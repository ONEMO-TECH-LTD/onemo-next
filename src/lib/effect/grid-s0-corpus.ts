import aiCorpusJson from './__fixtures__/grid-real-ai-corpus.json'
import type { Contour } from './types'
import type { UserGridJob } from './grid-user'

interface RealAiCorpus {
  schemaVersion: number
  sourceAsset: string
  sourceAssetSha256: string
  sourceKind: 'real-ai-magic'
  capturedAt: string
  captureContract: string
  spec: {
    maskWidthPx: number
    maskHeightPx: number
    mmPerPx: number
    geometryMM: Contour
    dimensions: {
      thicknessBodyMM: number
      edgeRadiusMM: number
      widthMM: number
      heightMM: number
    }
    generator: {
      adapter: string
      lane: string
      version: string
    }
    diagnostics: {
      rawContourNodes: number
      simplifiedNodes: number
      holes: number
      rdpEpsilonMM: number
    }
  }
}

export const REAL_AI_GRID_CORPUS = aiCorpusJson as unknown as RealAiCorpus

function subdivideContour(contour: Contour, segmentsPerEdge: number): Contour {
  const subdivide = (pts: Contour['outer']['pts']) => pts.flatMap((from, index) => {
    const to = pts[(index + 1) % pts.length]
    return Array.from({ length: segmentsPerEdge }, (_, segment) => {
      const t = segment / segmentsPerEdge
      return [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ] as [number, number]
    })
  })
  return {
    outer: { pts: subdivide(contour.outer.pts) },
    holes: contour.holes.map((hole) => ({ pts: subdivide(hole.pts) })),
  }
}

/**
 * Dense profiling fixture: exact collinear subdivision of the verified Magic manufacturing contour.
 * This adds edge-query work without resampling, smoothing, or changing the physical outline.
 */
export const DENSE_REAL_AI_GRID_CONTOUR = subdivideContour(
  REAL_AI_GRID_CORPUS.spec.geometryMM,
  8,
)

export const GRID_S0_ORACLE_CORPUS: ReadonlyArray<{
  name: string
  job: UserGridJob
}> = [
  {
    name: 'canonical-square-ladder',
    job: { operation: 'ladder', recipe: { kind: 'standard', shape: 'square' } },
  },
  {
    name: 'canonical-circle-plan',
    job: {
      operation: 'plan',
      recipe: { kind: 'standard', shape: 'circle', widthMM: 303, heightMM: 303 },
      attachment: 'magnetic',
    },
  },
  {
    name: 'dense-real-ai-magic-plan',
    job: {
      operation: 'plan',
      recipe: { kind: 'final-contour', contourMM: DENSE_REAL_AI_GRID_CONTOUR },
      attachment: 'magnetic',
    },
  },
  {
    name: 'holed-freeform-plan',
    job: {
      operation: 'plan',
      recipe: {
        kind: 'final-contour',
        contourMM: {
          outer: { pts: [[0, 0], [118, 0], [118, 118], [0, 118]] },
          holes: [{ pts: [[40, 40], [40, 78], [78, 78], [78, 40]] }],
        },
      },
      attachment: 'magnetic',
    },
  },
]
