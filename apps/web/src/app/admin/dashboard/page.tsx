"use client";

import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";

// ─── MOCK DATABASE / STATE FOR ADMINISTRATIVE PANEL ───
const INITIAL_USERS = [
  { id: "u1", name: "Juan Reyes", email: "student01@university.edu.ph", idNumber: "2023-10045", role: "student", status: "active", department: "Computer Science" },
  { id: "u2", name: "Dr. Rachel Lim", email: "adviser01@university.edu.ph", idNumber: "EMP-2015-88", role: "adviser", status: "active", department: "Information Technology" },
  { id: "u3", name: "Prof. Arthur Pendleton", email: "professor01@university.edu.ph", idNumber: "EMP-2010-12", role: "professor", status: "active", department: "Computer Science" },
  { id: "u4", name: "Dr. Lisa Wong", email: "panelist01@university.edu.ph", idNumber: "EMP-2018-45", role: "panelist", status: "active", department: "Software Engineering" },
  { id: "u5", name: "Sarah G. Garcia", email: "sarah.garcia@university.edu.ph", idNumber: "2023-11882", role: "student", status: "pending", department: "Information Systems" },
  { id: "u6", name: "Marc A. Santos", email: "marc.santos@university.edu.ph", idNumber: "2023-12001", role: "student", status: "pending", department: "Computer Science" },
  { id: "u7", name: "John Doe", email: "john.doe@university.edu.ph", idNumber: "2022-10492", role: "student", status: "suspended", department: "Software Engineering" },
];

const INITIAL_PROJECTS = [
  { id: "p1", title: "AI-based Crop Yield Prediction System Using ML", student: "Juan Reyes", adviser: "Dr. Rachel Lim", department: "Computer Science", status: "ongoing", progress: 65 },
  { id: "p2", title: "Smart Traffic Management System using IoT & Edge Computing", student: "Lando Vance", adviser: "Prof. Arthur Pendleton", department: "Information Technology", status: "for defense", progress: 85 },
  { id: "p3", title: "Blockchain-based Academic Credentials Verification System", student: "Santi Perez", adviser: "Dr. Rachel Lim", department: "Computer Science", status: "revision", progress: 45 },
  { id: "p4", title: "Automated Waste Sorting System using Computer Vision", student: "Clara Gomez", adviser: "Dr. Lisa Wong", department: "Software Engineering", status: "proposal", progress: 20 },
  { id: "p5", title: "Virtual Class VR Laboratory Environment for STEM", student: "Alex Ramos", adviser: "Dr. Rachel Lim", department: "Information Systems", status: "completed", progress: 100 },
];

