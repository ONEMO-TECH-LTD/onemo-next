# KAI-10218 independent QA verdict

Verdict: **CLEAR** on exact pushed snapshot `0b747d813e62f0ce77b7f2b3f9a93e213a7741a7`, parent `de31f1e3b16d4f756e2d805b7040decef2cb1738`, against authoritative contract SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 3.

## Source audit

- Replacement Upload constructs and decodes the candidate before touching accepted state, discards failed/stale candidates, resets history only after candidate success, publishes the new canvas/URL before revoking the old URL, and clears the old caches/output (`flow.ts:363-408`).
- One artwork identity fences Detect, tool, prepare, bake, Save, restore, Clear, replacement, and unmount publication; it augments rather than replaces the existing generations (`flow.ts:99-102`, `flow.ts:287-360`, `flow.ts:411-430`, `flow.ts:584-690`, `flow.ts:718-732`).
- The old replaceable pending slot is gone. Paint and GrabCut share one array-backed FIFO, one drain, and one captured-artwork validity check (`flow.ts:243-284`, `flow.ts:455-516`). Replacement, restore, Clear, and unmount settle queued callers and stale-suppress the bounded active operation.
- Successful Upload replaces the existing `HistoryStack`; every accepted cut/tool and every committed node/Frame edit pushes through the existing owner; Clear pushes; restore does not push. Failed restore publishes nothing and restores the cursor (`flow.ts:104-112`, `flow.ts:354`, `flow.ts:537-580`, `flow.ts:584-651`; `history.ts:4-18`).
- Full-bake waiters now own a timeout and are resolved/rejected on success, failure, cancellation, replacement, Clear, preview exit, and unmount; status and busy publication are generation-fenced (`flow.ts:132-149`, `flow.ts:167-205`, `flow.ts:637-690`, `flow.ts:718-732`).
- One-point Paint now renders and rasterizes the same filled disk; canvas and SVG overlay route pointer cancel/leave through the existing single commit path; a committed node edit replaces the selected-node base before the next adjustment (`mask-tools/index.ts:75-103`; `page.tsx:130-147`, `page.tsx:233-260`, `page.tsx:408-410`; `EditorOverlay.tsx:115-132`). Existing node insert/delete/selection owners are unchanged.
- `finish.ts` adds only the required accepted-artwork preseg-cache release owner (`finish.ts:163-172`). No GrabCut no-op, output-adapter, compositor, provider, Figma/UI, relocation, or KAI-10219 work entered the diff.

## Independent gates

- Tracked snapshot and upstream match; diff check passes. Only `_WIP/` review records are untracked.
- Full Vitest: 57 files passed, 1 skipped; 529 tests passed, 2 expected later-increment failures, 10 skipped.
- TypeScript, scoped ESLint, and Next 16.2.12 production build pass; `/cutout-lab` is generated.
- Existing preservation oracle passes with exact primary/replacement PNG `d7a28a…` and post-GrabCut PNG `55e6178e…`.
- Detector oracle passes in Chromium and WebKit with u2netp then Silueta ordering intact.
- Independent exact-current flow oracle passes on the real `/cutout-lab` route served from this worktree at commit `0b747d81`: corrupt replacement retains byte-identical output; Paint burst completes add → erase → add once each; both pointer-cancel paths commit once; selected-node drag survives the next curve edit; Clear/Undo/Redo and failed restore are atomic; Detect, standalone GrabCut, and Paint each remain snapshot 0; replacement receives no active/queued tool state; browser console has zero warnings/errors.
- Visual observation: the final replacement is visibly the clean accepted image with Save, Undo, Redo, and Clear disabled and status `image ready`; no old cut/history/status/output is active. Evidence: `KAI-10218-evidence/qa-flow-final.png`, 1280×797, SHA-256 `f888fce51cf564cbe9ef2f218e9fa5a7caba9883aa1428cd537290f8c319aee1`.

## Necessity and sufficiency

Necessity — **no unnecessary elements.** The added identities, FIFO owner, waiter settlement, cache release, three surgical UI/tool fixes, and one route oracle each map to an Increment 3 defect. No parallel state/history/gesture framework or downstream work was added.

Sufficiency — **delivers Increment 3 in full.** Atomic replacement/restore, ordered lossless accepted gestures, current history semantics, stale-work suppression, all named settlement paths, one-point Paint, node rebase, pointer cancellation, and the required current-code journey are source- and runtime-proven.

KAI-10219 remains dependency-locked pending the Meta gate.
