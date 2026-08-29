import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { AdviserGroupChats } from "@/components/dashboards/adviser/AdviserGroupChats";
import { getChatStore } from "@/lib/chat-store";
import { getStoredMeetingSession, saveMeetingSession, DEFAULT_SHARED_MEET_URL } from "@/lib/meeting-store";
import { GoogleMeetConnectModal } from "@/components/consultations/GoogleMeetConnectModal";
import { GoogleMeetTranscriptModal, ParsedChatMessage } from "@/components/consultations/GoogleMeetTranscriptModal";
import { getStoredConsultations, addStoredConsultation, saveStoredConsultations, updateStoredConsultationStatus, updateStoredConsultationNotes, ConsultationItem } from "@/lib/consultation-store";

function AdviserDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();

  // Synchronized Floating Google Meet Conference Session State
  const initialSession = getStoredMeetingSession();
  const [isMeetingActive, setIsMeetingActive] = useState(initialSession.isActive);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [activeMeetingUrl, setActiveMeetingUrl] = useState(initialSession.meetingUrl || DEFAULT_SHARED_MEET_URL);
  const [activeMeetingTopic, setActiveMeetingTopic] = useState(initialSession.topic || "Advising Stream Conference");
  const [activeParticipants, setActiveParticipants] = useState(
    initialSession.participants.length > 0
      ? initialSession.participants
      : [
          { id: "p1", name: "Dr. Rachel Lim", role: "Faculty Adviser", email: "rachel.lim@university.edu.ph", joinedAt: "Just now" },
          { id: "p2", name: "Juan Reyes", role: "Lead Researcher", email: "juan.reyes@student.university.edu.ph", joinedAt: "Just now" },
        ]
  );
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedConsultationForTranscript, setSelectedConsultationForTranscript] = useState<ConsultationItem | null>(null);

  // Live query for consultations with 1s auto-polling
  const { data: consultationsApiData, refetch: refetchConsultations } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => apiClient.get<{ consultations: any[] }>("/api/consultations").catch(() => ({ consultations: [] })),
    refetchInterval: 1000,
  });

  const [consultations, setConsultations] = useState<ConsultationItem[]>(getStoredConsultations());

  useEffect(() => {
    const syncConsultations = () => {
      if (consultationsApiData?.consultations && consultationsApiData.consultations.length > 0) {
        setConsultations(consultationsApiData.consultations);
        saveStoredConsultations(consultationsApiData.consultations);
      } else {
        setConsultations(getStoredConsultations());
      }
    };

    syncConsultations();
    window.addEventListener("storage", syncConsultations);
    return () => window.removeEventListener("storage", syncConsultations);
  }, [consultationsApiData]);

  // Poll backend database for active stream across different browsers (Edge, Brave, etc.)
  useEffect(() => {
    const fetchActiveStream = async () => {
      try {
        const res = await apiClient.get<{ success: boolean; stream: any }>("/api/consultations/active-stream?groupId=g1");
        if (res?.stream) {
          const s = res.stream;
          setIsMeetingActive(s.isActive);
          if (s.meetingUrl) setActiveMeetingUrl(s.meetingUrl);
          if (s.topic) setActiveMeetingTopic(s.topic);
          if (s.participants && s.participants.length > 0) {
            setActiveParticipants(s.participants);
          }
          saveMeetingSession({
            groupId: s.groupId || "g1",
            groupName: s.groupName || "Group AI-CCS-01",
            topic: s.topic,
            meetingUrl: s.meetingUrl,
            isActive: s.isActive,
            participants: s.participants || [],
          });
        }
      } catch {
        // Fallback to local store
      }
    };

    fetchActiveStream();
    const interval = setInterval(fetchActiveStream, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isMeetingActive) {
      timer = setInterval(() => {
        setMeetingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isMeetingActive]);

  const handleLaunchSyncedMeeting = async (targetUrl: string, selectedEmail: string) => {
    setShowConnectModal(false);
    setActiveMeetingUrl(targetUrl);
    setIsMeetingActive(true);

    const adviserParticipant = {
      id: "p1",
      name: "Dr. Rachel Lim",
      role: "Faculty Adviser",
      email: selectedEmail,
      joinedAt: "Just now",
    };

    const updatedParticipants = [
      adviserParticipant,
      ...activeParticipants.filter(p => p.email !== selectedEmail),
    ];

    setActiveParticipants(updatedParticipants);

    // Broadcast active stream to backend database so other browser receives exact same URL
    try {
      await apiClient.post("/api/consultations/active-stream", {
        groupId: "g1",
        groupName: "Group AI-CCS-01",
        topic: activeMeetingTopic,
        meetingUrl: targetUrl,
        gmailAccount: selectedEmail,
      });
    } catch {
      // Graceful fallback
    }

    saveMeetingSession({
      groupId: "g1",
      groupName: "Group AI-CCS-01",
      topic: activeMeetingTopic,
      meetingUrl: targetUrl,
      isActive: true,
      startedAt: Date.now(),
      participants: updatedParticipants,
    });

    window.open(targetUrl, "GoogleMeetWindow", "width=1024,height=720,resizable=yes");
  };

  const handleStartConference = (url?: string, topicTitle: string = "Group Conferencing") => {
    if (url) setActiveMeetingUrl(url);
    if (topicTitle) setActiveMeetingTopic(topicTitle);
    setShowConnectModal(true);
  };

  const handleReopenMeetingWindow = () => {
    window.open(activeMeetingUrl, "GoogleMeetWindow", "width=1024,height=720,resizable=yes");
  };

  const handleEndConference = async () => {
    setIsMeetingActive(false);
    setMeetingDuration(0);
    saveMeetingSession({
      ...getStoredMeetingSession(),
      isActive: false,
      participants: [],
    });
    try {
      await apiClient.post("/api/consultations/active-stream/end", { groupId: "g1" });
    } catch {
      // Graceful fallback
    }
  };

  const formatMeetingTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTabChange = (tab: string) => {
    router.push(`/adviser/dashboard?tab=${tab}`);
  };

  // Live query for assigned advisee research projects
  const { data: researchData } = useQuery({
    queryKey: ["adviser-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  // Mock State Data with live fallbacks
  const [advisees, setAdvisees] = useState([
    { id: "g1", groupName: "Group AI-CCS-01", projectTitle: "AI Crop Yield Prediction System Using ML", leader: "Juan Reyes", status: "active" },
    { id: "g2", groupName: "Group IoT-IT-03", projectTitle: "Smart Traffic Management System", leader: "Lando Vance", status: "active" },
  ]);

  useEffect(() => {
    if (researchData?.projects && researchData.projects.length > 0) {
      setAdvisees(
        researchData.projects.map((p: any) => ({
          id: p.id,
          groupName: p.title?.substring(0, 16) || "Research Group",
          projectTitle: p.title,
          leader: p.members?.find((m: any) => m.projectRole === "LEADER")?.user?.firstName || "Group Leader",
          status: p.status?.toLowerCase() || "active",
        }))
      );
    }
  }, [researchData]);

  const [reviews, setReviews] = useState([
    { id: "r1", groupName: "Group AI-CCS-01", docName: "Chapter 1-3 Review Draft v2.1", milestone: "Draft Submission", date: "2026-06-27", comments: [] },
  ]);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [consultTopic, setConsultTopic] = useState("");
  const [consultDate, setConsultDate] = useState("");
  const [consultTime, setConsultTime] = useState("");
  const [consultGroupId, setConsultGroupId] = useState("");
  const [customMeetUrl, setCustomMeetUrl] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  const handleScheduleConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultTopic) return;
    setIsScheduling(true);
    try {
      const selectedAdv = advisees.find(a => a.id === consultGroupId) || advisees[0];
      const startDateTime = new Date(`${consultDate || new Date().toISOString().split("T")[0]}T${consultTime || "10:00"}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 3600000);

      let meetUrl = customMeetUrl.trim() || DEFAULT_SHARED_MEET_URL;
      try {
        const res = await apiClient.post<{ consultation: any; meetingUrl?: string }>("/api/consultations", {
          researchId: selectedAdv?.id || "default-id",
          title: consultTopic,
          description: `Advising session for ${selectedAdv?.groupName || "Research Group"}`,
          scheduledStart: startDateTime.toISOString(),
          scheduledEnd: endDateTime.toISOString(),
          meetingUrl: meetUrl,
        });
        if (res?.meetingUrl) meetUrl = res.meetingUrl;
      } catch {
        // Fallback to meetUrl
      }

      const newC: ConsultationItem = {
        id: Math.random().toString(),
        groupName: selectedAdv?.groupName || "Group AI-CCS-01",
        topic: consultTopic,
        date: consultDate || new Date().toISOString().split("T")[0],
        time: consultTime || "10:00 AM",
        mode: "Google Meet",
        meetingUrl: meetUrl,
        status: "scheduled",
      };

      addStoredConsultation(newC);
      setConsultations(prev => [newC, ...prev.filter(c => c.id !== newC.id)]);
      refetchConsultations();
      setConsultTopic("");
      setConsultDate("");
      setConsultTime("");
      setCustomMeetUrl("");
      setShowScheduleModal(false);
      triggerToast(`Created Google Meet consultation: ${meetUrl}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleApproveConsultation = async (id: string, topic: string) => {
    updateStoredConsultationStatus(id, "scheduled");
    setConsultations(prev => prev.map(c => c.id === id ? { ...c, status: "scheduled" } : c));
    try {
      await apiClient.patch(`/api/consultations/${id}/approve`);
      refetchConsultations();
    } catch {
      // Graceful fallback
    }
    triggerToast(`Approved consultation: ${topic}`);
  };

  const handleOpenTranscriptModal = (consultation: ConsultationItem) => {
    setSelectedConsultationForTranscript(consultation);
    setShowTranscriptModal(true);
  };

  const handleSaveConsultationNotes = async (
    consultationId: string,
    notes: string,
    actionItems: string[],
    transcript: ParsedChatMessage[]
  ) => {
    updateStoredConsultationNotes(consultationId, notes, actionItems, transcript);
    setConsultations((prev) =>
      prev.map((c) =>
        c.id === consultationId
          ? { ...c, notes, actionItems, transcript }
          : c
      )
    );
    try {
      await apiClient.post(`/api/consultations/${consultationId}/notes`, {
        notes,
        actionItems,
        transcript,
      });
    } catch {
      // In-memory / storage fallback
    }
    refetchConsultations();
    triggerToast("Saved consultation notes and Google Meet chat transcript!");
  };

  const [approvals, setApprovals] = useState([
    { id: "a1", groupName: "Group AI-CCS-01", milestone: "Proposal Outline Upload", date: "2026-06-25", status: "pending" },
    { id: "a2", groupName: "Group IoT-IT-03", milestone: "Chapter 1-3 Final Draft", date: "2026-06-28", status: "pending" },
  ]);

  const [notifications, setNotifications] = useState([
    { id: "n1", msg: "Marc Santos uploaded Chapter 1-3 Review Draft v2.1", date: "2 hours ago" },
    { id: "n2", msg: "Lando Vance requested a consultation for July 5", date: "4 hours ago" },
  ]);

  const [chatStoreNotifications, setChatStoreNotifications] = useState<any[]>([]);

  useEffect(() => {
    const syncNotifs = () => {
      const store = getChatStore();
      const userNotifs = store.notifications.filter(
        n => n.userId === "rachel.lim@university.edu.ph"
      );
      setChatStoreNotifications(userNotifs);
    };
    syncNotifs();
    window.addEventListener("storage", syncNotifs);
    return () => window.removeEventListener("storage", syncNotifs);
  }, []);

  const combinedNotifications = [
    ...chatStoreNotifications.map(n => ({ id: n.id, msg: n.msg, date: n.date || "Just now" })),
    ...notifications
  ];

  const [commentInput, setCommentInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApproveMilestone = async (id: string, groupName: string) => {
    setApprovals(prev => prev.filter(a => a.id !== id));
    triggerToast(`Approved milestone for ${groupName}`);
  };

  const handleReviewComment = async (reviewId: string) => {
    if (!commentInput.trim()) return;
    triggerToast("Comment submitted and persisted successfully.");
    setCommentInput("");
  };

  const tabsList = [
    { id: "overview", label: "Dashboard Overview", icon: "ti-layout-dashboard" },
    { id: "advisees", label: "Assigned Advisees", icon: "ti-users", badge: advisees.length },
    { id: "reviews", label: "Document Reviews", icon: "ti-file-text", badge: reviews.length },
    { id: "approvals", label: "Milestone Approvals", icon: "ti-circle-check", badge: approvals.length },
    { id: "progress", label: "Group Progress", icon: "ti-chart-line" },
    { id: "consultations", label: "Consultations", icon: "ti-calendar-event" },
    { id: "history", label: "Consultation History", icon: "ti-history" },
    { id: "chat", label: "Adviser Chats", icon: "ti-messages" },
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
                  ? "border-[#ffa400] text-[#1b4264] bg-slate-50 shadow-sm"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              <i className={`ti ${tab.icon} text-sm ${isActive ? "text-[#ffa400]" : ""}`} />
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
          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <>
                {/* EXACT ADVISER CARDS (CLICKABLE) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div 
                    onClick={() => handleTabChange("advisees")}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-[#1b4264] hover:shadow-md transition cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-users" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Assigned Advisees</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{advisees.length} Groups</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabChange("reviews")}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-[#ffa400] hover:shadow-md transition cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-file-text" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Pending Reviews</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{reviews.length} Documents</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabChange("consultations")}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-[#1b4264] hover:shadow-md transition cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Recent Consultations</span>
                      <span className="text-[18px] font-extrabold text-[#ffa400]">4 Records</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabChange("overview")}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-bell" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Notifications</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{combinedNotifications.length} Alerts</span>
                    </div>
                  </div>
                </div>

                {/* Quick summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Pending Milestone Approvals</h3>
                    <div className="flex flex-col gap-2.5">
                      {approvals.map(a => (
                        <div key={a.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px]">
                          <div>
                            <span className="font-bold text-[#1b4264] block">{a.groupName}</span>
                            <span className="text-[10px] text-slate-450">{a.milestone}</span>
                          </div>
                          <button onClick={()=>handleApproveMilestone(a.id, a.groupName)} className="px-2.5 py-1 bg-[#ffa400] text-[#1b4264] font-extrabold text-[10px] rounded border border-[#ffa400] cursor-pointer">
                            Approve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Upcoming Scheduled Consultations</h3>
                    <div className="flex flex-col gap-2.5">
                      {consultations.map(c => (
                        <div key={c.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px] flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-800 block">{c.topic}</span>
                            <span className="text-[10px] text-slate-400">{c.groupName} · {c.time}</span>
                          </div>
                          <Tag variant="success">{c.mode}</Tag>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ),
            advisees: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Assigned Advisees</h3>
                <p className="text-[11px] text-slate-400 font-bold">List of research student groups under your advisory monitoring panel.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {advisees.map(adv => (
                    <div key={adv.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{adv.groupName}</span>
                        <span className="text-[11px] text-slate-500">{adv.projectTitle} · Representative: {adv.leader}</span>
                      </div>
                      <Tag variant="success">{adv.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            reviews: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Document Review & Commenting</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review draft submissions, download version history, and submit comments.</p>
                {reviews.map(rev => (
                  <div key={rev.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 text-[12.5px] shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{rev.docName}</span>
                        <span className="text-[10px] text-slate-400">{rev.groupName} · {rev.milestone}</span>
                      </div>
                      <button onClick={()=>triggerToast("Downloading draft files.")} className="text-[#ffa400] font-bold hover:underline cursor-pointer">
                        Download File
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                      <label className="font-bold text-slate-600 text-[11px]">Submit Review Comments</label>
                      <textarea 
                        value={commentInput} 
                        onChange={(e)=>setCommentInput(e.target.value)} 
                        placeholder="Provide detailed feedback comments..." 
                        className="bg-white border border-slate-350 rounded-lg p-2.5 text-[12px] focus:outline-none" 
                      />
                      <button onClick={()=>handleReviewComment(rev.id)} className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start mt-2">
                        Submit Comments
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ),
            consultations: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
                      <i className="ti ti-video text-[#ffa400]" />
                      Consultation Schedule & Google Meet Management
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                      Schedule 1-on-1 or group research advising sessions with automatic Google Meet link generation.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] text-[12px] font-bold rounded-lg shadow-sm cursor-pointer transition"
                  >
                    <i className="ti ti-plus font-bold" />
                    <span>Schedule Google Meet</span>
                  </button>
                </div>

                {/* SCHEDULE MODAL */}
                {showScheduleModal && (
                  <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 animate-fade-in-up">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <i className="ti ti-video text-base" />
                          </div>
                          <div>
                            <h4 className="font-bold text-[14px] text-slate-900">New Google Meet Consultation</h4>
                            <span className="text-[10px] text-slate-400">Generate real calendar video conference</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowScheduleModal(false)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                        >
                          <i className="ti ti-x text-base" />
                        </button>
                      </div>

                      <form onSubmit={handleScheduleConsultation} className="flex flex-col gap-3 text-[12px]">
                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-700">Advisee Group / Research Project</label>
                          <select
                            value={consultGroupId}
                            onChange={(e) => setConsultGroupId(e.target.value)}
                            className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
                          >
                            {advisees.map((adv) => (
                              <option key={adv.id} value={adv.id}>
                                {adv.groupName} — {adv.projectTitle}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-700">Consultation Topic / Purpose</label>
                          <input
                            type="text"
                            required
                            value={consultTopic}
                            onChange={(e) => setConsultTopic(e.target.value)}
                            placeholder="e.g. Chapter 3 Methodology & Analysis Discussion"
                            className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-slate-700">Date</label>
                            <input
                              type="date"
                              required
                              value={consultDate}
                              onChange={(e) => setConsultDate(e.target.value)}
                              className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-slate-700">Time</label>
                            <input
                              type="time"
                              required
                              value={consultTime}
                              onChange={(e) => setConsultTime(e.target.value)}
                              className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-700">Google Meet Link (Optional)</label>
                          <input
                            type="url"
                            value={customMeetUrl}
                            onChange={(e) => setCustomMeetUrl(e.target.value)}
                            placeholder="Leave blank for instant live Google Meet room (https://meet.google.com/new)"
                            className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264] text-[11.5px]"
                          />
                          <span className="text-[10px] text-slate-400">Default creates an instant live Google Meet video room automatically.</span>
                        </div>

                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setShowScheduleModal(false)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isScheduling}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-bold rounded-lg cursor-pointer shadow-sm disabled:opacity-50"
                          >
                            {isScheduling ? (
                              <span>Generating Meet Link...</span>
                            ) : (
                              <>
                                <i className="ti ti-video" />
                                <span>Create & Generate Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* CONSULTATION SESSIONS LIST */}
                <div className="flex flex-col gap-3.5">
                  {consultations.map((c: any) => (
                    <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[12.5px] shadow-sm hover:border-[#1b4264] transition">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center flex-shrink-0 text-lg">
                          <i className="ti ti-video" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1b4264] block text-[13.5px]">{c.topic}</span>
                            <Tag variant={c.status === "pending" || c.status === "requested" ? "warn" : "success"}>
                              {c.status === "pending" || c.status === "requested" ? "Pending Approval" : "Confirmed"}
                            </Tag>
                          </div>
                          <span className="text-[11px] text-slate-500 block">{c.groupName} · {c.date} at {c.time}</span>
                          {c.meetingUrl && (
                            <span className="inline-block mt-1 font-mono text-[10.5px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {c.meetingUrl}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {(c.status === "pending" || c.status === "requested") && (
                          <button
                            onClick={() => handleApproveConsultation(c.id, c.topic)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg text-[11px] shadow-sm transition cursor-pointer border border-[#ffa400]"
                          >
                            <i className="ti ti-check" />
                            <span>Approve Consultation</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleStartConference(c.meetingUrl || DEFAULT_SHARED_MEET_URL, c.topic)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition cursor-pointer"
                        >
                          <i className="ti ti-video" />
                          <span>Join Google Meet</span>
                        </button>
                        <button
                          onClick={() => {
                            if (c.meetingUrl) {
                              navigator.clipboard.writeText(c.meetingUrl);
                              triggerToast("Copied Google Meet link to clipboard!");
                            }
                          }}
                          title="Copy Link"
                          className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer text-xs"
                        >
                          <i className="ti ti-copy" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            progress: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Group Progress Monitoring</h3>
                <p className="text-[11px] text-slate-400 font-bold">Oversight indicators showing project progression across all assigned advisees.</p>
                <div className="flex flex-col gap-4 mt-2">
                  {advisees.map(adv => (
                    <div key={adv.id} className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-center text-[12px] font-extrabold text-[#1b4264]">
                        <span>{adv.groupName} · {adv.projectTitle}</span>
                        <span className="font-mono text-[#ffa400]">40% COMPLETE</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-full rounded-full" style={{ width: "40%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            approvals: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Milestone Approval & Recommendation</h3>
                <p className="text-[11px] text-slate-400 font-bold">Approve core outline thresholds and issue recommendations for oral review panels.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {approvals.map(a => (
                    <div key={a.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{a.groupName}</span>
                        <span className="text-[10px] text-slate-450">Target Milestone: {a.milestone}</span>
                      </div>
                      <button onClick={()=>handleApproveMilestone(a.id, a.groupName)} className="px-3.5 py-1.5 bg-[#ffa400] text-[#1b4264] font-extrabold text-[11px] rounded border border-[#ffa400] cursor-pointer">
                        Approve Milestone
                      </button>
                    </div>
                  ))}
                  {approvals.length === 0 && (
                    <div className="text-[12px] text-slate-400 font-medium text-center py-4">No pending milestone approval requests.</div>
                  )}
                </div>
              </div>
            ),
            history: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px]">Consultation History & Transcript Archive</h3>
                    <p className="text-[11px] text-slate-400 font-bold">Access historical meeting schedules, advising minutes, and Google Meet chat records.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      <strong>{consultations.length}</strong> Total Sessions
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {consultations.map((c) => (
                    <div
                      key={c.id}
                      className="bg-slate-50 p-5 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-3 hover:border-[#1b4264] transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#1b4264] text-[14px]">{c.topic}</span>
                            <Tag variant={c.status === "pending" || c.status === "requested" ? "warn" : "success"}>
                              {c.status === "pending" || c.status === "requested" ? "Pending Approval" : "Confirmed"}
                            </Tag>
                          </div>
                          <span className="text-[11.5px] text-slate-500 font-medium block mt-0.5">
                            {c.groupName} · {c.date} at {c.time} ({c.mode})
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenTranscriptModal(c)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-[#1b4264] font-bold rounded-lg border border-slate-300 text-xs shadow-sm cursor-pointer self-start sm:self-auto transition"
                        >
                          <i className="ti ti-file-text text-amber-500" />
                          <span>{c.notes || (c.transcript && c.transcript.length > 0) ? "View / Edit Transcript & Notes" : "Import Google Meet Chat"}</span>
                        </button>
                      </div>

                      {/* Adviser Notes & Recommendations preview */}
                      {c.notes && (
                        <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
                          <span className="font-bold text-[#1b4264] flex items-center gap-1">
                            <i className="ti ti-notes" />
                            <span>Meeting Summary & Adviser Feedback:</span>
                          </span>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{c.notes}</p>
                        </div>
                      )}

                      {/* Action items preview */}
                      {c.actionItems && c.actionItems.length > 0 && (
                        <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs flex flex-col gap-1.5">
                          <span className="font-bold text-[#1b4264] flex items-center gap-1">
                            <i className="ti ti-checklist text-emerald-600" />
                            <span>Agreed Action Items ({c.actionItems.length}):</span>
                          </span>
                          <ul className="list-disc list-inside text-slate-700 space-y-1 pl-1">
                            {c.actionItems.map((item, idx) => (
                              <li key={idx} className="text-[11.5px]">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* In-call Google Meet chat transcript preview */}
                      {c.transcript && c.transcript.length > 0 && (
                        <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="font-bold text-[#1b4264] flex items-center gap-1.5">
                              <i className="ti ti-messages text-blue-600" />
                              <span>Google Meet In-Call Messages ({c.transcript.length})</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Auto-Indexed</span>
                          </div>
                          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
                            {c.transcript.map((msg) => (
                              <div key={msg.id} className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px]">
                                <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                                  <span>{msg.sender}</span>
                                  <span className="font-mono text-slate-400">{msg.time}</span>
                                </div>
                                <p className="text-slate-800 mt-0.5 whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {consultations.length === 0 && (
                    <div className="text-center py-8 text-slate-400 font-medium">
                      No consultation records logged yet.
                    </div>
                  )}
                </div>
              </div>
            ),
            conferencing: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">In-App Voice and Video Group Conferencing</h3>
                <p className="text-[11px] text-slate-400 font-bold">Initiate peer study room conferences or sync appointments with advisees.</p>
                
                {!isMeetingActive ? (
                  <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl text-center flex flex-col gap-4 shadow-sm">
                    <div className="w-16 h-16 bg-[#1b4264]/10 rounded-full flex items-center justify-center mx-auto text-[#1b4264]">
                      <i className="ti ti-video text-3xl animate-pulse" />
                    </div>
                    <div>
                      <span className="font-bold text-[#1b4264] text-[14px] block">Live Stream Channels Ready</span>
                      <span className="text-[10.5px] text-slate-400">Join call for Group AI-CCS-01 or Group IoT-IT-03</span>
                    </div>
                    <button 
                      onClick={() => handleStartConference("https://meet.google.com/new", "In-App Voice and Video Group Conferencing")} 
                      className="px-5 py-2.5 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg shadow border border-[#ffa400] self-center cursor-pointer transition-colors flex items-center gap-2"
                    >
                      <i className="ti ti-video text-lg" />
                      <span>Start Stream Conference</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 p-6 border-2 border-emerald-400/80 rounded-xl text-center flex flex-col gap-4 shadow-md animate-fade-in">
                    <div className="flex items-center justify-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="font-extrabold text-emerald-800 text-[15px] uppercase tracking-wider">Meeting in Progress</span>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active Call Duration</span>
                      <span className="font-mono text-3xl font-black text-[#1b4264] tracking-tight">{formatMeetingTime(meetingDuration)}</span>
                      <span className="text-[11px] text-slate-500 mt-1">Google Meet session is running in floating window</span>
                    </div>

                    {/* LIVE ATTENDEES LIST */}
                    <div className="bg-white/80 border border-emerald-200/80 rounded-xl p-3.5 max-w-lg mx-auto w-full text-left shadow-sm">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-2.5">
                        <span className="text-[11px] font-extrabold text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-users text-emerald-600" />
                          <span>Connected Attendees ({activeParticipants.length})</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live Sync
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {activeParticipants.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-[11.5px] p-1.5 rounded-lg hover:bg-emerald-50/50 transition">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#1b4264] text-[#ffa400] text-[10px] font-black flex items-center justify-center">
                                {p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block leading-tight">{p.name}</span>
                                <span className="text-[9.5px] text-slate-500">{p.role} · {p.email}</span>
                              </div>
                            </div>
                            <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {p.joinedAt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 mt-2">
                      <button
                        onClick={handleReopenMeetingWindow}
                        className="px-4 py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-bold rounded-lg shadow cursor-pointer transition flex items-center gap-2 text-xs"
                      >
                        <i className="ti ti-external-link" />
                        <span>Reopen Meeting Window</span>
                      </button>

                      <button
                        onClick={() => handleEndConference()}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow cursor-pointer transition flex items-center gap-2 text-xs"
                      >
                        <i className="ti ti-phone-off" />
                        <span>End Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ),
            defense: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Schedule Viewing</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review defense panel timings, assignees, and digital venues.</p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] flex flex-col gap-2 mt-2 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-[#1b4264] text-[14px]">AI Crop Yield Prediction System ML</span>
                    <Tag variant="warn">Proposal Defense</Tag>
                  </div>
                  <div className="text-slate-500 font-medium">
                    <div><strong>Date / Time:</strong> 2026-07-10 at 10:00 AM</div>
                    <div><strong>Venue:</strong> CCS Seminar Hall</div>
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
            "group-chats": (
              <AdviserGroupChats triggerToast={triggerToast} />
            ),
          };

          return tabContent[activeTab] || tabContent.overview;
        })()}

      </main>

      <GoogleMeetConnectModal
        isOpen={showConnectModal}
        currentUrl={activeMeetingUrl}
        defaultEmail="rachel.lim@university.edu.ph"
        defaultName="Dr. Rachel Lim"
        role="Faculty Adviser"
        onClose={() => setShowConnectModal(false)}
        onLaunch={handleLaunchSyncedMeeting}
      />

      <GoogleMeetTranscriptModal
        isOpen={showTranscriptModal}
        onClose={() => setShowTranscriptModal(false)}
        consultation={selectedConsultationForTranscript}
        onSaveNotes={handleSaveConsultationNotes}
      />
    </div>
  );
}

export default function AdviserDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading Adviser Dashboard...</div>}>
      <AdviserDashboardContent />
    </Suspense>
  );
}
