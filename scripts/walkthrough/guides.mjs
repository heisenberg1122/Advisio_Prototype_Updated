import fs from "node:fs/promises";
import path from "node:path";
import { root, readScript } from "./common.mjs";
import {
  scriptHash,
  validateScript,
} from "../../walkthrough/shared/timing.mjs";
const script = await readScript();
validateScript(script);
const guide =
  "# ADVISIO Researcher Guide\n\nA guided tour of the Researcher workspace and its core features. Demonstrations use fictional research records.\n\n" +
  script.chapters
    .map(
      (chapter, index) =>
        `## ${index}. ${chapter.title}\n\n${chapter.guide}\n\nOptional activity: ${chapter.activity}\n`,
    )
    .join("\n");
await fs.writeFile(
  path.join(root, "docs/walkthroughs/researcher-evaluation-guide.md"),
  guide,
);
const storyboard =
  "# Researcher storyboard and draft narration\n\nEditorial target: 9:10; actual timing comes from narration alignment.\n\n" +
  script.chapters
    .map(
      (chapter, index) =>
        `## ${index}. ${chapter.title}\n\nRoute: ${chapter.route || "Title / handoff scene"}. Proposed budget: ${chapter.budgetSeconds} seconds.\n\n` +
        chapter.beats
          .map(
            (beat) =>
              `### ${beat.id} — ${beat.callout}\n\nCapture action: ${beat.action}.\n\n${beat.narration}\n`,
          )
          .join("\n"),
    )
    .join("\n");
await fs.writeFile(
  path.join(root, "docs/walkthroughs/researcher-storyboard.md"),
  storyboard,
);
const client = {
  title: script.title,
  scriptHash: scriptHash(script),
  chapters: script.chapters.map(({ id, title, guide, activity, beats }) => ({
    id,
    title,
    guide,
    activity,
    narration: beats.map((beat) => beat.narration).join("\n\n"),
  })),
};
await fs.writeFile(
  path.join(root, "apps/web/src/components/evaluation/researcher-guide.json"),
  JSON.stringify(client, null, 2) + "\n",
);
console.log(
  "Written guide, narration storyboard and accessible web text generated from the same script.",
);
