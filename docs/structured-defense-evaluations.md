# Structured defense evaluations

New defense review packets use a digital evaluation form. Existing packets keep
their original rubric or PDF mode and historical scoring.

## Prepare and publish

Open **Defense → Review packet → Configure evaluation**. Create criteria once
for individual presentation and once for the group manuscript. Configure two to
ten labeled rating levels, positive criterion weights, integrated feedback, and
an optional typed electronic signature. Templates are saved as new reusable
versions within the facilitator's college; changing one does not change a
published session.

Use **Header & titles** to set the college name, upload its PNG/JPEG logo, and
set the template form name/code. **Evaluation form title** controls the main
printed title. The school name, address, and school seal stay consistent.
Uploaded college logos are trimmed and centered in a square so both seals have
matching sizes and alignment. Header settings and embedded logo bytes are saved
in reusable templates and published packet snapshots, without external image URLs.
New packets start with the research project's college name; colleges other than
Information Technology upload their own seal. Existing locked PDF submissions
keep their original bytes.

Generated PDFs repeat the institutional header and aligned rating/weight/score
tables across pages, circle selected ratings, and show section totals. Individual
presentation and group manuscript sections begin on separate pages. Long rubrics,
researcher rosters, and feedback continue onto additional pages. The panelist name
appears only in the final signature area.

The packet takes its manuscript from an approved immutable submission attached
to the session's exact Defense Eligibility milestone. If several approved
documents qualify, the facilitator must choose the manuscript explicitly.
Approved manuscripts remain selectable while panel invitations are pending.
Drafts can be prepared before any panelist accepts. Publication requires at least
one accepted required panelist, but does not wait for every invitation. Only
accepted panelists can access the published packet; pending invitees gain access
when they accept.

Student names come from active leader/member project records. One presentation
section is generated for each student, including solo projects. Optional
similarity reports remain supporting files, not evaluation templates.

Publication stores the researcher roster, all non-removed panel assignments, rubric,
rating scale, weights, and manuscript version. An unstarted packet can be replaced
with an explicit reason and matching version, provided nobody has saved an
evaluation. Publication history is audited. Once live, the form is fixed.

## Score and submit

Accepted panelists can review the form before defense. During the live defense,
each panelist selects one configured rating per criterion. Scores equal rating
times weight; maximums follow the configured scale, not a hardcoded 100.

Drafts autosave with optimistic revision checking. Final submission requires all
student and manuscript ratings, one recommended defense result, and written
instructions for revision/re-defense recommendations. If configured, the
panelist types their full name as an electronic signature. The panelist previews
the generated PDF and explicitly confirms submission. The server retains that
exact PDF and its SHA-256 integrity hash and locks the evaluation. PDF generation
failure does not submit or lock the draft.

Panelists can access only their own evaluation. Facilitators can download locked
evaluation PDFs and view consolidated results. Reports show every panelist's
section totals and recommendation. Only locked required-panelist submissions
count toward equal-weight averages. Missing scores are pending, never zero;
averages remain provisional until all required panelists submit. Optional
panelists are labeled and excluded from the official averages. Presentation and
manuscript scores are separate; no combined final grade is inferred.

## Official result and post-defense

The facilitator explicitly selects Approved, Approved with Minor Revisions,
Approved with Major Revisions, Re-Defense Required, or Disapproved. Averages and
recommendations do not automatically select the official decision. Result release
requires every currently required panelist's locked submission to match the
published panel roster. Students see consolidated scores and integrated feedback
only after the official result is released.

Revision and re-defense results request manuscript changes and preserve the
defense eligibility. A re-defense uses a new session. For minor/major revisions,
the facilitator can explicitly clear a newer approved immutable version of the
same manuscript after all mandatory exact-version faculty reviews are approved.
Clearance consumes eligibility and permits the applicable badge, preserving the
original decision, manuscript packet, and evaluation PDFs. An active subsequent
defense blocks clearance. Clearance is audited and students are notified.

## Deployment and verification

Deploy the frontend/backend together. API startup runs Prisma migrations; the
additive migrations add the snapshot/submission tables and the structured packet
mode constraint. They do not convert historical evaluations. Regenerate the
Prisma client and build the validations package before type checking.

Tests cover weighted scoring, five/six levels, solo/three/four/five researchers,
missing scores, unauthorized access, stale drafts/previews, locked submission,
signatures, averaging, PDF pagination, and the database-backed defense workflow.
Browser screenshots use the real React components with labeled verification
data; they are not screenshots of production records.
