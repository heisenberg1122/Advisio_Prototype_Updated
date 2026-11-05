import fs from "node:fs/promises";
import {
  defaultEvaluationBranding,
  type StructuredForm,
} from "@research-management/validations";
import type { EvaluationCourse } from "./catalog.js";

const dataUrls = new Map<string, string>();
export async function evaluationAsset(name: string) {
  if (
    !/^(COA|CEA|CHTM|CIT|CNP|SAS|SBPA|SOE|demo-dean-signature)\.png$/.test(name)
  )
    throw new Error("Unknown evaluation asset.");
  let value = dataUrls.get(name);
  if (!value) {
    value = `data:image/png;base64,${(await fs.readFile(new URL(`./evaluation-assets/${name}`, import.meta.url))).toString("base64")}`;
    dataUrls.set(name, value);
  }
  return value;
}
export const formFamilies: Record<EvaluationCourse["id"], string> = {
  BSA: "Accountancy Research",
  BSCE: "Civil Engineering Design",
  BSARCH: "Architecture Thesis",
  BSTM: "Tourism Research",
  BSIT: "Information Technology Capstone",
  BSN: "Nursing Research",
  BSPSYCH: "Psychology Research",
  "BSBA-MM": "Business Research",
  BEED: "Education Research",
};
export async function demoEvaluationForm(
  course: EvaluationCourse,
  finalDefense = false,
): Promise<StructuredForm> {
  const name = `${formFamilies[course.id]} ${finalDefense ? "Final" : "Title"} Defense Evaluation`;
  return {
    name,
    branding: {
      ...defaultEvaluationBranding,
      collegeName: course.college,
      collegeLogo: await evaluationAsset(`${course.collegeCode}.png`),
      templateName: `${finalDefense ? "Final" : "Title"} Defense | Fictional Evaluation Sample`,
    },
    scale: [
      { value: 1, label: "Needs improvement" },
      { value: 2, label: "Developing" },
      { value: 3, label: "Proficient" },
      { value: 4, label: "Excellent" },
    ],
    presentation: [
      {
        id: "clarity",
        title: "Clarity of presentation",
        description: "Communicates the research clearly.",
        weight: 50,
      },
      {
        id: "response",
        title: "Response to questions",
        description: "Explains the research decisions and limitations.",
        weight: 50,
      },
    ],
    manuscript: [
      {
        id: "scope",
        title: "Research scope and objectives",
        description: course.objective,
        weight: 40,
      },
      {
        id: "method",
        title: finalDefense
          ? "Method, findings, and limitations"
          : "Appropriateness of proposed method",
        description: course.method,
        weight: 40,
      },
      {
        id: "organization",
        title: "Organization and consistency",
        description: "Organizes the manuscript clearly.",
        weight: 20,
      },
    ],
    feedbackLabel: "Recommendations",
    feedbackPrompt:
      "Record recommendations for this fictional evaluation sample.",
    signatureRequired: false,
  };
}
