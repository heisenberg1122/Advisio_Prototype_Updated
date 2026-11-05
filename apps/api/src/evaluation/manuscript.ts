import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EvaluationCourse } from "./catalog.js";

export type ManuscriptCourse = Omit<
  EvaluationCourse,
  "researchers" | "title" | "adviser"
> & {
  researchers: readonly string[];
  title: string;
  adviser: string;
};

// Deterministic, readable fixture documents use the same storage and viewer as uploads.
export async function manuscript(course: ManuscriptCourse, version: number) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${course.title} - Fictional evaluation sample v${version}`);
  pdf.setAuthor("ADVISIO Evaluation Workspace");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sections: Array<[string, string[]]> = [
    [
      "Research proposal",
      [
        course.title,
        `Research type: ${course.type}`,
        `College: ${course.college}`,
        `Researchers: ${course.researchers.join(", ")}`,
        `Adviser: ${course.adviser}`,
        `Version ${version}: ${version === 1 ? "Initial submission" : version === 2 ? "Revised manuscript" : "Prepared revision"}`,
        "FICTIONAL EVALUATION SAMPLE",
        "This proposal supports practice in the ADVISIO evaluation environment. All people, research groups, sites, review histories, and proposed records are fictional. It does not report an actual study, participant recruitment, findings, financial accounts, patient records, or an approved engineering design.",
        "Read the background, questions, framework, method, and planned outputs on the following pages. Use the review notes to identify details that can be improved before a real proposal would be ready.",
      ],
    ],
    [
      "Chapter 1 - Background and objectives",
      [
        "Introduction and background",
        course.objective,
        "The fictional research group identified a need to make its assumptions and planned outputs explicit. The proposal organizes that need into reviewable questions and a preliminary method. It describes planned work rather than completed data collection.",
        "Statement of the problem",
        version === 1
          ? "The group proposes to examine the topic broadly. The intended population or design context and the link between the problem and the proposed measures still require clarification. This deliberate gap is available for reviewer feedback."
          : `The proposal focuses on the following context: ${course.details[0]} The remaining review question concerns how the chosen evidence will support each planned output.`,
        "Objectives",
        course.objective,
        version === 1
          ? "Prepare a useful research output. The initial objective needs a measurable definition and a clear connection to the proposed method."
          : "Document the stated context; organize the requirements or variables into an evidence matrix; and assess whether the planned method can address each objective within the proposed scope.",
        "Scope and limits",
        ...course.details,
      ],
    ],
    [
      "Chapter 2 - Conceptual framework",
      [
        "Related literature preparation",
        `The planned literature search concerns ${course.label.toLowerCase()} and the proposal's stated research problem. The group will record each source's purpose, context, method, limitations, and relevance in a literature matrix. No invented article or empirical result is presented as a verified reference.`,
        "Framework summary",
        "The framework connects the problem context to the inputs, the proposed collection or design process, and the intended outputs. Each connection must be explained instead of treating the framework diagram as evidence that the proposal already works.",
        ...course.details,
        "Source selection and comparison",
        "The group will compare sources with similar definitions and contexts, flag disagreements, and distinguish descriptions from causal evidence. It will record bibliographic details before using a source in the final manuscript.",
        "Outstanding review point",
        course.feedback,
        version >= 2
          ? "Revision applied: the context and objectives now use consistent terms. The next review should check the completeness of the method and evidence matrix."
          : "Initial submission: the literature matrix and variable or requirement definitions have not yet been aligned. These are intentional review issues.",
      ],
    ],
    [
      "Chapter 3 - Proposed methodology",
      [
        "Research design",
        course.method,
        "Setting and inputs",
        ...course.details,
        "Procedure",
        version < 3
          ? "The initial procedure identifies preparation, collection or design, and analysis phases. Version 2 clarifies the context but still needs an explicit checklist of eligible inputs, an objective-to-evidence matrix, and a method for handling missing or unsuitable records."
          : `Prepared revision: ${course.revision} Before beginning, the group will verify the stated context and input criteria, pilot the instrument or review the design inputs, log excluded or missing entries, and preserve the version of every working document.`,
        "Analysis and quality checks",
        "Organize observations or requirements against the objectives. Check completeness, consistency, and stated assumptions before summarizing results. Explain exclusions and limitations. Treat proposed calculations or associations as exercises until all inputs and procedures have been independently checked.",
        "Ethics and information handling",
        "Participation, if later approved, must be voluntary. Collect only information necessary for the stated objectives, separate identifying details from working records, limit access, and define retention and deletion procedures. This fictional evaluation sample contains no real respondent data.",
      ],
    ],
    [
      "Planned outputs and review response",
      [
        "Proposed outcomes or system scope",
        course.objective,
        ...course.details,
        "Deliverables",
        "The planned package contains a refined proposal, an objective-to-evidence matrix, an instrument or design-input checklist, and a review log. Findings and a final design are outside the scope of this early-stage sample.",
        "Review history",
        "Version 1: Initial problem, objectives, and procedure submitted with deliberate review issues.",
        ...(version >= 2
          ? [
              "Version 2: Context and objectives clarified; detailed method revisions remain open.",
            ]
          : []),
        ...(version >= 3
          ? [`Version 3: Prepared response - ${course.revision}`]
          : []),
        "Supporting information and references",
        "ADVISIO fictional evaluation brief: research context and scenario supplied in this workspace.",
        "Fictional adviser review log: feedback supplied with the manuscript version history.",
        "Literature search plan: locate and verify discipline-specific academic sources before a real submission. This sample intentionally makes no claim to have verified external publications.",
      ],
    ],
  ];
  for (const [index, [heading, paragraphs]] of sections.entries()) {
    const page = pdf.addPage([595, 842]);
    const write = (value: string, size: number, heavy = false) => {
      const face = heavy ? bold : font;
      const words = value.split(/\s+/);
      let row = "";
      for (const word of words) {
        const next = row ? `${row} ${word}` : word;
        if (face.widthOfTextAtSize(next, size) > 491 && row) {
          page.drawText(row, { x: 52, y, size, font: face });
          y -= size + 4;
          row = word;
        } else row = next;
      }
      if (row) page.drawText(row, { x: 52, y, size, font: face });
      y -= size + 13;
      if (y < 65)
        throw new Error(`Evaluation manuscript page ${index + 1} overflows`);
    };
    let y = 790;
    write("ADVISIO | FICTIONAL EVALUATION SAMPLE", 9, true);
    write(heading, 17, true);
    for (const paragraph of paragraphs) write(paragraph, 10.5);
    page.drawText(
      `${course.id} | Manuscript v${version} | ${index + 1} / ${sections.length}`,
      {
        x: 52,
        y: 30,
        size: 9,
        font,
        color: rgb(0.3, 0.35, 0.4),
      },
    );
  }
  return Buffer.from(await pdf.save());
}
