import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronUp, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { loginAction } from "@/actions/auth";

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
        options: { theme: "outline"; size: "large"; text: "signin_with"; shape: "pill"; width: number },
      ) => void;
    };
  };
};

interface DemoAccount {
  label: string;
  name: string;
  email: string;
  roleBadge: string;
  specialty?: string;
  category: "professors" | "other";
}

const professorDemoAccounts: DemoAccount[] = [
  {
    label: "Prof. Santos",
    name: "Prof. Maria Clara Santos",
    email: "professor01@university.edu.ph",
    roleBadge: "Capstone Coordinator",
    specialty: "Software Engineering & Capstone",
    category: "professors",
  },
  {
    label: "Dr. Pendelton",
    name: "Dr. Arthur Pendelton",
    email: "professor02@university.edu.ph",
    roleBadge: "Professor",
    specialty: "AI & Data Science",
    category: "professors",
  },
  {
    label: "Dr. Rostova",
    name: "Dr. Elena Rostova",
    email: "professor03@university.edu.ph",
    roleBadge: "Professor",
    specialty: "Cybersecurity & Networks",
    category: "professors",
  },
  {
    label: "Prof. Vance",
    name: "Prof. Marcus Vance",
    email: "professor04@university.edu.ph",
    roleBadge: "Professor",
    specialty: "HCI & Web Systems",
    category: "professors",
  },
  {
    label: "Dr. Delgado",
    name: "Dr. Sophia Delgado",
    email: "professor05@university.edu.ph",
    roleBadge: "Professor",
    specialty: "Cloud & Distributed Systems",
    category: "professors",
  },
];

const generalDemoAccounts: DemoAccount[] = [
  {
    label: "Student",
    name: "Juan Reyes",
    email: "student01@university.edu.ph",
    roleBadge: "Researcher",
    category: "other",
  },
  {
    label: "Adviser",
    name: "Dr. Rachel Lim",
    email: "adviser01@university.edu.ph",
    roleBadge: "Faculty Adviser",
    category: "other",
  },
  {
    label: "Panelist",
    name: "Defense Panelist",
    email: "panelist01@university.edu.ph",
    roleBadge: "Panelist",
    category: "other",
  },
  {
    label: "Admin",
    name: "RPO Officer",
    email: "admin01@university.edu.ph",
    roleBadge: "RPO Admin",
    category: "other",
  },
  {
    label: "System Admin",
    name: "System Admin",
    email: "superadmin01@university.edu.ph",
    roleBadge: "Super Admin",
    category: "other",
  },
];

