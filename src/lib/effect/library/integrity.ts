// library/integrity.ts — the corpus checks its own soundness.

import { CLASS_FRAMES } from './frames'
import { frameKeyOf } from './transforms'

/** Every violation named; an empty list means the corpus is sound. */
export function libraryIntegrity(): string[] {
  const out: string[] = []
  for (const frames of Object.values(CLASS_FRAMES)) {
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
