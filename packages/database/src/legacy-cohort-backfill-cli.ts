import { PrismaClient } from "@prisma/client";
import { open } from "node:fs/promises";
import {
  applyBackfill,
  backfillTarget,
  formatBackfillSummary,
  parseBackfillOptions,
  prepareBackfill,
} from "./legacy-cohort-backfill.js";

async function main() {
  const options = parseBackfillOptions(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Legacy cohort backfill: [--dry-run | --apply] [--create-safe-cohorts] [--json] [--output path]\nDefault: DRY RUN, zero database writes. Set BACKFILL_DATABASE_URL explicitly. Apply currently requires the isolated integration target and test flags; production application is separately reviewed.",
    );
    return;
  }
  backfillTarget(process.env, options.apply);
  // Refuse an existing/unwritable report destination before any database writes.
  const output = options.output
    ? await open(options.output, "wx", 0o600)
    : undefined;
  const db = new PrismaClient({
    datasources: { db: { url: process.env.BACKFILL_DATABASE_URL! } },
  });
  try {
    const { plan, target } = await prepareBackfill(db);
    const summary = formatBackfillSummary(
      plan,
      options.apply,
      options.createSafeCohorts,
    );
    if (options.json) console.error(summary);
    else console.log(summary);
    // The summary is emitted before any apply write.
    const report = options.apply
      ? {
          target,
          ...(await applyBackfill(db, plan, {
            createSafeCohorts: options.createSafeCohorts,
          })),
        }
      : { mode: "DRY RUN", writesPerformed: 0, target, plan };
    const json = JSON.stringify(report, null, 2);
    if (options.json) console.log(json);
    else {
      console.log(`Writes performed: ${report.writesPerformed}`);
      console.log(
        JSON.stringify(
          options.apply && "groups" in report ? report.groups : plan.findings,
          null,
          2,
        ),
      );
    }
    if (output) await output.writeFile(json + "\n");
    if (
      "groups" in report &&
      report.groups.some((group) =>
        ["STALE_PLAN", "APPLY_FAILED"].includes(group.status),
      )
    )
      process.exitCode = 2;
  } finally {
    await output?.close();
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Backfill refused or failed. Check explicit target, flags and report destination; no credentials or source data are printed. Review any apply report before retrying.",
  );
  process.exitCode = 1;
});
