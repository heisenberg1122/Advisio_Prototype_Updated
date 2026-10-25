import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowRight, Loader2, X } from "lucide-react";
import {
  type DashboardWorkspace,
  type DashboardWorkspaceId,
  getEligibleWorkspaces,
  getWorkspaceById,
  resolveWorkspaceFromPath,
  getDefaultWorkspace,
  isSafeInternalUrl,
  getSafeReturnWorkspace,
} from "@research-management/auth";
import { useAuth } from "./auth-provider";
import {
  getRememberedWorkspaceId,
  setRememberedWorkspaceId,
  isOnboardingCompletedInSession,
  markOnboardingCompletedInSession,
  resetOnboardingForSession,
} from "@/lib/post-login-navigation";
import { formatAdminLink } from "@/lib/dashboard-navigation";

export interface DirtyFormEntry {
  id: string;
  isDirty: () => boolean;
  onDiscard?: () => void;
}

export interface DashboardWorkspaceContextType {
  availableWorkspaces: DashboardWorkspace[];
  activeWorkspace: DashboardWorkspace | null;
  isMultiRole: boolean;
  isSwitching: boolean;
  switchDashboard: (
    workspaceId: string,
    options?: { force?: boolean }
  ) => Promise<boolean>;
  rememberedWorkspaceId: string | null;
  setRememberedWorkspace: (workspaceId: string) => void;
  onboardingCompleted: boolean;
  completeOnboarding: (
    workspaceId: string,
    returnUrl?: string | null
  ) => Promise<boolean>;
  registerDirtyForm: (entry: DirtyFormEntry) => () => void;
  hasDirtyForms: () => boolean;
  discardDirtyForms: () => void;
  pendingSwitchWorkspace: DashboardWorkspace | null;
  cancelSwitch: () => void;
  confirmSwitch: () => Promise<void>;
  switchError: string | null;
  clearSwitchError: () => void;
}

const DashboardWorkspaceContext = createContext<
  DashboardWorkspaceContextType | undefined
>(undefined);

