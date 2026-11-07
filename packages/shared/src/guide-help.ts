import { ADVISER_HELP } from "./adviser-help";
import { normalizeHelpSearch } from "./researcher-help";

export type GuideWorkspace = "researcher" | "adviser";

// Guide eligibility remains permission-scoped without depending on an AI module.
export const authorizedAdviserHelp = (permissions: readonly string[]) =>
  ADVISER_HELP.filter(
    (topic) => !topic.permission || permissions.includes(topic.permission),
  );

export function normalizeGuideQuestion(question: string) {
  return normalizeHelpSearch(question)
    .replace(/\b(paano|papano)\b/g, "how")
    .replace(/\b(saan|nasaan|asan)\b/g, "where")
    .replace(/\b(makikita|makita|tingnan|tignan)\b/g, "see")
    .replace(/\b(sumali|magjoin|mag join)\b/g, "join")
    .replace(/\b(klase|klas|clas)\b/g, "class")
    .replace(
      /\b(kagrupo|ka grupo|kagroup|groupmates|groop|grup)\b/g,
      "my group",
    )
    .replace(/\b(grupo)\b/g, "group")
    .replace(/\b(mga gawain|gawain)\b/g, "tasks")
    .replace(/\b(mag submit|magsubmit|magpasa|ipasa|submt)\b/g, "submit")
    .replace(/\b(baguhin|palitan|ichange|i change)\b/g, "change")
    .replace(/\b(marka|grado)\b/g, "grades")
    .replace(/\b(miyembro|members ng group)\b/g, "group members")
    .replace(/\b(ko|kong|akin|aking)\b/g, "my")
    .replace(/\b(sa|ng|ang|yung|iyong|ako|po|ba|naman)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