export default function LoginPage() {
  const demoAccountPassword =
    import.meta.env.VITE_DEMO_ACCOUNT_PASSWORD ||
    (import.meta.env.DEV ? "password123" : "");
  const demoAccountsEnabled =
    Boolean(demoAccountPassword) &&
    (import.meta.env.DEV ||
      import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === "true");
  const router = useRouter();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_SIGN_IN_CLIENT_ID?.trim() || "";
  const googleSelfSignupEnabled = import.meta.env.VITE_GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP === "true";
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleCredentialHandlerRef = useRef<(credential: string) => void>(() => undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoAccs, setShowDemoAccs] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleButtonError, setGoogleButtonError] = useState<string | null>(null);

  const goToDashboard = (role = "") => {
    const value = role.toLowerCase();
    const requestedLocation = (location.state as any)?.from;
    if (
      requestedLocation?.pathname?.startsWith("/student/workflows/join/") &&
      (value.includes("researcher") || value.includes("student"))
    ) {
      navigate(
        `${requestedLocation.pathname}${requestedLocation.search || ""}${requestedLocation.hash || ""}`,
        { replace: true },
      );
      return;
    }
    if (value.includes("researcher") || value.includes("student")) router.push("/student/dashboard");
    else if (value.includes("adviser")) router.push("/adviser/dashboard");
    else if (value.includes("professor") || value.includes("coordinator")) router.push("/professor/dashboard");
    else if (value.includes("panelist")) router.push("/panelist/dashboard");
    else if (value.includes("system_admin")) router.push("/system-admin/dashboard");
    else if (value.includes("dean") || value.includes("admin")) router.push("/admin/dashboard");
    else if (["rpo", "reb", "vpaa"].some((adminRole) => value.includes(adminRole))) router.push("/admin/dashboard");
    else router.push("/student/dashboard");
  };

  googleCredentialHandlerRef.current = (credential: string) => {
    if (googleLoading) return;
    void (async () => {
      setError(null);
      setGoogleLoading(true);
      try {
        const result = await loginWithGoogle(credential);
        if (result.success) {
          if (result.needsAcademicSetup) {
            router.push("/google-onboarding");
            return;
          }
          goToDashboard(result.role || "RESEARCHER");
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
          if (response.credential) googleCredentialHandlerRef.current(response.credential);
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
      if (!cancelled) setGoogleButtonError("Google sign-in could not load. You can still use your email and password.");
    };

    if (script) {
      if ((window as Window & { google?: GoogleIdentityApi }).google) renderGoogleButton();
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
    if (!email.trim() || !password) return setError("Email and password are required.");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success && result.role) return goToDashboard(result.role);
      const fallbackResult = await loginAction({ email, password });
      if (fallbackResult.success) return goToDashboard(fallbackResult.user?.role);
      setError(result.error || fallbackResult.error || "Invalid email or password.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to authenticate.");
    } finally { setLoading(false); }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(demoAccountPassword);
    setError(null);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] font-sans text-slate-900 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(500px,.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-[#214b69] bg-[#0b3553] px-[clamp(2.5rem,5vw,5.5rem)] py-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-28 -right-24 h-[30rem] w-[30rem] select-none opacity-[0.035]">
          <img src="/school-logo.png" alt="" className="h-full w-full object-contain" />
        </div>

        <header className="relative z-10 flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white p-1.5">
              <img src="/ao-logo.png" alt="Advisio" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-[18px] font-extrabold tracking-[.06em]">ADVISIO</div>
              <div className="text-[9px] font-bold uppercase tracking-[.22em] text-[#f3b327]">Research portal</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-right">
            <div>
              <p className="text-[11px] font-semibold leading-tight text-white">University of the Assumption</p>
              <p className="mt-0.5 text-[9px] font-medium text-slate-300">City of San Fernando, Pampanga</p>
            </div>
            <img src="/school-logo.png" alt="University of the Assumption" className="h-10 w-10 object-contain" />
          </div>
        </header>

        <div className="relative z-10 my-auto max-w-[680px] py-12">
          <div className="max-w-[640px]">
            <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#f3b327]">University Research Management System</p>
            <h1 className="mt-5 text-[clamp(2.6rem,4.4vw,4.3rem)] font-semibold leading-[1.08] tracking-[-.035em]">A clearer way to manage academic research.</h1>
            <p className="mt-6 max-w-[570px] text-[15px] leading-7 text-slate-300">Advisio brings researchers, advisers, panelists, and administrators into one organized workspace from proposal to final defense.</p>
            <div className="mt-12 border-y border-white/15">
              {[
                ["01", "Research projects", "Documents, milestones, and team responsibilities."],
                ["02", "Faculty review", "Adviser feedback, consultations, and approvals."],
                ["03", "Defense readiness", "Schedules, panel coordination, and final requirements."],
              ].map(([number, title, description]) => <div key={number} className="grid grid-cols-[42px_minmax(0,1fr)] gap-4 border-b border-white/10 py-4 last:border-b-0 sm:grid-cols-[42px_150px_minmax(0,1fr)] sm:items-center"><span className="font-mono text-[11px] font-bold text-[#f3b327]">{number}</span><p className="text-[13px] font-bold text-white">{title}</p><p className="col-start-2 text-[12px] leading-5 text-slate-300 sm:col-start-auto">{description}</p></div>)}
            </div>
          </div>

        </div>
        <footer className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5 text-[10px] text-slate-400"><span>For authorized university users</span><span>ADVISIO · 2026</span></footer>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-[clamp(3rem,7vw,7.5rem)]">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[#ffb21c]/10 blur-3xl" />
        <div className="w-full max-w-[430px] animate-fade-in-up">
          <div className="mb-8 flex items-center justify-between border-b border-slate-200/80 pb-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                <img src="/ao-logo.png" alt="Advisio" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="font-extrabold text-[15px] tracking-wider text-[#092f4f] leading-none">ADVISIO</p>
                <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#d98600] mt-0.5">Research portal</p>
              </div>
            </div>
            <img src="/school-logo.png" alt="University of the Assumption" className="h-9 w-9 object-contain" />
          </div>
          <div className="mb-8">
            <div className="mb-5 hidden items-center gap-3 lg:flex">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                <img src="/ao-logo.png" alt="Advisio" className="h-full w-full object-contain" />
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <img src="/school-logo.png" alt="University of the Assumption" className="h-full w-full object-contain" />
              </div>
            </div>
            <h2 className="text-[32px] font-bold tracking-[-.035em] text-[#102f49]">Welcome back</h2>
            <p className="mt-2 text-[14px] text-slate-500">Sign in to continue your research journey.</p>
          </div>

          {error && <div role="alert" className={`mb-5 flex gap-3 rounded-xl border p-3.5 text-[12px] ${error.toLowerCase().includes("pending") ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}`}><ShieldCheck size={17} className="shrink-0" /><span>{error}</span></div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div><label htmlFor="email" className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.11em] text-[#234863]">University email</label><div className="relative"><Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input id="email" type="email" autoComplete="email" required disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@university.edu.ph" className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[14px] shadow-sm outline-none transition focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10 disabled:opacity-60" /></div></div>
            <div><div className="mb-2 flex justify-between"><label htmlFor="password" className="text-[11px] font-extrabold uppercase tracking-[.11em] text-[#234863]">Password</label><Link href="/forgot-password" className="text-[12px] font-bold text-[#1d567d] hover:text-[#d98600]">Forgot password?</Link></div><div className="relative"><LockKeyhole size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={loading} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-[14px] shadow-sm outline-none transition focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10 disabled:opacity-60" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
            <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-slate-600"><input type="checkbox" disabled={loading} checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 accent-[#0c3b5d]" />Keep me signed in on this device</label>
            <button type="submit" disabled={loading} className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ffad14] text-[13px] font-extrabold text-[#102f49] shadow-[0_10px_25px_rgba(255,173,20,.25)] transition hover:-translate-y-0.5 hover:bg-[#ffb82e] disabled:pointer-events-none disabled:opacity-60">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#102f49] border-t-transparent" />Signing in…</> : <>Sign in to Advisio <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></>}</button>
          </form>

          {googleClientId && <div className="mt-5">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
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
            {googleSelfSignupEnabled && <p className="mt-2 text-center text-[11px] text-slate-500">First-time Google sign-in creates a researcher test account.</p>}
            {googleButtonError && <p role="status" className="mt-2 text-center text-[11px] text-rose-600">{googleButtonError}</p>}
          </div>}

          <p className="mt-7 text-center text-[12px] text-slate-500">New to Advisio? <Link href="/register" className="font-extrabold text-[#164866] hover:text-[#d98600]">Request an account</Link></p>
          {demoAccountsEnabled && <div className="mt-8 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => setShowDemoAccs(!showDemoAccs)}
              className="flex w-full items-center justify-between rounded-lg py-2 text-[11px] font-bold text-slate-500 hover:text-[#164866]"
            >
              <span>Explore with a demo account</span>
              {showDemoAccs ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {showDemoAccs && (
              <div className="mt-3 space-y-3 animate-fade-in-up">
                {/* Professor Users Section */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#d98600]">
                      Professor Accounts ({professorDemoAccounts.length})
                    </span>
                    <span className="text-[9px] text-slate-400">Click to fill credentials</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {professorDemoAccounts.map((acc) => (
                      <button
                        type="button"
                        key={acc.email}
                        onClick={() => fillDemo(acc.email)}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:border-[#ffb21c] hover:bg-amber-50/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="block text-[11px] font-extrabold text-[#153d5c]">{acc.label}</span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold text-amber-900">
                            {acc.roleBadge}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-600 truncate">{acc.name}</p>
                        {acc.specialty && (
                          <p className="text-[9px] text-slate-400 truncate">{acc.specialty}</p>
                        )}
                        <span className="mt-1 block truncate text-[9px] font-mono text-slate-400">{acc.email}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Other Roles Section */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Other Roles
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {generalDemoAccounts.map((acc) => (
                      <button
                        type="button"
                        key={acc.email}
                        onClick={() => fillDemo(acc.email)}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:border-[#ffb21c] hover:bg-amber-50/50"
                      >
                        <span className="block text-[11px] font-extrabold text-[#153d5c]">{acc.label}</span>
                        <p className="mt-0.5 text-[9px] text-slate-500 truncate">{acc.name}</p>
                        <span className="mt-0.5 block truncate text-[8.5px] font-mono text-slate-400">{acc.email}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="pt-1 text-center text-[9px] text-slate-400">Demo access is enabled for this environment.</p>
              </div>
            )}
          </div>}
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-slate-400"><ShieldCheck size={13} /> Protected university access</div>
        </div>
      </section>
    </main>
  );
}
