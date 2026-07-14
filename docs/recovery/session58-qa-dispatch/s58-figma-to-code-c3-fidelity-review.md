# figma-to-code · C3 fidelity bug-fix — QA (node-matrix + visual required)

**From:** Kai (@s58-expert). **Report findings to:** @s58-expert. **Do NOT** loop the designer.
**Branch:** `session58-task/figma-to-code-converter` · **Sprint:** KAI-9337
**Backup tag:** `c2-backup-pre-c3-bugfix` @ `23ba592`
**Commits under review:** `def0067` (fixes) · `c9d639e` (deslop/SPEC) · `a7e832c` (audit tool).
**Golden mother screen:** `4084:25997` (Components+ → LOCKED, "Editor 402 iphone – apple blur glass").

## Audit method REQUIRED (Dan's C3 standard — both must be used)
1. **Node-by-node anatomy matrix:** `node audit/anatomy.mjs <outDir> cache/t88thL8hKksSpILgkeGRZ0-4084-25997.nodes.json <app tokens.css>` → per-node Figma props ↔ emitted CSS/React. See `audit/README.md`.
2. **Visual side-by-side:** Figma REST render (`/v1/images`) vs the converted screen rendered inside a `container-type` context (real `s58-converted` route preferred; shim caveat in README — stroked-SVG-in-flex collapses in a raw-HTML shim, a shim artifact not a converter bug).

## Bugs fixed — verify each via the matrix + visual (don't trust; re-derive)
- **C3.1 rotation radians→degrees.** Figma REST `rotation` is radians (±1.5708 = ±90°); was emitted as `rotate(1.57deg)` (dropped). Now `deg = -rad×180/π` in `emit.mjs` (declsFor + svg) + `reverse.mjs` geomOf. Golden: `rotate(±90deg)` ×4. **Verify it's correct, not just self-consistent between emit+reverse** — check a rotated glass button visually points right.
- **C3.2 stroke refusals flipped (refusals 1→0).** Rectangle 49's 10px gradient stroke (black→gray card border) was refused → now converts: rounded node → `border: 10px solid #333333` (avg gradient color, respects radius); square node → `border-image: <gradient> 1`; CENTER → box-shadow ring. **Open question for lead:** is the solid-avg approximation acceptable for rounded gradient borders, or should we invest in the background-clip technique for the exact gradient? (border-image can't follow border-radius.)
- **C3.3 container-type on root frame** (frame=viewport) so fluid `cqi` tokens resolve standalone. Golden root: `container-type: inline-size`.
- **C3.4** image object-fit mapping verified correct (no change needed).

## Known residuals (not regressions — confirm scope)
- Dial icons render empty in a raw-HTML shim (svg-in-flex width:0) — verified NOT a converter bug (svg valid, renders in isolation + real app per C1). Confirm in a real route if you can.
- Rounded gradient border = solid-avg approximation (exact-gradient-with-radius is a background-clip follow-up).

## Gate state @ HEAD
30/30 tests · census/canon/reverse/conformance OK · **refusals 0** · determinism byte-identical · coverage 77% unresolved 0.

## Review asks
**@s58-lead (meta):** run the anatomy matrix — is any Figma property still dropped/mis-mapped in the emitted CSS? Is rotation faithful (visual)? Is the solid-avg rounded-border call right or should it be exact-gradient? SPEC == code?
**@s58-meta-qa (Codex, adversarial):** mutation battery on `check` still fails loudly (rotation/geometry/canon/census); confirm rad→deg is objectively correct (compute a known node); determinism; hunt via the anatomy for any node where emitted CSS ≠ Figma value.

Findings → @s58-expert. Fold → re-route until clean, then Dan.

---
## REWORK FOLDED → frozen HEAD `288e2cd` (re-audit here)

- **Codex F1 HIGH (imageTransform)** — FIXED: ir carries the matrix; emit reproduces the crop exactly
  (`background-size: 104.44% 139.51%; background-position: 50% 27.25%` on Rectangle 49, derived from
  [[0.9575,0,0.0213],[0,0.7168,0.0772]]); non-identity leaf → background-image path (not <img>);
  reverse mirrors the identity condition. Verified visually on the REAL route (:3077) — dome crop matches Figma.
- **Live find (neither reviewer had it): flex-shrink law** — Figma never shrinks auto-layout children;
  CSS flex does. The 402px dial row squeezed 9×48px dials to 34px pills. Non-FILL flex children now get
  `flex-shrink: 0` (×43 golden). Dials render as circles WITH icons in the live route.
- **Codex F2 MED (gate hardening)** — reverse now diffs container-type (root), border (full stroke-law
  mirror incl. gradient-avg), flex-shrink. Your two probes (remove container-type; recolor border) now exit 1.
- **lead MED + Codex F3 (SPEC)** — REFUSED list fixed (CENTER/gradient strokes removed); new
  APPROXIMATIONS category in SPEC §4 + CONFORMANCE.md; the gradient→avg flatten is now a visible
  report entry (lead's condition satisfied): `approximations: 1` on golden.

Gate state @ 288e2cd: 30/30 · census/canon/reverse/conformance OK · refusals 0 · approximations 1 ·
determinism byte-identical · REAL React route renders + visual side-by-side matches (compare_real2).
Re-run your probes at this HEAD. Findings → @s58-expert.
