# Researcher walkthrough audit report and storyboard

## Audit conclusion

See [the complete feature inventory](researcher-feature-inventory.md) for current capabilities, source routes, seed gaps and all exclusions. No other role is implemented in this project. The older 16-second mock dashboard is not used as capture material.

## Proposed duration

Editorial target: **9 minutes 10 seconds (550 seconds)**, including introduction and handoff. This is an exact proposed budget, not a fabricated measured runtime. Final timing must come from ElevenLabs alignment and measured audio lengths, with short reading pauses. The generation validator rejects a runtime above ten minutes. Do not pad chapters to meet the estimate.

| Chapter                              | Screen/action and capture requirement                                                                                                                                                      | Attention label                                           | Budget |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -----: |
| 0 Introduction                       | Restrained ADVISIO / Researcher Walkthrough title; fictional-data notice                                                                                                                   | Prepared evaluation workspace                             |    20s |
| 1 Overview                           | Real dashboard, current milestone, pending task, sidebar and notifications                                                                                                                 | Active project / Current milestone                        |    45s |
| 2 My Project                         | Project Overview then My Group; assigned adviser and workflow                                                                                                                              | Research group / Assigned adviser                         |    45s |
| 3 Tasks & requirements               | List, completed scope, proposal task detail, instructions and feedback                                                                                                                     | Task instructions / Revision required                     |    55s |
| 4 Documents                          | Library → proposal → v1 snapshot/no-feedback state → v2 assignment; read guidance in task; upload dialog; upload supplied v3, confirmation and resulting status; official-copy empty state | Submitted version / Review assignment / Submission status |   105s |
| 5 Group Files                        | Empty state; folder dialog; upload supplied fictional PDF; file listing                                                                                                                    | Shared files / Working material                           |    35s |
| 6 Timeline                           | Configured stages and target dates; current versus completed stage                                                                                                                         | Workflow sequence                                         |    35s |
| 7 Defense                            | Actual readiness/no-session state; no fabricated session                                                                                                                                   | Defense readiness                                         |    25s |
| 8 My Grades                          | Class Grades then Defense Grades; published/unreleased state as returned                                                                                                                   | Grade release state                                       |    25s |
| 9 Consultations                      | Scheduled consultation, request form, empty notes/chat modal; no external launch                                                                                                           | Upcoming consultation / Notes and chat                    |    50s |
| 10 Calendar                          | Current month and consultation/deadline detail where present                                                                                                                               | Research events                                           |    25s |
| 11 Messages & Inbox                  | Empty conversation and invitation lists; no researcher create control; inbox folders and compose without send                                                                              | Conversations / Correspondence                            |    30s |
| 12 Notifications, profile & settings | Notice → actual dashboard link; fictional profile; appearance and preferences                                                                                                              | Read state / Appearance                                   |    30s |
| 13 Handoff                           | Continue with your ADVISIO evaluation; independent exploration and questionnaire instruction                                                                                               | Explore independently                                     |    25s |

## Draft narration

The machine-readable chapter script will contain the full narration, same numbering and neutral activities. Its generated storyboard will be the authoritative narration transcript. Narration describes visible states; conditional features are explicitly conditional. Approximate pacing: 145–160 words/minute. Voice direction confirmed by the requester: **like a tutor, gentle but firm, natural rather than robotic**. Name pronunciation confirmed: **ad - vi - sho**. Store this as a configurable ElevenLabs alias dictionary entry, not a guessed phonetic spelling in captions.

Narrative sequence: identify fictional workspace → selected project and workflow → task instructions → preserved document version and feedback → prepared revision and submission → shared working materials → configured milestone sequence → missing defense/grades honestly shown → consultation with no connected meeting/transcript → calendar → conversations versus correspondence → notices/profile/preferences → independent evaluation. Do not promise approval after resubmission or automatic stage completion.

## Capture plan

Use a fresh cookie-backed student/BSIT evaluation session on a loopback evaluation server. Assert the health endpoint reports evaluation mode, inspect returned title/role/program, verify fictional email, and use only the prepared revision download. Keep authentication in memory; no stored credentials, cookies or HAR files. End the workspace in a finally block. Never use production credentials or response interception to invent records.

