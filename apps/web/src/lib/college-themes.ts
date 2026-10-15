export type CourseThemeKey =
  | "bsa"
  | "bsais"
  | "bsarch"
  | "bsce"
  | "bscpe"
  | "bsie"
  | "bshm"
  | "bstm"
  | "bsit"
  | "blis"
  | "bsn"
  | "bsph"
  | "abcomm"
  | "bscrim"
  | "bhs"
  | "bspsych"
  | "bsba-mm"
  | "bsba-om"
  | "beed"
  | "bsed";

export type CollegeThemeKey =
  | "default"
  | "coa"
  | "cea"
  | "chtm"
  | "cit"
  | "cnp"
  | "sas"
  | "sbpa"
  | "soe"
  | CourseThemeKey;

export interface CollegeThemePalette {
  appBackground: string;
  sidebarBackground: string;
  headerBackground: string;
  primaryCardBackground: string;
  secondaryCardBackground: string;
  activeNavBackground: string;
  hoverBackground: string;
  borderColor: string;
  primaryInteractive: string;
  primaryHover: string;
  primaryText: string;
  secondaryText: string;
}

export interface CollegeThemeMetadata extends CollegeThemePalette {
  key: CollegeThemeKey;
  code: string;
  name: string;
  referenceColor: string;
  dark: CollegeThemePalette;
}

/**
 * Shared Dark Mode surface base for all courses from the official design system:
 * - Main background: #111820
 * - Sidebar: #19232D
 * - Header: #19232D
 * - Cards: #222D38
 * - Active navigation: #303744
 * - Primary text: #F1F5F9
 * - Secondary text: #A8B6C6
 */
const SHARED_DARK_SURFACES = {
  appBackground: "#111820",
  sidebarBackground: "#19232D",
  headerBackground: "#19232D",
  primaryCardBackground: "#222D38",
  secondaryCardBackground: "#1D2733",
  activeNavBackground: "#303744",
  hoverBackground: "rgba(255, 255, 255, 0.06)",
  borderColor: "rgba(255, 255, 255, 0.10)",
  primaryText: "#F1F5F9",
  secondaryText: "#A8B6C6",
} as const;

const createDarkPalette = (
  darkAccent: string,
  darkHover: string,
): CollegeThemePalette => ({
  ...SHARED_DARK_SURFACES,
  primaryInteractive: darkAccent,
  primaryHover: darkHover,
});

