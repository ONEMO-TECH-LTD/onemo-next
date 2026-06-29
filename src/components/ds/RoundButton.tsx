import * as React from 'react';

/**
 * RoundButton — the standard round control button (e.g. ✕ / ✓ / undo / redo).
 *
 * Anatomy (DS spec, from the Figma golden screen):
 *   container  44px  round            ← accessibility tap-target floor
 *   icon       20px                   ← icon ≈ 0.45 × control (Apple Symbol / Material floor ratio)
 *   surface    white control          ← sem-col token; sits on the brand surface
 *   ink        grey-12                ← sem-col-text-primary
 *
 * v2.3-native: all visual values are DS tokens (no hard-coded colour). The 44/20
 * geometry is the spec's tap-floor + held icon ratio.
 */
export interface RoundButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 20px icon (Phosphor light per the spec). Required for an accessible icon button + `aria-label`. */
  icon: React.ReactNode;
  'aria-label': string;
}

const CONTAINER = 44; // tap-target floor
const ICON = 20; // ≈ 0.45 × container

export function RoundButton({ icon, style, ...props }: RoundButtonProps) {
  return (
    <button
      type="button"
      data-anat="round-button"
      style={{
        width: CONTAINER,
        height: CONTAINER,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        borderRadius: 'var(--sem-radii-full, 9999px)',
        border: '1px solid var(--sem-col-border-secondary)',
        background: 'var(--sem-col-bg-primary)',
        color: 'var(--sem-col-text-primary)',
        boxShadow: 'var(--sem-effects-shadow-sm-01, 0 1px 2px rgb(0 0 0 / 0.06))',
        cursor: 'pointer',
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
