export declare const InstitutionalRoles: {
    readonly RESEARCHER: "RESEARCHER";
    readonly ADVISER: "ADVISER";
    readonly PANELIST: "PANELIST";
    readonly RESEARCH_COORDINATOR: "RESEARCH_COORDINATOR";
    readonly RPO: "RPO";
    readonly REB: "REB";
    readonly VPAA: "VPAA";
    readonly SYSTEM_ADMIN: "SYSTEM_ADMIN";
};
export type InstitutionalRole = (typeof InstitutionalRoles)[keyof typeof InstitutionalRoles];
export declare const ProjectRoles: {
    readonly LEADER: "LEADER";
    readonly MEMBER: "MEMBER";
    readonly ADVISER: "ADVISER";
    readonly PANELIST: "PANELIST";
    readonly COORDINATOR: "COORDINATOR";
};
export type ProjectRole = (typeof ProjectRoles)[keyof typeof ProjectRoles];
//# sourceMappingURL=roles.d.ts.map