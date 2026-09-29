"""Gemini streaming client, tested against mocked HTTP responses."""
import asyncio
import json

import httpx
import pytest

from app.core.config import get_settings
from app.services.llm import client
from app.services.llm.client import LLMUnavailable, stream_chat, to_gemini

MESSAGES = [
    {"role": "system", "content": "You are FinMentor."},
    {"role": "user", "content": "hi"},
    {"role": "assistant", "content": "hello"},
    {"role": "user", "content": "how am I doing?"},
]


@pytest.fixture
def settings(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "GEMINI_API_KEY", "g-test")
    monkeypatch.setattr(s, "GEMINI_MODEL", "gemini-test")
    monkeypatch.setattr(s, "GEMINI_FALLBACK_MODEL", "gemini-fallback")
    return s


def mock_http(monkeypatch, handler):
    """Route every httpx.AsyncClient the module creates through `handler`, recording requests."""
    seen: list[httpx.Request] = []
    real = httpx.AsyncClient

    def record(request):
        seen.append(request)
        return handler(request)

    monkeypatch.setattr(client.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(record), base_url=kw["base_url"]))
    return seen


def sse(*payloads) -> bytes:
    return "".join(f"data: {json.dumps(p)}\n\n" for p in payloads).encode()


def collect(messages=MESSAGES):
    async def run():
        return [c async for c in stream_chat(messages)]
    return asyncio.run(run())


def test_streams_text_parts(settings, monkeypatch):
    body = sse({"candidates": [{"content": {"parts": [{"text": "Namaste "}]}}]},
               {"candidates": [{"content": {"parts": [{"text": "Aarav"}]}}]})
    seen = mock_http(monkeypatch, lambda req: httpx.Response(200, content=body))

    assert collect() == ["Namaste ", "Aarav"]
    req = seen[0]
    assert req.url.path.endswith("/models/gemini-test:streamGenerateContent")
    assert req.url.params["alt"] == "sse"
    assert req.headers["x-goog-api-key"] == "g-test"
    sent = json.loads(req.content)
    assert sent["systemInstruction"]["parts"][0]["text"] == "You are FinMentor."
    assert [c["role"] for c in sent["contents"]] == ["user", "model", "user"]
    assert sent["generationConfig"]["temperature"] == 0.2


def test_to_gemini_without_system_prompt():
    assert "systemInstruction" not in to_gemini([{"role": "user", "content": "hi"}])


def test_missing_key_is_reported_without_calling_the_api(settings, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    seen = mock_http(monkeypatch, lambda req: httpx.Response(200))
    with pytest.raises(LLMUnavailable, match="GEMINI_API_KEY"):
        collect()
    assert seen == []


@pytest.mark.parametrize("status,message,match", [
    (400, "API key not valid. Please pass a valid API key.", "GEMINI_API_KEY"),
    (403, "forbidden", "GEMINI_API_KEY"),
    (404, "models/x is not found", "GEMINI_MODEL"),
    (429, "Resource exhausted", "quota"),
    (500, "internal", "returned 500"),
])
def test_http_errors_are_explained(settings, monkeypatch, status, message, match):
    mock_http(monkeypatch, lambda req: httpx.Response(status, json={"error": {"message": message}}))
    with pytest.raises(LLMUnavailable, match=match):
        collect()


def test_retries_when_gemini_is_overloaded(settings, monkeypatch):
    monkeypatch.setattr(client, "RETRY_DELAYS", (0, 0))
    ok = sse({"candidates": [{"content": {"parts": [{"text": "back"}]}}]})
    responses = iter([httpx.Response(503, json={"error": {"message": "high demand"}}),
                      httpx.Response(200, content=ok)])
    seen = mock_http(monkeypatch, lambda req: next(responses))
    assert collect() == ["back"]
    assert len(seen) == 2


def test_falls_back_to_second_model_when_main_stays_busy(settings, monkeypatch):
    monkeypatch.setattr(client, "RETRY_DELAYS", (0, 0))
    ok = sse({"candidates": [{"content": {"parts": [{"text": "from fallback"}]}}]})

    def handler(req):
        if "gemini-fallback" in req.url.path:
            return httpx.Response(200, content=ok)
        return httpx.Response(503, json={"error": {"message": "high demand"}})

    seen = mock_http(monkeypatch, handler)
    assert collect() == ["from fallback"]
    assert [r.url.path.split("/")[-1] for r in seen] == [
        "gemini-test:streamGenerateContent"] * 3 + ["gemini-fallback:streamGenerateContent"]


def test_gives_up_when_everything_is_busy(settings, monkeypatch):
    monkeypatch.setattr(client, "RETRY_DELAYS", (0, 0))
    seen = mock_http(monkeypatch, lambda req: httpx.Response(503, json={"error": {"message": "high demand"}}))
    with pytest.raises(LLMUnavailable, match="busy right now"):
        collect()
    assert len(seen) == 4


def test_no_fallback_when_disabled(settings, monkeypatch):
    monkeypatch.setattr(client, "RETRY_DELAYS", (0, 0))
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODEL", "")
    seen = mock_http(monkeypatch, lambda req: httpx.Response(503, json={"error": {"message": "high demand"}}))
    with pytest.raises(LLMUnavailable):
        collect()
    assert len(seen) == 3


def test_network_failure(settings, monkeypatch):
    def boom(req):
        raise httpx.ConnectError("no route", request=req)
    mock_http(monkeypatch, boom)
    with pytest.raises(LLMUnavailable, match="Can't reach the Gemini API"):
        collect()
