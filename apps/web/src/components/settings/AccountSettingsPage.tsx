"use client";

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  Camera,
  Lock,
  Check,
  Laptop,
  Moon,
  Palette,
  Pencil,
  Save,
  Shield,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useResearcherGuide } from "@/providers/researcher-guide-provider";
import { useAuth } from "@/providers/auth-provider";
import { useProfile, type ProfileData } from "@/hooks/use-profile";
import { AdviserFacultyProfileView } from "@/components/profile/AdviserFacultyProfileView";
import { useTheme } from "@/providers/theme-provider";
import { Avatar } from "@/components/ui/Avatar";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { COLLEGE_THEMES } from "@/lib/college-themes";
import { useAssistantVisibility } from "@/lib/assistant-preference";
import "./account-settings.css";

type SettingsTab = "account" | "faculty" | "notifications" | "appearance" | "security";
type NotificationPreferences = Record<string, boolean>;

const officeField = ["department", "Department / Office"] as const;
const PROFILE_FIELDS: Record<string, ReadonlyArray<readonly [keyof ProfileData, string]>> = {
  student: [["yearLevel", "Year Level"], ["section", "Section"], ["researchInterests", "Research Interests"]],
  professor: [officeField, ["specialization", "Research Specialization"], ["subjects", "Handled Subjects / Sections"]],
  panelist: [officeField, ["specialization", "Research Specialization"], ["panelDetails", "Panel Details"]],
  admin: [officeField, ["position", "Position Title"]],
  system_admin: [officeField, ["position", "Position Title"]],
};

const ROLE_LABELS: Record<string, string> = {
  RESEARCHER: "Researcher",
  STUDENT: "Researcher",
  ADVISER: "Research Adviser",
  PROFESSOR: "Professor",
  RESEARCH_COORDINATOR: "Research Coordinator",
  PANELIST: "Defense Panelist",
  ADMIN: "Administrator",
  DEAN: "Research Program Officer",
  SYSTEM_ADMIN: "System Administrator",
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
  SYSTEM_ADMIN: [
    ["security", "Security notices", "Updates about platform account security."],
    ["audit", "Audit alerts", "Updates about administrative activity."],
  ],
};

