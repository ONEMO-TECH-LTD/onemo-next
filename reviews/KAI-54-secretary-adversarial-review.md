# KAI-54 — Secretary Agent Phase 1 Adversarial Review (Codex)

## Scope reviewed

Primary files reviewed:
- `bus/hooks/secretary-extract.sh`
- `bus/hooks/secretary-flush.sh`
- `bus/src/secretary/config.ts`
- `bus/src/secretary/batch-processor.ts`
- `bus/src/secretary/cli.ts`
- `bus/src/extraction/extractor.ts`
- `bus/src/extraction/memory-ops.ts`
- `bus/test/secretary-e2e.test.ts`

Modified pipeline files reviewed for regressions:
- `bus/src/extraction/extractor.ts`
- `bus/src/extraction/memory-ops.ts`

## Findings summary

| ID | Severity | File:Line | Title | Data loss risk |
|---|---|---|---|---|
| F1 | HIGH | `bus/src/extraction/memory-ops.ts:119-150`, `bus/src/secretary/batch-processor.ts:199-203`, `bus/src/secretary/cli.ts:124` | Batch write failures are silently reported as successful extraction runs | **High** (failed writes are not retried/dead-lettered) |
| F2 | HIGH | `bus/hooks/secretary-flush.sh:38-45` | Stop-hook flush can drop data on extraction failure | **High** (processing file is always deleted even on failure) |
| F3 | HIGH | `bus/hooks/secretary-extract.sh:18-20`, `bus/src/secretary/batch-processor.ts:145-151`, `bus/src/extraction/extractor.ts:489` | Global shared batch file mixes sessions and misattributes memory_session_id | **High** (cross-session contamination/integrity risk) |
| F4 | MEDIUM | `bus/hooks/secretary-extract.sh:22-23`, `bus/hooks/secretary-flush.sh:16-17` | Symlink resolution is incomplete (relative targets break BUS_DIR) | Medium |
| F5 | MEDIUM | `bus/hooks/secretary-extract.sh:19,120` | Non-numeric `SECRETARY_BATCH_SIZE` can break hook arithmetic | Low/Medium |
| F6 | MEDIUM | `bus/src/extraction/extractor.ts:353-377` | Deep contradiction detection runs on facts even when no write occurred | None (quality/noise risk) |
| F7 | LOW | `bus/test/secretary-e2e.test.ts` | Missing tests for failure paths, concurrency, and session isolation | Indirect |

---

## Detailed findings

### F1 — HIGH — Silent write failures are not treated as pipeline errors

**Where**
- `memory-ops.ts:119-150` (`executeBatch`) catches DB/transaction failures and returns an array with `success:false` entries instead of throwing.
- `batch-processor.ts:199-203` only sets `result.error` when `pipeline.extract(...)` throws.
- `cli.ts:124` exports `error: result.error` as the hook’s failure signal.

**Why this is a bug**
When DB writes fail (constraint failure, schema mismatch, DB lock, etc.), the pipeline can return operations with `success:false` while `error` remains `null`. Hooks interpret this as success and do not dead-letter/retry. This is a silent integrity failure mode.

**Data-loss/integrity risk**
High. Facts appear “processed” but do not persist, and no retry path is triggered.

**Fix suggestion**
- In `ExtractionPipeline.extract()`, after `executeBatch`, detect any `!success` and either:
  1) throw an error, or
  2) return a top-level fatal flag consumed by `batch-processor.ts` as `result.error`.
- Add tests that intentionally force DB write failure and assert hook JSON contains `error`.

---

### F2 — HIGH — Stop-hook flush deletes processing files regardless of extraction success

**Where**
- `secretary-flush.sh:38-41` invokes extraction and swallows failures (`|| true`).
- `secretary-flush.sh:44` always removes `PROCESSING_FILE`.

**Why this is a bug**
If extraction fails during session-end flush (DB unavailable, CLI crash, timeout), the moved batch is deleted unconditionally. There is no dead-letter fallback here.

**Data-loss/integrity risk**
High. Remaining session data can be permanently discarded at Stop.

**Fix suggestion**
- Mirror PostToolUse dead-letter behavior in Stop hook:
  - Parse CLI JSON result and if `error` exists, append back to `failed.jsonl` (or restore original filename).
  - Delete processing file only after confirmed success.
