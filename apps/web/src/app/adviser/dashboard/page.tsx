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
import { useAuth } from "@/providers/auth-provider";

const resolveApiFileUrl = (value: string) => value.startsWith("/")
  ? `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}${value}`
  : value;

const openAuthenticatedFile = async (value: string) => {
  if (!value.startsWith("/")) {
    window.open(value, "_blank", "noopener,noreferrer");
    return;
  }
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(resolveApiFileUrl(value), { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) throw new Error("Unable to open the adviser request form.");
  const objectUrl = URL.createObjectURL(await response.blob());
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

function AdviserDashboardContent() {
  const { user } = useAuth();
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
            groupName: s.groupName || "Advisee Consultation",
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
        groupId: "default",
        groupName: "Advisee Consultation",
        topic: activeMeetingTopic,
        meetingUrl: targetUrl,
        gmailAccount: selectedEmail,
      });
    } catch {
      // Graceful fallback
    }

    saveMeetingSession({
      groupId: "default",
      groupName: "Advisee Consultation",
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
  const { data: researchData, refetch: refetchResearch } = useQuery({
    queryKey: ["adviser-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // Real State Data strictly from database queries
  const [advisees, setAdvisees] = useState<any[]>([]);

  useEffect(() => {
    if (researchData?.projects && researchData.projects.length > 0) {
      setAdvisees(
        researchData.projects
          .filter((p: any) => p.members?.some((member: any) => member.projectRole === "ADVISER" && member.user?.id === user?.id && !member.leftAt))
          .map((p: any) => {
            const stages = p.workflowInstance?.workflow?.stages || [];
            const currentStageId = p.workflowInstance?.currentStage?.id;
            const currentIndex = stages.findIndex((stage: any) => stage.id === currentStageId);
            const progress = stages.length > 0 ? Math.max(0, Math.round(((currentIndex + 1) / stages.length) * 100)) : 0;
            const taskSubmissions = new Map((p.taskSubmissions || []).map((submission: any) => [submission.taskId, submission]));
            const tasks = stages.flatMap((stage: any) => (stage.tasks || []).map((task: any) => ({
              ...task,
              stageName: stage.name,
              stageSequence: stage.sequence,
              submission: taskSubmissions.get(task.id),
            })));
            return {
              id: p.id,
              groupName: p.title?.substring(0, 24) || "Research Group",
              projectTitle: p.title,
              leader: p.members?.find((m: any) => m.projectRole === "LEADER")?.user?.firstName || "Group Leader",
              status: p.status?.toLowerCase() || "active",
              progress,
              currentStage: p.workflowInstance?.currentStage?.name || "Not started",
              tasks,
              abstract: p.abstract || "No abstract has been provided.",
              members: (p.members || []).filter((member: any) => member.projectRole !== "ADVISER" && !member.leftAt),
              adviserSince: p.members?.find((member: any) => member.projectRole === "ADVISER" && member.user?.id === user?.id && !member.leftAt)?.joinedAt,
            };
          })
      );
    }
  }, [researchData, user?.id]);

  const [selectedAdvisee, setSelectedAdvisee] = useState<any | null>(null);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const closeAdviseeModal = () => {
    setSelectedAdvisee(null);
    setShowWithdrawalForm(false);
    setWithdrawalReason("");
    setWithdrawalNote("");
  };

  const handleWithdrawFromGroup = async () => {
    if (!selectedAdvisee || !withdrawalReason || withdrawalNote.trim().length < 10) return;
    setIsWithdrawing(true);
    try {
      await apiClient.post(`/api/research/${selectedAdvisee.id}/adviser-withdrawal`, {
        reason: withdrawalReason,
        note: withdrawalNote.trim(),
      });
      const groupName = selectedAdvisee.groupName;
      closeAdviseeModal();
      await Promise.all([refetchResearch(), refetchReviewQueue(), refetchConsultations(), refetchAdviserCapacity()]);
      triggerToast(`You are no longer the adviser for ${groupName}. The group and coordinator were notified.`);
    } catch (error: any) {
      triggerToast(error?.message || "Unable to leave this research group.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const [reviews, setReviews] = useState<any[]>([]);

  const { data: reviewQueueData, refetch: refetchReviewQueue } = useQuery({
    queryKey: ["adviser-review-queue", user?.id, researchData?.projects?.map((project: any) => project.id).join(",")],
    enabled: Boolean(researchData?.projects),
    queryFn: async () => {
      const assignedProjects = (researchData?.projects || []).filter((project: any) =>
        project.members?.some((member: any) => member.projectRole === "ADVISER" && member.user?.id === user?.id && !member.leftAt)
      );
      const projectDocuments = await Promise.all(assignedProjects.map(async (project: any) => {
        const response = await apiClient.get<{ documents: any[] }>(`/api/research/${project.id}/documents`).catch(() => ({ documents: [] }));
        return (response.documents || []).flatMap((document: any) => {
          const latestVersion = document.versions?.[0];
          if (!latestVersion || latestVersion.reviews?.some((review: any) => review.reviewerId === user?.id && review.status === "SUBMITTED")) return [];
          return [{
            id: latestVersion.id,
            versionId: latestVersion.id,
            docName: document.title,
            groupName: project.title,
            milestone: project.workflowInstance?.currentStage?.name || "Research document",
            fileUrl: latestVersion.webViewLink,
            submittedAt: latestVersion.createdAt,
          }];
        });
      }));
      return projectDocuments.flat().sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    },
  });

  useEffect(() => {
    setReviews(reviewQueueData || []);
  }, [reviewQueueData]);

  const { data: adviserRequestData, refetch: refetchAdviserRequests } = useQuery({
    queryKey: ["adviser-requests"],
    queryFn: () => apiClient.get<{ requests: any[] }>("/api/adviser-requests").catch(() => ({ requests: [] })),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const { data: adviserCapacityData, refetch: refetchAdviserCapacity } = useQuery({
    queryKey: ["adviser-capacity"],
    queryFn: () => apiClient.get<{ capacity: { adviseeCount: number; maxAdviseeGroups: number; availableSlots: number; isAcceptingAdvisees: boolean; isFull: boolean } }>("/api/users/me/adviser-capacity"),
    staleTime: 30_000,
  });
  const adviserCapacity = adviserCapacityData?.capacity;
  const adviserRequests = adviserRequestData?.requests || [];
  const pendingAdviserRequests = adviserRequests.filter((request: any) => request.status === "PENDING");
  const [requestDecision, setRequestDecision] = useState<{ request: any; decision: "accept" | "reject" } | null>(null);
  const [requestResponseNote, setRequestResponseNote] = useState("");
  const [isRespondingToRequest, setIsRespondingToRequest] = useState(false);

  const handleAdviserRequestResponse = async () => {
    if (!requestDecision) return;
    setIsRespondingToRequest(true);
    try {
      await apiClient.patch(`/api/adviser-requests/${requestDecision.request.id}/respond`, {
        decision: requestDecision.decision,
        note: requestResponseNote,
      });
      triggerToast(requestDecision.decision === "accept" ? "Adviser request accepted." : "Adviser request declined.");
      setRequestDecision(null);
      setRequestResponseNote("");
      await Promise.all([refetchAdviserRequests(), refetchResearch(), refetchAdviserCapacity()]);
    } catch (error: any) {
      triggerToast(error?.message || "Unable to respond to the adviser request.");
    } finally {
      setIsRespondingToRequest(false);
    }
  };

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
        groupName: selectedAdv?.groupName || "Advisee Group",
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

  const [approvals, setApprovals] = useState<any[]>([]);
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
    ...chatStoreNotifications.map(n => ({ id: n.id, msg: n.msg, date: n.date || "Just now" })),
    ...notifications
  ];

  const [commentInput, setCommentInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const getWaitingLabel = (date?: string) => {
    if (!date) return "Recently submitted";
    const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
    if (days === 0) return "Submitted today";
    return `Waiting ${days} ${days === 1 ? "day" : "days"}`;
  };

  const handleApproveMilestone = async (id: string, groupName: string) => {
    setApprovals(prev => prev.filter(a => a.id !== id));
    triggerToast(`Approved milestone for ${groupName}`);
  };

  const handleReviewComment = async (reviewId: string) => {
    if (!commentInput.trim()) return;
    try {
      await apiClient.post(`/api/documents/versions/${reviewId}/reviews`, {
        reviewType: "ADVISER",
        overallComment: commentInput.trim(),
        recommendation: "MINOR_REVISION",
      });
      triggerToast("Review feedback submitted successfully.");
      setCommentInput("");
      await refetchReviewQueue();
    } catch (error: any) {
      triggerToast(error?.message || "Unable to submit review feedback.");
    }
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

      {requestDecision && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="adviser-response-title">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${requestDecision.decision === "accept" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}><i className={`ti ${requestDecision.decision === "accept" ? "ti-user-check" : "ti-user-x"}`} /></span>
              <div><h2 id="adviser-response-title" className="text-lg font-extrabold text-[#102f49]">{requestDecision.decision === "accept" ? "Accept adviser request" : "Decline adviser request"}</h2><p className="mt-1 text-sm text-slate-500">{requestDecision.request.research?.title}</p></div>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><span className="font-bold text-[#102f49]">Group message:</span><p className="mt-1 whitespace-pre-line">{requestDecision.request.note || "No message was included."}</p>{requestDecision.request.research?.members?.length > 0 && <p className="mt-3 text-xs"><span className="font-bold text-[#102f49]">Members:</span> {requestDecision.request.research.members.filter((member: any) => member.projectRole !== "ADVISER").map((member: any) => `${member.user.firstName} ${member.user.lastName}`).join(", ")}</p>}{requestDecision.request.requestFormDocument?.versions?.[0]?.storagePath && <button type="button" onClick={() => openAuthenticatedFile(requestDecision.request.requestFormDocument.versions[0].storagePath).catch((error) => triggerToast(error.message))} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-[#173f63] ring-1 ring-slate-200 hover:ring-[#f6a800]"><i className="ti ti-file-type-pdf text-rose-600" />Open adviser request PDF</button>}</div>
            <label className="mt-5 block text-sm font-bold text-slate-700">Note to the group <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea value={requestResponseNote} onChange={(event) => setRequestResponseNote(event.target.value)} maxLength={1000} rows={4} placeholder={requestDecision.decision === "accept" ? "Share your expectations or next steps." : "Briefly explain your decision or suggest another direction."} className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#173f63]" />
            {requestDecision.decision === "accept" && adviserCapacity?.isFull && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">You cannot accept this group because your adviser capacity is full or requests are paused.</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => { setRequestDecision(null); setRequestResponseNote(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600">Cancel</button><button onClick={handleAdviserRequestResponse} disabled={isRespondingToRequest || (requestDecision.decision === "accept" && adviserCapacity?.isFull)} className={`rounded-lg px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60 ${requestDecision.decision === "accept" ? "bg-emerald-600" : "bg-rose-600"}`}>{isRespondingToRequest ? "Saving…" : requestDecision.decision === "accept" ? "Accept request" : "Decline request"}</button></div>
          </div>
        </div>
      )}

      {selectedAdvisee && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="advisee-group-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#173f63]">Assigned research group</span><h2 id="advisee-group-title" className="mt-2 text-xl font-extrabold text-[#102f49]">{selectedAdvisee.projectTitle}</h2><p className="mt-1 text-sm text-slate-500">Representative: {selectedAdvisee.leader}</p></div>
              <button type="button" onClick={closeAdviseeModal} aria-label="Close group details" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#173f63] hover:bg-slate-200"><i className="ti ti-x text-xl" /></button>
            </div>

            {!showWithdrawalForm ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Project status</p><p className="mt-1 font-bold capitalize text-[#102f49]">{selectedAdvisee.status.replace(/_/g, " ")}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Current milestone</p><p className="mt-1 font-bold text-[#102f49]">{selectedAdvisee.currentStage}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Overall progress</p><p className="mt-1 font-bold text-[#102f49]">{selectedAdvisee.progress}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#173f63] to-[#f6a800]" style={{ width: `${selectedAdvisee.progress}%` }} /></div></div></div>

                <section className="mt-5"><h3 className="text-sm font-extrabold text-[#102f49]">Study abstract</h3><p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">{selectedAdvisee.abstract}</p></section>

                <section className="mt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-[#102f49]">Group members</h3><span className="text-xs font-semibold text-slate-400">{selectedAdvisee.members.length} students</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2">{selectedAdvisee.members.map((member: any) => <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173f63] text-xs font-bold text-white">{`${member.user?.firstName?.[0] || "S"}${member.user?.lastName?.[0] || ""}`}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#102f49]">{member.user?.firstName} {member.user?.lastName}</p><p className="truncate text-xs text-slate-500">{member.projectRole === "LEADER" ? "Group representative" : "Researcher"} · {member.user?.email}</p></div></div>)}</div></section>

                <section className="mt-5"><h3 className="text-sm font-extrabold text-[#102f49]">Milestone requirements</h3><div className="mt-2 space-y-2">{selectedAdvisee.tasks.length ? selectedAdvisee.tasks.slice(0, 5).map((task: any) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#102f49]">{task.title}</p><p className="text-xs text-slate-500">{task.stageName}</p></div><Tag variant={task.submission?.status === "APPROVED" ? "success" : task.submission ? "warn" : "neutral"}>{task.submission?.status?.replace(/_/g, " ") || "Not submitted"}</Tag></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No milestone requirements have been configured.</p>}</div></section>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><p className="text-xs text-slate-400">Adviser since {selectedAdvisee.adviserSince ? new Date(selectedAdvisee.adviserSince).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "assignment date unavailable"}</p><div className="flex gap-2"><button type="button" onClick={() => { closeAdviseeModal(); handleTabChange("group-chats"); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-[#173f63] hover:bg-slate-50"><i className="ti ti-message mr-1.5" />Message group</button><button type="button" onClick={() => setShowWithdrawalForm(true)} className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100"><i className="ti ti-logout mr-1.5" />Leave as adviser</button></div></div>
              </>
            ) : (
              <div className="mt-5">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><i className="ti ti-alert-triangle mt-0.5 text-xl text-amber-700" /><div><p className="font-extrabold text-amber-900">This group will become unassigned</p><p className="mt-1 text-sm leading-5 text-amber-800">Students may be unable to complete adviser-dependent milestones until another adviser accepts them. Future scheduled consultations will be cancelled, while your previous reviews, comments, and records will remain attributed to you.</p></div></div></div>
                <div className="mt-5"><label className="text-sm font-bold text-slate-700">Reason for leaving <span className="text-rose-600">*</span></label><select value={withdrawalReason} onChange={(event) => setWithdrawalReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-[#173f63]"><option value="">Select a reason</option><option value="GROUP_REQUESTED_CHANGE">Group requested a different adviser</option><option value="OUTSIDE_EXPERTISE">Research is outside my expertise</option><option value="WORKLOAD_AVAILABILITY">Workload or availability</option><option value="GROUP_INACTIVE">Group became inactive</option><option value="PROJECT_DISCONTINUED">Project rejected or discontinued</option><option value="STUDENT_WITHDREW">Student withdrew from the course</option><option value="OTHER">Other</option></select></div>
                <div className="mt-4"><label className="text-sm font-bold text-slate-700">Note to students and coordinator <span className="text-rose-600">*</span></label><textarea value={withdrawalNote} onChange={(event) => setWithdrawalNote(event.target.value)} maxLength={1500} rows={6} placeholder="Explain the decision and provide any recommended next steps. Minimum 10 characters." className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-[#173f63]" /><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{withdrawalNote.trim().length < 10 ? `${10 - withdrawalNote.trim().length} more characters required` : "Ready to submit"}</span><span>{withdrawalNote.length}/1500</span></div></div>
                <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => { setShowWithdrawalForm(false); setWithdrawalReason(""); setWithdrawalNote(""); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Back</button><button type="button" onClick={handleWithdrawFromGroup} disabled={isWithdrawing || !withdrawalReason || withdrawalNote.trim().length < 10} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">{isWithdrawing ? <><i className="ti ti-loader-2 animate-spin" />Withdrawing…</> : <><i className="ti ti-user-minus" />Confirm withdrawal</>}</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-y-auto bg-[#f6f8fb] p-5 lg:p-6">
        
        {(() => {
          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
                <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm md:px-8">
                  <div className="absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden lg:block" aria-hidden="true">
                    <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-[#1b4264]/5" />
                    <div className="absolute right-36 top-8 h-40 w-40 rounded-full bg-[#ffa400]/10" />
                    <i className="ti ti-books absolute bottom-5 right-40 text-[92px] text-[#1b4264]/90" />
                    <i className="ti ti-sparkles absolute right-28 top-7 text-3xl text-[#ffa400]" />
                  </div>
                  <div className="relative z-10 max-w-2xl">
                    <span className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#c98200]">
                      <span className="h-2 w-2 rounded-full bg-[#ffa400]" /> Adviser workspace
                    </span>
                    <h1 className="text-2xl font-black tracking-tight text-[#102f4d] md:text-3xl">
                      Welcome back, {user?.firstName || "Adviser"}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">Your advisees, reviews, and meetings—at a glance.</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button onClick={() => handleTabChange("reviews")} className="inline-flex items-center gap-2 rounded-lg bg-[#ffa400] px-4 py-2.5 text-sm font-extrabold text-[#102f4d] shadow-sm transition hover:bg-[#ee9900]">
                        <i className="ti ti-file-search" /> Review documents
                      </button>
                      <button onClick={() => setShowScheduleModal(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#1b4264] transition hover:bg-slate-50">
                        <i className="ti ti-calendar-plus" /> Schedule meeting
                      </button>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Advisee groups", value: adviserCapacity?.adviseeCount ?? advisees.length, suffix: adviserCapacity ? `of ${adviserCapacity.maxAdviseeGroups}` : "assigned", icon: "ti-users", tone: "bg-blue-50 text-[#1b4264]", tab: "advisees" },
                    { label: "Document reviews", value: reviews.length, suffix: "pending", icon: "ti-file-text", tone: "bg-amber-50 text-[#e08d00]", tab: "reviews" },
                    { label: "Milestones", value: approvals.length, suffix: "for approval", icon: "ti-circle-check", tone: "bg-emerald-50 text-emerald-600", tab: "approvals" },
                    { label: "Consultations", value: consultations.length, suffix: "scheduled", icon: "ti-calendar-event", tone: "bg-violet-50 text-violet-600", tab: "consultations" },
                  ].map((item) => (
                    <button key={item.label} onClick={() => handleTabChange(item.tab)} className="group flex min-h-24 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#1b4264]/30 hover:shadow-md">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${item.tone}`}><i className={`ti ${item.icon}`} /></span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-500">{item.label}</span>
                        <span className="mt-0.5 block text-xl font-black text-[#102f4d]">{item.value} <small className="text-xs font-semibold text-slate-400">{item.suffix}</small></span>
                      </span>
                    </button>
                  ))}
                </section>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="flex items-center gap-2 text-base font-extrabold text-[#102f4d]">Needs your attention {pendingAdviserRequests.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{pendingAdviserRequests.length} adviser {pendingAdviserRequests.length === 1 ? "request" : "requests"}</span>}</h2>
                        <p className="text-xs text-slate-400">Your highest-priority advising work.</p>
                      </div>
                      <button onClick={() => handleTabChange("approvals")} className="text-xs font-bold text-[#1b4264] hover:text-[#ffa400]">View all <i className="ti ti-chevron-right" /></button>
                    </div>
                    {pendingAdviserRequests.length > 0 || approvals.length > 0 || reviews.length > 0 ? (
                      <div className="space-y-2">
                        {pendingAdviserRequests.slice(0, 3).map((request: any) => (
                          <div key={request.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#1b4264] shadow-sm"><i className="ti ti-user-plus" /></span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#102f4d]">{request.research?.title || "Research group"}</p><p className="mt-0.5 text-xs text-slate-500">Requested by {request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : "group representative"}</p>{request.note && <p className="mt-2 line-clamp-2 text-xs text-slate-600">“{request.note}”</p>}</div></div><span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-700">Adviser request</span></div>
                            <div className="mt-3 flex justify-end gap-2"><button onClick={() => { setRequestDecision({ request, decision: "reject" }); setRequestResponseNote(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-rose-300 hover:text-rose-600">Reject</button><button onClick={() => { setRequestDecision({ request, decision: "accept" }); setRequestResponseNote(""); }} disabled={adviserCapacity?.isFull} title={adviserCapacity?.isFull ? "Capacity reached or new requests are paused" : undefined} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Accept</button></div>
                          </div>
                        ))}
                        {approvals.slice(0, 2).map((a) => (
                          <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><i className="ti ti-flag" /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#102f4d]">{a.groupName}</p><p className="truncate text-xs text-slate-500">{a.milestone}</p></div></div>
                            <button onClick={() => handleApproveMilestone(a.id, a.groupName)} className="ml-3 rounded-lg bg-[#ffa400] px-3 py-1.5 text-xs font-extrabold text-[#102f4d]">Review</button>
                          </div>
                        ))}
                        {reviews.slice(0, 2).map((review) => (
                          <button key={review.id} onClick={() => handleTabChange("reviews")} className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-left">
                            <span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[#1b4264]"><i className="ti ti-file-text" /></span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[#102f4d]">{review.docName || "Document review"}</span><span className="block truncate text-xs text-slate-500">{review.groupName} · {getWaitingLabel(review.submittedAt)}</span></span></span><i className="ti ti-chevron-right text-slate-400" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center">
                        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600"><i className="ti ti-circle-check" /></span>
                        <p className="text-sm font-extrabold text-[#102f4d]">You’re all caught up</p>
                        <p className="mt-1 text-xs text-slate-400">New reviews and approvals will appear here.</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold text-[#102f4d]">Next consultation</h2><button onClick={() => handleTabChange("consultations")} className="text-slate-400 hover:text-[#1b4264]" aria-label="Open consultations"><i className="ti ti-chevron-right" /></button></div>
                    {consultations.length > 0 ? (
                      <div className="flex min-h-40 flex-col justify-between rounded-xl bg-[#1b4264] p-4 text-white">
                        <div><span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">Upcoming</span><h3 className="mt-3 text-lg font-extrabold">{consultations[0].topic}</h3><p className="mt-1 text-xs text-slate-300">{consultations[0].groupName} · {consultations[0].date} · {consultations[0].time}</p></div>
                        <button onClick={() => handleStartConference(consultations[0].meetingUrl || DEFAULT_SHARED_MEET_URL, consultations[0].topic)} className="mt-4 rounded-lg bg-[#ffa400] py-2.5 text-sm font-extrabold text-[#102f4d]"><i className="ti ti-video mr-2" />Join meeting</button>
                      </div>
                    ) : (
                      <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-slate-50 px-4 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-[#1b4264]"><i className="ti ti-calendar-time" /></span><p className="text-sm font-extrabold text-[#102f4d]">No consultation scheduled</p><button onClick={() => setShowScheduleModal(true)} className="mt-3 rounded-lg bg-[#ffa400] px-4 py-2 text-xs font-extrabold text-[#102f4d]">Schedule one</button></div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-base font-extrabold text-[#102f4d]">Quick actions</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "View advisees", icon: "ti-users", tab: "advisees" },
                      { label: "Review documents", icon: "ti-file-search", tab: "reviews" },
                      { label: "Track progress", icon: "ti-chart-line", tab: "progress" },
                      { label: "Message groups", icon: "ti-messages", tab: "group-chats" },
                    ].map((action) => <button key={action.label} onClick={() => handleTabChange(action.tab)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#ffa400] hover:bg-amber-50/40"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-lg text-[#1b4264]"><i className={`ti ${action.icon}`} /></span><span className="text-xs font-bold text-[#102f4d]">{action.label}</span></button>)}
                  </div>
                </section>
              </div>
            ),
            advisees: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-extrabold text-[#1b4264] text-[16px]">Assigned Advisees</h3><p className="text-[11px] text-slate-400 font-bold">Active research groups currently assigned to you.</p></div>{adviserCapacity && <div className="min-w-60 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between text-xs"><span className="font-bold text-[#102f4d]">Capacity</span><span className="font-extrabold text-[#102f4d]">{adviserCapacity.adviseeCount} / {adviserCapacity.maxAdviseeGroups}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${adviserCapacity.isFull ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, adviserCapacity.maxAdviseeGroups ? (adviserCapacity.adviseeCount / adviserCapacity.maxAdviseeGroups) * 100 : 100)}%` }} /></div><p className="mt-2 text-[10px] font-semibold text-slate-500">{!adviserCapacity.isAcceptingAdvisees ? "New requests are paused by the dean." : adviserCapacity.isFull ? "Capacity reached. You cannot accept another group." : `${adviserCapacity.availableSlots} ${adviserCapacity.availableSlots === 1 ? "slot" : "slots"} available.`}</p></div>}</div>
                <div className="flex flex-col gap-3 mt-2">
                  {advisees.length > 0 ? (
                    advisees.map(adv => (
                      <button key={adv.id} type="button" onClick={() => setSelectedAdvisee(adv)} className="group w-full p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center gap-4 text-left text-[12.5px] shadow-sm transition hover:border-[#173f63] hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#f6a800]/60">
                        <div>
                          <span className="font-bold text-[#1b4264] block">{adv.groupName}</span>
                          <span className="text-[11px] text-slate-500">{adv.projectTitle} · Representative: {adv.leader}</span>
                        </div>
                        <span className="flex shrink-0 items-center gap-3"><Tag variant="success">{adv.status}</Tag><i className="ti ti-chevron-right text-base text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#173f63]" /></span>
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No assigned advisee groups registered yet.
                    </div>
                  )}
                </div>
              </div>
            ),
            reviews: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Research Document Review & Commenting</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review draft submissions, download version history, and submit comments.</p>
                {reviews.length > 0 ? (
                  reviews.map(rev => (
                    <div key={rev.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 text-[12.5px] shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                        <div>
                          <span className="font-bold text-[#1b4264] block">{rev.docName}</span>
                          <span className="text-[10px] text-slate-400">{rev.groupName} · {rev.milestone} · {getWaitingLabel(rev.submittedAt)}</span>
                        </div>
                        <button onClick={() => rev.fileUrl ? window.open(rev.fileUrl, "_blank", "noopener,noreferrer") : triggerToast("No document preview is available.")} className="text-[#ffa400] font-bold hover:underline cursor-pointer">
                          Open document
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
                  ))
                ) : (
                  <div className="text-xs text-slate-400 py-6 text-center">
                    No pending student draft reviews.
                  </div>
                )}
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
                        <span className="font-mono text-[#ffa400]">{adv.progress}% COMPLETE</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-full rounded-full" style={{ width: `${adv.progress}%` }} />
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">Current stage: {adv.currentStage}</span>
                      <div className="mt-1 grid gap-2 border-t border-slate-200 pt-3">
                        <div className="flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Shared task status</span><span className="text-[10px] font-bold text-slate-500">Adviser view</span></div>
                        {adv.tasks?.length ? adv.tasks.map((task: any) => {
                          const submission = task.submission;
                          const status = submission?.status || "NOT SUBMITTED";
                          const submitter = submission?.submittedByUser ? `${submission.submittedByUser.firstName} ${submission.submittedByUser.lastName}` : null;
                          return <div key={task.id} className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-[#1b4264]">{task.stageSequence}. {task.title}</p><p className="text-[10px] text-slate-500">{submitter ? `Submitted by: ${submitter}` : task.stageName}</p></div><Tag variant={status === "APPROVED" ? "success" : status === "REVISION_REQUIRED" || status === "REJECTED" ? "warn" : "info"}>{status.replace(/_/g, " ")}</Tag></div>;
                        }) : <p className="rounded-lg bg-white p-3 text-xs text-slate-500">No submission requirements configured for this workflow.</p>}
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
                      <span className="text-[10.5px] text-slate-400">Join consultation call with your assigned advisee groups</span>
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
            chat: (
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
