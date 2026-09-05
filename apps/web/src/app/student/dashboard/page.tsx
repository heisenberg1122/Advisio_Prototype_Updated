import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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

function StudentDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  // Synchronized Floating Google Meet Conference Session State
  const initialSession = getStoredMeetingSession();
  const [isMeetingActive, setIsMeetingActive] = useState(initialSession.isActive);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [activeMeetingUrl, setActiveMeetingUrl] = useState(initialSession.meetingUrl || DEFAULT_SHARED_MEET_URL);
  const [activeMeetingTopic, setActiveMeetingTopic] = useState(initialSession.topic || "Student Group Conferencing");
  const [activeParticipants, setActiveParticipants] = useState(
    initialSession.participants.length > 0
      ? initialSession.participants
      : [
          { id: "p1", name: "Juan Reyes", role: "Lead Researcher", email: "juan.reyes@student.university.edu.ph", joinedAt: "Just now" },
          { id: "p2", name: "Dr. Rachel Lim", role: "Faculty Adviser", email: "rachel.lim@university.edu.ph", joinedAt: "Just now" },
        ]
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

    const studentParticipant = {
      id: "p2",
      name: `${user?.firstName || "Juan"} ${user?.lastName || "Reyes"}`,
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

  // Query live projects from API
  const { data: researchData } = useQuery({
    queryKey: ["student-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  const activeProject = researchData?.projects?.[0];

  // State Data with live fallbacks
  const [group, setGroup] = useState({
    name: "Group AI-CCS-01",
    projectTitle: "AI-based Crop Yield Prediction System Using ML",
    members: ["Juan Reyes", "Marc Santos", "Sarah Garcia"],
    status: "active",
  });

  useEffect(() => {
    if (activeProject) {
      setGroup({
        name: activeProject.title?.substring(0, 20) || "Cap-Project-01",
        projectTitle: activeProject.title || "Untitled Research",
        members: activeProject.members?.map((m: any) => `${m.user.firstName} ${m.user.lastName}`) || ["Student Member"],
        status: activeProject.status?.toLowerCase() || "active",
      });
    }
  }, [activeProject]);

  const [aiMatches, setAiMatches] = useState([
    { name: "Dr. Rachel Lim", match: 98, expertise: "Machine Learning, Neural Networks", status: "Available" },
    { name: "Dr. Lisa Wong", match: 85, expertise: "Computer Vision, Data Analytics", status: "Available" },
    { name: "Prof. Arthur Pendleton", match: 72, expertise: "Big Data Systems, Cloud Tech", status: "Busy" },
  ]);

  const [submissions, setSubmissions] = useState([
    { id: "s1", docName: "Proposal Draft Outline v1", milestone: "Proposal Outline", date: "2026-06-25", version: "v1.0", status: "approved" },
    { id: "s2", docName: "Chapter 1-3 Review Draft v2", milestone: "Draft Submission", date: "2026-06-27", version: "v2.1", status: "pending" },
  ]);

  const [workspaceSubmissions, setWorkspaceSubmissions] = useState<any[]>([]);

  useEffect(() => {
    const syncSubmissions = () => {
      const stored = localStorage.getItem("advisio_student_submissions");
      if (stored) {
        try {
          setWorkspaceSubmissions(JSON.parse(stored));
        } catch (e) {}
      }
    };
    syncSubmissions();
    window.addEventListener("storage", syncSubmissions);
    return () => window.removeEventListener("storage", syncSubmissions);
  }, []);

  const combinedSubmissions = [...workspaceSubmissions, ...submissions];

  const [milestones, setMilestones] = useState([
    { id: "m1", title: "Proposal Outline Selection", status: "completed", date: "2026-06-20" },
    { id: "m2", title: "Chapter 1-3 Submission", status: "in-progress", date: "2026-07-15" },
    { id: "m3", title: "Ethics Clearance Review", status: "upcoming", date: "2026-07-30" },
    { id: "m4", title: "Pre-Defense Presentation", status: "upcoming", date: "2026-08-15" },
    { id: "m5", title: "Final Oral Defense", status: "upcoming", date: "2026-09-10" },
  ]);

  const [defenses, setDefenses] = useState([
    { id: "d1", title: "AI Crop Yield Prediction System", type: "Proposal Defense", date: "2026-07-10", time: "10:00 AM", venue: "CCS Seminar Hall", panelists: ["Dr. Lisa Wong", "Prof. A. Pendleton"] },
  ]);

  const [notifications, setNotifications] = useState([
    { id: "n1", msg: "Dr. Rachel Lim approved your outline version v1.0", date: "June 25, 2026", type: "system" },
    { id: "n2", msg: "Institutional Ethics Deadline scheduled for July 30", date: "June 24, 2026", type: "announcement" },
  ]);

  const [chatStoreNotifications, setChatStoreNotifications] = useState<any[]>([]);

  useEffect(() => {
    const syncNotifs = () => {
      const store = getChatStore();
      const userNotifs = store.notifications.filter(
        n => n.userId === "juan.reyes@university.edu.ph"
      );
      setChatStoreNotifications(userNotifs);
    };
    syncNotifs();
    window.addEventListener("storage", syncNotifs);
    return () => window.removeEventListener("storage", syncNotifs);
  }, []);

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
        groupName: "Group AI-CCS-01",
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

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { id: "workspace", label: "Document Workspace", icon: "ti-file-text" },
    { id: "submissions", label: "Submissions", icon: "ti-folder-check", badge: combinedSubmissions.length },
    { id: "consultations", label: "Consultations", icon: "ti-calendar-event", badge: consultations.length },
    { id: "history", label: "Consultation History", icon: "ti-history" },
    { id: "milestones", label: "Workflow Milestones", icon: "ti-timeline" },
    { id: "chat", label: "Group Chat", icon: "ti-messages" },
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
                {/* EXACT STUDENT CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-users" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Research Group Status</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{group.name} ({group.status})</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-brain" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Adviser Recs</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{aiMatches[0].name} (98%)</span>
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
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{consultations.filter(c=>c.status==='pending').length} Requested</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2.5 justify-center min-h-[72px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg flex-shrink-0">
                        <i className="ti ti-target" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold leading-none">Milestone Progress</span>
                        <span className="text-[14.5px] font-extrabold text-[#1b4264] mt-1.5 block leading-none">20% Complete</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
                      <div 
                        className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-full rounded-full transition-all duration-500 ease-out animate-pulse" 
                        style={{ width: "20%" }} 
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Defense Schedule</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">July 10, 2026</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-certificate" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Certificate Status</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">Locked (Pending Oral)</span>
                    </div>
                  </div>
                </div>

                {/* Quick Summary View */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Active Study Information</h3>
                    <div className="text-[12px] text-slate-650 flex flex-col gap-2">
                      <div><strong>Title:</strong> {group.projectTitle}</div>
                      <div><strong>Represented Group:</strong> {group.members.join(", ")}</div>
                      <div><strong>Official Adviser:</strong> Dr. Rachel Lim</div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Upcoming Milestones</h3>
                    <div className="flex flex-col gap-2.5">
                      {milestones.slice(0, 3).map(m => (
                        <div key={m.id} className="flex justify-between items-center text-[12.5px] p-2 bg-slate-50 border border-slate-200 rounded">
                          <span className="font-bold text-[#1b4264]">{m.title}</span>
                          <Tag variant={m.status==='completed'?'success':m.status==='in-progress'?'warn':'info'}>{m.status}</Tag>
                        </div>
                      ))}
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
                    <input type="text" readOnly value="Juan Reyes" className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Represented Department</label>
                    <input type="text" readOnly value="College of Computer Studies" className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Student ID Number</label>
                    <input type="text" readOnly value="2023-10045" className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none" />
                  </div>
                </div>
              </div>
            ),
            group: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Group Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Organize peer study divisions, invitation codes, and collaborative assignments.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-2 shadow-sm">
                  <div className="font-bold text-[#1b4264]">Group Identifier: {group.name}</div>
                  <div><strong>Active Title:</strong> {group.projectTitle}</div>
                  <div><strong>Group Members:</strong> {group.members.join(", ")}</div>
                </div>
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
                      <span className="text-[10.5px] text-slate-400">Current Room ID: <strong>Group AI-CCS-01</strong></span>
                    </div>
                    <button 
                      onClick={() => handleStartConference("https://meet.google.com/new", "Group AI-CCS-01 Study Stream")} 
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
            submission: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Document Submission</h3>
                <p className="text-[11px] text-slate-400 font-bold">Upload draft files and outline scopes directly to assigned reviewers.</p>
                <form onSubmit={handleUploadDoc} className="flex flex-col gap-3 mt-2 text-[12px]">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Select Document Type</label>
                    <select value={uploadMilestone} onChange={(e)=>setUploadMilestone(e.target.value)} className="bg-white border border-slate-350 rounded-lg p-2.5 focus:outline-none">
                      <option value="Proposal Outline">Proposal Outline</option>
                      <option value="Draft Submission">Chapter 1-3 Review Draft</option>
                      <option value="Ethics Application">Ethics Application Forms</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Document Name</label>
                    <input required type="text" value={uploadFileName} onChange={(e)=>setUploadFileName(e.target.value)} className="bg-white border border-slate-350 rounded-lg p-2.5 focus:outline-none" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg shadow border border-[#ffa400] self-start mt-2">
                    Submit Draft
                  </button>
                </form>
              </div>
            ),
            "version-control": (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Document Version Control</h3>
                <p className="text-[11px] text-slate-400 font-bold">Monitor historical draft changes, track comments, and compare version indexes.</p>
                <div className="flex flex-col gap-3.5 mt-2">
                  {combinedSubmissions.map(sub => (
                    <div key={sub.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{sub.docName}</span>
                        <span className="text-[10px] text-slate-400">Version: {sub.version} · Date: {sub.date}</span>
                      </div>
                      <Tag variant={sub.status === "approved" ? "success" : "warn"}>{sub.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            milestones: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Project Milestones</h3>
                <p className="text-[11px] text-slate-400 font-bold">View sequence boundaries, check tasks list, and monitor lock states.</p>
                <div className="flex flex-col gap-2.5 mt-2">
                  {milestones.map(m => (
                    <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{m.title}</span>
                      </div>
                      <Tag variant={m.status === 'completed' ? 'success' : m.status === 'in-progress' ? 'warn' : 'info'}>{m.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            "consultation-requests": (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Consultation Requests</h3>
                <p className="text-[11px] text-slate-400 font-bold">Book voice or messaging slots with designated coordinators and advisers.</p>
                <form onSubmit={handleRequestConsult} className="flex flex-col gap-3.5 mt-2 text-[12.5px]">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-600">Consultation Topic</label>
                    <input required type="text" value={consultTopic} onChange={(e)=>setConsultTopic(e.target.value)} placeholder="Methodology neural network details..." className="bg-white border border-slate-350 rounded-lg p-2.5 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-600">Preferred Date</label>
                      <input required type="date" value={consultDate} onChange={(e)=>setConsultDate(e.target.value)} className="bg-white border border-slate-350 rounded-lg p-2.5 focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-600">Preferred Time</label>
                      <input required type="text" value={consultTime} onChange={(e)=>setConsultTime(e.target.value)} placeholder="10:00 AM" className="bg-white border border-slate-350 rounded-lg p-2.5 focus:outline-none" />
                    </div>
                  </div>
                  <button type="submit" className="px-4 py-2 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-lg shadow border border-[#ffa400] self-start mt-2">
                    Request Consultation
                  </button>
                </form>
              </div>
            ),
            "consultation-repo": (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px] flex items-center gap-2">
                  <i className="ti ti-video text-[#ffa400]" />
                  Consultation Repository & Scheduled Meetings
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">Access historical transcripts, advisory notes, and join scheduled Google Meet video rooms.</p>
                <div className="flex flex-col gap-3.5 mt-2 text-[12px]">
                  {consultations.map((c: any) => (
                    <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 shadow-sm hover:border-[#1b4264] transition">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1b4264] block text-[13.5px]">{c.topic}</span>
                            <Tag variant={c.status === "pending" || c.status === "requested" ? "warn" : "success"}>
                              {c.status === "pending" || c.status === "requested" ? "Pending Adviser Approval" : "Approved & Confirmed"}
                            </Tag>
                          </div>
                          <span className="text-[11px] text-slate-500">{c.date} · {c.time} ({c.mode})</span>
                          {c.meetingUrl && (
                            <div className="font-mono text-[10.5px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-1">
                              {c.meetingUrl}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenTranscriptModal(c)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-[#1b4264] font-bold rounded-lg border border-slate-300 text-xs shadow-sm cursor-pointer transition"
                          >
                            <i className="ti ti-file-text text-amber-500" />
                            <span>{c.notes || (c.transcript && c.transcript.length > 0) ? "View Notes & Chat" : "Import Google Meet Chat"}</span>
                          </button>

                          {c.status === "pending" || c.status === "requested" ? (
                            <button
                              disabled
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 font-bold rounded-lg text-[11px] cursor-not-allowed opacity-90"
                              title="Awaiting adviser approval"
                            >
                              <i className="ti ti-clock" />
                              <span>Awaiting Approval</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartConference(c.meetingUrl || DEFAULT_SHARED_MEET_URL, c.topic)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition cursor-pointer"
                            >
                              <i className="ti ti-video" />
                              <span>Join Google Meet</span>
                            </button>
                          )}
                          {c.meetingUrl && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(c.meetingUrl);
                                triggerToast("Copied Google Meet link to clipboard!");
                              }}
                              title="Copy Link"
                              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer text-xs"
                            >
                              <i className="ti ti-copy" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Adviser Notes & Recommendations preview */}
                      {c.notes && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
                          <span className="font-bold text-[#1b4264] flex items-center gap-1">
                            <i className="ti ti-notes" />
                            <span>Meeting Summary & Adviser Feedback:</span>
                          </span>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{c.notes}</p>
                        </div>
                      )}

                      {/* Action items preview */}
                      {c.actionItems && c.actionItems.length > 0 && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
                          <span className="font-bold text-[#1b4264] flex items-center gap-1">
                            <i className="ti ti-checklist text-emerald-600" />
                            <span>Agreed Action Items ({c.actionItems.length}):</span>
                          </span>
                          <ul className="list-disc list-inside text-slate-700 space-y-0.5 pl-1">
                            {c.actionItems.map((item: string, idx: number) => (
                              <li key={idx} className="text-[11.5px]">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* In-call Google Meet chat transcript preview */}
                      {c.transcript && c.transcript.length > 0 && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex flex-col gap-1.5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                            <span className="font-bold text-[#1b4264] flex items-center gap-1.5">
                              <i className="ti ti-messages text-blue-600" />
                              <span>Google Meet In-Call Messages ({c.transcript.length})</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Auto-Indexed</span>
                          </div>
                          <div className="max-h-28 overflow-y-auto flex flex-col gap-1 pr-1">
                            {c.transcript.map((msg: any) => (
                              <div key={msg.id} className="p-1.5 bg-slate-50 rounded border border-slate-100 text-[11px]">
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
                </div>
              </div>
            ),
            progress: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Progress Tracking Dashboard</h3>
                <p className="text-[11px] text-slate-400 font-bold">Visual status indicators showing project workflow completion.</p>
                <div className="bg-slate-50 p-6 border border-slate-200 rounded-2xl mt-2 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-center text-[13px] font-extrabold text-[#1b4264]">
                    <span>Overall Study Progression</span>
                    <span className="bg-[#1b4264]/10 text-[#1b4264] px-2.5 py-0.5 rounded text-[11px] font-extrabold font-mono">20% COMPLETE</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-4 p-1 overflow-hidden border border-slate-300/40 shadow-inner flex items-center">
                    <div 
                      className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-2.5 rounded-full transition-all duration-500 ease-out animate-pulse shadow-sm" 
                      style={{ width: "20%" }} 
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 flex items-center gap-1.5">
                    <i className="ti ti-info-circle text-[#1b4264]" />
                    <span>Next Milestone: <strong>Chapter 1-3 Submission</strong>. Target deadline is July 15, 2026.</span>
                  </div>
                </div>
              </div>
            ),
            defense: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Schedule Viewing</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review defense panel timings, assignees, and digital venues.</p>
                {defenses.map(d => (
                  <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] flex flex-col gap-2 mt-2 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-[#1b4264] text-[14px]">{d.title}</span>
                      <Tag variant="warn">{d.type}</Tag>
                    </div>
                    <div className="text-slate-500 font-medium">
                      <div><strong>Date / Time:</strong> {d.date} at {d.time}</div>
                      <div><strong>Venue:</strong> {d.venue}</div>
                      <div><strong>Panelists:</strong> {d.panelists.join(", ")}</div>
                    </div>
                  </div>
                ))}
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
                  {consultations.map((c: any) => (
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
                            {c.groupName || "Group AI-CCS-01"} · {c.date} at {c.time} ({c.mode})
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
                            {c.actionItems.map((item: string, idx: number) => (
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
                  ))}

                  {consultations.length === 0 && (
                    <div className="text-center py-8 text-slate-400 font-medium">
                      No consultation records logged yet.
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
                  {combinedNotifications.map(n => (
                    <div key={n.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[12px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{n.msg}</span>
                      </div>
                      <span className="text-slate-400 font-bold text-[10.5px]">{n.date}</span>
                    </div>
                  ))}
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

      <GoogleMeetConnectModal
        isOpen={showConnectModal}
        currentUrl={activeMeetingUrl}
        defaultEmail={user?.email || "juan.reyes@student.university.edu.ph"}
        defaultName={`${user?.firstName || "Juan"} ${user?.lastName || "Reyes"}`}
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
