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
  CompassTool,
  CornersOut,
  DiceFive,
  DownloadSimple,
  Drop,
  Eye,
  EyeSlash,
  Faders,
  Gradient,
  ImageSquare,
  IntersectThree,
  LineSegment,
  MagicWand,
  Magnet,
  Minus,
  Palette,
  Plus,
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
import {
  Activity as UActivity,
  BezierCurve01,
  Check as UCheck,
  Contrast01,
  Dice5 as UDice,
  Download01,
  Droplets01,
  Eye as UEye,
  EyeOff as UEyeOff,
  Image01,
  MagicWand01,
  Maximize02,
  Minus as UMinus,
  Palette as UPalette,
  Pencil01,
  Pentagon as UPentagon,
  PlusCircle as UPlusCircle,
  RefreshCw01,
  ReverseLeft,
  ReverseRight,
  Ruler as URuler,
  Scan as UScan,
  Sliders01,
  Star06,
  Sun as USun,
  Thermometer01,
  Triangle as UTriangle,
  Trash01,
  X as UX,
} from '@untitledui/icons'
import {
  AngleTool,
  Check as ICheck,
  DiceFive as IDice,
  Download as IDownload,
  Droplet as IDroplet,
  Edit as IEdit,
  Eye as IEye,
  EyeClosed,
  Frame as IFrame,
  HalfMoon,
  MagicWand as IMagicWand,
  MediaImage,
  Minus as IMinus,
  Palette as IPalette,
  Pentagon as IPentagon,
  PlusCircle as IPlusCircle,
  Refresh as IRefresh,
  Redo as IRedo,
  Ruler as IRuler,
  Settings as ISettings,
  SineWave,
  Sparks,
  SunLight,
  TemperatureUp,
  Trash as ITrash,
  Undo as IUndo,
  Xmark,
} from 'iconoir-react'
import {
  Activity as MActivity,
  Badge as MBadge,
  BoundingBox as MBoundingBox,
  Check as MCheck,
  CircleHalf as MCircleHalf,
  Dice5 as MDice,
  Download as MDownload,
  Droplet as MDroplet,
  Eye as MEye,
  EyeOff as MEyeOff,
  Image as MImage,
  Minus as MMinus,
  Pencil as MPencil,
  PlusCircle as MPlusCircle,
  Redo as MRedo,
  Refresh as MRefresh,
  Ruler as MRuler,
  Sparkles as MSparkles,
  Sun as MSun,
  Thermometer as MThermometer,
  Trash as MTrash,
  Triangle as MTriangle,
  Undo as MUndo,
  X as MX,
} from '@mynaui/icons-react'
import {
  AudioWaveform,
  Check as LCheck,
  Contrast as LContrast,
  Dice5 as LDice,
  Download as LDownload,
  Droplet as LDroplet,
  Eye as LEye,
  EyeOff as LEyeOff,
  Frame as LFrame,
  Image as LImage,
  Minus as LMinus,
  Palette as LPalette,
  Pencil as LPencil,
  PlusCircle as LPlusCircle,
  Redo as LRedo,
  RotateCw as LRotate,
  Ruler as LRuler,
  Shapes as LShapes,
  Sliders as LSliders,
  Sparkle as LSparkle,
  Spline as LSpline,
  Sun as LSun,
  Thermometer as LThermometer,
  Trash as LTrash,
  TriangleRight,
  Undo as LUndo,
  Wand as LWand,
  X as LX,
} from 'lucide-react'
import {
  IconAdjustments,
  IconAngle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCategory,
  IconCheck,
  IconCirclePlus,
  IconContrast,
  IconDice5,
  IconDownload,
  IconDroplet,
  IconEye,
  IconEyeOff,
  IconFrame,
  IconLine,
  IconPalette,
  IconPencil,
  IconPhoto,
  IconRotateClockwise,
  IconRuler,
  IconSparkles,
  IconSun,
  IconThermometer,
  IconTrash,
  IconVectorBezier,
  IconWand,
  IconWaveSine,
  IconX,
} from '@tabler/icons-react'

