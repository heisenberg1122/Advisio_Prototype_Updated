import test from "node:test";
import assert from "node:assert/strict";
import {
  captionsFromAlignment,
  buildTimeline,
  scriptHash,
  validateScript,
  subtitleText,
} from "../../walkthrough/shared/timing.mjs";
import { readScript } from "./common.mjs";

const aligned = (text) => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_, i) => i / 20),
  character_end_times_seconds: [...text].map((_, i) => (i + 1) / 20),
});
test("captions preserve exact spoken punctuation and use provider timestamps", () => {
  const text =
    "Inspect the submitted version. Read the adviser feedback before preparing a revision.";
  const captions = captionsFromAlignment(text, aligned(text));
  assert.equal(
    captions.map((caption) => caption.text.replaceAll("\n", " ")).join(" "),
    text,
  );
  assert.equal(captions[0].startMs, 0);
  assert.equal(captions.at(-1).endMs, text.length * 50);
  assert.ok(captions.every((caption) => caption.text.split("\n").length <= 2));
});
test("mismatched or nonmonotonic alignment is rejected instead of guessed", () => {
  assert.throws(
    () => captionsFromAlignment("ADVISIO", aligned("ad vi sho")),
    /exact original/,
  );
  const bad = aligned("Text.");
  bad.character_start_times_seconds[3] = -1;
  assert.throws(() => captionsFromAlignment("Text.", bad), /timestamps/);
});
test("long words split phrases before a third caption line is formed", () => {
  const text =
    "Prepared evaluation records describe requirements and submissions.";
  const captions = captionsFromAlignment(text, aligned(text));
  assert.ok(captions.every((caption) => caption.text.split("\n").length <= 2));
  assert.equal(
    captions.map((caption) => caption.text.replaceAll("\n", " ")).join(" "),
    text,
  );
});
test("editorial script accounts for all chapters and excludes specified TAM claims", async () => {
  const script = await readScript();
  validateScript(script);
  assert.equal(script.chapters.length, 14);
  assert.equal(
    script.chapters.reduce((sum, chapter) => sum + chapter.budgetSeconds, 0),
    script.proposedSeconds,
  );
  assert.equal(script.pronunciation.alias, "ad vi sho");
  const altered = structuredClone(script);
  altered.chapters[0].beats[0].narration = "This is easy.";
  assert.throws(() => validateScript(altered), /TAM language/);
  const contextual = structuredClone(script);
  contextual.chapters[0].beats[0].narration =
    "Continue to the evaluation questionnaire.";
  assert.throws(() => validateScript(contextual), /Context-specific language/);
});
test("timeline uses measured voice lengths and refuses stale or audit-only assets", () => {
  const script = {
    id: "test",
    title: "Test",
    pronunciation: { confirmed: true, alias: "confirmed" },
    fps: 30,
    width: 1920,
    height: 1080,
    maximumSeconds: 600,
    chapters: [
      {
        id: "intro",
        title: "Intro",
        beats: [
          {
            id: "one",
            action: "intro",
            narration: "Test.",
            callout: "Orientation",
          },
        ],
      },
    ],
  };
  const voice = {
    scriptHash: scriptHash(script),
    beats: {
      "intro--one": {
        audio: "one.mp3",
        durationSeconds: 2.13,
        captions: captionsFromAlignment("Test.", aligned("Test.")),
      },
    },
  };
  const captures = { scriptHash: scriptHash(script), beats: {} };
  const timeline = buildTimeline(script, voice, captures);
  assert.equal(timeline.durationInFrames, Math.ceil(2.68 * 30));
  assert.match(subtitleText(timeline), /00:00:00,000 --> 00:00:00,250\nTest\./);
  assert.ok(subtitleText(timeline, true).startsWith("WEBVTT\n\n"));
  assert.throws(
    () => buildTimeline(script, voice, { ...captures, auditOnly: true }),
    /Audit clips/,
  );
  assert.throws(
    () => buildTimeline(script, { ...voice, scriptHash: "old" }, captures),
    /Script changed/,
  );
});
