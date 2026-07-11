/**
 * text/ — semantic family presentation overlay for the documentation.
 *
 * PILOT SNAPSHOT — hand-assembled from the live Figma file (values pulled 2026-07-11).
 * At DS lock this file becomes a generated output of tools/ds-pipeline (the token
 * converter reads the Figma export and emits this shape); nothing here is edited by hand
 * after that point. Structure mirrors what the converter knows: name, binding chain,
 * per-theme values, behavior class.
 */

export type TokenBehavior =
  | 'adaptive' // follows theme
  | 'inverse' // opposite of theme
  | 'fixed'; // same value both themes

/** Which surface the example renders on — the token's real habitat. */
export type ExampleSurface =
  | 'ground' // the theme app background
  | 'inverse-pill' // surface that flips opposite (black button in light)
  | 'flipping-pill' // brand/black adaptive pill (the flipping black button)
  | 'constant-ink-pill' // always-#071013 pill (chrome, constant black button)
  | 'constant-paper-pill' // always-#fafafa pill
  | 'photo' // product imagery (dark-leaning gradient stand-in)
  | 'photo-light' // light imagery stand-in
  | 'tint'; // the family's own light tint (per-token tintLight/tintDark)

export interface TextToken {
  name: string;
  group: 'max' | 'primary' | 'secondary' | 'neutrals' | 'brand' | 'status';
  behavior: TokenBehavior;
  /** Plain-words role — will live as the Figma variable description at lock. */
  usage: string;
  /** Semantic → alias binding (primitive resolution is the converter's job). */
  binding: string;
  light: string;
  dark: string;
  /** CSS alpha when the binding is an alpha-ladder route. */
  alpha?: number;
  surface: ExampleSurface;
  tintLight?: string;
  tintDark?: string;
}

import { RESOLVED } from './sem-col.resolved';

/** Presentation-only base list; every FACT (binding, values, usage) is overridden
 *  below from the GENERATED Figma pull — the file cannot drift from the design file. */
