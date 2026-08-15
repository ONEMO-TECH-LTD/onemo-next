// Grammar → arrangements. Held mask in. No scores.
// Traverse in population coordinates; publish base-lattice col/row.

export type Family =
  | 'single'
  | 'run'
  | 'rectangle-corners'
  | 'corner-triangle'
  | 'full-window'
  | 'tee'
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

export function enumerateArrangements(
  sites: readonly SiteInput[],
  population: Population,
  opts: { windows?: boolean; tees?: boolean } = {},
): Arrangement[] {
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

  // Apex + two base corners. The top disc sits on the mid-edge, so this is
  // not three corners of a rectangle — L20 utmost-corners on a triangular mass.
  if (held.length >= 3) {
    const minY = Math.min(...held.map((s) => s.popRow))
    const maxY = Math.max(...held.map((s) => s.popRow))
    if (maxY - minY >= 1) {
      const topBand = held.filter((s) => s.popRow === minY)
      const botBand = held.filter((s) => s.popRow === maxY)
      if (botBand.length >= 2) {
        const L = botBand.reduce((a, b) => (a.popCol < b.popCol ? a : b))
        const R = botBand.reduce((a, b) => (a.popCol > b.popCol ? a : b))
        if (L !== R && R.popCol - L.popCol >= 1) {
          for (const T of topBand) {
            if (T === L || T === R) continue
            push({
              family: 'corner-triangle',
              population,
              stepCol: R.popCol - L.popCol,
              stepRow: maxY - minY,
              sites: [T, L, R],
            })
          }
        }
      }
      // T: one apex + a base row of three. The neck need not be held.
      if (topBand.length >= 1 && botBand.length >= 3) {
        const bar = [...botBand].sort((a, b) => a.popCol - b.popCol)
        const L = bar[0]
        const R = bar[bar.length - 1]
        if (R.popCol - L.popCol >= 2) {
          const midX = (L.popCol + R.popCol) / 2
          const M = bar.reduce((a, b) =>
            Math.abs(a.popCol - midX) <= Math.abs(b.popCol - midX) ? a : b,
          )
          if (M !== L && M !== R) {
            for (const T of topBand) {
              if (T.popCol < L.popCol || T.popCol > R.popCol) continue
              push({
                family: 'tee',
                population,
                stepCol: R.popCol - L.popCol,
                stepRow: maxY - minY,
                sites: [T, L, M, R],
              })
            }
          }
        }
      }
    }
  }

  const ortho: Array<[number, number]> = [
    [1, 0],
    [0, 1],
  ]
  if (opts.tees !== false)
  for (const mid of held) {
    for (const [adc, adr] of ortho) {
      const neg: IndexedSite[] = []
      const pos: IndexedSite[] = []
      for (let k = 1; k <= 8; k++) {
        const a = heldAt(map, mid.popCol - adc * k, mid.popRow - adr * k)
        const b = heldAt(map, mid.popCol + adc * k, mid.popRow + adr * k)
        if (a) neg.push(a)
        if (b) pos.push(b)
        if (!a && !b) break
      }
      if (!neg.length || !pos.length) continue
      const stems: Array<[number, number]> = [
        [-adr, adc],
        [adr, -adc],
      ]
      for (const [sdc, sdr] of stems) {
        const stem: IndexedSite[] = []
        for (let k = 1; k <= 3; k++) {
          const s = heldAt(map, mid.popCol + sdc * k, mid.popRow + sdr * k)
          if (!s) break
          stem.push(s)
          const arm = Math.min(neg.length, pos.length, 2)
          const bar = [...neg.slice(0, arm).reverse(), mid, ...pos.slice(0, arm)]
          const sites = [...bar, ...stem]
          const colsT = sites.map((p) => p.popCol)
          const rowsT = sites.map((p) => p.popRow)
          push({
            family: 'tee',
            population,
            stepCol: Math.max(...colsT) - Math.min(...colsT),
            stepRow: Math.max(...rowsT) - Math.min(...rowsT),
            sites,
          })
        }
      }
    }
  }

  if (opts.windows !== false && held.length <= 12) {
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
  }

  return out
}
