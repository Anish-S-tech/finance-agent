import { Router } from "express";
import { loadFinancialProfile } from "../db/profile.js";
import { getAvailableBalance } from "../engine/types.js";
import { projectCashFlow } from "../engine/forecast.js";
import { resolveUser } from "./users.js";

export const forecastRouter = Router();

forecastRouter.get("/", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const profile = await loadFinancialProfile(user.id);
  const days = req.query.days ? Number(req.query.days) : 30;
  const startingBalance = getAvailableBalance(profile);
  const result = projectCashFlow(profile, startingBalance, days);
  res.json(result);
});
