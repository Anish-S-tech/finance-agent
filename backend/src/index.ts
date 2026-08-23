import "dotenv/config";
import express from "express";
import cors from "cors";
import { usersRouter } from "./routes/users.js";
import { profileRouter } from "./routes/profile.js";
import { healthRouter } from "./routes/health.js";
import { forecastRouter } from "./routes/forecast.js";
import { affordRouter } from "./routes/afford.js";
import { simulateRouter } from "./routes/simulate.js";
import { actionPlanRouter } from "./routes/actionPlan.js";
import { chatRouter } from "./routes/chat.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/ping", (_req, res) => res.json({ ok: true }));

app.use("/api/users", usersRouter);
app.use("/api/profile", profileRouter);
app.use("/api/health", healthRouter);
app.use("/api/forecast", forecastRouter);
app.use("/api/afford", affordRouter);
app.use("/api/simulate", simulateRouter);
app.use("/api/action-plan", actionPlanRouter);
app.use("/api/chat", chatRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Money Mentor backend listening on http://localhost:${port}`);
});
