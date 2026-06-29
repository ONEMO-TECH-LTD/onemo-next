import * as React from 'react';

/**
 * RoundButton — the standard round control button (✕ / ✓ / undo / redo).
 *
 * Anatomy (DS spec, from the Figma golden screen):
 *   container  44px round            ← accessibility tap-target floor (supersedes the .dc 40px)
 *   icon       20px                  ← icon ≈ 0.45 × control (held ratio)
 *   surface    solid | glass | ghost ← the control's own surface, NOT the page bg
 *   tone       neutral | brand | disabled
 *
 * Surface note (flagged for the colour-semantics decision): `solid` uses
 * `--al-col-base-white` (pure white) so the control reads ON the brand surface
 * instead of collapsing into it (the v2.3 page `--sem-col-bg-primary` is brand-white).
 * A dedicated semantic `--sem-col-bg-control` token should replace this alias once
 * the editor surface semantics are locked from the UI.
 */
export type RoundButtonSurface = 'solid' | 'glass' | 'ghost';
export type RoundButtonTone = 'neutral' | 'brand' | 'disabled';

export interface RoundButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** 20px icon (Phosphor light per the spec). */
  icon: React.ReactNode;
  'aria-label': string;
  surface?: RoundButtonSurface;
  tone?: RoundButtonTone;
}

const CONTAINER = 44; // tap-target floor
const ICON = 20; // ≈ 0.45 × container

const SURFACE: Record<RoundButtonSurface, React.CSSProperties> = {
  solid: {
    background: 'var(--al-col-base-white)',
    border: '1px solid var(--sem-col-border-secondary)',
    boxShadow: '0 1px 2px var(--effects-shadow-sm-01)',
  },
  glass: {
    background: 'color-mix(in oklch, var(--al-col-base-white) 55%, transparent)',
    border: '1px solid color-mix(in oklch, var(--al-col-base-white) 40%, transparent)',
    backdropFilter: 'blur(var(--effects-blur-sm))',
    WebkitBackdropFilter: 'blur(var(--effects-blur-sm))',
    boxShadow: '0 1px 2px var(--effects-shadow-sm-01)',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    boxShadow: 'none',
  },
};

const INK: Record<RoundButtonTone, string> = {
  neutral: 'var(--sem-col-text-primary)',
  brand: 'var(--sem-col-fg-brand-primary)',
  disabled: 'var(--sem-col-fg-disabled)',
};

export function RoundButton({
  icon,
  surface = 'solid',
  tone = 'neutral',
  style,
  ...props
}: RoundButtonProps) {
  const isDisabled = tone === 'disabled';
  return (
    <button
      type="button"
      data-anat="round-button"
      data-surface={surface}
      data-tone={tone}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      style={{
        width: CONTAINER,
        height: CONTAINER,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        borderRadius: 'var(--sem-radii-full, 9999px)',
        color: INK[tone],
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        ...SURFACE[surface],
        ...style,
      }}
      {...props}
    >
      <span
        data-anat="icon"
        aria-hidden="true"
        style={{
          width: ICON,
          height: ICON,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
    </button>
  );
}
