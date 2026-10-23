# Defense packet manuscript annotations

Accepted panelists open **Defense Packet → Manuscript** (the dashboard's `documents` tab). The published manuscript opens in the same PDF annotation workspace used by evaluations, with highlighting, comments, text, circles, checks, crosses, move/resize, Delete/Backspace, and undo/redo. Manuscript review does not add signatures or numerical grades.

Drafts save privately and are keyed by defense session, panelist, and exact manuscript version. The original PDF bytes are copied into a review snapshot when the first draft is saved. A panelist cannot access another panelist's drafts; professors and research group members cannot access drafts either.

**Preview annotated manuscript** opens the exact rendered feedback copy. It includes numbered comment markers and appended comment pages. Download PDF is available from the preview. Sharing requires explicit confirmation that all annotations will be shared with the professor and active research group members.

**Share feedback** creates an immutable PDF snapshot with its source version, review revision, publication time, author, and SHA-256 checksum. It remains visible in **Shared manuscript feedback** to the author, college-authorized professors/facilitators, and active student leaders/members of that research group. Other panelists cannot read peer feedback copies. Further edits stay private and do not alter earlier publications. Sharing a revised draft creates a separate snapshot; sharing the same revision again reuses its snapshot.

Professors see shared copies under **Defense → Review packet → Shared manuscript feedback**. Research group members see them on their **Defense** page. Each recipient can preview and download fixed copies, including feedback on earlier manuscript versions. Removed project members and revoked panel assignments lose access.

The manuscript version selector retains the panelist's earlier reviews. If the professor publishes a replacement manuscript, the earlier review becomes read-only and the new version starts a separate blank draft. Existing feedback snapshots stay associated with their original version. Reviews of the current manuscript can continue after a defense completes; cancelled sessions prevent further edits or sharing.

## Deployment and checks

Apply the `20261023020000_packet_manuscript_annotations` migration and regenerate Prisma before starting the updated API. It adds separate private review and immutable publication tables. No existing evaluations or manuscript versions are rewritten. The workspace inherits the annotation renderer's 20 MB / 500-page limits and standard Latin text font.

This migration follows `20261023010000_pdf_evaluation_workspace` in the committed order and depends on the existing defense-session, user, and document-version schema. It creates only new tables, indexes, foreign keys, and an update guard, so older application code remains compatible. Roll back the application before considering schema recovery; dropping these tables after reviewers have used them would permanently remove private drafts and published feedback unless a verified database snapshot is restored.

```powershell
npm --workspace=api run type-check
npm --workspace=web run type-check
node node_modules/vitest/vitest.mjs run apps/api/src/services/pdf-annotation.service.test.ts
node --env-file=.env.demo.local scripts/verify-manuscript-annotations.mjs
```

The API check requires the running isolated demo API at `127.0.0.1:5055`, its guarded database at port `5435`, seeded demo accounts, and the AquaWise demo manuscript. It creates only an exact marked temporary session and replacement-version record, exercises private drafts, publication access, immutability, version history, preview invalidation, and assignment revocation, then removes those test records. It never modifies the user's actual review or original manuscript bytes. Its exported test PDF is under ignored `tmp/pdfs/`.
