# Chief-QA review — Framer parity COMPLETION CONTRACT v1

**Verdict: CONTRACT-REWORK before AC freeze or builder dispatch.** The replacement is materially better than HARD-CONTRACT-v0: it states Dan's full-product law, restores the three wrongly narrowed capabilities, rejects phase-level closure, and requires human-visible proof. It is not yet a safe completion authority.

Reviewed in full: `s58-framer-parity-COMPLETION-CONTRACT-v1.md` 101/101 lines against the locked minimum bar, raw Framer extraction, HARD-CONTRACT-v0, and exact `8d64fd3` source/runtime audit.

## Blocking accuracy defects

1. **B3 is falsely green.** The shipped Components menu disables Rename and the current semantic authoring command surface has no component-rename command. Even if an older server op exists, completion law requires an operable UI plus visible proof. B3 must be `✗` or `◐`, never `✅`.
2. **A4 and C2 violate the contract's own DONE law.** Both are `✅` without recorded human-operable proof. Downgrade to `◐` until the proof column is populated and independently accepted.
3. **C1 bundles a failure inside a green row.** “create/rename/move ✅; delete ✗” cannot have one `✅` status. Split delete-variant into its own row, including in-use guard/consumer behavior.
4. **B5 misclassifies Copy Import.** Copy Import is currently operable; Copy URL and Library are absent. Split them so one working command cannot mask two missing ones—or be erased by their shared `✗`.
5. **A2 acceptance does not cover the actual bug.** “ANY project component” ignores the shipped global-only inventory. Split project-component entry, global-library behavior, and inventory reachability. Blank-create removal removed the alternate path; it did not itself cause global double-click to fail.

## Missing product rows

6. **Component-content editing is absent from the scoreboard.** The current canvas only moves/renames variant frames; component internals cannot be selected or edited and the component inspector is hidden. Add explicit end-to-end rows for selection/editing of component internals and persistence.
7. **Framer's component Style inspector is absent.** Raw extraction includes Link; Position & Size; Layout; Effects; Overlays; Cursor; Styles/Transition/Opacity/Visible/Fill/Overflow/Radius. Props E1–E5 do not cover this surface. Each supported editor function needs a source-exact parity row or an explicit Dan decision to exclude it.
8. **Blank create acceptance is under-specified.** Locked A1 requires name + Project/Global + category, real file, gallery/library appearance without reload hacks. B2 only says “named blank component.”
9. **Library organization is under-specified.** Add category move and Project↔Global move with file move, barrel regeneration, and consumer import rewrite; add the dedicated Components rail and Assets-components removal as scored invariants.
10. **Instance behavior is incomplete.** Add the observed instance `Trigger` and `Edit Component` surfaces; distinguish Go to main component from editing it. Initial instance creation already exists and must remain classified `◐ foundation`, not erased.
11. **Component manage commands are over-bundled.** Duplicate, guarded Delete, Find, Copy Import, Copy URL, Library move, and Insert are independently operable and independently fail-able. One B4/B5 status can conceal partial delivery.
12. **Folder behavior is over-bundled.** New Component, New Folder, nesting/move, rename/delete, and sort need separate acceptance if the row is meant to be closeable without ambiguity.

## Traceability defects

13. Line 16 promises `Linear ID`, `source proof`, and `human-visible proof` for every row, but the table has only Capability/Acceptance/Status/Owner. Add the promised columns now; do not defer the mapping to prose at line 101.
14. A–J section issues are not automatically 1:1 row traceability. If several rows share one issue, repeat the ID per row and keep per-row checkboxes/proofs; otherwise create atomic issues.
15. V1–V10 and S1–S9 remain unnamed references. Embed their definitions or map each explicitly to the v0 clause and to each affected row. `J2 · per-surface` is not auditable acceptance.
16. J3–J5 are gates, not statuses. Every capability row needs explicit reload/persistence/undo applicability, source commit, visible artifact/session, QA verdict, Meta verdict, and Dan sign field. “partial” and “GATE” are not in the stated status legend.

## Anti-invention corrections

17. A3's “~28px, icons” is not supported by the extracted Framer breadcrumb evidence (`Home › Component`) unless a measured live re-probe supplies it or Dan explicitly chooses it as the Figma adaptation. Do not turn a cosmetic suggestion into parity law without provenance.
18. E2's image/link “phase-2” is acceptable only as sequencing, not exclusion. The final scoreboard must retain them as required rows if Dan's full-set law stands.
19. The document says every capability comes from live Framer + compiled code, but several `⧗` rows have no frozen AC. Those must remain non-dispatchable until expert evidence lands and QA reviews it.

## Gate

Two possible paths:

1. **Recommended:** correct the classifications, atomize the bundled rows, add the missing component-content/inspector/organization/instance rows, populate traceability columns, then send v1.1 to Chief-QA + expert before Dan signs.
2. Freeze v1 as written, which knowingly permits false closure and therefore conflicts with Dan's full-Framer product law.

No product build should start from v1 as currently written.
