# KAI-10217 QA verdict — REVISE

Reviewed commit `216aaeb7067fbe8953cd4492a184375d27c78994` against the 177-line contract SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 2. Local and upstream heads match.

## Verdict

- Source accuracy: the detector/resource implementation is source-backed and the required desktop lifecycle paths pass.
- Necessity: **shrink** one downstream documentation rewrite and one stale removed-stack comment.
- Sufficiency: **partial** because the contract-required physical-iPhone matrix has not run.
- KAI-10218 remains locked.

## Smallest correction

1. Revert only `src/app/(dev)/cutout-lab/ARCHITECTURE.md` to its KAI-10216 bytes. Increment 6 owns deleting this stale document and explicitly forbids replacement narrative prose; the new 53-line rewrite is unnecessary Increment 2 build-ahead.
2. Remove the stale `cutout-ai` reference from `v531seg.ts:3`. Do not change executable detector code unless the narrow recheck exposes a regression.
3. Run the exact affected static gates and both existing Cutout browser oracles again.
4. On one declared physical iPhone, record model, iOS/Safari, input dimensions, and Low Power state; execute cold Detect, warm Detect, repeated Detect, same-session artwork replacement during Detect, and Clear/navigation cancellation. No simulator or browser emulation counts.

## Independently passed

- Complete source/diff/caller/dependency/asset audit: the live roster is only self-hosted u2netp and lazy Silueta; the comparison/query/Transformers tree and WebGPU experiment module are gone; no parallel provider or serializer survives.
- Vitest: 57 files passed, 1 skipped; 525 passed, 5 named later-increment expected failures, 10 skipped.
- Typecheck, scoped ESLint, diff hygiene, and production build passed.
- Exact current-code server on port 3217: primary u2netp, forced real Silueta, forced visible flood-fill, replacement/stale suppression, cancellation, timeout, worker death, recovery, Preview/Save preservation, Chromium, and WebKit passed.
- Real watchdog observation settled visibly at 121173ms. Forced native Worker death degraded visibly; the next Detect recovered on a fresh u2netp worker.
- Headed visual evidence, inspected by QA with zero console warnings/errors:
  - `KAI-10217-evidence/qa-primary-u2netp.png` — SHA-256 `b592b550408d78ff11664c1e4e364b62038f22d88bb49fe210b2f920081d88a8`
  - `KAI-10217-evidence/qa-forced-silueta.png` — SHA-256 `1ec08ecfec791f53cf0404f1cbdd78d16548a1b15cfb02486f09fd2d70a384e4`
  - `KAI-10217-evidence/qa-forced-flood-fill.png` — SHA-256 `54e49599de4a6ede941fc5ca9642173f2b281c742a98b0d994c421e0315b08a0`

## Physical-device evidence

No iPhone/iPad was attached over USB, and this Mac has Command Line Tools only—no Xcode device tools, Configurator tooling, or `idevice_*` client. The physical gate is unexecuted, not failed. Desktop evidence cannot clear it.

Full evidence and sequential audit record: `KAI-10217-qa-ledger.md`.
