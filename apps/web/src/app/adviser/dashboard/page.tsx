import { DateTile, StatusDot } from "@/components/ui/advisio";
import React, { useState, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { CardsPageSkeleton, DashboardSkeleton, ListPageSkeleton, TablePageSkeleton } from "@/components/ui/Skeleton";
import { AdviserResearchGroupCard } from "@/components/adviser/AdviserResearchGroupCard";
import { AdviserAdviseesWorkspace } from "@/components/adviser/AdviserAdviseesWorkspace";
import { AdviserConsultationsWorkspace } from "@/components/adviser/AdviserConsultationsWorkspace";
import { AdviserProgressWorkspace } from "@/components/adviser/AdviserProgressWorkspace";
import { AdviserGroupChats } from "@/components/dashboards/adviser/AdviserGroupChats";
import { getStoredMeetingSession, saveMeetingSession, DEFAULT_SHARED_MEET_URL } from "@/lib/meeting-store";
import { GoogleMeetConnectModal } from "@/components/consultations/GoogleMeetConnectModal";
import { GoogleMeetTranscriptModal, ParsedChatMessage } from "@/components/consultations/GoogleMeetTranscriptModal";
import type { ConsultationItem } from "@/lib/consultation-store";
import { useAuth } from "@/providers/auth-provider";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { AdviserDocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { calculateMilestoneProgress } from "@/lib/workflow-progress";
import "./adviser-overview.css";

const EMPTY_MILESTONE_PROGRESS_BY_PROJECT: Record<string, any[]> = {};

// The API already supplies a calendar date and a separately formatted time.
// Format the date's parts directly: no UTC/local conversion or locale-dependent output.
const formatOverviewDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value;
};

const overviewDateParts = (value: string) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match && months[Number(match[2]) - 1]) return { month: months[Number(match[2]) - 1], day: String(Number(match[3])) };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { month: "TBA", day: "—" };
  return {
    month: date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" }),
    day: date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" }),
  };
};

