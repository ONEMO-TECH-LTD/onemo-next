# Grid Engine Contract

Status: authoritative checklist for the next engine iteration  
Authority: Dan's verbatim [`grid-brief.md`](./grid-brief.md) and [`grid-laws.md`](./grid-laws.md)  
Use: this checklist validates conformance to Dan's original intent. Builder implements every applicable item. QA and Meta independently return a result against every ID. Unchecked, silent or inferred means undelivered.

## 0. Checklist evidence protocol

- [ ] **EC-0.1** Every applicable contract ID receives an explicit `PASS` or `FAIL`; no item is omitted.
- [ ] **EC-0.2** `PASS` means the checkpoint was positively confirmed against current source or the live applied surface.
- [ ] **EC-0.3** Every `PASS` cites reproducible evidence: test/oracle name or live interaction, artifact path, and exact frozen snapshot.
- [ ] **EC-0.4** A builder claim, prior screenshot or another reviewer's verdict cannot be inherited as confirmation.
- [ ] **EC-0.5** `NOT APPLICABLE` is permitted only for an item explicitly excluded by this contract and must cite that exclusion ID.
- [ ] **EC-0.6** Any `FAIL`, omitted item or unsupported `PASS` makes the complete deliverable `NOT CLEAR`.
- [ ] **EC-0.7** QA validates every ID for technical correctness and direct evidence.
- [ ] **EC-0.8** Meta validates every ID for original-intent fidelity, necessity, sufficiency and final deliverable completeness.

## 1. Mission conditions

- [ ] **EC-1.1** Given a traced cutout and guarded grid specification, the engine returns every lawful grid-and-shape match in bands 2, 3 and 4.
- [ ] **EC-1.2** The engine determines the manufactured size and magnet coordinates. Shape size is not an engine input.
- [ ] **EC-1.3** The result is proved by applying it to the real cutout. A numeric `fits` result alone is inconclusive.
- [ ] **EC-1.4** The iteration ends with an evidence-backed verdict: keep the complete algorithm, keep named parts and fix named parts, or reject it.

## 2. Input specification

- [ ] **EC-2.1** Input: one closed traced cutout outline.
- [ ] **EC-2.2** Input: guarded base-lattice pitch.
- [ ] **EC-2.3** Input: selected 48mm or 96mm population pitch.
- [ ] **EC-2.4** Input: guarded 12mm magnet padding radius.
- [ ] **EC-2.5** Input: released field ceiling expressed as a 9×9 grid count, never a millimetre constant.
- [ ] **EC-2.6** Input: centre method under test.
- [ ] **EC-2.7** Input: bands 2, 3 and 4.
- [ ] **EC-2.8** Forbidden input: target size, known answer, shape name, fixture-specific threshold or hidden default.

## 3. Shape and manufacturing laws

- [ ] **EC-3.1** The cutout outline and aspect ratio remain locked.
- [ ] **EC-3.2** Uniform scale is the only shape transform.
- [ ] **EC-3.3** The engine never deforms, independently scales axes, rotates, redraws, smooths, erodes or offsets the outline.
- [ ] **EC-3.4** One SVG unit equals one millimetre.
- [ ] **EC-3.5** Every selected magnet requires its complete 24mm support disc to lie on material.
- [ ] **EC-3.6** Magnet-centre containment without full-disc containment fails.
- [ ] **EC-3.7** The smallest offered population is one centred pair. Silent size 1 exists internally but is never offered.
- [ ] **EC-3.8** All answers publish at lawful even-millimetre steps.
- [ ] **EC-3.9** No tolerance, epsilon, probe resolution or threshold without named authority may affect an answer.

## 4. Lattice and band laws

- [ ] **EC-4.1** The 96mm population only hides points from the 48mm lattice.
- [ ] **EC-4.2** Switching 48mm/96mm never shifts the lattice, camera or shape.
- [ ] **EC-4.3** Band 2 has two positions per axis and centres between magnets.
- [ ] **EC-4.4** Band 3 has three positions per axis and centres on a magnet.
- [ ] **EC-4.5** Band 4 has four positions per axis and centres between magnets.
- [ ] **EC-4.6** Law 9.3a's accepted 96mm asymmetry is preserved; no symmetry correction moves the surviving population.
- [ ] **EC-4.7** The engine evaluates bands independently in order: 2, then 3, then 4.
- [ ] **EC-4.8** If one band has no lawful match, the engine continues to the next band and reports why the earlier band failed.

## 5. Required band search

