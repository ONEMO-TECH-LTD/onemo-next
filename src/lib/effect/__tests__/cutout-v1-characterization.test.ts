import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { HistoryStack } from '@/app/(dev)/cutout-lab/history'
import { runCutout as legacyRunCutout } from '@/app/(dev)/effect-creator/v5.3.1/core/primitives'
import { maskArea, subtractMasks, unionMasks } from '@/lib/mask-tools'
import { adapterIdFor, segment } from '../mask'
import { runCutout } from '../cutout'

const cutoutDir = 'src/app/(dev)/cutout-lab'
const read = (path: string) => readFileSync(path, 'utf8')
const cutout = (file: string) => read(`${cutoutDir}/${file}`)

const owners = [
  {
    file: 'page.tsx', layer: 'test-shell-donor', destination: 'src/app/page.tsx', adoption: 'selective-donor',
    excludes: ['eruda ?debug=1 diagnostics', '?admin=1 paint-calibration state and panel'],
  },
  { file: 'flow.ts', layer: 'react-studio', destination: 'src/app/studio/cutout/flow.ts', adoption: 'direct' },
  { file: 'finish.ts', layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/finish.ts', adoption: 'direct' },
  { file: 'EditorOverlay.tsx', layer: 'studio-shell', destination: 'src/app/studio/cutout/EditorOverlay.tsx', adoption: 'direct' },
  { file: 'history.ts', layer: 'headless', destination: 'src/lib/image-pipeline/history.ts', adoption: 'direct' },
  { file: 'ui-config.ts', layer: 'studio-shell', destination: 'src/app/studio/cutout/ui-config.ts', adoption: 'direct' },
  { file: 'v531seg.ts', layer: 'browser-adapter', destination: 'src/app/studio/cutout/browser/segment.ts', adoption: 'direct' },
] as const

const preservationCitations = [
  { behavior: 'Frame', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Frame:' },
  { behavior: 'collective controls', file: 'src/lib/effect/__tests__/trace-outline-controls.test.ts', oracle: 'routes all seven generation and whole-outline controls through the existing v5 engine' },
  { behavior: 'Paint', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Paint + pointer-leave cancellation:' },
  { behavior: 'Nodes', file: 'src/lib/vector-edit/__tests__/node-ops.test.ts', oracle: 'insertNode adds an anchor ON the tapped edge' },
  { behavior: 'exact GrabCut', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// GrabCut:' },
  { behavior: 'Detect u2netp/Silueta', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Forced Silueta fallback:' },
  { behavior: 'visible flood-fill degradation', file: 'src/lib/effect/__tests__/prepare-effect-fallback.test.ts', oracle: 'reports the visible flood-fill state through the existing progress callback' },
  { behavior: 'Clamp', file: 'src/lib/effect/__tests__/composite-frame.test.ts', oracle: 'clamps deterministic edge pixels into every exposed edge and corner with no void' },
  { behavior: 'Preview/Save', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Primary Detect, Preview, Save,' },
  { behavior: 'Clear', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Clear is a history state;' },
  { behavior: 'Undo/Redo', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Clear is a history state;' },
  { behavior: 'replacement', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Primary Detect, Preview, Save,' },
  { behavior: 'cancellation', file: 'scripts/verify-cutout-v1-preservation.mjs', oracle: '// Cancellation:' },
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

  it('classifies the current page as a selective test-shell donor and excludes route-only residue', () => {
    const pageOwner = owners.find(({ file }) => file === 'page.tsx')!
    expect(pageOwner).toEqual({
      file: 'page.tsx', layer: 'test-shell-donor', destination: 'src/app/page.tsx', adoption: 'selective-donor',
      excludes: ['eruda ?debug=1 diagnostics', '?admin=1 paint-calibration state and panel'],
    })
    const source = cutout('page.tsx')
    expect(source).not.toMatch(/searchParams\.(?:has|get)\('seg'\)/)
    expect(source).toContain("u.searchParams.get('debug') === '1'")
    expect(source).toContain("u.searchParams.get('admin') === '1'")
    expect(source).toContain('Paint-shaper config (admin)')
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
  it('cites an exact executable oracle for every contract-line-52 behavior', () => {
    expect(preservationCitations.map(({ behavior }) => behavior)).toEqual([
      'Frame', 'collective controls', 'Paint', 'Nodes', 'exact GrabCut', 'Detect u2netp/Silueta',
      'visible flood-fill degradation', 'Clamp', 'Preview/Save', 'Clear', 'Undo/Redo', 'replacement', 'cancellation',
    ])
    for (const { file, oracle } of preservationCitations) expect(read(file), `${file}: ${oracle}`).toContain(oracle)
  })

  it('preserves Paint add/erase mask behavior', () => {
    const base = { data: Uint8Array.from([1, 0, 0, 1]), w: 2, h: 2 }
    const stroke = { data: Uint8Array.from([0, 1, 0, 1]), w: 2, h: 2 }
    const added = unionMasks(base, stroke)
    expect([...added.data]).toEqual([1, 1, 0, 1])
    expect([...subtractMasks(added, stroke).data]).toEqual([1, 0, 0, 0])
    expect(maskArea(base)).toBe(2)
  })

  it('preserves the non-alpha flood-fill fallback as a working segmentation', () => {
    const width = 9, height = 9
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) {
      const i = (y * width + x) * 4
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0
    }
    const image = { data, width, height } as ImageData
    expect(adapterIdFor(image)).toBe('bg-flood')
    const result = segment(image)
    expect(result.mask.some(Boolean)).toBe(true)
    expect(result.mask[4 * width + 4]).toBe(1)
    expect(result.mask[0]).toBe(0)
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
  it('KAI-10217 removes the stale detector query while retaining current route diagnostics', () => {
    expect(cutout('page.tsx')).not.toMatch(/searchParams\.(?:has|get)\('seg'\)/)
    expect(cutout('page.tsx')).toContain("u.searchParams.get('debug') === '1'")
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