export const COLLEGE_THEMES: Record<CollegeThemeKey, CollegeThemeMetadata> = {
  default: {
    key: "default",
    code: "UA",
    name: "University of the Assumption",
    referenceColor: "#0B3A53",
    primaryInteractive: "#0B3A53",
    primaryHover: "#072A3D",
    appBackground: "#F2F6F9",
    sidebarBackground: "#E4ECF2",
    headerBackground: "#E4ECF2",
    primaryCardBackground: "#F8FAFC",
    secondaryCardBackground: "#DAE6EF",
    activeNavBackground: "#CADCE8",
    hoverBackground: "#D4E4EE",
    borderColor: "#BDD2E1",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: {
      ...SHARED_DARK_SURFACES,
      primaryInteractive: "#38BDF8",
      primaryHover: "#0EA5E9",
    },
  },

  // ─── 1. College of Accountancy ────────────────────────────────────
  bsa: {
    key: "bsa",
    code: "BSA",
    name: "BS Accountancy",
    referenceColor: "#815D00",
    primaryInteractive: "#815D00",
    primaryHover: "#674A00",
    appBackground: "#FCF9EE",
    sidebarBackground: "#F9F2DB",
    headerBackground: "#F9F2DB",
    primaryCardBackground: "#FDFCF6",
    secondaryCardBackground: "#F6EFD7",
    activeNavBackground: "#F5ECCA",
    hoverBackground: "#F8F0D3",
    borderColor: "#EADBAC",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#E0B034", "#ECC254"),
  },
  bsais: {
    key: "bsais",
    code: "BSAIS",
    name: "BS Accounting Information System",
    referenceColor: "#926B10",
    primaryInteractive: "#926B10",
    primaryHover: "#79570B",
    appBackground: "#FCF9F0",
    sidebarBackground: "#F8F2DF",
    headerBackground: "#F8F2DF",
    primaryCardBackground: "#FDFCF6",
    secondaryCardBackground: "#F6EEDA",
    activeNavBackground: "#F5ECCF",
    hoverBackground: "#F8F0D7",
    borderColor: "#E9DCB2",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#E5BA42", "#F0CA5E"),
  },

  // ─── 2. College of Engineering and Architecture ──────────────────
  bsarch: {
    key: "bsarch",
    code: "BSARCH",
    name: "BS Architecture",
    referenceColor: "#B53A24",
    primaryInteractive: "#B53A24",
    primaryHover: "#962F1C",
    appBackground: "#F8EDEB",
    sidebarBackground: "#F1DAD5",
    headerBackground: "#F1DAD5",
    primaryCardBackground: "#FBF5F4",
    secondaryCardBackground: "#EDD1CB",
    activeNavBackground: "#EAC8C2",
    hoverBackground: "#EED1CB",
    borderColor: "#E2B9B2",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#F2755E", "#F6907D"),
  },
  bsce: {
    key: "bsce",
    code: "BSCE",
    name: "BS Civil Engineering",
    referenceColor: "#AC4323",
    primaryInteractive: "#AC4323",
    primaryHover: "#8E351A",
    appBackground: "#F8EEEB",
    sidebarBackground: "#EFDBD5",
    headerBackground: "#EFDBD5",
    primaryCardBackground: "#FBF6F4",
    secondaryCardBackground: "#EBD2CB",
    activeNavBackground: "#E8CAC1",
    hoverBackground: "#ECD3CB",
    borderColor: "#DFBCB2",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#EE7E5F", "#F4987E"),
  },
  bscpe: {
    key: "bscpe",
    code: "BSCPE",
    name: "BS Computer Engineering",
    referenceColor: "#AB452B",
    primaryInteractive: "#AB452B",
    primaryHover: "#8D361F",
    appBackground: "#F7EEEC",
    sidebarBackground: "#EEDCD7",
    headerBackground: "#EEDCD7",
    primaryCardBackground: "#FBF6F4",
    secondaryCardBackground: "#EAD3CD",
    activeNavBackground: "#E7CBC4",
    hoverBackground: "#ECD4CD",
    borderColor: "#DEBEB6",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#EE8068", "#F49B86"),
  },
  bsie: {
    key: "bsie",
    code: "BSIE",
    name: "BS Industrial Engineering",
    referenceColor: "#B44C2A",
    primaryInteractive: "#B44C2A",
    primaryHover: "#943D1F",
    appBackground: "#F8EFEC",
    sidebarBackground: "#F1DDD7",
    headerBackground: "#F1DDD7",
    primaryCardBackground: "#FBF6F4",
    secondaryCardBackground: "#ECD4CD",
    activeNavBackground: "#EACDC3",
    hoverBackground: "#EED5CB",
    borderColor: "#E0BFB4",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#F08665", "#F59F82"),
  },

  // ─── 3. College of Hospitality and Tourism Management ─────────────
  bshm: {
    key: "bshm",
    code: "BSHM",
    name: "BS Hospitality Management",
    referenceColor: "#B20D53",
    primaryInteractive: "#B20D53",
    primaryHover: "#910942",
    appBackground: "#F8E9F0",
    sidebarBackground: "#F0D1DE",
    headerBackground: "#F0D1DE",
    primaryCardBackground: "#FBF3F6",
    secondaryCardBackground: "#ECC6D6",
    activeNavBackground: "#E9BBCF",
    hoverBackground: "#EEC7D7",
    borderColor: "#DFACCE",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#F26298", "#F87DAE"),
  },
  bstm: {
    key: "bstm",
    code: "BSTM",
    name: "BS Tourism Management",
    referenceColor: "#AF245F",
    primaryInteractive: "#AF245F",
    primaryHover: "#8E1B4C",
    appBackground: "#F8EBF1",
    sidebarBackground: "#F0D5E1",
    headerBackground: "#F0D5E1",
    primaryCardBackground: "#FBF4F7",
    secondaryCardBackground: "#ECCAD9",
    activeNavBackground: "#E9C2D2",
    hoverBackground: "#EECDDA",
    borderColor: "#DFB2C4",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#EE6A9F", "#F587B2"),
  },

  // ─── 4. College of Information Technology ─────────────────────────
  bsit: {
    key: "bsit",
    code: "BSIT",
    name: "BS Information Technology",
    referenceColor: "#58647A", // Standardized: #58647A (replaces #526862)
    primaryInteractive: "#58647A",
    primaryHover: "#444F63",
    appBackground: "#EFF1F1",
    sidebarBackground: "#DEE2E1",
    headerBackground: "#DEE2E1",
    primaryCardBackground: "#F6F7F7",
    secondaryCardBackground: "#D7DDDC",
    activeNavBackground: "#CFD5D3",
    hoverBackground: "#D7DDDC",
    borderColor: "#C0C9C6",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#8D9BB5", "#A3B0C7"),
  },
  blis: {
    key: "blis",
    code: "BLIS",
    name: "Bachelor of Library and Information Science",
    referenceColor: "#58647A",
    primaryInteractive: "#58647A",
    primaryHover: "#444F63",
    appBackground: "#F0F1F3",
    sidebarBackground: "#DFE2E6",
    headerBackground: "#DFE2E6",
    primaryCardBackground: "#F7F7F8",
    secondaryCardBackground: "#D7DCE1",
    activeNavBackground: "#D0D4DA",
    hoverBackground: "#D8DCE2",
    borderColor: "#C2C7CE",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#8D9BB5", "#A3B0C7"),
  },

  // ─── 5. College of Nursing and Pharmacy ───────────────────────────
  bsn: {
    key: "bsn",
    code: "BSN",
    name: "BS Nursing",
    referenceColor: "#26703E",
    primaryInteractive: "#26703E",
    primaryHover: "#1E5931",
    appBackground: "#EBF2EE",
    sidebarBackground: "#D6E4DA",
    headerBackground: "#D6E4DA",
    primaryCardBackground: "#F4F8F5",
    secondaryCardBackground: "#CCDFD2",
    activeNavBackground: "#C2D7C9",
    hoverBackground: "#CDDFD4",
    borderColor: "#B2CEBB",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#52BD74", "#6DC98C"),
  },
  bsph: {
    key: "bsph",
    code: "BSPH",
    name: "BS Pharmacy",
    referenceColor: "#386D42",
    primaryInteractive: "#386D42",
    primaryHover: "#2C5634",
    appBackground: "#EDF2EE",
    sidebarBackground: "#D9E3DB",
    headerBackground: "#D9E3DB",
    primaryCardBackground: "#F5F8F6",
    secondaryCardBackground: "#D0DED3",
    activeNavBackground: "#C7D6CA",
    hoverBackground: "#D1DED3",
    borderColor: "#B8CBBC",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#62B872", "#7AC588"),
  },

  // ─── 6. School of Arts and Sciences ───────────────────────────────
  abcomm: {
    key: "abcomm",
    code: "ABCOMM",
    name: "AB Communication",
    referenceColor: "#234B80",
    primaryInteractive: "#234B80",
    primaryHover: "#1A3B66",
    appBackground: "#EBEFF4",
    sidebarBackground: "#D5DDE7",
    headerBackground: "#D5DDE7",
    primaryCardBackground: "#F4F6F9",
    secondaryCardBackground: "#CBD5E1",
    activeNavBackground: "#C1CDDB",
    hoverBackground: "#CAD6E2",
    borderColor: "#B0BFD0",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#5E8FD4", "#7AA5E0"),
  },
  bscrim: {
    key: "bscrim",
    code: "BSCRIM",
    name: "BS Criminology",
    referenceColor: "#274466",
    primaryInteractive: "#274466",
    primaryHover: "#1E3550",
    appBackground: "#ECEEF1",
    sidebarBackground: "#D6DBE2",
    headerBackground: "#D6DBE2",
    primaryCardBackground: "#F4F6F7",
    secondaryCardBackground: "#CCD3DC",
    activeNavBackground: "#C3CBD4",
    hoverBackground: "#CCD4DC",
    borderColor: "#B3BDC8",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#6488B8", "#80A0C8"),
  },
  bhs: {
    key: "bhs",
    code: "BHS",
    name: "Bachelor in Human Services",
    referenceColor: "#395A7D",
    primaryInteractive: "#395A7D",
    primaryHover: "#2C4662",
    appBackground: "#EDF0F3",
    sidebarBackground: "#D9E0E6",
    headerBackground: "#D9E0E6",
    primaryCardBackground: "#F5F7F8",
    secondaryCardBackground: "#D0D9E1",
    activeNavBackground: "#C8D1DB",
    hoverBackground: "#D1DAE2",
    borderColor: "#B9C5D0",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#729EC8", "#8EB4D8"),
  },
  bspsych: {
    key: "bspsych",
    code: "BSPSYCH",
    name: "BS Psychology",
    referenceColor: "#4C5682",
    primaryInteractive: "#4C5682",
    primaryHover: "#3A4266",
    appBackground: "#EFF0F4",
    sidebarBackground: "#DDDFE7",
    headerBackground: "#DDDFE7",
    primaryCardBackground: "#F6F7F9",
    secondaryCardBackground: "#D4D7E2",
    activeNavBackground: "#CDD0DC",
    hoverBackground: "#D5D8E3",
    borderColor: "#BEC3CF",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#8692C4", "#9FAAD4"),
  },

  // ─── 7. School of Business and Public Administration ──────────────
  "bsba-mm": {
    key: "bsba-mm",
    code: "BSBA-MM",
    name: "BSBA Marketing Management",
    referenceColor: "#855E00",
    primaryInteractive: "#855E00",
    primaryHover: "#6B4B00",
    appBackground: "#FBF8EE",
    sidebarBackground: "#F7F0DB",
    headerBackground: "#F7F0DB",
    primaryCardBackground: "#FDFBF6",
    secondaryCardBackground: "#F4ECD5",
    activeNavBackground: "#F4E9CA",
    hoverBackground: "#F6EED2",
    borderColor: "#E7DBB8",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#DEAC33", "#E8BC4F"),
  },
  "bsba-om": {
    key: "bsba-om",
    code: "BSBA-OM",
    name: "BSBA Operations Management",
    referenceColor: "#866914",
    primaryInteractive: "#866914",
    primaryHover: "#6C5410",
    appBackground: "#FBF8EF",
    sidebarBackground: "#F7F1DD",
    headerBackground: "#F7F1DD",
    primaryCardBackground: "#FDFBF6",
    secondaryCardBackground: "#F3EBD4",
    activeNavBackground: "#F3EACD",
    hoverBackground: "#F6EED4",
    borderColor: "#E7DDBB",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#DFB745", "#E9C461"),
  },

  // ─── 8. School of Education ───────────────────────────────────────
  beed: {
    key: "beed",
    code: "BEED",
    name: "Bachelor of Elementary Education",
    referenceColor: "#302B8A",
    primaryInteractive: "#302B8A",
    primaryHover: "#25216E",
    appBackground: "#ECECF4",
    sidebarBackground: "#D8D7E9",
    headerBackground: "#D8D7E9",
    primaryCardBackground: "#F5F4F9",
    secondaryCardBackground: "#CECCE4",
    activeNavBackground: "#C5C4DE",
    hoverBackground: "#CFCEE4",
    borderColor: "#B5B3D2",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#8077ED", "#9A92F2"),
  },
  bsed: {
    key: "bsed",
    code: "BSED",
    name: "Bachelor of Secondary Education",
    referenceColor: "#3B3075",
    primaryInteractive: "#3B3075",
    primaryHover: "#2D255A",
    appBackground: "#EDECF3",
    sidebarBackground: "#D9D8E5",
    headerBackground: "#D9D8E5",
    primaryCardBackground: "#F5F5F8",
    secondaryCardBackground: "#D0CEE0",
    activeNavBackground: "#C7C5D8",
    hoverBackground: "#D0CFE0",
    borderColor: "#B7B5CC",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#8D80D8", "#A398E0"),
  },

  // ─── College Unit Fallbacks (for staff / deans assigned to college level) ──
  coa: {
    key: "coa",
    code: "COA",
    name: "College of Accountancy",
    referenceColor: "#815D00",
    primaryInteractive: "#815D00",
    primaryHover: "#674A00",
    appBackground: "#FCF9EE",
    sidebarBackground: "#F9F2DB",
    headerBackground: "#F9F2DB",
    primaryCardBackground: "#FDFCF6",
    secondaryCardBackground: "#F6EFD7",
    activeNavBackground: "#F5ECCA",
    hoverBackground: "#F8F0D3",
    borderColor: "#EADBAC",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#E0B034", "#ECC254"),
  },
  cea: {
    key: "cea",
    code: "CEA",
    name: "College of Engineering and Architecture",
    referenceColor: "#AC4323",
    primaryInteractive: "#AC4323",
    primaryHover: "#8E351A",
    appBackground: "#F8EEEB",
    sidebarBackground: "#EFDBD5",
    headerBackground: "#EFDBD5",
    primaryCardBackground: "#FBF6F4",
    secondaryCardBackground: "#EBD2CB",
    activeNavBackground: "#E8CAC1",
    hoverBackground: "#ECD3CB",
    borderColor: "#DFBCB2",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#EE7E5F", "#F4987E"),
  },
  chtm: {
    key: "chtm",
    code: "CHTM",
    name: "College of Hospitality and Tourism Management",
    referenceColor: "#AF245F",
    primaryInteractive: "#AF245F",
    primaryHover: "#8E1B4C",
    appBackground: "#F8EBF1",
    sidebarBackground: "#F0D5E1",
    headerBackground: "#F0D5E1",
    primaryCardBackground: "#FBF4F7",
    secondaryCardBackground: "#ECCAD9",
    activeNavBackground: "#E9C2D2",
    hoverBackground: "#EECDDA",
    borderColor: "#DFB2C4",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#EE6A9F", "#F587B2"),
  },
  cit: {
    key: "cit",
    code: "CIT",
    name: "College of Information Technology",
    referenceColor: "#58647A",
    primaryInteractive: "#58647A",
    primaryHover: "#444F63",
    appBackground: "#EFF1F1",
    sidebarBackground: "#DEE2E1",
    headerBackground: "#DEE2E1",
    primaryCardBackground: "#F6F7F7",
    secondaryCardBackground: "#D7DDDC",
    activeNavBackground: "#CFD5D3",
    hoverBackground: "#D7DDDC",
    borderColor: "#C0C9C6",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#8D9BB5", "#A3B0C7"),
  },
  cnp: {
    key: "cnp",
    code: "CNP",
    name: "College of Nursing and Pharmacy",
    referenceColor: "#26703E",
    primaryInteractive: "#26703E",
    primaryHover: "#1E5931",
    appBackground: "#EBF2EE",
    sidebarBackground: "#D6E4DA",
    headerBackground: "#D6E4DA",
    primaryCardBackground: "#F4F8F5",
    secondaryCardBackground: "#CCDFD2",
    activeNavBackground: "#C2D7C9",
    hoverBackground: "#CDDFD4",
    borderColor: "#B2CEBB",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#52BD74", "#6DC98C"),
  },
  sas: {
    key: "sas",
    code: "SAS",
    name: "School of Arts and Sciences",
    referenceColor: "#234B80",
    primaryInteractive: "#234B80",
    primaryHover: "#1A3B66",
    appBackground: "#EBEFF4",
    sidebarBackground: "#D5DDE7",
    headerBackground: "#D5DDE7",
    primaryCardBackground: "#F4F6F9",
    secondaryCardBackground: "#CBD5E1",
    activeNavBackground: "#C1CDDB",
    hoverBackground: "#CAD6E2",
    borderColor: "#B0BFD0",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#5E8FD4", "#7AA5E0"),
  },
  sbpa: {
    key: "sbpa",
    code: "SBPA",
    name: "School of Business and Public Administration",
    referenceColor: "#855E00",
    primaryInteractive: "#855E00",
    primaryHover: "#6B4B00",
    appBackground: "#FBF8EE",
    sidebarBackground: "#F7F0DB",
    headerBackground: "#F7F0DB",
    primaryCardBackground: "#FDFBF6",
    secondaryCardBackground: "#F4ECD5",
    activeNavBackground: "#F4E9CA",
    hoverBackground: "#F6EED2",
    borderColor: "#E7DBB8",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#DEAC33", "#E8BC4F"),
  },
  soe: {
    key: "soe",
    code: "SOE",
    name: "School of Education",
    referenceColor: "#302B8A",
    primaryInteractive: "#302B8A",
    primaryHover: "#25216E",
    appBackground: "#ECECF4",
    sidebarBackground: "#D8D7E9",
    headerBackground: "#D8D7E9",
    primaryCardBackground: "#F5F4F9",
    secondaryCardBackground: "#CECCE4",
    activeNavBackground: "#C5C4DE",
    hoverBackground: "#CFCEE4",
    borderColor: "#B5B3D2",
    primaryText: "#243047",
    secondaryText: "#64748B",
    dark: createDarkPalette("#8077ED", "#9A92F2"),
  },
};

