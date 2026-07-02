import type { Meta, StoryObj } from '@storybook/nextjs'
import React from 'react'
import {
  Angle,
  ArrowArcLeft,
  ArrowArcRight,
  ArrowCounterClockwise,
  BezierCurve,
  BoundingBox,
  Check,
  CircleHalf,
  CornersOut,
  Eye,
  EyeSlash,
  Faders,
  Gradient,
  ImageSquare,
  IntersectThree,
  LineSegment,
  MagicWand,
  Magnet,
  Palette,
  PlusCircle,
  Shapes,
  Sun,
  Thermometer,
  Trash,
  VectorTwo,
  Waveform,
  WaveSine,
  X,
} from '@phosphor-icons/react'

type Row = {
  category: string
  current: string
  icon: React.ReactNode
  actualJob: string
  productionName: string
  labelRule: 'shown label' | 'icon-only' | 'state pair'
  verdict: 'keep' | 'rename' | 'replace icon' | 'rename + replace icon'
  iconBrief: string
}

const SZ = 24
const P = (Icon: React.ElementType) => <Icon size={SZ} weight="light" />
const splitIcon: React.CSSProperties = { alignItems: 'center', display: 'inline-flex', gap: 4 }

const rows: Row[] = [
  {
    category: 'Creation dock',
    current: 'Image',
    icon: P(ImageSquare),
    actualJob: 'Add or replace the source photo.',
    productionName: 'Photo',
    labelRule: 'shown label',
    verdict: 'rename',
    iconBrief: 'Simple photo tile inside rounded square. No upload arrow unless the empty state needs it.',
  },
  {
    category: 'Creation dock',
    current: 'Magic',
    icon: P(MagicWand),
    actualJob: 'Run BEN to make an automatic subject cut-out from the photo.',
    productionName: 'Cutout',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Subject outline or cut path with one small sparkle. This is the only place where a magic accent is allowed.',
  },
  {
    category: 'Creation dock',
    current: 'Trim',
    icon: P(Palette),
    actualJob: 'Choose the back material color from swatches or a custom picker.',
    productionName: 'Material',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Material swatch/backplate icon. Avoid artist palette: this is product material, not drawing color.',
  },
  {
    category: 'Creation dock',
    current: 'Filters',
    icon: P(IntersectThree),
    actualJob: 'Open photo controls: brightness, contrast, color, warmth, blur, plus photo pan/zoom gesture.',
    productionName: 'Photo',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Recovered prior microcopy: this is the photo control surface, not Filters and not Adjust. Copy conflict remains because Image also maps to Photo; solve with source-photo naming or icon-only treatment, not by reusing Adjust.',
  },
  {
    category: 'Creation dock',
    current: 'Editor',
    icon: P(BezierCurve),
    actualJob: 'Open the contour editor for shape, points, outline controls, and preview.',
    productionName: 'Outline',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Cutline/outline frame with two visible nodes. Avoid compass/pencil metaphors.',
  },
  {
    category: 'Editor top bar',
    current: 'Points',
    icon: P(VectorTwo),
    actualJob: 'Toggle frame mode into point/anchor editing.',
    productionName: 'Points',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Two or three nodes on a path. Current idea is directionally correct.',
  },
  {
    category: 'Editor top bar',
    current: 'Preview / Edit',
    icon: (
      <span style={splitIcon}>
        {P(Eye)}
        {P(EyeSlash)}
      </span>
    ),
    actualJob: 'Hide editing chrome to see the clean cut-out, then return to editing.',
    productionName: 'Preview / Edit',
    labelRule: 'state pair',
    verdict: 'keep',
    iconBrief: 'Eye and eye-off are standard and should remain conventional.',
  },
  {
    category: 'Editor dock',
    current: 'Shape',
    icon: P(Shapes),
    actualJob: 'Choose or import the source outline shape.',
    productionName: 'Shape',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Single clean shape stack or one rounded primitive. Current multi-shape glyph is acceptable but slightly generic.',
  },
  {
    category: 'Editor dock',
    current: 'Magic',
    icon: P(MagicWand),
    actualJob: 'Re-run the automatic cut-out while staying in the editor.',
    productionName: 'Recut',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Same family as Cutout, but with refresh/cutline motion. Avoid a second generic wand.',
  },
  {
    category: 'Editor dock',
    current: 'Adjust',
    icon: P(Faders),
    actualJob: 'Open vector/outline controls: corners, curve, detail, smoothing, cleanup, angle, straight lines.',
    productionName: 'Edges',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Outline/edge tuning glyph. Faders reads generic settings and collides with photo adjustment.',
  },
  {
    category: 'Point bar',
    current: 'Add point',
    icon: P(PlusCircle),
    actualJob: 'Insert a new anchor after the selected anchor or at the selected segment midpoint.',
    productionName: 'Add',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Point on path plus sign. Plus-in-circle is acceptable but should connect to a path in the custom set.',
  },
  {
    category: 'Point bar',
    current: 'Delete point',
    icon: P(Trash),
    actualJob: 'Remove the selected anchor.',
    productionName: 'Delete',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Trash is conventional. If custom, keep it extremely simple.',
  },
  {
    category: 'Point bar',
    current: 'Smooth / Sharpen',
    icon: P(BoundingBox),
    actualJob: 'Toggle the selected anchor between smooth handles and a sharp corner.',
    productionName: 'Corner',
    labelRule: 'state pair',
    verdict: 'rename + replace icon',
    iconBrief: 'One point changing from round curve to corner. Bounding box is misleading.',
  },
  {
    category: 'Outline controls',
    current: 'Radius / Corner',
    icon: P(CornersOut),
    actualJob: 'Round all applicable corners, or round the selected corner when a corner point is selected.',
    productionName: 'Corners',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Rounded corner arc in an L-corner. This is the clearest custom-priority icon.',
  },
  {
    category: 'Outline controls',
    current: 'Curve',
    icon: P(BezierCurve),
    actualJob: 'Change bend/tension of the selected anchor.',
    productionName: 'Curve',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Anchor with two handles or one bent segment. Keep it vector-editing conventional.',
  },
  {
    category: 'Outline controls',
    current: 'Detail',
    icon: P(Waveform),
    actualJob: 'Master trace-detail dial that derives the fairing values.',
    productionName: 'Detail',
    labelRule: 'shown label',
    verdict: 'replace icon',
    iconBrief: 'Path with fewer/more points. Avoid waveform/audio metaphor.',
  },
  {
    category: 'Outline controls',
    current: 'Smooth',
    icon: P(WaveSine),
    actualJob: 'Move the whole outline from sharper/angular to rounder/smoother.',
    productionName: 'Smooth',
    labelRule: 'shown label',
    verdict: 'replace icon',
    iconBrief: 'Angular path becoming rounded path. No sine wave.',
  },
  {
    category: 'Outline controls',
    current: 'Snap',
    icon: P(Magnet),
    actualJob: 'Clean small trace detail by changing the detail-point threshold.',
    productionName: 'Clean',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'No magnet. Show small jitter collapsing into one clean contour.',
  },
  {
    category: 'Outline controls',
    current: 'Angle',
    icon: P(Angle),
    actualJob: 'Tune the turn-angle threshold used by the vector fairing.',
    productionName: 'Angles',
    labelRule: 'shown label',
    verdict: 'rename',
    iconBrief: 'Simple corner angle. Current icon is close enough.',
  },
  {
    category: 'Outline controls',
    current: 'Line',
    icon: P(LineSegment),
    actualJob: 'Tune the minimum straight-run threshold.',
    productionName: 'Straights',
    labelRule: 'shown label',
    verdict: 'rename + replace icon',
    iconBrief: 'Straight segment inside a contour. LineSegment is too abstract alone.',
  },
  {
    category: 'Photo controls',
    current: 'Bright',
    icon: P(Sun),
    actualJob: 'Brightness percentage.',
    productionName: 'Brightness',
    labelRule: 'shown label',
    verdict: 'rename',
    iconBrief: 'Sun is conventional. Keep simple.',
  },
  {
    category: 'Photo controls',
    current: 'Contrast',
    icon: P(CircleHalf),
    actualJob: 'Contrast percentage.',
    productionName: 'Contrast',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Half-circle contrast symbol is conventional.',
  },
  {
    category: 'Photo controls',
    current: 'Color',
    icon: P(Palette),
    actualJob: 'Saturation percentage.',
    productionName: 'Color',
    labelRule: 'shown label',
    verdict: 'replace icon',
    iconBrief: 'Droplet or simple color intensity mark. Avoid palette because Material already owns swatches.',
  },
  {
    category: 'Photo controls',
    current: 'Warmth',
    icon: P(Thermometer),
    actualJob: 'Warmth/sepia amount.',
    productionName: 'Warmth',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Thermometer is acceptable if kept light and not medical-looking.',
  },
  {
    category: 'Photo controls',
    current: 'Blend',
    icon: P(Gradient),
    actualJob: 'Blur the full photo behind the sharp subject matte.',
    productionName: 'Blur',
    labelRule: 'shown label',
    verdict: 'rename',
    iconBrief: 'Soft backdrop blur symbol. Current gradient direction is better than sparkle.',
  },
  {
    category: 'Global actions',
    current: 'Undo / Redo',
    icon: (
      <span style={splitIcon}>
        {P(ArrowArcLeft)}
        {P(ArrowArcRight)}
      </span>
    ),
    actualJob: 'Step backward/forward through global or editor history.',
    productionName: 'Undo / Redo',
    labelRule: 'state pair',
    verdict: 'keep',
    iconBrief: 'Keep standard arrows.',
  },
  {
    category: 'Global actions',
    current: 'Reset',
    icon: P(ArrowCounterClockwise),
    actualJob: 'Return to the fresh standard square for the current photo.',
    productionName: 'Reset',
    labelRule: 'shown label',
    verdict: 'keep',
    iconBrief: 'Circular reset arrow is standard.',
  },
  {
    category: 'Global actions',
    current: 'Close / Done',
    icon: (
      <span style={splitIcon}>
        {P(X)}
        {P(Check)}
      </span>
    ),
    actualJob: 'Cancel/close an editing surface, or commit a change.',
    productionName: 'Close / Done',
    labelRule: 'state pair',
    verdict: 'keep',
    iconBrief: 'Keep standard X/check.',
  },
]

