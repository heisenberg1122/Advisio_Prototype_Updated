import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateScript } from "../../walkthrough/shared/timing.mjs";
test("Panelist variants keep evaluation methods separate and reuse shared narration", async () => {
  const read = async (id) => JSON.parse(await fs.readFile(new URL(`../../walkthrough/${id}/${id}-script.json`, import.meta.url)));
  const source = await read("panelist"); validateScript(source);
  const common = source.chapters.filter((c) => ["workspace", "preparation", "live", "results", "support"].includes(c.id));
  for (const variant of ["structured", "pdf"]) {
    const script = await read(`panelist-${variant}`); validateScript(script);
    assert.ok(script.chapters.some((c) => c.id === variant));
    assert.ok(!script.chapters.some((c) => c.id === (variant === "pdf" ? "structured" : "pdf")));
    for (const chapter of common) assert.deepEqual(script.chapters.find((c) => c.id === chapter.id), chapter);
  }
  const prep = await read("panelist-preparation"); validateScript(prep);
  assert.ok(prep.chapters.flatMap((c) => c.beats).every((b) => !["structured-draft", "pdf-draft", "official-result"].includes(b.action)));
  const narration = source.chapters.flatMap((c) => c.beats).map((b) => b.narration).join(" ");
  assert.match(narration, /saved privately/);
  assert.match(narration, /does not automatically determine the official outcome/);
  assert.match(narration, /signature must be confirmed again/);
});
