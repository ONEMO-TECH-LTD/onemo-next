# Framer Component Module — COMPLETION CONTRACT v1.2 (immutable; binds acceptance authority AC-2)

**Owner:** @s58-designer (lead + meta) · **2026-07-13** · supersedes v1.1 (dated snapshot). v0 architecture §1–§10 stands. This is the LAW + structure; it holds NO status matrix (live status lives in Linear).
**Reviewed-before-sign:** one adversarial pass by @s58-qa (Chief QA) + @s58-expert on this whole immutable doc → then Dan sign. No product build before that.

## BINDING — the acceptance authority
- **Acceptance authority = `__qa-dispatch/s58-framer-parity-ATOMIC-ACCEPTANCE-CHECKLIST.md`, revision AC-2.**
- **264 stable checkbox rows · 333 lines · SHA-256 `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`.**
- Base AC-1 (`6c4554c1…e30b3e`) reconstructs byte-exact inside AC-2 — append-only, no original ID/text changed.
- **Any AC change → new annex revision (AC-3…) + new hash + Chief-QA re-freeze + one re-review. Never a silent edit.** v1.2 re-binds only on a new signed revision.
- Mechanical audit (Chief QA): 264 definitions, 0 duplicate IDs, 0 malformed rows, 0 prefix gaps, full 333/333 reread, deslop clean.

## Product Law
Clone Framer's **behaviour, model, full functionality**, rendered in **ONEMO/Figma styling** (DS tokens, Chillax, brand oklch, Phosphor-light icons — never Framer purple/chrome). Clone only what is **extracted and in front of us** — no invention, no vibe-code, no guessed numbers. Any target dimension/vocabulary comes from a measured Framer source or a Dan decision.

## Dan product decisions (approved)
Drag-insert = MANDATORY · **New Event = BUILD** (extraction: it mints an **Event variable**, not a variant wire) · **Blank-create = RESTORE** (extraction confirmed Framer HAS it — contradiction resolved in contract's favor).

## Completion Law — 5-stamp rule per AC-2 row
DONE only with ALL FIVE: **① source-proof** (commit) · **② human-visible browser proof** (Dan-openable; headless NEVER substitutes) · **③ Chief-QA independent PASS** · **④ Meta/design-fidelity PASS** (Figma-styled Framer, V1–V10 / S1–S9) · **⑤ Dan sign-off**. Stamps tracked in the row's Linear issue. Nothing is DONE without all five.

## Layer discipline (no conflation)
`schema/model exists` ≠ `command exists` ≠ `UI exists` ≠ `runtime exists`. Schema-only (InteractionEdge, `VariantFrame.kind`, TransitionSpec, AssetFolder, override-lineage) = UNBUILT/foundation, NOT partial. `semantic command` ≠ `lifecycle op` (import/revalidate/rebase/undo). Old lib.ts writers = unreachable cemetery (route-refused) = removal work, not capability.

## TRUE-STATE HEADLINE @ 8d64fd3 (three audits + expert real-Chrome, converged)
**There is NO working authoring path from any real CONTENT page.** create-from-selection refuses any module-css-styled element (= every element of every real content page; module-css escapes root — the passing E2E was a lab fixture); asset double-click dead-ends (global-only, project-only edit, blank-create removed); empty-canvas click can crash (pan null-race). The free-variant slice works only via a synthetic fixture OR a dependency-free selection (e.g. an empty draft-page root div — expert-proven live create→variant→rename→move→undo). **P0 restores a real-content authoring path before anything else.**

## Traceability — AC-2 rows ↔ Linear E12
Sprint **E12 = KAI-9437** (under KAI-9302). Capability issues mirror AC-2 groups: **A** KAI-9438 · **B** 9439 · **C** 9440 · **D** 9441 · **E** 9442 (props = **unified Variables model, 15 kinds**) · **F** 9443 (incl. New Event = event variable) · **G** 9444 · **H** 9445 (folders + blank-create) · **I** 9446 · **K** 9447 (content-edit) · **J** 9448 (gate) · **L** 9449 (style inspector) · **P0** 9450 (X1 real-page create / X2 crash / A2b dead-end / X1-UX = wedged-dialog-retry + product-language errors). *(Note: the expert's X3 = reload-loses-edit-context is a roadmap item, NOT P0 — the P0 UX items live inside X1.)* Each 5-stamp tracked in its issue. Supersedes stale E7/E10/E11.

## Build-order (Chief-QA-corrected dependency chain — content/inspector are FOUNDATIONAL, not last)
**P0** real user path: KAI-9450 (X1 create-from-real-page + X2 crash + A2b dead-end) + B2 blank-create + A3 breadcrumb (measured, target ⧗ expert/Dan — NOT invented). →
**P1** inner-content edit (K) + style-inspector foundation (L). →
**P2** lifecycle/menu (B) + folders/page/category/moves (H). →
**P3** variants/override (C) + states (D). →
**P4** props/Variables (E — 15 kinds). →
**P5** interactions (F, incl. New Event=event variable) + play/preview (G). →
**P6** instances (I). Each = one atomic slice, sources in front, 5-stamp before the next.

## Owners
- **@s58-designer** — lead + meta (contract, Linear, gate orchestration; NO build).
- **@s58-engineer** — sole builder, one atomic slice at a time, sources in front, no invention, human-visible proof required.
- **@s58-expert** — independent adversarial QA peer + live-Framer extraction of ⧗ needs-manual rows + overflow (bounded verify, no open-ended build).
- **@s58-qa** — CHIEF QA (single lane): sole writer of AC-2, independent classification, adversarial per-slice, human-visible gate, no self-closure.
- **Dan** — product decisions + final sign-off. Nothing DONE without Dan.

## ⧗ Still needs-manual (expert flagged — do NOT guess; extract before the owning slice's AC freezes)
instance value-edit + reset-to-default · event row on instance · layer-side fire-event action · zero-instance Delete state · folder "…" contents · **Library › submenu contents** · drag-into-folder · one Copy-Import ESM fetch to pin the compiled `addPropertyControls` shape · breadcrumb A3 target dims.
**Spec insurance (measured):** the instance-panel "Trigger" row is a PAID Convert add-on (upsell), NOT the event authoring UI — do not spec it as event UI in the E/I slices.

## Process (locked)
Probes/E2E run in THROWAWAY per-auditor worktrees, never the authoritative build branch. Cleanliness = capture baseline both repos + restore exact baseline (quarantine-move, never rm untracked without Dan confirm). Batch → freeze → one review (no live-patching under review).

---
**v1.2 is immutable on Dan's sign.** Next: one adversarial review (@s58-qa + @s58-expert) on this whole doc → Dan sign → build P0. **No product build until Dan signs.**
