'use client'

// Editor toolbar icons. Phosphor Icons (MIT, premium/editorial, SF-Symbols-like) for the standard
// glyphs — chosen over Lucide so the UI doesn't read as generic shadcn/SaaS. `weight="regular"`
// (default) reads cleanly at 24px on mobile; icons inherit `currentColor` from the button. One custom
// inline icon ("Round corners") covers the single concept Phosphor has no glyph for, matched to the
// Phosphor regular ~2px stroke so the set stays visually coherent.

import { ArrowArcLeft, ArrowArcRight, CornersIn, WaveSine, PenNib, ArrowClockwise, Check, X, ArrowsOut, Plus, Minus, Trash, PlusCircle } from '@phosphor-icons/react'

type P = { className?: string }
const SZ = 24

export const UndoIcon = (p: P) => <ArrowArcLeft size={SZ} className={p.className} />
export const RedoIcon = (p: P) => <ArrowArcRight size={SZ} className={p.className} />
// "Hug" — corners pulling inward = the cut tightening around the subject.
export const HugIcon = (p: P) => <CornersIn size={SZ} className={p.className} />
export const SmoothIcon = (p: P) => <WaveSine size={SZ} className={p.className} />
export const PenIcon = (p: P) => <PenNib size={SZ} className={p.className} />
export const ResetIcon = (p: P) => <ArrowClockwise size={SZ} className={p.className} />
export const CheckIcon = (p: P) => <Check size={SZ} className={p.className} />
export const CloseIcon = (p: P) => <X size={SZ} className={p.className} />
export const ScaleIcon = (p: P) => <ArrowsOut size={SZ} className={p.className} />
export const PlusIcon = (p: P) => <Plus size={SZ} className={p.className} />
export const MinusIcon = (p: P) => <Minus size={SZ} className={p.className} />
export const AddPointIcon = (p: P) => <PlusCircle size={SZ} className={p.className} />
export const DeleteIcon = (p: P) => <Trash size={SZ} className={p.className} />

// Round corners — Phosphor ships no corner-radius glyph; custom inline (Phosphor-coherent 2px stroke).
export const RoundIcon = (p: P) => (
  <svg className={p.className} width={SZ} height={SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 20v-6a9 9 0 0 1 9-9h6" />
  </svg>
)
