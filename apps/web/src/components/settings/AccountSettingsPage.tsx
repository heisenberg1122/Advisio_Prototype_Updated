"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  Laptop,
  Moon,
  Palette,
  Save,
  Shield,
  Sun,
  User,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type SettingsTab = "account" | "notifications" | "appearance" | "security";
type NotificationPreferences = Record<string, boolean>;

const ROLE_LABELS: Record<string, string> = {
  RESEARCHER: "Researcher",
  STUDENT: "Researcher",
  ADVISER: "Research Adviser",
  PROFESSOR: "Professor",
  RESEARCH_COORDINATOR: "Research Coordinator",
  PANELIST: "Defense Panelist",
  ADMIN: "Administrator",
  RPO: "Research Program Officer",
  REB: "Research Ethics Board",
  VPAA: "VPAA",
};

const ROLE_NOTIFICATIONS: Record<string, Array<[string, string, string]>> = {
  RESEARCHER: [
    ["deadlines", "Milestone deadlines", "Reminders for submissions and workflow deadlines."],
    ["reviews", "Review comments", "Updates when faculty members leave feedback or request revisions."],
    ["consultations", "Consultations", "Confirmation and schedule changes for adviser consultations."],
    ["defense", "Defense updates", "Defense invitations, schedules, results, and related announcements."],
  ],
  ADVISER: [
    ["submissions", "Research submissions", "Updates when advisees submit work for review."],
    ["consultations", "Consultation requests", "New, accepted, rescheduled, and cancelled consultations."],
    ["revisions", "Revision activity", "Updates when requested revisions are resubmitted."],
    ["defense", "Defense schedules", "Defense assignments and schedule changes involving your advisees."],
  ],
  PROFESSOR: [
    ["workflow", "Workflow activity", "Researcher enrollment and milestone progress updates."],
    ["submissions", "Student submissions", "New work awaiting professor review or approval."],
    ["defense", "Defense management", "Panel availability, schedules, and completed evaluations."],
    ["deadlines", "Deadline alerts", "Reminders for upcoming course and workflow deadlines."],
  ],
  PANELIST: [
    ["invitations", "Defense invitations", "New panel assignments requiring your response."],
    ["schedule", "Schedule changes", "Reschedules, venue changes, and session reminders."],
    ["evaluation", "Evaluation deadlines", "Reminders for pending and incomplete evaluation forms."],
    ["documents", "Document updates", "Notifications when assigned manuscripts are updated."],
  ],
  ADMIN: [
    ["approvals", "Account approvals", "New accounts and access requests requiring review."],
    ["schedules", "Defense scheduling", "Conflicts, confirmations, and schedule changes."],
    ["reports", "Reports and exports", "Notifications when requested reports are ready."],
    ["risk", "Research risk alerts", "Projects requiring administrative attention."],
  ],
};

