import React, { useState, useEffect, ReactNode } from 'react';
import { User } from '@/types/user';
import { authService } from '@/services/auth.service';
import { AuthContext, useAuth } from './useAuth';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate stored session with the server on mount
    authService.validateSession()
      .then(validatedUser => {
        setUser(validatedUser);
      })
      .catch(() => {
        // If validation fails, fall back to cached user
        const cached = authService.getCurrentUser();
        setUser(cached);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const { user } = await authService.login(email, password);
    setUser(user);
  };

  const register = async (name: string, email: string, password: string) => {
    const { user } = await authService.register(name, email, password);
    setUser(user);
  };

  const loginWithGoogle = async (credential: string) => {
    const { user } = await authService.loginWithGoogle(credential);
    setUser(user);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      loginWithGoogle,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Re-export useAuth for backwards compatibility with existing imports
export { useAuth };
