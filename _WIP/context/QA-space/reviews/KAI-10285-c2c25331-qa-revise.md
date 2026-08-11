# KAI-10285 QA — REVISE

Exact snapshot: `c2c25331b774ceafe58117ed1990859a6a082f80`

The boundary-crossing erase no longer fragments, and CLASSIC remains selected. It still replaces the entire accepted curved outline with a dense corner polygon: 26 editable nodes become 269. Undo leaves 7,524 canvas pixels different from the pre-erase cut; Redo leaves 448 pixels different from the accepted erased cut.

Source cause: `subtractShape` flattens the complete subject, runs Clipper difference, then reconstructs every surviving point with no Bezier handles. History subsequently prepares from that reconstructed vector rather than the stored exact mask. The current rectangle unit test and `<10,000` outside-pixel browser tolerance cannot detect either failure.

Smallest rework: preserve every non-intersected accepted path segment and handle; create geometry only across the cut boundary. Restore/prep the exact stored erase mask. Freeze node/handle preservation plus exact Undo and Redo in the existing real-route oracle.

Necessity: shrink the whole-subject polygonization and permissive tolerance; no new engine, GrabCut change, UI, provider, or framework.

Sufficiency: partial — local cut and recipe label pass; untouched-main geometry and exact history do not.

Evidence:

- `../evidence/KAI-10285-boundary-base-current.png`
- `../evidence/KAI-10285-boundary-erase-current.png`
- `../evidence/KAI-10285-boundary-erase-current.json`
- `../probes/KAI-10285-boundary-erase.mjs`
