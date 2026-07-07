/**
 * figma-to-code · C1.3 — slot law, EMIT direction (SPEC §3.2 padding row).
 *
 * SAME law as the react-figma engine's read/edit direction (onemo-next
 * `src/app/(dev)/react-figma/engine.ts` — splitSlots/boxSlots/editSlot, ENGINE-PLAN §5):
 * CSS box shorthand minimal form 1→2→4, untouched slots keep their text verbatim.
 * SHARING NOTE (flagged for sprint peer review): the engine lives in the onemo-next repo,
 * this tool in SSOT — until a cross-repo shared package exists, this file mirrors the law
 * with tests asserting the same cases the engine's QA replayed; divergence = round-trip churn.
 */

/** Minimal CSS box shorthand from 4 side TEXTS (top,right,bottom,left) — text equality, not numeric. */
export function minimalBoxShorthand(top, right, bottom, left) {
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  if (right === left) return `${top} ${right} ${bottom}`;
  return `${top} ${right} ${bottom} ${left}`;
}

/** Minimal border-radius from 4 corner TEXTS (tl,tr,br,bl) — same minimization law. */
export function minimalRadiusShorthand(tl, tr, br, bl) {
  if (tl === tr && tr === br && br === bl) return tl;
  if (tl === br && tr === bl) return `${tl} ${tr}`;
  if (tr === bl) return `${tl} ${tr} ${br}`;
  return `${tl} ${tr} ${br} ${bl}`;
}
