# Submission review and comments

Professors open **Submissions → Review Queue** and select a submitted requirement. The review workspace shows the exact submitted document beside feedback, comments, and approval/revision controls. Previous/next controls follow the queue's current workflow, search, status, and sort filters. The feedback panel can be hidden to give the document more space. Small screens stack the document and feedback.

PDFs use Advisio's existing viewer with page navigation, zoom, and full-screen controls. Images display directly. Other uploaded file types can be downloaded for review. The selector lists only submitted attempt versions; a newer working upload never replaces the submitted snapshot. Earlier versions allow comments but do not offer a new academic decision.

Assigned faculty also see a document preview and shared discussion when opening a decision from **Manuscript Reviews** for a task submission. Existing permanent decision rules and required-reviewer checks remain in force.

**Post comment** saves immediately, independently of an approval or revision decision. A comment may include a page number, and it stays attached to the selected submitted version. Comments are a shared conversation visible to the research group's currently enrolled active members, the authorized workflow checker, and the version's active/completed assigned reviewers. They are separate from private review drafts. Completed reviewers have read-only discussion access unless they also have workflow review authority. Revoked/superseded reviewers and removed members or workflow participants cannot access a discussion through their former assignment or membership.

For a PDF with selectable text, a checker can drag across a passage and choose **Comment on selection**, enter feedback, and select **Post comment**. The comment saves the quoted words and page-relative highlight rectangles against that exact version. Selecting the quoted passage in a saved comment navigates to its page and emphasizes the highlight; numbered markers on the page open the matching comment. Highlights for loaded comments remain aligned while zooming, resizing, or viewing intrinsically rotated/cropped pages. Use **Load earlier comments** to include older discussion highlights. Selecting a different submitted version clears any unposted selection and shows that version's own highlights. Researchers see the quoted text with the comment in task details. Scanned PDFs and images without selectable text continue to support page comments. Annotations do not modify the original PDF or its download.

Researchers can read and reply under **Tasks & Requirements → task details → Comments**, including comments on earlier submitted versions. Discussions refresh every 15 seconds and support loading earlier comments. Posting does not change document bytes, submission status, review decisions, or milestone progress. Comments are shared within Advisio; this feature does not send email or create external Google Docs comments. Comments are limited to 2,000 characters, and reviewer contact details are omitted from discussion responses.

## Milestone grades and history

Standard document requirements can be **Ungraded** or use **1–10,000 points**. The milestone composer sets the first requirement's points, and each requirement's grading settings can be saved separately. New and existing requirements remain ungraded by default. Approval gates, title proposals, and defense evaluations keep their separate workflows.

The professor who owns the workflow saves a private draft grade and explicitly selects **Release grade** to share it with the enrolled research group. Other assigned reviewers can continue reviewing and commenting; they do not control the milestone's grade. Scores allow zero and up to two decimal places and cannot exceed the configured points. Recorded grades preserve the point denominator, which becomes locked once grading begins. Draft edits after release remain private while researchers continue to see the last released score. Grades are tied to the exact submitted version, and earlier versions cannot be regraded through a newer attempt. Grading never changes the submission decision or advances the workflow.

**See history** is available in submission review, manuscript review, and researcher task details. It combines submitted/resubmitted attempts, recorded review decisions, shared comments, and grade releases with the actor and full date/time in **Asia/Manila**. Private draft-grade events appear only for the owning professor. Existing private reviewer identities and peer reviews remain protected. Older legacy decisions without a recorded reviewer use a generic faculty label instead of inventing an identity. Each version's access is checked before adding its history. Draft saves and releases create immutable history entries; changing the current grade never rewrites an earlier release. The draft-save timestamp remains distinct from a later release timestamp.

Apply `20261102030000_requirement_grading` and regenerate Prisma before using grading. The migration adds nullable requirement points, version-specific grade records, and immutable grade-history events. Existing submissions are not assigned scores automatically. The local sample is configured for 100 points and has a released **84.5/100** example; its review decision remains **Under review**. Grades apply to the submitted work, so active enrolled members of a group see the same released grade for their shared submission.

## Database update

Before starting the updated API, apply `20261102010000_submission_comments` using the normal Prisma deployment process and regenerate the Prisma client. This adds only the `task_submission_comments` table, its index, and foreign keys. It does not rewrite existing documents or decisions. The application code can be rolled back while retaining the additive table. Preserve posted comments in backups rather than dropping the table after use.

Apply `20261102020000_submission_text_highlights` afterward. It adds a nullable JSON column for passage anchors; existing page comments remain valid. The API bounds quote lengths, rectangle counts, page numbers, and normalized page coordinates before storage. A comment and its highlight must refer to the same page. The existing submission/version access checks also apply to highlighted comments.

The migration is included in source; it is not automatically applied to an existing database by the web build.

## Verification

- Comment service tests cover group enrollment and membership, workflow ownership, version-specific reviewer access, completed/revoked assignments, researcher portal boundaries, input validation, pagination, and exact version association.
- Submission review tests cover snapshot selection and read-only recorded decisions.
- Existing submission review routes and document/submission permission tests verify unchanged decision and access behavior.
- A local browser check with sample data verifies PDF rendering, posting a page-referenced comment, requesting revision, submission navigation, earlier-version decisions, mobile layout, and dark mode.
- Migration SQL, database comment storage, and database-level empty-comment/page validation were exercised in an isolated local transaction; the temporary schema was rolled back.
- Highlight tests cover native mouse-drag selection, exact quote capture, normalized geometry, saved restoration, quoted-comment navigation, version isolation, zoom, rotated/cropped pages, blank-page fallback, and mobile layout.
- Grading checks cover private drafts, released-score visibility, preserved draft timestamps, author and point snapshots, stale-write conflicts, unauthorized writes, immutable grade-history events, locked point denominators, unchanged review status, dated history, nested history dialogs, milestone settings, and mobile layout.
