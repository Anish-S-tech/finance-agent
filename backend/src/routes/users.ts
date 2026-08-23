import { Router, type Request } from "express";
import { prisma } from "../db/client.js";

export const usersRouter = Router();

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ isSample: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, isSample: true },
  });
  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const email = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}@moneymentor.local`;
  const user = await prisma.user.create({
    data: { name: name.trim(), email, isSample: false },
  });
  res.status(201).json(user);
});

/**
 * Every data-bearing route is scoped to the user identified by the X-User-Id header
 * (set by the frontend's profile switcher). There's no auth — this is a single-machine
 * demo app — the header just replaces the old hardcoded "demo user" ID.
 */
export async function resolveUser(req: Request) {
  const userId = req.header("x-user-id");
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
