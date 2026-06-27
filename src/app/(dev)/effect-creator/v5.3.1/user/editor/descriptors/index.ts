// editor/descriptors/index.ts — the ONE tool registry (Phase 4 · inv 30).
//
// The single list of every editor tool descriptor. "Remove a tool" = delete its file + its one line here
// (never edits a shared controller). The composer (useEditor) filters this by the runtime `toolEnabled`
// predicate, so a runtime-disabled tool is skipped LIVE with no code change. Populated in steps 3–5
// (shape tools, shape-pick, image tools).

import type { Descriptor } from './types'
import { shapePickDescriptor } from './shape/shape-pick'
import { detailDescriptor } from './shape/detail'
import { offsetDescriptor } from './shape/offset'
import { radiusDescriptor } from './shape/radius'
import { curveDescriptor } from './shape/curve'
import { simplifyDescriptor } from './shape/simplify'
import { smoothDescriptor } from './shape/smooth'
import { straightenDescriptor } from './shape/straighten'
import { brightnessDescriptor } from './image/brightness'
import { contrastDescriptor } from './image/contrast'
import { saturateDescriptor } from './image/saturate'
import { warmthDescriptor } from './image/warmth'
import { presetDescriptor } from './image/preset'
import { tintDescriptor } from './image/tint'
import { vignetteDescriptor } from './image/vignette'
import { blendDescriptor } from './image/blend'
import { fillDescriptor } from './image/fill'

export const TOOL_REGISTRY: Descriptor[] = [
  // step 4: shape-pick (the PickerDescriptor — Shape outlet)
  shapePickDescriptor,
  // step 3: shape/adjust tools (7) — generation: detail · offset; edit: radius · curve; global: simplify · smooth · straighten
  detailDescriptor,
  offsetDescriptor,
  radiusDescriptor,
  curveDescriptor,
  simplifyDescriptor,
  smoothDescriptor,
  straightenDescriptor,
  // step 5: image tools (image outlet — editor Image mode + hero FiltersSurface both render these)
  brightnessDescriptor,
  contrastDescriptor,
  saturateDescriptor,
  warmthDescriptor,
  presetDescriptor,
  tintDescriptor,
  vignetteDescriptor,
  blendDescriptor,
  fillDescriptor,
]

export { isPickerDescriptor } from './types'
