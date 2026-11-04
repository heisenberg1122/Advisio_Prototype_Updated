import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateScript } from "../../walkthrough/shared/timing.mjs";

test("coordinator master covers 19 clips in five reusable chapters", async () => {
  const script = JSON.parse(await fs.readFile(new URL("../../walkthrough/coordinator/coordinator-script.json", import.meta.url)));
  validateScript(script);
  assert.equal(script.chapters.length, 5);
  const beats = script.chapters.flatMap((c) => c.beats);
  assert.deepEqual([...new Set(beats.map((b) => b.clip))], Array.from({ length: 19 }, (_, i) => i + 1));
  const text = beats.map((b) => b.narration).join(" ");
  assert.match(text, /Course Professor workspace/);
  assert.match(text, /Prelim, Midterm, and Finals/);
  assert.match(text, /same eligibility cycle/);
  assert.match(text, /separate prepared session with all required evaluations finalized/);
  assert.match(text, /panelists.*own accounts/i);
  assert.doesNotMatch(text, /\b(TAM|questionnaire|respondent|survey)\b/i);
});
test("onboarding language permits academic evaluation while rejecting study prompts", () => {
  const script = { audience: "general", pronunciation: { confirmed: true, alias: "ad vi sho" }, chapters: [{ id: "defense", title: "Defense", beats: [{ id: "form", callout: "Panel evaluation", narration: "Review the manuscript evaluation and rating levels." }] }] };
  assert.doesNotThrow(() => validateScript(script));
  for (const narration of ["Complete the system evaluation.", "Please answer the questionnaire.", "Ask respondents for platform ratings."]) {
    const changed = structuredClone(script); changed.chapters[0].beats[0].narration = narration;
    assert.throws(() => validateScript(changed), /Context-specific/);
  }
});
