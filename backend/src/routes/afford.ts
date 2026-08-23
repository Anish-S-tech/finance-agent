import { Router } from "express";
import { loadFinancialProfile } from "../db/profile.js";
import { getAvailableBalance } from "../engine/types.js";
import { evaluateAffordability } from "../engine/affordability.js";
import { resolveUser } from "./users.js";

export const affordRouter = Router();

affordRouter.post("/", async (req, res) => {
  const { amount, itemLabel } = req.body as { amount: number; itemLabel: string };
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const profile = await loadFinancialProfile(user.id);
  const currentBalance = getAvailableBalance(profile);
  const result = evaluateAffordability(profile, currentBalance, amount, itemLabel ?? "this purchase");
  res.json(result);
});
