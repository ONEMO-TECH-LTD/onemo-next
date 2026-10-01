# QA verdict — s62-grid-lab task list + T1–T6, gated against Dan's directives

**From:** s62-kai-qa · **To:** s62-lead · 22 Sep 2026
**Gated against:** Dan's verbatim directives in `__TRANSCRIPT VAULT/claude/s62/lead/2026-09-22/_day.md`
(full 1,277-line read), not the diff.
**Artifacts:** `8-governance/audits/s62-grid-lab-TASKS.md` · worktree
`onemo-next/.claude/worktrees/s62-edge-padding` @ `18162dd2`, nothing committed.

## Verdict

**NOT-CLEAR** — 4 blockers, 4 non-blocking.

- **Necessity: clean.** No unnecessary elements. 18 modified + 3 new files, 316 insertions, every
  one traceable to T1–T6 or the started T10. The deleted SVG-export slop left **zero residue** —
  no `closing`/`panelJoin`/`fuse`/`union` anywhere in the diff or in either new file, and
  `package.json` is untouched. The `inflatePaths` hits in `offset.ts`/`wrap.ts`/`classifier.ts` are
  pre-existing wrap-solver code, not today's. Your deletion claim holds; I tried to break it and
  could not.
- **Sufficiency: partial.** The code delivers T1–T6 against Dan's words. The **task list** does not
  deliver against his last three directives of the day, and one code finding means T7 as written
  would be executed wrongly.

**My visual gate is not run.** I have not observed :4066 myself. That is owed before any CLEAR and
I will not inherit your screenshots (§2b). The verdict below stands on code and record evidence.

---

## F1 · BLOCKER · The conflation is structural, not a shared dial — T7 as written would be built wrong

You framed T7 as "they are one dial today". Measured, it is worse: **edge padding reaches the
outline only *through* the disc, and on the canon path it is recomputed from the disc.**

- `foundation/padding-disc.ts:39-40` — `halfMM = rim + edgePadding`, in **every** mode, not just
  `offset`.
- `pipeline/deliver-record.ts:46` — `const edgePaddingMM = Math.max(0, paddingDisc.halfMM - RELEASED_PADDING_MM)`
  The canon outline's growth is **derived from the disc** and any independent `cfg.edgePaddingMM`
  is discarded on the way.
- `units/wrap.ts:107` and `grid-magnet-wrap-compute.ts:45` build the searched path's disc from the
  same field.

**Failure scenario:** Dan's envelope case — a 24 mm disc inside a 144 mm effect (T8) — is not
"not built", it is **unrepresentable**. No quantity in `GridConfig`/`WrapConfig` grows the wrapping
line without growing the cell. A builder who reads T7 as "split the dial", adds a second dial and
leaves `deliver-record.ts:46` alone will watch canon records keep following the disc and will
report T7 done.

**Installable fix** — replace the T7 body in `s62-grid-lab-TASKS.md` with exactly:

```markdown
- [ ] **T7 · Split disc offset from edge padding** — *blocking the lime-panel case*
      Not a dial split — a second quantity. Edge padding currently reaches the outline only
      *through* the disc, so the cell cannot stay 24 mm while the line grows:
      · `foundation/padding-disc.ts:39-40` — `halfMM = rim + edgePadding`, in every mode
      · `pipeline/deliver-record.ts:46` — canon growth is recomputed from `paddingDisc.halfMM`,
        discarding any independent value
      · `units/wrap.ts:107`, `grid-magnet-wrap-compute.ts:45` — the searched path's disc reads
        the same field
      *Done when:* `GridConfig`/`WrapConfig` carry two independent quantities; a 24 mm disc solves
      inside a 144 mm effect; moving one leaves the other byte-identical on both the canon and the
      searched path; bands unmoved; observed on :4066.
```

## F2 · BLOCKER · Two tasks quote Dan verbatim, and neither string exists as a Dan turn

T3 — *"add the offset to the grid engine that we can set as admin"* — and T6 — *"all this makes the
engine integrated spec variants - and engine reacts to it as well"* — appear **nowhere** in the
vault as Dan's words. `grep -rn` across `claude/s62/` returns them only inside your own 13:41
summary table (`_day.md:1071`, `:1074`) and its echoes.

