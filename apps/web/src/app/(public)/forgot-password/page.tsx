import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const isReset = location.pathname === "/reset-password";
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (isReset && password !== confirmation) {
      setError("Passwords must match.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiClient.post<{ message: string }>(
        isReset ? "/api/auth/reset-password" : "/api/auth/forgot-password",
        isReset ? { token, newPassword: password } : { email },
      );
      setMessage(result.message);
      setPassword("");
      setConfirmation("");
    } catch (error: any) {
      setError(
        error.message ||
          "Unable to complete password recovery. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-800">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <p className="font-extrabold text-blue-700">ADVISIO</p>
        <h1 className="text-2xl font-bold">
          {isReset ? "Choose a new password" : "Reset your password"}
        </h1>
        {message ? (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {message}
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {isReset
                ? "Your reset link can be used once and expires after 30 minutes."
                : "Enter your account email to request a secure reset link."}
            </p>
            {isReset && !token ? (
              <p role="alert" className="text-sm text-red-700">
                This reset link is invalid. Request a new link from the password
                recovery page.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {isReset ? (
                  <>
                    <label className="block text-sm font-semibold">
                      New password
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Confirm new password
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block text-sm font-semibold">
                    Account email
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                    />
                  </label>
                )}
                {error && (
                  <p role="alert" className="text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button
                  disabled={busy}
                  className="w-full rounded-lg bg-blue-700 p-3 font-bold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Please wait…"
                    : isReset
                      ? "Reset password"
                      : "Request reset link"}
                </button>
              </form>
            )}
          </>
        )}
        {isReset && (
          <Link
            to="/forgot-password"
            className="block text-sm text-blue-700 underline"
          >
            Request a new reset link
          </Link>
        )}
        <Link to="/login" className="block text-sm font-semibold text-blue-700">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
