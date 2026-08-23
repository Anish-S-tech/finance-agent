import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "./provider.js";
import { buildContextBlock } from "./prompts.js";

export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string = process.env.GEMINI_API_KEY ?? "",
    private model: string = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
  ) {}

  async generateReply(params: {
    systemPrompt: string;
    financialContext: unknown;
    history: { role: "user" | "assistant"; content: string }[];
    userMessage: string;
  }): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Add it to backend/.env to use AI_PROVIDER=gemini.");
    }

    const client = new GoogleGenAI({ apiKey: this.apiKey });

    const contents = [
      ...params.history.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      })),
      { role: "user", parts: [{ text: params.userMessage }] },
    ];

    const response = await client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: `${params.systemPrompt}\n\n${buildContextBlock(params.financialContext)}`,
      },
    });

    return response.text ?? "";
  }
}
