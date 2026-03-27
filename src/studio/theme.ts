// Studio theme — colors reference HeroUI dark theme CSS vars (--background, --surface, etc.)
// Spacing and radius reference ONEMO design tokens (--radius-*, --spacing-*)
// This file provides JS-side constants for inline layout that cannot use CSS classes,
// and CSS class helpers for HeroUI component customization.

export const STUDIO_THEME = {
  fontFamily: 'var(--font-body, ui-sans-serif, system-ui, -apple-system, sans-serif)',
  // Shell / panel backgrounds — HeroUI dark theme vars
  shellBackground: 'var(--background, #1a1a1a)',
  baseBackground: 'var(--surface, #282828)',
  panelBackground: 'var(--surface-secondary, #222222)',
  sectionHeaderBackground: 'var(--surface-tertiary, #2e2e2e)',
  // Foreground / text — HeroUI dark theme vars
  baseForeground: 'var(--foreground, #c8c8c8)',
  labelForeground: 'var(--muted, #888888)',
  disabledForeground: 'color-mix(in oklch, var(--foreground) 35%, transparent)',
  // Borders — HeroUI dark theme vars
  border: '1px solid color-mix(in oklch, var(--foreground) 12%, transparent)',
  borderColor: 'color-mix(in oklch, var(--foreground) 12%, transparent)',
  // Interactive — HeroUI primary color var
  activeBlue: 'var(--primary, #0a84ff)',
  buttonBackground: 'var(--primary, #0a84ff)',
  buttonBackgroundHover: 'var(--primary-600, #1a94ff)',
  buttonForeground: 'var(--primary-foreground, #ffffff)',
  // Container / input
  containerBackground: 'color-mix(in oklch, var(--foreground) 5%, transparent)',
  containerBackgroundHover: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
  containerForeground: 'var(--foreground, #c8c8c8)',
  inputBackground: 'var(--field-background, #1e1e1e)',
  inputBackgroundHover: 'var(--surface, #222222)',
  inputForeground: 'var(--field-foreground, #c8c8c8)',
  // Misc
  baseShadow: 'rgba(0, 0, 0, 0.4)',
  monitorBackground: 'rgba(0, 0, 0, 0.4)',
  grooveForeground: 'color-mix(in oklch, var(--foreground) 12%, transparent)',
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
      ? 'color-mix(in oklch, var(--primary, #0a84ff) 12%, transparent)'
      : STUDIO_THEME.inputBackground,
    color: active ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground,
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    overflow: 'hidden',
  } as const
}
