'use client'

// Editor toolbar icons. Phosphor Icons (MIT, premium/editorial, SF-Symbols-like) for the standard
// glyphs — chosen over Lucide so the UI doesn't read as generic shadcn/SaaS. `weight="regular"`
// (default) reads cleanly at 24px on mobile; icons inherit `currentColor` from the button.

import { ArrowArcLeft, ArrowArcRight, ArrowCounterClockwise, BezierCurve, DiceFive, WaveSine, Check, X, Plus, Minus, Trash, PlusCircle, Sparkle, ImageSquare, PencilSimple, BoundingBox, Palette, DownloadSimple, Shapes, Eye, EyeSlash, MagicWand, Faders, Crop, Sun, CircleHalf, Drop, Thermometer, VectorTwo, Waveform, Magnet, Angle, LineSegment, CornersOut, Gradient } from '@phosphor-icons/react'

type P = { className?: string }
const SZ = 24

export const UndoIcon = (p: P) => <ArrowArcLeft size={SZ} className={p.className} />
export const RedoIcon = (p: P) => <ArrowArcRight size={SZ} className={p.className} />
// KAI-9003 (Dan): RESET is an icon button like its top-bar siblings — not a pill.
export const ResetIcon = (p: P) => <ArrowCounterClockwise size={SZ} className={p.className} />
export const DiceIcon = (p: P) => <DiceFive size={SZ} className={p.className} /> // blob generator reroll
export const SmoothIcon = (p: P) => <WaveSine size={SZ} className={p.className} />
export const CheckIcon = (p: P) => <Check size={SZ} className={p.className} />
export const CloseIcon = (p: P) => <X size={SZ} className={p.className} />
// Export — the mm-true SVG cutline download (temporary top-bar home until the save/library round).
export const ExportIcon = (p: P) => <DownloadSimple size={SZ} className={p.className} />
// Preview toggle — Eye (show clean result, hide anchors) / EyeSlash (back to editing).
export const PreviewIcon = (p: P) => <Eye size={SZ} className={p.className} />
export const PreviewOffIcon = (p: P) => <EyeSlash size={SZ} className={p.className} />
export const PlusIcon = (p: P) => <Plus size={SZ} className={p.className} />
// Frame ⇄ Points mode toggle — explicit button per Dan's ruling (KAI-9022); double-tap stays as the gesture.
export const PointsIcon = (p: P) => <VectorTwo size={SZ} className={p.className} />
// KAI-9017: the unified Adjust row — every vector dial is an icon chip (Phosphor-for-now;
// final icon selection rides sidekick's design-system research track).
export const CornerIcon = (p: P) => <CornersOut size={SZ} className={p.className} /> // Radius
export const DetailIcon = (p: P) => <Waveform size={SZ} className={p.className} />
export const SnapIcon = (p: P) => <Magnet size={SZ} className={p.className} />
export const AngleIcon = (p: P) => <Angle size={SZ} className={p.className} /> // restored (KAI-9017)
export const LineIcon = (p: P) => <LineSegment size={SZ} className={p.className} /> // restored (KAI-9017)
export const MinusIcon = (p: P) => <Minus size={SZ} className={p.className} />
export const AddPointIcon = (p: P) => <PlusCircle size={SZ} className={p.className} />
export const DeleteIcon = (p: P) => <Trash size={SZ} className={p.className} />
// KAI-9030 (Dan): the Blend effect IS a blur — the soft-gradient glyph reads as one.
// (Label rename Blend→Blur awaits Dan's word.)
export const BlurIcon = (p: P) => <Gradient size={SZ} className={p.className} />
// "Magic blend" — sparkle = the premium soft-background blend (toggle + intensity).
export const BlendIcon = (p: P) => <Sparkle size={SZ} className={p.className} />

// First screen (artwork toolbar) icons — paired with the brand pills.
export const UploadIcon = (p: P) => <ImageSquare size={SZ} className={p.className} />
export const EditIcon = (p: P) => <PencilSimple size={SZ} className={p.className} />
export const OutlineIcon = (p: P) => <BoundingBox size={SZ} className={p.className} />
export const ColorsIcon = (p: P) => <Palette size={SZ} className={p.className} />
// Magic wand — runs BEN to auto-generate the subject cut-out from the flat square.
export const MagicIcon = (p: P) => <MagicWand size={SZ} className={p.className} />

// Round corners — Phosphor ships no corner-radius glyph; custom inline (Phosphor-coherent 2px stroke).

// ── Shape tool + chip icons ─────────────────────────────────────────────────
export const RoundIcon = (p: P) => <BezierCurve size={SZ} className={p.className} /> // corner-radius control (returned by use, 2026-06-10)
export const ShapeIcon = (p: P) => <Shapes size={SZ} className={p.className} />
export const TuneIcon = (p: P) => <Faders size={SZ} className={p.className} /> // BEN runtime tuning dash (Dan, 2026-06-10)
export const ImageToolIcon = (p: P) => <Crop size={SZ} className={p.className} /> // #28: image mode inside the editor (Dan: "like crop tool")
export const BrightnessIcon = (p: P) => <Sun size={SZ} className={p.className} />
export const ContrastIcon = (p: P) => <CircleHalf size={SZ} className={p.className} />
export const SaturationIcon = (p: P) => <Drop size={SZ} className={p.className} />
export const WarmthIcon = (p: P) => <Thermometer size={SZ} className={p.className} />