type Row = {
  category: string
  name: string
  current: React.ReactNode
  untitled?: React.ReactNode
  iconoir?: React.ReactNode
  myna?: React.ReactNode
  lucide?: React.ReactNode
  tabler?: React.ReactNode
}

const SZ = 24
const C = (Icon: React.ElementType) => <Icon size={SZ} />
const U = (Icon: React.ElementType) => <Icon size={SZ} strokeWidth={1.5} />
const I = (Icon: React.ElementType) => <Icon width={SZ} height={SZ} />
const M = (Icon: React.ElementType) => <Icon size={SZ} stroke={1.5} />
const L = (Icon: React.ElementType) => <Icon size={SZ} strokeWidth={1.5} />
const T = (Icon: React.ElementType) => <Icon size={SZ} stroke={1.5} />

const rows: Row[] = [
  { category: 'Global top bar', name: 'Undo', current: C(ArrowArcLeft), untitled: U(ReverseLeft), iconoir: I(IUndo), myna: M(MUndo), lucide: L(LUndo), tabler: T(IconArrowBackUp) },
  { category: 'Global top bar', name: 'Redo', current: C(ArrowArcRight), untitled: U(ReverseRight), iconoir: I(IRedo), myna: M(MRedo), lucide: L(LRedo), tabler: T(IconArrowForwardUp) },
  { category: 'Global top bar', name: 'Reset', current: C(ArrowCounterClockwise), untitled: U(RefreshCw01), iconoir: I(IRefresh), myna: M(MRefresh), lucide: L(LRotate), tabler: T(IconRotateClockwise) },
  { category: 'Global top bar', name: 'Export', current: C(DownloadSimple), untitled: U(Download01), iconoir: I(IDownload), myna: M(MDownload), lucide: L(LDownload), tabler: T(IconDownload) },

  { category: 'Commit / cancel actions', name: 'Close', current: C(X), untitled: U(UX), iconoir: I(Xmark), myna: M(MX), lucide: L(LX), tabler: T(IconX) },
  { category: 'Commit / cancel actions', name: 'Done', current: C(Check), untitled: U(UCheck), iconoir: I(ICheck), myna: M(MCheck), lucide: L(LCheck), tabler: T(IconCheck) },

  { category: 'Editor top bar', name: 'Points', current: C(VectorTwo), untitled: U(BezierCurve01), iconoir: I(IFrame), myna: M(MBoundingBox), lucide: L(LSpline), tabler: T(IconVectorBezier) },
  { category: 'Editor top bar', name: 'Preview', current: C(Eye), untitled: U(UEye), iconoir: I(IEye), myna: M(MEye), lucide: L(LEye), tabler: T(IconEye) },
  { category: 'Editor top bar', name: 'Edit', current: C(EyeSlash), untitled: U(UEyeOff), iconoir: I(EyeClosed), myna: M(MEyeOff), lucide: L(LEyeOff), tabler: T(IconEyeOff) },

  { category: 'Hero creation dock', name: 'Image', current: C(ImageSquare), untitled: U(Image01), iconoir: I(MediaImage), myna: M(MImage), lucide: L(LImage), tabler: T(IconPhoto) },
  { category: 'Hero creation dock', name: 'Magic', current: C(MagicWand), untitled: U(MagicWand01), iconoir: I(IMagicWand), lucide: L(LWand), tabler: T(IconWand) },
  { category: 'Hero creation dock', name: 'Trim', current: C(Palette), untitled: U(UPalette), iconoir: I(IPalette), lucide: L(LPalette), tabler: T(IconPalette) },
  { category: 'Hero creation dock', name: 'Filters', current: C(IntersectThree), untitled: U(UScan), iconoir: I(ISettings), myna: M(MBoundingBox), lucide: L(LSliders), tabler: T(IconAdjustments) },
  { category: 'Hero creation dock', name: 'Editor', current: C(CompassTool), untitled: U(Pencil01), iconoir: I(IEdit), myna: M(MPencil), lucide: L(LPencil), tabler: T(IconPencil) },

  { category: 'Editor dock and node bar', name: 'Shape', current: C(Shapes), untitled: U(UPentagon), iconoir: I(IPentagon), myna: M(MBadge), lucide: L(LShapes), tabler: T(IconCategory) },
  { category: 'Editor dock and node bar', name: 'Adjust', current: C(Faders), untitled: U(Sliders01), iconoir: I(ISettings), lucide: L(LSliders), tabler: T(IconAdjustments) },
  { category: 'Editor dock and node bar', name: 'Smooth / Sharpen', current: C(BoundingBox), untitled: U(UScan), iconoir: I(IFrame), myna: M(MBoundingBox), lucide: L(LFrame), tabler: T(IconFrame) },
  { category: 'Editor dock and node bar', name: 'Add point', current: C(PlusCircle), untitled: U(UPlusCircle), iconoir: I(IPlusCircle), myna: M(MPlusCircle), lucide: L(LPlusCircle), tabler: T(IconCirclePlus) },
  { category: 'Editor dock and node bar', name: 'Delete point', current: C(Trash), untitled: U(Trash01), iconoir: I(ITrash), myna: M(MTrash), lucide: L(LTrash), tabler: T(IconTrash) },

  { category: 'Adjust vector controls', name: 'Radius / Corner', current: C(CornersOut), untitled: U(Maximize02), iconoir: I(IFrame), myna: M(MBoundingBox), lucide: L(LFrame), tabler: T(IconFrame) },
  { category: 'Adjust vector controls', name: 'Curve', current: C(BezierCurve), untitled: U(BezierCurve01), lucide: L(LSpline), tabler: T(IconVectorBezier) },
  { category: 'Adjust vector controls', name: 'Detail', current: C(Waveform), untitled: U(UActivity), iconoir: I(SineWave), myna: M(MActivity), lucide: L(AudioWaveform), tabler: T(IconWaveSine) },
  { category: 'Adjust vector controls', name: 'Smooth', current: C(WaveSine), untitled: U(UActivity), iconoir: I(SineWave), myna: M(MActivity), lucide: L(AudioWaveform), tabler: T(IconWaveSine) },
  { category: 'Adjust vector controls', name: 'Snap', current: C(Magnet), untitled: U(URuler), iconoir: I(IRuler), myna: M(MRuler), lucide: L(LRuler), tabler: T(IconRuler) },
  { category: 'Adjust vector controls', name: 'Angle', current: C(Angle), untitled: U(UTriangle), iconoir: I(AngleTool), myna: M(MTriangle), lucide: L(TriangleRight), tabler: T(IconAngle) },
  { category: 'Adjust vector controls', name: 'Line', current: C(LineSegment), untitled: U(UMinus), iconoir: I(IMinus), myna: M(MMinus), lucide: L(LMinus), tabler: T(IconLine) },

  { category: 'Image filter controls', name: 'Bright', current: C(Sun), untitled: U(USun), iconoir: I(SunLight), myna: M(MSun), lucide: L(LSun), tabler: T(IconSun) },
  { category: 'Image filter controls', name: 'Contrast', current: C(CircleHalf), untitled: U(Contrast01), iconoir: I(HalfMoon), myna: M(MCircleHalf), lucide: L(LContrast), tabler: T(IconContrast) },
  { category: 'Image filter controls', name: 'Color', current: C(Drop), untitled: U(Droplets01), iconoir: I(IDroplet), myna: M(MDroplet), lucide: L(LDroplet), tabler: T(IconDroplet) },
  { category: 'Image filter controls', name: 'Warmth', current: C(Thermometer), untitled: U(Thermometer01), iconoir: I(TemperatureUp), myna: M(MThermometer), lucide: L(LThermometer), tabler: T(IconThermometer) },
  { category: 'Image filter controls', name: 'Blend', current: C(Gradient), untitled: U(Star06), iconoir: I(Sparks), myna: M(MSparkles), lucide: L(LSparkle), tabler: T(IconSparkles) },

  { category: 'Shape sheet controls', name: 'Upload', current: C(Plus), untitled: U(UPlusCircle), iconoir: I(IPlusCircle), myna: M(MPlusCircle), lucide: L(LPlusCircle), tabler: T(IconCirclePlus) },
  { category: 'Shape sheet controls', name: 'More', current: C(Plus), untitled: U(UPlusCircle), iconoir: I(IPlusCircle), myna: M(MPlusCircle), lucide: L(LPlusCircle), tabler: T(IconCirclePlus) },
  { category: 'Shape sheet controls', name: 'Fewer', current: C(Minus), untitled: U(UMinus), iconoir: I(IMinus), myna: M(MMinus), lucide: L(LMinus), tabler: T(IconLine) },
  { category: 'Shape sheet controls', name: 'New blob', current: C(DiceFive), untitled: U(UDice), iconoir: I(IDice), myna: M(MDice), lucide: L(LDice), tabler: T(IconDice5) },
]

