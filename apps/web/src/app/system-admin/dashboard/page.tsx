import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";

// Mock colleges, departments, configurations, audit logs
const INITIAL_COLLEGES = [
  { id: "c1", name: "College of Computer Studies", code: "CCS", status: "active", deptsCount: 4, adminName: "Admin Officer" },
  { id: "c2", name: "College of Engineering", code: "COE", status: "active", deptsCount: 6, adminName: "Engr. Clara Santos" },
  { id: "c3", name: "College of Business Administration", code: "CBA", status: "active", deptsCount: 5, adminName: "Prof. Leo Gomez" },
  { id: "c4", name: "College of Science", code: "COS", status: "pending setup", deptsCount: 3, adminName: "None" },
];

const INITIAL_DEPARTMENTS = [
  { id: "d1", collegeId: "c1", name: "Computer Science", code: "CS", status: "active" },
  { id: "d2", collegeId: "c1", name: "Information Technology", code: "IT", status: "active" },
  { id: "d3", collegeId: "c1", name: "Software Engineering", code: "SE", status: "active" },
  { id: "d4", collegeId: "c2", name: "Civil Engineering", code: "CE", status: "active" },
];

function SystemAdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();

  // Query live colleges and programs
  const { data: collegesData } = useQuery({
    queryKey: ["admin-colleges"],
    queryFn: () => apiClient.get<{ colleges: any[] }>("/api/colleges").catch(() => ({ colleges: [] })),
    staleTime: 60000,
  });

  const { data: programsData } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: () => apiClient.get<{ programs: any[] }>("/api/programs").catch(() => ({ programs: [] })),
    staleTime: 60000,
  });

  const [colleges, setColleges] = useState(INITIAL_COLLEGES);
  const [departments, setDepartments] = useState(INITIAL_DEPARTMENTS);

  useEffect(() => {
    if (collegesData?.colleges && collegesData.colleges.length > 0) {
      setColleges(
        collegesData.colleges.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          status: "active",
          deptsCount: c.programs?.length || 0,
          adminName: "Dean Officer",
        }))
      );
    }
  }, [collegesData]);

  useEffect(() => {
    if (programsData?.programs && programsData.programs.length > 0) {
      setDepartments(
        programsData.programs.map((p: any) => ({
          id: p.id,
          collegeId: p.collegeId,
          name: p.name,
          code: p.code,
          status: "active",
        }))
      );
    }
  }, [programsData]);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [configStatus, setConfigStatus] = useState("Optimal");
  const [uptime, setUptime] = useState("99.98%");
  const [roleCount, setRoleCount] = useState(8);
  const [alertsCount, setAlertsCount] = useState(0);

  // Modals state
  const [modalCol, setModalCol] = useState(false);
  const [modalDept, setModalDept] = useState(false);
  const [modalMaint, setModalMaint] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalAssignRole, setModalAssignRole] = useState(false);

  // Form states
  const [colName, setColName] = useState("");
  const [colCode, setColCode] = useState("");
  const [deptCollege, setDeptCollege] = useState("");
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [newConfigName, setNewConfigName] = useState("");
  const [newConfigVal, setNewConfigVal] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/api/colleges", { name: colName, code: colCode.toUpperCase() });
    } catch (e) {}
    setColleges(prev => [...prev, { id: Math.random().toString(), name: colName, code: colCode.toUpperCase(), status: "active", deptsCount: 0, adminName: "None" }]);
    setModalCol(false);
    setColName("");
    setColCode("");
    triggerToast(`Successfully onboarded college ${colCode.toUpperCase()}`);
  };

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    setDepartments(prev => [...prev, { id: Math.random().toString(), collegeId: deptCollege, name: deptName, code: deptCode.toUpperCase(), status: "active" }]);
    setColleges(prev => prev.map(c => c.id === deptCollege ? { ...c, deptsCount: c.deptsCount + 1 } : c));
    setModalDept(false);
    setDeptName("");
    setDeptCode("");
    triggerToast(`Added department ${deptCode.toUpperCase()}`);
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
    router.push(`/system-admin/dashboard?tab=${tab}`);
  };

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { id: "onboarding", label: "College & Programs", icon: "ti-building", badge: colleges.length },
    { id: "roles", label: "Role Permissions", icon: "ti-shield-lock", badge: roleCount },
    { id: "config", label: "System Config", icon: "ti-settings" },
    { id: "logs", label: "Audit Logs", icon: "ti-file-text" },
    { id: "backups", label: "Database Backups", icon: "ti-database" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen text-slate-800 bg-slate-50 font-sans">
      
      {toast && (
        <div className="fixed top-5 right-5 z-55 bg-[#1b4264] border-l-4 border-[#ffa400] text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
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

      {/* MAIN MAIN CONTAINER */}
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
        
        {(() => {
          const tabTitles: Record<string, string> = {
            overview: "System Admin Dashboard",
            onboarding: "College & Department Onboarding",
            logs: "System Audit Logs",
            backups: "Backup & Restore Management",
            roles: "Global Role Permission Matrix",
            config: "System Parameter Configuration",
            settings: "Settings",
          };

          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <>
                {/* EXACT SYSTEM ADMIN CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-building" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Colleges Onboarded</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{colleges.length} Units</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-building-community" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Departments Onboarded</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{departments.length} Depts</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-adjustments" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Platform Config</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{configStatus}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-tool" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Maintenance Status</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{maintenanceMode ? "Active" : "Live"}</span>
                    </div>
                  </div>
                </div>

                {/* Quick overview of colleges and onboarding */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Onboarded Colleges</h3>
                    <div className="flex flex-col gap-3">
                      {colleges.map(c => (
                        <div key={c.id} className="p-3 border border-slate-200 rounded-lg flex justify-between items-center text-[12px] bg-slate-50 hover:border-[#ffa400] transition shadow-sm">
                          <div>
                            <span className="font-bold text-[#1b4264] block">{c.name} ({c.code})</span>
                            <span className="text-[10px] text-slate-400">Admin: {c.adminName}</span>
                          </div>
                          <Tag variant={c.status === 'active' ? 'success' : 'warn'}>{c.status}</Tag>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">System Audit Action Logs</h3>
                    <div className="flex flex-col gap-3 text-[11px] text-slate-500">
                      <div className="p-2 border-b border-slate-100 flex justify-between">
                        <span>Onboarded College Unit (Science)</span>
                        <span className="font-bold text-slate-450">Just now</span>
                      </div>
                      <div className="p-2 border-b border-slate-100 flex justify-between">
                        <span>Assigned CCS Admin Officer to layout portal</span>
                        <span className="font-bold text-slate-450">1 hour ago</span>
                      </div>
                      <div className="p-2 border-b border-slate-100 flex justify-between">
                        <span>Modified Database Maintenance Configuration</span>
                        <span className="font-bold text-slate-450">3 hours ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ),
            onboarding: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px]">College & Department Onboarding</h3>
                    <p className="text-[11px] text-slate-400 font-bold">Manage divisions, departments, and map university academic profiles.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setModalCol(true)} className="px-3.5 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold text-[12px] rounded-lg shadow cursor-pointer border border-[#ffa400]">
                      Onboard College
                    </button>
                    <button onClick={() => setModalDept(true)} className="px-3.5 py-2 bg-white text-[#1b4264] hover:bg-slate-50 font-bold text-[12px] rounded-lg shadow cursor-pointer border border-slate-300">
                      Add Department
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 bg-white">
                    <h4 className="font-bold text-[13px] text-[#1b4264] border-b border-slate-100 pb-2">Colleges</h4>
                    {colleges.map(c => (
                      <div key={c.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between items-center text-[12px]">
                        <span className="font-bold text-[#1b4264]">{c.name}</span>
                        <span className="font-mono text-[10px] bg-[#1b4264]/10 text-[#1b4264] px-1.5 py-0.5 rounded font-extrabold">{c.code}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 bg-white">
                    <h4 className="font-bold text-[13px] text-[#1b4264] border-b border-slate-100 pb-2">Departments</h4>
                    {departments.map(d => (
                      <div key={d.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between items-center text-[12px]">
                        <span className="font-bold text-slate-800">{d.name}</span>
                        <span className="text-[10px] text-slate-450 uppercase font-mono font-extrabold text-[#ffa400]">{d.code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
            logs: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">System Audit Logs</h3>
                <p className="text-[11px] text-slate-400 font-bold">Monitor server actions, configuration updates, and error alerts.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Database Integrity:</strong> Verified Healthy</div>
                  <div><strong>Total Requests Logged:</strong> 4,212 Actions</div>
                  <div className="h-px bg-slate-200 my-2" />
                  <div className="text-[11.5px] font-medium flex flex-col gap-2">
                    <div>1. INFO — Database Sync success at 2026-06-28 14:00:12</div>
                    <div>2. WARN — Session timeout threshold reached for admin user</div>
                    <div>3. ERROR — Failed login attempt from ip 192.168.1.1</div>
                  </div>
                </div>
              </div>
            ),
            backups: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Backup & Restore Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Initiate database snapshots or restore historical state records.</p>
                <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl text-center flex flex-col gap-4 shadow-sm">
                  <div className="w-16 h-16 bg-[#1b4264]/10 rounded-full flex items-center justify-center mx-auto text-[#1b4264]">
                    <i className="ti ti-download text-3xl" />
                  </div>
                  <div>
                    <span className="font-bold text-[#1b4264] text-[14px] block">Full Database Backup Ready</span>
                    <span className="text-[10.5px] text-slate-400">Last Snapshot: June 28, 2026 at 12:00 PM</span>
                  </div>
                  <button onClick={() => triggerToast("Initiated full PostgreSQL database backup download...")} className="px-4 py-2 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg shadow border border-[#ffa400] self-center cursor-pointer transition-colors">
                    Download Snapshot (SQL)
                  </button>
                </div>
              </div>
            ),
            roles: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Global Role Permission Matrix</h3>
                <p className="text-[11px] text-slate-400 font-bold">Configure active status, view permissions, and layout guidelines for student, faculty, and panelist profiles.</p>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[#1b4264] font-extrabold uppercase text-[10px]">
                        <th className="py-2">Role Profile</th>
                        <th className="py-2">Read Access</th>
                        <th className="py-2">Write Access</th>
                        <th className="py-2">Upload Files</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 font-bold">Student Portal</td>
                        <td className="py-2"><i className="ti ti-check text-green-500" /></td>
                        <td className="py-2"><i className="ti ti-check text-green-500" /></td>
                        <td className="py-2"><i className="ti ti-check text-green-500" /></td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 font-bold">Panelist Board</td>
                        <td className="py-2"><i className="ti ti-check text-green-500" /></td>
                        <td className="py-2"><i className="ti ti-check text-green-500" /></td>
                        <td className="py-2"><i className="ti ti-x text-red-500" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ),
            config: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">System Parameter Configuration</h3>
                <p className="text-[11px] text-slate-400 font-bold">Manage global database pool, caching configuration, and CORS parameters.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-[#1b4264] block">Maintenance Mode</span>
                      <span className="text-[10px] text-slate-400">Lock the platform database for scheduled upgrades.</span>
                    </div>
                    <input type="checkbox" checked={maintenanceMode} onChange={(e)=>setMaintenanceMode(e.target.checked)} className="accent-[#ffa400] w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-[#1b4264] block">DB Query Cache</span>
                      <span className="text-[10px] text-slate-400">Cache user role matrices to optimize performance.</span>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-[#ffa400] w-4 h-4 cursor-pointer" />
                  </div>
                </div>
              </div>
            ),
            settings: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Portal Settings</h3>
                <p className="text-[11px] text-slate-400 font-bold">Manage your notification channels, authentication credentials, and user preferences.</p>
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

      {/* MODALS */}
      {modalCol && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4 text-slate-800">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-building-plus text-[#ffa400] text-xl" />
              Onboard College Unit
            </h3>
            <form onSubmit={handleAddCollege} className="flex flex-col gap-3 text-[12px]">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-650">College Name</label>
                <input required type="text" value={colName} onChange={(e)=>setColName(e.target.value)} placeholder="e.g. College of Science" className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-650">College Code</label>
                <input required type="text" value={colCode} onChange={(e)=>setColCode(e.target.value)} placeholder="e.g. COS" className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]" />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button type="button" onClick={()=>setModalCol(false)} className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg font-bold text-slate-700 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg cursor-pointer">Onboard</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalDept && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4 text-slate-800">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-plus text-[#ffa400] text-xl" />
              Add Department
            </h3>
            <form onSubmit={handleAddDept} className="flex flex-col gap-3 text-[12px]">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-650">Affiliated College</label>
                <select required value={deptCollege} onChange={(e)=>setDeptCollege(e.target.value)} className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none">
                  <option value="">Select College</option>
                  {colleges.map(c=>(
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-650">Department Name</label>
                <input required type="text" value={deptName} onChange={(e)=>setDeptName(e.target.value)} placeholder="e.g. Physics Department" className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-650">Department Code</label>
                <input required type="text" value={deptCode} onChange={(e)=>setDeptCode(e.target.value)} placeholder="e.g. PHYS" className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button type="button" onClick={()=>setModalDept(false)} className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg font-bold text-slate-700 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg cursor-pointer">Add Dept</button>
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
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading System Admin Dashboard...</div>}>
      <SystemAdminDashboardContent />
    </Suspense>
  );
}
