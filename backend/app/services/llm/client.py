"""
Streaming chat client for Google Gemini (generateContent over SSE).

Called over plain HTTPS, so no SDK is needed. `stream_chat` takes
chat-style messages ([{"role": "system"|"user"|"assistant", "content": ...}])
and yields text chunks; `to_gemini` converts them to Gemini's format.

Configured by GEMINI_API_KEY / GEMINI_MODEL in backend/.env.
"""
import asyncio
import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings


class LLMUnavailable(Exception):
    """No API key configured, Gemini rejected the request, or it couldn't be reached."""


def to_gemini(messages: list[dict]) -> dict:
    """Chat messages → Gemini request body (system → systemInstruction, assistant → model)."""
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in messages if m["role"] != "system"
    ]
    body: dict = {"contents": contents}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    return body


RETRY_DELAYS = (1.0, 2.5)   # seconds; Gemini's 503 "high demand" spikes are usually brief


class _Retryable(LLMUnavailable):
    """Temporary overload (503) — worth retrying before any text was streamed."""


async def stream_chat(messages: list[dict], temperature: float = 0.2) -> AsyncIterator[str]:
    s = get_settings()
    if not s.GEMINI_API_KEY:
        raise LLMUnavailable("No Gemini API key set. Add GEMINI_API_KEY to backend/.env.")
    body = {**to_gemini(messages), "generationConfig": {"temperature": temperature}}
    timeout = httpx.Timeout(s.LLM_TIMEOUT_SECONDS, connect=10.0)

    # Retry the main model with backoff; if it's still busy, try the fallback once.
    plan = [(s.GEMINI_MODEL, delay) for delay in (0.0, *RETRY_DELAYS)]
    if s.GEMINI_FALLBACK_MODEL and s.GEMINI_FALLBACK_MODEL != s.GEMINI_MODEL:
        plan.append((s.GEMINI_FALLBACK_MODEL, 0.0))

    for attempt, (model, delay) in enumerate(plan):
        if delay:
            await asyncio.sleep(delay)
        try:
            async with httpx.AsyncClient(base_url=s.GEMINI_BASE_URL, timeout=timeout) as client:
                async with client.stream(
                    "POST", f"/models/{model}:streamGenerateContent",
                    params={"alt": "sse"},
                    headers={"x-goog-api-key": s.GEMINI_API_KEY},
                    json=body,
                ) as resp:
                    await _raise_for_status(resp)
                    async for data in _sse_data(resp):
                        for cand in data.get("candidates", []):
                            for part in (cand.get("content") or {}).get("parts", []):
                                if part.get("text"):
                                    yield part["text"]
            return
        except _Retryable as e:
            # Status errors arrive before any text, so retrying can't duplicate output.
            if attempt == len(plan) - 1:
                raise LLMUnavailable(str(e))
        except (httpx.ConnectError, httpx.ConnectTimeout):
            raise LLMUnavailable("Can't reach the Gemini API. Check your internet connection.")
        except httpx.HTTPError as e:
            raise LLMUnavailable(f"Gemini request failed: {e}")


async def _sse_data(resp: httpx.Response) -> AsyncIterator[dict]:
    """Yields the JSON payload of each `data:` line in an SSE stream."""
    async for line in resp.aiter_lines():
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload and payload != "[DONE]":
            yield json.loads(payload)


async def _raise_for_status(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    body = (await resp.aread()).decode(errors="replace")
    try:
        detail = json.loads(body).get("error", {})
        message = detail.get("message", body) if isinstance(detail, dict) else str(detail)
    except (ValueError, AttributeError):
        message = body
    if resp.status_code in (401, 403) or "API key not valid" in message:
        raise LLMUnavailable("Gemini rejected the API key — check GEMINI_API_KEY in backend/.env.")
    if resp.status_code == 404:
        raise LLMUnavailable(f"Gemini model not found — check GEMINI_MODEL in backend/.env ({message[:120]}).")
    if resp.status_code == 503:
        raise _Retryable("Gemini is busy right now (high demand). Please try again in a minute.")
    if resp.status_code == 429:
        raise LLMUnavailable(f"Gemini rate limit or quota reached: {message[:200]}")
    raise LLMUnavailable(f"Gemini returned {resp.status_code}: {message[:200]}")
