import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

// Load the repository-level configuration before services are evaluated.
// A service-specific apps/api/.env may override it when present.
dotenv.config({ path: path.resolve(configDir, "../../../../.env") });
dotenv.config({ path: path.resolve(configDir, "../../.env"), override: true });
