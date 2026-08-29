import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";

function ProfessorDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();

  // Query live workflows and research projects
  const { data: workflowData } = useQuery({
    queryKey: ["professor-workflows"],
    queryFn: () => apiClient.get<{ workflows: any[] }>("/api/workflows").catch(() => ({ workflows: [] })),
    staleTime: 60000,
  });

  const { data: researchData } = useQuery({
    queryKey: ["professor-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  // Mock State Data with live fallbacks
  const [studentsCount, setStudentsCount] = useState(48);
  const [projects, setProjects] = useState([
    { id: "p1", title: "AI-based Crop Yield Prediction System Using ML", group: "Group AI-CCS-01", progress: 65, status: "ongoing" },
    { id: "p2", title: "Smart Traffic Management System", group: "Group IoT-IT-03", progress: 85, status: "for defense" },
  ]);

  useEffect(() => {
    if (researchData?.projects && researchData.projects.length > 0) {
      setProjects(
        researchData.projects.map((p: any) => ({
          id: p.id,
          title: p.title,
          group: p.title?.substring(0, 16) || "Capstone Group",
          progress: 50,
          status: p.status?.toLowerCase() || "ongoing",
        }))
      );
      setStudentsCount(researchData.projects.length * 3);
    }
  }, [researchData]);

  const [topics, setTopics] = useState([
    { id: "top-1", name: "Capstone 1" },
    { id: "top-2", name: "Capstone 2" },
  ]);

  const [milestones, setMilestones] = useState([
    { id: "m1", topicId: "top-1", title: "Proposal Title Selection", scope: "Milestone", locked: false, prerequisiteTaskId: "" },
    { id: "m2", topicId: "top-1", title: "Chapter 1-3 Outline", scope: "Milestone", locked: false, prerequisiteTaskId: "m1" },
    { id: "m3", topicId: "top-1", title: "Ethics Certification Clear", scope: "Compliance", locked: true, prerequisiteTaskId: "m2" },
    { id: "m4", topicId: "top-2", title: "System Architecture Design", scope: "Milestone", locked: false, prerequisiteTaskId: "" },
    { id: "m5", topicId: "top-2", title: "Final Defense Presentation", scope: "Milestone", locked: true, prerequisiteTaskId: "m4" },
  ]);

  const [workflowStatus, setWorkflowStatus] = useState("Active Track");
  const [deadlineAlerts, setDeadlineAlerts] = useState(3);

  // Form input controllers
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneScope, setNewMilestoneScope] = useState("Milestone");
  const [newTopicName, setNewTopicName] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("top-1");
  const [prerequisiteTaskId, setPrerequisiteTaskId] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    const newT = {
      id: "top-" + Date.now(),
      name: newTopicName.trim(),
    };
    setTopics(prev => [...prev, newT]);
    setSelectedTopicId(newT.id);
    setNewTopicName("");
    triggerToast(`General topic "${newT.name}" successfully created.`);
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;
    const newM = {
      id: "m-" + Date.now(),
      topicId: selectedTopicId,
      title: newMilestoneTitle,
      scope: newMilestoneScope,
      locked: false,
      prerequisiteTaskId: prerequisiteTaskId || "",
    };
    setMilestones(prev => [...prev, newM]);
    setNewMilestoneTitle("");
    setPrerequisiteTaskId("");
    triggerToast(`Custom task "${newM.title}" successfully created.`);
  };

  const handleToggleTaskLock = (id: string, currentLock: boolean) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, locked: !currentLock } : m));
    triggerToast(!currentLock ? "Task access locked." : "Task access unlocked.");
  };

  const handleDeleteTask = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
    triggerToast("Task deleted successfully.");
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
    router.push(`/professor/dashboard?tab=${tab}`);
  };

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { id: "monitoring", label: "Cohort Monitoring", icon: "ti-users", badge: projects.length },
    { id: "builder", label: "Task & Stage Builder", icon: "ti-settings-automation" },
    { id: "locking", label: "Milestone Locking", icon: "ti-lock", badge: milestones.filter(m=>m.locked).length },
    { id: "deployment", label: "Workflow Deployment", icon: "ti-rocket" },
    { id: "tracking", label: "Progress Tracking", icon: "ti-chart-line" },
    { id: "completion", label: "Completion Status", icon: "ti-certificate" },
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

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

        {(() => {
          const tabTitles: Record<string, string> = {
            overview: "Professor Dashboard",
            monitoring: "Student & Project Monitoring",
            builder: "Blank-Canvas Task Builder",
            deployment: "Master Progression Deployment",
            locking: "Task-Locking",
            workflow: "Research Workflow Management",
            tracking: "Student Group Progress Tracking",
            completion: "Project Completion Monitoring",
            deadlines: "Deadline Enforcement & Monitoring",
            settings: "Settings",
          };

          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <>
                {/* EXACT PROFESSOR CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-users" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Students Monitored</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{studentsCount} Active</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-folders" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Active Projects</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{projects.length} Ongoing</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-plus" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Custom Milestones</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{milestones.length} Tasks</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-lock" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Locked Tasks</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{milestones.filter(m => m.locked).length} Locked</span>
                    </div>
                  </div>
                </div>

                {/* Quick summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Student Groups Progress Tracking</h3>
                    <div className="flex flex-col gap-3.5">
                      {projects.map(p => (
                        <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-[#1b4264]">{p.group}</span>
                            <span className="font-bold text-[#ffa400]">{p.progress}%</span>
                          </div>
                          <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Active Blank-Canvas Task Builder</h3>
                    <form onSubmit={handleCreateMilestone} className="flex flex-col gap-2.5 text-[12px]">
                      <input
                        type="text"
                        value={newMilestoneTitle}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        placeholder="E.g., Ethics Certification Clear..."
                        className="bg-white border border-slate-350 rounded-lg p-2.5 focus:outline-none"
                      />
                      <button type="submit" className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start cursor-pointer shadow-sm">
                        Deploy Task
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ),
            monitoring: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Student & Project Monitoring</h3>
                <p className="text-[11px] text-slate-400 font-bold">Monitor progression matrices, project status indices, and group rosters.</p>
                <div className="flex flex-col gap-3.5 mt-2">
                  {projects.map(p => (
                    <div key={p.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{p.group}</span>
                        <span className="text-[11px] text-slate-500">{p.title}</span>
                      </div>
                      <Tag variant="success">{p.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            builder: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5 text-slate-800">
                <div>
                  <h3 className="font-extrabold text-[#1b4264] text-[16px]">Blank-Canvas Task Builder</h3>
                  <p className="text-[11px] text-slate-400 font-bold">Build custom research milestones, define pre-requisite lock constraints, and set dynamic curriculum routes.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
                  
                  {/* Left Form Panel: 5 columns */}
                  <div className="lg:col-span-5 flex flex-col gap-5">
                    
                    {/* General Topic Creator */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
                      <h4 className="font-extrabold text-[#1b4264] text-[12.5px] flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <i className="ti ti-plus text-[#ffa400]" />
                        Create General Name / Topic
                      </h4>
                      <form onSubmit={handleCreateTopic} className="flex flex-col gap-2">
                        <input
                          required
                          type="text"
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          placeholder="e.g. Capstone 1, Capstone 2..."
                          className="bg-white border border-slate-350 rounded-lg p-2 text-[12px] focus:outline-none focus:border-[#ffa400]"
                        />
                        <button type="submit" className="w-full py-2 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg border border-[#ffa400] text-[11px] cursor-pointer transition shadow-sm">
                          Create Topic
                        </button>
                      </form>
                    </div>

                    {/* Task Deployer */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
                      <h4 className="font-extrabold text-[#1b4264] text-[12.5px] flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <i className="ti ti-target text-[#ffa400]" />
                        Deploy Custom Milestone / Task
                      </h4>
                      <form onSubmit={handleCreateMilestone} className="flex flex-col gap-3 text-[12px]">
                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-500 text-[10px] uppercase">Target Topic</label>
                          <select
                            value={selectedTopicId}
                            onChange={(e) => setSelectedTopicId(e.target.value)}
                            className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                          >
                            {topics.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-500 text-[10px] uppercase">Task Title</label>
                          <input
                            required
                            type="text"
                            value={newMilestoneTitle}
                            onChange={(e) => setNewMilestoneTitle(e.target.value)}
                            placeholder="e.g. Chapter 4 Outline draft v1"
                            className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-500 text-[10px] uppercase">Task Scope</label>
                          <select
                            value={newMilestoneScope}
                            onChange={(e) => setNewMilestoneScope(e.target.value)}
                            className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                          >
                            <option value="Milestone">Core Milestone</option>
                            <option value="Compliance">Compliance Form</option>
                            <option value="Pre-requisite">Pre-requisite Gate</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-500 text-[10px] uppercase">Pre-requisite Gate (Optional)</label>
                          <select
                            value={prerequisiteTaskId}
                            onChange={(e) => setPrerequisiteTaskId(e.target.value)}
                            className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none focus:border-[#ffa400]"
                          >
                            <option value="">-- No Pre-requisite --</option>
                            {milestones
                              .filter(m => m.topicId === selectedTopicId)
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                              ))}
                          </select>
                        </div>

                        <button type="submit" className="w-full py-2 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg border border-[#ffa400] text-[11px] cursor-pointer transition shadow-sm">
                          Deploy Task
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* Right View Panel: 7 columns */}
                  <div className="lg:col-span-7 flex flex-col gap-4">
                    <h4 className="font-extrabold text-[#1b4264] text-[13px] border-b border-slate-150 pb-2">
                      Topic & Progression Sequence Maps
                    </h4>
                    
                    <div className="flex flex-col gap-4 max-h-[460px] overflow-y-auto pr-1">
                      {topics.map(topic => {
                        const topicTasks = milestones.filter(m => m.topicId === topic.id);
                        return (
                          <div key={topic.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                              <span className="font-extrabold text-[#1b4264] text-[13px]">{topic.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 bg-slate-100 rounded-full">
                                {topicTasks.length} tasks
                              </span>
                            </div>

                            {topicTasks.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">No tasks created under this topic yet.</p>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {topicTasks.map(task => {
                                  const prereq = milestones.find(m => m.id === task.prerequisiteTaskId);
                                  return (
                                    <div key={task.id} className="p-3 bg-slate-50 border border-slate-150 rounded-lg flex flex-col gap-1.5 text-[11.5px]">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <span className="font-bold text-[#1b4264]">{task.title}</span>
                                          <div className="flex gap-2 items-center mt-1">
                                            <Tag variant={task.scope === "Milestone" ? "success" : task.scope === "Compliance" ? "info" : "warn"}>
                                              {task.scope}
                                            </Tag>
                                            {prereq && (
                                              <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                                <i className="ti ti-arrow-right text-[10px]" /> Prereq: {prereq.title}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <div className="flex gap-2 items-center">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTaskLock(task.id, task.locked)}
                                            className={`px-2 py-1 text-[9.5px] font-extrabold rounded border cursor-pointer transition ${
                                              task.locked
                                                ? "bg-[#ffa400] text-[#1b4264] border-[#ffa400]"
                                                : "bg-white border-slate-350 text-slate-600 hover:bg-slate-100"
                                            }`}
                                          >
                                            {task.locked ? "Unlock" : "Lock"}
                                          </button>
                                          
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                                            title="Delete Task"
                                          >
                                            <i className="ti ti-trash text-sm" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            ),
            deployment: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Master Progression Deployment</h3>
                <p className="text-[11px] text-slate-400 font-bold">Deploy research phases to specific program curricula and calendar schemas.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-600">
                  <div className="font-bold text-[#1b4264] text-[13.5px] mb-2">Curriculum: BS Computer Science</div>
                  <div>1. Proposal Defense Scope — deployed</div>
                  <div>2. Chapter 1-3 Submission — deployed</div>
                  <div>3. Oral Presentation Clearance — pending</div>
                </div>
              </div>
            ),
            locking: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Task-Locking & Milestone Constraints</h3>
                <p className="text-[11px] text-slate-400 font-bold">Enforce strict research sequence constraints by locking tasks until pre-requisite indicators are met.</p>
                <div className="flex flex-col gap-5 mt-2">
                  {topics.map(topic => {
                    const topicTasks = milestones.filter(m => m.topicId === topic.id);
                    return (
                      <div key={topic.id} className="flex flex-col gap-2.5">
                        <span className="font-extrabold text-[#1b4264] text-[12.5px] border-b border-slate-100 pb-1">{topic.name}</span>
                        {topicTasks.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic pl-1">No tasks configured under this topic.</div>
                        ) : (
                          topicTasks.map(m => (
                            <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[12.5px] shadow-sm">
                              <div>
                                <span className="font-bold text-[#1b4264] block">{m.title}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Scope: {m.scope} · Status: <strong>{m.locked ? "Locked" : "Unlocked"}</strong>
                                </span>
                              </div>
                              <button
                                onClick={() => handleToggleTaskLock(m.id, m.locked)}
                                className={`px-3 py-1 font-bold text-[11px] rounded border cursor-pointer transition ${
                                  m.locked
                                    ? "bg-[#ffa400] text-[#1b4264] border-[#ffa400]"
                                    : "bg-white border-slate-300 text-[#1b4264] hover:bg-slate-50"
                                }`}
                              >
                                {m.locked ? "Unlock Task" : "Lock Task"}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
            workflow: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Workflow Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review and update stages in the institutional capstone workflow pipeline.</p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Active Workflow Phase:</strong> {workflowStatus}</div>
                  <div><strong>Total Active Groups:</strong> {projects.length}</div>
                  <div className="h-px bg-slate-200 my-2" />
                  <button onClick={() => triggerToast("Optimized project pipeline stages.")} className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start cursor-pointer">
                    Optimize Pipeline
                  </button>
                </div>
              </div>
            ),
            tracking: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Student Group Progress Tracking</h3>
                <p className="text-[11px] text-slate-400 font-bold">Track overall progress rates, metrics overlays, and visual completion trackers.</p>
                <div className="flex flex-col gap-4 mt-2">
                  {projects.map(p => (
                    <div key={p.id} className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[12px] font-extrabold text-[#1b4264]">
                        <span>{p.group} — {p.title}</span>
                        <span className="font-mono text-[#ffa400]">{p.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-[#1b4264] h-full" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            completion: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Project Completion Monitoring</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review groups cleared for graduation and final document archive repository indices.</p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Completed Projects:</strong> 2 Research Papers</div>
                  <div><strong>Archival Status:</strong> Released to institutional libraries</div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="text-[11px] text-slate-500 font-medium">1. Virtual Class VR Lab — Alex Ramos (Released)</div>
                  <div className="text-[11px] text-slate-500 font-medium">2. Secure Decentralized Grading — Sarah Jenkins (Released)</div>
                </div>
              </div>
            ),
            deadlines: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Deadline Enforcement & Monitoring</h3>
                <p className="text-[11px] text-slate-400 font-bold">Set academic date thresholds, enforce compliance, and broadcast alerts.</p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Upcoming Submission Date:</strong> July 15, 2026</div>
                  <div><strong>Alerts State:</strong> {deadlineAlerts} Active Warnings</div>
                  <button onClick={() => triggerToast("Reminders broadcast to all groups.")} className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start mt-2">
                    Broadcast Reminders
                  </button>
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

    </div>
  );
}

export default function ProfessorDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading Professor Dashboard...</div>}>
      <ProfessorDashboardContent />
    </Suspense>
  );
}