function ProductionNaming() {
  const grouped = rows.reduce<Record<string, Row[]>>((acc, row) => {
    ;(acc[row.category] ??= []).push(row)
    return acc
  }, {})

  return (
    <main style={page}>
      <header style={header}>
        <p style={eyebrow}>Effect Creator v3 / microcopy and custom icon brief</p>
        <h1 style={title}>What The Icons Actually Do</h1>
        <p style={intro}>
          Current labels are implementation/mock names. This page maps each live control to its
          actual job, proposed production copy, and custom-icon intent. Any label shown under an
          icon must be one word.
        </p>
      </header>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} style={section}>
          <h2 style={sectionTitle}>{category}</h2>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Current</th>
                <th style={th}>Icon</th>
                <th style={th}>Actual job</th>
                <th style={th}>Production copy</th>
                <th style={th}>Label rule</th>
                <th style={th}>Decision</th>
                <th style={th}>Custom icon brief</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${row.category}-${row.current}`}>
                  <td style={td}><strong>{row.current}</strong></td>
                  <td style={iconTd}><span style={iconBox}>{row.icon}</span></td>
                  <td style={td}>{row.actualJob}</td>
                  <td style={nameTd}>{row.productionName}</td>
                  <td style={td}><span style={rulePill(row.labelRule)}>{row.labelRule}</span></td>
                  <td style={td}><span style={pill(row.verdict)}>{row.verdict}</span></td>
                  <td style={td}>{row.iconBrief}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  )
}

const page: React.CSSProperties = {
  background: '#f7f4ee',
  color: '#141719',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  minHeight: '100vh',
  padding: 24,
}

const header: React.CSSProperties = { maxWidth: 980, marginBottom: 24 }
const eyebrow: React.CSSProperties = { color: '#7d7469', fontSize: 12, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }
const title: React.CSSProperties = { fontSize: 42, lineHeight: 1.02, margin: '8px 0 10px', letterSpacing: '-0.045em' }
const intro: React.CSSProperties = { color: '#5e574f', fontSize: 15, lineHeight: 1.45, margin: 0, maxWidth: 760 }
const section: React.CSSProperties = { background: '#fffdf8', border: '1px solid #ded6cb', borderRadius: 18, marginBottom: 18, overflow: 'hidden' }
const sectionTitle: React.CSSProperties = { fontSize: 18, letterSpacing: '-0.02em', margin: 0, padding: '16px 18px 10px' }
const table: React.CSSProperties = { borderCollapse: 'collapse', fontSize: 12, width: '100%' }
const th: React.CSSProperties = { borderTop: '1px solid #e6ded3', color: '#6d655c', fontSize: 10, letterSpacing: '0.08em', padding: '9px 10px', textAlign: 'left', textTransform: 'uppercase' }
const td: React.CSSProperties = { borderTop: '1px solid #eee7dc', lineHeight: 1.35, padding: '10px', verticalAlign: 'top' }
const iconTd: React.CSSProperties = { ...td, textAlign: 'center', width: 58 }
const nameTd: React.CSSProperties = { ...td, fontSize: 15, fontWeight: 750, letterSpacing: '-0.02em' }
const iconBox: React.CSSProperties = { alignItems: 'center', display: 'inline-flex', justifyContent: 'center', minHeight: 28, minWidth: 34 }

function rulePill(kind: Row['labelRule']): React.CSSProperties {
  const color = kind === 'shown label' ? '#214a5a' : kind === 'icon-only' ? '#4c4c4c' : '#62551e'
  const bg = kind === 'shown label' ? '#dceef5' : kind === 'icon-only' ? '#ececec' : '#f3edcf'
  return {
    background: bg,
    borderRadius: 999,
    color,
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 750,
    letterSpacing: '0.04em',
    padding: '4px 7px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

function pill(kind: Row['verdict']): React.CSSProperties {
  const color = kind === 'keep' ? '#345c39' : kind === 'rename' ? '#62551e' : kind === 'replace icon' ? '#633b1d' : '#6b2424'
  const bg = kind === 'keep' ? '#e8f3e6' : kind === 'rename' ? '#f3edcf' : kind === 'replace icon' ? '#f3e3d5' : '#f3d8d8'
  return {
    background: bg,
    borderRadius: 999,
    color,
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 750,
    letterSpacing: '0.04em',
    padding: '4px 7px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

const meta: Meta<typeof ProductionNaming> = {
  title: 'Icons/V3 Current/Production Naming',
  component: ProductionNaming,
  parameters: { layout: 'fullscreen' },
}

export default meta
export const MicrocopyAndIconBrief: StoryObj<typeof ProductionNaming> = {}
