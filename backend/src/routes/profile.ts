import { Router } from "express";
import { prisma } from "../db/client.js";
import { resolveUser } from "./users.js";

export const profileRouter = Router();

profileRouter.get("/", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const [income, expenses, loans, savings] = await Promise.all([
    prisma.incomeSource.findMany({ where: { userId: user.id } }),
    prisma.expense.findMany({ where: { userId: user.id } }),
    prisma.loan.findMany({ where: { userId: user.id } }),
    prisma.savingsAccount.findMany({ where: { userId: user.id } }),
  ]);
  res.json({ user, income, expenses, loans, savings });
});

profileRouter.post("/income", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const { label, amount, frequency } = req.body;
  const created = await prisma.incomeSource.create({
    data: { userId: user.id, label, amount, frequency },
  });
  res.status(201).json(created);
});

profileRouter.post("/expenses", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const { label, category, amount, isRecurring, dueDay } = req.body;
  const created = await prisma.expense.create({
    data: { userId: user.id, label, category, amount, isRecurring: isRecurring ?? true, dueDay },
  });
  res.status(201).json(created);
});

profileRouter.post("/loans", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const { label, principal, emiAmount, interestRate, remainingMonths, dueDay } = req.body;
  const created = await prisma.loan.create({
    data: { userId: user.id, label, principal, emiAmount, interestRate, remainingMonths, dueDay },
  });
  res.status(201).json(created);
});

profileRouter.post("/savings", async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(400).json({ error: "Missing or invalid X-User-Id header" });

  const { label, balance, type } = req.body;
  const created = await prisma.savingsAccount.create({
    data: { userId: user.id, label, balance, type },
  });
  res.status(201).json(created);
});

profileRouter.delete("/income/:id", async (req, res) => {
  await prisma.incomeSource.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

profileRouter.delete("/expenses/:id", async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

profileRouter.delete("/loans/:id", async (req, res) => {
  await prisma.loan.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

profileRouter.delete("/savings/:id", async (req, res) => {
  await prisma.savingsAccount.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
