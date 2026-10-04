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
  register: (payload: any) => Promise<{ success: boolean; isPending?: boolean; message?: string; user?: any; onboardingToken?: string | null; error?: string }>;
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
        onboardingToken?: string | null;
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
        onboardingToken: data.onboardingToken,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to register" };
    }
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const confirmLogout = () => {
    setShowLogoutModal(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("advisio_token");
      setToken(null);
      setUser(null);
      window.location.href = "/login";
    }
  };

  const logout = () => {
    setShowLogoutModal(true);
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
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogoutModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
                <i className="ti ti-logout text-2xl" />
              </div>
              <div className="flex-1">
                <h3 id="logout-modal-title" className="text-lg font-bold text-slate-900">
                  Are you sure you want to log out?
                </h3>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                  You will be signed out of your session and returned to the login screen.
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                <i className="ti ti-logout text-base" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
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

