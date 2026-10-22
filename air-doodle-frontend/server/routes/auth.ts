import { Request, Response, NextFunction } from "express";
import { db } from "../services/db";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];
  const payload = db.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = db.findUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = { id: user.id, name: user.name, email: user.email };
  next();
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = db.verifyToken(token);
    if (payload) {
      const user = db.findUserById(payload.userId);
      if (user) {
        req.user = { id: user.id, name: user.name, email: user.email };
      }
    }
  }
  next();
}

export function handleRegister(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const user = db.createUser(name, email, password);
    const token = db.generateToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
      },
      token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(400).json({ error: message });
  }
}

export function handleLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.findUserByEmail(email);
    if (!user || !db.verifyPassword(user, password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = db.generateToken(user);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
      },
      token,
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
}

export function handleMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.json({
    user: {
      ...req.user,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.user.email)}`,
    },
  });
}

// ─── Forgot Password ─────────────────────────────────────────────
export function handleForgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Generic response to prevent account enumeration
  const genericMessage = "If an account with that email exists, a password reset link has been sent.";

  const user = db.findUserByEmail(email);
  if (!user) {
    // Don't reveal whether the email exists
    return res.json({ message: genericMessage });
  }

  const rawToken = db.createResetToken(user.id);

  // Check for email configuration
  const emailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const isProduction = process.env.NODE_ENV === "production";

  if (emailConfigured) {
    // TODO: Send actual email via SMTP here
    // For now, log that email would be sent
    console.log(`[Auth] Password reset email would be sent to ${email}`);
    return res.json({ message: genericMessage });
  }

  if (isProduction) {
    // In production without email config, log an error but don't expose the token
    console.error("[Auth] SMTP not configured. Cannot send password reset email in production.");
    return res.json({ message: genericMessage });
  }

  // Development only: return the reset link for testing
  console.log(`[Auth][DEV ONLY] Reset token generated for ${email}`);
  return res.json({
    message: genericMessage,
    _dev_reset_url: `/reset-password?token=${rawToken}`,
    _dev_notice: "This field is only available in development mode without SMTP configuration.",
  });
}

export function handleResetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const result = db.verifyResetToken(token);
  if (!result) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const consumed = db.consumeResetToken(token);
  if (!consumed) {
    return res.status(400).json({ error: "Reset token has already been used" });
  }

  try {
    db.updatePassword(result.userId, newPassword);
    res.json({ message: "Password has been reset successfully" });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
}

// ─── Google Sign-In ──────────────────────────────────────────────
export async function handleGoogleLogin(req: Request, res: Response) {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Google credential is required" });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({ error: "Google Sign-In is not configured on this server" });
  }

  try {
    // Verify the Google ID token by calling Google's tokeninfo endpoint
    const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyResponse.ok) {
      return res.status(401).json({ error: "Invalid Google credential" });
    }

    const payload = await verifyResponse.json() as {
      sub: string;
      email: string;
      email_verified: string;
      name: string;
      aud: string;
    };

    // Verify audience matches our client ID
    if (payload.aud !== clientId) {
      return res.status(401).json({ error: "Google token audience mismatch" });
    }

    if (payload.email_verified !== "true") {
      return res.status(401).json({ error: "Google email not verified" });
    }

    const user = db.createOrUpdateGoogleUser(payload.sub, payload.email, payload.name);
    const token = db.generateToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
      },
      token,
    });
  } catch (err) {
    console.error("[Auth] Google login error:", err);
    res.status(500).json({ error: "Google authentication failed" });
  }
}