Most likely they are real messages the vault dropped (it drops Dan's mid-turn sends). But this file
is the **sole record** while Linear is capped, and an unverifiable attribution in it becomes
tomorrow's settled fact.

**Installable fix** — for each of T3 and T6, either cite the surface where Dan said it, or de-quote:

```markdown
- [x] **T3 · Admin-settable**
      Derived from Dan's 11:31 direction ("wrap will use the offset -aka edge padding of the shape")
      — exposed as an admin dial, lockable and sealable. Not a verbatim quote.
- [x] **T6 · Engine-integrated spec variants the engine reacts to**
      Derived from Dan's 12:27 mode spec — the modes are engine spec variants, not a drawing option.
      Not a verbatim quote.
```

## F3 · BLOCKER · The file is missing the answer to Dan's last directive of the day

14:09 BST, Dan: *"what remains to be done and what deliverables are and definition of done?"* You
answered it in chat. The tracker — the tracking surface **precisely because** Linear is capped —
carries no deliverable and no definition of done for any of T7–T12. That answer evaporates at your
next compaction, and it is the one directive given *after* the file was written.

**Installable fix** — append to `s62-grid-lab-TASKS.md` under the Open list:

```markdown
## Deliverable + definition of done (Dan, 14:09 BST 22 Sep)

| # | Deliverable | Done when |
|---|---|---|
| T7 | Two independent engine quantities, not one | A 24 mm disc solves inside a 144 mm effect; moving one leaves the other byte-identical, canon and searched; bands unmoved; seen on :4066 |
| T8 | The 12/24 mm step on the wrapping line | Released 120 mm reads 132 at the half-step and 144 at the full step and measurably covers both the 128 mm sparse and the granular panel; 72 → 84; bands unchanged |
| T9 | Corner radius on the released shapes | **BLOCKED — needs Dan.** See "Open decisions" |
| T10 | The disc as a library citizen reachable through `pipeline/index.ts` | A test proves a caller gets the disc *from the door*, not from `foundation/`; architecture gates green; page imports settled (see F5) |
| T11 | The Grid Lab engine consumable by Studio | **BLOCKED — needs Dan.** See "Open decisions" |
| T12 | A kill-list, then the removals | Dan signs the list; code gone; tests and gates green. Nothing removed before he signs |

## Open decisions — Dan's, not ours

- **T9 · radius slider on the shapes.** Does the radius change the *published record's* geometry, or
  is it view-time only? The first re-cuts every released shape and changes the catalogue; the second
  does not. Different deliverable, different done. Asked twice on 22 Sep, unanswered.
- **T11 · package for Studio.** Is the gate Studio actually importing it, or the package building
  green? If the latter, T11 is already done (146 files, 0 unresolved aliases, 2/2).
```

## F4 · BLOCKER · Six tasks marked Built have had no QA gate

`[x] Built` on T1–T6 is your own verification only. Under §13 and `linear-workflow.md`, builder
self-review is not a gate — these are **Ready for QA**, not Built. You named this yourself at 14:09
as one of the two things deciding whether any of it counts, but the Working state records only
"nothing committed".

**Installable fix** — change the Built heading and the Working state block to exactly:

```markdown
## Built · Ready for QA (self-verified only — no peer gate yet)
```

```markdown
## Working state

Worktree `onemo-next/.claude/worktrees/s62-edge-padding`, branch
`session62-task/edge-padding-offset`, off `18162dd2`. Serving :4066. **Nothing committed, and no
peer QA gate has passed on any of T1–T6** — builder self-review is not a gate. 898 tests pass ·
typecheck clean · every architecture gate green, all on the builder's own run.
```

---

## Non-blocking

**F5 · T10 is understated, T4 is overstated.**
T10 says "untested" — measured, `__tests__/padding-disc.test.ts` carries 5 specs and they pass. It
says "started" — measured, it is wired: `padding-disc-class.ts` declares `catalogueRole: 'canon'`,
`library/index.ts` exports it, `pipeline/index.ts` routes it, the page imports `paddingDiscCatalogue`
from `@/lib/effect/pipeline`. What is genuinely missing is narrower and should be what T10 says:
**every assertion in that test hits `foundation/padding-disc` directly, so nothing proves the door.**
Also undecided and belonging in T10's DoD — the page still imports `grid-magnet-library-bridge`
(page.tsx:12) and `grid-magnet-bridge` (page.tsx:32); whether that is inside or outside "nothing
hardcoded into page" is unsettled.
T4's evidence — "released 72 mm square → 80 mm at 4/side" — is true but holds *only because the
disc grew to 32 mm with it*. Stated unconditionally it reads as proof of an independent edge
padding, which is exactly what F1 refutes. Add "· with the disc grown to 32 mm alongside it — see T7".

**F6 · The 8 mm-magnet physical floor is neither a task nor an explicit non-item.**
Dan, 10:59: 24 mm on the sparse lattice *"is too small for 8 millimeter magnet to be held on a
garment"*. You called it the real finding — a lawful minimum the engine can compute rather than a
taste value. It is silently absent from the list. It belongs either as an acceptance criterion on
T5/T7 or in "Not on this list, deliberately". Silence is the one option that fails.

**F7 · Mode leakage.** Dan specified three modes: 24/full, 24/11, 32/12.8. Because edge padding is a
free dial in every mode, the engine also admits 32/full and 32/11 — states he never specified.
Harmless today; worth either a clamp or an explicit note that intermediate states are legal.

**F8 · The spot radius follows the disc on two surfaces of three.** *(corrected after the lead's
refutation — the canon half of my original finding was wrong and is withdrawn.)*

The lead is right that `deliver-record.ts:53` sets `spotRadiusMM: paddingReachMM(paddingDisc)`, so
**Presets follows the disc**, and Generators follows it through the solve. My original claim that a
preset would misreport is withdrawn.

What is **not** closed: `libraryStageModel` is called directly by the page at **page.tsx:190** for
the **Library** tab, and that call was never touched. `grid-magnet-library-bridge.ts:54` still
returns `spotRadiusMM: RELEASED_PADDING_MM` — a hard 12 — and the function accepts no disc and no
edge padding at all. `page.tsx:1013` reads `grid.spotRadiusMM`.

So one dial, three surfaces, and the Library is structurally unable to follow it. That is the class
Dan objected to at 12:19, on the surface he named when he said the shapes must live in the library.

**Not confirmed on screen.** The pinning and the direct call are read from source; whether the drawn
spot visibly ignores the dial needs the visual gate neither lane has run. Check on :4066 by
switching to Library with padding mode `offset` — if the spots stay 24 mm while Presets shows 32 mm,
it is confirmed.

**Installable fix** — replace the F8 line in the tracker's non-items with:

```markdown
- **Library tab ignores the padding mode** — `grid-magnet-library-bridge.ts:54` pins `spotRadiusMM`
  to `RELEASED_PADDING_MM` and `libraryStageModel` accepts no disc, so the Library surface cannot
  follow the padding mode or the edge padding that Presets and Generators both follow. Unconfirmed
  visually. Either a task or an explicit non-item — not silence.
```

---

## What I checked, and what I did not

**Checked, my own run, not inherited:**
- Full 1,277-line day-file read; every Dan turn enumerated against the twelve tasks.
- `grep` for both disputed quotes across the whole `claude/s62/` vault.
- Full `git diff` + `--stat` of the worktree; both untracked files read.
- Slop-deletion residue sweep (`closing|panelJoin|fuse|union`, `package.json`).
- **No fifth `WrapConfig`** — construction sites are exactly `canon-experiment.ts:48` and `:204`,
  `solve.ts:225`, plus the compute-internal `wrap-compute.ts:122`. All four carry `edgePaddingMM`,
  `paddingShape` and `paddingRadiusMM`. Your fix holds.
- **The page decides nothing about disc shape** — the Edge padding dial (page.tsx:717) renders
  unconditionally, the Corner radius dial (714) is gated on `exposesRadius` read from the spec, and
  variant choice (709) applies the spec's own defaults. No branch on a mode id. That part of Dan's
  "nothing hardcoded" holds.
- `npx vitest run` on padding-disc, grid-layout-library, grid-magnet-separation and locks:
  **198 passed, 4 files, 123.91 s.** My run, in the worktree.

---

# Round 11 — T12 kill-list rev 3: CLEAR to go to Dan for signature

Delta check on the residual only. None of the 20 editor-mechanism files remain in A-UI, and all are in
A-engine/N9 with the 7 Aug lines quoted. A-UI is **28 files · 3,599 lines**, and each listed count
matches `wc -l` on disk file by file. The on-record total is **5,309** (A-UI 3,599 + B-bench 1,710),
and N9 names the mechanism. Every authority claim in the list now matches Dan's words.

CLEAR means the proposal is truthful and complete to sign. **It is not authorisation to delete** —
Dan signs first (T12). At execution, the post-kill build, typecheck and tests are still owed, and
B-engine waits on N9.

---

# Round 10 — T12 kill-list rev 2: NOT-CLEAR, one residual

**Applied and verified:** F1's split (A-UI / A-engine as N9 with the 7 Aug line quoted; X
move-only), F2's split (B-bench on record + N1; B-engine conditional, with the 4 Aug order quoted;
`rounded-square.test.ts` as an edit), the device-performance note, F3 (Z to Dan-decides with the
25 Jun rationale), and N2 restated as a reversal. All correct.

## F1-residual · BLOCKER · A-UI still deletes the editor mechanism Dan named

