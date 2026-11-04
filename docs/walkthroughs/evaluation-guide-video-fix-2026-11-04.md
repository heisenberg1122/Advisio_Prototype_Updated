# Evaluation guide video visibility

The Render evaluation guide was still serving a release without the published
walkthroughs. On 4 November, the live health endpoint reported evaluation mode
with a connected database, but Researcher and Dean media manifests and the video
gallery returned HTTP 404. A successful Vercel preview deployment does not update
this separate Render service. Its automatic deployment is disabled.

## Guide changes

- Show the Researcher video expanded by default in the evaluation guide. Keep
  the standalone tutorial's existing toggle and written guide.
- Connect the Research professor invitation to the Coordinator recording, and
  connect Adviser, Dean, and Panelist invitations to their published recordings.
- Give Panelists one player with Structured evaluation, PDF evaluation, and
  Defense preparation choices. Structured evaluation is initially selected.
- Include English captions, native playback controls, video downloads, and
  narration transcripts. Do not autoplay or require watching to continue.
- Remove the outdated “coming soon” notice and distinguish loading from failed
  Researcher video requests.
- Normalize HTML script line endings before computing the evaluation server's
  CSP hashes so Windows-built pages receive the correct hashes. Retain the
  existing bounded content security policy and access controls.

## Release the fix on the evaluation host

After the new commit's GitHub checks pass, open the existing Render service
`srv-dbkes34ipgvc73apmh6g` and choose **Manual Deploy → Deploy latest commit**.
The linked branch is `codex/qr-evaluation-local`. This does not require merging
the draft PR into `main`. Do not create another service or change the database.

When Render reports the intended commit live, check:

1. `/api/health` reports evaluation mode and a connected database.
2. `/walkthroughs/researcher/media.json` and each role's `media.json` return JSON,
   and the referenced MP4, poster, captions, and transcript are accessible.
3. `/evaluate/guide?role=student&course=BSIT` shows the expanded Researcher player.
4. The same guide with `professor`, `adviser`, `dean`, and `panelist` shows the
   matching role video. Switch the three Panelist choices and check playback.
5. Check phone width, captions, seeking, and continuing without watching.

Local verification and remote deployment status must be reported separately.
The code being pushed alone does not establish that the Render site is updated.
