# PDF defense evaluations

Professors can choose **Defense → Review packet → Evaluation method → Complete the evaluation PDF directly**. Upload or select an evaluation template, choose whether a signature is required, and publish. This uses the department's existing PDF without question detection or field mapping.

Accepted panelists open **Evaluations** for their assigned live defense. Each panelist receives a private copy with checkmarks, circles, crosses, highlights, text boxes, and page-specific comments. Marks can be moved, resized, removed, undone, and redone. Drafts save automatically after editing; Save draft is also available. Coordinates are normalized to the displayed page, including rotated/cropped pages, to retain placement across zoom levels.

Comments appear as numbered markers with their full text on appended comment pages in the exported PDF. Text boxes must be large enough for their text; export never silently truncates text. The original uploaded file remains unchanged.

Added text uses the standard PDF Latin font in this first version. Unsupported characters produce a validation message rather than being replaced or omitted.

Panelists may place a saved, drawn, or typed signature with password confirmation. A newly drawn/typed signature can optionally be saved to their private profile. Editing afterward invalidates the signature and preview. If the professor requires a signature, submission is blocked until it is applied.

Panelists preview the current revision, confirm review, and submit. Final PDF bytes and their SHA-256 checksum are retained and locked. Professors see only final PDFs under **Review packet → Submitted PDF evaluations**. Panelists can reopen their final copy from Results or the defense's evaluation link, including after the defense ends.

PDF evaluations count toward defense completion, but visual ratings do not create numerical grades. The existing scored-rubric workflow remains available for sessions that need calculated scores. The template and signature requirement cannot change after drafting begins. Reviewer assignment and session access are checked on every request; optimistic revision checks reject conflicting saves.

## Deployment and verification

Apply the committed `20261023010000_pdf_evaluation_workspace` Prisma migration and regenerate the Prisma client before starting the updated API. The migration adds packet settings and a separate PDF evaluation table. Source snapshots, drafts, signature bytes, and final PDFs are stored in the database; uploaded templates continue to use the configured document storage provider. Templates are limited to 20 MB and 500 pages.

The migration follows `20261022010000_mail_workspace_state` and precedes `20261023020000_packet_manuscript_annotations`. It is backward-compatible and additive: existing packet rows receive `RUBRIC` and `false` defaults, and no existing evaluation or document bytes are rewritten. The `defense_packets` alteration takes a table lock, so staging must use a controlled migration window even though PostgreSQL 16 normally applies constant defaults without a full table rewrite. Roll back the application first; dropping the new table or columns after use would destroy PDF evaluation data.

Unit checks:

```powershell
node node_modules/vitest/vitest.mjs run apps/api/src/services/pdf-annotation.service.test.ts
npm --workspace=api run type-check
npm --workspace=web run type-check
```

The disposable API verification script requires the verified isolated demo database, the running demo API on port 5055, seeded professor/panelist accounts, and the uploaded two-page capstone evaluation PDF for AquaWise. It uses a committed test-only PNG, never signs the user's actual practice session, and never changes a saved signature profile. It checks uploads, access control, draft restoration, revision conflicts, fixed settings, signature confirmation/invalidation, required signatures, preview, final locking, and professor downloads, then removes its exact test session and upload.

```powershell
node --env-file=.env.demo.local scripts/verify-pdf-evaluation.mjs
```
