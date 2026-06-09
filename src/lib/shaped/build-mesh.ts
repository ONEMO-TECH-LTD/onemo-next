// build-mesh.ts — the 3D half of the decouple (lean-spec §8.2, Phase B).
//
// `buildMeshFromSpec` takes the resolved mm geometry + the 2D composite canvases produced by
// `prepareSticker` (pure 2D) and builds the three.js mesh + textures — ON DEMAND, only when the
// golden scene mounts ("Finish in 3D"). This is the ONLY place three.js touches the shaped pipeline
// besides mesh.ts; the creation flow (prepareSticker) is three-free. The mesh extrudes the SAME mm
// outline the 2D hero clips to (silhouette parity), and the textures ARE the same composite the 2D
// hero shows (composite parity) — 3D only adds suede/lighting on top.

import * as THREE from 'three'
import type { Contour } from './types'
import { buildShapedGeometry, type MeshOptions } from './mesh'

export interface MeshFromSpec {
  geometry: THREE.BufferGeometry
  texture: THREE.CanvasTexture
  edgeTexture: THREE.CanvasTexture
  widthMM: number
  heightMM: number
}

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false // image loaded y-up + UV v = py/H → upright without an extra flip (matches pipeline.ts)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

/**
 * Build the shaped mesh + front/edge textures from a resolved mm contour + the 2D composites.
 * `opts` carries the physical build params (thickness/edge/mmPerPx/imgW/imgH). The textures are the
 * front magic-blend composite and the strongly-blurred edge-lip composite from `prepareSticker`.
 */
export function buildMeshFromSpec(
  geometryMM: Contour,
  opts: MeshOptions,
  composite: HTMLCanvasElement,
  edgeComposite: HTMLCanvasElement,
): MeshFromSpec {
  const { geometry, widthMM, heightMM } = buildShapedGeometry(geometryMM, opts)
  const texture = canvasTexture(composite)
  const edgeTexture = canvasTexture(edgeComposite)
  return { geometry, texture, edgeTexture, widthMM, heightMM }
}
