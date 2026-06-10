// Render Factory — Phase 2 (blueprint §8 Phase 2): the internal product-imagery tool.
//
// Dan's standing rulings, all structural here:
//  • INTERNAL — no creator UI; invoked at save, surfaced in the library only.
//  • OFFSCREEN/SANDBOXED — its OWN WebGLRenderer on a detached canvas. NEVER a live-canvas
//    screenshot (the captured-the-creator-framebuffer approach was ruled wrong); the live viewer
//    keeps `preserveDrawingBuffer` OFF.
//  • STANDARDIZED framing + scale (G8) — the camera is computed from the spec's mm dimensions and
//    a fixed fov: every product, every size, framed identically. No user zoom can leak in.
//  • TRANSPARENT background — alpha-0 clear; composites on any library/shop tile.
//  • AUTO-SAVED to folders — POSTs the set to /api/dev/factory-renders for inspection on disk.
//  • Baseline angle set: front / three-quarter / back, hash-tied to the payload they depict.
//
// One spec, one look: the mesh is built by the SAME buildMeshFromSpec from the SAME prepared
// composites, with the SAME suede material params and HDR environment as the live scene — the
// factory photographs the same object the customer sees, never its own interpretation.

import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'
import { EFFECT_BUILD_CONFIG } from '@/lib/effect/prepare-effect'
import { buildMeshFromSpec } from '@/lib/effect/build-mesh'
import type { Contour, SuedeMaterialParams } from '@/lib/effect/types'
import type { SceneSettings } from '../types'

export type FactoryAngle = 'front' | 'threeQuarter' | 'back'

export interface FactoryRender {
  angle: FactoryAngle
  dataUrl: string
  width: number
  height: number
}

export interface FactorySet {
  payload_hash: string
  renders: FactoryRender[]
}

export interface FactoryInputs {
  prepared: PreparedEffect
  /** committed edited outline (mm) if the user reshaped — same source ShapedModel renders. */
  editedContourMM: Contour | null
  suede: SuedeMaterialParams
  backColor: string
  scene: SceneSettings
  payload_hash: string
  /** HDR env path — the same studio HDR the live scene lights with. */
  hdrPath?: string
  /** square tile size (px). */
  tileSize?: number
}

const ANGLES: Record<FactoryAngle, { theta: number; phi: number }> = {
  front: { theta: 0, phi: 90 },          // straight-on
  threeQuarter: { theta: 35, phi: 78 },  // swing + slight tilt → rounded edge + suede depth read
  back: { theta: 180, phi: 90 },         // attachment face
}
const DEG = Math.PI / 180
const FOV = 35
const FIT_MARGIN = 1.32 // breathing room — identical for every product/size (G8)

const texLoader = new THREE.TextureLoader()
async function loadSuedeTex(url: string | undefined, channel: number): Promise<THREE.Texture | null> {
  if (!url) return null
  const t = await texLoader.loadAsync(url)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.NoColorSpace
  t.channel = channel
  return t
}

/**
 * Render the standardized product set OFFSCREEN. Pure function of (spec, materials, environment) —
 * builds its own renderer/scene, renders the three angles, disposes everything, returns PNGs.
 */
