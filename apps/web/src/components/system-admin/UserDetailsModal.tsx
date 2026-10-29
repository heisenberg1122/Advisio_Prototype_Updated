import React, { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ActionFeedback } from "@/components/ui/ActionFeedback";

type Details = {
  id: string;
  universityId: string;
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  status: string;
  college?: { name: string; code: string } | null;
  program?: { name: string; code: string } | null;
  roles: { role: { id: string; name: string } }[];
  authentication: {
    googleConnected: boolean;
    hasPassword: boolean;
    passwordStorage: string;
  };
  googleOnboardingStage?: string | null;
  researcherProfile?: Record<string, unknown> | null;
  facultyProfile?: Record<string, unknown> | null;
  maxAdviseeGroups: number;
  isAcceptingAdvisees: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
};

const label = (value: string) =>
  (/^[A-Z_]+$/.test(value) ? value.toLowerCase() : value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (v) => v.toUpperCase());
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";

function Field({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {title}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
        {children || (
          <span className="font-normal text-slate-400">Not provided</span>
        )}
      </dd>
    </div>
  );
}

// Profile records contain only registration/profile data selected by the admin endpoint.
function ProfileValue({ value }: { value: unknown }) {
  if (value == null || value === "" || (Array.isArray(value) && !value.length))
    return <>Not provided</>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (Array.isArray(value))
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i}>
            <ProfileValue value={item} />
          </div>
        ))}
      </div>
    );
  if (typeof value === "object")
    return (
      <dl className="space-y-1">
        {Object.entries(value)
          .filter(
            ([key]) =>
              !["id", "userId", "createdAt", "updatedAt"].includes(key),
          )
          .map(([key, item]) => (
            <div key={key}>
              <span className="font-normal text-slate-500">{label(key)}: </span>
              <ProfileValue value={item} />
            </div>
          ))}
      </dl>
    );
  const text = String(value);
  return (
    <>
      {/^\d{4}-\d{2}-\d{2}T/.test(text)
        ? date(text)
        : /^[A-Z_]+$/.test(text)
          ? label(text)
          : text}
    </>
  );
}

