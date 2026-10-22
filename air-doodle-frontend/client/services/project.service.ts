import { Project } from "@/types/project";
import { Shape } from "@/types/shape";
import { getAuthToken } from "./auth.service";

export interface LoadedProject extends Project {
  shapes: Shape[];
  permission?: "owner" | "view" | "edit";
}

export interface ShareLinkResponse {
  token: string;
  projectId: string;
  permission: "view" | "edit";
  createdAt: string;
}

const getHeaders = () => {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

export const listProjects = async (): Promise<Project[]> => {
  const token = getAuthToken();
  if (!token) return [];

  const res = await fetch("/api/projects", { headers: getHeaders() });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Authentication required");
    }
    throw new Error("Failed to load projects");
  }
  return res.json();
};

export const createProject = async (title: string): Promise<Project> => {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to create project");
  }
  return res.json();
};

export const loadProject = async (id: string, shareToken?: string): Promise<LoadedProject> => {
  const query = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : "";
  const res = await fetch(`/api/projects/${id}${query}`, { headers: getHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Project not found or access denied");
  }
  return res.json();
};

export const saveProject = async (id: string, shapes: Shape[], title?: string, shareToken?: string): Promise<void> => {
  const query = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : "";
  const body: Record<string, any> = { shapes };
  if (title !== undefined) body.title = title;

  const res = await fetch(`/api/projects/${id}${query}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server returned ${res.status}`);
  }
};

export const renameProject = async (id: string, title: string): Promise<void> => {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to rename project");
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  const res = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete project");
  }
};

export const getProjectPreview = async (id: string): Promise<{ id: string; shapes: Shape[] }> => {
  const res = await fetch(`/api/projects/${id}/preview`, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error("Failed to load preview");
  }
  return res.json();
};

// ─── Sharing API ──────────────────────────────────────────────
export const createShareLink = async (projectId: string, permission: "view" | "edit"): Promise<ShareLinkResponse> => {
  const res = await fetch(`/api/projects/${projectId}/shares`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ permission }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to create share link");
  }
  return res.json();
};

export const listShares = async (projectId: string): Promise<ShareLinkResponse[]> => {
  const res = await fetch(`/api/projects/${projectId}/shares`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to list shares");
  }
  return res.json();
};

export const revokeShare = async (projectId: string, shareToken: string): Promise<void> => {
  const res = await fetch(`/api/projects/${projectId}/shares/${shareToken}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to revoke share");
  }
};
