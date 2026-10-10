"use client";

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Camera,
  Check,
  Laptop,
  Moon,
  Palette,
  Pencil,
  Phone,
  Save,
  Shield,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/providers/theme-provider";
import { Avatar } from "@/components/ui/Avatar";
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

const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadPhoto(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected file is not a valid image."));
    image.src = source;
  });
}

async function prepareProfilePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > MAX_PROFILE_PHOTO_SIZE) throw new Error("Profile photos must be 5 MB or smaller.");

  const source = await fileAsDataUrl(file);
  const image = await loadPhoto(source);
  const maxDimension = 512;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [savedMessage, setSavedMessage] = useState("");
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [accountError, setAccountError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (editingAccount) return;
    setAccountName(profile.name || "");
    setContactNumber(profile.contactNumber || "");
    setPhotoUrl(profile.photoUrl || "");
  }, [editingAccount, profile]);

  const savePreferences = () => {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
    setSavedMessage("Notification preferences saved.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  };

  const editAccount = () => {
    setAccountName(profile.name || "");
    setContactNumber(profile.contactNumber || "");
    setPhotoUrl(profile.photoUrl || "");
    setAccountError("");
    setEditingAccount(true);
  };

  const cancelAccountEdit = () => {
    setAccountName(profile.name || "");
    setContactNumber(profile.contactNumber || "");
    setPhotoUrl(profile.photoUrl || "");
    setAccountError("");
    setEditingAccount(false);
  };

  const selectProfilePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setAccountError("");
    try {
      setPhotoUrl(await prepareProfilePhoto(file));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "The profile photo could not be prepared.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveAccount = () => {
    const normalizedName = accountName.trim();
    if (normalizedName.length < 2) {
      setAccountError("Enter your full name before saving.");
      return;
    }
    const success = updateProfile({ name: normalizedName, contactNumber: contactNumber.trim(), photoUrl });
    if (!success) {
      setAccountError("Your account changes could not be saved. Please try again.");
      return;
    }
    setEditingAccount(false);
    setAccountError("");
    setSavedMessage("Account profile updated.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  };

  const categories: Array<{ id: SettingsTab; label: string; description: string; icon: typeof User }> = [
    { id: "account", label: "Account", description: "Institutional identity", icon: User },
    { id: "notifications", label: "Notifications", description: "Role-specific alerts", icon: Bell },
    { id: "appearance", label: "Appearance", description: "Theme preferences", icon: Palette },
    { id: "security", label: "Security", description: "Password and access", icon: Shield },
  ];

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {savedMessage && (
        <div className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-xl border-l-4 border-[#C9A227] bg-[#0B3A53] px-4 py-3 text-sm font-bold text-white shadow-xl">
          <Check className="h-4 w-4 text-[#C9A227]" /> {savedMessage}
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
              <CardHeader>
                <div><CardTitle icon={User}>Account Profile</CardTitle><CardDescription>Update your name, contact number, and profile photo. Verified university details remain protected.</CardDescription></div>
                {!editingAccount && <Button type="button" variant="primary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={editAccount}>Edit profile</Button>}
              </CardHeader>
              <CardContent className="space-y-6">
                <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 dark:border-white/10 dark:from-white/[.04] dark:to-transparent sm:flex-row sm:items-center">
                  <div className="relative mx-auto shrink-0 sm:mx-0">
                    <Avatar initials={profile.initials} name={accountName || profile.name} src={photoUrl || undefined} colorVariant="accent" size="xl" className="h-24 w-24 border-4 border-white text-2xl shadow-md dark:border-[#101b2b]" />
                    {editingAccount && (
                      <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoBusy} aria-label="Choose profile photo" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#0B3A53] text-white shadow-md transition hover:bg-[#072A3D] disabled:opacity-60 dark:border-[#101b2b]">
                        <Camera className="h-4 w-4" />
                      </button>
                    )}
                    <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={selectProfilePhoto} />
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="truncate text-lg font-extrabold text-slate-900 dark:text-white">{accountName || profile.name}</p>
                    <p className="mt-1 text-sm font-semibold text-[#9A6A00] dark:text-[#C9A227]">{ROLE_LABELS[primaryRole] || primaryRole.replace(/_/g, " ")}</p>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || profile.email}</p>
                    {editingAccount && (
                      <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                        <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoBusy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"><Camera className="h-3.5 w-3.5" />{photoBusy ? "Preparing photo…" : photoUrl ? "Change photo" : "Add photo"}</button>
                        {photoUrl && <button type="button" onClick={() => setPhotoUrl("")} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" />Remove</button>}
                      </div>
                    )}
                    {editingAccount && <p className="mt-2 text-[10px] text-slate-400">PNG, JPEG, or WebP · Maximum 5 MB</p>}
                  </div>
                </section>

                {accountError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{accountError}</p>}

                <div>
                  <div className="mb-3 flex items-center gap-2"><Pencil className="h-4 w-4 text-[#C9A227]" /><h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Editable profile information</h3></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditableField label="Full name" value={accountName} placeholder="Enter your full name" editing={editingAccount} onChange={setAccountName} />
                    <EditableField label="Contact number" value={contactNumber} placeholder="Add your contact number" editing={editingAccount} onChange={setContactNumber} icon={<Phone className="h-4 w-4" />} />
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Verified institutional information</h3></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReadOnlyField label="University ID" value={user?.universityId || "Not available"} />
                    <ReadOnlyField label="Institutional email" value={user?.email || "Not available"} />
                    <ReadOnlyField label="Account role" value={ROLE_LABELS[primaryRole] || primaryRole.replace(/_/g, " ")} />
                    <ReadOnlyField label="College" value={user?.college?.name || "Not assigned"} />
                    <ReadOnlyField label="Program" value={user?.program?.name || "Not assigned"} />
                  </div>
                </div>
              </CardContent>
              {editingAccount && (
                <CardFooter className="justify-end gap-3">
                  <Button type="button" variant="outline" size="md" onClick={cancelAccountEdit}>Cancel</Button>
                  <Button type="button" variant="primary" size="md" icon={<Save className="h-4 w-4" />} onClick={saveAccount} disabled={photoBusy}>Save profile</Button>
                </CardFooter>
              )}
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

function EditableField({ label, value, placeholder, editing, onChange, icon }: {
  label: string;
  value: string;
  placeholder: string;
  editing: boolean;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}) {
  if (!editing) {
    return <ReadOnlyField label={label} value={value || "Not provided"} />;
  }

  return (
    <label className="block">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      <span className="relative mt-1.5 block">
        {icon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icon}</span>}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn("h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15 dark:border-white/15 dark:bg-white/5 dark:text-white", icon && "pl-10")}
        />
      </span>
    </label>
  );
}
