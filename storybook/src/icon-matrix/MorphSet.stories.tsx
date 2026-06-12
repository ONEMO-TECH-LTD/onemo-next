/**
 * ONEMO Custom Morph Set — TEST (capability probe, not final art)
 *
 * Every glyph is drawn from the morph alphabet (numbered steps 1–10 on the
 * brand identity board): filled nodes (magnets) + thin rounded tissue.
 * Stroke 1.5px at 24px — "clean and elegant light", Chillax-curved.
 * The fat 8px ring stays reserved for the CTA / brand moments.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { ArrowArcLeft, MagicWand, ImageSquare, PencilSimple, Eye, Crop, Sun, Palette } from '@phosphor-icons/react'
import { Undo as IUndo, MagicWand as IMagicWand, MediaImage, Edit as IEdit, Eye as IEye, Crop as ICrop, SunLight, Palette as IPalette } from 'iconoir-react'

// SOLID morph grammar — ONEMO marks are filled fluid masses, not line diagrams.
// Construction: clockwise solids + counter-clockwise "bite" circles (nonzero fill rule);
// curvature comes from negative space, like the receiver circles biting the garment grid.
const cw = (cx: number, cy: number, r: number) => `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} Z`
const ccw = (cx: number, cy: number, r: number) => `M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} Z`
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`

type P = { size?: number; color?: string }
const Solid = ({ size = 24, color = 'currentColor', d, transform }: P & { d: string; transform?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }} aria-hidden="true">
    <path d={d} fill="currentColor" fillRule="nonzero" transform={transform} />
  </svg>
)

// THE BRAND X — rounded square with four receiver-circle bites from the edge midpoints
const X_D = rrect(2.5, 2.5, 19, 19, 3.4) + ccw(12, 2.5, 6.4) + ccw(12, 21.5, 6.4) + ccw(2.5, 12, 6.4) + ccw(21.5, 12, 6.4)
export const MorphConnect = (p: P) => <Solid {...p} d={X_D} />
/** MAGIC \u2726 — the brand X rotated 45\u00b0 */
export const MorphMagic = (p: P) => <Solid {...p} d={X_D} transform="rotate(45 12 12) scale(0.92) translate(1.05 1.05)" />
/** PAIR — two rounded squares joined by waisted tissue (step 2) */
const PAIR_D = rrect(2.5, 13, 8.5, 8.5, 2.6) + rrect(13, 2.5, 8.5, 8.5, 2.6)
  + 'M 8.2 13.4 L 13.4 8.2 L 15.8 10.6 L 10.6 15.8 Z'
  + ccw(6.9, 6.9, 4.9) + ccw(17.1, 17.1, 4.9)
export const MorphPair = (p: P) => <Solid {...p} d={PAIR_D} />
/** EFFECT — solid squircle on a magnet (washer) */
const EFFECT_D = 'M 12 2.8 C 18.6 2.8 21.2 5.4 21.2 12 C 21.2 18.6 18.6 21.2 12 21.2 C 5.4 21.2 2.8 18.6 2.8 12 C 2.8 5.4 5.4 2.8 12 2.8 Z' + ccw(12, 12, 3.4)
export const MorphEffect = (p: P) => <Solid {...p} d={EFFECT_D} />
/** RECEIVER GRID — tissue fragment: square bitten by four receiver circles 2\u00d72 */
const GRID_D = rrect(2.5, 2.5, 19, 19, 4.2) + ccw(7.3, 7.3, 4.3) + ccw(16.7, 7.3, 4.3) + ccw(7.3, 16.7, 4.3) + ccw(16.7, 16.7, 4.3)
export const MorphGrid = (p: P) => <Solid {...p} d={GRID_D} />
/** LIBRARY — solid pill holding three magnets */
const LIB_D = rrect(2.5, 8, 19, 8, 4) + ccw(8, 12, 1.7) + ccw(12, 12, 1.7) + ccw(16, 12, 1.7)
export const MorphLibrary = (p: P) => <Solid {...p} d={LIB_D} />
/** REMIX — the pair mid-rotation: two solid lobes orbiting */
const REMIX_D = cw(7.2, 16.8, 3.6) + cw(16.8, 7.2, 3.6)
  + 'M 4.4 8.6 A 8.6 8.6 0 0 1 13 4.2 L 12.4 6.9 A 5.9 5.9 0 0 0 7 9.9 Z'
  + 'M 19.6 15.4 A 8.6 8.6 0 0 1 11 19.8 L 11.6 17.1 A 5.9 5.9 0 0 0 17 14.1 Z'
