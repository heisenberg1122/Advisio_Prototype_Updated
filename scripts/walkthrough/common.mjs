import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
export const root = fileURLToPath(new URL("../../", import.meta.url));
export const role = process.argv.find((arg) => arg.startsWith("--role="))?.slice(7) || "researcher";
if (!["researcher", "dean", "coordinator", "adviser"].includes(role)) throw new Error("Unsupported walkthrough role.");
export const output = path.join(root, ".walkthrough", role);
export const assets = path.join(output, "assets");
export const readJson = async (file) =>
  JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""));
export const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n");
};
export const readScript = () =>
  readJson(path.join(root, `walkthrough/${role}/${role}-script.json`));
export async function prepareBrandAssets() {
  await fs.mkdir(path.join(assets, "branding"), { recursive: true });
  await fs.copyFile(
    path.join(root, "apps/web/public/advisio-logo.png"),
    path.join(assets, "branding/advisio-logo.png"),
  );
}
export function run(command, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "",
      stderr = "";
    if (capture) {
      child.stdout.on("data", (data) => (stdout += data));
      child.stderr.on("data", (data) => (stderr += data));
    }
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(
            new Error(
              `${path.basename(command)} exited ${code}. ${stderr.slice(-1200)}`,
            ),
          ),
    );
  });
}
export const encode = (args) =>
  run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
export const probe = async (file) =>
  JSON.parse(
    await run(
      ffprobe.path,
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
      true,
    ),
  );
export const duration = async (file) =>
  Number((await probe(file)).format.duration);
export async function renderBinaries() {
  if (process.platform !== "win32" || process.arch !== "x64") return null;
  // Keep Remotion's compositor/DLLs but use the same self-contained FFmpeg pair
  // as capture/export. This avoids a dependency on system FFmpeg runtime DLLs.
  const require = createRequire(import.meta.url);
  const source = path.dirname(
    require.resolve("@remotion/compositor-win32-x64-msvc/package.json"),
  );
  const target = path.join(output, "render-binaries");
  await fs.cp(source, target, { recursive: true });
  await fs.copyFile(ffmpeg, path.join(target, "ffmpeg.exe"));
  await fs.copyFile(ffprobe.path, path.join(target, "ffprobe.exe"));
  return target;
}
