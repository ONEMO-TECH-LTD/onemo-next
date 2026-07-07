// Canonical inspector-field census (KAI-9383) — the ONE extractor run in BOTH the live Figma web
// console AND our build, so field anatomy is pulled from the source of truth, never hand-measured.
// Dan's mandate 2026-07-07: "build the audit tool that takes values from the figma web console and
// matches against our code." This is that extractor; figma-parity.mjs diffs the two dumps.
//
// Usage (in either tab's console, or injected via the browser bridge):
//   copy(JSON.stringify(figmaCensus()))        // → paste into figma-census.json / build-census.json
//
// It climbs to the FIELD BOX (the radius-bearing container) and captures the FULL visual anatomy —
// crucially border AND outline AND box-shadow together, because Figma draws the X/Y field edge with
// an `outline` (not a border), which a border-only census silently missed (the 20:52 regression).
(function () {
  function fieldBox(input) {
    let c = input.parentElement;
    for (let k = 0; k < 6 && c; k++) {
      const s = getComputedStyle(c);
      if (s.borderRadius !== '0px' && s.borderRadius !== '') return c; // the rounded field capsule
      c = c.parentElement;
    }
    return input.parentElement;
  }
  function anatomy(input) {
    const s = getComputedStyle(input);
    const box = fieldBox(input);
    const bs = getComputedStyle(box);
    const r = box.getBoundingClientRect();
    // edge = whichever of border / outline / inset-shadow actually draws the visible 1px rule
    const border = bs.borderTopStyle !== 'none' && parseFloat(bs.borderTopWidth) > 0 ? `${bs.borderTopWidth} ${bs.borderTopColor}` : null;
    const outline = bs.outlineStyle !== 'none' && parseFloat(bs.outlineWidth) > 0 ? `${bs.outlineWidth} ${bs.outlineColor}` : null;
    const shadow = bs.boxShadow && bs.boxShadow !== 'none' ? bs.boxShadow : null;
    return {
      value: input.value,
      // text
      fontFamily: s.fontFamily.split(',')[0].replace(/["']/g, ''),
      fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing === 'normal' ? '0px' : s.letterSpacing,
      ink: s.color,
      // box
      bg: bs.backgroundColor, radius: bs.borderRadius,
      edge: border || outline || shadow || 'none',   // the visible field-edge rule, however it's drawn
      height: Math.round(r.height),
    };
  }
  function census() {
    // right-hand inspector only (Figma: right of 60% width; our build: the last <aside>)
    const scope = document.querySelector('aside:last-of-type') || document.body;
    const inputs = [...document.querySelectorAll('input[aria-label]')].filter((i) => {
      const rc = i.getBoundingClientRect();
      return rc.width > 0 && rc.height > 0 && i.type !== 'checkbox' && i.type !== 'color'
        && (scope.contains(i) || rc.left > window.innerWidth * 0.6);
    });
    const out = {};
    for (const i of inputs) {
      const label = i.getAttribute('aria-label');
      if (label && !out[label]) out[label] = anatomy(i);
    }
    return { at: new Date().toISOString().slice(0, 19), href: location.host, fields: out };
  }
  window.figmaCensus = census;
})();
