import { Router } from "express";
import { prisma } from "../db/client.js";
import { loadFinancialProfile } from "../db/profile.js";
import { getAvailableBalance } from "../engine/types.js";
import { calculateHealthScore } from "../engine/healthScore.js";
import { projectCashFlow } from "../engine/forecast.js";
import { generateActionPlan } from "../engine/actionPlan.js";
import { getAIProvider, MENTOR_SYSTEM_PROMPT, type ChatTurn } from "../ai/index.js";
import { resolveUser } from "./users.js";

export const chatRouter = Router();

chatRouter.get("/", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const messages = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

chatRouter.post("/", async (req, res) => {
  const { message } = req.body as { message: string };
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const profile = await loadFinancialProfile(user.id);
  const availableBalance = getAvailableBalance(profile);

  const financialContext = {
    healthScore: calculateHealthScore(profile),
    cashFlowForecast30d: projectCashFlow(profile, availableBalance, 30),
    actionPlan: generateActionPlan(profile),
  };

  const priorMessages = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const history: ChatTurn[] = priorMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  await prisma.chatMessage.create({ data: { userId: user.id, role: "user", content: message } });

  try {
    const provider = getAIProvider();
    const reply = await provider.generateReply({
      systemPrompt: MENTOR_SYSTEM_PROMPT,
      financialContext,
      history,
      userMessage: message,
    });

    await prisma.chatMessage.create({ data: { userId: user.id, role: "assistant", content: reply } });
    res.json({ reply });
  } catch (err) {
    res.status(502).json({
      error: "AI provider request failed. Check that the API key for your configured AI_PROVIDER is set in backend/.env.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});
