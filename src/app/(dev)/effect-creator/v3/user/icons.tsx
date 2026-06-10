'use client'

// Editor toolbar icons. Phosphor Icons (MIT, premium/editorial, SF-Symbols-like) for the standard
// glyphs — chosen over Lucide so the UI doesn't read as generic shadcn/SaaS. `weight="regular"`
// (default) reads cleanly at 24px on mobile; icons inherit `currentColor` from the button.

import { ArrowArcLeft, ArrowArcRight, ArrowsOutCardinal, BezierCurve, DiceFive, WaveSine, PenNib, ArrowClockwise, Check, X, ArrowsOut, Plus, Minus, Trash, PlusCircle, Sparkle, ImageSquare, PencilSimple, BoundingBox, Palette, FloppyDisk, Shapes, Polygon, Circle, Square, Pill, Star, Heart, ChatTeardrop, Seal, Shield, Eye, EyeSlash, MagicWand } from '@phosphor-icons/react'

type P = { className?: string }
const SZ = 24

export const UndoIcon = (p: P) => <ArrowArcLeft size={SZ} className={p.className} />
export const RedoIcon = (p: P) => <ArrowArcRight size={SZ} className={p.className} />
// "Hug" — corners pulling inward = the cut tightening around the subject.
export const PositionIcon = (p: P) => <ArrowsOutCardinal size={SZ} className={p.className} /> // G1: pan/zoom the photo within the shape
export const DiceIcon = (p: P) => <DiceFive size={SZ} className={p.className} /> // blob generator reroll
export const SmoothIcon = (p: P) => <WaveSine size={SZ} className={p.className} />
export const PenIcon = (p: P) => <PenNib size={SZ} className={p.className} />
export const ResetIcon = (p: P) => <ArrowClockwise size={SZ} className={p.className} />
export const CheckIcon = (p: P) => <Check size={SZ} className={p.className} />
export const CloseIcon = (p: P) => <X size={SZ} className={p.className} />
// Save = apply the edit + collapse the open sub-menu (stays in the editor). Done = close the editor (CheckIcon).
export const SaveIcon = (p: P) => <FloppyDisk size={SZ} className={p.className} />
// Preview toggle — Eye (show clean result, hide anchors) / EyeSlash (back to editing).
export const PreviewIcon = (p: P) => <Eye size={SZ} className={p.className} />
export const PreviewOffIcon = (p: P) => <EyeSlash size={SZ} className={p.className} />
export const ScaleIcon = (p: P) => <ArrowsOut size={SZ} className={p.className} />
export const PlusIcon = (p: P) => <Plus size={SZ} className={p.className} />
export const MinusIcon = (p: P) => <Minus size={SZ} className={p.className} />
export const AddPointIcon = (p: P) => <PlusCircle size={SZ} className={p.className} />
export const DeleteIcon = (p: P) => <Trash size={SZ} className={p.className} />
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
export const PolygonChip = (p: P) => <Polygon size={SZ} className={p.className} />
export const StarChip = (p: P) => <Star size={SZ} className={p.className} />
export const CircleChip = (p: P) => <Circle size={SZ} className={p.className} />
export const SquareChip = (p: P) => <Square size={SZ} className={p.className} />
export const PillChip = (p: P) => <Pill size={SZ} className={p.className} />
export const HeartChip = (p: P) => <Heart size={SZ} className={p.className} />
export const SpeechChip = (p: P) => <ChatTeardrop size={SZ} className={p.className} />
export const BadgeChip = (p: P) => <Seal size={SZ} className={p.className} />
export const ShieldChip = (p: P) => <Shield size={SZ} className={p.className} />
// Phosphor has no squircle / blob / arch glyph — custom inline (Phosphor-coherent ~2px stroke).
export const SquircleChip = (p: P) => (
  <svg className={p.className} width={SZ} height={SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 12C3 5.5 5.5 3 12 3s9 2.5 9 9-2.5 9-9 9-9-2.5-9-9Z" />
  </svg>
)
export const BlobChip = (p: P) => (
  <svg className={p.className} width={SZ} height={SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3c3 0 5 1.4 6.5 3.5S21 11 20 13.5 16.5 20 13 20.5 6 20 4 17 2.5 11 4 6 9 3 12 3Z" />
  </svg>
)
export const ArchChip = (p: P) => (
  <svg className={p.className} width={SZ} height={SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V11a7 7 0 0 1 14 0v10" />
  </svg>
)
