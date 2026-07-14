# Framer Components P0 - Chief-QA source-seam baseline

**Owner:** `@s58-qa` (Chief QA)  
**Status:** PREPARED, NOT AUTHORIZED - Dan has not signed v1.4; no build may start  
**Product baseline:** clean `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f`  
**Contract:** v1.4 | SHA-256 `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`  
**Acceptance authority:** AC-3 | SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`  
**Gate matrix:** SHA-256 `02ac3a0c4bae4e79653bf13bb6967eff760f6f5cbc8aa16609391099a55d8c9e`

This is the exact pre-build source map for the 16 P0 rows. It adds no acceptance law, does not authorize implementation, and does not mark any row complete.

## Full-read scope

- `src/app/(dev)/react-figma/page.tsx` 1-4449
- `src/app/api/dev/editor-authoring/handler.ts` 1-238
- `src/app/api/dev/editor-write/route.ts` 1-50
- `src/app/api/dev/editor/authoring-compiler.ts` 1-495
- `src/app/api/dev/editor/source-projection.ts` 1-282
- `src/app/api/dev/editor/authoring-session.ts` 1-556
- `src/app/api/dev/editor/authoring-import.ts` 1-334
- `src/app/api/dev/editor/lib.ts` 1-2750
- `src/app/api/dev/editor/runtime-root-registry.ts` 1-101
- `src/app/api/dev/editor/authoring-schema.ts` 1-672

## Exact seam map

| AC-3 row | Current source truth at `8d64fd3` | Required fix/proof boundary |
|---|---|---|
| `AC-X-002` | `lib.ts:1616-1623` derives a CSS dependency by string replacement. A lawful relative import containing `..` remains non-canonical. `authoring-schema.ts:31-36` and `runtime-root-registry.ts:42-61` then correctly refuse that alias. | Canonicalize the CSS specifier against the owning store-relative source directory before dependency lookup/hash/jail. Never relax dot-segment, containment, or symlink refusal. Prove lawful in-root `..` succeeds and canonical out-of-root still refuses with zero writes. |
| `AC-X-001` | `lib.ts:2435-2534` copies selected free imports into the extracted component and relocates relative import specifiers. `authoring-compiler.ts:40-90` then reparses the new component. A real styled selection reaches the malformed CSS dependency key above and refuses before commit. | Gate the complete real-page selection flow after X002. The dependency-free lab fixture is supporting evidence only; reload must prove the extracted component, consumer replacement, graph, and history are durable together. |
| `AC-X-003` | `authoring-session.ts:57-112` already routes preview and commit through the exact snapshot/compiler/transaction stack, but the accepted browser fixture does not prove the real CSS dependency graph. | Commit a realistic page fixture whose selected subtree imports a component/CSS module through the real dependency topology. Visible proof must open that fixture, not substitute an in-memory or dependency-free case. |
| `AC-X-004` | `page.tsx:3660-3679` checks `pan.current`, then dereferences it inside a deferred `setView` updater. `onUp` can clear the ref before that updater executes. | Capture immutable pan coordinates/delta before queueing the update, or otherwise remove the deferred ref dereference. Visible rapid click/micro-drag/up repetition must remain live with zero console errors/reloads. |
| `AC-X-005` | `page.tsx:3080-3160` creates fresh command/transaction UUIDs per submit and resets `busy` after catch, but source alone does not disprove the live refusal-wedge report. | Browser proof must force a recoverable refusal, retry without closing, observe a second request with fresh IDs, and show no stale completion or pending state. Preserve zero-write refusal evidence. |
| `AC-X-006` | `handler.ts:231-238` returns internal `error` and `code`; `page.tsx:3113-3118,3140-3158` promotes the code/message directly into primary dialog copy. | Add a product-language mapping at the visible boundary while retaining named codes in diagnostics. Representative refusals must never show raw codes as the primary message. |
| `AC-A-003` | `page.tsx:2256-2309,3924-3927` exposes project-component double-click and directly sets `editingComponent`. | Prove the stable project identity enters the one-canvas context with no gallery fallback, reload, or wrong component. |
| `AC-A-004` | `page.tsx:3928-3935` context-menu Edit uses the same `editingComponent` state transition as double-click. | Gate both entries against the same component and compare context/canvas identity. Do not introduce a second backend or navigation path. |
| `AC-A-005` | `page.tsx:3924-3931` explicitly refuses global/library authoring. | HOLD behind `AC-A-009`. After the behavior is frozen, implement and visibly prove only that evidence-backed behavior; free-tier absence is not a pass. |
| `AC-A-006` | Reachability currently depends on inventory contents plus project entries; an empty inventory only shows a selection-extraction instruction (`page.tsx:2274-2279`). | After X001-X003 and entry fixes, prove a realistic initial project always has one lawful path or an honest actionable refusal, never a dead end. |
| `AC-A-008` | A styled Home/component breadcrumb exists at `page.tsx:3994-3999`, but target prominence/icon semantics remain unresolved. | HOLD. No implementation change until measured Framer evidence and Dan's call are frozen; then gate Home, component crumb, context retention, and stale-inspector regression visibly. |
| `AC-A-009` | The required Dan-workspace global/library entry behavior is not frozen; source currently contains only the refusal above. | HOLD. Measure entry, read, and edit behavior in Dan's enabled workspace and freeze the result before `AC-A-005` dispatch. |
| `AC-B-021` | The existing `CreateComponentDialog` at `page.tsx:1475-1504` belongs to selection extraction, not blank creation. | After `AC-B-022` measurement, build the measured blank New Component dialog with its independent empty/valid/Cancel behavior. No invented fields. |
| `AC-B-022` | No blank-create command/result path exists; `page.tsx:3910-3923` explicitly defers it. | HOLD. Measure the live Framer Create result before effects are dispatched. The measured result then governs frame/default/edit-context proof. |
| `AC-H-012` | The Components-owned plus button exists at `page.tsx:3910-3913`, but currently calls selection extraction. | Rebind the owner entry only after the blank-create contract is frozen. Do not leave a duplicate or dead legacy entry. |
| `AC-H-030` | Components has no shared blank-create flow; the current plus button aliases `openCreateComponentDialog` for selection extraction. | Reuse the single `AC-B-021/022` blank-create dialog/result path. Do not introduce a second dialog or reopen legacy `editor-write` creation. |

## Anti-slop disposition

- KEEP: disk and staged parsing are two adapters into the single `parseComponentModelSnapshot` authority (`lib.ts:1498-1546`), not duplicate compilers.
- KEEP-FLAGGED: `editor-write/route.ts:12-45` refuses component-authoring kinds before `applyWrite`, while `lib.ts:2675-2701` still dispatches their legacy implementations. This is confirmed cemetery outside this P0 seam package; no deletion is authorized here.
- Do not add a second authoring route, parser, dialog, or component-entry state owner. Fix the existing canonical seams after Dan signs.

## Gate consequence

Current `8d64fd3` does not satisfy the P0 acceptance rows; that is the expected pre-build baseline, not a new phase verdict. After Dan signs, each row must still clear the exact-SHA, visible-browser, Chief-QA, and Meta stamps in the registered P0 matrix. P0 is not product completion.
