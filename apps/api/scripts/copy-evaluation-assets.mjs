import fs from "node:fs/promises";
const source = new URL("../src/evaluation/evaluation-assets/", import.meta.url);
const destination = new URL("../dist/evaluation-assets/", import.meta.url);
await fs.mkdir(destination, { recursive: true });
await fs.cp(source, destination, { recursive: true });

const publicAssets = new URL("../../web/public/", import.meta.url);
const certificates = new URL("../dist/certificate-assets/", import.meta.url);
await fs.mkdir(certificates, { recursive: true });
await Promise.all([
  fs.copyFile(new URL("school-logo.png", publicAssets), new URL("school-logo.png", certificates)),
  fs.copyFile(new URL("advisio-logo.png", publicAssets), new URL("advisio-logo.png", certificates)),
  fs.cp(new URL("college-logos/", publicAssets), new URL("college-logos/", certificates), {
    recursive: true,
    filter: (name) => !name.endsWith(".md"),
  }),
  fs.copyFile(new URL("../assets/fonts/LiberationSans-Regular.ttf", import.meta.url),
    new URL("LiberationSans-Regular.ttf", certificates)),
]);
