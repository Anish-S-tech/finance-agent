import type { AIProvider } from "./provider.js";
import { ClaudeProvider } from "./claudeProvider.js";
import { OpenAIProvider } from "./openaiProvider.js";
import { GeminiProvider } from "./geminiProvider.js";

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.AI_PROVIDER ?? "claude").toLowerCase();

  switch (providerName) {
    case "openai":
      cachedProvider = new OpenAIProvider();
      break;
    case "gemini":
      cachedProvider = new GeminiProvider();
      break;
    case "claude":
      cachedProvider = new ClaudeProvider();
      break;
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${providerName}". Expected one of: claude, openai, gemini.`
      );
  }

  return cachedProvider;
}

export type { AIProvider, ChatTurn } from "./provider.js";
export { MENTOR_SYSTEM_PROMPT } from "./prompts.js";
