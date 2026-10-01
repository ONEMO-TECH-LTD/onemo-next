# s62-grid-lab — task tracker

The tracking surface for Session 62, Grid Lab. Linear is at its free issue cap
(ONE-279 created against a 250 active limit), so tasks live here until that clears.

From Dan's own words on 22 Sep 2026, confirmed by him before filing. Status is measured, never
remembered. Audited by @s62-qa (`2026-09-22-s62-qa-tasklist-verdict.md`) — NOT-CLEAR, 4 blockers;
this revision applies them.

**The two paddings are separate things** (Dan, 22 Sep):
- **disc offset** — grows the cosmetic cell: 24 mm granular, 32 mm sparse.
- **edge padding** — pads *the line that wraps the grid*, so every shape's outline expands
  outward. Canon records included: "the canon expands out by that number as well as other shapes."

> **On the quotes below.** Two of Dan's directives arrived as **mid-turn sends**, which Claude Code
> records as `queued_command` attachments rather than user turns — so the transcript vault never
> captures them (see `memory/reference_vault_drops_dan_midturn_messages.md`). They are quoted here
> from this session's own record and marked ⟨mid-turn⟩. QA verified both against the raw JSONL of
> session `bfdd88a3`, where each carries the documented `type:attachment` / `userType:external`
> queued-command signature — **T3 at 2026-09-22 10:30:53Z, T6 at 11:28:16Z**. Check there, not the
> vault. Vault silence about a mid-turn message is inconclusive, never evidence of invention.

---

## Ready for QA — self-verified only, no peer gate passed

- [x] **T1 · Wrap edge margin as an engine parameter, exposed**
      "wrap must exist but we need to add edge margin around which the wrap happens… add the
      engine parameter and expose it"
- [x] **T2 · The wrap uses that offset**
      "wrap will use the offset -aka edge padding of the shape"
- [x] **T3 · Admin-settable**
      ⟨mid-turn 10:30:53Z⟩ "and also add the offset to the grid engine that we can set as admin"
      — lockable and sealable like every other dial.
- [x] **T4 · Applies to every shape, canon and wrapped**
      "it is override for all wrap exposed and canon shapes" · released 72 mm square → 80 mm at
      4/side, magnets and band unmoved — **with the disc grown to 32 mm alongside it, see T7.**
      This is not evidence of an independent edge padding.
      **Band stability measured by @s62-qa at full scale: 1,247 records swept, every released pitch,
      all three modes — legal-area drift 0, offset-mode non-growth 0.** Non-vacuous both ways.
- [x] **T5 · Padding disc, three modes at Dan's numbers**
      default square + radius full (24 mm) · 24 mm + radius 11 exposed · 24 mm + 4 mm offset =
      32 mm + radius 12.8 exposed
- [x] **T6 · Engine-integrated spec variants the engine reacts to**
      ⟨mid-turn 11:28:16Z⟩ "all this makes the engine integrated spec variants - and engine reacts
      to it as well"

## Open

- [x] **T7 · Split disc offset from edge padding** — *done, QA-CLEAR with the visual law applied*
      Two quantities now. **Edge padding** pads the wrapping line, offered in every mode, and the
      disc cannot even receive it — `paddingDiscSpec` has no such parameter and the type forbids it.
      **Disc offset** grows the cell (24 → 32), belongs to the mode, its own dial and its own lock.
      `deliver-record.ts` reads the line's padding directly instead of recomputing it from
      `paddingDisc.halfMM`, which is what made a canon outline follow the cell.
      **Observed, dial swept to its ceiling (24), not its default:** every one of the seven canon
      shapes grows by exactly 2× the dial with the disc unchanged — square 72→120, rectangle
      24×72→72×120, diamond 130→178, triangle 135→183, pill/circle/oval 72→120. A 32 mm cell now
      sits inside a 120 mm effect: Dan's lime-panel case, unrepresentable before this.
      **Why it mattered:** at edge padding 24 the old build drew a released square as a four-petal
      blob with 72 mm discs. 900 tests were green through all of it.

