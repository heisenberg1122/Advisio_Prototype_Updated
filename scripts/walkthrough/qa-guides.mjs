import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.argv[2] ?? "http://localhost:3100";
const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [768, 1024],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(new URL("/walkthrough/research-dashboard", baseURL).href);
    await page
      .getByRole("heading", {
        name: "ADVISIO Researcher Walkthrough",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page
        .locator("#researcher-written-guide")
        .evaluate((guide) => guide.open),
      true,
    );
    await page.getByText("Read narration transcript", { exact: true }).click();
    assert.equal(
      await page
        .locator(".rw-transcript")
        .evaluate((transcript) => transcript.open),
      true,
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Explore ADVISIO", exact: true })
        .getAttribute("href"),
      "/student/dashboard",
    );
    assert.equal(await page.locator("video").count(), 0);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Researcher written guide, transcript, and dashboard link verified at four viewport sizes.",
  );
} finally {
  await browser.close();
}
