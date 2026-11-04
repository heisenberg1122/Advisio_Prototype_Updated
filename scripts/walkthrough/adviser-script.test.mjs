import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateScript } from "../../walkthrough/shared/timing.mjs";

test("Adviser master retains 18 clips, six chapters, and academic boundaries", async () => {
  const script = JSON.parse(await fs.readFile(new URL("../../walkthrough/adviser/adviser-script.json", import.meta.url)));
  validateScript(script);
  assert.equal(script.chapters.length, 6);
  const beats = script.chapters.flatMap((chapter) => chapter.beats);
  assert.deepEqual([...new Set(beats.map((beat) => beat.clip))], Array.from({ length: 18 }, (_, index) => index + 1));
  assert.ok(beats.some((beat) => beat.action === "feedback"));
  assert.ok(beats.some((beat) => beat.action === "revised"));
  const text = beats.map((beat) => beat.narration).join(" ");
  assert.match(text, /same study/);
  assert.match(text, /Other required faculty reviews/);
  assert.match(text, /Confirm your password/);
  assert.match(text, /separate completed demonstration session/);
  assert.match(text, /does not release the official defense result/);
  assert.doesNotMatch(text, /\b(TAM|questionnaire|respondent|survey)\b/i);
});
