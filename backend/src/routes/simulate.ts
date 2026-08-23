import { Router } from "express";
import { loadFinancialProfile } from "../db/profile.js";
import { simulateLoan, simulateIncomeLoss } from "../engine/simulation.js";
import { resolveUser } from "./users.js";

export const simulateRouter = Router();

simulateRouter.post("/loan", async (req, res) => {
  const { principal, annualRatePercent, tenureMonths } = req.body as {
    principal: number;
    annualRatePercent: number;
    tenureMonths: number;
  };
  if (!principal || !tenureMonths) {
    return res.status(400).json({ error: "principal and tenureMonths are required" });
  }

  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const profile = await loadFinancialProfile(user.id);
  const result = simulateLoan(profile, principal, annualRatePercent ?? 0, tenureMonths);
  res.json(result);
});

simulateRouter.post("/income-loss", async (req, res) => {
  const { months } = req.body as { months: number };
  if (!months || months <= 0) {
    return res.status(400).json({ error: "months must be a positive number" });
  }

  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const profile = await loadFinancialProfile(user.id);
  const result = simulateIncomeLoss(profile, months);
  res.json(result);
});
