export const InstitutionalRoles = {
  RESEARCHER: "RESEARCHER",
  ADVISER: "ADVISER",
  PANELIST: "PANELIST",
  RESEARCH_COORDINATOR: "RESEARCH_COORDINATOR",
  DEAN: "DEAN",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
} as const;

export type InstitutionalRole = (typeof InstitutionalRoles)[keyof typeof InstitutionalRoles];

export const ProjectRoles = {
  LEADER: "LEADER",
  MEMBER: "MEMBER",
  ADVISER: "ADVISER",
  PANELIST: "PANELIST",
  COORDINATOR: "COORDINATOR",
} as const;

export type ProjectRole = (typeof ProjectRoles)[keyof typeof ProjectRoles];
