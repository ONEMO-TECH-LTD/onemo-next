export const STUDIO_THEME = {
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  // Shell / panel backgrounds
  shellBackground: '#1a1a1a',
  baseBackground: '#282828',
  panelBackground: '#222222',
  sectionHeaderBackground: '#2e2e2e',
  // Foreground / text
  baseForeground: '#c8c8c8',
  labelForeground: '#888888',
  disabledForeground: '#555555',
  // Borders
  border: '1px solid #3a3a3a',
  borderColor: '#3a3a3a',
  // Interactive
  activeBlue: '#0a84ff',
  buttonBackground: '#0a84ff',
  buttonBackgroundHover: '#1a94ff',
  buttonForeground: '#ffffff',
  // Container / input
  containerBackground: 'rgba(255, 255, 255, 0.05)',
  containerBackgroundHover: 'rgba(255, 255, 255, 0.08)',
  containerForeground: '#c8c8c8',
  inputBackground: '#1e1e1e',
  inputBackgroundHover: '#222222',
  inputForeground: '#c8c8c8',
  // Misc
  baseShadow: 'rgba(0, 0, 0, 0.4)',
  monitorBackground: 'rgba(0, 0, 0, 0.4)',
  grooveForeground: '#3a3a3a',
  // Border radius — flat KeyShot style (no radius on panels, minimal on inputs)
  baseBorderRadius: 2,
  bladeBorderRadius: 2,
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

export function inputStyle() {
  return {
    width: '100%',
    height: 22,
    padding: '0 6px',
    borderRadius: STUDIO_THEME.bladeBorderRadius,
    border: STUDIO_THEME.border,
    background: STUDIO_THEME.inputBackground,
    color: STUDIO_THEME.inputForeground,
    fontFamily: 'inherit',
    fontSize: 11,
  } as const
}

export function primaryButtonStyle() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
    padding: '0 8px',
    borderRadius: STUDIO_THEME.bladeBorderRadius,
    border: 'none',
    background: STUDIO_THEME.buttonBackground,
    color: STUDIO_THEME.buttonForeground,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 11,
    fontFamily: 'inherit',
  } as const
}

export function secondaryButtonStyle(active = false) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
    padding: '0 8px',
    borderRadius: STUDIO_THEME.bladeBorderRadius,
    border: STUDIO_THEME.border,
    background: active ? STUDIO_THEME.buttonBackground : 'transparent',
    color: active ? STUDIO_THEME.buttonForeground : STUDIO_THEME.baseForeground,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 11,
    fontFamily: 'inherit',
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
    border: active ? `1px solid ${STUDIO_THEME.activeBlue}` : STUDIO_THEME.border,
    background: active ? 'rgba(10, 132, 255, 0.12)' : STUDIO_THEME.inputBackground,
    color: active ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground,
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    overflow: 'hidden',
  } as const
}