export const TEXT_FAMILY: TextToken[] = [
  // ── max — pure extremes (#000/#fff · media & absolutes) ─────────────────
  {
    name: 'text/max',
    group: 'max',
    behavior: 'adaptive',
    usage: 'True maximum contrast, follows theme. Absolutes only — UI text uses primary.',
    binding: 'base/black',
    light: '#000000',
    dark: '#ffffff',
    surface: 'ground',
  },
  {
    name: 'text/max-inverse',
    group: 'max',
    behavior: 'inverse',
    usage: 'White in light theme, black in dark — text on surfaces that invert against the theme.',
    binding: 'base/white',
    light: '#ffffff',
    dark: '#000000',
    surface: 'inverse-pill',
  },
  {
    name: 'text/max-dark',
    group: 'max',
    behavior: 'fixed',
    usage: 'Pure black always — text over light imagery (luminance-picked with max-light).',
    binding: 'base/black/l-constant',
    light: '#000000',
    dark: '#000000',
    surface: 'photo-light',
  },
  {
    name: 'text/max-light',
    group: 'max',
    behavior: 'fixed',
    usage: 'Pure white always — photo text. Pairs with scrim/on-image or region-luminance pick.',
    binding: 'base/white/l-constant',
    light: '#ffffff',
    dark: '#ffffff',
    surface: 'photo',
  },

  // ── primary — brand voice (ink #071013 / paper #fafafa · the UI default) ─
  {
    name: 'text/primary',
    group: 'primary',
    behavior: 'adaptive',
    usage: 'The default text — body, headings. Ink in light, paper in dark.',
    binding: 'brand/black',
    light: '#071013',
    dark: '#fafafa',
    surface: 'ground',
  },
  {
    name: 'text/primary-inverse',
    group: 'primary',
    behavior: 'inverse',
    usage: 'Paper in light, ink in dark — the flipping black button.',
    binding: 'brand/white',
    light: '#fafafa',
    dark: '#071013',
    surface: 'flipping-pill',
  },
  {
    name: 'text/primary-dark',
    group: 'primary',
    behavior: 'fixed',
    usage: 'Ink always — text on constant-light surfaces (a pill that stays white in dark).',
    binding: 'brand/black/l-constant',
    light: '#071013',
    dark: '#071013',
    surface: 'constant-paper-pill',
  },
  {
    name: 'text/primary-light',
    group: 'primary',
    behavior: 'fixed',
    usage: 'Paper always — the constant-black button, ink panel, chrome capsules.',
    binding: 'brand/white/l-constant',
    light: '#fafafa',
    dark: '#fafafa',
    surface: 'constant-ink-pill',
  },

  // ── secondary — supporting voice (solid grey + 70% alpha on mono surfaces)
  {
    name: 'text/primary-subtle',
    group: 'secondary',
    behavior: 'adaptive',
    usage: 'Captions, labels, meta — the supporting register on theme surfaces (rename of text/secondary).',
    binding: 'neutral/11',
    light: '#60646c',
    dark: '#b0b4ba',
    surface: 'ground',
  },
  {
    name: 'text/primary-subtle-inverse',
    group: 'secondary',
    behavior: 'inverse',
    usage: '70% paper → 70% ink — supporting text on the flipping black button.',
    binding: 'brand/white/alpha/9',
    light: '#fafafa',
    dark: '#071013',
    alpha: 0.7,
    surface: 'flipping-pill',
  },
  {
    name: 'text/primary-subtle-dark',
    group: 'secondary',
    behavior: 'fixed',
    usage: '70% ink always — supporting text on constant-light surfaces.',
    binding: 'brand/black/l-alpha/9',
    light: '#071013',
    dark: '#071013',
    alpha: 0.7,
    surface: 'constant-paper-pill',
  },
  {
    name: 'text/primary-subtle-light',
    group: 'secondary',
    behavior: 'fixed',
    usage: '70% paper always — supporting text on the constant-black button, chrome.',
    binding: 'brand/white/l-alpha/9',
    light: '#fafafa',
    dark: '#fafafa',
    alpha: 0.7,
    surface: 'constant-ink-pill',
  },

  // ── field neutrals ────────────────────────────────────────────────────────
  {
    name: 'text/disabled',
    group: 'neutrals',
    behavior: 'adaptive',
    usage: 'Unavailable controls. Law: never on selectable options.',
    binding: 'neutral/8',
    light: '#b9bbc6',
    dark: '#5a6169',
    surface: 'ground',
  },
  {
    name: 'text/placeholder',
    group: 'neutrals',
    behavior: 'adaptive',
    usage: 'Input hints — the canon step-9 exception (3.16:1, spent budget, industry floor).',
    binding: 'neutral/9',
    light: '#8b8d98',
    dark: '#696e77',
    surface: 'ground',
  },

  // ── brand colours ──
  {
    name: 'text/brand-primary',
    group: 'brand',
    behavior: 'adaptive',
    usage: 'Blue-green text — links, active labels, the dial numerals.',
    binding: 'brand/1/11',
    light: '#1170a1',
    dark: '#73c4f8',
    surface: 'ground',
  },
  {
    name: 'text/brand-primary-strong',
    group: 'brand',
    behavior: 'adaptive',
    usage: 'High emphasis + the text on brand-primary tints (on-colour law: tint carries own 12).',
    binding: 'brand/1/12',
    light: '#19394d',
    dark: '#c4ecff',
    surface: 'tint',
    tintLight: '#e0eef7',
    tintDark: '#0a293c',
  },
  {
    name: 'text/brand-secondary',
    group: 'brand',
    behavior: 'adaptive',
    usage: 'Lime-moss text. Measured on app bg: 5.14 light / 9.85 dark — body-legal.',
    binding: 'brand/2/11',
    light: '#517700',
    dark: '#98cb46',
    surface: 'ground',
  },
  {
    name: 'text/brand-tertiary',
    group: 'brand',
    behavior: 'adaptive',
    usage: 'Indigo-bloom text. Measured on app bg: 6.75 light / 8.78 dark — body-legal.',
    binding: 'brand/3/11',
    light: '#6940b9',
    dark: '#bda2ff',
    surface: 'ground',
  },


  { name: 'text/brand-primary-subtle', group: 'brand', behavior: 'adaptive', usage: '', binding: '', light: '#000', dark: '#000', surface: 'ground' },
  { name: 'text/brand-primary-inverse', group: 'brand', behavior: 'inverse', usage: '', binding: '', light: '#000', dark: '#000', surface: 'inverse-pill' },
  { name: 'text/brand-primary-dark', group: 'brand', behavior: 'fixed', usage: '', binding: '', light: '#000', dark: '#000', surface: 'ground' },
  { name: 'text/brand-primary-light', group: 'brand', behavior: 'fixed', usage: '', binding: '', light: '#000', dark: '#000', surface: 'tint', tintLight: '#0a293c', tintDark: '#0a293c' },
  { name: 'text/brand-secondary-subtle', group: 'brand', behavior: 'adaptive', usage: '', binding: '', light: '#000', dark: '#000', surface: 'ground' },
  { name: 'text/brand-secondary-inverse', group: 'brand', behavior: 'inverse', usage: '', binding: '', light: '#000', dark: '#000', surface: 'inverse-pill' },
  { name: 'text/brand-secondary-dark', group: 'brand', behavior: 'fixed', usage: '', binding: '', light: '#000', dark: '#000', surface: 'ground' },
  { name: 'text/brand-secondary-light', group: 'brand', behavior: 'fixed', usage: '', binding: '', light: '#000', dark: '#000', surface: 'tint', tintLight: '#202915', tintDark: '#202915' },
  { name: 'text/brand-tertiary-subtle', group: 'brand', behavior: 'adaptive', usage: '', binding: '', light: '#000', dark: '#000', surface: 'ground' },
  { name: 'text/brand-tertiary-inverse', group: 'brand', behavior: 'inverse', usage: '', binding: '', light: '#000', dark: '#000', surface: 'inverse-pill' },
  { name: 'text/brand-tertiary-dark', group: 'brand', behavior: 'fixed', usage: '', binding: '', light: '#000', dark: '#000', surface: 'ground' },
  { name: 'text/brand-tertiary-light', group: 'brand', behavior: 'fixed', usage: '', binding: '', light: '#000', dark: '#000', surface: 'tint', tintLight: '#291d46', tintDark: '#291d46' },

  // ── status ────────────────────────────────────────────────────────────────
  {
    name: 'text/error',
    group: 'status',
    behavior: 'adaptive',
    usage: 'Validation, destructive copy.',
    binding: 'error/12',
    light: '#601f1e',
    dark: '#ffcfcb',
    surface: 'ground',
  },
  {
    name: 'text/warning',
    group: 'status',
    behavior: 'adaptive',
    usage: 'Cautions. Re-bound 11 → 12: the olive 11 was the weakest text in the system.',
    binding: 'warning/12',
    light: '#403f19',
    dark: '#f2f1b3',
    surface: 'ground',
  },
  {
    name: 'text/success',
    group: 'status',
    behavior: 'adaptive',
    usage: 'Confirmations (its 11 measures fine).',
    binding: 'success/11',
    light: '#007d1c',
    dark: '#57d574',
    surface: 'ground',
  },
];

