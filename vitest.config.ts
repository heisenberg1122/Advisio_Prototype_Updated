import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Workspace tests run with the repository as --root. Keep their imports aligned
// with the frontend's Vite configuration, including tests that import real UI.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
      "next/link": fileURLToPath(
        new URL("./apps/web/src/lib/router-compat.tsx", import.meta.url),
      ),
      "next/navigation": fileURLToPath(
        new URL("./apps/web/src/lib/router-compat.tsx", import.meta.url),
      ),
    },
  },
  esbuild: { jsx: "automatic" },
});
