# Framer-clone Component Editor — BUILD BLUEPRINT
@s58-expert · 2026-07-10 · **supersedes the thin `s58-framer-clone-SPEC.md`**
Extraction source: live user-position click-through + code/DOM dig of Framer (my scratch project
"Powerful Autonomy"; Dan's real project untouched). Evidence ledger: `s58-framer-extraction-ledger.md`.
Awaiting: independent peer verification (designer + QA dig Framer themselves) → then Dan sign-off. **NO build code until signed.**

> **STATUS 2026-07-10 (post-QA): ARCHITECTURE REWORK — do NOT build from this doc.** Designer independently confirmed the
> BEHAVIOUR/direction; QA's authenticated Framer pass + full source read found the **authoring MODEL** ("keep whole engine /
> multi-axis under the hood") architecturally incapable of Framer's real model (primary/override variant lineage, 4-form
> TransitionSpec, arbitrary interaction edges, folders, preview). **I (expert) independently re-verified the two model-critical
> gaps myself** — see `s58-framer-evidence-challenge-expert.md`. This blueprint is now a **behavioural-evidence INPUT** to a
> canonical-model architecture revision **owned by @s58-engineer** (per QA §12). Not sign-ready. Evidence labels
> (observed/inferred/unverified) per the challenge memo §2 override the earlier "sign-ready" note in §8.

---

## THE LAW (Dan's directive, verbatim intent)
1. **Clone Framer's BEHAVIOUR and MODEL exactly** — every feature, pulled from Framer's real mechanics, not from memory.
2. **Render it in OUR design language** — ONEMO/Figma styling. **NOT a mixed-bag Framer-purple chrome.** Framer gives us the *interaction model and layout logic*; the *skin* is ours (our type scale, surfaces, accent, Phosphor-light icons, spacing).
3. The codegen **engine** underneath (I0–I6: model → clean React+CSS on disk) **stays** — it is the correct, hard-won backbone. What we rebuild is the **editor surface**.

Test for every screen we build: *"Would a Framer user recognise the behaviour instantly, AND would Dan recognise the skin as ONEMO, not Framer?"* Both must be yes.

---

## 1. WHAT FRAMER ACTUALLY IS (extracted, each cited by what I operated)

**Architecture.** The editor shell (framer.com) hosts the canvas as a **cross-origin sandbox iframe**
(`canvas-iframe` → `*.framercanvas.com/canvas-sandbox.html`). Play mode swaps in a **separate `preview-iframe`**
(live `framer.app` render). Left panel tabs `pages/layers/assets`, right panel tabs `Agent(chat)/Style(properties)`,
top `projectbar` with `preview-button` (▶). *(This iframe split is why our single-surface board felt wrong — Framer
cleanly separates author-canvas from live-preview.)*

**1.1 Infinite canvas, absolute placement.** Frames/components sit free at absolute X/Y. Zoom `100% ▾`, Hand-pan.
Not a grid, not a sheet.

**1.2 Edit a component IN PLACE.** Select an instance → inspector shows `<Name> · Component` + **Edit Component**
(double-click also enters). Editing opens the **same infinite canvas** (`?node=<componentNode>`) showing the
component's **variants as free frames**; breadcrumb `Home › <Name>` as a **top-bar chip**; Layers lists the variants;
`Home` exits. *(Not a separate "board of all components".)*

**1.3 Variants are FREE and NAMED.** `+Variant` ghost → a new free frame "Variant 2" (renamable). "Variant 1" carries
the **Primary** (default) tag. A **separate "Hover / Pressed" ghost slot** below creates interaction-state variants (⊕).
**No fixed 6-state list, no forced CVA axis inputs** — that was my invention.

**1.4 Connectors = interactions (trigger → action).** Inspector **Interactions (+)** → **New Transition** or **New Event**.
New Transition makes a row **`Click`(trigger) → `Set Variant`(action)**.
- **Trigger vocabulary — READ from the live `<select>` (value `onTap`), confirmed by me directly + designer independently:**
  **`Click · Click Start · Appear · Mouse Enter · Mouse Leave`**. There is **NO** Hover/Press/Scroll token at the
  variant-transition level — hover/press semantics live in the separate **Hover/Pressed state-variant gesture** (§1.3),
  a different mechanism. *(My first pass wrote "Click/Hover/Press/Appear/Scroll" — that was an assumption and is WRONG. Corrected here.)*
