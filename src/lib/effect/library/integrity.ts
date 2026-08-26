// library/integrity.ts — the corpus checks its own soundness.

import { RAW_CLASS_FRAMES } from './frames'
import { withSpacingModes } from './rules'
import { REGISTRY_FAMILIES } from './types'
import { frameKeyOf } from './transforms'

/** Every violation named; an empty list means the corpus is sound. */
export function registryIntegrity(): string[] {
  const out: string[] = []
  for (const fam of REGISTRY_FAMILIES) {
    const frames = RAW_CLASS_FRAMES[fam].map((f) => withSpacingModes(fam, f, 48))
    const seen = new Set<string>()
    for (const f of frames) {
      const fk = frameKeyOf(f)
      if (seen.has(fk)) out.push('duplicate frame ' + fk)
      seen.add(fk)
      const names = new Set<string>()
      for (const l of f.layouts) {
        if (names.has(l.name)) out.push(fk + ': duplicate layout name ' + l.name)
        names.add(l.name)
        const nodes = new Set<string>()
        for (const [x, y] of l.nodes) {
          if (x < 0 || x >= f.cols || y < 0 || y >= f.rows) out.push(fk + ' ' + l.name + ': node out of bounds ' + x + ',' + y)
          const k = x + ',' + y
          if (nodes.has(k)) out.push(fk + ' ' + l.name + ': duplicate node ' + k)
          nodes.add(k)
        }
        if (!l.nodes.length) out.push(fk + ' ' + l.name + ': empty layout')
      }
      if (!f.layouts.length) out.push(fk + ': no layouts')
    }
  }
  return out
}
