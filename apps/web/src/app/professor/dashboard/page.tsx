import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { calculateWorkflowProgress } from "@/lib/workflow-progress";
import { DashboardWelcome } from "@/components/ui/DashboardWelcome";
import { useAuth } from "@/providers/auth-provider";
import { SubmissionDocumentPreview } from "@/components/professor/SubmissionDocumentPreview";

function ProfessorDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
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
    programData?.programs?.find((program: any) => program.id === user?.program?.id) ||
    null;
  const availableResearchTypes = assignedProgram?.researchTypes?.filter(
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
    staleTime: 60000,
  });

  const {
    data: enrollmentData,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
  } = useQuery({
    queryKey: ["professor-workflow-enrollments"],
    queryFn: () =>
      apiClient.get<{ enrollments: any[] }>("/api/workflows/enrollments"),
    staleTime: 60000,
  });
  const acceptedResearchers = Array.from(
    new Map(
      (enrollmentData?.enrollments || []).map((enrollment: any) => [
        enrollment.user.id,
        enrollment,
      ]),
    ).values(),
  ) as any[];

  // Live State Data with live fallbacks
  const [studentsCount, setStudentsCount] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (researchData?.projects) {
      const mappedProjects = researchData.projects.map((p: any) => ({
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

  const [topics, setTopics] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState("Active Track");
  const [deadlineAlerts, setDeadlineAlerts] = useState(0);

  useEffect(() => {
    if (workflowData?.workflows) {
      const topList = workflowData.workflows.map((w: any) => ({
        id: w.id,
        name: w.name,
        inviteCode: w.inviteCode,
        inviteExpiresAt: w.inviteExpiresAt,
      }));
      setTopics(topList);
      if (
        topList.length > 0 &&
        !topList.some((topic: any) => topic.id === selectedTopicId)
      ) {
        setSelectedTopicId(topList[0].id);
      } else if (topList.length === 0 && selectedTopicId) {
        setSelectedTopicId("");
      }
      const msList: any[] = [];
      workflowData.workflows.forEach((w: any) => {
        w.stages?.forEach((s: any) => {
          msList.push({
            id: s.id,
            topicId: w.id,
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
  }, [workflowData]);

  // Form input controllers
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDescription, setNewWorkflowDescription] = useState("");
  const [newWorkflowResearchTypeId, setNewWorkflowResearchTypeId] = useState("");
  const [newMilestoneScope, setNewMilestoneScope] = useState("Milestone");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("");
  const [newMilestoneRequiresDocument, setNewMilestoneRequiresDocument] =
    useState(true);
  const [newMilestoneSubmissionMode, setNewMilestoneSubmissionMode] = useState("EITHER");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [newRequirementTitle, setNewRequirementTitle] = useState("");
  const [newRequirementInstructions, setNewRequirementInstructions] =
    useState("");
  const [newRequirementDueDays, setNewRequirementDueDays] = useState("");
  const [newRequirementFileTypes, setNewRequirementFileTypes] =
    useState("PDF,DOCX");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [monitoringView, setMonitoringView] = useState<
    "researchers" | "projects"
  >("researchers");
  const [monitoringSearch, setMonitoringSearch] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(
    null,
  );
  const [submissionFilter, setSubmissionFilter] = useState("NEEDS_REVIEW");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);
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
  const [milestoneEditSubmissionMode, setMilestoneEditSubmissionMode] = useState("EITHER");
  const [workflowInvitation, setWorkflowInvitation] = useState<{ code: string; link: string } | null>(null);
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

  useEffect(() => {
    if (
      availableResearchTypes.length &&
      !availableResearchTypes.some((item: any) => item.id === newWorkflowResearchTypeId)
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
      setSelectedTopicId(result.workflow.id);
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

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim() || !selectedTopicId) return;
    setSaving(true);
    try {
      await apiClient.post(`/api/workflows/${selectedTopicId}/stages`, {
        name: newMilestoneTitle.trim(),
        description: null,
        category: newMilestoneScope,
        deadlineDays: deadlineDays ? Number(deadlineDays) : null,
        requiresApproval: false,
        requiresDocument: newMilestoneRequiresDocument,
        submissionMode: newMilestoneSubmissionMode,
      });
      await refetchWorkflows();
      setNewMilestoneTitle("");
      setDeadlineDays("");
      setCreatingMilestone(false);
      setShowAdvancedMilestoneOptions(false);
      triggerToast(`Milestone "${newMilestoneTitle.trim()}" saved.`);
    } catch (error: any) {
      triggerToast(error?.message || "Milestone could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestoneId || !newRequirementTitle.trim()) return;
    setSaving(true);
    try {
      await apiClient.post(
        `/api/workflows/stages/${selectedMilestoneId}/tasks`,
        {
          title: newRequirementTitle.trim(),
          instructions: newRequirementInstructions.trim() || undefined,
          dueDays: newRequirementDueDays ? Number(newRequirementDueDays) : null,
          allowedFileTypes: newRequirementFileTypes,
        },
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
    setMilestoneEditSubmissionMode(milestone.submissionMode || "EITHER");
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
          category: milestoneEditCategory,
          deadlineDays:
            milestoneEditDeadline === "" ? null : Number(milestoneEditDeadline),
          requiresDocument: milestoneEditRequiresDocument,
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
    if (!selectedTopicId) return;
    setSaving(true);
    try {
      const result = await apiClient.post<{ invitation: { inviteCode: string } }>(`/api/workflows/${selectedTopicId}/invitation`, {});
      const code = result.invitation.inviteCode;
      setWorkflowInvitation({ code, link: `${window.location.origin}/student/workflows/join/${code}` });
      await refetchWorkflows();
      triggerToast("Workflow invitation link generated.");
    } catch (error: any) {
      triggerToast(error?.message || "Invitation link could not be generated.");
    } finally {
      setSaving(false);
    }
  };

  const router = useRouter();
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
        currentStage: project.currentStage,
        members: project.members,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  const needsReviewCount = submissions.filter((submission) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status),
  ).length;
  const filteredSubmissions = submissions.filter((submission) => {
    if (submissionFilter === "ALL") return true;
    if (submissionFilter === "NEEDS_REVIEW")
      return ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status);
    return submission.status === submissionFilter;
  });

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
    {
      id: "monitoring",
      label: "Cohort Monitoring",
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

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent font-sans text-slate-800">
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

      {editingMilestone && (
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
                  <label className="text-sm font-bold text-slate-700">Who completes this milestone?</label>
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
                <h2 id="create-workflow-title" className="mt-1 text-xl font-extrabold text-[#102f49]">
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
                <label htmlFor="workflow-name" className="mb-1.5 block text-sm font-bold text-slate-700">
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
                  <label htmlFor="workflow-research-type" className="mb-1.5 block text-sm font-bold text-slate-700">
                    Research type
                  </label>
                  <select
                    id="workflow-research-type"
                    value={newWorkflowResearchTypeId}
                    onChange={(event) => setNewWorkflowResearchTypeId(event.target.value)}
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
                <label htmlFor="workflow-description" className="mb-1.5 block text-sm font-bold text-slate-700">
                  Description <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="workflow-description"
                  value={newWorkflowDescription}
                  onChange={(event) => setNewWorkflowDescription(event.target.value)}
                  rows={3}
                  placeholder="Briefly describe when this workflow should be used."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            {!user?.program?.id && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your account must be assigned to a department or program before creating a workflow.
              </p>
            )}
            {user?.program?.id && availableResearchTypes.length === 0 && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No active research type is configured for your department. Ask the System Administrator to configure one first.
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
                disabled={saving || newWorkflowName.trim().length < 3 || !newWorkflowResearchTypeId}
                className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create workflow"}
              </button>
            </div>
          </form>
        </div>
      )}

      {creatingMilestone && (
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
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
                    >
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
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
                    <label className="text-sm font-bold text-slate-700">Who completes this milestone?</label>
                    <select
                      value={newMilestoneSubmissionMode}
                      onChange={(event) => setNewMilestoneSubmissionMode(event.target.value)}
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
                    saving || !newMilestoneTitle.trim() || !selectedTopicId
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
                {selectedProject.abstract || "No project description has been added yet."}
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
                  {selectedProject.program?.code || selectedProject.program?.name || "Not specified"}
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
                    {selectedProject.adviser.firstName} {selectedProject.adviser.lastName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedProject.adviser.email}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No adviser has been assigned yet.</p>
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
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col space-y-6 p-4 sm:p-6 lg:p-8">
        {(() => {
          const tabContent: Record<string, React.ReactNode> = {
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
                          Try another filter or check back after students submit
                          work.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ),
            monitoring: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div>
                  <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                    Researchers & Projects
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    View researchers who joined your workflows and the research projects in your scope.
                  </p>
                </div>
                <div className="flex w-fit rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Researchers and projects">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={monitoringView === "researchers"}
                    onClick={() => setMonitoringView("researchers")}
                    className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${monitoringView === "researchers" ? "bg-white text-[#173f63] shadow-sm" : "text-slate-500"}`}
                  >
                    Researchers <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs">{acceptedResearchers.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={monitoringView === "projects"}
                    onClick={() => setMonitoringView("projects")}
                    className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${monitoringView === "projects" ? "bg-white text-[#173f63] shadow-sm" : "text-slate-500"}`}
                  >
                    Projects <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs">{projects.length}</span>
                  </button>
                </div>
                <div className="relative max-w-xl">
                  <i className="ti ti-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={monitoringSearch}
                    onChange={(event) => setMonitoringSearch(event.target.value)}
                    placeholder={
                      monitoringView === "researchers"
                        ? "Search researcher, ID, email, or workflow…"
                        : "Search project, adviser, research type, or program…"
                    }
                    aria-label={`Search ${monitoringView}`}
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
                {(projectsError || workflowsError || enrollmentsError) && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    Dashboard data could not be loaded. Check the API connection
                    and try again.
                  </div>
                )}
                {monitoringView === "researchers" ? (
                  enrollmentsLoading ? (
                    <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                      Loading researchers…
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
                            .some((value) => String(value).toLowerCase().includes(query));
                        })
                        .map((enrollment: any) => {
                        const linkedProject = projects.find((project: any) =>
                          project.researchers.some((member: any) => member.user?.id === enrollment.user.id),
                        );
                        return (
                          <div key={enrollment.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                            <div>
                              <p className="font-bold text-[#173f63]">
                                {enrollment.user.firstName} {enrollment.user.lastName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {enrollment.user.universityId || enrollment.user.email}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow</p>
                              <p className="mt-1 text-sm font-semibold text-slate-700">{enrollment.workflow.name}</p>
                            </div>
                            <Tag variant={linkedProject ? "success" : "info"}>
                              {linkedProject ? "Project created" : "No project yet"}
                            </Tag>
                          </div>
                        );
                      })}
                      {!acceptedResearchers.length && !enrollmentsError && (
                        <div className="p-8 text-center">
                          <p className="font-bold text-[#173f63]">No accepted researchers yet</p>
                          <p className="mt-1 text-sm text-slate-500">Researchers appear here after they accept a workflow invitation.</p>
                        </div>
                      )}
                      {acceptedResearchers.length > 0 &&
                        !acceptedResearchers.some((enrollment: any) => {
                          const query = monitoringSearch.trim().toLowerCase();
                          if (!query) return true;
                          return [enrollment.user.firstName, enrollment.user.lastName, enrollment.user.universityId, enrollment.user.email, enrollment.workflow.name]
                            .filter(Boolean)
                            .some((value) => String(value).toLowerCase().includes(query));
                        }) && (
                          <div className="p-8 text-center text-sm text-slate-500">
                            No researchers match “{monitoringSearch}”.
                          </div>
                        )}
                    </div>
                  )
                ) : projectsLoading || workflowsLoading ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Loading research projects…
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
                          .some((value) => String(value).toLowerCase().includes(query));
                      })
                      .map((p) => (
                      <button
                        type="button"
                        onClick={() => setSelectedProject(p)}
                        key={p.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-left text-[12.5px] shadow-sm transition hover:border-[#f6a800]"
                      >
                        <div>
                          <span className="font-bold text-[#1b4264] block">
                            {p.group}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {p.researchers.length === 1 ? "Individual" : `${p.researchers.length} researchers`} ·{" "}
                            {p.currentStage?.name || "Not started"} ·{" "}
                            {p.progress}% complete
                          </span>
                        </div>
                        <Tag variant="success">{p.status}</Tag>
                      </button>
                    ))}
                    {!projects.length && !projectsError && (
                      <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                        No research projects are available.
                      </div>
                    )}
                    {projects.length > 0 &&
                      !projects.some((project: any) => {
                        const query = monitoringSearch.trim().toLowerCase();
                        if (!query) return true;
                        return [project.title, project.adviser?.firstName, project.adviser?.lastName, project.adviser?.email, project.researchType?.name, project.program?.code, project.program?.name]
                          .filter(Boolean)
                          .some((value) => String(value).toLowerCase().includes(query));
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
                          Draft
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Arrange the milestones students complete from proposal
                        to final submission.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled
                        title="Student preview is not connected yet"
                        className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-400"
                      >
                        <i className="ti ti-eye mr-1.5" />
                        Preview coming soon
                      </button>
                      {selectedTopicId && (
                        <button
                          type="button"
                          onClick={() => void handleGenerateWorkflowInvitation()}
                          disabled={saving}
                          className="rounded-xl border border-[#173f63] bg-white px-4 py-2.5 text-sm font-extrabold text-[#173f63] disabled:opacity-50"
                        >
                          <i className="ti ti-link mr-1.5" />
                          Invitation link
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                    <label className="text-sm font-bold text-slate-600">
                      Workflow
                    </label>
                    <select
                      value={selectedTopicId}
                      onChange={(event) => {
                        setSelectedTopicId(event.target.value);
                        setWorkflowInvitation(null);
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#102f49] sm:max-w-md"
                    >
                      {!topics.length && <option value="">No workflow created yet</option>}
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
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
                  {workflowInvitation && (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Researcher invitation</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input readOnly value={workflowInvitation.link} className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-700" />
                        <button type="button" onClick={() => void navigator.clipboard.writeText(workflowInvitation.link)} className="rounded-lg bg-[#173f63] px-3 py-2 text-xs font-bold text-white">Copy link</button>
                      </div>
                      <p className="mt-2 text-xs text-blue-800">Code: <strong className="font-mono">{workflowInvitation.code}</strong> · Expires in 30 days</p>
                    </div>
                  )}
                </section>
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
                            Select a milestone to edit its details and student
                            submissions.
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {
                            milestones.filter(
                              (item) => item.topicId === selectedTopicId,
                            ).length
                          }{" "}
                          milestones
                        </span>
                      </div>
                      <div className="mt-5 space-y-0">
                        {milestones
                          .filter((item) => item.topicId === selectedTopicId)
                          .map((task, index, selectedItems) => (
                            <div key={task.id} className="relative pl-12">
                              <div
                                className="absolute left-[19px] top-11 bottom-0 w-px bg-slate-200"
                                aria-hidden="true"
                              />
                              <span className="absolute left-0 top-4 grid h-10 w-10 place-items-center rounded-full border-2 border-[#173f63] bg-white text-sm font-extrabold text-[#173f63]">
                                {index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAdvancedMilestoneOptions(false);
                                  openMilestoneEditor(task);
                                }}
                                className="mb-3 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#f6a800] hover:shadow-sm"
                              >
                                <span className="flex items-start justify-between gap-4">
                                  <span>
                                    <span className="block text-[15px] font-extrabold text-[#102f49]">
                                      {task.title}
                                    </span>
                                    <span className="mt-1 block text-sm text-slate-500">
                                      {task.description ||
                                        "No student instructions added yet."}
                                    </span>
                                  </span>
                                  <i className="ti ti-chevron-right mt-1 text-slate-400" />
                                </span>
                                <span className="mt-3 flex flex-wrap gap-2">
                                  <Tag
                                    variant={
                                      task.scope === "Milestone"
                                        ? "success"
                                        : task.scope === "Compliance"
                                          ? "info"
                                          : "warn"
                                    }
                                  >
                                    {task.scope === "Pre-requisite"
                                      ? "Approval gate"
                                      : task.scope}
                                  </Tag>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    <i className="ti ti-calendar mr-1" />
                                    {task.deadlineDays != null
                                      ? `${task.deadlineDays} days`
                                      : "No target"}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    <i className="ti ti-upload mr-1" />
                                    {task.tasks?.length || 0} submissions
                                  </span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${task.locked ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
                                  >
                                    {task.locked
                                      ? "Approval required"
                                      : "Open access"}
                                  </span>
                                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                    {task.submissionMode === "INDIVIDUAL"
                                      ? "Individual"
                                      : task.submissionMode === "GROUP"
                                        ? "Group"
                                        : "Individual or group"}
                                  </span>
                                </span>
                              </button>
                              {index === selectedItems.length - 1 && (
                                <div className="absolute left-[19px] top-11 bottom-0 w-px bg-white" />
                              )}
                            </div>
                          ))}
                        {!milestones.some(
                          (item) => item.topicId === selectedTopicId,
                        ) && (
                          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
                            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-[#d98d00]">
                              <i className="ti ti-route text-2xl" />
                            </span>
                            <h4 className="mt-3 font-extrabold text-[#102f49]">
                              {topics.length ? "Start your research process" : "Create your first workflow"}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              {topics.length
                                ? "Add the first milestone students need to complete."
                                : "Create an empty department workflow before adding milestones."}
                            </p>
                            <button
                              type="button"
                              onClick={() => topics.length ? setCreatingMilestone(true) : setCreatingWorkflow(true)}
                              className="mt-4 rounded-xl bg-[#f6a800] px-4 py-2.5 text-sm font-extrabold text-[#102f49]"
                            >
                              {topics.length ? "Add first milestone" : "Create workflow"}
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
                            <span className="text-slate-500">Milestones</span>
                            <strong className="text-[#102f49]">
                              {
                                milestones.filter(
                                  (item) => item.topicId === selectedTopicId,
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
                                  (item) => item.topicId === selectedTopicId,
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
                                    item.topicId === selectedTopicId &&
                                    item.locked,
                                ).length
                              }
                            </strong>
                          </div>
                        </div>
                        {selectedTopicId && (
                          <button
                            type="button"
                            onClick={() => setCreatingMilestone(true)}
                            className="mt-5 w-full rounded-xl bg-[#173f63] py-2.5 text-sm font-extrabold text-white"
                          >
                            <i className="ti ti-plus mr-1.5" />
                            Add milestone
                          </button>
                        )}
                      </section>
                      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                        <div className="flex gap-3">
                          <i className="ti ti-bulb text-xl text-blue-700" />
                          <div>
                            <h3 className="font-extrabold text-[#102f49]">
                              Keep it simple
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              Professors only need a name and target duration.
                              Submission requirements and advanced rules can be
                              added later.
                            </p>
                          </div>
                        </div>
                      </section>
                    </aside>
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
                  {topics.map((topic) => {
                    const topicTasks = milestones.filter(
                      (m) => m.topicId === topic.id,
                    );
                    return (
                      <div key={topic.id} className="flex flex-col gap-2.5">
                        <span className="font-extrabold text-[#1b4264] text-[12.5px] border-b border-slate-100 pb-1">
                          {topic.name}
                        </span>
                        {topicTasks.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic pl-1">
                            No tasks configured under this topic.
                          </div>
                        ) : (
                          topicTasks.map((m) => (
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
            deadlines: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">
                  Deadline Enforcement & Monitoring
                </h3>
                <p className="text-[11px] text-slate-400 font-bold">
                  Set academic date thresholds, enforce compliance, and
                  broadcast alerts.
                </p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div>
                    <strong>Upcoming Submission Date:</strong> July 15, 2026
                  </div>
                  <div>
                    <strong>Alerts State:</strong> {deadlineAlerts} Active
                    Warnings
                  </div>
                  <button
                    onClick={() =>
                      triggerToast("Reminders broadcast to all groups.")
                    }
                    className="px-4 py-2 bg-[#ffa400] text-[#1b4264] font-extrabold rounded-lg border border-[#ffa400] self-start mt-2"
                  >
                    Broadcast Reminders
                  </button>
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
    <Suspense
      fallback={
        <div className="p-6 text-[#1b4264]">Loading Professor Dashboard...</div>
      }
    >
      <ProfessorDashboardContent />
    </Suspense>
  );
}
