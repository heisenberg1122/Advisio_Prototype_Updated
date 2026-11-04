import { createHash } from "node:crypto";

export const scriptHash = (script) =>
  createHash("sha256").update(JSON.stringify(script)).digest("hex");
export const beatKey = (chapter, beat) => `${chapter.id}--${beat.id}`;
export const biasTerms =
  /\b(easy|easier|simple to use|intuitive|convenient|efficient|useful|helpful|powerful|seamless|fast|time-saving|organized better|improves productivity|improves research|makes research easier|user-friendly|effective)\b/i;

export function validateScript(script) {
  if (!script.pronunciation.confirmed || !script.pronunciation.alias.trim())
    throw new Error("Confirm the ADVISIO pronunciation before narration.");
  const seen = new Set();
  for (const chapter of script.chapters) {
    for (const beat of chapter.beats) {
      const key = beatKey(chapter, beat);
      if (seen.has(key)) throw new Error(`Duplicate beat: ${key}`);
      seen.add(key);
      if (!beat.narration.trim()) throw new Error(`Missing narration: ${key}`);
      if (biasTerms.test(`${beat.narration} ${beat.callout}`))
        throw new Error(`TAM language review failed: ${key}`);
      if (
        script.audience === "general" &&
        /\b(TAM|respondents?|questionnaires?|surveys?|evaluators?|testing participants?|(?:system|platform|product)\s+(?:evaluation|ratings?)|evaluation\s+(?:activity|study|session))\b/i.test(
          `${chapter.title} ${beat.narration} ${beat.callout}`,
        )
      )
        throw new Error(`Context-specific language in master: ${key}`);
      if (/https?:|@/.test(beat.narration))
        throw new Error(`Unexpected address in narration: ${key}`);
    }
  }
}

// Preserve punctuation and the original caption text while using character-level
// alignment. Never estimate subtitle timing from word count or chapter budgets.
export function captionsFromAlignment(text, alignment) {
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = alignment || {};
  if (
    !characters?.length ||
    characters.join("") !== text ||
    starts?.length !== characters.length ||
    ends?.length !== characters.length
  ) {
    throw new Error("Narration alignment must match the exact original text.");
  }
  for (let i = 0; i < starts.length; i++) {
    if (
      ![starts[i], ends[i]].every(Number.isFinite) ||
      starts[i] < 0 ||
      ends[i] < starts[i] ||
      (i && starts[i] < starts[i - 1])
    )
      throw new Error("Invalid narration timestamps.");
  }
  const words = [...text.matchAll(/\S+/g)];
  const captions = [];
  let phrase = [];
  const wrap = (content) => {
    const lines = [""];
    for (const word of content.split(" ")) {
      const line = lines.at(-1);
      if (line && `${line} ${word}`.length > 38) lines.push(word);
      else lines[lines.length - 1] = `${line}${line ? " " : ""}${word}`;
    }
    return lines;
  };
  const flush = () => {
    if (!phrase.length) return;
    const first = phrase[0],
      last = phrase.at(-1);
    const content = phrase.map((word) => word[0]).join(" ");
    // At most two 38-character lines; avoid tiny mobile text from wide lines.
    const lines = wrap(content);
    if (lines.length > 2) throw new Error("Caption exceeds two lines.");
    captions.push({
      text: lines.join("\n"),
      startMs: Math.round(starts[first.index] * 1000),
      endMs: Math.round(ends[last.index + last[0].length - 1] * 1000),
      timestampMs: Math.round(starts[first.index] * 1000),
      confidence: null,
    });
    phrase = [];
  };
  for (const word of words) {
    const candidate = [...phrase, word].map((item) => item[0]).join(" ");
    if (
      phrase.length &&
      (candidate.length > 68 ||
        wrap(candidate).length > 2 ||
        starts[word.index] - starts[phrase[0].index] > 4.2)
    )
      flush();
    phrase.push(word);
    if (/[.!?;:]$/.test(word[0])) flush();
  }
  flush();
  return captions;
}

