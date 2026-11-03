# Researcher walkthrough redesign delivery

This edition is a reusable Researcher master tutorial. Study instructions remain on the surrounding evaluation page.

## Implementation

- Video engine: walkthrough/video/WalkthroughComposition.tsx, components.tsx, motion.ts, WorkflowTimeline.tsx and types.ts. Reused the chapter manifest, audio/caption alignment, browser frame, progress line and static delivery architecture.
- Product motion: Researcher NavItem/StudentSidebar, Tabs, Modal, WorkspaceMotion, overview progress and Group Files rows. Shared timings are in apps/web/src/lib/ui-motion.ts. Product motion honors reduced-motion preferences; existing focus handling, keyboard controls, permissions and workflow rules remain.
- CameraFrame replaces the click-following 1.3 zoom. Semantic modes are Overview 1.0, Focus 1.045 and Detail 1.1. Most scenes stay in Overview. Detail is reserved for version reading; the camera settles rather than following clicks.
- Remotion adds chapter fades through @remotion/transitions, a smaller eased DemoCursor, ClickRipple, short-lived target highlights and a growing configured-workflow illustration. The illustration is labeled and does not advance actual project state.
- The intro includes the existing ADVISIO logo and lasts about 6.7 seconds. The same mark closes the tutorial. Master titles, narration and outro contain no study/TAM/questionnaire language. Capture-only styling hides study controls and aliases fictional email domains; it does not change the live application.
- The player has a general default and an explicit evaluation-page context. General users enter the Researcher portal; evaluation-page instructions stay outside the reusable video.

## Narration and reuse

Jerry B. remains the sole narrator with the same voice settings and confirmed pronunciation. Twelve existing segments are reused verbatim: navigation, task list/instructions, document library/versions/submission/official copies, timeline, consultation schedule, calendar, conversations and notices. Twelve segments required finalized generic wording: intro, overview, project details/team, document options, Group Files, defense, grades, consultation records, Inbox, profile/settings and outro. Each replacement was generated once; no voice alternatives or extra takes were requested.

Capture and rendering retain the existing fictional source records and API permissions. Missing defense sessions, released grades, conversations and connected meeting/transcript records are shown truthfully. No fabricated approval, faculty response, typing status or successful external connection was added.

## Validation and resource use

- Existing web suite passed: 432 tests. Walkthrough timing/neutrality checks passed: 5 tests.
- Targeted changed-file lint, web production build and video TypeScript checks passed.
- Reviewed short 720p intro, revision-submission and workflow previews before the full render. A corrected confirmation was checked with one still instead of another video render.
- Clips were resumed/replaced individually after a transient calendar re-render and timing adjustments. No repeated full capture or narration generation was needed for these fixes.
- Added dependencies: motion in the web workspace and the matching @remotion/transitions package. No second product animation library or unrelated upgrades.
- The full export review caught a recording-clock issue that held route content transparent. Capture now uses a ticking clock and checks content opacity. Eleven affected clips were replaced; working clips and all narration stayed cached. Production exports were regenerated after that repair.
- Final runtime is 8:46, with 14 chapters and 186 caption phrases. Full-resolution master and web exports include selectable and burned-in caption alternatives, poster, subtitle files and chapter metadata.
- Final export checks passed for codecs, dimensions, frame rate, duration and captions. Reviewed the exported chapter contact sheet after repair. One mobile playback check passed for captions, chapter seeking, playback and page width; the player stays paused until started.

Repository delivery includes both web videos, captions, poster and chapter metadata. Raw media and the 1080p master remain local. A human can still review the full narration delivery and device fullscreen experience; automated checks do not replace that listening/device review.