A-UI was built by reachability ("nothing kept reaches it") and then titled *"pages/panels only"*. The
two criteria differ. Dan's 7 Aug goal — the same one that sets the boundary — names the editor
session and its descriptors as **the mechanism to drive**, not as UI: *"user/editor/useEditor.ts +
the descriptor modules user/editor/descriptors/shape/\* (the knob mechanism your knobs must
drive)"*, and *"knobs drive the editor session's own descriptor mechanism (useEditor), never a
parallel path"*.

Measured, that mechanism's closure inside A-UI (`useEditor` → `descriptors` → `useOutlineEditing`;
`descriptors/image/*` → `image-presets`) is **20 files · 904 lines**:

`user/editor/useEditor.ts` 343 · `user/editor/useOutlineEditing.ts` 117 ·
`user/editor/descriptors/index.ts` 50 · `descriptors/shape/{curve,detail,offset,radius,simplify,smooth,straighten}.ts`
214 · `descriptors/image/{blend,brightness,contrast,fill,preset,saturate,tint,vignette,warmth}.ts` 150 ·
`user/editor/image-presets.ts` 30.

**Fix:** move those 20 files from A-UI into A-engine (N9), citing the 7 Aug lines above. A-UI becomes
**28 files · 3,599 lines** — the pages, the components (`.tsx`), their stylesheets and icons, plus
the hooks used only by those panels (`useCanvasView`, `useEditorGestures`, `useImageFilters`,
`geometry.ts`, `tool-config.ts` — each imported only from A-UI components). The "on record" total
becomes **5,309** (3,599 + B-bench 1,710).

Everything else in rev 2 stands. Re-gate after this move is a delta check only.

---

# Round 9 — T12 kill-list (`2026-09-22-s62-deslop-killlist.md`): NOT-CLEAR

The list is a proposal Dan signs, so the gate is whether every row states its authority truthfully
and whether executing it breaks anything he said to keep. **Three rows claim more authority than the
record gives.** The graph work is otherwise sound, and the lead's questions are answered below.

**Dan's words, read in their own context** (not the list's excerpts):
- **4 Aug 15:47** *"delete v1 we can always recover - keep v5.3.1 obviously"* — answering Kai's
  15:45 description of v1 as *"the v1 page/UI (`effect-creator/grid-lab/`) and the v1 engine
  (`grid-core.ts`)"*. So **v1 = the grid-lab bench + the grid-core engine — confirmed.** Kai then
  recorded the order, which Dan accepted: *"build v2 engine → repoint `computeAttachmentGrid` to it →
  **then** delete the v1 engine."*
- **5 Aug 18:02** *"no ui in v5.3.1 - it is broken and must be deletted - reuse your ui shel for theis
  proto only"* — said while Kai was reading v5.3.1's editor UI. Kai's uncorrected reading: delete the
  UI, keep *"the neutral engine only … + the pure producer functions"*.
- **7 Aug 19:10, Dan's own goal:** *"Old v5.3.1 creator UI stays deleted (**pages/panels only —
  flows/, core/, lib/effect remain**; grep importers before any delete)."* **This is the boundary.**
- **24 Aug** *"you can delete the entire engine and logic for what i care **keep scaffold**"*.
- 21 Aug *"tab must be called v5.3.1"* was a slip, corrected 11 s later to *v3.5.1* — no live
  v5.3.1 tab.

## F1 · BLOCKER · Row A deletes what Dan said to keep

Row A kills all of `v5.3.1/**` except the three seam files — **flows/ and core/ included** — plus
`src/lib/effect/{mesh,build-mesh,image-shape}.ts`, under "Dan authority on record". The record
authorises **pages/panels** and says flows/, core/ and lib/effect **remain**. It is not academic:
`flows/twoDFirstFlow.ts:29,89` calls `prepareStandard` and `exportCutlineSvg`, and
`core/transactions.ts:21,149` calls `prepareStandard` — the very symbols row X would trim away as
"0 callers".