Capture at a fixed 1366×768 laptop viewport and compose a 1920×1080 master, using light theme, English locale, Asia/Manila timezone and fixed browser clock after seeding. Retain actual rendered product UI. Wait for target headings, API responses and element visibility; persistent SSE means networkidle is inappropriate. Record chapter-local clips and action timestamps with target bounds. Use named roles/labels and exact record titles; fail on selector or record drift. Dwell times are intentional reading time, not readiness sleeps. Trim recording startup from explicit recording markers. Later align action segments with narration phrases. Save poster images and a privacy/capture report locally.

No external message, invitation or meeting is sent. Resubmission and shared-file actions affect only the disposable captured evaluation workspace. No seed/core workflow/permission changes. Never capture panelist sessions to stand in for student defense data.

## Proposed files

- `docs/walkthroughs/researcher-feature-inventory.md`, this report, generated storyboard, written guide and production instructions.
- `walkthrough/researcher/researcher-script.json`: role chapter/narration/actions/activities manifest.
- `walkthrough/shared/`: timing, captions, neutrality checks and shared types/theme.
- `walkthrough/video/`: Remotion entry, composition and reusable scene/attention components.
- `scripts/walkthrough/`: preflight, deterministic capture, ElevenLabs voice/alignment, caption export, render/normalization, publication and tests.
- Root npm commands and locked development dependencies, isolated video TypeScript configuration and ignored generated media/cache.
- Web evaluation walkthrough component with pre-rendered accessible native video, chapter navigation, transcript and optional guide. Replace old public walkthrough with the same real-media delivery component and add its public route.
- `apps/web/public/walkthroughs/researcher/`: published media/metadata only after a successful render. No per-visitor Remotion rendering.

## Risks and publication gates

No ElevenLabs key or voice ID is present in the shell at audit time. These must be configured locally; do not substitute an unapproved voice or silent video. A generated video is not deliverable until real narration, alignment, captures, render and visual/audio review pass. Master/web MP4, poster, SRT, VTT and chapters are outputs, not placeholders with made-up times. The player must show the written guide and a truthful unavailable-video state until a complete media bundle exists.

FFmpeg/ffprobe are not on PATH at audit time; a project-local binary package can provide them. Browser/render dependency installation may need network access. Real capture may uncover API/UI failures; record these rather than masking them or weakening authorization. The evaluation session expires after an hour and is idle-limited; keep it active during capture, close it on completion, and generate narration/render outside the workspace lifetime.

Motion uses brief fades, callouts, a spotlight and progress line. Product Tour Spotlight, Annotated Screenshot and Scroll Progress patterns inform the treatment; no BrewedOps assets or third-party source code are copied. No music. Responsive player and chapter list support keyboard/focus, native captions/fullscreen/volume/seek and a written alternative. Manual listening and mobile playback remain release gates after media generation.

## Generic master redesign

Keep capture automation, caption alignment, chapter manifest, Jerry voice settings and static player delivery. Replace the per-clip 1.3 camera zoom and click-following with semantic overview/focus/detail framing (1.0 / 1.045 / 1.1); most narration remains in overview. Add shared Motion primitives for Researcher navigation, tabs, dialogs, page entry, progress and shared-file rows. Remotion handles chapter fades, cursor/ripple/highlight, and an explicitly illustrated configured-workflow diagram. Capture study controls are hidden only by the recording runner, and fictional account addresses are aliased to example.invalid in the recording. No core data, authorization, or API changes.

The 24 narration segments below were locked before generating replacements. Twelve existing Jerry segments are reused. Only twelve segments require generic wording; no alternative voices or duplicate takes are generated.

| Segment                 | Decision   |
| ----------------------- | ---------- |
| introduction--welcome   | REGENERATE |
| overview--dashboard     | REGENERATE |
| overview--navigation    | REUSE      |
| project--details        | REGENERATE |
| project--team           | REGENERATE |
| tasks--list             | REUSE      |
| tasks--instructions     | REUSE      |
| documents--library      | REUSE      |
| documents--versions     | REUSE      |
| documents--working      | REGENERATE |
| documents--submit       | REUSE      |
| documents--official     | REUSE      |
| files--shared           | REGENERATE |
| timeline--stages        | REUSE      |
| defense--readiness      | REGENERATE |
| grades--release         | REGENERATE |
| consultations--schedule | REUSE      |
| consultations--records  | REGENERATE |
| calendar--events        | REUSE      |
| communication--chat     | REUSE      |
| communication--mail     | REGENERATE |
| preferences--notices    | REUSE      |
| preferences--account    | REGENERATE |
| handoff--continue       | REGENERATE |
