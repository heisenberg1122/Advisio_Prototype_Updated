import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { acceptAccountInvitationSchema } from "@research-management/validations/account-invitations";
import { apiClient } from "@/lib/api-client";
import { AdvisioBrandMark } from "@/components/ui/AdvisioBrandMark";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/use-auth";
import { resolvePostLoginAction } from "@/lib/post-login-navigation";

const roleLabels: Record<string, string> = {
  ADVISER: "Adviser",
  RESEARCH_COORDINATOR: "Professor Coordinator",
  PANELIST: "Panelist",
  DEAN: "Dean",
};
type Preview = {
  email: string;
  firstName: string;
  lastName: string;
  collegeId: string;
  collegeName: string;
  roleNames: string[];
  expiresAt: string;
  accountExists: boolean;
};

export default function AcceptInvitationPage() {
  const location = useLocation();
  const { user, logout, switchCollege } = useAuth();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const query = useQuery({
    queryKey: ["account-invitation-preview", token],
    queryFn: () =>
      apiClient.post<{ invitation: Preview }>(
        "/api/account-invitations/preview",
        { token },
      ),
    enabled: validToken && !complete,
    retry: false,
    gcTime: 0,
  });
  const invitation = query.data?.invitation;
  const signInUrl = `/login?${new URLSearchParams({ returnUrl: location.pathname })}${location.hash}`;
  async function acceptExisting() {
    if (
      busy ||
      complete ||
      !user ||
      user.email.toLowerCase() !== invitation?.email.toLowerCase()
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiClient.post("/api/account-invitations/accept-existing", {
        token,
      });
      setComplete(true);
      window.history.replaceState(window.history.state, "", location.pathname);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to accept this invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openCollege() {
    if (!invitation) return;
    setBusy(true);
    setError("");
    try {
      const updated = await switchCollege(invitation.collegeId);
      navigate(resolvePostLoginAction({ roles: updated.roles }).url, {
        replace: true,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to open this college.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function accept(event: FormEvent) {
    event.preventDefault();
    if (busy || complete || invitation?.accountExists) return;
    if (password !== confirmation) {
      setError("Passwords must match.");
      return;
    }
    const parsed = acceptAccountInvitationSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiClient.post("/api/account-invitations/accept", parsed.data);
      setPassword("");
      setConfirmation("");
      setComplete(true);
      // Remove the consumed token from the current history entry.
      window.history.replaceState(window.history.state, "", location.pathname);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to accept this invitation. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const inputClass =
    "mt-2 min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]";
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-background)] px-4 py-10 text-[var(--color-text-primary)]">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-lg sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <AdvisioBrandMark />
          <div>
            <p className="text-lg font-extrabold tracking-tight">ADVISIO</p>
            <p className="text-xs tracking-wide text-[var(--color-text-muted)]">
              INSTITUTIONAL INVITATION
            </p>
          </div>
        </div>
        {complete ? (
          <div className="space-y-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-300" />
            <h1 className="text-2xl font-bold">Your college access is ready</h1>
            <p
              role="status"
              className="leading-7 text-[var(--color-text-secondary)]"
            >
              {invitation?.accountExists
                ? "Your existing account now has the accepted roles in this college. Your password and home college remain unchanged."
                : "Sign in with your invited email and the password you just created."}
            </p>
            {user && invitation?.accountExists ? (
              <Button isLoading={busy} onClick={() => void openCollege()}>
                Open approved college
              </Button>
            ) : user ? (
              <Button onClick={logout}>
                Sign out to use the invited account
              </Button>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-primary)] px-5 font-bold text-[var(--color-text-inverse)]"
              >
                Continue to sign in
              </Link>
            )}
            {error && (
              <p
                role="alert"
                className="text-sm text-rose-600 dark:text-rose-200"
              >
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">You’re invited to Advisio</h1>
            {validToken && query.isPending ? (
              <div
                role="status"
                aria-label="Loading invitation"
                className="mt-6 space-y-4"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : !validToken || query.isError ? (
              <div className="mt-5 space-y-4">
                <p
                  role="alert"
                  className="leading-7 text-[var(--color-text-secondary)]"
                >
                  {query.error instanceof Error
                    ? query.error.message
                    : "This invitation link is invalid. Open the complete link in your invitation email, or ask your System Administrator for a new invitation."}
                </p>
                {validToken ? (
                  <Button
                    variant="secondary"
                    onClick={() => void query.refetch()}
                    disabled={query.isFetching}
                  >
                    Try again
                  </Button>
                ) : null}
                <Link to="/login" className="block text-sm underline">
                  Back to sign in
                </Link>
              </div>
            ) : invitation ? (
              <>
                <p className="mt-3 leading-7 text-[var(--color-text-secondary)]">
                  Welcome, {invitation.firstName}. You have been invited to
                  approved roles in {invitation.collegeName}.
                </p>
                <div className="my-6 space-y-3 rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <p className="flex items-center gap-2 text-sm">
                    <MailCheck className="h-4 w-4 shrink-0" />
                    <span className="break-all">{invitation.email}</span>
                  </p>
                  <p className="flex items-start gap-2 text-sm">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {invitation.roleNames
                        .map((role) => roleLabels[role] || role)
                        .join(" · ")}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Accept by {new Date(invitation.expiresAt).toLocaleString()}.
                  </p>
                </div>
                {invitation.accountExists ? (
                  <div className="space-y-4">
                    <p className="leading-7 text-[var(--color-text-secondary)]">
                      Accept these roles using your existing account. This will
                      not change your password, home college, or access to other
                      colleges.
                    </p>
                    {!user ? (
                      <Link to={signInUrl} className="font-semibold underline">
                        Sign in to accept this invitation
                      </Link>
                    ) : user.email.toLowerCase() ===
                      invitation.email.toLowerCase() ? (
                      <Button
                        isLoading={busy}
                        onClick={() => void acceptExisting()}
                      >
                        Accept college access
                      </Button>
                    ) : (
                      <>
                        <p role="alert" className="text-sm">
                          You’re signed in with a different email. Sign out,
                          then reopen this invitation and sign in with{" "}
                          {invitation.email}.
                        </p>
                        <Button variant="secondary" onClick={logout}>
                          Sign out
                        </Button>
                      </>
                    )}
                    {error && (
                      <p
                        role="alert"
                        className="text-sm text-rose-600 dark:text-rose-200"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={accept} className="space-y-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Set your own password to accept this invitation. Use at
                      least 12 characters.
                    </p>
                    <label className="block text-sm font-semibold">
                      New password
                      <input
                        type="password"
                        aria-label="New password"
                        required
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={72}
                        disabled={busy}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Confirm password
                      <input
                        type="password"
                        aria-label="Confirm password"
                        required
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={72}
                        disabled={busy}
                        value={confirmation}
                        onChange={(event) =>
                          setConfirmation(event.target.value)
                        }
                        className={inputClass}
                      />
                    </label>
                    {error ? (
                      <p
                        role="alert"
                        className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"
                      >
                        {error}
                      </p>
                    ) : null}
                    <Button
                      type="submit"
                      isLoading={busy}
                      loadingText="Setting up your account…"
                      className="w-full"
                    >
                      Accept invitation
                    </Button>
                    <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                      If you weren’t expecting this invitation, contact your
                      institution before continuing.
                    </p>
                  </form>
                )}
              </>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
