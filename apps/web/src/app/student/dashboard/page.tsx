import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { StudentGroupChats } from "@/components/dashboards/student/StudentGroupChats";
import { StudentWorkspace } from "@/components/dashboards/student/StudentWorkspace";
import { getChatStore } from "@/lib/chat-store";
import { getStoredMeetingSession, saveMeetingSession, DEFAULT_SHARED_MEET_URL } from "@/lib/meeting-store";
import { GoogleMeetConnectModal } from "@/components/consultations/GoogleMeetConnectModal";
import { GoogleMeetTranscriptModal, ParsedChatMessage } from "@/components/consultations/GoogleMeetTranscriptModal";
import { getStoredConsultations, addStoredConsultation, saveStoredConsultations, updateStoredConsultationNotes, ConsultationItem } from "@/lib/consultation-store";
import { ProductTour, TourStep } from "@/components/shared/ProductTour";

const STUDENT_TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Advisio Research Portal",
    content: "This is your comprehensive workspace for capstone and thesis research. Let's take a quick tour of your essential tools.",
  },
  {
    selector: '[data-tour="tab-overview"]',
    title: "Project Overview",
    content: "Monitor your active research topic, assigned group members, and overall milestone progress at a glance.",
  },
  {
    selector: '[data-tour="tab-workspace"]',
    title: "Document Workspace",
    content: "Draft chapters, annotate PDF manuscripts, collaborate with teammates, and review inline faculty comments.",
  },
  {
    selector: '[data-tour="tab-submissions"]',
    title: "Formal Submissions",
    content: "Submit versioned manuscript drafts for adviser endorsement, ethics review, and defense panel evaluations.",
  },
  {
    selector: '[data-tour="tab-consultations"]',
    title: "Adviser Consultations & Meet",
    content: "Book consultation slots with your faculty adviser, launch synchronized Google Meet rooms, and review AI transcripts.",
  },
  {
    selector: '[data-tour="tab-milestones"]',
    title: "Institutional Milestones",
    content: "Keep track of institutional deadlines, defense schedules, and college research workflow stages.",
  },
  {
    selector: '[data-tour="tab-chat"]',
    title: "Real-Time Group Chat",
    content: "Direct, instant group chat with your research partners and faculty adviser powered by real-time event streaming.",
  },
];

function StudentDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Project Registration State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createAbstract, setCreateAbstract] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Synchronized Floating Google Meet Conference Session State
  const initialSession = getStoredMeetingSession();
  const [isMeetingActive, setIsMeetingActive] = useState(initialSession.isActive);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [activeMeetingUrl, setActiveMeetingUrl] = useState(initialSession.meetingUrl || DEFAULT_SHARED_MEET_URL);
  const [activeMeetingTopic, setActiveMeetingTopic] = useState(initialSession.topic || "Student Group Conferencing");
  const [activeParticipants, setActiveParticipants] = useState(
    initialSession.participants.length > 0 ? initialSession.participants : []
  );
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedConsultationForTranscript, setSelectedConsultationForTranscript] = useState<ConsultationItem | null>(null);

  // Live query for consultations with background refresh
  const { data: consultationsApiData, refetch: refetchConsultations } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => apiClient.get<{ consultations: any[] }>("/api/consultations").catch(() => ({ consultations: [] })),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
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
            groupId: s.groupId || "default",
            groupName: s.groupName || "Research Group",
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

    const studentParticipant = {
      id: "p2",
      name: `${user?.firstName || "Student"} ${user?.lastName || "Researcher"}`.trim(),
      role: "Lead Researcher",
      email: selectedEmail,
      joinedAt: "Just now",
    };

    const updatedParticipants = [
      ...activeParticipants.filter(p => p.email !== selectedEmail),
      studentParticipant,
    ];

    setActiveParticipants(updatedParticipants);

    // Broadcast active stream to backend database so other browser receives exact same URL
    try {
      await apiClient.post("/api/consultations/active-stream", {
        groupId: activeProject?.id || "default",
        groupName: group?.name || activeProject?.title || "Research Group",
        topic: activeMeetingTopic,
        meetingUrl: targetUrl,
        gmailAccount: selectedEmail,
      });
    } catch {
      // Graceful fallback
    }

    saveMeetingSession({
      groupId: activeProject?.id || "default",
      groupName: group?.name || activeProject?.title || "Research Group",
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

  // Query live projects from API
  const { data: researchData } = useQuery({
    queryKey: ["student-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  const activeProject = researchData?.projects?.[0];

  // State Data strictly from live API
  const [group, setGroup] = useState<any>(null);

  useEffect(() => {
    if (activeProject) {
      setGroup({
        id: activeProject.id,
        name: activeProject.title?.length > 25 ? activeProject.title.substring(0, 25) + "..." : activeProject.title,
        projectTitle: activeProject.title || "Untitled Research",
        members: activeProject.members?.map((m: any) => `${m.user.firstName} ${m.user.lastName}`) || [],
        status: activeProject.status?.toLowerCase() || "draft",
      });
      if (activeProject.workflowInstance?.currentStage) {
        setMilestones([
          {
            id: activeProject.workflowInstance.currentStage.id,
            title: activeProject.workflowInstance.currentStage.name,
            status: "in-progress",
            date: new Date().toISOString().split("T")[0],
          },
        ]);
      }
    } else {
      setGroup(null);
      setMilestones([]);
    }
  }, [activeProject]);

  const [aiMatches, setAiMatches] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [workspaceSubmissions, setWorkspaceSubmissions] = useState<any[]>([]);

  useEffect(() => {
    const syncSubmissions = () => {
      const stored = localStorage.getItem("advisio_student_submissions");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const filtered = Array.isArray(parsed)
            ? parsed.filter((s: any) => !s.docName?.includes("Chapter 3 Methodology Draft"))
            : [];
          setWorkspaceSubmissions(filtered);
        } catch (e) {}
      }
    };
    syncSubmissions();
    window.addEventListener("storage", syncSubmissions);
    return () => window.removeEventListener("storage", syncSubmissions);
  }, []);

  const combinedSubmissions = [...workspaceSubmissions, ...submissions];

  const [milestones, setMilestones] = useState<any[]>([]);
  const [defenses, setDefenses] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [chatStoreNotifications, setChatStoreNotifications] = useState<any[]>([]);

  useEffect(() => {
    const syncNotifs = () => {
      const store = getChatStore();
      const userNotifs = store.notifications.filter(
        n => n.userId === user?.email
      );
      setChatStoreNotifications(userNotifs);
    };
    syncNotifs();
    window.addEventListener("storage", syncNotifs);
    return () => window.removeEventListener("storage", syncNotifs);
  }, [user]);

  const combinedNotifications = [
    ...chatStoreNotifications.map(n => ({ id: n.id, msg: n.msg, date: n.date || "Just now", type: "system" })),
    ...notifications
  ];

  // Form input controllers
  const [topicInput, setTopicInput] = useState("");
  const [uploadMilestone, setUploadMilestone] = useState("Draft Submission");
  const [uploadFileName, setUploadFileName] = useState("");
  const [consultTopic, setConsultTopic] = useState("");
  const [consultDate, setConsultDate] = useState("");
  const [consultTime, setConsultTime] = useState("");
  const [consultMode, setConsultMode] = useState("Video Call");

  // Modals state
  const [modalCert, setModalCert] = useState(false);
  const [modalJoinConferencing, setModalJoinConferencing] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName) return;
    const newDoc = {
      id: Math.random().toString(),
      docName: uploadFileName,
      milestone: uploadMilestone,
      date: new Date().toISOString().split("T")[0],
      version: `v${(submissions.length + 1).toFixed(1)}`,
      status: "pending",
    };
    setSubmissions(prev => [newDoc, ...prev]);
    setUploadFileName("");
    triggerToast(`Submitted ${newDoc.docName} for verification.`);
  };

  const handleRequestConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultTopic) return;
    try {
      const startDateTime = new Date(`${consultDate || new Date().toISOString().split("T")[0]}T${consultTime || "10:00"}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 3600000);

      let meetUrl = DEFAULT_SHARED_MEET_URL;
      try {
        const res = await apiClient.post<{ consultation: any; meetingUrl?: string }>("/api/consultations", {
          researchId: activeProject?.id || "default-id",
          title: consultTopic,
          description: `Student consultation requested by ${user?.firstName || "Student"}`,
          scheduledStart: startDateTime.toISOString(),
          scheduledEnd: endDateTime.toISOString(),
        });
        if (res?.meetingUrl) meetUrl = res.meetingUrl;
      } catch {
        const letters = "abcdefghijklmnopqrstuvwxyz";
        let p1 = "", p2 = "", p3 = "";
        for (let i = 0; i < 3; i++) p1 += letters[Math.floor(Math.random() * 26)];
        for (let i = 0; i < 4; i++) p2 += letters[Math.floor(Math.random() * 26)];
        for (let i = 0; i < 3; i++) p3 += letters[Math.floor(Math.random() * 26)];
        meetUrl = `https://meet.google.com/${p1}-${p2}-${p3}`;
      }

      const newConsult: ConsultationItem = {
        id: Math.random().toString(),
        groupName: group?.name || activeProject?.title || "Research Group",
        topic: consultTopic,
        date: consultDate || new Date().toISOString().split("T")[0],
        time: consultTime || "10:00 AM",
        mode: consultMode === "In-Person" ? "In-Person" : "Google Meet",
        meetingUrl: consultMode !== "In-Person" ? meetUrl : undefined,
        status: "pending",
      };

      addStoredConsultation(newConsult);
      setConsultations(prev => [newConsult, ...prev.filter(c => c.id !== newConsult.id)]);
      refetchConsultations();
      triggerToast(`Consultation request submitted! Awaiting adviser approval.`);
    } catch {
      // Graceful fallback
    }
    setConsultTopic("");
    setConsultDate("");
    setConsultTime("");
  };

  const handleCreateResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;
    setIsCreatingProject(true);
    try {
      await apiClient.post("/api/research", {
        title: createTitle.trim(),
        abstract: createAbstract.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["student-research"] });
      setShowCreateModal(false);
      setCreateTitle("");
      setCreateAbstract("");
      triggerToast("Research study registered successfully!");
    } catch (err: any) {
      triggerToast(err.message || "Failed to register project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleOpenTranscriptModal = (consultation: ConsultationItem) => {
    setSelectedConsultationForTranscript(consultation);
    setShowTranscriptModal(true);
  };

  const handleSaveConsultationNotes = (
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
    refetchConsultations();
    triggerToast("Saved consultation notes and Google Meet chat transcript!");
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
    router.push(`/student/dashboard?tab=${tab}`);
  };

  const [consultFilter, setConsultFilter] = useState<"all" | "approved" | "pending">("all");

  const renderConsultationsHub = () => {
    const filteredConsultations = consultations.filter((c: any) => {
      if (consultFilter === "approved") return c.status !== "pending" && c.status !== "requested";
      if (consultFilter === "pending") return c.status === "pending" || c.status === "requested";
      return true;
    });

    return (
      <div className="flex flex-col gap-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#1b4264] via-[#225580] to-[#1b4264] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-extrabold text-[#ffa400] uppercase tracking-wider block">
              Adviser Consultations & Scheduled Meetings
            </span>
            <h2 className="text-xl font-black mt-0.5">Faculty Consultation Repository & Video Rooms</h2>
            <p className="text-xs text-slate-200 mt-1">
              Book advising slots, launch synchronized Google Meet rooms, and review auto-indexed meeting transcripts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleStartConference(DEFAULT_SHARED_MEET_URL, "Advising Video Conference")}
              className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="ti ti-video font-bold" />
              <span>Instant Google Meet</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Scheduled Sessions & History (7 of 12) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2">
                    <i className="ti ti-calendar-time text-[#ffa400]" />
                    Scheduled Sessions
                  </h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {consultations.length}
                  </span>
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setConsultFilter("all")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      consultFilter === "all" ? "bg-white text-[#1b4264] shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    All ({consultations.length})
                  </button>
                  <button
                    onClick={() => setConsultFilter("approved")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      consultFilter === "approved" ? "bg-white text-[#1b4264] shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Confirmed
                  </button>
                  <button
                    onClick={() => setConsultFilter("pending")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      consultFilter === "pending" ? "bg-white text-[#1b4264] shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>

              {filteredConsultations.length > 0 ? (
                <div className="flex flex-col gap-3.5">
                  {filteredConsultations.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 shadow-sm hover:border-[#1b4264] transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1b4264] text-[13.5px]">{c.topic}</span>
                            <Tag variant={c.status === "pending" || c.status === "requested" ? "warn" : "success"}>
                              {c.status === "pending" || c.status === "requested" ? "Pending Approval" : "Confirmed"}
                            </Tag>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {c.groupName || "Research Group"} · {c.date} at {c.time} ({c.mode})
                          </span>
                          {c.meetingUrl && (
                            <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-1">
                              {c.meetingUrl}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            onClick={() => handleOpenTranscriptModal(c)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#1b4264] font-bold rounded-lg border border-slate-300 text-xs shadow-sm cursor-pointer transition flex items-center gap-1"
                          >
                            <i className="ti ti-file-text text-amber-500" />
                            <span>{c.notes || (c.transcript && c.transcript.length > 0) ? "Notes & Chat" : "Import Chat"}</span>
                          </button>
                          {c.status === "pending" || c.status === "requested" ? (
                            <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 font-bold rounded-lg text-xs flex items-center gap-1">
                              <i className="ti ti-clock" />
                              <span>Pending</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStartConference(c.meetingUrl || DEFAULT_SHARED_MEET_URL, c.topic)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow transition cursor-pointer flex items-center gap-1"
                            >
                              <i className="ti ti-video" />
                              <span>Join Meet</span>
                            </button>
                          )}
                          {c.meetingUrl && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(c.meetingUrl);
                                triggerToast("Copied Google Meet link!");
                              }}
                              title="Copy Meet Link"
                              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer text-xs"
                            >
                              <i className="ti ti-copy" />
                            </button>
                          )}
                        </div>
                      </div>

                      {c.notes && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700">
                          <span className="font-bold text-[#1b4264] block mb-1">Adviser Feedback & Summary:</span>
                          <p className="whitespace-pre-wrap">{c.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-2xl">
                    <i className="ti ti-calendar-off" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#1b4264] text-sm">No Consultations Found</h4>
                    <p className="text-slate-500 text-xs max-w-sm mt-1">
                      {consultFilter === "all"
                        ? "You have not booked any advising consultations yet. Use the booking form on the right to schedule a session."
                        : `No ${consultFilter} consultations found.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quick Booking Form + Instant Meet + Guidelines (5 of 12) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Card 1: Book Consultation Form */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2">
                <i className="ti ti-calendar-plus text-[#ffa400]" />
                Book a Consultation Session
              </h3>
              <p className="text-slate-400 text-[11px] font-bold">
                Submit your preferred date and topic to your research adviser.
              </p>
              <form onSubmit={handleRequestConsult} className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Discussion Topic *</label>
                  <input
                    required
                    type="text"
                    value={consultTopic}
                    onChange={(e) => setConsultTopic(e.target.value)}
                    placeholder="e.g. Chapter 3 Methodology Validation"
                    className="bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-[#ffa400]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-700">Preferred Date *</label>
                    <input
                      required
                      type="date"
                      value={consultDate}
                      onChange={(e) => setConsultDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-[#ffa400]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-700">Preferred Time *</label>
                    <input
                      required
                      type="text"
                      value={consultTime}
                      onChange={(e) => setConsultTime(e.target.value)}
                      placeholder="10:00 AM"
                      className="bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-[#ffa400]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Meeting Mode</label>
                  <select
                    value={consultMode}
                    onChange={(e) => setConsultMode(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-[#ffa400]"
                  >
                    <option value="Video Call">Google Meet (Online Video Conference)</option>
                    <option value="In-Person">In-Person (Faculty Consultation Room)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg shadow transition cursor-pointer mt-1"
                >
                  Submit Consultation Request
                </button>
              </form>
            </div>

            {/* Card 2: Instant Meet Launch */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-[#1b4264] uppercase tracking-wider flex items-center gap-1.5">
                  <i className="ti ti-video text-emerald-600" />
                  Live Conferencing Room
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ready
                </span>
              </div>
              <p className="text-slate-500 text-xs">
                Need an immediate sync with your team members or adviser? Launch a synchronized Google Meet room with floating transcript window.
              </p>
              <button
                onClick={() => handleStartConference(DEFAULT_SHARED_MEET_URL, `${group?.name || "Student"} Instant Room`)}
                className="w-full py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="ti ti-external-link" />
                <span>Launch Instant Meet Room</span>
              </button>
            </div>

            {/* Card 3: Consultation Guidelines */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs flex flex-col gap-2">
              <span className="font-bold text-[#1b4264] flex items-center gap-1.5">
                <i className="ti ti-info-circle text-[#ffa400]" />
                Advising Guidelines & Policies
              </span>
              <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px]">
                <li>Book consultations at least 48 hours in advance.</li>
                <li>Upload your updated draft to Document Workspace prior to the call.</li>
                <li>In-call chats and action items are automatically preserved for compliance.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSubmissionsHub = () => {
    return (
      <div className="flex flex-col gap-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#1b4264] via-[#225580] to-[#1b4264] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-extrabold text-[#ffa400] uppercase tracking-wider block">
              Research Submissions & Version Control
            </span>
            <h2 className="text-xl font-black mt-0.5">Manuscript Draft Submissions & Review Center</h2>
            <p className="text-xs text-slate-200 mt-1">
              Submit formal drafts for faculty review, track incremental version diffs, and view approval endorsements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabChange("workspace")}
              className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="ti ti-edit font-bold" />
              <span>Open Document Workspace</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Submissions & Version Control History (7 of 12) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2">
                  <i className="ti ti-history text-[#ffa400]" />
                  Manuscript Versions & Upload History
                </h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {combinedSubmissions.length} Version{combinedSubmissions.length === 1 ? "" : "s"}
                </span>
              </div>

              {combinedSubmissions.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {combinedSubmissions.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm hover:border-[#1b4264] transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg flex-shrink-0">
                          <i className="ti ti-file-text" />
                        </div>
                        <div>
                          <span className="font-bold text-[#1b4264] text-[13px] block">{sub.docName}</span>
                          <span className="text-[11px] text-slate-500">
                            {sub.milestone || "Chapter Draft"} · Version {sub.version} · {sub.date}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag variant={sub.status === "approved" ? "success" : "warn"}>
                          {sub.status === "approved" ? "Approved" : "Pending Review"}
                        </Tag>
                        <button
                          onClick={() => handleTabChange("workspace")}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[#1b4264] font-bold text-xs cursor-pointer transition flex items-center gap-1"
                        >
                          <i className="ti ti-edit" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-2xl">
                    <i className="ti ti-upload" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#1b4264] text-sm">No Manuscript Submissions Yet</h4>
                    <p className="text-slate-500 text-xs max-w-sm mt-1">
                      Upload your initial proposal outline or chapter drafts using the submission form on the right.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Upload Form + Guidelines (5 of 12) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Card 1: Upload Manuscript Form */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              <h3 className="font-extrabold text-[#1b4264] text-[15px] flex items-center gap-2">
                <i className="ti ti-cloud-upload text-[#ffa400]" />
                Submit Draft Manuscript
              </h3>
              <p className="text-slate-400 text-[11px] font-bold">
                Submit your document draft for adviser endorsement and review.
              </p>
              <form onSubmit={handleUploadDoc} className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Milestone Stage *</label>
                  <select
                    value={uploadMilestone}
                    onChange={(e) => setUploadMilestone(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-[#ffa400]"
                  >
                    <option value="Proposal Outline">Proposal Outline & Scope</option>
                    <option value="Draft Submission">Chapter 1-3 Review Draft</option>
                    <option value="Ethics Application">Ethics Clearance Forms</option>
                    <option value="Final Manuscript">Final Defense Full Manuscript</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Document Title *</label>
                  <input
                    required
                    type="text"
                    value={uploadFileName}
                    onChange={(e) => setUploadFileName(e.target.value)}
                    placeholder="e.g. Chapter 3 Methodology Draft v1.0"
                    className="bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-[#ffa400]"
                  />
                </div>

                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center flex flex-col items-center justify-center gap-1.5">
                  <i className="ti ti-file-upload text-2xl text-slate-400" />
                  <span className="text-[11.5px] font-bold text-slate-600">Drag & Drop Manuscript (PDF / DOCX)</span>
                  <span className="text-[10px] text-slate-400">Maximum file size: 25 MB</span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg shadow transition cursor-pointer mt-1"
                >
                  Submit Manuscript for Review
                </button>
              </form>
            </div>

            {/* Card 2: Submission Guidelines */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs flex flex-col gap-2">
              <span className="font-bold text-[#1b4264] flex items-center gap-1.5">
                <i className="ti ti-checklist text-emerald-600" />
                Submission Standards Checklist
              </span>
              <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px]">
                <li>Turnitin similarity score must be strictly under 15%.</li>
                <li>Include faculty adviser formal endorsement slip.</li>
                <li>Use standard institutional margins (1.5" left, 1" top/right/bottom).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard", matches: ["overview", ""] },
    { id: "workspace", label: "Document Workspace", icon: "ti-file-text", matches: ["workspace"] },
    { id: "submissions", label: "Submissions", icon: "ti-folder-check", badge: combinedSubmissions.length, matches: ["submissions", "submission", "version-control"] },
    { id: "consultations", label: "Consultations", icon: "ti-calendar-event", badge: consultations.length, matches: ["consultations", "consultation-repo", "consultation-requests", "conferencing"] },
    { id: "history", label: "Consultation History", icon: "ti-history", matches: ["history"] },
    { id: "milestones", label: "Workflow Milestones", icon: "ti-timeline", matches: ["milestones", "progress"] },
    { id: "group-chats", label: "Group Chat", icon: "ti-messages", matches: ["group-chats", "chat"] },
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
      <div className="bg-white border-b border-slate-200 px-6 pt-3 flex items-center justify-between overflow-x-auto shadow-sm">
        <div className="flex gap-2">
          {tabsList.map((tab) => {
            const isActive = tab.matches ? tab.matches.includes(activeTab) : activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tour={`tab-${tab.id}`}
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

        <button
          onClick={() => setIsTourOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors mb-1.5 cursor-pointer whitespace-nowrap border border-slate-200"
          title="Start interactive product tour"
        >
          <i className="ti ti-sparkles text-amber-500" />
          <span>Product Tour</span>
        </button>
      </div>

      <ProductTour
        tourKey="student_onboarding_v1"
        steps={STUDENT_TOUR_STEPS}
        isOpen={isTourOpen ? true : undefined}
        onClose={() => setIsTourOpen(false)}
        autoStart={true}
      />

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
        
        {(() => {
          const tabTitles: Record<string, string> = {
            overview: "Student Dashboard",
            group: "Research Group Management",
            milestones: "Project Milestones",
            progress: "Progress Tracking",
            submission: "Research Document Submission",
            "version-control": "Document Version Control",
            "adviser-credentials": "Adviser Credentials Hub",
            "ai-recommendation": "AI Adviser Recommendation",
            "consultation-requests": "Consultation Requests",
            "consultation-repo": "Consultation Repository",
            conferencing: "Group Conferencing",
            defense: "Defense Schedule",
            certificates: "Certificates of Completion",
            settings: "Settings",
            profile: "My Profile",
            notifications: "Notifications",
          };

          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <>
                {!group ? (
                  <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-sm my-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1b4264]/10 to-[#ffa400]/20 flex items-center justify-center text-[#1b4264] mb-4">
                      <i className="ti ti-folder-plus text-3xl text-[#1b4264]" />
                    </div>
                    <h3 className="text-xl font-extrabold text-[#1b4264] mb-2">No Research Project Registered Yet</h3>
                    <p className="text-slate-500 text-sm max-w-md mb-6 leading-relaxed">
                      You are not enrolled in an active research study yet. Create your capstone or thesis project to start collaborating with faculty advisers, submitting drafts, and booking consultations.
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-extrabold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <i className="ti ti-plus font-bold" />
                      <span>Register Research Project</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-[#1b4264] to-[#255883] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-extrabold text-[#ffa400] uppercase tracking-wider block">Active Research Study</span>
                      <h2 className="text-xl font-black mt-0.5">{group.projectTitle}</h2>
                      <p className="text-xs text-slate-200 mt-1">Study Leader: {user?.firstName} {user?.lastName} · Status: <span className="uppercase font-bold text-[#ffa400]">{group.status}</span></p>
                    </div>
                    <button
                      onClick={() => handleTabChange("workspace")}
                      className="px-4 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-xl text-xs shadow transition cursor-pointer"
                    >
                      Open Document Workspace
                    </button>
                  </div>
                )}

                {/* EXACT STUDENT CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-users" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Research Group Status</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{group ? `${group.name} (${group.status})` : "Not Registered"}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-brain" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Adviser Recs</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{aiMatches.length > 0 ? `${aiMatches[0].name} (${aiMatches[0].match}%)` : "None yet"}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-file-text" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Submitted Documents</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{combinedSubmissions.length} Uploads</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar-event" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Pending Consults</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{consultations.filter(c=>c.status==='pending' || c.status==='requested').length} Requested</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2.5 justify-center min-h-[72px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg flex-shrink-0">
                        <i className="ti ti-target" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold leading-none">Milestone Progress</span>
                        <span className="text-[14.5px] font-extrabold text-[#1b4264] mt-1.5 block leading-none">{group ? "In Progress" : "0% Complete"}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
                      <div 
                        className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-full rounded-full transition-all duration-500 ease-out" 
                        style={{ width: group ? "20%" : "0%" }} 
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Defense Schedule</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{defenses.length > 0 ? defenses[0].date : "Not Scheduled"}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-certificate" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Certificate Status</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{group ? "Locked (Pending Defense)" : "Locked"}</span>
                    </div>
                  </div>
                </div>

                {/* Enhanced Bottom Cards: 4-card balanced grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Card 1: Active Study Information */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-school text-[#ffa400]" />
                          Study Overview
                        </span>
                        <Tag variant={group ? "success" : "info"}>{group ? "Enrolled" : "Draft"}</Tag>
                      </div>
                      <h4 className="font-extrabold text-[#1b4264] text-[13.5px] leading-snug line-clamp-2">
                        {group?.projectTitle || "No project registered yet"}
                      </h4>
                      <div className="text-[11.5px] text-slate-500 flex flex-col gap-1 mt-1">
                        <div><strong className="text-slate-700">Team:</strong> {group?.members?.length > 0 ? group.members.join(", ") : `${user?.firstName || "Student"} ${user?.lastName || ""}`}</div>
                        <div><strong className="text-slate-700">Adviser:</strong> {group?.adviser || "Not Assigned"}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTabChange(group ? "workspace" : "group")}
                      className="w-full py-2 bg-slate-100 hover:bg-[#1b4264] hover:text-[#ffa400] text-slate-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <i className="ti ti-arrow-right text-xs" />
                      <span>{group ? "Open Workspace" : "Manage Group"}</span>
                    </button>
                  </div>

                  {/* Card 2: Upcoming Milestones */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-timeline text-[#ffa400]" />
                          Workflow Milestones
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">{milestones.length} Tasks</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {milestones.length > 0 ? (
                          milestones.slice(0, 2).map(m => (
                            <div key={m.id} className="flex justify-between items-center text-[12px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
                              <span className="font-bold text-[#1b4264] truncate max-w-[140px]">{m.title}</span>
                              <Tag variant={m.status === "completed" ? "success" : m.status === "in-progress" ? "warn" : "info"}>{m.status}</Tag>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            No active milestones. Register your project to generate deadlines.
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleTabChange("milestones")}
                      className="w-full py-2 bg-slate-100 hover:bg-[#1b4264] hover:text-[#ffa400] text-slate-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <i className="ti ti-list-details text-xs" />
                      <span>View All Milestones</span>
                    </button>
                  </div>

                  {/* Card 3: Next Consultation & Google Meet */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-calendar-event text-[#ffa400]" />
                          Next Consultation
                        </span>
                        <Tag variant={consultations.length > 0 ? "success" : "info"}>{consultations.length > 0 ? "Scheduled" : "None"}</Tag>
                      </div>
                      {consultations.length > 0 ? (
                        <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg flex flex-col gap-1 text-[12px]">
                          <span className="font-bold text-[#1b4264] truncate">{consultations[0].topic}</span>
                          <span className="text-[11px] text-slate-500">{consultations[0].date} · {consultations[0].time}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          No upcoming consultations booked yet.
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleTabChange("consultations")}
                      className="w-full py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] text-xs font-extrabold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <i className="ti ti-plus font-bold text-xs" />
                      <span>Book Consultation</span>
                    </button>
                  </div>

                  {/* Card 4: Quick Collaboration Tools */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-bolt text-[#ffa400]" />
                          Quick Actions
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">Shortcuts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleTabChange("workspace")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-file-text text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-[11px] font-bold text-[#1b4264] block">Editor</span>
                          <span className="text-[9px] text-slate-400">Draft Chapters</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("group-chats")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-messages text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-[11px] font-bold text-[#1b4264] block">Group Chat</span>
                          <span className="text-[9px] text-slate-400">Message Team</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("submissions")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-upload text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-[11px] font-bold text-[#1b4264] block">Submit Draft</span>
                          <span className="text-[9px] text-slate-400">Upload Files</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("defense")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-calendar text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-[11px] font-bold text-[#1b4264] block">Defense</span>
                          <span className="text-[9px] text-slate-400">View Schedule</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ),
            profile: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Student profile Info</h3>
                <p className="text-[11px] text-slate-400 font-bold">Edit your student representative details, institutional identity cards, and department classifications.</p>
                <div className="flex flex-col gap-3 mt-2 text-[12px]">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Student Name</label>
                    <input type="text" readOnly value={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Student Researcher"} className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Represented Department</label>
                    <input type="text" readOnly value={user?.college?.name || user?.program?.name || "College of Computing"} className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Student ID Number</label>
                    <input type="text" readOnly value={user?.universityId || "Not Assigned"} className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none" />
                  </div>
                </div>
              </div>
            ),
            group: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Group Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Organize peer study divisions, invitation codes, and collaborative assignments.</p>
                {group ? (
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-2 shadow-sm">
                    <div className="font-bold text-[#1b4264]">Group Identifier: {group.name}</div>
                    <div><strong>Active Title:</strong> {group.projectTitle}</div>
                    <div><strong>Group Members:</strong> {group.members?.join(", ") || `${user?.firstName} ${user?.lastName}`}</div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl text-center flex flex-col items-center gap-3">
                    <p className="text-slate-500 text-xs">You do not have a research group registered yet.</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-[#1b4264] text-[#ffa400] font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Register Research Study
                    </button>
                  </div>
                )}
              </div>
            ),
            "adviser-credentials": (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Adviser Credentials Hub</h3>
                <p className="text-[11px] text-slate-400 font-bold">View faculty profiles, research expertise indices, and verified publication records.</p>
                <div className="flex flex-col gap-3.5 mt-2">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                    <div>
                      <span className="font-extrabold text-[#1b4264] block">Dr. Rachel Lim</span>
                      <span className="text-[11px] text-slate-500">Expertise: Machine Learning, Computer Vision, Neural Nets</span>
                    </div>
                    <Tag variant="success">Available</Tag>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                    <div>
                      <span className="font-extrabold text-[#1b4264] block">Dr. Lisa Wong</span>
                      <span className="text-[11px] text-slate-500">Expertise: Data Infrastructures, Cryptographic Security Systems</span>
                    </div>
                    <Tag variant="success">Available</Tag>
                  </div>
                </div>
              </div>
            ),
            "ai-recommendation": (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">AI Adviser Recommendation</h3>
                <p className="text-[11px] text-slate-400 font-bold">Generate optimized matches based on topic alignment algorithms.</p>
                <div className="flex flex-col gap-3.5 mt-2 text-[12px]">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={topicInput}
                      onChange={(e)=>setTopicInput(e.target.value)}
                      placeholder="Enter your research keywords (e.g., Computer Vision, CNN)..." 
                      className="bg-white border border-slate-350 rounded-lg p-2.5 flex-1 focus:outline-none focus:border-[#ffa400]" 
                    />
                    <button 
                      onClick={() => triggerToast("Generated matches successfully.")} 
                      className="px-4 py-2 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg shadow-md border border-[#ffa400]"
                    >
                      Find Match
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    {aiMatches.map(m => (
                      <div key={m.name} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center shadow-sm">
                        <div>
                          <span className="font-bold text-[#1b4264]">{m.name}</span>
                        </div>
                        <span className="font-mono text-[#ffa400] font-extrabold text-[12px]">{m.match} match</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
            conferencing: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">In-App Voice and Video Group Conferencing</h3>
                <p className="text-[11px] text-slate-400 font-bold">Coordinate with peers and advisers using localized sandbox stream channels.</p>
                
                {!isMeetingActive ? (
                  <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl text-center flex flex-col gap-4 shadow-sm">
                    <div className="w-16 h-16 bg-[#1b4264]/10 rounded-full flex items-center justify-center mx-auto text-[#1b4264]">
                      <i className="ti ti-video text-3xl animate-pulse" />
                    </div>
                    <div>
                      <span className="font-bold text-[#1b4264] text-[14px] block">Live Stream Channels Ready</span>
                      <span className="text-[10.5px] text-slate-400">Current Room ID: <strong>{group?.name || "Research Room"}</strong></span>
                    </div>
                    <button 
                      onClick={() => handleStartConference("https://meet.google.com/new", `${group?.name || "Research"} Study Stream`)} 
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
            submissions: renderSubmissionsHub(),
            submission: renderSubmissionsHub(),
            "version-control": renderSubmissionsHub(),
            milestones: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Project Milestones</h3>
                <p className="text-[11px] text-slate-400 font-bold">View sequence boundaries, check tasks list, and monitor lock states.</p>
                <div className="flex flex-col gap-2.5 mt-2">
                  {milestones.length > 0 ? (
                    milestones.map(m => (
                      <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[12.5px] shadow-sm">
                        <div>
                          <span className="font-bold text-[#1b4264] block">{m.title}</span>
                        </div>
                        <Tag variant={m.status === 'completed' ? 'success' : m.status === 'in-progress' ? 'warn' : 'info'}>{m.status}</Tag>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No project milestones recorded. Register your research study to initiate workflow.
                    </div>
                  )}
                </div>
              </div>
            ),
            consultations: renderConsultationsHub(),
            "consultation-repo": renderConsultationsHub(),
            "consultation-requests": renderConsultationsHub(),
            progress: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Progress Tracking Dashboard</h3>
                <p className="text-[11px] text-slate-400 font-bold">Visual status indicators showing project workflow completion.</p>
                <div className="bg-slate-50 p-6 border border-slate-200 rounded-2xl mt-2 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-center text-[13px] font-extrabold text-[#1b4264]">
                    <span>Overall Study Progression</span>
                    <span className="bg-[#1b4264]/10 text-[#1b4264] px-2.5 py-0.5 rounded text-[11px] font-extrabold font-mono">{group ? "20% COMPLETE" : "0% COMPLETE"}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-4 p-1 overflow-hidden border border-slate-300/40 shadow-inner flex items-center">
                    <div 
                      className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-2.5 rounded-full transition-all duration-500 ease-out animate-pulse shadow-sm" 
                      style={{ width: group ? "20%" : "0%" }} 
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 flex items-center gap-1.5">
                    <i className="ti ti-info-circle text-[#1b4264]" />
                    <span>{group ? `Current Milestone: ${milestones[0]?.title || "Topic Proposal"}` : "Register your research study to begin tracking milestones."}</span>
                  </div>
                </div>
              </div>
            ),
            defense: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Schedule Viewing</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review defense panel timings, assignees, and digital venues.</p>
                {defenses.length > 0 ? (
                  defenses.map(d => (
                    <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] flex flex-col gap-2 mt-2 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[#1b4264] text-[14px]">{d.title}</span>
                        <Tag variant="warn">{d.type}</Tag>
                      </div>
                      <div className="text-slate-500 font-medium">
                        <div><strong>Date / Time:</strong> {d.date} at {d.time}</div>
                        <div><strong>Venue:</strong> {d.venue}</div>
                        <div><strong>Panelists:</strong> {d.panelists?.join(", ")}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 py-6 text-center">
                    No defense presentations scheduled yet. Complete required chapters to be eligible for defense.
                  </div>
                )}
              </div>
            ),
            history: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#1b4264] text-[16px]">Consultation History & Transcript Archive</h3>
                    <p className="text-[11px] text-slate-400 font-bold">Review historical meeting schedules, faculty advice, and Google Meet chat records.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      <strong>{consultations.length}</strong> Total Records
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {consultations.length > 0 ? (
                    consultations.map((c: any) => (
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
                              {c.groupName || "Research Consultation"} · {c.date} at {c.time} ({c.mode})
                            </span>
                          </div>

                          <button
                            onClick={() => handleOpenTranscriptModal(c)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-[#1b4264] font-bold rounded-lg border border-slate-300 text-xs shadow-sm cursor-pointer self-start sm:self-auto transition"
                          >
                            <i className="ti ti-file-text text-amber-500" />
                            <span>{c.notes || (c.transcript && c.transcript.length > 0) ? "View Notes & Chat" : "Import Google Meet Chat"}</span>
                          </button>
                        </div>

                        {c.notes && (
                          <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
                            <span className="font-bold text-[#1b4264] flex items-center gap-1">
                              <i className="ti ti-notes" />
                              <span>Meeting Summary & Adviser Feedback:</span>
                            </span>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{c.notes}</p>
                          </div>
                        )}

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
                              {c.transcript.map((msg: any) => (
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
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No consultation records or transcripts recorded yet.
                    </div>
                  )}
                </div>
              </div>
            ),
            notifications: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Notifications & Announcements</h3>
                <p className="text-[11px] text-slate-400 font-bold">Real-time alerts, chapter approvals, and institutional announcements.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {combinedNotifications.length > 0 ? (
                    combinedNotifications.map(n => (
                      <div key={n.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[12px] shadow-sm">
                        <div>
                          <span className="font-bold text-[#1b4264] block">{n.msg}</span>
                        </div>
                        <span className="text-slate-400 font-bold text-[10.5px]">{n.date}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No new notifications.
                    </div>
                  )}
                </div>
              </div>
            ),
            certificates: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Certificates of Completion</h3>
                <p className="text-[11px] text-slate-400 font-bold">Access and download QR-verified Certificates of Completion.</p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] flex items-center justify-between mt-2 shadow-sm">
                  <div>
                    <span className="font-bold text-[#1b4264] block">Certificate of Completion (Pending)</span>
                    <span className="text-[10px] text-slate-400">Available once final oral grading has been submitted.</span>
                  </div>
                  <button 
                    onClick={() => setModalCert(true)} 
                    className="px-3.5 py-2 bg-[#ffa400] hover:bg-[#e09000] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] shadow cursor-pointer transition-colors"
                  >
                    View Status
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
            "group-chats": (
              <StudentGroupChats triggerToast={triggerToast} />
            ),
            chat: (
              <StudentGroupChats triggerToast={triggerToast} />
            ),
            workspace: (
              <StudentWorkspace triggerToast={triggerToast} />
            ),
          };

          return tabContent[activeTab] || tabContent.overview;
        })()}

      </main>

      {/* ─── MODALS ─── */}
      {modalCert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4">
            <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
              <i className="ti ti-certificate text-[#ffa400] text-xl" />
              Certificate Completion Verification
            </h3>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center flex flex-col gap-3 shadow-inner">
              <div className="font-extrabold text-[#1b4264] text-[14px]">Verification: In Progress</div>
              <div className="w-24 h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center mx-auto shadow-sm relative">
                <i className="ti ti-qrcode text-5xl text-slate-350" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ffa400] rounded-full border border-white" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                Lock status: Locked. Oral evaluation sheet verification signature must be processed by the administrative panel.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button onClick={()=>setModalCert(false)} className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg text-[12px] font-bold text-slate-700 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER RESEARCH STUDY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-t-4 border-[#1b4264] max-w-lg w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
                <i className="ti ti-folder-plus text-[#ffa400] text-xl" />
                Register Research Study
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            <form onSubmit={handleCreateResearch} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Research Project Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Real-Time Water Quality Monitoring Using IoT"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="p-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-[#ffa400]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Abstract / Problem Scope (Optional)</label>
                <textarea
                  rows={4}
                  placeholder="Provide an overview of the proposed study, methodology, or objectives..."
                  value={createAbstract}
                  onChange={(e) => setCreateAbstract(e.target.value)}
                  className="p-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-[#ffa400] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProject || !createTitle.trim()}
                  className="px-5 py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-extrabold rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {isCreatingProject ? "Registering..." : "Submit Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GoogleMeetConnectModal
        isOpen={showConnectModal}
        currentUrl={activeMeetingUrl}
        defaultEmail={user?.email || ""}
        defaultName={`${user?.firstName || "Student"} ${user?.lastName || "Researcher"}`.trim()}
        role="Lead Researcher"
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

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading Student Portal...</div>}>
      <StudentDashboardContent />
    </Suspense>
  );
}
