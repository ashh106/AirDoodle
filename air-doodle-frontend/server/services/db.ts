import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Shape } from "../../shared/shape";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  googleId?: string;
  createdAt: string;
}

export interface ResetTokenRecord {
  tokenHash: string;
  userId: string;
  expiresAt: number;
  used: boolean;
}

export type SharePermission = "view" | "edit";

export interface ShareRecord {
  token: string;
  projectId: string;
  permission: SharePermission;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  title: string;
  shapes: Shape[];
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  projects: ProjectRecord[];
  resetTokens: ResetTokenRecord[];
  shares: ShareRecord[];
}

const DATA_DIR = fs.existsSync(path.resolve(process.cwd(), "server", "data"))
  ? path.resolve(process.cwd(), "server", "data")
  : fs.existsSync(path.resolve(process.cwd(), "air-doodle-frontend", "server", "data"))
  ? path.resolve(process.cwd(), "air-doodle-frontend", "server", "data")
  : path.resolve(process.cwd(), "server", "data");
const DB_FILE = path.join(DATA_DIR, "air-doodle-db.json");

function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.trim().length < 32) {
      console.error(
        "[Security Error] SESSION_SECRET must be configured with at least 32 characters in production environments."
      );
      process.exit(1);
    }
    return secret.trim();
  }

  // Development-only fallback
  return secret || "air-doodle-dev-only-session-secret-not-for-production";
}

const SECRET = resolveSessionSecret();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

