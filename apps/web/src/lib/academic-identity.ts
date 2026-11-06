type AcademicAssignment = { code?: string | null; name?: string | null };

const colleges = [
  { key: "coa", name: "College of Accountancy", codes: ["COA"], programs: ["BSA", "BSAIS"] },
  { key: "cea", name: "College of Engineering and Architecture", codes: ["CEA"], programs: ["BSARCH", "BSCE", "BSCPE", "BSIE"] },
  { key: "chtm", name: "College of Hospitality and Tourism Management", codes: ["CHTM"], programs: ["BSHM", "BSTM"] },
  { key: "cit", name: "College of Information Technology", codes: ["CIT", "CITCLS", "CCS", "CICT"], programs: ["BSIT", "BLIS"] },
  { key: "cnp", name: "College of Nursing and Pharmacy", codes: ["CNP", "CONP"], programs: ["BSN", "BSPH"] },
  { key: "sas", name: "School of Arts and Sciences", codes: ["SAS"], programs: ["ABCOMM", "BSCRIM", "BHS", "BSPSYCH"] },
  { key: "sbpa", name: "School of Business and Public Administration", codes: ["SBPA"], programs: ["BSBAMM", "BSBAOM"] },
  { key: "soe", name: "School of Education", codes: ["SOE"], programs: ["BEED", "BSED"] },
];

const normalize = (value?: string | null) => (value || "").replace(/&/g, "and").replace(/[^a-z0-9]/gi, "").toUpperCase();

/** Academic identity follows the authenticated account, independently of its
 * selected color theme or dashboard role. An explicit college takes priority. */
export function getAcademicIdentity({ college, program }: {
  college?: AcademicAssignment | null;
  program?: AcademicAssignment | null;
}) {
  const collegeLabel = college?.name?.trim() || college?.code?.trim();
  const programName = program?.name?.trim() || program?.code?.trim();
  if (!collegeLabel && !programName) return null;

  const match = collegeLabel
    ? colleges.find(item => item.codes.includes(normalize(college?.code)) || normalize(item.name) === normalize(college?.name))
    : colleges.find(item => item.programs.includes(normalize(program?.code)));
  const collegeName = college?.name?.trim() || match?.name || collegeLabel;

  return {
    collegeName,
    programName,
    logoSrc: match ? `/college-logos/${match.key}.png` : "/school-logo.png",
    logoAlt: match ? `${match.name} logo` : "University of the Assumption logo",
  };
}
