import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";

const [file, expectedChecksum, ...extra] = process.argv.slice(2);
if (!file || !/^[a-f\d]{64}$/i.test(expectedChecksum || "") || extra.length) {
  console.error("Usage: node scripts/verify-document-integrity.mjs <file> <expected-sha256>");
  process.exitCode = 2;
} else {
  try {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    const actualChecksum = hash.digest("hex");
    const expected = expectedChecksum.toLowerCase();
    const matches = actualChecksum === expected;
    console.log(JSON.stringify({
      file: resolve(file),
      algorithm: "SHA-256",
      expectedChecksum: expected,
      actualChecksum,
      matches,
      checkedAt: new Date().toISOString(),
      statement: "Compares file bytes with the supplied reference hash. This does not establish approval, authorship, or signature authenticity.",
    }, null, 2));
    process.exitCode = matches ? 0 : 1;
  } catch (error) {
    console.error(`Unable to verify file: ${error.message}`);
    process.exitCode = 2;
  }
}
