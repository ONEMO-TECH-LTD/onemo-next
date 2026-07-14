# s58 react-figma coverage + verification audit

Verdict: **REWORK / NOT gate-clear**.

Reason: the brief asked to verify live `:3025` at frozen HEAD `87b26fa`, but the target moved during QA: `87b26fa` → `0f49814` → `1ead0f4`. Current live behavior can be sampled, but this is no longer a clean frozen-target QA pass.

## Inputs read

| Input | Read scope |
| --- | --- |
| `__qa-dispatch/s58-annotations-digest-2026-07-05.md` | full file, lines 1-42 |
| `__TRANSCRIPT VAULT/claude/s58/designer/2026-07-05/2-s58-designer--11-15.md` | full file, lines 1-1221 |
| `__TRANSCRIPT VAULT/claude/s58/designer/2026-07-05/_day.md` | full file, lines 1-2225 |
| Linear | `KAI-9347`, `KAI-9350`, children `KAI-9351..9363`, `KAI-9364`, plus targeted searches for Phosphor/undo/link/file-menu |
| Browser | Playwright real clicks/mouse on `http://localhost:3025/react-figma` |

## Findings

| Severity | Finding | Evidence |
| --- | --- | --- |
| HIGH | Frozen target invalidated. The requested target was HEAD `87b26fa`; current worktree advanced first to `0f49814`, then to `1ead0f4` while this audit was running. | `git log`: `1ead0f4 feat(react-figma): wrap-jsx-link op...`, `c06df83 feat(react-figma): TRUE component rename...`, `0f49814 feat(react-figma): layer rename...`, then `87b26fa`. |
| HIGH | The target is not stable enough for a frozen QA verdict. I observed an uncommitted `src/app/api/dev/editor/lib.ts` diff mid-audit; it then disappeared because the branch advanced to committed `c06df83`/`1ead0f4`. Current status is clean except pre-existing `test-results/`, but the moving source invalidates the original gate. | `git status --short`: `?? test-results/`; `git log -5` shows two new commits after the first audit snapshot. |
| HIGH | `KAI-9358` is not gate-clear. Linear still says Backlog; current code has page create/delete/rename and later layer/component rename work, but I did not verify add/delete flows live because the target was moving under QA. Layer delete/add as explicit row controls are not proven. | `page.tsx:2295`, `page.tsx:2308`, `page.tsx:2322`, `editor/lib.ts:443`, `editor/lib.ts:642`, `editor/lib.ts:649`; Linear `KAI-9358` status Backlog at query time. |
| MED | `KAI-9354` is still partial. A real `FigmaField` exists, but hand-rolled field variants remain for resizing and gap controls, while Linear status is Building. | `page.tsx:451` defines `FigmaField`; `page.tsx:564` `ResizeDropdownField`; `page.tsx:601` `GapDropdownField`; Linear `KAI-9354` status Building. |
| MED | `KAI-9359` and `KAI-9360` are not done. Both were Building at query time, not Ready. `1ead0f4` adds server-side link write plumbing after my live probe, but I did not verify a matching inspector UI or E2E link flow. | Linear `KAI-9359`/`KAI-9360` status Building; file menu source remains page/build-source menu at `page.tsx:2769-2786`; link server op exists at `editor/lib.ts:240` and `editor/lib.ts:492-536`. |
| LOW | Console is not fully silent, but no route errors were present after reload/selection. One Canvas2D performance warning remains. | Playwright console: `0 errors, 1 warning`, `engine.ts:663` `willReadFrequently` warning. |

## Verified current behavior

These are sampled current-target live checks, not a clean `87b26fa` frozen-target closure. HEAD changed during the audit, so anything not directly re-probed after `1ead0f4` should not be treated as closed.

