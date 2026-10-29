import React, { useEffect, useRef, useState } from "react";
import "./login.css";
import Link from "next/link";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  MessagesSquare,
  ClipboardCheck,
  GraduationCap,
  LockKeyhole,
  Loader2,
  Mail,
  Pause,
  Play,
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
  const [journeyPaused, setJourneyPaused] = useState(false);
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
      const width = Math.min(400, googleButtonRef.current.clientWidth || 360);
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
      <section className="login-story" aria-labelledby="login-story-title">
        <img
          src="/school-logo.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="login-story-watermark"
        />
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
                advisio<span className="login-brand-dot">.</span>
              </div>
              <div className="login-brand-caption">Research, connected</div>
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
              <span aria-hidden="true" /> University Research Management
            </p>
            <h1 id="login-story-title" className="login-story-headline">
              <span>A clearer path</span>
              <span>
                through <span className="login-headline-accent">research.</span>
              </span>
            </h1>
            <p className="login-story-description">
              From proposal to final defense, Advisio keeps every stage
              connected.
            </p>
            <div
              className="login-journey"
              data-paused={journeyPaused || undefined}
              role="group"
              aria-label="The research journey"
            >
              <div className="login-journey-caption">
                <span>One connected journey</span>
                <div className="login-journey-controls">
                  <span className="login-journey-index" aria-hidden="true">
                    01 — 04
                  </span>
                  <button
                    type="button"
                    className="login-journey-toggle"
                    onClick={() => setJourneyPaused((paused) => !paused)}
                    aria-label={
                      journeyPaused
                        ? "Resume research journey animation"
                        : "Pause research journey animation"
                    }
                    aria-pressed={journeyPaused}
                  >
                    {journeyPaused ? (
                      <Play size={12} aria-hidden="true" />
                    ) : (
                      <Pause size={12} aria-hidden="true" />
                    )}
                    {journeyPaused ? "Play" : "Pause"}
                  </button>
                </div>
              </div>
              <div className="login-journey-map">
                <svg
                  className="login-journey-path"
                  viewBox="0 0 560 280"
                  preserveAspectRatio="none"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    className="login-path-track"
                    d="M48 204H142Q188 204 188 158V152Q188 106 234 106H282Q328 106 328 60Q328 40 362 40H512"
                  />
                  <path
                    className="login-path-progress"
                    pathLength="1"
                    d="M48 204H142Q188 204 188 158V152Q188 106 234 106H282Q328 106 328 60Q328 40 362 40H512"
                  />
                </svg>
                <ol className="login-milestones">
                  {[
                    { label: "Proposal", Icon: FileText },
                    { label: "Advising", Icon: MessagesSquare },
                    { label: "Review", Icon: ClipboardCheck },
                    { label: "Defense", Icon: GraduationCap },
                  ].map(({ label, Icon }, index) => (
                    <li
                      key={label}
                      className={`login-milestone login-milestone-${index + 1}`}
                    >
                      <span className="login-milestone-node">
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <span className="login-milestone-label">
                        <span className="login-milestone-number">
                          0{index + 1}
                        </span>
                        {label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
          <p className="login-journey-note">
            Every conversation. Every revision. A step forward.
          </p>
        </div>
        <footer className="login-story-footer">
          <span>Built for the university research community</span>
          <span>ADVISIO · UA</span>
        </footer>
      </section>

      <section className="login-form-panel" aria-labelledby="login-welcome">
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
                  advisio<span className="login-brand-dot">.</span>
                </p>
                <p className="login-mobile-caption">Research, connected</p>
              </div>
            </div>
            <img
              src="/school-logo.png"
              alt="University of the Assumption"
              className="login-mobile-seal"
            />
          </div>
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
              <div className="login-divider">
                <span className="login-divider-line" />
                <span>or</span>
                <span className="login-divider-line" />
              </div>
              <div
                ref={googleButtonRef}
                aria-label="Continue with Google"
                aria-busy={googleLoading}
                className={`login-google-button ${googleLoading ? "login-google-pending" : ""}`}
              />
              {googleLoading && (
                <p role="status" className="login-google-guidance">
                  Signing in with Google...
                </p>
              )}
              <p className="login-google-guidance">
                Use Google to sign in or set up your account.
              </p>
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
            </Link>
          </p>
          <div className="login-access-note">
            <ShieldCheck size={14} aria-hidden="true" /> Protected university
            access
          </div>
          <div className="login-public-links">
            <nav aria-label="Public information">
              <Link href="/privacy-policy">Privacy</Link>
              <span aria-hidden="true">·</span>
              <Link href="/terms-of-service">Terms</Link>
              <span aria-hidden="true">·</span>
              <a href="mailto:advisio.main@gmail.com">Help</a>
            </nav>
          </div>
        </div>
      </section>
    </main>
  );
}
