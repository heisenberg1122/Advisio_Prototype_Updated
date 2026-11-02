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
    label: "Research professor",
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

export const ROLE_TASKS: Record<EvaluationRole, string[]> = {
  student: [
    "Open your assigned research project.",
    "Find its current milestone and revision deadline.",
    "Open the latest manuscript and read the adviser feedback.",
    "Download the prepared revision from this guide, then upload it through the manuscript task.",
    "Check the updated submission status.",
    "Find the upcoming consultation schedule.",
  ],
  professor: [
    "Open your assigned program projects.",
    "Locate a project with pending work.",
    "Check its milestone and deadline.",
    "Open the current submission.",
    "Perform a permitted review or coordination action.",
    "Check the resulting progress or status.",
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
    "Check the defense schedule and rubric.",
    "Enter your practice ratings.",
    "Add feedback and preview the evaluation.",
    "Submit your evaluation within this private workspace and inspect its status.",
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
