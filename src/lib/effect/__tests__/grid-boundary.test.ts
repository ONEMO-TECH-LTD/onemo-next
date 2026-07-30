import { existsSync, readFileSync } from 'node:fs'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GridWorkbenchAdminPanel } from '@/app/(dev)/effect-creator/grid-lab/GridWorkbenchAdminPanel'
import { GridWorkbenchPanel } from '@/app/(dev)/effect-creator/grid-lab/GridWorkbenchPanel'

const CREATE_PAGE_PATH = 'src/app/(store)/create/page.tsx'
const HOME_PAGE_PATH = 'src/app/page.tsx'
const PAGE_PATH = 'src/app/(dev)/effect-creator/grid-lab/page.tsx'
const PANEL_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchPanel.tsx'
const ADMIN_PANEL_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchAdminPanel.tsx'
const USER_PANEL_PATH = `src/app/(dev)/effect-creator/grid-lab/${'GridWorkbenchUser' + 'Panel.tsx'}`
const RENDERER_PATH = 'src/app/(dev)/effect-creator/grid-lab/GridWorkbenchRenderer.tsx'
const ENTRY_PATH = 'src/lib/effect/grid.ts'
const WORKER_PATH = 'src/lib/effect/grid.worker.ts'
const CLIENT_PATH = 'src/lib/effect/grid-client.ts'
const WORKER_HOOK_PATH = 'src/app/(dev)/effect-creator/grid-lab/useGridWorkerJob.ts'
const SHAPED_MODEL_PATH = 'src/app/(dev)/effect-creator/v5.3.1/core/shaped/ShapedModel.tsx'