- Consider bounded retry loop plus warning output.

---

### F3 — HIGH — Shared global batch file causes cross-session memory attribution

**Where**
- `secretary-extract.sh` writes all sessions into one global file: `/tmp/kai-secretary/pending.jsonl`.
- `batch-processor.ts:145-151` takes the first `session_id` found and applies it to all generated operations via pipeline options.
- `extractor.ts:489` uses one `sessionId` for every ADD operation in the batch.

**Why this is a bug**
Parallel/overlapping sessions (or sub-agents) can interleave entries in the same file. Processing then tags all facts with the first session id, creating false provenance and FK linkage to the wrong session.

**Data-loss/integrity risk**
High integrity risk (corruption of lineage and analytics), even when rows are written successfully.

**Fix suggestion**
- Partition by session: `pending-<session_id>.jsonl` (or hash-safe variant) and flush each independently.
- If mixed-session batches are ever possible, split by `session_id` before pipeline invocation.
- Add concurrency E2E test with two interleaved session IDs and assert correct memory_session_id mapping.

---

### F4 — MEDIUM — Symlink path resolution remains fragile

**Where**
- `secretary-extract.sh:22-23`, `secretary-flush.sh:16-17` use `readlink "$0"` without canonicalization.

**Why this is a bug**
`readlink` can return a relative target path. `dirname` then resolves relative to current working directory, not necessarily symlink location. BUS_DIR can be wrong, leading to failure to find `dist/secretary/cli.js`/`src/secretary/cli.ts`.

**Data-loss/integrity risk**
Medium (missed extraction and deferred/failed processing).

**Fix suggestion**
Use canonical path resolution robustly, e.g.:
- `SCRIPT_REAL="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$0")"` or
- portable shell realpath helper that anchors relative symlink targets from link directory.

---

### F5 — MEDIUM — `SECRETARY_BATCH_SIZE` is not shell-validated before arithmetic

**Where**
- `secretary-extract.sh:19` assigns raw env string.
- `secretary-extract.sh:120` evaluates `(( COUNT < BATCH_SIZE ))`.

**Why this is a bug**
If `SECRETARY_BATCH_SIZE` is non-numeric, bash arithmetic with `set -u` can error (interpreting tokens as variable names), causing hook instability.

**Data-loss/integrity risk**
Low/Medium (missed triggers; accumulation behavior becomes unpredictable).

**Fix suggestion**
Pre-validate once:
```bash
[[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || BATCH_SIZE=10
(( BATCH_SIZE > 0 )) || BATCH_SIZE=10
```

---

### F6 — MEDIUM — Deep contradiction detector analyzes uncommitted facts

**Where**
- `extractor.ts:353-377` loops over all extracted facts irrespective of final action outcome.

**Why this is a problem**
Deep contradiction alerts can be raised for facts that were NOOP/DELETE, blocked by sycophancy guard, or not persisted due to write failure. This inflates false-positive alerting and can trigger unnecessary escalation.

**Data-loss/integrity risk**
No direct data loss; quality/noise risk.

**Fix suggestion**
Run deep contradiction detection only on facts whose corresponding operation is successful and materially new/changed (ADD/UPDATE with success).

---

### F7 — LOW — Test coverage misses key failure/concurrency scenarios

**Where**
- `secretary-e2e.test.ts` validates happy paths and basic filtering, but not:
  1) write-failure propagation to hook-visible `error`,
  2) Stop-hook failure preservation behavior,
  3) multi-session interleaving in one batch,
  4) non-numeric batch-size env handling,
  5) symlink-relative hook invocation behavior.

**Impact**
These omissions align with the highest-risk integrity paths above.

**Fix suggestion**
Add targeted tests for each scenario, especially one that simulates DB failure and asserts dead-letter behavior.

---

## Overall assessment

**Not production-ready yet for Phase 1** due to unresolved high-severity integrity issues (F1/F2/F3). The core architecture is close and many previous critical issues were fixed, but current behavior can still silently lose or misattribute extracted facts under realistic failure/concurrency conditions.

## Suggested go/no-go gate

Require all before rollout:
1. Fail-fast propagation for any DB write failure (F1).
2. Stop-hook dead-letter preservation on failure (F2).
3. Session isolation in batching (F3).
4. At least one E2E test each for the above.

