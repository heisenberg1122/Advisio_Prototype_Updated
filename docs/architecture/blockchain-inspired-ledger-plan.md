# Document integrity recommendation and optional ledger design

Status: recommendation revised; hash-linked ledger deferred as an optional future enhancement. No ledger implementation or experiment results are claimed by this document.
Prepared: 2026-10-26.

## Revised recommendation

Describe Advisio's current features as **SHA-256 document integrity verification and traceable approval history**. A hash-linked ledger is not necessary for the core research-management workflow and should not be added solely to justify a blockchain-inspired claim in the manuscript.

The earlier recommendation to build a ledger as the next step is superseded. Prioritize documenting and evaluating the existing checksum verification, preserved signed versions, role-scoped approvals, and audit records. Remove blockchain-inspired wording as a claim about the current implementation; ordinary document hashing and version history alone do not establish a blockchain architecture.

Suggested current manuscript wording:

> Advisio supports document integrity verification using SHA-256 checksums and maintains approval traceability through preserved signed document versions and audit records identifying actors, actions, and timestamps.

Support this description with source references and reproducible evaluations of the existing features. On disposable fixtures, verify that an unchanged official copy matches its recorded checksum, a modified copy produces a mismatch, successive signing preserves earlier versions, and unauthorized users cannot approve or access another project's protected records. Record actual outcomes before presenting them as evaluation findings. Checksum matching establishes agreement with a stored reference; it does not establish who authored a document or protect against coordinated replacement of both the file and its reference hash.

Reconsider the ledger only if detecting alteration of historical approval records becomes an explicit institutional requirement or research objective. First document the threat being addressed, why current controls are insufficient, and who will independently retain checkpoints. If implemented and evaluated, name the feature a **tamper-evident, hash-linked approval ledger** and explain its blockchain inspiration in the technical discussion.

## Optional future design and claim boundary

The remaining sections retain a conditional design for future consideration. They are not the recommended current implementation scope or evidence of existing capabilities.

If the requirement is established, add a centralized, append-only, hash-linked event ledger to Advisio's document approval lifecycle. Evaluate document integrity, event ordering, and detection of changes relative to independently retained checkpoints.

This is an architectural analogy supported by specific mechanisms, not a certification or proof that Advisio is a blockchain. The design does not implement distributed consensus, mining, tokens, or smart contracts. Faculty approval is an academic authorization decision, not blockchain consensus.

NIST defines a hash chain as an append-only structure in which later blocks incorporate hashes of earlier blocks, providing evidence of modification. This is the technical mechanism being adapted:

- https://csrc.nist.gov/glossary/term/hash_chain
- https://csrc.nist.gov/pubs/ir/8202/final

## Existing implementation evidence

| Mechanism | Repository evidence | What it currently supports |
| --- | --- | --- |
| Source and signed PDF hashes | `apps/api/src/services/document-signing.service.ts`, creation of `DocumentSignature` | Records SHA-256 fingerprints and source/signed version relationships. |
| Official-copy integrity verification | `apps/api/src/services/official-copy.service.ts`, `verify` | Recomputes the actual artifact hash and compares it with the expected value. |
| Audit events | `packages/database/prisma/schema.prisma`, `AuditLog` | Records actor, action, entity, changes, and time; currently has no predecessor hash. |

These are observations from source inspection, not new test results. A hash stored beside a file does not independently protect against an attacker changing both. An electronic signature image plus password confirmation is not itself a public-key digital signature.

## Optional ledger scope

Use one ledger stream per research project. Include only events that have precise, persisted meanings in the existing workflow:

1. Manuscript version submitted for review.
2. Academic approval or rejection recorded for an exact version.
3. Electronic endorsement/signing completed, identifying source and output versions.
4. Official copy issued.
5. Official copy revoked, or a prior event corrected through a new compensating event.

Map these events to the existing transaction boundaries before implementation. Preserve the ordinary audit log for operational activity. Do not insert read-only verification requests into the approval chain merely to record its inspection.

## Ledger data and hashing

