"use client";

import React, { useState } from "react";
import {
  User,
  Bell,
  Palette,
  Shield,
  Check,
  Save,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

type SettingsTab = "account" | "notifications" | "appearance" | "security";

export default function StudentSettingsPage() {
  const { profile } = useProfile();
  const { theme, setTheme, isDark } = useTheme();
  const [activeCategory, setActiveCategory] = useState<SettingsTab>("account");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(profile?.name || "Student Researcher");
  const [email, setEmail] = useState(profile?.email || "student@ua.edu.ph");
  const [department, setDepartment] = useState(profile?.department || "Computer Studies");
  const [studentId, setStudentId] = useState(profile?.studentId || "2024-00128-UA");

  // Notification Preferences
  const [notifDeadlines, setNotifDeadlines] = useState(true);
  const [notifConsultations, setNotifConsultations] = useState(true);
  const [notifReviews, setNotifReviews] = useState(true);
  const [notifChatMessages, setNotifChatMessages] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Account preferences saved successfully!");
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Notification preferences updated!");
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Password updated successfully!");
  };

  const categories = [
    { id: "account", label: "Account & Profile", icon: User, desc: "Personal info and university routing" },
    { id: "notifications", label: "Notifications", icon: Bell, desc: "Alerts, deadlines, and chat pings" },
    { id: "appearance", label: "Appearance", icon: Palette, desc: "Theme and display options" },
    { id: "security", label: "Security", icon: Shield, desc: "Password and authentication" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#0B3A53] px-4 py-3 text-white shadow-xl border-l-4 border-[#C9A227] animate-fade-in-up">
          <Check className="h-5 w-5 text-[#C9A227] shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Settings Grid: Category Sidebar + Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Category Navigation (Sidebar on Desktop, Horizontal on Mobile) */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 select-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as SettingsTab)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all whitespace-nowrap lg:whitespace-normal cursor-pointer w-full",
                  isActive
                    ? "bg-[#0B3A53] text-white shadow-sm font-bold"
                    : "bg-white dark:bg-[#101b2b] text-slate-700 dark:text-slate-300 border border-[#DDE3E8] dark:border-white/10 hover:bg-[#F1F5F9] dark:hover:bg-white/5"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] leading-tight">{cat.label}</div>
                  <div
                    className={cn(
                      "text-[11px] truncate hidden lg:block mt-0.5",
                      isActive ? "text-slate-200" : "text-slate-400"
                    )}
                  >
                    {cat.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Settings Panels */}
        <div className="space-y-6">
          {/* TAB 1: ACCOUNT & PROFILE */}
          {activeCategory === "account" && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle icon={User}>Account Information</CardTitle>
                  <CardDescription>
                    Update your official university identification and contact information.
                  </CardDescription>
                </div>
              </CardHeader>

              <form onSubmit={handleSaveAccount}>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-[#DDE3E8] dark:border-white/15 bg-white dark:bg-[#080E18] text-sm text-[#17212B] dark:text-white focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15 transition-all"
                        placeholder="e.g. Maria Santos"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Student ID / Number
                      </label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-[#DDE3E8] dark:border-white/15 bg-white dark:bg-[#080E18] text-sm text-[#17212B] dark:text-white focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15 transition-all"
                        placeholder="2024-XXXXX-UA"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Institutional Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-[#DDE3E8] dark:border-white/15 bg-white dark:bg-[#080E18] text-sm text-[#17212B] dark:text-white focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15 transition-all"
                        placeholder="student@ua.edu.ph"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Department / College
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-[#DDE3E8] dark:border-white/15 bg-white dark:bg-[#080E18] text-sm text-[#17212B] dark:text-white focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15 transition-all"
                        placeholder="College of Information Technology"
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="justify-end gap-3">
                  <Button variant="secondary" size="md" type="button" onClick={() => setName(profile?.name || "")}>
                    Reset
                  </Button>
                  <Button variant="primary" size="md" type="submit" icon={<Save className="h-4 w-4" />}>
                    Save Changes
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeCategory === "notifications" && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle icon={Bell}>Notification Channels</CardTitle>
                  <CardDescription>
                    Control which updates and alerts you receive while conducting your capstone research.
                  </CardDescription>
                </div>
              </CardHeader>

              <form onSubmit={handleSaveNotifications}>
                <CardContent className="space-y-4">
                  {[
                    {
                      id: "deadlines",
                      title: "Milestone Deadlines & Defense Schedules",
                      desc: "Receive timely reminders 48 hours before institutional submission deadlines.",
                      checked: notifDeadlines,
                      onChange: setNotifDeadlines,
                    },
                    {
                      id: "consultations",
                      title: "Faculty Consultation Status",
                      desc: "Get notified immediately when your adviser confirms or reschedules a Google Meet session.",
                      checked: notifConsultations,
                      onChange: setNotifConsultations,
                    },
                    {
                      id: "reviews",
                      title: "Manuscript Review Comments",
                      desc: "Alerts when your faculty adviser leaves inline feedback or requests revisions.",
                      checked: notifReviews,
                      onChange: setNotifReviews,
                    },
                    {
                      id: "chat",
                      title: "Real-time Group Chat Pings",
                      desc: "Send desktop alerts when research partners send messages in your group room.",
                      checked: notifChatMessages,
                      onChange: setNotifChatMessages,
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[#EEF2F6] dark:border-white/10 bg-[#F7F9FB] dark:bg-white/5"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#17212B] dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.onChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B3A53]" />
                      </label>
                    </div>
                  ))}
                </CardContent>

                <CardFooter className="justify-end gap-3">
                  <Button variant="primary" size="md" type="submit" icon={<Save className="h-4 w-4" />}>
                    Save Preferences
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* TAB 3: APPEARANCE */}
          {activeCategory === "appearance" && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle icon={Palette}>Theme & Display</CardTitle>
                  <CardDescription>
                    Customize your visual environment for daylight research or late-night thesis drafting.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-3">
                    Interface Theme Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { id: "light", label: "University Light", icon: Sun, desc: "Clean institutional white & UA navy" },
                      { id: "dark", label: "Academic Dark", icon: Moon, desc: "Reduced eye strain for night study" },
                      { id: "system", label: "System Default", icon: Laptop, desc: "Synchronizes with device settings" },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = theme === opt.id || (!theme && opt.id === "light");
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setTheme(opt.id as any);
                            showToast(`Theme switched to ${opt.label}`);
                          }}
                          className={cn(
                            "flex flex-col items-center p-4 rounded-xl border text-center transition-all cursor-pointer",
                            isSelected
                              ? "border-[#0B3A53] bg-[#0B3A53]/5 ring-2 ring-[#0B3A53]/20 dark:border-[#C9A227] dark:bg-[#C9A227]/10"
                              : "border-[#DDE3E8] dark:border-white/10 bg-white dark:bg-[#101b2b] hover:bg-slate-50"
                          )}
                        >
                          <div
                            className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center mb-2",
                              isSelected
                                ? "bg-[#0B3A53] text-[#C9A227]"
                                : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="text-sm font-bold text-[#17212B] dark:text-white">
                            {opt.label}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: SECURITY */}
          {activeCategory === "security" && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle icon={Shield}>Security & Authentication</CardTitle>
                  <CardDescription>
                    Manage your Advisio portal password and secure session access.
                  </CardDescription>
                </div>
              </CardHeader>

              <form onSubmit={handleSaveSecurity}>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Current Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      className="w-full h-11 px-4 rounded-xl border border-[#DDE3E8] dark:border-white/15 bg-white dark:bg-[#080E18] text-sm text-[#17212B] dark:text-white focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15 transition-all"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        New Password
                      </label>
                      <input
                        type="password"
                        placeholder="At least 8 characters"
                        className="w-full h-11 px-4 rounded-xl border border-[#DDE3E8] dark:border-white/15 bg-white dark:bg-[#080E18] text-sm text-[#17212B] dark:text-white focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15 transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        placeholder="Repeat new password"
                        className="w-full h-11 px-4 rounded-xl border border-[#DDE3E8] dark:border-white/15 bg-white dark:bg-[#080E18] text-sm text-[#17212B] dark:text-white focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/15 transition-all"
                        required
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="justify-end gap-3">
                  <Button variant="accent" size="md" type="submit" icon={<Shield className="h-4 w-4" />}>
                    Update Password
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
