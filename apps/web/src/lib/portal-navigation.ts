export type PortalPrefix =
  | "/student"
  | "/adviser"
  | "/professor"
  | "/panelist"
  | "/admin"
  | "/system-admin";

export type PortalQuickLink = {
  id: string;
  label: string;
  subtitle: string;
  href: string;
};

export function portalPrefixForPath(pathname: string): PortalPrefix {
  if (pathname.startsWith("/system-admin")) return "/system-admin";
  if (pathname.startsWith("/adviser")) return "/adviser";
  if (pathname.startsWith("/professor")) return "/professor";
  if (pathname.startsWith("/panelist")) return "/panelist";
  if (pathname.startsWith("/admin")) return "/admin";
  return "/student";
}

const sharedFacultyLinks = (prefix: PortalPrefix): PortalQuickLink[] => [
  {
    id: "dashboard",
    label: "Overview Dashboard",
    subtitle: "Main academic workspace",
    href: `${prefix}/dashboard`,
  },
  {
    id: "reviews",
    label: "Document Reviews",
    subtitle: "Assigned manuscript reviews",
    href: `${prefix}/reviews`,
  },
  {
    id: "documents",
    label: "Document Workspace",
    subtitle: "Project documents and official copies",
    href: `${prefix}/documents`,
  },
  {
    id: "calendar",
    label: "Calendar",
    subtitle: "Academic schedules and deadlines",
    href: `${prefix}/calendar`,
  },
  {
    id: "messages",
    label: "Messages",
    subtitle: "Research communication",
    href: `${prefix}/inbox`,
  },
];

export function portalQuickLinks(
  pathname: string,
  roles: string[] = [],
): PortalQuickLink[] {
  const prefix = portalPrefixForPath(pathname);
  if (prefix === "/student") {
    return [
      {
        id: "dashboard",
        label: "Overview Dashboard",
        subtitle: "Main research workspace",
        href: "/student/dashboard",
      },
      {
        id: "tasks",
        label: "Research Tasks",
        subtitle: "Required deliverables and deadlines",
        href: "/student/tasks",
      },
      {
        id: "documents",
        label: "Document Workspace",
        subtitle: "Live drafts, reviews, and official copies",
        href: "/student/documents",
      },
      {
        id: "consultations",
        label: "Consultations",
        subtitle: "Adviser meetings and appointments",
        href: "/student/consultations",
      },
      {
        id: "calendar",
        label: "Calendar",
        subtitle: "Academic schedules and deadlines",
        href: "/student/calendar",
      },
      {
        id: "messages",
        label: "Messages",
        subtitle: "Research communication",
        href: "/student/inbox",
      },
    ];
  }
  if (prefix === "/system-admin") {
    return [
      {
        id: "dashboard",
        label: "System Administration",
        subtitle: "Users, integrations, and audit tools",
        href: "/system-admin/dashboard",
      },
      {
        id: "calendar",
        label: "Calendar",
        subtitle: "Institutional schedules",
        href: "/system-admin/calendar",
      },
      {
        id: "messages",
        label: "Messages",
        subtitle: "Institutional communication",
        href: "/system-admin/inbox",
      },
    ];
  }
  if (prefix === "/admin") {
    const links: PortalQuickLink[] = [
      {
        id: "dashboard",
        label: "Administration Dashboard",
        subtitle: "Research oversight workspace",
        href: "/admin/dashboard",
      },
      {
        id: "reviews",
        label: "Document Reviews",
        subtitle: "Authorized institutional reviews",
        href: "/admin/reviews",
      },
      {
        id: "calendar",
        label: "Calendar",
        subtitle: "Institutional schedules",
        href: "/admin/calendar",
      },
      {
        id: "messages",
        label: "Messages",
        subtitle: "Institutional communication",
        href: "/admin/inbox",
      },
    ];
    if (roles.some((role) => role === "RPO" || role === "VPAA")) {
      links.splice(2, 0, {
        id: "documents",
        label: "Official Documents",
        subtitle: "Authorized official research copies",
        href: "/admin/documents?tab=official",
      });
    }
    return links;
  }
  const links = sharedFacultyLinks(prefix);
  if (prefix === "/professor") {
    links.splice(3, 0, {
      id: "signatures",
      label: "Signature Center",
      subtitle: "Authorized document signature requests",
      href: "/professor/signatures",
    });
  }
  return links;
}
