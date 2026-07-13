'use client';

/**
 * State Lab — interactive proving ground for the state families on the real app ground.
 * Everything here is LIVE: press with the pointer, drag the chip, Tab to focus, open the
 * scrim. Every colour resolves from the generated pull at render time (no typed values);
 * where the committed snapshot predates a rename, the resolver falls back to the old name.
 */

import React from 'react';
import { cssColor, semanticFamily, resolve, AL_COL, EFFECTS_COL, splitAlpha } from './data';
import { S } from './blocks';

const PHOTO = 'linear-gradient(135deg,#e8b04b 0%,#b0592f 45%,#3a6b52 100%)'; // imagery stand-in

type Face = 'L' | 'D';

const SEM = new Map(semanticFamily('').map((t) => [t.name, t]));
/** Semantic face with rename fallbacks (fresh pull wins when present). */
function sem(face: Face, ...names: string[]): string | null {
  for (const n of names) {
    const t = SEM.get(n);
    if (t) return cssColor(face === 'L' ? t.L : t.D);
  }
  return null;
}
function alias(face: Face, path: string): string | null {
  const v = resolve(AL_COL, path);
  return v ? cssColor(face === 'L' ? v.L : v.D) : null;
}
function washAlpha(...names: string[]): string {
  for (const n of names) {
    const t = SEM.get(n);
    if (t) {
      const { alpha } = splitAlpha(t.L);
      if (alpha !== null) return `${Math.round(alpha * 100)}%`;
    }
  }
  return '';
}

const chipBase: React.CSSProperties = {
  width: 128,
  height: 56,
  borderRadius: 14,
  border: 'none',
  position: 'relative',
  overflow: 'hidden',
  cursor: 'pointer',
  padding: 0,
};

/** Hold to see the press wash; the wash is the token, not a CSS trick. */
function PressChip({ ground, wash, caption }: { ground: string; wash: string | null; caption: string }) {
  const [down, setDown] = React.useState(false);
  return (
    <span style={{ textAlign: 'center' }}>
      <button
        type="button"
        style={{ ...chipBase, background: ground, outline: 'none' }}
        onPointerDown={() => setDown(true)}
        onPointerUp={() => setDown(false)}
        onPointerLeave={() => setDown(false)}
      >
        {down && wash ? <span style={{ position: 'absolute', inset: 0, background: wash }} /> : null}
      </button>
      <div style={{ ...S.mono, fontSize: 8.5, color: '#8b8d98', marginTop: 2 }}>{caption}</div>
    </span>
  );
}

/** Drag me — wash + shadow ride the move, both released on drop. */
function DragChip({ ground, wash, shadow }: { ground: string; wash: string | null; shadow: string | null }) {
  const [drag, setDrag] = React.useState<{ x: number; y: number } | null>(null);
  const origin = React.useRef({ x: 0, y: 0 });
  return (
    <span style={{ display: 'inline-block', width: 128, height: 56 }}>
      <button
        type="button"
        style={{
          ...chipBase,
          background: ground,
          outline: 'none',
          transform: drag ? `translate(${drag.x}px, ${drag.y}px) scale(1.04)` : undefined,
          boxShadow: drag && shadow ? `0 12px 32px ${shadow}` : undefined,
          transition: drag ? 'none' : 'transform .18s ease, box-shadow .18s ease',
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          origin.current = { x: e.clientX, y: e.clientY };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDrag({ x: 0, y: 0 });
        }}
        onPointerMove={(e) => {
          if (drag) setDrag({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y });
        }}
        onPointerUp={() => setDrag(null)}
      >
        {drag && wash ? <span style={{ position: 'absolute', inset: 0, background: wash }} /> : null}
      </button>
    </span>
  );
}

/** Real keyboard focus — Tab into it; the ring is the token. On-solid rings draw inset
 * (inside the solid surface) — outside they'd sit on the app ground where a pure ring
 * has no contrast; the placement is the component contract. */
function FocusChip({ ground, ring, caption, inset }: { ground: string; ring: string | null; caption: string; inset?: boolean }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <span style={{ textAlign: 'center' }}>
      <button
        type="button"
        style={{
          ...chipBase,
          background: ground,
          outline: focused && ring && !inset ? `2px solid ${ring}` : 'none',
          outlineOffset: 2,
          boxShadow: focused && ring && inset ? `inset 0 0 0 2px ${ring}` : undefined,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLButtonElement).focus();
          setFocused(true);
        }}
      />
      <div style={{ ...S.mono, fontSize: 8.5, color: '#8b8d98', marginTop: 2 }}>{caption}</div>
    </span>
  );
}

