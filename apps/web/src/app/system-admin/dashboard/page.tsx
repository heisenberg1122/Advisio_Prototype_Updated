"use client";

import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { SystemAnnouncements } from "@/components/system-admin/SystemAnnouncements";
import { UserManagement } from "@/components/system-admin/UserManagement";
import { GoogleDriveIntegration } from "@/components/system-admin/GoogleDriveIntegration";
import { DashboardWelcome } from "@/components/ui/DashboardWelcome";
import { DashboardSkeleton, Skeleton, TablePageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";
import {
  Building2,
  Layers,
  Settings,
  Wrench,
  Shield,
  FileText,
  Database,
  Users,
  CheckCircle2,
  Plus,
  ArrowRight,
  Lock,
  Sliders,
  Check,
  X,
  Mail,
  Moon,
} from "lucide-react";

function SystemAdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  // Query live colleges and programs
  const {
    data: collegesData,
    isLoading: collegesLoading,
    isError: collegesError,
    refetch: refetchColleges,
  } = useQuery({
    queryKey: ["admin-colleges"],
    queryFn: () => apiClient.get<{ colleges: any[] }>("/api/colleges"),
    staleTime: 60000,
  });

  const {
    data: programsData,
    isLoading: programsLoading,
    isError: programsError,
    refetch: refetchPrograms,
  } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: () => apiClient.get<{ programs: any[] }>("/api/programs"),
    staleTime: 60000,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["system-admin-users-overview"],
    queryFn: () =>
      apiClient
        .get<{ users: any[] }>("/api/users")
        .catch(() => ({ users: [] })),
    staleTime: 60000,
  });

  const { data: academicYearsData, isLoading: academicYearsLoading } = useQuery({
    queryKey: ["system-admin-academic-years-overview"],
    queryFn: () =>
      apiClient
        .get<{ academicYears: any[] }>("/api/academic-years")
        .catch(() => ({ academicYears: [] })),
    staleTime: 60000,
  });

  const { data: researchData, isLoading: researchLoading } = useQuery({
    queryKey: ["system-admin-research-overview"],
    queryFn: () =>
      apiClient
        .get<{ projects: any[] }>("/api/research")
        .catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    if (collegesData?.colleges) {
      setColleges(
        collegesData.colleges.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          status: "active",
          deptsCount: c.programs?.length || 0,
          adminName: "Dean Officer",
        })),
      );
    }
  }, [collegesData]);

  useEffect(() => {
    if (programsData?.programs) {
      setDepartments(
        programsData.programs.map((p: any) => ({
          id: p.id,
          collegeId: p.collegeId,
          name: p.name,
          code: p.code,
          status: "active",
        })),
      );
    }
  }, [programsData]);

  const [maintenanceMode] = useState(false);
  const [configStatus] = useState("Operational");
  // Modals state
  const [modalCol, setModalCol] = useState(false);
  const [modalDept, setModalDept] = useState(false);

  // Form states
  const [colName, setColName] = useState("");
  const [colCode, setColCode] = useState("");
  const [deptCollege, setDeptCollege] = useState("");
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/api/colleges", {
        name: colName.trim(),
        code: colCode.trim().toUpperCase(),
        isActive: true,
      });
      await refetchColleges();
      setModalCol(false);
      setColName("");
      setColCode("");
      triggerToast(
        `Successfully onboarded college ${colCode.trim().toUpperCase()}`,
      );
    } catch (error) {
      triggerToast(
        error instanceof Error
          ? `Could not onboard college: ${error.message}`
          : "Could not onboard college.",
      );
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/api/programs", {
        collegeId: deptCollege,
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase(),
        isActive: true,
      });
      await Promise.all([refetchPrograms(), refetchColleges()]);
      setModalDept(false);
      setDeptCollege("");
      setDeptName("");
      setDeptCode("");
      triggerToast(`Added department ${deptCode.trim().toUpperCase()}`);
    } catch (error) {
      triggerToast(
        error instanceof Error
          ? `Could not add department: ${error.message}`
          : "Could not add department.",
      );
    }
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
    router.push(`/system-admin/dashboard?tab=${tab}`);
  };

  if (activeTab === "overview" && (collegesLoading || programsLoading || usersLoading || academicYearsLoading || researchLoading)) {
    return <DashboardSkeleton />;
  }
  if (activeTab === "onboarding" && (collegesLoading || programsLoading)) return <TablePageSkeleton />;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent text-slate-800 transition-colors dark:text-slate-100">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-[#0B3A53] border border-[#C9A227]/30 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-[#C9A227]" />
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* TAB CONTENTS */}
        {(() => {
          if (activeTab === "announcements") return <SystemAnnouncements />;
          if (activeTab === "users") return <UserManagement />;
          if (activeTab === "integrations") return <GoogleDriveIntegration />;

          if (activeTab === "onboarding") {
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b] flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      College & Department Onboarding
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Manage academic divisions, departments, and map university
                      profiles.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModalCol(true)}
                      className="px-4 py-2 bg-[#C9A227] hover:brightness-105 text-[#0B3A53] font-black text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      Onboard College
                    </button>
                    <button
                      onClick={() => setModalDept(true)}
                      className="px-4 py-2 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer"
                    >
                      Add Department
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-3 bg-white dark:bg-[#101b2b]">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-2.5">
                      Colleges ({colleges.length})
                    </h4>
                    {collegesLoading ? (
                      <div className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /></div>
                    ) : collegesError ? (
                      <button
                        onClick={() => void refetchColleges()}
                        className="text-left text-xs font-semibold text-rose-600"
                      >
                        Unable to load colleges. Retry
                      </button>
                    ) : (
                      colleges.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 bg-slate-50/70 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center text-xs"
                        >
                          <span className="font-bold text-slate-900 dark:text-white">
                            {c.name}
                          </span>
                          <span className="font-mono text-[10px] bg-[#0B3A53]/10 text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227] px-2 py-0.5 rounded font-black">
                            {c.code}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-3 bg-white dark:bg-[#101b2b]">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-2.5">
                      Departments ({departments.length})
                    </h4>
                    {programsLoading ? (
                      <div className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /></div>
                    ) : programsError ? (
                      <button
                        onClick={() => void refetchPrograms()}
                        className="text-left text-xs font-semibold text-rose-600"
                      >
                        Unable to load departments. Retry
                      </button>
                    ) : (
                      departments.map((d) => (
                        <div
                          key={d.id}
                          className="p-3 bg-slate-50/70 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center text-xs"
                        >
                          <span className="font-bold text-slate-900 dark:text-white">
                            {d.name}
                          </span>
                          <span className="text-[10px] uppercase font-mono font-black text-[#C9A227]">
                            {d.code}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (activeTab === "logs") {
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-6 flex flex-col gap-4 dark:border-white/10 dark:bg-[#101b2b]">
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  System Audit Logs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Monitor server operations, configuration updates, and
                  permission changes.
                </p>
                <div className="bg-slate-50/70 dark:bg-white/[0.02] p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-xs text-center text-slate-500 dark:text-slate-400">
                  Audit log stream is operational. No anomalous system access
                  events recorded in the last 24 hours.
                </div>
              </div>
            );
          }

          if (activeTab === "backups") {
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-6 flex flex-col gap-4 dark:border-white/10 dark:bg-[#101b2b]">
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Backup & Restore Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
                    className="px-5 py-2.5 bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400 font-extrabold text-xs rounded-xl cursor-not-allowed"
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
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Global Role Permission Matrix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Active role capabilities for Student, Adviser, Professor,
                  Panelist, Dean, and Administrator accounts.
                </p>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-black uppercase text-[10px] tracking-wider">
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
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  System Parameter Configuration
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Portal Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Moon className="h-5 w-5 text-slate-400" />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-sm">
                          Dark Mode
                        </span>
                        <span className="text-xs text-slate-400">
                          Toggle University Light or Elevated Dark Navy
                          appearance.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isDark}
                      onChange={toggleTheme}
                      className="accent-[#C9A227] w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            );
          }

          // OVERVIEW
          return (
            <>
              <DashboardWelcome
                firstName={user?.firstName}
                fallbackName="System Administrator"
                summary="Here's an overview of system activity, users, programs, and configuration status."
                actions={
                  <>
                    <button
                      onClick={() => setModalCol(true)}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-4 text-xs font-black text-[#0B3A53] shadow-xs transition hover:brightness-105 sm:flex-none"
                    >
                      <Plus className="h-4 w-4" /> Onboard College
                    </button>
                    <button
                      onClick={() => setModalDept(true)}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-xs font-bold text-white backdrop-blur-xs transition hover:bg-white/20 sm:flex-none"
                    >
                      <Plus className="h-4 w-4" /> Add Department
                    </button>
                  </>
                }
              />
              {/* KEY METRICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Users",
                    value: usersData?.users?.length || 0,
                    suffix: "accounts",
                    icon: Users,
                    tone: "text-[#0B3A53] dark:text-[#C9A227] bg-[#0B3A53]/10 dark:bg-white/10",
                  },
                  {
                    label: "Active Programs",
                    value: departments.length,
                    suffix: "programs",
                    icon: Layers,
                    tone: "text-[#8A6A0B] dark:text-[#C9A227] bg-[#C9A227]/15",
                  },
                  {
                    label: "Academic Years",
                    value: academicYearsData?.academicYears?.length || 0,
                    suffix: "configured",
                    icon: Database,
                    tone: "text-[#0B3A53] dark:text-[#C9A227] bg-[#0B3A53]/10 dark:bg-white/10",
                  },
                  {
                    label: "Research Projects",
                    value: researchData?.projects?.length || 0,
                    suffix: "registered",
                    icon: FileText,
                    tone: "text-[#C9A227] bg-[#C9A227]/10",
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:border-white/10 dark:bg-[#101b2b]"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${metric.tone} transition-transform duration-200 group-hover:scale-105`}
                      >
                        <metric.icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block truncate">
                          {metric.label}
                        </span>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            {metric.value}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                            · {metric.suffix}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2.5">
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        Live system data
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                ))}
              </div>

              <GoogleDriveIntegration
                compact
                onManage={() => handleTabChange("integrations")}
              />

              {/* OVERVIEW CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b] flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        System Overview
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Live academic colleges, programs, and administration
                        scope.
                      </p>
                    </div>
                    <button
                      onClick={() => setModalCol(true)}
                      className="text-xs font-extrabold text-[#0B3A53] dark:text-[#C9A227] hover:underline"
                    >
                      + Onboard
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {collegesLoading && (
                      <div className="space-y-2"><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></div>
                    )}
                    {collegesError && (
                      <button
                        onClick={() => void refetchColleges()}
                        className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-xs font-semibold text-rose-700"
                      >
                        Colleges could not be loaded. Click to retry.
                      </button>
                    )}
                    {!collegesLoading &&
                      !collegesError &&
                      colleges.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                          No colleges have been onboarded.
                        </div>
                      )}
                    {colleges.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 border border-slate-100 dark:border-white/5 rounded-xl flex justify-between items-center text-xs bg-slate-50/70 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {c.name} ({c.code})
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Dean Officer · {c.deptsCount} Departments
                          </span>
                        </div>
                        <Tag
                          variant={c.status === "active" ? "success" : "warn"}
                        >
                          {c.status}
                        </Tag>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b] flex flex-col gap-4">
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Quick Actions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Open common administration and configuration workspaces.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleTabChange("users")}
                      className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/60 dark:hover:bg-white/[0.04] text-left transition-all group"
                    >
                      <Users className="h-5 w-5 text-[#0B3A53] dark:text-[#C9A227] mb-2 group-hover:scale-105 transition-transform" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">
                        Manage Users
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Audit user profiles & accounts
                      </span>
                    </button>

                    <button
                      onClick={() => handleTabChange("onboarding")}
                      className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/60 dark:hover:bg-white/[0.04] text-left transition-all group"
                    >
                      <Building2 className="h-5 w-5 text-[#0B3A53] dark:text-[#C9A227] mb-2 group-hover:scale-105 transition-transform" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">
                        Manage Programs
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Colleges and academic programs
                      </span>
                    </button>

                    <button
                      onClick={() => handleTabChange("config")}
                      className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/60 dark:hover:bg-white/[0.04] text-left transition-all group"
                    >
                      <Sliders className="h-5 w-5 text-[#0B3A53] dark:text-[#C9A227] mb-2 group-hover:scale-105 transition-transform" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">
                        System Config
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Platform parameters and status
                      </span>
                    </button>

                    <button
                      onClick={() => handleTabChange("settings")}
                      className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/60 dark:hover:bg-white/[0.04] text-left transition-all group"
                    >
                      <Settings className="h-5 w-5 text-[#0B3A53] dark:text-[#C9A227] mb-2 group-hover:scale-105 transition-transform" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">
                        System Settings
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Maintenance and preferences
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Recent System Activity
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Current live state from the system&apos;s user, academic,
                      and infrastructure records.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTabChange("logs")}
                    className="shrink-0 text-xs font-extrabold text-[#0B3A53] hover:underline dark:text-[#C9A227]"
                  >
                    View audit logs{" "}
                    <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "User directory",
                      detail: `${usersData?.users?.length || 0} accounts available`,
                      icon: Users,
                      tone: "bg-[#0B3A53]/10 text-[#0B3A53]",
                    },
                    {
                      label: "Academic registry",
                      detail: `${departments.length} programs · ${academicYearsData?.academicYears?.length || 0} years`,
                      icon: Building2,
                      tone: "bg-blue-50 text-blue-600",
                    },
                    {
                      label: "Platform configuration",
                      detail: configStatus,
                      icon: Sliders,
                      tone: "bg-emerald-50 text-emerald-600",
                    },
                    {
                      label: "Maintenance mode",
                      detail: maintenanceMode ? "Active" : "Normal operation",
                      icon: Wrench,
                      tone: "bg-amber-50 text-amber-700",
                    },
                  ].map((activity) => (
                    <div
                      key={activity.label}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]"
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${activity.tone} dark:bg-white/10 dark:text-[#C9A227]`}
                      >
                        <activity.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900 dark:text-white">
                          {activity.label}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {activity.detail}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          );
        })()}
      </main>

      {/* ONBOARD COLLEGE MODAL */}
      {modalCol && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101b2b] rounded-2xl border border-slate-200 dark:border-white/10 max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-slate-800 dark:text-slate-100">
            <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#C9A227]" />
              Onboard College Unit
            </h3>
            <form
              onSubmit={handleAddCollege}
              className="flex flex-col gap-3 text-xs"
            >
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  College Name
                </label>
                <input
                  required
                  type="text"
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  placeholder="e.g. College of Science"
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#0B3A53]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  College Code
                </label>
                <input
                  required
                  type="text"
                  value={colCode}
                  onChange={(e) => setColCode(e.target.value)}
                  placeholder="e.g. COS"
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#0B3A53]"
                />
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-100 dark:border-white/5 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setModalCol(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C9A227] hover:brightness-105 text-[#0B3A53] font-black rounded-xl cursor-pointer"
                >
                  Onboard College
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DEPARTMENT MODAL */}
      {modalDept && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101b2b] rounded-2xl border border-slate-200 dark:border-white/10 max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-slate-800 dark:text-slate-100">
            <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#C9A227]" />
              Add Department
            </h3>
            <form
              onSubmit={handleAddDept}
              className="flex flex-col gap-3 text-xs"
            >
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  Affiliated College
                </label>
                <select
                  required
                  value={deptCollege}
                  onChange={(e) => setDeptCollege(e.target.value)}
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="" className="dark:bg-[#101b2b]">
                    Select College
                  </option>
                  {colleges.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      className="dark:bg-[#101b2b]"
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  Department Name
                </label>
                <input
                  required
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Physics Department"
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  Department Code
                </label>
                <input
                  required
                  type="text"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="e.g. PHYS"
                  className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-100 dark:border-white/5 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setModalDept(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C9A227] hover:brightness-105 text-[#0B3A53] font-black rounded-xl cursor-pointer"
                >
                  Add Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemAdminDashboardPage() {
  return (
    <Suspense
      fallback={<DashboardSkeleton />}
    >
      <SystemAdminDashboardContent />
    </Suspense>
  );
}
