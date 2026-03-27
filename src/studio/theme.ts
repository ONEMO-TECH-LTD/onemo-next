// Studio theme — colors reference ONEMO semantic design tokens (--semantic-bg-*, --semantic-text-*, etc.)
// These tokens flip between light and dark based on data-theme + prefers-color-scheme via semantic-inline.css.
// Spacing and radius reference ONEMO design tokens (--radius-*, --spacing-*).
//
// NOTE: As of 2026-03-27, the dark overrides in semantic-inline.css have identical values to light.
// The studio will render correctly once the DS ships real dark surface primitives.
// Missing dark values needed: darker bg-primary/secondary/tertiary, lighter text-primary/secondary.

export const STUDIO_THEME = {
  fontFamily: 'var(--font-body, ui-sans-serif, system-ui, -apple-system, sans-serif)',
  // Shell / panel backgrounds — ONEMO semantic bg tokens
  shellBackground: 'var(--semantic-bg-primary)',
  baseBackground: 'var(--semantic-bg-secondary)',
  panelBackground: 'var(--semantic-bg-tertiary)',
  sectionHeaderBackground: 'var(--semantic-bg-tertiary)',
  // Foreground / text — ONEMO semantic text tokens
  baseForeground: 'var(--semantic-text-primary)',
  labelForeground: 'var(--semantic-text-secondary)',
  disabledForeground: 'var(--semantic-fg-disabled)',
  // Borders — ONEMO semantic border tokens
  border: '1px solid var(--semantic-border-primary)',
  borderColor: 'var(--semantic-border-primary)',
  // Interactive — ONEMO brand tokens
  activeBlue: 'var(--semantic-bg-brand-solid)',
  buttonBackground: 'var(--semantic-bg-brand-solid)',
  buttonBackgroundHover: 'var(--semantic-bg-brand-solid-hover)',
  buttonForeground: 'var(--semantic-fg-white)',
  // Container / input
  containerBackground: 'var(--semantic-bg-tertiary)',
  containerBackgroundHover: 'var(--semantic-bg-quaternary)',
  containerForeground: 'var(--semantic-text-primary)',
  inputBackground: 'var(--semantic-bg-secondary)',
  inputBackgroundHover: 'var(--semantic-bg-secondary-hover)',
  inputForeground: 'var(--semantic-text-primary)',
  // Misc
  baseShadow: 'var(--semantic-shadow-md-01)',
  monitorBackground: 'var(--semantic-bg-quaternary)',
  grooveForeground: 'var(--semantic-border-secondary)',
  // Border radius — ONEMO design tokens (flat KeyShot style)
  baseBorderRadius: 'var(--radius-xxs, 2px)',
  bladeBorderRadius: 'var(--radius-xxs, 2px)',
} as const

export function paneSurfaceStyle() {
  return {
    display: 'grid',
    gap: 0,
    padding: 0,
    borderRadius: 0,
    background: STUDIO_THEME.baseBackground,
    borderBottom: STUDIO_THEME.border,
    fontFamily: STUDIO_THEME.fontFamily,
  } as const
}

export function paneSummaryStyle() {
  return {
    cursor: 'pointer',
    display: 'grid',
    gap: 2,
    listStyle: 'none',
    padding: '6px 8px',
    background: STUDIO_THEME.sectionHeaderBackground,
    borderBottom: STUDIO_THEME.border,
  } as const
}

export function eyebrowStyle() {
  return {
    fontSize: 10,
    letterSpacing: '0.10em',
    textTransform: 'uppercase' as const,
    color: STUDIO_THEME.labelForeground,
  } as const
}

export function mutedCopyStyle() {
  return {
    margin: 0,
    fontSize: 10,
    lineHeight: 1.4,
    color: STUDIO_THEME.labelForeground,
  } as const
}

export function fieldStackStyle() {
  return {
    display: 'grid',
    gap: 3,
  } as const
}

export function statusGridStyle(columns = 3) {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: 1,
  } as const
}

export function statusCardStyle() {
  return {
    display: 'grid',
    gap: 2,
    minWidth: 0,
    padding: '5px 8px',
    borderRadius: 0,
    background: STUDIO_THEME.containerBackground,
    border: 'none',
    overflow: 'hidden',
  } as const
}

export function quickPickGridStyle(minWidth = 64) {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
    gap: 4,
  } as const
}

export function quickPickButtonStyle(active = false) {
  return {
    display: 'grid',
    gap: 3,
    minWidth: 0,
    padding: '4px',
    borderRadius: STUDIO_THEME.bladeBorderRadius,
    border: active
      ? `1px solid ${STUDIO_THEME.activeBlue}`
      : STUDIO_THEME.border,
    background: active
      ? 'var(--semantic-bg-brand-primary)'
      : STUDIO_THEME.inputBackground,
    color: active ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground,
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    overflow: 'hidden',
  } as const
}
