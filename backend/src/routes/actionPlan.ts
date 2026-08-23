import { Router } from "express";
import { loadFinancialProfile } from "../db/profile.js";
import { generateActionPlan } from "../engine/actionPlan.js";
import { resolveUser } from "./users.js";

export const actionPlanRouter = Router();

actionPlanRouter.get("/", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const profile = await loadFinancialProfile(user.id);
  const result = generateActionPlan(profile);
  res.json(result);
});
