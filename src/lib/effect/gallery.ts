// gallery.ts — §8.8 render-factory gallery (lean-spec §3 + §8 step 8 + §11).
//
// The render factory's core = the flat 2D shape-truth (the prepareEffect composite) + a 3-angle product
// gallery captured FROM the on-demand golden scene at save: front · three-quarter (shows the rounded edge
// + suede depth) · back (the attachment face). v1 = BROWSER CAPTURE (no render farm — §3).
//
// WYSIWYG / material honesty: we render the REAL scene through the REAL output pipeline (tone-mapping +
// sRGB + environment) and read the canvas — so the gallery matches the on-screen object exactly, the
// "same object everywhere" guarantee. (A render-target path would have to re-replicate that pipeline and
// risk colour drift, so we capture the live framebuffer instead.)
//
// Hash-tied (§11 dependency-invalidation): GalleryArtifact carries the payload_hash it was captured for,
// so a Phase-A geometry edit → a new payload_hash → the prior gallery is detectably stale.
//
// Phase B ONLY (three import here) — never imported by the Phase-A (WebGL-free) creation graph.

import * as THREE from 'three'

export type GalleryAngle = 'front' | 'threeQuarter' | 'back'

export interface GalleryCapture {
  angle: GalleryAngle
  dataUrl: string
  width: number
  height: number
}

export interface GalleryArtifact {
  payload_hash: string       // the manufactured payload this gallery depicts (stale on a geometry edit)
  flat2D_dataUrl: string     // the flat shape-truth tile (the prepareEffect composite, upright)
  renders: GalleryCapture[]  // the 3 golden-scene angles
}

export interface CaptureContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
}

export interface CaptureOptions {
  /** image mime for toDataURL (default image/png — lossless product image). */
  mime?: string
  /** orbit target the angles rotate about (default origin — the golden mesh is <Center>ed at origin). */
  target?: [number, number, number]
}

// Angle perturbations relative to the scene's CURRENT camera spherical (deg). `front` is the live pose,
// captured exactly (no reposition → pixel-identical to what's on screen). `threeQuarter` swings around +
// tilts toward the equator so the rounded edge + suede depth read; `back` is the opposite (attachment) face.
// Derived by perturbing the CURRENT spherical, so the set tracks the golden framing rather than hard-coding
// absolute angles.
const ANGLE_OFFSETS: Record<GalleryAngle, { dTheta: number; dPhi: number }> = {
  front: { dTheta: 0, dPhi: 0 },           // the live azimuth/polar, but FIT-FRAMED (not the user's zoom)
  threeQuarter: { dTheta: 35, dPhi: 12 },  // swing + tilt toward equator → rounded edge + suede depth read
  back: { dTheta: 180, dPhi: 0 },          // opposite (attachment) face
}
const ORDER: GalleryAngle[] = ['front', 'threeQuarter', 'back']
const DEG = Math.PI / 180
const FIT_MARGIN = 1.3 // breathing room around the framed effect

/**
 * World-space bounds of the EFFECT mesh — the SMALLEST renderable mesh in the scene (the environment /
 * ground projection, if any, is far larger; lights aren't meshes). Used to FIT each capture tightly to
 * the effect so the gallery reads as product shots, not specks lost in the golden scene's wide framing.
 */
function effectMeshBounds(root: THREE.Object3D): { center: THREE.Vector3; radius: number } | null {
  let best: { center: THREE.Vector3; radius: number } | null = null
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry || m.visible === false) return
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
    const bs = m.geometry.boundingSphere
    if (!bs || bs.radius <= 0) return
    const center = bs.center.clone(); m.localToWorld(center)
    const s = new THREE.Vector3(); m.getWorldScale(s)
    const radius = bs.radius * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z))
    if (radius <= 1e-6) return
    if (!best || radius < best.radius) best = { center, radius } // smallest mesh = the effect
  })
  return best
}

