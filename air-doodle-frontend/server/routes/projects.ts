import { Response } from "express";
import { AuthenticatedRequest } from "./auth";
import { db } from "../services/db";

export function handleListProjects(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const projects = db.listProjects(req.user.id);
  const response = projects.map(p => ({
    id: p.id,
    title: p.title,
    shapeCount: p.shapes.length,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
  res.json(response);
}

export function handleCreateProject(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const { title } = req.body;
  const project = db.createProject(title, req.user.id);
  res.status(201).json({
    id: project.id,
    title: project.title,
    shapeCount: 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

export function handleGetProject(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const shareToken = req.query.shareToken as string | undefined;

  const project = db.getProject(id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const permission = db.getUserProjectPermission(id, req.user?.id, shareToken);
  if (!permission) {
    return res.status(403).json({ error: "You don't have access to this project" });
  }

  res.json({
    id: project.id,
    title: project.title,
    shapes: project.shapes,
    permission,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

export function handleUpdateProject(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { title, shapes } = req.body;
  const shareToken = req.query.shareToken as string | undefined;

  const project = db.getProject(id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const permission = db.getUserProjectPermission(id, req.user?.id, shareToken);
  if (!permission) {
    return res.status(403).json({ error: "You don't have access to this project" });
  }

  if (permission === "view") {
    return res.status(403).json({ error: "View-only access: you cannot modify this project" });
  }

  try {
    const updated = db.updateProject(id, { title, shapes });
    res.json({
      success: true,
      id: updated.id,
      title: updated.title,
      updatedAt: updated.updatedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update project";
    res.status(404).json({ error: message });
  }
}

export function handleDeleteProject(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const project = db.getProject(id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  // Only owner can delete
  if (!req.user || project.userId !== req.user.id) {
    return res.status(403).json({ error: "Only the project owner can delete it" });
  }

  const success = db.deleteProject(id);
  if (!success) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json({ success: true });
}

// ─── Sharing routes ──────────────────────────────────────────────
export function handleCreateShare(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { permission } = req.body;

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const project = db.getProject(id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.userId !== req.user.id) {
    return res.status(403).json({ error: "Only the project owner can share it" });
  }

  const validPerms = ["view", "edit"] as const;
  const perm = validPerms.includes(permission) ? permission : "view";

  const share = db.createShareToken(id, perm);
  res.status(201).json(share);
}

export function handleListShares(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const project = db.getProject(id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.userId !== req.user.id) {
    return res.status(403).json({ error: "Only the project owner can manage shares" });
  }

  const shares = db.listSharesForProject(id);
  res.json(shares);
}

export function handleUpdateShare(req: AuthenticatedRequest, res: Response) {
  const { id, shareToken } = req.params;
  const { permission } = req.body;

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const project = db.getProject(id);
  if (!project || project.userId !== req.user.id) {
    return res.status(403).json({ error: "Only the project owner can manage shares" });
  }

  const updated = db.updateSharePermission(shareToken, permission);
  if (!updated) {
    return res.status(404).json({ error: "Share not found" });
  }

  res.json(updated);
}

export function handleRevokeShare(req: AuthenticatedRequest, res: Response) {
  const { id, shareToken } = req.params;

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const project = db.getProject(id);
  if (!project || project.userId !== req.user.id) {
    return res.status(403).json({ error: "Only the project owner can manage shares" });
  }

  const success = db.revokeShare(shareToken);
  if (!success) {
    return res.status(404).json({ error: "Share not found" });
  }

  res.json({ success: true });
}

/** Get shapes preview (first few shapes) for project listing thumbnails */
export function handleGetProjectPreview(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const project = db.getProject(id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.userId !== req.user.id) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Return shape data for thumbnail rendering
  res.json({
    id: project.id,
    shapes: project.shapes,
  });
}
