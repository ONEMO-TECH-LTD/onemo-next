# [Codex s62-qa][QA-CLEAR] e508ff35

F1 is closed. `materializeDraft` now resolves and uses its own authoritative `frame` and `safeSel`; caller-owned frame dimensions are deleted from the producer, bridge and page. The page passes the actual `draft:<name>` selection on the draft path.

Independent evidence:

- Original throwaway counterexample now succeeds with `frameKey: 3x3`, exact four nodes, and `error: null`.
- Source: `materialize.ts:72-96`; bridge signature `grid-magnet-library-bridge.ts:55-58`; page call `page.tsx:122-129`.
- Regression: registry and triangle saved selections are passed directly from `saveEdit` to `materializeDraft`; triangle remains three vertices with 12.000000mm clearance (`grid-layout-library.test.ts:1106-1140`).
- No surviving caller-supplied `frameCols/frameRows`; the bridge only reads those fields from the finished record to assemble `centreMainMM`.
- Gates: production build clean; 39 effect files / 528 tests pass; TypeScript clean; scoped eslint clean; clean worktree.
- Visual gate, established Playwright fallback on the real Centre Lab at port 4046, serving worktree head `e508ff35`: square and triangle each completed save → corpus selection → saved-chip reopen → delete; reopened chip pressed; square retained 4 corners, triangle retained 3; all four families and all 76 triangle offers were also walked at this exact head with zero malformed outlines; one body/viewport/Stage; Bench returned; zero console/page errors. Evidence: `/tmp/s62-qa-e508ff35.png`.

NECESSITY: no unnecessary elements. The correction deletes duplicate inputs and reuses the resolution already performed; no helper, registry or UI condition was added.

SUFFICIENCY: delivers the rejected F1 contract in full. The pure producer accepts the identity its own authoring API emits, owns frame truth, and hands the bridge finished geometry.

