import { TitleProposalPanel } from "@/components/workflow/TitleProposalPanel";
import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { Modal } from "@/components/ui/Modal";
import { calculateMilestoneProgress } from "@/lib/workflow-progress";
import {
  calendarDateValue,
  formatMilestoneTarget,
  formatTaskDeadline,
  resolveWorkflowDeadline,
} from "@/lib/workflow-deadlines";
import { DashboardWelcome } from "@/components/ui/DashboardWelcome";
import {
  DashboardSkeleton,
  ListRowsSkeleton,
  TablePageSkeleton,
} from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";
import { SubmissionDocumentPreview } from "@/components/professor/SubmissionDocumentPreview";
import { ProfessorDeanRequestModal } from "@/components/professor/ProfessorDeanRequestModal";
import { DefensePacketConfigurator } from "@/components/professor/DefensePacketConfigurator";
import { DefenseSessionStatusModal } from "@/components/professor/DefenseSessionStatusModal";
import { DefenseBadgeIssuance } from "@/components/professor/DefenseBadgeIssuance";
import { FacultyGroupChats } from "@/components/messaging/FacultyGroupChats";
import { WorkflowResourcesCard } from "@/components/workflow/WorkflowResourcesCard";
import {
  MilestoneAttachmentsCard,
  type PendingMilestoneAttachment,
} from "@/components/workflow/MilestoneAttachmentsCard";
import { SubmissionFileTypes } from "@/components/workflow/SubmissionFileTypes";
import { MilestoneComposer } from "@/components/workflow/MilestoneComposer";
import { WorkflowParticipantsCard } from "@/components/workflow/WorkflowParticipantsCard";
import {
  WorkflowDeadlineTracker,
  type WorkflowDeadlineRow,
} from "@/components/workflow/WorkflowDeadlineTracker";
import { ResearchProjectsOnboarding } from "@/components/workflow/ResearchProjectsOnboarding";

const EMPTY_MILESTONE_PROGRESS_BY_PROJECT: Record<string, any[]> = {};

