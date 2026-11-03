import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  root,
  assets,
  output,
  readJson,
  readScript,
  writeJson,
  duration,
} from "./common.mjs";
import {
  beatKey,
  captionsFromAlignment,
  scriptHash,
  validateScript,
} from "../../walkthrough/shared/timing.mjs";

// Only this local file is loaded. No unrelated application's credentials are read.
try {
  process.loadEnvFile?.(path.join(root, ".env.walkthrough.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const script = await readScript();
validateScript(script);
const key = process.env.ELEVENLABS_API_KEY,
  voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!key || !voiceId)
  throw new Error(
    "Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env.walkthrough.local. Never commit this file.",
  );
const model = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const voiceSettings = {
  stability: 0.65,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  speed: 1.02,
};
await fs.mkdir(path.join(assets, "audio"), { recursive: true });
async function api(endpoint, body) {
  const response = await fetch(`https://api.elevenlabs.io/v1/${endpoint}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const status = String(error?.detail?.status || "request_rejected")
      .replace(/[^a-z_0-9-]/gi, "")
      .slice(0, 80);
    throw new Error(
      `ElevenLabs request failed (${response.status}, ${status}). Completed narration is cached; credentials and response payload are not logged.`,
    );
  }
  return response.json();
}
const fingerprint = createHash("sha256")
  .update(
    JSON.stringify({
      voiceId,
      model,
      voiceSettings,
      pronunciation: script.pronunciation,
      direction: script.voiceDirection,
    }),
  )
  .digest("hex");
const latest = await readJson(path.join(output, "voice.json")).catch(
  () => null,
);
if (latest?.fingerprint)
  await writeJson(
    path.join(output, "voice-cache", `${latest.fingerprint}.json`),
    latest,
  );
const previous = await readJson(
  path.join(output, "voice-cache", `${fingerprint}.json`),
).catch(() => (latest?.fingerprint === fingerprint ? latest : null));
const requestedChapters = process.argv.includes("--sample")
  ? script.chapters.slice(0, 1)
  : script.chapters;
const requiredCounts = await Promise.all(
  requestedChapters.flatMap((chapter) =>
    chapter.beats.map(async (beat) => {
      const cached = previous?.beats[beatKey(chapter, beat)];
      const exists =
        cached?.audio &&
        (await fs.access(path.join(assets, cached.audio)).then(
          () => true,
          () => false,
        ));
      return cached?.text === beat.narration && exists
        ? 0
        : await readJson(
            path.join(
              output,
              "voice-raw",
              fingerprint,
              `${beatKey(chapter, beat)}.json`,
            ),
          ).then(
            (raw) => (raw.text === beat.narration ? 0 : beat.narration.length),
            () => beat.narration.length,
          );
    }),
  ),
);
const requiredCharacters = requiredCounts.reduce(
  (sum, count) => sum + count,
  0,
);
// Check the account before consuming credits. Some restricted keys cannot read
// account quota, so an unavailable lookup does not imply a generation failure.
if (requiredCharacters) {
  const quotaResponse = await fetch(
    "https://api.elevenlabs.io/v1/user/subscription",
    { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(30000) },
  );
  if (quotaResponse.ok) {
    const quota = await quotaResponse.json();
    const available = quota.character_limit - quota.character_count;
    if (Number.isFinite(available) && available < requiredCharacters)
      throw new Error(
        `Narration requires approximately ${requiredCharacters} character credits; the account has ${available}. No speech requests were made. Add quota or configure an account with sufficient quota.`,
      );
  }
}
await fs.mkdir(path.join(assets, "audio", fingerprint.slice(0, 16)), {
  recursive: true,
});
let dictionary =
  previous?.fingerprint === fingerprint ? previous.dictionary : null;
if (!dictionary) {
  const result = await api("pronunciation-dictionaries/add-from-rules", {
    name: "ADVISIO role walkthrough",
    rules: [
      {
        type: "alias",
        string_to_replace: script.pronunciation.word,
        alias: script.pronunciation.alias,
      },
    ],
  });
  dictionary = {
    pronunciation_dictionary_id: result.id,
    version_id: result.version_id,
  };
  if (!dictionary.pronunciation_dictionary_id || !dictionary.version_id)
    throw new Error("Pronunciation dictionary was not created.");
}
const result = {
  scriptHash: scriptHash(script),
  fingerprint,
  dictionary,
  voiceId,
  model,
  voiceSettings,
  provider: "ElevenLabs",
  beats: {},
};
for (const chapter of requestedChapters)
  for (const beat of chapter.beats) {
    const id = beatKey(chapter, beat),
      audio = `audio/${fingerprint.slice(0, 16)}/${id}.mp3`;
    const cached = previous?.fingerprint === fingerprint && previous.beats[id];
    if (
      cached?.text === beat.narration &&
      (await fs.access(path.join(assets, cached.audio)).then(
        () => true,
        () => false,
      ))
    )
      result.beats[id] = cached;
    else {
      console.log(`Generating narration: ${id}`);
      const rawFile = path.join(output, "voice-raw", fingerprint, `${id}.json`);
      const savedRaw = await readJson(rawFile).catch(() => null);
      const response =
        savedRaw?.text === beat.narration
          ? savedRaw.response
          : await api(
              `text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
              {
                text: beat.narration,
                model_id: model,
                pronunciation_dictionary_locators: [dictionary],
                voice_settings: voiceSettings,
                seed: 20261103,
              },
            );
      await writeJson(rawFile, { text: beat.narration, response });
      if (!response.audio_base64)
        throw new Error(`No narration audio for ${id}`);
      const captions = captionsFromAlignment(
        beat.narration,
        response.alignment,
      );
      await fs.writeFile(
        path.join(assets, audio),
        Buffer.from(response.audio_base64, "base64"),
      );
      const durationSeconds = await duration(path.join(assets, audio));
      const lastCaption = captions.at(-1);
      if (lastCaption.endMs > durationSeconds * 1000 + 100)
        throw new Error(`Caption extends past audio: ${id}`);
      result.beats[id] = {
        audio,
        text: beat.narration,
        captions,
        durationSeconds,
        alignment: response.alignment,
      };
    }
    // Persist each completed beat so failures do not repeat paid generation.
    await writeJson(path.join(output, "voice.json"), result);
    await writeJson(
      path.join(output, "voice-cache", `${fingerprint}.json`),
      result,
    );
  }
console.log(
  "Narration and exact-text alignment saved. Review pronunciation and delivery before release.",
);
