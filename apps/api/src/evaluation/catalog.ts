export const EVALUATION_ROLES = [
  {
    id: "student",
    label: "Researchers/Students",
    institutionalRole: "RESEARCHER",
    home: "/student/dashboard",
    surveyRole: "Researchers/Students",
  },
  {
    id: "professor",
    label: "Research Professor / Coordinator",
    institutionalRole: "RESEARCH_COORDINATOR",
    home: "/professor/dashboard",
    surveyRole: "Research professors",
  },
  {
    id: "adviser",
    label: "Research adviser",
    institutionalRole: "ADVISER",
    home: "/adviser/dashboard",
    surveyRole: "Research advisers",
  },
  {
    id: "panelist",
    label: "Evaluation panelist",
    institutionalRole: "PANELIST",
    home: "/panelist/dashboard",
    surveyRole: "Evaluation panelists",
  },
  {
    id: "dean",
    label: "College Dean",
    institutionalRole: "DEAN",
    home: "/admin/dashboard",
    surveyRole: "College Deans",
  },
] as const;
export type EvaluationRole = (typeof EVALUATION_ROLES)[number]["id"];

export const EVALUATION_COURSES = [
  {
    id: "BSIT",
    label: "Information Technology",
    collegeCode: "CIT",
    college: "College of Information Technology",
    quota: 40,
    type: "Developmental capstone",
    title:
      "CampusWay: A Web Based Campus Facility Locator and Navigation System",
    short: "CampusWay",
    researchers: ["Mikaela Santos", "Joshua Villanueva", "Carlo Mendoza"],
    adviser: "Andrea Reyes",
    stage: "Requirements and system design review",
    feedback:
      "Clarify the route-selection rules and connect each evaluation measure to a system requirement.",
    objective:
      "Develop a campus facility locator with an accessible directory and route selection for a fictional campus.",
    method:
      "Use iterative requirements analysis, interface design, prototype implementation, functional testing, and a planned usability evaluation.",
    details: [
      "A facility directory lists the library, clinic, registrar, and learning laboratories.",
      "Route selection considers access points, path availability, and accessible alternatives.",
      "The evaluation plan maps task completion, navigation accuracy, and usability measures to requirements.",
    ],
    revision:
      "Add a requirements-to-test matrix and describe route-selection rules, accessibility assumptions, and success measures.",
  },
  {
    id: "BEED",
    label: "Education",
    collegeCode: "SOE",
    college: "School of Education",
    quota: 20,
    type: "Quantitative correlational research proposal",
    title:
      "Classroom Feedback Practices and Academic Engagement among First Year College Students",
    short: "Feedback_Engagement",
    researchers: ["Lara Bautista", "Denise Ramos", "Paolo Cruz"],
    adviser: "Elena Garcia",
    stage: "Research method and instrument review",
    feedback:
      "Specify the participant criteria and map each questionnaire section to its variable.",
    objective:
      "Examine the proposed relationship between classroom feedback practices and academic engagement.",
    method:
      "Plan a cross-sectional correlational survey with separate scales for feedback practices and engagement. Report associations without claiming causation.",
    details: [
      "Eligible participants are first-year students enrolled during the defined term.",
      "Feedback items address timeliness, clarity, and opportunities to apply advice.",
      "Engagement items address participation, effort, and learning strategies.",
    ],
    revision:
      "Add an eligibility checklist, variable-to-item matrix, and a plan to examine scale reliability.",
  },
  {
    id: "BSN",
    label: "Nursing",
    collegeCode: "CNP",
    college: "College of Nursing and Pharmacy",
    quota: 20,
    type: "Correlational research proposal",
    title:
      "Clinical Learning Environment and Perceived Stress among Third Year Nursing Students",
    short: "Clinical_Learning",
    researchers: ["Nicole Rivera", "Alyssa Torres", "Gabriel Aquino"],
    adviser: "Marissa Valdez",
    stage: "Research method and ethics review",
    feedback:
      "Separate the environment and stress measures and explain how student responses will remain confidential.",
    objective:
      "Examine the planned association between the clinical learning environment and perceived stress.",
    method:
      "Propose a voluntary survey of eligible third-year nursing students using separately scored measures and an association analysis.",
    details: [
      "The environment measure addresses supervision, learning opportunities, and support.",
      "The stress measure concerns perceived demands and coping during learning placements.",
      "Recruitment must avoid pressure from clinical instructors and must not collect patient records.",
    ],
    revision:
      "Add separate scoring instructions, confidential response handling, and a voluntary recruitment procedure.",
  },
  {
    id: "BSA",
    label: "Accountancy",
    collegeCode: "COA",
    college: "College of Accountancy",
    quota: 20,
    type: "Descriptive survey research proposal",
    title:
      "Digital Bookkeeping Adoption and Record Keeping Practices among Micro Retail Enterprises",
    short: "Digital_Bookkeeping",
    researchers: ["Sofia Lim", "Adrian Mercado", "Bea Navarro"],
    adviser: "Ramon Castillo",
    stage: "Research method and questionnaire review",
    feedback:
      "Define eligible enterprises and distinguish software adoption from record-keeping practices.",
    objective:
      "Describe proposed digital bookkeeping adoption and record-keeping practices among micro retailers.",
    method:
      "Plan a descriptive survey using enterprise eligibility screening and separate adoption and record-practice sections.",
    details: [
      "Screen for retail activity, enterprise size, and the defined operating area.",
      "Adoption questions distinguish spreadsheets, bookkeeping applications, and manual records.",
      "Practice questions address update frequency, supporting documents, and reconciliation; no account balances are collected.",
    ],
    revision:
      "Add enterprise screening criteria and separate the adoption questions from record-keeping indicators.",
  },
  {
    id: "BSTM",
    label: "Tourism",
    collegeCode: "CHTM",
    college: "College of Hospitality and Tourism Management",
    quota: 20,
    type: "Descriptive visitor survey research proposal",
    title:
      "Visitor Satisfaction with Accessibility and Service Quality at Local Heritage Attractions",
    short: "Heritage_Visitor",
    researchers: ["Isabella Flores", "Ethan Dizon", "Chloe Manalo"],
    adviser: "Patricia David",
    stage: "Research method and visitor questionnaire review",
    feedback:
      "Define visitor eligibility and separate accessibility items from service-quality items.",
    objective:
      "Describe planned visitor satisfaction measures at fictional local heritage attractions.",
    method:
      "Propose an exit survey with eligibility screening, a visitor-journey framework, and a defined recruitment schedule.",
    details: [
      "A fictional venue description identifies an entrance, information desk, exhibit areas, and visitor facilities.",
      "Accessibility items address wayfinding, movement, and availability of visitor information.",
      "Service-quality items address staff responsiveness, clarity, and assistance.",
    ],
    revision:
      "Add visitor inclusion criteria, separate questionnaire dimensions, and a recruitment schedule.",
  },
  {
    id: "BSCE",
    label: "Civil Engineering",
    collegeCode: "CEA",
    college: "College of Engineering and Architecture",
    quota: 20,
    type: "Applied engineering assessment and preliminary design study",
    title:
      "Preliminary Drainage Assessment and Improvement Design for a Flood Prone Residential Street",
    short: "Drainage_Assessment",
    researchers: ["Miguel Lopez", "Hannah Soriano", "Sean Velasco"],
    adviser: "Rafael Mendoza",
    stage: "Assessment method and preliminary design review",
    feedback:
      "State the design assumptions and show how field observations will inform the proposed drainage layout.",
    objective:
      "Prepare a preliminary drainage assessment and improvement concept for a fictional residential street.",
    method:
      "Plan site reconnaissance, an observation sheet, catchment delineation, stated rainfall assumptions, and preliminary hydraulic checks.",
    details: [
      "The fictional site sketch identifies roadway edges, inlets, drainage direction, and a proposed outfall.",
      "The observation sheet records obstructions, surface condition, and ponding locations.",
      "Design calculations remain proposed exercises and require verification of survey and rainfall inputs.",
    ],
    revision:
      "Add an assumptions register, observation-to-design matrix, and a preliminary drainage layout.",
  },
  {
    id: "BSPSYCH",
    label: "Psychology",
    collegeCode: "SAS",
    college: "School of Arts and Sciences",
    quota: 0,
    type: "Quantitative correlational research proposal",
    title: "Study Habits and Academic Engagement among Undergraduate Students",
    short: "Study_Habits",
    researchers: ["Sam Rivera", "Alex Garcia", "Jamie Reyes"],
    adviser: "Clara Santos",
    stage: "Research method and instrument review",
    feedback:
      "Distinguish study habits from engagement and define the eligibility and voluntary recruitment procedures.",
    objective:
      "Examine the proposed association between study habits and academic engagement among fictional undergraduate students.",
    method:
      "Plan a voluntary cross-sectional survey with separate habit and engagement scales, reliability checks, and correlational analysis without causal claims.",
    details: [
      "Habit items address scheduling, study environments, and review strategies.",
      "Engagement items address participation, effort, and persistence.",
      "Use anonymous responses, stated eligibility criteria, and a defined recruitment period.",
    ],
    revision:
      "Add an eligibility checklist, variable-to-item matrix, and anonymous response handling procedure.",
  },
  {
    id: "BSBA-MM",
    label: "Business Administration - Marketing Management",
    collegeCode: "SBPA",
    college: "School of Business and Public Administration",
    quota: 0,
    type: "Descriptive enterprise survey research proposal",
    title: "Digital Marketing Adoption among Local Microenterprises",
    short: "Digital_Marketing",
    researchers: ["Mia Castro", "Leo Ramos", "Ella Tan"],
    adviser: "Daniel Flores",
    stage: "Research method and questionnaire review",
    feedback:
      "Separate channel adoption from marketing practices and define eligible microenterprises without collecting confidential revenue data.",
    objective:
      "Describe proposed digital marketing adoption and channel use among fictional local microenterprises.",
    method:
      "Plan a descriptive survey using enterprise eligibility screening, a channel inventory, and separate marketing-practice indicators.",
    details: [
      "Channel adoption distinguishes social media, online marketplaces, and business websites.",
      "Practice items address content planning, customer responses, and promotion frequency.",
      "Participation is voluntary and no account credentials or actual sales records are collected.",
    ],
    revision:
      "Add enterprise screening criteria, separate channel and practice measures, and a confidential recruitment procedure.",
  },
  {
    id: "BSARCH",
    label: "Architecture",
    collegeCode: "CEA",
    college: "College of Engineering and Architecture",
    quota: 10,
    type: "Architectural design thesis proposal",
    title:
      "A Climate Responsive Community Learning Hub in San Fernando Pampanga",
    short: "Community_Learning_Hub",
    researchers: ["Amelia Fernandez"],
    adviser: "Celina Villanueva",
    stage: "Site analysis and architectural programming review",
    feedback:
      "Relate the space program to identified users and justify the orientation and circulation concept.",
    objective:
      "Develop a climate-responsive learning hub concept for a fictional site in San Fernando, Pampanga.",
    method:
      "Plan user analysis, site and climate review, architectural programming, adjacency studies, and preliminary massing.",
    details: [
      "The space program includes reading, collaborative learning, multipurpose activity, support, and service spaces.",
      "The fictional site-analysis sheet considers sun exposure, ventilation, access, and surrounding uses.",
      "The concept study compares shaded circulation, daylight, and separation of quiet and active zones.",
    ],
    revision:
      "Add user-to-space justification, an adjacency diagram, and orientation and circulation alternatives.",
  },
] as const;
export type EvaluationCourse = (typeof EVALUATION_COURSES)[number];