- [x] **T8 · Edge padding as the effect envelope** — *met by the edge-padding dial; QA-CLEAR (Round 7)*
      12 or 24 mm step (6–12 per side) so an effect covers the sparse or granular panel beneath
      it: 120 → 132 or 144, 72 → 84. Sparse panel measures 128 mm; granular equals the effect
      exactly, which is why it sits edge to edge.
      **Observed on :4066, Presets square:** B3 120 → **132** at edge 6, **144** at edge 12; B2 72 →
      **84** at edge 6. Legal area 96 / 48 and band unchanged; 9 / 4 magnets unmoved
      (`evidence/t8/`). Cover over the panels: granular 120 under 132 = 6 mm a side; sparse 128 under
      132 = 2 mm, under 144 = 8 mm.
      **Not built, because not asked:** snapping the dial to 6/12 steps, or an effect declaring its
      panel and the engine picking the step — that was my 11:17 proposal, never confirmed.
- [x] **T9 · Shape radius — the corner of the wrapping line, settable and lockable** — *QA-CLEAR (Round 6)*
      "we also need to add radius slider to shapes as well" · Dan, 15:42: "the padding applies but why
      by default it adds radius i need the controls for that for me to set and lock shape radius".
      A round-join offset ties corner radius to stand-off, so 24 mm padding gave 24 mm corners nobody
      chose. `shapeRadiusMM` (spec default `null` = follow padding) grows the line `(d − r)` sharp then
      `r` round: distance unchanged, corner is Dan's. Lockable dial "Shape radius · the corner of the
      wrapping line". **Observed:** square, edge padding 24 — width 120 at follow / 0 / 12, corners
      sharp at 0 (`evidence/t9-shape-radius-0.png`, `-12.png`). Canon path only so far — searched shapes
      grow by the wrap, not by an outline offset.
- [x] **T10 · Nothing hardcoded into the page** — *closed; the library move was an over-read*
      "nothing can be hardcoded into page - the shapes must live in the library and routed to the
      grid lab and routable as canon as part of the grid-lab api"
      **Dan, 22 Sep: "disc is not shape it is internal visual guide."** That settles it. The disc is
      the padding made visible, not a library citizen with a population and a band, so it is
      spec-stated and engine-emitted rather than registered.
      The requirement itself is MET and gate-verified: the spec states the shape, the engine emits
      the disc's outline, the bridge hands it to the surface, and the page branches on nothing — the
      architecture gate for that passes and @s62-qa confirmed no branch on a mode id.
      **What I tried and reverted:** a `library/padding-disc-class.ts` routed onto `pipeline/index.ts`.
      Two of the repo's own laws rejected it — the door is gated to exactly five exports because that
      minimality is what makes the engine liftable into Studio, and `library/` admits only registered
      shape classes. Four gates failed; all four green again after reverting.

