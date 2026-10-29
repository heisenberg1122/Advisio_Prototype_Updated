import React, { useEffect, useRef, useState } from "react";
import "./login.css";
import {
  AuthJourneyPanel,
  AuthMobileBrand,
} from "@/components/auth/AuthJourneyPanel";
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
          text: "continue_with";
          shape: "rectangular";
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
    let renderedWidth = 0;
    let googleInitialized = false;
    let script: HTMLScriptElement | null = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current) return;
      const google = (window as Window & { google?: GoogleIdentityApi }).google;
      if (!google) return;
      // Keep the native 14px label; enlarging the control also enlarges its text.
      const availableWidth =
        googleButtonRef.current.parentElement?.clientWidth || 500;
      const width = Math.min(400, Math.round(availableWidth));
      if (renderedWidth === width && googleButtonRef.current.childElementCount)
        return;
      if (!googleInitialized) {
        google.accounts.id.initialize({
          client_id: googleClientId,
          ux_mode: "popup",
          callback: (response) => {
            if (response.credential)
              googleCredentialHandlerRef.current(response.credential);
          },
        });
        googleInitialized = true;
      }
      googleButtonRef.current.replaceChildren();
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width,
      });
      renderedWidth = width;
    };

    const handleScriptError = () => {
      if (!cancelled)
        setGoogleButtonError(
          "Google sign-in could not load. You can still use your email and password.",
        );
    };

    const resizeObserver = new ResizeObserver(renderGoogleButton);
    resizeObserver.observe(googleButtonRef.current);

    if (script) {
      if ((window as Window & { google?: GoogleIdentityApi }).google)
        renderGoogleButton();
      else script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", handleScriptError);
    } else {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", handleScriptError);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      script?.removeEventListener("load", renderGoogleButton);
      script?.removeEventListener("error", handleScriptError);
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
      <a href="#login-form" className="login-skip-link">
        Skip to sign in
      </a>
      <AuthJourneyPanel />

      <section className="login-form-panel" aria-labelledby="login-welcome">
        <div className="login-form-content">
          <AuthMobileBrand />
          <div className="login-form-heading">
            <h2 id="login-welcome" className="login-welcome">
              Welcome back
            </h2>
            <p className="login-welcome-description">
              Sign in to continue to your Advisio workspace.
            </p>
          </div>

          <ActionFeedback
            id="login-feedback"
            feedback={loginAction.feedback}
            className="login-feedback"
          />

          <form
            id="login-form"
            onSubmit={handleSubmit}
            className="login-form"
            aria-label="Sign in with email and password"
            tabIndex={-1}
          >
            <div>
              <label htmlFor="email" className="login-field-label">
                University email
              </label>
              <div className="login-input-wrap">
                <Mail
                  size={17}
                  aria-hidden="true"
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
                  placeholder="name@ua.edu.ph"
                  className="login-input"
                />
              </div>
            </div>
            <div>
              <div className="login-password-label-row">
                <label htmlFor="password" className="login-field-label">
                  Password
                </label>
                <Link href="/forgot-password" className="login-forgot-link">
                  Forgot password?
                </Link>
              </div>
              <div className="login-input-wrap">
                <LockKeyhole
                  size={17}
                  aria-hidden="true"
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
                  aria-pressed={showPassword}
                  aria-controls="password"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
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
                  <ArrowRight size={17} className="login-submit-arrow" />
                </>
              )}
            </button>
          </form>

          {googleClientId && (
            <div className="login-google-section">
              <div className="login-google-separator" aria-hidden="true">
                <span>or</span>
              </div>
              <div
                aria-label="Continue with Google"
                aria-busy={googleLoading}
                className={`login-google-button ${googleLoading ? "login-google-pending" : ""}`}
              >
                <div ref={googleButtonRef} className="login-google-sdk" />
              </div>
              {googleLoading && (
                <p role="status" className="login-google-guidance">
                  Signing in with Google...
                </p>
              )}
              {googleButtonError && (
                <p role="status" className="login-google-error">
                  {googleButtonError}
                </p>
              )}
            </div>
          )}

          <p className="login-account-request">
            Need access?{" "}
            <Link href="/register" className="login-account-link">
              Request an account
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </p>
          <footer className="login-form-footer">
            <div className="login-access-note">
              <ShieldCheck size={14} aria-hidden="true" /> Protected university
              access
            </div>
            <div className="login-public-links">
              <nav aria-label="Public information">
                <Link href="/privacy-policy">Privacy</Link>
                <Link href="/terms-of-service">Terms</Link>
                <a href="mailto:advisio.main@gmail.com">Help</a>
              </nav>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
