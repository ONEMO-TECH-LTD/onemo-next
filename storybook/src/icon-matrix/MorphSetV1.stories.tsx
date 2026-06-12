/**
 * DRAFT v1 — line grammar (dots + thin tissue). KEPT FOR THE RECORD.
 * Superseded by v2 (solid grammar) after Dan's correction: the brand X is a
 * filled fluid mass, not a dot-and-line diagram. Kept because drafts collect —
 * the line register may still be useful for non-brand annotation/diagram UI.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'

const S = 1.5
const R = 2.2

type P = { size?: number; color?: string; sw?: number }
const Svg = ({ size = 24, color = 'currentColor', sw = S, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={{ color }} aria-hidden="true">{children}</svg>
)
const Dot = ({ x, y, r = R }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
const Node = ({ x, y, r = 3.2 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="none" />

const V1Pair = (p: P) => (<Svg {...p}><Dot x={7} y={17} /><Dot x={17} y={7} /><path d="M8.6 15.4 15.4 8.6" /></Svg>)
const V1Connect = (p: P) => (<Svg {...p}><Dot x={6} y={6} /><Dot x={18} y={6} /><Dot x={6} y={18} /><Dot x={18} y={18} /><path d="M7.6 7.6 12 12l4.4-4.4M7.6 16.4 12 12l4.4 4.4" /></Svg>)
const V1Effect = (p: P) => (<Svg {...p}><path d="M5 12c0-5 2-7 7-7s7 2 7 7-2 7-7 7-7-2-7-7Z" /><Dot x={12} y={12} /></Svg>)
const V1Grid = (p: P) => (<Svg {...p}><Node x={7.5} y={7.5} /><Node x={16.5} y={7.5} /><Node x={7.5} y={16.5} /><Node x={16.5} y={16.5} /><Dot x={12} y={12} r={1.8} /></Svg>)
const V1Remix = (p: P) => (<Svg {...p}><Dot x={7.5} y={16.5} /><Dot x={16.5} y={7.5} /><path d="M6 9.5A8.4 8.4 0 0 1 14.5 6M18 14.5A8.4 8.4 0 0 1 9.5 18" /><path d="M13 4.2 14.8 6l-1.8 1.8M11 19.8 9.2 18l1.8-1.8" /></Svg>)
const V1MagicPlus = (p: P) => (<Svg {...p}><Dot x={12} y={4.5} r={1.9} /><Dot x={12} y={19.5} r={1.9} /><Dot x={4.5} y={12} r={1.9} /><Dot x={19.5} y={12} r={1.9} /><path d="M12 6.6 12 12l-5.4 0M12 17.4 12 12l5.4 0" /></Svg>)
const V1MagicX = (p: P) => (
  <Svg {...p}><g transform="rotate(45 12 12)"><Dot x={6} y={6} r={1.9} /><Dot x={18} y={6} r={1.9} /><Dot x={6} y={18} r={1.9} /><Dot x={18} y={18} r={1.9} /><path d="M7.4 7.4 12 12l4.6-4.6M7.4 16.6 12 12l4.6 4.6" /></g><Dot x={12} y={12} r={1.1} /></Svg>
)
const V1AddPoint = (p: P) => (<Svg {...p}><Dot x={6.5} y={17.5} /><Dot x={14} y={10} /><path d="M8.1 15.9 12.4 11.6" /><Node x={19} y={5} r={2.6} /><path d="M19 3.4v3.2M17.4 5h3.2" strokeWidth={1.2} /></Svg>)
const V1Library = (p: P) => (<Svg {...p}><rect x={3.5} y={8} width={17} height={8} rx={4} /><Dot x={8.5} y={12} r={1.7} /><Dot x={12} y={12} r={1.7} /><Dot x={15.5} y={12} r={1.7} /></Svg>)
const V1Share = (p: P) => (<Svg {...p}><Dot x={6.5} y={17.5} /><path d="M8.1 15.9 11 13" /><Node x={17.5} y={6.5} r={2.6} /><path d="M13.2 10.8 15 9" strokeWidth={1.2} strokeDasharray="0.1 2.6" /></Svg>)
const V1Growth = (p: P) => (<Svg {...p}><Dot x={4.5} y={12} r={1.6} /><Dot x={10} y={9.5} r={1.6} /><Dot x={10} y={14.5} r={1.6} /><path d="M10 10.8v2.4" strokeWidth={1.2} /><Dot x={17} y={7.5} r={1.6} /><Dot x={21} y={7.5} r={1.6} /><Dot x={17} y={16.5} r={1.6} /><Dot x={21} y={16.5} r={1.6} /><path d="M17.9 8.6 19 10m1.1-1.4L19 10m-1.1 5.4L19 14m1.1 1.4L19 14M19 10v4" strokeWidth={1.2} /></Svg>)

const SET: { name: string; node: React.FC<P> }[] = [
  { name: 'pair', node: V1Pair }, { name: 'connect', node: V1Connect }, { name: 'effect', node: V1Effect },
  { name: 'receiver grid', node: V1Grid }, { name: 'remix', node: V1Remix }, { name: 'magic (+ var)', node: V1MagicPlus },
  { name: 'magic (× var)', node: V1MagicX }, { name: 'add point', node: V1AddPoint }, { name: 'library', node: V1Library },
  { name: 'share', node: V1Share }, { name: 'growth', node: V1Growth },
]

const aluminium: React.CSSProperties = { background: 'linear-gradient(#C3E1F2, #FAFAFA)', color: '#2C3A4A' }
const blackPole: React.CSSProperties = { background: '#0B0F12', color: '#E8EEF2' }

function Panel({ style, title }: { style: React.CSSProperties; title: string }) {
  return (
    <div style={{ ...style, borderRadius: 16, padding: '20px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SET.map(({ name, node: C }) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 84 }}>
            <C size={28} />
            <span style={{ fontSize: 10, opacity: 0.7, textAlign: 'center' }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MorphSetV1() {
  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', color: '#1a1a1a', padding: 16, maxWidth: 980 }}>
      <h2 style={{ fontWeight: 600 }}>DRAFT v1 — line grammar (dots + 1.5px tissue)</h2>
      <p style={{ fontSize: 13, color: '#555', maxWidth: 720 }}>
        First attempt, kept for the record. Verdict: wrong grammar for brand marks (the ONEMO X is a solid
        fluid mass, not a dot-line diagram) — see v2. The line register itself may suit diagram/annotation
        surfaces later. Per Dan: functional UI icons stay neutral canon — neither v1 nor v2 are toolbar icons.
      </p>
      <Panel style={aluminium} title="aluminium pole — v1 line set @28px" />
      <Panel style={blackPole} title="black pole — same set" />
    </div>
  )
}

const meta: Meta<typeof MorphSetV1> = { title: 'ONEMO/Drafts/Morph Set v1 — line grammar', component: MorphSetV1 }
export default meta
export const Draft: StoryObj<typeof MorphSetV1> = {}