function ProfessorDashboardContent() {
  // Kept temporarily while the new composer and workflow workspace replace the
  // legacy drawer markup in a follow-up cleanup pass.
  const legacyWorkflowUiEnabled = false;
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "overview";
  const activeTab = requestedTab === "deadlines" ? "submissions" : requestedTab;
  const requestedWorkflowView = searchParams.get("workflowView");
  const workflowView =
    requestedWorkflowView === "resources"
      ? "resources"
      : requestedWorkflowView === "participants"
        ? "participants"
        : "milestones";
  const submissionView =
    requestedTab === "deadlines" ||
    searchParams.get("submissionView") === "deadlines"
      ? "deadlines"
      : "review";
  const submissionWorkflowId = searchParams.get("workflowId") || "ALL";
  const requestedWorkflowId = searchParams.get("workflowId") || "";
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  const { data: defenseData, refetch: refetchDefense } = useQuery({
    queryKey: ["professor-live-defense"],
    queryFn: () =>
      apiClient.get<{ session: any | null }>("/api/defense-sessions/active"),
    refetchInterval: 3000,
  });
  const liveDefense = defenseData?.session || null;
  const [officialDecision, setOfficialDecision] = useState("APPROVED");
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [defenseActionPending, setDefenseActionPending] = useState(false);
  const {
    data: defenseManagementData,
    refetch: refetchDefenseManagement,
    error: defenseManagementError,
  } = useQuery({
    queryKey: ["professor-defense-management"],
    queryFn: () =>
      apiClient.get<{ sessions: any[] }>("/api/defense-management"),
    refetchInterval: 15000,
  });
  const {
    data: defenseEventData,
    refetch: refetchDefenseEvents,
    error: defenseEventError,
  } = useQuery({
    queryKey: ["professor-defense-events"],
    queryFn: () => apiClient.get<{ events: any[] }>("/api/defense-events"),
    refetchInterval: 15000,
  });
  const { data: eligibleDefenseData, refetch: refetchEligibleDefenseGroups } =
    useQuery({
      queryKey: ["defense-eligible-groups"],
      queryFn: () =>
        apiClient.get<{ projects: any[] }>(
          "/api/defense-management/eligible-groups",
        ),
      refetchInterval: 15000,
    });
  const { data: defenseCandidateData } = useQuery({
    queryKey: ["defense-participant-candidates"],
    queryFn: () =>
      apiClient.get<{ users: any[] }>("/api/defense-management/candidates"),
  });
  const { data: eligibilityGatesData, refetch: refetchEligibilityGates } =
    useQuery({
      queryKey: ["defense-eligibility-gates"],
      queryFn: () =>
        apiClient.get<{ groups: any[] }>(
          "/api/defense-management/eligibility-gates",
        ),
      refetchInterval: 15000,
    });
  const { data: signatureGroupsData, refetch: refetchSignatureGroups } =
    useQuery({
      queryKey: ["defense-signature-groups"],
      queryFn: () =>
        apiClient.get<{ projects: any[] }>(
          "/api/defense-management/eligible-groups?purpose=signature",
        ),
      refetchInterval: 15000,
    });
  const signatureGroups = signatureGroupsData?.projects || [];
  const eligibilityGroups = eligibilityGatesData?.groups || [];
  const defenseSessions = (defenseManagementData?.sessions || []).filter(
    (session: any) => session.status !== "CANCELLED",
  );
  const defenseEvents = (defenseEventData?.events || []).filter(
    (event: any) => event.status !== "CANCELLED",
  );
  const legacyDefenseSessions = defenseSessions.filter(
    (session: any) => !session.defenseEventId,
  );
  const defenseLoadError = defenseEventError || defenseManagementError;
  const eligibleDefenseGroups = eligibleDefenseData?.projects || [];
  const defenseCandidates = defenseCandidateData?.users || [];
  const [showDefenseForm, setShowDefenseForm] = useState(false);
  const [showDeanRequestForm, setShowDeanRequestForm] = useState(false);
  const [packetSession, setPacketSession] = useState<any | null>(null);
  const [statusSession, setStatusSession] = useState<{
    session: any;
    event?: any;
  } | null>(null);
  const [defenseProjectId, setDefenseProjectId] = useState("");
  const [defenseProjectIds, setDefenseProjectIds] = useState<string[]>([]);
  const [defenseType, setDefenseType] = useState("PRE_ORAL_DEFENSE");
  const [defenseDate, setDefenseDate] = useState("");
  const [defenseStartTime, setDefenseStartTime] = useState("");
  const [defenseEndTime, setDefenseEndTime] = useState("");
  const [defenseVenue, setDefenseVenue] = useState("");
  const [defenseMeetingUrl, setDefenseMeetingUrl] = useState("");
  const [defenseNotes, setDefenseNotes] = useState("");
  const [defenseChairId, setDefenseChairId] = useState("");
  const [defensePanelistIds, setDefensePanelistIds] = useState<string[]>([]);
  const [reschedulingSession, setReschedulingSession] = useState<any | null>(
    null,
  );
  const [replacementInvitation, setReplacementInvitation] = useState<
    any | null
  >(null);
  const [replacementUserId, setReplacementUserId] = useState("");
  const { data: announcementData, refetch: refetchAnnouncements } = useQuery({
    queryKey: ["professor-announcements"],
    queryFn: () =>
      apiClient.get<{ announcements: any[] }>(
        "/api/notifications/announcements",
      ),
    refetchInterval: 30000,
  });
  const announcements = announcementData?.announcements || [];
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementCategory, setAnnouncementCategory] = useState("GENERAL");
  const [announcementSeverity, setAnnouncementSeverity] = useState("INFO");
  const [announcementExpiresAt, setAnnouncementExpiresAt] = useState("");
  const [announcementPublishing, setAnnouncementPublishing] = useState(false);

  // Query live workflows and research projects
  const {
    data: workflowData,
    isLoading: workflowsLoading,
    error: workflowsError,
    refetch: refetchWorkflows,
  } = useQuery({
    queryKey: ["professor-workflows"],
    queryFn: () => apiClient.get<{ workflows: any[] }>("/api/workflows"),
    staleTime: 60000,
  });
  const { data: programData } = useQuery({
    queryKey: ["professor-workflow-program", user?.college?.id],
    queryFn: () =>
      apiClient.get<{ programs: any[] }>("/api/programs", {
        params: { collegeId: user?.college?.id },
      }),
    enabled: Boolean(user?.college?.id),
    staleTime: 60000,
  });
  const assignedProgram =
    programData?.programs?.find(
      (program: any) => program.id === user?.program?.id,
    ) || null;
  const availableResearchTypes =
    assignedProgram?.researchTypes?.filter(
      (researchType: any) => researchType.isActive !== false,
    ) || [];

  const {
    data: researchData,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchResearch,
  } = useQuery({
    queryKey: ["professor-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research"),
    staleTime: 15000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const professorProjectIds = (researchData?.projects || [])
    .filter(
      (project: any) =>
        project.status !== "ARCHIVED" && project.workflowInstance,
    )
    .map((project: any) => project.id as string);
  const professorProjectKey = professorProjectIds.join(",");
  const {
    data: milestoneProgressByProject = EMPTY_MILESTONE_PROGRESS_BY_PROJECT,
  } = useQuery({
    queryKey: ["professor-milestone-progress", professorProjectKey],
    queryFn: async () => {
      const entries = await Promise.all(
        professorProjectIds.map(async (projectId) => {
          try {
            const projection = await apiClient.get<{ milestones: any[] }>(
              `/api/research/${projectId}/manuscript-workflow`,
            );
            return [projectId, projection.milestones || []] as const;
          } catch {
            return [projectId, []] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, any[]>;
    },
    enabled: professorProjectIds.length > 0,
    staleTime: 15000,
    refetchInterval: 15000,
  });

  const {
    data: enrollmentData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
    refetch: refetchEnrollments,
  } = useQuery({
    queryKey: ["professor-workflow-enrollments"],
    queryFn: () =>
      apiClient.get<{ enrollments: any[] }>("/api/workflows/enrollments"),
    staleTime: 15000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  // An enrollment represents a researcher joining a specific workflow. Do not
  // collapse these by user ID: the same researcher can legitimately join more
  // than one workflow and must remain visible under each one.
  const acceptedResearchers = (enrollmentData?.enrollments || []).filter(
    (enrollment: any) => enrollment.user && enrollment.workflow,
  );

  // Live State Data with live fallbacks
  const [studentsCount, setStudentsCount] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");

  useEffect(() => {
    if (researchData?.projects) {
      const mappedProjects = researchData.projects
        .filter((p: any) => p.status !== "ARCHIVED" && p.workflowInstance)
        .map((p: any) => ({
          id: p.id,
          workflowDraft: p.workflowDraft,
          registeredAt: p.registeredAt,
          title: p.title,
          group: p.title || "Untitled research project",
          abstract: p.abstract || "",
          researchType: p.researchType || null,
          program: p.program || null,
          college: p.college || null,
          academicYear: p.academicYear || null,
          members: p.members || [],
          researchers: (p.members || []).filter((member: any) =>
            ["LEADER", "MEMBER"].includes(member.projectRole),
          ),
          adviser:
            (p.members || []).find(
              (member: any) => member.projectRole === "ADVISER",
            )?.user || null,
          currentStage: p.workflowInstance?.currentStage || null,
          workflowId: p.workflowInstance?.workflowId || null,
          workflowName:
            p.workflowInstance?.workflow?.name || "Research workflow",
          workflowStartedAt: p.workflowInstance?.startedAt || null,
          workflowTransitions: p.workflowInstance?.transitions || [],
          workflowStages: p.workflowInstance?.workflow?.stages || [],
          milestoneProgress: milestoneProgressByProject[p.id] || [],
          taskSubmissions: p.taskSubmissions || [],
          progress: calculateMilestoneProgress(
            milestoneProgressByProject[p.id],
            Boolean(p.workflowInstance?.completedAt),
          ),
          status: p.status?.toLowerCase() || "ongoing",
        }));
      setProjects(mappedProjects);
      setStudentsCount(
        researchData.projects.reduce(
          (total: number, project: any) =>
            total + (project.members?.length || 0),
          0,
        ),
      );
    }
  }, [milestoneProgressByProject, researchData]);

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState("Active Track");

  useEffect(() => {
    if (workflowData?.workflows) {
      const topList = workflowData.workflows.map((w: any) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        status: w.status,
        version: w.version,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        publishedAt: w.publishedAt,
        inviteCode: w.inviteCode,
        inviteExpiresAt: w.inviteExpiresAt,
        topics: w.topics || [],
      }));
      setWorkflows(topList);
      if (
        requestedWorkflowId &&
        topList.some((workflow: any) => workflow.id === requestedWorkflowId)
      ) {
        setSelectedWorkflowId(requestedWorkflowId);
      } else if (
        topList.length > 0 &&
        !topList.some((workflow: any) => workflow.id === selectedWorkflowId)
      ) {
        setSelectedWorkflowId(topList[0].id);
      } else if (topList.length === 0 && selectedWorkflowId) {
        setSelectedWorkflowId("");
      }
      const msList: any[] = [];
      workflowData.workflows.forEach((w: any) => {
        w.stages?.forEach((s: any) => {
          msList.push({
            id: s.id,
            workflowId: w.id,
            topicId: s.topicId || null,
            sequence: s.sequence,
            title: s.name,
            scope:
              s.category ||
              (["Milestone", "Compliance", "Pre-requisite"].includes(
                s.description,
              )
                ? s.description
                : "Milestone"),
            description: ["Milestone", "Compliance", "Pre-requisite"].includes(
              s.description,
            )
              ? ""
              : s.description || "",
            locked: Boolean(s.requiresApproval),
            requiredMilestoneId: s.requiredMilestoneId || null,
            deadlineDays: s.deadlineDays,
            targetCompletionDate: s.targetCompletionDate,
            requiresDocument: s.requiresDocument !== false,
            submissionMode: s.submissionMode || "EITHER",
            titleProposalCount: s.titleProposalCount || 3,
            milestoneType: s.milestoneType || "STANDARD",
            tasks: s.tasks || [],
          });
        });
      });
      setMilestones(msList);
    }
  }, [workflowData, requestedWorkflowId, selectedWorkflowId]);

  // Form input controllers
  const [newTitleProposalCount, setNewTitleProposalCount] = useState(3);
  const [editTitleProposalCount, setEditTitleProposalCount] = useState(3);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDescription, setNewMilestoneDescription] = useState("");
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingWorkflow, setDeletingWorkflow] = useState(false);
  const [deleteWorkflowError, setDeleteWorkflowError] = useState("");
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDescription, setNewWorkflowDescription] = useState("");
  const [newWorkflowResearchTypeId, setNewWorkflowResearchTypeId] =
    useState("");
  const [newMilestoneScope, setNewMilestoneScope] = useState("Milestone");
  const { data: workflowResourceSummary } = useQuery({
    queryKey: ["workflow-resources", selectedWorkflowId],
    queryFn: () =>
      apiClient.get<{ resources: any[] }>(
        `/api/workflows/${selectedWorkflowId}/resources`,
      ),
    enabled: Boolean(selectedWorkflowId),
    staleTime: 30_000,
  });
  const [targetCompletionDate, setTargetCompletionDate] = useState("");
  const [newMilestoneRequiresDocument, setNewMilestoneRequiresDocument] =
    useState(true);
  const [newMilestoneRequiresApproval, setNewMilestoneRequiresApproval] =
    useState(false);
  const [newMilestoneSubmissionMode, setNewMilestoneSubmissionMode] =
    useState("GROUP");
  const [newMilestoneTopicId, setNewMilestoneTopicId] = useState("");
  const [newMilestoneType, setNewMilestoneType] = useState<
    "STANDARD" | "ADVISER_SELECTION" | "DEFENSE_ELIGIBILITY" | "TITLE_PROPOSAL"
  >("STANDARD");
  const [newMilestoneRequired, setNewMilestoneRequired] = useState("");
  const [newMilestoneAttachments, setNewMilestoneAttachments] = useState<
    PendingMilestoneAttachment[]
  >([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [newRequirementTitle, setNewRequirementTitle] = useState("");
  const [newRequirementInstructions, setNewRequirementInstructions] =
    useState("");
  const [newRequirementDueDays, setNewRequirementDueDays] = useState("");
  const [newMilestoneFileTypes, setNewMilestoneFileTypes] = useState("PDF,DOCX");
  const [newRequirementFileTypes, setNewRequirementFileTypes] =
    useState("PDF,DOCX");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  useEffect(() => {
    setSelectedProject((current: any) => {
      if (!current) return null;
      return projects.find((project) => project.id === current.id) || current;
    });
  }, [projects]);
  const [monitoringSearch, setMonitoringSearch] = useState("");
  const [monitoringPendingRemoval, setMonitoringPendingRemoval] = useState<{
    kind: "researcher" | "project";
    id: string;
    name: string;
    workflowName?: string;
  } | null>(null);
  const [monitoringRemovalSaving, setMonitoringRemovalSaving] = useState(false);
  const [monitoringRemovalReason, setMonitoringRemovalReason] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(
    null,
  );
  const [submissionFilter, setSubmissionFilter] = useState("NEEDS_REVIEW");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionSort, setSubmissionSort] = useState("OLDEST_REVIEW");
  const [deadlineFilter, setDeadlineFilter] = useState<
    "UPCOMING" | "OVERDUE" | "NO_DEADLINE" | "ALL"
  >("UPCOMING");
  const [deadlineSort, setDeadlineSort] = useState<
    "DUE_SOON" | "MOST_OVERDUE" | "GROUP" | "MILESTONE"
  >("DUE_SOON");
  const [selectedDeadlineKeys, setSelectedDeadlineKeys] = useState<string[]>(
    [],
  );
  const [deadlineReminderSaving, setDeadlineReminderSaving] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [showWorkflowCreateMenu, setShowWorkflowCreateMenu] = useState(false);
  const [publishingWorkflow, setPublishingWorkflow] = useState(false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [collapsedTopicIds, setCollapsedTopicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [draggedTopicId, setDraggedTopicId] = useState<string | null>(null);
  const [topicOrderSaving, setTopicOrderSaving] = useState(false);
  const [showAdvancedMilestoneOptions, setShowAdvancedMilestoneOptions] =
    useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);
  const [milestoneEditTitle, setMilestoneEditTitle] = useState("");
  const [milestoneEditDescription, setMilestoneEditDescription] = useState("");
  const [milestoneEditCategory, setMilestoneEditCategory] =
    useState("Milestone");
  const [milestoneEditDeadline, setMilestoneEditDeadline] = useState("");
  const [milestoneEditTargetChanged, setMilestoneEditTargetChanged] =
    useState(false);
  const [milestoneEditRequiresDocument, setMilestoneEditRequiresDocument] =
    useState(true);
  const [milestoneEditRequiresApproval, setMilestoneEditRequiresApproval] =
    useState(false);
  const [milestoneEditSubmissionMode, setMilestoneEditSubmissionMode] =
    useState("EITHER");
  const [milestoneEditTopicId, setMilestoneEditTopicId] = useState("");
  const [milestoneEditRequired, setMilestoneEditRequired] = useState("");
  const [milestoneEditType, setMilestoneEditType] = useState<
    "STANDARD" | "ADVISER_SELECTION" | "DEFENSE_ELIGIBILITY" | "TITLE_PROPOSAL"
  >("STANDARD");
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any | null>(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicSaving, setTopicSaving] = useState(false);
  const [milestoneSaveStatus, setMilestoneSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [milestonePendingDelete, setMilestonePendingDelete] = useState<
    any | null
  >(null);

  const [toast, setToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleMonitoringRemoval = async () => {
    if (!monitoringPendingRemoval) return;
    const reason = monitoringRemovalReason.trim();
    if (reason.length < 5) {
      triggerToast("Please provide a clear reason for removal.");
      return;
    }
    setMonitoringRemovalSaving(true);
    try {
      if (monitoringPendingRemoval.kind === "researcher") {
        await apiClient.delete(
          `/api/workflows/enrollments/${monitoringPendingRemoval.id}`,
          { body: JSON.stringify({ reason }) },
        );
        await refetchEnrollments();
        triggerToast(
          "Participant removed. The reason was saved to audit history.",
        );
      } else {
        await apiClient.post(
          `/api/research/${monitoringPendingRemoval.id}/remove-from-workflow`,
          { reason },
        );
        setSelectedProject(null);
        await refetchResearch();
        triggerToast(
          "Project removed from the workflow. The research project remains available to its researchers.",
        );
      }
      setMonitoringPendingRemoval(null);
      setMonitoringRemovalReason("");
    } catch (error: any) {
      triggerToast(error?.message || "The item could not be removed.");
    } finally {
      setMonitoringRemovalSaving(false);
    }
  };

  useEffect(() => {
    if (
      availableResearchTypes.length &&
      !availableResearchTypes.some(
        (item: any) => item.id === newWorkflowResearchTypeId,
      )
    ) {
      setNewWorkflowResearchTypeId(availableResearchTypes[0].id);
    }
  }, [availableResearchTypes, newWorkflowResearchTypeId]);

  const handleCreateWorkflow = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newWorkflowName.trim() || !newWorkflowResearchTypeId) return;
    setSaving(true);
    try {
      const result = await apiClient.post<{ workflow: any }>("/api/workflows", {
        researchTypeId: newWorkflowResearchTypeId,
        name: newWorkflowName.trim(),
        description: newWorkflowDescription.trim() || undefined,
        stages: [],
      });
      setSelectedWorkflowId(result.workflow.id);
      await refetchWorkflows();
      setCreatingWorkflow(false);
      setNewWorkflowName("");
      setNewWorkflowDescription("");
      triggerToast(`Workflow "${result.workflow.name}" created as a draft.`);
    } catch (error: any) {
      triggerToast(error?.message || "Workflow could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const closeDeleteWorkflow = () => {
    if (deletingWorkflow) return;
    setWorkflowToDelete(null);
    setDeleteConfirmation("");
    setDeleteWorkflowError("");
  };

  const handleDeleteWorkflow = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !workflowToDelete ||
      deletingWorkflow ||
      deleteConfirmation !== `sudo delete "${workflowToDelete.name}"`
    )
      return;
    setDeletingWorkflow(true);
    setDeleteWorkflowError("");
    try {
      await apiClient.delete(`/api/workflows/${workflowToDelete.id}`, {
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
    } catch (error: any) {
      setDeleteWorkflowError(
        error?.message || "Workflow could not be deleted.",
      );
      setDeletingWorkflow(false);
      return;
    }
    setWorkflowToDelete(null);
    setDeleteConfirmation("");
    await Promise.all([
      refetchWorkflows(),
      refetchEnrollments(),
      refetchResearch(),
    ]);
    setDeletingWorkflow(false);
    triggerToast(`Workflow "${workflowToDelete.name}" deleted.`);
  };

  const openNewMilestone = (
    kind: "submission" | "approval" | "event" | "adviser" | "title" = "submission",
    preferredTopicId?: string,
  ) => {
    if (!selectedWorkflowTopics.length) {
      setShowWorkflowCreateMenu(false);
      setEditingTopic(null);
      setTopicTitle("");
      setTopicDescription("");
      setTopicDialogOpen(true);
      triggerToast("Create a topic before adding its first milestone.");
      return;
    }
    const titleProposal = kind === "title";
    setNewTitleProposalCount(3);
    const adviserMilestone = kind === "adviser";
    const topicId = preferredTopicId || selectedWorkflowTopics[0].id;
    setNewMilestoneTitle(titleProposal ? "Title Proposal" : adviserMilestone ? "Secure faculty adviser" : "");
    setNewMilestoneDescription(
      adviserMilestone
        ? "The research group leader must request an eligible faculty adviser. This milestone is approved automatically when the adviser accepts."
        : "",
    );
    setTargetCompletionDate("");
    setNewMilestoneSubmissionMode("GROUP");
    setNewMilestoneFileTypes("PDF,DOCX");
    setNewMilestoneRequiresDocument(kind === "submission");
    setNewMilestoneRequiresApproval(titleProposal || kind === "approval" || adviserMilestone);
    setNewMilestoneScope(
      kind === "approval" || adviserMilestone ? "Pre-requisite" : "Milestone",
    );
    setNewMilestoneTopicId(topicId);
    setNewMilestoneType(titleProposal ? "TITLE_PROPOSAL" : adviserMilestone ? "ADVISER_SELECTION" : "STANDARD");
    setNewMilestoneRequired("");
    setNewMilestoneAttachments([]);
    setShowAdvancedMilestoneOptions(false);
    setShowWorkflowCreateMenu(false);
    setCreatingMilestone(true);
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newMilestoneTitle.trim() ||
      !selectedWorkflowId ||
      !newMilestoneTopicId
    )
      return;
    setSaving(true);
    try {
      const result = await apiClient.post<{ stage: { id: string } }>(
        `/api/workflows/${selectedWorkflowId}/stages`,
        {
          name: newMilestoneTitle.trim(),
          description: newMilestoneDescription.trim() || null,
          topicId: newMilestoneTopicId,
          category: newMilestoneScope,
          targetCompletionDate: targetCompletionDate || null,
          requiresApproval: newMilestoneRequiresApproval,
          requiresDocument: newMilestoneRequiresDocument,
          allowedFileTypes: newMilestoneFileTypes,
          submissionMode: newMilestoneSubmissionMode,
          milestoneType: newMilestoneType,
          titleProposalCount: newTitleProposalCount,
          requiredMilestoneId: newMilestoneRequired || null,
        },
      );
      const attachmentResults = await Promise.allSettled(
        newMilestoneAttachments.map((attachment) => {
          if (attachment.type === "GUIDE") {
            return apiClient.post(
              `/api/workflows/stages/${result.stage.id}/attachments`,
              {
                type: "GUIDE",
                workflowResourceId: attachment.workflowResource?.id,
              },
            );
          }
          if (attachment.type === "LINK") {
            return apiClient.post(
              `/api/workflows/stages/${result.stage.id}/attachments`,
              {
                type: "LINK",
                title: attachment.title,
                url: attachment.url,
              },
            );
          }
          const form = new FormData();
          form.append("type", attachment.type);
          form.append("title", attachment.title);
          if (attachment.file) form.append("file", attachment.file);
          return apiClient.upload(
            `/api/workflows/stages/${result.stage.id}/attachments`,
            form,
          );
        }),
      );
      const failedAttachments = attachmentResults.filter(
        (item) => item.status === "rejected",
      ).length;
      await refetchWorkflows();
      setNewMilestoneTitle("");
      setNewMilestoneDescription("");
      setTargetCompletionDate("");
      setNewMilestoneRequiresApproval(false);
      setNewMilestoneRequiresDocument(true);
      setNewMilestoneSubmissionMode("GROUP");
      setNewMilestoneTopicId("");
      setNewMilestoneType("STANDARD");
      setNewMilestoneRequired("");
      setNewMilestoneAttachments([]);
      setNewMilestoneScope("Milestone");
      setCreatingMilestone(false);
      setShowAdvancedMilestoneOptions(false);
      triggerToast(
        failedAttachments
          ? `Milestone saved, but ${failedAttachments} attachment${failedAttachments === 1 ? "" : "s"} could not be added.`
          : `Milestone "${newMilestoneTitle.trim()}" saved with ${newMilestoneAttachments.length} attachment${newMilestoneAttachments.length === 1 ? "" : "s"}.`,
      );
    } catch (error: any) {
      triggerToast(error?.message || "Milestone could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const openTopicEditor = (topic?: any) => {
    setEditingTopic(topic || null);
    setTopicTitle(topic?.title || "");
    setTopicDescription(topic?.description || "");
    setShowWorkflowCreateMenu(false);
    setTopicDialogOpen(true);
  };

  const handleSaveTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedWorkflowId || topicTitle.trim().length < 2) return;
    setTopicSaving(true);
    try {
      if (editingTopic) {
        await apiClient.patch(`/api/workflows/topics/${editingTopic.id}`, {
          title: topicTitle.trim(),
          description: topicDescription.trim() || null,
        });
        triggerToast(`Topic "${topicTitle.trim()}" updated.`);
      } else {
        const result = await apiClient.post<{ topic: any }>(
          `/api/workflows/${selectedWorkflowId}/topics`,
          {
            title: topicTitle.trim(),
            description: topicDescription.trim() || null,
          },
        );
        setNewMilestoneTopicId(result.topic.id);
        triggerToast(`Topic "${result.topic.title}" created.`);
      }
      await refetchWorkflows();
      setTopicDialogOpen(false);
      setEditingTopic(null);
      setTopicTitle("");
      setTopicDescription("");
    } catch (error: any) {
      triggerToast(error?.message || "The workflow topic could not be saved.");
    } finally {
      setTopicSaving(false);
    }
  };

  const saveTopicOrder = async (reordered: any[]) => {
    if (!selectedWorkflowId || topicOrderSaving) return;
    setTopicOrderSaving(true);
    try {
      await apiClient.patch(
        `/api/workflows/${selectedWorkflowId}/topics/reorder`,
        { topicIds: reordered.map((topic: any) => topic.id) },
      );
      await refetchWorkflows();
      triggerToast("Topic order updated.");
    } catch (error: any) {
      triggerToast(error?.message || "The topic could not be moved.");
    } finally {
      setTopicOrderSaving(false);
      setDraggedTopicId(null);
    }
  };

  const handleMoveTopic = async (topicId: string, direction: -1 | 1) => {
    const index = selectedWorkflowTopics.findIndex(
      (topic: any) => topic.id === topicId,
    );
    const nextIndex = index + direction;
    if (
      index < 0 ||
      nextIndex < 0 ||
      nextIndex >= selectedWorkflowTopics.length
    )
      return;
    const reordered = [...selectedWorkflowTopics];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];
    await saveTopicOrder(reordered);
  };

  const handleDropTopic = async (targetTopicId: string) => {
    if (!draggedTopicId || draggedTopicId === targetTopicId) {
      setDraggedTopicId(null);
      return;
    }
    const reordered = [...selectedWorkflowTopics];
    const sourceIndex = reordered.findIndex(
      (topic: any) => topic.id === draggedTopicId,
    );
    const targetIndex = reordered.findIndex(
      (topic: any) => topic.id === targetTopicId,
    );
    if (sourceIndex < 0 || targetIndex < 0) return setDraggedTopicId(null);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    await saveTopicOrder(reordered);
  };

  const handleDeleteTopic = async (topic: any) => {
    if (!window.confirm(`Delete the empty topic "${topic.title}"?`)) return;
    try {
      await apiClient.delete(`/api/workflows/topics/${topic.id}`);
      await refetchWorkflows();
      triggerToast(`Topic "${topic.title}" deleted.`);
    } catch (error: any) {
      triggerToast(
        error?.message || "Move this topic's milestones before deleting it.",
      );
    }
  };

  const handleCreateRequirement = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedMilestoneId || !newRequirementTitle.trim()) return;
    setSaving(true);
    try {
      const result = await apiClient.post<{ task: any }>(
        `/api/workflows/stages/${selectedMilestoneId}/tasks`,
        {
          title: newRequirementTitle.trim(),
          instructions: newRequirementInstructions.trim() || undefined,
          dueDays: milestoneEditDeadline
            ? null
            : newRequirementDueDays
              ? Number(newRequirementDueDays)
              : null,
          allowedFileTypes: newRequirementFileTypes,
        },
      );
      setEditingMilestone((current: any) =>
        current
          ? { ...current, tasks: [...(current.tasks || []), result.task] }
          : current,
      );
      await refetchWorkflows();
      setNewRequirementTitle("");
      setNewRequirementInstructions("");
      setNewRequirementDueDays("");
      triggerToast("Submission requirement created.");
    } catch (error: any) {
      triggerToast(error?.message || "Requirement could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequirement = async (taskId: string) => {
    if (!window.confirm("Delete this submission requirement?")) return;
    try {
      await apiClient.delete(`/api/workflows/tasks/${taskId}`);
      setEditingMilestone((current: any) =>
        current
          ? {
              ...current,
              tasks: (current.tasks || []).filter(
                (task: any) => task.id !== taskId,
              ),
            }
          : current,
      );
      await refetchWorkflows();
      triggerToast("Requirement deleted.");
    } catch (error: any) {
      triggerToast(error?.message || "Requirement could not be deleted.");
    }
  };

  const handleReviewTaskSubmission = async (
    submissionId: string,
    status: "APPROVED" | "REVISION_REQUIRED",
  ) => {
    if (status === "REVISION_REQUIRED" && !reviewFeedback.trim()) {
      triggerToast("Add clear feedback before requesting a revision.");
      return;
    }
    setReviewSaving(true);
    try {
      const result = await apiClient.patch<{
        lifecycleStatus?: string;
        progression?: {
          advanced: boolean;
          completed: boolean;
          nextStageName?: string;
        };
      }>(`/api/workflows/tasks/submissions/${submissionId}/review`, {
        status,
        reviewNote: reviewFeedback.trim() || "Requirement approved.",
      });
      await Promise.all([refetchResearch(), refetchEligibleDefenseGroups()]);
      setSelectedProject(null);
      setSelectedSubmission(null);
      setReviewFeedback("");
      if (result.lifecycleStatus && !["APPROVED", "REVISION_REQUIRED"].includes(result.lifecycleStatus))
        triggerToast("Your review was recorded. Other required reviews are still pending.");
      else if (result.progression?.completed)
        triggerToast("Approved. The research workflow is now complete.");
      else if (result.progression?.advanced)
        triggerToast(
          `Approved. The group advanced to ${result.progression.nextStageName}.`,
        );
      else
        triggerToast(
          status === "APPROVED"
            ? "Requirement approved."
            : "Revision requested and the group was notified.",
        );
    } catch (error: any) {
      triggerToast(error?.message || "Submission could not be reviewed.");
    } finally {
      setReviewSaving(false);
    }
  };

  const handleToggleTaskLock = async (id: string, currentLock: boolean) => {
    try {
      await apiClient.post(`/api/workflows/stages/${id}/toggle-lock`);
      await refetchWorkflows();
      triggerToast(
        !currentLock
          ? "Milestone access locked."
          : "Milestone access unlocked.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "Milestone access could not be updated.");
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const result = await apiClient.delete<{
        archived?: boolean;
        preservedSubmissions?: number;
        reassignedGroups?: number;
      }>(`/api/workflows/stages/${id}`);
      await refetchWorkflows();
      setMilestonePendingDelete(null);
      setEditingMilestone(null);
      triggerToast(
        result.archived
          ? `Milestone removed from the active workflow. ${result.preservedSubmissions || 0} submission record(s) were safely preserved.`
          : "Milestone deleted.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "Milestone could not be deleted.");
    }
  };

  const publishCollegeAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    setAnnouncementPublishing(true);
    try {
      const result = await apiClient.post<{
        recipientCount: number;
        collegeName?: string;
      }>("/api/notifications/announcements", {
        workflowId: selectedWorkflowId,
        title: announcementTitle,
        message: announcementMessage,
        category: announcementCategory,
        severity: announcementSeverity,
        expiresAt: announcementExpiresAt
          ? new Date(announcementExpiresAt).toISOString()
          : null,
      });
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementCategory("GENERAL");
      setAnnouncementSeverity("INFO");
      setAnnouncementExpiresAt("");
      await refetchAnnouncements();
      triggerToast(
        `Announcement published to ${result.recipientCount} ${result.collegeName || "college"} account(s).`,
      );
    } catch (error: any) {
      triggerToast(
        error?.message || "The announcement could not be published.",
      );
    } finally {
      setAnnouncementPublishing(false);
    }
  };

  const openMilestoneEditor = (milestone: any) => {
    setEditingMilestone(milestone);
    setMilestoneEditTitle(milestone.title || "");
    setMilestoneEditDescription(milestone.description || "");
    setMilestoneEditCategory(milestone.scope || "Milestone");
    setMilestoneEditDeadline(calendarDateValue(milestone.targetCompletionDate));
    setMilestoneEditTargetChanged(false);
    setMilestoneEditRequiresDocument(milestone.requiresDocument !== false);
    setMilestoneEditRequiresApproval(Boolean(milestone.locked));
    setMilestoneEditSubmissionMode(milestone.submissionMode || "EITHER");
    setMilestoneEditTopicId(milestone.topicId || "");
    setMilestoneEditType(milestone.milestoneType || "STANDARD");
    setEditTitleProposalCount(milestone.titleProposalCount || 3);
    setMilestoneEditRequired(milestone.requiredMilestoneId || "");
    setMilestoneSaveStatus("idle");
    setSelectedMilestoneId(milestone.id);
  };

  const handleSaveMilestoneDetails = async () => {
    if (!editingMilestone || !milestoneEditTitle.trim()) return;
    setMilestoneSaveStatus("saving");
    try {
      const result = await apiClient.patch<{ stage: any }>(
        `/api/workflows/stages/${editingMilestone.id}`,
        {
          name: milestoneEditTitle.trim(),
          description: milestoneEditDescription.trim() || null,
          topicId: milestoneEditTopicId,
          category: milestoneEditCategory,
          milestoneType: milestoneEditType,
          titleProposalCount: editTitleProposalCount,
          ...(milestoneEditTargetChanged && {
            targetCompletionDate: milestoneEditDeadline || null,
          }),
          requiresDocument: milestoneEditRequiresDocument,
          taskFileTypes: Object.fromEntries((editingMilestone.tasks || []).map((task: any) => [task.id, task.allowedFileTypes || "PDF,DOCX"])),
          requiresApproval: milestoneEditRequiresApproval,
          submissionMode: milestoneEditSubmissionMode,
          requiredMilestoneId: milestoneEditRequired || null,
        },
      );
      const refreshed = await refetchWorkflows();
      const refreshedStage = refreshed.data?.workflows
        ?.flatMap((workflow: any) => workflow.stages || [])
        .find((stage: any) => stage.id === editingMilestone.id);
      setEditingMilestone((current: any) => ({
        ...current,
        ...result.stage,
        title: result.stage.name,
        tasks: refreshedStage?.tasks || current.tasks,
      }));
      setMilestoneEditTargetChanged(false);
      setMilestoneSaveStatus("saved");
    } catch (error: any) {
      setMilestoneSaveStatus("idle");
      triggerToast(error?.message || "Milestone details could not be saved.");
    }
  };

  const handlePublishWorkflow = async () => {
    if (!selectedWorkflowId || publishingWorkflow) return;
    setPublishingWorkflow(true);
    try {
      const result = await apiClient.post<{
        alreadyPublished: boolean;
        recipients: number;
      }>(`/api/workflows/${selectedWorkflowId}/publish`, {});
      await Promise.all([
        refetchWorkflows(),
        refetchEnrollments(),
        refetchResearch(),
      ]);
      setShowPublishConfirmation(false);
      triggerToast(
        result.alreadyPublished
          ? "This workflow is already published."
          : `Workflow published${result.recipients ? ` and ${result.recipients} affected researcher${result.recipients === 1 ? " was" : "s were"} notified` : ""}.`,
      );
    } catch (error: any) {
      const details = Array.isArray(error?.issues)
        ? ` ${error.issues.join(" ")}`
        : "";
      triggerToast(
        `${error?.message || "Workflow could not be published."}${details}`,
      );
    } finally {
      setPublishingWorkflow(false);
    }
  };

  const handleGenerateWorkflowInvitation = async () => {
    if (!selectedWorkflowId) return;
    setSaving(true);
    try {
      await apiClient.post(
        `/api/workflows/${selectedWorkflowId}/invitation`,
        {},
      );
      await refetchWorkflows();
      triggerToast("Workflow invitation link generated.");
    } catch (error: any) {
      triggerToast(error?.message || "Invitation link could not be generated.");
    } finally {
      setSaving(false);
    }
  };

  const router = useRouter();
  const updateSubmissionQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "submissions");
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "ALL") params.delete(key);
      else params.set(key, value);
    });
    router.push(`/professor/dashboard?${params.toString()}`);
  };

  useEffect(() => {
    setSelectedDeadlineKeys([]);
  }, [submissionWorkflowId]);

  useEffect(() => {
    if (requestedTab === "deadlines") {
      router.replace(
        "/professor/dashboard?tab=submissions&submissionView=deadlines",
      );
    }
  }, [requestedTab, router]);

  const setWorkflowView = (
    view: "milestones" | "resources" | "participants",
  ) => {
    const workflowQuery = selectedWorkflowId
      ? `&workflowId=${encodeURIComponent(selectedWorkflowId)}`
      : "";
    router.push(
      `/professor/dashboard?tab=builder&workflowView=${view}${workflowQuery}`,
    );
  };

  const openWorkflowParticipants = (workflowId: string) => {
    if (!workflowId) return;
    setSelectedWorkflowId(workflowId);
    router.push(
      `/professor/dashboard?tab=builder&workflowView=participants&workflowId=${encodeURIComponent(workflowId)}`,
    );
  };

  const selectMonitoringWorkflow = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    router.replace(
      `/professor/dashboard?tab=monitoring&workflowId=${encodeURIComponent(workflowId)}`,
    );
  };
  const handleTabChange = (tab: string) => {
    if (tab !== "submissions") {
      setSelectedSubmission(null);
      setReviewFeedback("");
    }
    router.push(`/professor/dashboard?tab=${tab}`);
  };

  const submissions = projects
    .flatMap((project) =>
      (project.taskSubmissions || []).map((submission: any) => ({
        ...submission,
        projectId: project.id,
        projectTitle: project.title,
        workflowId: project.workflowId,
        workflowName: project.workflowName,
        currentStage: project.currentStage,
        members: project.members,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  const selectedWorkflow =
    workflows.find((workflow: any) => workflow.id === selectedWorkflowId) ||
    null;
  const selectedWorkflowTopics = selectedWorkflow?.topics || [];
  const selectedWorkflowInvitation = selectedWorkflow?.inviteCode
    ? {
        expiresAt: selectedWorkflow.inviteExpiresAt,
        code: selectedWorkflow.inviteCode,
        link: `${typeof window !== "undefined" ? window.location.origin : ""}/student/workflows/join/${selectedWorkflow.inviteCode}`,
      }
    : null;
  const selectedWorkflowMilestones = milestones.filter(
    (item) => item.workflowId === selectedWorkflowId,
  );
  const milestoneConditionOptions = (topicId: string, editingId?: string) => {
    const editing = selectedWorkflowMilestones.find(
      (item) => item.id === editingId,
    );
    const topicIndex = selectedWorkflowTopics.findIndex(
      (topic: any) => topic.id === topicId,
    );
    return selectedWorkflowMilestones
      .filter(
        (item) =>
          item.id !== editingId &&
          item.scope !== "Archived" &&
          item.sequence > 0,
      )
      .filter((item) => {
        if (editing && editing.topicId === topicId)
          return item.sequence < editing.sequence;
        const candidateTopicIndex = selectedWorkflowTopics.findIndex(
          (topic: any) => topic.id === item.topicId,
        );
        return (
          topicIndex >= 0 &&
          (!item.topicId ||
            (candidateTopicIndex >= 0 && candidateTopicIndex <= topicIndex))
        );
      })
      .sort((a, b) => a.sequence - b.sequence)
      .map((item) => ({
        value: item.id,
        label:
          item.milestoneType === "ADVISER_SELECTION"
            ? `Adviser Milestone: ${item.title}`
            : item.title,
      }));
  };
  const hasAdviserMilestone = selectedWorkflowMilestones.some(
    (item) => item.milestoneType === "ADVISER_SELECTION",
  );
  const ungroupedWorkflowMilestones = selectedWorkflowMilestones.filter(
    (item) => !item.topicId,
  );
  const workflowRequirementCount = selectedWorkflowMilestones.reduce(
    (sum, item) => sum + (item.tasks?.length || 0),
    0,
  );
  const workflowApprovalCount = selectedWorkflowMilestones.filter(
    (item) => item.locked,
  ).length;
  const workflowDocumentMilestoneCount = selectedWorkflowMilestones.filter(
    (item) => item.requiresDocument,
  ).length;
  const workflowReadyToPublish = Boolean(
    selectedWorkflow &&
    selectedWorkflowTopics.length &&
    selectedWorkflowMilestones.length &&
    selectedWorkflowMilestones.every(
      (item) =>
        item.topicId &&
        (!item.requiresDocument ||
          item.tasks?.some((task: any) => task.isRequired !== false)),
    ),
  );
  const workflowConfigurationPercent = selectedWorkflowMilestones.length
    ? Math.round(
        (selectedWorkflowMilestones.filter((item) => item.topicId).length /
          selectedWorkflowMilestones.length) *
          100,
      )
    : 0;
  const workflowSavedLabel = selectedWorkflow?.updatedAt
    ? new Date(selectedWorkflow.updatedAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const workflowEnrollmentCount = acceptedResearchers.filter(
    (item: any) =>
      item.workflowId === selectedWorkflowId ||
      item.workflow?.id === selectedWorkflowId,
  ).length;
  const selectedWorkflowParticipants = acceptedResearchers.filter(
    (item: any) =>
      item.workflowId === selectedWorkflowId ||
      item.workflow?.id === selectedWorkflowId,
  );
  const renderWorkflowMilestone = (milestone: any) => {
    const prerequisite = selectedWorkflowMilestones
      .filter((candidate) => candidate.sequence < milestone.sequence)
      .sort((left, right) => right.sequence - left.sequence)[0];
    const topicPosition = milestone.topicId
      ? selectedWorkflowMilestones
          .filter((candidate) => candidate.topicId === milestone.topicId)
          .sort((left, right) => left.sequence - right.sequence)
          .findIndex((candidate) => candidate.id === milestone.id) + 1
      : milestone.sequence;
    const typeLabel = milestone.milestoneType === "TITLE_PROPOSAL" ? "Title Proposal" : milestone.milestoneType === "ADVISER_SELECTION"
      ? "Adviser Milestone"
      : milestone.milestoneType === "DEFENSE_ELIGIBILITY"
        ? "Defense Eligibility"
        : milestone.requiresDocument !== false
          ? "Submission"
          : milestone.locked
            ? "Approval"
            : "Academic Event";
    const typeStyle = milestone.milestoneType === "ADVISER_SELECTION"
      ? "bg-emerald-50 text-emerald-700"
      : milestone.milestoneType === "DEFENSE_ELIGIBILITY"
        ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
        : milestone.requiresDocument !== false
          ? "bg-blue-50 text-blue-700"
          : milestone.locked
            ? "bg-violet-50 text-violet-700"
            : "bg-amber-50 text-amber-700";
    return (
      <article key={milestone.id} className="group flex flex-wrap items-start gap-3 border-t border-[var(--color-border-subtle)] px-4 py-4 first:border-t-0 sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-sm font-extrabold text-[var(--color-primary)]">
          {topicPosition}
        </span>
        <button
          type="button"
          onClick={() => {
            setShowAdvancedMilestoneOptions(false);
            openMilestoneEditor(milestone);
          }}
          aria-label={`Edit milestone ${milestone.title}`}
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold text-[var(--color-text-primary)]">{milestone.title}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${typeStyle}`}>{typeLabel}</span>
          </span>
          <span className="mt-1.5 block line-clamp-2 text-sm leading-5 text-[var(--color-text-secondary)]">
            {milestone.description || "No student instructions added yet."}
          </span>
          <span className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
            <span className="rounded-lg bg-[var(--color-surface-subtle)] px-2.5 py-1.5"><i className="ti ti-users mr-1" />{milestone.submissionMode === "INDIVIDUAL" ? "Individual" : milestone.submissionMode === "GROUP" ? "Research group" : "Individual or group"}</span>
            <span className="rounded-lg bg-[var(--color-surface-subtle)] px-2.5 py-1.5"><i className="ti ti-calendar mr-1" />{formatMilestoneTarget(milestone)}</span>
            {milestone.requiredMilestoneId && <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-700"><i className="ti ti-lock-check mr-1" />Required: {selectedWorkflowMilestones.find((item) => item.id === milestone.requiredMilestoneId)?.title || "earlier milestone"}</span>}
            {prerequisite && <span className="rounded-lg bg-[var(--color-surface-subtle)] px-2.5 py-1.5"><i className="ti ti-link mr-1" />Prerequisite: {prerequisite.title}</span>}
            {milestone.locked && <span className="rounded-lg bg-[var(--color-surface-subtle)] px-2.5 py-1.5"><i className="ti ti-lock mr-1" />Approval required</span>}
            {milestone.milestoneType === "DEFENSE_ELIGIBILITY" && <span className="rounded-lg bg-[var(--color-primary-light)] px-2.5 py-1.5 text-[var(--color-primary)]"><i className="ti ti-shield-check mr-1" />One defense cycle</span>}
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-1 pt-1 text-[var(--color-text-muted)]" aria-hidden="true"><i className="ti ti-dots text-lg" /><i className="ti ti-grip-vertical text-lg" /></span>
        {milestone.milestoneType === "TITLE_PROPOSAL" && <TitleProposalPanel stageId={milestone.id} count={milestone.titleProposalCount || 3} review />}
      </article>
    );
  };
  const registeredProjects = projects.filter(project => !project.workflowDraft && (project.registeredAt || !project.workflowStages.some((stage: any) => stage.milestoneType === "TITLE_PROPOSAL" && stage.category !== "Archived")));
  const scopedSubmissions = submissions.filter(
    (submission) =>
      submissionWorkflowId === "ALL" ||
      submission.workflowId === submissionWorkflowId,
  );
  const needsReviewCount = scopedSubmissions.filter((submission) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status),
  ).length;
  const filteredSubmissions = scopedSubmissions
    .filter((submission) => {
      const statusMatches =
        submissionFilter === "ALL" ||
        (submissionFilter === "NEEDS_REVIEW" &&
          ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status)) ||
        submission.status === submissionFilter;
      const query = submissionSearch.trim().toLowerCase();
      const searchMatches =
        !query ||
        [
          submission.task?.title,
          submission.document?.title,
          submission.projectTitle,
          submission.submittedByUser?.firstName,
          submission.submittedByUser?.lastName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return statusMatches && searchMatches;
    })
    .sort((a, b) => {
      if (submissionSort === "GROUP")
        return a.projectTitle.localeCompare(b.projectTitle);
      if (submissionSort === "MILESTONE")
        return (a.task?.sequence || 0) - (b.task?.sequence || 0);
      const delta =
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return submissionSort === "NEWEST" ? -delta : delta;
    });

  const deadlineRows: WorkflowDeadlineRow[] = projects
    .flatMap((project: any) => {
      if (
        submissionWorkflowId !== "ALL" &&
        project.workflowId !== submissionWorkflowId
      )
        return [];
      const stages = [...(project.workflowStages || [])].sort(
        (a: any, b: any) => a.sequence - b.sequence,
      );
      return stages.flatMap((stage: any, stageIndex: number) => {
        return (stage.tasks || []).map((task: any) => {
          const { dueAt, projected } = resolveWorkflowDeadline({
            stages,
            stageIndex,
            startedAt: project.workflowStartedAt,
            transitions: project.workflowTransitions || [],
            dueDays: task.dueDays,
          });
          const submission = (project.taskSubmissions || []).find(
            (item: any) => item.taskId === task.id,
          );
          let status: WorkflowDeadlineRow["status"] = dueAt
            ? "NOT_SUBMITTED"
            : "NO_DEADLINE";
          if (submission?.status === "APPROVED") status = "APPROVED";
          else if (submission?.status === "REVISION_REQUIRED")
            status =
              dueAt && !projected && dueAt.getTime() < Date.now()
                ? "REVISION_OVERDUE"
                : "REVISION_REQUIRED";
          else if (submission)
            status =
              dueAt &&
              new Date(submission.submittedAt).getTime() > dueAt.getTime()
                ? "SUBMITTED_LATE"
                : "SUBMITTED";
          else if (dueAt && !projected && dueAt.getTime() < Date.now())
            status = "OVERDUE";
          return {
            key: `${project.id}:${task.id}`,
            researchId: project.id,
            taskId: task.id,
            workflowId: project.workflowId,
            workflowName: project.workflowName,
            projectTitle: project.title,
            milestoneName: stage.name,
            milestoneSequence: stage.sequence,
            requirementTitle: task.title,
            dueAt: dueAt?.toISOString() || null,
            projected,
            status,
          };
        });
      });
    })
    .filter((row) => {
      const query = submissionSearch.trim().toLowerCase();
      return (
        !query ||
        [
          row.requirementTitle,
          row.projectTitle,
          row.milestoneName,
          row.workflowName,
        ].some((value) => String(value).toLowerCase().includes(query))
      );
    });

  const handleSendDeadlineReminders = async () => {
    const items = deadlineRows
      .filter((row) => selectedDeadlineKeys.includes(row.key))
      .map((row) => ({ researchId: row.researchId, taskId: row.taskId }));
    if (!items.length) return;
    setDeadlineReminderSaving(true);
    try {
      const result = await apiClient.post<{ recipientCount: number }>(
        "/api/workflows/deadlines/reminders",
        { items },
      );
      setSelectedDeadlineKeys([]);
      triggerToast(
        `Deadline reminder sent to ${result.recipientCount} researcher${result.recipientCount === 1 ? "" : "s"}.`,
      );
    } catch (error: any) {
      triggerToast(error?.message || "Deadline reminders could not be sent.");
    } finally {
      setDeadlineReminderSaving(false);
    }
  };

  const openSubmissionReview = (submission: any) => {
    setSelectedSubmission(submission);
    setReviewFeedback(submission.reviewNote || "");
  };

  const deleteDefenseSession = async (session: any) => {
    if (
      !window.confirm(
        `Delete the defense session for ${session.research?.title || "this group"}? The schedule and invitations will be cancelled. The group's eligibility will remain available.`,
      )
    )
      return;
    setDefenseActionPending(true);
    try {
      await apiClient.delete(`/api/defense-management/${session.id}`, {
        body: JSON.stringify({ confirmation: `DELETE ${session.id}` }),
      });
      await Promise.all([
        refetchDefenseManagement(),
        refetchDefenseEvents(),
        refetchEligibleDefenseGroups(),
        refetchSignatureGroups(),
      ]);
      triggerToast(
        "Defense session deleted. The group can be scheduled again.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "Unable to delete the defense session.");
    } finally {
      setDefenseActionPending(false);
    }
  };
  const approveDefenseGate = async (group: any) => {
    if (
      !window.confirm(
        `Approve ${group.milestone.name} for ${group.title}? This grants one defense cycle.`,
      )
    )
      return;
    setDefenseActionPending(true);
    try {
      await apiClient.post(
        `/api/defense-management/eligibility/${group.id}/${group.milestone.id}/approve`,
        {},
      );
      await Promise.all([
        refetchEligibilityGates(),
        refetchSignatureGroups(),
        refetchEligibleDefenseGroups(),
        refetchResearch(),
      ]);
      triggerToast(
        "Defense eligibility approved. Request the Dean signature before scheduling.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "Unable to approve defense eligibility.");
    } finally {
      setDefenseActionPending(false);
    }
  };

  const startDefense = async (sessionId: string) => {
    setDefenseActionPending(true);
    try {
      await apiClient.post("/api/defense-sessions/start", { sessionId });
      await Promise.all([
        refetchDefense(),
        refetchDefenseManagement(),
        refetchDefenseEvents(),
      ]);
      triggerToast(
        "Live defense started. Assigned panelists are now synchronized to this group.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "The defense could not be started.");
    } finally {
      setDefenseActionPending(false);
    }
  };

  const resetDefenseForm = () => {
    setShowDefenseForm(false);
    setReschedulingSession(null);
    setDefenseProjectId("");
    setDefenseProjectIds([]);
    setDefenseType("PRE_ORAL_DEFENSE");
    setDefenseDate("");
    setDefenseStartTime("");
    setDefenseEndTime("");
    setDefenseVenue("");
    setDefenseMeetingUrl("");
    setDefenseNotes("");
    setDefenseChairId("");
    setDefensePanelistIds([]);
  };

  const openRescheduleDefense = (session: any) => {
    const start = new Date(session.scheduledStart);
    const end = new Date(session.scheduledEnd);
    const localDate = new Date(
      start.getTime() - start.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 10);
    setReschedulingSession(session);
    setDefenseProjectId(session.researchId);
    setDefenseDate(localDate);
    setDefenseStartTime(start.toTimeString().slice(0, 5));
    setDefenseEndTime(end.toTimeString().slice(0, 5));
    setDefenseVenue(session.venue || "");
    setDefenseMeetingUrl(session.meetingUrl || "");
    setDefenseNotes(session.notes || "");
    setShowDefenseForm(true);
  };

  const saveDefenseRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const scheduledStart = new Date(`${defenseDate}T${defenseStartTime}`);
    const scheduledEnd = new Date(`${defenseDate}T${defenseEndTime}`);
    setDefenseActionPending(true);
    try {
      if (reschedulingSession) {
        await apiClient.patch(
          `/api/defense-management/${reschedulingSession.id}/reschedule`,
          {
            scheduledStart,
            scheduledEnd,
            venue: defenseVenue,
            meetingUrl: defenseMeetingUrl,
            notes: defenseNotes,
          },
        );
        triggerToast("Updated schedule sent for reconfirmation.");
      } else {
        await apiClient.post("/api/defense-events", {
          researchIds: defenseProjectIds,
          defenseType,
          scheduledStart,
          scheduledEnd,
          venue: defenseVenue,
          meetingUrl: defenseMeetingUrl,
          notes: defenseNotes,
          invitees: [
            { userId: defenseChairId, role: "PANEL_CHAIR", isRequired: true },
            ...defensePanelistIds
              .filter((id) => id !== defenseChairId)
              .map((userId) => ({
                userId,
                role: "PANELIST",
                isRequired: true,
              })),
          ],
        });
        triggerToast(
          "Defense event created and invitations sent to every group and panelist.",
        );
      }
      await Promise.all([
        refetchDefenseManagement(),
        refetchDefenseEvents(),
        refetchEligibleDefenseGroups(),
      ]);
      resetDefenseForm();
    } catch (error: any) {
      triggerToast(error?.message || "The defense request could not be saved.");
    } finally {
      setDefenseActionPending(false);
    }
  };

  const updateDefenseQueue = async (
    eventId: string,
    sessionId: string,
    action: string,
  ) => {
    setDefenseActionPending(true);
    try {
      await apiClient.patch(
        `/api/defense-events/${eventId}/queue/${sessionId}`,
        { action },
      );
      await Promise.all([
        refetchDefenseEvents(),
        refetchDefenseManagement(),
        refetchDefense(),
      ]);
      triggerToast(
        action === "PREPARE"
          ? "The next group has been notified to prepare."
          : action === "CALL"
            ? "The group has been called and its live defense has started."
            : "The defense queue has been updated.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "The defense queue could not be updated.");
    } finally {
      setDefenseActionPending(false);
    }
  };

  const replaceDefenseParticipant = async () => {
    if (!replacementInvitation || !replacementUserId) return;
    setDefenseActionPending(true);
    try {
      await apiClient.patch(
        `/api/defense-management/${replacementInvitation.defenseSessionId}/invitations/${replacementInvitation.id}/replace`,
        { userId: replacementUserId },
      );
      await refetchDefenseManagement();
      setReplacementInvitation(null);
      setReplacementUserId("");
      triggerToast(
        "Replacement invitation sent. Existing acceptances were preserved.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "The participant could not be replaced.");
    } finally {
      setDefenseActionPending(false);
    }
  };

  const releaseDefenseResult = async () => {
    if (!liveDefense) return;
    setDefenseActionPending(true);
    try {
      await apiClient.post(`/api/defense-sessions/${liveDefense.id}/release`, {
        decision: officialDecision,
        revisionInstructions:
          officialDecision === "APPROVED_WITH_MINOR_REVISIONS" ||
          officialDecision === "MAJOR_REVISIONS_REQUIRED"
            ? revisionInstructions.trim()
            : undefined,
      });
      await Promise.all([
        refetchDefense(),
        refetchResearch(),
        refetchDefenseManagement(),
        refetchDefenseEvents(),
      ]);
      triggerToast(
        "Official defense result released to the researcher dashboard.",
      );
      setRevisionInstructions("");
    } catch (error: any) {
      triggerToast(error?.message || "The result could not be released.");
    } finally {
      setDefenseActionPending(false);
    }
  };

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { id: "messages", label: "Messages", icon: "ti-messages" },
    {
      id: "monitoring",
      label: "Research Projects",
      icon: "ti-users",
      badge: projects.length,
    },
    {
      id: "builder",
      label: "Task & Stage Builder",
      icon: "ti-settings-automation",
    },
    {
      id: "locking",
      label: "Milestone Locking",
      icon: "ti-lock",
      badge: milestones.filter((m) => m.locked).length,
    },
    { id: "deployment", label: "Workflow Deployment", icon: "ti-rocket" },
    { id: "tracking", label: "Progress Tracking", icon: "ti-chart-line" },
    { id: "completion", label: "Completion Status", icon: "ti-certificate" },
  ];

  if ((projectsLoading || workflowsLoading) && activeTab !== "messages") {
    return activeTab === "overview" ? (
      <DashboardSkeleton />
    ) : (
      <TablePageSkeleton />
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent font-sans text-slate-800">
      <Modal
        isOpen={Boolean(workflowToDelete)}
        onClose={closeDeleteWorkflow}
        title="Delete workflow"
        maxWidth="lg"
      >
        {workflowToDelete && (
          <form onSubmit={handleDeleteWorkflow} className="space-y-4">
            <p className="text-base text-[var(--color-text-secondary)]">
              Permanently delete <strong>{workflowToDelete.name}</strong>,
              including its milestones, topics, resources, invitations, and
              enrollments. This cannot be undone. Workflows linked to research
              projects cannot be deleted.
            </p>
            <div>
              <label
                htmlFor="delete-workflow-confirmation"
                className="block text-sm font-bold text-[var(--color-text-primary)]"
              >
                To confirm, type the exact text below, including the quotation
                marks:
              </label>
              <code
                id="delete-workflow-phrase"
                className="my-2 block whitespace-pre-wrap break-words rounded-lg bg-[var(--color-surface-subtle)] p-3 text-sm select-text"
              >
                {`sudo delete "${workflowToDelete.name}"`}
              </code>
              <input
                id="delete-workflow-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                disabled={deletingWorkflow}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="delete-workflow-phrase"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {deleteWorkflowError && (
              <p role="alert" className="text-sm text-red-600">
                {deleteWorkflowError}
              </p>
            )}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={closeDeleteWorkflow}
                disabled={deletingWorkflow}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  deletingWorkflow ||
                  deleteConfirmation !==
                    `sudo delete "${workflowToDelete.name}"`
                }
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingWorkflow ? "Deleting…" : "Delete workflow"}
              </button>
            </div>
          </form>
        )}
      </Modal>
      {showDeanRequestForm && (
        <ProfessorDeanRequestModal
          projects={signatureGroups}
          onClose={() => setShowDeanRequestForm(false)}
          onSent={(message) => {
            setShowDeanRequestForm(false);
            void refetchSignatureGroups();
            triggerToast(message);
          }}
        />
      )}
      {packetSession && (
        <DefensePacketConfigurator
          session={packetSession}
          onClose={() => setPacketSession(null)}
          onSaved={(message) => {
            setPacketSession(null);
            triggerToast(message);
            refetchDefenseManagement();
          }}
        />
      )}
      {statusSession && (
        <DefenseSessionStatusModal
          session={statusSession.session}
          event={statusSession.event}
          onClose={() => setStatusSession(null)}
        />
      )}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-55 bg-[#1b4264] border border-white/10 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3"
        >
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
        </div>
      )}

      {showPublishConfirmation && selectedWorkflow && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="publish-workflow-title"
          aria-describedby="publish-workflow-description"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !publishingWorkflow)
              setShowPublishConfirmation(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-800">
              <i className="ti ti-send text-xl" aria-hidden="true" />
            </span>
            <h2
              id="publish-workflow-title"
              className="mt-4 text-xl font-extrabold text-[var(--color-text-primary)]"
            >
              Publish “{selectedWorkflow.name}”?
            </h2>
            <p
              id="publish-workflow-description"
              className="mt-2 text-base leading-6 text-[var(--color-text-secondary)]"
            >
              Researchers will see these milestones, deadlines, resources,
              submission rules, and approval gates across Tasks, Documents, and
              their project workspace.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Topics", selectedWorkflowTopics.length],
                ["Milestones", selectedWorkflowMilestones.length],
                ["Approvals", workflowApprovalCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl bg-[var(--color-surface-subtle)] p-3"
                >
                  <strong className="block text-lg text-[var(--color-text-primary)]">
                    {value}
                  </strong>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            {!workflowReadyToPublish && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Add a topic, milestone, and required submission details before
                publishing.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={publishingWorkflow}
                onClick={() => setShowPublishConfirmation(false)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)]"
              >
                Keep editing
              </button>
              <button
                type="button"
                disabled={publishingWorkflow || !workflowReadyToPublish}
                onClick={() => void handlePublishWorkflow()}
                className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-extrabold text-[var(--college-on-primary)] disabled:opacity-50"
              >
                <i
                  className={`ti ${publishingWorkflow ? "ti-loader-2 animate-spin" : "ti-send"} mr-1.5`}
                  aria-hidden="true"
                />
                {publishingWorkflow ? "Publishing…" : "Publish workflow"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStudentPreview && selectedWorkflow && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-workflow-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setShowStudentPreview(false);
          }}
        >
          <section className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                  Student preview
                </p>
                <h2
                  id="student-workflow-preview-title"
                  className="mt-1 text-xl font-black text-[var(--color-text-primary)]"
                >
                  {selectedWorkflow.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  This is how the published sequence and unlock rules will read
                  to a research group.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentPreview(false)}
                aria-label="Close student preview"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-[var(--color-surface-subtle)]"
              >
                <i className="ti ti-x text-xl" aria-hidden="true" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-5">
                {selectedWorkflowTopics.map(
                  (topic: any, topicIndex: number) => {
                    const topicMilestones = selectedWorkflowMilestones.filter(
                      (milestone) => milestone.topicId === topic.id,
                    );
                    return (
                      <section
                        key={topic.id}
                        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
                      >
                        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--color-primary)]">
                          Phase {topicIndex + 1}
                        </p>
                        <h3 className="mt-1 text-lg font-extrabold text-[var(--color-text-primary)]">
                          {topic.title}
                        </h3>
                        {topic.description && (
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {topic.description}
                          </p>
                        )}
                        <div className="mt-4 space-y-3">
                          {topicMilestones.map((milestone, milestoneIndex) => (
                            <article
                              key={milestone.id}
                              className="flex gap-3 rounded-xl bg-[var(--color-surface-subtle)] p-4"
                            >
                              <span
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${topicIndex === 0 && milestoneIndex === 0 ? "bg-[var(--color-primary)] text-[var(--college-on-primary)]" : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"}`}
                              >
                                <i
                                  className={`ti ${topicIndex === 0 && milestoneIndex === 0 ? "ti-player-play" : "ti-lock"}`}
                                  aria-hidden="true"
                                />
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-[var(--color-text-primary)]">
                                  {milestone.sequence}. {milestone.title}
                                </h4>
                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                  {milestone.description ||
                                    "Follow the milestone instructions provided by your professor."}
                                </p>
                                <p className="mt-2 text-xs font-semibold text-[var(--color-text-muted)]">
                                  {formatMilestoneTarget(milestone)} ·{" "}
                                  {milestone.tasks?.length || 0} requirement
                                  {milestone.tasks?.length === 1
                                    ? ""
                                    : "s"} ·{" "}
                                  {milestone.locked
                                    ? "Faculty approval required"
                                    : "Sequential completion"}
                                </p>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {monitoringPendingRemoval && (
        <div
          className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-monitoring-item-title"
          aria-describedby="remove-monitoring-item-description"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !monitoringRemovalSaving
            ) {
              setMonitoringPendingRemoval(null);
              setMonitoringRemovalReason("");
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-700">
              <i className="ti ti-alert-triangle text-2xl" />
            </span>
            <h2
              id="remove-monitoring-item-title"
              className="mt-4 text-xl font-extrabold text-[#102f49]"
            >
              Remove “{monitoringPendingRemoval.name}”?
            </h2>
            <p
              id="remove-monitoring-item-description"
              className="mt-2 text-base leading-6 text-slate-600"
            >
              {monitoringPendingRemoval.kind === "researcher"
                ? `This will revoke the researcher's access to ${monitoringPendingRemoval.workflowName || "this workflow"}. Their project membership and submitted academic records will not be deleted. The reason and enrollment details will be saved in audit history.`
                : "This project will be detached from the professor workflow and removed from active monitoring. The research project, members, documents, and academic records will remain available on the Researcher Dashboard."}
            </p>
            <label
              htmlFor="monitoring-removal-reason"
              className="mt-5 block text-sm font-bold text-slate-700"
            >
              Reason for removal <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="monitoring-removal-reason"
              value={monitoringRemovalReason}
              onChange={(event) =>
                setMonitoringRemovalReason(event.target.value)
              }
              maxLength={500}
              rows={4}
              autoFocus
              placeholder="Explain why this item is being removed…"
              className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3.5 py-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#173f63] focus:ring-2 focus:ring-[#173f63]/10"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>Minimum 5 characters</span>
              <span>{monitoringRemovalReason.length}/500</span>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={monitoringRemovalSaving}
                onClick={() => {
                  setMonitoringPendingRemoval(null);
                  setMonitoringRemovalReason("");
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  monitoringRemovalSaving ||
                  monitoringRemovalReason.trim().length < 5
                }
                onClick={handleMonitoringRemoval}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                <i className="ti ti-trash mr-1.5" />
                {monitoringRemovalSaving ? "Removing…" : "Confirm remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMilestone && (
        <MilestoneComposer
          mode="edit"
          requirementsSignature={JSON.stringify((editingMilestone.tasks || []).map((task: any) => [task.id, task.allowedFileTypes]))}
          workflowName={selectedWorkflow?.name || "Research workflow"}
          topics={selectedWorkflowTopics}
          topicId={milestoneEditTopicId}
          title={milestoneEditTitle}
          instructions={milestoneEditDescription}
          targetCompletionDate={milestoneEditDeadline}
          legacyDeadlineDays={
            milestoneEditTargetChanged ? null : editingMilestone.deadlineDays
          }
          submissionMode={milestoneEditSubmissionMode}
          requiresDocument={milestoneEditRequiresDocument}
          requiresApproval={milestoneEditRequiresApproval}
          category={milestoneEditCategory}
          titleProposalCount={editTitleProposalCount}
          onTitleProposalCountChange={value => { setEditTitleProposalCount(value); setMilestoneSaveStatus("idle"); }}
          milestoneType={milestoneEditType}
          onMilestoneTypeChange={(value) => {
            setMilestoneEditType(value);
            setMilestoneSaveStatus("idle");
          }}
          requiredMilestoneId={milestoneEditRequired}
          milestoneConditions={milestoneConditionOptions(
            milestoneEditTopicId,
            editingMilestone.id,
          )}
          onRequiredMilestoneChange={(value) => {
            setMilestoneEditRequired(value);
            setMilestoneSaveStatus("idle");
          }}
          saving={milestoneSaveStatus === "saving"}
          saveStatus={milestoneSaveStatus}
          prerequisiteLabel={
            selectedWorkflowMilestones
              .filter(
                (milestone) => milestone.sequence < editingMilestone.sequence,
              )
              .sort((left, right) => right.sequence - left.sequence)[0]
              ?.title || "Available when the workflow begins"
          }
          advancedOpen={showAdvancedMilestoneOptions}
          onTitleChange={(value) => {
            setMilestoneEditTitle(value);
            setMilestoneSaveStatus("idle");
          }}
          onTopicIdChange={(value) => {
            setMilestoneEditTopicId(value);
            setMilestoneSaveStatus("idle");
          }}
          onInstructionsChange={(value) => {
            setMilestoneEditDescription(value);
            setMilestoneSaveStatus("idle");
          }}
          onTargetCompletionDateChange={(value) => {
            setMilestoneEditDeadline(value);
            setMilestoneEditTargetChanged(true);
            setMilestoneSaveStatus("idle");
          }}
          onSubmissionModeChange={(value) => {
            setMilestoneEditSubmissionMode(value);
            setMilestoneSaveStatus("idle");
          }}
          onRequiresDocumentChange={(value) => {
            setMilestoneEditRequiresDocument(value);
            setMilestoneSaveStatus("idle");
          }}
          onRequiresApprovalChange={(value) => {
            setMilestoneEditRequiresApproval(value);
            setMilestoneSaveStatus("idle");
          }}
          onCategoryChange={(value) => {
            setMilestoneEditCategory(value);
            setMilestoneSaveStatus("idle");
          }}
          onAdvancedOpenChange={setShowAdvancedMilestoneOptions}
          onClose={() => setEditingMilestone(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveMilestoneDetails();
          }}
          onDelete={() => setMilestonePendingDelete(editingMilestone)}
          requirementsContent={
            ["STANDARD", "DEFENSE_ELIGIBILITY"].includes(milestoneEditType) ? (
              <div className="mt-4 space-y-3">
                {(editingMilestone.tasks || []).map((requirement: any) => (
                  <div
                    key={requirement.id}
                    className="flex items-start justify-between rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="text-base font-bold text-[#102f49]">
                        {requirement.title}
                      </p>
                      <p className="mt-0.5 text-base text-slate-500">
                        {requirement.allowedFileTypes || "PDF,DOCX"} ·{" "}
                        {formatTaskDeadline({
                          ...requirement,
                          stage: {
                            deadlineDays: milestoneEditTargetChanged
                              ? null
                              : editingMilestone.deadlineDays,
                            targetCompletionDate: milestoneEditDeadline || null,
                          },
                        })}
                      </p>
                      <SubmissionFileTypes value={requirement.allowedFileTypes || "PDF,DOCX"} onChange={(value) => {
                        setEditingMilestone((current: any) => ({ ...current, tasks: current.tasks.map((task: any) => task.id === requirement.id ? { ...task, allowedFileTypes: value } : task) }));
                        setMilestoneSaveStatus("idle");
                      }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRequirement(requirement.id)}
                      aria-label={`Delete ${requirement.title}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                ))}
                <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                  <p className="text-base font-extrabold text-[#102f49]">
                    Add another requirement
                  </p>
                  <input
                    value={newRequirementTitle}
                    onChange={(event) =>
                      setNewRequirementTitle(event.target.value)
                    }
                    placeholder="e.g. Chapter 1 PDF"
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                  />
                  <textarea
                    value={newRequirementInstructions}
                    onChange={(event) =>
                      setNewRequirementInstructions(event.target.value)
                    }
                    rows={2}
                    placeholder="Short instructions (optional)"
                    className="w-full resize-none rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      max="3650"
                      value={newRequirementDueDays}
                      onChange={(event) =>
                        setNewRequirementDueDays(event.target.value)
                      }
                      disabled={Boolean(milestoneEditDeadline)}
                      placeholder={
                        milestoneEditDeadline
                          ? "Uses milestone date"
                          : "Target days"
                      }
                      className="rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                    />
                    <SubmissionFileTypes value={newRequirementFileTypes} onChange={setNewRequirementFileTypes} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateRequirement()}
                    disabled={saving || !newRequirementTitle.trim()}
                    className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                  >
                    {saving ? "Adding…" : "Add requirement"}
                  </button>
                </div>
              </div>
            ) : undefined
          }
          attachmentsContent={
            milestoneEditType === "STANDARD" ? (
              <MilestoneAttachmentsCard
                stageId={editingMilestone.id}
                workflowId={selectedWorkflowId}
              />
            ) : undefined
          }
        />
      )}

      {legacyWorkflowUiEnabled && editingMilestone && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-editor-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingMilestone(null);
          }}
        >
          <aside className="ml-auto flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-base font-bold text-[#d98d00]">
                  Milestone details
                </p>
                <h2
                  id="milestone-editor-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  Edit milestone
                </h2>
                <p className="mt-1 text-base text-slate-500">
                  Keep the essentials simple. Optional rules stay out of the
                  way.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMilestone(null)}
                aria-label="Close milestone editor"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#173f63] hover:bg-slate-200"
              >
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section className="space-y-4">
                <div>
                  <h3 className="font-extrabold text-[#102f49]">
                    Basic details
                  </h3>
                  <p className="text-base text-slate-500">
                    The information students will see.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Milestone name
                  </label>
                  <input
                    value={milestoneEditTitle}
                    onChange={(event) => {
                      setMilestoneEditTitle(event.target.value);
                      setMilestoneSaveStatus("idle");
                    }}
                    maxLength={150}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-semibold text-[#102f49] outline-none focus:border-[#173f63]"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Instructions for students
                  </label>
                  <textarea
                    value={milestoneEditDescription}
                    onChange={(event) => {
                      setMilestoneEditDescription(event.target.value);
                      setMilestoneSaveStatus("idle");
                    }}
                    maxLength={4000}
                    rows={5}
                    placeholder="Explain what students need to complete."
                    className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3.5 py-3 text-base leading-6 text-slate-700 outline-none focus:border-[#173f63]"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Target completion
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type="date"
                      value={milestoneEditDeadline}
                      onChange={(event) => {
                        setMilestoneEditDeadline(event.target.value);
                        setMilestoneEditTargetChanged(true);
                        setMilestoneSaveStatus("idle");
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-[#173f63]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Who completes this milestone?
                  </label>
                  <select
                    value={milestoneEditSubmissionMode}
                    onChange={(event) => {
                      setMilestoneEditSubmissionMode(event.target.value);
                      setMilestoneSaveStatus("idle");
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base"
                  >
                    <option value="INDIVIDUAL">Individual researcher</option>
                    <option value="GROUP">Research group</option>
                    <option value="EITHER">Individual or group</option>
                  </select>
                </div>
              </section>
              <section className="border-t border-slate-200 pt-5">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span>
                    <span className="block font-extrabold text-[#102f49]">
                      Document submission required
                    </span>
                    <span className="text-xs text-slate-500">
                      Students may create a document or upload a PDF/DOCX.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={milestoneEditRequiresDocument}
                    onChange={(event) => {
                      setMilestoneEditRequiresDocument(event.target.checked);
                      setMilestoneSaveStatus("idle");
                    }}
                    className="h-5 w-5 accent-[#f6a800]"
                  />
                </label>
                {milestoneEditRequiresDocument ? (
                  <>
                    <div className="mt-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-[#102f49]">
                          Student submissions
                        </h3>
                        <p className="text-base text-slate-500">
                          Files or documents required for this milestone.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {editingMilestone.tasks?.length || 0}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {editingMilestone.tasks?.map((requirement: any) => (
                        <div
                          key={requirement.id}
                          className="flex items-start justify-between rounded-xl border border-slate-200 p-3"
                        >
                          <div>
                            <p className="text-base font-bold text-[#102f49]">
                              {requirement.title}
                            </p>
                            <p className="mt-0.5 text-base text-slate-500">
                              {requirement.allowedFileTypes} ·{" "}
                              {formatTaskDeadline({
                                ...requirement,
                                stage: {
                                  deadlineDays: milestoneEditTargetChanged
                                    ? null
                                    : editingMilestone.deadlineDays,
                                  targetCompletionDate:
                                    milestoneEditDeadline || null,
                                },
                              })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRequirement(requirement.id)
                            }
                            aria-label={`Delete ${requirement.title}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <form
                      onSubmit={handleCreateRequirement}
                      className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4"
                    >
                      <p className="text-base font-extrabold text-[#102f49]">
                        Add a submission
                      </p>
                      <input
                        required
                        value={newRequirementTitle}
                        onChange={(e) => setNewRequirementTitle(e.target.value)}
                        placeholder="e.g. Chapter 1 PDF"
                        className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                      />
                      <textarea
                        value={newRequirementInstructions}
                        onChange={(e) =>
                          setNewRequirementInstructions(e.target.value)
                        }
                        rows={2}
                        placeholder="Short instructions (optional)"
                        className="w-full resize-none rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          max="3650"
                          value={newRequirementDueDays}
                          onChange={(e) =>
                            setNewRequirementDueDays(e.target.value)
                          }
                          disabled={Boolean(milestoneEditDeadline)}
                          placeholder={
                            milestoneEditDeadline
                              ? "Uses milestone date"
                              : "Due in days"
                          }
                          className="rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                        />
                        <SubmissionFileTypes value={newRequirementFileTypes} onChange={setNewRequirementFileTypes} />
                      </div>
                      <button
                        disabled={saving}
                        className="w-full rounded-xl bg-[#173f63] py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                      >
                        {saving ? "Adding…" : "Add submission requirement"}
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="mt-3 rounded-xl bg-blue-50 p-4 text-base text-blue-800">
                    This milestone is instruction or approval based. Researchers
                    will not be asked for a document.
                  </p>
                )}
              </section>
              <section className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowAdvancedMilestoneOptions((value) => !value)
                  }
                  className="flex w-full items-center justify-between text-left"
                >
                  <span>
                    <span className="block font-extrabold text-[#102f49]">
                      Advanced settings
                    </span>
                    <span className="text-sm text-slate-500">
                      Type and access controls
                    </span>
                  </span>
                  <i
                    className={`ti ${showAdvancedMilestoneOptions ? "ti-chevron-up" : "ti-chevron-down"}`}
                  />
                </button>
                {showAdvancedMilestoneOptions && (
                  <div className="mt-4">
                    <label className="text-sm font-bold text-slate-700">
                      Milestone type
                    </label>
                    <select
                      value={milestoneEditCategory}
                      onChange={(event) => {
                        setMilestoneEditCategory(event.target.value);
                        setMilestoneSaveStatus("idle");
                      }}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base"
                    >
                      <option value="Milestone">Standard milestone</option>
                      <option value="Compliance">Compliance requirement</option>
                      <option value="Pre-requisite">Approval gate</option>
                    </select>
                  </div>
                )}
              </section>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
              <div
                className="flex items-center gap-3 text-sm font-bold"
                aria-live="polite"
              >
                <button
                  type="button"
                  onClick={() => setMilestonePendingDelete(editingMilestone)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-extrabold text-rose-700 hover:bg-rose-100"
                >
                  <i className="ti ti-trash mr-1.5" />
                  Delete milestone
                </button>
                {milestoneSaveStatus === "saved" && (
                  <span className="text-emerald-600">
                    <i className="ti ti-circle-check-filled" /> Saved
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMilestone(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMilestoneDetails}
                  disabled={
                    milestoneSaveStatus === "saving" ||
                    !milestoneEditTitle.trim()
                  }
                  className="rounded-xl bg-[#f6a800] px-5 py-2.5 text-sm font-extrabold text-[#102f49] disabled:opacity-60"
                >
                  {milestoneSaveStatus === "saving"
                    ? "Saving…"
                    : "Save changes"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {milestonePendingDelete && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-milestone-title"
          aria-describedby="delete-milestone-description"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-700">
              <i className="ti ti-alert-triangle text-2xl" />
            </span>
            <h2
              id="delete-milestone-title"
              className="mt-4 text-xl font-extrabold text-[#102f49]"
            >
              Delete “{milestonePendingDelete.title}”?
            </h2>
            <p
              id="delete-milestone-description"
              className="mt-2 text-base leading-6 text-slate-600"
            >
              If this milestone is unused, it will be permanently deleted. If
              groups or submission history already depend on it, the milestone
              will be removed from the active workflow and its academic records
              will be safely preserved.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMilestonePendingDelete(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Keep milestone
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTask(milestonePendingDelete.id)}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white"
              >
                <i className="ti ti-trash mr-1.5" />
                Remove milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {creatingWorkflow && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-workflow-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setCreatingWorkflow(false);
          }}
        >
          <form
            onSubmit={handleCreateWorkflow}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-[#d98d00]">
                  New workflow
                </p>
                <h2
                  id="create-workflow-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  Create your workflow
                </h2>
                <p className="mt-1 text-base text-slate-500">
                  Start with an empty draft for your assigned department.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close create workflow dialog"
                onClick={() => setCreatingWorkflow(false)}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-blue-900">
              <strong>{user?.college?.name || "College not assigned"}</strong>
              <span className="mx-1.5 text-blue-300">·</span>
              <span>{user?.program?.name || "Department not assigned"}</span>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="workflow-name"
                  className="mb-1.5 block text-sm font-bold text-slate-700"
                >
                  Workflow name
                </label>
                <input
                  id="workflow-name"
                  value={newWorkflowName}
                  onChange={(event) => setNewWorkflowName(event.target.value)}
                  maxLength={150}
                  placeholder="e.g. BSIT Capstone Workflow 2026"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                  autoFocus
                  required
                />
                <p className="mt-1 text-base text-slate-400">
                  The name must be unique within your department or program.
                </p>
              </div>

              {availableResearchTypes.length > 1 && (
                <div>
                  <label
                    htmlFor="workflow-research-type"
                    className="mb-1.5 block text-sm font-bold text-slate-700"
                  >
                    Research type
                  </label>
                  <select
                    id="workflow-research-type"
                    value={newWorkflowResearchTypeId}
                    onChange={(event) =>
                      setNewWorkflowResearchTypeId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base"
                  >
                    {availableResearchTypes.map((researchType: any) => (
                      <option key={researchType.id} value={researchType.id}>
                        {researchType.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="workflow-description"
                  className="mb-1.5 block text-sm font-bold text-slate-700"
                >
                  Description{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="workflow-description"
                  value={newWorkflowDescription}
                  onChange={(event) =>
                    setNewWorkflowDescription(event.target.value)
                  }
                  rows={3}
                  placeholder="Briefly describe when this workflow should be used."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            {!user?.program?.id && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-base text-amber-800">
                Your account must be assigned to a department or program before
                creating a workflow.
              </p>
            )}
            {user?.program?.id && availableResearchTypes.length === 0 && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-base text-amber-800">
                No active research type is configured for your department. Ask
                the System Administrator to configure one first.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setCreatingWorkflow(false)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  newWorkflowName.trim().length < 3 ||
                  !newWorkflowResearchTypeId
                }
                className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create workflow"}
              </button>
            </div>
          </form>
        </div>
      )}

      {topicDialogOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workflow-topic-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !topicSaving)
              setTopicDialogOpen(false);
          }}
        >
          <form
            onSubmit={handleSaveTopic}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-[#C58A18]">
                  Workflow topic
                </p>
                <h2
                  id="workflow-topic-dialog-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  {editingTopic ? "Edit topic" : "Create a topic"}
                </h2>
                <p className="mt-1 text-base text-slate-500">
                  Group related milestones under a phase such as Title Defense
                  or Final Defense.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTopicDialogOpen(false)}
                disabled={topicSaving}
                aria-label="Close topic dialog"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700">
                  Topic title <span className="text-rose-600">*</span>
                </span>
                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={150}
                  value={topicTitle}
                  onChange={(event) => setTopicTitle(event.target.value)}
                  placeholder="e.g. Title Defense"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700">
                  Description{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={topicDescription}
                  onChange={(event) => setTopicDescription(event.target.value)}
                  placeholder="Explain what this phase covers."
                  className="w-full resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setTopicDialogOpen(false)}
                disabled={topicSaving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={topicSaving || topicTitle.trim().length < 2}
                className="rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {topicSaving
                  ? "Saving…"
                  : editingTopic
                    ? "Save changes"
                    : "Create topic"}
              </button>
            </div>
          </form>
        </div>
      )}

      {creatingMilestone && (
        <MilestoneComposer
          mode="create"
          workflowName={selectedWorkflow?.name || "Research workflow"}
          topics={selectedWorkflowTopics}
          topicId={newMilestoneTopicId}
          title={newMilestoneTitle}
          instructions={newMilestoneDescription}
          targetCompletionDate={targetCompletionDate}
          submissionMode={newMilestoneSubmissionMode}
          requiresDocument={newMilestoneRequiresDocument}
          allowedFileTypes={newMilestoneFileTypes}
          onAllowedFileTypesChange={setNewMilestoneFileTypes}
          requiresApproval={newMilestoneRequiresApproval}
          category={newMilestoneScope}
          titleProposalCount={newTitleProposalCount}
          onTitleProposalCountChange={setNewTitleProposalCount}
          milestoneType={newMilestoneType}
          onMilestoneTypeChange={setNewMilestoneType}
          requiredMilestoneId={newMilestoneRequired}
          milestoneConditions={milestoneConditionOptions(newMilestoneTopicId)}
          saving={saving}
          advancedOpen={showAdvancedMilestoneOptions}
          prerequisiteLabel="The previous milestone in this workflow sequence"
          onTitleChange={setNewMilestoneTitle}
          onTopicIdChange={(topicId) => {
            setNewMilestoneTopicId(topicId);
            setNewMilestoneRequired("");
          }}
          onInstructionsChange={setNewMilestoneDescription}
          onTargetCompletionDateChange={setTargetCompletionDate}
          onSubmissionModeChange={setNewMilestoneSubmissionMode}
          onRequiresDocumentChange={setNewMilestoneRequiresDocument}
          onRequiresApprovalChange={setNewMilestoneRequiresApproval}
          onCategoryChange={setNewMilestoneScope}
          onRequiredMilestoneChange={setNewMilestoneRequired}
          onAdvancedOpenChange={setShowAdvancedMilestoneOptions}
          onClose={() => setCreatingMilestone(false)}
          onSubmit={handleCreateMilestone}
          attachmentsContent={
            newMilestoneType !== "ADVISER_SELECTION" ? (
              <MilestoneAttachmentsCard
                workflowId={selectedWorkflowId}
                pendingAttachments={newMilestoneAttachments}
                onPendingAttachmentsChange={setNewMilestoneAttachments}
              />
            ) : undefined
          }
        />
      )}

      {legacyWorkflowUiEnabled && creatingMilestone && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-milestone-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setCreatingMilestone(false);
          }}
        >
          <aside className="ml-auto flex h-full w-full max-w-[500px] flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-base font-bold text-[#d98d00]">
                  New milestone
                </p>
                <h2
                  id="create-milestone-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  What should students do next?
                </h2>
                <p className="mt-1 text-base text-slate-500">
                  Choose a starting point, then fill in the essentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatingMilestone(false)}
                aria-label="Close new milestone drawer"
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-[#173f63]"
              >
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <form
              onSubmit={handleCreateMilestone}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <section>
                  <h3 className="font-extrabold text-[#102f49]">
                    Choose a template
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "Document submission",
                        icon: "ti-file-upload",
                        type: "Milestone",
                        title: "Document submission",
                        requiresDocument: true,
                      },
                      {
                        label: "Review & approval",
                        icon: "ti-checkup-list",
                        type: "Pre-requisite",
                        title: "Faculty review and approval",
                        requiresDocument: false,
                      },
                      {
                        label: "Academic event",
                        icon: "ti-presentation",
                        type: "Milestone",
                        title: "Academic presentation",
                        requiresDocument: false,
                      },
                      {
                        label: "Blank milestone",
                        icon: "ti-plus",
                        type: "Milestone",
                        title: "",
                        requiresDocument: false,
                      },
                    ].map((template) => (
                      <button
                        key={template.label}
                        type="button"
                        onClick={() => {
                          setNewMilestoneScope(template.type);
                          setNewMilestoneTitle(template.title);
                          setNewMilestoneRequiresDocument(
                            template.requiresDocument,
                          );
                        }}
                        className={`rounded-xl border p-3 text-left transition ${newMilestoneTitle === template.title && template.title ? "border-[#f6a800] bg-amber-50" : "border-slate-200 hover:border-[#f6a800]"}`}
                      >
                        <i
                          className={`ti ${template.icon} text-xl text-[#173f63]`}
                        />
                        <span className="mt-2 block text-sm font-bold text-[#102f49]">
                          {template.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="space-y-4 border-t border-slate-200 pt-5">
                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Research workflow
                    </label>
                    <select
                      value={selectedWorkflowId}
                      onChange={(e) => setSelectedWorkflowId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                    >
                      {workflows.map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Milestone name
                    </label>
                    <input
                      required
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      placeholder="e.g. Chapter 1 submission"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Target completion
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type="date"
                        value={targetCompletionDate}
                        onChange={(e) =>
                          setTargetCompletionDate(e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Who completes this milestone?
                    </label>
                    <select
                      value={newMilestoneSubmissionMode}
                      onChange={(event) =>
                        setNewMilestoneSubmissionMode(event.target.value)
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                    >
                      <option value="INDIVIDUAL">Individual researcher</option>
                      <option value="GROUP">Research group</option>
                      <option value="EITHER">Individual or group</option>
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span>
                      <span className="block text-sm font-bold text-[#102f49]">
                        Requires a document
                      </span>
                      <span className="text-xs text-slate-500">
                        Enable Documents and direct file upload.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={newMilestoneRequiresDocument}
                      onChange={(event) =>
                        setNewMilestoneRequiresDocument(event.target.checked)
                      }
                      className="h-5 w-5 accent-[#f6a800]"
                    />
                  </label>
                </section>
                <section className="border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAdvancedMilestoneOptions((value) => !value)
                    }
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span>
                      <span className="block font-extrabold text-[#102f49]">
                        Advanced settings
                      </span>
                      <span className="text-sm text-slate-500">
                        Most professors can leave these unchanged.
                      </span>
                    </span>
                    <i
                      className={`ti ${showAdvancedMilestoneOptions ? "ti-chevron-up" : "ti-chevron-down"}`}
                    />
                  </button>
                  {showAdvancedMilestoneOptions && (
                    <div className="mt-4">
                      <label className="text-sm font-bold text-slate-700">
                        Milestone type
                      </label>
                      <select
                        value={newMilestoneScope}
                        onChange={(e) => setNewMilestoneScope(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-base"
                      >
                        <option value="Milestone">Standard milestone</option>
                        <option value="Compliance">
                          Compliance requirement
                        </option>
                        <option value="Pre-requisite">Approval gate</option>
                      </select>
                    </div>
                  )}
                </section>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setCreatingMilestone(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    !newMilestoneTitle.trim() ||
                    !selectedWorkflowId ||
                    !newMilestoneTopicId
                  }
                  className="rounded-xl bg-[#f6a800] px-5 py-2.5 text-sm font-extrabold text-[#102f49] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save milestone"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-detail-title"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-[#d98d00]">
                  Research project
                </p>
                <h2
                  id="project-detail-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  {selectedProject.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                aria-label="Close project details"
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-[#173f63]"
              >
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-base text-slate-500">Status</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.status}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-base text-slate-500">Current stage</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.currentStage?.name || "Not started"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-base text-slate-500">Progress</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.progress}%
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Project description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-base leading-6 text-slate-600">
                {selectedProject.abstract ||
                  "No project description has been added yet."}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-base text-slate-500">Research type</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.researchType?.name || "Not specified"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-base text-slate-500">Program</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.program?.code ||
                    selectedProject.program?.name ||
                    "Not specified"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-base text-slate-500">Academic year</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.academicYear?.name || "Not specified"}
                </p>
              </div>
            </div>
            <h3 className="mt-6 font-extrabold text-[#102f49]">Adviser</h3>
            <div className="mt-3 rounded-xl border border-slate-200 p-4">
              {selectedProject.adviser ? (
                <div>
                  <p className="font-bold text-[#102f49]">
                    {selectedProject.adviser.firstName}{" "}
                    {selectedProject.adviser.lastName}
                  </p>
                  <p className="mt-1 text-base text-slate-500">
                    {selectedProject.adviser.email}
                  </p>
                </div>
              ) : (
                <p className="text-base text-slate-500">
                  No adviser has been assigned yet.
                </p>
              )}
            </div>
            <h3 className="mt-6 font-extrabold text-[#102f49]">
              Researchers ({selectedProject.researchers.length})
            </h3>
            <div className="mt-3 space-y-2">
              {selectedProject.researchers.length ? (
                selectedProject.researchers.map((member: any) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-bold text-[#102f49]">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <p className="text-base text-slate-500">
                        {member.user.email}
                      </p>
                    </div>
                    <Tag
                      variant={
                        member.projectRole === "LEADER" ? "info" : "success"
                      }
                    >
                      {member.projectRole}
                    </Tag>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-base text-slate-500">
                  No researchers have been assigned.
                </p>
              )}
            </div>
            <h3 className="mt-6 font-extrabold text-[#102f49]">
              Workflow stages
            </h3>
            <div className="mt-3 space-y-2">
              {selectedProject.workflowStages.map((stage: any) => {
                const progress = selectedProject.milestoneProgress?.find(
                  (item: any) => item.id === stage.id,
                );
                const adviserMilestone = progress?.adviserMilestone;
                return (
                  <div
                    key={stage.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#102f49]">
                          {stage.sequence}. {stage.name}
                        </p>
                        {stage.milestoneType === "ADVISER_SELECTION" && (
                          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#C58A18]">
                            Adviser Milestone
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatMilestoneTarget(stage)}
                      </span>
                    </div>
                    {stage.milestoneType === "ADVISER_SELECTION" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                        <Tag
                          variant={
                            adviserMilestone?.status === "APPROVED"
                              ? "success"
                              : adviserMilestone?.status === "DECLINED"
                                ? "warn"
                                : "info"
                          }
                        >
                          {(adviserMilestone?.status || "NOT_STARTED").replace(
                            /_/g,
                            " ",
                          )}
                        </Tag>
                        {adviserMilestone?.adviser && (
                          <span>
                            {adviserMilestone.adviser.firstName}{" "}
                            {adviserMilestone.adviser.lastName}
                          </span>
                        )}
                        {adviserMilestone?.acceptedAt && (
                          <span>
                            Accepted{" "}
                            {new Date(
                              adviserMilestone.acceptedAt,
                            ).toLocaleString()}
                          </span>
                        )}
                        {!adviserMilestone?.acceptedAt &&
                          adviserMilestone?.requestedAt && (
                            <span>
                              Requested{" "}
                              {new Date(
                                adviserMilestone.requestedAt,
                              ).toLocaleString()}
                            </span>
                          )}
                        {adviserMilestone?.status === "DECLINED" &&
                          adviserMilestone?.respondedAt && (
                            <span>
                              Responded{" "}
                              {new Date(
                                adviserMilestone.respondedAt,
                              ).toLocaleString()}
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <h3 className="mt-6 font-extrabold text-[#102f49]">
              Task submissions
            </h3>
            <div className="mt-3 space-y-2">
              {selectedProject.taskSubmissions?.length ? (
                selectedProject.taskSubmissions.map((submission: any) => (
                  <div
                    key={submission.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[#102f49]">
                          {submission.task?.title}
                        </p>
                        <p className="text-base text-slate-500">
                          {submission.document?.title} ·{" "}
                          {submission.status.replace(/_/g, " ")}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          openSubmissionReview({
                            ...submission,
                            projectId: selectedProject.id,
                            projectTitle: selectedProject.title,
                            currentStage: selectedProject.currentStage,
                            members: selectedProject.members,
                          });
                          setSelectedProject(null);
                          handleTabChange("submissions");
                        }}
                        className="rounded-lg bg-[#173f63] px-3 py-1.5 text-sm font-extrabold text-white"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-base text-slate-500">
                  No task submissions yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div
        className={`flex w-full flex-1 flex-col space-y-6 ${activeTab === "messages" ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8"}`}
      >
        {(() => {
          const tabContent: Record<string, React.ReactNode> = {
            messages: <FacultyGroupChats triggerToast={triggerToast} />,
            overview: (
              <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
                <DashboardWelcome
                  firstName={user?.firstName}
                  fallbackName="Professor"
                  summary="Here's an overview of the research activity and submissions you are monitoring."
                  actions={
                    <>
                      <button
                        onClick={() => handleTabChange("builder")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-5 text-sm font-bold text-[var(--college-on-primary)] shadow-xs transition dark:text-[var(--college-on-primary-dark)]"
                      >
                        <i className="ti ti-plus text-base" /> Create Milestone
                      </button>
                      <button
                        onClick={() => handleTabChange("monitoring")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-white/80 dark:bg-white/10 px-4 text-sm font-semibold text-[var(--color-text-primary)] dark:text-white dark:border-white/20 shadow-2xs backdrop-blur-xs transition hover:bg-white dark:hover:bg-white/20"
                      >
                        <i className="ti ti-folders text-base" /> Monitor Groups
                        ({projects.length})
                      </button>
                      <button
                        onClick={() => handleTabChange("submissions")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-white/80 dark:bg-white/10 px-4 text-sm font-semibold text-[var(--color-text-primary)] dark:text-white dark:border-white/20 shadow-2xs backdrop-blur-xs transition hover:bg-white dark:hover:bg-white/20"
                      >
                        <i className="ti ti-file-text text-base" /> Submissions
                      </button>
                    </>
                  }
                />
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Recent activity
                      </p>
                      <h2 className="mt-1 text-lg font-extrabold text-[#102f49]">
                        College and system updates
                      </h2>
                      <p className="mt-1 text-base text-slate-500">
                        Official notices are labeled by source so you can
                        quickly distinguish department and system messages.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTabChange("announcements")}
                      className="shrink-0 text-sm font-bold text-[#173f63]"
                    >
                      View all <i className="ti ti-chevron-right" />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {announcements.slice(0, 3).map((announcement) => (
                      <article
                        key={announcement.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${announcement.source === "SYSTEM_ADMIN" ? "bg-violet-500" : announcement.source === "DEAN" ? "bg-blue-500" : "bg-emerald-500"}`}
                          />
                          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                            {announcement.source === "SYSTEM_ADMIN"
                              ? "System Admin"
                              : announcement.source === "DEAN"
                                ? "Dean / Admin"
                                : "Professor"}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate text-lg font-extrabold text-[#102f49]">
                          {announcement.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-base leading-5 text-slate-600">
                          {announcement.message}
                        </p>
                      </article>
                    ))}
                    {!announcements.length && (
                      <div className="col-span-full rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                        No current announcements.
                      </div>
                    )}
                  </div>
                </section>
                {/* Key Metrics Grid - Standardized UA Institutional Pattern */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Students Monitored",
                      value: studentsCount,
                      suffix: "active",
                      icon: "ti-users",
                      tone: "bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#38bdf8]",
                      tab: "monitoring",
                    },
                    {
                      label: "Active Research Projects",
                      value: projects.length,
                      suffix: "cohorts",
                      icon: "ti-folders",
                      tone: "bg-[#C9A227]/15 text-[#8A6A0B] dark:text-[#C9A227]",
                      tab: "monitoring",
                    },
                    {
                      label: "Research Milestones",
                      value: milestones.length,
                      suffix: "milestones",
                      icon: "ti-flag",
                      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                      tab: "builder",
                    },
                    {
                      label: "Pending Reviews",
                      value: needsReviewCount,
                      suffix: "pending",
                      icon: "ti-inbox",
                      tone: "bg-blue-50 text-[#0B3A53] dark:bg-white/10 dark:text-white",
                      tab: "submissions",
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleTabChange(item.tab)}
                      className="group flex min-h-[96px] items-center gap-4 rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-4 sm:p-5 text-left shadow-xs transition hover:shadow-md hover:border-[#0B3A53]/40 hover:-translate-y-0.5 outline-none"
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${item.tone}`}
                      >
                        <i className={`ti ${item.icon}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-500 dark:text-slate-400">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-2xl font-black text-[#0B3A53] dark:text-white truncate">
                          {item.value}{" "}
                          <small className="text-xs font-semibold text-slate-400">
                            · {item.suffix}
                          </small>
                        </span>
                      </span>
                    </button>
                  ))}
                </section>

                {/* Progress & Attention Grid */}
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.95fr]">
                  <article className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-[#17212B] dark:text-white">
                          Research Monitoring Overview
                        </h3>
                        <p className="mt-0.5 text-base text-slate-500 dark:text-slate-400">
                          Live monitoring stream of active student research
                          groups.
                        </p>
                      </div>
                      <button
                        onClick={() => handleTabChange("tracking")}
                        className="flex items-center gap-1 text-sm font-bold text-[#0B3A53] hover:underline dark:text-[#C9A227]"
                      >
                        View all <i className="ti ti-chevron-right text-xs" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {projects.length ? (
                        projects.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleTabChange("tracking")}
                            className="block w-full rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/5"
                          >
                            <span className="flex items-center justify-between">
                              <span className="font-bold text-sm text-[#17212B] dark:text-white">
                                {p.group}
                              </span>
                              <span className="text-sm font-bold text-[#0B3A53] dark:text-[#C9A227]">
                                {p.progress}%
                              </span>
                            </span>
                            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                              <span
                                className="block h-full rounded-full bg-gradient-to-r from-[#0B3A53] to-[#C9A227]"
                                style={{ width: `${p.progress}%` }}
                              />
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="flex min-h-40 flex-col items-center justify-center text-center">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#C9A227]">
                            <i className="ti ti-users-group text-2xl" />
                          </span>
                          <p className="mt-3 font-bold text-base text-[#17212B] dark:text-white">
                            No active groups yet
                          </p>
                          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                            Research groups will appear here once registered.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-[#17212B] dark:text-white">
                          Needs your attention
                        </h3>
                        <p className="mt-0.5 text-base text-slate-500 dark:text-slate-400">
                          Recent student work waiting for instructor review.
                        </p>
                      </div>
                      <button
                        onClick={() => handleTabChange("submissions")}
                        className="flex items-center gap-1 text-sm font-bold text-[#0B3A53] hover:underline dark:text-[#C9A227]"
                      >
                        View queue <i className="ti ti-chevron-right text-xs" />
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {submissions
                        .filter((item) =>
                          ["SUBMITTED", "UNDER_REVIEW"].includes(item.status),
                        )
                        .slice(0, 3)
                        .map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              openSubmissionReview(item);
                              handleTabChange("submissions");
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-[#17212B] dark:text-white">
                                {item.task?.title}
                              </span>
                              <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
                                {item.projectTitle}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-[#C9A227]/20 px-2.5 py-1 text-xs font-bold text-[#8A6A0B] dark:text-[#C9A227]">
                              Review
                            </span>
                          </button>
                        ))}
                      {needsReviewCount === 0 && (
                        <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center dark:border-white/10 dark:bg-white/5">
                          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <i className="ti ti-circle-check text-lg" />
                          </span>
                          <p className="text-base font-bold text-[#17212B] dark:text-white">
                            You’re all caught up
                          </p>
                          <p className="text-base text-slate-400">
                            New submissions will appear here.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                </section>

                {/* Quick Actions */}
                <section className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                  <h3 className="mb-4 text-lg font-bold text-[#17212B] dark:text-white">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: "View groups",
                        icon: "ti-users",
                        tab: "monitoring",
                      },
                      {
                        label: "Review submissions",
                        icon: "ti-inbox",
                        tab: "submissions",
                      },
                      {
                        label: "Build workflow",
                        icon: "ti-adjustments",
                        tab: "builder",
                      },
                      {
                        label: "Track progress",
                        icon: "ti-chart-line",
                        tab: "tracking",
                      },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleTabChange(action.tab)}
                        className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-3 text-left transition hover:border-[#0B3A53] dark:hover:border-[#C9A227] hover:bg-white hover:shadow-xs"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3A53]/10 dark:bg-white/10 text-lg text-[#0B3A53] dark:text-[#C9A227]">
                          <i className={`ti ${action.icon}`} />
                        </span>
                        <span className="text-sm font-bold text-[#17212B] dark:text-white">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ),
            "overview-legacy": (
              <>
                {/* EXACT PROFESSOR CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-users" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">
                        Students Monitored
                      </span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">
                        {studentsCount} Active
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-folders" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">
                        Active Projects
                      </span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">
                        {projects.length} Ongoing
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-plus" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">
                        Custom Milestones
                      </span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">
                        {milestones.length} Tasks
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-lock" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block font-extrabold">
                        Locked Tasks
                      </span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">
                        {milestones.filter((m) => m.locked).length} Locked
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-lg">
                      Student Groups Progress Tracking
                    </h3>
                    <div className="flex flex-col gap-3.5">
                      {projects.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-[#1b4264]">
                              {p.group}
                            </span>
                            <span className="font-bold text-[#ffa400]">
                              {p.progress}%
                            </span>
                          </div>
                          <div className="progress-bar-track">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-lg">
                      Active Blank-Canvas Task Builder
                    </h3>
                    <form
                      onSubmit={handleCreateMilestone}
                      className="flex flex-col gap-2.5 text-[12px]"
                    >
                      <input
                        type="text"
                        value={newMilestoneTitle}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        placeholder="E.g., Ethics Certification Clear..."
                        className="bg-white border border-slate-350 rounded-lg p-2.5 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start cursor-pointer shadow-sm"
                      >
                        Deploy Task
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ),
            announcements: (
              <div className="mx-auto grid w-full max-w-[1440px] gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Announcement feed
                      </p>
                      <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                        Official updates
                      </h2>
                      <p className="mt-1 text-base text-slate-500">
                        Global announcements and notices for your college
                        department.
                      </p>
                    </div>
                    <div className="hidden flex-wrap gap-3 text-xs font-bold text-slate-500 sm:flex">
                      <span>
                        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                        Dean / Admin
                      </span>
                      <span>
                        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
                        System Admin
                      </span>
                      <span>
                        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Professor
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {announcements.map((announcement) => (
                      <article
                        key={announcement.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full ${announcement.source === "SYSTEM_ADMIN" ? "bg-violet-500" : announcement.source === "DEAN" ? "bg-blue-500" : "bg-emerald-500"}`}
                          />
                          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                            {announcement.source === "SYSTEM_ADMIN"
                              ? "System Administrator"
                              : announcement.source === "DEAN"
                                ? "Dean / College Admin"
                                : "Professor"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${announcement.severity === "CRITICAL" ? "bg-rose-100 text-rose-700" : announcement.severity === "WARNING" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"}`}
                          >
                            {announcement.severity}
                          </span>
                          {announcement.audienceCollege ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                              {announcement.audienceCollege.code}
                            </span>
                          ) : (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                              All colleges
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 text-lg font-extrabold text-[#102f49]">
                          {announcement.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-base leading-6 text-slate-600">
                          {announcement.message}
                        </p>
                        <p className="mt-3 text-base text-slate-400">
                          {announcement.creator.firstName}{" "}
                          {announcement.creator.lastName} ·{" "}
                          {new Date(announcement.publishedAt).toLocaleString()}
                        </p>
                      </article>
                    ))}
                    {!announcements.length && (
                      <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center">
                        <i className="ti ti-speakerphone text-3xl text-slate-300" />
                        <p className="mt-2 font-bold text-[#102f49]">
                          No current announcements
                        </p>
                        <p className="text-base text-slate-500">
                          New college and system notices will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <p className="text-sm font-extrabold uppercase tracking-wider text-emerald-700">
                    Your selected workflow
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold text-[#102f49]">
                    Post an announcement
                  </h2>
                  <p className="mt-1 text-base leading-5 text-slate-500">
                    This will notify active participants in the selected workflow.
                  </p>
                  <form
                    onSubmit={publishCollegeAnnouncement}
                    className="mt-5 space-y-4"
                  >
                    <label className="block text-sm font-bold text-slate-700">Workflow
                      <select required value={selectedWorkflowId} onChange={(event) => setSelectedWorkflowId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base font-normal">
                        <option value="">Choose a published workflow</option>
                        {(workflowData?.workflows || []).filter((workflow: any) => workflow.status === "PUBLISHED").map((workflow: any) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-bold text-slate-700">
                      Title
                      <input
                        required
                        minLength={3}
                        maxLength={200}
                        value={announcementTitle}
                        onChange={(event) =>
                          setAnnouncementTitle(event.target.value)
                        }
                        placeholder="e.g. Capstone consultation schedule"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base font-normal"
                      />
                    </label>
                    <label className="block text-sm font-bold text-slate-700">
                      Message
                      <textarea
                        required
                        minLength={10}
                        maxLength={5000}
                        rows={6}
                        value={announcementMessage}
                        onChange={(event) =>
                          setAnnouncementMessage(event.target.value)
                        }
                        placeholder="Write the announcement details…"
                        className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 p-3 text-base font-normal leading-6"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm font-bold text-slate-700">
                        Category
                        <select
                          value={announcementCategory}
                          onChange={(event) =>
                            setAnnouncementCategory(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base font-normal"
                        >
                          <option value="GENERAL">General</option>
                          <option value="UPDATE">Update</option>
                          <option value="DEADLINE">Deadline</option>
                        </select>
                      </label>
                      <label className="text-sm font-bold text-slate-700">
                        Priority
                        <select
                          value={announcementSeverity}
                          onChange={(event) =>
                            setAnnouncementSeverity(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base font-normal"
                        >
                          <option value="INFO">Information</option>
                          <option value="WARNING">Important</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                      </label>
                    </div>
                    <label className="block text-sm font-bold text-slate-700">
                      Expires{" "}
                      <span className="font-normal text-slate-400">
                        (optional)
                      </span>
                      <input
                        type="datetime-local"
                        value={announcementExpiresAt}
                        onChange={(event) =>
                          setAnnouncementExpiresAt(event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base font-normal"
                      />
                    </label>
                    <button
                      disabled={
                        announcementPublishing ||
                        !selectedWorkflowId ||
                        !announcementTitle.trim() ||
                        announcementMessage.trim().length < 10
                      }
                      className="w-full rounded-xl bg-[#173f63] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                    >
                      <i className="ti ti-send mr-2" />
                      {announcementPublishing
                        ? "Publishing…"
                        : "Publish to workflow"}
                    </button>
                  </form>
                </aside>
              </div>
            ),
            defense: (
              <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Defense coordination
                      </p>
                      <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                        Defense Management
                      </h2>
                      <p className="mt-1 text-base text-slate-500">
                        Build multi-group defense events, confirm the panel, and
                        control the live queue.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeanRequestForm(true)}
                        disabled={!signatureGroups.length}
                        className="rounded-xl border border-[#173f63] bg-white px-5 py-3 text-sm font-extrabold text-[#173f63] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <i className="ti ti-mail-forward mr-2" />
                        Request Dean signature
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetDefenseForm();
                          setShowDefenseForm(true);
                        }}
                        disabled={!eligibleDefenseGroups.length}
                        className="rounded-xl bg-[#f6a800] px-5 py-3 text-sm font-extrabold text-[#102f49] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <i className="ti ti-calendar-plus mr-2" />
                        Create defense event
                      </button>
                    </div>
                  </div>
                  {!eligibleDefenseGroups.length && (
                    <p className="mt-4 rounded-xl bg-blue-50 p-3 text-base text-blue-800">
                      <i className="ti ti-info-circle mr-1" />A group becomes
                      schedulable after its Defense Eligibility milestone is
                      approved and the Dean letter for that cycle is signed.
                    </p>
                  )}
                </section>
                <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <h3 className="text-lg font-extrabold">
                    Defense eligibility approvals
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Approve each group's next eligibility milestone. A passed
                    defense consumes that milestone's approval.
                  </p>
                  {!eligibilityGroups.length && (
                    <p className="mt-3 text-sm">
                      Add a Defense Eligibility milestone in Workflow → Academic
                      event → Advanced settings.
                    </p>
                  )}
                  <div className="mt-4 space-y-3">
                    {eligibilityGroups.map((group: any) => (
                      <div
                        key={group.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
                      >
                        <div>
                          <strong>{group.groupName || group.title}</strong>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {group.milestone.name} ·{" "}
                            {group.approved
                              ? "Approved for one defense cycle"
                              : group.canApprove
                                ? "Ready for coordinator approval"
                                : "Complete prerequisites and approve required submissions first"}
                          </p>
                        </div>
                        {!group.approved && (
                          <button
                            type="button"
                            disabled={!group.canApprove || defenseActionPending}
                            onClick={() => approveDefenseGate(group)}
                            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                          >
                            Approve eligibility
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
                <DefenseBadgeIssuance
                  sessions={defenseSessions}
                  canIssue={Boolean(
                    user?.roles.includes("RESEARCH_COORDINATOR"),
                  )}
                  onIssued={() =>
                    Promise.all([
                      refetchDefenseManagement(),
                      refetchDefenseEvents(),
                    ])
                  }
                />
                {liveDefense && (
                  <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
                    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                      <div>
                        <p className="text-sm font-extrabold uppercase tracking-wider text-emerald-700">
                          <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                          Live defense control
                        </p>
                        <h2 className="mt-2 text-xl font-extrabold text-[#102f49]">
                          {liveDefense.research.title}
                        </h2>
                        <p className="mt-1 text-base text-slate-600">
                          {
                            (liveDefense.packet?.evaluationMode === "PDF"
                              ? liveDefense.pdfEvaluations || []
                              : liveDefense.evaluations
                            ).filter((item: any) => item.status === "LOCKED")
                              .length
                          }{" "}
                          of{" "}
                          {
                            liveDefense.invitations.filter(
                              (item: any) =>
                                item.status === "ACCEPTED" &&
                                ["PANELIST", "PANEL_CHAIR"].includes(item.role),
                            ).length
                          }{" "}
                          panelists submitted their final evaluation.
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600">
                          Official decision
                          <select
                            value={officialDecision}
                            onChange={(event) =>
                              setOfficialDecision(event.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3"
                          >
                            <option value="APPROVED">Approved</option>
                            <option value="APPROVED_WITH_MINOR_REVISIONS">
                              Approved with minor revisions
                            </option>
                            <option value="MAJOR_REVISIONS_REQUIRED">
                              Major revisions required
                            </option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </label>
                        {(officialDecision ===
                          "APPROVED_WITH_MINOR_REVISIONS" ||
                          officialDecision === "MAJOR_REVISIONS_REQUIRED") && (
                          <label className="mt-2 block text-sm font-bold text-slate-600">
                            Required manuscript revisions
                            <textarea
                              value={revisionInstructions}
                              onChange={(event) =>
                                setRevisionInstructions(event.target.value)
                              }
                              placeholder="Record the panel's required post-defense revisions."
                              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"
                            />
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={releaseDefenseResult}
                          disabled={
                            defenseActionPending ||
                            ((officialDecision ===
                              "APPROVED_WITH_MINOR_REVISIONS" ||
                              officialDecision ===
                                "MAJOR_REVISIONS_REQUIRED") &&
                              revisionInstructions.trim().length < 10)
                          }
                          className="mt-2 w-full rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                        >
                          Release official result
                        </button>
                      </div>
                    </div>
                  </section>
                )}
                {defenseLoadError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    <p className="font-extrabold">
                      <i className="ti ti-alert-circle mr-1.5" />
                      Defense status could not be loaded
                    </p>
                    <p className="mt-1 text-base">
                      {(defenseLoadError as Error).message ||
                        "Refresh the page or check the API connection."}
                    </p>
                  </div>
                )}
                <section className="grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      label: "Awaiting replies",
                      value: defenseSessions.filter(
                        (item) => item.status === "PENDING_ACKNOWLEDGEMENT",
                      ).length,
                      icon: "ti-clock",
                      tone: "bg-blue-50 text-blue-700",
                    },
                    {
                      label: "Needs action",
                      value: defenseSessions.filter(
                        (item) => item.status === "NEEDS_RESCHEDULING",
                      ).length,
                      icon: "ti-calendar-exclamation",
                      tone: "bg-rose-50 text-rose-700",
                    },
                    {
                      label: "Confirmed",
                      value: defenseSessions.filter(
                        (item) => item.status === "SCHEDULED",
                      ).length,
                      icon: "ti-calendar-check",
                      tone: "bg-emerald-50 text-emerald-700",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <span
                        className={`grid h-12 w-12 place-items-center rounded-xl ${item.tone}`}
                      >
                        <i className={`ti ${item.icon} text-2xl`} />
                      </span>
                      <div>
                        <p className="text-base text-slate-500">{item.label}</p>
                        <p className="mt-0.5 text-xl font-extrabold text-[#102f49]">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </section>
                {defenseEvents.map((defenseEvent: any) => (
                  <section
                    key={defenseEvent.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6"
                  >
                    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-extrabold text-[#102f49]">
                            {defenseEvent.code}
                          </h3>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700">
                            {defenseEvent.defenseType.replace(/_/g, " ")}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-700">
                            {defenseEvent.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-base text-slate-600">
                          <i className="ti ti-calendar-event mr-1.5" />
                          {new Date(
                            defenseEvent.scheduledStart,
                          ).toLocaleString()}{" "}
                          –{" "}
                          {new Date(
                            defenseEvent.scheduledEnd,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {defenseEvent.venue ? ` · ${defenseEvent.venue}` : ""}
                        </p>
                      </div>
                      <div className="text-sm text-slate-500">
                        {defenseEvent.sessions.length} research{" "}
                        {defenseEvent.sessions.length === 1
                          ? "group"
                          : "groups"}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {defenseEvent.sessions.map((session: any) => {
                        const accepted = (session.invitations || []).filter(
                          (item: any) => item.status === "ACCEPTED",
                        ).length;
                        const required = (session.invitations || []).filter(
                          (item: any) => item.status !== "REMOVED",
                        ).length;
                        return (
                          <div
                            key={session.id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173f63] text-sm font-extrabold text-white">
                                {session.queuePosition}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-extrabold text-[#102f49]">
                                  {session.research.title}
                                </p>
                                <p className="mt-0.5 text-base text-slate-500">
                                  {new Date(
                                    session.scheduledStart,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  · {accepted}/{required} confirmed ·{" "}
                                  {session.queueStatus.replace(/_/g, " ")}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setStatusSession({
                                    session,
                                    event: defenseEvent,
                                  })
                                }
                                className="rounded-lg border border-[#173f63] bg-white px-3 py-2 text-sm font-extrabold text-[#173f63]"
                              >
                                <i className="ti ti-users-group mr-1.5" />
                                View status
                              </button>
                              {![
                                "LIVE",
                                "DELIBERATION",
                                "COMPLETED",
                                "CANCELLED",
                              ].includes(session.status) && (
                                <button
                                  type="button"
                                  disabled={defenseActionPending}
                                  onClick={() => deleteDefenseSession(session)}
                                  className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-bold text-rose-600 disabled:opacity-40"
                                >
                                  Delete session
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPacketSession(session)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-extrabold text-[#173f63]"
                              >
                                Review packet
                              </button>
                              {session.status === "SCHEDULED" &&
                                !["IN_PROGRESS", "COMPLETED"].includes(
                                  session.queueStatus,
                                ) && (
                                  <button
                                    type="button"
                                    disabled={defenseActionPending}
                                    onClick={() =>
                                      updateDefenseQueue(
                                        defenseEvent.id,
                                        session.id,
                                        "PREPARE",
                                      )
                                    }
                                    className="rounded-lg border border-[#f6a800] bg-amber-50 px-3 py-2 text-sm font-extrabold text-[#7a5200] disabled:opacity-50"
                                  >
                                    Prepare next
                                  </button>
                                )}
                              {session.status === "SCHEDULED" && (
                                <button
                                  type="button"
                                  disabled={defenseActionPending}
                                  onClick={() =>
                                    updateDefenseQueue(
                                      defenseEvent.id,
                                      session.id,
                                      "CALL",
                                    )
                                  }
                                  className="rounded-lg bg-[#173f63] px-3 py-2 text-sm font-extrabold text-white disabled:opacity-50"
                                >
                                  Call group
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
                <section className="space-y-4">
                  {legacyDefenseSessions.map((session) => {
                    const activeInvitations = (
                      session.invitations || []
                    ).filter((item: any) => item.status !== "REMOVED");
                    const accepted = activeInvitations.filter(
                      (item: any) => item.status === "ACCEPTED",
                    ).length;
                    return (
                      <article
                        key={session.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-extrabold text-[#102f49]">
                                {session.research?.title}
                              </h3>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${session.status === "SCHEDULED" ? "bg-emerald-100 text-emerald-800" : session.status === "NEEDS_RESCHEDULING" ? "bg-rose-100 text-rose-800" : session.status === "LIVE" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}
                              >
                                {session.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="mt-2 text-base text-slate-600">
                              <i className="ti ti-calendar mr-1.5" />
                              {session.scheduledStart
                                ? new Date(
                                    session.scheduledStart,
                                  ).toLocaleString()
                                : "Schedule pending"}
                              {session.venue
                                ? ` · ${session.venue}`
                                : session.meetingUrl
                                  ? " · Online"
                                  : ""}
                            </p>
                            <p className="mt-1 text-base text-slate-500">
                              {accepted} of {activeInvitations.length} invited
                              participants accepted
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setStatusSession({ session })}
                              className="rounded-xl border border-[#173f63] bg-white px-4 py-2 text-sm font-extrabold text-[#173f63]"
                            >
                              <i className="ti ti-users-group mr-1.5" />
                              View status
                            </button>
                            {![
                              "LIVE",
                              "DELIBERATION",
                              "COMPLETED",
                              "CANCELLED",
                            ].includes(session.status) && (
                              <button
                                type="button"
                                disabled={defenseActionPending}
                                onClick={() => deleteDefenseSession(session)}
                                className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-bold text-rose-600 disabled:opacity-40"
                              >
                                Delete session
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPacketSession(session)}
                              className="rounded-xl border border-[#f6a800] bg-amber-50 px-4 py-2 text-sm font-extrabold text-[#7a5200]"
                            >
                              <i className="ti ti-files mr-1.5" />
                              Review packet
                            </button>
                            {[
                              "PENDING_ACKNOWLEDGEMENT",
                              "NEEDS_RESCHEDULING",
                            ].includes(session.status) && (
                              <button
                                type="button"
                                onClick={() => openRescheduleDefense(session)}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-[#173f63]"
                              >
                                <i className="ti ti-calendar-time mr-1.5" />
                                Reschedule
                              </button>
                            )}
                            {session.status === "SCHEDULED" && (
                              <button
                                type="button"
                                onClick={() => startDefense(session.id)}
                                disabled={defenseActionPending}
                                className="rounded-xl bg-[#173f63] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
                              >
                                <i className="ti ti-player-play mr-1.5" />
                                Start live defense
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {activeInvitations.map((invitation: any) => (
                            <div
                              key={invitation.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-base font-bold text-[#102f49]">
                                    {invitation.invitee.firstName}{" "}
                                    {invitation.invitee.lastName}
                                  </p>
                                  <p className="text-base text-slate-500">
                                    {invitation.role.replace(/_/g, " ")}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-extrabold ${invitation.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800" : invitation.status === "DECLINED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}
                                >
                                  {invitation.status.replace(/_/g, " ")}
                                </span>
                              </div>
                              {invitation.status === "DECLINED" && (
                                <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                                  <p>
                                    <strong>Reason:</strong>{" "}
                                    {invitation.responseNote}
                                  </p>
                                  {Array.isArray(
                                    invitation.suggestedAvailability,
                                  ) &&
                                    invitation.suggestedAvailability.length >
                                      0 && (
                                      <p className="mt-1">
                                        <strong>Suggested:</strong>{" "}
                                        {invitation.suggestedAvailability
                                          .map((value: string) =>
                                            new Date(value).toLocaleString(),
                                          )
                                          .join("; ")}
                                      </p>
                                    )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplacementInvitation(invitation);
                                      setReplacementUserId("");
                                    }}
                                    className="mt-2 rounded-lg bg-white px-2.5 py-1.5 font-extrabold text-rose-700 shadow-sm"
                                  >
                                    Replace participant
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                  {!defenseLoadError &&
                    !defenseEvents.length &&
                    !legacyDefenseSessions.length && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-[#173f63]">
                          <i className="ti ti-presentation text-2xl" />
                        </span>
                        <h3 className="mt-3 font-extrabold text-[#102f49]">
                          No defense requests yet
                        </h3>
                        <p className="mt-1 text-base text-slate-500">
                          Eligible groups can be scheduled once all workflow
                          requirements are complete.
                        </p>
                      </div>
                    )}
                </section>
                {showDefenseForm && (
                  <div
                    className="fixed inset-0 z-50 flex bg-slate-950/45"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="defense-form-title"
                  >
                    <button
                      type="button"
                      aria-label="Close defense form"
                      onClick={resetDefenseForm}
                      className="flex-1 cursor-default"
                    />
                    <aside className="ml-auto flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
                      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                        <div>
                          <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                            {reschedulingSession
                              ? "Updated invitation"
                              : "New defense event"}
                          </p>
                          <h2
                            id="defense-form-title"
                            className="mt-1 text-xl font-extrabold text-[#102f49]"
                          >
                            {reschedulingSession
                              ? "Reschedule defense"
                              : "Create defense event"}
                          </h2>
                          <p className="mt-1 text-base text-slate-500">
                            {reschedulingSession
                              ? "Changing the schedule asks every participant to confirm again."
                              : "Choose one or more ready groups. Their time slots are divided evenly across the event."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={resetDefenseForm}
                          className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-[#173f63]"
                        >
                          <i className="ti ti-x text-xl" />
                        </button>
                      </div>
                      <form
                        onSubmit={saveDefenseRequest}
                        className="flex flex-1 flex-col overflow-hidden"
                      >
                        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                          {!reschedulingSession && (
                            <fieldset>
                              <legend className="text-sm font-bold text-slate-700">
                                Defense-ready research groups
                              </legend>
                              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                                {eligibleDefenseGroups.map((project) => (
                                  <label
                                    key={project.id}
                                    className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={defenseProjectIds.includes(
                                        project.id,
                                      )}
                                      onChange={(event) =>
                                        setDefenseProjectIds((current) =>
                                          event.target.checked
                                            ? [...current, project.id]
                                            : current.filter(
                                                (id) => id !== project.id,
                                              ),
                                        )
                                      }
                                      className="mt-0.5 h-4 w-4 accent-[#f6a800]"
                                    />
                                    <span>
                                      <span className="block text-sm font-bold text-[#102f49]">
                                        {project.title}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {project.program?.code || "Program"} ·{" "}
                                        {project.members?.length || 0} members
                                        {project.eligibility?.milestoneName &&
                                          ` · ${project.eligibility.milestoneName}`}
                                      </span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                              <p className="mt-1.5 text-base text-slate-500">
                                {defenseProjectIds.length} selected
                              </p>
                            </fieldset>
                          )}
                          {!reschedulingSession && (
                            <label className="block text-sm font-bold text-slate-700">
                              Defense type
                              <select
                                value={defenseType}
                                onChange={(event) =>
                                  setDefenseType(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base"
                              >
                                <option value="TITLE_DEFENSE">
                                  Title defense
                                </option>
                                <option value="PROPOSAL_DEFENSE">
                                  Proposal defense
                                </option>
                                <option value="PRE_ORAL_DEFENSE">
                                  Pre-oral defense
                                </option>
                                <option value="FINAL_ORAL_DEFENSE">
                                  Final oral defense
                                </option>
                              </select>
                            </label>
                          )}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <label className="text-sm font-bold text-slate-700">
                              Event date
                              <input
                                required
                                type="date"
                                value={defenseDate}
                                onChange={(event) =>
                                  setDefenseDate(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base"
                              />
                            </label>
                            <label className="text-sm font-bold text-slate-700">
                              Event starts
                              <input
                                required
                                type="time"
                                value={defenseStartTime}
                                onChange={(event) =>
                                  setDefenseStartTime(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base"
                              />
                            </label>
                            <label className="text-sm font-bold text-slate-700">
                              Event ends
                              <input
                                required
                                type="time"
                                value={defenseEndTime}
                                onChange={(event) =>
                                  setDefenseEndTime(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-bold text-slate-700">
                            Venue
                            <input
                              value={defenseVenue}
                              onChange={(event) =>
                                setDefenseVenue(event.target.value)
                              }
                              placeholder="e.g. Research Room 204"
                              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base"
                            />
                          </label>
                          <label className="block text-sm font-bold text-slate-700">
                            Meeting link{" "}
                            <span className="font-normal text-slate-400">
                              (optional)
                            </span>
                            <input
                              type="url"
                              value={defenseMeetingUrl}
                              onChange={(event) =>
                                setDefenseMeetingUrl(event.target.value)
                              }
                              placeholder="https://meet.google.com/..."
                              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base"
                            />
                          </label>
                          {!reschedulingSession && (
                            <section className="space-y-4 border-t border-slate-200 pt-5">
                              <div>
                                <h3 className="font-extrabold text-[#102f49]">
                                  Defense panel
                                </h3>
                                <p className="text-base text-slate-500">
                                  Every required participant must accept before
                                  confirmation.
                                </p>
                              </div>
                              <label className="block text-sm font-bold text-slate-700">
                                Panel chair
                                <select
                                  required
                                  value={defenseChairId}
                                  onChange={(event) =>
                                    setDefenseChairId(event.target.value)
                                  }
                                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base"
                                >
                                  <option value="">Select chair</option>
                                  {defenseCandidates.map((person) => (
                                    <option key={person.id} value={person.id}>
                                      {person.firstName} {person.lastName}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <fieldset>
                                <legend className="text-sm font-bold text-slate-700">
                                  Panelists
                                </legend>
                                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                                  {defenseCandidates.map((person) => (
                                    <label
                                      key={person.id}
                                      className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={defensePanelistIds.includes(
                                          person.id,
                                        )}
                                        onChange={(event) =>
                                          setDefensePanelistIds((current) =>
                                            event.target.checked
                                              ? [...current, person.id]
                                              : current.filter(
                                                  (id) => id !== person.id,
                                                ),
                                          )
                                        }
                                        className="h-4 w-4 accent-[#f6a800]"
                                      />
                                      <span>
                                        <span className="block text-sm font-bold text-[#102f49]">
                                          {person.firstName} {person.lastName}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {person.roles.join(", ")}
                                        </span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </fieldset>
                            </section>
                          )}
                          <label className="block text-sm font-bold text-slate-700">
                            Notes{" "}
                            <span className="font-normal text-slate-400">
                              (optional)
                            </span>
                            <textarea
                              value={defenseNotes}
                              onChange={(event) =>
                                setDefenseNotes(event.target.value)
                              }
                              rows={4}
                              placeholder="Preparation instructions for the group and panel…"
                              className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-base"
                            />
                          </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                          <button
                            type="button"
                            onClick={resetDefenseForm}
                            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={
                              defenseActionPending ||
                              !defenseDate ||
                              !defenseStartTime ||
                              !defenseEndTime ||
                              (!reschedulingSession &&
                                (!defenseProjectIds.length ||
                                  !defenseChairId ||
                                  !defensePanelistIds.length))
                            }
                            className="rounded-xl bg-[#f6a800] px-5 py-2.5 text-sm font-extrabold text-[#102f49] disabled:opacity-50"
                          >
                            {defenseActionPending
                              ? "Sending…"
                              : reschedulingSession
                                ? "Send updated schedule"
                                : "Create event & invite"}
                          </button>
                        </div>
                      </form>
                    </aside>
                  </div>
                )}
                {replacementInvitation && (
                  <div
                    className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="replace-panelist-title"
                  >
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                      <p className="text-sm font-extrabold uppercase tracking-wider text-rose-600">
                        Unavailable participant
                      </p>
                      <h2
                        id="replace-panelist-title"
                        className="mt-1 text-xl font-extrabold text-[#102f49]"
                      >
                        Replace {replacementInvitation.invitee.firstName}{" "}
                        {replacementInvitation.invitee.lastName}
                      </h2>
                      <p className="mt-1 text-base text-slate-500">
                        The schedule stays unchanged, so participants who
                        already accepted will not need to reconfirm.
                      </p>
                      <label className="mt-5 block text-sm font-bold text-slate-700">
                        Replacement
                        <select
                          value={replacementUserId}
                          onChange={(event) =>
                            setReplacementUserId(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base"
                        >
                          <option value="">Select participant</option>
                          {defenseCandidates
                            .filter(
                              (person) =>
                                person.id !== replacementInvitation.inviteeId,
                            )
                            .map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.firstName} {person.lastName} ·{" "}
                                {person.roles.join(", ")}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="mt-5 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplacementInvitation(null);
                            setReplacementUserId("");
                          }}
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={replaceDefenseParticipant}
                          disabled={!replacementUserId || defenseActionPending}
                          className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                        >
                          Send replacement invitation
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ),
            submissions: selectedSubmission ? (
              <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubmission(null);
                    setReviewFeedback("");
                  }}
                  className="flex w-fit items-center gap-2 text-sm font-bold text-[#173f63]"
                >
                  <i className="ti ti-arrow-left" />
                  Back to submissions
                </button>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                          {selectedSubmission.projectTitle}
                        </p>
                        <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                          {selectedSubmission.task?.title}
                        </h2>
                        <p className="mt-1 text-base text-slate-500">
                          Submitted by{" "}
                          {selectedSubmission.submittedByUser?.firstName}{" "}
                          {selectedSubmission.submittedByUser?.lastName} ·{" "}
                          {new Date(
                            selectedSubmission.submittedAt,
                          ).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${selectedSubmission.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : selectedSubmission.status === "REVISION_REQUIRED" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}
                      >
                        {selectedSubmission.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="p-6">
                      <SubmissionDocumentPreview
                        versions={selectedSubmission.document?.versions || []}
                        title={
                          selectedSubmission.document?.title ||
                          selectedSubmission.task?.title ||
                          "Submitted document"
                        }
                      />
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
                            Student note
                          </p>
                          <p className="mt-2 text-base leading-6 text-slate-700">
                            {selectedSubmission.note ||
                              "No note was included with this submission."}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
                            Requirement
                          </p>
                          <p className="mt-2 text-base leading-6 text-slate-700">
                            {selectedSubmission.task?.instructions ||
                              "No additional instructions were provided."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                  <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                      Your decision
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold text-[#102f49]">
                      Review submission
                    </h3>
                    <p className="mt-1 text-base leading-5 text-slate-500">
                      Approve work that meets the requirement, or explain
                      exactly what the group should revise.
                    </p>
                    <label className="mt-5 block text-sm font-bold text-slate-700">
                      Feedback
                      <textarea
                        value={reviewFeedback}
                        onChange={(event) =>
                          setReviewFeedback(event.target.value)
                        }
                        rows={7}
                        placeholder="Add helpful, specific feedback for the group…"
                        className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 text-base font-normal leading-6 outline-none focus:border-[#173f63]"
                      />
                    </label>
                    {selectedSubmission.reviewNote && (
                      <p className="mt-2 text-base text-slate-500">
                        Last saved feedback: {selectedSubmission.reviewNote}
                      </p>
                    )}
                    <div className="mt-5 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleReviewTaskSubmission(
                            selectedSubmission.id,
                            "APPROVED",
                          )
                        }
                        disabled={reviewSaving}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                      >
                        <i className="ti ti-check mr-2" />
                        Approve submission
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleReviewTaskSubmission(
                            selectedSubmission.id,
                            "REVISION_REQUIRED",
                          )
                        }
                        disabled={reviewSaving || !reviewFeedback.trim()}
                        className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-extrabold text-amber-800 disabled:opacity-50"
                      >
                        <i className="ti ti-message-exclamation mr-2" />
                        Request revision
                      </button>
                    </div>
                    <p className="mt-4 rounded-xl bg-blue-50 p-3 text-base leading-5 text-blue-800">
                      <i className="ti ti-info-circle mr-1" />
                      Approving every required submission in the group’s current
                      milestone automatically advances its workflow.
                    </p>
                  </aside>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Professor workspace
                      </p>
                      <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                        Student submissions
                      </h2>
                      <p className="mt-1 text-base text-slate-500">
                        Review submitted work and monitor requirement deadlines
                        from one place.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:w-[620px]">
                      <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        Workflow
                        <select
                          value={submissionWorkflowId}
                          onChange={(event) =>
                            updateSubmissionQuery({
                              workflowId: event.target.value,
                            })
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold normal-case tracking-normal text-[#102f49]"
                        >
                          <option value="ALL">All workflows</option>
                          {workflows.map((workflow) => (
                            <option key={workflow.id} value={workflow.id}>
                              {workflow.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        Search
                        <span className="relative mt-1.5 block">
                          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={submissionSearch}
                            onChange={(event) =>
                              setSubmissionSearch(event.target.value)
                            }
                            placeholder="Requirement or research group"
                            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#173f63]"
                          />
                        </span>
                      </label>
                    </div>
                  </div>
                  <div
                    className="mt-5 flex w-fit rounded-xl bg-slate-100 p-1"
                    role="tablist"
                    aria-label="Submission workspace views"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={submissionView === "review"}
                      onClick={() =>
                        updateSubmissionQuery({ submissionView: null })
                      }
                      className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${submissionView === "review" ? "bg-white text-[#173f63] shadow-sm" : "text-slate-500"}`}
                    >
                      Review Queue
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={submissionView === "deadlines"}
                      onClick={() =>
                        updateSubmissionQuery({ submissionView: "deadlines" })
                      }
                      className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${submissionView === "deadlines" ? "bg-white text-[#173f63] shadow-sm" : "text-slate-500"}`}
                    >
                      Deadline Tracker
                    </button>
                  </div>
                </section>
                {submissionView === "deadlines" ? (
                  <WorkflowDeadlineTracker
                    rows={deadlineRows}
                    filter={deadlineFilter}
                    sort={deadlineSort}
                    selectedKeys={selectedDeadlineKeys}
                    reminderSaving={deadlineReminderSaving}
                    onFilterChange={(value) => {
                      setDeadlineFilter(value);
                      setSelectedDeadlineKeys([]);
                    }}
                    onSortChange={setDeadlineSort}
                    onSelectionChange={setSelectedDeadlineKeys}
                    onSendReminders={() => void handleSendDeadlineReminders()}
                  />
                ) : (
                  <>
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-sm font-extrabold uppercase tracking-wider text-[#d98d00]">
                            Review queue
                          </p>
                          <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                            Student submissions
                          </h2>
                          <p className="mt-1 text-base text-slate-500">
                            Review deliverables, give feedback, and keep groups
                            moving.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            {
                              id: "NEEDS_REVIEW",
                              label: `Needs review (${needsReviewCount})`,
                            },
                            {
                              id: "REVISION_REQUIRED",
                              label: "Revision requested",
                            },
                            { id: "APPROVED", label: "Approved" },
                            { id: "ALL", label: "All" },
                          ].map((filter) => (
                            <button
                              key={filter.id}
                              type="button"
                              onClick={() => setSubmissionFilter(filter.id)}
                              className={`rounded-xl px-3.5 py-2 text-sm font-extrabold transition ${submissionFilter === filter.id ? "bg-[#173f63] text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-[#f6a800]"}`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                        <label className="text-sm font-bold text-slate-500">
                          Sort by
                          <select
                            value={submissionSort}
                            onChange={(event) =>
                              setSubmissionSort(event.target.value)
                            }
                            className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-bold text-slate-700"
                          >
                            <option value="OLDEST_REVIEW">
                              Oldest awaiting review
                            </option>
                            <option value="NEWEST">Newest submitted</option>
                            <option value="GROUP">Research group A–Z</option>
                            <option value="MILESTONE">Milestone order</option>
                          </select>
                        </label>
                      </div>
                    </section>
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-500 md:grid">
                        <span>Submission</span>
                        <span>Research group</span>
                        <span>Submitted</span>
                        <span>Status</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {filteredSubmissions.map((submission) => (
                          <button
                            key={submission.id}
                            type="button"
                            onClick={() => openSubmissionReview(submission)}
                            className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-amber-50/40 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_130px] md:items-center md:gap-4"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-extrabold text-[#102f49]">
                                {submission.task?.title}
                              </span>
                              <span className="mt-1 block truncate text-sm text-slate-500">
                                {submission.document?.title} ·{" "}
                                {submission.submittedByUser?.firstName}{" "}
                                {submission.submittedByUser?.lastName}
                              </span>
                            </span>
                            <span className="truncate text-sm font-semibold text-slate-700">
                              {submission.projectTitle}
                            </span>
                            <span className="text-sm text-slate-500">
                              {new Date(
                                submission.submittedAt,
                              ).toLocaleDateString()}
                            </span>
                            <span
                              className={`w-fit rounded-full px-2.5 py-1 text-xs font-extrabold ${submission.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : submission.status === "REVISION_REQUIRED" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}
                            >
                              {submission.status.replace(/_/g, " ")}
                            </span>
                          </button>
                        ))}
                        {!filteredSubmissions.length && (
                          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                            <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
                              <i className="ti ti-inbox text-2xl" />
                            </span>
                            <h3 className="mt-3 font-extrabold text-[#102f49]">
                              No submissions in this view
                            </h3>
                            <p className="mt-1 text-base text-slate-500">
                              Try another filter or check back after students
                              submit work.
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>
            ),
            monitoring: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div>
                  <h3 className="font-extrabold text-[#1b4264] text-lg">
                    Research Projects
                  </h3>
                  <p className="mt-1 text-base text-slate-500">
                    View and manage the registered research projects across your
                    workflows.
                  </p>
                </div>
                {projects.length > 0 && (
                  <div className="relative max-w-xl">
                    <i className="ti ti-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={monitoringSearch}
                      onChange={(event) =>
                        setMonitoringSearch(event.target.value)
                      }
                      placeholder="Search project, adviser, research type, or program…"
                      aria-label="Search research projects"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#173f63] focus:ring-2 focus:ring-[#173f63]/10"
                    />
                    {monitoringSearch && (
                      <button
                        type="button"
                        onClick={() => setMonitoringSearch("")}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <i className="ti ti-x" />
                      </button>
                    )}
                  </div>
                )}
                {(projectsError || workflowsError || enrollmentsError) && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    Dashboard data could not be loaded. Check the API connection
                    and try again.
                  </div>
                )}
                {legacyWorkflowUiEnabled ? (
                  enrollmentsLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <ListRowsSkeleton rows={5} />
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      {acceptedResearchers
                        .filter((enrollment: any) => {
                          const query = monitoringSearch.trim().toLowerCase();
                          if (!query) return true;
                          return [
                            enrollment.user.firstName,
                            enrollment.user.lastName,
                            enrollment.user.universityId,
                            enrollment.user.email,
                            enrollment.workflow.name,
                          ]
                            .filter(Boolean)
                            .some((value) =>
                              String(value).toLowerCase().includes(query),
                            );
                        })
                        .map((enrollment: any) => {
                          const linkedProject = projects.find((project: any) =>
                            project.researchers.some(
                              (member: any) =>
                                member.user?.id === enrollment.user.id,
                            ),
                          );
                          return (
                            <div
                              key={enrollment.id}
                              className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center"
                            >
                              <div>
                                <p className="font-bold text-[#173f63]">
                                  {enrollment.user.firstName}{" "}
                                  {enrollment.user.lastName}
                                </p>
                                <p className="text-base text-slate-500">
                                  {enrollment.user.universityId ||
                                    enrollment.user.email}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
                                  Workflow
                                </p>
                                <p className="mt-1 text-base font-semibold text-slate-700">
                                  {enrollment.workflow.name}
                                </p>
                              </div>
                              <Tag variant={linkedProject ? "success" : "info"}>
                                {linkedProject
                                  ? "Project created"
                                  : "No project yet"}
                              </Tag>
                              <button
                                type="button"
                                onClick={() =>
                                  setMonitoringPendingRemoval({
                                    kind: "researcher",
                                    id: enrollment.id,
                                    name:
                                      `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim() ||
                                      enrollment.user.email,
                                    workflowName: enrollment.workflow.name,
                                  })
                                }
                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                              >
                                <i className="ti ti-trash mr-1.5" />
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      {!acceptedResearchers.length && !enrollmentsError && (
                        <div className="p-8 text-center">
                          <p className="font-bold text-[#173f63]">
                            No accepted researchers yet
                          </p>
                          <p className="mt-1 text-base text-slate-500">
                            Researchers appear here after they accept a workflow
                            invitation.
                          </p>
                        </div>
                      )}
                      {acceptedResearchers.length > 0 &&
                        !acceptedResearchers.some((enrollment: any) => {
                          const query = monitoringSearch.trim().toLowerCase();
                          if (!query) return true;
                          return [
                            enrollment.user.firstName,
                            enrollment.user.lastName,
                            enrollment.user.universityId,
                            enrollment.user.email,
                            enrollment.workflow.name,
                          ]
                            .filter(Boolean)
                            .some((value) =>
                              String(value).toLowerCase().includes(query),
                            );
                        }) && (
                          <div className="p-8 text-center text-sm text-slate-500">
                            No researchers match “{monitoringSearch}”.
                          </div>
                        )}
                    </div>
                  )
                ) : projectsLoading ||
                  workflowsLoading ||
                  enrollmentsLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <ListRowsSkeleton rows={5} avatars={false} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5 mt-2">
                    {registeredProjects
                      .filter((project: any) => {
                        const query = monitoringSearch.trim().toLowerCase();
                        if (!query) return true;
                        return [
                          project.title,
                          project.adviser?.firstName,
                          project.adviser?.lastName,
                          project.adviser?.email,
                          project.researchType?.name,
                          project.program?.code,
                          project.program?.name,
                        ]
                          .filter(Boolean)
                          .some((value) =>
                            String(value).toLowerCase().includes(query),
                          );
                      })
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-left text-[12.5px] shadow-sm transition hover:border-[#f6a800]"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedProject(p)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="font-bold text-[#1b4264] block">
                              {p.group}
                            </span>
                            <span className="text-sm text-slate-500">
                              {p.researchers.length === 1
                                ? "Individual"
                                : `${p.researchers.length} researchers`}{" "}
                              · {p.currentStage?.name || "Not started"} ·{" "}
                              {p.progress}% complete
                            </span>
                          </button>
                          <div className="ml-4 flex shrink-0 items-center gap-2">
                            <Tag variant="success">{p.status}</Tag>
                            <button
                              type="button"
                              onClick={() =>
                                setMonitoringPendingRemoval({
                                  kind: "project",
                                  id: p.id,
                                  name: p.title,
                                })
                              }
                              className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                            >
                              <i className="ti ti-trash mr-1.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    {!registeredProjects.length && projects.length > 0 && <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="font-bold">Research titles not registered yet</h3><p className="mt-2 text-sm">Researchers can begin milestones before registering a title. If the workflow uses Title Proposal, accept a submitted title to register their project.</p><button type="button" onClick={() => router.push("/professor/dashboard?tab=builder")} className="mt-3 text-sm font-bold text-[var(--color-primary)]">View workflow</button></div>}
                    {!projects.length &&
                      !projectsError &&
                      !workflowsError &&
                      !enrollmentsError && (
                        <ResearchProjectsOnboarding
                          workflows={workflows.map((workflow) => ({
                            id: workflow.id,
                            name: workflow.name,
                          }))}
                          selectedWorkflowId={selectedWorkflowId}
                          participantCount={selectedWorkflowParticipants.length}
                          onSelectWorkflow={selectMonitoringWorkflow}
                          onCreateWorkflow={() => {
                            setCreatingWorkflow(true);
                            router.push("/professor/dashboard?tab=builder");
                          }}
                          onOpenParticipants={() =>
                            openWorkflowParticipants(selectedWorkflowId)
                          }
                        />
                      )}
                    {registeredProjects.length > 0 &&
                      !registeredProjects.some((project: any) => {
                        const query = monitoringSearch.trim().toLowerCase();
                        if (!query) return true;
                        return [
                          project.title,
                          project.adviser?.firstName,
                          project.adviser?.lastName,
                          project.adviser?.email,
                          project.researchType?.name,
                          project.program?.code,
                          project.program?.name,
                        ]
                          .filter(Boolean)
                          .some((value) =>
                            String(value).toLowerCase().includes(query),
                          );
                      }) && (
                        <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                          No projects match “{monitoringSearch}”.
                        </div>
                      )}
                  </div>
                )}
              </div>
            ),
            builder: (
              <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 text-[var(--color-text-primary)]">
                <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] lg:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                        Professor / Coordinator
                      </p>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)]">
                          Research Workflow
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${selectedWorkflow?.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                        >
                          {selectedWorkflow?.status
                            ? selectedWorkflow.status
                                .toLowerCase()
                                .replace(/^\w/, (letter: string) =>
                                  letter.toUpperCase(),
                                )
                            : "No workflow selected"}
                        </span>
                      </div>
                      <p className="mt-1 text-base text-slate-500">
                        Configure research stages, milestones, and approval requirements.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 self-start lg:self-auto">
                      <button
                        type="button"
                        disabled={!selectedWorkflow}
                        onClick={() => setShowStudentPreview(true)}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-extrabold text-[var(--color-primary)] transition hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <i className="ti ti-eye mr-1.5" aria-hidden="true" />
                        Preview as Student
                      </button>
                      <button
                        type="button"
                        disabled={
                          !selectedWorkflow ||
                          selectedWorkflow.status === "PUBLISHED" ||
                          publishingWorkflow
                        }
                        onClick={() => setShowPublishConfirmation(true)}
                        className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-extrabold text-[var(--college-on-primary)] shadow-sm transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <i
                          className={`ti ${publishingWorkflow ? "ti-loader-2 animate-spin" : selectedWorkflow?.status === "PUBLISHED" ? "ti-circle-check" : "ti-send"} mr-1.5`}
                          aria-hidden="true"
                        />
                        {publishingWorkflow
                          ? "Publishing…"
                          : selectedWorkflow?.status === "PUBLISHED"
                            ? "Published"
                            : "Publish"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center">
                    <label className="text-sm font-bold text-[var(--color-text-primary)]">
                      Workflow
                    </label>
                    <select
                      value={selectedWorkflowId}
                      onChange={(event) => {
                        setSelectedWorkflowId(event.target.value);
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-base font-semibold text-[var(--color-text-primary)] sm:max-w-md"
                    >
                      {!workflows.length && (
                        <option value="">No workflow created yet</option>
                      )}
                      {workflows.map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.name}
                        </option>
                      ))}
                    </select>
                    <span
                      className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)]"
                      role="status"
                    >
                      <i
                        className="ti ti-cloud-check text-emerald-600"
                        aria-hidden="true"
                      />
                      {workflowSavedLabel
                        ? `Last saved ${workflowSavedLabel}`
                        : "Changes are saved directly to this workflow"}
                    </span>
                  </div>
                  {selectedWorkflow?.status === "DRAFT" && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                      <i className="ti ti-lock mt-0.5" aria-hidden="true" />
                      Draft milestones remain private until you publish.
                      Existing student submissions are never changed by
                      publishing.
                    </p>
                  )}
                </section>
                <div
                  className="overflow-x-auto rounded-t-2xl border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 shadow-sm"
                  role="tablist"
                  aria-label="Workflow sections"
                >
                  <div className="flex min-w-max gap-1">
                    {(
                      [
                        {
                          id: "milestones",
                          label: "Workflow",
                          icon: "ti-route",
                        },
                        {
                          id: "resources",
                          label: "Guides & Templates",
                          icon: "ti-books",
                        },
                        {
                          id: "participants",
                          label: `Participants (${workflowEnrollmentCount})`,
                          icon: "ti-users",
                        },
                      ] as const
                    ).map((item, index, items) => (
                      <button
                        key={item.id}
                        id={`workflow-tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={workflowView === item.id}
                        aria-controls={`workflow-panel-${item.id}`}
                        tabIndex={workflowView === item.id ? 0 : -1}
                        onClick={() => setWorkflowView(item.id)}
                        onKeyDown={(event) => {
                          if (
                            event.key !== "ArrowLeft" &&
                            event.key !== "ArrowRight"
                          )
                            return;
                          event.preventDefault();
                          const direction = event.key === "ArrowRight" ? 1 : -1;
                          const next =
                            items[
                              (index + direction + items.length) % items.length
                            ];
                          setWorkflowView(next.id);
                          window.setTimeout(
                            () =>
                              document
                                .getElementById(`workflow-tab-${next.id}`)
                                ?.focus(),
                            0,
                          );
                        }}
                        className={`relative flex items-center gap-2 whitespace-nowrap px-5 py-4 text-sm font-extrabold transition ${workflowView === item.id ? "text-[#173f63]" : "text-slate-500 hover:text-[#173f63]"}`}
                      >
                        <i className={`ti ${item.icon}`} />
                        {item.label}
                        {workflowView === item.id && (
                          <span className="absolute inset-x-3 bottom-0 h-1 rounded-t-full bg-[#f6a800]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {legacyWorkflowUiEnabled && (
                  <section
                    id="workflow-panel-overview"
                    role="tabpanel"
                    aria-labelledby="workflow-tab-overview"
                    className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#C58A18]">
                        Selected workflow
                      </p>
                      <h3 className="mt-2 text-xl font-black text-[#102f49]">
                        {selectedWorkflow?.name || "Create your first workflow"}
                      </h3>
                      <p className="mt-2 max-w-3xl text-base leading-6 text-slate-500">
                        {selectedWorkflow?.description ||
                          "Build a reusable research process, share official guides, and invite researchers when it is ready."}
                      </p>
                      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          [
                            "Milestones",
                            selectedWorkflowMilestones.length,
                            "ti-route",
                          ],
                          [
                            "Requirements",
                            workflowRequirementCount,
                            "ti-upload",
                          ],
                          [
                            "Guides & templates",
                            workflowResourceSummary?.resources?.length || 0,
                            "ti-books",
                          ],
                          ["Researchers", workflowEnrollmentCount, "ti-users"],
                        ].map(([label, value, icon]) => (
                          <div
                            key={String(label)}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <i
                              className={`ti ${icon} text-lg text-[#C58A18]`}
                            />
                            <strong className="mt-3 block text-2xl font-black text-[#102f49]">
                              {value}
                            </strong>
                            <span className="text-xs font-bold text-slate-500">
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWorkflowView("milestones");
                            openNewMilestone("submission");
                          }}
                          disabled={!selectedWorkflowId}
                          className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
                        >
                          <i className="ti ti-plus mr-1.5" />
                          Add milestone
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkflowView("resources")}
                          disabled={!selectedWorkflowId}
                          className="rounded-xl border border-[#173f63] px-4 py-2.5 text-sm font-extrabold text-[#173f63] disabled:opacity-40"
                        >
                          <i className="ti ti-upload mr-1.5" />
                          Manage resources
                        </button>
                      </div>
                    </div>
                    <aside className="space-y-4">
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h3 className="font-extrabold text-[#102f49]">
                          Workflow readiness
                        </h3>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Version</span>
                            <strong>v{selectedWorkflow?.version || 1}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              Approval gates
                            </span>
                            <strong>{workflowApprovalCount}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Invitation</span>
                            <strong
                              className={
                                selectedWorkflow?.inviteCode
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              }
                            >
                              {selectedWorkflow?.inviteCode
                                ? "Ready"
                                : "Not generated"}
                            </strong>
                          </div>
                        </div>
                      </section>
                      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                        <h3 className="font-extrabold text-[#102f49]">
                          Whole-workflow resources
                        </h3>
                        <p className="mt-1 text-base leading-5 text-slate-600">
                          Guides and templates are shared with every enrolled
                          researcher and are not tied to individual milestones.
                        </p>
                      </section>
                    </aside>
                  </section>
                )}
                {workflowView === "resources" && (
                  <div
                    id="workflow-panel-resources"
                    role="tabpanel"
                    aria-labelledby="workflow-tab-resources"
                  >
                    <WorkflowResourcesCard
                      workflowId={selectedWorkflowId}
                      canManage
                    />
                  </div>
                )}
                {workflowView === "participants" && (
                  <div
                    id="workflow-panel-participants"
                    role="tabpanel"
                    aria-labelledby="workflow-tab-participants"
                  >
                    <WorkflowParticipantsCard
                      workflowId={selectedWorkflowId}
                      workflowName={selectedWorkflow?.name}
                      participants={selectedWorkflowParticipants}
                      isLoading={enrollmentsLoading}
                      error={enrollmentsError}
                      invitation={selectedWorkflowInvitation}
                      invitationLoading={saving}
                      onInvite={() => void handleGenerateWorkflowInvitation()}
                      onRemove={(participant) =>
                        setMonitoringPendingRemoval({
                          kind: "researcher",
                          id: participant.id,
                          name:
                            `${participant.user.firstName || ""} ${participant.user.lastName || ""}`.trim() ||
                            participant.user.email,
                          workflowName: selectedWorkflow?.name,
                        })
                      }
                    />
                  </div>
                )}
                {workflowView === "milestones" && (
                  <div
                    id="workflow-panel-milestones"
                    role="tabpanel"
                    aria-labelledby="workflow-tab-milestones"
                    className="flex flex-col gap-5"
                  >
                    {(workflowsError || workflowsLoading) && (
                      <section
                        className={`rounded-2xl border p-5 text-sm ${workflowsError ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"}`}
                        role="status"
                        aria-live="polite"
                        aria-busy={workflowsLoading}
                      >
                        {workflowsError ? (
                          "The workflow could not be loaded. Check the API connection and try again."
                        ) : (
                          <ListRowsSkeleton rows={4} avatars={false} />
                        )}
                      </section>
                    )}
                    {!workflowsLoading && !workflowsError && (
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">
                                Workflow structure
                              </h3>
                              <p className="mt-0.5 text-base text-[var(--color-text-secondary)]">
                                Organize topics and select a milestone to edit its details.
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-3 self-end sm:self-auto">
                              <span className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-bold text-[var(--color-text-secondary)]">
                                {
                                  milestones.filter(
                                    (item) =>
                                      item.workflowId === selectedWorkflowId,
                                  ).length
                                }{" "}
                                milestones
                              </span>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowWorkflowCreateMenu((value) => !value)
                                  }
                                  disabled={!selectedWorkflowId}
                                  aria-haspopup="menu"
                                  aria-expanded={showWorkflowCreateMenu}
                                  className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-extrabold text-[var(--college-on-primary)] shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:text-[var(--college-on-primary-dark)]"
                                >
                                  <i className="ti ti-plus mr-1.5" />
                                  Create{" "}
                                  <i className="ti ti-chevron-down ml-1" />
                                </button>
                                {showWorkflowCreateMenu && (
                                  <div
                                    role="menu"
                                    className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 shadow-xl"
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => openTopicEditor()}
                                      className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                                    >
                                      <i className="ti ti-folders mt-0.5 text-lg text-[#C58A18]" />
                                      <span>
                                        <strong className="block text-sm text-[#102f49]">
                                          Topic
                                        </strong>
                                        <span className="mt-0.5 block text-sm text-slate-500">
                                          Group milestones by defense or phase
                                        </span>
                                      </span>
                                    </button>
                                    <div className="my-1 border-t border-slate-100" />
                                    {[
                                      ["title", "ti-writing", "Title Proposal", "Approve one title to register the research project"],
                                      [
                                        "submission",
                                        "ti-file-upload",
                                        "Submission milestone",
                                        "Collect a document or deliverable",
                                      ],
                                      [
                                        "approval",
                                        "ti-circle-check",
                                        "Approval checkpoint",
                                        "Review before researchers continue",
                                      ],
                                      [
                                        "event",
                                        "ti-presentation",
                                        "Academic event",
                                        "Presentation, defense, or consultation",
                                      ],
                                      [
                                        "adviser",
                                        "ti-user-check",
                                        "Adviser Milestone",
                                        hasAdviserMilestone
                                          ? "Already added to this workflow"
                                          : "Complete when an adviser accepts",
                                      ],
                                    ].map(
                                      ([kind, icon, label, description]) => (
                                        <button
                                          key={kind}
                                          type="button"
                                          role="menuitem"
                                          disabled={(kind === "adviser" && hasAdviserMilestone) || (kind === "title" && selectedWorkflowMilestones.some(item => item.milestoneType === "TITLE_PROPOSAL"))}
                                          onClick={() => {
                                            if (
                                              kind === "adviser" &&
                                              hasAdviserMilestone
                                            )
                                              return;
                                            openNewMilestone(
                                              kind as
                                                | "submission"
                                                | "approval"
                                                | "event"
                                                | "adviser"
                                                | "title",
                                            );
                                          }}
                                          className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <i
                                            className={`ti ${icon} mt-0.5 text-lg text-[#173f63]`}
                                          />
                                          <span>
                                            <strong className="block text-sm text-[#102f49]">
                                              {label}
                                            </strong>
                                            <span className="mt-0.5 block text-sm text-slate-500">
                                              {description}
                                            </span>
                                          </span>
                                        </button>
                                      ),
                                    )}
                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setShowWorkflowCreateMenu(false);
                                        setWorkflowView("resources");
                                      }}
                                      className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                                    >
                                      <i className="ti ti-books mt-0.5 text-lg text-[#173f63]" />
                                      <span>
                                        <strong className="block text-sm text-[#102f49]">
                                          Guide or template
                                        </strong>
                                        <span className="mt-0.5 block text-sm text-slate-500">
                                          Share a reusable workflow resource
                                        </span>
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-5 flex flex-col gap-5">
                            {ungroupedWorkflowMilestones.length > 0 && (
                              <section className="order-2 overflow-hidden rounded-2xl border border-dashed border-amber-300 bg-amber-50/40">
                                <div className="flex items-center gap-3 border-b border-amber-200 px-4 py-3">
                                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
                                    <i className="ti ti-folder-question" />
                                  </span>
                                  <div>
                                    <h4 className="font-extrabold text-[var(--color-text-primary)]">
                                      Needs organization
                                    </h4>
                                    <p className="text-base text-[var(--color-text-secondary)]">
                                      Open a milestone to assign it to a topic.
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  {ungroupedWorkflowMilestones.map(
                                    renderWorkflowMilestone,
                                  )}
                                </div>
                              </section>
                            )}
                            {selectedWorkflowTopics.map(
                              (topic: any, topicIndex: number) => {
                                const topicMilestones =
                                  selectedWorkflowMilestones.filter(
                                    (milestone) =>
                                      milestone.topicId === topic.id,
                                  );
                                return (
                                  <section
                                    key={topic.id}
                                    onDragOver={(event) =>
                                      event.preventDefault()
                                    }
                                    onDrop={() =>
                                      void handleDropTopic(topic.id)
                                    }
                                    className={`order-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition ${draggedTopicId === topic.id ? "opacity-60 ring-2 ring-[var(--college-focus-ring)]" : ""}`}
                                  >
                                    <header className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                      <div className="flex min-w-0 items-start gap-3">
                                        <span
                                          draggable={!topicOrderSaving}
                                          onDragStart={() =>
                                            setDraggedTopicId(topic.id)
                                          }
                                          onDragEnd={() =>
                                            setDraggedTopicId(null)
                                          }
                                          className="grid h-10 w-10 shrink-0 cursor-grab place-items-center rounded-xl bg-[var(--color-primary)] text-[var(--college-on-primary)] active:cursor-grabbing"
                                          aria-hidden="true"
                                          title="Drag to reorder"
                                        >
                                          <i
                                            className="ti ti-grip-vertical"
                                            aria-hidden="true"
                                          />
                                        </span>
                                        <div className="min-w-0">
                                          <h4 className="font-extrabold text-[var(--color-text-primary)]">
                                            <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                                              Phase {topicIndex + 1}
                                            </span>
                                            {topic.title}
                                          </h4>
                                          {topic.description && (
                                            <p className="mt-0.5 text-base text-[var(--color-text-secondary)]">
                                              {topic.description}
                                            </p>
                                          )}
                                          <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                                            {topicMilestones.length} milestone
                                            {topicMilestones.length === 1
                                              ? ""
                                              : "s"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setCollapsedTopicIds((current) => {
                                              const next = new Set(current);
                                              if (next.has(topic.id))
                                                next.delete(topic.id);
                                              else next.add(topic.id);
                                              return next;
                                            })
                                          }
                                          aria-expanded={
                                            !collapsedTopicIds.has(topic.id)
                                          }
                                          aria-controls={`workflow-topic-${topic.id}`}
                                          aria-label={`${collapsedTopicIds.has(topic.id) ? "Expand" : "Collapse"} ${topic.title}`}
                                          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white"
                                        >
                                          <i
                                            className={`ti ${collapsedTopicIds.has(topic.id) ? "ti-chevron-down" : "ti-chevron-up"}`}
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleMoveTopic(topic.id, -1)
                                          }
                                          disabled={topicIndex === 0}
                                          aria-label={`Move ${topic.title} up`}
                                          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-30"
                                        >
                                          <i className="ti ti-arrow-up" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleMoveTopic(topic.id, 1)
                                          }
                                          disabled={
                                            topicIndex ===
                                            selectedWorkflowTopics.length - 1
                                          }
                                          aria-label={`Move ${topic.title} down`}
                                          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-30"
                                        >
                                          <i className="ti ti-arrow-down" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openTopicEditor(topic)}
                                          aria-label={`Edit ${topic.title}`}
                                          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white"
                                        >
                                          <i className="ti ti-pencil" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleDeleteTopic(topic)
                                          }
                                          disabled={topicMilestones.length > 0}
                                          title={
                                            topicMilestones.length
                                              ? "Move the topic's milestones before deleting it"
                                              : "Delete topic"
                                          }
                                          aria-label={`Delete ${topic.title}`}
                                          className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                                        >
                                          <i className="ti ti-trash" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openNewMilestone(
                                              "submission",
                                              topic.id,
                                            )
                                          }
                                          className="ml-1 rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-[#173f63] shadow-sm ring-1 ring-slate-200 hover:ring-[#173f63]"
                                        >
                                          <i className="ti ti-plus mr-1" />
                                          Milestone
                                        </button>
                                      </div>
                                    </header>
                                    <div
                                      id={`workflow-topic-${topic.id}`}
                                      hidden={collapsedTopicIds.has(topic.id)}
                                      className="p-0"
                                    >
                                      {topicMilestones.length ? (
                                        topicMilestones.map(
                                          renderWorkflowMilestone,
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openNewMilestone(
                                              "submission",
                                              topic.id,
                                            )
                                          }
                                          className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm font-bold text-slate-500 hover:border-[#f6a800] hover:bg-amber-50/40 hover:text-[#102f49]"
                                        >
                                          <i className="ti ti-plus mr-1.5" />
                                          Add the first milestone to{" "}
                                          {topic.title}
                                        </button>
                                      )}
                                    </div>
                                  </section>
                                );
                              },
                            )}
                            {!selectedWorkflowMilestones.length &&
                              !selectedWorkflowTopics.length && (
                                <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
                                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-[#d98d00]">
                                    <i className="ti ti-route text-2xl" />
                                  </span>
                                  <h4 className="mt-3 font-extrabold text-[#102f49]">
                                    {workflows.length
                                      ? "Start your research process"
                                      : "Create your first workflow"}
                                  </h4>
                                  <p className="mt-1 text-base text-slate-500">
                                    {workflows.length
                                      ? "Create the first topic that will organize this workflow."
                                      : "Create an empty department workflow before adding milestones."}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      workflows.length
                                        ? openTopicEditor()
                                        : setCreatingWorkflow(true)
                                    }
                                    className="mt-4 rounded-xl bg-[#f6a800] px-4 py-2.5 text-sm font-extrabold text-[#102f49]"
                                  >
                                    {workflows.length
                                      ? "Add first topic"
                                      : "Create workflow"}
                                  </button>
                                </div>
                              )}
                          </div>
                        </section>
                        <aside className="space-y-4">
                          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-extrabold text-[var(--color-text-primary)]">
                                  Workflow summary
                                </h3>
                                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                                  Version {selectedWorkflow?.version || 1}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-bold ${workflowReadyToPublish ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                              >
                                {workflowReadyToPublish
                                  ? "Ready"
                                  : "Needs setup"}
                              </span>
                            </div>
                            <div className="mt-4 space-y-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Topics</span>
                                <strong className="text-[#102f49]">
                                  {selectedWorkflowTopics.length}
                                </strong>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">
                                  Milestones
                                </span>
                                <strong className="text-[#102f49]">
                                  {
                                    milestones.filter(
                                      (item) =>
                                        item.workflowId === selectedWorkflowId,
                                    ).length
                                  }
                                </strong>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">
                                  Document milestones
                                </span>
                                <strong className="text-[#102f49]">
                                  {workflowDocumentMilestoneCount}
                                </strong>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">
                                  Submission requirements
                                </span>
                                <strong className="text-[#102f49]">
                                  {workflowRequirementCount}
                                </strong>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">
                                  Approval gates
                                </span>
                                <strong className="text-[#102f49]">
                                  {
                                    milestones.filter(
                                      (item) =>
                                        item.workflowId ===
                                          selectedWorkflowId && item.locked,
                                    ).length
                                  }
                                </strong>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">
                                  Active researchers
                                </span>
                                <strong className="text-[#102f49]">
                                  {workflowEnrollmentCount}
                                </strong>
                              </div>
                            </div>
                          </section>
                          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-subtle)] p-5">
                            <div className="flex gap-3">
                              <i className="ti ti-bulb text-xl text-blue-700" />
                              <div>
                                <h3 className="font-extrabold text-[var(--color-text-primary)]">
                                  Keep it simple
                                </h3>
                                <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)]">
                                  Professors only need a name and target
                                  duration. Submission requirements and advanced
                                  rules can be added later.
                                </p>
                              </div>
                            </div>
                          </section>
                          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                            <h3 className="font-extrabold text-[var(--color-text-primary)]">Workflow progress</h3>
                            <div className="mt-4 flex items-center gap-4">
                              <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) ${workflowConfigurationPercent}%, var(--color-surface-muted) 0)` }}>
                                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface)] text-sm font-black text-[var(--color-text-primary)]">{workflowConfigurationPercent}%</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-[var(--color-text-primary)]">{selectedWorkflowMilestones.filter((item) => item.topicId).length} of {selectedWorkflowMilestones.length} milestones organized</p>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"><div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${workflowConfigurationPercent}%` }} /></div>
                              </div>
                            </div>
                          </section>
                          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                            <h3 className="font-extrabold text-[var(--color-text-primary)]">Quick actions</h3>
                            <div className="mt-3 divide-y divide-[var(--color-border-subtle)]">
                              <button type="button" onClick={() => setShowStudentPreview(true)} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]"><i className="ti ti-eye" /></span><span><strong className="block text-sm text-[var(--color-text-primary)]">Preview as Student</strong><span className="text-xs text-[var(--color-text-secondary)]">See the published student view</span></span></button>
                              <button type="button" onClick={() => setWorkflowView("resources")} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-primary)]"><i className="ti ti-books" /></span><span><strong className="block text-sm text-[var(--color-text-primary)]">Guides & Templates</strong><span className="text-xs text-[var(--color-text-secondary)]">Manage shared workflow resources</span></span></button>
                              <button type="button" onClick={() => setWorkflowView("participants")} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-primary)]"><i className="ti ti-users" /></span><span><strong className="block text-sm text-[var(--color-text-primary)]">Participants</strong><span className="text-xs text-[var(--color-text-secondary)]">Manage assigned researchers</span></span></button>
                              <button type="button" onClick={() => setCreatingWorkflow(true)} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-primary)]"><i className="ti ti-copy-plus" /></span><span><strong className="block text-sm text-[var(--color-text-primary)]">Create another workflow</strong><span className="text-xs text-[var(--color-text-secondary)]">Start a separate workflow configuration</span></span></button>
                              <button type="button" disabled={!selectedWorkflow || deletingWorkflow} onClick={() => { if (!selectedWorkflow) return; setWorkflowToDelete({ id: selectedWorkflow.id, name: selectedWorkflow.name }); setDeleteConfirmation(""); setDeleteWorkflowError(""); }} className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"><span className="grid h-9 w-9 place-items-center rounded-full bg-rose-50 text-rose-600"><i className="ti ti-trash" /></span><span><strong className="block text-sm text-rose-700">Delete workflow</strong><span className="text-xs text-[var(--color-text-secondary)]">Available only when no project is linked</span></span></button>
                            </div>
                          </section>
                        </aside>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ),
            deployment: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">
                  Master Progression Deployment
                </h3>
                <p className="text-base text-slate-400 font-bold">
                  Deploy research phases to specific program curricula and
                  calendar schemas.
                </p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-600">
                  <div className="font-bold text-[#1b4264] text-[13.5px] mb-2">
                    Curriculum: BS Computer Science
                  </div>
                  <div>1. Proposal Defense Scope — deployed</div>
                  <div>2. Chapter 1-3 Submission — deployed</div>
                  <div>3. Oral Presentation Clearance — pending</div>
                </div>
              </div>
            ),
            locking: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">
                  Task-Locking & Milestone Constraints
                </h3>
                <p className="text-base text-slate-400 font-bold">
                  Enforce strict research sequence constraints by locking tasks
                  until pre-requisite indicators are met.
                </p>
                <div className="flex flex-col gap-5 mt-2">
                  {workflows.map((workflow) => {
                    const workflowMilestones = milestones.filter(
                      (milestone) => milestone.workflowId === workflow.id,
                    );
                    return (
                      <div key={workflow.id} className="flex flex-col gap-2.5">
                        <span className="font-extrabold text-[#1b4264] text-[12.5px] border-b border-slate-100 pb-1">
                          {workflow.name}
                        </span>
                        {workflowMilestones.length === 0 ? (
                          <div className="text-xs text-slate-400 italic pl-1">
                            No milestones configured under this workflow.
                          </div>
                        ) : (
                          workflowMilestones.map((m) => (
                            <div
                              key={m.id}
                              className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-[12.5px] shadow-sm"
                            >
                              <div>
                                <span className="font-bold text-[#1b4264] block">
                                  {m.title}
                                </span>
                                <span className="text-xs text-slate-400 block mt-0.5">
                                  Scope: {m.scope} · Status:{" "}
                                  <strong>
                                    {m.locked ? "Locked" : "Unlocked"}
                                  </strong>
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  handleToggleTaskLock(m.id, m.locked)
                                }
                                className={`px-3 py-1 font-bold text-sm rounded border cursor-pointer transition ${
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
                <h3 className="font-extrabold text-[#1b4264] text-lg">
                  Research Workflow Management
                </h3>
                <p className="text-base text-slate-400 font-bold">
                  Review and update stages in the institutional capstone
                  workflow pipeline.
                </p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div>
                    <strong>Active Workflow Phase:</strong> {workflowStatus}
                  </div>
                  <div>
                    <strong>Total Active Groups:</strong> {projects.length}
                  </div>
                  <div className="h-px bg-slate-200 my-2" />
                  <button
                    onClick={() =>
                      triggerToast("Optimized project pipeline stages.")
                    }
                    className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start cursor-pointer"
                  >
                    Optimize Pipeline
                  </button>
                </div>
              </div>
            ),
            tracking: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">
                  Student Group Progress Tracking
                </h3>
                <p className="text-base text-slate-400 font-bold">
                  Track overall progress rates, metrics overlays, and visual
                  completion trackers.
                </p>
                <div className="flex flex-col gap-4 mt-2">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center text-[12px] font-extrabold text-[#1b4264]">
                        <span>
                          {p.group} — {p.title}
                        </span>
                        <span className="font-mono text-[#ffa400]">
                          {p.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-[#1b4264] h-full"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            completion: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">
                  Project Completion Monitoring
                </h3>
                <p className="text-base text-slate-400 font-bold">
                  Review groups cleared for graduation and final document
                  archive repository indices.
                </p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div>
                    <strong>Completed Projects:</strong> 2 Research Papers
                  </div>
                  <div>
                    <strong>Archival Status:</strong> Released to institutional
                    libraries
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="text-xs text-slate-500 font-medium">
                    1. Virtual Class VR Lab — Alex Ramos (Released)
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    2. Secure Decentralized Grading — Sarah Jenkins (Released)
                  </div>
                </div>
              </div>
            ),
            settings: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-lg">
                  Portal Settings
                </h3>
                <p className="text-base text-slate-400 font-bold">
                  Manage your notification channels, authentication credentials,
                  and user preferences.
                </p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-[#1b4264] block">
                        Email Notifications
                      </span>
                      <span className="text-xs text-slate-400">
                        Receive system notifications via email address.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="accent-[#ffa400] w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[#1b4264] block">
                        Dark Mode
                      </span>
                      <span className="text-xs text-slate-400">
                        Switch platform styling theme to night vision.
                      </span>
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
      </div>
    </div>
  );
}

export default function ProfessorDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ProfessorDashboardContent />
    </Suspense>
  );
}