/** Click to raise the modal scrim over the mini screen. */
function ScrimDemo({ ground, control, scrim, sheet }: { ground: string; control: string; scrim: string | null; sheet: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      style={{ display: 'inline-block', width: 230, height: 140, borderRadius: 12, background: ground, position: 'relative', overflow: 'hidden', border: '1px solid rgba(128,128,128,.25)' }}
    >
      <button
        type="button"
        style={{ position: 'absolute', top: 14, left: 14, width: 92, height: 34, borderRadius: 9, border: 'none', background: control, cursor: 'pointer', ...S.mono, fontSize: 9 }}
        onClick={() => setOpen(true)}
      >
        open modal
      </button>
      {open && scrim ? (
        <span style={{ position: 'absolute', inset: 0, background: scrim, cursor: 'pointer' }} onClick={() => setOpen(false)}>
          <span style={{ position: 'absolute', left: 40, top: 56, width: 150, height: 62, borderRadius: 12, background: sheet }} />
        </span>
      ) : null}
    </span>
  );
}

function Panel({ face }: { face: Face }) {
  const ground = sem(face, 'bg/app/primary', 'bg/app/default') ?? '#ccc';
  const control = sem(face, 'bg/control/default') ?? '#ddd';
  const solid = sem(face, 'bg/max/brand-contrast', 'bg/max/brand') ?? '#000';
  const float = sem(face, 'bg/max/default', 'bg/max/inverse') ?? '#fff';
  const pressN = sem(face, 'interaction/press/on-neutral');
  const pressS = sem(face, 'interaction/press/on-solid');
  const pressI = sem(face, 'interaction/press/on-image');
  const dragN = sem(face, 'interaction/drag/on-neutral');
  const scrimDim = sem(face, 'scrim/dim');
  const scrimImg = sem(face, 'scrim/on-image');
  const ringInk = alias(face, 'brand/ink-snow'); // proposal A — the mono ring
  const ringCur = sem(face, 'focus/ring/on-neutral'); // current draft (colour)
  const ringSolid = sem(face, 'focus/ring/on-solid');
  const shadowRegular = (() => {
    const v = resolve(EFFECTS_COL, 'shadow/regular');
    return v ? cssColor(face === 'L' ? v.L : v.D) : null;
  })();
  const label: React.CSSProperties = { ...S.mono, fontSize: 9.5, color: '#8b8d98', margin: '14px 0 6px' };
  return (
    <div style={{ flex: 1, minWidth: 430, borderRadius: 16, background: ground, padding: 20, border: '1px solid rgba(128,128,128,.3)' }}>
      <div style={{ ...S.mono, fontSize: 10, color: '#8b8d98' }}>{face === 'L' ? 'LIGHT' : 'DARK'} — app ground</div>

      <div style={label}>PRESS — hold the chips ({washAlpha('interaction/press/on-neutral')})</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <PressChip ground={control} wash={pressN} caption="control · on-neutral" />
        <PressChip ground={solid} wash={pressS} caption="max/brand · on-solid" />
        <PressChip ground={PHOTO} wash={pressI} caption="imagery · on-image (pinned)" />
      </div>

      <div style={label}>DRAG — grab and move ({washAlpha('interaction/drag/on-neutral')} + shadow)</div>
      <DragChip ground={control} wash={dragN} shadow={shadowRegular} />

      <div style={label}>FOCUS — click a chip (or Tab) for its ring</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <FocusChip ground={control} ring={ringInk} caption="A · Ink (proposal)" />
        <FocusChip ground={control} ring={ringCur} caption="B · current (colour)" />
        <FocusChip ground={solid} ring={ringSolid} caption="on-solid (inset)" inset />
      </div>

      <div style={label}>SCRIM — click to raise the modal dim ({washAlpha('scrim/dim')})</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ScrimDemo ground={ground} control={control} scrim={scrimDim} sheet={float} />
        <span style={{ display: 'inline-block', width: 230, height: 140, borderRadius: 12, background: PHOTO, position: 'relative', overflow: 'hidden' }}>
          {scrimImg ? <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 62, background: scrimImg }} /> : null}
          <span style={{ position: 'absolute', left: 10, bottom: 8, color: '#fff', fontSize: 11, fontWeight: 650 }}>
            legibility scrim ({washAlpha('scrim/on-image')})
          </span>
        </span>
      </div>
    </div>
  );
}

/** Both theme faces side by side, every state operable. */
export function StateLab() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
      <Panel face="L" />
      <Panel face="D" />
    </div>
  );
}