- **`New Event` has its own separate vocabulary — neither extraction opened it. PRE-BUILD extraction item (do not assume).**
- **Set Variant popover parameters (the "rules for the nodes" — Dan's Q5), operated live by the designer:**
  **`On` (trigger) · `Delay` (seconds stepper) · `Transition: Once | Cycle` (segmented) · `Variant` (target picker: Set Variant… · Variant 1/2/3)**;
  clearing the action leaves a **`Reset…`** action (reset-to-base state). **Multiple interaction rows per variant** are allowed.
  `Cycle` is exactly what our engine's switch-cycle maps to; `Once` = a single transition.
- Target animates by the target variant's **Transition** (first-class Style property, default **Spring** ⚡). NOTE (F-D7):
  the *generated code* defaults to `{type:"spring", bounce:0.2, duration:0.4, delay:0}` (bounce/duration form), while our
  engine speaks stiffness/damping/mass — Framer supports both; **record which form we author + the conversion** (build decision).
- A **▶ badge** on the variant label — semantics richer than "has an interaction": designer saw it on a freshly-created
  variant with ZERO interactions *while selected*, gone on deselect. **PRE-BUILD hand-verify the exact rule before any AC cites it.**
- **Remove a connector = the ✕ on the interaction row** (or delete the wire).
- **Wire rendering (measured by designer + my own 2026-07-09 pass): STRAIGHT edge-to-edge line, arrowhead at the TARGET end**,
  drawn from the interaction-OWNING variant to its target the instant a target is set. **NOT curved, NOT orthogonal.**
- **Wires + ghost slots (+Variant / state) + label badge are SELECTION-SCOPED** — they render **only while a variant frame is
  selected**; deep-selecting a child or deselecting hides the whole overlay (Escape pops selection up). *(Our old NodeLayer was
  always-on — the exact fidelity trap this reset is about.)*
- On canvas the ⚡ edge-handle → wire and the inspector row are two views of ONE interaction.

**1.5 Play / Preview.** ▶ (`projectbar-preview-button`) → full-screen `preview-iframe` (`view=preview`); interactions
run live (hover/tap → transitions play); `‹ Back` exits. *(The "how do you test the component" answer — we have none today.)*

**1.6 Assets & folders.** Tree `Templates · Components · Styles · Vectors · Code`; Components holds **nested folders**;
folder ctx menu **New Component / New Folder / Sort Alphabetically**.

**1.7 Create / Insert / Instances.** Create-from-element: select frame → **⌘⌥K** / right-click → Create Component →
**a naming dialog** ("Components can be edited in their own canvas. Double-click on any instance…"). Insert:
**drag from Assets → canvas**, OR **right-click asset → Insert**. Component ctx menu:
`Insert · Edit · Find · Rename · Duplicate · Delete · Library › · Copy Import · Copy URL` — and **Delete is DISABLED while any
instance exists** (referential-integrity guard, seen live — must be an engine-op contract too). Framer's context menus are
**searchable command palettes** (type-to-search field at top) — informs our menu primitive. Instance inspector:
**Variant picker**, **Trigger: Add…**, **Edit Component**, plus **detach** and **Replace With / Replace All Instances With**
(two distinct scopes — not one generic "replace").

**1.8 Frame inspector (Style tab), full order.** `Interactions · Link · Position & Size (X/Y; Width Fixed·Relative·Fill·Fit;
Height +Viewport; Min Max) · Layout · Effects · Overlays · Cursor · Styles (Transition · Opacity · Visible · Fill · Overflow ·
Radius · Rotate · Border · Shadows) · Accessibility · Code Overrides`.

---

## 2. STYLING INTERPRETATION — Framer behaviour → ONEMO skin
The one thing Dan flagged hardest: **do not become a Framer look-alike.** Mapping:

| Framer chrome (what it DOES) | Our render (ONEMO skin) |
|---|---|
| Breadcrumb chips `Home › Name`, top-bar | Same position/behaviour; ONEMO chip surface + Phosphor-light doc/component glyphs; **our accent, not Framer purple** |
| Purple component-diamond icon | Phosphor-light component glyph in our accent |
| Right `Agent | Style` segmented tabs | Our segmented control (DS control-states Option B) |
| Left `Pages/Layers/Assets` tabs + tree | Our tree styling, our row height/type scale |
| Canvas toolbar (pointer/hand/comment/theme/zoom) | Same tools; ONEMO icon set + surface |
| ▶ play button, `Publish` purple CTA | ▶ our accent; CTA = our primary button, not Framer's purple |
| Variant frame labels + ▶ interaction badge | Our label type + our badge treatment |
| ⚡ connector handle + **STRAIGHT wire (arrowhead at target)** + Set-Variant popover | Behaviour identical; handle = our accent node, **wire = our stroke, STRAIGHT edge-to-edge, arrowhead at target**, popover = our surface |
| **Selection-scoped overlay** (wires/ghost-slots/badge only while a variant is selected) | Same visibility rule in our skin — NOT always-on |
| Selection box + 8 resize handles + rotate | Our selection accent + handle style |

**Icon law:** Phosphor light or Figma-extracted only — never invented SVG or unicode glyphs (per standing rule).
**Motion:** **STRAIGHT wires** (measured — not curved) + hover-reveal handles (Framer's feel) but our accent/stroke tokens.
**Semantic-parity test (per designer):** every Framer affordance (selected-variant label, ghost slot, wire direction, ▶ badge) has exactly ONE our-styled equivalent communicating the same thing — no orphan chrome, no Framer-purple leak.

---

## 3. BEHAVIOUR → BUILD MAP (every feature, its backing, its verdict)

| # | Framer behaviour | Ours today | Engine op backing it | Verdict |
|---|---|---|---|---|
| B1 | Infinite canvas, absolute free placement | fixed board-sheet of all components | (canvas shell) | **REBUILD** |
| B2 | Edit-in-place (`?node=`), variants as free frames | opens board of ALL components | model READ by node | **REBUILD** |
| B3 | Breadcrumb top-bar chip `Home › Name` | micro-attached to sheet | — | **REBUILD (our skin)** |
| B4 | Free named variants + Primary default | hardcoded 6 states + CVA inputs | add-variant ops (reuse mechanics, drop the UI) | **REBUILD authoring UX** |
| B5 | Hover/Pressed state ghost slot | part of hardcoded 6 | state-variant op | **REBUILD** |
| B6 | Interactions: trigger→action, New Transition/Event | wires bolted on old board | set-connector (state/switch), remove-connector | **PORT + extend triggers** |
| B7 | ▶ interaction badge on variant | none | — | **BUILD** |
| B8 | Remove connector = ✕ on row / delete wire | popover remove exists | remove-connector | **PORT** |
| B9 | Play/preview iframe, live interaction, Back | NONE | render real generated component | **BUILD new** |
| B10 | Assets tree + nested folders + folder ops | flat list | — | **BUILD folder ops** |
| B11 | Create-from-element (⌘⌥K) + from scratch | muddled 2-icon, crash-on-select | create-component op (reuse) | **REBUILD flow** |
| B12 | Insert: drag-from-Assets OR right-click→Insert | drag BROKEN | instance insert | **FIX/BUILD both paths** |
| B13 | Instance: Variant picker, Trigger, Edit, detach/replace | partial | instance ops | **BUILD** |
| B14 | Frame inspector (full Style tab order) | partial/ours | model props | **ALIGN to §1.8, our skin** |
| B15 | Codegen → clean React+CSS | WORKS | I0–I6 engine | **KEEP (backbone)** |

---

## 4. PHASED PLAN (each phase = a Framer behaviour set + acceptance criteria)

**P0 — Triage the shipped bugs** *(so today's build stops being embarrassing while the rest builds)*
- Fix crash-on-select (iframe/board remount), slow component load, broken drag-insert.
- AC: select a component → no crash, loads <1s; drag-insert places an instance.

**P1 — Infinite-canvas shell + edit-in-place** (B1, B2, B3, B14)
- Components live free on an infinite canvas; double-click / "Edit Component" → in-place variant canvas at `?node=`;
  breadcrumb top-bar chip (our skin); Layers lists variants; Home exits. Frame inspector aligned to §1.8.
- AC: editing a component shows ONLY that component's variants in place, not the whole board; breadcrumb + exit work;
  matches Framer behaviour, renders in ONEMO skin (designer-verified).

**P2 — Free variants** (B4, B5)
- `+Variant` → free named variant frame; rename; Primary default tag; Hover/Pressed state slot.
  Drop the hardcoded-6-states + CVA-input UI. Back it with the shipped variant ops (code shape stays multi-axis under the hood; authoring is free-form).
- AC: create/rename N variants freely; add a Hover state; engine emits correct React+CSS; no fixed state list visible.

**P3 — Connectors on the new canvas** (B6, B7, B8)
- Port ⚡ handle + wire + Set-Variant popover + remove onto the infinite canvas.
- Trigger vocab = the REAL five: **Click · Click Start · Appear · Mouse Enter · Mouse Leave** (extract New Event's own set pre-build).
- Popover params: **On · Delay · Transition Once|Cycle · Variant(target)**; clear→**Reset…**; multiple rows per variant.
- Wire = **STRAIGHT, arrowhead at target**; overlay (wire/ghost/badge) **selection-scoped**, not always-on.
- AC: drag handle → **STRAIGHT wire** → Set Variant with Delay + Once|Cycle; ✕/remove deletes it; engine round-trips
  (Cycle → switch-cycle, Once → single transition); **trigger set = the five above (NOT Hover/Press/Scroll)**; overlay hides on deselect.

**P4 — Play / Preview mode** (B9)
- ▶ → full-screen live render (separate preview surface) where interactions actually run; Back to exit.
- AC: hover/tap in preview fires the real transitions on the generated component; Back returns to canvas.

**P5 — Assets folders + create + insert + instances** (B10, B11, B12, B13)
- Nested folder tree + New Component/Folder/Sort; create-from-element (⌘⌥K, **with naming dialog**) + from scratch; both
  insert paths (drag + right-click Insert); instance Variant picker / Trigger / Edit / detach / **Replace With** + **Replace All Instances With**.
- **Delete-component DISABLED while instances exist** (referential guard — UI + engine-op contract).
- AC: organise components in folders; create from a frame (dialog); insert an instance two ways; switch instance variant; detach; delete-guard holds.

**P6 — Visual parity pass (ONEMO skin)** (styling §2)
- Match Framer's *feel* (hover-reveal handles, **STRAIGHT wires**, ▶ badge, spacing) rendered entirely in ONEMO tokens.
- AC: designer signs that behaviour = Framer, skin = ONEMO (no Framer-purple mixed bag); semantic-parity test (§2) holds.

---

## 5. KEEP vs SCRAP
- **KEEP:** the whole codegen engine (`api/dev/editor/lib.ts` + routes) — model, variant/prop/connector/structural ops, byte-exact writers, parse-guards.
- **SCRAP/REBUILD:** the react-figma editor *surface* — board-sheet, hardcoded-state chips, CVA axis inputs, breadcrumb-on-sheet, the bolted-on wire layer's host.
- **NET:** the hard half (edits → clean code) is done; the visible half (the Framer editor experience) is the work.

---

## 6. INDEPENDENT VERIFICATION PROTOCOL (Dan's requirement)
This blueprint is **not** trusted on my word. Before Dan signs:
- **QA (@s58-qa)** — request already open (Dan sent). QA independently opens Framer, reads its console/DOM, click-throughs
  the real behaviour, and reviews this blueprint for (a) fidelity to Framer, (b) fidelity to what Dan asked (behaviour-clone + our-skin, no mixed bag).
- **Designer (@s58-designer)** — I dispatch: do the SAME independent Framer dig (console + click-through, own hands),
  then review this blueprint's model accuracy AND the styling-interpretation table (§2) — is the skin genuinely ONEMO, is the behaviour genuinely Framer.
- Both return findings → I fold → re-present. Only then does Dan review for sign-off.
- Neither peer reviews on my doc alone; each must dig Framer themselves (the whole point — three independent extractions must agree).

---

## 7. HONEST SCOPE
This is a real editor build (P1–P6), **weeks-class, not a slice**. P0 is hours. The engine saved the hardest half.
I will not write a line of surface code until this blueprint is peer-verified and Dan-signed.

---

## 8. PEER VERIFICATION LOG

### Round 1 — Designer (@s58-designer), independent live pass, 2026-07-10
**Method:** own fresh throwaway project "Average Book", user-position click-through + DOM/code dig **incl. fetching the
component's real generated ESM module** (Copy Import). Reviewed this blueprint only AFTER its own extraction was on disk.
Docs: `s58-framer-blueprint-review-designer.md`, `s58-framer-extraction-designer-ledger.md`, `s58-framer-gap-report-designer.md`.

**DIRECTION INDEPENDENTLY CONFIRMED** — the designer's separate extraction converged on **every structural claim**: model
inversion (infinite canvas, edit-in-place, free named variants, generalized trigger→Set-Variant, play mode, folder tree,
two insert paths, instance ops), KEEP-the-engine, **the same independently-derived P0→P6 order**, and the styling law.
*(Two independent extractions reaching the same plan is the strongest signal the direction is right.)*

**Findings folded (all cheap, none change the direction):**
- **F-D1 (MED-HIGH) — trigger vocab was my ASSUMPTION, wrong.** Real = `Click · Click Start · Appear · Mouse Enter · Mouse Leave`
  (NO Hover/Press/Scroll). **I re-confirmed this myself** by reading the live `<select>` (value `onTap`) in my own session. Folded into §1.4 + P3.
- **F-D2 (MED) — popover params** (On/Delay/Once|Cycle/Variant; clear→Reset; multi-row). Folded §1.4 + P3. *(Designer-measured; I confirmed the trigger + target selects.)*
- **F-D3 (MED) — wire rules:** STRAIGHT + arrowhead-at-target + **selection-scoped overlay** (the old always-on NodeLayer trap). Folded §1.4, §2, P3.
- **F-D4 → corrected:** §2/P6 "curved wires" was wrong (both extractions + my own 2026-07-09 pass say straight). Now STRAIGHT everywhere.
- **F-D6 lifecycle** (naming dialog; Delete-disabled-while-instances-exist; searchable command-palette menus; Replace With / Replace All Instances With) — folded §1.7 + P5.
- **F-D7 spring form:** generated code = `{type:"spring",bounce:0.2,duration:0.4,delay:0}` (bounce/duration) vs our engine's stiffness/damping/mass — recorded as a build decision in §1.4.
- **F-D8 code-level proof (KEEP-engine confirmed at code level):** real generated module = flat variant-ID set + `humanReadableVariantMap`
  (names are aliases), interactions compiled to per-variant `onTap`-class overrides calling `setVariant(id)`, spring via
  `MotionConfigContext`, `addPropertyControls` Enum for the instance variant picker, `withCSS` scoped classes, imports from
  `"framer"`+`"framer-motion"` (proprietary runtime — proves our clean-React+CSS output is the real advantage). (saved: `framer-buybutton-module.js`)

**PRE-BUILD hand-checks (open before P3/P4, do NOT assume):**
- `New Event`'s own trigger vocabulary (neither extraction opened it).
- The exact ▶-badge rule (F-D5: designer saw it on a zero-interaction variant *while selected* → richer than "has an interaction").

**Designer verdict:** faithful spec of Framer's behaviour rendered in our language once F-D1..D4 folded (done) — **ready for Dan from the designer's lane.**
**Designer CLOSURE (post-fold re-read of the full blueprint):** every fold verified in place (F-D1 in §1.4 + hard-coded into P3 AC; F-D2/D3/D4/D6/D7/D8 + semantic-parity test + both pre-build hand-checks) — **"blueprint is sign-ready from my side, no open findings."**

### Round 1 — QA (@s58-qa): BLOCKED on authentication (pending Dan's decision)
QA's toolchain (Playwright) launches a clean Chrome with no Framer/Google session → hits 2-Step Verification, console JS disabled.
It correctly preserved independence (didn't open the artifacts). **Unblock is Dan's call:** (1) an authenticated CDP-reachable
Framer Chrome (Dan clears 2FA), or (2) QA does an evidence-audit cross-checking my raw evidence vs the designer's independent
live ledger. Not a blueprint defect — an environment gate.