class Database {
  private data: DatabaseSchema = { users: [], projects: [], resetTokens: [], shares: [] };
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        // Migrate: ensure new fields exist
        this.data = {
          users: parsed.users || [],
          projects: parsed.projects || [],
          resetTokens: parsed.resetTokens || [],
          shares: parsed.shares || [],
        };
      } else {
        // Fresh install: seed only the demo user, no sample projects
        this.seedDemoUser();
        this.save();
      }
    } catch {
      this.seedDemoUser();
    }
    this.initialized = true;
  }

  private seedDemoUser() {
    const existing = this.data.users.find(u => u.email === "demo@airdoodle.com");
    if (!existing) {
      this.data.users.push({
        id: "demo-user-1",
        name: "Demo User",
        email: "demo@airdoodle.com",
        salt: "demo-salt-1234",
        passwordHash: hashPassword("password123", "demo-salt-1234"),
        createdAt: new Date().toISOString(),
      });
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("[Database] Failed to write db to disk:", err);
    }
  }

  // ─── User methods ──────────────────────────────────────────────
  createUser(name: string, email: string, password: string): UserRecord {
    const existing = this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error("A user with this email already exists");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const user: UserRecord = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase(),
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(user);
    this.save();
    return user;
  }

  findUserByEmail(email: string): UserRecord | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): UserRecord | undefined {
    return this.data.users.find(u => u.id === id);
  }

  findUserByGoogleId(googleId: string): UserRecord | undefined {
    return this.data.users.find(u => u.googleId === googleId);
  }

  createOrUpdateGoogleUser(googleId: string, email: string, name: string): UserRecord {
    let user = this.findUserByGoogleId(googleId);
    if (user) {
      user.name = name;
      this.save();
      return user;
    }

    // Check if email already exists (non-Google user)
    const existing = this.findUserByEmail(email);
    if (existing) {
      // Link Google to existing account
      existing.googleId = googleId;
      this.save();
      return existing;
    }

    // Create new user with Google
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase(),
      salt: "",
      passwordHash: "",
      googleId,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  verifyPassword(user: UserRecord, password: string): boolean {
    if (!user.salt || !user.passwordHash) return false;
    const hash = hashPassword(password, user.salt);
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
    } catch {
      return false;
    }
  }

  updatePassword(userId: string, newPassword: string): void {
    const user = this.findUserById(userId);
    if (!user) throw new Error("User not found");
    const salt = crypto.randomBytes(16).toString("hex");
    user.salt = salt;
    user.passwordHash = hashPassword(newPassword, salt);
    this.save();
  }

  // ─── Token methods ─────────────────────────────────────────────
  generateToken(user: UserRecord): string {
    const payload = JSON.stringify({ userId: user.id, email: user.email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    const b64 = Buffer.from(payload).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
    return `${b64}.${sig}`;
  }

  verifyToken(token: string): { userId: string; email: string } | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) return null;
      const [b64, sig] = parts;
      const expectedSig = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
      if (sig !== expectedSig) return null;
      const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8"));
      if (payload.exp && payload.exp < Date.now()) return null;
      return { userId: payload.userId, email: payload.email };
    } catch {
      return null;
    }
  }

  // ─── Password reset token methods ──────────────────────────────
  createResetToken(userId: string): string {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Invalidate any existing tokens for this user
    this.data.resetTokens = this.data.resetTokens.filter(t => t.userId !== userId);

    this.data.resetTokens.push({
      tokenHash,
      userId,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      used: false,
    });
    this.save();
    return rawToken;
  }

  verifyResetToken(rawToken: string): { userId: string } | null {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const record = this.data.resetTokens.find(t => t.tokenHash === tokenHash);
    if (!record || record.used || record.expiresAt < Date.now()) return null;
    return { userId: record.userId };
  }

  consumeResetToken(rawToken: string): boolean {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const record = this.data.resetTokens.find(t => t.tokenHash === tokenHash);
    if (!record || record.used || record.expiresAt < Date.now()) return false;
    record.used = true;
    this.save();
    return true;
  }

  // ─── Project methods ───────────────────────────────────────────
  /** Returns only projects owned by the given userId */
  listProjects(userId: string): ProjectRecord[] {
    return this.data.projects.filter(p => p.userId === userId);
  }

  getProject(id: string): ProjectRecord | undefined {
    return this.data.projects.find(p => p.id === id);
  }

  createProject(title: string, userId: string): ProjectRecord {
    if (!userId) throw new Error("userId is required");
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      userId,
      title: title || "Untitled Project",
      shapes: [],
      createdAt: now,
      updatedAt: now,
    };
    this.data.projects.unshift(project);
    this.save();
    return project;
  }

  updateProject(id: string, updates: { title?: string; shapes?: Shape[] }): ProjectRecord {
    const project = this.getProject(id);
    if (!project) throw new Error("Project not found");
    if (updates.title !== undefined) project.title = updates.title;
    if (updates.shapes !== undefined) project.shapes = updates.shapes;
    project.updatedAt = new Date().toISOString();
    this.save();
    return project;
  }

  deleteProject(id: string): boolean {
    const idx = this.data.projects.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.data.projects.splice(idx, 1);
    // Also remove related shares
    this.data.shares = this.data.shares.filter(s => s.projectId !== id);
    this.save();
    return true;
  }

  // ─── Sharing methods ───────────────────────────────────────────
  createShareToken(projectId: string, permission: SharePermission): ShareRecord {
    const token = crypto.randomBytes(24).toString("base64url");
    const share: ShareRecord = {
      token,
      projectId,
      permission,
      createdAt: new Date().toISOString(),
    };
    this.data.shares.push(share);
    this.save();
    return share;
  }

  getShareByToken(token: string): ShareRecord | undefined {
    return this.data.shares.find(s => s.token === token);
  }

  listSharesForProject(projectId: string): ShareRecord[] {
    return this.data.shares.filter(s => s.projectId === projectId);
  }

  updateSharePermission(token: string, permission: SharePermission): ShareRecord | null {
    const share = this.data.shares.find(s => s.token === token);
    if (!share) return null;
    share.permission = permission;
    this.save();
    return share;
  }

  revokeShare(token: string): boolean {
    const idx = this.data.shares.findIndex(s => s.token === token);
    if (idx === -1) return false;
    this.data.shares.splice(idx, 1);
    this.save();
    return true;
  }

  /** Check if a user has access to a project (owner OR share token) */
  getUserProjectPermission(projectId: string, userId?: string, shareToken?: string): "owner" | SharePermission | null {
    const project = this.getProject(projectId);
    if (!project) return null;

    if (userId && project.userId === userId) return "owner";

    if (shareToken) {
      const share = this.getShareByToken(shareToken);
      if (share && share.projectId === projectId) return share.permission;
    }

    return null;
  }
}

export const db = new Database();
