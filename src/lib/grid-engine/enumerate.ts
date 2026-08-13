// Grammar → arrangements. Held mask in. No scores.
// Traverse in population coordinates; publish base-lattice col/row.

export type Family = 'single' | 'run' | 'rectangle-corners' | 'corner-triangle' | 'full-window'
export type Population = 'base' | 'sparse'
export type AxisParity = 'gap' | 'point'

export interface IndexedSite {
  col: number
  row: number
  popCol: number
  popRow: number
  x: number
  y: number
  fits: boolean
}

export type SiteInput = Omit<IndexedSite, 'popCol' | 'popRow'> & {
  popCol?: number
  popRow?: number
}

export interface Arrangement {
  family: Family
  population: Population
  stepCol: number
  stepRow: number
  sites: IndexedSite[]
}

function keyOf(sites: IndexedSite[]): string {
  return sites
    .map((s) => `${s.col},${s.row}`)
    .sort()
    .join(';')
}

function heldAt(map: Map<string, IndexedSite>, popCol: number, popRow: number): IndexedSite | undefined {
  const s = map.get(`${popCol},${popRow}`)
  return s?.fits ? s : undefined
}

/** Keep base col/row; add population coords for grammar walks. */
export function toPopulationCoords(sites: readonly SiteInput[], population: Population): IndexedSite[] {
  const out: IndexedSite[] = []
  for (const s of sites) {
    if (population === 'sparse') {
      if (s.col % 2 !== 0 || s.row % 2 !== 0) continue
      out.push({ ...s, popCol: s.col / 2, popRow: s.row / 2 })
    } else {
      out.push({ ...s, popCol: s.col, popRow: s.row })
    }
  }
  return out
}

/** L6: even count on an axis → gap; odd → point. */
export function registrationOf(sites: readonly IndexedSite[]): { x: AxisParity; y: AxisParity } {
  const cols = new Set(sites.map((s) => s.popCol))
  const rows = new Set(sites.map((s) => s.popRow))
  return {
    x: cols.size % 2 === 0 ? 'gap' : 'point',
    y: rows.size % 2 === 0 ? 'gap' : 'point',
  }
}

export function enumerateArrangements(sites: readonly SiteInput[], population: Population): Arrangement[] {
  const mesh = toPopulationCoords(sites, population)
  const held = mesh.filter((s) => s.fits)
  if (held.length === 0) return []
  const map = new Map(mesh.map((s) => [`${s.popCol},${s.popRow}`, s] as const))
  const out: Arrangement[] = []
  const seen = new Set<string>()

  const push = (a: Arrangement) => {
    const id = `${a.family}|${a.population}|${a.stepCol},${a.stepRow}|${keyOf(a.sites)}`
    if (seen.has(id)) return
    seen.add(id)
    out.push(a)
  }

  for (const s of held) {
    push({ family: 'single', population, stepCol: 0, stepRow: 0, sites: [s] })
  }

  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]
  for (const start of held) {
    for (const [dc, dr] of dirs) {
      for (let step = 1; step <= 8; step++) {
        const run: IndexedSite[] = [start]
        for (let k = 1; k <= 8; k++) {
          const n = heldAt(map, start.popCol + dc * step * k, start.popRow + dr * step * k)
          if (!n) break
          run.push(n)
        }
        for (let len = 2; len <= run.length; len++) {
          push({
            family: 'run',
            population,
            stepCol: Math.abs(dc * step),
            stepRow: Math.abs(dr * step),
            sites: run.slice(0, len),
          })
        }
      }
    }
  }

  const cols = [...new Set(held.map((s) => s.popCol))].sort((a, b) => a - b)
  const rows = [...new Set(held.map((s) => s.popRow))].sort((a, b) => a - b)
  for (const c0 of cols) {
    for (const c1 of cols) {
      if (c1 <= c0) continue
      for (const r0 of rows) {
        for (const r1 of rows) {
          if (r1 <= r0) continue
          const corners = [
            heldAt(map, c0, r0),
            heldAt(map, c1, r0),
            heldAt(map, c0, r1),
            heldAt(map, c1, r1),
          ]
          const present = corners.filter((s): s is IndexedSite => !!s)
          const stepCol = c1 - c0
          const stepRow = r1 - r0
          if (present.length === 4) {
            push({
              family: 'rectangle-corners',
              population,
              stepCol,
              stepRow,
              sites: present,
            })
            for (let drop = 0; drop < 4; drop++) {
              push({
                family: 'corner-triangle',
                population,
                stepCol,
                stepRow,
                sites: present.filter((_, i) => i !== drop),
              })
            }
          }
          if (present.length === 3) {
            push({
              family: 'corner-triangle',
              population,
              stepCol,
              stepRow,
              sites: present,
            })
          }
        }
      }
    }
  }

  for (const c0 of cols) {
    for (const c1 of cols) {
      if (c1 < c0) continue
      for (const r0 of rows) {
        for (const r1 of rows) {
          if (r1 < r0) continue
          const block: IndexedSite[] = []
          let all = true
          for (let c = c0; c <= c1 && all; c++) {
            for (let r = r0; r <= r1; r++) {
              const s = heldAt(map, c, r)
              if (!s) {
                all = false
                break
              }
              block.push(s)
            }
          }
          if (all && block.length >= 1) {
            push({
              family: 'full-window',
              population,
              stepCol: Math.max(1, c1 - c0),
              stepRow: Math.max(1, r1 - r0),
              sites: block,
            })
          }
        }
      }
    }
  }

  return out
}
