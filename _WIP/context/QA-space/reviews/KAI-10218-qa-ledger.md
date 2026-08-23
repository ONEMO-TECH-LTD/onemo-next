# KAI-10218 independent QA ledger

## Authority

- Snapshot: `0b747d813e62f0ce77b7f2b3f9a93e213a7741a7`.
- Parent: QA-cleared KAI-10217 snapshot `de31f1e3b16d4f756e2d805b7040decef2cb1738`.
- Local and upstream heads match.
- Contract: 177 lines, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 3.
- Live KAI-10218 entered `In QA review`; KAI-10219 remains Backlog and blocked.

## Atomic deliverables

1. Atomic replacement Upload: decode/prepare locally; failure preserves accepted artwork, URL, history, and derived state; publish then revoke old URL.
2. Minimum artwork invalidation prevents cross-artwork and stale publication.
3. Replace the single pending tool slot with one ordered lossless FIFO.
4. Reset history on successful Upload; first accepted Detect, standalone GrabCut, or Paint is non-undoable snapshot 0; later changes and Clear append; Clear stays undoable; Undo/Redo add nothing.
5. Restore prepares locally and publishes atomically; failed restore changes nothing.
6. Every exit settles queues, timers, `fullBakeWaiters`, status, and busy state.
7. Fix one-point Paint, selected-node rebase after committed geometry, and pointer cancel/leave while preserving insert/delete/selection behavior.
8. No GrabCut no-op cleanup, output work, parallel framework, or KAI-10219 build-ahead.
9. Prove corrupt replacement, stale suppression, FIFO burst order, all three first-cut histories, Clear/Undo, failed restore, and the current-code long-edit journey.

## Review state

- Full-read authoritative contract (177/177), Builder ledger (117/117), all changed production files, new flow oracle, package entry, characterization test, and unchanged `HistoryStack` dependency.
- `finish.ts` change is bounded to an explicit preseg-cache disposer plus ownership comments; no compositor/output behavior changed.
- `mask-tools` renders a one-point stroke as one filled disk. Canvas and overlay both settle `pointercancel`; canvas `pointerleave` remains routed through the same commit path.
- Successful Upload resets `HistoryStack`; candidate decode/canvas creation precedes accepted-state invalidation; failed candidate revokes only itself; successful publication precedes old-URL revocation.
- Paint and GrabCut share one array-backed FIFO owner. Each job captures its accepted artwork generation and settles through one drain path; replacement/Clear/unmount settle queued callers and fence active publication.
- Restore prepares the candidate before publishing refs/state, and rolls the history cursor back if preparation fails.
- The accepted first cut is snapshot 0 under the unchanged `HistoryStack`; Clear appends; Undo/Redo restore without pushing.
- Selected-node base is updated only after a committed geometry edit, preserving subsequent drag coordinates. Existing insert/delete/selection owners remain unchanged.
- New Playwright oracle exercises current route for corrupt replacement, one-point Paint, FIFO Paint order, both pointer-cancel surfaces, selected-node rebase, long edit -> Clear -> Undo/Redo, failed restore, all three first-cut paths, and replacement cancellation.
- Pending exact-diff necessity/sufficiency judgment, investigation of vector-control history wording and active-tool replacement settlement, complete headless gates, and exact-current visual observation.

## Independent gates

- Full Vitest: 57 files passed, 1 skipped; 529 tests passed, 2 expected later-increment failures, 10 skipped.
- TypeScript: pass.
- Scoped ESLint over every changed source/oracle file: pass with zero output.
- Next 16.2.12 production build: pass; 22 pages generated and `/cutout-lab` present.
- Existing preservation oracle: pass; exact primary/replacement PNG `d7a28a…`, post-GrabCut PNG `55e6178e…`.
- Detector oracle: pass in Chromium and WebKit; u2netp -> Silueta order preserved.
- Exact-current flow oracle: pass on worktree-served commit `0b747d81`; corrupt replacement byte-equality, add -> erase -> add FIFO, both pointer-cancel paths, node rebase, Clear/Undo/Redo, failed restore, all three snapshot-zero paths, and active/queued replacement invalidation all pass with zero console warnings/errors.
- Independent visual evidence: `KAI-10218-evidence/qa-flow-final.png`, 1280x797, SHA-256 `f888fce51cf564cbe9ef2f218e9fa5a7caba9883aa1428cd537290f8c319aee1`; accepted replacement shows Save/Undo/Redo/Clear disabled and `image ready` with no active old cut/history/output.

## Final judgment

- Vector/Frame history wording is satisfied by the existing `editCommit` owner: node insert/delete/adjust and Frame commits all append once; collective knob ticks retain their accepted existing cadence and travel with the next snapshot.
- Active tool replacement settlement is bounded and correct: waiting callers settle immediately, the active operation is generation-stale and cannot publish, and the single drain remains the sole owner until its bounded await exits. No second cancellation/queue system is justified.
- Necessity: no unnecessary elements.
- Sufficiency: delivers Increment 3 in full.
- Verdict: CLEAR on `0b747d813e62f0ce77b7f2b3f9a93e213a7741a7`. KAI-10219 remains locked until Meta.
