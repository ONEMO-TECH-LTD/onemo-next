# Framer Components P0 - Chief-QA gate matrix

**Owner:** `@s58-qa` (Chief QA)  
**Status:** PREPARED, NOT AUTHORIZED - Dan has not signed v1.4; no build may start  
**Contract:** v1.4 · SHA-256 `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`  
**Acceptance authority:** AC-3 · 335 rows · SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`  
**P0 scope:** exactly 16 rows; no broad P0 PASS and no row bundling into one claim

## Gate law

Each row is independently fail-able and independently stamped. A row cannot advance without:

1. Exact commit SHA and changed-file/source proof.
2. Dan-openable visible-browser proof from an isolated worktree/port/store.
3. Chief-QA adversarial verdict against that row's exact acceptance text.
4. Meta/design-fidelity verdict for visible behavior.

Tests support proof; they never replace the visible-browser stamp. Every mutation row must also prove applicable reload, undo, refusal-zero-write, console cleanliness, and baseline restoration under `AC-J-015..029`.

## Measurement holds - freeze before builder dispatch

| Row | Required freeze | Dispatch condition |
|---|---|---|
| `AC-A-008` | Expert measures Framer breadcrumb semantics; Dan resolves prominence/icon target. | No breadcrumb implementation until measured evidence + Dan call are durable. |
| `AC-A-009` | Dan-workspace live pass freezes global/library entry, read, and edit behavior. | Blocks `AC-A-005`; absence on free tier is not a waiver. |
| `AC-B-022` | Live Framer pass freezes blank Create result: frame/default/edit context. | P0 may build the measured dialog/entry only; canonical creation effects remain governed by later lifecycle rows. |

## Atomic build and proof rows

| Row | Source proof | Required human-visible proof | Adversarial edge |
|---|---|---|---|
| `AC-X-001` | Canonical create-from-selection path accepts an existing real page element with a CSS-module dependency. | Select a real styled content element, create component, observe successful replacement/result in the real editor. | Dependency-free fixture does not count; reload proves durable result. |
| `AC-X-002` | Relative module-CSS imports are canonicalized before containment/jail/hash checks. | Same real-page flow succeeds with lawful `..` import resolution. | Canonical out-of-root target still named-refuses with zero writes. |
| `AC-X-003` | Committed browser fixture contains a real page dependency graph and is exercised by the acceptance test. | Open the exact fixture and complete the real selection flow visibly. | Synthetic dependency-free fixture is supporting only. |
| `AC-X-004` | Pan gesture lifecycle cannot dereference cleared state during queued view updates. | Empty-canvas click, micro-drag, pointer-up, repeated rapidly; editor stays live. | Zero console errors, reloads, crash overlays, or lost selection state. |
| `AC-X-005` | Retry creates a fresh request after recoverable refusal. | Force one lawful refusal, press Create again without Cancel/reopen, observe a new request and usable dialog. | No wedged pending state or stale response reuse. |
| `AC-X-006` | Error-code mapping preserves named internal cause while rendering product language. | Trigger representative refusal; primary dialog copy is human-readable. | Raw internal code may exist in diagnostics, never as primary user message. |
| `AC-A-003` | Project-component double-click routes to its stable authoring identity. | Double-click a project component row and enter its one-canvas context. | No dead-end, wrong component, reload, or legacy gallery fallback. |
| `AC-A-004` | Context-menu Edit uses the same canonical entry path as double-click. | Use Edit on the same component and compare URL/context/canvas. | No second implementation path or behavioral drift. |
| `AC-A-005` | Global/library entry implements only the frozen `AC-A-009` behavior. | Operate the measured library entry in Dan's enabled workspace. | Cannot dispatch before `AC-A-009`; unavailable access never counts as PASS. |
| `AC-A-006` | Inventory/bootstrap guarantees at least one lawful authoring target. | From a realistic initial project state, visibly reach component authoring. | Empty/unsupported inventory must guide or refuse honestly, never dead-end. |
| `AC-A-008` | Breadcrumb implementation matches its completed measurement/Dan target. | Enter component mode, use Home and component crumb, verify navigation and visible ONEMO/Figma styling. | No invented dimensions, stale page inspector, or context loss. |
| `AC-B-021` | New Component opens the measured dialog surface. | Open dialog and verify Title field, disabled-empty state, explainer, Cancel. | No invented Project/Global/category fields. |
| `AC-H-012` | Owning Components tree/page exposes New Component. | Reach New Component from the actual Components owner surface. | No duplicate or dead legacy entry. |
| `AC-H-030` | Components entry reuses the same blank-create flow as `AC-B-021/022`. | Open from Components and compare the exact dialog/result contract. | No divergent second dialog or legacy request path. |

## Dependency-aware QA order

1. Freeze `AC-A-008`, `AC-A-009`, `AC-B-022` before dependent dispatch.
2. Gate `AC-X-002` before `AC-X-001`; then require `AC-X-003` visible fixture proof.
3. Gate refusal recovery/language `AC-X-005/006` and crash safety `AC-X-004` independently.
4. Gate project entry `AC-A-003/004`, then library entry `AC-A-005`, then reachability `AC-A-006`.
5. Gate blank dialog/entry `AC-B-021`, `AC-H-012`, `AC-H-030` and breadcrumb `AC-A-008`.

## Explicit non-claims

- This matrix does not authorize build, change AC-3, write Linear, or claim any row complete.
- P0 completion is not product completion. All remaining 319 AC-3 rows and every hold remain required.
- No headless-only, unit-only, screenshot-only, or fixture-only proof can satisfy a human-visible row.