export async function renderFactorySet(inputs: FactoryInputs): Promise<FactorySet> {
  const { prepared, editedContourMM, suede, backColor, scene: sceneSettings, payload_hash } = inputs
  const tile = inputs.tileSize ?? 1024
  const hdrPath = inputs.hdrPath ?? '/assets/env/studio_small_03_1k.hdr'

  // own renderer on a DETACHED canvas — the live viewer is never touched
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(tile, tile, false)
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0) // TRANSPARENT
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = sceneSettings.exposure
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = null

  const disposables: { dispose: () => void }[] = []
  try {
    // same studio HDR the live scene lights with
    const hdr = await new RGBELoader().loadAsync(hdrPath)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromEquirectangular(hdr)
    scene.environment = envRT.texture
    scene.environmentIntensity = sceneSettings.envIntensity
    hdr.dispose()
    disposables.push(pmrem, envRT)

    scene.add(new THREE.AmbientLight(0xffffff, sceneSettings.ambientIntensity))

    // the SAME mesh build path as the live scene (one engine; silhouette + composite parity)
    const geom = editedContourMM ?? prepared.spec.geometryMM
    const built = buildMeshFromSpec(
      geom,
      {
        thicknessMM: EFFECT_BUILD_CONFIG.thicknessMM,
        edgeRadiusMM: EFFECT_BUILD_CONFIG.edgeRadiusMM,
        edgeSegments: EFFECT_BUILD_CONFIG.edgeSegments,
        mmPerPx: prepared.spec.mmPerPx,
        imgW: prepared.spec.maskWidthPx,
        imgH: prepared.spec.maskHeightPx,
      },
      prepared.composite,
      prepared.edgeComposite,
    )
    disposables.push(built.geometry, built.texture, built.edgeTexture)
    built.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    const [normalMap, roughnessMap, bumpMap] = await Promise.all([
      loadSuedeTex(suede.normalMap, 1),
      loadSuedeTex(suede.roughnessMap, 1),
      loadSuedeTex(suede.bumpMap, 1),
    ])
    for (const t of [normalMap, roughnessMap, bumpMap]) if (t) disposables.push(t)

    const common = {
      normalMap,
      normalScale: new THREE.Vector2(suede.normalScale, suede.normalScale),
      bumpMap,
      bumpScale: suede.bumpScale,
      roughnessMap,
      side: THREE.DoubleSide,
    }
    const frontMaterial = new THREE.MeshPhysicalMaterial({
      ...common, map: built.texture, color: new THREE.Color(0xffffff),
      roughness: suede.roughness, metalness: suede.metalness,
      sheen: suede.sheen, sheenColor: new THREE.Color(suede.sheenColor), sheenRoughness: suede.sheenRoughness,
      envMapIntensity: suede.envMapIntensity,
    })
    const edgeMaterial = new THREE.MeshPhysicalMaterial({
      ...common, map: built.edgeTexture, color: new THREE.Color(0xffffff),
      roughness: 1, metalness: 0, sheen: 0, envMapIntensity: 0, specularIntensity: 0,
    })
    const backMaterial = new THREE.MeshPhysicalMaterial({
      ...common, color: new THREE.Color(backColor),
      roughness: suede.roughness, metalness: suede.metalness,
      sheen: suede.sheen, sheenColor: new THREE.Color(suede.sheenColor), sheenRoughness: suede.sheenRoughness,
      envMapIntensity: suede.envMapIntensity,
    })
    disposables.push(frontMaterial, edgeMaterial, backMaterial)

    const mesh = new THREE.Mesh(built.geometry, [frontMaterial, edgeMaterial, backMaterial])
    // mm → unit world; geometry is already centred on its bbox by buildShapedGeometry
    scene.add(mesh)

    // G8 standardized framing: distance from the spec's mm bounding sphere + the fixed fov —
    // identical framing for every product and size band; no live-camera state can leak in.
    built.geometry.computeBoundingSphere()
    const radius = built.geometry.boundingSphere?.radius ?? Math.max(built.widthMM, built.heightMM) / 2
    const dist = (radius * FIT_MARGIN) / Math.sin((FOV * DEG) / 2)
    const camera = new THREE.PerspectiveCamera(FOV, 1, dist / 100, dist * 10)

    const renders: FactoryRender[] = []
    for (const angle of ['front', 'threeQuarter', 'back'] as FactoryAngle[]) {
      const { theta, phi } = ANGLES[angle]
      const sph = new THREE.Spherical(dist, phi * DEG, theta * DEG)
      camera.position.setFromSpherical(sph)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
      renders.push({ angle, dataUrl: canvas.toDataURL('image/png'), width: tile, height: tile })
    }

    return { payload_hash, renders }
  } finally {
    for (const d of disposables) d.dispose()
    renderer.dispose()
  }
}

/** Auto-save the set to disk via the dev API (blueprint: auto-saved to folders for inspection). */
export async function saveFactorySet(set: FactorySet): Promise<{ saved: boolean; dir?: string }> {
  try {
    const res = await fetch('/api/dev/factory-renders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(set),
    })
    if (!res.ok) return { saved: false }
    return (await res.json()) as { saved: boolean; dir?: string }
  } catch {
    return { saved: false }
  }
}