function renderCell(node?: React.ReactNode) {
  return <span style={iconCell}>{node ?? <span style={dash}>-</span>}</span>
}

function GroupedComparison() {
  const groups = [...new Set(rows.map((row) => row.category))]
  return (
    <div style={page}>
      <header style={header}>
        <p style={eyebrow}>Effect Creator v3 / icon comparison</p>
        <h1 style={title}>Grouped Current Icons</h1>
        <p style={intro}>
          User-facing icon names first. Current v3 build second. Other columns are visual candidates
          only, grouped by where the icon is used.
        </p>
      </header>
      <section style={section}>
        <table style={table}>
          <thead>
            <tr>
              <th style={nameTh}>Icon name</th>
              <th style={th}>Current v3</th>
              <th style={th}>Untitled</th>
              <th style={th}>Iconoir</th>
              <th style={th}>Myna</th>
              <th style={th}>Lucide</th>
              <th style={th}>Tabler</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group}>
                <tr><td colSpan={7} style={groupCell}>{group}</td></tr>
                {rows.filter((row) => row.category === group).map((row) => (
                  <tr key={`${row.category}-${row.name}`}>
                    <td style={nameTd}>{row.name}</td>
                    <td style={td}>{renderCell(row.current)}</td>
                    <td style={td}>{renderCell(row.untitled)}</td>
                    <td style={td}>{renderCell(row.iconoir)}</td>
                    <td style={td}>{renderCell(row.myna)}</td>
                    <td style={td}>{renderCell(row.lucide)}</td>
                    <td style={td}>{renderCell(row.tabler)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

const page: React.CSSProperties = {
  background: '#f5f1e9',
  color: '#1b1a18',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  minHeight: '100vh',
  padding: 24,
}
const header: React.CSSProperties = { maxWidth: 980, marginBottom: 24 }
const eyebrow: React.CSSProperties = { color: '#827568', fontSize: 12, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }
const title: React.CSSProperties = { fontSize: 40, lineHeight: 1.05, margin: '8px 0 10px', letterSpacing: '-0.04em' }
const intro: React.CSSProperties = { color: '#5d554d', fontSize: 15, lineHeight: 1.45, margin: 0, maxWidth: 760 }
const section: React.CSSProperties = { background: '#fffaf2', border: '1px solid #ded4c4', borderRadius: 18, overflow: 'auto', padding: 18 }
const table: React.CSSProperties = { borderCollapse: 'collapse', fontSize: 12, minWidth: 920, width: '100%' }
const th: React.CSSProperties = { borderBottom: '1px solid #d8cdbb', color: '#6a6259', fontSize: 11, padding: '8px 10px', textAlign: 'center', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const nameTh: React.CSSProperties = { ...th, textAlign: 'left', width: 190 }
const td: React.CSSProperties = { borderTop: '1px solid #eee5d8', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }
const nameTd: React.CSSProperties = { ...td, fontSize: 13, fontWeight: 700, textAlign: 'left' }
const groupCell: React.CSSProperties = { background: '#221f1b', color: '#f7f1e7', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', padding: '9px 10px', textTransform: 'uppercase' }
const iconCell: React.CSSProperties = { alignItems: 'center', display: 'inline-flex', height: 34, justifyContent: 'center', width: 34 }
const dash: React.CSSProperties = { color: '#c1b7aa', fontSize: 16 }

const meta: Meta<typeof GroupedComparison> = { title: 'Icons/V3 Current/Grouped Comparison', component: GroupedComparison }
export default meta
export const ByApplication: StoryObj<typeof GroupedComparison> = {}
