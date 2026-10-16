"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  FolderKanban,
  Search,
  History,
  Import,
  Link as LinkIcon,
  MessageSquareText,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListRowsSkeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { apiClient } from "@/lib/api-client";
import { useActiveProject } from "@/providers/active-project-provider";
import {
  DocumentSigningModal,
  type DocumentSigningResult,
} from "@/components/adviser/AdviserDocumentSigningModal";

type WorkflowStage = {
  id: string;
  name: string;
  sequence: number;
  tasks?: Array<{ id: string; title: string }>;
};

type ResearchProject = {
  id: string;
  title: string;
  groupName?: string | null;
  taskSubmissions?: Array<{
    documentId?: string | null;
    documentVersionId?: string | null;
    attempts?: Array<{
      documentId: string;
      documentVersionId: string;
    }>;
  }>;
  workflowInstance?: {
    workflow?: { stages?: WorkflowStage[] } | null;
  } | null;
};

type Review = {
  id: string;
  reviewType: string;
  status: string;
  overallComment?: string | null;
  recommendation?: string | null;
  submittedAt?: string | null;
  reviewer: { firstName: string; lastName: string; email?: string } | null;
  comments: Array<{ id: string; comment: string; createdAt: string }>;
};

type ReviewerAssignment = {
  id: string;
  reviewType: string;
  status: "ACTIVE" | "COMPLETED" | "REVOKED" | "REASSIGNED" | "SUPERSEDED";
  isRequired: boolean;
  assignedAt: string;
  completedAt?: string | null;
  reviewer: { firstName: string; lastName: string; email?: string } | null;
  review?: {
    id: string;
    recommendation?: string | null;
    overallComment?: string | null;
    submittedAt?: string | null;
    comments: Array<{
      id: string;
      comment: string;
      locationData?: { section?: string; page?: number } | null;
    }>;
  } | null;
};

type DocumentVersion = {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  webViewLink?: string;
  uploadedAt: string;
  manuscriptStatus?: ManuscriptLifecycleStatus | null;
  isImmutable?: boolean;
  contentChecksum?: string | null;
  submittedAt?: string | null;
  snapshotCreatedAt?: string | null;
  sourceModifiedAt?: string | null;
  milestone?: { id: string; name: string; sequence: number } | null;
  submitter?: { id: string; firstName: string; lastName: string } | null;
  reviews: Review[];
  reviewerAssignments?: ReviewerAssignment[];
  sourceSignature?: {
    signedVersionId: string;
    signedAt: string;
    revokedAt?: string | null;
  } | null;
  signedSignature?: {
    signedAt: string;
    sourceVersionId: string;
    verificationCode: string;
    revokedAt?: string | null;
    signedBy: {
      firstName: string;
      middleName?: string | null;
      lastName: string;
    };
  } | null;
};

type ManuscriptLifecycleStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "FINALIZED";

type WorkspaceDocument = {
  id: string;
  title: string;
  documentType: string;
  currentVersion: number;
  lifecycleStatus: ManuscriptLifecycleStatus;
  liveDocumentUrl?: string | null;
  liveExternalFileId?: string | null;
  milestoneId?: string | null;
  milestone?: { id: string; name: string; sequence: number } | null;
  updatedAt: string;
  versions: DocumentVersion[];
  manuscriptStatusEvents?: Array<{
    id: string;
    fromStatus?: ManuscriptLifecycleStatus | null;
    toStatus: ManuscriptLifecycleStatus;
    reason?: string | null;
    createdAt: string;
    actor: { id: string; firstName: string; lastName: string };
  }>;
};

type DocumentPermissions = {
  canView: boolean;
  canManageWorkingDocuments: boolean;
  canSubmitManuscript: boolean;
  canReview: boolean;
  canApproveOfficialDocuments: boolean;
};

type OfficialCopyPermissions = {
  canView: boolean;
  canFinalize: boolean;
  canSign: boolean;
  canRevoke: boolean;
};

type OfficialCopySignature = {
  id: string;
  signerRole: string;
  fileName: string;
  fileSize: number;
  fileUrl?: string | null;
  sourceFileHash: string;
  signedFileHash: string;
  verificationCode: string;
  authenticationMethod: string;
  mechanism: "ACCOUNT_AUTHENTICATED_VISUAL_SIGNATURE";
  status: "ACTIVE" | "REVOKED";
  signedAt: string;
  revokedAt?: string | null;
  signedBy: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
  };
};

type OfficialCopy = {
  id: string;
  researchId: string;
  documentId: string;
  sourceVersionId: string;
  title: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  fileUrl?: string | null;
  checksum: string;
  verificationCode: string;
  status: "ACTIVE" | "SUPERSEDED" | "REVOKED";
  canSign: boolean;
  finalizedAt: string;
  supersededAt?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  finalizedBy: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
  };
  sourceVersion: {
    id: string;
    versionNumber: number;
    fileName: string;
    submittedAt?: string | null;
    contentChecksum?: string | null;
    milestone?: { id: string; name: string; sequence: number } | null;
    reviewerAssignments: ReviewerAssignment[];
  };
  signatures: OfficialCopySignature[];
  supersedes?: {
    id: string;
    verificationCode: string;
    finalizedAt: string;
  } | null;
  supersededBy?: {
    id: string;
    verificationCode: string;
    finalizedAt: string;
  } | null;
};

type OfficialEligibleVersion = {
  id: string;
  versionNumber: number;
  fileName: string;
  submittedAt?: string | null;
  contentChecksum?: string | null;
  milestone?: { id: string; name: string; sequence: number } | null;
  document: { id: string; title: string; documentType: string };
};

type TaskAttempt = {
  id: string;
  attemptNumber: number;
  status: string;
  documentVersionId: string;
  submittedAt: string;
  reviewedAt?: string | null;
};

type MilestoneProgress = {
  id: string;
  name: string;
  description?: string | null;
  sequence: number;
  status:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "AWAITING_REVIEW"
    | "REVISION_REQUIRED"
    | "APPROVED"
    | "COMPLETED";
  isCurrent: boolean;
  completed: boolean;
  completionPercent: number;
  completedRequirements: number;
  totalRequirements: number;
  documentRequirementSatisfied: boolean;
  tasks: Array<{
    id: string;
    title: string;
    sequence: number;
    isRequired: boolean;
    status?: string | null;
    documentId?: string | null;
    documentVersionId?: string | null;
    attempts: TaskAttempt[];
  }>;
};

type ManuscriptActivity = {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  documentId?: string | null;
  versionId?: string | null;
  milestoneId?: string | null;
  actor?: { id?: string | null; name: string } | null;
};

type LegacyDocument = {
  id?: string;
  title?: string;
  docUrl?: string;
  directUrl?: string;
  milestone?: string;
  milestoneId?: string;
};

type ImportReceipt = {
  legacyKey: string;
  researchId: string;
  documentId: string;
  importedAt: string;
};

const LEGACY_STORAGE_KEY = "advisio_student_linked_google_docs";
const IMPORT_RECEIPTS_KEY = "advisio_student_linked_google_docs:server-imports";

function extractGoogleId(rawUrl?: string | null) {
  const value = rawUrl?.trim() || "";
  return (
    value.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    value.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    null
  );
}

function getEmbedUrl(rawUrl: string) {
  const id = extractGoogleId(rawUrl);
  if (!id) return rawUrl;
  return rawUrl.includes("docs.google.com")
    ? `https://docs.google.com/document/d/${id}/preview`
    : `https://drive.google.com/file/d/${id}/preview`;
}

function legacyKey(document: LegacyDocument) {
  return (
    document.id ||
    extractGoogleId(document.directUrl || document.docUrl) ||
    document.docUrl ||
    ""
  );
}

function milestoneForLegacy(document: LegacyDocument, stages: WorkflowStage[]) {
  if (
    document.milestoneId &&
    stages.some((stage) => stage.id === document.milestoneId)
  ) {
    return document.milestoneId;
  }
  const label = (document.milestone || "").toLowerCase();
  return stages.find(
    (stage) =>
      label === `${stage.sequence}. ${stage.name}`.toLowerCase() ||
      (label && label.includes(stage.name.toLowerCase())),
  )?.id;
}