export function DashboardWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [pendingSwitchWorkspace, setPendingSwitchWorkspace] =
    useState<DashboardWorkspace | null>(null);

  const dirtyFormsRef = useRef<Map<string, DirtyFormEntry>>(new Map());

  const availableWorkspaces = useMemo(() => {
    return getEligibleWorkspaces(user?.roles || []);
  }, [user?.roles]);

  const isMultiRole = availableWorkspaces.length >= 2;

  const [rememberedWorkspaceId, setRememberedState] = useState<string | null>(
    () => (user?.id ? getRememberedWorkspaceId(user.id) : null)
  );

  useEffect(() => {
    if (user?.id) {
      setRememberedState(getRememberedWorkspaceId(user.id));
    } else {
      setRememberedState(null);
    }
  }, [user?.id]);

  const setRememberedWorkspace = useCallback(
    (workspaceId: string) => {
      if (!user?.id) return;
      setRememberedWorkspaceId(user.id, workspaceId);
      setRememberedState(workspaceId);
    },
    [user?.id]
  );

  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() =>
    user?.id ? isOnboardingCompletedInSession(user.id) : false
  );

  useEffect(() => {
    if (user?.id) {
      setOnboardingCompleted(isOnboardingCompletedInSession(user.id));
    } else {
      setOnboardingCompleted(false);
    }
  }, [user?.id]);

  // Derive active workspace directly from the authoritative URL
  const activeWorkspace = useMemo(() => {
    const fromPath = resolveWorkspaceFromPath(
      location.pathname,
      location.search
    );
    if (fromPath && availableWorkspaces.some((w) => w.id === fromPath.id)) {
      return fromPath;
    }

    // If on /admin route without an explicit workspace param, find user's eligible admin workspace
    if (location.pathname.startsWith("/admin")) {
      const adminWorkspaces = availableWorkspaces.filter((w) =>
        ["dean", "ethics", "academic-affairs"].includes(w.id)
      );
      if (adminWorkspaces.length > 0) {
        if (
          rememberedWorkspaceId &&
          adminWorkspaces.some((w) => w.id === rememberedWorkspaceId)
        ) {
          return (
            adminWorkspaces.find((w) => w.id === rememberedWorkspaceId) ??
            adminWorkspaces[0]
          );
        }
        return adminWorkspaces[0];
      }
    }

    // Fallback for non-portal shared pages
    return (
      getDefaultWorkspace(availableWorkspaces, rememberedWorkspaceId) || null
    );
  }, [
    location.pathname,
    location.search,
    availableWorkspaces,
    rememberedWorkspaceId,
  ]);

  // Canonicalize admin URLs that lack the ?workspace= query parameter
  useEffect(() => {
    if (!user || availableWorkspaces.length === 0) return;
    if (location.pathname.startsWith("/admin")) {
      const searchParams = new URLSearchParams(location.search);
      if (!searchParams.has("workspace")) {
        const adminWorkspaces = availableWorkspaces.filter((w) =>
          ["dean", "ethics", "academic-affairs"].includes(w.id)
        );
        if (adminWorkspaces.length > 0) {
          const target =
            (rememberedWorkspaceId &&
              adminWorkspaces.find((w) => w.id === rememberedWorkspaceId)) ||
            adminWorkspaces[0];
          const canonical = formatAdminLink(
            `${location.pathname}${location.search}${location.hash}`,
            target.id
          );
          navigate(canonical, { replace: true });
        }
      }
    }
  }, [
    location.pathname,
    location.search,
    location.hash,
    availableWorkspaces,
    rememberedWorkspaceId,
    navigate,
    user,
  ]);

  const registerDirtyForm = useCallback((entry: DirtyFormEntry) => {
    dirtyFormsRef.current.set(entry.id, entry);
    return () => {
      dirtyFormsRef.current.delete(entry.id);
    };
  }, []);

  const hasDirtyForms = useCallback(() => {
    for (const entry of dirtyFormsRef.current.values()) {
      try {
        if (entry.isDirty()) return true;
      } catch {
        // tolerate error in form check
      }
    }
    return false;
  }, []);

  const discardDirtyForms = useCallback(() => {
    for (const entry of dirtyFormsRef.current.values()) {
      try {
        entry.onDiscard?.();
      } catch {}
    }
  }, []);

  const executeSwitch = useCallback(
    async (targetWorkspace: DashboardWorkspace) => {
      setIsSwitching(true);
      setSwitchError(null);

      try {
        // Revalidate user role eligibility
        const refreshed = await refreshUser();
        const freshRoles = refreshed?.roles || user?.roles || [];
        const freshEligible = getEligibleWorkspaces(freshRoles);

        const stillEligible = freshEligible.some(
          (w) => w.id === targetWorkspace.id
        );
        if (!stillEligible) {
          setSwitchError(
            `The ${targetWorkspace.label} dashboard is no longer assigned to your account.`
          );
          setIsSwitching(false);
          return false;
        }

        // Save remembered preference
        if (user?.id) {
          setRememberedWorkspace(targetWorkspace.id);
        }

        // Cancel in-flight queries to prevent stale data population
        await queryClient.cancelQueries();

        // Navigate to the target dashboard home URL
        navigate(targetWorkspace.homeUrl);
        setIsSwitching(false);
        return true;
      } catch {
        setSwitchError(
          "We could not verify your dashboard permissions. Check your connection and try again."
        );
        setIsSwitching(false);
        return false;
      }
    },
    [refreshUser, user, setRememberedWorkspace, queryClient, navigate]
  );

  const switchDashboard = useCallback(
    async (
      workspaceId: string,
      options: { force?: boolean } = {}
    ): Promise<boolean> => {
      const target = getWorkspaceById(workspaceId);
      if (!target) return false;

      // If already active workspace, no-op
      if (activeWorkspace?.id === target.id) {
        return true;
      }

      // Check unsaved changes
      if (!options.force && hasDirtyForms()) {
        setPendingSwitchWorkspace(target);
        return false;
      }

      return executeSwitch(target);
    },
    [activeWorkspace?.id, hasDirtyForms, executeSwitch]
  );

  const cancelSwitch = useCallback(() => {
    setPendingSwitchWorkspace(null);
  }, []);

  const confirmSwitch = useCallback(async () => {
    if (!pendingSwitchWorkspace) return;
    const target = pendingSwitchWorkspace;
    setPendingSwitchWorkspace(null);
    discardDirtyForms();
    await executeSwitch(target);
  }, [pendingSwitchWorkspace, discardDirtyForms, executeSwitch]);

  const completeOnboarding = useCallback(
    async (
      workspaceId: string,
      returnUrl?: string | null
    ): Promise<boolean> => {
      const target = getWorkspaceById(workspaceId);
      if (!target) return false;

      setIsSwitching(true);
      setSwitchError(null);

      try {
        const refreshed = await refreshUser();
        const freshRoles = refreshed?.roles || user?.roles || [];
        const freshEligible = getEligibleWorkspaces(freshRoles);

        const stillEligible = freshEligible.some((w) => w.id === target.id);
        if (!stillEligible) {
          setSwitchError(
            `The ${target.label} dashboard is no longer assigned to your account.`
          );
          setIsSwitching(false);
          return false;
        }

        if (user?.id) {
          setRememberedWorkspace(target.id);
          markOnboardingCompletedInSession(user.id);
          setOnboardingCompleted(true);
        }

        await queryClient.cancelQueries();

        // If safe returnUrl belongs to target workspace, navigate there
        if (
          returnUrl &&
          isSafeInternalUrl(returnUrl) &&
          getSafeReturnWorkspace(returnUrl, [target])?.id === target.id
        ) {
          navigate(returnUrl, { replace: true });
        } else {
          navigate(target.homeUrl, { replace: true });
        }

        setIsSwitching(false);
        return true;
      } catch {
        setSwitchError(
          "We could not verify your dashboard permissions. Check your connection and try again."
        );
        setIsSwitching(false);
        return false;
      }
    },
    [refreshUser, user, setRememberedWorkspace, queryClient, navigate]
  );

  return (
    <DashboardWorkspaceContext.Provider
      value={{
        availableWorkspaces,
        activeWorkspace,
        isMultiRole,
        isSwitching,
        switchDashboard,
        rememberedWorkspaceId,
        setRememberedWorkspace,
        onboardingCompleted,
        completeOnboarding,
        registerDirtyForm,
        hasDirtyForms,
        discardDirtyForms,
        pendingSwitchWorkspace,
        cancelSwitch,
        confirmSwitch,
        switchError,
        clearSwitchError: () => setSwitchError(null),
      }}
    >
      {children}

      {/* Unsaved Changes Confirmation Modal */}
      {pendingSwitchWorkspace && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-modal-title"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-white/10 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3
                  id="unsaved-modal-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  Unsaved changes
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  You have unsaved changes in this dashboard. If you switch to{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {pendingSwitchWorkspace.label}
                  </strong>
                  , your unsaved edits will be discarded.
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                autoFocus
                onClick={cancelSwitch}
                className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmSwitch}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Discard changes</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Error Alert Dialog */}
      {switchError && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="switch-error-title"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-white/10 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3
                  id="switch-error-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  Dashboard Switch
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {switchError}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSwitchError(null)}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardWorkspaceContext.Provider>
  );
}

export function useDashboardWorkspace() {
  const context = useContext(DashboardWorkspaceContext);
  if (!context) {
    throw new Error(
      "useDashboardWorkspace must be used within a DashboardWorkspaceProvider"
    );
  }
  return context;
}
