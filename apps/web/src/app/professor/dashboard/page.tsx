import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { calculateWorkflowProgress } from "@/lib/workflow-progress";
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
import { FacultyGroupChats } from "@/components/messaging/FacultyGroupChats";
import { WorkflowResourcesCard } from "@/components/workflow/WorkflowResourcesCard";
import { MilestoneAttachmentsCard } from "@/components/workflow/MilestoneAttachmentsCard";
import { MilestoneComposer } from "@/components/workflow/MilestoneComposer";
import { WorkflowParticipantsCard } from "@/components/workflow/WorkflowParticipantsCard";
import {
  WorkflowDeadlineTracker,
  type WorkflowDeadlineRow,
} from "@/components/workflow/WorkflowDeadlineTracker";
import { ResearchProjectsOnboarding } from "@/components/workflow/ResearchProjectsOnboarding";

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
  const [defenseActionPending, setDefenseActionPending] = useState(false);
  const { data: defenseManagementData, refetch: refetchDefenseManagement } =
    useQuery({
      queryKey: ["professor-defense-management"],
      queryFn: () =>
        apiClient.get<{ sessions: any[] }>("/api/defense-management"),
      refetchInterval: 15000,
    });
  const { data: eligibleDefenseData, refetch: refetchEligibleDefenseGroups } =
    useQuery({
      queryKey: ["defense-eligible-groups"],
      queryFn: () =>
        apiClient.get<{ projects: any[] }>(
          "/api/defense-management/eligible-groups",
        ),
    });
  const { data: defenseCandidateData } = useQuery({
    queryKey: ["defense-participant-candidates"],
    queryFn: () =>
      apiClient.get<{ users: any[] }>("/api/defense-management/candidates"),
  });
  const defenseSessions = defenseManagementData?.sessions || [];
  const eligibleDefenseGroups = eligibleDefenseData?.projects || [];
  const defenseCandidates = defenseCandidateData?.users || [];
  const [showDefenseForm, setShowDefenseForm] = useState(false);
  const [showDeanRequestForm, setShowDeanRequestForm] = useState(false);
  const [packetSession, setPacketSession] = useState<any | null>(null);
  const [defenseProjectId, setDefenseProjectId] = useState("");
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
          taskSubmissions: p.taskSubmissions || [],
          progress: calculateWorkflowProgress(p),
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
  }, [researchData]);

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
            prerequisiteTaskId: "",
            deadlineDays: s.deadlineDays,
            requiresDocument: s.requiresDocument !== false,
            submissionMode: s.submissionMode || "EITHER",
            tasks: s.tasks || [],
          });
        });
      });
      setMilestones(msList);
    }
  }, [workflowData, requestedWorkflowId, selectedWorkflowId]);

  // Form input controllers
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDescription, setNewMilestoneDescription] = useState("");
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
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
  const [deadlineDays, setDeadlineDays] = useState("");
  const [newMilestoneRequiresDocument, setNewMilestoneRequiresDocument] =
    useState(true);
  const [newMilestoneRequiresApproval, setNewMilestoneRequiresApproval] =
    useState(false);
  const [newMilestoneSubmissionMode, setNewMilestoneSubmissionMode] =
    useState("GROUP");
  const [newMilestoneTopicId, setNewMilestoneTopicId] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [newRequirementTitle, setNewRequirementTitle] = useState("");
  const [newRequirementInstructions, setNewRequirementInstructions] =
    useState("");
  const [newRequirementDueDays, setNewRequirementDueDays] = useState("");
  const [newRequirementFileTypes, setNewRequirementFileTypes] =
    useState("PDF,DOCX");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
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
  const [showAdvancedMilestoneOptions, setShowAdvancedMilestoneOptions] =
    useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);
  const [milestoneEditTitle, setMilestoneEditTitle] = useState("");
  const [milestoneEditDescription, setMilestoneEditDescription] = useState("");
  const [milestoneEditCategory, setMilestoneEditCategory] =
    useState("Milestone");
  const [milestoneEditDeadline, setMilestoneEditDeadline] = useState("");
  const [milestoneEditRequiresDocument, setMilestoneEditRequiresDocument] =
    useState(true);
  const [milestoneEditRequiresApproval, setMilestoneEditRequiresApproval] =
    useState(false);
  const [milestoneEditSubmissionMode, setMilestoneEditSubmissionMode] =
    useState("EITHER");
  const [milestoneEditTopicId, setMilestoneEditTopicId] = useState("");
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any | null>(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicSaving, setTopicSaving] = useState(false);
  const [workflowInvitation, setWorkflowInvitation] = useState<{
    code: string;
    link: string;
  } | null>(null);
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

  const openNewMilestone = (
    kind: "submission" | "approval" | "event" = "submission",
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
    setNewMilestoneTitle("");
    setNewMilestoneDescription("");
    setDeadlineDays("");
    setNewMilestoneSubmissionMode("GROUP");
    setNewMilestoneRequiresDocument(kind === "submission");
    setNewMilestoneRequiresApproval(kind === "approval");
    setNewMilestoneScope(kind === "approval" ? "Pre-requisite" : "Milestone");
    setNewMilestoneTopicId(preferredTopicId || selectedWorkflowTopics[0].id);
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
      await apiClient.post(`/api/workflows/${selectedWorkflowId}/stages`, {
        name: newMilestoneTitle.trim(),
        description: newMilestoneDescription.trim() || null,
        topicId: newMilestoneTopicId,
        category: newMilestoneScope,
        deadlineDays: deadlineDays ? Number(deadlineDays) : null,
        requiresApproval: newMilestoneRequiresApproval,
        requiresDocument: newMilestoneRequiresDocument,
        submissionMode: newMilestoneSubmissionMode,
      });
      await refetchWorkflows();
      setNewMilestoneTitle("");
      setNewMilestoneDescription("");
      setDeadlineDays("");
      setNewMilestoneRequiresApproval(false);
      setNewMilestoneRequiresDocument(true);
      setNewMilestoneSubmissionMode("GROUP");
      setNewMilestoneTopicId("");
      setNewMilestoneScope("Milestone");
      setCreatingMilestone(false);
      setShowAdvancedMilestoneOptions(false);
      triggerToast(`Milestone "${newMilestoneTitle.trim()}" saved.`);
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
    try {
      await apiClient.patch(
        `/api/workflows/${selectedWorkflowId}/topics/reorder`,
        {
          topicIds: reordered.map((topic: any) => topic.id),
        },
      );
      await refetchWorkflows();
      triggerToast("Topic order updated.");
    } catch (error: any) {
      triggerToast(error?.message || "The topic could not be moved.");
    }
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
          dueDays: newRequirementDueDays ? Number(newRequirementDueDays) : null,
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
        progression?: {
          advanced: boolean;
          completed: boolean;
          nextStageName?: string;
        };
      }>(`/api/workflows/tasks/submissions/${submissionId}/review`, {
        status,
        reviewNote: reviewFeedback.trim() || "Requirement approved.",
      });
      await refetchResearch();
      setSelectedProject(null);
      setSelectedSubmission(null);
      setReviewFeedback("");
      if (result.progression?.completed)
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
    setMilestoneEditDeadline(
      milestone.deadlineDays == null ? "" : String(milestone.deadlineDays),
    );
    setMilestoneEditRequiresDocument(milestone.requiresDocument !== false);
    setMilestoneEditRequiresApproval(Boolean(milestone.locked));
    setMilestoneEditSubmissionMode(milestone.submissionMode || "EITHER");
    setMilestoneEditTopicId(milestone.topicId || "");
    setMilestoneSaveStatus("idle");
    setSelectedMilestoneId(milestone.id);
  };

  const handleSaveMilestoneDetails = async () => {
    if (!editingMilestone || !milestoneEditTitle.trim()) return;
    setMilestoneSaveStatus("saving");
    const minimumDelay = new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await Promise.all([
        apiClient.patch(`/api/workflows/stages/${editingMilestone.id}`, {
          name: milestoneEditTitle.trim(),
          description: milestoneEditDescription.trim() || null,
          topicId: milestoneEditTopicId,
          category: milestoneEditCategory,
          deadlineDays:
            milestoneEditDeadline === "" ? null : Number(milestoneEditDeadline),
          requiresDocument: milestoneEditRequiresDocument,
          requiresApproval: milestoneEditRequiresApproval,
          submissionMode: milestoneEditSubmissionMode,
        }),
        minimumDelay,
      ]);
      await refetchWorkflows();
      setMilestoneSaveStatus("saved");
    } catch (error: any) {
      await minimumDelay;
      setMilestoneSaveStatus("idle");
      triggerToast(error?.message || "Milestone details could not be saved.");
    }
  };

  const handleGenerateWorkflowInvitation = async () => {
    if (!selectedWorkflowId) return;
    setSaving(true);
    try {
      const result = await apiClient.post<{
        invitation: { inviteCode: string };
      }>(`/api/workflows/${selectedWorkflowId}/invitation`, {});
      const code = result.invitation.inviteCode;
      setWorkflowInvitation({
        code,
        link: `${window.location.origin}/student/workflows/join/${code}`,
      });
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
  const selectedWorkflowInvitation =
    workflowInvitation ||
    (selectedWorkflow?.inviteCode
      ? {
          code: selectedWorkflow.inviteCode,
          link: `${typeof window !== "undefined" ? window.location.origin : ""}/student/workflows/join/${selectedWorkflow.inviteCode}`,
        }
      : null);
  const selectedWorkflowMilestones = milestones.filter(
    (item) => item.workflowId === selectedWorkflowId,
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
  const renderWorkflowMilestone = (milestone: any) => (
    <div key={milestone.id} className="relative pl-12">
      <div
        className="absolute bottom-0 left-[19px] top-11 w-px bg-slate-200"
        aria-hidden="true"
      />
      <span className="absolute left-0 top-4 grid h-10 w-10 place-items-center rounded-full border-2 border-[#173f63] bg-white text-sm font-extrabold text-[#173f63]">
        {milestone.sequence}
      </span>
      <button
        type="button"
        onClick={() => {
          setShowAdvancedMilestoneOptions(false);
          openMilestoneEditor(milestone);
        }}
        className="mb-3 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#f6a800] hover:shadow-sm"
      >
        <span className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[15px] font-extrabold text-[#102f49]">
              {milestone.title}
            </span>
            <span className="mt-1 block text-sm text-slate-500">
              {milestone.description || "No student instructions added yet."}
            </span>
          </span>
          <i className="ti ti-chevron-right mt-1 text-slate-400" />
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
          <span>
            {milestone.submissionMode === "INDIVIDUAL"
              ? "Individual researcher"
              : milestone.submissionMode === "GROUP"
                ? "Research group"
                : "Individual or group"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {milestone.deadlineDays != null
              ? `${milestone.deadlineDays} day target`
              : "No target"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {milestone.requiresDocument === false
              ? "No upload"
              : `${milestone.tasks?.length || 1} submission requirement${(milestone.tasks?.length || 1) === 1 ? "" : "s"}`}
          </span>
          {milestone.locked && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700">
                <i className="ti ti-lock mr-1" />
                Approval required
              </span>
            </>
          )}
        </span>
      </button>
    </div>
  );
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
      const startedAt = project.workflowStartedAt
        ? new Date(project.workflowStartedAt)
        : null;
      return stages.flatMap((stage: any, stageIndex: number) => {
        const transition = (project.workflowTransitions || []).find(
          (item: any) => item.toStageId === stage.id,
        );
        const actualActivation = transition?.createdAt
          ? new Date(transition.createdAt)
          : stageIndex === 0 && startedAt
            ? startedAt
            : null;
        const projectedOffset = stages
          .slice(0, stageIndex)
          .reduce(
            (days: number, previousStage: any) =>
              days + Number(previousStage.deadlineDays || 0),
            0,
          );
        return (stage.tasks || []).map((task: any) => {
          const dueDays = task.dueDays ?? stage.deadlineDays;
          const projected = !actualActivation && Boolean(startedAt);
          const activation =
            actualActivation ||
            (startedAt
              ? new Date(startedAt.getTime() + projectedOffset * 86_400_000)
              : null);
          const dueAt =
            activation && dueDays != null
              ? new Date(activation.getTime() + Number(dueDays) * 86_400_000)
              : null;
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

  const startDefense = async (sessionId: string) => {
    setDefenseActionPending(true);
    try {
      await apiClient.post("/api/defense-sessions/start", { sessionId });
      await Promise.all([refetchDefense(), refetchDefenseManagement()]);
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
        await apiClient.post("/api/defense-management", {
          researchId: defenseProjectId,
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
          "Defense invitations sent to the panel and research group.",
        );
      }
      await Promise.all([
        refetchDefenseManagement(),
        refetchEligibleDefenseGroups(),
      ]);
      resetDefenseForm();
    } catch (error: any) {
      triggerToast(error?.message || "The defense request could not be saved.");
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
      });
      await Promise.all([refetchDefense(), refetchResearch()]);
      triggerToast(
        "Official defense result released to the researcher dashboard.",
      );
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
      {showDeanRequestForm && (
        <ProfessorDeanRequestModal
          projects={
            eligibleDefenseGroups.length ? eligibleDefenseGroups : projects
          }
          onClose={() => setShowDeanRequestForm(false)}
          onSent={(message) => {
            setShowDeanRequestForm(false);
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
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-55 bg-[#1b4264] border-l-4 border-[#ffa400] text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3"
        >
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
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
              className="mt-2 text-sm leading-6 text-slate-600"
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
              className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#173f63] focus:ring-2 focus:ring-[#173f63]/10"
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
          workflowName={selectedWorkflow?.name || "Research workflow"}
          topics={selectedWorkflowTopics}
          topicId={milestoneEditTopicId}
          title={milestoneEditTitle}
          instructions={milestoneEditDescription}
          deadlineDays={milestoneEditDeadline}
          submissionMode={milestoneEditSubmissionMode}
          requiresDocument={milestoneEditRequiresDocument}
          requiresApproval={milestoneEditRequiresApproval}
          category={milestoneEditCategory}
          saving={milestoneSaveStatus === "saving"}
          saveStatus={milestoneSaveStatus}
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
          onDeadlineDaysChange={(value) => {
            setMilestoneEditDeadline(value);
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
            <div className="mt-4 space-y-3">
              {(editingMilestone.tasks || []).map((requirement: any) => (
                <div
                  key={requirement.id}
                  className="flex items-start justify-between rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <p className="text-sm font-bold text-[#102f49]">
                      {requirement.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {requirement.allowedFileTypes || "PDF,DOCX"} ·{" "}
                      {requirement.dueDays != null
                        ? `${requirement.dueDays} days`
                        : "Uses milestone target"}
                    </p>
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
                <p className="text-sm font-extrabold text-[#102f49]">
                  Add another requirement
                </p>
                <input
                  required
                  value={newRequirementTitle}
                  onChange={(event) =>
                    setNewRequirementTitle(event.target.value)
                  }
                  placeholder="e.g. Chapter 1 PDF"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                />
                <textarea
                  value={newRequirementInstructions}
                  onChange={(event) =>
                    setNewRequirementInstructions(event.target.value)
                  }
                  rows={2}
                  placeholder="Short instructions (optional)"
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
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
                    placeholder="Target days"
                    className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                  />
                  <input
                    value={newRequirementFileTypes}
                    onChange={(event) =>
                      setNewRequirementFileTypes(event.target.value)
                    }
                    placeholder="PDF,DOCX"
                    className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                  />
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
          }
          attachmentsContent={
            <MilestoneAttachmentsCard
              stageId={editingMilestone.id}
              workflowId={selectedWorkflowId}
            />
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
                <p className="text-xs font-bold text-[#d98d00]">
                  Milestone details
                </p>
                <h2
                  id="milestone-editor-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  Edit milestone
                </h2>
                <p className="mt-1 text-sm text-slate-500">
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
                  <p className="text-xs text-slate-500">
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
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-[#102f49] outline-none focus:border-[#173f63]"
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
                    className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3.5 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-[#173f63]"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Target completion
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type="number"
                      min="0"
                      max="3650"
                      value={milestoneEditDeadline}
                      onChange={(event) => {
                        setMilestoneEditDeadline(event.target.value);
                        setMilestoneSaveStatus("idle");
                      }}
                      placeholder="No target"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-14 text-sm outline-none focus:border-[#173f63]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      days
                    </span>
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
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
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
                        <p className="text-xs text-slate-500">
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
                            <p className="text-sm font-bold text-[#102f49]">
                              {requirement.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {requirement.allowedFileTypes} ·{" "}
                              {requirement.dueDays != null
                                ? `${requirement.dueDays} days`
                                : "Uses milestone schedule"}
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
                      <p className="text-sm font-extrabold text-[#102f49]">
                        Add a submission
                      </p>
                      <input
                        required
                        value={newRequirementTitle}
                        onChange={(e) => setNewRequirementTitle(e.target.value)}
                        placeholder="e.g. Chapter 1 PDF"
                        className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                      />
                      <textarea
                        value={newRequirementInstructions}
                        onChange={(e) =>
                          setNewRequirementInstructions(e.target.value)
                        }
                        rows={2}
                        placeholder="Short instructions (optional)"
                        className="w-full resize-none rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
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
                          placeholder="Due in days"
                          className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                        />
                        <input
                          value={newRequirementFileTypes}
                          onChange={(e) =>
                            setNewRequirementFileTypes(e.target.value)
                          }
                          placeholder="PDF,DOCX"
                          className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                        />
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
                  <p className="mt-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
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
                    <span className="text-xs text-slate-500">
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
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
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
              className="mt-2 text-sm leading-6 text-slate-600"
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
                <p className="text-xs font-bold uppercase tracking-wider text-[#d98d00]">
                  New workflow
                </p>
                <h2
                  id="create-workflow-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  Create your workflow
                </h2>
                <p className="mt-1 text-sm text-slate-500">
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
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                  autoFocus
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
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
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            {!user?.program?.id && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your account must be assigned to a department or program before
                creating a workflow.
              </p>
            )}
            {user?.program?.id && availableResearchTypes.length === 0 && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
                <p className="text-xs font-bold uppercase tracking-wider text-[#C58A18]">
                  Workflow topic
                </p>
                <h2
                  id="workflow-topic-dialog-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  {editingTopic ? "Edit topic" : "Create a topic"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
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
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
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
                  className="w-full resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
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
          deadlineDays={deadlineDays}
          submissionMode={newMilestoneSubmissionMode}
          requiresDocument={newMilestoneRequiresDocument}
          requiresApproval={newMilestoneRequiresApproval}
          category={newMilestoneScope}
          saving={saving}
          advancedOpen={showAdvancedMilestoneOptions}
          onTitleChange={setNewMilestoneTitle}
          onTopicIdChange={setNewMilestoneTopicId}
          onInstructionsChange={setNewMilestoneDescription}
          onDeadlineDaysChange={setDeadlineDays}
          onSubmissionModeChange={setNewMilestoneSubmissionMode}
          onRequiresDocumentChange={setNewMilestoneRequiresDocument}
          onRequiresApprovalChange={setNewMilestoneRequiresApproval}
          onCategoryChange={setNewMilestoneScope}
          onAdvancedOpenChange={setShowAdvancedMilestoneOptions}
          onClose={() => setCreatingMilestone(false)}
          onSubmit={handleCreateMilestone}
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
                <p className="text-xs font-bold text-[#d98d00]">
                  New milestone
                </p>
                <h2
                  id="create-milestone-title"
                  className="mt-1 text-xl font-extrabold text-[#102f49]"
                >
                  What should students do next?
                </h2>
                <p className="mt-1 text-sm text-slate-500">
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
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
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
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Target completion
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        min="0"
                        max="3650"
                        value={deadlineDays}
                        onChange={(e) => setDeadlineDays(e.target.value)}
                        placeholder="e.g. 14"
                        className="w-full rounded-xl border border-slate-300 p-2.5 pr-14 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        days
                      </span>
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
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
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
                      <span className="text-xs text-slate-500">
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
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
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
                <p className="text-xs font-bold uppercase tracking-wider text-[#d98d00]">
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
                <p className="text-xs text-slate-500">Status</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.status}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Current stage</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.currentStage?.name || "Not started"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Progress</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.progress}%
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Project description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {selectedProject.abstract ||
                  "No project description has been added yet."}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Research type</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.researchType?.name || "Not specified"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Program</p>
                <p className="mt-1 font-bold text-[#102f49]">
                  {selectedProject.program?.code ||
                    selectedProject.program?.name ||
                    "Not specified"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Academic year</p>
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
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedProject.adviser.email}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
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
                      <p className="text-xs text-slate-500">
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
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No researchers have been assigned.
                </p>
              )}
            </div>
            <h3 className="mt-6 font-extrabold text-[#102f49]">
              Workflow stages
            </h3>
            <div className="mt-3 space-y-2">
              {selectedProject.workflowStages.map((stage: any) => (
                <div
                  key={stage.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                >
                  <span className="font-semibold text-[#102f49]">
                    {stage.sequence}. {stage.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {stage.deadlineDays != null
                      ? `${stage.deadlineDays} days`
                      : "No deadline"}
                  </span>
                </div>
              ))}
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
                        <p className="text-xs text-slate-500">
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
                        className="rounded-lg bg-[#173f63] px-3 py-1.5 text-xs font-extrabold text-white"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No task submissions yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div
        className={`flex w-full flex-1 flex-col space-y-6 ${activeTab === "messages" ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-screen-2xl p-4 sm:p-6 lg:p-8"}`}
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
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#C9A227] px-5 text-sm font-bold text-[#0B3A53] shadow-xs transition hover:bg-[#B38E1E]"
                      >
                        <i className="ti ti-plus text-base" /> Create Milestone
                      </button>
                      <button
                        onClick={() => handleTabChange("monitoring")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
                      >
                        <i className="ti ti-folders text-base" /> Monitor Groups
                        ({projects.length})
                      </button>
                      <button
                        onClick={() => handleTabChange("submissions")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
                      >
                        <i className="ti ti-file-text text-base" /> Submissions
                      </button>
                    </>
                  }
                />
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Recent activity
                      </p>
                      <h2 className="mt-1 text-lg font-extrabold text-[#102f49]">
                        College and system updates
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
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
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                            {announcement.source === "SYSTEM_ADMIN"
                              ? "System Admin"
                              : announcement.source === "DEAN"
                                ? "Dean / Admin"
                                : "Professor"}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate text-sm font-extrabold text-[#102f49]">
                          {announcement.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
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
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                        <h3 className="text-base sm:text-lg font-bold text-[#17212B] dark:text-white">
                          Research Monitoring Overview
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Live monitoring stream of active student research
                          groups.
                        </p>
                      </div>
                      <button
                        onClick={() => handleTabChange("tracking")}
                        className="flex items-center gap-1 text-xs font-bold text-[#0B3A53] hover:underline dark:text-[#C9A227]"
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
                              <span className="text-xs font-bold text-[#0B3A53] dark:text-[#C9A227]">
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
                          <p className="mt-3 font-bold text-sm text-[#17212B] dark:text-white">
                            No active groups yet
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Research groups will appear here once registered.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-[#17212B] dark:text-white">
                          Needs your attention
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Recent student work waiting for instructor review.
                        </p>
                      </div>
                      <button
                        onClick={() => handleTabChange("submissions")}
                        className="flex items-center gap-1 text-xs font-bold text-[#0B3A53] hover:underline dark:text-[#C9A227]"
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
                              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                {item.projectTitle}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-[#C9A227]/20 px-2.5 py-1 text-[11px] font-bold text-[#8A6A0B] dark:text-[#C9A227]">
                              Review
                            </span>
                          </button>
                        ))}
                      {needsReviewCount === 0 && (
                        <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center dark:border-white/10 dark:bg-white/5">
                          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <i className="ti ti-circle-check text-lg" />
                          </span>
                          <p className="text-sm font-bold text-[#17212B] dark:text-white">
                            You’re all caught up
                          </p>
                          <p className="text-xs text-slate-400">
                            New submissions will appear here.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                </section>

                {/* Quick Actions */}
                <section className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                  <h3 className="mb-4 text-base font-bold text-[#17212B] dark:text-white">
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
                        <span className="text-xs font-bold text-[#17212B] dark:text-white">
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
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">
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
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">
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
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">
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
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">
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
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">
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
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">
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
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Announcement feed
                      </p>
                      <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                        Official updates
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Global announcements and notices for your college
                        department.
                      </p>
                    </div>
                    <div className="hidden flex-wrap gap-3 text-[10px] font-bold text-slate-500 sm:flex">
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
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                            {announcement.source === "SYSTEM_ADMIN"
                              ? "System Administrator"
                              : announcement.source === "DEAN"
                                ? "Dean / College Admin"
                                : "Professor"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${announcement.severity === "CRITICAL" ? "bg-rose-100 text-rose-700" : announcement.severity === "WARNING" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"}`}
                          >
                            {announcement.severity}
                          </span>
                          {announcement.audienceCollege ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {announcement.audienceCollege.code}
                            </span>
                          ) : (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              All colleges
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 text-base font-extrabold text-[#102f49]">
                          {announcement.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {announcement.message}
                        </p>
                        <p className="mt-3 text-xs text-slate-400">
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
                        <p className="text-xs text-slate-500">
                          New college and system notices will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                    Your college only
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold text-[#102f49]">
                    Post an announcement
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    This will only be visible to active accounts assigned to
                    your college department.
                  </p>
                  <form
                    onSubmit={publishCollegeAnnouncement}
                    className="mt-5 space-y-4"
                  >
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
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"
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
                        className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm font-normal leading-6"
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
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal"
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
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal"
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
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"
                      />
                    </label>
                    <button
                      disabled={
                        announcementPublishing ||
                        !announcementTitle.trim() ||
                        announcementMessage.trim().length < 10
                      }
                      className="w-full rounded-xl bg-[#173f63] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                    >
                      <i className="ti ti-send mr-2" />
                      {announcementPublishing
                        ? "Publishing…"
                        : "Publish to college"}
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
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Defense coordination
                      </p>
                      <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                        Defense Management
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Invite the panel, track acknowledgements, and confirm
                        eligible groups.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeanRequestForm(true)}
                        disabled={!projects.length}
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
                        Schedule defense
                      </button>
                    </div>
                  </div>
                  {!eligibleDefenseGroups.length && (
                    <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                      <i className="ti ti-info-circle mr-1" />A group becomes
                      schedulable after every required workflow milestone is
                      completed.
                    </p>
                  )}
                </section>
                {liveDefense && (
                  <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
                    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                          <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                          Live defense control
                        </p>
                        <h2 className="mt-2 text-xl font-extrabold text-[#102f49]">
                          {liveDefense.research.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {
                            liveDefense.evaluations.filter(
                              (item: any) => item.status === "LOCKED",
                            ).length
                          }{" "}
                          of{" "}
                          {
                            liveDefense.research.members.filter(
                              (item: any) => item.projectRole === "PANELIST",
                            ).length
                          }{" "}
                          panelists submitted their final evaluation.
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600">
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
                        <button
                          type="button"
                          onClick={releaseDefenseResult}
                          disabled={defenseActionPending}
                          className="mt-2 w-full rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                        >
                          Release official result
                        </button>
                      </div>
                    </div>
                  </section>
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
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className="mt-0.5 text-xl font-extrabold text-[#102f49]">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </section>
                <section className="space-y-4">
                  {defenseSessions.map((session) => {
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
                                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${session.status === "SCHEDULED" ? "bg-emerald-100 text-emerald-800" : session.status === "NEEDS_RESCHEDULING" ? "bg-rose-100 text-rose-800" : session.status === "LIVE" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}
                              >
                                {session.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
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
                            <p className="mt-1 text-xs text-slate-500">
                              {accepted} of {activeInvitations.length} invited
                              participants accepted
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
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
                                  <p className="text-sm font-bold text-[#102f49]">
                                    {invitation.invitee.firstName}{" "}
                                    {invitation.invitee.lastName}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {invitation.role.replace(/_/g, " ")}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${invitation.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800" : invitation.status === "DECLINED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}
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
                  {!defenseSessions.length && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-[#173f63]">
                        <i className="ti ti-presentation text-2xl" />
                      </span>
                      <h3 className="mt-3 font-extrabold text-[#102f49]">
                        No defense requests yet
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
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
                          <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                            {reschedulingSession
                              ? "Updated invitation"
                              : "New defense request"}
                          </p>
                          <h2
                            id="defense-form-title"
                            className="mt-1 text-xl font-extrabold text-[#102f49]"
                          >
                            {reschedulingSession
                              ? "Reschedule defense"
                              : "Schedule a defense"}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            {reschedulingSession
                              ? "Changing the schedule asks every participant to confirm again."
                              : "Only completed groups are available."}
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
                            <label className="block text-sm font-bold text-slate-700">
                              Eligible research group
                              <select
                                required
                                value={defenseProjectId}
                                onChange={(event) =>
                                  setDefenseProjectId(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
                              >
                                <option value="">Select completed group</option>
                                {eligibleDefenseGroups.map((project) => (
                                  <option key={project.id} value={project.id}>
                                    {project.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <label className="text-sm font-bold text-slate-700">
                              Date
                              <input
                                required
                                type="date"
                                value={defenseDate}
                                onChange={(event) =>
                                  setDefenseDate(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm"
                              />
                            </label>
                            <label className="text-sm font-bold text-slate-700">
                              Starts
                              <input
                                required
                                type="time"
                                value={defenseStartTime}
                                onChange={(event) =>
                                  setDefenseStartTime(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm"
                              />
                            </label>
                            <label className="text-sm font-bold text-slate-700">
                              Ends
                              <input
                                required
                                type="time"
                                value={defenseEndTime}
                                onChange={(event) =>
                                  setDefenseEndTime(event.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm"
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
                              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm"
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
                              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm"
                            />
                          </label>
                          {!reschedulingSession && (
                            <section className="space-y-4 border-t border-slate-200 pt-5">
                              <div>
                                <h3 className="font-extrabold text-[#102f49]">
                                  Defense panel
                                </h3>
                                <p className="text-xs text-slate-500">
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
                                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
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
                              className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm"
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
                                (!defenseProjectId ||
                                  !defenseChairId ||
                                  !defensePanelistIds.length))
                            }
                            className="rounded-xl bg-[#f6a800] px-5 py-2.5 text-sm font-extrabold text-[#102f49] disabled:opacity-50"
                          >
                            {defenseActionPending
                              ? "Sending…"
                              : reschedulingSession
                                ? "Send updated schedule"
                                : "Send invitations"}
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
                      <p className="text-xs font-extrabold uppercase tracking-wider text-rose-600">
                        Unavailable participant
                      </p>
                      <h2
                        id="replace-panelist-title"
                        className="mt-1 text-xl font-extrabold text-[#102f49]"
                      >
                        Replace {replacementInvitation.invitee.firstName}{" "}
                        {replacementInvitation.invitee.lastName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
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
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
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
                        <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                          {selectedSubmission.projectTitle}
                        </p>
                        <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                          {selectedSubmission.task?.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
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
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Student note
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {selectedSubmission.note ||
                              "No note was included with this submission."}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Requirement
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {selectedSubmission.task?.instructions ||
                              "No additional instructions were provided."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                  <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                      Your decision
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold text-[#102f49]">
                      Review submission
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
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
                        className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm font-normal leading-6 outline-none focus:border-[#173f63]"
                      />
                    </label>
                    {selectedSubmission.reviewNote && (
                      <p className="mt-2 text-xs text-slate-500">
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
                    <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
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
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                        Professor workspace
                      </p>
                      <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                        Student submissions
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Review submitted work and monitor requirement deadlines
                        from one place.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:w-[620px]">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Workflow
                        <select
                          value={submissionWorkflowId}
                          onChange={(event) =>
                            updateSubmissionQuery({
                              workflowId: event.target.value,
                            })
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-[#102f49]"
                        >
                          <option value="ALL">All workflows</option>
                          {workflows.map((workflow) => (
                            <option key={workflow.id} value={workflow.id}>
                              {workflow.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Search
                        <span className="relative mt-1.5 block">
                          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={submissionSearch}
                            onChange={(event) =>
                              setSubmissionSearch(event.target.value)
                            }
                            placeholder="Requirement or research group"
                            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-[#173f63]"
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
                          <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">
                            Review queue
                          </p>
                          <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">
                            Student submissions
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
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
                              className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${submissionFilter === filter.id ? "bg-[#173f63] text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-[#f6a800]"}`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                        <label className="text-xs font-bold text-slate-500">
                          Sort by
                          <select
                            value={submissionSort}
                            onChange={(event) =>
                              setSubmissionSort(event.target.value)
                            }
                            className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
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
                              <span className="mt-1 block truncate text-xs text-slate-500">
                                {submission.document?.title} ·{" "}
                                {submission.submittedByUser?.firstName}{" "}
                                {submission.submittedByUser?.lastName}
                              </span>
                            </span>
                            <span className="truncate text-sm font-semibold text-slate-700">
                              {submission.projectTitle}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(
                                submission.submittedAt,
                              ).toLocaleDateString()}
                            </span>
                            <span
                              className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-extrabold ${submission.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : submission.status === "REVISION_REQUIRED" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}
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
                            <p className="mt-1 text-sm text-slate-500">
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
                  <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                    Research Projects
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
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
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#173f63] focus:ring-2 focus:ring-[#173f63]/10"
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
                                <p className="text-xs text-slate-500">
                                  {enrollment.user.universityId ||
                                    enrollment.user.email}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Workflow
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-700">
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
                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
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
                          <p className="mt-1 text-sm text-slate-500">
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
                    {projects
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
                            <span className="text-[11px] text-slate-500">
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
                              className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                            >
                              <i className="ti ti-trash mr-1.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
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
                    {projects.length > 0 &&
                      !projects.some((project: any) => {
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
              <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 text-slate-800">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold text-[#102f49]">
                          Research workflow
                        </h2>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          {selectedWorkflow?.status
                            ? selectedWorkflow.status
                                .toLowerCase()
                                .replace(/^\w/, (letter: string) =>
                                  letter.toUpperCase(),
                                )
                            : "No workflow selected"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Organize the workflow structure, milestones, and shared
                        academic resources.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setShowWorkflowCreateMenu((value) => !value)
                          }
                          disabled={!selectedWorkflowId}
                          aria-haspopup="menu"
                          aria-expanded={showWorkflowCreateMenu}
                          className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <i className="ti ti-plus mr-1.5" />
                          Create <i className="ti ti-chevron-down ml-1" />
                        </button>
                        {showWorkflowCreateMenu && (
                          <div
                            role="menu"
                            className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
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
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  Group milestones by defense or phase
                                </span>
                              </span>
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            {[
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
                            ].map(([kind, icon, label, description]) => (
                              <button
                                key={kind}
                                type="button"
                                role="menuitem"
                                onClick={() =>
                                  openNewMilestone(
                                    kind as "submission" | "approval" | "event",
                                  )
                                }
                                className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                              >
                                <i
                                  className={`ti ${icon} mt-0.5 text-lg text-[#173f63]`}
                                />
                                <span>
                                  <strong className="block text-sm text-[#102f49]">
                                    {label}
                                  </strong>
                                  <span className="mt-0.5 block text-xs text-slate-500">
                                    {description}
                                  </span>
                                </span>
                              </button>
                            ))}
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
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  Share a reusable workflow resource
                                </span>
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                    <label className="text-sm font-bold text-slate-600">
                      Workflow
                    </label>
                    <select
                      value={selectedWorkflowId}
                      onChange={(event) => {
                        setSelectedWorkflowId(event.target.value);
                        setWorkflowInvitation(null);
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#102f49] sm:max-w-md"
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
                    <button
                      type="button"
                      onClick={() => setCreatingWorkflow(true)}
                      className="rounded-xl border border-[#173f63] bg-white px-4 py-2.5 text-sm font-extrabold text-[#173f63] transition hover:bg-[#173f63] hover:text-white"
                    >
                      <i className="ti ti-plus mr-1.5" />
                      Create workflow
                    </button>
                    <span className="text-xs text-slate-400">
                      Changes are saved directly to this workflow.
                    </span>
                  </div>
                </section>
                <div
                  className="overflow-x-auto border-b border-slate-200 bg-white px-2 shadow-sm"
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
                      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#C58A18]">
                        Selected workflow
                      </p>
                      <h3 className="mt-2 text-xl font-black text-[#102f49]">
                        {selectedWorkflow?.name || "Create your first workflow"}
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
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
                        <p className="mt-1 text-xs leading-5 text-slate-600">
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
                        className={`rounded-2xl border p-5 text-sm ${workflowsError ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-500"}`}
                      >
                        {workflowsError
                          ? "The workflow could not be loaded. Check the API connection and try again."
                          : "Loading workflow…"}
                      </section>
                    )}
                    {!workflowsLoading && !workflowsError && (
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-extrabold text-[#102f49]">
                                Milestone order
                              </h3>
                              <p className="mt-0.5 text-sm text-slate-500">
                                Select a milestone to edit its details and
                                student submissions.
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                              {
                                milestones.filter(
                                  (item) =>
                                    item.workflowId === selectedWorkflowId,
                                ).length
                              }{" "}
                              milestones
                            </span>
                          </div>
                          <div className="mt-5 space-y-5">
                            {ungroupedWorkflowMilestones.length > 0 && (
                              <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
                                <div className="mb-3 flex items-center gap-3">
                                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-200 text-slate-600">
                                    <i className="ti ti-folder-question" />
                                  </span>
                                  <div>
                                    <h4 className="font-extrabold text-[#102f49]">
                                      Ungrouped milestones
                                    </h4>
                                    <p className="text-xs text-slate-500">
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
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50"
                                  >
                                    <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                      <div className="flex min-w-0 items-start gap-3">
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173f63] text-white">
                                          <i className="ti ti-folders" />
                                        </span>
                                        <div className="min-w-0">
                                          <h4 className="font-extrabold text-[#102f49]">
                                            {topic.title}
                                          </h4>
                                          {topic.description && (
                                            <p className="mt-0.5 text-xs text-slate-500">
                                              {topic.description}
                                            </p>
                                          )}
                                          <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
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
                                          className="ml-1 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-[#173f63] shadow-sm ring-1 ring-slate-200 hover:ring-[#173f63]"
                                        >
                                          <i className="ti ti-plus mr-1" />
                                          Milestone
                                        </button>
                                      </div>
                                    </header>
                                    <div className="p-4">
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
                                  <p className="mt-1 text-sm text-slate-500">
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
                          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h3 className="font-extrabold text-[#102f49]">
                              Workflow summary
                            </h3>
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
                                  Student submissions
                                </span>
                                <strong className="text-[#102f49]">
                                  {milestones
                                    .filter(
                                      (item) =>
                                        item.workflowId === selectedWorkflowId,
                                    )
                                    .reduce(
                                      (sum, item) =>
                                        sum + (item.tasks?.length || 0),
                                      0,
                                    )}
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
                            </div>
                          </section>
                          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                            <div className="flex gap-3">
                              <i className="ti ti-bulb text-xl text-blue-700" />
                              <div>
                                <h3 className="font-extrabold text-[#102f49]">
                                  Keep it simple
                                </h3>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                  Professors only need a name and target
                                  duration. Submission requirements and advanced
                                  rules can be added later.
                                </p>
                              </div>
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
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                  Master Progression Deployment
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">
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
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                  Task-Locking & Milestone Constraints
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">
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
                          <div className="text-[11px] text-slate-400 italic pl-1">
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
                                <span className="text-[10px] text-slate-400 block mt-0.5">
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
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                  Research Workflow Management
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">
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
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                  Student Group Progress Tracking
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">
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
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                  Project Completion Monitoring
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">
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
                  <div className="text-[11px] text-slate-500 font-medium">
                    1. Virtual Class VR Lab — Alex Ramos (Released)
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    2. Secure Decentralized Grading — Sarah Jenkins (Released)
                  </div>
                </div>
              </div>
            ),
            settings: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                  Portal Settings
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">
                  Manage your notification channels, authentication credentials,
                  and user preferences.
                </p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-[#1b4264] block">
                        Email Notifications
                      </span>
                      <span className="text-[10px] text-slate-400">
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
                      <span className="text-[10px] text-slate-400">
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
