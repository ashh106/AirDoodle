import { User } from "@/types/user";
import { visionAgent } from "./vision.service";

export interface AuthResponse {
  user: User;
  token?: string;
}

export interface ForgotPasswordResponse {
  message: string;
  _dev_reset_url?: string;
  _dev_notice?: string;
}

const TOKEN_KEY = "air-doodle-token";
const USER_KEY = "air-doodle-user";

export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Invalid email or password");
    }

    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },

  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Registration failed");
    }

    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },

  loginWithGoogle: async (credential: string): Promise<AuthResponse> => {
    const response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Google Sign-In failed");
    }

    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },

  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to process forgot password request");
    }
    return data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to reset password");
    }
    return data;
  },

  logout: () => {
    try {
      visionAgent.stopCapture();
      visionAgent.disconnect();
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("user");
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(USER_KEY) || localStorage.getItem("user");
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  },

  /** Validate the current token is still valid with the server */
  validateSession: async (): Promise<User | null> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        // Token is expired or invalid — clean up
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        return null;
      }
      const data = await response.json();
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      return data.user ?? null;
    } catch {
      // Server not reachable — keep the cached user but don't clear credentials
      const stored = localStorage.getItem(USER_KEY);
      if (stored) {
        try { return JSON.parse(stored) as User; } catch { return null; }
      }
      return null;
    }
  },
};
