import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider } from "./provider.js";
import { buildContextBlock } from "./prompts.js";

export class ClaudeProvider implements AIProvider {
  constructor(
    private apiKey: string = process.env.ANTHROPIC_API_KEY ?? "",
    private model: string = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"
  ) {}

  async generateReply(params: {
    systemPrompt: string;
    financialContext: unknown;
    history: { role: "user" | "assistant"; content: string }[];
    userMessage: string;
  }): Promise<string> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Add it to backend/.env to use AI_PROVIDER=claude.");
    }

    const client = new Anthropic({ apiKey: this.apiKey });

    const message = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: `${params.systemPrompt}\n\n${buildContextBlock(params.financialContext)}`,
      messages: [...params.history, { role: "user", content: params.userMessage }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }
}
