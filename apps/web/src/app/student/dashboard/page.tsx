import { WorkflowAccessInbox } from "@/components/workflow/WorkflowAccessInbox";
import React, { useState, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { calculateMilestoneProgress } from "@/lib/workflow-progress";
import { formatMilestoneTarget } from "@/lib/workflow-deadlines";
import { Tag } from "@/components/ui/Tag";
import { CourseCard } from "@/components/ui/CourseCard";
import { StatCard } from "@/components/ui/StatCard";
import { DashboardWelcome } from "@/components/ui/DashboardWelcome";
import { CardsPageSkeleton, DashboardSkeleton, FilesPageSkeleton, ListPageSkeleton, TablePageSkeleton } from "@/components/ui/Skeleton";
import { StudentProjectOverview } from "@/components/dashboards/student/StudentProjectOverview";
import { projectSectionHref, type ProjectAction } from "@/lib/student-project-overview";
import { studentTaskDetailsHref } from "@/lib/student-task-navigation";
import { StudentGroupChats } from "@/components/dashboards/student/StudentGroupChats";
import { getStoredMeetingSession, saveMeetingSession, DEFAULT_SHARED_MEET_URL } from "@/lib/meeting-store";
import { GoogleMeetConnectModal } from "@/components/consultations/GoogleMeetConnectModal";
import { GoogleMeetTranscriptModal, ParsedChatMessage } from "@/components/consultations/GoogleMeetTranscriptModal";
import {
  getPendingConsultationImports,
  recordConsultationImportReceipts,
  type ConsultationItem,
} from "@/lib/consultation-store";
import { ProductTour, TourStep } from "@/components/shared/ProductTour";
import { StudentGanttChart } from "@/components/dashboards/student/StudentGanttChart";
import { getOrderedWorkflowStages } from "@/lib/workflow-progress";
import { useNotifications as useStudentNotifications } from "@/hooks/use-student";
import { useActiveProject } from "@/providers/active-project-provider";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "overview";
  const activeTab = requestedTab === "my-group" ? "group" : requestedTab;
  const projectSection = requestedTab === "my-group" || searchParams.get("section") === "my-group" ? "my-group" : "overview";
  useEffect(() => {
    if (requestedTab !== "my-group") return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", "group");
    params.set("section", "my-group");
    router.replace(`/student/dashboard?${params}`);
  }, [requestedTab, searchParams, router]);
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: apiNotifications = [] } = useStudentNotifications();
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Auto-redirect if tab is workspace or documents to the modern /student/documents workspace
  useEffect(() => {
    if (activeTab === "workspace" || activeTab === "documents") {
      const milestoneId = searchParams.get("milestoneId");
      const taskId = searchParams.get("taskId");
      const params = new URLSearchParams();
      const projectId = searchParams.get("projectId");
      if (projectId) params.set("projectId", projectId);
      if (milestoneId) params.set("milestoneId", milestoneId);
      if (taskId) params.set("taskId", taskId);
      const queryStr = params.toString();
      router.replace(`/student/documents${queryStr ? `?${queryStr}` : ""}`);
    }
  }, [activeTab, searchParams, router]);

  // Project Registration State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createAbstract, setCreateAbstract] = useState("");
  const [createParticipationMode, setCreateParticipationMode] = useState<
    "SOLO" | "GROUP"
  >("SOLO");
  const [createGroupName, setCreateGroupName] = useState("");
  const [createAccessMode, setCreateAccessMode] = useState<
    "INVITE_ONLY" | "PUBLIC_APPROVAL" | "PUBLIC_OPEN"
  >("INVITE_ONLY");
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
      if (activeProject?.id)
        await apiClient.post("/api/consultations/active-stream/end", { groupId: activeProject.id });
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
  const { data: researchData, isLoading: isResearchLoading, isError: isResearchError, refetch: refetchResearch } = useQuery({
    queryKey: ["student-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research"),
    staleTime: 5000,
    refetchInterval: 5000,
  });
  const { data: workspaceData, isLoading: isWorkspaceLoading } = useQuery({
    queryKey: ["student-workspaces"],
    queryFn: () => apiClient.get<{ workspaces: any[] }>("/api/workspaces/me"),
    refetchOnWindowFocus: true,
  });
  const activeWorkspace = workspaceData?.workspaces?.[0] || null;
  const isWorkspaceLeader = activeWorkspace?.members?.some((member: any) => member.userId === user?.id && member.role === "LEADER" && !member.leftAt) ?? false;
  const canCreateResearch = !isWorkspaceLoading && !isResearchLoading && !isResearchError && !!workspaceData && (!activeWorkspace || isWorkspaceLeader);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{ id: string; name: string } | null>(null);
  const [workspaceDeletePending, setWorkspaceDeletePending] = useState(false);
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState("");
  const canDeleteWorkspace = activeWorkspace?._count?.projects === 0 && activeWorkspace.members?.some(
    (member: any) => member.userId === user?.id && member.role === "LEADER" && !member.leftAt,
  );
  const { data: workflowEnrollmentData, isLoading: isWorkflowEnrollmentLoading, isError: isWorkflowEnrollmentError } = useQuery({
    queryKey: ["student-workflow-enrollments"],
    queryFn: () =>
      apiClient.get<{ enrollments: any[] }>("/api/workflows/enrollments/me"),
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
  // Enrollment results are ordered by joinedAt descending by the API.
  const registrationWorkflow = workflowEnrollmentData?.enrollments?.[0]?.workflow;
  const registrationWorkflowId = workflowEnrollmentData?.enrollments?.[0]?.workflowId;
  const hasRegistrationWorkflow = !isWorkflowEnrollmentLoading && !isWorkflowEnrollmentError && !!registrationWorkflowId;
  const needsRegistrationWorkflow = !!activeWorkspace || !!createTitle.trim();

  const projectSelection = useActiveProject(researchData?.projects || []);
  const activeProject = projectSelection.project;
  useEffect(() => {
    if (!activeProject?.id) return;
    const pending = getPendingConsultationImports(activeProject.id);
    if (!pending.length) return;
    let cancelled = false;
    apiClient
      .post<{ receipts: Array<{ clientId: string; consultationId: string }> }>(
        "/api/consultations/import",
        { researchId: activeProject.id, consultations: pending },
      )
      .then((result) => {
        if (cancelled) return;
        recordConsultationImportReceipts(activeProject.id, result.receipts || []);
        refetchConsultations();
      })
      .catch(() => {
        // Legacy records remain intact and will be retried idempotently later.
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, refetchConsultations]);
  // Live conference presence is intentionally transient, but still scoped to
  // the selected research project and an authenticated membership.
  useEffect(() => {
    if (!activeProject?.id) return;
    const fetchActiveStream = async () => {
      try {
        const res = await apiClient.get<{ success: boolean; stream: any }>(
          `/api/consultations/active-stream?groupId=${activeProject.id}`,
        );
        if (!res?.stream) return;
        const stream = res.stream;
        setIsMeetingActive(stream.isActive);
        if (stream.meetingUrl) setActiveMeetingUrl(stream.meetingUrl);
        if (stream.topic) setActiveMeetingTopic(stream.topic);
        setActiveParticipants(stream.participants || []);
        saveMeetingSession({
          groupId: stream.groupId,
          groupName: stream.groupName || activeProject.title,
          topic: stream.topic,
          meetingUrl: stream.meetingUrl,
          isActive: stream.isActive,
          participants: stream.participants || [],
        });
      } catch {
        // Transient local presence remains available while the API is offline.
      }
    };
    fetchActiveStream();
    const interval = window.setInterval(fetchActiveStream, 3000);
    return () => window.clearInterval(interval);
  }, [activeProject?.id, activeProject?.title]);
  const { data: dashboardDocumentData } = useQuery({
    queryKey: ["student-dashboard-documents", activeProject?.id],
    queryFn: () =>
      apiClient.get<{ documents: any[] }>(
        `/api/research/${activeProject.id}/documents`,
      ),
    enabled: Boolean(activeProject?.id),
    refetchOnWindowFocus: true,
  });
  const { data: manuscriptWorkflowResponse, isLoading: isMilestoneLoading, isError: isMilestoneError, refetch: refetchMilestones } = useQuery({
    queryKey: ["student-manuscript-workflow", activeProject?.id],
    queryFn: () => apiClient.get<{ milestones: any[]; activity: any[] }>(`/api/research/${activeProject.id}/manuscript-workflow`),
    enabled: Boolean(activeProject?.id && !activeProject?.workflowAccessRemoved),
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
  const manuscriptWorkflowData = activeProject?.workflowAccessRemoved ? undefined : manuscriptWorkflowResponse;
  const activeWorkflowEnrollment = activeProject
    ? workflowEnrollmentData?.enrollments?.find((enrollment: any) => enrollment.workflowId === activeProject.workflowInstance?.workflowId)
    : workflowEnrollmentData?.enrollments?.[0];
  const { data: defenseResultData } = useQuery({
    queryKey: ["student-defense-result", activeProject?.id],
    queryFn: () => apiClient.get<{ result: any | null }>(`/api/research/${activeProject.id}/defense-result`),
    enabled: Boolean(activeProject?.id),
    refetchInterval: 5000,
  });
  const officialDefenseResult = defenseResultData?.result || null;
  const { data: defenseManagementData } = useQuery({
    queryKey: ["student-defense-management"],
    queryFn: () => apiClient.get<{ sessions: any[] }>("/api/defense-management"),
    refetchInterval: 15000,
  });
  const projectDefenseSessions = (defenseManagementData?.sessions || []).filter(
    (session: any) => session.researchId === activeProject?.id,
  );
  const currentDefenseSession =
    projectDefenseSessions.find((session: any) =>
      ["LIVE", "DELIBERATION", "SCHEDULED", "PENDING_ACKNOWLEDGEMENT", "NEEDS_RESCHEDULING"].includes(session.status),
    ) || projectDefenseSessions[0] || null;
  const projectProgress = calculateMilestoneProgress(
    manuscriptWorkflowData?.milestones,
    Boolean(activeProject?.workflowInstance?.completedAt),
  );
  const projectStatusLabel = activeProject?.status
    ? activeProject.status.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter: string) => letter.toUpperCase())
    : "Not registered";
  const activeStudentMembers = (activeProject?.members || []).filter((member: any) => !member.leftAt && ["LEADER", "MEMBER"].includes(member.projectRole));
  const currentMembership = activeStudentMembers.find((member: any) => member.userId === user?.id || member.user?.id === user?.id);
  const isGroupLeader = currentMembership?.projectRole === "LEADER";
  const activeAdviserMembership = (activeProject?.members || []).find(
    (member: any) => member.projectRole === "ADVISER" && !member.leftAt,
  );
  const {
    data: adviserRequestData,
    refetch: refetchAdviserRequests,
  } = useQuery({
    queryKey: ["student-adviser-requests", activeProject?.id],
    queryFn: () =>
      apiClient.get<{ requests: any[] }>("/api/adviser-requests"),
    enabled: Boolean(activeProject?.id),
    refetchInterval: 10000,
  });
  const adviserRequests = adviserRequestData?.requests || [];
  const pendingAdviserRequest = adviserRequests.find(
    (request: any) =>
      request.researchId === activeProject?.id && request.status === "PENDING",
  );
  const latestAdviserRequest = adviserRequests.find(
    (request: any) => request.researchId === activeProject?.id,
  );
  const { data: joinRequestData, refetch: refetchJoinRequests } = useQuery({
    queryKey: ["student-research-join-requests", activeProject?.id],
    queryFn: () =>
      apiClient.get<{ requests: any[] }>(
        `/api/research/${activeProject.id}/join-requests`,
      ),
    enabled: Boolean(activeProject?.id && isGroupLeader),
    refetchInterval: 10000,
  });
  const joinRequests = joinRequestData?.requests || [];
  const pendingJoinRequests = joinRequests.filter(
    (request: any) => request.status === "PENDING",
  );

  // State Data strictly from live API
  const [group, setGroup] = useState<any>(null);

  useEffect(() => {
    if (activeProject) {
      setGroupNameInput(activeProject.groupName || "");
      setInviteCode(activeProject.inviteCode || "");
      setProjectAccessMode(activeProject.accessMode || "INVITE_ONLY");
      setProjectParticipationMode(
        activeProject.participationMode ||
          (activeStudentMembers.length > 1 ? "GROUP" : "SOLO"),
      );
      setProjectInviteEnabled(activeProject.inviteCodeEnabled === true);
      setGroup({
        id: activeProject.id,
        name: activeProject.groupName || (activeProject.title?.length > 25 ? activeProject.title.substring(0, 25) + "..." : activeProject.title),
        projectTitle: activeProject.title || "Untitled Research",
        members: activeProject.members?.map((m: any) => `${m.user.firstName} ${m.user.lastName}`) || [],
        status: activeProject.status?.toLowerCase() || "draft",
      });
      const authoritative = new Map((manuscriptWorkflowData?.milestones || []).map((milestone: any) => [milestone.id, milestone]));
      setMilestones(getOrderedWorkflowStages(activeProject).map((stage) => ({
        id: stage.id,
        title: stage.name,
        status: authoritative.get(stage.id)?.completed
          ? "completed"
          : ["IN_PROGRESS", "AWAITING_REVIEW", "REVISION_REQUIRED", "APPROVED"].includes(authoritative.get(stage.id)?.status)
            ? "in-progress"
            : "upcoming",
        completionPercent: authoritative.get(stage.id)?.completionPercent || 0,
        deadlineDays: stage.deadlineDays,
        targetCompletionDate: stage.targetCompletionDate,
        requiresApproval: stage.requiresApproval,
        sequence: stage.sequence,
        topicId: stage.topic?.id || null,
        topicTitle: stage.topic?.title || "Ungrouped milestones",
        description: stage.description || "",
        category: stage.category || "Milestone",
      })));
    } else if (activeWorkflowEnrollment?.workflow?.stages) {
      setGroup(null);
      setMilestones(
        activeWorkflowEnrollment.workflow.stages.map(
          (stage: any, index: number) => ({
            id: stage.id,
            title: stage.name,
            status: index === 0 ? "in-progress" : "upcoming",
            deadlineDays: stage.deadlineDays,
        targetCompletionDate: stage.targetCompletionDate,
            requiresApproval: stage.requiresApproval,
            sequence: stage.sequence,
            topicId: stage.topic?.id || null,
            topicTitle: stage.topic?.title || "Ungrouped milestones",
            description: stage.description || "",
            category: stage.category || "Milestone",
            previewOnly: true,
          }),
        ),
      );
    } else {
      setGroup(null);
      setMilestones([]);
    }
  }, [activeProject, activeWorkflowEnrollment, manuscriptWorkflowData?.milestones]);

  const [aiMatches, setAiMatches] = useState<any[]>([]);
  const combinedSubmissions = (dashboardDocumentData?.documents || []).flatMap(
    (document: any) =>
      (document.versions || []).map((version: any) => ({
        id: version.id,
        documentId: document.id,
        docName: document.title,
        milestone:
          version.milestone?.name ||
          document.milestone?.name ||
          document.documentType,
        date: new Date(version.uploadedAt).toISOString().split("T")[0],
        version: `v${version.versionNumber}`,
        status: String(
          version.manuscriptStatus || document.lifecycleStatus || "DRAFT",
        )
          .toLowerCase()
          .replace(/_/g, " "),
      })),
  );

  const [milestones, setMilestones] = useState<any[]>([]);
  const [defenses, setDefenses] = useState<any[]>([]);

  useEffect(() => {
    setDefenses((defenseManagementData?.sessions || []).map((session: any) => ({
      id: session.id,
      title: session.research?.title || "Research defense",
      date: session.scheduledStart ? new Date(session.scheduledStart).toLocaleDateString() : "Pending",
      time: session.scheduledStart ? new Date(session.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Awaiting confirmation",
      venue: session.venue || (session.meetingUrl ? "Online defense" : "To be announced"),
      meetingUrl: session.meetingUrl,
      type: session.status.replace(/_/g, " "),
      status: session.status,
      panelists: (session.invitations || []).filter((item: any) => item.status !== "REMOVED").map((item: any) => `${item.invitee.firstName} ${item.invitee.lastName} (${item.role.replace(/_/g, " ")})`),
    })));
  }, [defenseManagementData]);

  const combinedNotifications = apiNotifications.map((notification: any) => {
    const createdAt = notification.createdAt
      ? new Date(notification.createdAt)
      : null;

    return {
      id: notification.id,
      msg: notification.message || notification.title,
      date:
        createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.toLocaleDateString()
          : "",
      type: notification.type,
    };
  });

  // Form input controllers
  const [topicInput, setTopicInput] = useState("");
  const [uploadMilestone, setUploadMilestone] = useState("Draft Submission");
  const [uploadFileName, setUploadFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [consultTopic, setConsultTopic] = useState("");
  const [consultDate, setConsultDate] = useState("");
  const [consultTime, setConsultTime] = useState("");
  const [consultMode, setConsultMode] = useState("Video Call");

  // Modals state
  const [modalCert, setModalCert] = useState(false);
  const [modalJoinConferencing, setModalJoinConferencing] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectTitle, setEditProjectTitle] = useState("");
  const [editProjectAbstract, setEditProjectAbstract] = useState("");
  const [editProjectReason, setEditProjectReason] = useState("");
  const [editProjectSaving, setEditProjectSaving] = useState(false);
  const [projectAccessMode, setProjectAccessMode] = useState<
    "INVITE_ONLY" | "PUBLIC_APPROVAL" | "PUBLIC_OPEN"
  >("INVITE_ONLY");
  const [projectParticipationMode, setProjectParticipationMode] = useState<
    "SOLO" | "GROUP"
  >("SOLO");
  const [projectInviteEnabled, setProjectInviteEnabled] = useState(false);
  const [projectAccessSaving, setProjectAccessSaving] = useState(false);
  const [groupAction, setGroupAction] = useState<{ type: "transfer" | "leave" | "disband" | "remove" | "delete"; member?: any } | null>(null);
  const [groupActionPending, setGroupActionPending] = useState(false);
  const [adviserCancelPending, setAdviserCancelPending] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim()) {
      triggerToast("Please enter a document title.");
      return;
    }
    if (!selectedFile) {
      triggerToast("Please click or drag & drop a PDF or DOCX file first.");
      return;
    }

    setIsUploading(true);
    try {
      if (activeProject?.id) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", uploadFileName.trim());
        formData.append("documentType", uploadMilestone);

        await apiClient.upload(
          `/api/research/${activeProject.id}/documents`,
          formData,
        );
        await queryClient.invalidateQueries({
          queryKey: ["student-dashboard-documents", activeProject.id],
        });
      }
      setUploadFileName("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      triggerToast(`Uploaded "${uploadFileName.trim()}" to Documents.`);
    } catch (err: any) {
      triggerToast(`Submission failed: ${err.message || "Network error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRequestConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultTopic) return;
    try {
      const startDateTime = new Date(`${consultDate}T${consultTime}:00+08:00`);
      if (!Number.isFinite(startDateTime.getTime())) throw new Error("Choose a valid consultation date and time.");
      const endDateTime = new Date(startDateTime.getTime() + 3600000);

      if (!activeProject?.id) throw new Error("Select a research project first.");
      const result = await apiClient.post<{ consultation: ConsultationItem; warning?: string }>("/api/consultations", {
        researchId: activeProject.id,
        title: consultTopic,
        description: `Student consultation requested by ${user?.firstName || "Student"}`,
        scheduledStart: startDateTime.toISOString(),
        scheduledEnd: endDateTime.toISOString(),
      });
      setConsultations((previous) => [
        result.consultation,
        ...previous.filter((item) => item.id !== result.consultation.id),
      ]);
      await refetchConsultations();
      triggerToast(
        result.warning || "Consultation request submitted! Awaiting adviser approval.",
      );
      setConsultTopic("");
      setConsultDate("");
      setConsultTime("");
    } catch (error: any) {
      triggerToast(error?.message || "Unable to save the consultation request.");
    }
  };

  const handleCreateResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateResearch) {
      setShowCreateModal(false);
      triggerToast("Only your group leader can register the research project.");
      return;
    }
    if (activeProject) {
      setShowCreateModal(false);
      triggerToast(activeProject.status === "REJECTED"
        ? "Revise the rejected title from My Project instead of creating a replacement."
        : "You already have a registered research project.");
      return;
    }
    if (activeWorkspace && !createTitle.trim()) return;
    if (needsRegistrationWorkflow && !hasRegistrationWorkflow) {
      triggerToast("Join your professor’s workflow from Tasks & Requirements before adding a research project.");
      return;
    }
    setIsCreatingProject(true);
    try {
      const isCreatingProjectRecord = Boolean(createTitle.trim());
      let workspace = activeWorkspace;
      if (!workspace) {
        const workspaceName = createGroupName.trim() || (createParticipationMode === "SOLO" ? "My research workspace" : "Research group");
        const result = await apiClient.post<{ workspace: any }>("/api/workspaces", {
          name: workspaceName,
          participationMode: createParticipationMode,
          accessMode: createParticipationMode === "GROUP" ? createAccessMode : "INVITE_ONLY",
        });
        workspace = result.workspace;
      }
      if (createTitle.trim()) {
        await apiClient.post("/api/research", {
          title: createTitle.trim(),
          abstract: createAbstract.trim() || undefined,
          workspaceId: workspace.id,
          workflowId: registrationWorkflowId,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["student-research"] });
      queryClient.invalidateQueries({ queryKey: ["student-workspaces"] });
      setShowCreateModal(false);
      setCreateTitle("");
      setCreateAbstract("");
      setCreateParticipationMode("SOLO");
      setCreateGroupName("");
      setCreateAccessMode("INVITE_ONLY");
      triggerToast(isCreatingProjectRecord ? "Workspace and research project created." : "Workspace created. Add your research title when you are ready.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to register project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const refreshGroup = async () => {
    await queryClient.invalidateQueries({ queryKey: ["student-research"] });
  };

  const handleSaveGroupName = async () => {
    if (!activeProject?.id) return;
    try {
      await apiClient.patch(`/api/research/${activeProject.id}/group-name`, { groupName: groupNameInput.trim() });
      await refreshGroup();
      triggerToast(groupNameInput.trim() ? "Group name updated." : "Optional group name removed.");
    } catch (error: any) {
      triggerToast(error?.message || "Group name could not be updated.");
    }
  };

  const handleCreateInvite = async () => {
    if (!activeProject?.id) return;
    try {
      const response = await apiClient.post<{ inviteCode: string }>(`/api/research/${activeProject.id}/invite-code`, { accessMode: projectAccessMode });
      setInviteCode(response.inviteCode);
      await refreshGroup();
      triggerToast("A new group invitation is ready.");
    } catch (error: any) {
      triggerToast(error?.message || "Invitation could not be created.");
    }
  };

  const openEditProject = () => {
    if (!activeProject) return;
    setEditProjectTitle(activeProject.title || "");
    setEditProjectAbstract(activeProject.abstract || "");
    setEditProjectReason("");
    setShowEditProjectModal(true);
  };

  const handleSaveProjectDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProject?.id || !editProjectTitle.trim()) return;
    setEditProjectSaving(true);
    try {
      const result = await apiClient.patch<{ titleChangePending?: boolean }>(
        `/api/research/${activeProject.id}/details`,
        {
          title: editProjectTitle.trim(),
          abstract: editProjectAbstract.trim(),
          groupName: groupNameInput.trim(),
          reason: editProjectReason.trim(),
        },
      );
      await refreshGroup();
      setShowEditProjectModal(false);
      triggerToast(
        result.titleChangePending
          ? "Your title-change request was submitted for approval."
          : "Research project details updated.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "Project details could not be updated.");
    } finally {
      setEditProjectSaving(false);
    }
  };

  const handleSaveProjectAccess = async () => {
    if (!activeProject?.id) return;
    setProjectAccessSaving(true);
    try {
      await apiClient.patch(`/api/research/${activeProject.id}/access`, {
        participationMode: projectParticipationMode,
        accessMode: projectAccessMode,
        inviteCodeEnabled: projectInviteEnabled,
      });
      await refreshGroup();
      triggerToast("Group access settings updated.");
    } catch (error: any) {
      triggerToast(error?.message || "Access settings could not be updated.");
    } finally {
      setProjectAccessSaving(false);
    }
  };

  const decideJoinRequest = async (
    requestId: string,
    action: "ACCEPT" | "REJECT",
  ) => {
    if (!activeProject?.id) return;
    try {
      await apiClient.patch(
        `/api/research/${activeProject.id}/join-requests/${requestId}`,
        { action },
      );
      await Promise.all([refreshGroup(), refetchJoinRequests()]);
      triggerToast(
        action === "ACCEPT"
          ? "Researcher added to the group."
          : "Join request declined.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "The join request could not be updated.");
    }
  };

  const cancelAdviserRequest = async () => {
    if (!pendingAdviserRequest?.id || !isGroupLeader) return;
    setAdviserCancelPending(true);
    try {
      await apiClient.patch(
        `/api/adviser-requests/${pendingAdviserRequest.id}/cancel`,
      );
      await refetchAdviserRequests();
      triggerToast("The pending adviser request was cancelled.");
    } catch (error: any) {
      triggerToast(error?.message || "The adviser request could not be cancelled.");
    } finally {
      setAdviserCancelPending(false);
    }
  };

  const deleteWorkspace = async () => {
    if (!workspaceToDelete || workspaceDeletePending) return;
    setWorkspaceDeletePending(true);
    setWorkspaceDeleteError("");
    try {
      await apiClient.delete(`/api/workspaces/${workspaceToDelete.id}`);
      queryClient.setQueryData<{ workspaces: any[] }>(["student-workspaces"], (previous) => previous ? {
        ...previous, workspaces: previous.workspaces.filter((workspace) => workspace.id !== workspaceToDelete.id),
      } : previous);
      setWorkspaceToDelete(null);
      setShowCreateModal(false);
      await queryClient.invalidateQueries({ queryKey: ["student-workspaces"] });
      triggerToast("Workspace deleted. You can create a new workspace.");
    } catch (error: any) {
      setWorkspaceDeleteError(error?.message || "The workspace could not be deleted. Please try again.");
    } finally {
      setWorkspaceDeletePending(false);
    }
  };

  const executeGroupAction = async () => {
    if (!groupAction || !activeProject?.id) return;
    setGroupActionPending(true);
    try {
      if (groupAction.type === "transfer") await apiClient.post(`/api/research/${activeProject.id}/transfer-leadership`, { userId: groupAction.member.userId });
      if (groupAction.type === "leave") await apiClient.post(`/api/research/${activeProject.id}/leave`);
      if (groupAction.type === "disband") await apiClient.post(`/api/research/${activeProject.id}/disband`);
      if (groupAction.type === "remove") await apiClient.delete(`/api/research/${activeProject.id}/members/${groupAction.member.id}`);
      if (groupAction.type === "delete") await apiClient.delete(`/api/research/${activeProject.id}`);
      setGroupAction(null);
      await refreshGroup();
      triggerToast(groupAction.type === "transfer" ? "Leadership transferred." : groupAction.type === "leave" ? "You left the research group." : groupAction.type === "disband" ? "The group was disbanded and archived." : groupAction.type === "delete" ? "Rejected project deleted. You can now create a replacement." : "Member removed from the active group.");
    } catch (error: any) {
      triggerToast(error?.message || "The group action could not be completed.");
    } finally {
      setGroupActionPending(false);
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
      triggerToast("Saved consultation notes and Google Meet chat transcript!");
    } catch (error: any) {
      triggerToast(error?.message || "Unable to save consultation notes.");
    }
  };

  const handleTabChange = (tab: string) => {
    if (tab === "my-group") {
      router.push(projectSelection.projectHref(projectSectionHref("my-group")));
      return;
    }
    if (tab === "workspace" || tab === "documents") {
      router.push(projectSelection.projectHref("/student/documents"));
      return;
    }
    if (tab === "tasks") {
      router.push(projectSelection.projectHref("/student/tasks"));
      return;
    }
    if (tab === "adviser-pool") {
      router.push(projectSelection.projectHref("/student/adviser-pool"));
      return;
    }
    if (tab === "defense") {
      router.push(
        currentDefenseSession?.id
          ? projectSelection.projectHref(`/student/defense/${currentDefenseSession.id}`)
          : projectSelection.projectHref("/student/defense"),
      );
      return;
    }
    router.push(projectSelection.projectHref(`/student/dashboard?tab=${tab}`));
  };

  const handleProjectAction = (action: ProjectAction) => {
    if (action.kind === "task") router.push(studentTaskDetailsHref(action.taskId, activeProject?.id));
    else if (action.kind === "edit") openEditProject();
    else if (action.kind === "retry") void refetchMilestones();
    else handleTabChange(action.kind === "timeline" ? "milestones" : action.kind);
  };

  const [consultFilter, setConsultFilter] = useState<"all" | "approved" | "pending">("all");

  const renderConsultationsHub = () => {
    const filteredConsultations = consultations.filter((c: any) => {
      if (consultFilter === "approved") return c.status !== "pending" && c.status !== "requested";
      if (consultFilter === "pending") return c.status === "pending" || c.status === "requested";
      return true;
    });
    const today = new Date();
    const visibleDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index - 3);
      return date;
    });

    return (
      <div className="flex flex-col gap-6">
        {/* Course-Themed Page Header Banner */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 shadow-xs md:flex-row md:items-center sm:p-8">
          <div className="max-w-3xl">
            <span className="block text-xs font-extrabold uppercase tracking-widest text-[var(--color-primary)]">
              Adviser Consultations & Scheduled Meetings
            </span>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text-primary)] dark:text-white">
              Faculty Consultation Repository & Video Rooms
            </h2>
            <p className="mt-2 text-base leading-6 text-[var(--color-text-secondary)]">
              Book advising slots, launch synchronized Google Meet rooms, and review auto-indexed meeting transcripts.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => handleStartConference(DEFAULT_SHARED_MEET_URL, "Advising Video Conference")}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-extrabold text-white shadow-xs transition hover:bg-[var(--color-primary-dark)] active:scale-[0.98]"
            >
              <i className="ti ti-video text-base font-bold" />
              <span>Instant Google Meet</span>
            </button>
          </div>
        </div>

        {/* Course-Tinted Consultation Calendar */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-4" aria-label="Consultation calendar">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="shrink-0">
              <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Consultation calendar</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)] dark:text-white">
                {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {visibleDays.map((date) => {
                const isToday = date.toDateString() === today.toDateString();
                return (
                  <div
                    key={date.toISOString()}
                    className={`flex min-w-11 flex-col items-center rounded-xl px-2.5 py-2.5 text-center transition sm:min-w-16 ${
                      isToday
                        ? "bg-[var(--color-primary)] text-white shadow-xs font-black"
                        : "bg-[var(--color-surface)] border border-[var(--color-border)]/70 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="mt-1 text-sm font-black">{date.getDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Scheduled Sessions Container */}
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex min-h-[460px] flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                    <i className="ti ti-calendar-time text-lg" />
                  </span>
                  <h3 className="flex items-center gap-2 text-lg font-extrabold text-[var(--color-text-primary)] dark:text-white">
                    Scheduled Sessions
                  </h3>
                  <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--color-text-secondary)]">
                    {consultations.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-[var(--color-surface-muted)] p-1 text-xs font-bold border border-[var(--color-border)]">
                  <button
                    onClick={() => setConsultFilter("all")}
                    className={`h-8 cursor-pointer rounded-lg px-3 transition ${
                      consultFilter === "all" ? "bg-[var(--color-primary)] text-white shadow-xs font-bold" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    All ({consultations.length})
                  </button>
                  <button
                    onClick={() => setConsultFilter("approved")}
                    className={`h-8 cursor-pointer rounded-lg px-3 transition ${
                      consultFilter === "approved" ? "bg-[var(--color-primary)] text-white shadow-xs font-bold" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    Confirmed
                  </button>
                  <button
                    onClick={() => setConsultFilter("pending")}
                    className={`h-8 cursor-pointer rounded-lg px-3 transition ${
                      consultFilter === "pending" ? "bg-[var(--color-primary)] text-white shadow-xs font-bold" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>

              {filteredConsultations.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {filteredConsultations.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-sm sm:p-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--color-text-primary)] dark:text-white">{c.topic}</span>
                            <Tag variant={c.status === "pending" || c.status === "requested" ? "warn" : "success"}>
                              {c.status === "pending" || c.status === "requested" ? "Pending Approval" : "Confirmed"}
                            </Tag>
                          </div>
                          <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                            {c.groupName || "Research Group"} · {c.date} at {c.time} ({c.mode})
                          </span>
                          {c.meetingUrl && (
                            <span className="mt-2 inline-block rounded-lg bg-[var(--color-primary-light)] px-2 py-1 font-mono text-xs text-[var(--color-primary)]">
                              {c.meetingUrl}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            onClick={() => handleOpenTranscriptModal(c)}
                            className="px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] font-bold rounded-lg border border-[var(--color-border)] text-sm shadow-xs cursor-pointer transition flex items-center gap-1"
                          >
                            <i className="ti ti-file-text text-[var(--color-primary)]" />
                            <span>{c.notes || (c.transcript && c.transcript.length > 0) ? "Notes & Chat" : "Import Chat"}</span>
                          </button>
                          {c.status === "pending" || c.status === "requested" ? (
                            <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold rounded-lg text-xs flex items-center gap-1">
                              <i className="ti ti-clock" />
                              <span>Pending</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStartConference(c.meetingUrl || DEFAULT_SHARED_MEET_URL, c.topic)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow-xs transition cursor-pointer flex items-center gap-1"
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
                              className="p-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] rounded-lg text-[var(--color-text-secondary)] cursor-pointer text-sm"
                            >
                              <i className="ti ti-copy" />
                            </button>
                          )}
                        </div>
                      </div>

                      {c.notes && (
                        <div className="rounded-xl bg-[var(--color-surface-muted)] p-4 text-xs text-[var(--color-text-secondary)]">
                          <span className="mb-1 block font-bold text-[var(--color-text-primary)] dark:text-white">Adviser Feedback & Summary:</span>
                          <p className="whitespace-pre-wrap">{c.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-2xl text-[var(--color-primary)]">
                    <i className="ti ti-calendar-off" />
                  </div>
                  <div>
                    <h4 className="text-lg font-extrabold tracking-tight text-[var(--color-text-primary)] dark:text-white">No Consultations Found</h4>
                    <p className="mt-1.5 max-w-sm text-base leading-6 text-[var(--color-text-secondary)]">
                      {consultFilter === "all"
                        ? "You have not booked any advising consultations yet. Use the booking form on the right to schedule a session."
                        : `No ${consultFilter} consultations found.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Booking Form & Live Conferencing */}
          <div className="flex flex-col gap-5 xl:sticky xl:top-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-[var(--color-text-primary)] dark:text-white">
                <i className="ti ti-calendar-plus text-[var(--color-primary)]" />
                Book a Consultation Session
              </h3>
              <p className="text-base leading-6 text-[var(--color-text-secondary)]">
                Submit your preferred date and topic to your research adviser.
              </p>
              <form onSubmit={handleRequestConsult} className="flex flex-col gap-4 text-sm">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[var(--color-text-primary)]">Discussion Topic *</label>
                  <input
                    required
                    type="text"
                    value={consultTopic}
                    onChange={(e) => setConsultTopic(e.target.value)}
                    placeholder="e.g. Chapter 3 Methodology Validation"
                    className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)] text-[var(--color-text-primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-[var(--color-text-primary)]">Preferred Date *</label>
                    <input
                      required
                      type="date"
                      value={consultDate}
                      onChange={(e) => setConsultDate(e.target.value)}
                      className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-[var(--color-text-primary)]">Preferred Time *</label>
                    <input
                      required
                      type="time"
                      value={consultTime}
                      onChange={(e) => setConsultTime(e.target.value)}
                      className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)] text-[var(--color-text-primary)]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[var(--color-text-primary)]">Meeting Mode</label>
                  <select
                    value={consultMode}
                    onChange={(e) => setConsultMode(e.target.value)}
                    className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)] text-[var(--color-text-primary)]"
                  >
                    <option value="Video Call">Google Meet (Online Video Conference)</option>
                    <option value="In-Person">In-Person (Faculty Consultation Room)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="mt-1 h-11 w-full cursor-pointer rounded-xl bg-[var(--color-primary)] px-4 font-extrabold text-white shadow-xs transition hover:bg-[var(--color-primary-dark)] active:scale-[0.98]"
                >
                  Submit Consultation Request
                </button>
              </form>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <i className="ti ti-video text-emerald-600" />
                  Live Conferencing Room
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ready
                </span>
              </div>
              <p className="text-[var(--color-text-secondary)] text-base leading-relaxed">
                Need an immediate sync with your team members or adviser? Launch a synchronized Google Meet room with floating transcript window.
              </p>
              <button
                onClick={() => handleStartConference(DEFAULT_SHARED_MEET_URL, `${group?.name || "Student"} Instant Room`)}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-extrabold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98]"
              >
                <i className="ti ti-external-link" />
                <span>Launch Instant Meet Room</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5 text-xs">
              <span className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <i className="ti ti-info-circle text-[var(--color-primary)]" />
                Advising Guidelines & Policies
              </span>
              <ul className="list-disc list-inside text-[var(--color-text-secondary)] space-y-1 text-xs">
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
        <div className="flex justify-end">
          <button
            onClick={() => router.push("/student/documents")}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 text-sm font-extrabold text-white shadow-xs transition"
          >
            <i className="ti ti-edit font-bold" />
            <span>Open Document Workspace</span>
          </button>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Submissions & Version Control History (7 of 12) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-[#1b4264] text-lg flex items-center gap-2">
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
                          <span className="text-xs text-slate-500">
                            {sub.milestone || "Chapter Draft"} · Version {sub.version} · {sub.date}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag variant={sub.status === "approved" || sub.status === "finalized" ? "success" : "warn"}>
                          {sub.status.replace(/\b\w/g, (letter: string) => letter.toUpperCase())}
                        </Tag>
                        <button
                          onClick={() =>
                            router.push(
                              `/student/documents?projectId=${activeProject?.id || ""}&documentId=${sub.documentId}`,
                            )
                          }
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[#1b4264] font-bold text-sm cursor-pointer transition flex items-center gap-1"
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
                    <h4 className="font-extrabold text-[#1b4264] text-lg">No Manuscript Submissions Yet</h4>
                    <p className="text-slate-500 text-base max-w-sm mt-1">
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
              <h3 className="font-extrabold text-[#1b4264] text-lg flex items-center gap-2">
                <i className="ti ti-cloud-upload text-[#ffa400]" />
                Submit Draft Manuscript
              </h3>
              <p className="text-slate-400 text-base font-bold">
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

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      if (!uploadFileName) {
                        setUploadFileName(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />

                {/* Interactive Clickable & Drag & Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      if (!uploadFileName) {
                        setUploadFileName(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                  className={`p-5 border-2 border-dashed rounded-xl text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    isDragging
                      ? "bg-amber-50 border-[#ffa400] scale-[1.01]"
                      : selectedFile
                      ? "bg-emerald-50/70 border-emerald-400"
                      : "bg-slate-50 border-slate-300 hover:border-[#ffa400] hover:bg-slate-100/70"
                  }`}
                >
                  {selectedFile ? (
                    <>
                      <i className="ti ti-file-check text-3xl text-emerald-600" />
                      <span className="text-[12px] font-bold text-emerald-800 break-all px-2">
                        {selectedFile.name}
                      </span>
                      <span className="text-xs text-emerald-600 font-medium">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drop to replace
                      </span>
                    </>
                  ) : (
                    <>
                      <i className={`ti ti-cloud-upload text-3xl ${isDragging ? "text-[#ffa400]" : "text-slate-400"}`} />
                      <span className="text-[12px] font-bold text-slate-700">
                        {isDragging ? "Drop your manuscript here" : "Click to browse or Drag & Drop Manuscript"}
                      </span>
                      <span className="text-xs text-slate-400">Supported formats: PDF or DOCX (Max: 25 MB)</span>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-extrabold rounded-lg shadow transition cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <i className="ti ti-loader animate-spin" />
                      <span>Uploading Manuscript...</span>
                    </>
                  ) : (
                    <span>Submit Manuscript for Review</span>
                  )}
                </button>
              </form>
            </div>

            {/* Card 2: Submission Guidelines */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs flex flex-col gap-2">
              <span className="font-bold text-[#1b4264] flex items-center gap-1.5">
                <i className="ti ti-checklist text-emerald-600" />
                Submission Standards Checklist
              </span>
              <ul className="list-disc list-inside text-slate-600 space-y-1 text-xs">
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

  if (isResearchLoading) {
    if (activeTab === "overview") return <DashboardSkeleton />;
    if (["workspace", "submissions"].includes(activeTab)) return <FilesPageSkeleton />;
    if (["consultations", "history"].includes(activeTab)) return <CardsPageSkeleton />;
    if (activeTab === "milestones") return <TablePageSkeleton />;
    return <ListPageSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent font-sans text-slate-800">
      
      {toast && (
        <div className="fixed top-5 right-5 z-55 bg-[#1b4264] border border-white/10 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
        </div>
      )}

      {groupAction && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="group-action-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !groupActionPending) setGroupAction(null); }}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${groupAction.type === "transfer" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-600"}`}><i className={`ti ${groupAction.type === "transfer" ? "ti-user-star" : "ti-alert-triangle"} text-xl`} /></span><div><h2 id="group-action-title" className="text-lg font-extrabold text-[#102f49]">{groupAction.type === "transfer" ? "Transfer group leadership?" : groupAction.type === "leave" ? "Leave this research group?" : groupAction.type === "disband" ? "Disband and archive this group?" : groupAction.type === "delete" ? "Permanently delete rejected project?" : "Remove this member?"}</h2><p className="mt-2 text-base leading-6 text-slate-600">{groupAction.type === "transfer" ? `${groupAction.member?.user?.firstName} ${groupAction.member?.user?.lastName} will become the group leader. You will remain as a member.` : groupAction.type === "leave" ? "You will lose access to the group, but your previous submissions and activity attribution will remain." : groupAction.type === "disband" ? "All active memberships will end and the project will be archived. Academic records and submissions will be preserved." : groupAction.type === "delete" ? `The rejected project “${activeProject?.title}” will be permanently deleted. You can register a replacement afterward.` : `${groupAction.member?.user?.firstName} ${groupAction.member?.user?.lastName} will lose group access. Their previous contributions will remain attributed to them.`}</p></div></div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setGroupAction(null)} disabled={groupActionPending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={executeGroupAction} disabled={groupActionPending} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50 ${groupAction.type === "transfer" ? "bg-[#173f63]" : "bg-rose-600"}`}>{groupActionPending ? "Processing…" : groupAction.type === "transfer" ? "Confirm transfer" : groupAction.type === "leave" ? "Confirm leave" : groupAction.type === "disband" ? "Confirm disband" : groupAction.type === "delete" ? "Delete project" : "Confirm removal"}</button></div></div></div>}

      <ProductTour
        tourKey="student_onboarding_v1"
        steps={STUDENT_TOUR_STEPS}
        isOpen={isTourOpen ? true : undefined}
        onClose={() => setIsTourOpen(false)}
        autoStart={false}
      />

      {/* MAIN CONTAINER */}
      <div className={`w-full flex-1 space-y-6 ${["group-chats", "chat"].includes(activeTab) ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8"}`}>
        {activeTab === "overview" && <WorkflowAccessInbox/>}
        {((researchData?.projects?.length || 0) > 1 || projectSelection.invalidRequestedProjectId) && (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card-soft)] sm:p-5">
            <label htmlFor="dashboard-project" className="mb-2 block text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Active research project</label>
            <select id="dashboard-project" value={activeProject?.id || ""} onChange={(event) => projectSelection.selectProject(event.target.value || null)} className="h-11 w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-base font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]">
              <option value="">Choose a research project</option>
              {(researchData?.projects || []).map((project: any) => <option key={project.id} value={project.id}>{project.groupName || project.title}</option>)}
            </select>
            {!activeProject && <p className="mt-2 text-base text-[var(--color-text-secondary)]">{projectSelection.invalidRequestedProjectId ? "That project is unavailable or you do not have access to it." : "Choose a project to view its authoritative workflow data."}</p>}
          </section>
        )}
        
        {activeTab === "group" && <div className="space-y-4"><h1 className="text-2xl font-bold text-[var(--color-text-primary)]">My Project</h1><nav aria-label="Project sections" className="flex gap-1 border-b border-[var(--color-border)]">{([{ id: "overview", label: "Project Overview" }, { id: "my-group", label: "My Group" }] as const).map((section) => <button key={section.id} type="button" aria-current={projectSection === section.id ? "page" : undefined} onClick={() => handleTabChange(section.id === "my-group" ? "my-group" : "group")} className={`min-h-11 border-b-2 px-4 py-3 text-sm font-semibold transition ${projectSection === section.id ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>{section.label}</button>)}</nav></div>}

        {(() => {
          const tabTitles: Record<string, string> = {
            overview: "Researcher Dashboard",
            group: "My Project",
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
              <div className="flex w-full flex-col gap-6">
                <DashboardWelcome
                  firstName={user?.firstName}
                  fallbackName="Student Researcher"
                  summary="Here's an overview of your research progress and what needs your attention."
                  actions={
                    isResearchLoading || isWorkspaceLoading ? (
                      <div className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        <i className="ti ti-loader-2 animate-spin text-base" /> Checking your project…
                      </div>
                    ) : isResearchError ? (
                      <button
                        onClick={() => refetchResearch()}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                      >
                        <i className="ti ti-refresh text-base" /> Retry Project Lookup
                      </button>
                    ) : !activeProject ? (
                      <button
                        onClick={() => researchData?.projects?.length ? window.scrollTo({ top: 0, behavior: "smooth" }) : canCreateResearch ? setShowCreateModal(true) : handleTabChange("my-group")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 text-sm font-bold text-[var(--college-on-primary)] shadow-xs transition hover:bg-[var(--color-primary-dark)] active:scale-[0.98] dark:text-[var(--college-on-primary-dark)]"
                      >
                        <i className={`ti ${researchData?.projects?.length ? "ti-folders" : canCreateResearch ? "ti-plus" : "ti-users"} text-base font-bold`} /> {researchData?.projects?.length ? "Select Project" : canCreateResearch ? "Register Project" : "View My Group"}
                      </button>
                    ) : activeProject.status === "REJECTED" ? (
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <span className="text-xs font-medium text-rose-600">
                          Delete this rejected record before registering a replacement.
                        </span>
                        <button
                          onClick={() => setGroupAction({ type: "delete" })}
                          disabled={groupActionPending}
                          className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-60"
                        >
                          <i className="ti ti-trash text-base" /> {groupActionPending ? "Deleting…" : "Delete Rejected Project"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleTabChange("group")}
                          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-bold text-[var(--college-on-primary)] shadow-xs transition hover:bg-[var(--color-primary-dark)] active:scale-[0.98] dark:text-[var(--college-on-primary-dark)]"
                        >
                          <i className="ti ti-folder-open text-base" /> View My Project
                        </button>
                        <button
                          onClick={() => router.push("/student/documents")}
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-white/80 dark:bg-white/10 px-5 text-sm font-bold text-[var(--color-text-primary)] dark:text-white dark:border-white/20 shadow-2xs backdrop-blur-xs transition hover:bg-white dark:hover:bg-white/20"
                        >
                          <i className="ti ti-file-text text-base" /> Document Workspace
                        </button>
                      </>
                    )
                  }
                />
                {officialDefenseResult && (
                  <section
                    className={`rounded-2xl border p-5 ${
                      officialDefenseResult.decision === "REJECTED"
                        ? "border-rose-200 bg-rose-50 text-rose-900"
                        : officialDefenseResult.decision === "MAJOR_REVISIONS_REQUIRED"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl ${
                          officialDefenseResult.decision === "REJECTED"
                            ? "bg-rose-100 text-rose-700"
                            : officialDefenseResult.decision === "MAJOR_REVISIONS_REQUIRED"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        <i className="ti ti-certificate" />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold uppercase tracking-wider text-slate-500">Official defense result</p>
                        <h2 className="mt-1 text-xl font-extrabold text-[#0B3A53] dark:text-white">
                          {String(officialDefenseResult.decision).replace(/_/g, " ")}
                        </h2>
                        <p className="mt-1 text-base text-slate-600">
                          Released by the defense facilitator on {new Date(officialDefenseResult.releasedAt).toLocaleString()}.
                        </p>
                      </div>
                    </div>
                  </section>
                )}
                {/* 4 Stat Cards in a row: Proportions, icons & labels matching reference screenshot */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <StatCard
                    label="Project Status"
                    value={activeProject ? projectStatusLabel : "Not registered"}
                    icon="ti-file-description"
                    iconBg="bg-sky-50 dark:bg-sky-950/40"
                    iconColor="text-sky-700 dark:text-sky-300"
                    onClick={() => handleTabChange("group")}
                  />
                  <StatCard
                    label="Documents"
                    value={`${combinedSubmissions.length} submitted`}
                    icon="ti-file-text"
                    iconBg="bg-amber-50 dark:bg-amber-950/40"
                    iconColor="text-amber-600 dark:text-amber-400"
                    onClick={() => router.push("/student/documents")}
                  />
                  <StatCard
                    label="Consultations"
                    value={consultations.length > 0 ? `${consultations.length} scheduled` : "None scheduled"}
                    icon="ti-calendar-event"
                    iconBg="bg-indigo-50 dark:bg-indigo-950/40"
                    iconColor="text-indigo-600 dark:text-indigo-400"
                    onClick={() => handleTabChange("consultations")}
                  />
                  <StatCard
                    label="Progress"
                    value={`${projectProgress}%`}
                    icon="ti-chart-line"
                    iconBg="bg-emerald-50 dark:bg-emerald-950/40"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    onClick={() => handleTabChange("milestones")}
                  />
                </section>

                {/* Active Research Study Enrolled Card (when project registered) */}
                {activeProject && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
                        <span>Active Research Study</span>
                        <span className="rounded-full bg-[#0B3A53]/10 dark:bg-[#0B3A53]/30 px-2.5 py-0.5 text-xs font-bold text-[#0B3A53] dark:text-[#38bdf8]">
                          ENROLLED
                        </span>
                      </h2>
                      <button
                        onClick={() => handleTabChange("group")}
                        className="flex items-center gap-1 text-sm font-bold text-[#0B3A53] hover:underline dark:text-[#FFA400] cursor-pointer"
                      >
                        Manage Project <i className="ti ti-chevron-right text-xs transition group-hover:translate-x-0.5" />
                      </button>
                    </div>
                    <CourseCard
                      title={activeProject.title || "Capstone & Thesis Research Study"}
                      code={`GROUP ${String(activeProject.id).substring(0, 6).toUpperCase()} • RESEARCH STUDY`}
                      subtitle={`Current Workflow Stage: ${activeProject.workflowInstance?.currentStage?.name || "Proposal Stage"}`}
                      instructor={
                        activeProject.members?.find((m: any) => m.projectRole === "ADVISER")?.user
                          ? `Adviser: Prof. ${activeProject.members.find((m: any) => m.projectRole === "ADVISER").user.firstName} ${activeProject.members.find((m: any) => m.projectRole === "ADVISER").user.lastName}`
                          : "Faculty Adviser: To Be Assigned"
                      }
                      statusBadge={
                        <Tag variant={activeProject.status === "COMPLETED" ? "success" : activeProject.status === "REJECTED" ? "danger" : "info"}>
                          {projectStatusLabel}
                        </Tag>
                      }
                      progress={projectProgress}
                      description={activeProject.abstract || "Active University of the Assumption capstone research project."}
                      actions={[
                        { label: "Workspace", onClick: () => router.push("/student/documents") },
                        { label: "Submissions", onClick: () => handleTabChange("submissions") },
                        { label: "Consultations", onClick: () => handleTabChange("consultations") },
                        { label: "Messages", onClick: () => handleTabChange("group-chats") },
                      ]}
                    />
                  </div>
                )}

                {/* Main 2-Column Responsive Layout: 7 Cols Left, 5 Cols Right */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column (lg:col-span-7) */}
                  <div className="lg:col-span-7 flex flex-col gap-6">
                    {/* Getting Started Stepper Card */}
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7 shadow-[var(--shadow-card-soft)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Getting Started</h3>
                          <p className="mt-0.5 text-base text-slate-500 dark:text-slate-400">Complete these steps to begin your research journey.</p>
                        </div>
                        <button
                          onClick={() => setIsTourOpen(true)}
                          title="Watch product tour"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          aria-label="Start interactive guide"
                        >
                          <i className="ti ti-player-play-filled text-sm" />
                        </button>
                      </div>

                      {/* Stepper with connecting line */}
                      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                        {/* Step 1: Register Project */}
                        <button
                          onClick={() => !activeProject && canCreateResearch ? setShowCreateModal(true) : handleTabChange(activeProject ? "group" : "my-group")}
                          className="group relative flex flex-col items-center text-center cursor-pointer focus:outline-none"
                        >
                          <span className="hidden md:block absolute left-[65%] top-[14px] w-[70%] h-[2px] bg-slate-200 dark:bg-white/10 -z-0" />
                          <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-xs ${
                            activeProject ? "bg-emerald-600 text-white" : "bg-slate-400 text-white dark:bg-white/20"
                          }`}>
                            {activeProject ? <i className="ti ti-check text-xs" /> : "1"}
                          </span>
                          <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 group-hover:border-[#0B3A53] group-hover:text-[var(--color-primary)] transition">
                            <i className="ti ti-file-description text-xl" />
                          </span>
                          <span className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                            {canCreateResearch || activeProject ? "Register project" : "View group"}
                          </span>
                          <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[150px] leading-relaxed">
                            {canCreateResearch || activeProject ? "View or register your research topic." : "View your team while your leader registers the project."}
                          </span>
                        </button>

                        {/* Step 2: Add Group Members */}
                        <button
                          onClick={() => handleTabChange("group")}
                          className="group relative flex flex-col items-center text-center cursor-pointer focus:outline-none"
                        >
                          <span className="hidden md:block absolute left-[65%] top-[14px] w-[70%] h-[2px] bg-slate-200 dark:bg-white/10 -z-0" />
                          <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-xs ${
                            activeStudentMembers.length > 1 ? "bg-emerald-600 text-white" : "bg-slate-400 text-white dark:bg-white/20"
                          }`}>
                            {activeStudentMembers.length > 1 ? <i className="ti ti-check text-xs" /> : "2"}
                          </span>
                          <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 group-hover:border-[#0B3A53] group-hover:text-[var(--color-primary)] transition">
                            <i className="ti ti-users text-xl" />
                          </span>
                          <span className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                            Add group members
                          </span>
                          <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[150px] leading-relaxed">
                            Invite your team, if any.
                          </span>
                        </button>

                        {/* Step 3: Choose an Adviser */}
                        <button
                          onClick={() => isGroupLeader ? router.push("/student/adviser-pool") : handleTabChange("group")}
                          className="group relative flex flex-col items-center text-center cursor-pointer focus:outline-none"
                        >
                          <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-xs ${
                            activeProject?.members?.some((m: any) => m.projectRole === "ADVISER") ? "bg-emerald-600 text-white" : "bg-slate-400 text-white dark:bg-white/20"
                          }`}>
                            {activeProject?.members?.some((m: any) => m.projectRole === "ADVISER") ? <i className="ti ti-check text-xs" /> : "3"}
                          </span>
                          <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 group-hover:border-[#0B3A53] group-hover:text-[var(--color-primary)] transition">
                            <i className="ti ti-user-check text-xl" />
                          </span>
                          <span className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                            Choose an adviser
                          </span>
                          <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[150px] leading-relaxed">
                            {isGroupLeader ? "Browse verified faculty and send a formal request." : "View your project’s adviser status."}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Recent Activity Card */}
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7 shadow-[var(--shadow-card-soft)]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Recent Activity</h3>
                        <button
                          onClick={() => handleTabChange("notifications")}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition p-1"
                          aria-label="View all activity"
                        >
                          <i className="ti ti-chevron-right text-base" />
                        </button>
                      </div>
                      {combinedNotifications.length > 0 ? (
                        <div className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
                          {combinedNotifications.slice(0, 3).map((item) => (
                            <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="h-2 w-2 rounded-full bg-[#0B3A53] shrink-0" />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.msg}</span>
                              </div>
                              <span className="text-xs text-slate-400 shrink-0">{item.date}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-center">
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-400 text-xl">
                            <i className="ti ti-file-description" />
                          </span>
                          <p className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">No recent activity</p>
                          <p className="mt-0.5 text-base text-slate-400 dark:text-slate-500">Your updates, submissions, and consultations will appear here.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column (lg:col-span-5) */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    {/* Next Consultation Card */}
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7 shadow-[var(--shadow-card-soft)] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Next Consultation</h3>
                          <button
                            onClick={() => handleTabChange("consultations")}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition p-1"
                            aria-label="Open consultations"
                          >
                            <i className="ti ti-chevron-right text-base" />
                          </button>
                        </div>

                        {consultations.length > 0 ? (
                          <div className="py-6 flex flex-col items-center text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-sky-950/40 text-[#0B3A53] dark:text-[#38bdf8] text-2xl">
                              <i className="ti ti-calendar-time" />
                            </span>
                            <p className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                              {consultations[0].topic}
                            </p>
                            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                              {consultations[0].date} at {consultations[0].time} ({consultations[0].mode})
                            </p>
                          </div>
                        ) : (
                          <div className="py-6 flex flex-col items-center text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50/80 dark:bg-white/5 text-slate-400 dark:text-slate-500 text-2xl">
                              <i className="ti ti-calendar-time" />
                            </span>
                            <p className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">
                              No upcoming consultation
                            </p>
                            <p className="mt-1 text-base text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                              Book a consultation with your adviser to get feedback and guidance.
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleTabChange("consultations")}
                        className="w-full mt-4 h-10 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98]"
                      >
                        <i className="ti ti-calendar-plus text-base font-bold" />
                        <span>Book consultation</span>
                      </button>
                    </div>

                    {/* Quick Actions Card */}
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7 shadow-[var(--shadow-card-soft)]">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Quick Actions</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                        <button
                          onClick={() => router.push("/student/documents")}
                          className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:shadow-xs hover:-translate-y-0.5 transition cursor-pointer text-center group"
                        >
                          <i className="ti ti-file-text text-xl text-slate-700 dark:text-slate-200 group-hover:text-[var(--color-primary)] transition" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">New document</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("submissions")}
                          className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:shadow-xs hover:-translate-y-0.5 transition cursor-pointer text-center group"
                        >
                          <i className="ti ti-upload text-xl text-slate-700 dark:text-slate-200 group-hover:text-[var(--color-primary)] transition" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Submit draft</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("group-chats")}
                          className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:shadow-xs hover:-translate-y-0.5 transition cursor-pointer text-center group"
                        >
                          <i className="ti ti-message text-xl text-slate-700 dark:text-slate-200 group-hover:text-[var(--color-primary)] transition" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Message group</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("milestones")}
                          className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:shadow-xs hover:-translate-y-0.5 transition cursor-pointer text-center group"
                        >
                          <i className="ti ti-chart-bar text-xl text-slate-700 dark:text-slate-200 group-hover:text-[var(--color-primary)] transition" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">View milestones</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ),
            "overview-legacy": (
              <>
                {!group ? (
                  <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-sm my-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1b4264]/10 to-[#ffa400]/20 flex items-center justify-center text-[#1b4264] mb-4">
                      <i className="ti ti-folder-plus text-3xl text-[#1b4264]" />
                    </div>
                    <h3 className="text-xl font-extrabold text-[#1b4264] mb-2">No Research Project Registered Yet</h3>
                    <p className="text-slate-500 text-base max-w-md mb-6 leading-relaxed">
                      You are not enrolled in an active research study yet. Create your capstone or thesis project to start collaborating with faculty advisers, submitting drafts, and booking consultations.
                    </p>
                    <button
                      onClick={() => canCreateResearch ? setShowCreateModal(true) : handleTabChange("my-group")}
                      className="px-6 py-3 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-extrabold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <i className="ti ti-plus font-bold" />
                      <span>{canCreateResearch ? "Register Research Project" : "View My Group"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="college-hero-surface border border-[var(--color-border)] text-[var(--color-text-primary)] p-6 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-extrabold text-[#ffa400] uppercase tracking-wider block">Active Research Study</span>
                      <h2 className="text-xl font-black mt-0.5">{group.projectTitle}</h2>
                      <p className="text-base text-slate-200 mt-1">Study Leader: {user?.firstName} {user?.lastName} · Status: <span className="uppercase font-bold text-[#ffa400]">{group.status}</span></p>
                    </div>
                    <button
                      onClick={() => router.push("/student/documents")}
                      className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-extrabold rounded-xl text-sm shadow-xs transition cursor-pointer active:scale-[0.98]"
                    >
                      Open Document Workspace
                    </button>
                  </div>
                )}

                {/* EXACT STUDENT CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-users" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">Research Group Status</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{group ? `${group.name} (${group.status})` : "Not Registered"}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-brain" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">Adviser Recs</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{aiMatches.length > 0 ? `${aiMatches[0].name} (${aiMatches[0].match}%)` : "None yet"}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-file-text" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">Submitted Documents</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{combinedSubmissions.length} Uploads</span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar-event" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">Pending Consults</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{consultations.filter(c=>c.status==='pending' || c.status==='requested').length} Requested</span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex flex-col gap-2.5 justify-center min-h-[72px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg flex-shrink-0">
                        <i className="ti ti-target" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold leading-none">Milestone Progress</span>
                        <span className="text-[14.5px] font-extrabold text-[#1b4264] mt-1.5 block leading-none">{group ? `${projectProgress}% Complete` : "0% Complete"}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
                      <div 
                        className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-full rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${projectProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">Defense Schedule</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{defenses.length > 0 ? defenses[0].date : "Not Scheduled"}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-certificate" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">Certificate Status</span>
                      <span className="text-[15px] font-extrabold text-[#1b4264]">{group ? "Locked (Pending Defense)" : "Locked"}</span>
                    </div>
                  </div>
                </div>

                {/* Enhanced Bottom Cards: 4-card balanced grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Card 1: Active Study Information */}
                  <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-school text-[#ffa400]" />
                          Study Overview
                        </span>
                        <Tag variant={group ? "success" : "info"}>{group ? "Enrolled" : "Draft"}</Tag>
                      </div>
                      <h4 className="font-extrabold text-[#1b4264] text-lg leading-snug line-clamp-2">
                        {group?.projectTitle || "No project registered yet"}
                      </h4>
                      <div className="text-xs text-slate-500 flex flex-col gap-1 mt-1">
                        <div><strong className="text-slate-700">Team:</strong> {group?.members?.length > 0 ? group.members.join(", ") : `${user?.firstName || "Student"} ${user?.lastName || ""}`}</div>
                        <div><strong className="text-slate-700">Adviser:</strong> {group?.adviser || "Not Assigned"}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => group ? router.push("/student/documents") : handleTabChange("group")}
                      className="w-full py-2 bg-slate-100 hover:bg-[#1b4264] hover:text-[#ffa400] text-slate-700 text-sm font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <i className="ti ti-arrow-right text-xs" />
                      <span>{group ? "Open Workspace" : "Manage Group"}</span>
                    </button>
                  </div>

                  {/* Card 2: Upcoming Milestones */}
                  <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-timeline text-[#ffa400]" />
                          Workflow Milestones
                        </span>
                        <span className="text-xs font-bold text-slate-400">{milestones.length} Tasks</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {milestones.length > 0 ? (
                          milestones.slice(0, 2).map(m => (
                            <div key={m.id} className="flex justify-between items-center gap-2 text-[12px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
                              <span className="min-w-0"><span className="block truncate text-xs font-extrabold uppercase tracking-wide text-slate-400">{m.topicTitle}</span><span className="block truncate font-bold text-[#1b4264]">{m.title}</span></span>
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
                      className="w-full py-2 bg-slate-100 hover:bg-[#1b4264] hover:text-[#ffa400] text-slate-700 text-sm font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <i className="ti ti-list-details text-xs" />
                      <span>View All Milestones</span>
                    </button>
                  </div>

                  {/* Card 3: Next Consultation & Google Meet */}
                  <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-calendar-event text-[#ffa400]" />
                          Next Consultation
                        </span>
                        <Tag variant={consultations.length > 0 ? "success" : "info"}>{consultations.length > 0 ? "Scheduled" : "None"}</Tag>
                      </div>
                      {consultations.length > 0 ? (
                        <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg flex flex-col gap-1 text-[12px]">
                          <span className="font-bold text-[#1b4264] truncate">{consultations[0].topic}</span>
                          <span className="text-xs text-slate-500">{consultations[0].date} · {consultations[0].time}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          No upcoming consultations booked yet.
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleTabChange("consultations")}
                      className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <i className="ti ti-plus font-bold text-xs" />
                      <span>Book Consultation</span>
                    </button>
                  </div>

                  {/* Card 4: Quick Collaboration Tools */}
                  <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs flex flex-col justify-between gap-4 hover:border-[#1b4264]/40 transition">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#1b4264] flex items-center gap-1.5">
                          <i className="ti ti-bolt text-[#ffa400]" />
                          Quick Actions
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">Shortcuts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => router.push("/student/documents")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-file-text text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-sm font-bold text-[#1b4264] block">Editor</span>
                          <span className="text-sm text-slate-400">Draft Chapters</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("group-chats")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-messages text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-sm font-bold text-[#1b4264] block">Group Chat</span>
                          <span className="text-sm text-slate-400">Message Team</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("submissions")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-upload text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-sm font-bold text-[#1b4264] block">Submit Draft</span>
                          <span className="text-sm text-slate-400">Upload Files</span>
                        </button>
                        <button
                          onClick={() => handleTabChange("defense")}
                          className="p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
                        >
                          <i className="ti ti-calendar text-[#1b4264] text-sm block mb-0.5" />
                          <span className="text-sm font-bold text-[#1b4264] block">Defense</span>
                          <span className="text-sm text-slate-400">View Schedule</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ),
            profile: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">Student profile Info</h3>
                <p className="text-base text-slate-400 font-bold">Edit your student representative details, institutional identity cards, and department classifications.</p>
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
            "my-group": (
              <section className="student-projects-readable space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs">
                <div><h3 className="text-xl font-bold text-[var(--color-text-primary)]">My Group</h3><p className="mt-1 text-base text-[var(--color-text-secondary)]">View your teammates and manage invitations, membership, and group access. These settings apply to the selected project.</p></div>
                {!activeProject && (researchData?.projects?.length || 0) > 0 ? <p className="text-base text-[var(--color-text-secondary)]">Select a research project above to view its group.</p> : activeProject || activeWorkspace ? <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-lg font-bold text-[#102f49]">{activeProject ? activeProject.groupName || "Research team" : activeWorkspace?.name}</h4>
                    <p className="mt-1 text-base text-slate-600">{activeProject?.title || "Research project awaiting registration by your leader."}</p>
                    <p className="mt-2 text-sm font-semibold text-[#173f63]">Your role: {(activeProject ? isGroupLeader : isWorkspaceLeader) ? "Group Leader" : "Member"}</p>
                  </div>
                  {activeProject ? (
                      <div>
                        <div className="flex items-center justify-between"><h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Active researchers</h4><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{activeStudentMembers.length} member{activeStudentMembers.length === 1 ? "" : "s"}</span></div>
                        <div className="mt-3 space-y-2">{activeStudentMembers.map((member: any) => <div key={member.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-base font-bold text-[#102f49]">{member.user.firstName} {member.user.lastName}{(member.userId === user?.id || member.user?.id === user?.id) ? " (You)" : ""}</p><p className="text-base text-slate-500">{member.user.email} · {member.projectRole === "LEADER" ? "Group Leader" : "Member"}</p></div>{isGroupLeader && member.projectRole === "MEMBER" && <div className="flex gap-2"><button onClick={() => setGroupAction({ type: "transfer", member })} className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-700">Transfer leadership</button><button onClick={() => setGroupAction({ type: "remove", member })} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-bold text-rose-600">Remove</button></div>}</div>)}</div>
                      </div>
                  ) : <div><h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Group members</h4><div className="mt-3 space-y-2">{(activeWorkspace.members || []).filter((member: any) => !member.leftAt).map((member: any) => <div key={member.id} className="rounded-xl border border-slate-200 p-3"><p className="text-base font-bold text-[#102f49]">{member.user.firstName} {member.user.lastName}{member.userId === user?.id ? " (You)" : ""}</p><p className="text-base text-slate-500">{member.user.email} · {member.role === "LEADER" ? "Group Leader" : "Member"}</p></div>)}</div></div>}

                  {activeProject && <div className="flex flex-wrap gap-3"><button onClick={() => handleTabChange("group-chats")} className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-bold text-white">Group messages</button><button onClick={() => router.push(projectSelection.projectHref("/student/tasks"))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#173f63]">Tasks</button><button onClick={() => router.push(projectSelection.projectHref("/student/group-files"))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#173f63]">Shared files</button></div>}
                  {activeProject && <div className="space-y-4">{isGroupLeader && (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Group access</h4>
                            <label className="mt-3 block text-sm font-bold text-slate-600">Working arrangement<select value={projectParticipationMode} onChange={(event) => setProjectParticipationMode(event.target.value as "SOLO" | "GROUP")} className="mt-1.5 h-10 w-full rounded-lg border border-blue-200 bg-white px-3"><option value="SOLO">Solo</option><option value="GROUP">Group</option></select></label>
                            {projectParticipationMode === "GROUP" && <><label className="mt-3 block text-sm font-bold text-slate-600">How researchers can join<select value={projectAccessMode} onChange={(event) => setProjectAccessMode(event.target.value as typeof projectAccessMode)} className="mt-1.5 h-10 w-full rounded-lg border border-blue-200 bg-white px-3"><option value="INVITE_ONLY">Invite only</option><option value="PUBLIC_APPROVAL">Code access — leader approval</option><option value="PUBLIC_OPEN">Code access — join immediately</option></select></label><label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={projectInviteEnabled} onChange={(event) => setProjectInviteEnabled(event.target.checked)} />Accept joins using the current code</label></>}
                            <button onClick={handleSaveProjectAccess} disabled={projectAccessSaving} className="mt-4 rounded-lg bg-[#173f63] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50">{projectAccessSaving ? "Saving…" : "Save access settings"}</button>
                          </div>
                          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Invitation code and link</h4>
                            <p className="mt-1 text-base text-slate-600">Researchers review the group before joining or requesting approval.</p>
                            {inviteCode ? <div className="mt-3 space-y-2"><div className="rounded-lg bg-white p-3 font-mono text-sm font-bold text-[#173f63]">Code: {inviteCode}</div><div className="flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(inviteCode).then(() => triggerToast("Invite code copied."))} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700"><i className="ti ti-copy mr-1" />Copy code</button><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join-group?code=${inviteCode}`).then(() => triggerToast("Shareable link copied."))} className="rounded-lg bg-[#173f63] px-3 py-2 text-sm font-extrabold text-white"><i className="ti ti-link mr-1" />Copy link</button><button onClick={handleCreateInvite} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">Rotate code</button></div></div> : <button onClick={handleCreateInvite} className="mt-3 rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white"><i className="ti ti-user-plus mr-1" />Create invitation</button>}
                          </div>
                        </div>
                      )}

                      {isGroupLeader && pendingJoinRequests.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center justify-between"><div><h4 className="font-extrabold text-[#102f49]">Pending join requests</h4><p className="mt-1 text-base text-slate-600">Approve only researchers who should receive this project’s workflow and files.</p></div><span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-extrabold text-amber-900">{pendingJoinRequests.length}</span></div><div className="mt-3 space-y-2">{pendingJoinRequests.map((request: any) => <div key={request.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-base font-bold text-[#102f49]">{request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "Researcher"}</p><p className="text-base text-slate-500">{request.requester?.email} · Requested {new Date(request.createdAt).toLocaleDateString()}</p></div><div className="flex gap-2"><button onClick={() => decideJoinRequest(request.id, "REJECT")} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-bold text-rose-700">Reject</button><button onClick={() => decideJoinRequest(request.id, "ACCEPT")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-extrabold text-white">Accept</button></div></div>)}</div></div>
                      )}</div>}
                  {!activeProject && isWorkspaceLeader && activeWorkspace?.participationMode === "GROUP" && <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"><h4 className="font-semibold text-[var(--color-text-primary)]">Workspace invitation</h4><p className="mt-2 font-mono text-base text-[var(--color-primary)]">{activeWorkspace.inviteCode}</p><button type="button" onClick={() => navigator.clipboard.writeText(activeWorkspace.inviteCode).then(() => triggerToast("Invite code copied."))} className="mt-3 text-sm font-semibold text-[var(--color-primary)] hover:underline">Copy code</button></div>}
                  {!activeProject && canDeleteWorkspace && <button onClick={() => { setWorkspaceDeleteError(""); setWorkspaceToDelete({ id: activeWorkspace.id, name: activeWorkspace.name }); }} className="rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-extrabold text-rose-700 hover:bg-rose-50"><i className="ti ti-trash mr-1" />Delete workspace</button>}
                  {activeProject && !isGroupLeader && currentMembership && <button onClick={() => setGroupAction({ type: "leave" })} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-700">Leave group</button>}
                </> : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center"><p className="text-base text-slate-500">{isWorkspaceLoading ? "Loading your group…" : !workspaceData ? "Unable to load your group. Refresh to try again." : "You have not joined a research group yet."}</p>{workspaceData && <button onClick={() => handleTabChange("group")} className="mt-4 rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-bold text-white">Open My Project</button>}</div>}
              </section>
            ),
            group: (
              <div className="space-y-5">
                {activeProject ? (
                  <StudentProjectOverview
                    project={activeProject}
                    isLeader={isGroupLeader}
                    workflowName={activeProject.workflowInstance?.workflow?.name}
                    coordinator={activeWorkflowEnrollment?.workflow?.creator ? [activeWorkflowEnrollment.workflow.creator.firstName, activeWorkflowEnrollment.workflow.creator.lastName].filter(Boolean).join(" ") || activeWorkflowEnrollment.workflow.creator.email : undefined}
                    academicYear={activeProject.academicYear?.name}
                    teamName={activeProject.groupName || (activeStudentMembers.length === 1 ? "Solo research" : "Research team")}
                    memberCount={activeStudentMembers.length}
                    progress={projectProgress}
                    milestones={manuscriptWorkflowData?.milestones}
                    loading={isMilestoneLoading}
                    error={isMilestoneError}
                    defenseSession={currentDefenseSession}
                    onAction={handleProjectAction}
                    onGroup={() => handleTabChange("my-group")}
                    onArchive={() => setGroupAction({ type: "disband" })}
                    adviser={<div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Faculty Adviser</h4>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${activeAdviserMembership ? "bg-emerald-200 text-emerald-900" : pendingAdviserRequest ? "bg-amber-200 text-amber-900" : "bg-white text-slate-600"}`}>
                                {activeAdviserMembership ? "ASSIGNED" : pendingAdviserRequest ? "PENDING" : latestAdviserRequest?.status || "NOT ASSIGNED"}
                              </span>
                            </div>

                            {activeAdviserMembership ? (
                              <div className="mt-3">
                                <p className="text-base font-extrabold text-[#102f49]">{activeAdviserMembership.user.firstName} {activeAdviserMembership.user.lastName}</p>
                                <p className="mt-1 text-base text-slate-600">{activeAdviserMembership.user.email} · Adviser for the entire research project</p>
                                <p className="mt-2 text-base text-emerald-800">Assigned {activeAdviserMembership.joinedAt ? new Date(activeAdviserMembership.joinedAt).toLocaleDateString() : "to your group"}</p>
                              </div>
                            ) : pendingAdviserRequest ? (
                              <div className="mt-3">
                                <p className="text-base font-extrabold text-[#102f49]">{pendingAdviserRequest.adviser?.firstName} {pendingAdviserRequest.adviser?.lastName}</p>
                                <p className="mt-1 text-base text-slate-600">Request sent {new Date(pendingAdviserRequest.createdAt).toLocaleString()}</p>
                                {pendingAdviserRequest.note && <p className="mt-2 whitespace-pre-line text-base text-slate-600">{pendingAdviserRequest.note}</p>}
                                {!isGroupLeader && <p className="mt-2 text-base font-semibold text-amber-800">Your group leader manages this request.</p>}
                              </div>
                            ) : (
                              <div className="mt-3">
                                <p className="text-base font-extrabold text-[#102f49]">No adviser assigned</p>
                                <p className="mt-1 text-base text-slate-600">{isGroupLeader ? "Browse verified advisers for your program and send one formal request." : "Your group leader can browse the adviser pool and send a request."}</p>
                                {latestAdviserRequest && ["REJECTED", "CANCELLED"].includes(latestAdviserRequest.status) && (
                                  <div className="mt-3 rounded-xl bg-white p-3 text-xs">
                                    <p className="font-bold text-slate-700">Previous request: {latestAdviserRequest.status.toLowerCase()}</p>
                                    <p className="mt-1 text-slate-500">{latestAdviserRequest.adviser?.firstName} {latestAdviserRequest.adviser?.lastName}{latestAdviserRequest.respondedAt ? ` · ${new Date(latestAdviserRequest.respondedAt).toLocaleDateString()}` : ""}</p>
                                    {latestAdviserRequest.responseNote && <p className="mt-1 text-slate-600">{latestAdviserRequest.responseNote}</p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {isGroupLeader && !activeAdviserMembership && (
                            <div className="flex shrink-0 flex-wrap gap-2">
                              {pendingAdviserRequest ? (
                                <button onClick={cancelAdviserRequest} disabled={adviserCancelPending} className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-extrabold text-rose-700 disabled:opacity-50">
                                  {adviserCancelPending ? "Cancelling…" : "Cancel request"}
                                </button>
                              ) : (
                                <button onClick={() => router.push("/student/adviser-pool")} className="text-sm font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline">
                                  <i className="ti ti-user-search mr-1.5" />Browse adviser pool
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>}
                    titleHistory={<div className="mt-4">{Array.isArray(activeProject.titleRevisions) && activeProject.titleRevisions.length > 0 && (
                        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-extrabold text-[#102f49]">Title revision history ({activeProject.titleRevisions.length})</summary><div className="mt-3 space-y-2">{activeProject.titleRevisions.map((revision: any) => <div key={revision.id} className="rounded-lg bg-slate-50 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[#102f49]">{revision.proposedTitle}</strong><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">{revision.status}</span></div><p className="mt-1 text-slate-500">Previous: {revision.previousTitle}</p>{revision.reason && <p className="mt-1 text-slate-600">Reason: {revision.reason}</p>}<p className="mt-1 text-base text-slate-400">{new Date(revision.createdAt).toLocaleString()}</p></div>)}</div></details>
                      )}</div>}
                  />
                ) : (researchData?.projects?.length || 0) > 0 ? (
                  <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><h2 className="text-xl font-bold text-[var(--color-text-primary)]">Select a research project</h2><p className="mt-2 text-base text-[var(--color-text-secondary)]">Use the project selector above to view the correct title, workflow, and next step.</p></section>
                ) : (
                  <section className="student-projects-readable rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Research title not added</h2>
                    <p className="mt-2 text-base text-[var(--color-text-secondary)]">{activeWorkspace && !isWorkspaceLeader ? "Your leader will register the project after joining a workflow. View your teammates in My Group." : "Create or join a workspace, then register your research title after joining your professor’s workflow."}</p>
                    {activeWorkspace ? (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div><p className="text-sm font-extrabold uppercase tracking-widest text-[#C58A18]">{activeWorkspace.participationMode === "GROUP" ? "Research group" : "Solo workspace"}</p><h4 className="mt-1 text-lg font-extrabold text-[#102f49]">{activeWorkspace.name}</h4><p className="mt-1 text-base text-slate-500">{activeWorkspace.program?.code || activeWorkspace.program?.name} · {activeWorkspace.members?.length || 1} member{(activeWorkspace.members?.length || 1) === 1 ? "" : "s"}</p></div>
                          <div className="flex flex-wrap gap-2">
                            {canCreateResearch && !activeWorkspace.projects?.length && <button onClick={() => { setCreateTitle(""); setShowCreateModal(true); }} className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white"><i className="ti ti-plus mr-1" />Add research project</button>}
                          </div>
                        </div>
                        {activeWorkspace.projects?.length > 0 && <div className="mt-4 space-y-2">{activeWorkspace.projects.map((project: any) => <div key={project.id} className="flex items-center justify-between rounded-xl bg-white p-3"><span className="text-sm font-bold text-[#102f49]">{project.title}</span><span className="text-xs font-bold text-slate-500">{project.status}</span></div>)}</div>}
                      </div>
                    ) : isWorkspaceLoading || !workspaceData ? (
                      <p className="mt-5 text-base text-slate-500">{isWorkspaceLoading ? "Loading your workspace…" : "Unable to load your workspace. Refresh to try again."}</p>
                    ) : (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <button onClick={() => { setCreateTitle(""); setCreateGroupName(""); setShowCreateModal(true); }} className="rounded-2xl border-2 border-[#173f63] bg-[#173f63] p-6 text-left text-white transition hover:-translate-y-0.5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><i className="ti ti-folder-plus text-xl text-[#ffa400]" /></span><span className="mt-4 block text-base font-extrabold">Create a workspace</span><span className="mt-1 block text-sm leading-5 text-blue-100">Start Solo or create a group. Add a research title now or later.</span></button>
                        <button onClick={() => router.push("/join-group")} className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#173f63]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100"><i className="ti ti-users-plus text-xl text-[#173f63]" /></span><span className="mt-4 block text-base font-extrabold text-[#102f49]">Join a group</span><span className="mt-1 block text-sm leading-5 text-slate-500">Enter a group invitation code to join a research workspace.</span></button>
                      </div>
                    )}
                    {activeWorkspace && <button type="button" onClick={() => handleTabChange("my-group")} className="mt-5 text-sm font-semibold text-[var(--color-primary)] hover:underline">View My Group →</button>}
                  </section>
                )}
              </div>
            ),
            "adviser-credentials": (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">Adviser Credentials Hub</h3>
                <p className="text-base text-slate-400 font-bold">Adviser credentials now come from verified institutional accounts instead of sample profiles.</p>
                <button onClick={() => isGroupLeader ? router.push("/student/adviser-pool") : handleTabChange("group")} className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-left transition hover:border-[#f6a800]"><span><span className="block text-sm font-extrabold text-[#102f49]">{isGroupLeader ? "Open Verified Adviser Pool" : "View Adviser Status"}</span><span className="mt-1 block text-sm text-slate-600">{isGroupLeader ? "Browse active advisers and send the project’s formal request." : "Adviser selection is managed by your group leader in My Project."}</span></span><i className="ti ti-arrow-right text-xl text-[#173f63]" /></button>
              </div>
            ),
            "ai-recommendation": (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">AI Adviser Recommendation</h3>
                <p className="text-base text-slate-400 font-bold">Generate optimized matches based on topic alignment algorithms.</p>
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
                      className="px-4 py-2 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] font-extrabold rounded-lg shadow-xs border border-[var(--color-primary)]"
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
                <h3 className="font-extrabold text-[#1b4264] text-lg">In-App Voice and Video Group Conferencing</h3>
                <p className="text-base text-slate-400 font-bold">Coordinate with peers and advisers using localized sandbox stream channels.</p>
                
                {!isMeetingActive ? (
                  <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl text-center flex flex-col gap-4 shadow-sm">
                    <div className="w-16 h-16 bg-[#1b4264]/10 rounded-full flex items-center justify-center mx-auto text-[#1b4264]">
                      <i className="ti ti-video text-3xl animate-pulse" />
                    </div>
                    <div>
                      <span className="font-bold text-[#1b4264] text-[14px] block">Live Stream Channels Ready</span>
                      <span className="text-xs text-slate-400">Current Room ID: <strong>{group?.name || "Research Room"}</strong></span>
                    </div>
                    <button 
                      onClick={() => handleStartConference("https://meet.google.com/new", `${group?.name || "Research"} Study Stream`)} 
                      className="px-5 py-2.5 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] font-extrabold rounded-lg shadow-xs border border-[var(--color-primary)] self-center cursor-pointer transition-colors flex items-center gap-2"
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
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Call Duration</span>
                      <span className="font-mono text-3xl font-black text-[#1b4264] tracking-tight">{formatMeetingTime(meetingDuration)}</span>
                      <span className="text-xs text-slate-500 mt-1">Google Meet session is running in floating window</span>
                    </div>

                    {/* LIVE ATTENDEES LIST */}
                    <div className="bg-white/80 border border-emerald-200/80 rounded-xl p-3.5 max-w-lg mx-auto w-full text-left shadow-sm">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-2.5">
                        <span className="text-xs font-extrabold text-[#1b4264] flex items-center gap-1.5">
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
                          <div key={p.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-emerald-50/50 transition">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#1b4264] text-[#ffa400] text-xs font-black flex items-center justify-center">
                                {p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block leading-tight">{p.name}</span>
                                <span className="text-xs text-slate-500">{p.role} · {p.email}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {p.joinedAt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 mt-2">
                      <button
                        onClick={handleReopenMeetingWindow}
                        className="px-4 py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-bold rounded-lg shadow cursor-pointer transition flex items-center gap-2 text-sm"
                      >
                        <i className="ti ti-external-link" />
                        <span>Reopen Meeting Window</span>
                      </button>

                      <button
                        onClick={() => handleEndConference()}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow cursor-pointer transition flex items-center gap-2 text-sm"
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
              <div className="flex flex-col gap-5">
                <StudentGanttChart project={activeProject} milestoneProgress={manuscriptWorkflowData?.milestones || []} />
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Recorded research activity</h3>
                  <p className="mt-1 text-base text-[var(--color-text-secondary)]">Actual events from manuscript, milestone, consultation, defense, and official-copy records. The Gantt chart above remains the planned schedule.</p>
                  <div className="mt-4 space-y-2">
                    {(manuscriptWorkflowData?.activity || []).slice(0, 12).map((event: any) => {
                      const href = event.documentId
                        ? projectSelection.projectHref(`/student/documents?documentId=${event.documentId}${event.versionId ? `&versionId=${event.versionId}` : ""}`)
                        : event.defenseSessionId
                          ? projectSelection.projectHref(`/student/defense/${event.defenseSessionId}`)
                          : event.consultationId
                            ? projectSelection.projectHref(`/student/dashboard?tab=consultations&consultationId=${event.consultationId}`)
                            : event.milestoneId
                              ? projectSelection.projectHref(`/student/documents?tab=milestones&milestoneId=${event.milestoneId}`)
                              : null;
                      const content = <><span className="min-w-0"><span className="block text-sm font-semibold text-[var(--color-text-primary)]">{event.title}</span><span className="block truncate text-xs text-[var(--color-text-secondary)]">{event.description}</span></span><time className="shrink-0 text-xs text-[var(--color-text-muted)]">{new Date(event.timestamp).toLocaleString()}</time></>;
                      return href ? <button key={event.id} type="button" onClick={() => router.push(href)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-3 text-left hover:border-[var(--color-primary)]">{content}</button> : <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-3">{content}</div>;
                    })}
                    {!manuscriptWorkflowData?.activity?.length && <p className="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-center text-base text-[var(--color-text-secondary)]">No recorded workflow activity for this project yet.</p>}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                  <h3 className="font-extrabold text-[#1b4264] text-lg">Milestone Details</h3>
                  <p className="text-base text-slate-400 font-bold">Review the professor-defined sequence, target dates, approval gates, and current status.</p>
                  <div className="flex flex-col gap-2.5 mt-2">
                  {milestones.length > 0 ? (
                    milestones.map((m, index) => (
                      <React.Fragment key={m.id}>
                      {(index === 0 || milestones[index - 1]?.topicId !== m.topicId) && <div className="mt-3 flex items-center gap-2 first:mt-0"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1b4264] text-white"><i className="ti ti-folders text-xs" /></span><span className="text-xs font-extrabold uppercase tracking-wide text-[#1b4264]">{m.topicTitle}</span></div>}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-start gap-4 text-[12.5px] shadow-sm">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-[#1b4264] block">{m.sequence}. {m.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{m.category} · {formatMilestoneTarget(m)}{m.requiresApproval ? " · Adviser approval required" : ""}</span>
                          {m.description && <p className="mt-2 whitespace-pre-wrap text-base leading-5 text-slate-600">{m.description}</p>}
                        </div>
                        <Tag variant={m.status === 'completed' ? 'success' : m.status === 'in-progress' ? 'warn' : 'info'}>{m.status}</Tag>
                      </div>
                      </React.Fragment>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No project milestones recorded. Register your research study to initiate workflow.
                    </div>
                  )}
                  </div>
                </div>
              </div>
            ),
            consultations: renderConsultationsHub(),
            "consultation-repo": renderConsultationsHub(),
            "consultation-requests": renderConsultationsHub(),
            progress: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">Progress Tracking Dashboard</h3>
                <p className="text-base text-slate-400 font-bold">Visual status indicators showing project workflow completion.</p>
                <div className="bg-slate-50 p-6 border border-slate-200 rounded-2xl mt-2 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-center text-[13px] font-extrabold text-[#1b4264]">
                    <span>Overall Study Progression</span>
                    <span className="bg-[#1b4264]/10 text-[#1b4264] px-2.5 py-0.5 rounded text-xs font-extrabold font-mono">{projectProgress}% COMPLETE</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-4 p-1 overflow-hidden border border-slate-300/40 shadow-inner flex items-center">
                    <div 
                      className="bg-gradient-to-r from-[#1b4264] to-[#ffa400] h-2.5 rounded-full transition-all duration-500 ease-out animate-pulse shadow-sm" 
                      style={{ width: `${projectProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 font-medium leading-relaxed mt-1 flex items-center gap-1.5">
                    <i className="ti ti-info-circle text-[#1b4264]" />
                    <span>{group ? `Current Milestone: ${activeProject?.workflowInstance?.currentStage?.name || "Not started"}` : "Register your research study to begin tracking milestones."}</span>
                  </div>
                </div>
              </div>
            ),
            defense: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">Defense Schedule Viewing</h3>
                <p className="text-base text-slate-400 font-bold">Review defense panel timings, assignees, and digital venues.</p>
                {defenses.length > 0 ? (
                  defenses.map(d => (
                    <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] flex flex-col gap-2 mt-2 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[#1b4264] text-[14px]">{d.title}</span>
                        <Tag variant={d.status === "SCHEDULED" ? "success" : d.status === "NEEDS_RESCHEDULING" ? "danger" : "warn"}>{d.type}</Tag>
                      </div>
                      <div className="text-slate-500 font-medium">
                        <div><strong>Date / Time:</strong> {d.date} at {d.time}</div>
                        <div><strong>Venue:</strong> {d.venue}</div>
                        <div><strong>Panelists:</strong> {d.panelists?.join(", ")}</div>
                        {d.meetingUrl && d.status === "SCHEDULED" && <div><strong>Meeting:</strong> <a href={d.meetingUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">Open meeting link</a></div>}
                        {d.status === "PENDING_ACKNOWLEDGEMENT" && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-base text-amber-800">The proposed schedule is awaiting confirmation from required panel members.</p>}
                        {d.status === "NEEDS_RESCHEDULING" && <p className="mt-2 rounded-lg bg-blue-50 p-2 text-base text-blue-800">The professor is adjusting the schedule. Private decline reasons are not shown to the group.</p>}
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
                    <h3 className="font-extrabold text-[#1b4264] text-lg">Consultation History & Transcript Archive</h3>
                    <p className="text-base text-slate-400 font-bold">Review historical meeting schedules, faculty advice, and Google Meet chat records.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
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
                            <span className="text-xs text-slate-500 font-medium block mt-0.5">
                              {c.groupName || "Research Consultation"} · {c.date} at {c.time} ({c.mode})
                            </span>
                          </div>

                          <button
                            onClick={() => handleOpenTranscriptModal(c)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-[#1b4264] font-bold rounded-lg border border-slate-300 text-sm shadow-sm cursor-pointer self-start sm:self-auto transition"
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
                              <span className="text-xs text-slate-400 font-mono">Auto-Indexed</span>
                            </div>
                            <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
                              {c.transcript.map((msg: any) => (
                                <div key={msg.id} className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
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
                <h3 className="font-extrabold text-[#1b4264] text-lg">Notifications & Announcements</h3>
                <p className="text-base text-slate-400 font-bold">Real-time alerts, chapter approvals, and institutional announcements.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {combinedNotifications.length > 0 ? (
                    combinedNotifications.map(n => (
                      <div key={n.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[12px] shadow-sm">
                        <div>
                          <span className="font-bold text-[#1b4264] block">{n.msg}</span>
                        </div>
                        <span className="text-slate-400 font-bold text-xs">{n.date}</span>
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
                <h3 className="font-extrabold text-[#1b4264] text-lg">Certificates of Completion</h3>
                <p className="text-base text-slate-400 font-bold">Access and download QR-verified Certificates of Completion.</p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] flex items-center justify-between mt-2 shadow-sm">
                  <div>
                    <span className="font-bold text-[#1b4264] block">Certificate of Completion (Pending)</span>
                    <span className="text-xs text-slate-400">Available once final oral grading has been submitted.</span>
                  </div>
                  <button 
                    onClick={() => setModalCert(true)} 
                    className="px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-extrabold rounded-lg border border-[var(--color-primary)] shadow-xs cursor-pointer transition-colors"
                  >
                    View Status
                  </button>
                </div>
              </div>
            ),
            settings: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">Portal Settings</h3>
                <p className="text-base text-slate-400 font-bold">Manage your notification channels, authentication credentials, and user preferences.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-[#1b4264] block">Email Notifications</span>
                      <span className="text-xs text-slate-400">Receive system notifications via email address.</span>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-[#ffa400] w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[#1b4264] block">Dark Mode</span>
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
              <StudentGroupChats triggerToast={triggerToast} />
            ),
            chat: (
              <StudentGroupChats triggerToast={triggerToast} />
            ),
            workspace: (
              <FilesPageSkeleton className="p-4 sm:p-4 lg:p-4" />
            ),
          };

          return activeTab === "group" && projectSection === "my-group" ? tabContent["my-group"] : tabContent[activeTab] || tabContent.overview;
        })()}

      </div>

      {/* ─── MODALS ─── */}
      {modalCert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-t-4 border-[#1b4264] max-w-md w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4">
            <h3 className="font-extrabold text-[#1b4264] text-lg flex items-center gap-2">
              <i className="ti ti-certificate text-[#ffa400] text-xl" />
              Certificate Completion Verification
            </h3>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center flex flex-col gap-3 shadow-inner">
              <div className="font-extrabold text-[#1b4264] text-[14px]">Verification: In Progress</div>
              <div className="w-24 h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center mx-auto shadow-sm relative">
                <i className="ti ti-qrcode text-5xl text-slate-350" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ffa400] rounded-full border border-white" />
              </div>
              <p className="text-base text-slate-500 leading-relaxed font-bold">
                Lock status: Locked. Oral evaluation sheet verification signature must be processed by the administrative panel.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button onClick={()=>setModalCert(false)} className="px-4 py-2 border border-slate-350 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-700 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {workspaceToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" onKeyDown={(event) => {
          if (event.key === "Escape" && !workspaceDeletePending) setWorkspaceToDelete(null);
          if (event.key === "Tab") {
            const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="workspace-delete-title" aria-describedby="workspace-delete-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="workspace-delete-title" className="text-lg font-extrabold text-[#102f49]">Delete workspace?</h2>
            <p id="workspace-delete-description" className="mt-2 text-base leading-6 text-slate-600">The workspace “{workspaceToDelete.name}” will be permanently deleted for all members and its invitation code will stop working. This cannot be undone.</p>
            {workspaceDeleteError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{workspaceDeleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button autoFocus onClick={() => setWorkspaceToDelete(null)} disabled={workspaceDeletePending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50">Cancel</button>
              <button onClick={deleteWorkspace} disabled={workspaceDeletePending} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-rose-700 disabled:opacity-50">{workspaceDeletePending ? "Deleting…" : "Delete workspace"}</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RESEARCH PROJECT MODAL */}
      {showCreateModal && canCreateResearch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl animate-fade-in-up flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#1b4264] text-lg flex items-center gap-2">
                <i className="ti ti-folder-plus text-[#ffa400] text-xl" />
                {activeWorkspace ? "Add research project" : "Create research workspace"}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            <form onSubmit={handleCreateResearch} className="flex flex-col gap-4 text-xs">
              {!activeWorkspace && <fieldset>
                <legend className="font-bold text-slate-700">How will you conduct this research?</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {([
                    { value: "SOLO", title: "Work solo", text: "Start with one researcher. You can convert it to a group later.", icon: "ti-user" },
                    { value: "GROUP", title: "Create a group", text: "Become the leader and invite researchers using a code or link.", icon: "ti-users-group" },
                  ] as const).map((option) => (
                    <button key={option.value} type="button" onClick={() => setCreateParticipationMode(option.value)} className={`rounded-xl border-2 p-4 text-left transition ${createParticipationMode === option.value ? "border-[#173f63] bg-blue-50" : "border-slate-200 bg-white"}`}>
                      <i className={`ti ${option.icon} text-xl text-[#173f63]`} />
                      <span className="mt-2 block font-extrabold text-[#102f49]">{option.title}</span>
                      <span className="mt-1 block text-sm leading-4 text-slate-500">{option.text}</span>
                    </button>
                  ))}
                </div>
              </fieldset>}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Research title {!activeWorkspace && <span className="font-normal text-slate-400">(optional — you can add it later)</span>}</label>
                <input
                  type="text"
                  placeholder="e.g. Real-Time Water Quality Monitoring Using IoT"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="p-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-[#ffa400]"
                />
              </div>
              {needsRegistrationWorkflow && (
                isWorkflowEnrollmentLoading ? (
                  <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Checking your workflow enrollment…</p>
                ) : !hasRegistrationWorkflow ? (
                  <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-bold"><i className="ti ti-alert-triangle mr-1.5" />{isWorkflowEnrollmentError ? "Unable to verify workflow enrollment" : "Join a workflow first"}</p>
                    <p className="mt-1">{isWorkflowEnrollmentError ? "Your enrollment could not be checked. Open Tasks & Requirements to verify your workflow before creating a research project." : "You cannot create a research project until you join your professor’s workflow in Tasks & Requirements."}</p>
                    <button type="button" onClick={() => { setShowCreateModal(false); handleTabChange("tasks"); }} className="mt-3 font-bold underline underline-offset-2">Open Tasks &amp; Requirements</button>
                  </div>
                ) : (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">This project will use your {workflowEnrollmentData!.enrollments.length > 1 ? "most recently joined workflow" : "joined workflow"}: <strong>{registrationWorkflow?.name || "Research workflow"}</strong>.</p>
                )
              )}
              {!activeWorkspace && <div className="grid gap-4 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 font-bold text-slate-700">
                  {createParticipationMode === "GROUP" ? "Group name" : "Workspace name"}
                  <input type="text" required maxLength={120} value={createGroupName} onChange={(event) => setCreateGroupName(event.target.value)} placeholder={createParticipationMode === "GROUP" ? "e.g. Team Innovators" : "e.g. My Thesis Workspace"} className="rounded-xl border border-blue-200 bg-white p-3 font-normal text-slate-800 outline-none focus:border-[#173f63]" />
                </label>
                {createParticipationMode === "GROUP" && <label className="flex flex-col gap-1.5 font-bold text-slate-700">
                  Joining permission
                  <select value={createAccessMode} onChange={(event) => setCreateAccessMode(event.target.value as typeof createAccessMode)} className="h-[42px] rounded-xl border border-blue-200 bg-white px-3 font-normal text-slate-800 outline-none focus:border-[#173f63]">
                    <option value="INVITE_ONLY">Invite code</option>
                    <option value="PUBLIC_OPEN">Open code joining</option>
                  </select>
                </label>}
              </div>}
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
                  disabled={isCreatingProject || (needsRegistrationWorkflow && !hasRegistrationWorkflow) || (activeWorkspace ? !createTitle.trim() : !createGroupName.trim())}
                  className="px-5 py-2 bg-[#1b4264] hover:bg-[#15344f] text-[#ffa400] font-extrabold rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {isCreatingProject ? "Creating..." : activeWorkspace ? "Create research project" : createTitle.trim() ? "Create workspace and project" : "Create workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditProjectModal && activeProject && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-t-4 border-[#1b4264] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[.16em] text-[#C58A18]">Project leader</p>
                <h3 className="mt-1 text-lg font-extrabold text-[#1b4264]">Edit project details</h3>
                <p className="mt-1 text-base text-slate-500">Revise a rejected title without losing the project, members, files, or workflow history.</p>
              </div>
              <button type="button" onClick={() => setShowEditProjectModal(false)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleSaveProjectDetails} className="mt-5 space-y-4">
              {activeProject.status === "REJECTED" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><strong>Title revision required.</strong> Saving a new title will move this project into Revision while preserving its existing academic record.</div>
              )}
              {activeProject.status === "APPROVED" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><strong>Approved title.</strong> A changed title will be submitted as a pending amendment and will not replace the official title until approved.</div>
              )}
              <label className="block text-sm font-bold text-slate-700">Research title *<input required minLength={5} value={editProjectTitle} onChange={(event) => setEditProjectTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base font-normal outline-none focus:border-[#173f63]" /></label>
              <label className="block text-sm font-bold text-slate-700">Group name <span className="font-normal text-slate-400">(optional)</span><input maxLength={120} value={groupNameInput} onChange={(event) => setGroupNameInput(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base font-normal outline-none focus:border-[#173f63]" /></label>
              <label className="block text-sm font-bold text-slate-700">Abstract / problem scope<textarea rows={4} value={editProjectAbstract} onChange={(event) => setEditProjectAbstract(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-base font-normal outline-none focus:border-[#173f63]" /></label>
              {editProjectTitle.trim() !== activeProject.title && (
                <label className="block text-sm font-bold text-slate-700">Reason for changing the title<textarea rows={3} value={editProjectReason} onChange={(event) => setEditProjectReason(event.target.value)} placeholder="Explain the rejection feedback or reason for the revised title." className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-base font-normal outline-none focus:border-[#173f63]" /></label>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowEditProjectModal(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="submit" disabled={editProjectSaving || !editProjectTitle.trim()} className="rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{editProjectSaving ? "Saving…" : activeProject.status === "APPROVED" && editProjectTitle.trim() !== activeProject.title ? "Submit title change" : "Save changes"}</button></div>
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
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentDashboardContent />
    </Suspense>
  );
}
