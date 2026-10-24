"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/providers/theme-provider";
import { SystemAnnouncements } from "@/components/system-admin/SystemAnnouncements";
import { UserManagement } from "@/components/system-admin/UserManagement";
import { GoogleDriveIntegration } from "@/components/system-admin/GoogleDriveIntegration";
import { AcademicStructureManagement } from "@/components/system-admin/AcademicStructureManagement";
import {
  SystemAdminOverview,
  AdminAuditActivity,
} from "@/components/system-admin/SystemAdminOverview";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import {
  Settings,
  Database,
  Lock,
  Check,
  X,
  Mail,
  Moon,
  Sun,
  Laptop,
  Palette,
} from "lucide-react";

function SystemAdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { theme, setTheme, collegeTheme } = useTheme();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent text-slate-800 transition-colors dark:text-slate-100">
      {/* MAIN CONTAINER */}
      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* TAB CONTENTS */}
        {(() => {
          if (activeTab === "announcements") return <SystemAnnouncements />;
          if (activeTab === "users")
            return (
              <UserManagement
                key={searchParams.get("status") || "ALL"}
                initialStatus={searchParams.get("status") || "ALL"}
              />
            );
          if (activeTab === "integrations") return <GoogleDriveIntegration />;

          if (activeTab === "onboarding") {
            return <AcademicStructureManagement />;
          }

          if (activeTab === "logs") return <AdminAuditActivity />;

          if (activeTab === "backups") {
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-6 flex flex-col gap-4 dark:border-white/10 dark:bg-[#101b2b]">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">
                  Backup & Restore Management
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
                  Initiate database snapshots or restore historical state
                  records.
                </p>
                <div className="bg-slate-50/70 dark:bg-white/[0.02] p-8 border border-slate-200 dark:border-white/10 rounded-2xl text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-[#0B3A53]/10 dark:bg-white/10 rounded-2xl flex items-center justify-center text-[#0B3A53] dark:text-[#C9A227]">
                    <Database className="h-8 w-8" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm block">
                      Automated Database Snapshots
                    </span>
                    <span className="text-xs text-slate-400">
                      Daily snapshot schedule configured via cloud
                      infrastructure.
                    </span>
                  </div>
                  <button
                    disabled
                    className="px-5 py-2.5 bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 font-extrabold text-sm rounded-xl cursor-not-allowed"
                  >
                    Automated snapshots running
                  </button>
                </div>
              </div>
            );
          }

          if (activeTab === "roles") {
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-6 flex flex-col gap-4 dark:border-white/10 dark:bg-[#101b2b]">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">
                  Global Role Permission Matrix
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
                  Active role capabilities for Student, Adviser, Professor,
                  Panelist, Dean, and Administrator accounts.
                </p>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-black uppercase text-xs tracking-wider">
                        <th className="py-3 px-4">Role Profile</th>
                        <th className="py-3 px-4">Workspace Read</th>
                        <th className="py-3 px-4">Manuscript Write</th>
                        <th className="py-3 px-4">Evaluation / Grading</th>
                        <th className="py-3 px-4">College Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-semibold">
                      {[
                        {
                          role: "Student Researcher",
                          read: true,
                          write: true,
                          eval: false,
                          admin: false,
                        },
                        {
                          role: "Research Adviser",
                          read: true,
                          write: true,
                          eval: true,
                          admin: false,
                        },
                        {
                          role: "Course Professor",
                          read: true,
                          write: true,
                          eval: true,
                          admin: false,
                        },
                        {
                          role: "Defense Panelist",
                          read: true,
                          write: false,
                          eval: true,
                          admin: false,
                        },
                        {
                          role: "College Dean / Admin",
                          read: true,
                          write: true,
                          eval: true,
                          admin: true,
                        },
                        {
                          role: "System Administrator",
                          read: true,
                          write: true,
                          eval: true,
                          admin: true,
                        },
                      ].map((item) => (
                        <tr
                          key={item.role}
                          className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {item.role}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.read ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <X className="h-4 w-4 text-rose-500" />
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.write ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <X className="h-4 w-4 text-rose-500" />
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.eval ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <X className="h-4 w-4 text-rose-500" />
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.admin ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <X className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          if (activeTab === "config") {
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-6 flex flex-col gap-4 dark:border-white/10 dark:bg-[#101b2b]">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">
                  System Parameter Configuration
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
                  Manage global database pooling, cache lifetime, and platform
                  status.
                </p>
                <div className="bg-slate-50/70 dark:bg-white/[0.02] p-5 border border-slate-200/80 dark:border-white/10 rounded-2xl flex flex-col gap-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200/80 dark:border-white/5">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">
                        Maintenance Mode
                      </span>
                      <span className="text-xs text-slate-400">
                        Lock the platform database for scheduled institutional
                        upgrades.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      Normal Mode
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">
                        Query & Session Cache
                      </span>
                      <span className="text-xs text-slate-400">
                        Cache user role matrices and taxonomy trees to optimize
                        performance.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          if (activeTab === "settings") {
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-6 flex flex-col gap-4 dark:border-white/10 dark:bg-[#101b2b]">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">
                  Portal Settings
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
                  Manage notification channels and administrative preferences.
                </p>
                <div className="bg-slate-50/70 dark:bg-white/[0.02] p-5 border border-slate-200/80 dark:border-white/10 rounded-2xl flex flex-col gap-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200/80 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-slate-400" />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-sm">
                          Email Notifications
                        </span>
                        <span className="text-xs text-slate-400">
                          Receive system-level security notices and audit
                          alerts.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="accent-[#C9A227] w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <Palette className="h-5 w-5 text-slate-400" />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-sm">
                          Appearance
                        </span>
                        <span className="text-xs text-slate-400">
                          The original Advisio palette and display mode are
                          saved to your administrator account.
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 ring-2 ring-[var(--college-focus-ring)]">
                      <span
                        className="h-11 w-11 shrink-0 rounded-xl border border-black/10 shadow-sm"
                        style={{ backgroundColor: collegeTheme.referenceColor }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
                          Default Advisio Theme
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                          System Administrators always use the original
                          University of the Assumption-inspired palette.
                        </span>
                      </div>
                      <Check
                        className="h-4 w-4 shrink-0 text-[var(--color-primary)]"
                        aria-label="Active theme"
                      />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          { id: "light", label: "Light", icon: Sun },
                          { id: "dark", label: "Dark", icon: Moon },
                          { id: "system", label: "System", icon: Laptop },
                        ] as const
                      ).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTheme(id)}
                          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${theme === id ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return <SystemAdminOverview />;
        })()}
      </main>
    </div>
  );
}

export default function SystemAdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <SystemAdminDashboardContent />
    </Suspense>
  );
}
