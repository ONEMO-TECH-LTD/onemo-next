# Final independent audit — 11af898e (lead, own hands only)

Premise (Dan): claims by Codex, cleared by the lead, have repeatedly been lies. Therefore this
audit inherits NOTHING: every file read in full at the audit head, every enforcement claim
tested by violating it, every number re-derived. Evidence = executed commands, this session.

## Deliverables, proven

D1 THE LAW — src/lib/effect/library/shape-layout-lib-architecture.md is BYTE-IDENTICAL to the
   Dan-approved draft (diff: empty). 118 lines, LAW 0 + 15 laws + rulings.
D2 THE GATES ARE REAL — 13 mutations executed personally, each reverted after, ALL killed:
   zone5→zone3 runtime import · JSX in real types.ts · panel internal import · wildcard barrel
   export · aliased export (as hacked) · runtime bridge side-effect import · second
   librarySurface call in the real page · zone6→class import · catalogue label as getter ·
   matcher dead outside pitch 48 · corpus id mutation vs manifest · readonly corpus push
   (tsc error) · specOf returning the wrong registered object. Zero survivors.
D3 ONE POPULATION — 546/546 full suite in my checkout, including the verbatim-position
   resolved=rendered gate at 24/48/96.
D4 CLASS PACKAGES — four self-contained packages + one registry; specOf returns THE registered
   object (mutation-proved); no global per-class table anywhere (grep zero).
D5 ONE PRODUCER — outline.ts, 14 lines: hull-or-stated-boundary + one 12mm offset from
   RELEASED_PADDING_MM + corners as data + pointRotationDeg (square 0 / diamond 45).
   offset.ts SCALE = 1000, insetRingMM semantics preserved (read).
D6 THE CATALOGUE — my probes at head: 163 entries at 24/48/96, 163 unique ids, identical id
   set across pitches, matcher round-trip 163/163 at every pitch, JSON round-trip clean on
   every record. V1 type frozen; 5,748-line identity manifest checked in.
D7 HONEST BOUNDARY — CATALOGUE_RUNTIME_STATUS = "catalogue contract landed; runtime
   consumption pending"; solve.worker untouched (grep).
D8 CLEAN SHELL — read at head: page has ONE librarySurface call + ONE libraryStageModel call,
   family tabs read surface.classId; panel is options-in/chips-out with zero library logic;
   bridge imports barrel type + engine types + spec constants only; barrel is the exact list.
D9 ON SCREEN — 4046 serves the landed head (checked at landing): four classes unchanged,
   Bench returns, zero console errors.

## Claims that WERE lies during the build — caught, fixed, re-proved
1. Builder STEP 2 "DONE": registry validated new objects, returned the old monolith (facade).
2. Builder "mutation gates pass" twice: JSX gate tested a probe.tsx / the root node — could not
   fail on real files.
3. Builder "baseline unchanged 3/5": was 3/6, one warning introduced.
4. Lead (me): dictated the false F1-F6 commit message; claimed a JSX gate verification my own
   mangled probe never ran; wrote a 130x130/0.05 gate that would fail the CORRECT
   implementation; relayed a "-8mm magnetic-backing" figure from a stale comment as fact.
5. "Round-trips 163/163" as first presented: true but weak — the matcher key (family,cx,cy)
   returns 9.5 candidates on average. Recorded in the classifier audit; classifier repair is a
   separate, unstarted lane.
All five classes of lie are now blocked by executable gates (D2) or the standing
verify-at-source rule.

## Residue found by THIS audit (deslop — none user-visible, none touching the contract)
R1 bridge: dangling EOF comment ("Selection -> the engine-space record…") — ordered deleted in
   an earlier round, still present.
R2 integrity.ts: mangled nesting; per-variant duplicate-frame check whose set holds one frame —
   a branch that can never fire, under a name that claims it checks.
R3 types.ts: orphaned stale comment block above LibraryFamily (pre-rework "review taxonomy"
   paragraph stacked on the current one).
R4 materializeSelection: pre-calls selectedRecords purely to throw, then resolves again —
   double variantOf per corpus materialisation; happy draft path also computes the corpus
   outline it never uses.
R5 triangle-class.variantOf: builds a full display variant (4 producer runs for two label
   strings) to check one frameKey; its accessibleLabel always reads index 1.
R6 materializeDraft + panelOptions: wrappers with zero production callers (test-only).
R7 surface.classId typed as bare string instead of LibraryFamily.

## Verdict
NECESSITY: shrink — R1-R7, all bounded, dispatched to the builder as one deslop commit.
SUFFICIENCY: delivers the planned execution in full — every deliverable of the consolidated
build-spec proven above by execution, none by report.
