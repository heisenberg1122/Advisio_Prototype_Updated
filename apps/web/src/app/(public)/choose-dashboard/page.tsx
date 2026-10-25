"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Award,
  BookOpen,
  BookOpenCheck,
  Check,
  GraduationCap,
  HelpCircle,
  Landmark,
  Loader2,
  LogOut,
  Radio,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";
import {
  type DashboardWorkspace,
  type DashboardWorkspaceId,
  isSafeInternalUrl,
  getSafeReturnWorkspace,
} from "@research-management/auth";

const WORKSPACE_ICONS: Record<DashboardWorkspaceId, React.ComponentType<{ className?: string }>> = {
  researcher: GraduationCap,
  adviser: Users,
  panelist: Award,
  coordinator: BookOpen,
  dean: Landmark,
  ethics: ShieldCheck,
  "academic-affairs": BookOpenCheck,
  "system-admin": Settings,
};

export default function ChooseDashboardPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const {
    availableWorkspaces,
    rememberedWorkspaceId,
    completeOnboarding,
    isSwitching,
    switchError,
    clearSwitchError,
  } = useDashboardWorkspace();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Validate internal return URL
  const returnUrlParam = searchParams.get("returnUrl");
  const stateFrom = (location.state as any)?.from;
  const rawReturnUrl =
    returnUrlParam ||
    (stateFrom
      ? `${stateFrom.pathname || ""}${stateFrom.search || ""}${stateFrom.hash || ""}`
      : null);
  const validatedReturnUrl = isSafeInternalUrl(rawReturnUrl)
    ? rawReturnUrl
    : null;

  // Preselection logic:
  // 1. Authorized return workspace
  // 2. Remembered workspace
  // 3. First in registry order
  const preselectedId = useMemo(() => {
    if (validatedReturnUrl) {
      const match = getSafeReturnWorkspace(
        validatedReturnUrl,
        availableWorkspaces
      );
      if (match) return match.id;
    }
    if (
      rememberedWorkspaceId &&
      availableWorkspaces.some((w) => w.id === rememberedWorkspaceId)
    ) {
      return rememberedWorkspaceId;
    }
    return availableWorkspaces[0]?.id || "researcher";
  }, [validatedReturnUrl, rememberedWorkspaceId, availableWorkspaces]);

  const [selectedId, setSelectedId] = useState<string>(preselectedId);

  useEffect(() => {
    setSelectedId(preselectedId);
  }, [preselectedId]);

  // If single-role user navigates here, resolve directly to their destination
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/login", { replace: true });
      return;
    }
    if (availableWorkspaces.length === 1) {
      void completeOnboarding(availableWorkspaces[0].id, validatedReturnUrl);
    }
  }, [
    isAuthLoading,
    isAuthenticated,
    user,
    availableWorkspaces,
    completeOnboarding,
    validatedReturnUrl,
    navigate,
  ]);

  if (isAuthLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7fb]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#102f49]" />
          <p className="text-sm font-semibold text-slate-500">
            Loading your academic profile…
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Access Help Screen when zero eligible roles are found
  if (availableWorkspaces.length === 0) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <HelpCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-[#102f49] tracking-tight">
              Access Help
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              No authorized research role or academic dashboard is currently
              assigned to your account.
            </p>
            <p className="text-xs text-slate-400">
              Account: {user.email} ({user.universityId})
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed text-left">
            <p className="font-semibold text-slate-700 mb-1">
              What should you do?
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Contact your Department Coordinator or Dean&apos;s Office to verify
                role assignment.
              </li>
              <li>
                Reach out to the Advisio System Administrator for account
                support.
              </li>
            </ul>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </section>
      </main>
    );
  }

  const selectedWorkspace =
    availableWorkspaces.find((w) => w.id === selectedId) ||
    availableWorkspaces[0];

  const handleContinue = async () => {
    if (!selectedWorkspace) return;
    clearSwitchError();
    await completeOnboarding(selectedWorkspace.id, validatedReturnUrl);
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in-up">
        {/* Top Header Branding */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm border border-slate-200">
              <img
                src="/ao-logo.png"
                alt="Advisio"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-[#102f49]">
                ADVISIO
              </div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#d98600]">
                Research Portal
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-right">
            <div>
              <p className="text-xs font-bold text-[#102f49] leading-tight">
                {user.college?.name || "University of the Assumption"}
              </p>
              <p className="text-xs text-slate-400">
                {user.firstName} {user.lastName}
              </p>
            </div>
            <img
              src="/school-logo.png"
              alt="University Logo"
              className="h-9 w-9 object-contain"
            />
          </div>
        </header>

        {/* Title & Introduction */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 space-y-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-[#b36b00]">
              Multi-Role Account
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#102f49]">
              Choose your dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Your account has multiple roles. Choose where you want to start.
              You can switch dashboards anytime from your profile menu.
            </p>
          </div>

          {switchError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 animate-shake"
            >
              <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p>{switchError}</p>
                <p className="mt-1 font-normal text-rose-500">
                  Please select an active role or click retry.
                </p>
              </div>
            </div>
          )}

          {/* Accessible Role Cards */}
          <div
            role="radiogroup"
            aria-label="Assigned dashboards"
            className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
          >
            {availableWorkspaces.map((ws) => {
              const isSelected = selectedId === ws.id;
              const IconComponent = WORKSPACE_ICONS[ws.id] || BookOpen;

              return (
                <div
                  key={ws.id}
                  role="radio"
                  tabIndex={0}
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedId(ws.id);
                    clearSwitchError();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setSelectedId(ws.id);
                      clearSwitchError();
                    }
                  }}
                  className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer text-left outline-none focus-visible:ring-4 focus-visible:ring-[#ffb21c]/20 select-none ${
                    isSelected
                      ? "border-[#ffad14] bg-amber-50/40 shadow-sm ring-1 ring-[#ffad14]"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                          isSelected
                            ? "bg-[#102f49] text-[#ffad14]"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                          isSelected
                            ? "border-[#ffad14] bg-[#ffad14] text-[#102f49]"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-[#102f49]">
                        {ws.label}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-3">
                        {ws.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      {user.college?.code || "Institutional"}
                    </span>
                    {isSelected && (
                      <span className="font-bold text-[#b36b00]">
                        Selected
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary & Sign Out Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={logout}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>

            <button
              type="button"
              disabled={isSwitching || !selectedWorkspace}
              onClick={handleContinue}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-[#ffad14] px-6 py-3.5 text-sm font-extrabold text-[#102f49] shadow-md hover:bg-[#ffb82e] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSwitching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Entering {selectedWorkspace?.label}…</span>
                </>
              ) : (
                <>
                  <span>Continue to {selectedWorkspace?.label}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