const INITIAL_DEFENSES = [
  { id: "d1", title: "AI Crop Yield Prediction System", type: "Proposal", date: "2026-07-10", time: "10:00 AM", venue: "CL-3 Lab", panelists: ["Dr. Lisa Wong", "Prof. A. Pendleton"], status: "scheduled" },
  { id: "d2", title: "Smart Traffic Management System", type: "Final Defense", date: "2026-07-12", time: "02:00 PM", venue: "CCS Seminar Hall", panelists: ["Dr. Rachel Lim", "Dr. Lisa Wong"], status: "scheduled" },
  { id: "d3", title: "Blockchain Credentials System", type: "Pre-Defense", date: "2026-06-25", time: "09:00 AM", venue: "Zoom Room A", panelists: ["Prof. A. Pendleton", "Dr. Rachel Lim"], status: "completed" },
];

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();

  // Query live users and projects
  const { data: usersData } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.get<{ users: any[] }>("/api/users").catch(() => ({ users: [] })),
    staleTime: 60000,
  });

  const { data: researchData } = useQuery({
    queryKey: ["admin-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  // Data states
  const [users, setUsers] = useState(INITIAL_USERS);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [defenses, setDefenses] = useState(INITIAL_DEFENSES);

  useEffect(() => {
    if (usersData?.users && usersData.users.length > 0) {
      setUsers(
        usersData.users.map((u: any) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          idNumber: u.universityId || "2026-0001",
          role: u.roles?.[0]?.role?.name?.toLowerCase() || "student",
          status: u.status?.toLowerCase() || "active",
          department: u.program?.name || u.college?.name || "College of Computing",
        }))
      );
    }
  }, [usersData]);

  useEffect(() => {
    if (researchData?.projects && researchData.projects.length > 0) {
      setProjects(
        researchData.projects.map((p: any) => ({
          id: p.id,
          title: p.title,
          student: p.members?.[0]?.user?.firstName ? `${p.members[0].user.firstName} ${p.members[0].user.lastName}` : "Student Lead",
          adviser: "Dr. Rachel Lim",
          department: p.program?.name || "Computer Science",
          status: p.status?.toLowerCase() || "ongoing",
          progress: 60,
        }))
      );
    }
  }, [researchData]);

  const [deadlines, setDeadlines] = useState([
    { id: "dl1", title: "Proposal Outline Upload", date: "2026-07-01", type: "Proposal", status: "upcoming" },
    { id: "dl2", title: "Chapter 1-3 Final Draft Submission", date: "2026-07-15", type: "Milestone", status: "upcoming" },
    { id: "dl3", title: "Ethics Clearance Letter", date: "2026-06-24", type: "Compliance", status: "completed" },
  ]);
  const [certificates, setCertificates] = useState([
    { id: "c1", project: "Virtual Class VR Lab", student: "Alex Ramos", date: "2026-06-20", number: "CERT-2026-904", status: "released" },
    { id: "c2", project: "Smart Traffic Management", student: "Lando Vance", date: "Pending Defense", number: "", status: "pending" },
  ]);

  // Search & Filters
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  // Modal Control States
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalApprove, setModalApprove] = useState(false);
  const [modalSuspend, setModalSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  
  const [modalDefense, setModalDefense] = useState(false);
  const [defTitle, setDefTitle] = useState("");
  const [defType, setDefType] = useState("Proposal");
  const [defDate, setDefDate] = useState("");
  const [defTime, setDefTime] = useState("");
  const [defVenue, setDefVenue] = useState("");
  const [defPanelists, setDefPanelists] = useState<string[]>([]);
  
  const [modalCert, setModalCert] = useState(false);
  const [certProject, setCertProject] = useState<any>(null);
  
  const [modalDeadline, setModalDeadline] = useState(false);
  const [dlTitle, setDlTitle] = useState("");
  const [dlType, setDlType] = useState("Milestone");
  const [dlDate, setDlDate] = useState("");
  
  const [modalExport, setModalExport] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");

  // Success Feedback Toast Mock
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Actions handlers
  const handleApproveConfirm = async () => {
    if (!selectedUser) return;
    try {
      await apiClient.patch(`/api/users/${selectedUser.id}/status`, { status: "ACTIVE" });
    } catch (e) {}
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: "active" } : u));
    setModalApprove(false);
    triggerToast(`Approved account for ${selectedUser.name} successfully.`);
  };

  const handleSuspendConfirm = async () => {
    if (!selectedUser) return;
    try {
      await apiClient.patch(`/api/users/${selectedUser.id}/status`, { status: "SUSPENDED" });
    } catch (e) {}
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: "suspended" } : u));
    setModalSuspend(false);
    setSuspendReason("");
    triggerToast(`Suspended account for ${selectedUser.name} successfully.`);
  };

  const handleCreateDefense = (e: React.FormEvent) => {
    e.preventDefault();
    const newDef = {
      id: Math.random().toString(),
      title: defTitle,
      type: defType,
      date: defDate,
      time: defTime,
      venue: defVenue,
      panelists: defPanelists,
      status: "scheduled",
    };
    setDefenses(prev => [...prev, newDef]);
    setModalDefense(false);
    triggerToast("Created new defense schedule panel successfully.");
  };

  const handleGenerateCertificateConfirm = () => {
    if (!certProject) return;
    const certNum = `CERT-2026-${Math.floor(100 + Math.random() * 900)}`;
    setCertificates(prev => [
      ...prev.filter(c => c.student !== certProject.student),
      { id: Math.random().toString(), project: certProject.title, student: certProject.student, date: "2026-06-28", number: certNum, status: "released" }
    ]);
    setModalCert(false);
    triggerToast(`Certificate of Completion generated: ${certNum}`);
  };

  const handleCreateDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    const newDl = {
      id: Math.random().toString(),
      title: dlTitle,
      date: dlDate,
      type: dlType,
      status: "upcoming",
    };
    setDeadlines(prev => [...prev, newDl]);
    setModalDeadline(false);
    triggerToast(`Added academic deadline: ${dlTitle}`);
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
    router.push(`/admin/dashboard?tab=${tab}`);
  };

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { id: "users", label: "User Accounts", icon: "ti-users", badge: users.filter(u=>u.status==="pending").length },
    { id: "defense", label: "Defense Scheduling", icon: "ti-calendar-event" },
    { id: "projects", label: "Research Projects", icon: "ti-folder-check", badge: projects.length },
    { id: "deadlines", label: "Deadlines & Calendar", icon: "ti-clock" },
    { id: "certificates", label: "Certificates", icon: "ti-certificate" },
    { id: "reports", label: "Reports & Analytics", icon: "ti-file-analytics" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen text-slate-800 bg-white font-sans">
      
      {toast && (
        <div className="fixed top-5 right-5 z-55 bg-[#1b4264] border-l-4 border-[#ffa400] text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-fade-in-up">
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12.5px] font-bold">{toast}</span>
        </div>
      )}

      {/* TABS HEADER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 pt-3 flex gap-2 overflow-x-auto shadow-sm">
        {tabsList.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-[12px] font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-[#1b4264] text-[#1b4264] bg-slate-50 shadow-sm"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              <i className={`ti ${tab.icon} text-sm ${isActive ? "text-[#1b4264]" : ""}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isActive ? "bg-[#1b4264] text-[#ffa400]" : "bg-slate-200 text-slate-700"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* BODY PANEL */}
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto bg-slate-50">
        
        {(() => {
          const tabTitles: Record<string, string> = {
            overview: "Admin Dashboard",
            users: "User Account Management",
            defense: "Defense Scheduling Management",
            projects: "Research Project Monitoring",
            deadlines: "Deadline and Academic Calendar Management",
            certificates: "Certificate Generation Oversight",
            reports: "Report Generation",
            analytics: "Analytics Dashboard",
            repository: "Repository Management",
            settings: "Settings",
          };

          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <>
                {/* 8 OVERVIEW CARDS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-users" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Total Users</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{users.length} Active</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-user-plus" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Pending Accounts</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{users.filter(u=>u.status==='pending').length} Requests</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Defense Panels</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{defenses.length} Scheduled</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-target" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Active Studies</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{projects.length} Ongoing</span>
                    </div>
                  </div>
                </div>

                {/* Quick summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Pending User Account Actions</h3>
                    <div className="flex flex-col gap-2.5">
                      {users.filter(u => u.status === "pending").slice(0, 3).map(u => (
                        <div key={u.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px]">
                          <div>
                            <span className="font-bold text-[#1b4264] block">{u.name}</span>
                            <span className="text-[10px] text-slate-400">{u.role} · {u.email}</span>
                          </div>
                          <button onClick={() => { setSelectedUser(u); setModalApprove(true); }} className="px-2.5 py-1 bg-[#ffa400] text-[#1b4264] font-extrabold text-[10px] rounded border border-[#ffa400] cursor-pointer">
                            Activate
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Upcoming Academic Deadlines</h3>
                    <div className="flex flex-col gap-2.5">
                      {deadlines.slice(0, 3).map(dl => (
                        <div key={dl.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px] flex justify-between items-center">
                          <div>
                            <span className="font-bold text-[#1b4264] block">{dl.title}</span>
                            <span className="text-[10px] text-slate-400">{dl.date}</span>
                          </div>
                          <Tag variant={dl.status==='completed'?'success':'warn'}>{dl.status}</Tag>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ),
            users: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px]">User Account Management</h3>
                    <p className="text-[11px] text-slate-400 font-bold">Activate, suspend, or configure user permissions.</p>
                  </div>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search user ID, name, email..."
                      className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[12.5px] w-64 focus:outline-none focus:border-[#ffa400]" 
                    />
                  </div>
                </div>

                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[#1b4264] font-extrabold uppercase text-[10px]">
                        <th className="py-2.5">Name</th>
                        <th className="py-2.5">Role</th>
                        <th className="py-2.5">Email</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                        <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 font-bold text-[#1b4264]">{u.name}</td>
                          <td className="py-3 text-slate-500 font-medium">{u.role}</td>
                          <td className="py-3 text-slate-500">{u.email}</td>
                          <td className="py-3">
                            <Tag variant={u.status === "active" ? "success" : u.status === "pending" ? "warn" : "info"}>{u.status}</Tag>
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              {u.status === "pending" && (
                                <button 
                                  onClick={() => { setSelectedUser(u); setModalApprove(true); }}
                                  className="px-2.5 py-1 bg-[#ffa400] text-[#1b4264] font-extrabold rounded text-[10.5px] cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              {u.status === "active" && (
                                <button 
                                  onClick={() => { setSelectedUser(u); setModalSuspend(true); }}
                                  className="px-2.5 py-1 bg-white text-[#1b4264] hover:bg-slate-50 rounded border border-slate-300 cursor-pointer font-bold text-[10.5px]"
                                >
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
            defense: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Scheduling Management</h3>
                    <p className="text-[11px] text-slate-400 font-bold">Assign presentation formats, schedules, venues, and coordinator evaluations.</p>
                  </div>
                  <button 
                    onClick={() => setModalDefense(true)} 
                    className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] shadow cursor-pointer text-[12px]"
                  >
                    Schedule Panel
                  </button>
                </div>
                <div className="flex flex-col gap-3.5 mt-2">
                  {defenses.map(d => (
                    <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{d.title}</span>
                        <span className="text-[11px] text-slate-500">{d.date} at {d.time} · Venue: {d.venue}</span>
                        <span className="text-[10px] text-slate-400 block mt-1">Panelists: {d.panelists.join(", ")}</span>
                      </div>
                      <Tag variant="warn">{d.type}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            projects: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Project Monitoring</h3>
                <p className="text-[11px] text-slate-400 font-bold">Oversight indicators showing status indexes, advisee metadata, and milestones.</p>
                <div className="flex flex-col gap-3.5 mt-2">
                  {projects.map(p => (
                    <div key={p.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{p.title}</span>
                        <span className="text-[11px] text-slate-500">Representative: {p.student} · Adviser: {p.adviser}</span>
                      </div>
                      <Tag variant={p.status === "completed" ? "success" : "warn"}>{p.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            deadlines: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px]">Deadline & Academic Calendar Management</h3>
                    <p className="text-[11px] text-slate-400 font-bold">Configure outline, compliance form, and final draft schedule boundaries.</p>
                  </div>
                  <button 
                    onClick={() => setModalDeadline(true)} 
                    className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] shadow cursor-pointer text-[12px]"
                  >
                    Add Deadline
                  </button>
                </div>
                <div className="flex flex-col gap-3.5 mt-2">
                  {deadlines.map(dl => (
                    <div key={dl.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{dl.title}</span>
                        <span className="text-[11px] text-slate-500">Due Date: {dl.date}</span>
                      </div>
                      <Tag variant={dl.status === "completed" ? "success" : "warn"}>{dl.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            certificates: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div>
                  <h3 className="font-extrabold text-[#1b4264] text-[16px]">Certificate of Completion Management</h3>
                  <p className="text-[11px] text-slate-400 font-bold">Review eligibility requirements and generate official validation credentials.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  
                  {/* Completed Projects List */}
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 bg-white">
                    <h4 className="font-extrabold text-[13px] text-[#1b4264] border-b border-slate-100 pb-2">Completed Research Status</h4>
                    {projects.filter(p => p.status === "completed").map(proj => (
                      <div key={proj.id} className="p-3 bg-white border border-slate-200 rounded-lg flex justify-between items-center text-[12px] shadow-sm">
                        <div>
                          <span className="font-bold text-slate-800 block">{proj.title}</span>
                          <span className="text-[10px] text-slate-400">{proj.student} · Adviser: {proj.adviser}</span>
                        </div>
                        <button 
                          onClick={() => { setCertProject(proj); setModalCert(true); }}
                          className="px-3 py-1 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold text-[11px] rounded shadow cursor-pointer border border-[#ffa400]"
                        >
                          Generate Cert
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Generated Certificates List */}
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 bg-white">
                    <h4 className="font-extrabold text-[13px] text-[#1b4264] border-b border-slate-100 pb-2">Released Certificates Archive</h4>
                    {certificates.map(c => (
                      <div key={c.id} className="p-3 bg-white border border-slate-200 rounded-lg flex justify-between items-center text-[12px] shadow-sm">
                        <div>
                          <span className="font-bold text-slate-800 block">{c.project}</span>
                          <span className="text-[10px] text-[#1b4264] font-mono">{c.number} · {c.date}</span>
                        </div>
                        <Tag variant="success">{c.status}</Tag>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            ),
            reports: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px]">Report Generation</h3>
                    <p className="text-[11px] text-slate-400 font-bold">Compile institutional metrics, adviser ratios, and performance indexes.</p>
                  </div>
                  <button 
                    onClick={() => setModalExport(true)} 
                    className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] shadow cursor-pointer text-[12px]"
                  >
                    Configure & Export Report
                  </button>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Recent Export Logs:</strong></div>
                  <div>1. Active Proposals Summary — Excel · Jun 25, 2026</div>
                  <div>2. Faculty Advisory Load Allocation — PDF · Jun 20, 2026</div>
                </div>
              </div>
            ),
            analytics: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Analytics Dashboard</h3>
                <p className="text-[11px] text-slate-400 font-bold">Visual summaries showing college-wide capstone metrics averages.</p>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-sm text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Avg Progress Rate</span>
                    <span className="text-[20px] font-extrabold text-[#1b4264] block mt-1">75% Complete</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-sm text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Graduation Clearance</span>
                    <span className="text-[20px] font-extrabold text-[#ffa400] block mt-1">12 Approved</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-sm text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Adviser Ratio</span>
                    <span className="text-[20px] font-extrabold text-[#1b4264] block mt-1">1:4 CS Average</span>
                  </div>
                </div>
              </div>
            ),
            repository: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Repository Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Oversight indexes containing approved and QR-validated capstone documents.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Archived Projects:</strong> 12 Verified Systems</div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="text-[11.5px] font-medium flex flex-col gap-2">
                    <div>1. SECURE DECENTRALIZED GRADING SYSTEM (A.Y. 2025 CS)</div>
                    <div>2. IOT SMART HOME HUB SECURITY (A.Y. 2025 IT)</div>
                  </div>
                </div>
              </div>
            ),
            settings: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Portal Settings</h3>
                <p className="text-[11px] text-slate-400 font-bold">Manage your notification channels, credential limits, and metadata formats.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-[#1b4264] block">Email Notifications</span>
                      <span className="text-[10px] text-slate-400">Receive system notifications via email address.</span>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-[#ffa400] w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[#1b4264] block">Dark Mode</span>
                      <span className="text-[10px] text-slate-400">Switch platform styling theme to night vision.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isDark}
                      onChange={toggleTheme}
                      className="accent-[#ffa400] w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ),
          };

          return tabContent[activeTab] || tabContent.overview;
        })()}

      </main>

      {/* MODAL 1: APPROVE USER ACCOUNT */}
      {modalApprove && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#ffa400] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-circle-check text-[#ffa400] text-xl" />
              Approve User Account
            </h3>
            <p className="text-[12.5px] text-slate-500 leading-relaxed">
              Are you sure you want to approve the account for <strong className="text-slate-800">{selectedUser.name}</strong> ({selectedUser.email})? 
              This will grant them immediate access to their designated portal.
            </p>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                onClick={() => setModalApprove(false)} 
                className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg text-[12.5px] font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleApproveConfirm}
                className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-[12.5px] cursor-pointer"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SUSPEND USER ACCOUNT */}
      {modalSuspend && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-alert-triangle text-[#ffa400] text-xl" />
              Suspend User Account
            </h3>
            <div className="flex flex-col gap-2">
              <p className="text-[12.5px] text-slate-500 leading-relaxed font-semibold">
                Provide a reason for suspending <strong className="text-slate-800">{selectedUser.name}</strong>. They will be locked out from access.
              </p>
              <textarea 
                required
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for account suspension..."
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400]"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                onClick={() => setModalSuspend(false)} 
                className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg text-[12.5px] font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSuspendConfirm}
                className="px-4 py-2 bg-[#1b4264] hover:bg-opacity-90 text-white font-extrabold rounded-lg text-[12.5px] cursor-pointer"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE DEFENSE SCHEDULE */}
      {modalDefense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-lg w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4 text-slate-800">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-calendar-plus text-[#ffa400] text-xl" />
              Schedule Defense Panel
            </h3>
            
            <form onSubmit={handleCreateDefense} className="flex flex-col gap-3 text-[12px]">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-600">Research Project Target</label>
                <select 
                  required
                  value={defTitle}
                  onChange={(e) => setDefTitle(e.target.value)}
                  className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400]"
                >
                  <option value="">Select Active Study</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.title}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Defense Type</label>
                  <select 
                    value={defType}
                    onChange={(e) => setDefType(e.target.value)}
                    className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                  >
                    <option value="Proposal">Proposal Defense</option>
                    <option value="Pre-Defense">Pre-Defense</option>
                    <option value="Final Defense">Final Defense</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Defense Date</label>
                  <input 
                    type="date" 
                    required
                    value={defDate}
                    onChange={(e) => setDefDate(e.target.value)}
                    className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Scheduled Time</label>
                  <input 
                    type="text" 
                    required
                    value={defTime}
                    onChange={(e) => setDefTime(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Venue / Location</label>
                  <input 
                    type="text" 
                    required
                    value={defVenue}
                    onChange={(e) => setDefVenue(e.target.value)}
                    placeholder="e.g. CCS Room 204 or Zoom Link"
                    className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input type="checkbox" id="conflict-toggle" defaultChecked className="rounded text-[#1b4264] focus:ring-0" />
                <label htmlFor="conflict-toggle" className="text-[11px] text-slate-600 select-none cursor-pointer">
                  Avoid Panelist & Venue Schedule Conflict Overlaps
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button 
                  type="button"
                  onClick={() => setModalDefense(false)} 
                  className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 cursor-pointer text-[12px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg cursor-pointer text-[12px]"
                >
                  Schedule Panel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE CERTIFICATE OF COMPLETION */}
      {modalCert && certProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#ffa400] max-w-lg w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4 text-slate-800">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-award text-[#ffa400] text-xl" />
              Generate Certificate of Completion
            </h3>

            <div className="bg-white border border-slate-250 p-4 rounded-xl flex flex-col gap-2.5 text-[12px] shadow-sm">
              <div className="text-center font-extrabold text-[#1b4264] text-[14px]">Advisio Verification Template</div>
              <div className="h-px bg-slate-200" />
              <p className="text-center italic text-slate-500 my-2 leading-relaxed font-semibold">
                This certifies that <strong className="text-[#1b4264] font-extrabold">{certProject.student}</strong> has completed the research study titled 
                <strong className="text-[#1b4264] block font-extrabold mt-1">"{certProject.title}"</strong> 
                complying with all institutional capstone validation milestones under adviser <strong className="text-slate-800 font-bold">{certProject.adviser}</strong>.
              </p>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>College: CCS</span>
                <span>Date: June 28, 2026</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button 
                onClick={() => setModalCert(false)} 
                className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg text-[12.5px] font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateCertificateConfirm}
                className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-[12.5px] cursor-pointer"
              >
                Approve & Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD ACADEMIC DEADLINE */}
      {modalDeadline && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-alarm text-[#ffa400] text-xl" />
              Create Academic Deadline
            </h3>
            
            <form onSubmit={handleCreateDeadline} className="flex flex-col gap-3 text-[12px]">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-600">Milestone / Title</label>
                <input 
                  type="text" 
                  required
                  value={dlTitle}
                  onChange={(e) => setDlTitle(e.target.value)}
                  placeholder="e.g. Chapter 4-5 Submission"
                  className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400] focus:ring-1 focus:ring-[#ffa400]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Deadline Type</label>
                  <select 
                    value={dlType}
                    onChange={(e) => setDlType(e.target.value)}
                    className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                  >
                    <option value="Proposal">Proposal</option>
                    <option value="Milestone">Milestone</option>
                    <option value="Defense">Defense</option>
                    <option value="Revision">Revision</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Due Date</label>
                  <input 
                    type="date" 
                    required
                    value={dlDate}
                    onChange={(e) => setDlDate(e.target.value)}
                    className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button 
                  type="button"
                  onClick={() => setModalDeadline(false)} 
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 cursor-pointer text-[12px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg cursor-pointer text-[12px]"
                >
                  Create Deadline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: EXPORT REPORT */}
      {modalExport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4 text-slate-800">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-download text-[#ffa400] text-xl" />
              Export Operations Report
            </h3>
            
            <div className="flex flex-col gap-3 text-[12px]">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-600">Report Category</label>
                <select className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none">
                  <option>Adviser Workload and Panel Assignments</option>
                  <option>Completed vs Ongoing Studies Summary</option>
                  <option>Defense Panel Schedules</option>
                  <option>User Registry Logs</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Date Range (From)</label>
                  <input type="date" defaultValue="2026-06-01" className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Date Range (To)</label>
                  <input type="date" defaultValue="2026-06-28" className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-600">Output Format</label>
                <div className="flex gap-4 mt-1 font-semibold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="format" checked={exportFormat==='pdf'} onChange={()=>setExportFormat('pdf')} className="text-[#1b4264] focus:ring-0" />
                    <span>PDF</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="format" checked={exportFormat==='xlsx'} onChange={()=>setExportFormat('xlsx')} className="text-[#1b4264] focus:ring-0" />
                    <span>Excel (.xlsx)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="format" checked={exportFormat==='csv'} onChange={()=>setExportFormat('csv')} className="text-[#1b4264] focus:ring-0" />
                    <span>CSV</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
              <button 
                onClick={() => setModalExport(false)} 
                className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg text-[12.5px] font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => { setModalExport(false); triggerToast(`Downloaded operations report in ${exportFormat.toUpperCase()} format.`); }}
                className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-[12.5px] cursor-pointer"
              >
                Download Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading Admin Dashboard...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
