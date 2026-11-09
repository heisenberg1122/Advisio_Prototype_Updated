import { OverviewDefenseResult, OverviewGettingStarted } from "@/components/dashboards/student/overview/ResearchCommandCenter";
import { ResearcherComingUp, ResearcherHomeHero, ResearcherLatestUpdates, ResearcherNextStep, ResearcherWorkflows } from "@/components/dashboards/student/overview/ResearcherHome";
import { buildComingUp, buildJourney, buildLatestUpdates, memberInitials } from "@/lib/researcher-home";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { humanizeTimestamps } from "@/lib/project-overview-display";
import { WorkflowAccessInbox } from "@/components/workflow/WorkflowAccessInbox";
import { JoinedWorkflows } from "@/components/workflow/JoinedWorkflows";
import { resolveStudentWorkflow } from "@/lib/student-workflow-context";
import { TeamEmailInvitation } from "@/components/workflow/TeamEmailInvitation";
import React, { useState, Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { calculateMilestoneProgress } from "@/lib/workflow-progress";
import { formatMilestoneTarget } from "@/lib/workflow-deadlines";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { CardsPageSkeleton, DashboardSkeleton, FilesPageSkeleton, ListPageSkeleton, TablePageSkeleton } from "@/components/ui/Skeleton";
import "@/components/dashboards/student/my-project-workspace.css";
import "../student-screens.css";
import { EmptyNote, StatusDot } from "@/components/ui/advisio";
import { RoleBand, initials } from "@/components/dashboards/RoleScreenParts";
import { StudentProjectOverview } from "@/components/dashboards/student/StudentProjectOverview";
import { ProjectGroupPanel } from "@/components/dashboards/student/ProjectGroupPanel";
import {
  currentProjectMilestone, overviewDate, overviewStatus, pendingProjectRequirements, projectActivityHref,
  projectConsultationHref, projectSectionHref, resolveProjectNextStep, summarizeProjectDocuments,
  type OverviewDocument, type OverviewRecord, type ProjectAction, type ProjectActivity, type ProjectMilestoneProgress,
} from "@/lib/student-project-overview";
import { notificationLink } from "@/lib/notification-navigation";
import { studentTaskDetailsHref } from "@/lib/student-task-navigation";
import { StudentGroupChats } from "@/components/dashboards/student/StudentGroupChats";
import { ConsultationMeetingForm } from "@/components/consultations/ConsultationMeetingForm";
import { ConsultationBooking } from "@/components/consultations/ConsultationBooking";
import { joinConsultation } from "@/components/consultations/ConsultationActions";
import { GoogleMeetTranscriptModal, ParsedChatMessage } from "@/components/consultations/GoogleMeetTranscriptModal";
import {
  getPendingConsultationImports,
  recordConsultationImportReceipts,
  type ConsultationItem,
} from "@/lib/consultation-store";
import { StudentGanttChart } from "@/components/dashboards/student/StudentGanttChart";
import { ConsultationsHub } from "@/components/consultations/ConsultationsHub";
import { MilestoneDetails, RecordedActivity } from "@/components/dashboards/student/TimelineDetails";
import { getOrderedWorkflowStages } from "@/lib/workflow-progress";
import { useNotifications as useStudentNotifications } from "@/hooks/use-student";
import { useActiveProject } from "@/providers/active-project-provider";

function StudentDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "overview";
  const activeTab = requestedTab === "my-group" ? "group" : requestedTab;
  const requestedConsultationId = searchParams.get("consultationId");
  const projectSection = requestedTab === "my-group" || searchParams.get("section") === "my-group" ? "my-group" : "overview";
  useEffect(() => {
    if (requestedTab !== "my-group") return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", "group");
    params.set("section", "my-group");
    router.replace(`/student/dashboard?${params}`);
  }, [requestedTab, searchParams, router]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: apiNotifications = [] } = useStudentNotifications();

  // Auto-redirect if tab is workspace or documents to the modern /student/documents workspace
  useEffect(() => {
    if (activeTab === "workspace" || activeTab === "documents") {
      const params = new URLSearchParams(searchParams);
      params.delete("tab");
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

  const [instantMeetingOpen, setInstantMeetingOpen] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [selectedConsultationForTranscript, setSelectedConsultationForTranscript] = useState<ConsultationItem | null>(null);

  // Live query for consultations with background refresh
  const { data: consultationsApiData, refetch: refetchConsultations } = useQuery({
    queryKey: ["consultations", "researcher", user?.id, user?.college?.id],
    queryFn: () => apiClient.get<{ consultations: ConsultationItem[] }>("/api/consultations"),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const consultations = consultationsApiData?.consultations || [];

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
  const { data: workflowEnrollmentData, isLoading: isWorkflowEnrollmentLoading, isError: isWorkflowEnrollmentError, refetch: refetchEnrollments } = useQuery({
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
  const { data: dashboardDocumentData, isLoading: documentsLoading, isError: documentsError } = useQuery({
    queryKey: ["student-dashboard-documents", activeProject?.id],
    queryFn: () =>
      apiClient.get<{ documents: Array<OverviewDocument & { versions?: any[]; milestone?: { name: string }; documentType?: string }> }>(
        `/api/research/${activeProject.id}/documents`,
      ),
    enabled: Boolean(activeProject?.id),
    refetchOnWindowFocus: true,
  });
  const { activeEnrollment: activeWorkflowEnrollment, workflowProject } =
    resolveStudentWorkflow(workflowEnrollmentData?.enrollments || [], activeProject);
  const { data: manuscriptWorkflowResponse, isLoading: isMilestoneLoading, isError: isMilestoneError, refetch: refetchMilestones } = useQuery({
    queryKey: ["student-manuscript-workflow", activeProject?.id],
    queryFn: () => apiClient.get<{ milestones: Array<ProjectMilestoneProgress & { completed: boolean; status: string; totalRequirements: number; completedRequirements: number; completionPercent: number }>; activity: ProjectActivity[] }>(`/api/research/${activeProject.id}/manuscript-workflow`),
    enabled: Boolean(workflowProject?.id),
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
  const manuscriptWorkflowData = workflowProject ? manuscriptWorkflowResponse : undefined;
  const progressLoading = Boolean(activeProject?.workflowInstance && (isWorkflowEnrollmentLoading || isMilestoneLoading));
  const progressError = isWorkflowEnrollmentError || isMilestoneError;
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
  const projectConsultations = (consultationsApiData?.consultations || []).filter(
    (item: ConsultationItem) => item.researchId === activeProject?.id,
  );
  const now = Date.now();
  const upcomingConsultations = (activeProject ? projectConsultations : []).filter(
    (item: ConsultationItem) =>
      ["scheduled", "confirmed"].includes(item.status) && Date.parse(item.scheduledStart || "") >= now,
  ).sort((a, b) => Date.parse(a.scheduledStart || "") - Date.parse(b.scheduledStart || ""));
  const upcomingConsultation = upcomingConsultations[0];
  const upcomingDefense = projectDefenseSessions.filter((session: { status: string; scheduledStart?: string }) =>
    session.status === "SCHEDULED" && Date.parse(session.scheduledStart || "") >= now,
  ).sort((a, b) => Date.parse(a.scheduledStart || "") - Date.parse(b.scheduledStart || ""))[0];
  const projectProgress = calculateMilestoneProgress(
    manuscriptWorkflowData?.milestones,
    Boolean(activeProject?.workflowInstance?.completedAt),
  );
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
    } else {
      setGroup(null);
    }
    if (workflowProject) {
      const authoritative = new Map((manuscriptWorkflowData?.milestones || []).map((milestone: any) => [milestone.id, milestone]));
      setMilestones(getOrderedWorkflowStages(workflowProject).map((stage) => ({
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
        requiredMilestone: authoritative.get(stage.id)?.requiredMilestone,
        isBlocked: authoritative.get(stage.id)?.isBlocked === true,
        sequence: stage.sequence,
        topicId: stage.topic?.id || null,
        topicTitle: stage.topic?.title || "Ungrouped milestones",
        description: stage.description || "",
        category: stage.category || "Milestone",
      })));
    } else if (activeWorkflowEnrollment?.workflow?.stages) {
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
      setMilestones([]);
    }
  }, [activeProject, activeWorkflowEnrollment, workflowProject, manuscriptWorkflowData?.milestones]);

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

  const handleCreateResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateResearch) {
      setShowCreateModal(false);
      triggerToast("Only your group leader can register the research project.");
      return;
    }
    if (activeProject) {
      setShowCreateModal(false);
      if (activeProject.workflowDraft) { openEditProject(); return; }
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
    const titleMilestone = activeProject.workflowInstance?.workflow?.stages?.find((stage: any) => stage.milestoneType === "TITLE_PROPOSAL" && stage.category !== "Archived");
    if (titleMilestone) { router.push(studentTaskDetailsHref(`milestone-${titleMilestone.id}`, activeProject.id)); return; }
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
    else if (action.kind === "retry") {
      if (workflowProject) void refetchMilestones();
      else void refetchEnrollments();
    }
    else handleTabChange(action.kind === "timeline" ? "milestones" : action.kind);
  };

  const consultationRef = useRef<HTMLLIElement>(null);
  const linkedConsultation = consultations.find(({ id }) => id === requestedConsultationId);
  useEffect(() => {
    if (!linkedConsultation || !["consultations", "consultation-repo", "consultation-requests"].includes(activeTab)) return;
    consultationRef.current?.focus({ preventScroll: true });
    consultationRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeTab, linkedConsultation?.id]);

  const consultationProjects = (researchData?.projects || []).filter((project) =>
    project.status !== "ARCHIVED" && project.members?.some((member: any) =>
      member.user?.id === user?.id && !member.leftAt && ["LEADER", "MEMBER"].includes(member.projectRole),
    ),
  );
  const renderConsultationsHub = () => (
    <ConsultationsHub
      consultations={consultations}
      projectTitle={activeProject?.title}
      linkedId={linkedConsultation?.id}
      linkedRef={consultationRef}
      booking={<ConsultationBooking key={activeProject?.id} projectId={activeProject?.id} projects={consultationProjects} />}
      onInstantMeet={() => setInstantMeetingOpen(true)}
      onJoin={(c) => void joinConsultation(c.id, triggerToast)}
      onNotes={(c) => handleOpenTranscriptModal(c)}
      onCopyLink={(c) => {
        if (!c.meetingUrl) return;
        navigator.clipboard.writeText(c.meetingUrl);
        triggerToast("Copied Google Meet link!");
      }}
    />
  );

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
                <h3 data-guide="submission-history-heading" className="font-extrabold text-[#1b4264] text-lg flex items-center gap-2">
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
                  className="submission-action w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-extrabold rounded-lg shadow transition cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
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

  const canStartProject = canCreateResearch && !researchData?.projects?.length;
  const homeNextStep = activeProject ? resolveProjectNextStep({
    project: activeProject,
    milestones: manuscriptWorkflowData?.milestones,
    loading: progressLoading,
    error: progressError,
    isLeader: isGroupLeader,
    defenseDecision: officialDefenseResult?.releasedAt ? officialDefenseResult.decision : null,
  }) : null;
  const homeDeadlines = activeProject && !progressError
    ? pendingProjectRequirements(activeProject, manuscriptWorkflowData?.milestones, now)
      .filter(({ dueAt, overdue, priority }) => dueAt && (overdue || dueAt.getTime() >= now) && priority < 3).slice(0, 4)
    : [];
  const projectActivity = activeProject && !activeProject.workflowAccessRemoved && !progressError
    ? (manuscriptWorkflowData?.activity || []).slice(0, 4).map((event) => ({
      id: event.id, title: event.title, detail: humanizeTimestamps(event.description), date: event.timestamp,
      href: projectActivityHref(event, activeProject.id),
    }))
    : [];
  const homeJourney = buildJourney(
    manuscriptWorkflowData?.milestones,
    activeProject ? currentProjectMilestone(activeProject, manuscriptWorkflowData?.milestones)?.id : undefined,
    Boolean(activeProject?.workflowInstance?.completedAt),
  );
  const homeLogoSrc = getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc;
  const homeMembers = activeStudentMembers.map((member: any) => ({ id: member.id, initials: memberInitials(member.user) }));
  const homeComingUp = buildComingUp([
    ...homeDeadlines.map((task) => ({
      id: task.id, kind: "deadline" as const, title: task.title, date: task.dueAt!,
      href: studentTaskDetailsHref(task.id, activeProject?.id),
    })),
    ...(activeProject ? upcomingConsultations.map((item: ConsultationItem) => ({
      id: item.id, kind: "consultation" as const, title: item.topic, date: item.scheduledStart, mode: item.mode,
      href: projectConsultationHref(activeProject.id, item.id),
    })) : []),
    ...(activeProject && upcomingDefense ? [{
      id: upcomingDefense.id, kind: "defense" as const, title: "Scheduled defense", date: upcomingDefense.scheduledStart,
      href: projectSelection.projectHref(`/student/defense/${upcomingDefense.id}`),
    }] : []),
  ], now);
  const homeUpdates = buildLatestUpdates([
    ...apiNotifications.map((notification: { id: string; title: string; message?: string; createdAt: string; actionUrl?: string; isRead?: boolean }) => ({
      id: notification.id, title: notification.title || notification.message, date: notification.createdAt,
      href: notificationLink(notification.actionUrl, "student"), unread: !notification.isRead,
    })),
    ...projectActivity.map(({ id, title, href, date }) => ({ id, title, date, href })),
  ]);
  const homeSetupSteps = [
    {
      label: activeProject || canStartProject ? "Register project" : "View group",
      icon: "ti-file-description",
      description: "View your project or register a research title.",
      complete: Boolean(activeProject?.registeredAt),
      onClick: () => !activeProject && canStartProject ? setShowCreateModal(true) : handleTabChange("group"),
    },
    {
      label: "Set up your group",
      icon: "ti-users",
      description: "Invite your team, if any.",
      complete: activeStudentMembers.length > 1,
      onClick: () => handleTabChange("my-group"),
    },
    {
      label: "Choose an adviser",
      icon: "ti-user-check",
      description: isGroupLeader ? "Browse verified faculty and send a formal request." : "View your project\u2019s adviser status.",
      complete: Boolean(activeAdviserMembership),
      onClick: () => isGroupLeader ? handleTabChange("adviser-pool") : handleTabChange("group"),
    },
  ];
  // The group step is optional because solo research is allowed.
  const homeSetupComplete = homeSetupSteps[0].complete && homeSetupSteps[2].complete;
  const homeGettingStarted = (
    <OverviewGettingStarted
      onTour={() => localStorage.getItem("advisio_token") === "__evaluation__" ? window.dispatchEvent(new Event("advisio:evaluation-activities")) : router.push("/walkthrough/research-dashboard")}
      steps={homeSetupSteps}
    />
  );
  const academic: OverviewRecord[] = [];
  if (activeProject && upcomingConsultation) academic.push({
    id: upcomingConsultation.id, title: upcomingConsultation.topic,
    detail: "Confirmed", date: upcomingConsultation.scheduledStart, dateWithTime: true,
    href: projectConsultationHref(activeProject.id, upcomingConsultation.id),
  });
  if (activeProject && upcomingDefense) academic.push({
    id: upcomingDefense.id, title: "Scheduled defense",
    detail: "Scheduled", date: upcomingDefense.scheduledStart, dateWithTime: true,
    href: projectSelection.projectHref(`/student/defense/${upcomingDefense.id}`),
  });
  if (activeProject && officialDefenseResult?.releasedAt) academic.push({
    id: "defense-result", title: "Released defense outcome",
    detail: overviewStatus(officialDefenseResult.decision), date: officialDefenseResult.releasedAt,
    href: projectSelection.projectHref(`/student/defense/${officialDefenseResult.id}`),
  });

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

      {groupAction && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="group-action-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !groupActionPending) setGroupAction(null); }}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${groupAction.type === "transfer" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-600"}`}><i className={`ti ${groupAction.type === "transfer" ? "ti-user-star" : "ti-alert-triangle"} text-xl`} /></span><div><h2 id="group-action-title" className="text-lg font-extrabold text-[#102f49]">{groupAction.type === "transfer" ? "Transfer group leadership?" : groupAction.type === "leave" ? "Leave this research group?" : groupAction.type === "disband" ? "Disband and archive this group?" : groupAction.type === "delete" ? "Permanently delete rejected project?" : "Remove this member?"}</h2><p className="mt-2 text-base leading-6 text-slate-600">{groupAction.type === "transfer" ? `${groupAction.member?.user?.firstName} ${groupAction.member?.user?.lastName} will become the group leader. You will remain as a member.` : groupAction.type === "leave" ? "You will lose access to the group, but your previous submissions and activity attribution will remain." : groupAction.type === "disband" ? "All active memberships will end and the project will be archived. Academic records and submissions will be preserved." : groupAction.type === "delete" ? `The rejected project “${activeProject?.title}” will be permanently deleted. You can register a replacement afterward.` : `${groupAction.member?.user?.firstName} ${groupAction.member?.user?.lastName} will lose group access. Their previous contributions will remain attributed to them.`}</p></div></div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setGroupAction(null)} disabled={groupActionPending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={executeGroupAction} disabled={groupActionPending} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50 ${groupAction.type === "transfer" ? "submission-action bg-[#173f63]" : "bg-rose-600"}`}>{groupActionPending ? "Processing…" : groupAction.type === "transfer" ? "Confirm transfer" : groupAction.type === "leave" ? "Confirm leave" : groupAction.type === "disband" ? "Confirm disband" : groupAction.type === "delete" ? "Delete project" : "Confirm removal"}</button></div></div></div>}

      {/* MAIN CONTAINER */}
      <div className={`workspace-page researcher-dashboard-page w-full flex-1 space-y-6 ${["group-chats", "chat"].includes(activeTab) ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8"}`}>
        {((researchData?.projects?.length || 0) > 1 || projectSelection.invalidRequestedProjectId) && (
          <section className="researcher-project-picker">
            <label htmlFor="dashboard-project">Active research project</label>
            <select id="dashboard-project" value={activeProject?.id || ""} onChange={(event) => projectSelection.selectProject(event.target.value || null)}>
              <option value="">Choose a research project</option>
              {(researchData?.projects || []).map((project: any) => <option key={project.id} value={project.id}>{[project.groupName, project.title].filter(Boolean).join(" · ") || "Untitled research"}</option>)}
            </select>
            {!activeProject && <p className="mt-2 text-base text-[var(--color-text-secondary)]">{projectSelection.invalidRequestedProjectId ? "That project is unavailable or you do not have access to it." : "Choose a project to see its workflow and requirements."}</p>}
          </section>
        )}
        


        {activeTab === "group" && projectSection === "my-group" && (activeProject || !activeWorkspace) && <h1 className="sr-only">Group &amp; Members</h1>}
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
            notifications: "Notifications",
          };

          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <div className="research-command-center researcher-home">
                <ResearcherHomeHero
                  firstName={user?.firstName}
                  title={activeProject?.title || (activeProject ? "Research title not added" : "Let\u2019s set up your research project")}
                  steps={homeJourney}
                  progress={activeProject && !progressLoading && !progressError && homeJourney.length ? projectProgress : null}
                  members={homeMembers}
                  memberCount={homeMembers.length}
                  adviserName={[activeAdviserMembership?.user?.firstName, activeAdviserMembership?.user?.lastName].filter(Boolean).join(" ")}
                  logoSrc={homeLogoSrc}
                  action={isResearchError ? (
                    <button type="button" onClick={() => void refetchResearch()} className="rcc-button rcc-button--secondary">Retry project lookup</button>
                  ) : (
                    <Link href={projectSelection.projectHref(projectSectionHref("overview"), activeProject?.id)} className="rcc-button rcc-button--secondary">Open research workspace <i aria-hidden="true" className="ti ti-arrow-right" /></Link>
                  )}
                />
                <div className="rcc-workflow-access"><WorkflowAccessInbox /></div>
                {officialDefenseResult && <OverviewDefenseResult decision={officialDefenseResult.decision} releasedOn={overviewDate(officialDefenseResult.releasedAt)} />}
                {homeNextStep ? (
                  <ResearcherNextStep
                    step={homeNextStep}
                    now={now}
                    action={homeNextStep.action ? <button type="button" onClick={() => handleProjectAction(homeNextStep.action!)} className="rcc-button rcc-button--primary">{homeNextStep.buttonLabel} <i aria-hidden="true" className="ti ti-arrow-right" /></button> : null}
                  />
                ) : (
                  <ResearcherNextStep
                    step={{ label: "Your next step", tone: "neutral", title: canStartProject ? "Register your research project" : "Select your research project", description: canStartProject ? "Add your project to start tracking milestones, deadlines, and consultations here." : "Choose a project, or check with your group leader if you haven\u2019t been added to one yet." }}
                    now={now}
                    action={<button type="button" onClick={() => canStartProject ? setShowCreateModal(true) : handleTabChange("group")} className="rcc-button rcc-button--primary">{canStartProject ? "Get started" : "View projects"} <i aria-hidden="true" className="ti ti-arrow-right" /></button>}
                  />
                )}
                <div className="rh-columns">
                  {activeProject ? (
                    <ResearcherComingUp
                      items={homeComingUp}
                      emptyMessage={isMilestoneLoading ? "Checking deadlines\u2026" : isMilestoneError ? "Deadlines could not be loaded." : "No upcoming deadlines or consultations for this project."}
                      calendarHref={projectSelection.projectHref("/student/calendar")}
                      onBookConsultation={() => handleTabChange("consultations")}
                    />
                  ) : homeGettingStarted}
                  {(activeProject || homeUpdates.length > 0) && (
                    <ResearcherLatestUpdates
                      items={homeUpdates}
                      emptyMessage={isMilestoneLoading ? "Checking project activity\u2026" : "No recent updates."}
                      viewAllHref={projectSelection.projectHref("/student/notifications")}
                    />
                  )}
                </div>
                {activeProject && !homeSetupComplete && homeGettingStarted}
                <ResearcherWorkflows count={workflowEnrollmentData?.enrollments?.length || 0}>
                  <JoinedWorkflows enrollments={workflowEnrollmentData?.enrollments || []} />
                </ResearcherWorkflows>
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
                          className="submission-action p-2.5 bg-slate-50 hover:bg-[#1b4264]/10 rounded-lg border border-slate-200 text-left transition cursor-pointer"
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
            "my-group": (
              <section className="student-projects-readable mp-workspace mp-group">
                {!activeProject && (researchData?.projects?.length || 0) > 0 ? <p data-guide="group-selection" className="text-base text-[var(--color-text-secondary)]">Select a research project above to view its group.</p> : activeProject ? (
                  <ProjectGroupPanel
                    groupName={activeProject.groupName || "Research team"}
                    projectTitle={activeProject.title}
                    isLeader={isGroupLeader}
                    logoSrc={homeLogoSrc}
                    members={activeStudentMembers.map((member: any) => ({
                      id: member.id,
                      name: [member.user?.firstName, member.user?.lastName].filter(Boolean).join(" ") || "Group member",
                      email: member.user?.email,
                      leader: member.projectRole === "LEADER",
                      isYou: member.userId === user?.id || member.user?.id === user?.id,
                      raw: member,
                    }))}
                    joinRequests={isGroupLeader && pendingJoinRequests.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center justify-between"><div><h2 className="font-extrabold text-[#102f49]">Pending join requests</h2><p className="mt-1 text-base text-slate-600">Approve only researchers who should receive this project’s workflow and files.</p></div><span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-extrabold text-amber-900">{pendingJoinRequests.length}</span></div><div className="mt-3 space-y-2">{pendingJoinRequests.map((request: any) => <div key={request.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-base font-bold text-[#102f49]">{request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "Researcher"}</p><p className="text-base text-slate-500">{request.requester?.email} · Requested {new Date(request.createdAt).toLocaleDateString()}</p></div><div className="flex gap-2"><button onClick={() => decideJoinRequest(request.id, "REJECT")} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-bold text-rose-700">Reject</button><button onClick={() => decideJoinRequest(request.id, "ACCEPT")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-extrabold text-white">Accept</button></div></div>)}</div></div> : null}
                    onTransfer={(member) => setGroupAction({ type: "transfer", member })}
                    onRemove={(member) => setGroupAction({ type: "remove", member })}
                    onLeave={!isGroupLeader && currentMembership ? () => setGroupAction({ type: "leave" }) : undefined}
                    onMessages={() => handleTabChange("group-chats")}
                    onTasks={() => router.push(projectSelection.projectHref("/student/tasks"))}
                    onFiles={() => router.push(projectSelection.projectHref("/student/group-files"))}
                    invite={isGroupLeader ? <>
                      <TeamEmailInvitation teamId={activeProject.id} kind="project" />
                      <div className="mp-panel mp-invitation-code">
                      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Invitation code and link</h2>
                      <p className="mt-1 text-base text-slate-600">Researchers review the group before joining or requesting approval.</p>
                      {inviteCode ? <div className="mt-3 space-y-2"><div className="rounded-lg bg-white p-3 font-mono text-sm font-bold text-[#173f63]">Code: {inviteCode}</div><div className="flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(inviteCode).then(() => triggerToast("Invite code copied."))} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700"><i className="ti ti-copy mr-1" />Copy code</button><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join-group?code=${inviteCode}`).then(() => triggerToast("Shareable link copied."))} className="rounded-lg bg-[#173f63] px-3 py-2 text-sm font-extrabold text-white"><i className="ti ti-link mr-1" />Copy link</button><button onClick={handleCreateInvite} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">Rotate code</button></div></div> : <button onClick={handleCreateInvite} className="mt-3 rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white"><i className="ti ti-user-plus mr-1" />Create invitation</button>}
                      </div>
                    </> : undefined}
                    settings={isGroupLeader ? {
                      summary: [projectParticipationMode === "SOLO" ? "Solo" : "Group", projectParticipationMode === "GROUP" ? ({ INVITE_ONLY: "Invite only", PUBLIC_APPROVAL: "Code access, leader approval", PUBLIC_OPEN: "Code access, join immediately" } as Record<string, string>)[projectAccessMode] : null].filter(Boolean).join(" · "),
                      content: <>
                        <label className="mt-3 block text-sm font-bold text-slate-600">Working arrangement<select value={projectParticipationMode} onChange={(event) => setProjectParticipationMode(event.target.value as "SOLO" | "GROUP")} className="mt-1.5 h-10 w-full rounded-lg border border-blue-200 bg-white px-3"><option value="SOLO">Solo</option><option value="GROUP">Group</option></select></label>
                        {projectParticipationMode === "GROUP" && <><label className="mt-3 block text-sm font-bold text-slate-600">How researchers can join<select value={projectAccessMode} onChange={(event) => setProjectAccessMode(event.target.value as typeof projectAccessMode)} className="mt-1.5 h-10 w-full rounded-lg border border-blue-200 bg-white px-3"><option value="INVITE_ONLY">Invite only</option><option value="PUBLIC_APPROVAL">Code access — leader approval</option><option value="PUBLIC_OPEN">Code access — join immediately</option></select></label><label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={projectInviteEnabled} onChange={(event) => setProjectInviteEnabled(event.target.checked)} />Accept joins using the current code</label></>}
                        <button onClick={handleSaveProjectAccess} disabled={projectAccessSaving} className="mt-4 rounded-lg bg-[#173f63] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50">{projectAccessSaving ? "Saving…" : "Save access settings"}</button>
                      </>,
                    } : undefined}
                  />
                ) : activeWorkspace ? (
                  <div className="rs">
                    <RoleBand
                      eyebrow="Group and members"
                      title={activeWorkspace.name}
                      titleId="student-group-title"
                      guide="group-identity"
                      meta="Research project awaiting registration by your leader."
                      counts={[
                        { label: "Members", value: (activeWorkspace.members || []).filter((member: any) => !member.leftAt).length },
                        { label: "Your role", value: isWorkspaceLeader ? "Leader" : "Member" },
                      ]}
                      countsLabel="Group summary"
                    />
                    <div className="stu-notice" data-tone="waiting">
                      <i className="ti ti-file-plus" aria-hidden="true" />
                      <div className="stu-notice-text">
                        <strong>{isWorkspaceLeader ? "Add your research project" : "Waiting for your leader"}</strong>
                        <span>{isWorkspaceLeader ? "Register the title so your group can start its workflow." : "Your leader still needs to register the research project."}</span>
                      </div>
                      {canCreateResearch && !activeWorkspace.projects?.length && (
                        <button type="button" className="rs-primary" onClick={() => { setCreateTitle(""); setShowCreateModal(true); }}>Add research project</button>
                      )}
                    </div>
                    <div className="rh-grid">
                      <section className="rh-panel" aria-labelledby="student-group-members" data-guide="group-members">
                        <div className="rh-head">
                          <h2 id="student-group-members">Group members</h2>
                          <span className="rh-pill">{(activeWorkspace.members || []).filter((member: any) => !member.leftAt).length}</span>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          {(activeWorkspace.members || []).filter((member: any) => !member.leftAt).map((member: any) => (
                            <div key={member.id} className="stu-member">
                              <span className="rs-avatar" aria-hidden="true">{initials(`${member.user.firstName} ${member.user.lastName}`)}</span>
                              <span className="rs-text">
                                <strong>{member.user.firstName} {member.user.lastName}{member.userId === user?.id ? " (You)" : ""}</strong>
                                <small>{member.user.email}</small>
                              </span>
                              <StatusDot tone={member.role === "LEADER" ? "done" : "neutral"}>{member.role === "LEADER" ? "Leader" : "Member"}</StatusDot>
                            </div>
                          ))}
                        </div>
                      </section>
                      <div className="rh-col">
                        {isWorkspaceLeader && activeWorkspace?.participationMode === "GROUP" ? (
                          <>
                            <section className="rh-panel" aria-labelledby="student-group-code">
                              <div className="rh-head"><h2 id="student-group-code">Invite by code</h2></div>
                              <p className="rh-lede">Researchers review the group before joining.</p>
                              <div className="stu-code-chip">
                                <span>{activeWorkspace.inviteCode}</span>
                                <button type="button" className="rs-icon-btn" aria-label="Copy invite code" onClick={() => navigator.clipboard.writeText(activeWorkspace.inviteCode).then(() => triggerToast("Invite code copied."))}>
                                  <i className="ti ti-copy" aria-hidden="true" />
                                </button>
                              </div>
                            </section>
                            <div className="mp-email-invitation"><TeamEmailInvitation teamId={activeWorkspace.id} kind="workspace" /></div>
                          </>
                        ) : !isWorkspaceLeader ? (
                          <section className="rh-panel" aria-labelledby="student-group-next">
                            <div className="rh-head"><h2 id="student-group-next">What happens next</h2></div>
                            <ol className="stu-steps">
                              <li><span><strong>Your leader registers the project</strong></span></li>
                              <li><span><strong>Your group starts its workflow</strong></span></li>
                              <li><span><strong>Tasks appear for everyone</strong></span></li>
                            </ol>
                          </section>
                        ) : null}
                        {canDeleteWorkspace && (
                          <button type="button" className="stu-danger-link" onClick={() => { setWorkspaceDeleteError(""); setWorkspaceToDelete({ id: activeWorkspace.id, name: activeWorkspace.name }); }}>
                            <i className="ti ti-trash" aria-hidden="true" /> Delete workspace
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rs-empty-card" data-guide={isWorkspaceLoading ? undefined : "group-empty"}>
                    <EmptyNote
                      layout="row"
                      icon="ti-users-group"
                      title={isWorkspaceLoading ? "Loading your group…" : !workspaceData ? "Unable to load your group" : "You have not joined a research group yet"}
                      text={!isWorkspaceLoading && !workspaceData ? "Refresh to try again." : undefined}
                      action={workspaceData ? <button type="button" className="rs-primary" onClick={() => handleTabChange("group")}>Open My Project</button> : undefined}
                    />
                  </div>
                )}
              </section>
            ),
            group: (
              <div className="mp-project-container space-y-5">
                {isResearchError ? (
                  <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Projects could not be loaded</h2>
                    <button type="button" onClick={() => void refetchResearch()} className="mp-text-action">Retry project lookup</button>
                  </section>
                ) : activeProject ? (
                  <StudentProjectOverview
                    project={activeProject}
                    isLeader={isGroupLeader}
                    defenseDecision={officialDefenseResult?.releasedAt ? officialDefenseResult.decision : null}
                    logoSrc={homeLogoSrc}
                    workflowName={activeProject.workflowInstance?.workflow?.name}
                    coordinator={workflowProject && activeWorkflowEnrollment?.workflow?.creator ? [activeWorkflowEnrollment.workflow.creator.firstName, activeWorkflowEnrollment.workflow.creator.lastName].filter(Boolean).join(" ") || activeWorkflowEnrollment.workflow.creator.email : undefined}
                    academicYear={activeProject.academicYear?.name}
                    teamName={activeProject.groupName || (activeStudentMembers.length === 1 ? "Solo research" : "Research team")}
                    groupCode={isGroupLeader && activeProject.inviteCodeEnabled ? activeProject.inviteCode : undefined}
                    adviserName={[activeAdviserMembership?.user?.firstName, activeAdviserMembership?.user?.lastName].filter(Boolean).join(" ")}
                    members={activeStudentMembers.map((member: { userId: string; projectRole: string; user?: { firstName: string; lastName: string } }) => ({
                      id: member.userId,
                      name: [member.user?.firstName, member.user?.lastName].filter(Boolean).join(" ") || "Group member",
                      leader: member.projectRole === "LEADER",
                    }))}
                    pendingMembers={pendingJoinRequests.length}
                    documents={documentsError ? [] : summarizeProjectDocuments(dashboardDocumentData?.documents || [], activeProject.id)}
                    documentsState={documentsLoading ? "loading" : documentsError ? "error" : "ready"}
                    academic={academic}
                    activity={projectActivity}
                    milestones={manuscriptWorkflowData?.milestones}
                    loading={progressLoading}
                    error={progressError}
                    onAction={handleProjectAction}
                    onGroup={() => handleTabChange("my-group")}
                    onArchive={() => setGroupAction({ type: "disband" })}
                    adviser={<div className="mp-panel mp-adviser-content">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="mp-section-title">Faculty Adviser</h3>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${activeAdviserMembership ? "bg-emerald-200 text-emerald-900" : pendingAdviserRequest ? "bg-amber-200 text-amber-900" : "bg-white text-slate-600"}`}>
                                {activeAdviserMembership ? "ASSIGNED" : pendingAdviserRequest ? "PENDING" : latestAdviserRequest?.status || "NOT ASSIGNED"}
                              </span>
                            </div>

                            {activeAdviserMembership ? (
                              <div className="mt-3">
                                <p className="text-base font-extrabold text-[#102f49]">{activeAdviserMembership.user.firstName} {activeAdviserMembership.user.lastName}</p>
                                <p className="mt-1 text-base text-slate-600">{activeAdviserMembership.user.email} · Adviser for the entire research project</p>
                                <p className="mp-assignment-date">Assigned {activeAdviserMembership.joinedAt ? new Date(activeAdviserMembership.joinedAt).toLocaleDateString() : "to your group"}</p>
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
                    titleHistory={<div className="mt-4">{isGroupLeader && activeProject.status === "REJECTED" && <button type="button" onClick={() => setGroupAction({ type: "delete" })} className="mb-3 min-h-11 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:underline">Delete rejected project</button>}{Array.isArray(activeProject.titleRevisions) && activeProject.titleRevisions.length > 0 && (
                        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-extrabold text-[#102f49]">Title revision history ({activeProject.titleRevisions.length})</summary><div className="mt-3 space-y-2">{activeProject.titleRevisions.map((revision: any) => <div key={revision.id} className="rounded-lg bg-slate-50 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[#102f49]">{revision.proposedTitle}</strong><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">{revision.status}</span></div><p className="mt-1 text-slate-500">Previous: {revision.previousTitle}</p>{revision.reason && <p className="mt-1 text-slate-600">Reason: {revision.reason}</p>}<p className="mt-1 text-base text-slate-400">{new Date(revision.createdAt).toLocaleString()}</p></div>)}</div></details>
                      )}</div>}
                  />
                ) : projectSelection.invalidRequestedProjectId || (researchData?.projects?.length || 0) > 0 ? (
                  <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><h2 data-guide="project-empty" className="text-xl font-bold text-[var(--color-text-primary)]">{projectSelection.invalidRequestedProjectId ? "Project unavailable" : "Select a research project"}</h2><p className="mt-2 text-base text-[var(--color-text-secondary)]">Use the project selector above to view a project’s title, workflow, and next step.</p></section>
                ) : (
                  <section className="student-projects-readable rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xs">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]" data-guide="project-empty">Research title not added</h2>
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
                        <button onClick={() => { setCreateTitle(""); setCreateGroupName(""); setShowCreateModal(true); }} className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] p-6 text-left text-[var(--color-text-primary)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--color-surface-subtle)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]"><i className="ti ti-folder-plus text-xl" /></span><span className="mt-4 block text-base font-extrabold">Create a workspace</span><span className="mt-1 block text-sm leading-5 text-[var(--color-text-secondary)]">Start Solo or create a group. Add a research title now or later.</span></button>
                        <button data-guide="group-join-entry" onClick={() => router.push(projectSelection.projectHref("/student/join-group"))} className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#173f63]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100"><i className="ti ti-users-plus text-xl text-[#173f63]" /></span><span className="mt-4 block text-base font-extrabold text-[#102f49]">Join a group</span><span className="mt-1 block text-sm leading-5 text-slate-500">Enter a group invitation code to join a research workspace.</span></button>
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
            conferencing: renderConsultationsHub(),
            submissions: renderSubmissionsHub(),
            submission: renderSubmissionsHub(),
            "version-control": renderSubmissionsHub(),
            milestones: (
              <div className="flex flex-col gap-5">
                <StudentGanttChart project={activeProject} milestoneProgress={manuscriptWorkflowData?.milestones || []} />
                <RecordedActivity
                  events={manuscriptWorkflowData?.activity || []}
                  hrefFor={(event) => (activeProject ? projectActivityHref(event, activeProject.id) : null)}
                  onOpen={(href) => router.push(href)}
                />
                <MilestoneDetails milestones={milestones} formatTarget={(milestone) => formatMilestoneTarget(milestone as Parameters<typeof formatMilestoneTarget>[0])} />
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-research-workspace-title"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg animate-fade-in-up flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-primary)] shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <h3 id="create-research-workspace-title" className="flex items-center gap-2 text-lg font-extrabold text-[var(--color-text-primary)]">
                <i className="ti ti-folder-plus text-xl text-[var(--color-primary)]" aria-hidden="true" />
                {activeWorkspace ? "Add research project" : "Create research workspace"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close create research workspace dialog"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
              >
                <i className="ti ti-x text-lg" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleCreateResearch} className="flex flex-col gap-4 text-xs">
              {!activeWorkspace && <fieldset>
                <legend className="font-bold text-[var(--color-text-primary)]">How will you conduct this research?</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {([
                    { value: "SOLO", title: "Work solo", text: "Start with one researcher. You can convert it to a group later.", icon: "ti-user" },
                    { value: "GROUP", title: "Create a group", text: "Become the leader and invite researchers using a code or link.", icon: "ti-users-group" },
                  ] as const).map((option) => (
                    <button key={option.value} type="button" aria-pressed={createParticipationMode === option.value} onClick={() => setCreateParticipationMode(option.value)} className={`rounded-xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] ${createParticipationMode === option.value ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:border-[var(--color-border-strong)]"}`}>
                      <i className={`ti ${option.icon} text-xl text-[var(--color-primary)]`} aria-hidden="true" />
                      <span className="mt-2 block font-extrabold text-[var(--color-text-primary)]">{option.title}</span>
                      <span className="mt-1 block text-sm leading-4 text-[var(--color-text-secondary)]">{option.text}</span>
                    </button>
                  ))}
                </div>
              </fieldset>}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[var(--color-text-primary)]">Research title {!activeWorkspace && <span className="font-normal text-[var(--color-text-muted)]">(optional — you can add it later)</span>}</label>
                <input
                  type="text"
                  placeholder="e.g. Real-Time Water Quality Monitoring Using IoT"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                />
              </div>
              {needsRegistrationWorkflow && (
                isWorkflowEnrollmentLoading ? (
                  <p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-secondary)]">Checking your workflow enrollment…</p>
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
              {!activeWorkspace && <div className="grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-subtle)] p-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 font-bold text-[var(--color-text-primary)]">
                  {createParticipationMode === "GROUP" ? "Group name" : "Workspace name"}
                  <input type="text" required maxLength={120} value={createGroupName} onChange={(event) => setCreateGroupName(event.target.value)} placeholder={createParticipationMode === "GROUP" ? "e.g. Team Innovators" : "e.g. My Thesis Workspace"} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]" />
                </label>
                {createParticipationMode === "GROUP" && <label className="flex flex-col gap-1.5 font-bold text-[var(--color-text-primary)]">
                  Joining permission
                  <select value={createAccessMode} onChange={(event) => setCreateAccessMode(event.target.value as typeof createAccessMode)} className="h-[42px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]">
                    <option value="INVITE_ONLY">Invite code</option>
                    <option value="PUBLIC_OPEN">Open code joining</option>
                  </select>
                </label>}
              </div>}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[var(--color-text-primary)]">Abstract / Problem Scope (Optional)</label>
                <textarea
                  rows={4}
                  placeholder="Provide an overview of the proposed study, methodology, or objectives..."
                  value={createAbstract}
                  onChange={(e) => setCreateAbstract(e.target.value)}
                  className="resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                />
              </div>
              <div className="flex flex-col-reverse gap-2.5 border-t border-[var(--color-border-subtle)] pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isCreatingProject}
                  loadingText="Creating workspace..."
                  disabled={isCreatingProject || (needsRegistrationWorkflow && !hasRegistrationWorkflow) || (activeWorkspace ? !createTitle.trim() : !createGroupName.trim())}
                  className="w-full disabled:border-[var(--color-border)] disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-text-secondary)] disabled:opacity-100 disabled:shadow-none sm:w-auto"
                >
                  {activeWorkspace ? "Create research project" : createTitle.trim() ? "Create workspace and project" : "Create workspace"}
                </Button>
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
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowEditProjectModal(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="submit" disabled={editProjectSaving || !editProjectTitle.trim()} className="submission-action rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{editProjectSaving ? "Saving…" : activeProject.status === "APPROVED" && editProjectTitle.trim() !== activeProject.title ? "Submit title change" : "Save changes"}</button></div>
            </form>
          </div>
        </div>
      )}

      {instantMeetingOpen && (
        <ConsultationMeetingForm instant projects={consultationProjects} initialProjectId={activeProject?.id}
          onClose={() => setInstantMeetingOpen(false)} onResult={triggerToast} />
      )}

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