- [x] **T17 · The wrap reacts to the TRUE disc shape, not a circle round it** — *QA-CLEAR (Round 6, `evidence/t9t17-r6/`)*
      Dan, 15:43: "why with the radius set the circles expand - the main point is to have true shapes
      and wrap engine to react to that shape not circle - there will be points where circle fits and
      square does not and vice versa".
      **Cause:** the disc was collapsed to one number — its furthest reach, hypot(s,s)+r — and the wrap
      cleared that as a circle. The grey field markers were drawn at the same reach, so lowering the
      corner radius visibly swelled them.
      **Fix:** every disc is an axis-aligned square core (half h−r) grown by a round margin (r). The seat
      region is the outline eroded by exactly that: the round inset the wrap already did, then a
      Minkowski sweep of the square core (`units/wrap.ts erodeBySquare`). Edge padding grows the round
      margin only. Circle mode has no square core and runs the old path byte-for-byte. The scalar reach
      (`paddingReachMM`) is deleted; spot radius is back to the rim; field markers draw the disc ring.
      **Proven both directions** (`padding-disc.test.ts`): one magnet, 24 mm squircle at 5 mm corners —
      a square outline holds it at 24 mm (the reach circle needed 29.8); a diamond refuses it at 33.9
      where the 24 mm circle fits, and needs 42.1.
      **Observed on :4066, Generators blob, B2, edge padding 0:** circle 107.9 · squircle r5 114.0 ·
      square r0 118.5 — each wraps its own shape, binding corner on the line, every disc inside
      (`evidence/t17-gen-*.png`). Presets in Dan's 15:43 state (squircle r5, edge 12): field markers are
      squircles, no swelling circles (`evidence/t17-presets-squircle5-edge12.png`).
      **Not changed, deliberately:** registration still seats on the bare 12 mm rim, so legal area and
      bands are untouched — band sweep 1,247 / drift 0 still green.
      **Round 5 (@s62-qa NOT-CLEAR, 2 blockers) — both applied.**
      *B1 — edge padding stripped magnets from wrapped shapes* (blob 4 → 3 → 1 as the dial rose): it sat
      in the wrap's clearance inside a band-bounded search. Now the wrap finds its outline without it,
      and `wrapGrid` grows that outline by the edge padding with the SAME `grownContour` a canon record
      uses (moved verbatim from `deliver-record.ts` into `offset.ts`, the one module both callers may
      import). So the shape radius now reaches wrapped shapes too. **Observed:** blob, square discs,
      edge 0/12/24 → 119/143/167 mm, **4 magnets every step**, wrap 118.54 and legal area 95×93 unmoved
      (`evidence/t17r2/b1-*.png`).
      *B2 — Presets legal overlay grew with edge padding and vanished at small shape radii*: it inset the
      grown outline. `GridSolve.legalContour` now carries the outline before padding (canon: the
      published record; wrapped: the wrap's outline) and the adapter reads that. **Observed:** square B2
      legal 48×48 at edge 0/12/24, present at shape radius 6 and 12 (`evidence/t17r2/L-*.png`, `R-*.png`).
      Taken in part: `effSize` on the wrapped path stays the wrap's scale — it feeds the manual band-scale
      control, clamped to the band; the drawn outline carries the +2×edge.
      **Suite:** 903 pass, 1 fail — the lock-profile hash pin, proven by QA to be the page-written profile.
      **Open, Dan's call:** a canon record is published geometry and is not re-wrapped, so a disc larger
      than the record's own margin (offset mode, 32 mm, at edge padding 0) overhangs the line. Grow canon
      to contain its disc, or leave it to the edge-padding dial?

- [ ] **T11 · Package for Studio**
      "make it packaged for studio" — engine package builds (146 files, 0 unresolved aliases,
      2/2 consumer tests). The bench is still a route in onemo-next. **Gate undecided, below.**
- [ ] **T12 · Deslop onemo-next** — *kill-list rev 3 QA-CLEAR (Round 11) — awaiting Dan's signature; not deletion authority* →
      `2026-09-22-s62-deslop-killlist.md`. **On Dan's existing words: 5,309 lines** — v5.3.1 UI pages/panels
      only, 28 files enumerated by import closure (the editor mechanism he named on 7 Aug stays with N9) (5 Aug "no ui in v5.3.1 - it is broken and must be
      deletted", bounded by his 7 Aug goal "pages/panels only — flows/, core/, lib/effect remain") + the old
      grid-lab bench (4 Aug "delete v1 we can always recover"). **~12,700 more on record but conditional**
      (the S59 engine — only after `computeAttachmentGrid` goes or is repointed, the order Dan accepted
      4 Aug). **~25,900 Dan decides** (N2 grid-engine scaffold — a reversal of his "keep scaffold"; N9
      v5.3.1 flows/core; N3 contracts; Z). Runs AFTER today's work is committed.

- [ ] **T15 · Two controls on one screen both called "padding"**
      The left dial is **protection padding** (1 Sep, `4317b6ad`) — measurement only, `units/protection.ts`
      is "never imported by the solver", and a test proves doubling it returns a byte-identical solve.
      It says how much material a magnet grips. The right one is today's **edge padding**, which moves
      the cut line. Dan lost time reading 24 on the left and expecting a 24 mm margin. Proposed:
      rename the left to "Hold reach · how far material still counts as held". Label only, no behaviour.

- [ ] **T16 · Disc controls vanish instead of explaining themselves**
      Corner radius and disc offset render only in the modes that expose them, so on the default
      (circle) there is nothing to adjust and the controls read as missing. Dan: "where are the disc
      controls?" Proposed: always render, disabled with their reason — "radius: full, by definition".

- [x] **T13 · The Library tab cannot follow the padding dial** — *QA-CLEAR (Round 8, `evidence/t13-qa/`)*
      **Fix:** the Library stage now wears the padding disc in play. The disc is resolved by the engine
      bridge (`grid-magnet-bridge.paddingDiscOf`, the page passing the released rim from spec) and the
      Library bridge only carries it — it is pinned to wrapping data, never resolving it, and the
      architecture gate enforces that. The outline stays as published: the Library is the record being
      authored; edge padding applies when a record is delivered. **Observed:** offset mode, Library 3×3
      draws 32 mm squircles (31.2 drawn, stroke-trimmed); squircle r5 draws 24 mm squircles; field
      markers match (`evidence/t13/`). The mode control is still set on Bench — shared state, one place.
      *Original finding:*
      `grid-magnet-library-bridge.ts:54` pins `spotRadiusMM` to `RELEASED_PADDING_MM`, and
      `libraryStageModel` (line 27) accepts no disc and no edge padding. The page calls it at
      `page.tsx:190` for the Library tab; `page.tsx:1013` reads that pinned value.
      **Measured on :4066 with mode = offset — Presets disc 31.4, Library disc 23.4.** Generators
      and Presets follow the disc; Library structurally cannot — **and the mode control is not
      rendered on that tab at all**, so it is not merely ignored, it is never offered. Same class
      Dan objected to at 12:19, on the surface he named when he said the shapes must live in the
      library. Confirmed independently by @s62-qa's own visual gate.

- [x] **T14 · The padding mode silently reverted, then its values desynced** — *found by @s62-qa over two rounds, fixed*
      `padShape` was the only one of the three dials on plain `useState` while `edgePad` and
      `padRadius` both persisted — and it GOVERNS them. Leaving Presets for Library and returning
      dropped the mode with nothing on screen saying so, and a reload landed in circle mode wearing
      the offset mode's radius and edge padding. That is F7's mode leakage produced by the page.
      Fixed with `usePersistedChoice`, validated against the ids the door publishes so a stale entry
      cannot select a mode the engine does not offer; the mode also joined the save-default/reset
      block with the values it governs.
      **Round 2 — QA broke the first fix and was right to.** Validating the mode id alone still let
      a stale `edgePad`/`padRadius` survive a fallback: the control read "circle" while the geometry
      drew 31.4 mm. A label disagreeing with its own shape is worse than either being wrong, and
      persisting the mode is what created the vector. Fixed properly by storing mode + both governed
      values as ONE record that validates whole or is replaced whole — so no combination can exist
      that no variant declares, which closes F7's open half by construction rather than by a clamp.
      **Measured:** offset set 31.45 · honest reload 31.45 · **poisoned key + reload → "circle" AND
      23.40** (label and geometry now agree) · Presets→Library→Bench 31.45, stable on resample.
      **Row-3 disagreement resolved:** the Library tab renders only `["Bench","Library"]` — no
      Presets button exists there, so QA's locator never left Library and re-read its 24. Via the
      real path the mode holds.

## Deliverable + definition of done (Dan, 14:09 BST 22 Sep)

| # | Deliverable | Done when |
|---|---|---|
| T7 | Two independent engine quantities, not one | A 24 mm disc solves inside a 144 mm effect; moving one leaves the other byte-identical, canon and searched; bands unmoved; seen on :4066 |
| T8 | The 12/24 mm step on the wrapping line | Released 120 mm reads 132 at the half-step and 144 at the full step and measurably covers both the 128 mm sparse and the granular panel; 72 → 84; bands unchanged |
| T9 | Corner radius of the wrapping line, set and locked by Dan | Width unchanged at any radius; corners follow the dial; lockable; seen on :4066 |
| T17 | The wrap clears the true disc shape | Circle < squircle < square wrap on one shape; a square outline holds a square disc at its own size; a diamond refuses it where a circle fits; no swelling circles; bands unmoved |
| T10 | ~~The disc as a library citizen~~ — closed: the disc is an internal visual guide, not a shape | Met: spec states the shape, engine emits it, page decides nothing; architecture gates green |
| T11 | The Grid Lab engine consumable by Studio | **BLOCKED — needs Dan.** See Open decisions |
| T12 | A kill-list, then the removals | Dan signs the list; code gone; tests and gates green. Nothing removed before he signs |
| T13 | The Library tab drawing the disc in play *(QA-CLEAR)* | Library and Presets show the same disc at the same settings, observed on :4066 |

## Open decisions — Dan's, not ours

- **Library outline is the published one** — so offset-mode 32 mm discs overhang it at any edge padding
  (QA Round 8, `L-offset-e24-published.png`). Same question as the canon overhang below.
- **T17 · canon disc overhang.** Canon records are not re-wrapped; with a disc bigger than the
  record's margin the disc overhangs the line until edge padding covers it. Grow canon to contain its
  disc, or leave it to the dial?
- **lock-profile.ts was rewritten at 15:42 by the running page** (two unlocked entries: edge padding 0,
  corner radius 11). It is embedded in every result, so it moves the device-performance hash pin
  (`dense-live-plan`). Not an engine change. Keep it (re-pin) or reset it to `{}`?
- **T11 · package for Studio.** Is the gate Studio actually importing it, or the package building
  green? If the latter, T11 is already done (146 files, 0 unresolved aliases, 2/2).

## Acceptance criteria carried, not forgotten

- **The 8 mm-magnet physical floor.** Dan, 10:59: a 24 mm cell on the sparse lattice "is too small
  for 8 millimeter magnet to be held on a garment". A lawful minimum the engine can compute rather
  than a taste value re-picked each time. Belongs as an acceptance criterion on T5/T7; **not yet
  implemented and not silently dropped.**
- **Mode leakage.** Dan specified three modes — 24/full, 24/11, 32/12.8. Because edge padding is a
  free dial in every mode, the engine also admits 32/full and 32/11, states he never specified.
  Closed for persistence by T14's one-record fix — a combination no variant declares cannot be
  restored. What remains is the live-dial question: an admin can still type values producing 32/full
  or 32/11 in-session. Needs either a clamp or an explicit ruling that intermediate states are legal.

## Not on this list, deliberately

- **SVG manufacturing export** — built 22 Sep, never asked for, **deleted**. 192-line script, its
  npm entry and 231 generated files removed. QA swept for residue and found none. Dan's own 16 Sep
  export at `~/Downloads/onemo-grid-shapes-48mm/` untouched.
- **Middleware narrowing** — `src/middleware.ts` runs a Supabase auth check on every route
  including Grid Lab, which is why a worktree needs production secrets to draw shapes. Offered,
  never authorised. Not work until Dan says so.

## Working state

Worktree `onemo-next/.claude/worktrees/s62-edge-padding`, branch
`session62-task/edge-padding-offset`, off `18162dd2`. Serving :4066. **Nothing committed, and no
peer QA gate has passed on T9 or T17** — builder self-review is not a gate. Suite after T17: **901 pass,
2 fail** — the locks roster (fixed since: `shapeRadiusMM` declared, 114/114 on the four affected files)
and the device-performance hash, caused by the page-written `lock-profile.ts` above, not the engine. Earlier: 900 pass ·
typecheck clean · every architecture gate green. @s62-qa's band-drift sweep is **adopted as a standing
test** (`__tests__/band-drift-sweep.test.ts`) and runs in the suite: 1,247 records, legal-area drift 0,
offset-mode non-growth 0 — it guards exactly the quantity T7 is about to move. @s62-qa ran its own
198 tests across four files, **swept all 1,247 catalogue records for band drift (clean)**, and has
**run its own visual gate** on :4066 — evidence in `8-governance/audits/evidence/qa-4066-*.png` and
`qa-gate-*.png`. Its round-2 verdict is still NOT-CLEAR, on T14 alone; T14 is now fixed and awaiting
its re-gate.
