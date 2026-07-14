# AC-A-001 / AC-A-002 — Framer component-canvas pan/zoom + unbounded surface, LIVE MEASUREMENT
**Provenance: expert-live-probed 2026-07-13 · authenticated Framer, "Powerful Autonomy", NodeCard edit mode · DOM-exact reads + operated probes. Honest split below: OPERATED (measured numbers) vs HARNESS-BLOCKED (enumerated, flagged for a 2-min hands pass — never guessed).**

## A · MEASURED (operated today)

### Zoom UI vocabulary (complete, from the live control)
- Bottom-center toolbar: **[Select] [Pan(hand)] [Comment] [Theme] [ NN% ▾ ]** — a **dedicated hand/Pan tool button EXISTS** beside Select.
- The `%` readout is a live display + menu trigger — **NOT a typeable input** (typing is ignored; measured).
- Zoom menu (measured, ss_8808otjgi): **Zoom `Z`** (tool) · **Zoom In `⌘+`** · **Zoom Out `⌘−`** · ─ · **Zoom to 100% `⌘0`** · **Zoom to Fit `⌘1`** · **Zoom to Selection `⌘2`** · ─ · **Fast Zoom** (toggle) · **Nudge Amount** (setting).
- Edit-mode canvas chrome (breadcrumb bar, bottom toolbar) is FIXED — never pans/zooms with content (established prior measurement, structure re-confirmed).

### Unbounded surface (AC-A-002) — numeric proof
- Selected Variant 2 → Position X set to **−20000 → ACCEPTED**: input commits, **no clamp, no error, frame simply moves far off-view**; restored to 495 cleanly. Coordinate space proven free to at least ±20,000 with no boundary behavior encountered.
- Variants carry free x/y/w/h (prior measured: x=0/495/990 row, arbitrary drag positions persist). **No canvas edges, no scroll bounds, no "fit content" clamp anywhere in the model.**
- Position inputs accept negative and arbitrary integers directly — inspector-driven placement is part of the unbounded model.

### Robustness behavior (bonus, measured)
- Framer's **"Reconnecting…" state DISABLES canvas operations** (zoom/menu items grey out) rather than allowing edits against a dead session — a deliberate offline lock. Parity thinking: our editor should define its disconnected-state behavior explicitly (product decision, not smuggled scope).

## B · HARNESS-BLOCKED — enumerated for a 2-MINUTE HANDS PASS (never guessed)
Blocked mechanisms (all previously documented limit classes): browser owns `⌘±`; Framer dropdown items need macOS press-drag-release; canvas = cross-origin iframe that eats synthetic wheel/gesture events (wheel at canvas → zero pan, measured by unmoved label overlay).

Checklist for Dan/designer hands (fills the numeric gaps in one sitting):
1. `⌘−` repeatedly from 100% → write down each step value → the **step ladder + MIN %**.
2. `⌘+` repeatedly → ladder up + **MAX %**.
3. `⌘wheel` (or pinch): zoom **anchored at cursor or viewport center?**
4. Plain wheel / two-finger trackpad: **pans 2D?** Momentum?
5. **Space-drag** and **hand-tool drag**: both pan? cursor change?
6. `⌘1` Zoom-to-Fit: framing **margin** around the variant set (screenshot for px).
7. `⌘2` Zoom-to-Selection: same margin question.
8. **Fast Zoom** toggled on: what changes (step size? animation?).
9. `Z` tool: click = zoom-in step size? `⌥`-click = out?
Record: sequence of % values + short notes; I fold them into this doc and the row freezes.

## C · Current→target guidance for the engineer (measured-only baseline)
| Property | Framer (measured today) | ONEMO current @ HEAD | Target |
|---|---|---|---|
| Surface bounds | none (±20k proven, no clamp) | bounded host (designer-audited ◐) | **unbounded coordinate space**; frames at any x/y incl. negative; no scroll clamps |
| Position editing | inspector x/y accepts any int incl. negative | x/y editable | keep; must accept negative + large values (add the ±20k acceptance as a test) |
| Zoom control | bottom toolbar % readout + menu (Z/⌘+/⌘−/⌘0/⌘1/⌘2/Fast Zoom) | zoom −/100%/+ buttons (page canvas) | full vocabulary incl. **Zoom to Fit + Zoom to Selection + Z tool**; % = readout+menu (not typeable) |
| Pan tool | dedicated hand tool + (gesture set ⧗ hands pass) | wheel/drag pan on page canvas (crashes on empty-click — X2, being fixed) | hand tool + gesture set per hands-pass numbers |
| Chrome | breadcrumb/toolbar fixed, never transformed | breadcrumb fixed ✓ (D5-a done) | keep chrome outside the zoom transform |
| Numbers (steps/min/max/margins) | ⧗ HANDS PASS §B | n/a | **do not invent** — freeze after §B lands |

**Row status: A-002 unblocked now (unbounded model fully measured). A-001 pan/zoom FEEL: vocabulary + structure measured; the numeric ladder/gestures = §B hands pass (2 min) before that row's AC freezes.** Per v1.4 gating law, A-001 is held-until-measured on §B — never dispatched pending.
