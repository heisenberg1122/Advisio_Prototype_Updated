export const DATASET = "ADVISIO-PROGRAM-DEMO-V1";
export const DATASET_ID = "ad150d00-0000-4000-8000-000000000004";
export const DOMAIN = "demo.advisio.invalid";

export const PROGRAMS = [
  {
    code: "BSN",
    college: "CNP",
    label: "Nursing Research",
    method:
      "Descriptive nursing research using fictional respondents and simulated data.",
    titles: [
      "Clinical Preparation and Learning Confidence among Nursing Students",
      "Learning Support and Stress Management during Clinical Preparation",
    ],
    work: "Fictional data collection, analysis, and nursing manuscript completion",
  },
  {
    code: "BSA",
    college: "COA",
    label: "Accountancy Research",
    method:
      "Quantitative, qualitative, or mixed-method research. Workflow interpreted from the supplied COA interview; demonstration material only.",
    titles: [
      "Bookkeeping Practices among Community Microenterprises",
      "Digital Record Keeping Readiness among Small Retail Enterprises",
    ],
    work: "Data gathering, analysis, and remaining research chapters",
  },
  {
    code: "BSCPE",
    college: "CEA",
    label: "Computer Engineering Capstone",
    method:
      "Fictional engineering design, prototype development, and testing; a proposed demo workflow.",
    titles: [
      "Sensor-Based Campus Water Monitoring Prototype",
      "Low-Power Classroom Occupancy Monitoring Prototype",
    ],
    work: "Prototype implementation, test execution, and technical manuscript completion",
  },
  {
    code: "BEED",
    college: "SOE",
    label: "Education Qualitative Research",
    method:
      "Qualitative group research based on the supplied School of Education interview. Four members per group; onsite defense with separate presentation and manuscript evaluations.",
    titles: [
      "Teacher Experiences with Reading Support in Elementary Classrooms",
      "Classroom Feedback Practices and Learner Participation",
    ],
    work: "Fictional interviews, qualitative analysis, and manuscript completion",
  },
];

export function accounts() {
  return PROGRAMS.flatMap((program) =>
    [
      ["professor", "RESEARCH_COORDINATOR"],
      ["adviser", "ADVISER"],
      ["panel1", "PANELIST"],
      ["panel2", "PANELIST"],
      ["panel3", "PANELIST"],
      ["dean", "DEAN"],
      ...Array.from({ length: 8 }, (_, i) => [`student${i + 1}`, "RESEARCHER"]),
    ].map(([key, role]) => ({
      key,
      role,
      program: program.code,
      college: program.college,
      email: `demo.${program.code.toLowerCase()}.${key}@${DOMAIN}`,
      universityId: `DEMO4-${program.code}-${key.toUpperCase()}`,
    })),
  );
}

export function demoPassword(program, env = process.env) {
  const value = env[`PROGRAM_DEMO_${program.code}_PASSWORD`];
  if (!value || value.length < 6)
    throw new Error(
      `Set PROGRAM_DEMO_${program.code}_PASSWORD to a demo password of at least 6 characters in the private environment.`,
    );
  return value;
}

export function milestones(program) {
  const adviser = {
    name: "Adviser selection and acceptance",
    type: "ADVISER_SELECTION",
    role: "RESEARCHER",
    files: false,
  };
  const title = {
    name: "Research title proposal",
    type: "TITLE_PROPOSAL",
    role: "RESEARCHER",
    files: false,
  };
  const standard = (name, role = "RESEARCH_COORDINATOR") => ({
    name,
    type: "STANDARD",
    role,
    files: true,
  });
  const gate = (name) => ({
    name,
    type: "DEFENSE_ELIGIBILITY",
    role: "RESEARCH_COORDINATOR",
    files: true,
  });
  // The Education interview lists one defense, after manuscript completion.
  if (program.code === "BEED")
    return [
      title,
      adviser,
      standard("Research proposal review and revision"),
      standard("UAREB application and demo clearance document"),
      standard("Research instrument validation"),
      standard("Fictional interviews and qualitative analysis"),
      standard("Research manuscript completion and adviser review"),
      gate("Final defense eligibility and manuscript approval"),
      standard("Onsite defense result and required revisions"),
      standard("Final manuscript approval and archive submission", "DEAN"),
    ];
  return [
    ...(program.code === "BEED" ? [title, adviser] : [adviser, title]),
    standard(
      program.code === "BSCPE"
        ? "Design proposal and technical plan"
        : "Research proposal, initial chapters, and methodology",
    ),
    gate("Proposal defense eligibility and manuscript approval"),
    standard("Proposal defense result and approved corrections"),
    standard(
      program.code === "BSCPE"
        ? "Design, safety, and testing approvals"
        : program.code === "BEED"
          ? "UAREB application and instrument validation"
          : "Research ethics application and instrument validation",
    ),
    standard(program.work),
    gate("Final defense eligibility and manuscript approval"),
    standard("Final defense result and required revisions"),
    standard("Final manuscript approval and archive submission", "DEAN"),
  ];
}