function formatDate(value?: string | null) {
  if (!value) return "Not submitted";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const lifecycleLabels: Record<ManuscriptLifecycleStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  REVISION_REQUIRED: "Revision required",
  APPROVED: "Approved",
  FINALIZED: "Finalized",
};

function lifecycleVariant(
  status: ManuscriptLifecycleStatus,
): "success" | "warning" | "info" | "neutral" {
  if (status === "APPROVED" || status === "FINALIZED") return "success";
  if (status === "REVISION_REQUIRED") return "warning";
  if (status === "SUBMITTED" || status === "IN_REVIEW") return "info";
  return "neutral";
}

function milestoneVariant(
  status: MilestoneProgress["status"],
): "success" | "warning" | "info" | "neutral" {
  if (status === "COMPLETED" || status === "APPROVED") return "success";
  if (status === "REVISION_REQUIRED") return "warning";
  if (status === "AWAITING_REVIEW" || status === "IN_PROGRESS") return "info";
  return "neutral";
}

export default function DocumentWorkspacePage() {
  const searchParams = useSearchParams();
  const milestoneParam = searchParams.get("milestoneId");
  const taskParam = searchParams.get("taskId");
  const documentParam = searchParams.get("documentId");
  const versionParam = searchParams.get("versionId");
  const projectParam =
    searchParams.get("projectId") || searchParams.get("researchId");

  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const {
    projectId: resolvedProjectId,
    invalidRequestedProjectId,
    selectProject,
  } = useActiveProject(projects);
  const activeProjectId = resolvedProjectId || "";
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [workflowMilestones, setWorkflowMilestones] = useState<
    MilestoneProgress[]
  >([]);
  const [activity, setActivity] = useState<ManuscriptActivity[]>([]);
  const [permissions, setPermissions] = useState<DocumentPermissions | null>(
    null,
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [fileFilter, setFileFilter] = useState<"all" | "working" | "uploaded">("all");
  const [fileSort, setFileSort] = useState<"recent" | "name">("recent");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "official" ? "official" : "workspace",
  );
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkMilestoneId, setLinkMilestoneId] = useState("");
  const [linkError, setLinkError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creatingGoogleDocument, setCreatingGoogleDocument] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createMilestoneId, setCreateMilestoneId] = useState("");
  const [createError, setCreateError] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadMilestoneId, setUploadMilestoneId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editMilestoneId, setEditMilestoneId] = useState("");
  const [editError, setEditError] = useState("");
  const [legacyDocuments, setLegacyDocuments] = useState<LegacyDocument[]>([]);
  const [importReceipts, setImportReceipts] = useState<ImportReceipt[]>([]);
  const [importing, setImporting] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionMilestoneId, setSubmissionMilestoneId] = useState("");
  const [submissionTaskId, setSubmissionTaskId] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [submissionKey, setSubmissionKey] = useState("");
  const [officialCopies, setOfficialCopies] = useState<OfficialCopy[]>([]);
  const [officialEligibleVersions, setOfficialEligibleVersions] = useState<
    OfficialEligibleVersion[]
  >([]);
  const [officialPermissions, setOfficialPermissions] =
    useState<OfficialCopyPermissions | null>(null);
  const [finalizingVersionId, setFinalizingVersionId] = useState("");
  const [verifyingArtifactId, setVerifyingArtifactId] = useState("");
  const [signingOfficialCopy, setSigningOfficialCopy] =
    useState<OfficialCopy | null>(null);
  const [revocationTarget, setRevocationTarget] = useState<OfficialCopy | null>(
    null,
  );
  const [revocationReason, setRevocationReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;
  const stages = activeProject?.workflowInstance?.workflow?.stages || [];
  const submissionStage = stages.find(
    (stage) => stage.id === submissionMilestoneId,
  );
  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) || null;
  const visibleDocuments = useMemo(
    () => documents
      .filter((document) => {
        const search = fileSearch.trim().toLocaleLowerCase();
        const matchesSearch = !search || document.title.toLocaleLowerCase().includes(search);
        const matchesType =
          fileFilter === "all" ||
          (fileFilter === "working" && Boolean(document.liveDocumentUrl)) ||
          (fileFilter === "uploaded" && !document.liveDocumentUrl);
        return matchesSearch && matchesType;
      })
      .sort((left, right) =>
        fileSort === "name"
          ? left.title.localeCompare(right.title)
          : new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [documents, fileSearch, fileFilter, fileSort],
  );

  const importableLegacyDocuments = useMemo(
    () =>
      legacyDocuments.filter((document) => {
        const key = legacyKey(document);
        const url = document.directUrl || document.docUrl;
        return (
          Boolean(key && document.title?.trim() && extractGoogleId(url)) &&
          !importReceipts.some((receipt) => receipt.legacyKey === key)
        );
      }),
    [legacyDocuments, importReceipts],
  );

  const reviewAssignments = useMemo(
    () =>
      documents.flatMap((document) =>
        document.versions.flatMap((version) =>
          (version.reviewerAssignments || []).map((assignment) => ({
            document,
            version,
            assignment,
          })),
        ),
      ),
    [documents],
  );

  const loadDocuments = async (researchId: string) => {
    setLoadingDocuments(true);
    setPageError("");
    try {
      const [documentsResult, workflowResult, officialResult] =
        await Promise.allSettled([
          apiClient.get<{
            documents: WorkspaceDocument[];
            permissions: DocumentPermissions;
          }>(`/api/research/${researchId}/documents`),
          apiClient.get<{
            milestones: MilestoneProgress[];
            activity: ManuscriptActivity[];
          }>(`/api/research/${researchId}/manuscript-workflow`),
          apiClient.get<{
            copies: OfficialCopy[];
            permissions: OfficialCopyPermissions;
            eligibleVersions: OfficialEligibleVersion[];
          }>(`/api/research/${researchId}/official-copies`),
        ]);
      const response =
        documentsResult.status === "fulfilled" ? documentsResult.value : null;
      const workflow =
        workflowResult.status === "fulfilled" ? workflowResult.value : null;
      const archive =
        officialResult.status === "fulfilled" ? officialResult.value : null;
      if (!response && !archive) {
        const reason =
          documentsResult.status === "rejected"
            ? documentsResult.reason
            : officialResult.status === "rejected"
              ? officialResult.reason
              : null;
        throw reason || new Error("Unable to load this project's documents.");
      }
      setDocuments(response?.documents || []);
      setPermissions(response?.permissions || null);
      setWorkflowMilestones(workflow?.milestones || []);
      setActivity(workflow?.activity || []);
      setOfficialCopies(archive?.copies || []);
      setOfficialEligibleVersions(archive?.eligibleVersions || []);
      setOfficialPermissions(archive?.permissions || null);
      if (!response && archive) setActiveTab("official");
      setSelectedDocumentId((current) =>
        documentParam &&
        response?.documents.some((document) => document.id === documentParam)
          ? documentParam
          : response?.documents.some((document) => document.id === current)
            ? current
            : response?.documents[0]?.id || "",
      );
    } catch (error: any) {
      setDocuments([]);
      setPermissions(null);
      setWorkflowMilestones([]);
      setActivity([]);
      setOfficialCopies([]);
      setOfficialEligibleVersions([]);
      setOfficialPermissions(null);
      setPageError(error.message || "Unable to load this project's documents.");
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const response = await apiClient.get<{ projects: ResearchProject[] }>(
          "/api/research",
        );
        if (!active) return;
        const available = response.projects || [];
        setProjects(available);
        const contextualProject = available.find(
          (project) =>
            project.id === projectParam ||
            project.workflowInstance?.workflow?.stages?.some(
              (stage) =>
                stage.id === milestoneParam ||
                stage.tasks?.some((task) => task.id === taskParam),
            ) ||
            project.taskSubmissions?.some(
              (submission) =>
                submission.documentId === documentParam ||
                submission.documentVersionId === versionParam ||
                submission.attempts?.some(
                  (attempt) =>
                    attempt.documentId === documentParam ||
                    attempt.documentVersionId === versionParam,
                ),
            ),
        );
        if (contextualProject && contextualProject.id !== projectParam)
          selectProject(contextualProject.id, { replace: true });
        else if (!projectParam && available.length === 1)
          selectProject(available[0].id, { replace: true });
      } catch (error: any) {
        if (active)
          setPageError(
            error.message || "Unable to load your research projects.",
          );
      } finally {
        if (active) setLoadingProjects(false);
      }
    };
    loadProjects();
    return () => {
      active = false;
    };
  }, [documentParam, milestoneParam, projectParam, selectProject, taskParam, versionParam]);

  useEffect(() => {
    if (!activeProjectId) {
      setDocuments([]);
      setPermissions(null);
      setWorkflowMilestones([]);
      setActivity([]);
      setOfficialCopies([]);
      setOfficialEligibleVersions([]);
      setOfficialPermissions(null);
      setSelectedDocumentId("");
      return;
    }
    loadDocuments(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!versionParam || loadingDocuments) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`document-version-${versionParam}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [loadingDocuments, selectedDocumentId, versionParam]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(LEGACY_STORAGE_KEY) || "[]",
      );
      const receipts = JSON.parse(
        localStorage.getItem(IMPORT_RECEIPTS_KEY) || "[]",
      );
      setLegacyDocuments(Array.isArray(stored) ? stored : []);
      setImportReceipts(Array.isArray(receipts) ? receipts : []);
    } catch {
      setLegacyDocuments([]);
      setImportReceipts([]);
    }
  }, []);

  useEffect(() => {
    if (!isLinkOpen) return;
    const contextualStage = stages.find(
      (stage) =>
        stage.id === milestoneParam ||
        stage.tasks?.some((task) => task.id === taskParam),
    );
    if (contextualStage) {
      setLinkMilestoneId(contextualStage.id);
      const task = contextualStage.tasks?.find((item) => item.id === taskParam);
      if (!linkTitle) setLinkTitle(task?.title || contextualStage.name);
    }
  }, [isLinkOpen, linkTitle, milestoneParam, stages, taskParam]);

  const contextualMilestoneId = () =>
    stages.find(
      (stage) =>
        stage.id === milestoneParam ||
        stage.tasks?.some((task) => task.id === taskParam),
    )?.id || "";

  const openCreateDialog = () => {
    setCreateTitle("");
    setCreateMilestoneId(contextualMilestoneId());
    setCreateError("");
    setIsCreateOpen(true);
  };

  const openUploadDialog = () => {
    setUploadTitle("");
    setUploadMilestoneId(contextualMilestoneId());
    setUploadFile(null);
    setUploadError("");
    setIsUploadOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedDocument?.liveDocumentUrl) return;
    setEditTitle(selectedDocument.title);
    setEditUrl(selectedDocument.liveDocumentUrl);
    setEditMilestoneId(selectedDocument.milestoneId || "");
    setEditError("");
    setIsEditOpen(true);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 5000);
  };

  const linkDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProjectId) return;
    setSavingLink(true);
    setLinkError("");
    try {
      const response = await apiClient.post<{
        document: WorkspaceDocument;
        duplicate: boolean;
      }>(`/api/research/${activeProjectId}/documents/live`, {
        title: linkTitle,
        url: linkUrl,
        milestoneId: linkMilestoneId || null,
      });
      await loadDocuments(activeProjectId);
      setSelectedDocumentId(response.document.id);
      setIsLinkOpen(false);
      setLinkTitle("");
      setLinkUrl("");
      setLinkMilestoneId("");
      showNotice(
        response.duplicate
          ? "That Google document was already linked."
          : "Google document linked to the project workspace.",
      );
    } catch (error: any) {
      setLinkError(error.message || "Unable to link the Google document.");
    } finally {
      setSavingLink(false);
    }
  };

  const createGoogleDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProjectId) return;
    setCreatingGoogleDocument(true);
    setCreateError("");
    try {
      const response = await apiClient.post<{ document: WorkspaceDocument }>(
        `/api/research/${activeProjectId}/documents/google`,
        {
          title: createTitle,
          milestoneId: createMilestoneId || null,
        },
      );
      await loadDocuments(activeProjectId);
      setSelectedDocumentId(response.document.id);
      setIsCreateOpen(false);
      showNotice("Google document created and added to the project workspace.");
    } catch (error: any) {
      setCreateError(error.message || "Unable to create the Google document.");
    } finally {
      setCreatingGoogleDocument(false);
    }
  };

  const uploadWorkingDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProjectId || !uploadFile) return;
    setUploadingDocument(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.set("title", uploadTitle);
      form.set("documentType", "UPLOADED_WORKING_COPY");
      if (uploadMilestoneId) form.set("milestoneId", uploadMilestoneId);
      form.set("file", uploadFile);
      const response = await apiClient.upload<{
        document: WorkspaceDocument;
      }>(`/api/research/${activeProjectId}/documents`, form);
      await loadDocuments(activeProjectId);
      setSelectedDocumentId(response.document.id);
      setIsUploadOpen(false);
      showNotice("Working document uploaded to the project workspace.");
    } catch (error: any) {
      setUploadError(error.message || "Unable to upload the document.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const editLiveDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDocument) return;
    setEditingDocument(true);
    setEditError("");
    try {
      await apiClient.patch(`/api/documents/${selectedDocument.id}/live`, {
        title: editTitle,
        url: editUrl,
        milestoneId: editMilestoneId || null,
      });
      await loadDocuments(activeProjectId);
      setIsEditOpen(false);
      showNotice("Document details updated.");
    } catch (error: any) {
      setEditError(error.message || "Unable to update the document.");
    } finally {
      setEditingDocument(false);
    }
  };

  const updateMilestone = async (documentId: string, milestoneId: string) => {
    try {
      await apiClient.patch(`/api/documents/${documentId}/live`, {
        milestoneId: milestoneId || null,
      });
      await loadDocuments(activeProjectId);
      showNotice("Document milestone updated.");
    } catch (error: any) {
      setPageError(error.message || "Unable to update the document milestone.");
    }
  };

  const importLegacyDocuments = async () => {
    if (!activeProjectId || !importableLegacyDocuments.length) return;
    setImporting(true);
    setPageError("");
    const nextReceipts = [...importReceipts];
    let imported = 0;
    let duplicates = 0;
    const failures: string[] = [];

    for (const legacy of importableLegacyDocuments) {
      const key = legacyKey(legacy);
      const url = legacy.directUrl || legacy.docUrl || "";
      try {
        const response = await apiClient.post<{
          document: WorkspaceDocument;
          duplicate: boolean;
        }>(`/api/research/${activeProjectId}/documents/live`, {
          title: legacy.title!.trim(),
          url,
          milestoneId: milestoneForLegacy(legacy, stages) || null,
        });
        nextReceipts.push({
          legacyKey: key,
          researchId: activeProjectId,
          documentId: response.document.id,
          importedAt: new Date().toISOString(),
        });
        if (response.duplicate) duplicates += 1;
        else imported += 1;
        localStorage.setItem(IMPORT_RECEIPTS_KEY, JSON.stringify(nextReceipts));
      } catch (error: any) {
        failures.push(
          `${legacy.title || "Untitled document"}: ${error.message || "Import failed"}`,
        );
      }
    }

    setImportReceipts(nextReceipts);
    await loadDocuments(activeProjectId);
    setImporting(false);
    const result = `${imported} imported${duplicates ? `, ${duplicates} already present` : ""}`;
    if (failures.length)
      setPageError(
        `${result}. ${failures.length} failed: ${failures.join("; ")}`,
      );
    else
      showNotice(
        `${result}. The original browser records were kept as a backup.`,
      );
  };

  const openStoredFile = async (version: DocumentVersion, download = false) => {
    if (!version.webViewLink) return;
    try {
      const blob = await apiClient.file(version.webViewLink);
      const objectUrl = URL.createObjectURL(blob);
      if (download) {
        const link = window.document.createElement("a");
        link.href = objectUrl;
        link.download = version.fileName;
        link.click();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: any) {
      setPageError(error.message || "Unable to open the stored document.");
    }
  };

  const openOfficialArtifact = async (
    fileUrl: string | null | undefined,
    fileName: string,
    download = false,
  ) => {
    if (!fileUrl) return;
    try {
      const blob = await apiClient.file(
        download ? `${fileUrl}?download=1` : fileUrl,
      );
      const objectUrl = URL.createObjectURL(blob);
      if (download) {
        const link = window.document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        link.click();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: any) {
      setPageError(error.message || "Unable to open the official document.");
    }
  };

  const finalizeOfficialCopy = async (version: { id: string }) => {
    setFinalizingVersionId(version.id);
    setPageError("");
    try {
      const response = await apiClient.post<{ duplicate: boolean }>(
        `/api/documents/versions/${version.id}/official-copy`,
        {},
      );
      await loadDocuments(activeProjectId);
      showNotice(
        response.duplicate
          ? "This approved version was already archived. No duplicate was created."
          : "The approved version was finalized as an immutable official copy.",
      );
    } catch (error: any) {
      setPageError(error.message || "Unable to finalize this manuscript.");
    } finally {
      setFinalizingVersionId("");
    }
  };

  const verifyOfficialArtifact = async (
    copy: OfficialCopy,
    signature?: OfficialCopySignature,
  ) => {
    const artifactId = signature?.id || copy.id;
    setVerifyingArtifactId(artifactId);
    setPageError("");
    try {
      const result = await apiClient.post<{
        matches: boolean;
        statement: string;
      }>(`/api/official-copies/${copy.id}/verify`, {
        signatureId: signature?.id,
      });
      if (!result.matches)
        setPageError(
          "Integrity verification failed. Do not rely on or redistribute this artifact until an authorized records officer reviews it.",
        );
      else showNotice(`Integrity verified. ${result.statement}`);
    } catch (error: any) {
      setPageError(error.message || "Unable to verify this official copy.");
    } finally {
      setVerifyingArtifactId("");
    }
  };

  const officialCopySigned = async (
    _message: string,
    _result: DocumentSigningResult,
  ) => {
    setSigningOfficialCopy(null);
    await loadDocuments(activeProjectId);
    showNotice(
      "A separate account-authenticated visually signed PDF was archived. The original official copy remains unchanged.",
    );
  };

  const revokeOfficialCopy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!revocationTarget || !revocationReason.trim()) return;
    setRevoking(true);
    setPageError("");
    try {
      await apiClient.patch(
        `/api/official-copies/${revocationTarget.id}/revoke`,
        { reason: revocationReason.trim() },
      );
      setRevocationTarget(null);
      setRevocationReason("");
      await loadDocuments(activeProjectId);
      showNotice(
        "The official copy was revoked without deleting its archival or audit history.",
      );
    } catch (error: any) {
      setPageError(error.message || "Unable to revoke this official copy.");
    } finally {
      setRevoking(false);
    }
  };

  const openSubmission = () => {
    if (!selectedDocument) return;
    const contextualStage = stages.find(
      (stage) =>
        stage.id === milestoneParam ||
        stage.tasks?.some((task) => task.id === taskParam),
    );
    const milestoneId =
      selectedDocument.milestoneId || contextualStage?.id || "";
    const selectedStage = stages.find((stage) => stage.id === milestoneId);
    const contextualTask = selectedStage?.tasks?.find(
      (task) => task.id === taskParam,
    );
    setSubmissionMilestoneId(milestoneId);
    setSubmissionTaskId(
      contextualTask?.id ||
        (selectedStage?.tasks?.length === 1 ? selectedStage.tasks[0].id : ""),
    );
    setSubmissionNote("");
    setSubmissionError("");
    setSubmissionKey(crypto.randomUUID());
    setIsSubmitOpen(true);
  };

  const submitManuscript = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDocument || !submissionMilestoneId || !submissionKey) return;
    setSubmitting(true);
    setSubmissionError("");
    try {
      const response = await apiClient.post<{
        version: DocumentVersion;
        duplicate: boolean;
      }>(`/api/documents/${selectedDocument.id}/submissions`, {
        milestoneId: submissionMilestoneId,
        taskId: submissionTaskId || null,
        idempotencyKey: submissionKey,
        note: submissionNote.trim() || null,
      });
      await loadDocuments(activeProjectId);
      setIsSubmitOpen(false);
      showNotice(
        response.duplicate
          ? "This submission was already recorded. No duplicate version was created."
          : `Version ${response.version.versionNumber} was frozen and submitted successfully.`,
      );
    } catch (error: any) {
      setSubmissionError(
        error.message || "Unable to create the manuscript snapshot.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    {
      id: "workspace",
      label: "My Files",
      icon: FolderKanban,
      badge: documents.length,
    },
    {
      id: "reviews",
      label: "Feedback History",
      icon: MessageSquareText,
      badge: reviewAssignments.length,
    },
    {
      id: "milestones",
      label: "Project Activity",
      icon: FileClock,
      badge: workflowMilestones.length,
    },
    {
      id: "official",
      label: "Official Copies",
      icon: ShieldCheck,
      badge: officialCopies.length,
    },
  ];

  if (loadingProjects) {
    return (
      <PageContainer>
        <Card>
          <ListRowsSkeleton rows={6} />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        variant="banner"
        category="Research workspace"
        title="Documents"
        subtitle="Create, organize, preview, and edit research files. Submit requirements through Tasks."
        actions={
          permissions?.canManageWorkingDocuments ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                icon={<Upload className="h-4 w-4" />}
                onClick={openUploadDialog}
                disabled={!activeProjectId}
              >
                Upload file
              </Button>
              <Button
                variant="secondary"
                icon={<LinkIcon className="h-4 w-4" />}
                onClick={() => setIsLinkOpen(true)}
                disabled={!activeProjectId}
              >
                Link existing
              </Button>
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={openCreateDialog}
                disabled={!activeProjectId}
              >
                New Google Doc
              </Button>
            </div>
          ) : undefined
        }
      />

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </div>
      )}
      {pageError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-xl">
            <label
              htmlFor="research-project"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-secondary)]"
            >
              Research project
            </label>
            <select
              id="research-project"
              value={activeProjectId}
              onChange={(event) => selectProject(event.target.value || null)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            >
              <option value="">
                {projects.length > 1
                  ? "Choose a research project"
                  : "No research project selected"}
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.groupName ? `${project.groupName} — ` : ""}
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          <p className="max-w-lg text-xs leading-5 text-[var(--color-text-secondary)]">
            Your research files live here. Open the working copy to edit it, then use Tasks
            when you are ready to submit a required deliverable.
          </p>
        </div>
      </Card>

      {!activeProjectId ? (
        <EmptyState
          icon={FolderKanban}
          title={
            projects.length
              ? "Select a research project"
              : "No research projects available"
          }
          description={
            invalidRequestedProjectId
              ? "The requested project is unavailable or you do not have access to it. Select one of your authorized projects."
              : projects.length
              ? "Choose the project whose document workspace you want to open. Advisio will not assume a project when you belong to more than one."
              : "Join or create a research project before linking project-owned documents."
          }
        />
      ) : (
        <>
          {importableLegacyDocuments.length > 0 &&
            permissions?.canManageWorkingDocuments && (
              <Card className="border-[var(--color-primary)]/25 bg-[var(--color-primary-light)]/35 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-primary)]">
                      <Import className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">
                        Import browser-linked documents
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                        {importableLegacyDocuments.length} valid browser record
                        {importableLegacyDocuments.length === 1 ? "" : "s"} can
                        be copied into{" "}
                        {activeProject?.groupName || activeProject?.title}. The
                        original local records will remain untouched until you
                        verify the import.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Import className="h-4 w-4" />}
                    isLoading={importing}
                    onClick={importLegacyDocuments}
                  >
                    Import to selected project
                  </Button>
                </div>
              </Card>
            )}

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => { setActiveTab("workspace"); setFileFilter("all"); }}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)]"
            >
              <span className="rounded-lg bg-[var(--color-primary-light)] p-2.5 text-[var(--color-primary)]"><FolderKanban className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold text-[var(--color-text-primary)]">All research files</span><span className="text-xs text-[var(--color-text-secondary)]">{documents.length} documents</span></span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("workspace"); setFileFilter("working"); }}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)]"
            >
              <span className="rounded-lg bg-[var(--color-primary-light)] p-2.5 text-[var(--color-primary)]"><FileText className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold text-[var(--color-text-primary)]">Working documents</span><span className="text-xs text-[var(--color-text-secondary)]">{documents.filter((document) => Boolean(document.liveDocumentUrl)).length} editable links</span></span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("workspace"); setFileFilter("uploaded"); }}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)]"
            >
              <span className="rounded-lg bg-[var(--color-primary-light)] p-2.5 text-[var(--color-primary)]"><Upload className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold text-[var(--color-text-primary)]">Uploaded files</span><span className="text-xs text-[var(--color-text-secondary)]">{documents.filter((document) => !document.liveDocumentUrl).length} stored items</span></span>
            </button>
          </div>

          <Card className="p-0 overflow-hidden">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="px-3 sm:px-5"
            />

            {loadingDocuments ? (
              <div className="p-6">
                <ListRowsSkeleton rows={5} />
              </div>
            ) : activeTab === "workspace" ? (
              <div className="grid min-h-[620px] xl:grid-cols-[360px_minmax(0,1fr)]">
                <aside className="border-b border-[var(--color-border)] p-4 xl:border-b-0 xl:border-r sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Research files
                    </h2>
                    <Tag variant="neutral">{visibleDocuments.length}</Tag>
                  </div>
                  <div className="mb-4 space-y-2">
                    <div className="relative">
                      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--color-text-secondary)]" />
                      <label htmlFor="document-search" className="sr-only">Search research files</label>
                      <input
                        id="document-search"
                        type="search"
                        value={fileSearch}
                        onChange={(event) => setFileSearch(event.target.value)}
                        placeholder="Search files..."
                        className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label htmlFor="document-type-filter" className="sr-only">File type</label>
                      <select
                        id="document-type-filter"
                        value={fileFilter}
                        onChange={(event) => setFileFilter(event.target.value as "all" | "working" | "uploaded")}
                        className="h-10 min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs font-medium text-[var(--color-text-primary)]"
                      >
                        <option value="all">All files</option>
                        <option value="working">Google Docs</option>
                        <option value="uploaded">Uploads</option>
                      </select>
                      <label htmlFor="document-sort" className="sr-only">Sort files</label>
                      <select
                        id="document-sort"
                        value={fileSort}
                        onChange={(event) => setFileSort(event.target.value as "recent" | "name")}
                        className="h-10 min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs font-medium text-[var(--color-text-primary)]"
                      >
                        <option value="recent">Recently updated</option>
                        <option value="name">File name</option>
                      </select>
                    </div>
                  </div>
                  {documents.length === 0 ? (
                    <EmptyState
                      size="sm"
                      className="p-6"
                      icon={FileText}
                      title="No project documents"
                      description="Create, link, or upload a real project document to begin this workspace."
                      action={
                        permissions?.canManageWorkingDocuments ? (
                          <Button
                            size="sm"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={openCreateDialog}
                          >
                            New Google Doc
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : visibleDocuments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-center text-sm text-[var(--color-text-secondary)]">
                      No files match your search or filter.
                      <button
                        type="button"
                        onClick={() => { setFileSearch(""); setFileFilter("all"); }}
                        className="mt-2 block w-full font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleDocuments.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          onClick={() => setSelectedDocumentId(document.id)}
                          className={`w-full rounded-xl border p-3 text-left transition ${selectedDocumentId === document.id ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:border-[var(--color-border-strong)]"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-primary)]">
                              {document.liveDocumentUrl ? (
                                <LinkIcon className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                {document.title}
                              </span>
                              <span className="mt-1 block truncate text-xs text-[var(--color-text-secondary)]">
                                {document.milestone
                                  ? `${document.milestone.sequence}. ${document.milestone.name}`
                                  : "No milestone"}
                              </span>
                              <span className="mt-2 flex items-center gap-2">
                                <Tag
                                  size="xs"
                                  variant={
                                    document.liveDocumentUrl
                                      ? "info"
                                      : "neutral"
                                  }
                                >
                                  {document.liveDocumentUrl
                                    ? "Live"
                                    : `${document.versions.length} version${document.versions.length === 1 ? "" : "s"}`}
                                </Tag>
                                <Tag
                                  size="xs"
                                  variant={lifecycleVariant(
                                    document.lifecycleStatus,
                                  )}
                                >
                                  {lifecycleLabels[document.lifecycleStatus]}
                                </Tag>
                              </span>
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </aside>

                <section className="min-w-0 bg-[var(--color-surface-subtle)]">
                  {selectedDocument ? (
                    <div className="flex h-full min-h-[620px] flex-col">
                      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                              {selectedDocument.title}
                            </h2>
                            <Tag
                              variant={
                                selectedDocument.liveDocumentUrl
                                  ? "info"
                                  : "neutral"
                              }
                            >
                              {selectedDocument.liveDocumentUrl
                                ? "Live working copy"
                                : "Stored version"}
                            </Tag>
                            <Tag
                              variant={lifecycleVariant(
                                selectedDocument.lifecycleStatus,
                              )}
                            >
                              {
                                lifecycleLabels[
                                  selectedDocument.lifecycleStatus
                                ]
                              }
                            </Tag>
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Updated {formatDate(selectedDocument.updatedAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedDocument.liveDocumentUrl &&
                            permissions?.canManageWorkingDocuments && (
                              <select
                                aria-label="Document milestone"
                                value={selectedDocument.milestoneId || ""}
                                onChange={(event) =>
                                  updateMilestone(
                                    selectedDocument.id,
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                              >
                                <option value="">No milestone</option>
                                {stages.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.sequence}. {stage.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          {selectedDocument.liveDocumentUrl && (
                            <a
                              href={selectedDocument.liveDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                            >
                              <ExternalLink className="h-4 w-4" /> Open in
                              Google
                            </a>
                          )}
                          {selectedDocument.liveDocumentUrl &&
                            permissions?.canManageWorkingDocuments && (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Pencil className="h-4 w-4" />}
                                onClick={openEditDialog}
                              >
                                Edit details
                              </Button>
                            )}
                          {selectedDocument.liveDocumentUrl &&
                            permissions?.canSubmitManuscript &&
                            ["DRAFT", "REVISION_REQUIRED"].includes(
                              selectedDocument.lifecycleStatus,
                            ) && (
                              <Button
                                size="sm"
                                icon={<Send className="h-4 w-4" />}
                                onClick={() => {
                                  if (taskParam) {
                                    openSubmission();
                                    return;
                                  }
                                  const params = new URLSearchParams({ projectId: activeProjectId });
                                  window.location.href = `/student/tasks?${params.toString()}`;
                                }}
                              >
                                {taskParam ? "Submit manuscript" : "Submit via Tasks"}
                              </Button>
                            )}
                        </div>
                      </div>
                      {selectedDocument.liveDocumentUrl ? (
                        <div className="flex flex-1 flex-col">
                          <iframe
                            src={getEmbedUrl(selectedDocument.liveDocumentUrl)}
                            title={selectedDocument.title}
                            className="min-h-[540px] w-full flex-1 bg-white"
                            allow="clipboard-write"
                          />
                          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 sm:p-6">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <h3 className="text-sm font-extrabold text-[var(--color-text-primary)]">
                                  Previous submitted versions
                                </h3>
                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                  Frozen PDFs remain unchanged while the Google
                                  working copy stays editable.
                                </p>
                              </div>
                              <Tag variant="neutral">
                                {
                                  selectedDocument.versions.filter(
                                    (version) => version.isImmutable,
                                  ).length
                                }{" "}
                                versions
                              </Tag>
                            </div>
                            {selectedDocument.versions.some(
                              (version) => version.isImmutable,
                            ) ? (
                              <div className="space-y-3">
                                {selectedDocument.versions
                                  .filter((version) => version.isImmutable)
                                  .map((version) => (
                                    <div
                                      key={version.id}
                                      id={`document-version-${version.id}`}
                                      className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                            Version {version.versionNumber}
                                          </p>
                                          {version.manuscriptStatus && (
                                            <Tag
                                              size="xs"
                                              variant={lifecycleVariant(
                                                version.manuscriptStatus,
                                              )}
                                            >
                                              {
                                                lifecycleLabels[
                                                  version.manuscriptStatus
                                                ]
                                              }
                                            </Tag>
                                          )}
                                        </div>
                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                          {version.milestone
                                            ? `${version.milestone.sequence}. ${version.milestone.name}`
                                            : "Milestone unavailable"}
                                          {" · "}
                                          {formatDate(
                                            version.submittedAt ||
                                              version.uploadedAt,
                                          )}
                                          {version.submitter
                                            ? ` · ${version.submitter.firstName} ${version.submitter.lastName}`
                                            : ""}
                                        </p>
                                        {version.contentChecksum && (
                                          <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-text-secondary)]">
                                            SHA-256 {version.contentChecksum}
                                          </p>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        icon={
                                          <ExternalLink className="h-4 w-4" />
                                        }
                                        onClick={() => openStoredFile(version)}
                                      >
                                        Open snapshot
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-text-secondary)]">
                                No formal manuscript version has been submitted
                                yet.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : selectedDocument.versions.length ? (
                        <div className="p-5 sm:p-6">
                          <div className="space-y-3">
                            {selectedDocument.versions.map((version) => (
                              <div
                                key={version.id}
                                id={`document-version-${version.id}`}
                                className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                    {version.fileName}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Version {version.versionNumber} ·{" "}
                                    {formatDate(version.uploadedAt)}
                                  </p>
                                </div>
                                {version.webViewLink && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={<ExternalLink className="h-4 w-4" />}
                                    onClick={() => openStoredFile(version)}
                                  >
                                    Open
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          className="m-6"
                          icon={History}
                          title="No frozen versions"
                          description="This document does not have a stored or formally submitted version yet."
                        />
                      )}
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="flex h-full min-h-[360px] flex-col items-center justify-center p-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] mb-3">
                        <FileText className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                        Workspace Ready
                      </h3>
                      <p className="mt-1 max-w-sm text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                        Create or link a document from the left panel to begin reviewing drafts, tracking versions, and submitting manuscripts.
                      </p>
                    </div>
                  ) : (
                    <EmptyState
                      className="m-6 min-h-[360px]"
                      icon={FileText}
                      title="Select a document"
                      description="Choose a project document to open its live workspace or stored versions."
                    />
                  )}
                </section>
              </div>
            ) : activeTab === "reviews" ? (
              <div className="p-5 sm:p-6">
                {reviewAssignments.length ? (
                  <div className="space-y-3">
                    {reviewAssignments.map(
                      ({ document, version, assignment }) => (
                        <div
                          key={assignment.id}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-extrabold text-[var(--color-text-primary)]">
                                {document.title} · v{version.versionNumber}
                              </p>
                              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {assignment.reviewType.replace(/_/g, " ")}{" "}
                                review
                                {assignment.isRequired
                                  ? " · Required"
                                  : " · Optional"}
                              </p>
                            </div>
                            <Tag
                              variant={
                                assignment.status === "COMPLETED"
                                  ? "success"
                                  : assignment.status === "ACTIVE"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {assignment.status.replace(/_/g, " ")}
                            </Tag>
                          </div>
                          {assignment.review?.overallComment && (
                            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                              {assignment.review.overallComment}
                            </p>
                          )}
                          {assignment.review?.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-secondary)]"
                            >
                              {(comment.locationData?.section ||
                                comment.locationData?.page) && (
                                <p className="mb-1 text-xs font-bold text-[var(--color-text-primary)]">
                                  {[
                                    comment.locationData.section,
                                    comment.locationData.page
                                      ? `Page ${comment.locationData.page}`
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                              {comment.comment}
                            </div>
                          ))}
                          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                            {assignment.review?.recommendation
                              ? `Decision: ${assignment.review.recommendation.replace(/_/g, " ")} · `
                              : ""}
                            {assignment.status === "ACTIVE"
                              ? "Awaiting assigned faculty decision"
                              : formatDate(
                                  assignment.completedAt ||
                                    assignment.review?.submittedAt,
                                )}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={MessageSquareText}
                    title="No document reviews yet"
                    description="Review assignments and faculty feedback will appear here after a formal manuscript version is submitted."
                  />
                )}
              </div>
            ) : activeTab === "milestones" ? (
              <div className="space-y-6 p-5 sm:p-6">
                {workflowMilestones.length ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {workflowMilestones.map((milestone) => {
                        const stageDocuments = documents.filter(
                          (document) => document.milestoneId === milestone.id,
                        );
                        return (
                          <section
                            key={milestone.id}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-sm font-black text-[var(--color-primary)]">
                                  {milestone.sequence}
                                </span>
                                <div className="min-w-0">
                                  <h3 className="truncate text-sm font-extrabold text-[var(--color-text-primary)]">
                                    {milestone.name}
                                  </h3>
                                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                                    {milestone.completedRequirements} of{" "}
                                    {milestone.totalRequirements} mandatory
                                    requirements complete
                                  </p>
                                </div>
                              </div>
                              <Tag variant={milestoneVariant(milestone.status)}>
                                {milestone.status.replace(/_/g, " ")}
                              </Tag>
                            </div>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                              <div
                                className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
                                style={{
                                  width: `${milestone.completionPercent}%`,
                                }}
                              />
                            </div>

                            <div className="mt-4 space-y-2">
                              {milestone.tasks.map((task) => (
                                <a
                                  key={task.id}
                                  href={`/student/tasks?projectId=${activeProjectId}&taskId=${task.id}`}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-xs transition hover:border-[var(--color-primary)]"
                                >
                                  <span className="min-w-0 truncate font-semibold text-[var(--color-text-primary)]">
                                    {task.title}
                                    {!task.isRequired ? " (optional)" : ""}
                                  </span>
                                  <span className="shrink-0 text-[11px] font-bold text-[var(--color-text-secondary)]">
                                    {task.status?.replace(/_/g, " ") ||
                                      "NOT STARTED"}
                                    {task.attempts.length
                                      ? ` · ${task.attempts.length} attempt${task.attempts.length === 1 ? "" : "s"}`
                                      : ""}
                                  </span>
                                </a>
                              ))}
                              {stageDocuments.map((document) => (
                                <button
                                  key={document.id}
                                  onClick={() => {
                                    setSelectedDocumentId(document.id);
                                    setActiveTab("workspace");
                                  }}
                                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                                >
                                  Open {document.title}
                                </button>
                              ))}
                              {!milestone.tasks.length &&
                                !stageDocuments.length && (
                                  <p className="text-xs text-[var(--color-text-secondary)]">
                                    No configured tasks or linked documents.
                                  </p>
                                )}
                            </div>
                          </section>
                        );
                      })}
                    </div>

                    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-extrabold text-[var(--color-text-primary)]">
                            Research activity
                          </h3>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Document, review, and milestone events from the
                            project record.
                          </p>
                        </div>
                        <a
                          href={`/student/dashboard?tab=milestones&projectId=${activeProjectId}`}
                          className="text-xs font-bold text-[var(--color-primary)] hover:underline"
                        >
                          Open project timeline
                        </a>
                      </div>
                      {activity.length ? (
                        <ol className="mt-4 space-y-3">
                          {activity.map((event) => (
                            <li key={event.id} className="flex gap-3">
                              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-primary)] ring-4 ring-[var(--color-primary-light)]" />
                              <div className="min-w-0 border-b border-[var(--color-border)] pb-3 last:border-0">
                                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                  {event.title}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                                  {event.description}
                                </p>
                                <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                  {event.actor?.name
                                    ? `${event.actor.name} · `
                                    : ""}
                                  {formatDate(event.timestamp)}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-text-secondary)]">
                          No manuscript activity has been recorded for this
                          project yet.
                        </p>
                      )}
                    </section>
                  </>
                ) : (
                  <EmptyState
                    icon={FileClock}
                    title="No workflow milestones"
                    description="This project does not currently have an assigned milestone workflow."
                  />
                )}
              </div>
            ) : (
              <div className="space-y-5 p-5 sm:p-6">
                {officialPermissions?.canFinalize &&
                  officialEligibleVersions.length > 0 && (
                    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-100">
                            Approved versions awaiting finalization
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                            Finalization archives the exact approved PDF without
                            replacing its submitted version or changing defense
                            history.
                          </p>
                          <div className="mt-3 space-y-2">
                            {officialEligibleVersions.map((version) => (
                              <div
                                key={version.id}
                                className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white/80 p-3 dark:border-amber-500/20 dark:bg-slate-950/20 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                    {version.document.title}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Approved immutable version{" "}
                                    {version.versionNumber}
                                    {version.milestone?.name
                                      ? ` · ${version.milestone.name}`
                                      : ""}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  isLoading={finalizingVersionId === version.id}
                                  disabled={Boolean(finalizingVersionId)}
                                  icon={<Archive className="h-4 w-4" />}
                                  onClick={() =>
                                    void finalizeOfficialCopy(version)
                                  }
                                >
                                  Finalize & archive
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                {officialCopies.length ? (
                  <div className="space-y-3">
                    {officialCopies.map((copy) => {
                      const latestSignature = copy.signatures.find(
                        (signature) => signature.status === "ACTIVE",
                      );
                      const document = { title: copy.title };
                      const version: DocumentVersion = {
                        id: copy.id,
                        versionNumber: copy.sourceVersion.versionNumber,
                        fileName: copy.fileName,
                        mimeType: "application/pdf",
                        webViewLink: copy.fileUrl || undefined,
                        uploadedAt: copy.finalizedAt,
                        reviews: [],
                        signedSignature: latestSignature
                          ? {
                              signedAt: latestSignature.signedAt,
                              sourceVersionId: copy.sourceVersionId,
                              verificationCode:
                                latestSignature.verificationCode,
                              revokedAt: latestSignature.revokedAt,
                              signedBy: latestSignature.signedBy,
                            }
                          : null,
                      };
                      return (
                        <div
                          key={version.id}
                          className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <FileCheck2 className="h-5 w-5" />
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-extrabold text-[var(--color-text-primary)]">
                                  {document.title}
                                </p>
                                <Tag
                                  size="xs"
                                  variant={
                                    copy.status === "ACTIVE"
                                      ? "success"
                                      : copy.status === "REVOKED"
                                        ? "warning"
                                        : "neutral"
                                  }
                                >
                                  {copy.status}
                                </Tag>
                              </div>
                              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Finalized by {copy.finalizedBy.firstName}{" "}
                                {copy.finalizedBy.lastName} ·{" "}
                                {formatDate(copy.finalizedAt)} · Source version{" "}
                                {copy.sourceVersion.versionNumber}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                Verification code: {copy.verificationCode}
                              </p>
                              <p className="mt-1 break-all font-mono text-[10px] text-[var(--color-text-secondary)]">
                                SHA-256 {copy.checksum}
                              </p>
                              {latestSignature && (
                                <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
                                  Visually signed by{" "}
                                  {latestSignature.signedBy.firstName}{" "}
                                  {latestSignature.signedBy.lastName} ·{" "}
                                  {formatDate(latestSignature.signedAt)} ·{" "}
                                  {latestSignature.verificationCode}
                                </p>
                              )}
                              {copy.revocationReason && (
                                <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                                  Revoked: {copy.revocationReason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<ExternalLink className="h-4 w-4" />}
                              onClick={() => openStoredFile(version)}
                            >
                              Open
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Download className="h-4 w-4" />}
                              onClick={() => openStoredFile(version, true)}
                            >
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              isLoading={verifyingArtifactId === copy.id}
                              icon={<ShieldCheck className="h-4 w-4" />}
                              onClick={() => void verifyOfficialArtifact(copy)}
                            >
                              Verify integrity
                            </Button>
                            {copy.canSign && (
                              <Button
                                size="sm"
                                onClick={() => setSigningOfficialCopy(copy)}
                              >
                                Add signature
                              </Button>
                            )}
                            {officialPermissions?.canRevoke &&
                              copy.status === "ACTIVE" && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setRevocationTarget(copy);
                                    setRevocationReason("");
                                  }}
                                >
                                  Revoke
                                </Button>
                              )}
                          </div>
                          <div className="grid basis-full gap-4 border-t border-[var(--color-border)] pt-4 lg:grid-cols-2">
                            <section>
                              <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Academic approval history
                              </h4>
                              <div className="mt-2 space-y-2">
                                {copy.sourceVersion.reviewerAssignments.map(
                                  (assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                                    >
                                      <p className="text-xs font-bold text-[var(--color-text-primary)]">
                                        {assignment.reviewType.replace(
                                          /_/g,
                                          " ",
                                        )}{" "}
                                        ·{" "}
                                        {assignment.review?.recommendation ||
                                          assignment.status}
                                      </p>
                                      <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                        {assignment.reviewer
                                          ? `${assignment.reviewer.firstName} ${assignment.reviewer.lastName}`
                                          : "Assigned faculty"}
                                        {assignment.review?.submittedAt
                                          ? ` · ${formatDate(assignment.review.submittedAt)}`
                                          : ""}
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
                            </section>
                            <section>
                              <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Signed archival artifacts
                              </h4>
                              {copy.signatures.length ? (
                                <div className="mt-2 space-y-2">
                                  {copy.signatures.map((signature) => (
                                    <div
                                      key={signature.id}
                                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                                    >
                                      <p className="text-xs font-bold text-[var(--color-text-primary)]">
                                        {signature.signedBy.firstName}{" "}
                                        {signature.signedBy.lastName} ·{" "}
                                        {signature.signerRole.replace(
                                          /_/g,
                                          " ",
                                        )}
                                      </p>
                                      <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                        {formatDate(signature.signedAt)} ·{" "}
                                        {signature.verificationCode}
                                      </p>
                                      <p className="mt-1 text-[10px] leading-4 text-[var(--color-text-secondary)]">
                                        Account-authenticated visual signature;
                                        not a cryptographic digital signature.
                                      </p>
                                      <div className="mt-2 flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() =>
                                            void openOfficialArtifact(
                                              signature.fileUrl,
                                              signature.fileName,
                                            )
                                          }
                                        >
                                          Preview
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          isLoading={
                                            verifyingArtifactId === signature.id
                                          }
                                          onClick={() =>
                                            void verifyOfficialArtifact(
                                              copy,
                                              signature,
                                            )
                                          }
                                        >
                                          Verify
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                                  No visual signature artifact has been
                                  generated. The original official PDF remains
                                  unchanged.
                                </p>
                              )}
                            </section>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Archive}
                    title="No official copies yet"
                    description="An approved immutable manuscript appears here only after authorized finalization. No sample or placeholder records are shown."
                  />
                )}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal
        isOpen={isSubmitOpen}
        onClose={() => !submitting && setIsSubmitOpen(false)}
        title="Submit manuscript"
        subtitle="Create an immutable PDF snapshot of the current Google document."
      >
        <form onSubmit={submitManuscript} className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {selectedDocument?.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
              Advisio will verify and export the actual linked Google document.
              The submitted PDF and its SHA-256 checksum cannot be overwritten;
              your Google working copy remains editable for future revisions.
            </p>
          </div>
          <div>
            <label
              htmlFor="submission-milestone"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Manuscript milestone
            </label>
            <select
              id="submission-milestone"
              required
              value={submissionMilestoneId}
              onChange={(event) => {
                const milestoneId = event.target.value;
                const milestone = stages.find(
                  (stage) => stage.id === milestoneId,
                );
                setSubmissionMilestoneId(milestoneId);
                setSubmissionTaskId(
                  milestone?.tasks?.length === 1 ? milestone.tasks[0].id : "",
                );
                setSubmissionError("");
              }}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">Select a milestone</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.sequence}. {stage.name}
                </option>
              ))}
            </select>
          </div>
          {submissionStage?.tasks?.length ? (
            <div>
              <label
                htmlFor="submission-task"
                className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
              >
                Requirement
              </label>
              <select
                id="submission-task"
                required
                value={submissionTaskId}
                onChange={(event) => {
                  setSubmissionTaskId(event.target.value);
                  setSubmissionError("");
                }}
                className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">
                  Select the requirement this version satisfies
                </option>
                {submissionStage.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                This links the frozen version to the correct task without
                changing the live Google document.
              </p>
            </div>
          ) : null}
          <div>
            <label
              htmlFor="submission-note"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Submission note <span className="font-normal">(optional)</span>
            </label>
            <textarea
              id="submission-note"
              rows={4}
              maxLength={2000}
              value={submissionNote}
              onChange={(event) => setSubmissionNote(event.target.value)}
              className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
              placeholder="Optional context for your adviser or research professor"
            />
          </div>
          {submissionError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {submissionError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSubmitOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={<Send className="h-4 w-4" />}
              isLoading={submitting}
              disabled={
                !submissionMilestoneId ||
                Boolean(submissionStage?.tasks?.length && !submissionTaskId)
              }
            >
              Freeze and submit
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => !creatingGoogleDocument && setIsCreateOpen(false)}
        title="Create Google document"
        subtitle="Create a live editable draft inside this project's managed Google Drive workspace."
      >
        <form onSubmit={createGoogleDocument} className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">
            Advisio will create the document in the selected project's working
            folder and grant your signed-in email editor access. This is a live
            draft, not a formal submission.
          </div>
          <div>
            <label
              htmlFor="create-document-title"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Document title
            </label>
            <input
              id="create-document-title"
              required
              minLength={2}
              maxLength={255}
              autoFocus
              value={createTitle}
              onChange={(event) => {
                setCreateTitle(event.target.value);
                setCreateError("");
              }}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
              placeholder="Research manuscript"
            />
          </div>
          <div>
            <label
              htmlFor="create-document-milestone"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Milestone
            </label>
            <select
              id="create-document-milestone"
              value={createMilestoneId}
              onChange={(event) => setCreateMilestoneId(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            >
              <option value="">No milestone</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.sequence}. {stage.name}
                </option>
              ))}
            </select>
          </div>
          {createError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {createError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              disabled={creatingGoogleDocument}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={<Plus className="h-4 w-4" />}
              isLoading={creatingGoogleDocument}
            >
              Create document
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isUploadOpen}
        onClose={() => !uploadingDocument && setIsUploadOpen(false)}
        title="Upload working document"
        subtitle="Store a PDF, Word document, or plain-text file in this project's working folder."
      >
        <form onSubmit={uploadWorkingDocument} className="space-y-4">
          <div>
            <label
              htmlFor="upload-document-title"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Document title
            </label>
            <input
              id="upload-document-title"
              required
              minLength={2}
              maxLength={255}
              autoFocus
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
              placeholder="Supporting document"
            />
          </div>
          <div>
            <label
              htmlFor="upload-document-file"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              File
            </label>
            <input
              id="upload-document-file"
              required
              type="file"
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(event) => {
                setUploadFile(event.target.files?.[0] || null);
                setUploadError("");
              }}
              className="block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-primary-light)] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[var(--color-primary)]"
            />
            <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
              Maximum file size: 50 MB.
            </p>
          </div>
          <div>
            <label
              htmlFor="upload-document-milestone"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Milestone
            </label>
            <select
              id="upload-document-milestone"
              value={uploadMilestoneId}
              onChange={(event) => setUploadMilestoneId(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            >
              <option value="">No milestone</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.sequence}. {stage.name}
                </option>
              ))}
            </select>
          </div>
          {uploadError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {uploadError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsUploadOpen(false)}
              disabled={uploadingDocument}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={<Upload className="h-4 w-4" />}
              isLoading={uploadingDocument}
              disabled={!uploadFile}
            >
              Upload file
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditOpen}
        onClose={() => !editingDocument && setIsEditOpen(false)}
        title="Edit document details"
        subtitle="Update the workspace title, Google link, or milestone without changing submitted snapshots."
      >
        <form onSubmit={editLiveDocument} className="space-y-4">
          <div>
            <label
              htmlFor="edit-document-title"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Document title
            </label>
            <input
              id="edit-document-title"
              required
              minLength={2}
              maxLength={255}
              autoFocus
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="edit-document-url"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Google Docs or Drive link
            </label>
            <input
              id="edit-document-url"
              required
              type="url"
              value={editUrl}
              onChange={(event) => setEditUrl(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            />
          </div>
          <div>
            <label
              htmlFor="edit-document-milestone"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Milestone
            </label>
            <select
              id="edit-document-milestone"
              value={editMilestoneId}
              onChange={(event) => setEditMilestoneId(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            >
              <option value="">No milestone</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.sequence}. {stage.name}
                </option>
              ))}
            </select>
          </div>
          {editError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {editError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              disabled={editingDocument}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={<Pencil className="h-4 w-4" />}
              isLoading={editingDocument}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isLinkOpen}
        onClose={() => !savingLink && setIsLinkOpen(false)}
        title="Link Google document"
        subtitle="Save a live editable document as a project-owned workspace record."
      >
        <form onSubmit={linkDocument} className="space-y-4">
          <div>
            <label
              htmlFor="document-title"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Document title
            </label>
            <input
              id="document-title"
              required
              minLength={2}
              maxLength={255}
              value={linkTitle}
              onChange={(event) => setLinkTitle(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
              placeholder="Research manuscript"
            />
          </div>
          <div>
            <label
              htmlFor="document-url"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Google Docs or Drive link
            </label>
            <input
              id="document-url"
              required
              type="url"
              value={linkUrl}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError("");
              }}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
              placeholder="https://docs.google.com/document/d/.../edit"
            />
          </div>
          <div>
            <label
              htmlFor="document-milestone"
              className="mb-1.5 block text-xs font-bold text-[var(--color-text-primary)]"
            >
              Milestone
            </label>
            <select
              id="document-milestone"
              value={linkMilestoneId}
              onChange={(event) => setLinkMilestoneId(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">No milestone</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.sequence}. {stage.name}
                </option>
              ))}
            </select>
          </div>
          {linkError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {linkError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsLinkOpen(false)}
              disabled={savingLink}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={<LinkIcon className="h-4 w-4" />}
              isLoading={savingLink}
            >
              Save link
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(revocationTarget)}
        onClose={() => {
          if (revoking) return;
          setRevocationTarget(null);
          setRevocationReason("");
        }}
        title="Revoke official copy"
        subtitle="The record and file remain preserved for audit history, but the copy will no longer be active."
      >
        <form onSubmit={revokeOfficialCopy} className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
            Revocation cannot be used to delete or rewrite an academic record. A
            corrected approved version must be finalized as a separate official
            copy.
          </div>
          <label className="block text-xs font-bold text-[var(--color-text-primary)]">
            Revocation reason
            <textarea
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={revocationReason}
              onChange={(event) => setRevocationReason(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-rose-500"
              placeholder="Explain why this archival copy must no longer be treated as active."
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={revoking}
              onClick={() => setRevocationTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={revoking}
              disabled={revocationReason.trim().length < 10}
            >
              Revoke official copy
            </Button>
          </div>
        </form>
      </Modal>
      {signingOfficialCopy && signingOfficialCopy.fileUrl && (
        <DocumentSigningModal
          document={{
            versionId: signingOfficialCopy.id,
            docName: signingOfficialCopy.title,
            groupName:
              activeProject?.groupName ||
              activeProject?.title ||
              "Research project",
            fileUrl: signingOfficialCopy.fileUrl,
            signUrl: `/api/official-copies/${signingOfficialCopy.id}/sign`,
          }}
          onClose={() => setSigningOfficialCopy(null)}
          onSigned={(message, result) =>
            void officialCopySigned(message, result)
          }
        />
      )}
    </PageContainer>
  );
}