export function UserDetailsModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "registration">("overview");
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const close = useCallback(() => {
    if (!working) onClose();
  }, [working, onClose]);
  const query = useQuery({
    queryKey: ["system-user-details", userId],
    queryFn: () =>
      apiClient.get<{ user: Details }>(`/api/users/${userId}/details`),
    staleTime: 0,
    gcTime: 0,
  });
  const user = query.data?.user;
  const reset = async () => {
    if (working) return;
    setWorking(true);
    setFeedback(null);
    try {
      const result = await apiClient.post<{ message: string }>(
        `/api/users/${userId}/reset-password`,
        { confirmed: true },
      );
      setFeedback({ tone: "success", message: result.message });
      setConfirming(false);
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not send reset email.",
      });
    } finally {
      setWorking(false);
    }
  };
  const sectionTitle =
    "mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white";
  const card =
    "rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.02]";
  return (
    <Modal
      isOpen
      onClose={close}
      title="View Details"
      subtitle="Complete user information and account security"
      maxWidth="xl"
      className="!max-w-4xl max-h-[94vh]"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={14} />
            System administrator access
          </span>
          <Button variant="secondary" onClick={close} disabled={working}>
            Close
          </Button>
        </>
      }
    >
      {query.isPending ? (
        <p role="status" className="py-12 text-center text-slate-500">
          Loading user details…
        </p>
      ) : query.isError ? (
        <div role="alert" className="text-center">
          <p>Could not load user details.</p>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : (
        user && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0B3A53] text-xl font-bold text-white">
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  {[user.firstName, user.middleName, user.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  {user.universityId}{" "}
                  <span className="mx-1 text-slate-300">/</span>{" "}
                  {user.roles.map(({ role }) => label(role.name)).join(", ")}
                </p>
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {label(user.status)}
              </span>
            </div>
            <div
              role="tablist"
              aria-label="User information"
              className="flex gap-6 border-b border-slate-200 dark:border-white/10"
            >
              {(
                [
                  ["overview", "Account overview"],
                  ["registration", "Registration details"],
                ] as const
              ).map(([id, title]) => (
                <button
                  key={id}
                  id={`details-tab-${id}`}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`details-panel-${id}`}
                  onClick={() => setTab(id)}
                  className={`border-b-2 pb-3 text-sm font-bold ${tab === id ? "border-[#0B3A53] text-[#0B3A53] dark:border-amber-400 dark:text-amber-400" : "border-transparent text-slate-500"}`}
                >
                  {title}
                </button>
              ))}
            </div>
            <ActionFeedback feedback={feedback} />
            <div
              role="tabpanel"
              id={`details-panel-${tab}`}
              aria-labelledby={`details-tab-${tab}`}
            >
              {tab === "overview" ? (
                <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                  <div className="space-y-4">
                    <section className={card}>
                      <h5 className={sectionTitle}>
                        <UserRound size={17} className="text-slate-400" />
                        Personal information
                      </h5>
                      <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
                        <Field title="First name">{user.firstName}</Field>
                        <Field title="Middle name">{user.middleName}</Field>
                        <Field title="Last name">{user.lastName}</Field>
                        <Field title="University ID">{user.universityId}</Field>
                        <div className="col-span-2">
                          <Field title="Email address">{user.email}</Field>
                        </div>
                      </dl>
                    </section>
                    <section className={card}>
                      <h5 className={sectionTitle}>
                        <Building2 size={17} className="text-slate-400" />
                        Institutional information
                      </h5>
                      <dl className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Field title="College / School">
                            {user.college &&
                              `${user.college.name} (${user.college.code})`}
                          </Field>
                        </div>
                        <div className="col-span-2">
                          <Field title="Program">
                            {user.program &&
                              `${user.program.name} (${user.program.code})`}
                          </Field>
                        </div>
                        <div className="col-span-2">
                          <Field title="Assigned roles">
                            {user.roles
                              .map(({ role }) => label(role.name))
                              .join(", ")}
                          </Field>
                        </div>
                      </dl>
                    </section>
                  </div>
                  <div className="space-y-4">
                    <section className={card}>
                      <h5 className={sectionTitle}>
                        <ShieldCheck size={17} className="text-slate-400" />
                        Sign-in & security
                      </h5>
                      <dl className="space-y-4">
                        <Field title="Sign-in method">
                          {user.authentication.googleConnected
                            ? user.authentication.hasPassword
                              ? "Google + email and password"
                              : "Google sign-in"
                            : "Email and password"}
                        </Field>
                        <Field title="Google account">
                          {user.authentication.googleConnected ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <BadgeCheck size={14} />
                              Connected
                            </span>
                          ) : (
                            "Not connected"
                          )}
                        </Field>
                        <Field title="Password">
                          {user.authentication.hasPassword ? (
                            <>
                              <span className="block tracking-widest text-slate-500">
                                ••••••••••••
                              </span>
                              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <KeyRound size={12} />
                                {user.authentication.passwordStorage}
                              </span>
                            </>
                          ) : (
                            "Managed by Google"
                          )}
                        </Field>
                      </dl>
                      <p className="mt-3 text-xs leading-relaxed text-slate-500">
                        {user.authentication.hasPassword
                          ? "Passwords are stored securely as hashes and cannot be viewed or recovered."
                          : "This account uses Google authentication. Password changes are managed through Google."}
                      </p>
                      {user.authentication.hasPassword && (
                        <Button
                          variant="secondary"
                          className="mt-4 w-full"
                          icon={<KeyRound size={15} />}
                          disabled={user.status !== "ACTIVE" || working}
                          onClick={() => {
                            setConfirming(true);
                            setFeedback(null);
                          }}
                        >
                          Reset password
                        </Button>
                      )}
                      {user.authentication.hasPassword &&
                        user.status !== "ACTIVE" && (
                          <p className="mt-2 text-xs text-amber-700">
                            Activate this account before requesting a reset.
                          </p>
                        )}
                    </section>
                    <section className={card}>
                      <h5 className={sectionTitle}>Account activity</h5>
                      <dl className="space-y-3">
                        <Field title="Registered on">
                          {date(user.createdAt)}
                        </Field>
                        <Field title="Last sign-in">
                          {date(user.lastLoginAt)}
                        </Field>
                        <Field title="Last updated">
                          {date(user.updatedAt)}
                        </Field>
                      </dl>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    All saved registration and onboarding information for this
                    account.
                  </p>
                  {[
                    ["Researcher profile", user.researcherProfile],
                    ["Faculty profile", user.facultyProfile],
                  ].map(([title, profile]) =>
                    profile && typeof profile === "object" ? (
                      <section key={String(title)} className={card}>
                        <h5 className={sectionTitle}>{String(title)}</h5>
                        <dl className="grid gap-5 sm:grid-cols-2">
                          {Object.entries(profile)
                            .filter(([key]) => !["id", "userId"].includes(key))
                            .map(([key, value]) => (
                              <Field key={key} title={label(key)}>
                                <ProfileValue value={value} />
                              </Field>
                            ))}
                        </dl>
                      </section>
                    ) : null,
                  )}
                  {!user.researcherProfile && !user.facultyProfile && (
                    <p className={card}>
                      No additional registration profile has been submitted.
                    </p>
                  )}
                  <section className={card}>
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <Field title="Google onboarding stage">
                        {user.googleOnboardingStage
                          ? label(user.googleOnboardingStage)
                          : "Not applicable"}
                      </Field>
                      {user.roles.some(
                        ({ role }) => role.name === "ADVISER",
                      ) && (
                        <>
                          <Field title="Maximum advisee groups">
                            {String(user.maxAdviseeGroups)}
                          </Field>
                          <Field title="Accepting advisees">
                            {user.isAcceptingAdvisees ? "Yes" : "No"}
                          </Field>
                        </>
                      )}
                    </dl>
                  </section>
                </div>
              )}
            </div>
            {confirming && (
              <section
                role="region"
                aria-label="Confirm password reset"
                className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <h5 className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200">
                  <Mail size={18} />
                  Send a password reset email?
                </h5>
                <p className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
                  A notification and a single-use link to choose a new password
                  will be sent to{" "}
                  <strong className="break-all">{user.email}</strong>. The link
                  expires in 30 minutes. The current password remains valid
                  until the user completes the reset; existing sessions are then
                  signed out.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirming(false)}
                    disabled={working}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void reset()}
                    isLoading={working}
                    loadingText="Sending email…"
                  >
                    Confirm & send email
                  </Button>
                </div>
              </section>
            )}
          </div>
        )
      )}
    </Modal>
  );
}