export function validateTarget(env) {
  if (!env.PROGRAM_DEMO_DATABASE_URL)
    throw new Error(
      "Set PROGRAM_DEMO_DATABASE_URL in the private .env.program-demo.local file. Ordinary development .env is never used as the target.",
    );
  const u = new URL(env.PROGRAM_DEMO_DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(u.protocol))
    throw new Error("A PostgreSQL connection is required.");
  const host = u.hostname.toLowerCase(),
    database = decodeURIComponent(u.pathname.slice(1));
  const schema = u.searchParams.get("schema") || "public";
  if (
    !host ||
    !database ||
    host !== env.PROGRAM_DEMO_EXPECTED_HOST?.toLowerCase() ||
    database !== env.PROGRAM_DEMO_EXPECTED_DATABASE
  )
    throw new Error(
      "The connection does not match the explicitly declared host and database.",
    );
  if (schema !== "public")
    throw new Error("The demo tool requires the public application schema.");
  const local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
  if (!local && env.PROGRAM_DEMO_LIVE_CONFIRMATION !== `CREATE:${DATASET}`)
    throw new Error(
      `Live provisioning requires PROGRAM_DEMO_LIVE_CONFIRMATION=CREATE:${DATASET}.`,
    );
  const insideRender =
    env.PROGRAM_DEMO_RENDER_SERVICE_ID &&
    env.RENDER_SERVICE_ID === env.PROGRAM_DEMO_RENDER_SERVICE_ID &&
    /^srv-[a-z0-9]+$/.test(env.RENDER_SERVICE_ID) &&
    /^dpg-[a-z0-9]+-a$/.test(host) &&
    env.PROGRAM_DEMO_DATABASE_URL === env.DATABASE_URL;
  if (
    !local &&
    !insideRender &&
    !(
      u.searchParams.get("sslmode") === "require" &&
      u.searchParams.get("sslaccept") === "strict"
    )
  )
    throw new Error(
      "External live connections require sslmode=require&sslaccept=strict. Private Render connections require the matching declared Render service and its existing DATABASE_URL.",
    );
  if (env.ADVISIO_EVALUATION === "1")
    throw new Error(
      "Respondent evaluation sessions cannot provision persistent demo accounts.",
    );
  return { host, database, schema, local };
}

export function assertOwnedRoots(roots) {
  const expected = new Map(accounts().map((a) => [a.email, a]));
  for (const user of roots.users) {
    const account = expected.get(user.email);
    if (
      !account ||
      user.universityId !== account.universityId ||
      user.firstName !== "Demo" ||
      user.googleSubject
    )
      throw new Error(
        "A demo login identity changed or is externally linked; refusing cleanup.",
      );
    if (user.roles.length !== 1 || user.roles[0].role.name !== account.role)
      throw new Error("A demo account has changed roles; refusing cleanup.");
  }
  const userIds = new Set(roots.users.map((u) => u.id));
  const projectIds = new Set(roots.projects.map((p) => p.id));
  const workflowIds = new Set(roots.workflows.map((w) => w.id));
  const typeIds = new Set(roots.types.map((t) => t.id));
  const programCodes = new Set(PROGRAMS.map((p) => p.code));
  for (const workflow of roots.workflows)
    if (
      !userIds.has(workflow.createdBy) ||
      !typeIds.has(workflow.researchTypeId) ||
      !workflow.name.startsWith(DATASET + " ")
    )
      throw new Error("A workflow has an unrelated owner or research type.");
  for (const type of roots.types)
    if (
      !type.code.startsWith("DEMO4-") ||
      !programCodes.has(type.code.slice(6)) ||
      (type.workflowId && !workflowIds.has(type.workflowId))
    )
      throw new Error("A research type has an unrelated workflow.");
  for (const project of roots.projects) {
    if (
      !userIds.has(project.createdBy) ||
      !typeIds.has(project.researchTypeId) ||
      !project.groupName?.startsWith(DATASET + ":") ||
      !workflowIds.has(project.workflowInstance?.workflowId)
    )
      throw new Error("A project is not wholly owned by this demo dataset.");
    if (project.members.some((m) => !userIds.has(m.userId)))
      throw new Error("A non-demo user joined a demo group.");
    if (project.officialCopies.length)
      throw new Error(
        "An official archive exists. Preserve it and remove active demo access separately.",
      );
  }
  for (const workspace of roots.workspaces)
    if (
      !userIds.has(workspace.createdBy) ||
      workspace.members.some((m) => !userIds.has(m.userId)) ||
      workspace.projects.some((p) => !projectIds.has(p.id))
    )
      throw new Error("A workspace is linked to non-demo records.");
}
