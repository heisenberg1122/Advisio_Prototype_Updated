import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
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
  appearancePreference?: "LIGHT" | "DARK" | "SYSTEM";
  colorThemePreference?: "DEFAULT_ADVISIO" | "COLLEGE_PROGRAM";
  roles: string[];
  permissions: string[];
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionError: string | null;
  retrySession: () => void;
  login: (email: string, password?: string) => Promise<{ success: boolean; role?: string; error?: string }>;
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; role?: string; needsAcademicSetup?: boolean; error?: string }>;
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

  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const hydratedToken = useRef<string | null>(null);
  const retrySession = () => { setIsLoading(true); setSessionAttempt((value) => value + 1); };
  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      if (!token) { setIsLoading(false); return; }
      if (hydratedToken.current === token) { setIsLoading(false); return; }
      setIsLoading(true); setSessionError(null);
      try {
        const data = await apiClient.get<{ user: UserProfile }>("/api/auth/me");
        if (cancelled) return;
        hydratedToken.current = token; setUser(data.user);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.statusCode === 401) {
          localStorage.removeItem("advisio_token");
          for (const key of ["advisio_theme:active", "advisio_color-theme:active", "advisio_college-theme:active"]) localStorage.removeItem(key);
          setToken(null); setUser(null); hydratedToken.current = null;
        } else { setSessionError("We could not restore your session. Check your connection and try again."); }
      } finally { if (!cancelled) setIsLoading(false); }
    }
    loadUser();
    return () => { cancelled = true; };
  }, [token, sessionAttempt]);
  async function hydrateSession(sessionToken: string) {
    setSessionError(null);
    localStorage.setItem("advisio_token", sessionToken);
    try {
      const profile = await apiClient.get<{ user: UserProfile }>("/api/auth/me", { headers: { Authorization: `Bearer ${sessionToken}` } });
      if (localStorage.getItem("advisio_token") !== sessionToken) return;
      hydratedToken.current = sessionToken; setUser(profile.user); setSessionError(null);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        localStorage.removeItem("advisio_token"); setUser(null); setToken(null); throw error;
      }
    }
    if (localStorage.getItem("advisio_token") === sessionToken) {
      if (hydratedToken.current !== sessionToken) { setUser(null); setIsLoading(true); }
      setToken(sessionToken);
    }
  }

  const login = async (email: string, password?: string) => {
    try {
      const data = await apiClient.post<{
        message: string;
        token: string;
        user: { id: string; universityId: string; email: string; firstName: string; lastName: string; roles: string[] };
      }>("/api/auth/login", { email, password });

      await hydrateSession(data.token);

      const primaryRole = (data.user.roles[0] || "RESEARCHER").toLowerCase();
      return { success: true, role: primaryRole };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to sign in" };
    }
  };

  const loginWithGoogle = async (credential: string) => {
    try {
      const data = await apiClient.post<{
        message: string;
        token: string;
        needsAcademicSetup?: boolean;
        user: { id: string; universityId: string; email: string; firstName: string; lastName: string; roles: string[] };
      }>("/api/auth/google", { credential });

      await hydrateSession(data.token);

      return {
        success: true,
        role: (data.user.roles[0] || "RESEARCHER").toLowerCase(),
        needsAcademicSetup: data.needsAcademicSetup === true,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Google sign-in failed" };
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

      if (data.token) await hydrateSession(data.token);

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
      localStorage.removeItem("advisio_theme:active");
      localStorage.removeItem("advisio_color-theme:active");
      localStorage.removeItem("advisio_college-theme:active");
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
        sessionError,
        retrySession,
        login,
        loginWithGoogle,
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
                <p className="mt-1 text-base text-slate-500 leading-relaxed">
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
      sessionError: null,
      retrySession: () => {},
      login: async () => ({ success: false, role: undefined, error: "AuthProvider not mounted" }),
      loginWithGoogle: async () => ({ success: false, needsAcademicSetup: false, error: "AuthProvider not mounted" }),
      register: async () => ({ success: false, error: "AuthProvider not mounted" }),
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("advisio_token");
          localStorage.removeItem("advisio_theme:active");
          localStorage.removeItem("advisio_color-theme:active");
          localStorage.removeItem("advisio_college-theme:active");
          window.location.href = "/login";
        }
      },
    };
  }
  return context;
}

