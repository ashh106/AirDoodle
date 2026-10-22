import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleRegister,
  handleLogin,
  handleMe,
  handleForgotPassword,
  handleResetPassword,
  handleGoogleLogin,
  authMiddleware,
  optionalAuthMiddleware,
} from "./routes/auth";
import {
  handleListProjects,
  handleCreateProject,
  handleGetProject,
  handleUpdateProject,
  handleDeleteProject,
  handleCreateShare,
  handleListShares,
  handleUpdateShare,
  handleRevokeShare,
  handleGetProjectPreview,
} from "./routes/projects";
import { handleRecognize } from "./routes/recognize";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Status & Demo
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping, timestamp: new Date().toISOString() });
  });
  app.get("/api/demo", handleDemo);

  // Authentication
  app.post("/api/auth/register", handleRegister);
  app.post("/api/auth/login", handleLogin);
  app.get("/api/auth/me", authMiddleware, handleMe);
  app.post("/api/auth/forgot-password", handleForgotPassword);
  app.post("/api/auth/reset-password", handleResetPassword);
  app.post("/api/auth/google", handleGoogleLogin);

  // Projects (authenticated or token-based)
  app.get("/api/projects", optionalAuthMiddleware, handleListProjects);
  app.post("/api/projects", optionalAuthMiddleware, handleCreateProject);
  app.get("/api/projects/:id", optionalAuthMiddleware, handleGetProject);
  app.put("/api/projects/:id", optionalAuthMiddleware, handleUpdateProject);
  app.delete("/api/projects/:id", optionalAuthMiddleware, handleDeleteProject);
  app.get("/api/projects/:id/preview", optionalAuthMiddleware, handleGetProjectPreview);

  // Project Sharing
  app.post("/api/projects/:id/shares", authMiddleware, handleCreateShare);
  app.get("/api/projects/:id/shares", authMiddleware, handleListShares);
  app.put("/api/projects/:id/shares/:shareToken", authMiddleware, handleUpdateShare);
  app.delete("/api/projects/:id/shares/:shareToken", authMiddleware, handleRevokeShare);

  // Geometry recognition
  app.post("/api/recognize", handleRecognize);

  return app;
}