// Keep the source wording intact. Only recognized waiting labels get a chip;
// other submission labels remain ordinary metadata, without an amber status.
function OverviewSubmissionAge({ label }: { label: string }) {
  if (!/^Waiting \d+ days?$/.test(label)) return <span>{label}</span>;
  return <span className="adviser-overview__waiting"><i className="ti ti-clock" aria-hidden="true" />{label}</span>;
}

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
  const contextualResearchId = searchParams.get("researchId") || "";
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
  const [conferenceProjectId, setConferenceProjectId] = useState("");

  // Live query for consultations with background refresh
  const { data: consultationsApiData, isPending: consultationsLoading, isError: consultationsError, refetch: refetchConsultations } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => apiClient.get<{ consultations: any[] }>("/api/consultations"),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const [consultations, setConsultations] = useState<ConsultationItem[]>([]);

  useEffect(() => {
    if (consultationsApiData?.consultations) {
      setConsultations(consultationsApiData.consultations);
    }
  }, [consultationsApiData]);

  // Poll backend database for active stream across different browsers (Edge, Brave, etc.)
  useEffect(() => {
    const fetchActiveStream = async () => {
      try {
        if (!conferenceProjectId) return;
        const res = await apiClient.get<{ success: boolean; stream: any }>(`/api/consultations/active-stream?groupId=${conferenceProjectId}`);
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
  }, [conferenceProjectId]);

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
      id: user?.id || selectedEmail,
      name: `${user?.firstName || "Faculty"} ${user?.lastName || "Adviser"}`.trim(),
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
        groupId: conferenceProjectId,
        groupName: "Advisee Consultation",
        topic: activeMeetingTopic,
        meetingUrl: targetUrl,
        gmailAccount: selectedEmail,
      });
    } catch {
      // Graceful fallback
    }

    saveMeetingSession({
      groupId: conferenceProjectId,
      groupName: "Advisee Consultation",
      topic: activeMeetingTopic,
      meetingUrl: targetUrl,
      isActive: true,
      startedAt: Date.now(),
      participants: updatedParticipants,
    });

    window.open(targetUrl, "GoogleMeetWindow", "width=1024,height=720,resizable=yes");
  };

  const handleStartConference = (url?: string, topicTitle: string = "Group Conferencing", researchId?: string) => {
    if (url) setActiveMeetingUrl(url);
    if (topicTitle) setActiveMeetingTopic(topicTitle);
    if (researchId) setConferenceProjectId(researchId);
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
      if (conferenceProjectId)
        await apiClient.post("/api/consultations/active-stream/end", { groupId: conferenceProjectId });
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
    if (tab === "reviews") {
      router.push("/adviser/reviews");
      return;
    }
    router.push(`/adviser/dashboard?tab=${tab}`);
  };

  // Live query for assigned advisee research projects
  const { data: researchData, isPending: researchLoading, isError: researchError, refetch: refetchResearch } = useQuery({
    queryKey: ["adviser-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research"),
    staleTime: 60000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const adviserProjectIds = (researchData?.projects || [])
    .filter((project: any) => project.members?.some(
      (member: any) => member.projectRole === "ADVISER" && member.user?.id === user?.id && !member.leftAt,
    ))
    .map((project: any) => project.id as string);
  const adviserProjectKey = adviserProjectIds.join(",");
  const { data: milestoneProgressByProject = EMPTY_MILESTONE_PROGRESS_BY_PROJECT, isLoading: milestoneProgressLoading } = useQuery({
    queryKey: ["adviser-milestone-progress", adviserProjectKey],
    queryFn: async () => {
      const entries = await Promise.all(adviserProjectIds.map(async (projectId) => {
        try {
          const projection = await apiClient.get<{ milestones: any[] }>(
            `/api/research/${projectId}/manuscript-workflow`,
          );
          return [projectId, projection.milestones || []] as const;
        } catch {
          return [projectId, []] as const;
        }
      }));
      return Object.fromEntries(entries) as Record<string, any[]>;
    },
    enabled: adviserProjectIds.length > 0,
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // Real State Data strictly from database queries
  const [advisees, setAdvisees] = useState<any[]>([]);

  useEffect(() => {
    if (researchData?.projects) {
      setAdvisees(
        researchData.projects
          .filter((p: any) => p.members?.some((member: any) => member.projectRole === "ADVISER" && member.user?.id === user?.id && !member.leftAt))
          .map((p: any) => {
            const stages = p.workflowInstance?.workflow?.stages || [];
            const progress = calculateMilestoneProgress(
              milestoneProgressByProject[p.id],
              Boolean(p.workflowInstance?.completedAt),
            );
            const taskSubmissions = new Map((p.taskSubmissions || []).map((submission: any) => [submission.taskId, submission]));
            const milestoneProgress = milestoneProgressByProject[p.id] || [];
            const tasks = stages.flatMap((stage: any) => (stage.tasks || []).map((task: any) => ({
              ...task,
              stageName: stage.name,
              stageSequence: stage.sequence,
              submission: taskSubmissions.get(task.id),
            })));
            return {
              id: p.id,
              groupName: p.groupName || "Research Group",
              projectTitle: p.title || "Research title not registered",
              leader: (() => {
                const leader = p.members?.find((m: any) => m.projectRole === "LEADER" && !m.leftAt)?.user;
                return leader ? `${leader.firstName || ""} ${leader.lastName || ""}`.trim() : "Group Leader";
              })(),
              status: p.status?.toLowerCase() || "active",
              progress,
              currentStage: p.workflowInstance?.currentStage?.name || "Not started",
              tasks,
              pendingTasks: milestoneProgress.reduce(
                (count: number, milestone: any) => count + (milestone.tasks || []).filter((task: any) => task.isRequired && task.status !== "APPROVED").length,
                0,
              ),
              abstract: p.abstract || "No abstract has been provided.",
              members: (p.members || []).filter((member: any) => member.projectRole !== "ADVISER" && !member.leftAt),
              adviserSince: p.members?.find((member: any) => member.projectRole === "ADVISER" && member.user?.id === user?.id && !member.leftAt)?.joinedAt,
            };
          })
      );
    }
  }, [milestoneProgressByProject, researchData, user?.id]);

  useEffect(() => {
    if (!contextualResearchId || !advisees.some((advisee) => advisee.id === contextualResearchId)) return;
    setConsultGroupId(contextualResearchId);
  }, [advisees, contextualResearchId]);

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

  const { data: reviewQueueData, isPending: reviewQueueLoading, isError: reviewQueueError, refetch: refetchReviewQueue } = useQuery({
    queryKey: ["adviser-review-queue", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const response = await apiClient.get<{ assignments: any[] }>("/api/reviewer-assignments/me");
      return (response.assignments || []).map((assignment: any) => ({
        id: assignment.id,
        assignmentId: assignment.id,
        projectId: assignment.research.id,
        documentId: assignment.document.id,
        versionId: assignment.documentVersion.id,
        docName: `${assignment.document.title} · Version ${assignment.documentVersion.versionNumber}`,
        groupName: assignment.research.groupName || assignment.research.title,
        milestone: assignment.documentVersion.milestone?.name || "Research manuscript",
        submittedAt: assignment.documentVersion.submittedAt || assignment.assignedAt,
        status: assignment.status,
        recommendation: assignment.review?.recommendation || null,
      })).sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    },
  });

  useEffect(() => {
    setReviews((reviewQueueData || []).filter((assignment: any) => assignment.status === "ACTIVE"));
  }, [reviewQueueData]);
  const openAssignedReview = (review: any) => {
    const params = new URLSearchParams({
      projectId: review.projectId,
      documentId: review.documentId,
      versionId: review.versionId,
      assignmentId: review.assignmentId,
    });
    router.push(`/adviser/reviews?${params.toString()}`);
  };

  const { data: adviserRequestData, isPending: requestsLoading, isError: requestsError, refetch: refetchAdviserRequests } = useQuery({
    queryKey: ["adviser-requests"],
    queryFn: () => apiClient.get<{ requests: any[] }>("/api/adviser-requests"),
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
  const requestId = searchParams.get("requestId");
  const requestDetails = adviserRequests.find((request: any) => request.id === requestId);
  const requestDetailsRef = useRef<HTMLDivElement>(null);
  const showingRequestDetails = Boolean(requestId && !requestDecision);
  useEffect(() => {
    if (!showingRequestDetails) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    requestDetailsRef.current?.focus();
    return () => previousFocus?.focus();
  }, [showingRequestDetails, requestId]);
  const closeRequestDetails = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("requestId");
    router.replace(`/adviser/dashboard${params.size ? `?${params}` : ""}`);
  };

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

      if (!selectedAdv?.id) throw new Error("Select an assigned research group.");
      const result = await apiClient.post<{ consultation: ConsultationItem; warning?: string }>("/api/consultations", {
        researchId: selectedAdv.id,
        title: consultTopic,
        description: `Advising session for ${selectedAdv.groupName || "Research Group"}`,
        scheduledStart: startDateTime.toISOString(),
        scheduledEnd: endDateTime.toISOString(),
        meetingUrl: customMeetUrl.trim() || undefined,
      });
      setConsultations((previous) => [
        result.consultation,
        ...previous.filter((item) => item.id !== result.consultation.id),
      ]);
      await refetchConsultations();
      setConsultTopic("");
      setConsultDate("");
      setConsultTime("");
      setCustomMeetUrl("");
      setShowScheduleModal(false);
      triggerToast(result.warning || "Consultation scheduled successfully.");
    } catch (error: any) {
      triggerToast(error?.message || "Unable to schedule the consultation.");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleApproveConsultation = async (id: string, topic: string) => {
    try {
      await apiClient.patch(`/api/consultations/${id}/approve`);
      await refetchConsultations();
      triggerToast(`Approved consultation: ${topic}`);
    } catch (error: any) {
      triggerToast(error?.message || "Unable to approve this consultation.");
    }
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
    try {
      await apiClient.post(`/api/consultations/${consultationId}/notes`, {
        notes,
        actionItems,
        transcript,
      });
      await refetchConsultations();
      triggerToast("Consultation notes saved.");
    } catch (error: any) {
      triggerToast(error?.message || "Unable to save consultation notes.");
    }
  };

  const [approvals, setApprovals] = useState<any[]>([]);

  const [commentInput, setCommentInput] = useState("");
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
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

  if (researchLoading) {
    if (activeTab === "overview") return <DashboardSkeleton />;
    if (["advisees", "consultations", "history"].includes(activeTab)) return <CardsPageSkeleton />;
    if (activeTab === "chat") return <ListPageSkeleton />;
    return <TablePageSkeleton />;
  }

  const overviewSeal = activeTab === "overview" || activeTab === "advisees" || activeTab === "consultations" || activeTab === "progress"
    ? getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc
    : undefined;
  const now = Date.now();
  const upcomingConsultations = activeTab === "overview"
    ? consultations
        .filter((session) => ["scheduled", "confirmed", "approved"].includes(String(session.status).toLowerCase()))
        .map((session) => ({
          session,
          startsAt: Date.parse(session.scheduledStart || `${session.date}T23:59:59+08:00`),
        }))
        .filter(({ startsAt }) => startsAt >= now)
        .sort((a, b) => a.startsAt - b.startsAt)
    : [];
  const nextConsultation = upcomingConsultations[0]?.session;
  const attentionUnavailable = requestsError || reviewQueueError;
  const attentionLoading = requestsLoading || reviewQueueLoading;
  const openOverviewSchedule = () => {
    setShowScheduleModal(true);
    handleTabChange("consultations");
  };
  const overviewWorkload = [
    {
      label: "Groups",
      value: adviserCapacity?.adviseeCount ?? (researchError ? null : advisees.length),
      suffix: adviserCapacity ? `of ${adviserCapacity.maxAdviseeGroups} slots` : "assigned",
      icon: "ti-users",
      tab: "advisees",
    },
    {
      label: "To review",
      value: reviewQueueError || reviewQueueLoading ? null : reviews.length,
      suffix: "pending",
      icon: "ti-file-text",
      tab: "reviews",
      loading: reviewQueueLoading,
    },
    { label: "Milestones", value: approvals.length, suffix: "for approval", icon: "ti-circle-check", tab: "approvals" },
    {
      label: "Consultations",
      value: consultationsError || consultationsLoading ? null : upcomingConsultations.length,
      suffix: "upcoming",
      icon: "ti-calendar-event",
      tab: "consultations",
      loading: consultationsLoading,
    },
  ];
  const submittedTime = (value?: string) => (value ? new Date(value).getTime() || 0 : 0);
  const reviewsOldestFirst = [...reviews].sort((a: any, b: any) => submittedTime(a.submittedAt) - submittedTime(b.submittedAt));
  const reviewsNewestFirst = [...reviewsOldestFirst].reverse();
  // The oldest waiting review gets the focus treatment unless a request or approval needs a decision first.
  const focusReview: any = pendingAdviserRequests.length === 0 && approvals.length === 0 ? reviewsOldestFirst[0] : null;
  const otherReviews = focusReview ? reviewsOldestFirst.slice(1, 3) : reviewsOldestFirst.slice(0, 2);
  const attentionCount = pendingAdviserRequests.length + approvals.length + reviews.length;
  const adviseesByPending = [...advisees].sort((a: any, b: any) => (b.pendingTasks || 0) - (a.pendingTasks || 0));
  const nextConsultationDate = nextConsultation ? overviewDateParts(nextConsultation.date) : null;
  const overviewSummary = [
    reviews.length ? `${reviews.length} ${reviews.length === 1 ? "review is" : "reviews are"} waiting` : null,
    pendingAdviserRequests.length ? `${pendingAdviserRequests.length} adviser ${pendingAdviserRequests.length === 1 ? "request" : "requests"}` : null,
    nextConsultation && nextConsultationDate ? `next consultation ${nextConsultationDate.month} ${nextConsultationDate.day}, ${nextConsultation.time}` : null,
  ].filter(Boolean).join(" · ") || "Your research groups, reviews, and consultations — all in one place.";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent font-sans text-slate-800">
      
      {toast && (
        <div className="fixed top-5 right-5 z-55 bg-[var(--color-primary)] border border-white/10 text-[var(--college-on-primary)] px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
        </div>
      )}

      {signingDocument && (
        <AdviserDocumentSigningModal
          document={signingDocument}
          onClose={() => setSigningDocument(null)}
          onSigned={async (message) => {
            setSigningDocument(null);
            triggerToast(message);
            await refetchReviewQueue();
          }}
        />
      )}

      {requestId && !requestDecision && (
        <div ref={requestDetailsRef} tabIndex={-1} onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); closeRequestDetails(); }
          if (event.key !== "Tab") return;
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="adviser-request-details-title">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-2xl [overflow-wrap:anywhere]">
            <div className="flex items-start justify-between gap-4">
              <h2 id="adviser-request-details-title" className="text-lg font-semibold text-[var(--color-text-primary)]">Adviser request details</h2>
              <button type="button" onClick={closeRequestDetails} aria-label="Close request details" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><i className="ti ti-x text-xl" /></button>
            </div>
            {requestsLoading ? <p className="mt-4" role="status">Loading request…</p> : requestsError ? (
              <div className="mt-4" role="alert"><p>Unable to load this request.</p><button type="button" onClick={() => void refetchAdviserRequests()} className="mt-3 font-bold text-[var(--color-text-primary)] underline">Try again</button></div>
            ) : !requestDetails ? <p className="mt-4">This request is no longer available.</p> : (
              <>
                <h3 className="mt-4 whitespace-pre-wrap text-xl font-bold text-[var(--color-text-primary)]">{requestDetails.research?.title || "Research group"}</h3>
                <p className="mt-2 text-sm text-slate-600">Status: {requestDetails.status}</p>
                <p className="mt-2 text-sm text-slate-600">Requested by {requestDetails.requestedBy ? `${requestDetails.requestedBy.firstName} ${requestDetails.requestedBy.lastName}` : "group representative"}</p>
                {requestDetails.createdAt && <p className="mt-1 text-sm text-slate-500">Submitted {new Date(requestDetails.createdAt).toLocaleString()}</p>}
                {requestDetails.research?.abstract && <div className="mt-5"><h4 className="font-bold text-[var(--color-text-primary)]">Research abstract</h4><p className="mt-2 whitespace-pre-wrap text-slate-600">{requestDetails.research.abstract}</p></div>}
                <div className="mt-5 rounded-xl bg-slate-50 p-4"><h4 className="font-bold text-[var(--color-text-primary)]">Group message</h4><p className="mt-2 whitespace-pre-wrap text-slate-600">{requestDetails.note || "No message was included."}</p></div>
                <div className="mt-5"><h4 className="font-bold text-[var(--color-text-primary)]">Group members</h4><ul className="mt-2 space-y-2 text-slate-600">{requestDetails.research?.members?.filter((member: any) => member.projectRole !== "ADVISER").map((member: any) => <li key={member.user.id}>{member.user.firstName} {member.user.lastName}{member.projectRole === "LEADER" ? " (Group leader)" : ""}</li>)}</ul></div>
                <div className="mt-5">
                  {requestDetails.requestFormDocument?.versions?.[0]?.storagePath ? <button type="button" onClick={() => openAuthenticatedFile(requestDetails.requestFormDocument.versions[0].storagePath).catch((error) => triggerToast(error.message))} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 font-bold text-[var(--color-text-primary)]"><i className="ti ti-file-type-pdf text-rose-600" />Open adviser request PDF</button> : <p className="text-sm text-slate-500">No adviser request PDF was attached.</p>}
                </div>
                {requestDetails.status === "PENDING" && <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => { setRequestDecision({ request: requestDetails, decision: "reject" }); setRequestResponseNote(""); }} className="rounded-lg border border-[var(--color-border)] px-4 py-2 font-bold text-slate-700">Reject</button>
                  <button type="button" data-guide="adviser-request-accept" disabled={adviserCapacity?.isFull} onClick={() => { setRequestDecision({ request: requestDetails, decision: "accept" }); setRequestResponseNote(""); }} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-60">Accept request</button>
                  {adviserCapacity?.isFull && <p className="w-full text-sm text-amber-800">Your adviser capacity is full or new requests are paused.</p>}
                </div>}
              </>
            )}
          </div>
        </div>
      )}

      {requestDecision && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="adviser-response-title">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-2xl [overflow-wrap:anywhere]">
            <div className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${requestDecision.decision === "accept" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}><i className={`ti ${requestDecision.decision === "accept" ? "ti-user-check" : "ti-user-x"}`} /></span>
              <div><h2 id="adviser-response-title" className="text-lg font-semibold text-[var(--color-text-primary)]">{requestDecision.decision === "accept" ? "Accept adviser request" : "Decline adviser request"}</h2><p className="mt-1 text-base text-slate-500">{requestDecision.request.research?.title || requestDecision.request.research?.groupName || "Research title not registered"}</p></div>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><span className="font-bold text-[var(--color-text-primary)]">Group message:</span><p className="mt-1 whitespace-pre-line">{requestDecision.request.note || "No message was included."}</p>{requestDecision.request.research?.members?.length > 0 && <p className="mt-3 text-base"><span className="font-bold text-[var(--color-text-primary)]">Members:</span> {requestDecision.request.research.members.filter((member: any) => member.projectRole !== "ADVISER").map((member: any) => `${member.user.firstName} ${member.user.lastName}`).join(", ")}</p>}{requestDecision.request.requestFormDocument?.versions?.[0]?.storagePath && <button type="button" onClick={() => openAuthenticatedFile(requestDecision.request.requestFormDocument.versions[0].storagePath).catch((error) => triggerToast(error.message))} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] ring-1 ring-slate-200 hover:ring-[#f6a800]"><i className="ti ti-file-type-pdf text-rose-600" />Open adviser request PDF</button>}</div>
            <label className="mt-5 block text-sm font-bold text-slate-700">Note to the group <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea value={requestResponseNote} onChange={(event) => setRequestResponseNote(event.target.value)} maxLength={1000} rows={4} placeholder={requestDecision.decision === "accept" ? "Share your expectations or next steps." : "Briefly explain your decision or suggest another direction."} className="mt-2 w-full resize-none rounded-xl border border-[var(--color-border)] p-3 text-base outline-none focus:border-[var(--color-primary)]" />
            {requestDecision.decision === "accept" && adviserCapacity?.isFull && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-base font-semibold text-amber-800">You cannot accept this group because your adviser capacity is full or requests are paused.</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => { setRequestDecision(null); setRequestResponseNote(""); }} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-bold text-slate-600">Cancel</button><button onClick={handleAdviserRequestResponse} disabled={isRespondingToRequest || (requestDecision.decision === "accept" && adviserCapacity?.isFull)} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${requestDecision.decision === "accept" ? "bg-emerald-600" : "bg-rose-600"}`}>{isRespondingToRequest ? "Saving…" : requestDecision.decision === "accept" ? "Accept request" : "Decline request"}</button></div>
          </div>
        </div>
      )}

      {selectedAdvisee && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="advisee-group-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">Assigned research group</span><h2 id="advisee-group-title" className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{selectedAdvisee.projectTitle}</h2><p className="mt-1 text-base text-slate-500">Representative: {selectedAdvisee.leader}</p></div>
              <button type="button" onClick={closeAdviseeModal} aria-label="Close group details" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[var(--color-text-primary)] hover:bg-slate-200"><i className="ti ti-x text-xl" /></button>
            </div>

            {!showWithdrawalForm ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-base text-slate-500">Project status</p><p className="mt-1 font-bold capitalize text-[var(--color-text-primary)]">{selectedAdvisee.status.replace(/_/g, " ")}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-base text-slate-500">Current milestone</p><p className="mt-1 font-bold text-[var(--color-text-primary)]">{selectedAdvisee.currentStage}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-base text-slate-500">Overall progress</p><p className="mt-1 font-bold text-[var(--color-text-primary)]">{selectedAdvisee.progress}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#173f63] to-[#f6a800]" style={{ width: `${selectedAdvisee.progress}%` }} /></div></div></div>

                <section className="mt-5"><h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Study abstract</h3><p className="mt-2 whitespace-pre-wrap rounded-xl border border-[var(--color-border)] bg-slate-50 p-4 text-base leading-6 text-slate-600">{selectedAdvisee.abstract}</p></section>

                <section className="mt-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Group members</h3><span className="text-xs font-semibold text-slate-400">{selectedAdvisee.members.length} students</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2">{selectedAdvisee.members.map((member: any) => <div key={member.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-[var(--college-on-primary)]">{`${member.user?.firstName?.[0] || "S"}${member.user?.lastName?.[0] || ""}`}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{member.user?.firstName} {member.user?.lastName}</p><p className="truncate text-sm text-slate-500">{member.projectRole === "LEADER" ? "Group representative" : "Researcher"} · {member.user?.email}</p></div></div>)}</div></section>

                <section className="mt-5"><h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Milestone requirements</h3><div className="mt-2 space-y-2">{selectedAdvisee.tasks.length ? selectedAdvisee.tasks.slice(0, 5).map((task: any) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{task.title}</p><p className="text-base text-slate-500">{task.stageName}</p></div><Tag variant={task.submission?.status === "APPROVED" ? "success" : task.submission ? "warn" : "neutral"}>{task.submission?.status?.replace(/_/g, " ") || "Not submitted"}</Tag></div>) : <p className="rounded-xl bg-slate-50 p-4 text-base text-slate-500">No milestone requirements have been configured.</p>}</div></section>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5"><p className="text-base text-slate-400">Adviser since {selectedAdvisee.adviserSince ? new Date(selectedAdvisee.adviserSince).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "assignment date unavailable"}</p><div className="flex gap-2"><button type="button" onClick={() => { closeAdviseeModal(); handleTabChange("group-chats"); }} className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-primary)] hover:bg-slate-50"><i className="ti ti-message mr-1.5" />Message group</button><button type="button" onClick={() => setShowWithdrawalForm(true)} className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100"><i className="ti ti-logout mr-1.5" />Leave as adviser</button></div></div>
              </>
            ) : (
              <div className="mt-5">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><i className="ti ti-alert-triangle mt-0.5 text-xl text-amber-700" /><div><p className="font-semibold text-amber-900">This group will become unassigned</p><p className="mt-1 text-base leading-5 text-amber-800">Students may be unable to complete adviser-dependent milestones until another adviser accepts them. Future scheduled consultations will be cancelled, while your previous reviews, comments, and records will remain attributed to you.</p></div></div></div>
                <div className="mt-5"><label className="text-sm font-bold text-slate-700">Reason for leaving <span className="text-rose-600">*</span></label><select value={withdrawalReason} onChange={(event) => setWithdrawalReason(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white p-3 text-base outline-none focus:border-[var(--color-primary)]"><option value="">Select a reason</option><option value="GROUP_REQUESTED_CHANGE">Group requested a different adviser</option><option value="OUTSIDE_EXPERTISE">Research is outside my expertise</option><option value="WORKLOAD_AVAILABILITY">Workload or availability</option><option value="GROUP_INACTIVE">Group became inactive</option><option value="PROJECT_DISCONTINUED">Project rejected or discontinued</option><option value="STUDENT_WITHDREW">Student withdrew from the course</option><option value="OTHER">Other</option></select></div>
                <div className="mt-4"><label className="text-sm font-bold text-slate-700">Note to students and coordinator <span className="text-rose-600">*</span></label><textarea value={withdrawalNote} onChange={(event) => setWithdrawalNote(event.target.value)} maxLength={1500} rows={6} placeholder="Explain the decision and provide any recommended next steps. Minimum 10 characters." className="mt-2 w-full resize-none rounded-xl border border-[var(--color-border)] p-3 text-base leading-6 outline-none focus:border-[var(--color-primary)]" /><div className="mt-1 flex justify-between text-xs text-slate-400"><span>{withdrawalNote.trim().length < 10 ? `${10 - withdrawalNote.trim().length} more characters required` : "Ready to submit"}</span><span>{withdrawalNote.length}/1500</span></div></div>
                <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => { setShowWithdrawalForm(false); setWithdrawalReason(""); setWithdrawalNote(""); }} className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-slate-600">Back</button><button type="button" onClick={handleWithdrawFromGroup} disabled={isWithdrawing || !withdrawalReason || withdrawalNote.trim().length < 10} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isWithdrawing ? <><i className="ti ti-loader-2 animate-spin" />Withdrawing…</> : <><i className="ti ti-user-minus" />Confirm withdrawal</>}</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className={`workspace-page adviser-dashboard-container flex w-full flex-1 flex-col space-y-6 ${["group-chats", "chat"].includes(activeTab) ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8"}`}>
        
        {(() => {
          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <div className="adviser-overview mx-auto flex w-full max-w-[1360px] flex-col gap-6">
                <section className="adviser-overview__hero" aria-labelledby="adviser-home-title">
                  {overviewSeal && (
                    <img className="adviser-overview__seal" src={overviewSeal} alt="" aria-hidden="true" draggable={false} />
                  )}
                  <header className="adviser-overview__hero-heading">
                    <div>
                      <p className="adviser-overview__eyebrow">Adviser workspace</p>
                      <h1 id="adviser-home-title">Good day, {user?.firstName?.trim() || "Adviser"}</h1>
                      <p>{overviewSummary}</p>
                    </div>
                    <section className="adviser-overview__workload" aria-label="Adviser workload snapshot">
                      {overviewWorkload.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => handleTabChange(item.tab)}
                          className="adviser-overview__workload-item"
                          data-workload={item.tab}
                          data-waiting={item.tab === "reviews" && Boolean(item.value) ? "true" : undefined}
                          title={item.value === null ? (item.loading ? "Loading" : "Unavailable") : `${item.value} ${item.suffix}`}
                        >
                          <span className="adviser-overview__metric-value">{item.value ?? "—"}</span>
                          <span className="adviser-overview__metric-label">{item.label}</span>
                        </button>
                      ))}
                    </section>
                  </header>

                  <div className="adviser-overview__hero-actions">
                    <button type="button" onClick={() => handleTabChange("reviews")} className="adviser-overview__hero-primary">
                      <i className="ti ti-file-search" aria-hidden="true" /> Review documents
                    </button>
                    <button type="button" onClick={openOverviewSchedule} className="adviser-overview__hero-secondary">
                      <i className="ti ti-calendar-plus" aria-hidden="true" /> Schedule consultation
                    </button>
                    <button type="button" onClick={() => handleTabChange("group-chats")} className="adviser-overview__hero-secondary">
                      <i className="ti ti-messages" aria-hidden="true" /> Message groups
                    </button>
                    <button type="button" onClick={() => handleTabChange("progress")} className="adviser-overview__hero-secondary">
                      <i className="ti ti-chart-line" aria-hidden="true" /> Track progress
                    </button>
                  </div>
                </section>

                {/* Attention & Consultation Section */}
                <section className="adviser-overview__split adviser-overview__priorities" aria-label="Your next steps">
                  <div className="adviser-overview__panel adviser-overview__attention" data-focus={attentionCount > 0 ? "true" : undefined}>
                    <div className="adviser-overview__section-heading">
                      <div>
                        <h2 data-guide={!requestsLoading && !requestsError ? "adviser-attention" : undefined} data-guide-empty={pendingAdviserRequests.length === 0}
                          className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]">
                          Needs your attention{" "}
                          {attentionCount > 0 && <span className="adviser-overview__count">{attentionCount}</span>}
                        </h2>
                      </div>
                      <button
                        onClick={() => handleTabChange("approvals")}
                        className="adviser-overview__section-link"
                      >
                        View all <i aria-hidden="true" className="ti ti-chevron-right text-xs" />
                      </button>
                    </div>

                    {pendingAdviserRequests.length > 0 || approvals.length > 0 || reviews.length > 0 ? (
                      <div className="space-y-2.5">
                        {pendingAdviserRequests.map((request: any) => (
                          <div
                            key={request.id}
                            className="adviser-overview__request"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <span className="adviser-overview__task-icon">
                                  <i aria-hidden="true" className="ti ti-user-plus" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                    {request.research?.title || "Research group"}
                                  </p>
                                  <p className="mt-0.5 text-base text-slate-500 dark:text-slate-400">
                                    Requested by {request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : "group representative"}
                                  </p>
                                  {request.note && (
                                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300 italic">
                                      “{request.note}”
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="adviser-overview__request-label">
                                Adviser Request
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <button type="button" data-guide="adviser-request-open" onClick={() => { const params = new URLSearchParams(searchParams.toString()); params.set("requestId", request.id); router.push(`/adviser/dashboard?${params}`); }} className="mr-auto rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-bold text-[var(--color-text-primary)] dark:text-slate-200">View full request</button>
                              <button
                                onClick={() => {
                                  setRequestDecision({ request, decision: "reject" });
                                  setRequestResponseNote("");
                                }}
                                className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-600 dark:bg-white/5 dark:text-slate-300"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => {
                                  setRequestDecision({ request, decision: "accept" });
                                  setRequestResponseNote("");
                                }}
                                disabled={adviserCapacity?.isFull}
                                title={adviserCapacity?.isFull ? "Capacity reached or new requests are paused" : undefined}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        ))}

                        {approvals.slice(0, 2).map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-slate-50/70 p-3 dark:border-white/5 dark:bg-white/5"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C9A227]/20 text-[#8A6A0B] dark:text-[#C9A227]">
                                <i aria-hidden="true" className="ti ti-flag" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{a.groupName}</p>
                                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{a.milestone}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleApproveMilestone(a.id, a.groupName)}
                              className="ml-3 rounded-lg bg-[var(--color-primary)] hover:bg-[#072A3D] px-3 py-1.5 text-sm font-bold text-[var(--college-on-primary)] shadow-xs"
                            >
                              Review
                            </button>
                          </div>
                        ))}

                        {focusReview && (
                          <div className="adviser-overview__focus-task">
                            <p className="adviser-overview__focus-title">{focusReview.docName || "Document review"}</p>
                            <p className="adviser-overview__task-meta">
                              <span>{focusReview.groupName}</span>
                              <OverviewSubmissionAge label={getWaitingLabel(focusReview.submittedAt)} />
                            </p>
                            <button type="button" onClick={() => openAssignedReview(focusReview)} className="adviser-overview__start">
                              <i className="ti ti-file-search" aria-hidden="true" /> Start review
                            </button>
                          </div>
                        )}

                        {otherReviews.map((review: any) => (
                          <button
                            key={review.id}
                            onClick={() => openAssignedReview(review)}
                            className="adviser-overview__review-task"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="adviser-overview__task-icon" aria-hidden="true">
                                <i aria-hidden="true" className="ti ti-file-text" />
                              </span>
                              <span className="min-w-0">
                                <span className="adviser-overview__task-title">
                                  {review.docName || "Document review"}
                                </span>
                                <span className="adviser-overview__task-meta">
                                  <span>{review.groupName}</span>
                                  <OverviewSubmissionAge label={getWaitingLabel(review.submittedAt)} />
                                </span>
                              </span>
                            </span>
                            <span className="adviser-overview__task-action">Review <i className="ti ti-chevron-right" aria-hidden="true" /></span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="adviser-overview__empty" role="status">
                        <span className="adviser-overview__empty-icon">
                          <i aria-hidden="true" className={attentionUnavailable ? "ti ti-alert-circle" : attentionLoading ? "ti ti-clock" : "ti ti-circle-check"} />
                        </span>
                        <h3>{attentionUnavailable ? "Some items couldn’t load" : attentionLoading ? "Checking for new work…" : "You’re all caught up"}</h3>
                        <p>{attentionUnavailable ? "Open the relevant queue to check for new work." : !attentionLoading ? "New reviews, requests, and approvals will appear here." : null}</p>
                      </div>
                    )}
                  </div>

                  <div className="adviser-overview__panel adviser-overview__consultation">
                    <div className="adviser-overview__section-heading">
                      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Next consultation</h2>
                      <button
                        onClick={() => handleTabChange("consultations")}
                        className="adviser-overview__section-link"
                        aria-label="View all consultations"
                      >
                        <span>View all</span>
                        <i aria-hidden="true" className="ti ti-chevron-right" />
                      </button>
                    </div>
                    {nextConsultation ? (
                      <div className="adviser-overview__session">
                        <div className="adviser-overview__session-row">
                          <DateTile
                            top={nextConsultationDate?.month}
                            bottom={nextConsultationDate?.day}
                            label={formatOverviewDate(nextConsultation.date)}
                          />
                          <div className="min-w-0">
                            <h3>{nextConsultation.topic}</h3>
                            <p className="adviser-overview__session-group">{nextConsultation.time} · {nextConsultation.groupName}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartConference(nextConsultation.meetingUrl || DEFAULT_SHARED_MEET_URL, nextConsultation.topic, nextConsultation.researchId)}
                          className="adviser-overview__join"
                        >
                          <i aria-hidden="true" className="ti ti-video" /> Join Google Meet
                        </button>
                      </div>
                    ) : (
                      <div className="adviser-overview__empty">
                        <span className="adviser-overview__empty-icon">
                          <i aria-hidden="true" className="ti ti-calendar-time text-lg" />
                        </span>
                        <div role="status">
                          <h3>{consultationsError ? "Consultations couldn’t load" : consultationsLoading ? "Loading consultations…" : "No upcoming consultations"}</h3>
                        </div>
                        {consultationsError ? (
                          <button type="button" onClick={() => void refetchConsultations()} className="adviser-overview__empty-action">Try again</button>
                        ) : !consultationsLoading && (
                          <button type="button" onClick={openOverviewSchedule} className="adviser-overview__empty-action">Schedule one</button>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Active Advisee Groups - Google Classroom Cards Grid */}
                <section className="adviser-overview__panel adviser-overview__groups" aria-labelledby="adviser-groups-title">
                  <div className="adviser-overview__section-heading">
                    <div>
                      <h2 id="adviser-groups-title" className="text-lg font-bold text-[var(--color-text-primary)]">
                        Advisee research
                      </h2>
                      <p className="text-base text-slate-500 dark:text-slate-400">
                        {advisees.length > 3 ? `Showing 3 of ${advisees.length} · most pending first` : "Research teams assigned under your guidance."}
                      </p>
                    </div>
                    <button
                      onClick={() => handleTabChange("advisees")}
                      className="adviser-overview__section-link"
                    >
                        All groups <i aria-hidden="true" className="ti ti-chevron-right text-xs" />
                    </button>
                  </div>

                  {advisees.length > 0 ? (
                    <div className="adviser-overview__research-grid">
                      {adviseesByPending.slice(0, 3).map((adv: any) => (
                        <AdviserResearchGroupCard
                          className="adviser-overview__research-card"
                          key={adv.id}
                          title={adv.projectTitle || "Research Study"}
                          groupName={adv.groupName}
                          status={adv.status}
                          currentStage={adv.currentStage}
                          progress={adv.progress}
                          memberCount={adv.members.length}
                          pendingTasks={adv.pendingTasks}
                          leader={adv.leader}
                          href={`/adviser/advisees/${adv.id}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="adviser-overview__empty">
                      <div className="adviser-overview__empty-icon">
                        <i aria-hidden="true" className="ti ti-users" />
                      </div>
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                        {researchError ? "Assigned groups couldn’t load" : "No assigned research groups"}
                      </h3>
                      <p className="mt-1 max-w-md text-base text-slate-500 dark:text-slate-400">
                        {researchError ? "Try loading your assigned groups again." : "Research groups appear here after you accept their adviser requests."}
                      </p>
                      {researchError && <button type="button" onClick={() => void refetchResearch()} className="adviser-overview__empty-action">Try again</button>}
                    </div>
                  )}
                </section>

                {/* Recent Activity */}
                <section aria-label="Recent advisee activity">
                  <article className="adviser-overview__panel adviser-overview__activity">
                    <div className="adviser-overview__section-heading">
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Recent Advisee Activity</h2>
                        <p>Latest submissions and scheduled advising sessions.</p>
                      </div>
                      <button onClick={() => handleTabChange("reviews")} className="adviser-overview__section-link">
                        View reviews <i aria-hidden="true" className="ti ti-chevron-right" />
                      </button>
                    </div>
                    <div className="adviser-overview__feed">
                      {reviewsNewestFirst.slice(0, 3).map((review: any) => (
                        <button key={review.id} onClick={() => openAssignedReview(review)} className="adviser-overview__feed-item">
                          <span className="adviser-overview__task-icon" aria-hidden="true"><i className="ti ti-file-text" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="adviser-overview__feed-title">{review.docName || "Document submission"}</span>
                            <span className="adviser-overview__feed-group">
                              {review.groupName} · <time dateTime={review.submittedAt}>{getWaitingLabel(review.submittedAt)}</time>
                            </span>
                          </span>
                          <StatusDot tone="waiting">Needs review</StatusDot>
                        </button>
                      ))}
                      {upcomingConsultations.slice(0, 2).map(({ session: consultation }: any) => (
                        <button key={consultation.id} onClick={() => handleTabChange("consultations")} className="adviser-overview__feed-item">
                          <span className="adviser-overview__task-icon" aria-hidden="true"><i className="ti ti-calendar-time" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="adviser-overview__feed-title">{consultation.topic}</span>
                            <span className="adviser-overview__feed-group">
                              {consultation.groupName} · <time dateTime={consultation.date}>{formatOverviewDate(consultation.date)}</time>
                            </span>
                          </span>
                          <StatusDot tone="brand">Upcoming</StatusDot>
                        </button>
                      ))}
                      {reviews.length === 0 && upcomingConsultations.length === 0 && (
                        <div className="adviser-overview__empty">
                          <span className="adviser-overview__empty-icon"><i aria-hidden="true" className="ti ti-activity" /></span>
                          <h3>{reviewQueueError || consultationsError ? "Recent activity couldn’t load" : reviewQueueLoading || consultationsLoading ? "Loading recent activity…" : "No recent advisee activity"}</h3>
                          {!reviewQueueError && !consultationsError && !reviewQueueLoading && !consultationsLoading && <p>New reviews and consultations will appear here.</p>}
                        </div>
                      )}
                    </div>
                  </article>
                </section>
              </div>
            ),
            advisees: (
              <AdviserAdviseesWorkspace
                advisees={advisees}
                loading={researchLoading}
                countsLoading={milestoneProgressLoading}
                error={Boolean(researchError)}
                onRetry={() => void refetchResearch()}
                capacity={adviserCapacity}
                seal={overviewSeal}
                onNavigate={handleTabChange}
              />
            ),
            reviews: (
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">Research Document Review & Commenting</h3>
                <p className="text-base text-slate-400 font-bold">Review draft submissions, download version history, and submit comments.</p>
                {reviews.length > 0 ? (
                  reviews.map(rev => (
                    <div key={rev.id} className="p-4 bg-slate-50 border border-[var(--color-border)] rounded-xl flex flex-col gap-3 text-[12.5px] shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                        <div>
                          <span className="font-bold text-[var(--color-text-primary)] block">{rev.docName}</span>
                          <span className="text-xs text-slate-400">{rev.groupName} · {rev.milestone} · {getWaitingLabel(rev.submittedAt)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => rev.fileUrl ? openAuthenticatedFile(rev.fileUrl).catch((error) => triggerToast(error.message)) : triggerToast("No document preview is available.")} className="text-[#ffa400] font-bold hover:underline cursor-pointer">Open document</button>
                          {rev.mimeType === "application/pdf" && !rev.signed && <button onClick={() => setSigningDocument(rev)} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-[var(--college-on-primary)]"><i className="ti ti-signature mr-1" />Add signature</button>}
                          {rev.signed && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Signed</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="font-bold text-slate-600 text-sm">Submit Review Comments</label>
                        <textarea 
                          value={commentInput} 
                          onChange={(e)=>setCommentInput(e.target.value)} 
                          placeholder="Provide detailed feedback comments..." 
                          className="bg-white border border-slate-350 rounded-lg p-2.5 text-base focus:outline-none"
                        />
                        <button onClick={()=>handleReviewComment(rev.id)} className="submission-action px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold rounded-lg border border-[var(--color-primary)] self-start mt-2 transition">
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
              <>
                <AdviserConsultationsWorkspace
                  consultations={consultations}
                  loading={consultationsLoading}
                  error={Boolean(consultationsError)}
                  onRetry={() => void refetchConsultations()}
                  seal={overviewSeal}
                  onSchedule={() => setShowScheduleModal(true)}
                  onApprove={(item) => handleApproveConsultation(item.id, item.topic)}
                  onJoin={(item) => handleStartConference(item.meetingUrl || DEFAULT_SHARED_MEET_URL, item.topic, item.researchId)}
                  onCopy={(url) => {
                    void navigator.clipboard.writeText(url);
                    triggerToast("Copied Google Meet link to clipboard!");
                  }}
                />

                {/* SCHEDULE MODAL */}
                {showScheduleModal && (
                  <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="adviser-consultation-form-title">
                    <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-2xl p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto flex flex-col gap-4 animate-fade-in-up">
                      <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <i className="ti ti-video text-base" />
                          </div>
                          <div>
                            <h4 id="adviser-consultation-form-title" className="font-bold text-lg text-slate-900">New Google Meet Consultation</h4>
                            <span className="text-xs text-slate-400">Generate real calendar video conference</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowScheduleModal(false)}
                          aria-label="Close scheduling form"
                          className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                        >
                          <i className="ti ti-x text-base" />
                        </button>
                      </div>

                      <form onSubmit={handleScheduleConsultation} className="flex flex-col gap-3 text-[12px]">
                        <div className="flex flex-col gap-1">
                          <label className="font-bold text-slate-700">Advisee Group / Research Project</label>
                          <select
                            data-guide="adviser-consultation-group"
                            data-guide-empty={advisees.length === 0}
                            value={consultGroupId}
                            onChange={(e) => setConsultGroupId(e.target.value)}
                            className="bg-slate-50 border border-[var(--color-border)] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
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
                            data-guide="adviser-consultation-topic"
                            value={consultTopic}
                            onChange={(e) => setConsultTopic(e.target.value)}
                            placeholder="e.g. Chapter 3 Methodology & Analysis Discussion"
                            className="bg-slate-50 border border-[var(--color-border)] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-slate-700">Date</label>
                            <input
                              type="date"
                              required
                              data-guide="adviser-consultation-date"
                              value={consultDate}
                              onChange={(e) => setConsultDate(e.target.value)}
                              className="bg-slate-50 border border-[var(--color-border)] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="font-bold text-slate-700">Time</label>
                            <input
                              type="time"
                              required
                              data-guide="adviser-consultation-time"
                              value={consultTime}
                              onChange={(e) => setConsultTime(e.target.value)}
                              className="bg-slate-50 border border-[var(--color-border)] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264]"
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
                            className="bg-slate-50 border border-[var(--color-border)] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#1b4264] text-base"
                          />
                          <span className="text-xs text-slate-400">Default creates an instant live Google Meet video room automatically.</span>
                        </div>

                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                          <button
                            type="button"
                            onClick={() => setShowScheduleModal(false)}
                            className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isScheduling}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--college-on-primary)] font-bold rounded-lg cursor-pointer shadow-sm disabled:opacity-50"
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
              </>
            ),
            progress: (
              <AdviserProgressWorkspace
                advisees={advisees}
                loading={researchLoading}
                countsLoading={milestoneProgressLoading}
                error={Boolean(researchError)}
                onRetry={() => void refetchResearch()}
                seal={overviewSeal}
                onNavigate={handleTabChange}
              />
            ),
            approvals: (
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-6 flex flex-col gap-4">
                <h3 data-guide="adviser-milestone-queue" className="font-semibold text-[var(--color-text-primary)] text-lg">Milestone Approval & Recommendation</h3>
                <p className="text-base text-slate-400 font-bold">Approve core outline thresholds and issue recommendations for oral review panels.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {approvals.map(a => (
                    <div key={a.id} className="p-4 bg-slate-50 border border-[var(--color-border)] rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[var(--color-text-primary)] block">{a.groupName}</span>
                        <span className="text-xs text-slate-450">Target Milestone: {a.milestone}</span>
                      </div>
                      <button onClick={()=>handleApproveMilestone(a.id, a.groupName)} className="px-3.5 py-1.5 bg-[#ffa400] text-[#102f49] font-semibold text-sm rounded border border-[#ffa400] cursor-pointer">
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
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-6 flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                  <div>
                    <h3 data-guide="adviser-consultation-history" className="font-semibold text-[var(--color-text-primary)] text-lg">Consultation History & Transcript Archive</h3>
                    <p className="text-base text-slate-400 font-bold">Access historical meeting schedules, advising minutes, and Google Meet chat records.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-[var(--color-border)]">
                      <strong>{consultations.length}</strong> Total Sessions
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {consultations.map((c) => (
                    <div
                      key={c.id}
                      className="bg-slate-50 p-5 border border-[var(--color-border)] rounded-xl shadow-sm flex flex-col gap-3 hover:border-[#1b4264] transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[var(--color-text-primary)] text-[14px]">{c.topic}</span>
                            <Tag variant={c.status === "pending" || c.status === "requested" ? "warn" : "success"}>
                              {c.status === "pending" || c.status === "requested" ? "Pending Approval" : "Confirmed"}
                            </Tag>
                          </div>
                          <span className="text-xs text-slate-500 font-medium block mt-0.5">
                            {c.groupName} · {c.date} at {c.time} ({c.mode})
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenTranscriptModal(c)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-[var(--color-text-primary)] font-bold rounded-lg border border-[var(--color-border)] text-sm shadow-sm cursor-pointer self-start sm:self-auto transition"
                        >
                          <i className="ti ti-file-text text-amber-500" />
                          <span>{c.notes || (c.transcript && c.transcript.length > 0) ? "View / Edit Transcript & Notes" : "Import Google Meet Chat"}</span>
                        </button>
                      </div>

                      {/* Adviser Notes & Recommendations preview */}
                      {c.notes && (
                        <div className="bg-white p-3.5 rounded-lg border border-[var(--color-border)] text-xs flex flex-col gap-1">
                          <span className="font-bold text-[var(--color-text-primary)] flex items-center gap-1">
                            <i className="ti ti-notes" />
                            <span>Meeting Summary & Adviser Feedback:</span>
                          </span>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{c.notes}</p>
                        </div>
                      )}

                      {/* Action items preview */}
                      {c.actionItems && c.actionItems.length > 0 && (
                        <div className="bg-white p-3.5 rounded-lg border border-[var(--color-border)] text-xs flex flex-col gap-1.5">
                          <span className="font-bold text-[var(--color-text-primary)] flex items-center gap-1">
                            <i className="ti ti-checklist text-emerald-600" />
                            <span>Agreed Action Items ({c.actionItems.length}):</span>
                          </span>
                          <ul className="list-disc list-inside text-slate-700 space-y-1 pl-1">
                            {c.actionItems.map((item, idx) => (
                              <li key={idx} className="text-xs">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* In-call Google Meet chat transcript preview */}
                      {c.transcript && c.transcript.length > 0 && (
                        <div className="bg-white p-3.5 rounded-lg border border-[var(--color-border)] text-xs flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-1.5">
                            <span className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                              <i className="ti ti-messages text-blue-600" />
                              <span>Google Meet In-Call Messages ({c.transcript.length})</span>
                            </span>
                            <span className="text-xs text-slate-400 font-mono">Auto-Indexed</span>
                          </div>
                          <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
                            {c.transcript.map((msg) => (
                              <div key={msg.id} className="p-2 bg-slate-50 rounded border border-[var(--color-border)] text-xs">
                                <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
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
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">In-App Voice and Video Group Conferencing</h3>
                <p className="text-base text-slate-400 font-bold">Initiate peer study room conferences or sync appointments with advisees.</p>
                
                {!isMeetingActive ? (
                  <div className="bg-slate-50 p-6 border border-[var(--color-border)] rounded-xl text-center flex flex-col gap-4 shadow-sm">
                    <div className="w-16 h-16 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mx-auto text-[var(--college-on-primary)]">
                      <i className="ti ti-video text-3xl animate-pulse" />
                    </div>
                    <div>
                      <span className="font-bold text-[var(--color-text-primary)] text-[14px] block">Live Stream Channels Ready</span>
                      <span className="text-xs text-slate-400">Join consultation call with your assigned advisee groups</span>
                    </div>
                    <button 
                      onClick={() => handleStartConference("https://meet.google.com/new", "In-App Voice and Video Group Conferencing", advisees[0]?.id)}
                      className="px-5 py-2.5 bg-[#ffa400] text-[#102f49] hover:bg-[#e09000] font-semibold rounded-lg shadow border border-[#ffa400] self-center cursor-pointer transition-colors flex items-center gap-2"
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
                      <span className="font-semibold text-emerald-800 text-[15px] uppercase tracking-wider">Meeting in Progress</span>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Call Duration</span>
                      <span className="font-mono text-3xl font-semibold text-[var(--color-text-primary)] tracking-tight">{formatMeetingTime(meetingDuration)}</span>
                      <span className="text-xs text-slate-500 mt-1">Google Meet session is running in floating window</span>
                    </div>

                    {/* LIVE ATTENDEES LIST */}
                    <div className="bg-white/80 border border-emerald-200/80 rounded-xl p-3.5 max-w-lg mx-auto w-full text-left shadow-sm">
                      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                        <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                          <i className="ti ti-users text-emerald-600" />
                          <span>Connected Attendees ({activeParticipants.length})</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live Sync
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {activeParticipants.map((p) => (
                          <div key={p.id} className="flex flex-col gap-1.5 rounded-lg p-1.5 text-xs transition hover:bg-emerald-50/50 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-[var(--college-on-primary)] text-xs font-semibold flex items-center justify-center">
                                {p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block leading-tight">{p.name}</span>
                                <span className="break-all text-xs text-slate-500 sm:break-normal">{p.role} · {p.email}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {p.joinedAt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                      <button
                        onClick={handleReopenMeetingWindow}
                        aria-label="Reopen meeting window"
                        className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-bold text-[var(--color-text-primary)] shadow-sm transition hover:bg-[var(--color-surface-muted)]"
                      >
                        <i className="ti ti-external-link" />
                        <span className="hidden sm:inline">Reopen Meeting Window</span>
                      </button>

                      <button
                        onClick={() => handleEndConference()}
                        className="flex min-h-11 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-bold text-white shadow transition hover:bg-rose-700"
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
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">Defense Schedule Viewing</h3>
                <p className="text-base text-slate-400 font-bold">Review defense panel timings, assignees, and digital venues.</p>
                <div className="p-4 bg-slate-50 border border-[var(--color-border)] rounded-xl text-[12.5px] flex flex-col gap-2 mt-2 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[var(--color-text-primary)] text-[14px]">AI Crop Yield Prediction System ML</span>
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
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">Portal Settings</h3>
                <p className="text-base text-slate-400 font-bold">Manage your notification channels, authentication credentials, and user preferences.</p>
                <div className="bg-slate-50 p-4 border border-[var(--color-border)] rounded-xl text-[12.5px] mt-2 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
                    <div>
                      <span className="font-bold text-[var(--color-text-primary)] block">Email Notifications</span>
                      <span className="text-xs text-slate-400">Receive system notifications via email address.</span>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-[#ffa400] w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[var(--color-text-primary)] block">Dark Mode</span>
                      <span className="text-xs text-slate-400">Switch platform styling theme to night vision.</span>
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

      </div>

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
    <Suspense fallback={<DashboardSkeleton />}>
      <AdviserDashboardContent />
    </Suspense>
  );
}