export const MorphRemix = (p: P) => <Solid {...p} d={REMIX_D} />
/** ADD POINT — solid pair gaining a third node */
const ADD_D = cw(6.5, 17.5, 3.1) + cw(13.5, 10.5, 3.1)
  + 'M 7.6 15.2 L 11.2 11.6 L 12.4 12.8 L 8.8 16.4 Z'
  + cw(19.2, 4.8, 0.001)
export const MorphAddPoint = ({ size = 24, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }} aria-hidden="true">
    <path d={ADD_D} fill="currentColor" fillRule="nonzero" />
    <circle cx={19} cy={5} r={3.1} fill="none" stroke="currentColor" strokeWidth={1.4} />
    <path d="M 19 3.9 V 6.1 M 17.9 5 H 20.1" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" fill="none" />
  </svg>
)
/** SHARE — one solid magnet handing off to an open receiver */
export const MorphShare = ({ size = 24, color = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }} aria-hidden="true">
    <path d={cw(7, 17, 3.4) + 'M 8.4 14.2 L 11.4 11.2 L 12.8 12.6 L 9.8 15.6 Z'} fill="currentColor" fillRule="nonzero" />
    <circle cx={17} cy={7} r={3.4} fill="none" stroke="currentColor" strokeWidth={1.4} />
    <path d="M 13.6 10.4 L 14.8 9.2" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeDasharray="0.1 2.4" fill="none" />
  </svg>
)
/** GROWTH — the alphabet counting up: 1 \u2192 2 \u2192 X (all solid, miniature) */
const GROWTH_D = cw(4, 12, 1.7)
  + cw(9.3, 14.6, 1.9) + cw(12.7, 9.4, 1.9) + 'M 9.9 13.2 L 12.1 10.8 L 13.3 11.9 L 11.1 14.3 Z'
  + rrect(16.2, 8.2, 7.6, 7.6, 1.6) + ccw(20, 8.2, 2.5) + ccw(20, 15.8, 2.5) + ccw(16.2, 12, 2.5) + ccw(23.8, 12, 2.5)
export const MorphGrowth = (p: P) => <Solid {...p} d={GROWTH_D} />

const CUSTOM: { name: string; node: React.FC<P>; means: string }[] = [
  { name: 'pair', node: MorphPair, means: 'magnetic attachment (step 2)' },
  { name: 'connect', node: MorphConnect, means: 'the brand X (step 4)' },
  { name: 'effect', node: MorphEffect, means: 'cut shape on a magnet' },
  { name: 'receiver grid', node: MorphGrid, means: 'garment grid fragment' },
  { name: 'remix', node: MorphRemix, means: 'pair rotating / swap' },
  { name: 'magic ✦', node: MorphMagic, means: 'connector at 45° = ONEMO sparkle' },
  { name: 'add point', node: MorphAddPoint, means: 'step 2 → 3 transition' },
  { name: 'library', node: MorphLibrary, means: 'magnets in a pill' },
  { name: 'share', node: MorphShare, means: 'hand-off, tissue open' },
  { name: 'growth', node: MorphGrowth, means: 'loading = alphabet counts up' },
]

const PH = [
  { n: 'undo', C: ArrowArcLeft }, { n: 'magic', C: MagicWand }, { n: 'image', C: ImageSquare }, { n: 'edit', C: PencilSimple },
  { n: 'preview', C: Eye }, { n: 'crop', C: Crop }, { n: 'bright', C: Sun }, { n: 'trim', C: Palette },
]
const IC = [
  { n: 'undo', C: IUndo }, { n: 'magic', C: IMagicWand }, { n: 'image', C: MediaImage }, { n: 'edit', C: IEdit },
  { n: 'preview', C: IEye }, { n: 'crop', C: ICrop }, { n: 'bright', C: SunLight }, { n: 'trim', C: IPalette },
]

