import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, LoaderCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  readGoogleOnboardingSession,
  storeGoogleOnboardingSession,
  prepareGoogleResearcherOnboarding,
  type GoogleOnboardingSession,
} from "@/lib/google-onboarding";

type College = {
  id: string;
  name: string;
  programs: { id: string; name: string; code: string }[];
};
const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base outline-none focus:border-[#164866] focus:ring-2 focus:ring-[#164866]/15";

export default function GoogleOnboardingPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<GoogleOnboardingSession | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    universityId: "",
    collegeId: "",
    programId: "",
  });
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const cached = readGoogleOnboardingSession();
    if (!cached) {
      setError(
        "Sign in with Google to start or resume your researcher registration.",
      );
      setRestoring(false);
      return;
    }
    let cancelled = false;
    setRestoring(true);
    setError("");
    Promise.all([
      apiClient.post<GoogleOnboardingSession>(
        "/api/auth/google/onboarding-session",
        { onboardingToken: cached.onboardingToken },
      ),
      apiClient.get<{ colleges: College[] }>("/api/colleges"),
    ])
      .then(([restored, catalog]) => {
        if (cancelled) return;
        if (restored.onboardingStage === "FACULTY") {
          setError(
            "Faculty access requires an invitation from your Dean or System Administrator.",
          );
          return;
        }
        storeGoogleOnboardingSession(restored);
        if (restored.onboardingStage === "RESEARCHER") {
          prepareGoogleResearcherOnboarding(restored);
          navigate("/researcher-onboarding", { replace: true });
          return;
        }
        setSession(restored);
        setColleges(catalog.colleges);
        setForm({
          firstName: restored.user.firstName,
          middleName: restored.user.middleName || "",
          lastName: restored.user.lastName,
          universityId: /^(GOOGLE|TEST)-/i.test(restored.user.universityId)
            ? ""
            : restored.user.universityId,
          collegeId: restored.user.collegeId || "",
          programId: restored.user.programId || "",
        });
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load your registration details.",
          );
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, attempt]);

  const setField = (key: keyof typeof form, value: string) =>
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "collegeId" ? { programId: "" } : {}),
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || saving) return;
    setSaving(true);
    setError("");
    try {
      const next = await apiClient.post<GoogleOnboardingSession>(
        "/api/auth/google/onboarding-identity",
        {
          ...form,
          onboardingToken: session.onboardingToken,
          accountType: "RESEARCHER",
          policiesAccepted,
        },
      );
      storeGoogleOnboardingSession(next);
      prepareGoogleResearcherOnboarding(next);
      navigate("/researcher-onboarding", { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save your registration details.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (restoring)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7fa]">
        <div role="status" className="flex items-center gap-3 text-[#164866]">
          <LoaderCircle className="animate-spin" />
          Preparing your registration…
        </div>
      </main>
    );
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fa] px-4 py-10 text-slate-800">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="bg-[#0c3b5d] p-7 text-white sm:px-9">
          <GraduationCap size={28} className="mb-4 text-[#ffb21c]" />
          <p className="text-sm font-bold uppercase tracking-widest text-[#ffb21c]">
            Researcher registration
          </p>
          <h1 className="mt-2 text-2xl font-bold">Welcome to Advisio</h1>
          <p className="mt-2 leading-6 text-slate-200">
            Enter your institutional details to continue your research
            onboarding.
          </p>
          {session && (
            <p className="mt-4 break-all text-sm">{session.user.email}</p>
          )}
        </header>
        {session && (
          <form onSubmit={submit} className="space-y-5 p-7 sm:p-9">
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              This registration is for researchers. Advisers and other faculty
              receive invitations from their Dean or System Administrator.
            </p>
            <fieldset
              disabled={saving}
              className="space-y-5 disabled:opacity-70"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["firstName", "First name"],
                    ["lastName", "Last name"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm font-bold">
                    {label}
                    <input
                      required
                      maxLength={100}
                      value={form[key]}
                      onChange={(event) => setField(key, event.target.value)}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
              <label className="block text-sm font-bold">
                Middle name (optional)
                <input
                  maxLength={100}
                  value={form.middleName}
                  onChange={(event) =>
                    setField("middleName", event.target.value)
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-bold">
                Researcher / Student ID
                <input
                  required
                  maxLength={50}
                  value={form.universityId}
                  onChange={(event) =>
                    setField("universityId", event.target.value)
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-bold">
                College / School
                <select
                  required
                  value={form.collegeId}
                  onChange={(event) =>
                    setField("collegeId", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select your college</option>
                  {colleges.map((college) => (
                    <option key={college.id} value={college.id}>
                      {college.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                Academic program
                <select
                  required
                  disabled={!form.collegeId}
                  value={form.programId}
                  onChange={(event) =>
                    setField("programId", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select your program</option>
                  {colleges
                    .find(({ id }) => id === form.collegeId)
                    ?.programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.code} — {program.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  required
                  checked={policiesAccepted}
                  onChange={(event) =>
                    setPoliciesAccepted(event.target.checked)
                  }
                  className="mt-1.5"
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              <button
                disabled={saving || !policiesAccepted}
                type="submit"
                className="min-h-12 w-full rounded-xl bg-[#0c3b5d] px-4 font-bold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Continue researcher setup"}
              </button>
            </fieldset>
          </form>
        )}
        {error && (
          <div className="space-y-4 px-7 pb-7 pt-4">
            <p
              role="alert"
              className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
            >
              {error}
            </p>
            {!session && (
              <button
                className="text-sm underline"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            )}
          </div>
        )}
        <p className="px-7 pb-7 text-sm">
          <Link to="/login" className="underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
