# Document integrity verification and approval traceability

Advisio uses SHA-256 document fingerprints, preserved signed versions, role-scoped academic actions, and audit records. These features should be described directly in the manuscript. They do not implement a blockchain or a hash-linked approval ledger.

## Online verification

Authorized users can select **Verify integrity** on an official copy in the document workflow. The existing authenticated endpoint is:

```text
POST /api/official-copies/:officialCopyId/verify
Body: {} or { "signatureId": "<signature belonging to this copy>" }
```

The response now contains `algorithm`, `expectedChecksum`, `actualChecksum`, `matches`, `checkedAt`, `officialCopyId`, and `signatureId`. The existing `checksum` field is retained as an alias of the expected checksum. The audit record retains these same comparison details and the authenticated checking user's ID. A signed artifact is compared with its signed-file hash, rather than the original copy's checksum. Existing project access checks apply before any file is loaded.

An unreadable storage artifact produces an error, not a successful integrity result. A mismatch returns `matches: false` and is recorded as a failed comparison. A matching checksum does not establish that a copy is currently approved or active: consult its separate approval/revocation status.

## Independent local file check

Download an artifact using an account authorized to access it, obtain its corresponding expected checksum from the official-copy record or verification response, and run from the repository root:

```powershell
node scripts/verify-document-integrity.mjs 'C:\path\manuscript.pdf' '<64-character-expected-sha256>'
```

The command reads the local file without changing it and prints a JSON comparison. Exit codes: `0` matches; `1` mismatch; `2` invalid arguments or unreadable file. It works without application or database credentials. It checks any file's bytes, not PDF structure or approval status. For signed PDFs, supply the signed artifact's expected hash.

For a controlled demonstration, first verify the downloaded original, then change a byte in a disposable local copy and verify that copy against the same reference. Retain both outputs. The reference must come from a source you trust; this command cannot detect an attacker replacing both the document and the reference checksum.

## Reproducible automated checks

```powershell
npm --workspace=api run test -- src/services/official-copy-integrity.test.ts src/services/official-copy.service.test.ts src/services/document-signing.service.test.ts
npm --workspace=api run type-check
node --test scripts/verify-document-integrity.test.mjs
```

On environments with inaccessible worker temporary folders, set `TEMP` and `TMP` to an existing writable local folder before running Vitest.

The new service tests exercise the real verification method and project access policy with mocked persistence and file storage. They cover matching bytes and audit evidence, one-byte modification, the signed-artifact reference, foreign-project denial, a foreign signature ID, and storage-read failure. Existing selected suites cover role policies and separate visual-signature PDF generation without source-byte mutation. They do not establish end-to-end database preservation or deployed access enforcement.

The local command test uses the known SHA-256 vector for `abc`, then checks changed bytes, invalid hashes, a missing file, and unexpected arguments. Keep observed test outcomes separate from deployment checks and from any later real-workflow demonstration.

## Manuscript wording

> Advisio supports document integrity verification using SHA-256 checksums and maintains approval traceability through preserved signed document versions and audit records identifying actors, actions, and timestamps.

Use actual evaluation outputs to support this description. Avoid claims of decentralization, immutable audit storage, legal signature validity, or public-key signature authenticity. Electronic endorsements and file checksums have distinct purposes.
