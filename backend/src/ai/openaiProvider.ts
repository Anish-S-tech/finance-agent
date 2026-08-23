import OpenAI from "openai";
import type { AIProvider } from "./provider.js";
import { buildContextBlock } from "./prompts.js";

export class OpenAIProvider implements AIProvider {
  constructor(
    private apiKey: string = process.env.OPENAI_API_KEY ?? "",
    private model: string = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
  ) {}

  async generateReply(params: {
    systemPrompt: string;
    financialContext: unknown;
    history: { role: "user" | "assistant"; content: string }[];
    userMessage: string;
  }): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not set. Add it to backend/.env to use AI_PROVIDER=openai.");
    }

    const client = new OpenAI({ apiKey: this.apiKey });

    const completion = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: `${params.systemPrompt}\n\n${buildContextBlock(params.financialContext)}` },
        ...params.history,
        { role: "user", content: params.userMessage },
      ],
    });

    return completion.choices[0]?.message?.content ?? "";
  }
}
