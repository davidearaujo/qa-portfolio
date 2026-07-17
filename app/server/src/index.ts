import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./db"; // initializes the SQLite schema on boot
import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// Simple health check — useful for uptime checks and as a trivial
// "does the API even respond" smoke test in Postman/CI.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`TaskFlow API listening on http://localhost:${PORT}`);
});