**Fix — split row A:**
- **A-UI · KILL, on record:** the v5.3.1 **pages and panels only**, enumerated file by file, importers
  grepped first (Dan's own procedure).
- **A-engine · → Dan (new N-item):** `flows/`, `core/` (including `prepareStandard`,
  `exportCutlineSvg`, `runCutout`, `computeAttachmentGrid`), the producers and shapes beyond the three
  symbols grid-centre calls, and `src/lib/effect/{mesh,build-mesh,image-shape}.ts`. Quote the 7 Aug
  line verbatim as the standing KEEP. They stay unless Dan rescinds it.
- **Row X:** extract the three seam files; **no trimming of core/ symbols** until Dan rules on
  A-engine.

## F2 · BLOCKER · Row B's engine half carries an unmet condition and depends on F1

The **bench** half is authorised outright. The **engine** half (the S59 `grid*` family and its
scripts, tests and docs) was authorised on the condition Kai recorded: repoint `computeAttachmentGrid`
first. That function lives in `core/primitives.ts` — core/ is on Dan's keep list — and it imports the
S59 engine (type import `:23`, `await import('@/lib/effect/grid')` at `:93`). With core/ kept,
deleting `effect/grid.ts` breaks the typecheck, and grid-centre's module graph still reaches the S59
engine lazily through that file.

**Fix — split row B:**
- **B-bench · KILL, on record:** `effect-creator/grid-lab/**`, with N1 (where `/` redirects) decided
  in the same change.
- **B-engine · KILL, on record, conditional:** state the condition in the row — it runs only after
  Dan's A-engine ruling removes `computeAttachmentGrid`, or after that function is repointed to the
  live engine (Kai's 4 Aug plan).
- **Keep `rounded-square.test.ts` — edit it, don't delete it.** `rounded-square.ts` is live (the list
  says so), and the list deletes every test that covers it. That test imports `grid-prepared` only as
  a measuring stick (`:17`). Replace that stick with the live engine's own distance measure, and add
  it to the list's "edits, not deletions" beside `locks.test.ts:26` and `geometry-truth.test.ts:12`.
  (`mesh-edge.test.ts:9` does the same, but `mesh.ts` belongs to A-engine and follows Dan's ruling.)

## F3 · Row Z is counted as Dan-authorised with no Dan words

The totals put Z under *"KILL — Dan's authority on record"*. There is no Dan quote for Z, and its own
history (28e5a063, 25 Jun) says the retired algorithm was kept *deliberately* so its regression tests
still run. **Fix:** move Z to *"KILL-proposed — Dan decides"* and quote that 25 Jun rationale, so he
signs knowing it reverses a recorded keep.

## Non-blocking

- **Row C / N2** is correctly routed to Dan, but it *recommends* deleting what he said to keep
  (*"keep scaffold"*). The argument — the scaffold's structure now lives in `src/lib/effect` — is a
  legitimate reading. Present it to him as a reversal of his words, not as support.
- **The device-performance harness** does measure only the S59 engine: its only engine imports are
  `effect/grid` and `grid-s0-corpus`, and it drives real browsers. So it rightly goes with B-engine.
  Two things Dan should see before signing: it is the repo's **only on-device performance check**
  (the live engine has only the headless, opt-in `pipeline/__tests__/bench.test.ts`); and it is the
  test the stray lock entries turn red. Deleting it hides that symptom but does not settle the lock
  call, which stays separate.
- **Studio's code** carries 152 v5.3.1 donor-lineage comments that will go stale. Nothing breaks.

## The lead's questions, answered

| Question | Answer | Evidence |
|---|---|---|
| Is "v1" really grid-lab + grid-core? | **Yes** | Kai's 15:45 description, which Dan answered at 15:47 |
| Does a live path reach the S59 engine? | **grid-centre — lazily**, via `v5.3.1/core/primitives.ts:93` (+ type import `:23`). The pipeline does not. **The package does not:** built it, 73 modules, the only file from any row is `grid-engine/compute/geometry.js`, which row C keeps. **Studio does not:** nothing in its main tree reads onemo-next | builds and greps above |
| Does device-performance go with it? | **Yes** — see the note above | its imports |
| Untracked files inside any target? | **None** | `git ls-files --others` over every target |
| Re-export-aware refs outside the kill set | Only these five: `primitives.ts` (F2), `locks.test`, `geometry-truth.test`, `rounded-square.test`, `mesh-edge.test` | grep over `from` / `import()` |

**Not covered:** like the list, no post-kill build — it is owed at execution, before anything is
called done. The build output I produced is untracked; the tree is unchanged.

---

# Round 8 — T13 (Library tab wears the padding disc): CLEAR

**The ask** is the finding QA filed: the Library tab could not follow the padding mode — its stage
model took no disc. Standing words: the disc is an internal visual guide (Dan 15:14); edge padding
applies to canon and wrapped shapes (13:53).

**Provenance.** pid 83495, `cwd` = the worktree, 24 entries (the new one is
`grid-magnet-library-bridge.ts`); last change 19:15:35, all runs after it. Headless, fresh context,
zero page errors, frames opened. Evidence `evidence/t13-qa/`.

**Source.** `libraryStageModel` takes an optional `PaddingDiscSpec` and places it on the stage grid —
it wraps and resolves nothing, so the bridge's pinned role holds. The page resolves the disc through
`paddingDiscOf(RELEASED_PADDING_MM, dials)`, the same rim and dials the Presets delivery uses, with all
three dials in the memo's dependencies.

**On screen** — Library 3×3, published 120 mm, mode set on Bench each time (`L-strip.png`):

| Bench mode | Library draws |
|---|---|
| circle | circles |
| squircle, corner 5 | 24 mm squircles |
| squircle, corner 0 | sharp 24 mm squares |
| squircle, corner 12 (bound) | circles |
| offset | 32 mm squircles (31.2 drawn) |

The field markers match the disc. The mode survives Bench → Library → Bench. T13 as filed is closed.

**Headless.** Typecheck clean; 903 pass / 1 fail / 11 skip, my own run. The failure is still only the
lock profile, re-proven on this head — the delta touched two bridge files, so I did not assume it.
Scaffold deleted; tree back at 24.

**Two product calls the lead made and flagged — Dan's to confirm, not blockers:**
- **The Library outline stays as published** and does not take the edge padding. So in offset mode the
  32 mm discs always hang past the Library outline, even with edge padding at 24
  (`L-offset-e24-published.png`). The same overhang Dan already has open for Presets at edge 0.
- **The mode control lives on Bench only.** The Library wears the mode but you change it on Bench.

**Non-blocking.** Drawn disc widths carry a small render trim — 23.5 for the 24 mm cell, 31.2 for 32 mm
(was 31.45 before Round 6 moved the trim onto the rim). Screen guide only; sub-millimetre.

---

# Round 7 — T8 (envelope step): CLEAR, no code change

**Governing directive** — Dan 11:15, vault: *"The solution is to make effects bbox to have extra
padding to envelope any panel sparse or the granular. And I found the best option is to add extra
24mm step or a half - 12mm padding (6-12mm on each side basically) this provides breather for any
shape like 120 turns into 132 or 144 - smaller effect becomes 84mm etc"*. Plus the tracker DoD.

**Step-snapping and panel-declared steps are not required.** Dan names the amounts — 6 or 12 a
side — not a snapping rule, and he never confirmed the lead's 11:17 panel-declaration proposal
(his next words, 11:30, went to the disc). A dial that takes those values meets the words; building
more would be drift.

**Provenance.** Same head as Round 6 — no working file changed after 18:56; my Round 6 gate ended at
19:04. pid 83495, `cwd` = the worktree. Headless, fresh context, zero page errors.
Evidence `evidence/t8-qa/T8-strip.png`, frames opened.

| record | edge 0 | edge 6 | edge 12 | legal | magnets |
|---|---|---|---|---|---|
| square B3 3×3 | 120 | **132** | **144** | 96 × 96 unmoved | 9 |
| square B2 2×2 | 72 | **84** | 96 | 48 × 48 unmoved | 4 |

On screen: at edge 0 the discs touch the outline — the snugness Dan objected to; at 6 and 12 each
effect has an even breather all round. Against Dan's own panel sizes, that gives 6 or 12 mm per side
over the granular panel (which equals the effect) and 2 or 8 mm per side over the 128 mm sparse
panel. The panels are physical and outside the engine, so this is arithmetic on the drawn sizes.
It also holds for wrapped shapes since Round 6's Blocker 1 fix.

**Headless half:** unchanged tree, so my own Round 6 run stands — typecheck clean, 903 pass / 1 fail
(the lock-profile baseline, re-proven on this head).

**Dan's call:** the edge-padding default is still 0, so no effect carries the envelope until he sets
it or locks it. The lead asked him at 15:35; no answer yet.

---

# Round 6 — T9 + T17 re-gated: CLEAR

**Verdict: CLEAR.** Both Round 5 blockers are fixed, observed on :4066 on the current code; the one
partial take and the one refutation are both correct.

**Provenance.** pid 83495, `cwd` = the worktree, `18162dd2` + 23 working entries. Headless Chromium
(declared fallback), fresh context per run, zero page errors, every solve waited to completion. Every
frame cited was opened. Evidence: `evidence/t9t17-r6/`.

**Source matches the claims.** `grownContour` exists once, in `offset.ts` (a move, not a copy). The
wrap's seat radius is the disc's own round margin (`units/wrap.ts:152`). Wrapped shapes are grown
after the wrap (`grid-magnet-wrap-compute.ts:55-56`), with their legal box taken from the ungrown
outline. The Presets overlay reads `legalContour ?? contour` (`libraryViewModel.ts:21`).

## Blocker 1 — fixed

Generators, square discs, edge padding 0 → 12 → 24:

| shape | outline | magnets | legal box |
|---|---|---|---|
| Blob | 117 → 141 → 165 mm | 4 · 4 · 4 | 93 × 92 unmoved |
| Polygon | 98 → 122 → 146 mm | 4 · 4 · 4 | 74 × 86 unmoved |

Exactly 2× the dial, magnets kept (`G-Blob-shapeR-strip.png`). **Shape radius now reaches generated
shapes:** hexagon at edge 24, *follow* → rounded corners, *0* → sharp; the sharp tips reach 3.7 mm
further per side (151 → 159 mm), the correct geometry for a 120° corner (`PG-strip.png`). The Blob
shows no difference between the two because it has no corners — expected.

**Star — not a defect.** At band B2 the engine refuses square discs outright: the page reads *"no
lawful offer in this band — calibration witness only, not a fit"*, and the overhanging square drawn
is that labelled witness. Circle discs fit (108 mm, 2 magnets) and grow to 156 mm at edge 24 —
108 + 48. That is Dan's "circle fits and square does not" at the level of whole layouts.

## Blocker 2 — fixed

Square B2 72 mm: the legal-area overlay reads **48 × 48 at edge 0, 12 and 24**, and is **present at
shape radius 0, 6, 12, 18 and 24**. Looked at the worst previous case — edge 24, radius 6: the 48 mm
box sits between the magnets, not grown (`P-sq-e24-shapeR-6.png`). The circle shape's legal area
holds at 68 × 68 across 92 → 140 mm.

## The partial take and the refutation — both accepted

- **`effSize` on the wrapped path stays the wrap scale.** Correct: the page feeds it back into the
  band-scale request (page.tsx:528, 636, 753). Adding the padding there would pad it again on the
  next solve. The drawn outline carries the padding; the rung chip shows the wrap size (117.38 mm on
  a 165 mm outline), the same convention as the Presets record chip showing the published 72 mm on a
  120 mm outline. Consistent.
- **The first-vertex stamp in `erodeBySquare` is not redundant — my Round 5 note was wrong.**
  Clipper's Minkowski sum sweeps the square's *outline* along the path, so a region component
  wholly inside the square never crosses that outline and would survive. The stamp covers it.

## Regressions — none

Presets square 72 / 96 / 120 at edge 0 / 12 / 24; circle shape 92 → 140; Dan's 15:43 case
(squircle, corner 5, edge 12) still shows 24 mm squircles with matching lattice markers.

## Headless half

Typecheck clean. 903 passed / 1 failed / 11 skipped, my own run. **The one failure is still only the
lock profile, re-proven on this head** — the engine changed since my Round 5 proof, so I re-ran it:
with the committed empty profile swapped in (in memory, scaffold deleted, tree back at 23 entries),
all three device baselines match.

## Still open — Dan's calls, unchanged

The two unlocked lock entries (behaviour-neutral; they alone turn that test red) · discs drawn outside
a released shape's outline in offset mode at edge 0 · the shape-radius default still "follow
padding".

**Not covered:** holes on the wrap path. Nothing is committed.

---

# Round 5 — T9 (shape radius) + T17 (true-shape wrap)

**Verdict: NOT-CLEAR** — 2 blockers (3 findings, two sharing one root). The true-shape engine work is
right and I watched it work; the blockers are on edge padding for wrapped shapes and on the legal-area
overlay.

**Governing directives** (full vault read 1278–1866, plus raw JSONL for the mid-turn one):
- T9 — Dan 15:42: *"the padding applies but why by default it adds radius i need the controls for
  that for me to set and lock shape radius"*
- T17 — Dan 14:44:30Z, mid-turn (`attachment`, `userType: external`, with screenshot 15.43.11):
  *"why with the radius set the circles expand - the main point is to have true shapes and wrap
  engine to react to that shape not circle - there will be points where circle fits and square does
  not and vice versa"*
- Standing — Dan 13:51 *"the line that wraps the grid must be padded = edge padding"*; 13:53 *"edge
  padding applies to the wrap shapes and canon all of them - the canon expands out by that number as
  well as other shapes"*.

**Provenance.** pid 83495, `cwd` = `onemo-next/.claude/worktrees/s62-edge-padding`, `18162dd2` + 20
working entries, hot-reloaded. Headless Chromium (no extension connected; declared fallback). Zero
page errors on every run. Every frame cited below was opened and looked at. Evidence:
`evidence/t9t17/`.

## BLOCKER 1 · Edge padding strips magnets from wrapped shapes instead of padding the line

Generators, Blob, square discs (radius 0), edge padding swept to its ceiling —
`evidence/t9t17/GT-Blob-edge-strip.png`:

| edge padding | outline | magnets |
|---|---|---|
| 0 | 117 mm | **4** |
| 12 | 119 mm | **3** |
| 24 | **97 mm** | **1** |

The shape does not "expand out by that number" — it loses magnets and, at the ceiling, shrinks. Canon
shapes do expand (72 → 120). Dan ruled the wrapped shapes behave the same.

**Root:** `units/wrap.ts` adds edge padding into the *seat clearance*
(`const radius = roundMM + Math.max(0, cfg.edgePaddingMM ?? EDGE_PADDING_MM)`), inside a
band-bounded size search — so the search trades magnets for clearance rather than padding the line.

**Resolution method** (ordered):
1. `units/wrap.ts` — the seat test uses the disc's true shape only:
   `const radius = roundMM` (delete the `+ edgePadding` term and the `EDGE_PADDING_MM` import if
   orphaned).
2. Move `grownContour` out of `pipeline/deliver-record.ts` into a shared engine unit (it is now needed
   by two callers — canon delivery and the wrap) — unchanged, a move not a rewrite.
3. After the wrap selects its outline, grow it by edge padding with that same `grownContour`, honouring
   `shapeRadiusMM` — the identical mechanism canon uses — and add `2 * edgePaddingMM` to its reported
   size.

*Done when:* Blob, Star and Polygon keep their edge-0 magnet count at edge 12 and 24 and grow by
exactly 2× the dial (Blob square: 117 → 141 → 165); the 1,247-record band sweep still reads 0 drift;
observed on :4066. Side effect worth having: the shape-radius control then reaches Generators with no
new code — the lead's own open caveat ("right now it only affects Presets shapes") closes.

## BLOCKER 2 · The legal-area overlay misreports on Presets — two symptoms, one root

**2a — it grows with edge padding.** Square B2 72 mm, `evidence/t9t17/L-legal-edge*.png`, drawn
legal-area path measured in the stage's own millimetres:

| edge padding | drawn legal area |
|---|---|
| 0 | **48 × 48** |
| 12 | **72 × 72** |
| 24 | **96 × 96** |

The record's legal area is 48 mm and never moves — the 1,247-record sweep proves the engine keeps it.
The overlay tells Dan it doubled.

**2b — it vanishes at intermediate shape radii.** Edge 24, shape radius swept —
`evidence/t9t17/R-strip.png`: the layer is present at **0, 18, 24** and **absent at 6 and 12**.
Reproducible with a 4 s settle; not timing.

**Root (both):** `adapters/libraryViewModel.ts:23` builds the overlay by insetting the **delivered,
grown** outline by the 12 mm rim (`insetOffsetPath(path, RELEASED_PADDING_MM)`), and the page feeds it
`presetModel` (page.tsx:547). A grown outline makes the inset grow (2a); a corner arc smaller than the
rim collapses under an exact inset and returns nothing (2b).

**Resolution method:** compute the Presets legal-area islands from the record's **published,
ungrown** outline — the one `recordStageModel` returns before `grownContour` — inside the engine, and
hand that to the page, instead of insetting the delivered contour. The page must still reach only
through the door. *Done when:* the overlay reads 48 × 48 on the 72 mm square at edge 0/12/24 and is
present at shape radius 0/6/12/18/24; observed on :4066.

## Verified clean — observed, not inferred

- **Dan's 15:43 complaint is fixed.** Same settings (square, squircle, corner 5, edge 12): the discs
  are 24 mm squircles with no circle round them, and the lattice markers are the same squircle —
  `P1-dan1543-sq-r5-e12.png`. Corner radius at its bounds: 0 → sharp squares, markers follow
  (`P2a`); 12 → circle (`P2b`).
- **The wrap reacts to the true shape.** Star, circle → squircle 11 → 5 → square: 206 → 208 → 213 →
  195 mm, 5 → 5 → 6 → 4 magnets (`G-Star-strip.png`). Zoomed, the four square discs sit inside the
  arms with corners just touching the line at the top arm and the lower notch
  (`G-Star-sq-r0-zoom.png`). Square discs could not take the layout circles fit — Dan's "circle fits
  and square does not", on screen. Blob, settled and timed: circle 107 · squircle 11 108 · r5 113 ·
  square 117 mm, each solve 0.3–1.3 s.
- **The maths is right.** Fitting a squircle = eroding by its round margin then by its square core —
  exactly the composition coded. The circle case keeps the old fast path byte-for-byte. `gapsMM` as
  distance to the feasible-centre boundary is the exact gap. `paddingReachMM` has no residue.
- **Shape radius (T9) works on canon.** Edge 24: follow → 24 mm corners, set 0 → sharp, 12 →
  tighter, 48 → clamped to 24, identical to follow; size 120 mm throughout (`P3-strip.png`). A
  framed record with a hole pads correctly at radius 0 and follow, the hole shrinking as material is
  added (`P4a`, `P4b`).
- **The red test is the lock profile, proven.** With the committed empty profile swapped in (in
  memory, scaffold deleted, tree back at 20 entries), all three device baselines match; with the two
  stray entries, `dense-live-plan` differs. The engine change does not move it.
- Typecheck clean. 902 passed / 1 failed (that baseline) / 11 skipped, my own run.

## Dan's calls — for the lead to carry, not QA's

- **The two lock entries** (`edgePaddingMM: 0`, `paddingRadiusMM: 11`, both `locked: false`).
  Unlocked means "released, value remembered" — they seal nothing, so keeping or clearing them is
  behaviour-neutral; only the baseline hash cares. **Not written by my automation:** the file changed
  at 15:42:45 BST; my last page interaction ended at 15:37:29.
- **Offset mode at edge 0 draws discs outside the record's outline** — confirmed on screen
  (`P6-offset-e0-overhang.png`).
- **The shape-radius default is still "follow padding"**, so at edge 24 the first thing Dan sees is
  round corners until he sets it. He asked for the control, which exists; the default is his.

## Non-blocking

- `erodeBySquare` also stamps the square at each path's first vertex. Every point within that square
  already lies within the boundary sweep, so it appears redundant — harmless; the builder's call.
- A lock click on the dev page writes `lock-profile.ts`, a tracked file the perf baseline hashes — so
  any lock toggle during a demo or a QA run turns CI red. Existing mechanism; noted, not raised.

## Corrections to my own Round 4 (T7) verdict

- **"circle 72 → 120 PASS" was false when I wrote it.** The click hit the padding-mode `circle`
  button, which sits earlier in the page; that frame shows the **pill** still selected. The circle
  *shape* is now actually observed: 92 → 140 mm at edge 0 → 24, discs unchanged
  (`P5a`, `P5b`) — so the claim holds today, but it was not verified then.
- **My T7 CLEAR swept Presets only.** Dan's ruling covers wrapped shapes too; I never moved edge
  padding on Generators. Blocker 1 above was live under that CLEAR.

## Not covered

- **Holes on the wrap path** — no Generators source with holes exercised; the erosion is correct by
  reading, not by observation.
- The Polygon frames from the first pass may have been captured mid-solve; not relied on.
- T13 (Library tab) and all commit/CI steps — out of this gate. Nothing is committed.

---

# Round 4 — T7 gated with the visual law applied. And my Round 3 CLEAR, retracted.

## RETRACTION — the Round 3 CLEAR was invalid

It cited *"all three modes at Dan's numbers **observed live**"*. **I never opened a single
screenshot.** I scraped `getBBox().width` out of the DOM, reported the numbers, and called that
observation. Seven captures sat in `evidence/` unread.

Dan caught it, and the same failure had just caught the lead: it generated a screenshot showing four
enormous overlapping discs — a four-petal flower where a square should be — read the bounding-box
number instead, and was about to call it working.

**The specific gap in my gate:** I exercised edge padding at its default of **4** and never swept
the dial. `EDGE_PADDING_CEIL_MM` is **24**. Dan set 24 and got the flower. At 4 the conflation is
invisible; at the ceiling it is grotesque. A gate that never moves a dial through its declared range
has not gated the dial.

**900 passing tests cannot see that something looks like a flower.** Headless evidence stays
necessary and stays insufficient. Round 3's verdict is withdrawn; T1–T6 are re-covered by the
observation below, which supersedes it.

## T7 · VERDICT: CLEAR — the split is real, and I looked

**Provenance.** `lsof -nP -iTCP:4066` → pid 83495, `cwd` =
`onemo-next/.claude/worktrees/s62-edge-padding` — the worktree itself, not a stale build. Tree at
`18162dd2` + 19 working entries. Dev server, hot-reloaded. Headless Chromium (no Chrome extension is
connected to this session; declared fallback). Zero page errors in every run below.

**The split, in source.** `foundation/padding-disc.ts` no longer references `edgePadding` at all —
the disc is independent. `pipeline/deliver-record.ts:47` now reads `cfg.edgePaddingMM` **directly**
instead of recomputing it from `paddingDisc.halfMM`. That is exactly the F1 defect, closed at the
site I named.

**The split, on screen.** The bench now carries two dials in Dan's own words:
`DISC OFFSET · GROWS THE CELL, NOT THE LINE` and `EDGE PADDING · PADS THE WRAPPING LINE`.

Square, B2 72 mm record, dial swept to its ceiling:

| mode | edge 0 | edge 12 | edge 24 | disc |
|---|---|---|---|---|
| circle | 72 mm | 96 mm | **120 mm** | **24 mm, unchanged** |
| squircle + offset (radius 12.8, disc offset 4) | 72 mm | 96 mm | **120 mm** | **31.4 mm, unchanged** |

**Observed, not inferred** — `evidence/t7-circle-edge24.png` and `evidence/t7fix-offset-edge24.png`:
a square with an even orange margin on all four sides, four discs sitting on their 48 mm lattice at
their own size, magnets unmoved. **Not a flower.** The offset case is Dan's lime-panel requirement
made real: a 32 mm cell inside a 120 mm effect — the combination that was unrepresentable this
morning.

**Every canon shape, not just the square.** Edge padding 0 → 24 on all seven Presets chips:

```
square     72   -> 120   grew 48.0   disc 24 -> 24   PASS
rectangle  24x72-> 72x120 grew 48.0  disc 24 -> 24   PASS
diamond   129.9 -> 177.9 grew 48.0   disc 24 -> 24   PASS
triangle  134.8 -> 182.8 grew 48.0   disc 24 -> 24   PASS
pill       72   -> 120   grew 48.0   disc 24 -> 24   PASS
circle     72   -> 120   grew 48.0   disc 24 -> 24   PASS
oval       72   -> 120   grew 48.0   disc 24 -> 24   PASS
```

Seven of seven grow by exactly 2× the dial with the disc untouched. That is Dan's
"the canon expands out by that number as well as other shapes", delivered.

**Headless half** (necessary, not sufficient): typecheck clean; **900 passed, 11 skipped, 0 failed**
across 78 files, my own run, including the adopted 1,247-record band-drift sweep.

## Two instrumentation errors of mine in this round, both caught by looking

- **`circle` is ambiguous** — it names both a Presets shape chip and a padding mode. A
  `text-is("circle")` locator can click the wrong one and the numbers still look plausible. Resolved
  by DOM index.
- **`rectangle` flagged `** CHECK **` and was fine.** My metric filtered outline widths to >40 mm,
  which excluded a slim 24 mm-wide record at the baseline and made it read as growing 24 instead of
  48. The screenshot settled it in seconds: 72 × 120 mm, correct. **A number raised a false defect;
  the image killed it** — the same lesson in the opposite direction.

## Still not covered

- **Nothing is committed.** Dirty worktree.
- **T8–T12 unbuilt**, outside this gate. **T13 open** (Library never offers the padding control).
- **F7's live-dial half open** — an admin can still type a combination no mode declares. Dan's ruling.

---

# Round 3 — CLEAR on T1–T6 and T14 — **RETRACTED, see Round 4**

**Verdict: CLEAR.** Everything I raised is applied, correctly refuted, or filed as an open task with
an owner. Both of my own errors are recorded below.

## T14 · re-gated, my own run, five rows

Headless on :4066, pid serving the worktree, zero page errors. Screenshots
`evidence/qa-final-row3-viaBench.png`, `evidence/qa-final-poisoned.png`.

| # | step | disc | control says |
|---|---|---|---|
| 1 | Presets, offset set | **31.45 mm** | squircle + offset |
| 2 | Library | 24 mm | *(nothing — T13, unchanged and expected)* |
| 3 | back via **Bench → Presets** | **31.45 mm** | squircle + offset |
| 4 | honest reload | **31.45 mm** | squircle + offset |
| 5 | poisoned + reload | **24 mm** | **circle** — label and geometry agree |

Row 5 poisons harder than the done-condition I set: a bogus mode id **and** out-of-bounds values
(`{"shape":"NOT_A_MODE","radiusMM":99,"edgePaddingMM":99}`). All three are discarded together and
the default variant's own triple is taken. Persistence is genuinely one record —
`grid-centre.disc` = `{"shape":"offset","radiusMM":12.8,"edgePaddingMM":4}`, single key, validated
whole.

**The lead was right to refuse my fix.** I proposed "adopt the variant's declared values whenever
the mode resolves"; that would overwrite a radius an admin had deliberately typed, on every
hydration. It took the property I was after — no combination can exist that no variant declares —
and got it at the root: three independent keys cannot be made safe, so there is now one record.
Better than what I asked for.

## Two errors of mine, recorded

**Row 3 was my locator, not a regression.** `Presets` is a **Bench sub-tab**; the outer axis is
`Bench | Library`. On the Library tab only `Bench` and `Library` render, so my
`button:text-is("Presets")` matched nothing, never left Library, and re-read Library's 24 mm — twice,
which is why longer settle times did not change it. Verified: buttons on Library are exactly
`["Bench","Library"]`. Driving it properly gives 31.45 mm. My 3c observation (no mode button pressed
on Library) was true and useful, but its cause is T13 — the control is not rendered there — not
persistence.

**My first spot-radius finding was half wrong** (see F8 above), withdrawn for the canon path and
upgraded for the Library path.

## Suite, my own run, whole repo

```
Test Files  78 passed | 2 skipped (80)
     Tests  899 passed | 11 skipped (910)
```

899 with zero failures — the lead's number is exact. The `src/lib/effect` subset alone is 708 passed
/ 1 skipped across 52 files; the gap to 899 is scope, not a discrepancy.

**Tree verified:** `library/padding-disc-class.ts` is gone and `library/index.ts` and
`pipeline/index.ts` are no longer modified — T10's revert is real, on Dan's ruling that the disc is
an internal visual guide, not a shape. `band-drift-sweep.test.ts` is landed and running in the
suite. 16 modified + 3 untracked.

## What is CLEAR, and what it does not cover

**CLEAR:** T1–T6 and T14, on the ask as Dan stated it — necessity clean, the band invariant proven
across all 1,247 records, no fifth wrap seam, the page deciding nothing about disc shape, all three
modes at Dan's numbers observed live, 899 green.

**Not covered, and not claimed:**
- **Nothing is committed.** This is a dirty worktree. It ships or it evaporates.
- **T7–T12 are not built** and are outside this gate. T7 is in flight on the F1 rewrite.
- **T13 stands open** — the Library tab never offers the padding-mode control.
- **F7's live-dial half stands open** — an admin can still type 32/full in-session. The persistence
  half is closed by construction. Clamp or ruling is Dan's.

---

# Round 2 — the two owed measurements, run

## F2 · CLOSED. Both quotes are real Dan messages, proven from the raw record

The lead refuted my de-quote fix and was right. I did not take its word — the memory it cited
(`reference_vault_drops_dan_midturn_messages.md`) names the method, so I used it: read the raw
session JSONL, not the vault.

In the lead's own session `bfdd88a3-d1f7-4314-867c-20ba7057eff7.jsonl`, both strings appear as
`type: attachment` with `userType: external` — the human marker, the documented queued-command
signature of a mid-turn send:

| task | Dan's words | record | timestamp |
|---|---|---|---|
| T3 | "add the offset to the grid engine that we can set as admin" | `attachment` · `userType: external` | 2026-09-22 **10:30:53Z** |
| T6 | "all this makes the engine integrated spec variants - and engine reacts to it as well" | `attachment` · `userType: external` | 2026-09-22 **11:28:16Z** |

They are Dan's verbatim instructions. The vault cannot see them by construction. The lead's
handling — quote them, mark each ⟨mid-turn⟩, cite the provenance — is correct and better than my
fix. **Add the two timestamps above to the tracker**; they turn "trust the lead" into "check the
JSONL at this time".

**Method note for future audits (mine included):** vault silence about a Dan instruction is
inconclusive, never evidence of invention. Check the raw JSONL before adjudicating authority.

## Band drift · SWEPT. The T4 claim holds catalogue-wide

Written, run and removed from the builder's tree (kept in my scratchpad; yours if you want it as a
standing regression test — that is your scope call, not mine).

Every published record, every released pitch, all three padding modes, comparing each record's
delivered legal box against its own baseline:

```
[QA SWEEP] records swept: 1247 · legal-area drift: 0 · offset-mode non-growth: 0
✓ 11748ms
```

**1,247 records — the exact catalogue count. Zero legal-area drift. Zero records where the offset
mode failed to grow the outline.** The sweep is non-vacuous in both directions: it fails if a legal
box moves *and* it fails if the outline does not grow. Your invariant is independently confirmed at
full catalogue scale. **This was the one blocker-grade claim neither lane had measured; it is now
measured and it passes.**

## Visual gate · RUN, by me, on the current code

**Provenance:** pid 83495 serving :4066, cwd = `onemo-next/.claude/worktrees/s62-edge-padding`, the
worktree itself, HTTP 200. Headless Chromium — no Chrome extension is connected to this session
(`list_connected_browsers` → `[]`), same constraint the lead hit. Screenshots in
`8-governance/audits/evidence/qa-4066-*.png` and `qa-gate-*.png`. Zero page errors throughout.

Measured off the stage SVG, whose viewBox is millimetres:

| step | surface | mode | drawn disc |
|---|---|---|---|
| 1 | Presets | squircle + offset **set here** | **31.45 mm** ✓ |
| 2 | Library | same state carried over | **23.4 mm** — and the mode control **is not rendered on this tab at all** |
| 3 | Presets | nothing clicked but the tab | **23.4 mm** — the mode did not survive the round trip |

**Row 2 confirms T13 independently, and sharpens it.** It is not only that the Library ignores the
dial — the Library surface does not expose the padding-mode control in the first place. Your
measurement (Presets 31.4 · Library 23.4) reproduces exactly.

**Row 3 is new — neither of us had it. NEW FINDING, blocker-grade for the surface Dan uses.**
Presets → Library → Presets, with no mode click in the third step, and the disc is back to circle.
Dan sets the offset mode, glances at the Library, comes back, and his mode is silently gone with
nothing on screen saying so.

I am reporting the observation and the reproduction, not a diagnosis. But one source fact is worth
handing you, because it is provable and it points at the same area:

```
page.tsx:110  const [edgePad,   setEdgePad]   = usePersisted('edgePad', EDGE_PADDING_MM)
page.tsx:111  const [padShape,  setPadShape]  = useState<PaddingShape>(PADDING_SHAPE)     // <— not persisted
page.tsx:112  const [padRadius, setPadRadius] = usePersisted('padRadius', SQUIRCLE_RADIUS_MM)
```

**The mode is the only one of the three that is not persisted, while both values it governs are.**
Independently of the tab round trip, that means a reload lands you in `circle` mode still carrying
the offset mode's radius and edge padding — which is F7's mode leakage, not as a theoretical
admission but as a state the page produces on its own. It also rhymes with the s62 item still open
from before this sprint: "locks display after reload — browser values override a sealed dial."

**Installable fix** — add to the tracker's Open list:

```markdown
- [ ] **T14 · The padding mode does not survive leaving the tab** — *observed on :4066 by QA, 22 Sep*
      Presets → Library → Presets with no mode click and the disc returns to circle (31.45mm → 23.4mm).
      Dan loses his mode with nothing on screen saying so. Related source fact: `page.tsx:111` holds
      `padShape` in a plain `useState` while `edgePad` (110) and `padRadius` (112) are both
      `usePersisted`, so a reload also lands in `circle` carrying the offset mode's radius and edge
      padding — F7's mode leakage, produced by the page itself.
      *Done when:* the mode survives a tab round trip and a reload, and mode/radius/edge padding can
      never be observed in a combination no variant declares. Seen on :4066.
```

---

## Verdict after round 2

Still **NOT-CLEAR**, and the reason has changed. Every blocker I raised against the *list* is
applied or correctly refuted, and both owed measurements now pass — the band invariant holds across
all 1,247 records and the visual gate is run on the current code by me. What stops a CLEAR is
**T14**: a state-loss defect on the surface Dan uses, found by that gate, not yet on the list.

Nothing here blocks T7. T7 was already yours to start and the F1 rewrite stands.

---

## What I checked, and what I did not

**Checked, my own run, not inherited:**
- Full 1,277-line day-file read; every Dan turn enumerated against the twelve tasks.
- `grep` for both disputed quotes across the whole `claude/s62/` vault, **then the raw session
  JSONL**, which settled them.
- Full `git diff` + `--stat` of the worktree; both untracked files read.
- Slop-deletion residue sweep (`closing|panelJoin|fuse|union`, `package.json`).
- **No fifth `WrapConfig`** — construction sites are exactly `canon-experiment.ts:48` and `:204`,
  `solve.ts:225`, plus the compute-internal `wrap-compute.ts:122`. All four carry `edgePaddingMM`,
  `paddingShape` and `paddingRadiusMM`. Your fix holds.
- **The page decides nothing about disc shape** — the Edge padding dial (page.tsx:717) renders
  unconditionally, the Corner radius dial (714) is gated on `exposesRadius` read from the spec, and
  variant choice (709) applies the spec's own defaults. No branch on a mode id. That part of Dan's
  "nothing hardcoded" holds.
- `npx vitest run` on padding-disc, grid-layout-library, grid-magnet-separation and locks:
  **198 passed, 4 files, 123.91 s.** My run, in the worktree.
- **The 1,247-record band-drift sweep**, above.
- **The visual gate on :4066**, above, with provenance and screenshots.

**Not checked — stated so it is not mistaken for covered:**
- **The cause of T14.** I observed the loss and read one source fact that points at the area. I did
  not diagnose it; that is the builder's.
- **Generators tab** — I gated Presets and Library. Generators was covered by the lead and by the
  sweep's solve path, not by my own eyes.
- **No commit, no merge, no CI.** Everything above is a dirty worktree.

**My scaffolding is removed.** The sweep test is out of the builder's tree; `git status` is back to
your 21 entries (18 modified, 3 untracked). Nothing of mine is in your diff.