Introduce a separate `ResearchLedgerEvent` model and a per-project stream head. Proposed event fields:

| Field | Purpose |
| --- | --- |
| `schemaVersion`, `hashAlgorithm` | Fix the interpretation and encoding of the record. |
| `id`, `researchId`, `sequence` | Identify the event, stream, and monotonic position. |
| `eventType`, `occurredAt` | Record server-observed event type and UTC time. Time is not an independently certified timestamp. |
| `actorId`, `actorRoleAtEvent` | Record the authenticated actor and validated acting role. |
| `documentVersionId`, `artifactHashes` | Identify exact relevant versions and their SHA-256 fingerprints. Signing events include both source and output hashes. |
| `payload`, `payloadHash` | Store minimal event facts and their canonical digest. |
| `previousHash`, `eventHash` | Commit to the predecessor and the complete current event. |
| `operationId` | Make retries idempotent. |

Specify canonical JSON encoding, including recursive key ordering, UTC date formatting, null handling, string encoding, and rejection of unsupported numeric values. Hash the canonical UTF-8 bytes; do not concatenate ambiguous strings.

Conceptually:

```text
payloadHash = SHA256(canonical(payload))
eventHash = SHA256(canonical({
  domain: "advisio-research-ledger-v1",
  schemaVersion, hashAlgorithm, id, researchId, sequence,
  eventType, occurredAt, actorId, actorRoleAtEvent,
  documentVersionId, artifactHashes, payloadHash, previousHash
}))
```

Define an explicit genesis predecessor and require the first sequence to be 1. Enforce unique `(researchId, sequence)` and unique operation identifiers. Recompute `payloadHash` during verification rather than trusting its stored value.

Use restrictive foreign keys or stable identifiers so deleting related application records cannot cascade-delete events or silently change hashed fields. Keep student names, email addresses, manuscript text, passwords, and tokens out of ledger payloads. Hashes do not make confidential data anonymous.

## Safe append and integration

1. Authorize the actual business operation using existing role and project checks.
2. Serialize appends for the project, including its first event, through a locked stream-head row or equivalent database transaction lock.
3. Persist the business change, event, and updated stream head in one database transaction. A failed event append must not leave an unrecorded approval.
4. Enforce append-only behavior with database grants for the runtime role and update/delete rejection triggers. Use a separate migration owner; verify runtime permissions in integration tests.
5. Add corrections and revocations as new events referencing earlier events. Never rewrite their original meaning.
6. Account for external file storage: finish uploading and hashing the exact artifact before committing references; handle failed transactions without treating orphan uploads as approved records.

Existing records must not be represented as if they were protected before this feature existed. If imported, label them as baseline/import events with import time and source provenance. Historical event dates remain reported metadata, not independently established evidence.

## Verification and checkpoints

Provide a scoped verification API and an offline command that accepts an exported stream, an independently obtained checkpoint, and optionally the relevant PDFs.

Verification checks genesis, project identity, sequence continuity, predecessor links, canonical event hashes, payload hashes, artifact digests when files are available, and checkpoint agreement. Report the first invalid sequence and distinguish missing files from hash mismatches. Do not claim full file verification when PDFs were not supplied.

A checkpoint includes stream/project identity, sequence, event hash, format version, and checkpoint creation time. Retain it outside the operational database under separate custody, such as a reviewed export held by the research coordinator. Merely saving another row in the same database is not independent anchoring. Automatic external publication or delivery is outside this plan's authorization.

An optional institution-signed checkpoint strengthens provenance only when its verification key is independently trusted and its private key has separate protection. A signature alone does not establish trustworthy historical time.

Report separate outcomes for internal chain consistency, artifact integrity, and agreement with a supplied checkpoint. Identify the checkpointed sequence and any later uncheckpointed suffix. A valid old checkpoint cannot prove that no newer checkpoint or events exist; independent checkpoint retention and freshness policy are required to identify rollback.

Threat boundary: a privileged database administrator may bypass application restrictions. Without an independent checkpoint, an attacker who can rewrite all records can recompute a consistent replacement chain. With a trusted checkpoint, changes to the committed prefix can be detected; later, uncheckpointed events have weaker protection. These limits must appear in the manuscript.

