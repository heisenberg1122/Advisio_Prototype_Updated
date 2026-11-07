import path from "node:path";
import { root, run } from "./common.mjs";
for (const file of [
  "guides.mjs",
  "voice.mjs",
  "capture-researcher.mjs",
  "render.mjs",
  "verify-export.mjs",
]) {
  await run(process.execPath, [
    path.join(root, "scripts/walkthrough", file),
  ]);
}