- [ ] **EC-5.1** The outline bounding box establishes the starting band and starting scale.
- [ ] **EC-5.2** The engine evaluates every publishable even-millimetre scale inside each band's range.
- [ ] **EC-5.3** At every scale, the engine evaluates every distinct lawful lattice placement permitted by the field and registration rules.
- [ ] **EC-5.4** The engine discovers arrangements from supported lattice points without classifying the outline by shape name.
- [ ] **EC-5.5** The search includes a centred vertical 1×2 pair when supported.
- [ ] **EC-5.6** The search includes a centred horizontal 2×1 pair when supported.
- [ ] **EC-5.7** The search includes a centred 2×2 arrangement when supported.
- [ ] **EC-5.8** The search includes rectangular populations available inside the band.
- [ ] **EC-5.9** The search includes material-derived partial populations, including three-point L arrangements, when supported.
- [ ] **EC-5.10** The search includes larger populations made possible by later steps and bands.
- [ ] **EC-5.11** A candidate fails when any selected magnet lacks its complete support disc.
- [ ] **EC-5.12** A candidate fails when the top is unsupported.
- [ ] **EC-5.13** A candidate fails when a materially significant side remains as an asymmetric flap.
- [ ] **EC-5.14** The engine records every lawful candidate and never stops at the first physical fit.
- [ ] **EC-5.15** The engine never silently selects a winner.
- [ ] **EC-5.16** A candidate is distinct when its magnet set, registration, centre method, population pitch or published size differs.

## 6. Candidate output specification

Every returned candidate must contain:

- [ ] **EC-6.1** Band.
- [ ] **EC-6.2** Published shape size and resulting width × height.
- [ ] **EC-6.3** Uniform scale.
- [ ] **EC-6.4** Centre method and computed centre.
- [ ] **EC-6.5** Population pitch.
- [ ] **EC-6.6** Registration.
- [ ] **EC-6.7** Complete magnet coordinate list.
- [ ] **EC-6.8** Magnet quantity and arrangement extents.
- [ ] **EC-6.9** Minimum support clearance.
- [ ] **EC-6.10** Binding magnet and outline edge that set the size.
- [ ] **EC-6.11** Per-side and per-cell material coverage.
- [ ] **EC-6.12** Top-support result.
- [ ] **EC-6.13** Uncovered-area or flap measure.
- [ ] **EC-6.14** Separate symmetry and balance measures.
- [ ] **EC-6.15** Exact rejection reason for a rejected candidate or band.
- [ ] **EC-6.16** Raw measures remain separate until visual testing settles precedence.
- [ ] **EC-6.17** No combined score, default centre method or automatic winner is invented.

## 7. Applied visual-proof deliverables

- [ ] **EC-7.1** Every candidate can be applied to the actual traced cutout in the admin canvas.
- [ ] **EC-7.2** Applied geometry uses the candidate's exact uniform scale.
- [ ] **EC-7.3** Applied geometry uses the candidate's exact centre.
- [ ] **EC-7.4** Applied geometry uses the candidate's exact registration.
- [ ] **EC-7.5** Applied geometry uses the candidate's exact lattice coordinates.
- [ ] **EC-7.6** Applied geometry uses the candidate's exact 48mm or 96mm population.
- [ ] **EC-7.7** Applied geometry draws complete 24mm support discs.
- [ ] **EC-7.8** The canvas exposes band, size, magnet count, centre method, coverage, balance and binding/rejection explanation.
- [ ] **EC-7.9** Independently measured canvas geometry numerically reproduces the engine answer.
- [ ] **EC-7.10** Dan can browse every candidate in a band and compare bands without retracing the cutout.
- [ ] **EC-7.11** Candidate browsing performs no solver recomputation.

## 8. Architecture and performance limitations

- [ ] **EC-8.1** All computation lives in the engine.
- [ ] **EC-8.2** The logic/bridge holds values and carries engine answers; it performs no mathematics.
- [ ] **EC-8.3** The admin shell performs screen interaction and presentation only.
- [ ] **EC-8.4** Pinch performs no solver work.
- [ ] **EC-8.5** Resize performs no solver work.
- [ ] **EC-8.6** Pan and canvas drag perform no solver work.
- [ ] **EC-8.7** Camera movement performs no solver work.
- [ ] **EC-8.8** Solver work starts only when the outline or a governing grid input changes.
- [ ] **EC-8.9** Results are cached by outline and complete grid specification.
- [ ] **EC-8.10** Heavy computation runs outside the browser's main UI thread.
- [ ] **EC-8.11** The interface remains responsive while a solve is running.
- [ ] **EC-8.12** Mobile Safari is the performance gate; desktop success alone fails.
- [ ] **EC-8.13** The iteration records solve duration, long tasks, peak memory and interaction latency on iPhone-class Safari.
- [ ] **EC-8.14** No numeric performance budget is invented. Measurements are returned for Dan's ruling.

## 9. Required real-cutout deliverables

Each cutout must be traced, solved, applied and captured at 48mm and 96mm across bands 2, 3 and 4:

- [ ] **EC-9.1** BAT-WOMAN.
- [ ] **EC-9.2** BOT.
- [ ] **EC-9.3** BUTTERFLY.
- [ ] **EC-9.4** DUCK.
- [ ] **EC-9.5** PILL.
- [ ] **EC-9.6** POKE1.
- [ ] **EC-9.7** POKE2.

## 10. Required synthetic attacks

