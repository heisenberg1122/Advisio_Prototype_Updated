# Panelist walkthrough production

The source follows fourteen clip positions with interchangeable structured (9A–10A) and PDF (9B–10B) evaluation modules. Three deliverables are derived from it: Structured Evaluation, PDF Evaluation, and Defense Preparation. Shared scenes and narration are generated once and copied into each applicable variant; the two evaluation methods are never mixed within a released variant.

## Accuracy and isolation

The current sidebar includes Overview, Manuscript Reviews, Official Copies, Evaluations, Results, Defense Schedule, Calendar, Messages, and Inbox. Published defense manuscripts and private annotation drafts are accessed from the assigned defense's **Open defense documents** action, rather than ordinary manuscript-review assignments.

`panelist-server.mjs` creates a dedicated `walkthrough_panelist_<random>` schema in the existing local demo cluster, with loopback web/API ports 3500/5500. It blanks external credentials and disables email and workers. Fictional account manifests remain ignored. `--fresh` creates a new schema without deleting old fixtures. Normal authentication, assignment restrictions, accepted invitations, approved prerequisites, exact-cycle Dean signing, packet publication, evaluation confirmation, and result-release checks remain active.

Separate examples cover a pending invitation and acceptance, an independently declined invitation, a live structured evaluation with two researchers, a live PDF evaluation with required signing, and a completed result released by its authorized coordinator after both panelists finalized their own assessments. Preparation uses each actor's native authenticated API. The panelist never starts a coordinator-owned session or releases an outcome. No live meeting is opened and no real academic data is changed.

Manuscript annotation drafts remain private until a current preview is explicitly confirmed and shared. The shared annotated copy leaves the source manuscript intact. Structured submissions require ratings, written revision instructions when applicable, a configured signature, a current PDF preview, and final confirmation. PDF editing after signature invalidates that signature; a fresh signature and preview are required before final lock. Another panelist's private draft is never exposed through the demo account.

## Efficient production

Rehearse every path before generating narration. Generate the source narration once using the established narrator, voice settings, and ADVISIO pronunciation dictionary. Preserve unchanged audio through any visual correction. Timed capture saves each successful scene and supports `--resume`. Variant derivation rejects audit footage, reported errors, stale scripts, and incompatible narration. Rendering remains 30 fps with the existing branded framing, measured captions, and normalized narration.

```text
node --import tsx scripts/walkthrough/panelist-server.mjs --fresh
node --import tsx scripts/walkthrough/prepare-panelist.mjs
node scripts/walkthrough/capture-panelist.mjs --role=panelist --audit
node scripts/walkthrough/voice.mjs --role=panelist
node scripts/walkthrough/capture-panelist.mjs --role=panelist
node scripts/walkthrough/panelist-variants.mjs
node scripts/walkthrough/render.mjs --role=panelist-structured --native --chapters --release-first
node scripts/walkthrough/render.mjs --role=panelist-pdf --native --chapters --release-first
node scripts/walkthrough/render.mjs --role=panelist-preparation --native --chapters --release-first
node scripts/walkthrough/preview-panelist.mjs
node scripts/walkthrough/verify-export.mjs --role=panelist-structured
node scripts/walkthrough/verify-panelist-playback.mjs --variant=structured
```

After a mutating rehearsal, prepare a fresh fixture before production. Resume failed captures against their same fixture and matching script. Final artifacts stay local under `.walkthrough/panelist-*/export/`. Preview is `http://localhost:3510/`, with `/structured/`, `/pdf/`, and `/preparation/` players. Each variant includes web video, 1080p master, captioned alternative, separate chapters, transcript, SRT/VTT, poster, and measured metadata. Early viewing copies can be released before additional downloads finish. Codec, timing, caption, desktop/mobile playback, seeking, download, and overflow checks run for every completed variant. Remote video packaging uses the shared verified-file publisher; a branch push remains distinct from merging `main` or deploying production.

## Completed local recording — November 4, 2026

| Output | Runtime | Chapters | Caption phrases |
| --- | ---: | ---: | ---: |
| Structured Evaluation | 380.10 seconds | 6 | 127 |
| PDF Evaluation | 371.90 seconds | 6 | 124 |
| Defense Preparation | 206.80 seconds | 3 | 67 |

All fifteen timed screen scenes passed capture with no reported errors. Seventeen narration segments were generated once after rehearsal; common scenes and audio were reused across the three derived variants without additional speech generation. Structured and PDF modules remain in their respective outputs. Final artifacts include twenty-four MP4 files across the full and chapter exports.

All three packages passed media codec, 30 fps frame-rate, dimensions, audio, full/chapter runtime, and caption checks. Desktop/mobile verification passed playback, chapter seeking, volume controls, download links, browser-error checks, and horizontal overflow. The nine recording tests, video TypeScript check, and web production build passed. Visual QA included manuscript annotations, the PDF final signature/lock/download scene, and responsive players. Private fixture manifests and provider responses remain local and ignored. These checks were completed before preparing the branch release. Pushing the release does not merge `main` or establish production deployment success.