/**
 * Center-crop the (wide) framebuffer to a SQUARE product tile. The effect is centered + fit to the
 * vertical fov, so the square crop frames it cleanly (no letterbox specks). Requires the renderer to be
 * created with `preserveDrawingBuffer: true` — else drawImage reads an empty buffer under demand frameloop.
 */
function squareCrop(el: HTMLCanvasElement, mime: string): { dataUrl: string; size: number } {
  const size = Math.min(el.width, el.height)
  const sx = (el.width - size) / 2
  const sy = (el.height - size) / 2
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  c.getContext('2d')!.drawImage(el, sx, sy, size, size, 0, 0, size, size)
  return { dataUrl: c.toDataURL(mime), size }
}

/**
 * Capture the 3 product angles from the live golden scene as SQUARE, FIT-FRAMED tiles. ALL angles
 * (front / threeQuarter / back) orbit the effect mesh at a fit distance computed from its bounding sphere
 * + the camera fov, so the effect FILLS each tile (a product shot, not a speck — the §8.8 framing fix).
 * Restores the live camera pose + re-renders at the end so the on-screen view is unchanged. REQUIRES the
 * renderer created with `preserveDrawingBuffer: true` — else the capture reads an empty buffer under
 * `frameloop="demand"`. `opts.target` is only a fallback when no effect mesh is found.
 */
export async function captureGallery(ctx: CaptureContext, opts: CaptureOptions = {}): Promise<GalleryCapture[]> {
  const { renderer, scene, camera } = ctx
  const mime = opts.mime ?? 'image/png'
  const el = renderer.domElement

  const savedPos = camera.position.clone()
  const savedQuat = camera.quaternion.clone()

  // Frame to the effect mesh (fit-to-bbox); fall back to origin + the live distance if no mesh is found.
  const bounds = effectMeshBounds(scene)
  const target = bounds ? bounds.center.clone() : new THREE.Vector3(...(opts.target ?? [0, 0, 0]))
  const baseSph = new THREE.Spherical().setFromVector3(savedPos.clone().sub(target))
  let fitRadius = baseSph.radius
  if (bounds && camera instanceof THREE.PerspectiveCamera) {
    // fit the bounding sphere to the VERTICAL fov (= the square crop's axis) so the square tile frames it
    fitRadius = (bounds.radius * FIT_MARGIN) / Math.sin((camera.fov * DEG) / 2)
  }

  const renders: GalleryCapture[] = []
  for (const angle of ORDER) {
    const { dTheta, dPhi } = ANGLE_OFFSETS[angle]
    const sph = baseSph.clone()
    sph.theta += dTheta * DEG
    sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi * DEG, 0.05, Math.PI - 0.05)
    sph.radius = fitRadius
    sph.makeSafe()
    camera.position.setFromSpherical(sph).add(target)
    camera.lookAt(target)
    camera.updateMatrixWorld(true)
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const { dataUrl, size } = squareCrop(el, mime)
    renders.push({ angle, dataUrl, width: size, height: size })
  }

  // restore the live pose + re-render so the visible view is unchanged
  camera.position.copy(savedPos)
  camera.quaternion.copy(savedQuat)
  camera.updateMatrixWorld(true)
  if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix()
  renderer.render(scene, camera)

  return renders
}

/** Flat shape-truth tile: the prepareEffect composite is y-up (3D-UV parity) → flip to an upright dataUrl. */
export function flatTileDataUrl(composite: HTMLCanvasElement, mime = 'image/png'): string {
  const c = document.createElement('canvas')
  c.width = composite.width
  c.height = composite.height
  const g = c.getContext('2d')!
  g.translate(0, composite.height)
  g.scale(1, -1)
  g.drawImage(composite, 0, 0)
  return c.toDataURL(mime)
}

/**
 * Assemble the hash-tied gallery artifact (flat shape-truth + the 3 golden-scene angles). In-memory only —
 * DB/Cloudinary persistence is §8.7b.
 */
export function assembleGallery(
  payload_hash: string,
  flat2DDataUrl: string,
  renders: GalleryCapture[],
): GalleryArtifact {
  return { payload_hash, flat2D_dataUrl: flat2DDataUrl, renders }
}