const aluminium: React.CSSProperties = { background: 'linear-gradient(#C3E1F2, #FAFAFA)', color: '#2C3A4A' }
const blackPole: React.CSSProperties = { background: '#0B0F12', color: '#E8EEF2' }

function Cell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 84 }}>
      {children}
      <span style={{ fontSize: 10, opacity: 0.7, textAlign: 'center' }}>{label}</span>
    </div>
  )
}

function Panel({ style, title }: { style: React.CSSProperties; title: string }) {
  return (
    <div style={{ ...style, borderRadius: 16, padding: '20px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CUSTOM.map(({ name, node: C }) => <Cell key={name} label={name}><C size={28} /></Cell>)}
      </div>
    </div>
  )
}

function MorphSet() {
  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', color: '#1a1a1a', padding: 16, maxWidth: 980 }}>
      <h2 style={{ fontWeight: 600 }}>DRAFT v2 — solid grammar (filled masses + bite curvature)</h2>
      <p style={{ fontSize: 13, color: '#555', maxWidth: 720 }}>
        10 product nouns drawn ONLY from the morph alphabet (filled magnet nodes + 1.5px rounded tissue).
        Judged on both brand poles. Below: how they sit next to Phosphor (light) and Iconoir — the two
        delicate canonical candidates — and the weight controls each system offers.
      </p>

      <Panel style={aluminium} title="aluminium pole — custom morph set @28px, 1.5px tissue" />
      <Panel style={blackPole} title="black pole — same set" />

      <div style={{ ...aluminium, borderRadius: 16, padding: '20px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>coexistence — morph nouns (custom) interleaved with Phosphor light (canon)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PH.map(({ n, C }, i) => (
            <React.Fragment key={n}>
              <Cell label={`${n} · ph`}><C size={28} weight="light" /></Cell>
              {CUSTOM[i] && <Cell label={`${CUSTOM[i].name} · onemo`}>{React.createElement(CUSTOM[i].node, { size: 28 })}</Cell>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ ...aluminium, borderRadius: 16, padding: '20px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>coexistence — morph nouns interleaved with Iconoir (1.5px fixed)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {IC.map(({ n, C }, i) => (
            <React.Fragment key={n}>
              <Cell label={`${n} · in`}><C width={28} height={28} /></Cell>
              {CUSTOM[i] && <Cell label={`${CUSTOM[i].name} · onemo`}>{React.createElement(CUSTOM[i].node, { size: 28 })}</Cell>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ ...aluminium, borderRadius: 16, padding: '20px 16px' }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>weight controls — Phosphor weight prop vs Iconoir strokeWidth override (magic wand @28px)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Cell label="ph thin (1px)"><MagicWand size={28} weight="thin" /></Cell>
          <Cell label="ph light (1.5px)"><MagicWand size={28} weight="light" /></Cell>
          <Cell label="ph regular (2px)"><MagicWand size={28} weight="regular" /></Cell>
          <Cell label="ph bold"><MagicWand size={28} weight="bold" /></Cell>
          <Cell label="in 1px"><IMagicWand width={28} height={28} strokeWidth={1} /></Cell>
          <Cell label="in 1.5px (native)"><IMagicWand width={28} height={28} /></Cell>
          <Cell label="in 2px"><IMagicWand width={28} height={28} strokeWidth={2} /></Cell>
          <Cell label="morph X 20px"><MorphConnect size={20} /></Cell>
          <Cell label="morph X 28px"><MorphConnect size={28} /></Cell>
          <Cell label="morph X 40px"><MorphConnect size={40} /></Cell>
        </div>
      </div>
    </div>
  )
}

const meta: Meta<typeof MorphSet> = { title: 'ONEMO/Drafts/Morph Set v2 — solid grammar', component: MorphSet }
export default meta
export const Test: StoryObj<typeof MorphSet> = {}
