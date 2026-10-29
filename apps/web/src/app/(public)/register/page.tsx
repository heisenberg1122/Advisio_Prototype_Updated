"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  AuthJourneyPanel,
  AuthMobileBrand,
} from "@/components/auth/AuthJourneyPanel";
import { Modal } from "@/components/ui/Modal";
import "../login/login.css";
import "./register.css";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/Skeleton";

type AccountType = "RESEARCHER" | "ADVISER";
type RegistrationProgram = {
  id: string;
  collegeId: string;
  code: string;
  name: string;
};
type RegistrationCollege = {
  id: string;
  code: string;
  name: string;
  programs: RegistrationProgram[];
};

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    universityId: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [role, setRole] = useState<AccountType>("RESEARCHER");
  const [collegeId, setCollegeId] = useState("");
  const [programId, setProgramId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    name: string;
    email: string;
    id: string;
    role: string;
  } | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const collegesQuery = useQuery({
    queryKey: ["registration-institutional-units"],
    queryFn: () =>
      apiClient.get<{ colleges: RegistrationCollege[] }>("/api/colleges"),
  });
  const programs = (collegesQuery.data?.colleges || [])
    .flatMap((college) =>
      college.programs.map((program) => ({ ...program, college })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedProgram = programs.find((program) => program.id === programId);
  const assignedCollege =
    role === "RESEARCHER"
      ? selectedProgram?.college
      : collegesQuery.data?.colleges.find(
          (college) => college.id === collegeId,
        );
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim())
      return setError("Please provide your first and last name.");
    if (!form.universityId.trim())
      return setError("University ID is required.");
    if (!form.email.includes("@"))
      return setError("Enter a valid institutional email address.");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters long.");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match.");
    if (!agreed)
      return setError(
        "Please accept the Terms, Privacy Notice, and Research Integrity Policy.",
      );
    setLoading(true);
    try {
      if (role === "RESEARCHER" && !selectedProgram)
        return setError("Please select your academic program.");
      if (role === "ADVISER" && !collegeId)
        return setError("Please select your assigned college or school.");
      const resolvedCollegeId = assignedCollege?.id || "";
      const result = await register({
        universityId: form.universityId.trim(),
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
        role,
        collegeId: resolvedCollegeId,
        programId: role === "RESEARCHER" ? programId : undefined,
      });
      if (!result.success)
        return setError(result.error || "Failed to create account.");
      const identity = {
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        universityId: form.universityId.trim(),
      };
      setCreated({
        name: identity.name,
        email: identity.email,
        id: identity.universityId,
        role: role === "ADVISER" ? "Faculty Member" : "Researcher",
      });
      if (role === "RESEARCHER" && result.onboardingToken) {
        sessionStorage.setItem(
          "advisio_researcher_onboarding_token",
          result.onboardingToken,
        );
        sessionStorage.setItem(
          "advisio_researcher_onboarding_identity",
          JSON.stringify({
            ...identity,
            collegeId: resolvedCollegeId,
            programId,
          }),
        );
        sessionStorage.setItem(
          "advisio_researcher_onboarding_draft",
          JSON.stringify({ collegeId: resolvedCollegeId, programId }),
        );
        setOnboardingReady(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="advisio-login advisio-register">
      <a href="#register-form" className="login-skip-link">
        Skip to account setup
      </a>
      <AuthJourneyPanel />
      <section
        className="login-form-panel register-panel"
        aria-labelledby="register-title"
      >
        <div className="login-form-content register-content">
          <AuthMobileBrand />
          {created ? (
            <Success
              user={created}
              onboardingReady={onboardingReady}
              onContinue={() => router.push("/researcher-onboarding")}
            />
          ) : (
            <>
              <header className="register-heading">
                <h2 id="register-title" className="login-welcome">
                  Create your account
                </h2>
                <p className="login-welcome-description">
                  Join the Advisio research community.
                </p>
              </header>
              {error && (
                <div
                  role="alert"
                  id="register-feedback"
                  className="register-feedback"
                >
                  <ShieldCheck size={17} aria-hidden="true" />
                  {error}
                </div>
              )}
              <form
                id="register-form"
                onSubmit={submit}
                aria-label="Create your Advisio account"
                aria-busy={loading}
                tabIndex={-1}
              >
                <fieldset className="register-fields" disabled={loading}>
                  <fieldset className="register-role-fieldset">
                    <legend className="login-field-label">
                      How will you use Advisio?
                    </legend>
                    <div className="register-roles">
                      <Role
                        active={role === "RESEARCHER"}
                        icon={<GraduationCap size={18} />}
                        title="Researcher"
                        subtitle="Undergraduate or graduate"
                        onClick={() => setRole("RESEARCHER")}
                      />
                      <Role
                        active={role === "ADVISER"}
                        icon={<BookOpenCheck size={18} />}
                        title="Faculty"
                        subtitle="Institutional member"
                        onClick={() => setRole("ADVISER")}
                      />
                    </div>
                  </fieldset>
                  {collegesQuery.isLoading ? (
                    <div role="status" aria-label="Loading academic programs">
                      <Skeleton className="register-academic-skeleton w-full" />
                    </div>
                  ) : collegesQuery.isError ? (
                    <div role="alert" className="register-feedback">
                      Academic information could not load.{" "}
                      <button
                        type="button"
                        onClick={() => void collegesQuery.refetch()}
                      >
                        Try again
                      </button>
                    </div>
                  ) : role === "RESEARCHER" ? (
                    <div className="register-academic">
                      <div>
                        <Label htmlFor="registration-program">
                          Course / Program
                        </Label>
                        <select
                          id="registration-program"
                          value={programId}
                          onChange={(event) => setProgramId(event.target.value)}
                          required
                          className="register-select"
                        >
                          <option value="">Select your academic program</option>
                          {programs.map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.name} ({program.code})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="register-assignment" aria-live="polite">
                        <span>College / School</span>
                        <strong>
                          {assignedCollege?.name ||
                            "Identified when you select a program"}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="registration-college">
                        Assigned College / School
                      </Label>
                      <select
                        id="registration-college"
                        value={collegeId}
                        onChange={(event) => setCollegeId(event.target.value)}
                        required
                        className="register-select"
                      >
                        <option value="">
                          Select your assigned college or school
                        </option>
                        {collegesQuery.data?.colleges.map((college) => (
                          <option key={college.id} value={college.id}>
                            {college.name}
                          </option>
                        ))}
                      </select>
                      <p className="register-hint">
                        This assignment remains pending until institutional
                        verification.
                      </p>
                    </div>
                  )}
                  <div className="register-field-grid">
                    <Input
                      id="first-name"
                      label="First name"
                      icon={<UserRound size={16} />}
                      value={form.firstName}
                      setValue={(v) => set("firstName", v)}
                      placeholder="Maria"
                      autoComplete="given-name"
                    />
                    <Input
                      id="last-name"
                      label="Last name"
                      icon={<UserRound size={16} />}
                      value={form.lastName}
                      setValue={(v) => set("lastName", v)}
                      placeholder="Santos"
                      autoComplete="family-name"
                    />
                    <Input
                      id="university-id"
                      label={
                        role === "ADVISER" ? "Employee number" : "Researcher ID"
                      }
                      icon={<IdCard size={17} />}
                      value={form.universityId}
                      setValue={(v) => set("universityId", v)}
                      placeholder={
                        role === "ADVISER" ? "FAC-2026-001" : "2026-10025"
                      }
                      autoComplete="off"
                    />
                    <Input
                      id="reg-email"
                      label="University email"
                      type="email"
                      icon={<Mail size={17} />}
                      value={form.email}
                      setValue={(v) => set("email", v)}
                      placeholder="name@ua.edu.ph"
                      autoComplete="email"
                    />
                    <Password
                      id="reg-password"
                      label="Password"
                      value={form.password}
                      setValue={(v) => set("password", v)}
                      show={showPassword}
                      toggle={() => setShowPassword(!showPassword)}
                    />
                    <Password
                      id="confirm-password"
                      label="Confirm password"
                      value={form.confirmPassword}
                      setValue={(v) => set("confirmPassword", v)}
                      show={showPassword}
                    />
                  </div>
                  <p id="register-password-hint" className="register-hint">
                    Use at least 8 characters. Choose a password different from
                    your university portal.
                  </p>
                  <div className="register-consent">
                    <input
                      id="registration-agreement"
                      type="checkbox"
                      aria-labelledby="registration-agreement-label registration-policy-link"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                    />
                    <div>
                      <label
                        id="registration-agreement-label"
                        htmlFor="registration-agreement"
                      >
                        I agree to the{" "}
                      </label>
                      <button
                        id="registration-policy-link"
                        type="button"
                        onClick={() => setShowPolicies(true)}
                      >
                        Terms, Privacy Notice, and Research Integrity Policy
                      </button>
                      .
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      collegesQuery.isLoading ||
                      collegesQuery.isError
                    }
                    aria-busy={loading}
                    className="login-submit register-submit"
                  >
                    {loading ? (
                      <>
                        <Loader2
                          size={17}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Creating account…
                      </>
                    ) : (
                      <>
                        Create Advisio account{" "}
                        <ArrowRight size={17} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </fieldset>
              </form>
              <p className="register-sign-in">
                Already have an account?{" "}
                <Link href="/login">
                  Sign in <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </p>
              <footer className="register-footer">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>New accounts require institutional verification</span>
              </footer>
            </>
          )}
        </div>
      </section>
      {showPolicies && (
        <Policies
          close={() => setShowPolicies(false)}
          accept={() => {
            setAgreed(true);
            setShowPolicies(false);
          }}
        />
      )}
    </main>
  );
}

function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label htmlFor={htmlFor} className="login-field-label register-label">
      {children}
    </label>
  );
}
function Role({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="register-role"
    >
      <span className="register-role-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="register-role-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {active && (
        <Check size={14} className="register-role-check" aria-hidden="true" />
      )}
    </button>
  );
}
function Input({
  id,
  label,
  icon,
  value,
  setValue,
  placeholder,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="login-input-wrap">
        <span className="login-field-icon" aria-hidden="true">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="login-input"
        />
      </div>
    </div>
  );
}
function Password({
  id,
  label,
  value,
  setValue,
  show,
  toggle,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  show: boolean;
  toggle?: () => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="login-input-wrap">
        <LockKeyhole
          size={16}
          className="login-field-icon"
          aria-hidden="true"
        />
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter password"
          autoComplete="new-password"
          aria-describedby="register-password-hint"
          className={`login-input ${toggle ? "login-password-input" : ""}`}
        />
        {toggle && (
          <button
            type="button"
            onClick={toggle}
            aria-label={show ? "Hide passwords" : "Show passwords"}
            aria-pressed={show}
            aria-controls="reg-password confirm-password"
            className="login-password-toggle"
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
    </div>
  );
}
function Success({
  user,
  onboardingReady,
  onContinue,
}: {
  user: { name: string; email: string; id: string; role: string };
  onboardingReady: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="register-success" role="status">
      <div className="register-success-icon">
        <CheckCircle2 size={30} aria-hidden="true" />
      </div>
      <h2 id="register-title" className="login-welcome">
        Account created
      </h2>
      <p className="login-welcome-description">
        Welcome, {user.name}. Your {user.role.toLowerCase()} account is pending
        verification.
      </p>
      <div className="register-success-identity">
        <p>{user.email}</p>
        <strong>{user.id}</strong>
      </div>
      {onboardingReady ? (
        <button type="button" onClick={onContinue} className="login-submit">
          Continue researcher onboarding{" "}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      ) : (
        <Link href="/login" className="login-submit">
          Return to sign in <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
function Policies({
  close,
  accept,
}: {
  close: () => void;
  accept: () => void;
}) {
  return (
    <Modal
      isOpen
      onClose={close}
      title="Terms and research policies"
      subtitle="Institutional account agreement"
      maxWidth="lg"
      className="register-policy-modal"
      footer={
        <>
          <button
            type="button"
            onClick={close}
            className="register-policy-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={accept}
            className="register-policy-accept"
          >
            Accept policies
          </button>
        </>
      }
    >
      <div className="register-policy-copy">
        <p>
          <strong>Identity.</strong> Account information must match official
          institutional records.
        </p>
        <p>
          <strong>Privacy.</strong> Research documents and academic records are
          protected through role-based access.
        </p>
        <p>
          <strong>Research integrity.</strong> Users must follow institutional
          rules for originality, attribution, ethics, and responsible AI use.
        </p>
        <p>
          <strong>Confidentiality.</strong> Unpublished manuscripts, reviews,
          and defense records must not be shared without authorization.
        </p>
      </div>
    </Modal>
  );
}
