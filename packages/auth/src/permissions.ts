export const Permissions = {
  RESEARCH_VIEW: "research.view",
  RESEARCH_CREATE: "research.create",
  RESEARCH_EDIT: "research.edit",
  RESEARCH_SUBMIT: "research.submit",
  RESEARCH_ARCHIVE: "research.archive",
  RESEARCH_ASSIGN: "research.assign",

  WORKFLOW_VIEW: "workflow.view",
  WORKFLOW_CREATE: "workflow.create",
  WORKFLOW_EDIT: "workflow.edit",
  WORKFLOW_PUBLISH: "workflow.publish",

  FORM_VIEW: "form.view",
  FORM_CREATE: "form.create",
  FORM_EDIT: "form.edit",
  FORM_SUBMIT: "form.submit",
  FORM_APPROVE: "form.approve",

  DOCUMENT_VIEW: "document.view",
  DOCUMENT_UPLOAD: "document.upload",
  DOCUMENT_DOWNLOAD: "document.download",
  DOCUMENT_DELETE: "document.delete",

  EVALUATION_CREATE: "evaluation.create",
  EVALUATION_SUBMIT: "evaluation.submit",

  REB_REVIEW: "reb.review",
  REB_APPROVE: "reb.approve",
  REB_REJECT: "reb.reject",
  REB_REQUEST_REVISION: "reb.request_revision",
  REB_ISSUE_CERTIFICATE: "reb.issue_certificate",

  RPO_ASSIGN: "rpo.assign",
  RPO_MONITOR: "rpo.monitor",
  RPO_REPORT: "rpo.report",

  VPAA_VIEW: "vpaa.view",
  VPAA_APPROVE: "vpaa.approve",

  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  SYSTEM_CONFIGURE: "system.configure",
  AUDIT_VIEW: "audit.view",
  DASHBOARD_CONFIGURE: "dashboard.configure",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS = Object.values(Permissions);
