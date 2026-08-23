export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIProvider {
  /**
   * Generates a reply given a system prompt (guardrails), the current financial
   * context as a JSON-serializable summary, prior chat history, and the new user message.
   */
  generateReply(params: {
    systemPrompt: string;
    financialContext: unknown;
    history: ChatTurn[];
    userMessage: string;
  }): Promise<string>;
}