## Conditional implementation phases and completion gates

| Phase | Deliverables | Completion gate |
| --- | --- | --- |
| 1. Define protocol | Event inventory, canonical encoding, threat model, fixed hash vectors | Independent recomputation agrees with expected vectors. |
| 2. Build ledger | Migration, append service, transaction integration, runtime restrictions | Concurrency, rollback, retry, and access-control integration tests pass. |
| 3. Verify and anchor | Scoped API, restricted export, offline verifier, independently retained checkpoint process | An export verifies outside the application against the retained checkpoint. |
| 4. Expose results | Document-history integrity view with failure details and checkpoint coverage | Users can distinguish chain consistency, actual file checks, and checkpoint coverage. |
| 5. Evaluate | Isolated tampering experiments, reproducible commands, results and defense demonstration | Observed results support each final manuscript claim. |

Proposed code locations: `apps/api/src/services/research-ledger.service.ts`, a dedicated ledger protocol/hash module, a ledger verification route using existing research-scope authorization, and an offline script under `scripts/`. Add the Prisma model and a new migration without changing unrelated schema work. Add the UI to the existing document history/official-copy workflow.

## Evidence and test matrix

Run destructive experiments only on disposable test fixtures or copied exports. A privileged tampering fixture may bypass the runtime restrictions intentionally; ordinary application routes must remain restricted.

| Experiment | Expected evidence |
| --- | --- |
| Unmodified stream and exact PDFs | Chain, files, and supplied checkpoint verify. |
| Change a PDF byte | Artifact hash mismatch. |
| Change actor, time, event type, or payload | Event or payload digest mismatch. |
| Change a historical record and recompute only its hash | A later predecessor link or trusted checkpoint disagrees. |
| Delete or reorder an interior event | Sequence or predecessor validation fails. |
| Remove final events | Detected if the independently retained checkpoint commits to a removed event; otherwise explicitly not guaranteed. |
| Rewrite the entire chain and all internal hashes | Internal checks may pass, but a trusted checkpoint covering the altered prefix fails. |
| Two simultaneous appends | Both commit in a single sequence without forks or duplicate positions. |
| Retry the same operation | Exactly one business event and one ledger event persist. |
| Force ledger insertion failure | Related approval transaction rolls back. |
| Unauthorized user reads/exports another project's chain | Access is denied without revealing protected metadata. |
| Runtime database role updates/deletes an event | Database rejects the attempt. |
| Replay an export from another project or an older checkpoint | Identity mismatch is rejected; older checkpoint coverage is explicitly reported rather than represented as current completeness. |

For each case record fixture, changed field/bytes, expected result, actual result, verifier output, commit identifier, and test command. Report executed case counts and observed detection results, including limitations. Do not infer real-world attack detection rates or absolute security from a small controlled test set. Measure verification latency on stated stream sizes if performance is discussed.

## Optional ledger evidence package

Keep the following together: architecture diagram; event schema; canonical hashing specification and vectors; source references at a fixed commit; actual test report; sample export; independently retained checkpoint; offline verification instructions; before/after screenshots; and stated threat boundaries.

Suggested defense sequence: submit a PDF, approve/sign it, issue its official copy, export and retain a checkpoint, run offline verification, modify a copied PDF and event, and show the corresponding failures. Finally truncate or fully rewrite the copied chain to demonstrate why the checkpoint matters.

Suggested wording **after implementation and validation**:

> Advisio implements a blockchain-inspired approval ledger using sequential, hash-linked records, SHA-256 document fingerprints, and append-only controls. Controlled tests evaluate detection of document and event modifications, while independently retained checkpoints support detection of changes to committed history. The system remains centrally administered and does not implement distributed blockchain consensus.

Until those gates are met, describe the ledger as proposed and describe existing hash verification separately. Evidence supports the implemented properties; it does not prove an unrestricted claim of immutability, legal signature validity, or blockchain equivalence.