| Linear | Current status | QA result |
| --- | --- | --- |
| `KAI-9347` E5 sweep | Backlog | PARTIAL. Many controls now work, but parent cannot close while E6 children remain Building/Backlog and the target is moving. |
| `KAI-9351` Zoom +/- real click | Ready for Dan | PASS. Real Playwright click changed zoom from `60%` to `94%`. Source guards interactive children at `page.tsx:2681-2685`. |
| `KAI-9352` Draw-to-place iframe swallow | Ready for Dan | NOT FULLY VERIFIED. Source has draw mode and `pointerEvents: drawArm ? 'none' : 'auto'` on iframe, but I did not perform the write probe because the target was moving. |
| `KAI-9353` Fresh token binding pill | Ready for Dan | PASS. Real picker click on X-position showed `prim-dim-0` as a pill, not raw `var(...)`; source handles live `var(...)` at `page.tsx:431-433`, `page.tsx:461-468`. |
| `KAI-9354` FigmaField everywhere | Building | REWORK/PARTIAL. `FigmaField` exists, but custom `ResizeDropdownField` and `GapDropdownField` remain. |
| `KAI-9355` Pages/Layers divider drag | Ready for Dan | PASS. Real mouse drag moved divider y-position; source uses `role="separator"` and pointer capture at `page.tsx:2834-2840`. |
| `KAI-9356` 2x2 grids / remove Inset / publish disabled | Ready for Dan | PARTIAL PASS. Inset absent; z-index remains; Publish disabled gray/full-width verified. 2x2 coverage not fully probed across every 4-input group. |
| `KAI-9357` Variables JSON SSOT | Ready for Dan | PASS. Live Variables rail auto-loads `Figma · figma-export.json`, collections, HEX figma values, CSS variable/code columns. Source reads SSOT at `editor-tokens/route.ts:20`, serves `?figma=1` at `editor-tokens/route.ts:90-93`, renders figma/code columns at `page.tsx:886-894`. |
| `KAI-9358` Pages AND Layers CRUD/rename | Backlog | REWORK/OPEN. Current code is beyond `87b26fa` and includes page ops + layer/component rename, but ticket remains Backlog and live destructive probes were blocked by target drift. |
| `KAI-9359` File menu/Finder/recents/version/delete/branch | Building | OPEN. Live UI sampled before the latest commits still showed raw path/tree; no Finder/recents/version/branch flow verified. |
| `KAI-9360` Link control | Building | OPEN / NEEDS RE-QA. `1ead0f4` adds a server link op after my live probe, so the prior "no Link UI" observation is stale. The new link layer was not independently verified live. |
| `KAI-9361` Assets tabs/thumbnails | Ready for Dan | PASS. Real clicks: Components empty state, `Images · 2`, `Icons · 11`. Source tabs at `page.tsx:2874-2881`, image tiles at `page.tsx:2904-2917`, icon tiles at `page.tsx:2919-2933`. |
| `KAI-9362` Text section anatomy | Ready for Dan | BASIC PASS. Real click on iframe text exposes text inspector section with `Text`, `Aa`, `Chillax`, `Medium`, fill/opacity controls. Not pixel-measured against Figma in this pass. |
| `KAI-9363` Token scopes | Ready for Dan | PASS. X-position picker showed dimension tokens, no color-like values. Source joins `$scopes` at `editor-tokens/route.ts:21-43`, filters by field scopes at `page.tsx:202-217` and `page.tsx:268-272`. |
| `KAI-9364` E7 Components Canvas | Backlog | OPEN by design. Tracked but not built in this E6 pass. |

## Coverage map

| Dan request | Linear tracking |
| --- | --- |
| Zoom pinch too slow / zoom still not working | `KAI-9347`, `KAI-9351` |
| Panel zoom control | `KAI-9347`, `KAI-9351` |
| Frame not selectable / frame wrapper selection focuses layers/canvas | `KAI-9347` |
| Frame preset/resizer not wired | `KAI-9347` |
| Remove useless Design/Prototype tablist | `KAI-9347` |
| Component creation/code like Framer | `KAI-9347`, later broadened by `KAI-9364` |
| Code panel open/remove | `KAI-9347` |
| More actions duplicate/delete | `KAI-9347` |
| Alignment controls fail / grid alignment wrongly mapped | `KAI-9347` |
| Token picker not wired / short label / colors / scope filtering | `KAI-9347`, `KAI-9353`, `KAI-9363` |
| CSS position / z-index / X/Y wrong values | `KAI-9347` |
| Inset/z-index, remove redundant inset, 2x2 grids | `KAI-9347`, `KAI-9356` |
| Freeform/Grid flow behavior | `KAI-9347` |
| Stroke TRBL / Stroke not reading | `KAI-9347` |
| Corners/padding reusable component | `KAI-9347`, `KAI-9354` |
| Fill/Effects/Selection colors/Layout guide not working | `KAI-9347` |
| Insert tools create divs/frames/text; draw-to-place real drag | `KAI-9347`, `KAI-9352` |
| Layers header resizable | `KAI-9347`, `KAI-9355` |
| Assets rail images/components/icons/thumbnails | `KAI-9347`, `KAI-9361` |
| Tools/Agents rails investigate/remove | `KAI-9347` |
| Variables Figma JSON format/columns/header resize/scopes | `KAI-9347`, `KAI-9357`, `KAI-9363` |
| Publish = save button + disabled state + dropdown/badge + stretch full width | `KAI-9347`, `KAI-9356` |
| Undo/redo CmdZ/ShiftCmdZ and Phosphor-only icons | `KAI-9347` umbrella; no dedicated E6 child found |
| Pages add/delete/rename + Layers add/delete/rename/data-name/component rename conventions | `KAI-9358` |
| Finder build path + recents + file menu publish/version/duplicate/delete/branch | `KAI-9359` |
| Framer Link section | `KAI-9360` |
| Text section conformance | `KAI-9362` |
| FigmaField standardized inputs | `KAI-9354` |
| Columns auto-fit/distribute | `KAI-9357` partial; no dedicated child found |
| Components separate canvas/library | `KAI-9364` |

## Missing / weak tracking

No fully untracked Dan request was found if `KAI-9347` is accepted as the broad E5 umbrella. If the standard is one issue per actionable chat-only request, these are weakly tracked only through the umbrella or adjacent child, not as dedicated E6 children:

| Request | Current tracking gap |
| --- | --- |
| Undo/redo CmdZ/ShiftCmdZ + Phosphor-only icons | Only `KAI-9347` umbrella found; source implements at `page.tsx:2556-2593` and `page.tsx:3011-3015`. |
| Publish = save/dropdown/badge/stretch | `KAI-9356` covers disabled state, but not the full publish menu semantics as a standalone child. Source implements menu at `page.tsx:2974-3004`. |
| Columns auto-fit/distribute | `KAI-9357` covers variables columns/resizing; no explicit child for auto-fit/distribute behavior beyond reset/double-click source at `page.tsx:829-832`. |

## Side effects

I made no source edits and did not touch Linear states. I wrote only this artifact. I stopped destructive live probes when the target moved under QA. Current worktree status is clean except `?? test-results/`, which I left untouched.