// Keep BSARCH invitation URLs valid while offering one representative per college.
export const EVALUATION_COLLEGES = EVALUATION_COURSES.filter(
  (c) => c.id !== "BSARCH",
);
export function evaluationCourse(value: unknown) {
  return (
    EVALUATION_COURSES.find((c) => c.id === value) ||
    EVALUATION_COLLEGES.find((c) => c.collegeCode === value)
  );
}
export const DEFAULT_MILESTONES = [
  "Title Proposal",
  "Adviser",
  "Chapter 1 to Chapter 3",
  "Full Manuscript Chapter 1-3",
  "Title Defense",
  "UAREB Submission",
  "Chapter 4-5",
  "Full Manuscript Chapter 4-5",
  "Full Manuscript Chapter 1-5",
  "Final Defense",
] as const;
export const PROJECT_SCENARIOS = {
  A: { current: 4, lifecycle: "IN_REVIEW" },
  B: { current: 3, lifecycle: "REVISION_REQUIRED" },
  C: { current: 5, lifecycle: "APPROVED" },
  D: { current: 6, lifecycle: "APPROVED" },
} as const;
export type Scenario = keyof typeof PROJECT_SCENARIOS;
export const ROLE_PROJECTS: Record<EvaluationRole, readonly Scenario[]> = {
  student: ["B"],
  professor: ["A", "B", "C"],
  adviser: ["A", "B"],
  panelist: ["C", "D"],
  dean: ["A", "B", "C"],
};

