// Studio theme — colors use HeroUI CSS vars (auto-switch light/dark via data-theme on studio root).
// Spacing, radius, and font use ONEMO design tokens (--radius-*, --font-*, --spacing-*).
//
// HeroUI vars referenced here (defined in @heroui/styles):
//   --background, --foreground, --surface, --surface-secondary, --surface-tertiary,
//   --muted, --border, --field-background, --field-foreground, --accent, --accent-foreground

export const STUDIO_THEME = {
  fontFamily: 'var(--font-body, ui-sans-serif, system-ui, -apple-system, sans-serif)',
  // Shell / panel backgrounds — HeroUI adaptive surface vars
  shellBackground: 'var(--background)',
  baseBackground: 'var(--surface)',
  panelBackground: 'var(--surface-secondary)',
  sectionHeaderBackground: 'var(--surface-tertiary)',
  // Foreground / text — HeroUI adaptive foreground vars
  baseForeground: 'var(--foreground)',
  labelForeground: 'var(--muted)',
  disabledForeground: 'color-mix(in oklch, var(--foreground) 35%, transparent)',
  // Borders — HeroUI adaptive border vars
  border: '1px solid var(--border)',
  borderColor: 'var(--border)',
  // Interactive — HeroUI accent (adaptive blue)
  activeBlue: 'var(--accent)',
  buttonBackground: 'var(--accent)',
  buttonBackgroundHover: 'color-mix(in oklch, var(--accent) 90%, var(--foreground))',
  buttonForeground: 'var(--accent-foreground)',
  // Container / input — HeroUI field and surface vars
  containerBackground: 'color-mix(in oklch, var(--foreground) 5%, transparent)',
  containerBackgroundHover: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
  containerForeground: 'var(--foreground)',
  inputBackground: 'var(--field-background)',
  inputBackgroundHover: 'var(--surface)',
  inputForeground: 'var(--field-foreground)',
  // Misc
  baseShadow: 'var(--surface-shadow)',
  monitorBackground: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
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
      ? 'color-mix(in oklch, var(--accent) 12%, transparent)'
      : STUDIO_THEME.inputBackground,
    color: active ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground,
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    overflow: 'hidden',
  } as const
}
