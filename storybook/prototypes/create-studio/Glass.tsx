import * as React from 'react';

/**
 * Glass — ONEMO's refined glass control surface (Dan's signed-off recipe).
 * All backdrop-filter + gradients (GPU / Safari-safe, no SVG-filter reach). Layers:
 *   • edge refraction — radial-masked backdrop-blur (clear centre → blurred rim, doubled)
 *   • diagonal rims   — crisp white TL + BR highlights (the light catch)
 *   • dark contact    — directional dark inset (the "tiny border")
 *   • micro CA        — near-invisible red/cyan rim split
 *
 * STRUCTURE MATTERS: the refraction backdrop-filter layers must have NO `filter` or
 * `transform` ancestor (those form a backdrop-root and neutralise backdrop-filter → clear
 * on iOS). So the ground shadow is a `box-shadow` (not `filter:drop-shadow`), and the
 * rotating rim base — which carries `transform` — holds ONLY box-shadows, never a blur.
 */
export type GlassShape = 'round' | 'pill';

export interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: GlassShape;
  /** light-direction angle deg (rotates the rims; refraction is symmetric). */
  angle?: number;
  /** faint white surface tint 0..1. */
  tint?: number;
  children?: React.ReactNode;
}

const RADIUS: Record<GlassShape, string> = { round: '50%', pill: 'var(--sem-radii-full, 9999px)' };
const REFRACT = {
  round: {
    near: 'radial-gradient(closest-side, transparent 56%, rgba(0,0,0,.5) 80%, #000 100%)',
    far: 'radial-gradient(closest-side, transparent 80%, #000 100%)',
  },
  pill: {
    near: 'radial-gradient(ellipse closest-side, transparent 60%, rgba(0,0,0,.5) 82%, #000 100%)',
    far: 'radial-gradient(ellipse closest-side, transparent 82%, #000 100%)',
  },
};

export function Glass({ shape = 'round', angle = 38, tint = 0.05, children, style, ...props }: GlassProps) {
  const radius = RADIUS[shape];
  const refract = REFRACT[shape];
  return (
    <div
      data-anat="glass"
      data-shape={shape}
      style={{ position: 'relative', display: 'grid', placeItems: 'center', borderRadius: radius, boxShadow: '0 3px 6px rgba(0,0,0,.16)', ...style }}
      {...props}
    >
      {/* refraction — no filter/transform ancestor → backdrop-filter samples the page */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', WebkitMaskImage: refract.near, maskImage: refract.near }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', WebkitMaskImage: refract.far, maskImage: refract.far }} />
      {/* turning rim base — box-shadow only (transform OK, no backdrop-filter here) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', transform: `rotate(${angle}deg)`,
          background: `color-mix(in oklch, var(--al-col-base-white) ${tint * 100}%, transparent)`,
          boxShadow: [
            'inset -1.4px -1.4px .8px rgba(255,255,255,.95)',
            'inset 1.1px 1.1px .4px rgba(255,255,255,.9)',
            '-1.4px -1.4px 1.4px rgba(255,255,255,.45)',
            '1.4px 1.4px 1.4px rgba(255,255,255,.45)',
            'inset 1px 1.6px 2px rgba(0,0,0,.12)',
            'inset -.6px -.8px 1px rgba(0,0,0,.05)',
            'inset 2px 0 1px rgba(255,60,60,.06)',
            'inset -2px 0 1px rgba(40,180,255,.06)',
          ].join(', '),
        }}
      />
      <div style={{ position: 'relative', zIndex: 2, display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: 'var(--sem-col-text-primary)' }}>
        {children}
      </div>
    </div>
  );
}
