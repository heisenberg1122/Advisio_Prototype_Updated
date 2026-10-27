import React, { useEffect, useRef, useState } from "react";
import "./login.css";
import Link from "next/link";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PublicLinks } from "@/components/public/PublicLayout";
import { useAsyncAction } from "@/hooks/use-async-action";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
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
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleCredentialHandlerRef = useRef<(credential: string) => void>(
    () => undefined,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const loginAction = useAsyncAction();
  const loading = loginAction.isPending;
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleButtonError, setGoogleButtonError] = useState<string | null>(
    null,
  );

  const handlePostLogin = (
    roles: string[],
    needsAcademicSetup?: boolean,
    userId?: string,
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
      loginAction.reset();
      setGoogleLoading(true);
      try {
        const result = await loginWithGoogle(credential);
        if (result.success) {
          const roles =
            result.user?.roles || (result.role ? [result.role] : []);
          handlePostLogin(roles, result.needsAcademicSetup, result.user?.id);
          return;
        }
        loginAction.fail(
          result.error || "Google sign-in failed. Please try again.",
        );
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
    if (!email.trim() || !password)
      return loginAction.warn("Email and password are required.");
    try {
      await loginAction.run(
        async () => {
          const result = await login(email, password);
          if (!result.success)
            throw new Error(result.error || "Invalid email or password.");
          const roles =
            result.user?.roles || (result.role ? [result.role] : []);
          handlePostLogin(roles, false, result.user?.id);
        },
        {
          successMessage: "Signed in successfully.",
          errorMessage: (error) =>
            error instanceof Error ? error.message : "Failed to authenticate.",
        },
      );
    } catch {
      // Credentials stay populated so the user can correct them and retry.
    }
  };

  return (
    <main className="advisio-login">
      <section className="login-story">
        <div className="login-watermark">
          <img
            src="/school-logo.png"
            alt=""
            className="h-full w-full object-contain"
          />
        </div>

        <header className="login-story-header">
          <div className="login-brand">
            <div className="login-brand-mark">
              <img
                src="/ao-logo.png"
                alt="Advisio"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="login-brand-name">
                ADVISIO
              </div>
              <div className="login-brand-caption">
                Research portal
              </div>
            </div>
          </div>

          <div className="login-university">
            <div>
              <p className="login-university-name">
                University of the Assumption
              </p>
              <p className="login-university-location">
                City of San Fernando, Pampanga
              </p>
            </div>
            <img
              src="/school-logo.png"
              alt="University of the Assumption"
              className="login-university-seal"
            />
          </div>
        </header>

        <div className="login-story-content">
          <div className="login-story-copy">
            <p className="login-eyebrow">
              University Research Management System
            </p>
            <h1 className="login-story-headline">
              <span>A clearer way to</span>
              <span>manage academic</span>
              <span className="login-headline-accent">research.</span>
            </h1>
            <p className="login-story-description">
              Advisio brings researchers, advisers, panelists, and
              administrators into one organized workspace from proposal to final
              defense.
            </p>
            <div className="login-features">
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
                  className="login-feature-row"
                >
                  <span className="login-feature-number">
                    {number}
                  </span>
                  <p className="login-feature-title">{title}</p>
                  <p className="login-feature-description">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="login-story-footer">
          <span>For authorized university users</span>
          <span>ADVISIO · 2026</span>
        </footer>
      </section>

      <section className="login-form-panel">
        <div className="login-form-glow" />
        <div className="login-form-content">
          <div className="login-mobile-brand">
            <div className="login-mobile-brand-group">
              <div className="login-mobile-mark">
                <img
                  src="/ao-logo.png"
                  alt="Advisio"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="login-mobile-name">
                  ADVISIO
                </p>
                <p className="login-mobile-caption">
                  Research portal
                </p>
              </div>
            </div>
            <img
              src="/school-logo.png"
              alt="University of the Assumption"
              className="login-mobile-seal"
            />
          </div>
          <div className="login-form-heading">
            <div className="login-form-logos">
              <div className="login-form-logo">
                <img
                  src="/ao-logo.png"
                  alt="Advisio"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="login-logo-divider" />
              <div className="login-form-logo login-form-seal">
                <img
                  src="/school-logo.png"
                  alt="University of the Assumption"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <h2 className="login-welcome">
              Welcome back
            </h2>
            <p className="login-welcome-description">
              Sign in to continue your research journey.
            </p>
          </div>

          <ActionFeedback
            id="login-feedback"
            feedback={loginAction.feedback}
            className="login-feedback"
          />

          <form onSubmit={handleSubmit} className="login-form">
            <div>
              <label
                htmlFor="email"
                className="login-field-label"
              >
                University email
              </label>
              <div className="login-input-wrap">
                <Mail
                  size={17}
                  className="login-field-icon"
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
                  className="login-input"
                />
              </div>
            </div>
            <div>
              <div className="login-password-label-row">
                <label
                  htmlFor="password"
                  className="login-field-label"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="login-forgot-link"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="login-input-wrap">
                <LockKeyhole
                  size={17}
                  className="login-field-icon"
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
                  className="login-input login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <label className="login-remember">
              <input
                type="checkbox"
                disabled={loading}
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="login-checkbox"
              />
              Keep me signed in on this device
            </label>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading || undefined}
              aria-describedby={
                loginAction.feedback ? "login-feedback" : undefined
              }
              className={`login-submit ${loginAction.status === "success" ? "login-submit-success" : "login-submit-primary"}`}
            >
              {loading ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                  Signing in...
                </>
              ) : loginAction.status === "success" ? (
                <>
                  <CheckCircle2 aria-hidden="true" size={17} />
                  Signed in
                </>
              ) : (
                <>
                  Sign in to Advisio{" "}
                  <ArrowRight
                    size={17}
                    className="login-submit-arrow"
                  />
                </>
              )}
            </button>
          </form>

          {googleClientId && (
            <div className="login-google-section">
              <div className="login-divider">
                <span className="login-divider-line" />
                <span>Or</span>
                <span className="login-divider-line" />
              </div>
              <div
                ref={googleButtonRef}
                aria-label="Continue with Google"
                aria-busy={googleLoading}
                className={`login-google-button ${googleLoading ? "login-google-pending" : ""}`}
              />
              {googleClientId && (
                <p className="login-google-guidance">
                  Use Google to sign in or create an account and complete researcher or faculty onboarding.
                </p>
              )}
              {googleButtonError && (
                <p
                  role="status"
                  className="login-google-error"
                >
                  {googleButtonError}
                </p>
              )}
            </div>
          )}

          <p className="login-account-request">
            New to Advisio?{" "}
            <Link
              href="/register"
              className="login-account-link"
            >
              Request an account
            </Link>
          </p>
          <div className="login-access-note">
            <ShieldCheck size={13} /> Protected university access
          </div>
          <div className="login-public-links">
            <PublicLinks />
          </div>
        </div>
      </section>
    </main>
  );
}