const CODE_ALIASES: Record<string, CollegeThemeKey> = {
  // Colleges & Schools
  COA: "coa",
  CEA: "cea",
  CHTM: "chtm",
  CIT: "cit",
  CCS: "cit",
  CICT: "cit",
  CNP: "cnp",
  SAS: "sas",
  SBPA: "sbpa",
  SOE: "soe",

  // Course / Degree Program Offerings (all 20 courses)
  BSA: "bsa",
  BSAIS: "bsais",
  BSARCH: "bsarch",
  BSCE: "bsce",
  BSCPE: "bscpe",
  BSIE: "bsie",
  BSHM: "bshm",
  BSTM: "bstm",
  BSIT: "bsit",
  BLIS: "blis",
  BSN: "bsn",
  BSPH: "bsph",
  ABCOMM: "abcomm",
  BSCRIM: "bscrim",
  BHS: "bhs",
  BSPSYCH: "bspsych",
  "BSBA-MM": "bsba-mm",
  "BSBA-OM": "bsba-om",
  BEED: "beed",
  BSED: "bsed",
  "BSED-VE-RE": "bsed",
};

export function resolveCollegeTheme(
  college?: { code?: string | null; name?: string | null } | null,
  program?: { code?: string | null; name?: string | null } | null,
  fallbackKey?: CollegeThemeKey,
): CollegeThemeMetadata {
  // 1. Check direct program code (e.g. BSIT, BSTM, BSA)
  const programCode = program?.code?.trim().toUpperCase();
  if (programCode && CODE_ALIASES[programCode]) {
    return COLLEGE_THEMES[CODE_ALIASES[programCode]];
  }

  // 2. Check direct college code or passed offering code (e.g. CHTM, COA, BSIT)
  const collegeCode = college?.code?.trim().toUpperCase();
  if (collegeCode && CODE_ALIASES[collegeCode]) {
    return COLLEGE_THEMES[CODE_ALIASES[collegeCode]];
  }

  // 3. Check program name for domain keywords
  const programName = program?.name?.trim().toLowerCase() || "";
  if (programName) {
    if (programName.includes("information technology")) return COLLEGE_THEMES.bsit;
    if (programName.includes("library")) return COLLEGE_THEMES.blis;
    if (programName.includes("account")) {
      if (programName.includes("information")) return COLLEGE_THEMES.bsais;
      return COLLEGE_THEMES.bsa;
    }
    if (programName.includes("architecture")) return COLLEGE_THEMES.bsarch;
    if (programName.includes("civil")) return COLLEGE_THEMES.bsce;
    if (programName.includes("computer engineering")) return COLLEGE_THEMES.bscpe;
    if (programName.includes("industrial")) return COLLEGE_THEMES.bsie;
    if (programName.includes("hospitality")) return COLLEGE_THEMES.bshm;
    if (programName.includes("tourism")) return COLLEGE_THEMES.bstm;
    if (programName.includes("nurs")) return COLLEGE_THEMES.bsn;
    if (programName.includes("pharmac")) return COLLEGE_THEMES.bsph;
    if (programName.includes("communication")) return COLLEGE_THEMES.abcomm;
    if (programName.includes("criminol")) return COLLEGE_THEMES.bscrim;
    if (programName.includes("human service")) return COLLEGE_THEMES.bhs;
    if (programName.includes("psycholog")) return COLLEGE_THEMES.bspsych;
    if (programName.includes("marketing")) return COLLEGE_THEMES["bsba-mm"];
    if (programName.includes("operation")) return COLLEGE_THEMES["bsba-om"];
    if (programName.includes("elementary")) return COLLEGE_THEMES.beed;
    if (programName.includes("secondary")) return COLLEGE_THEMES.bsed;
  }

  // 4. Check college name
  const collegeName = college?.name?.trim().toLowerCase() || "";
  if (collegeName) {
    const match = Object.values(COLLEGE_THEMES).find(
      (theme) => theme.name.toLowerCase() === collegeName,
    );
    if (match) return match;
  }

  if (fallbackKey && COLLEGE_THEMES[fallbackKey]) {
    return COLLEGE_THEMES[fallbackKey];
  }

  return COLLEGE_THEMES.default;
}
