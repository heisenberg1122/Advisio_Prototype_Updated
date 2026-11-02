import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import { hostedEvaluationEnvironment } from "./hosted-evaluation-config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const environment = hostedEvaluationEnvironment(process.env, root);
await fs.access(path.join(environment.EVALUATION_WEB_DIST, "index.html"));
await fs.access(environment.EVALUATION_SCHEMA_FILE);
await fs.mkdir(environment.EVALUATION_DATA_DIR, { recursive: true });
Object.assign(process.env, environment);
await import("../apps/api/dist/index.js");