export const ROLE_TASKS: Record<EvaluationRole, string[]> = {
  student: [
    "Open your assigned research project.",
    "Find its current milestone and revision deadline.",
    "Open the latest manuscript and read the adviser feedback.",
    "Download the prepared revision from these evaluation controls, then upload it through the manuscript task.",
    "Check the updated submission status.",
    "Find the upcoming consultation schedule.",
  ],
  professor: [
    "Open your assigned program projects.",
    "Locate a project with pending work.",
    "Check its milestone and deadline.",
    "Open the current submission.",
    "Perform a permitted review or coordination action.",
    "Inspect the class record activities, attendance, and released grades.",
  ],
  adviser: [
    "Open an assigned project.",
    "View the latest manuscript and version history.",
    "Review the prepared student revision.",
    "Add feedback or record a permitted review decision.",
    "Respond to the consultation request.",
    "Check the updated review status and project progress.",
  ],
  panelist: [
    "Open your assigned defense.",
    "Read the approved manuscript in its defense packet.",
    "Highlight a section, add a comment, and place an annotation mark.",
    "Save, preview, and share your manuscript feedback.",
    "To try a live evaluation, switch to Coordinator, start Project C's scheduled defense, then return to Panelist.",
    "Complete the structured evaluation during the live defense and inspect the result; view Project D's completed defense history.",
  ],
  dean: [
    "Open the college overview.",
    "Locate a project awaiting action.",
    "Inspect its progress and current manuscript.",
    "Read its approval history.",
    "Perform a permitted review or approval action.",
    "Check the updated institutional record.",
  ],
};
