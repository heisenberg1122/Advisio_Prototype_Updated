# Faculty Adviser walkthrough

The reusable master follows 18 script clips in six chapters: workspace and advising requests; research group management; manuscript review and endorsement; consultations and research guidance; defense preparation and academic records; communication and follow-up. The optional withdrawal module is outside this introductory master.

The attached script is adapted to current role permissions and visible controls before voice generation. The manuscript lifecycle remains central: exact-version review, passage comments, a permanent minor-revision decision, a later researcher submission for the same study, and adviser approval. That approval does not replace other faculty gates. Formal PDF endorsement uses the current Inbox attachment signing interface, placement controls, password confirmation, and preserved signed-copy record. Official Copies remains a separate publication register. Consultations distinguish scheduled requests from an independently prepared completed session with saved notes and action items. No real meeting is opened.

## Production and credit reuse

Rehearse every screen before generating narration. Use the established ElevenLabs narrator and pronunciation settings. Generate narration per beat and preserve unchanged audio through visual corrections. Timed capture supports `--resume`; successful segments are retained. The shared native compositor reuses fingerprinted compositions only when the design, exact footage, audio, timing, and measured duration match. Full final rendering follows a successful timed capture.

`adviser-server.mjs` uses a dedicated `walkthrough_adviser_<random>` schema in the local demo cluster and loopback web/API ports 3400/5400. `--fresh` creates a new schema without deleting older fixtures. External service credentials are blank; email and workers are disabled. Native authentication, academic scope, review assignments, and signing confirmation remain active. Fictional credentials and private fixture identifiers stay in ignored `.walkthrough/adviser/demo.json`. The researcher owns the later revision submission; the coordinator uses its own permissions to assign any required exact-version review. The adviser cannot impersonate those roles.

## Commands

```text
npm run walkthrough:adviser:dev -- --fresh
node scripts/walkthrough/capture-adviser.mjs --role=adviser --audit
npm run walkthrough:adviser:voice
npm run walkthrough:adviser:capture
npm run walkthrough:adviser:render
npm run walkthrough:adviser:verify
npm run walkthrough:adviser:preview
node scripts/walkthrough/verify-adviser-playback.mjs
```

After a mutating rehearsal, prepare a fresh fixture before production capture. Resume failures against the same fixture and matching script, without resetting academic state or regenerating unchanged narration. Production rendering rejects audit captures, stale audio, missing clips, capture errors, wrong dimensions, and clips shorter than their narration.

Exports remain in `.walkthrough/adviser/export/`: 1080p master, web and captioned videos, six separate 1080p chapters, SRT/VTT, transcript, poster, and chapter metadata. The local preview runs at `http://localhost:3410`. Verification covers codecs, frame rate, dimensions, full/chapter runtimes, captions, downloads, desktop/mobile playback, seeking, volume, errors, and overflow.

## Readability correction and recorded provenance

Visual inspection found that Adviser-specific CSS capped the decision dialog at 720 pixels, compressing its manuscript preview beside the feedback column. A rule scoped to the Adviser dialog containing the recommendation field restores the intended 1400-pixel maximum. Compact history dialogs, theme colors, decision handlers, permissions, and mobile stacking remain intact. Desktop (1366 × 768) and mobile (390 × 844) checks confirmed viewport bounds, no horizontal overflow, and a readable desktop PDF canvas wider than 500 pixels.

The three affected review scenes were retaken in a fresh fictional fixture after that layout check. Fifteen other timed screen segments and all twenty narration segments were preserved. Captures retain each segment's fixture schema; ignored manifests and `retakes.json` preserve the original fixture and retake reason. A later researcher revision uses the original document's version-upload and stored-version submission flow, preserving its immutable snapshot and prior history. Separate required coordinator review remains active after the Adviser decision. No academic decision is reversed for a retake, and no unchanged narration is regenerated.

For urgent delivery, add `--release-first` to the render command. It exports the full web video first using the same 30 fps footage, a CRF 20 encode, and measured audio normalization. An early manifest, poster, transcript, and captions support immediate viewing. The preview exposes only completed files while the 1080p master, captioned copy, and chapter files finish. `verify-adviser-playback.mjs --video-only` checks this initial release; full media and download verification still run after the complete package is available.

## Completed local release — November 4, 2026

The verified recording runs 484.6 seconds (about 8:05), with six chapters, eighteen screen segments, and twenty narration segments including the branded introduction and closing. All nine MP4 exports passed codec, dimensions, frame-rate, audio, and runtime checks. All 166 caption phrases, six chapter downloads, desktop/mobile playback, chapter seeking, volume controls, viewport bounds, and browser-error checks passed. The eight recording tests, video type check, web production build, and desktop/mobile review-layout checks passed. Final exported frames confirmed the readable highlighted comment and saved signed PDF. Narration was generated once after rehearsal and reused for all visual retakes. The complete preview and downloads are available at `http://localhost:3410` while its local server runs.
