import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  readGoogleOnboardingSession,
  storeGoogleOnboardingSession,
  prepareGoogleResearcherOnboarding,
  clearGoogleOnboardingSession,
  type GoogleOnboardingSession,
} from "@/lib/google-onboarding";

type Program = { id: string; name: string; code: string };
type College = { id: string; name: string; code: string; programs: Program[] };

export default function GoogleOnboardingPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<GoogleOnboardingSession | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [accountType, setAccountType] = useState<"RESEARCHER" | "FACULTY">(
    "RESEARCHER",
  );
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [programId, setProgramId] = useState("");
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [academicTitle, setAcademicTitle] = useState("");
  const [facultyDesignation, setFacultyDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [expertise, setExpertise] = useState("");
  const [restoring, setRestoring] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const cached = readGoogleOnboardingSession();
    if (!cached) {
      setError(
        "Sign in with Google to start or resume your Advisio registration.",
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
        storeGoogleOnboardingSession(restored);
        if (restored.onboardingStage === "RESEARCHER") {
          prepareGoogleResearcherOnboarding(restored);
          navigate("/researcher-onboarding", { replace: true });
          return;
        }
        setSession(restored);
        setColleges(catalog.colleges);
        setFirstName(restored.user.firstName);
        setMiddleName(restored.user.middleName || "");
        setLastName(restored.user.lastName);
        setUniversityId(
          /^(GOOGLE|TEST)-/i.test(restored.user.universityId)
            ? ""
            : restored.user.universityId,
        );
        setCollegeId(restored.user.collegeId || "");
        setProgramId(restored.user.programId || "");
        const faculty = restored.facultyProfile;
        setAcademicTitle(faculty?.academicTitle || "");
        setFacultyDesignation(faculty?.facultyDesignation || "");
        setDepartment(faculty?.department || "");
        setExpertise(faculty?.expertiseKeywords?.join(", ") || "");
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.message || "Could not load your registration details.");
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, attempt]);

  const selectedCollege = colleges.find((college) => college.id === collegeId);
  const programs = useMemo(
    () => selectedCollege?.programs || [],
    [selectedCollege],
  );
  const facultyStep = session?.onboardingStage === "FACULTY";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || saving) return;
    setSaving(true);
    setError("");
    try {
      if (facultyStep) {
        await apiClient.post("/api/auth/google/faculty-onboarding", {
          onboardingToken: session.onboardingToken,
          academicTitle,
          facultyDesignation,
          department,
          expertiseKeywords: expertise
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        });
        clearGoogleOnboardingSession();
        setComplete(true);
      } else {
        const next = await apiClient.post<GoogleOnboardingSession>(
          "/api/auth/google/onboarding-identity",
          {
            onboardingToken: session.onboardingToken,
            accountType,
            firstName,
            middleName,
            lastName,
            universityId,
            collegeId,
            programId,
            policiesAccepted,
          },
        );
        storeGoogleOnboardingSession(next);
        if (next.onboardingStage === "RESEARCHER") {
          prepareGoogleResearcherOnboarding(next);
          navigate("/researcher-onboarding", { replace: true });
        } else {
          setSession(next);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof ApiError && Array.isArray(err.details)
          ? err.details
              .map((detail: { message?: string }) => detail.message)
              .filter(Boolean)
              .join(" ") || err.message
          : err instanceof Error
            ? err.message
            : "Could not save your details. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base outline-none focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10 disabled:bg-slate-50";
  if (restoring)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7fa]">
        <div role="status" className="flex items-center gap-3 text-[#164866]">
          <LoaderCircle className="animate-spin" />
          Preparing your registration…
        </div>
      </main>
    );
  if (complete)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7fa] p-6">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <ShieldCheck size={44} className="mx-auto text-emerald-600" />
          <h1 className="mt-5 text-2xl font-bold text-[#153d5c]">
            Faculty profile submitted
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            Your account is pending administrator verification. You can sign in
            with Google once your identity and faculty eligibility have been
            approved.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#0c3b5d] px-4 py-3 font-bold text-white"
          >
            Return to sign in
          </Link>
        </section>
      </main>
    );

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fa] px-4 py-10 text-slate-800">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="bg-[#0c3b5d] p-7 text-white sm:px-9">
          <GraduationCap size={28} className="mb-4 text-[#ffb21c]" />
          <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#ffb21c]">
            Google account setup
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            {facultyStep
              ? "Complete your faculty profile"
              : "Welcome to Advisio"}
          </h1>
          <p className="mt-2 leading-6 text-slate-200">
            {facultyStep
              ? "Tell us about your teaching role and expertise for institutional verification."
              : "Your Google account is connected. Choose your account type and enter your institutional details to continue onboarding."}
          </p>
          {session && (
            <p className="mt-4 break-all rounded-xl bg-white/10 px-4 py-3 text-sm">
              {session.user.email}
            </p>
          )}
        </header>
        {session && (
          <form onSubmit={submit} className="space-y-5 p-7 sm:p-9">
            <fieldset
              disabled={saving}
              className="space-y-5 disabled:opacity-70"
            >
              {facultyStep ? (
                <>
                  <Field
                    label="Academic title"
                    value={academicTitle}
                    onChange={setAcademicTitle}
                    placeholder="e.g. Dr., Prof., Mr., Ms."
                    maxLength={100}
                  />
                  <Field
                    label="Faculty designation"
                    value={facultyDesignation}
                    onChange={setFacultyDesignation}
                    placeholder="e.g. Instructor, Assistant Professor"
                    maxLength={150}
                  />
                  <Field
                    label="Department"
                    value={department}
                    onChange={setDepartment}
                    placeholder="Your academic department"
                    maxLength={150}
                  />
                  <Field
                    label="Areas of expertise"
                    value={expertise}
                    onChange={setExpertise}
                    placeholder="Separate areas with commas"
                    maxLength={2400}
                  />
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    Selecting Faculty requests a faculty account. An
                    administrator will verify your identity and eligibility
                    before granting access.
                  </p>
                </>
              ) : (
                <>
                  <fieldset>
                    <legend className="mb-2 text-sm font-bold text-[#234863]">
                      I am registering as a
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["RESEARCHER", "FACULTY"] as const).map((role) => (
                        <label
                          key={role}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${accountType === role ? "border-[#164866] bg-[#eef5f8]" : "border-slate-200"}`}
                        >
                          <input
                            type="radio"
                            name="account-type"
                            value={role}
                            checked={accountType === role}
                            onChange={() => setAccountType(role)}
                            className="accent-[#164866]"
                          />
                          {role === "RESEARCHER" ? (
                            <GraduationCap size={22} />
                          ) : (
                            <Users size={22} />
                          )}
                          <span>
                            <strong className="block">
                              {role === "RESEARCHER" ? "Researcher" : "Faculty"}
                            </strong>
                            <small className="text-slate-500">
                              {role === "RESEARCHER"
                                ? "Student or graduate researcher"
                                : "Teaching or advising faculty"}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="First name"
                      value={firstName}
                      onChange={setFirstName}
                      maxLength={100}
                    />
                    <Field
                      label="Last name"
                      value={lastName}
                      onChange={setLastName}
                      maxLength={100}
                    />
                  </div>
                  <Field
                    label="Middle name (optional)"
                    value={middleName}
                    onChange={setMiddleName}
                    maxLength={100}
                    optional
                  />
                  <Field
                    label={
                      accountType === "RESEARCHER"
                        ? "Researcher / Student ID"
                        : "Faculty / Employee ID"
                    }
                    value={universityId}
                    onChange={setUniversityId}
                    placeholder="Enter your official institutional ID"
                    maxLength={50}
                  />
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#234863]">
                      College / School
                    </span>
                    <select
                      required
                      value={collegeId}
                      onChange={(event) => {
                        setCollegeId(event.target.value);
                        setProgramId("");
                      }}
                      className={inputClass}
                    >
                      <option value="">Select your college or school</option>
                      {colleges.map((college) => (
                        <option key={college.id} value={college.id}>
                          {college.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#234863]">
                      Course / Program
                    </span>
                    <select
                      required
                      value={programId}
                      disabled={!collegeId}
                      onChange={(event) => setProgramId(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">
                        {collegeId
                          ? "Select your course or program"
                          : "Select a college first"}
                      </option>
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name} ({program.code})
                        </option>
                      ))}
                    </select>
                    {collegeId && !programs.length && (
                      <span className="mt-2 block text-sm text-amber-700">
                        No active programs are listed. Contact your
                        administrator.
                      </span>
                    )}
                  </label>
                  <details className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600">
                    <summary className="cursor-pointer font-bold text-[#234863]">
                      Research and privacy policies
                    </summary>
                    <p className="mt-3">
                      Your identity and academic information must match official
                      institutional records. Research documents and academic
                      records are protected through role-based access. Follow
                      institutional rules on originality, ethics, responsible AI
                      use, and confidentiality. Do not share unpublished
                      manuscripts, reviews, or defense records without
                      authorization.
                    </p>
                  </details>
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      required
                      checked={policiesAccepted}
                      onChange={(event) =>
                        setPoliciesAccepted(event.target.checked)
                      }
                      className="mt-1 accent-[#164866]"
                    />
                    <span>
                      I confirm my institutional details are accurate and agree
                      to the research and privacy policies.
                    </span>
                  </label>
                </>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  saving ||
                  (!facultyStep &&
                    (!collegeId || !programId || !policiesAccepted))
                }
                className="submission-action flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ffad14] px-4 py-3 font-extrabold text-[#102f49] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    {facultyStep
                      ? "Submit for verification"
                      : "Continue onboarding"}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </fieldset>
            <p className="text-center text-sm leading-6 text-slate-500">
              Registration and profile details are verified before account
              access is approved.
            </p>
            <Link
              href="/login"
              className="block text-center text-sm font-bold text-[#164866]"
            >
              Return to sign in
            </Link>
          </form>
        )}
        {!session && (
          <div className="space-y-4 p-7">
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
            <button
              onClick={() => setAttempt((value) => value + 1)}
              className="rounded-xl border border-slate-300 px-4 py-2 font-bold"
            >
              Retry
            </button>
            <Link href="/login" className="ml-4 font-bold text-[#164866]">
              Sign in with Google
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#234863]">
        {label}
      </span>
      <input
        type="text"
        required={!optional}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base outline-none focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10"
      />
    </label>
  );
}
