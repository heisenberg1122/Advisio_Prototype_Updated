import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";

function PanelistDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();

  // Query assigned defense research projects
  const { data: researchData } = useQuery({
    queryKey: ["panelist-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  // Mock State Data with live fallbacks
  const [schedules, setSchedules] = useState([
    { id: "d1", title: "AI Crop Yield Prediction System Using ML", type: "Proposal Defense", date: "2026-07-10", time: "10:00 AM", venue: "CCS Seminar Hall" },
    { id: "d2", title: "Smart Traffic Management System", type: "Final Defense", date: "2026-07-12", time: "02:00 PM", venue: "CCS Webex B" },
  ]);

  const [documents, setDocuments] = useState([
    { id: "doc1", title: "AI Crop Yield Prediction Chapter 1-3 v2.1", group: "Group AI-CCS-01", status: "Ready for scoring" },
    { id: "doc2", title: "Smart Traffic Management Final Review v1", group: "Group IoT-IT-03", status: "Needs review" },
  ]);

  const [evaluations, setEvaluations] = useState([
    { id: "e1", title: "AI Crop Yield Prediction (Proposal)", status: "pending", score: 0, recommendations: "" },
    { id: "e2", title: "Smart Traffic Management (Final)", status: "pending", score: 0, recommendations: "" },
  ]);

  const [gradesSubmitted, setGradesSubmitted] = useState([
    { id: "g1", title: "Blockchain Credential Verification", score: 92, status: "submitted" },
  ]);

  const [notifications, setNotifications] = useState([
    { id: "n1", msg: "New defense panel assigned for Group IoT-IT-03 on July 12", date: "1 day ago" },
  ]);

  const [activeScore, setActiveScore] = useState<number>(85);
  const [activeRecs, setActiveRecs] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmitEvaluation = async (id: string, title: string) => {
    try {
      const templates = await apiClient.get<{ templates: any[] }>("/api/evaluation-templates").catch(() => ({ templates: [] }));
      const templateId = templates.templates?.[0]?.id;
      const researchList = await apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] }));
      const project = researchList.projects?.[0];

      if (templateId && project) {
        await apiClient.post("/api/evaluations", {
          templateId,
          researchId: project.id,
          totalScore: activeScore,
          recommendation: "APPROVE",
        });
      }
    } catch (e) {
      console.warn("Backend unavailable, using local persistence.");
    }

    setEvaluations(prev => prev.filter(e => e.id !== id));
    setGradesSubmitted(prev => [...prev, { id, title, score: activeScore, status: "submitted" }]);
    triggerToast(`Scoring and grades submitted for ${title}`);
    setActiveRecs("");
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
    router.push(`/panelist/dashboard?tab=${tab}`);
  };

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { id: "schedule", label: "Defense Schedules", icon: "ti-calendar-event", badge: schedules.length },
    { id: "documents", label: "Manuscript Reviews", icon: "ti-file-text", badge: documents.length },
    { id: "evaluations", label: "Evaluations & Scoring", icon: "ti-certificate", badge: evaluations.length },
    { id: "grades", label: "Grades & Recommendations", icon: "ti-clipboard-check", badge: gradesSubmitted.length },
    { id: "history", label: "Defense Archives", icon: "ti-history" },
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
            overview: "Panelist Dashboard",
            schedule: "Defense Schedule Management",
            documents: "Submitted Research Documents",
            evaluation: "Digital Evaluation & Scoring Sheets",
            grades: "Grades & Recommendations",
            history: "Historical Grading Records",
            settings: "Settings",
          };

          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <>
                {/* EXACT PANELIST CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Assigned Defense Schedules</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{schedules.length} Panels</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-file-text" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Submitted Research Docs</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{documents.length} Files</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-stars" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Pending Evaluation Sheets</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{evaluations.length} Pending</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-circle-check" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Grades Submitted</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{gradesSubmitted.length} Grades</span>
                    </div>
                  </div>
                </div>

                {/* Quick summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Assigned Defense Schedules</h3>
                    <div className="flex flex-col gap-2.5">
                      {schedules.map(s => (
                        <div key={s.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px] flex justify-between items-center shadow-sm">
                          <div>
                            <span className="font-bold text-[#1b4264] block">{s.title}</span>
                            <span className="text-[10px] text-slate-450">{s.date} · {s.time} ({s.venue})</span>
                          </div>
                          <Tag variant="warn">{s.type}</Tag>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Pending Digital Evaluations</h3>
                    <div className="flex flex-col gap-2.5">
                      {evaluations.map(e => (
                        <div key={e.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px] flex justify-between items-center shadow-sm">
                          <span>{e.title}</span>
                          <button onClick={()=>triggerToast("Opening evaluation rubric sheet.")} className="px-2.5 py-1 bg-[#ffa400] text-[#1b4264] font-extrabold text-[10px] rounded border border-[#ffa400] cursor-pointer">
                            Evaluate
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ),
            schedule: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Schedule Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review defense panel timings, assignees, and digital venues.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {schedules.map(s => (
                    <div key={s.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{s.title}</span>
                        <span className="text-[11px] text-slate-500">{s.date} at {s.time} · Venue: {s.venue}</span>
                      </div>
                      <Tag variant="warn">{s.type}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            documents: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Submitted Research Documents</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review draft submissions, download version histories, and checklist files.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {documents.map(d => (
                    <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{d.title}</span>
                        <span className="text-[11px] text-slate-500">{d.group}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#ffa400]">{d.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ),
            evaluation: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Digital Evaluation & Scoring Sheets</h3>
                <p className="text-[11px] text-slate-400 font-bold">Input institutional rubric scores, grade points, and panel recommendations.</p>
                {evaluations.map(e => (
                  <div key={e.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 text-[12.5px] shadow-sm">
                    <div className="font-bold text-[#1b4264] text-[13.5px] border-b border-slate-150 pb-2">{e.title}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-slate-600">Overall Grade / Score (1-100)</label>
                        <input 
                          type="number" 
                          value={activeScore}
                          onChange={(e)=>setActiveScore(Number(e.target.value))}
                          placeholder="e.g. 90" 
                          className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none" 
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-slate-600">Recommendations</label>
                        <input 
                          type="text" 
                          value={activeRecs}
                          onChange={(e)=>setActiveRecs(e.target.value)}
                          placeholder="e.g. Recommended for final clearance with revisions" 
                          className="bg-white border border-slate-350 rounded-lg p-2 focus:outline-none" 
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSubmitEvaluation(e.id, e.title)}
                      className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start mt-2"
                    >
                      Submit Scores & Grades
                    </button>
                  </div>
                ))}
                {evaluations.length === 0 && (
                  <div className="text-[12px] text-slate-400 font-medium text-center py-4">No pending evaluation sheets.</div>
                )}
              </div>
            ),
            grades: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Grades & Recommendations</h3>
                <p className="text-[11px] text-slate-400 font-bold">Monitor submitted grades, final marks, and panel consensus records.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {gradesSubmitted.map(g => (
                    <div key={g.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{g.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Score: {g.score}</span>
                      </div>
                      <Tag variant="success">{g.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            history: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Historical Grading Records</h3>
                <p className="text-[11px] text-slate-400 font-bold">Access historical transcripts, previous semester grading sheets, and archives.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Total Historical Panels:</strong> 12 Panels</div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="text-[11.5px] font-medium flex flex-col gap-2">
                    <div>1. SECURE DECENTRALIZED GRADING SYSTEM (A.Y. 2025 CS) — Passed (94)</div>
                    <div>2. IOT SMART HOME HUB SECURITY (A.Y. 2025 IT) — Passed (91)</div>
                  </div>
                </div>
              </div>
            ),
            settings: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Portal Settings</h3>
                <p className="text-[11px] text-slate-400 font-bold">Manage your notification channels, credentials, and theme settings.</p>
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

export default function PanelistDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading Panelist Dashboard...</div>}>
      <PanelistDashboardContent />
    </Suspense>
  );
}
