import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { HistoryStack } from '@/app/(dev)/cutout-lab/history'
import { runCutout as legacyRunCutout } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { resolveChain } from '../ben-chain'
import { runCutout } from '../cutout'

const cutoutDir = 'src/app/(dev)/cutout-lab'
const read = (path: string) => readFileSync(path, 'utf8')
const cutout = (file: string) => read(`${cutoutDir}/${file}`)

const owners = [
  { file: 'page.tsx', layer: 'studio-shell', destination: 'src/app/page.tsx' },
  { file: 'flow.ts', layer: 'react-studio', destination: 'src/app/studio/cutout/flow.ts' },
  { file: 'finish.ts', layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/finish.ts' },
  { file: 'EditorOverlay.tsx', layer: 'studio-shell', destination: 'src/app/studio/cutout/EditorOverlay.tsx' },
  { file: 'history.ts', layer: 'headless', destination: 'src/lib/image-pipeline/history.ts' },
  { file: 'ui-config.ts', layer: 'studio-shell', destination: 'src/app/studio/cutout/ui-config.ts' },
  { file: 'v531seg.ts', layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/segment.ts' },
] as const

const dependencies: Record<string, { layer: string; destination: string | null }> = {
  './EditorOverlay': { layer: 'studio-shell', destination: 'src/app/studio/cutout/EditorOverlay.tsx' },
  './finish': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/finish.ts' },
  './flow': { layer: 'react-studio', destination: 'src/app/studio/cutout/flow.ts' },
  './history': { layer: 'headless', destination: 'src/lib/image-pipeline/history.ts' },
  './ui-config': { layer: 'studio-shell', destination: 'src/app/studio/cutout/ui-config.ts' },
  './v531seg': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/segment.ts' },
  '@/lib/cutout-grabcut': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/grabcut.ts' },
  '@/lib/effect/composite': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/composite.ts' },
  '@/lib/effect/cutout': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/cutout.ts' },
  '@/lib/effect/mask': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/mask.ts' },
  '@/lib/effect/prepare-effect': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/prepare-effect.ts' },
  '@/lib/effect/segment-ml': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/segment-ml.ts' },
  '@/lib/effect/trace-outline-controls': { layer: 'headless', destination: 'src/lib/image-pipeline/trace-outline-controls.ts' },
  '@/lib/mask-tools': { layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/mask-tools.ts' },
  '@/lib/mask-tools/types': { layer: 'headless', destination: 'src/lib/image-pipeline/mask-types.ts' },
  '@/lib/vector-core': { layer: 'headless', destination: 'src/lib/image-pipeline/vector-core.ts' },
  '@/lib/vector-edit': { layer: 'headless', destination: 'src/lib/image-pipeline/vector-edit.ts' },
  eruda: { layer: 'route-diagnostic', destination: null },
  react: { layer: 'react-studio', destination: 'src/app/studio/cutout' },
  'thinking-orbs': { layer: 'studio-shell', destination: 'src/app/studio/cutout' },
}

function imports(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
}

describe('KAI-10216 Cutout V1 adoption boundary', () => {
  it('keeps the v5.3.1 primitive import as an identity re-export', () => {
    expect(legacyRunCutout).toBe(runCutout)
  })

  it('classifies every current owner and direct dependency exactly once', () => {
    expect(new Set(owners.map(({ file }) => file)).size).toBe(7)
    for (const { file } of owners) expect(() => cutout(file)).not.toThrow()
    expect(owners.every(({ destination }) => Boolean(destination))).toBe(true)

    const actualDependencies = new Set(owners.flatMap(({ file }) => imports(cutout(file))))
    expect([...actualDependencies].sort()).toEqual(Object.keys(dependencies).sort())
    expect(Object.values(dependencies).every(({ layer }) => Boolean(layer))).toBe(true)
    expect(Object.entries(dependencies).filter(([, { destination }]) => destination === null).map(([specifier]) => specifier)).toEqual(['eruda'])
  })

  it('keeps the adoption closure product-owned and the headless owners DOM-free', () => {
    for (const file of ['flow.ts', 'finish.ts', 'EditorOverlay.tsx', 'history.ts', 'v531seg.ts']) {
      expect(cutout(file)).not.toContain('/(dev)/')
    }
    const headlessFiles = [`${cutoutDir}/history.ts`]
    for (const [specifier, { layer }] of Object.entries(dependencies)) {
      if (layer !== 'headless' || !specifier.startsWith('@/')) continue
      const path = specifier.replace('@/', 'src/')
      headlessFiles.push([`${path}.ts`, `${path}/index.ts`].find((candidate) => {
        try { read(candidate); return true } catch { return false }
      }) ?? path)
    }
    for (const file of headlessFiles) {
      const source = read(file)
      const runtime = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(imports(source)).not.toContain('react')
      expect(imports(source).some((path) => path.startsWith('next/'))).toBe(false)
      expect(runtime).not.toMatch(/\b(document|window|HTMLCanvasElement|ImageData|new Image)\b/)
    }
    expect(() => read('src/lib/cutout-lab/index.ts')).toThrow()
  })

  it('preserves the existing UI-facing flow surface without adding a replacement interface', () => {
    const source = cutout('flow.ts')
    expect(source).toContain('state: {')
    expect(source).toContain('actions: {')
    expect(source).toContain('view,')
    expect(source).toContain('measureNode,')
    expect(cutout('page.tsx')).toContain('flow.measureNode(')
    expect(source).not.toContain('CutoutStudioContract')
  })

  it('contains no Cutout performance HUD edge or dead upload ref', () => {
    const source = owners.map(({ file }) => cutout(file)).join('\n')
    expect(source).not.toMatch(/PerfHUD|perfGesture|lastFileRef/)
  })
})

describe('KAI-10216 accepted behavior', () => {
  it('preserves frame, collective controls, exact GrabCut, detector fallback, output, and lifecycle surfaces', () => {
    const overlay = cutout('EditorOverlay.tsx')
    const config = cutout('ui-config.ts')
    const grabcut = read('src/lib/cutout-grabcut/index.ts')
    const flow = cutout('flow.ts')
    const finish = cutout('finish.ts')
    const page = cutout('page.tsx')

    for (const grip of ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']) expect(overlay).toContain(`g: '${grip}'`)
    expect(overlay).toContain("if (g.includes('e')) { ax = bb.minX")
    expect(overlay).toContain("if (g.includes('w')) { ax = bb.maxX")
    expect(config).toContain("['detail', 'offset', 'simplify', 'smooth', 'radius']")
    expect(config).toContain('detail: [0, 100], offset: [0, 15], simplify: [0, 100], smooth: [0, 200]')
    expect(grabcut).toContain('const GC_ITERS = 3')
    expect(grabcut).toContain('const CORRIDOR_MULT = 2.5')
    expect(grabcut).toContain('erase ? cv.GC_BGD : cv.GC_FGD')
    expect(flow).toContain('u2net failed:')
    expect(flow).toContain('flood-fill fallback')
    expect(resolveChain()?.map(({ adapter }) => adapter)).toEqual(['u2netp', 'silueta'])
    expect(flow).toContain('MIN_ERASE_KEEP_RATIO = 0.1')
    expect(flow).toContain('swathMask(pts, brushPx')
    expect(flow).toContain('nodeInsert')
    expect(flow).toContain('nodeDelete')
    expect(flow).toContain('nodeApply')
    expect(overlay).toContain('onSelect?.({ pi, ai })')
    expect(overlay).toContain('onDeleteNode?.(pi, ai)')
    expect(finish).toContain("fill: 'clamp'")
    expect(flow).toContain('awaitFullBake()')
    expect(flow).toContain('BakeCancelled')
    expect(flow).toContain('const gen = ++bakeGen.current')
    expect(flow).toContain("a.download = 'cutout.png'")
    expect(flow).toContain('URL.revokeObjectURL(urlRef.current)')
    expect(flow).toContain('URL.createObjectURL(file)')
    for (const action of ['clearAll', 'undo', 'redo', 'setPreview']) expect(flow).toContain(action)
    expect(page).toContain('onPointerLeave')
  })

  it('preserves capped undo/redo and branch truncation', () => {
    const history = new HistoryStack<number>(3)
    history.push(1); history.push(2); history.push(3); history.push(4)
    expect(history.undo()).toBe(3)
    expect(history.undo()).toBe(2)
    expect(history.undo()).toBeNull()
    expect(history.redo()).toBe(3)
    history.push(9)
    expect(history.canRedo()).toBe(false)
    expect(history.undo()).toBe(3)
  })
})

describe('later increment defect reproductions', () => {
  it.fails('KAI-10217 removes stale detector/query/debug residue', () => {
    expect(cutout('page.tsx')).not.toMatch(/searchParams\.(?:has|get)\('(seg|debug)'\)/)
  })

  it.fails('KAI-10218 publishes a replacement only after decode succeeds', () => {
    const source = cutout('flow.ts')
    expect(source.indexOf('await img.decode()')).toBeLessThan(source.indexOf('maskRef.current = null'))
  })

  it.fails('KAI-10218 replaces the one-slot tool queue with FIFO ownership', () => {
    expect(cutout('flow.ts')).not.toContain('pendingToolRef')
  })

  it.fails('KAI-10218 renders one-point Paint and settles canvas pointer cancellation', () => {
    const source = cutout('page.tsx')
    expect(source).toContain('if (st.length > 0)')
    expect(source).toContain('onPointerCancel={onUp}')
  })

  it.fails('KAI-10219 removes Mirror and dormant Cutout output settings', () => {
    expect(cutout('finish.ts')).not.toMatch(/\bmirror\b/i)
  })

  it.fails('KAI-10220 returns scratch+erase before loading OpenCV', () => {
    const source = read('src/lib/cutout-grabcut/index.ts')
    expect(source.indexOf('if (fromScratch && erase)')).toBeLessThan(source.indexOf('await loadCv()'))
  })
})
