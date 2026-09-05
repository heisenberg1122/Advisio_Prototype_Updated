import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

export interface UserProfile {
  id: string;
  universityId: string;
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  college?: { id: string; name: string; code: string } | null;
  program?: { id: string; name: string; code: string } | null;
  roles: string[];
  permissions: string[];
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; role?: string; error?: string }>;
  register: (payload: any) => Promise<{ success: boolean; isPending?: boolean; message?: string; user?: any; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== "undefined" ? localStorage.getItem("advisio_token") : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user session on mount
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiClient.get<{ user: UserProfile }>("/api/auth/me");
        setUser(data.user);
      } catch (err) {
        console.warn("Session expired or invalid, logging out.");
        localStorage.removeItem("advisio_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const login = async (email: string, password?: string) => {
    try {
      const data = await apiClient.post<{
        message: string;
        token: string;
        user: { id: string; universityId: string; email: string; firstName: string; lastName: string; roles: string[] };
      }>("/api/auth/login", { email, password });

      localStorage.setItem("advisio_token", data.token);
      setToken(data.token);

      // Hydrate profile
      const profile = await apiClient.get<{ user: UserProfile }>("/api/auth/me").catch(() => null);
      if (profile) {
        setUser(profile.user);
      }

      const primaryRole = (data.user.roles[0] || "RESEARCHER").toLowerCase();
      return { success: true, role: primaryRole };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to sign in" };
    }
  };

  const register = async (payload: any) => {
    try {
      const data = await apiClient.post<{
        message: string;
        token?: string;
        status?: string;
        user: any;
      }>("/api/auth/register", payload);

      if (data.token) {
        localStorage.setItem("advisio_token", data.token);
        setToken(data.token);

        const profile = await apiClient.get<{ user: UserProfile }>("/api/auth/me").catch(() => null);
        if (profile) {
          setUser(profile.user);
        }
      }

      return {
        success: true,
        isPending: data.status === "PENDING" || !data.token,
        message: data.message,
        user: data.user,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to register" };
    }
  };

  const logout = () => {
    localStorage.removeItem("advisio_token");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      token: typeof window !== "undefined" ? localStorage.getItem("advisio_token") : null,
      isLoading: false,
      isAuthenticated: false,
      login: async () => ({ success: false, role: undefined, error: "AuthProvider not mounted" }),
      register: async () => ({ success: false, error: "AuthProvider not mounted" }),
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("advisio_token");
          window.location.href = "/login";
        }
      },
    };
  }
  return context;
}

