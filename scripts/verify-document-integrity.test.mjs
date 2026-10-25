import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./verify-document-integrity.mjs", import.meta.url));
const reference = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

test("offline verifier checks a known SHA-256 vector, modification, and invalid input", () => {
  const directory = mkdtempSync(join(tmpdir(), "advisio-integrity-"));
  const file = join(directory, "sample with spaces.pdf");
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  try {
    writeFileSync(file, "abc");
    const valid = run(file, reference.toUpperCase());
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).actualChecksum, reference);
    assert.equal(JSON.parse(valid.stdout).matches, true);
    writeFileSync(file, "abd");
    const changed = run(file, reference);
    assert.equal(changed.status, 1, changed.stderr);
    assert.equal(JSON.parse(changed.stdout).matches, false);
    assert.equal(run(file, "invalid").status, 2);
    assert.equal(run(join(directory, "missing.pdf"), reference).status, 2);
    assert.equal(run(file, reference, "extra").status, 2);
  } finally {
    unlinkSync(file);
    rmdirSync(directory);
  }
});
