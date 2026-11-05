import fs from "node:fs/promises";
const source = new URL("../src/evaluation/evaluation-assets/", import.meta.url);
const destination = new URL("../dist/evaluation-assets/", import.meta.url);
await fs.mkdir(destination, { recursive: true });
await fs.cp(source, destination, { recursive: true });
