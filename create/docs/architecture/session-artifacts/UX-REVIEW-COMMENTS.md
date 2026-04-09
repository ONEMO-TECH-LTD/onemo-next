# Create UX Review — Running Comments

> Dan's comments as he reads the founder brief, plus Kai's responses.
> Session 44, 2026-04-08.
> This will be reviewed as a whole to decide what changes to the UX spec.

---

## Comment 1: Kill the dedicated intake screen

**Dan:** Why can't you just upload and make it appear on the surface, like it already works in the prototype? You have a button to upload, it uploads, it appears. The intake screen only makes sense if there's an IP checkbox before upload. But that's not a separate screen.

**Kai:** Agreed. The UX chain created a separate `/create` intake screen that does: source path choice → upload → suitability check → first preview → accept → create draft. For upload-only MVP, this is over-separation. The prototype already does it right — upload inside the workspace, image appears on the surface, errors inline.

**Decision direction:** Kill the dedicated intake screen. Upload happens inside the draft shell. IP/rights checkbox is a modal on upload, not a screen. Draft exists from the moment the customer enters Create. The "intake screen" concept only becomes relevant later when there are multiple source types (AI generation, imports) that need a chooser.

---

---

## Comment 2: UX chain doesn't know 3D — chain integrity problem

**Dan:** It's weird that UX doesn't know 3D. The goals and user stories must have it. There's an Opus generation somewhere — check if it's better.

**Kai investigated:** Two generations exist:
- **V1 sealed** (GPT-5.4 Pro, March 22) — original chain. 3D only as viewer, not editing surface.
- **Current artifacts** (Track B, April 3) — mixed authorship. Codex generated the bulk of the chain (steps 04-14, content models, overlays). Opus then patched in 3D-specific content as bolt-ons (3D scene brief V2, V3 delta supplement, experience layer, and upgraded steps 08-10 and 12a/12b).

**The problem:** Codex generated the lower chain (task model, content models, UI inventory, MVP skeleton) BEFORE the 3D patches landed. So the content models (which define what the system tracks) and the UI inventory (which defines what components exist) don't know about 3D surface gestures, precision assist, back-side visualization, or cap-specific scenes. The Opus patches are bolted on top of a chain that was generated from pre-3D inputs.

**The 3D knowledge exists in:** 3D scene brief V2, delta supplement, experience layer, vision layer (all Opus). It does NOT exist in: content models, task model, UI inventory, MVP skeleton (all Codex, never upgraded).

**Decision direction:** The proper fix is to regenerate the chain with V3 inputs that include 3D as a core assumption, not as a patch. But that's a UXgen pipeline run, not an architecture task. For now, the architecture should derive from the Opus patches (which are correct) rather than the Codex chain (which is incomplete).

---

## Comment 3: Lots of unnecessary dust in the UX chain

**Dan:** Agrees there's lots of unnecessary complexity. Academic over-specification where simple product behavior would do.

**Kai:** Confirmed. Items 6 (proof record), 8 (readiness frame), 12 (authored feeling), 13 (identity set) are the primary overengineering. The known-good snapshot pattern is premature. The formal experiment/restore model can be replaced with undo.

---

---

## Comment 4: Opus generation exists and is better

**Dan:** There must be another generation — one by Composer (Codex), another by Opus. Find all of them.

**Kai found:** Archived at `4-ux/time-capsule/uxgen-worktree-archive/`. Two full runs exist:
- `create-opus-run/` — Full Opus-generated chain for Create (claude-opus-4-6)
- `create-regen-run/` — Full 7-module regeneration (separate run)

The Opus content model has 10 objects vs Codex's 14. It's cleaner because:
- DesignSession is ONE object (Codex split it into draft + workspace — unnecessary)
- No "proof record" entity — trust handled in flow, not as tracked object
- No "readiness frame" — no manufactured urgency modeling
- No "authored feeling" database record — emotions aren't data
- ShareArtifact handles both private and public (Codex split into two)
- OwnedEffect models post-purchase immutability (Codex missed this entirely)
- Action safety is a cross-cutting flow pattern, not a domain entity

The commit message says "All superseded by manual upgrade in modules/*/artifacts/" — the Codex version + patches was chosen over the Opus version. This may have been a mistake.

**Full generation history found — 4 generations total:**
1. **V1 Sealed** (March 22, GPT-5.4 Pro) — original, pre-3D. Lives in `v1-sealed/`.
2. **Track B** (April 3, Codex) — PR #57. Current `artifacts/` base. 14-object content model. Doesn't know 3D.
3. **Opus Pipeline Run** (April 4, Claude Opus 4.6) — full Create-only run. 10-object model. 3D-native. Cleanest. Archived to `time-capsule/create-opus-run/`.
4. **Regen Run** (April 4, Codex) — full 7-module regen. Worst quality — abstract academic language. Archived to `time-capsule/create-regen-run/`.

**What happened:** After Gen 3 and Gen 4 were produced, someone chose to manually upgrade the Track B (Gen 2) artifacts instead of adopting the Opus run. Sprint UXR-2 (April 5) did manual Opus upgrades on steps 08-10, 12a/12b. Triple audit followed. Both Gen 3 and Gen 4 were archived as "superseded by manual upgrade."

**Current `artifacts/` = Frankenstein:** Codex base (Gen 2) + Opus bolt-ons (3D brief, delta supplement) + manual upgrades (steps 08-10, 12) + audit corrections. The pure Opus run was archived rather than adopted.

**Decision direction:** The Opus content model (Gen 3, 10 objects) should be the starting point for architecture, not the Frankenstein. The architecture domain schemas should derive from the Opus 10-object model.

---

---

## Comment 5: UXgen tool model routing — the real quality problem

**Dan:** Corrected the record. Track B = Codex without inputs. Regen = Composer. Opus = clean run.

**Kai discovered:** The UXgen tool (`llm.ts` lines 166-177) routes steps like this:
- Steps 04-07 (story normalization, activity map, task model, requirements) → **Haiku** (cheapest)
- Steps 08-13 (feature map, flows, interaction arch, content models, patterns, UI inventory) → **Sonnet**
- **Opus is never used by default** — only if step config explicitly requests it

So the Track B artifacts in `artifacts/` were generated by Haiku and Sonnet, not Codex. The "Opus run" was special because it forced Opus for everything.

**The Opus run had ALL proper inputs** (verified from source manifest): 01-intent, 02-user-context, 03-stories, 2.5-personas, 2.6-product-goals, 2.2-product-brief, 2.4-catalog-definition, 3.11-cross-cutting, 3.12-domain-model, 7.1-manufacturing, plus branding and design system. 20 documents total, all verified present.

**Conclusion:** The Opus Create run is the correct, complete, properly-fed generation. The other 6 modules need regeneration with the same input quality and model routing.

---

*More comments to follow as Dan continues reading.*