export const GROUP_META: Record<TextToken['group'], { title: string; note: string }> = {
  max: {
    title: 'max — pure extremes',
    note: 'The absolute extremes, for media and edge surfaces. Photo text is the pinned pair, picked by sampled region luminance or seated on the image scrim.',
  },
  primary: {
    title: 'primary — brand voice',
    note: 'The brand ink and paper — the UI default voice. Naming law: a bare name follows the theme; -inverse opposes it; -dark and -light pin one of the voices so it never flips.',
  },
  secondary: {
    title: 'primary-subtle — the supporting register',
    note: 'The quiet register of the primary voice: -subtle quiets a family the way -strong amplifies it. Solid neutral on theme surfaces; on mono surfaces the transparency ladder, self-adapting over any fill.',
  },
  neutrals: { title: 'field neutrals', note: 'Disabled and placeholder — the input-field voices, deliberately below the reading tiers.' },
  brand: {
    title: 'brand colours',
    note: 'Colour used deliberately: each brand colour carries the same behavior pack — a quiet decorative register, an inverse, and the two pinned voices.',
  },
  status: { title: 'status', note: 'Functional colours, not accents — validation, caution, confirmation. Each binds the step of its family that reads as text.' },
};

/** The 15 removals — recorded so migrating consumers know their target. */
export const REMOVED: { name: string; to: string; visible?: string }[] = [
  { name: 'text/tertiary', to: 'text/primary-subtle' },
  { name: 'text/quaternary', to: 'text/primary-subtle' },
  { name: 'text/secondary-hover', to: 'text/primary' },
  { name: 'text/tertiary-hover', to: 'text/primary' },
  { name: 'text/brand-secondary (old — was a blue dupe)', to: 'text/brand-primary', visible: 'NAME REUSED: brand-secondary now = lime-moss' },
  { name: 'text/brand-tertiary (old — was a blue dupe)', to: 'text/brand-primary', visible: 'NAME REUSED: brand-tertiary now = indigo-bloom' },
  { name: 'text/brand-secondary-hover', to: 'text/brand-primary-strong' },
  { name: 'text/brand-tertiary-alt', to: 'text/brand-primary-strong' },
  { name: 'text/error-primary-hover', to: 'text/error' },
  { name: 'text/white', to: 'text/max-light' },
  { name: 'text/tertiary-on-brand', to: 'text/primary-subtle-light' },
  { name: 'text/quaternary-on-brand', to: 'text/primary-subtle-light' },
  { name: 'text/secondary-on-brand', to: 'text/primary-subtle-light', visible: 'was blue-on-blue (illegible)' },
  { name: 'text/primary-on-brand', to: 'text/primary-light' },
  { name: 'text/placeholder-subtle', to: 'text/placeholder', visible: 'was 1.5:1 border colour as text' },
];

// ── override facts from the generated pull (Figma is the source of truth) ──
for (const t of TEXT_FAMILY) {
  const r = RESOLVED.tokens.find((x) => x.name === t.name);
  if (!r) { t.usage = '⚠ NOT IN FIGMA PULL — ' + t.usage; continue; }
  t.binding = r.binding;
  t.light = r.L.slice(0, 7);
  t.dark = r.D.slice(0, 7);
  if (r.L.length === 9) t.alpha = parseInt(r.L.slice(7), 16) / 255;
  const desc = r.description.replace(/^🔒[^—]*— /, '').replace(/ ?NOTE: name reused[^]*$/, '');
  if (desc) t.usage = desc;
}
