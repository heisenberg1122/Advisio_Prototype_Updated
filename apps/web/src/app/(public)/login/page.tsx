import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  resolvePostLoginAction,
  resetOnboardingForSession,
  getRememberedWorkspaceId,
  setRememberedWorkspaceId,
  markOnboardingCompletedInSession,
} from "@/lib/post-login-navigation";

type GoogleCredentialResponse = { credential: string };
type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        ux_mode?: "popup" | "redirect";
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          theme: "outline";
          size: "large";
          text: "signin_with";
          shape: "pill";
          width: number;
        },
      ) => void;
    };
  };
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();
  const googleClientId =
    import.meta.env.VITE_GOOGLE_SIGN_IN_CLIENT_ID?.trim() || "";
  const googleSelfSignupEnabled =
    import.meta.env.VITE_GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP === "true";
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleCredentialHandlerRef = useRef<(credential: string) => void>(
    () => undefined,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleButtonError, setGoogleButtonError] = useState<string | null>(
    null,
  );

  const handlePostLogin = (
    roles: string[],
    needsAcademicSetup?: boolean,
    userId?: string
  ) => {
    const requestedLocation = (location.state as any)?.from;
    const returnUrl = requestedLocation
      ? `${requestedLocation.pathname || ""}${requestedLocation.search || ""}${requestedLocation.hash || ""}`
      : null;

    if (userId) {
      resetOnboardingForSession(userId);
    }
    const rememberedWorkspaceId = getRememberedWorkspaceId(userId);
    const action = resolvePostLoginAction({
      roles,
      needsAcademicSetup,
      returnUrl,
      rememberedWorkspaceId,
    });

    if (action.type === "SINGLE_ROLE") {
      if (userId) {
        markOnboardingCompletedInSession(userId);
        setRememberedWorkspaceId(userId, action.workspace.id);
      }
      navigate(action.url, { replace: true });
      return;
    }

    navigate(action.url, { replace: true });
  };
  googleCredentialHandlerRef.current = (credential: string) => {
    if (googleLoading) return;
    void (async () => {
      setError(null);
      setGoogleLoading(true);
      try {
        const result = await loginWithGoogle(credential);
        if (result.success) {
          const roles = result.user?.roles || (result.role ? [result.role] : []);
          handlePostLogin(roles, result.needsAcademicSetup, result.user?.id);
          return;
        }
        setError(result.error || "Google sign-in failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;
    let cancelled = false;
    let script: HTMLScriptElement | null = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current) return;
      const google = (window as Window & { google?: GoogleIdentityApi }).google;
      if (!google) return;
      google.accounts.id.initialize({
        client_id: googleClientId,
        ux_mode: "popup",
        callback: (response) => {
          if (response.credential)
            googleCredentialHandlerRef.current(response.credential);
        },
      });
      googleButtonRef.current.replaceChildren();
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: googleButtonRef.current.clientWidth || 360,
      });
    };

    const handleScriptError = () => {
      if (!cancelled)
        setGoogleButtonError(
          "Google sign-in could not load. You can still use your email and password.",
        );
    };

    if (script) {
      if ((window as Window & { google?: GoogleIdentityApi }).google)
        renderGoogleButton();
      else script.addEventListener("load", renderGoogleButton);
    } else {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = renderGoogleButton;
      script.onerror = handleScriptError;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", renderGoogleButton);
    };
  }, [googleClientId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password)
      return setError("Email and password are required.");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) { const roles = result.user?.roles || (result.role ? [result.role] : []); handlePostLogin(roles, false, result.user?.id); return; }
      setError(result.error || "Invalid email or password.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to authenticate.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] font-sans text-slate-900 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(500px,.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-[#214b69] bg-[#0b3553] px-[clamp(2.5rem,5vw,5.5rem)] py-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-28 -right-24 h-[30rem] w-[30rem] select-none opacity-[0.035]">
          <img
            src="/school-logo.png"
            alt=""
            className="h-full w-full object-contain"
          />
        </div>

        <header className="relative z-10 flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white p-1.5">
              <img
                src="/ao-logo.png"
                alt="Advisio"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="text-[18px] font-extrabold tracking-[.06em]">
                ADVISIO
              </div>
              <div className="text-xs font-bold uppercase tracking-[.22em] text-[#f3b327]">
                Research portal
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-right">
            <div>
              <p className="text-base font-semibold leading-tight text-white">
                University of the Assumption
              </p>
              <p className="mt-0.5 text-base font-medium text-slate-300">
                City of San Fernando, Pampanga
              </p>
            </div>
            <img
              src="/school-logo.png"
              alt="University of the Assumption"
              className="h-10 w-10 object-contain"
            />
          </div>
        </header>

        <div className="relative z-10 my-auto max-w-[680px] py-12">
          <div className="max-w-[640px]">
            <p className="text-sm font-bold uppercase tracking-[.22em] text-[#f3b327]">
              University Research Management System
            </p>
            <h1 className="mt-5 text-[clamp(2.6rem,4.4vw,4.3rem)] font-semibold leading-[1.08] tracking-[-.035em]">
              A clearer way to manage academic research.
            </h1>
            <p className="mt-6 max-w-[570px] text-base leading-7 text-slate-300">
              Advisio brings researchers, advisers, panelists, and
              administrators into one organized workspace from proposal to final
              defense.
            </p>
            <div className="mt-12 border-y border-white/15">
              {[
                [
                  "01",
                  "Research projects",
                  "Documents, milestones, and team responsibilities.",
                ],
                [
                  "02",
                  "Faculty review",
                  "Adviser feedback, consultations, and approvals.",
                ],
                [
                  "03",
                  "Defense readiness",
                  "Schedules, panel coordination, and final requirements.",
                ],
              ].map(([number, title, description]) => (
                <div
                  key={number}
                  className="grid grid-cols-[42px_minmax(0,1fr)] gap-4 border-b border-white/10 py-4 last:border-b-0 sm:grid-cols-[42px_150px_minmax(0,1fr)] sm:items-center"
                >
                  <span className="font-mono text-xs font-bold text-[#f3b327]">
                    {number}
                  </span>
                  <p className="text-base font-bold text-white">{title}</p>
                  <p className="col-start-2 text-base leading-5 text-slate-300 sm:col-start-auto">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5 text-xs text-slate-400">
          <span>For authorized university users</span>
          <span>ADVISIO · 2026</span>
        </footer>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-[clamp(3rem,7vw,7.5rem)]">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[#ffb21c]/10 blur-3xl" />
        <div className="w-full max-w-[430px] animate-fade-in-up">
          <div className="mb-8 flex items-center justify-between border-b border-slate-200/80 pb-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                <img
                  src="/ao-logo.png"
                  alt="Advisio"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-extrabold text-base tracking-wider text-[#092f4f] leading-none">
                  ADVISIO
                </p>
                <p className="text-sm font-bold uppercase tracking-[.18em] text-[#d98600] mt-0.5">
                  Research portal
                </p>
              </div>
            </div>
            <img
              src="/school-logo.png"
              alt="University of the Assumption"
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="mb-8">
            <div className="mb-5 hidden items-center gap-3 lg:flex">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                <img
                  src="/ao-logo.png"
                  alt="Advisio"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <img
                  src="/school-logo.png"
                  alt="University of the Assumption"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <h2 className="text-[32px] font-bold tracking-[-.035em] text-[#102f49]">
              Welcome back
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Sign in to continue your research journey.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className={`mb-5 flex gap-3 rounded-xl border p-3.5 text-[12px] ${error.toLowerCase().includes("pending") ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}`}
            >
              <ShieldCheck size={17} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-extrabold uppercase tracking-[.11em] text-[#234863]"
              >
                University email
              </label>
              <div className="relative">
                <Mail
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@university.edu.ph"
                  className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base shadow-sm outline-none transition focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10 disabled:opacity-60"
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-extrabold uppercase tracking-[.11em] text-[#234863]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-bold text-[#1d567d] hover:text-[#d98600]"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <LockKeyhole
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-base shadow-sm outline-none transition focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                disabled={loading}
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 accent-[#0c3b5d]"
              />
              Keep me signed in on this device
            </label>
            <button
              type="submit"
              disabled={loading}
              className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ffad14] text-sm font-extrabold text-[#102f49] shadow-[0_10px_25px_rgba(255,173,20,.25)] transition hover:-translate-y-0.5 hover:bg-[#ffb82e] disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#102f49] border-t-transparent" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in to Advisio{" "}
                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          {googleClientId && (
            <div className="mt-5">
              <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[.14em] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>Or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div
                ref={googleButtonRef}
                aria-label="Continue with Google"
                aria-busy={googleLoading}
                className={`flex min-h-11 w-full justify-center overflow-hidden rounded-full transition-opacity ${googleLoading ? "pointer-events-none opacity-60" : ""}`}
              />
              {googleSelfSignupEnabled && (
                <p className="mt-2 text-center text-base text-slate-500">
                  First-time Google sign-in creates a researcher test account.
                </p>
              )}
              {googleButtonError && (
                <p
                  role="status"
                  className="mt-2 text-center text-base text-rose-600"
                >
                  {googleButtonError}
                </p>
              )}
            </div>
          )}

          <p className="mt-7 text-center text-base text-slate-500">
            New to Advisio?{" "}
            <Link
              href="/register"
              className="font-extrabold text-[#164866] hover:text-[#d98600]"
            >
              Request an account
            </Link>
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={13} /> Protected university access
          </div>
        </div>
      </section>
    </main>
  );
}