function preferenceRole(role: string) {
  if (["STUDENT", "RESEARCHER"].includes(role)) return "RESEARCHER";
  if (["PROFESSOR", "RESEARCH_COORDINATOR"].includes(role)) return "PROFESSOR";
  if (["ADMIN", "DEAN"].includes(role)) return "ADMIN";
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

export default function AccountSettingsPage({ guideTarget }: { guideTarget?: string } = {}) {
  const { user } = useAuth();
  const assistant = useAssistantVisibility(user?.id);
  const guide = useResearcherGuide();
  const guidePrefix = guide?.enabled && guide.workspace !== "researcher" ? guide.workspace : null;
  const [assistantMessage, setAssistantMessage] = useState("");
  const { profile, updateProfile } = useProfile();
  const {
    theme,
    setTheme,
    collegeTheme,
    assignedCollegeTheme,
    colorThemePreference,
    headingFontPreference,
    setHeadingFontPreference,
    setColorThemePreference,
  } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasFacultyProfile = profile.role === "adviser";
  const profileFields = PROFILE_FIELDS[profile.role] ?? [];
  const [savedMessage, setSavedMessage] = useState("");
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [profileDetails, setProfileDetails] = useState<Partial<ProfileData>>({});
  const [accountError, setAccountError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const primaryRole = (user?.roles?.[0] || "RESEARCHER").toUpperCase();
  const isSystemAdministrator = Boolean(
    user?.roles?.some((role) => role.toUpperCase() === "SYSTEM_ADMIN"),
  );
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

  const editAccount = () => {
    setAccountName(profile.name || "");
    setContactNumber(profile.contactNumber || "");
    setPhotoUrl(profile.photoUrl || "");
    setProfileDetails(profile);
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
    const details = Object.fromEntries(
      profileFields.map(([key]) => [key, (profileDetails[key] || "").trim()]),
    );
    const success = updateProfile({ ...details, name: normalizedName, contactNumber: contactNumber.trim(), photoUrl });
    if (!success) {
      setAccountError("Your account changes could not be saved. Please try again.");
      return;
    }
    setEditingAccount(false);
    setAccountError("");
    setSavedMessage("Account profile updated.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  };

  const categories: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
    { id: "account", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "security", label: "Security", icon: Shield },
  ];
  if (hasFacultyProfile) {
    categories.splice(1, 0, { id: "faculty", label: "Faculty Profile", icon: Briefcase });
  }
  const activeTab = categories.find(({ id }) => id === searchParams.get("section"))?.id || "account";

  useEffect(() => {
    if (searchParams.get("saved") !== "true") return;
    setSavedMessage("Account profile updated.");
    const timer = window.setTimeout(() => setSavedMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const selectTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams);
    params.delete("saved");
    if (tab === "account") params.delete("section");
    else params.set("section", tab);
    setSearchParams(params, { replace: true, preventScrollReset: true });
  };

  const roleLabel = ROLE_LABELS[primaryRole] || primaryRole.replace(/_/g, " ");
  const seal = getAcademicIdentity({ college: user?.college as any, program: user?.program as any })?.logoSrc;
  const identityLine = [roleLabel, user?.program?.name, user?.universityId].filter(Boolean).join(" · ");
  const togglePreference = (id: string, value: boolean) => {
    const next = { ...preferences, [id]: value };
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setPreferenceStatus("Saved");
    } catch {
      setPreferenceStatus("Applied for this session. Browser storage is unavailable.");
    }
  };
  const themeSwatch = (color: string) => (
    <span className="as-swatch" aria-hidden="true">
      <i style={{ backgroundColor: color }} />
      <i style={{ backgroundColor: `color-mix(in srgb, ${color} 45%, white)` }} />
      <i style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, white)` }} />
    </span>
  );

  return (
    <div className="as-page mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {savedMessage && (
        <div role="status" className="as-toast">
          <Check className="h-4 w-4" aria-hidden="true" /> {savedMessage}
        </div>
      )}

      <section className="as-card" aria-labelledby="as-title">
        <header className="as-band">
          {seal && <img className="as-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
          <Avatar initials={profile.initials} name={profile.name} src={profile.photoUrl || undefined} colorVariant="accent" size="lg" className="as-avatar" />
          <div className="min-w-0">
            <p id="as-title" className="as-eyebrow">Account settings</p>
            <h1>{profile.name || user?.email}</h1>
            <p className="as-identity">{identityLine}</p>
          </div>
        </header>

        <div className="as-body">
          <nav className="as-nav" aria-label="Account settings sections" data-guide={guideTarget}>
            {categories.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={activeTab === id ? "page" : undefined}
                data-guide={guidePrefix && id === "appearance" ? `${guidePrefix}-appearance-tab` : undefined}
                onClick={() => selectTab(id)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <div className="as-panel">
            {activeTab === "account" && (
              <>
                <div className="as-section-head">
                  <div>
                    <h2>Your details</h2>
                    <p>You can change these.</p>
                  </div>
                  {!editingAccount && (
                    <button type="button" className="as-btn" onClick={editAccount}>
                      <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                    </button>
                  )}
                </div>
                {accountError && <p role="alert" className="as-error">{accountError}</p>}
                <dl className="as-rows">
                  <div className="as-row">
                    <dt>Full name</dt>
                    <dd>
                      {editingAccount ? (
                        <input aria-label="Full name" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Enter your full name" />
                      ) : (
                        profile.name || <span className="as-muted">Not added yet</span>
                      )}
                    </dd>
                    <span />
                  </div>
                  <div className="as-row">
                    <dt>Contact number</dt>
                    <dd>
                      {editingAccount ? (
                        <input aria-label="Contact number" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="Add your contact number" inputMode="tel" />
                      ) : (
                        profile.contactNumber || <span className="as-muted">Not added yet</span>
                      )}
                    </dd>
                    {!editingAccount && !profile.contactNumber ? (
                      <button type="button" className="as-link" onClick={editAccount}>Add</button>
                    ) : (
                      <span />
                    )}
                  </div>
                  <div className="as-row">
                    <dt>Profile photo</dt>
                    <dd className="as-photo">
                      <Avatar initials={profile.initials} name={accountName || profile.name} src={photoUrl || undefined} colorVariant="accent" size="sm" />
                      {editingAccount ? (
                        <span className="as-photo-actions">
                          <button type="button" className="as-btn" onClick={() => photoInputRef.current?.click()} disabled={photoBusy}>
                            <Camera className="h-4 w-4" aria-hidden="true" />
                            {photoBusy ? "Preparing photo…" : photoUrl ? "Change photo" : "Add photo"}
                          </button>
                          {photoUrl && (
                            <button type="button" className="as-btn as-btn-danger" onClick={() => setPhotoUrl("")}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
                            </button>
                          )}
                          <span className="as-muted">PNG, JPEG or WebP · up to 5 MB</span>
                        </span>
                      ) : (
                        <span className="as-muted">{profile.photoUrl ? "Photo added" : "Initials shown"}</span>
                      )}
                      <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={selectProfilePhoto} />
                    </dd>
                    {!editingAccount && !profile.photoUrl ? (
                      <button type="button" className="as-link" onClick={editAccount}>Upload</button>
                    ) : (
                      <span />
                    )}
                  </div>
                </dl>
                {profileFields.length > 0 && (
                  <>
                    <div className="as-section-head as-section-gap">
                      <div>
                        <h2>Role details</h2>
                        <p>Manage information specific to your dashboard.</p>
                      </div>
                    </div>
                    <dl className="as-rows">
                      {profileFields.map(([key, label]) => {
                        const Field = key === "researchInterests" ? "textarea" : "input";
                        return (
                          <div key={key} className="as-row">
                            <dt>{label}</dt>
                            <dd>
                              {editingAccount ? (
                                <Field
                                  aria-label={label}
                                  value={profileDetails[key] || ""}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setProfileDetails((current) => ({ ...current, [key]: value }));
                                  }}
                                />
                              ) : (
                                profile[key] || <span className="as-muted">Not added yet</span>
                              )}
                            </dd>
                            <span />
                          </div>
                        );
                      })}
                    </dl>
                  </>
                )}
                {editingAccount && (
                  <div className="as-actions">
                    <button type="button" className="as-btn" onClick={cancelAccountEdit}>Cancel</button>
                    <button type="button" className="as-btn as-btn-primary" onClick={saveAccount} disabled={photoBusy}>
                      <Save className="h-4 w-4" aria-hidden="true" /> Save changes
                    </button>
                  </div>
                )}

                <div className="as-section-head as-section-gap">
                  <div>
                    <h2><BadgeCheck className="as-verified" aria-hidden="true" /> Verified by the university</h2>
                    <p>Managed by the university. Contact your research coordinator to correct these.</p>
                  </div>
                </div>
                <dl className="as-rows">
                  {[
                    ["University ID", user?.universityId || "Not available"],
                    ["Institutional email", user?.email || "Not available"],
                    ["Account role", roleLabel],
                    ["College", user?.college?.name || "Not assigned"],
                    ["Program", user?.program?.name || "Not assigned"],
                  ].map(([label, value]) => (
                    <div key={label} className="as-row">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                      <Lock className="as-lock" aria-label="Verified, read only" />
                    </div>
                  ))}
                </dl>
              </>
            )}

            {activeTab === "faculty" && <AdviserFacultyProfileView />}

            {activeTab === "notifications" && (
              <>
                <div className="as-section-head">
                  <div>
                    <h2>Notifications</h2>
                    <p>Choose which {roleLabel.toLowerCase()} updates appear in your notifications.</p>
                  </div>
                  {preferenceStatus && <span className="as-saved" role="status"><Check className="h-4 w-4" aria-hidden="true" /> {preferenceStatus}</span>}
                </div>
                <ul className="as-rows">
                  {options.map(([id, title, description]) => (
                    <li key={id} className="as-row as-row-switch">
                      <span className="as-row-text">
                        <strong id={`as-pref-${id}`}>{title}</strong>
                        <span>{description}</span>
                      </span>
                      <Switch labelledBy={`as-pref-${id}`} checked={preferences[id] ?? true} onChange={(value) => togglePreference(id, value)} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {activeTab === "appearance" && (
              <>
                <div className="as-section-head">
                  <div>
                    <h2>Color theme</h2>
                    <p>
                      {isSystemAdministrator
                        ? "System Administrators always use the original University of the Assumption-inspired Advisio theme."
                        : "Use your college or program colors, a softer version of them, or the original Advisio palette."}
                    </p>
                  </div>
                </div>
                <div className="as-themes">
                  <button type="button" className="as-theme" aria-pressed={colorThemePreference === "DEFAULT_ADVISIO"} onClick={() => setColorThemePreference("DEFAULT_ADVISIO")}>
                    {themeSwatch(COLLEGE_THEMES.default.referenceColor)}
                    <strong>Advisio default</strong>
                    <span>Original University of the Assumption palette</span>
                    {colorThemePreference === "DEFAULT_ADVISIO" && <span className="as-in-use"><Check className="h-3.5 w-3.5" aria-hidden="true" /> In use</span>}
                  </button>
                  <button
                    type="button"
                    className="as-theme"
                    aria-pressed={colorThemePreference === "COLLEGE_PROGRAM"}
                    disabled={isSystemAdministrator || assignedCollegeTheme.key === "default"}
                    onClick={() => setColorThemePreference("COLLEGE_PROGRAM")}
                  >
                    {themeSwatch(assignedCollegeTheme.referenceColor)}
                    <strong>{assignedCollegeTheme.key === "default" ? "College / program" : assignedCollegeTheme.name}</strong>
                    <span>{assignedCollegeTheme.key === "default" ? "No college or program theme is assigned" : "Your college or program colors"}</span>
                    {colorThemePreference === "COLLEGE_PROGRAM" && <span className="as-in-use"><Check className="h-3.5 w-3.5" aria-hidden="true" /> In use</span>}
                  </button>
                  <button
                    type="button"
                    className="as-theme"
                    aria-pressed={colorThemePreference === "COLLEGE_SOFT"}
                    disabled={isSystemAdministrator || assignedCollegeTheme.key === "default"}
                    onClick={() => setColorThemePreference("COLLEGE_SOFT")}
                  >
                    {themeSwatch(`color-mix(in oklab, ${assignedCollegeTheme.referenceColor} 40%, #545e6c)`)}
                    <strong>Soft college</strong>
                    <span>Your college color, quiet and easy on the eyes</span>
                    {colorThemePreference === "COLLEGE_SOFT" && <span className="as-in-use"><Check className="h-3.5 w-3.5" aria-hidden="true" /> In use</span>}
                  </button>
                </div>

                <div className="as-section-head as-section-gap">
                  <div>
                    <h2>Heading font</h2>
                    <p>Choose how page titles and section headings look.</p>
                  </div>
                </div>
                <div className="as-themes">
                  <button type="button" className="as-theme" aria-pressed={headingFontPreference === "STANDARD"} onClick={() => setHeadingFontPreference("STANDARD")}>
                    <span className="as-font-sample" aria-hidden="true">Good day</span>
                    <strong>Standard</strong>
                    <span>Clean and modern</span>
                    {headingFontPreference === "STANDARD" && <span className="as-in-use"><Check className="h-3.5 w-3.5" aria-hidden="true" /> In use</span>}
                  </button>
                  <button type="button" className="as-theme" aria-pressed={headingFontPreference === "SERIF"} onClick={() => setHeadingFontPreference("SERIF")}>
                    <span className="as-font-sample as-font-sample--serif" aria-hidden="true">Good day</span>
                    <strong>Serif</strong>
                    <span>Scholarly titles and section headings</span>
                    {headingFontPreference === "SERIF" && <span className="as-in-use"><Check className="h-3.5 w-3.5" aria-hidden="true" /> In use</span>}
                  </button>
                </div>

                <div className="as-section-head as-section-gap">
                  <div>
                    <h2>Display</h2>
                    <p>Light, dark, or follow your device.</p>
                  </div>
                </div>
                <div className="as-seg" role="group" aria-label="Display mode">
                  {([{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }, { id: "system", label: "System", icon: Laptop }] as const).map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)}>
                      <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                    </button>
                  ))}
                </div>

                {guide?.enabled && (
                  <section className="as-section-gap" aria-labelledby="workspace-assistance-title">
                    <h3 id="workspace-assistance-title">Workspace Assistance</h3>
                    <ul className="as-rows">
                      <li className="as-row as-row-switch">
                        <span className="as-row-text">
                          <strong id="workspace-assistance-heading">Show floating AI Assistant</strong>
                          <span>Shows the floating assistant while you work. Guide stays in the sidebar either way. Saved for this browser.</span>
                          {assistantMessage && <span role="status">{assistantMessage}</span>}
                        </span>
                        <Switch
                          labelledBy="workspace-assistance-heading"
                          label="Show floating AI Assistant"
                          guide={guidePrefix ? `${guidePrefix}-assistant-switch` : undefined}
                          checked={assistant.visible}
                          onChange={(value) => setAssistantMessage(
                            assistant.setVisible(value)
                              ? "Saved for your account in this browser."
                              : "Applied for this session. Browser storage is unavailable.",
                          )}
                        />
                      </li>
                    </ul>
                  </section>
                )}
              </>
            )}

            {activeTab === "security" && (
              <>
                <div className="as-section-head">
                  <div>
                    <h2>Security</h2>
                    <p>Password changes go through the university's secure account recovery.</p>
                  </div>
                </div>
                <ul className="as-rows">
                  <li className="as-row as-row-switch">
                    <span className="as-row-text">
                      <strong>Password</strong>
                      <span>A reset link goes to {user?.email || "your institutional email"}.</span>
                    </span>
                    <Link href="/forgot-password" className="as-btn">
                      <Shield className="h-4 w-4" aria-hidden="true" /> Send reset link
                    </Link>
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Switch({ checked, onChange, labelledBy, label, guide }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  labelledBy?: string;
  label?: string;
  guide?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? undefined : labelledBy}
      aria-label={label}
      data-guide={guide}
      className="as-switch"
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  );
}
