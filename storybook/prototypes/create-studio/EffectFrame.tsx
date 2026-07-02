'use client';
import * as React from 'react';

/**
 * EffectFrame — the real Effect Frame from the proto: brushed-metal rim, recessed
 * well, image on the front, solid colour on the back, and the locked tap-to-flip
 * (single-face continuous rotateY, content swapped at the edge-on 90° instant →
 * immune to Safari's filter/blend backface bug). Ported verbatim from
 * `_prototypes/s58-skylrk + suede studio/suede-studio.html` (frame chrome + flip),
 * minus the suede nap — this frame carries an image, no grain.
 */

const RIM_SHADOW =
  '0 26px 50px -18px rgba(10,13,18,.55),0 0 0 1px rgba(255,255,255,.22),' +
  'inset 0 2px 1px -1px rgba(255,255,255,.32),inset 2px 0 1px -1px rgba(255,255,255,.2),' +
  'inset -2px 0 1px -1px rgba(255,255,255,.18),inset 0 -2px 1px -1px rgba(255,255,255,.24),' +
  'inset 5px -5px 3px -3px rgba(255,255,255,.28),inset -4px 4px 3px -3px rgba(255,255,255,.1),' +
  'inset 4px 4px 3px -3px rgba(255,255,255,.1),inset 0 -3px 4px -3px rgba(0,0,0,.28)';

const EDGE_SHADOW =
  'inset 0 0 0 1px rgba(0,0,0,.42),inset 0 7px 11px -5px rgba(0,0,0,.62),' +
  'inset 4px 0 9px -6px rgba(0,0,0,.42),inset -4px 0 9px -6px rgba(0,0,0,.42),' +
  'inset 0 -4px 9px -5px rgba(0,0,0,.26)';

const PERSP = 'perspective(1200px)'; // in the card's OWN transform → real depth (parent perspective flattens under scale)
const easeQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export interface EffectFrameProps {
  /** Frame size (px). */
  size?: number;
  /** Front image URL (default = the proto's placeholder gradient). */
  image?: string;
  /** Back-face colour. */
  backColor?: string;
  /** Brushed-metal frame gradient. */
  frame?: string;
  /** Flip duration (s). */
  duration?: number;
}

export function EffectFrame({
  size = 300,
  image,
  backColor = '#b9986f',
  frame = 'linear-gradient(145deg,#2c313a,#171a1f 42%,#0f1216)',
  duration = 0.7,
}: EffectFrameProps) {
  const modelRef = React.useRef<HTMLDivElement>(null);
  const flipped = React.useRef(false);
  const flipping = React.useRef(false);
  const [showBack, setShowBack] = React.useState(false);

  const doFlip = React.useCallback(() => {
    const m = modelRef.current;
    if (!m || flipping.current) return;
    flipping.current = true;
    const from = flipped.current ? 180 : 0, to = flipped.current ? 0 : 180, mid = (from + to) / 2;
    const dur = Math.max(120, duration * 1000);
    const t0 = performance.now();
    let swapped = false;
    m.style.transition = 'none';
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = easeQuad(t);
      let ang = from + (to - from) * e;
      if (!swapped && e >= 0.5) { swapped = true; ang = mid; flipped.current = !flipped.current; setShowBack(flipped.current); } // pin to edge-on, swap while invisible
      m.style.transform = `${PERSP} rotateY(${ang}deg)`;
      if (t < 1) requestAnimationFrame(step); else flipping.current = false;
    };
    requestAnimationFrame(step);
  }, [duration]);

  const photo = image ? `url(${image})` : 'linear-gradient(135deg,#c9d3dc,#7b8794 60%,#525c66)';

  return (
    <div style={{ width: size, height: size }}>
      <div
        ref={modelRef}
        onClick={doFlip}
        role="button"
        aria-label="Flip"
        style={{ position: 'relative', width: '100%', height: '100%', cursor: 'pointer', willChange: 'transform', transformOrigin: 'center', transform: `${PERSP} rotateY(0deg)` }}
      >
        {/* rim — brushed-metal frame */}
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 52, padding: 8, background: frame, boxShadow: RIM_SHADOW }}>
          {/* well — recessed cavity */}
          <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', borderRadius: 44, overflow: 'hidden', background: showBack ? backColor : 'transparent' }}>
            {!showBack && <div style={{ position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: photo }} />}
            {/* edge — inward recess shadow (no highlight ring) */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 44, pointerEvents: 'none', boxShadow: EDGE_SHADOW }} />
          </div>
        </div>
      </div>
    </div>
  );
}