function preferenceRole(role: string) {
  if (["STUDENT", "RESEARCHER"].includes(role)) return "RESEARCHER";
  if (["PROFESSOR", "RESEARCH_COORDINATOR"].includes(role)) return "PROFESSOR";
  if (["ADMIN", "RPO", "REB", "VPAA"].includes(role)) return "ADMIN";
  return role;
}

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [saved, setSaved] = useState(false);
  const primaryRole = (user?.roles?.[0] || "RESEARCHER").toUpperCase();
  const settingsRole = preferenceRole(primaryRole);
  const options = ROLE_NOTIFICATIONS[settingsRole] || ROLE_NOTIFICATIONS.RESEARCHER;
  const storageKey = `advisio_account_preferences:${user?.id || "guest"}`;
  const defaults = useMemo(
    () => Object.fromEntries(options.map(([id]) => [id, true])),
    [options],
  );
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaults);

  useEffect(() => {
    if (!user) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      setPreferences({ ...defaults, ...stored });
    } catch {
      setPreferences(defaults);
    }
  }, [defaults, storageKey, user]);

  const savePreferences = () => {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const categories: Array<{ id: SettingsTab; label: string; description: string; icon: typeof User }> = [
    { id: "account", label: "Account", description: "Institutional identity", icon: User },
    { id: "notifications", label: "Notifications", description: "Role-specific alerts", icon: Bell },
    { id: "appearance", label: "Appearance", description: "Theme preferences", icon: Palette },
    { id: "security", label: "Security", description: "Password and access", icon: Shield },
  ];

  const fullName = [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {saved && (
        <div className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-xl border-l-4 border-[#C9A227] bg-[#0B3A53] px-4 py-3 text-sm font-bold text-white shadow-xl">
          <Check className="h-4 w-4 text-[#C9A227]" /> Preferences saved successfully.
        </div>
      )}

      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#C9A227]">My account</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#17212B] dark:text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage personal preferences for your Advisio account.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:pb-0" aria-label="Account settings sections">
          {categories.map(({ id, label, description, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)} className={cn("flex min-w-52 items-center gap-3 rounded-xl border p-3 text-left transition", activeTab === id ? "border-[#0B3A53] bg-[#0B3A53] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#101b2b] dark:text-slate-200")}>
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", activeTab === id ? "bg-white/15" : "bg-slate-100 dark:bg-white/10")}><Icon className="h-4 w-4" /></span>
              <span><strong className="block text-sm">{label}</strong><span className={cn("text-[11px]", activeTab === id ? "text-slate-200" : "text-slate-400")}>{description}</span></span>
            </button>
          ))}
        </nav>

        <div>
          {activeTab === "account" && (
            <Card>
              <CardHeader><div><CardTitle icon={User}>Institutional Account</CardTitle><CardDescription>These verified details come from your university account. Edit personal and professional details from My Profile.</CardDescription></div></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Full name" value={fullName || "Not available"} />
                <ReadOnlyField label="University ID" value={user?.universityId || "Not available"} />
                <ReadOnlyField label="Institutional email" value={user?.email || "Not available"} />
                <ReadOnlyField label="Account role" value={ROLE_LABELS[primaryRole] || primaryRole.replace(/_/g, " ")} />
                <ReadOnlyField label="College" value={user?.college?.name || "Not assigned"} />
                <ReadOnlyField label="Program" value={user?.program?.name || "Not assigned"} />
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card>
              <CardHeader><div><CardTitle icon={Bell}>Notification Preferences</CardTitle><CardDescription>Choose which {ROLE_LABELS[primaryRole] || "account"} updates should appear in your notifications.</CardDescription></div></CardHeader>
              <CardContent className="space-y-3">
                {options.map(([id, title, description]) => (
                  <label key={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <span><strong className="block text-sm text-slate-800 dark:text-white">{title}</strong><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{description}</span></span>
                    <input type="checkbox" checked={preferences[id] ?? true} onChange={(event) => setPreferences((current) => ({ ...current, [id]: event.target.checked }))} className="mt-1 h-4 w-4 accent-[#0B3A53]" />
                  </label>
                ))}
              </CardContent>
              <CardFooter className="justify-end"><Button type="button" variant="primary" size="md" icon={<Save className="h-4 w-4" />} onClick={savePreferences}>Save Preferences</Button></CardFooter>
            </Card>
          )}

          {activeTab === "appearance" && (
            <Card>
              <CardHeader><div><CardTitle icon={Palette}>Appearance</CardTitle><CardDescription>Your theme selection is saved for this account.</CardDescription></div></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {([{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }, { id: "system", label: "System", icon: Laptop }] as const).map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setTheme(id)} className={cn("rounded-xl border p-5 text-center transition", theme === id ? "border-[#C9A227] bg-[#C9A227]/10 ring-2 ring-[#C9A227]/20" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5")}>
                    <Icon className="mx-auto h-6 w-6 text-[#0B3A53] dark:text-[#C9A227]" /><strong className="mt-2 block text-sm text-slate-800 dark:text-white">{label}</strong>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === "security" && (
            <Card>
              <CardHeader><div><CardTitle icon={Shield}>Security and Password</CardTitle><CardDescription>Password changes use the secure university account-recovery flow.</CardDescription></div></CardHeader>
              <CardContent>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">For your security, Advisio will send password-reset instructions to your verified institutional email address.</div>
              </CardContent>
              <CardFooter className="justify-end"><Link href="/forgot-password" className="inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#072A3D]"><Shield className="h-4 w-4 text-[#C9A227]" />Reset Password Securely</Link></CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"><span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span><p className="mt-1 break-words text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p></div>;
}