export function buildTimeline(script, voice, captures) {
  validateScript(script);
  if (
    voice.scriptHash !== scriptHash(script) ||
    captures.scriptHash !== scriptHash(script)
  )
    throw new Error("Script changed: regenerate narration and capture.");
  if (captures.auditOnly)
    throw new Error(
      "Audit clips cannot be published as a narrated walkthrough. Recapture with narration.",
    );
  if (captures.errors?.length)
    throw new Error(
      "Capture reported errors; complete a clean capture before publishing.",
    );
  let frame = 0;
  const chapters = script.chapters.map((chapter, index) => {
    const chapterStart = frame;
    const beats = chapter.beats.map((beat) => {
      const key = beatKey(chapter, beat),
        audio = voice.beats[key],
        capture = captures.beats[key];
      if (
        !audio?.captions?.length ||
        !Number.isFinite(audio.durationSeconds) ||
        audio.durationSeconds <= 0
      )
        throw new Error(`Missing voice: ${key}`);
      if (beat.action !== "intro" && beat.action !== "outro" && !capture?.clip)
        throw new Error(`Missing capture: ${key}`);
      const durationInFrames = Math.ceil(
        (audio.durationSeconds + 0.55) * script.fps,
      );
      if (
        capture?.durationSeconds &&
        capture.durationSeconds + 0.15 < durationInFrames / script.fps
      )
        throw new Error(`Capture shorter than narration: ${key}`);
      const result = {
        ...beat,
        key,
        from: frame,
        durationInFrames,
        audio: audio.audio,
        captions: audio.captions,
        capture,
      };
      frame += durationInFrames;
      return result;
    });
    return {
      ...chapter,
      index,
      from: chapterStart,
      durationInFrames: frame - chapterStart,
      beats,
    };
  });
  if (frame / script.fps > script.maximumSeconds)
    throw new Error(
      "Walkthrough exceeds ten minutes; revise narration before publishing.",
    );
  return {
    id: script.id,
    title: script.title,
    fps: script.fps,
    width: script.width,
    height: script.height,
    durationInFrames: frame,
    scriptHash: scriptHash(script),
    chapters,
  };
}

export function subtitleText(timeline, vtt = false) {
  const stamp = (ms) => {
    const value = Math.round(ms);
    return `${String(Math.floor(value / 3600000)).padStart(2, "0")}:${String(Math.floor(value / 60000) % 60).padStart(2, "0")}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}${vtt ? "." : ","}${String(value % 1000).padStart(3, "0")}`;
  };
  let counter = 0;
  return (
    (vtt ? "WEBVTT\n\n" : "") +
    timeline.chapters
      .flatMap((chapter) =>
        chapter.beats.flatMap((beat) =>
          beat.captions.map((caption) => {
            const offset = (beat.from / timeline.fps) * 1000;
            return `${++counter}\n${stamp(offset + caption.startMs)} --> ${stamp(offset + caption.endMs)}\n${caption.text}\n`;
          }),
        ),
      )
      .join("\n")
  );
}

export function subtitleAss(timeline) {
  const stamp = (milliseconds) => {
    const cs = Math.round(milliseconds / 10);
    return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
  };
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,38,&H00FFFFFF,&H00FFFFFF,&H00432E12,&H00432E12,0,0,0,0,100,100,0,0,3,6,0,2,80,80,44,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  return (
    header +
    timeline.chapters
      .flatMap((chapter) =>
        chapter.beats.flatMap((beat) =>
          beat.captions.map((caption) => {
            const offset = (beat.from / timeline.fps) * 1000;
            const text = caption.text
              .replaceAll("{", "")
              .replaceAll("}", "")
              .replaceAll("\n", "\\N");
            return `Dialogue: 0,${stamp(offset + caption.startMs)},${stamp(offset + caption.endMs)},Default,,0,0,0,,${text}`;
          }),
        ),
      )
      .join("\n") +
    "\n"
  );
}
