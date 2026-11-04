# Panelist video release — November 4, 2026

This release adds three independently watchable Panelist tutorials. Choose the evaluation video matching the defense's configured method; panelists do not need to watch both full variants.

| Video | Runtime | Published page |
| --- | ---: | --- |
| Structured Evaluation | 380.10 seconds | `/walkthroughs/panelist-structured/index.html` |
| PDF Evaluation | 371.90 seconds | `/walkthroughs/panelist-pdf/index.html` |
| Defense Preparation | 206.80 seconds | `/walkthroughs/panelist-preparation/index.html` |

Each includes the 1080p master, web viewing copy, captioned alternative, separate chapter MP4s, transcript, SRT/VTT, poster, and measured chapter metadata. All three appear in `/walkthroughs/index.html`. Their twenty-four MP4 files are the finalized deliverables, not raw footage. Explicit release allowlists, verification byte counts, per-file SHA-256 manifests, and scoped Git attributes protect the copied files. Accounts, passwords, tokens, isolated databases, capture evidence, and voice-provider caches remain ignored.

The recordings preserve invitation acceptance/decline, published manuscript access, private annotation drafts, explicit feedback sharing, separate structured/PDF evaluation methods, identity-confirmed PDF signing, invalidation of a signature after edits, final locking, and the distinction between panelist recommendations and an authorized official result. All records are fictional. Shared scenes and narration are reused across variants without duplicate speech generation.

Local validation covers nine recording tests, video TypeScript checks, web lint/build, media codecs and runtimes, captions, chapter downloads, responsive playback, seeking, volume controls, browser errors, and source/build file checksums. GitHub Actions and deployment status must be reported separately for the pushed commit.

## Branch and main distinction

Before this release, fetched `origin/main` was `dc437a3`, and `codex/qr-evaluation-local` was fifteen commits ahead: 190 changed files, 24,566 insertions, and 765 deletions. That confirms the note that recent QR evaluation, narrated walkthrough, and scoped-access work was absent from `main`.

PR #7 already targets `main` from this branch. Updating the branch updates that existing PR; it does not require a duplicate PR and does not itself merge `main`. The PR was still a draft when this release began. A deployment following `main` retains the older version until the changes are merged and its deployment succeeds. A branch preview can contain newer code independently.