- [ ] **EC-10.1** Symmetric convex control verifies arithmetic only.
- [ ] **EC-10.2** Tall sliver demonstrates a lawful 1×2 pair.
- [ ] **EC-10.3** Wide sliver demonstrates a lawful 2×1 pair.
- [ ] **EC-10.4** Asymmetric concave L demonstrates material-derived partial population.
- [ ] **EC-10.5** Hollow C or ring attacks centres that land outside material.
- [ ] **EC-10.6** Deep notch or separated-looking limbs attack non-monotonic legality.
- [ ] **EC-10.7** Winding reversal produces identical candidates.
- [ ] **EC-10.8** Transparent image margins cannot change computed/applied identity.
- [ ] **EC-10.9** A no-answer fixture is proved inside the 9×9 ceiling.
- [ ] **EC-10.10** Padding mutation re-derives every answer.
- [ ] **EC-10.11** Pitch mutation re-derives every answer.
- [ ] **EC-10.12** Field-count mutation re-derives every answer.
- [ ] **EC-10.13** Invalid centre method fails loudly.
- [ ] **EC-10.14** Squares and circles are never presented as proof of the free-shape mission.

## 11. Algorithm-proof acceptance

- [ ] **EC-11.1** An independent oracle finds no missing candidate defined by §5.
- [ ] **EC-11.2** The independent oracle finds no invented candidate.
- [ ] **EC-11.3** Every accepted disc is fully supported at the published size.
- [ ] **EC-11.4** Every rejection names the violated contract item.
- [ ] **EC-11.5** Scaling and transparent margins cannot separate computed and applied geometry.
- [ ] **EC-11.6** Every real cutout has an applied visual record for every returned candidate.
- [ ] **EC-11.7** Visual records expose coverage and balance, not only containment.
- [ ] **EC-11.8** Slim pair arrangements are visibly demonstrated.
- [ ] **EC-11.9** An adversarial concave fixture proves legality may appear and later disappear as scale changes.
- [ ] **EC-11.10** The final evidence names what survived, what failed and whether the complete algorithm is a keeper.

## 12. Existing findings that must close

- [ ] **EC-12.1** Regenerate or explain the DUCK band-3 maximum-clearance live/report mismatch.
- [ ] **EC-12.2** Regenerate or explain the BUTTERFLY band-2 maximum-clearance live/report mismatch.
- [ ] **EC-12.3** Remove the authorless chained `/2/2/2/2` probe precision.
- [ ] **EC-12.4** Derive or source the precision rule.
- [ ] **EC-12.5** Make the structural guard detect equivalent chained-literal spellings.

## 13. Decisions the engine may not invent

- [ ] **EC-13.1** Centre methods remain comparable options until real evidence supports a product choice.
- [ ] **EC-13.2** Coverage and symmetry/balance remain separate until their precedence is ruled.
- [ ] **EC-13.3** Numeric bounding-box thresholds separating band ranges require evidence and Dan's ruling.
- [ ] **EC-13.4** The mobile performance budget requires measurements and Dan's ruling.

## 14. Explicit limitations and exclusions

- [ ] **EC-14.1** No production Cutout Lab integration in this iteration.
- [ ] **EC-14.2** No product default or automatic winner.
- [ ] **EC-14.3** No rotation behavior.
- [ ] **EC-14.4** No cutout-outline modification.
- [ ] **EC-14.5** No manufacturing export.
- [ ] **EC-14.6** No admin-shell redesign beyond applied visual comparison.

## 15. Closing deliverables

- [ ] **EC-15.1** Builder supplies one frozen snapshot.
- [ ] **EC-15.2** Builder supplies a checklist showing evidence for every EC item.
- [ ] **EC-15.3** QA independently audits source, oracle results, performance and live applied geometry.
- [ ] **EC-15.4** Meta independently reruns the suite, synthetic attacks and all seven real cutouts.
- [ ] **EC-15.5** QA and Meta cite the exact serving tree and commit.
- [ ] **EC-15.6** Necessity verdict states `no unnecessary elements` or exact shrink required.
- [ ] **EC-15.7** Sufficiency verdict states `delivers EC-1.1 through EC-15.6 in full` or lists every missing ID.
- [ ] **EC-15.8** The algorithm receives no keeper verdict until every applicable item above is checked with reproducible evidence.
- [ ] **EC-15.9** The final deliverable contains a conformance matrix with columns: contract ID, `PASS`/`FAIL`/`NOT APPLICABLE`, evidence, independently observed result, reviewer, and frozen snapshot.
- [ ] **EC-15.10** QA positively confirms every applicable checkpoint in its own conformance matrix.
- [ ] **EC-15.11** Meta positively confirms every applicable checkpoint in its own conformance matrix.
- [ ] **EC-15.12** The final verdict explicitly states whether the complete algorithm conforms to Dan's original intent; a technical test summary alone is insufficient.
- [ ] **EC-15.13** `CLEAR` is valid only when every applicable checkpoint has a positively evidenced `PASS` from both QA and Meta.
