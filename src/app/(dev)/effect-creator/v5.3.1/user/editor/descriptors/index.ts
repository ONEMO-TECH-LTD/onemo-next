// editor/descriptors/index.ts — the ONE tool registry (Phase 4 · inv 30).
//
// The single list of every editor tool descriptor. "Remove a tool" = delete its file + its one line here
// (never edits a shared controller). The composer (useEditor) filters this by the runtime `toolEnabled`
// predicate, so a runtime-disabled tool is skipped LIVE with no code change. Populated in steps 3–5
// (shape tools, shape-pick, image tools).

import type { ToolDescriptor } from './types'
import { simplifyDescriptor } from './shape/simplify'
import { smoothDescriptor } from './shape/smooth'
import { straightenDescriptor } from './shape/straighten'

export const TOOL_REGISTRY: ToolDescriptor[] = [
  // step 3: shape/adjust tools — global axes (radius · curve · detail · offset still to land this step)
  simplifyDescriptor,
  smoothDescriptor,
  straightenDescriptor,
  // step 4: shape-pick
  // step 5: image tools (brightness · contrast · saturation · warmth · preset · tint · vignette · blend · fill)
]
