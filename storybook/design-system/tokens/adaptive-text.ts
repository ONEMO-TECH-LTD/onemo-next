/**
 * Adaptive accessible text — ONE algorithm for imagery and coloured surfaces.
 *
 * The agreed law (DS v2.3.2, 2026-07-11):
 *   · text on an IMAGE   → sample region luminance → text/max-light on dark, text/max-dark on light
 *   · text on a COLOUR   → the family speaks for itself: own step-12 dark voice (L12) on light steps,
 *                          own step-12 light voice (D12) on deep steps, neutral white/ink fallback
 *                          for the few mid-tone dips (brand-primary/10 is the palette's one large-only cell)
 *
 * Both are the same computation: measure the surface, walk a preference-ordered
 * candidate list, take the first candidate that passes WCAG body text (4.5:1);
 * if none passes, take the best and flag it large-only (3.0:1, ≥24px / ≥19px bold).
 *
 * Ramp values below were live-pulled from the Figma file 2026-07-11; at DS lock
 * they come from the ds-pipeline converter output instead.
 */

export function relLuminance(hex: string): number {
  const n = hex.replace('#', '');
  const f = (x: number) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * f(parseInt(n.slice(0, 2), 16)) +
    0.7152 * f(parseInt(n.slice(2, 4), 16)) +
    0.0722 * f(parseInt(n.slice(4, 6), 16))
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export interface TextPick {
  token: string;
  hex: string;
  ratio: number;
  /** true = passes 4.5:1 body text; false = best available, large-only (≥3.0). */
  body: boolean;
}

/** Walk candidates in preference order; first body-pass wins, else best-ratio large-only. */
export function pickAccessibleText(
  surfaceHex: string,
  candidates: { token: string; hex: string }[],
): TextPick {
  let best: TextPick | null = null;
  for (const c of candidates) {
    const ratio = contrastRatio(surfaceHex, c.hex);
    if (ratio >= 4.5) return { ...c, ratio, body: true };
    if (!best || ratio > best.ratio) best = { ...c, ratio, body: false };
  }
  return best as TextPick;
}

/** Text on imagery: the max pair, luminance decides. */
export function pickOnImage(regionHexes: string[]): TextPick {
  const luma = regionHexes.reduce((s, h) => s + relLuminance(h), 0) / regionHexes.length;
  const surface = luma < 0.4 ? '#000000' : '#ffffff'; // representative ground for ratio reporting
  void surface;
  const mean = regionHexes[Math.floor(regionHexes.length / 2)] ?? regionHexes[0];
  return pickAccessibleText(mean, [
    ...(luma < 0.4
      ? [{ token: 'text/max-light', hex: '#ffffff' }, { token: 'text/max-dark', hex: '#000000' }]
      : [{ token: 'text/max-dark', hex: '#000000' }, { token: 'text/max-light', hex: '#ffffff' }]),
  ]);
}

/** Family ramp anchors (Light/Dark) — live-pulled 2026-07-11; converter-fed at lock. */
export const FAMILY_RAMPS: Record<
  string,
  { alias: string; steps: Record<'3' | '9' | '12', { L: string; D: string }> }
> = {
  'brand-primary': {
    alias: 'blue-green',
    steps: { '3': { L: '#deeef9', D: '#0a293c' }, '9': { L: '#378cbe', D: '#378cbe' }, '12': { L: '#19394d', D: '#c4ecff' } },
  },
  'brand-secondary': {
    alias: 'lime-moss',
    steps: { '3': { L: '#e1f3cc', D: '#202915' }, '9': { L: '#8cbe37', D: '#8cbe37' }, '12': { L: '#304215', D: '#d0eeab' } },
  },
  'brand-tertiary': {
    alias: 'indigo-bloom',
    steps: { '3': { L: '#edeafa', D: '#291d46' }, '9': { L: '#6837be', D: '#6837be' }, '12': { L: '#372163', D: '#e3dcff' } },
  },
  error: {
    alias: 'tomato-jam',
    steps: { '3': { L: '#f7e6e4', D: '#3e0e0e' }, '9': { L: '#bf373a', D: '#bf373a' }, '12': { L: '#601f1e', D: '#ffcfcb' } },
  },
  warning: {
    alias: 'golden-glow',
    steps: { '3': { L: '#f7f6a4', D: '#262610' }, '9': { L: '#d8d33e', D: '#d8d33e' }, '12': { L: '#403f19', D: '#f2f1b3' } },
  },
  success: {
    alias: 'jade-green',
    steps: { '3': { L: '#def2e0', D: '#182a1b' }, '9': { L: '#37bf5d', D: '#37bf5d' }, '12': { L: '#143f1e', D: '#b5f4be' } },
  },
};

/**
 * Text on a coloured surface: colour-native first (the family's own 12 voices),
 * neutral white/ink only as fallback for mid-tone dips.
 */
export function pickOnColour(family: string, surfaceHex: string): TextPick {
  const ramp = FAMILY_RAMPS[family];
  return pickAccessibleText(surfaceHex, [
    { token: `${family}/12 (dark voice)`, hex: ramp.steps['12'].L },
    { token: `${family}/12 (light voice)`, hex: ramp.steps['12'].D },
    { token: 'max-light', hex: '#ffffff' },
    { token: 'primary ink', hex: '#071013' },
  ]);
}