describe('Creator magnetic-grid module boundary', () => {
  it('removes the A4 Create route and sends the root to the original Grid Lab', () => {
    const homeSource = readFileSync(HOME_PAGE_PATH, 'utf8')
    expect(existsSync(CREATE_PAGE_PATH)).toBe(false)
    expect(homeSource).toContain('redirect("/effect-creator/grid-lab")')
  })

  it('uses one neutral engine lane behind separate product and admin control panels', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const adminPanelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')

    expect(existsSync(USER_PANEL_PATH)).toBe(false)
    expect(pageSource).toMatch(/from ['"]@\/lib\/effect\/grid['"]/)
    expect(pageSource).toMatch(/from ['"]@\/lib\/effect\/grid-client['"]/)
    expect(pageSource.match(/<GridWorkbenchStage/g)).toHaveLength(1)
    expect(pageSource.match(/<GridWorkbenchPanel/g)).toHaveLength(1)
    expect(pageSource.match(/<GridWorkbenchAdminPanel/g)).toHaveLength(1)
    expect(pageSource.indexOf('<GridWorkbenchAdminPanel')).toBeLessThan(
      pageSource.indexOf('<GridWorkbenchStage'),
    )
    expect(pageSource.indexOf('<GridWorkbenchStage')).toBeLessThan(
      pageSource.indexOf('<GridWorkbenchPanel'),
    )
    expect(pageSource).toContain('requestGridJob')
    expect(pageSource).toContain('const [snapToGrid, setSnapToGrid] = useState(true)')
    expect(pageSource).toContain('if (!snapToGrid || !preparedDesign?.rung) return undefined')
    expect(pageSource)
      .toContain('resolvedSizeMM: snapToGrid ? effectiveTestSizeMM : resolvedSizeMM')
    expect(pageSource).not.toMatch(/\b(?:Admin|User)Grid/)
    expect(pageSource).not.toContain('panel' + 'Entry')
    expect(pageSource).not.toContain('data-grid-door')
    expect(panelSource).toContain("'quincunx'")
    expect(adminPanelSource).toContain('Dice-5')
  })

  it('renders every control exactly once in its product or admin panel', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const adminPanelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const combined = `${panelSource}\n${adminPanelSource}`
    const productControls = [
      '<div className="gl-glabel">Shape source</div>',
      '<div className="gl-field"><span>Geometry</span>',
      '<label className="gl-field"><span>Preset shape</span>',
      '<Slider label="Sides"',
      '<Slider label="Points"',
      '<button className="gl-upload"',
      '<div className="gl-field"><span>Attachment</span>',
      '<div className="gl-field"><span>Orientation</span>',
      '<Slider label={`Design size · longest side',
      '<span className="gl-total-k">Total effect size</span>',
    ]
    const adminControls = [
      '<div className="gl-field"><span>Density</span>',
      '<div className="gl-field"><span>Grid pitch ·',
      '<Slider label="Magnet padding · per spot · min 10"',
      '<Slider label="Base margin · outward offset"',
      '<Slider label="Max auto-margin · balance"',
      'label="Rounded-square corner radius"',
      '<div className="gl-field"><span>Grid pattern ·',
      '<div className="gl-field"><span>Grid centering · A/B</span>',
      '<div className="gl-field"><span>Magnet plan</span>',
      '<span>Snap test size to grid</span>',
      'label="Test size · longest side"',
      '<label className="gl-toggle"><span>Front face · magnet overlay</span>',
    ]

    for (const control of productControls) {
      expect(panelSource, `${control} missing from product panel`).toContain(control)
      expect(adminPanelSource, `${control} duplicated in admin panel`).not.toContain(control)
      expect(combined.split(control)).toHaveLength(2)
    }
    for (const control of adminControls) {
      expect(adminPanelSource, `${control} missing from admin panel`).toContain(control)
      expect(panelSource, `${control} duplicated in product panel`).not.toContain(control)
      expect(combined.split(control)).toHaveLength(2)
    }

    expect(panelSource.match(/\.filter\(r => r\.visible\)/g)).toHaveLength(3)
    expect(adminPanelSource).not.toContain('Size ·')
    expect(adminPanelSource).not.toContain('Long side · size')
    expect(adminPanelSource).not.toContain('Short side · size')
    expect(`${pageSource}\n${panelSource}\n${adminPanelSource}`).not.toContain('showUntestedRungs')
  })

  it('keeps only calibrated size tiers in the product panel and none in the admin panel', () => {
    const noop = () => {}
    const stdRungs = [
      { label: 'VISIBLE_STD', points: 4, sizeMM: 70, visible: true },
      { label: 'HIDDEN_STD', points: 8, sizeMM: 118, visible: false },
    ]
    const rectRungs = {
      longOptions: [
        { label: 'VISIBLE_LONG', points: 4, sizeMM: 70, visible: true },
        { label: 'HIDDEN_LONG', points: 8, sizeMM: 118, visible: false },
      ],
      shortOptions: [
        { label: 'VISIBLE_SHORT', points: 1, sizeMM: 22, visible: true },
        { label: 'HIDDEN_SHORT', points: 4, sizeMM: 70, visible: false },
      ],
    }
    const baseProductProps: ComponentProps<typeof GridWorkbenchPanel> = {
      src: 'std',
      setSrc: noop,
      geo: 'square',
      setGeo: noop,
      setLongMM: noop,
      setShortMM: noop,
      orient: 'landscape',
      setOrient: noop,
      preset: 'squircle',
      setPreset: noop,
      gen: 'blob',
      setGen: noop,
      p1: 50,
      setP1: noop,
      p2: 7,
      setP2: noop,
      sides: 6,
      setSides: noop,
      points: 5,
      setPoints: noop,
      setSizeMM: noop,
      attachment: 'magnetic',
      setAttachment: noop,
      magic: null,
      magStatus: '',
      fileRef: { current: null },
      onFile: noop,
      sizeMax: 310,
      sizeMin: 22,
      resolvedSizeMM: 70,
      maxRungMM: 310,
      gridMode: 'auto',
      stdRungs,
      rectRungs,
      model: null,
      onSliderInteractionChange: noop,
    }
    const baseAdminProps: ComponentProps<typeof GridWorkbenchAdminPanel> = {
      pitch: 48,
      setPitch: noop,
      pitchAuto: true,
      setPitchAuto: noop,
      density: 'light',
      setDensity: noop,
      pad: 10,
      setPad: noop,
      offsetMM: 0,
      setOffsetMM: noop,
      pattern: 'standard',
      setPattern: noop,
      patternAuto: true,
      setPatternAuto: noop,
      plan: 'auto',
      setPlan: noop,
      front: false,
      setFront: noop,
      centerMode: 'centroid',
      setCenterMode: noop,
      maxGrowMM: 12,
      setMaxGrowMM: noop,
      roundedSquareRadiusMM: 10,
      setRoundedSquareRadiusMM: noop,
      roundedSquareRadiusMaxMM: 35,
      showRoundedSquareRadius: false,
      testSizeMM: 143,
      setTestSizeMM: noop,
      testSizeMin: 22,
      testSizeMax: 310,
      snapToGrid: false,
      setSnapToGrid: noop,
      snapSizesMM: [39, 143, 231],
      model: null,
      onSliderInteractionChange: noop,
    }
    const renderProduct = (props: Partial<ComponentProps<typeof GridWorkbenchPanel>>) =>
      renderToStaticMarkup(createElement(GridWorkbenchPanel, { ...baseProductProps, ...props }))
    const renderAdmin = (props: Partial<ComponentProps<typeof GridWorkbenchAdminPanel>>) =>
      renderToStaticMarkup(createElement(GridWorkbenchAdminPanel, { ...baseAdminProps, ...props }))

    const productStandard = renderProduct({})
    const adminStandard = renderAdmin({})
    expect(productStandard).toContain('VISIBLE_STD')
    expect(productStandard).not.toContain('HIDDEN_STD')
    expect(adminStandard).not.toContain('VISIBLE_STD')
    expect(adminStandard).not.toContain('HIDDEN_STD')

    const productRectangle = renderProduct({ geo: 'rect' })
    const adminRectangle = renderAdmin({})
    expect(productRectangle).toContain('VISIBLE_LONG')
    expect(productRectangle).toContain('VISIBLE_SHORT')
    expect(productRectangle).not.toContain('HIDDEN_LONG')
    expect(productRectangle).not.toContain('HIDDEN_SHORT')
    expect(adminRectangle).not.toContain('VISIBLE_LONG')
    expect(adminRectangle).not.toContain('VISIBLE_SHORT')
    expect(adminRectangle).not.toContain('HIDDEN_LONG')
    expect(adminRectangle).not.toContain('HIDDEN_SHORT')

    expect(productStandard).not.toContain('Design size · longest side')
    expect(renderProduct({ src: 'preset' })).not.toContain('Design size · longest side')
    expect(renderProduct({ src: 'gen' })).toContain('Design size · longest side')
    expect(renderProduct({ src: 'magic' })).toContain('Design size · longest side')

    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    expect(pageSource).toContain("maxGrowMM: src === 'gen' || src === 'magic' ? maxGrowMM : 0")
    expect(pageSource).toContain("{ kind: 'uniform-contour', unitContour: presetUnitContour }")
    expect(pageSource).toContain("kind: 'rounded-square'")
    expect(pageSource).toContain('radiusMM: roundedSquareRadiusMM')
    expect(pageSource).toContain('minimumAnchors: DEFAULT_ROUNDED_SQUARE_CALIBRATION.minimumAnchors')

    const continuousAdmin = renderAdmin({})
    expect(continuousAdmin).toContain('data-grid-size-snap="off"')
    expect(continuousAdmin).toContain('min="22"')
    expect(continuousAdmin).toContain('max="310"')
    expect(continuousAdmin).toContain('value="143"')

    const snappedAdmin = renderAdmin({ snapToGrid: true })
    expect(snappedAdmin).toContain('data-grid-size-snap="on"')
    expect(snappedAdmin).toContain('min="0"')
    expect(snappedAdmin).toContain('max="2"')
    expect(snappedAdmin).toContain('value="1"')

    const roundedAdmin = renderAdmin({ showRoundedSquareRadius: true })
    expect(roundedAdmin).toContain('Rounded-square corner radius')
    expect(roundedAdmin).toContain('max="35"')
    expect(roundedAdmin).toContain('value="10"')
  })

  it('keeps the serializable handler, worker, and client behind one neutral entry', () => {
    const entrySource = readFileSync(ENTRY_PATH, 'utf8')
    const workerSource = readFileSync(WORKER_PATH, 'utf8')
    const clientSource = readFileSync(CLIENT_PATH, 'utf8')

    expect(entrySource).toContain('handleGridJob')
    expect(entrySource).toContain('handleGridWorkerJob')
    expect(workerSource.match(/^import .* from ['"].*['"]$/gm)).toEqual([
      "import { handleGridWorkerJob, type GridJob } from './grid'",
    ])
    expect(clientSource).toContain("new URL('./grid.worker.ts', import.meta.url)")
    expect(`${entrySource}\n${workerSource}\n${clientSource}`).not.toMatch(/grid-(?:user|admin)/)
    expect(`${entrySource}\n${workerSource}\n${clientSource}`).not.toMatch(/\b(?:Admin|User)Grid/)
  })

  it('keeps magnetic-grid law out of every UI surface', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const adminPanelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(RENDERER_PATH, 'utf8')
    const combined = [pageSource, panelSource, adminPanelSource, rendererSource].join('\n')

    expect(pageSource).toContain('resolveRectangleRungs(')
    expect(pageSource).toContain('nearestAnchorPair(')
    expect(pageSource).toContain('source: src')
    expect(panelSource).toContain('rectRungs?.shortOptions')
    expect(rendererSource).toContain('anchorPair.distanceMM')
    expect(combined).not.toMatch(/\b(?:autoGrid|balancedFit|perimeterForDensity|insetRingMM)\s*\(/)
    expect(pageSource).not.toMatch(/const d[rb]\s*=\s*Math\.abs/)
    expect(panelSource).not.toContain('Math.min(...stdRungs')
    expect(panelSource).not.toContain('Math.max(sizeMin')
    expect(rendererSource).not.toMatch(/Math\.hypot\(/)
    expect(combined).not.toMatch(/grid-(?:user|admin|core)/)
  })

  it('derives render tessellation from the physical display tolerance, never a pixel floor', () => {
    const shapedModelSource = readFileSync(SHAPED_MODEL_PATH, 'utf8')

    expect(shapedModelSource).toContain('DISPLAY_TOLERANCE_MM / k')
    expect(shapedModelSource).not.toContain(
      'Math.max(0.01, DISPLAY_TOLERANCE_MM / k)',
    )
  })

  it('publishes only matching async worker results with an honest resolving surface', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const planDesignSource = pageSource.slice(
      pageSource.indexOf('const planDesign ='),
      pageSource.indexOf('const preparedDesign ='),
    )
    const planJobSource = pageSource.slice(
      pageSource.indexOf('const planJob ='),
      pageSource.indexOf('const planKey ='),
    )

    expect(pageSource).toContain('useGridWorkerJob')
    expect(pageSource).toContain('requestGridWorkerJobInBackground')
    expect(planDesignSource).not.toContain('stdRungs')
    expect(planDesignSource).toContain("if (geo === 'rect')")
    expect(planDesignSource).toContain('if (!rectRungs) return null')
    expect(planJobSource).toContain("operation: 'plan'")
    expect(planJobSource).not.toContain('preparedDesign')
    expect(pageSource).toContain('data-grid-runtime-status={runtimeStatus}')
    expect(pageSource).toContain("'resolving-sizes'")
    expect(pageSource).toContain("'resolving-grid'")
    expect(pageSource).toContain('Resolving sizes… controls remain available')
    expect(pageSource).toContain('Resolving grid… controls remain available')
    expect(pageSource).not.toContain('resolveGridPlan(')
    expect(pageSource).not.toContain('semanticLadder(')
  })

  it('renders an accepted non-rectangle plan before ladder metadata while rectangles still wait', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(RENDERER_PATH, 'utf8')
    const preparedDesignSource = pageSource.slice(
      pageSource.indexOf('const preparedDesign ='),
      pageSource.indexOf('const planJob ='),
    )

    expect(preparedDesignSource).toContain('if (!planDesign) return null')
    expect(preparedDesignSource).not.toContain('if (!planDesign || !stdRungs.length) return null')
    expect(preparedDesignSource)
      .toContain('if (!stdRungs.length) return { ...planDesign, rung: null, rungH: null }')
    expect(preparedDesignSource).toContain("if (src === 'std' && geo === 'rect')")
    expect(preparedDesignSource).toContain('if (!rectRungs) return null')
    expect(preparedDesignSource).toContain('const targetMM = snapToGrid')
    expect(preparedDesignSource).toContain('? effectiveTestSizeMM')
    expect(pageSource).toContain('renderedPlanKey')
    expect(pageSource).toContain('planKey: activePlanResult.key')
    expect(rendererSource).toContain('useLayoutEffect')
    expect(rendererSource).toContain('onRenderedPlanCommit(model?.planKey ?? null)')
    expect(panelSource).toContain('model?.rung?.sizeMM')
    expect(panelSource).toContain('seated ${model.grid.anchors.length}')
  })

  it('keeps calibration verdicts off the product surface and labels the delivered population', () => {
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const rendererSource = readFileSync(RENDERER_PATH, 'utf8')

    expect(rendererSource).not.toContain('"Won\'t hold reliably"')
    expect(rendererSource).not.toContain('<Verdict grid={model.grid} />')
    expect(panelSource).not.toContain('tier ${model.rung.points}pt')
    expect(panelSource).toContain('tier ${model.grid.anchors.length}pt')
  })

  it('retains generic lane cancellation after removing profile switching', () => {
    const clientSource = readFileSync(CLIENT_PATH, 'utf8')
    const hookSource = readFileSync(WORKER_HOOK_PATH, 'utf8')

    expect(clientSource).toContain('export function suspendGridWork()')
    expect(clientSource).toContain('sharedClient?.cancelPending()')
    expect(hookSource).toContain("errorName === 'GridWorkerInactiveError'")
  })

  it('coalesces only transient slider work before the exact worker lane', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8')
    const panelSource = readFileSync(PANEL_PATH, 'utf8')
    const adminPanelSource = readFileSync(ADMIN_PANEL_PATH, 'utf8')
    const hookSource = readFileSync(WORKER_HOOK_PATH, 'utf8')
    const panelsSource = `${panelSource}\n${adminPanelSource}`

    expect(panelsSource).toContain('onPointerDown={() => onInteractionChange(true)}')
    expect(panelsSource).toContain('onPointerUp={() => onInteractionChange(false)}')
    expect(panelsSource).toContain('onKeyDown=')
    expect(panelsSource).toContain('onKeyUp=')
    expect(pageSource).toContain('onSliderInteractionChange: setSliderTransient')
    expect(pageSource).toContain('data-grid-slider-transient={sliderTransient}')
    expect(hookSource).toContain('coalescer.request(job, key, request)')
    expect(hookSource).toContain('coalescer.flush(job, key, request)')
    expect(hookSource).not.toMatch(/grid-(?:user|admin|core)/)
  })
})
