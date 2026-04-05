// StudioViewport — Studio-specific viewport wrapper with navigation, grid, gizmos, selection.
// Wraps the golden EffectViewer from prototype. Studio controls are injected as children.
// The renderer code is EffectViewer — Studio is purely UI/UX.

import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewcube, TransformControls } from '@react-three/drei'
import React, { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import EffectViewer, { type EffectViewerBridge as CoreBridge } from '../../../../src/app/(dev)/prototype/core/EffectViewer'
import type { ViewerConfig, DesignState } from '../../../../src/app/(dev)/prototype/types'

const DEFAULT_ARTWORK = '/assets/test-artwork.png'

export interface EffectViewerBridge {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  modelRoot: THREE.Object3D
  materialSlots: Map<string, THREE.Material | THREE.Material[]>
  orbitControls?: React.ComponentRef<typeof OrbitControls> | null
  keyLight?: THREE.PointLight | null
}

export interface EffectViewerTransformSnapshot {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export type ViewerRenderPass =
  | 'standard'
  | 'albedo'
  | 'opacity'
  | 'worldNormal'
  | 'specularity'
  | 'gloss'
  | 'metalness'
  | 'ao'
  | 'emission'
  | 'lighting'
  | 'uv0'

export type ViewerCameraPreset =
  | 'perspective'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'

export type ViewerCameraCommand =
  | {
      kind: 'focus'
      seq: number
    }
  | {
      kind: 'entity'
      resourceId: string
      seq: number
    }
  | {
      kind: 'preset'
      preset: ViewerCameraPreset
      seq: number
    }

export interface ViewerGridSettings {
  enabled: boolean
  divisions: number
  cellSize: number
}

export interface ViewerTransformSnapSettings {
  enabled: boolean
  increment: number
}

const LOOK_SENSITIVITY = 0.002
const ROTATION_SNAP_MULTIPLIER = 5

class ViewportErrorBoundary extends React.Component<
  { background: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[effect-viewer] Viewport render failed', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: this.props.background,
            color: '#f5f5f5',
            fontSize: 14,
            letterSpacing: '0.01em',
          }}
        >
          Viewport error. Check the console.
        </div>
      )
    }

    return this.props.children
  }
}

function syncOrbitTargetFromCamera(
  camera: THREE.Camera,
  orbitControls: React.ComponentRef<typeof OrbitControls> | null
) {
  if (!orbitControls) {
    return
  }

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  const distance = Math.max(
    orbitControls.target.distanceTo(camera.position),
    0.001
  )
  orbitControls.target.copy(camera.position).add(forward.multiplyScalar(distance))
  orbitControls.update()
}

function normalizeCameraRect(value: unknown): [number, number, number, number] {
  if (!Array.isArray(value) || value.length < 4) {
    return [0, 0, 1, 1]
  }

  const nextRect = [
    Number(value[0] ?? 0),
    Number(value[1] ?? 0),
    Number(value[2] ?? 1),
    Number(value[3] ?? 1),
  ] as [number, number, number, number]

  nextRect[0] = THREE.MathUtils.clamp(nextRect[0], 0, 1)
  nextRect[1] = THREE.MathUtils.clamp(nextRect[1], 0, 1)
  nextRect[2] = THREE.MathUtils.clamp(nextRect[2], 0, 1)
  nextRect[3] = THREE.MathUtils.clamp(nextRect[3], 0, 1)

  if (nextRect[2] <= 0 || nextRect[3] <= 0) {
    return [0, 0, 1, 1]
  }

  return nextRect
}

function normalizeCameraLayers(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const nextLayers = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < 32)

  return nextLayers.length ? nextLayers : null
}

function getCameraRuntimeSignature(camera: THREE.Camera) {
  return JSON.stringify({
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    scale: camera.scale.toArray(),
    projection: camera instanceof THREE.OrthographicCamera ? 'orthographic' : 'perspective',
    fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : null,
    orthoHeight: camera instanceof THREE.OrthographicCamera ? Math.abs(camera.top) : null,
    near: 'near' in camera ? camera.near : null,
    far: 'far' in camera ? camera.far : null,
    userData: {
      clearColor: camera.userData?.clearColor ?? null,
      clearColorBuffer: camera.userData?.clearColorBuffer ?? null,
      clearDepthBuffer: camera.userData?.clearDepthBuffer ?? null,
      rect: camera.userData?.rect ?? null,
      layers: camera.userData?.layers ?? null,
      frustumCulling: camera.userData?.frustumCulling ?? null,
      toneMapping: camera.userData?.toneMapping ?? null,
      gammaCorrection: camera.userData?.gammaCorrection ?? null,
    },
  })
}

function ViewportGridHelper({
  visible,
  size,
  divisions,
}: {
  visible: boolean
  size: number
  divisions: number
}) {
  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(
      size,
      Math.max(divisions, 1),
      new THREE.Color('#909090'),
      new THREE.Color('#5d5d5d')
    )
    helper.position.y = 0

    const materials = Array.isArray(helper.material) ? helper.material : [helper.material]
    materials.forEach((material) => {
      material.transparent = true
      material.opacity = 0.45
      material.depthWrite = false
    })

    return helper
  }, [divisions, size])

  useEffect(() => {
    return () => {
      gridHelper.geometry.dispose()
      const materials = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material]
      materials.forEach((material) => material.dispose())
    }
  }, [gridHelper])

  if (!visible) {
    return null
  }

  return <primitive object={gridHelper} />
}

function ViewportNavigationController({
  orbitControlsRef,
  enabled,
}: {
  orbitControlsRef: RefObject<React.ComponentRef<typeof OrbitControls> | null>
  enabled: boolean
}) {
  const { camera, gl } = useThree()
  const lookActiveRef = useRef(false)
  const shiftPanActiveRef = useRef(false)
  const previousOrbitEnabledRef = useRef<boolean | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const shiftKeyRef = useRef(false)
  const movementRef = useRef({
    forward: false,
    left: false,
    back: false,
    right: false,
    up: false,
    down: false,
    fast: false,
  })
  const forwardRef = useRef(new THREE.Vector3())
  const rightRef = useRef(new THREE.Vector3())
  const moveRef = useRef(new THREE.Vector3())
  const worldUpRef = useRef(new THREE.Vector3(0, 1, 0))

  useEffect(() => {
    const element = gl.domElement

    const restoreLeftMouse = () => {
      const controls = orbitControlsRef.current
      if (controls) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
      }
    }

    const stopLookMode = () => {
      const controls = orbitControlsRef.current
      lookActiveRef.current = false
      pointerRef.current = null
      movementRef.current = {
        forward: false,
        left: false,
        back: false,
        right: false,
        up: false,
        down: false,
        fast: false,
      }

      if (controls) {
        controls.enabled = previousOrbitEnabledRef.current ?? enabled
        previousOrbitEnabledRef.current = null
        syncOrbitTargetFromCamera(camera, controls)
      }

      restoreLeftMouse()
    }

    const stopShiftPanMode = () => {
      const controls = orbitControlsRef.current
      shiftPanActiveRef.current = false
      pointerRef.current = null

      if (controls) {
        controls.enabled = previousOrbitEnabledRef.current ?? enabled
        previousOrbitEnabledRef.current = null
        controls.update()
      }

      restoreLeftMouse()
    }

    const isInputLike = (target: EventTarget | null) => {
      return target instanceof HTMLElement && (
        target.isContentEditable ||
        /input|textarea|select/i.test(target.tagName)
      )
    }

    const setMovement = (code: string, value: boolean) => {
      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
          movementRef.current.forward = value
          return true
        case 'ArrowLeft':
        case 'KeyA':
          movementRef.current.left = value
          return true
        case 'ArrowDown':
        case 'KeyS':
          movementRef.current.back = value
          return true
        case 'ArrowRight':
        case 'KeyD':
          movementRef.current.right = value
          return true
        case 'KeyE':
        case 'PageUp':
          movementRef.current.up = value
          return true
        case 'KeyQ':
        case 'PageDown':
          movementRef.current.down = value
          return true
        default:
          return false
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const controls = orbitControlsRef.current

      if (event.button === 0 && (event.shiftKey || shiftKeyRef.current)) {
        event.preventDefault()
        shiftPanActiveRef.current = true
        pointerRef.current = { x: event.clientX, y: event.clientY }

        if (controls) {
          previousOrbitEnabledRef.current = controls.enabled
          controls.enabled = false
        }

        return
      }

      if (!enabled || event.button !== 2) {
        return
      }

      event.preventDefault()
      lookActiveRef.current = true
      pointerRef.current = { x: event.clientX, y: event.clientY }

      if (controls) {
        previousOrbitEnabledRef.current = controls.enabled
        controls.enabled = false
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (shiftPanActiveRef.current) {
        const previousPointer = pointerRef.current
        pointerRef.current = { x: event.clientX, y: event.clientY }
        if (!previousPointer) {
          return
        }

        const orbitControls = orbitControlsRef.current
        const orbitDistance = orbitControls ? orbitControls.target.distanceTo(camera.position) : camera.position.length()
        const panScale = Math.max(orbitDistance, 0.1) / Math.max(gl.domElement.clientHeight, 1) * 2
        const right = rightRef.current
        const pan = moveRef.current.set(0, 0, 0)
        right.crossVectors(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), worldUpRef.current).normalize()
        pan
          .addScaledVector(right, -(event.clientX - previousPointer.x) * panScale)
          .addScaledVector(worldUpRef.current, (event.clientY - previousPointer.y) * panScale)

        camera.position.add(pan)
        if (orbitControls) {
          orbitControls.target.add(pan)
          orbitControls.update()
        }
        return
      }

      if (!lookActiveRef.current) {
        return
      }

      const previousPointer = pointerRef.current
      const movementX = event.movementX || (previousPointer ? event.clientX - previousPointer.x : 0)
      const movementY = event.movementY || (previousPointer ? event.clientY - previousPointer.y : 0)
      pointerRef.current = { x: event.clientX, y: event.clientY }

      const nextEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      nextEuler.y -= movementX * LOOK_SENSITIVITY
      nextEuler.x = THREE.MathUtils.clamp(
        nextEuler.x - movementY * LOOK_SENSITIVITY,
        -Math.PI / 2 + 0.01,
        Math.PI / 2 - 0.01
      )
      camera.quaternion.setFromEuler(nextEuler)
      syncOrbitTargetFromCamera(camera, orbitControlsRef.current)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 0 && shiftPanActiveRef.current) {
        pointerRef.current = null
        stopShiftPanMode()
        return
      }

      if (event.button === 2) {
        pointerRef.current = null
        stopLookMode()
      }
    }

    const handleContextMenu = (event: MouseEvent) => {
      if (lookActiveRef.current || event.button === 2) {
        event.preventDefault()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        shiftKeyRef.current = true
        movementRef.current.fast = true
      }

      if (
        !lookActiveRef.current ||
        isInputLike(event.target) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return
      }

      if (setMovement(event.code, true)) {
        event.preventDefault()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        shiftKeyRef.current = false
        movementRef.current.fast = false
      }

      if (
        !lookActiveRef.current ||
        isInputLike(event.target) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return
      }

      if (setMovement(event.code, false)) {
        event.preventDefault()
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLookMode()
      }
    }

    element.addEventListener('pointerdown', handlePointerDown, true)
    element.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('pointermove', handlePointerMove, true)
    window.addEventListener('pointerup', handlePointerUp, true)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', stopLookMode)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown, true)
      element.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('pointermove', handlePointerMove, true)
      window.removeEventListener('pointerup', handlePointerUp, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', stopLookMode)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopLookMode()
      stopShiftPanMode()
    }
  }, [camera, enabled, gl, orbitControlsRef])

  useFrame((_, delta) => {
    if (!enabled || !lookActiveRef.current) {
      return
    }

    const movement = movementRef.current
    if (
      !movement.forward &&
      !movement.left &&
      !movement.back &&
      !movement.right &&
      !movement.up &&
      !movement.down
    ) {
      return
    }

    const orbitControls = orbitControlsRef.current
    const orbitDistance = orbitControls ? orbitControls.target.distanceTo(camera.position) : camera.position.length()
    const speed = Math.max(orbitDistance * 2, 0.1) * (movement.fast ? 2 : 1)
    const forward = forwardRef.current
    const right = rightRef.current
    const move = moveRef.current.set(0, 0, 0)

    camera.getWorldDirection(forward)
    forward.normalize()
    right.crossVectors(forward, worldUpRef.current).normalize()

    if (movement.forward) move.add(forward)
    if (movement.back) move.sub(forward)
    if (movement.right) move.add(right)
    if (movement.left) move.sub(right)
    if (movement.up) move.add(worldUpRef.current)
    if (movement.down) move.sub(worldUpRef.current)

    if (move.lengthSq() === 0) {
      return
    }

    move.normalize().multiplyScalar(speed * delta)
    camera.position.add(move)
    syncOrbitTargetFromCamera(camera, orbitControls)
  })

  return null
}

interface EffectViewerProps {
  config: ViewerConfig
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
  onBridgeReady?: (bridge: EffectViewerBridge) => void
  selectedResourceIds?: string[]
  resolveObjectById?: (resourceId: string) => THREE.Object3D | null
  resolveIdByObject?: (object: THREE.Object3D) => string | null
  onSelectResourceId?: (resourceId: string) => void
  onTransformCommit?: (payload: {
    resourceId: string
    before: EffectViewerTransformSnapshot
    after: EffectViewerTransformSnapshot
  }) => void
  onSceneChange?: () => void
  transformMode?: 'translate' | 'rotate' | 'scale' | 'disabled'
  transformSpace?: 'world' | 'local'
  showGizmoHelper?: boolean
  enableTransformControls?: boolean
  renderPass?: ViewerRenderPass
  wireframeEnabled?: boolean
  gridSettings?: ViewerGridSettings
  transformSnapSettings?: ViewerTransformSnapSettings
  cameraCommand?: ViewerCameraCommand | null
  sceneObjectRevision?: number
  activeSceneCameraResourceId?: string | null
  onCameraCommandConsumed?: () => void
}

function snapshotObjectTransform(object: THREE.Object3D): EffectViewerTransformSnapshot {
  return {
    position: [
      Number(object.position.x.toFixed(6)),
      Number(object.position.y.toFixed(6)),
      Number(object.position.z.toFixed(6)),
    ],
    rotation: [
      Number(THREE.MathUtils.radToDeg(object.rotation.x).toFixed(6)),
      Number(THREE.MathUtils.radToDeg(object.rotation.y).toFixed(6)),
      Number(THREE.MathUtils.radToDeg(object.rotation.z).toFixed(6)),
    ],
    scale: [
      Number(object.scale.x.toFixed(6)),
      Number(object.scale.y.toFixed(6)),
      Number(object.scale.z.toFixed(6)),
    ],
  }
}

function disposeHelperObject(helper: THREE.Object3D) {
  helper.traverse((child) => {
    if ('geometry' in child) {
      const geo = (child as THREE.Mesh).geometry
      if (geo && typeof geo.dispose === 'function') {
        geo.dispose()
      }
    }

    if ('material' in child) {
      const { material } = child as { material?: THREE.Material | THREE.Material[] }
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose())
      } else if (material) {
        material.dispose()
      }
    }
  })
}

function flattenMaterials(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material]
}

function createUvDebugMaterial(source: THREE.Material, wireframe: boolean) {
  return new THREE.ShaderMaterial({
    wireframe,
    side: source.side,
    transparent: source.transparent,
    opacity: source.opacity,
    uniforms: {},
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        vec2 tiled = fract(vUv);
        gl_FragColor = vec4(tiled.x, tiled.y, 0.0, 1.0);
      }
    `,
  })
}

function createDebugMaterial(source: THREE.Material, renderPass: ViewerRenderPass, wireframe: boolean) {
  if (renderPass === 'worldNormal') {
    return new THREE.MeshNormalMaterial({
      wireframe,
      side: source.side,
      transparent: source.transparent,
      opacity: source.opacity,
    })
  }

  if (renderPass === 'uv0') {
    return createUvDebugMaterial(source, wireframe)
  }

  if (!(source instanceof THREE.MeshStandardMaterial) && !(source instanceof THREE.MeshPhysicalMaterial)) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      wireframe,
      side: source.side,
      transparent: source.transparent,
      opacity: source.opacity,
    })
  }

  if (renderPass === 'lighting') {
    const clone = source.clone()
    clone.wireframe = wireframe
    return clone
  }

  const baseConfig: THREE.MeshBasicMaterialParameters = {
    wireframe,
    side: source.side,
    transparent: source.transparent,
    opacity: source.opacity,
  }

  if (renderPass === 'albedo') {
    return new THREE.MeshBasicMaterial({
      ...baseConfig,
      color: source.color.clone(),
      map: source.map ?? null,
    })
  }

  if (renderPass === 'opacity') {
    const opacity = source.transparent ? source.opacity : 1
    return new THREE.MeshBasicMaterial({
      ...baseConfig,
      color: new THREE.Color(opacity, opacity, opacity),
      alphaMap: source.alphaMap ?? null,
      transparent: true,
      opacity,
    })
  }

  if (renderPass === 'emission') {
    const emissiveIntensity = source.emissiveIntensity ?? 1
    return new THREE.MeshBasicMaterial({
      ...baseConfig,
      color: source.emissive.clone().multiplyScalar(emissiveIntensity),
      map: source.emissiveMap ?? null,
    })
  }

  if (renderPass === 'specularity') {
    const meshPhysical = source instanceof THREE.MeshPhysicalMaterial ? source : null
    const specularColor = meshPhysical?.specularColor?.clone() ?? new THREE.Color(1 - source.roughness, 1 - source.roughness, 1 - source.roughness)
    const specularIntensity = meshPhysical?.specularIntensity ?? 1
    return new THREE.MeshBasicMaterial({
      ...baseConfig,
      color: specularColor.multiplyScalar(specularIntensity),
      map: meshPhysical?.specularColorMap ?? null,
    })
  }

  if (renderPass === 'gloss') {
    const gloss = 1 - source.roughness
    return new THREE.MeshBasicMaterial({
      ...baseConfig,
      color: new THREE.Color(gloss, gloss, gloss),
    })
  }

  if (renderPass === 'metalness') {
    return new THREE.MeshBasicMaterial({
      ...baseConfig,
      color: new THREE.Color(source.metalness, source.metalness, source.metalness),
    })
  }

  if (renderPass === 'ao') {
    const intensity = source.aoMapIntensity ?? 1
    return new THREE.MeshBasicMaterial({
      ...baseConfig,
      color: new THREE.Color(intensity, intensity, intensity),
    })
  }

  return source.clone()
}

function applyWireframe(material: THREE.Material | THREE.Material[], enabled: boolean) {
  flattenMaterials(material).forEach((entry) => {
    if ('wireframe' in entry) {
      ;(entry as THREE.Material & { wireframe?: boolean }).wireframe = enabled
    }
  })
}

function SelectionOutline({ target }: { target: THREE.Object3D | null }) {
  const scene = useThree((state) => state.scene)
  const helperRef = useRef<THREE.BoxHelper | null>(null)
  const specialHelperRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    const helper = new THREE.BoxHelper(new THREE.Object3D(), 0xffa24c)
    helper.visible = false
    scene.add(helper)
    helperRef.current = helper

    return () => {
      scene.remove(helper)
      helper.geometry.dispose()
      ;(helper.material as THREE.Material).dispose()
      helperRef.current = null
    }
  }, [scene])

  useEffect(() => {
    if (specialHelperRef.current) {
      scene.remove(specialHelperRef.current)
      disposeHelperObject(specialHelperRef.current)
      specialHelperRef.current = null
    }

    if (target instanceof THREE.Camera) {
      const helper = new THREE.CameraHelper(target)
      scene.add(helper)
      specialHelperRef.current = helper
      return
    }

    if (target instanceof THREE.PointLight) {
      const helper = new THREE.PointLightHelper(target, 0.05, 0xffa24c)
      scene.add(helper)
      specialHelperRef.current = helper
      return
    }

    if (target instanceof THREE.SpotLight) {
      const helper = new THREE.SpotLightHelper(target, 0xffa24c)
      scene.add(helper)
      specialHelperRef.current = helper
      return
    }

    if (target instanceof THREE.DirectionalLight) {
      const helper = new THREE.DirectionalLightHelper(target, 0.04, 0xffa24c)
      scene.add(helper)
      specialHelperRef.current = helper
    }
  }, [scene, target])

  useEffect(() => {
    return () => {
      if (!specialHelperRef.current) {
        return
      }

      scene.remove(specialHelperRef.current)
      disposeHelperObject(specialHelperRef.current)
      specialHelperRef.current = null
    }
  }, [scene])

  useFrame(() => {
    const boxHelper = helperRef.current
    const specialHelper = specialHelperRef.current
    const canOutline = !!target && !(target instanceof THREE.Camera) && !(target instanceof THREE.Light)

    if (!boxHelper || !canOutline) {
      if (boxHelper) {
        boxHelper.visible = false
      }
    } else {
      boxHelper.setFromObject(target)
      boxHelper.visible = true
    }

    if (!specialHelper) {
      return
    }

    specialHelper.visible = !!target

    if (specialHelper instanceof THREE.CameraHelper) {
      specialHelper.update()
      return
    }

    if (specialHelper instanceof THREE.PointLightHelper) {
      specialHelper.update()
      return
    }

    if (specialHelper instanceof THREE.SpotLightHelper) {
      specialHelper.update()
      return
    }

    if (specialHelper instanceof THREE.DirectionalLightHelper) {
      specialHelper.update()
    }
  })

  return null
}

function EditorViewportOverlay({
  selectedResourceIds,
  resolveObjectById,
  resolveIdByObject,
  onSelectResourceId,
  onTransformCommit,
  onSceneChange,
  orbitControlsRef,
  transformMode,
  transformSpace,
  snapSettings,
  showGizmoHelper,
  enableTransformControls,
  sceneObjectRevision,
}: {
  selectedResourceIds: string[]
  resolveObjectById?: (resourceId: string) => THREE.Object3D | null
  resolveIdByObject?: (object: THREE.Object3D) => string | null
  onSelectResourceId?: (resourceId: string) => void
  onTransformCommit?: (payload: {
    resourceId: string
    before: EffectViewerTransformSnapshot
    after: EffectViewerTransformSnapshot
  }) => void
  onSceneChange?: () => void
  orbitControlsRef: RefObject<React.ComponentRef<typeof OrbitControls> | null>
  transformMode: 'translate' | 'rotate' | 'scale' | 'disabled'
  transformSpace: 'world' | 'local'
  snapSettings?: ViewerTransformSnapSettings
  showGizmoHelper?: boolean
  enableTransformControls?: boolean
  sceneObjectRevision?: number
}) {
  const { camera, scene, gl } = useThree()
  const selectedObject = useMemo(() => {
    if (!selectedResourceIds.length || !resolveObjectById) {
      return null
    }

    return resolveObjectById(selectedResourceIds[0])
  }, [resolveObjectById, sceneObjectRevision, selectedResourceIds])

  const transformControlsRef = useRef<React.ComponentRef<typeof TransformControls>>(null)
  const lightProxyRef = useRef<THREE.Group>(new THREE.Group())
  const isDraggingRef = useRef(false)
  const dragStartTransformRef = useRef<EffectViewerTransformSnapshot | null>(null)
  const dragResourceIdRef = useRef<string | null>(null)
  const ignoreClickUntilRef = useRef(0)
  const pointerRef = useRef(new THREE.Vector2())
  const raycasterRef = useRef(new THREE.Raycaster())
  const selectedLight = selectedObject instanceof THREE.Light ? selectedObject : null
  const transformTarget = selectedLight ?? selectedObject
  const transformObject = selectedLight ? lightProxyRef.current : selectedObject

  useEffect(() => {
    if (!selectedLight || isDraggingRef.current) {
      return
    }

    lightProxyRef.current.position.copy(selectedLight.position)
    lightProxyRef.current.quaternion.copy(selectedLight.quaternion)
    lightProxyRef.current.scale.copy(selectedLight.scale)
    lightProxyRef.current.updateMatrixWorld(true)
  }, [selectedLight])

  useFrame(() => {
    if (!selectedLight || isDraggingRef.current) {
      return
    }

    lightProxyRef.current.position.copy(selectedLight.position)
    lightProxyRef.current.quaternion.copy(selectedLight.quaternion)
    lightProxyRef.current.scale.copy(selectedLight.scale)
  })

  useEffect(() => {
    const element = gl.domElement
    const handleClick = (event: MouseEvent) => {
      if (Date.now() < ignoreClickUntilRef.current) {
        return
      }

      if (isDraggingRef.current || !resolveIdByObject || !onSelectResourceId) {
        return
      }

      const rect = element.getBoundingClientRect()
      pointerRef.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )

      raycasterRef.current.setFromCamera(pointerRef.current, camera)
      const intersection = raycasterRef.current
        .intersectObjects(scene.children, true)
        .find((entry) => !!resolveIdByObject(entry.object))

      if (!intersection) {
        onSelectResourceId('')
        return
      }

      const resourceId = resolveIdByObject(intersection.object)
      if (resourceId) {
        onSelectResourceId(resourceId)
      }
    }

    element.addEventListener('click', handleClick)
    return () => {
      element.removeEventListener('click', handleClick)
    }
  }, [camera, gl, onSelectResourceId, resolveIdByObject, scene])

  useEffect(() => {
    const controls = transformControlsRef.current
    const orbitControls = orbitControlsRef.current
    if (!controls) {
      return
    }

    const handleDraggingChange = (event: { value: boolean }) => {
      isDraggingRef.current = event.value
      if (orbitControls) {
        orbitControls.enabled = !event.value
      }

      if (event.value) {
        dragStartTransformRef.current = transformTarget ? snapshotObjectTransform(transformTarget) : null
        dragResourceIdRef.current = transformTarget && resolveIdByObject ? resolveIdByObject(transformTarget) : null
        return
      }

      const resourceId = dragResourceIdRef.current
      if (transformTarget && resourceId && dragStartTransformRef.current && onTransformCommit) {
        onTransformCommit({
          resourceId,
          before: dragStartTransformRef.current,
          after: snapshotObjectTransform(transformTarget),
        })
      }

      dragStartTransformRef.current = null
      dragResourceIdRef.current = null
      ignoreClickUntilRef.current = Date.now() + 400
    }

    const handleObjectChange = () => {
      if (selectedLight) {
        selectedLight.position.copy(lightProxyRef.current.position)
        selectedLight.quaternion.copy(lightProxyRef.current.quaternion)
        selectedLight.scale.copy(lightProxyRef.current.scale)
        selectedLight.updateMatrixWorld(true)

        // Sync directional light target from rotation so the light direction
        // follows the gizmo orientation instead of always pointing at (0,0,0).
        if (selectedLight instanceof THREE.DirectionalLight && selectedLight.target) {
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(selectedLight.quaternion)
          selectedLight.target.position.copy(selectedLight.position).add(dir)
          selectedLight.target.updateMatrixWorld(true)
        }
      }

      onSceneChange?.()
    }

    // @ts-expect-error -- TransformControls events exist at runtime but aren't in Object3DEventMap
    controls.addEventListener('dragging-changed', handleDraggingChange)
    // @ts-expect-error -- TransformControls events exist at runtime but aren't in Object3DEventMap
    controls.addEventListener('objectChange', handleObjectChange)
    return () => {
      // @ts-expect-error -- TransformControls events exist at runtime but aren't in Object3DEventMap
      controls.removeEventListener('dragging-changed', handleDraggingChange)
      // @ts-expect-error -- TransformControls events exist at runtime but aren't in Object3DEventMap
      controls.removeEventListener('objectChange', handleObjectChange)
      isDraggingRef.current = false
    }
  }, [onSceneChange, onTransformCommit, orbitControlsRef, resolveIdByObject, selectedLight, transformMode, transformTarget])

  const canTransform =
    !!enableTransformControls &&
    !!transformTarget &&
    transformMode !== 'disabled' &&
    !(transformTarget instanceof THREE.Scene) &&
    (selectedLight ? true : !!transformTarget.parent)
  const translationSnap = snapSettings?.enabled ? snapSettings.increment : undefined
  const rotationSnap = snapSettings?.enabled
    ? THREE.MathUtils.degToRad(snapSettings.increment * ROTATION_SNAP_MULTIPLIER)
    : undefined
  const scaleSnap = snapSettings?.enabled ? snapSettings.increment : undefined

  return (
    <>
      {selectedLight ? <primitive object={lightProxyRef.current} /> : null}
      <SelectionOutline target={selectedObject} />
      {canTransform ? (
        <TransformControls
          key={transformObject?.uuid ?? 'transform-target'}
          ref={transformControlsRef}
          object={transformObject!}
          mode={transformMode}
          space={transformSpace}
          size={0.95}
          translationSnap={translationSnap}
          rotationSnap={rotationSnap}
          scaleSnap={scaleSnap}
        />
      ) : null}
      {showGizmoHelper ? (
        <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
          <GizmoViewcube />
        </GizmoHelper>
      ) : null}
    </>
  )
}

function RenderModeController({
  renderPass,
  wireframeEnabled,
  resolveIdByObject,
}: {
  renderPass: ViewerRenderPass
  wireframeEnabled: boolean
  resolveIdByObject?: (object: THREE.Object3D) => string | null
}) {
  const scene = useThree((state) => state.scene)
  const originalMaterialsRef = useRef(new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>())
  const originalWireframeRef = useRef(new WeakMap<THREE.Material, boolean>())

  useEffect(() => {
    const debugMaterials: THREE.Material[] = []

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !resolveIdByObject?.(child)) {
        return
      }

      if (!originalMaterialsRef.current.has(child)) {
        originalMaterialsRef.current.set(child, child.material)
      }

      const originalMaterial = originalMaterialsRef.current.get(child)!
      flattenMaterials(originalMaterial).forEach((entry) => {
        if (!originalWireframeRef.current.has(entry)) {
          originalWireframeRef.current.set(entry, 'wireframe' in entry ? Boolean((entry as THREE.Material & { wireframe?: boolean }).wireframe) : false)
        }
      })

      if (renderPass === 'standard') {
        child.material = originalMaterial
        applyWireframe(originalMaterial, wireframeEnabled)
        return
      }

      applyWireframe(originalMaterial, false)
      const nextMaterial = Array.isArray(originalMaterial)
        ? originalMaterial.map((entry) => createDebugMaterial(entry, renderPass, wireframeEnabled))
        : createDebugMaterial(originalMaterial, renderPass, wireframeEnabled)
      child.material = nextMaterial
      debugMaterials.push(...flattenMaterials(nextMaterial))
    })

    return () => {
      scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) {
          return
        }

        const originalMaterial = originalMaterialsRef.current.get(child)
        if (!originalMaterial) {
          return
        }

        child.material = originalMaterial
        flattenMaterials(originalMaterial).forEach((entry) => {
          const originalWireframe = originalWireframeRef.current.get(entry)
          if (originalWireframe !== undefined) {
            applyWireframe(entry, originalWireframe)
          }
        })
      })

      debugMaterials.forEach((entry) => entry.dispose())
    }
  }, [renderPass, resolveIdByObject, scene, wireframeEnabled])

  return null
}

function ActiveCameraRuntimeSync({
  config,
}: {
  config: ViewerConfig
}) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const signatureRef = useRef<string | null>(null)

  useFrame(() => {
    const rect = normalizeCameraRect(camera.userData?.rect)
    const layers = normalizeCameraLayers(camera.userData?.layers)
    const clearColorBuffer = camera.userData?.clearColorBuffer !== false
    const clearDepthBuffer = camera.userData?.clearDepthBuffer !== false
    const clearColor = Array.isArray(camera.userData?.clearColor) && camera.userData.clearColor.length >= 3
      ? camera.userData.clearColor
      : null
    const toneMapping = typeof camera.userData?.toneMapping === 'number'
      ? camera.userData.toneMapping
      : config.renderer?.toneMapping
    const gammaCorrection = typeof camera.userData?.gammaCorrection === 'number'
      ? camera.userData.gammaCorrection
      : (config.renderer?.outputColorSpace === 'srgb-linear' ? 0 : 1)
    const frustumCulling = camera.userData?.frustumCulling !== false
    const signature = JSON.stringify({
      rect,
      layers,
      clearColorBuffer,
      clearDepthBuffer,
      clearColor,
      toneMapping,
      gammaCorrection,
      frustumCulling,
    })

    if (signature !== signatureRef.current) {
      signatureRef.current = signature

      if (layers) {
        camera.layers.disableAll()
        layers.forEach((layer) => camera.layers.enable(layer))
      } else {
        camera.layers.mask = 0xffffffff
      }

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = frustumCulling
        }
      })

      if (clearColor) {
        gl.setClearColor(
          new THREE.Color(
            Number(clearColor[0] ?? 1),
            Number(clearColor[1] ?? 1),
            Number(clearColor[2] ?? 1)
          ),
          THREE.MathUtils.clamp(Number(clearColor[3] ?? 1), 0, 1)
        )
      } else {
        gl.setClearColor(config.colors.bgColor, 1)
      }

      if (typeof toneMapping === 'number') {
        gl.toneMapping = toneMapping as THREE.ToneMapping
      }

      gl.outputColorSpace = gammaCorrection === 0
        ? THREE.LinearSRGBColorSpace
        : THREE.SRGBColorSpace
    }

    gl.autoClearColor = clearColorBuffer
    gl.autoClearDepth = clearDepthBuffer

    const fullRect = rect[0] === 0 && rect[1] === 0 && rect[2] === 1 && rect[3] === 1
    if (fullRect) {
      gl.setScissorTest(false)
      gl.setViewport(0, 0, size.width, size.height)
      return
    }

    const x = Math.round(rect[0] * size.width)
    const y = Math.round(rect[1] * size.height)
    const width = Math.max(1, Math.round(rect[2] * size.width))
    const height = Math.max(1, Math.round(rect[3] * size.height))

    gl.setScissorTest(true)
    gl.setViewport(x, y, width, height)
    gl.setScissor(x, y, width, height)
  })

  useEffect(() => {
    return () => {
      gl.setScissorTest(false)
      gl.setViewport(0, 0, size.width, size.height)
      gl.autoClearColor = true
      gl.autoClearDepth = true
      gl.setClearColor(config.colors.bgColor, 1)
    }
  }, [config.colors.bgColor, gl, size.height, size.width])

  return null
}

function resolveSceneIconTextureName(object: THREE.Object3D) {
  if (object instanceof THREE.DirectionalLight) {
    return 'light-directional'
  }

  if (object instanceof THREE.SpotLight) {
    return 'light-spot'
  }

  if (object instanceof THREE.PointLight) {
    return 'light-point'
  }

  if (object instanceof THREE.Camera) {
    return 'camera'
  }

  return 'unknown'
}

function createSceneIconTexture(kind: 'camera' | 'light') {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.Texture()
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  ctx.arc(64, 64, 34, 0, Math.PI * 2)
  ctx.fillStyle = kind === 'camera' ? 'rgba(255,255,255,0.94)' : 'rgba(255,156,64,0.94)'
  ctx.fill()

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (kind === 'camera') {
    ctx.fillStyle = '#203040'
    ctx.fillRect(36, 46, 48, 32)
    ctx.fillRect(44, 40, 16, 10)
    ctx.beginPath()
    ctx.arc(60, 62, 10, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
  } else {
    ctx.strokeStyle = '#fff8ef'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(64, 58, 13, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(64, 72)
    ctx.lineTo(64, 88)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(54, 90)
    ctx.lineTo(74, 90)
    ctx.stroke()
    ;[[40, 40], [88, 40], [40, 78], [88, 78], [64, 28], [64, 102]].forEach(([x, y]) => {
      ctx.beginPath()
      ctx.moveTo(64, 64)
      ctx.lineTo(x, y)
      ctx.stroke()
    })
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function SceneObjectIcons({
  resolveIdByObject,
  sceneObjectRevision,
  activeSceneCameraResourceId,
}: {
  resolveIdByObject?: (object: THREE.Object3D) => string | null
  sceneObjectRevision?: number
  activeSceneCameraResourceId?: string | null
}) {
  const scene = useThree((state) => state.scene)
  const iconTextures = useMemo(() => {
    return {
      camera: createSceneIconTexture('camera'),
      light: createSceneIconTexture('light'),
    }
  }, [])

  const icons = useMemo(() => {
    const nextIcons: {
      resourceId: string
      object: THREE.Object3D
      texture: THREE.Texture
      color: string
    }[] = []

    if (!resolveIdByObject) {
      return nextIcons
    }

    scene.traverse((object) => {
      if (!(object instanceof THREE.Camera) && !(object instanceof THREE.Light)) {
        return
      }

      const resourceId = resolveIdByObject(object)
      if (!resourceId) {
        return
      }

      if (object instanceof THREE.Camera && resourceId === activeSceneCameraResourceId) {
        return
      }

      const textureName = resolveSceneIconTextureName(object)
      const texture = textureName === 'camera'
        ? iconTextures.camera
        : iconTextures.light

      nextIcons.push({
        resourceId,
        object,
        texture,
        color: object instanceof THREE.Light ? `#${object.color.getHexString()}` : '#ffffff',
      })
    })

    return nextIcons
  }, [activeSceneCameraResourceId, iconTextures.camera, iconTextures.light, resolveIdByObject, scene, sceneObjectRevision])

  useEffect(() => {
    return () => {
      iconTextures.camera.dispose()
      iconTextures.light.dispose()
    }
  }, [iconTextures.camera, iconTextures.light])

  return (
    <>
      {icons.map((icon) => (
        <SceneObjectIconSprite
          key={icon.resourceId}
          object={icon.object}
          texture={icon.texture}
          color={icon.color}
        />
      ))}
    </>
  )
}

function SceneObjectIconSprite({
  object,
  texture,
  color,
}: {
  object: THREE.Object3D
  texture: THREE.Texture
  color: string
}) {
  const spriteRef = useRef<THREE.Sprite>(null)

  useFrame(() => {
    const sprite = spriteRef.current
    if (!sprite) {
      return
    }

    object.updateWorldMatrix(true, false)
    object.getWorldPosition(sprite.position)
    sprite.scale.set(0.025, 0.025, 1)
  })

  return (
    <sprite ref={spriteRef} renderOrder={1000}>
      <spriteMaterial
        map={texture}
        color={color}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </sprite>
  )
}

/**
 * Renders a camera preview as a second render pass inside the main WebGL canvas
 * using scissor + viewport — no second EffectViewer or WebGL context.
 */
function SceneCameraPreviewRenderer({
  cameraObject,
}: {
  cameraObject: THREE.Camera
}) {
  const { gl, scene, size } = useThree()
  const previewCameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null)

  useEffect(() => {
    if (cameraObject instanceof THREE.PerspectiveCamera) {
      previewCameraRef.current = cameraObject.clone() as THREE.PerspectiveCamera
    } else if (cameraObject instanceof THREE.OrthographicCamera) {
      previewCameraRef.current = cameraObject.clone() as THREE.OrthographicCamera
    } else {
      previewCameraRef.current = new THREE.PerspectiveCamera(35, 256 / 196, 0.001, 100)
    }
    return () => { previewCameraRef.current = null }
  }, [cameraObject])

  useFrame(() => {
    const previewCamera = previewCameraRef.current
    if (!previewCamera) return

    // Sync transform from source camera
    cameraObject.updateMatrixWorld(true)
    previewCamera.position.copy(cameraObject.position)
    previewCamera.quaternion.copy(cameraObject.quaternion)
    if (previewCamera instanceof THREE.PerspectiveCamera && cameraObject instanceof THREE.PerspectiveCamera) {
      previewCamera.fov = cameraObject.fov
      previewCamera.near = cameraObject.near
      previewCamera.far = cameraObject.far
    }

    const pw = Math.min(256, Math.floor(size.width * 0.25))
    const ph = Math.round(pw * 196 / 256)
    const px = 4
    // R3F/Three.js viewport Y is bottom-up
    const py = size.height - ph - 40

    if (previewCamera instanceof THREE.PerspectiveCamera) {
      previewCamera.aspect = pw / ph
    }
    previewCamera.updateProjectionMatrix()
    previewCamera.updateMatrixWorld(true)

    const prevScissorTest = gl.getScissorTest()
    gl.setScissorTest(true)
    gl.setViewport(px, py, pw, ph)
    gl.setScissor(px, py, pw, ph)
    gl.render(scene, previewCamera)

    // Restore main viewport
    gl.setScissorTest(prevScissorTest)
    gl.setViewport(0, 0, size.width, size.height)
  }, 1) // priority 1 = after main render

  return null
}

/**
 * Clickable overlay positioned on top of the preview render area.
 */
function SceneCameraPreviewOverlay({
  resourceId,
}: {
  resourceId: string
}) {
  const handleActivate = useCallback(() => {
    const observer = editor.call('entities:get', resourceId)
    if (!observer?.entity) {
      return
    }

    editor.call('camera:set', observer.entity)
    editor.call('selector:set', 'entity', [observer])
    editor.emit('attributes:inspect[entity]', [observer])
  }, [resourceId])

  const name = useMemo(() => {
    const observer = editor.call('entities:get', resourceId) as { get?: (path: string) => unknown } | null
    return String(observer?.get?.('name') || 'Camera')
  }, [resourceId])

  return (
    <div
      className="camera-preview"
      style={{
        display: 'block',
        position: 'absolute',
        top: 40,
        left: 4,
        width: 256,
        height: 196,
        border: '2px solid rgba(255,255,255,0.92)',
        overflow: 'hidden',
        zIndex: 5,
        cursor: 'pointer',
        background: 'transparent',
        boxSizing: 'border-box',
      }}
      onClick={handleActivate}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '3px 8px',
          background: 'rgba(24,30,32,0.75)',
          color: 'rgba(255,255,255,0.9)',
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          pointerEvents: 'none',
        }}
      >
        {name} — click to activate
      </div>
    </div>
  )
}

function CameraCommandController({
  cameraCommand,
  selectedResourceIds,
  resolveObjectById,
  resolveIdByObject,
  orbitControlsRef,
  fallbackPerspectivePosition,
  onCameraReplaced,
  onCameraCommandConsumed,
}: {
  cameraCommand: ViewerCameraCommand | null
  selectedResourceIds: string[]
  resolveObjectById?: (resourceId: string) => THREE.Object3D | null
  resolveIdByObject?: (object: THREE.Object3D) => string | null
  orbitControlsRef: RefObject<React.ComponentRef<typeof OrbitControls> | null>
  fallbackPerspectivePosition: [number, number, number]
  onCameraReplaced?: (camera: THREE.Camera) => void
  onCameraCommandConsumed?: () => void
}) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const set = useThree((state) => state.set)
  const activeSceneCameraIdRef = useRef<string | null>(null)
  const activeSceneCameraSignatureRef = useRef<string | null>(null)

  const syncProjectionCamera = useCallback((projection: 'perspective' | 'orthographic', radius: number) => {
    const aspect = size.width / Math.max(size.height, 1)
    const near = 'near' in camera ? camera.near : 0.001
    const far = 'far' in camera ? camera.far : 100

    if (projection === 'perspective') {
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
        return camera
      }

      const nextCamera = new THREE.PerspectiveCamera(45, aspect, near, far)
      nextCamera.position.copy(camera.position)
      nextCamera.quaternion.copy(camera.quaternion)
      nextCamera.up.copy(camera.up)
      set({ camera: nextCamera })
      onCameraReplaced?.(nextCamera)
      return nextCamera
    }

    const orthoHeight = Math.max(radius, 0.5)

    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = -orthoHeight * aspect
      camera.right = orthoHeight * aspect
      camera.top = orthoHeight
      camera.bottom = -orthoHeight
      camera.updateProjectionMatrix()
      return camera
    }

    const nextCamera = new THREE.OrthographicCamera(
      -orthoHeight * aspect,
      orthoHeight * aspect,
      orthoHeight,
      -orthoHeight,
      near,
      far
    )
    nextCamera.position.copy(camera.position)
    nextCamera.quaternion.copy(camera.quaternion)
    nextCamera.up.copy(camera.up)
    set({ camera: nextCamera })
    onCameraReplaced?.(nextCamera)
    return nextCamera
  }, [camera, onCameraReplaced, set, size.height, size.width])

  const applyCameraTarget = useCallback((nextCamera: THREE.Camera, nextTarget: THREE.Vector3) => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.object = nextCamera
      orbitControlsRef.current.target.copy(nextTarget)
      orbitControlsRef.current.update()
    } else {
      nextCamera.lookAt(nextTarget)
    }
  }, [orbitControlsRef])

  const resetCameraRuntimeState = useCallback((workingCamera: THREE.Camera) => {
    workingCamera.userData = {}
    activeSceneCameraSignatureRef.current = null
  }, [])

  const applySceneCamera = useCallback((sourceCamera: THREE.Camera) => {
    const nextProjection = sourceCamera instanceof THREE.OrthographicCamera ? 'orthographic' : 'perspective'
    const workingCamera = syncProjectionCamera(
      nextProjection,
      sourceCamera instanceof THREE.OrthographicCamera ? Math.abs(sourceCamera.top) : 5
    )
    const sourceNear = 'near' in sourceCamera ? sourceCamera.near : workingCamera.near
    const sourceFar = 'far' in sourceCamera ? sourceCamera.far : workingCamera.far

    workingCamera.position.copy(sourceCamera.position)
    workingCamera.quaternion.copy(sourceCamera.quaternion)
    workingCamera.scale.copy(sourceCamera.scale)
    workingCamera.near = sourceNear
    workingCamera.far = sourceFar

    if (workingCamera instanceof THREE.PerspectiveCamera && sourceCamera instanceof THREE.PerspectiveCamera) {
      workingCamera.fov = sourceCamera.fov
    }

    if (workingCamera instanceof THREE.OrthographicCamera && sourceCamera instanceof THREE.OrthographicCamera) {
      const aspect = size.width / Math.max(size.height, 1)
      const orthoHeight = Math.max(Math.abs(sourceCamera.top), 0.5)
      workingCamera.left = -orthoHeight * aspect
      workingCamera.right = orthoHeight * aspect
      workingCamera.top = orthoHeight
      workingCamera.bottom = -orthoHeight
    }

    workingCamera.updateProjectionMatrix()

    // Compute orbit target at a reasonable distance along the camera's forward
    // direction — use the scene bounds radius so orbit feels natural, not 1 unit.
    const sceneBounds = new THREE.Box3()
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        sceneBounds.expandByObject(child)
      }
    })
    const sceneCenter = new THREE.Vector3()
    if (!sceneBounds.isEmpty()) {
      sceneBounds.getCenter(sceneCenter)
    }
    const distanceToCenter = workingCamera.position.distanceTo(sceneCenter)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(workingCamera.quaternion)
    const orbitTarget = workingCamera.position.clone().add(forward.multiplyScalar(Math.max(distanceToCenter, 1)))
    applyCameraTarget(workingCamera, orbitTarget)
    activeSceneCameraSignatureRef.current = getCameraRuntimeSignature(sourceCamera)
  }, [applyCameraTarget, scene, size.height, size.width, syncProjectionCamera])

  useFrame(() => {
    const activeSceneCameraId = activeSceneCameraIdRef.current
    if (!activeSceneCameraId || !resolveObjectById) {
      return
    }

    const sourceCamera = resolveObjectById(activeSceneCameraId)
    if (!(sourceCamera instanceof THREE.Camera)) {
      return
    }

    const nextSignature = getCameraRuntimeSignature(sourceCamera)
    if (nextSignature === activeSceneCameraSignatureRef.current) {
      return
    }

    applySceneCamera(sourceCamera)
  })

  useEffect(() => {
    if (!cameraCommand) {
      return
    }

    const bounds = new THREE.Box3()
    const target = new THREE.Vector3()
    const visitedIds = new Set<string>()

    if (selectedResourceIds.length > 0 && resolveObjectById) {
      selectedResourceIds.forEach((resourceId) => {
        const object = resolveObjectById(resourceId)
        if (!object || visitedIds.has(resourceId)) {
          return
        }

        visitedIds.add(resourceId)
        bounds.expandByObject(object)
      })
    }

    if (bounds.isEmpty()) {
      scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !resolveIdByObject) {
          return
        }

        const resourceId = resolveIdByObject(child)
        if (!resourceId) {
          return
        }

        bounds.expandByObject(child)
      })
    }

    if (bounds.isEmpty()) {
      bounds.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1))
    }

    bounds.getCenter(target)
    const size = bounds.getSize(new THREE.Vector3())
    const radius = Math.max(size.length() * 0.5, 0.5)
    const controls = orbitControlsRef.current
    const currentTarget = controls?.target.clone() ?? new THREE.Vector3()

    if (cameraCommand.kind === 'entity' && resolveObjectById) {
      activeSceneCameraIdRef.current = cameraCommand.resourceId
      const targetObject = resolveObjectById(cameraCommand.resourceId)
      if (targetObject instanceof THREE.Camera) {
        applySceneCamera(targetObject)
      }
      onCameraCommandConsumed?.()
      return
    }

    activeSceneCameraIdRef.current = null

    let direction = camera.position.clone().sub(currentTarget)
    if (direction.lengthSq() === 0) {
      direction = new THREE.Vector3(...fallbackPerspectivePosition).normalize()
    } else {
      direction.normalize()
    }

    let projection: 'perspective' | 'orthographic' = camera instanceof THREE.OrthographicCamera ? 'orthographic' : 'perspective'

    if (cameraCommand.kind === 'preset') {
      switch (cameraCommand.preset) {
        case 'front':
          projection = 'orthographic'
          direction = new THREE.Vector3(0, 0, 1)
          break
        case 'back':
          projection = 'orthographic'
          direction = new THREE.Vector3(0, 0, -1)
          break
        case 'left':
          projection = 'orthographic'
          direction = new THREE.Vector3(-1, 0, 0)
          break
        case 'right':
          projection = 'orthographic'
          direction = new THREE.Vector3(1, 0, 0)
          break
        case 'top':
          projection = 'orthographic'
          direction = new THREE.Vector3(0, 1, 0)
          break
        case 'bottom':
          projection = 'orthographic'
          direction = new THREE.Vector3(0, -1, 0)
          break
        case 'perspective':
        default:
          projection = 'perspective'
          direction = new THREE.Vector3(...fallbackPerspectivePosition).normalize()
          break
      }
    }

    const workingCamera = syncProjectionCamera(projection, radius)
    const distance = projection === 'orthographic' ? Math.max(radius * 4, 2) : radius * 2.6
    workingCamera.position.copy(target.clone().add(direction.multiplyScalar(distance)))
    workingCamera.lookAt(target)
    resetCameraRuntimeState(workingCamera)
    workingCamera.updateProjectionMatrix()
    applyCameraTarget(workingCamera, target.clone())
    onCameraCommandConsumed?.()
  }, [applyCameraTarget, applySceneCamera, camera, cameraCommand, fallbackPerspectivePosition, onCameraCommandConsumed, orbitControlsRef, resetCameraRuntimeState, resolveIdByObject, resolveObjectById, scene, selectedResourceIds, syncProjectionCamera])

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1)

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      return
    }

    if (camera instanceof THREE.OrthographicCamera) {
      const orthoHeight = Math.max(Math.abs(camera.top), 0.5)
      camera.left = -orthoHeight * aspect
      camera.right = orthoHeight * aspect
      camera.top = orthoHeight
      camera.bottom = -orthoHeight
      camera.updateProjectionMatrix()
    }
  }, [camera, size.height, size.width])

  return null
}

/**
 * Configures OrbitControls for Studio navigation (middle-click pan, right-click rotate).
 * Also provides orbit center reset via editor event and keyboard shortcut.
 */
function OrbitControlsOverride({ orbitControlsRef, resolveObjectById, selectedResourceIds, activeSceneCameraResourceId }: {
  orbitControlsRef: RefObject<React.ComponentRef<typeof OrbitControls> | null>
  resolveObjectById?: (resourceId: string) => THREE.Object3D | null
  selectedResourceIds?: string[]
  activeSceneCameraResourceId?: string | null
}) {
  const { camera, scene } = useThree()

  useEffect(() => {
    const controls = orbitControlsRef.current
    if (!controls) return
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
  }, [orbitControlsRef])

  // Disable orbit controls when viewing through a scene camera —
  // the viewport is locked to that camera's view. Re-enable when back on editor camera.
  useEffect(() => {
    const controls = orbitControlsRef.current
    if (!controls) return
    controls.enabled = !activeSceneCameraResourceId
  }, [activeSceneCameraResourceId, orbitControlsRef])

  const resetOrbitCenter = useCallback(() => {
    const controls = orbitControlsRef.current
    if (!controls) return

    // Try to center on selected object first
    if (resolveObjectById && selectedResourceIds?.length) {
      const target = resolveObjectById(selectedResourceIds[0])
      if (target) {
        const worldPos = new THREE.Vector3()
        target.getWorldPosition(worldPos)
        controls.target.copy(worldPos)
        controls.update()
        return
      }
    }

    // Fall back to scene center
    const box = new THREE.Box3().setFromObject(scene)
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3())
      controls.target.copy(center)
    } else {
      controls.target.set(0, 0, 0)
    }
    controls.update()
  }, [camera, orbitControlsRef, resolveObjectById, scene, selectedResourceIds])

  useEffect(() => {
    const handle = editor.on('r3f:viewer:resetOrbit', resetOrbitCenter)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === 'Numpad5' &&
        !event.ctrlKey && !event.metaKey && !event.altKey &&
        !(event.target instanceof HTMLElement && (event.target.isContentEditable || /input|textarea|select/i.test(event.target.tagName)))
      ) {
        event.preventDefault()
        resetOrbitCenter()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      handle.unbind()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [resetOrbitCenter])

  return null
}

function BridgeStateSync({
  onSync,
}: {
  onSync: (patch: Partial<EffectViewerBridge>) => void
}) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const renderer = useThree((state) => state.gl)

  useEffect(() => {
    onSync({
      camera,
      scene,
      renderer,
    })
  }, [camera, onSync, renderer, scene])

  return null
}

export default function StudioViewport({
  config,
  artworkUrl,
  designState,
  isEditing,
  onBridgeReady,
  selectedResourceIds = [],
  resolveObjectById,
  resolveIdByObject,
  onSelectResourceId,
  onTransformCommit,
  onSceneChange,
  transformMode = 'disabled',
  transformSpace = 'local',
  showGizmoHelper = false,
  enableTransformControls = false,
  renderPass = 'standard',
  wireframeEnabled = false,
  gridSettings = { enabled: true, divisions: 10, cellSize: 1 },
  transformSnapSettings,
  cameraCommand = null,
  sceneObjectRevision = 0,
  activeSceneCameraResourceId = null,
  onCameraCommandConsumed,
}: EffectViewerProps) {
  const bridgeRef = useRef<Partial<EffectViewerBridge>>({})
  const emitBridge = useCallback((patch: Partial<EffectViewerBridge>) => {
    Object.assign(bridgeRef.current, patch)

    if (
      onBridgeReady &&
      bridgeRef.current.scene &&
      bridgeRef.current.camera &&
      bridgeRef.current.renderer
    ) {
      onBridgeReady({
        scene: bridgeRef.current.scene,
        camera: bridgeRef.current.camera,
        renderer: bridgeRef.current.renderer,
        modelRoot: bridgeRef.current.modelRoot ?? bridgeRef.current.scene,
        materialSlots: bridgeRef.current.materialSlots ?? new Map<string, THREE.Material | THREE.Material[]>(),
        orbitControls: bridgeRef.current.orbitControls ?? null,
        keyLight: bridgeRef.current.keyLight ?? null,
      })
    }
  }, [onBridgeReady])

  const cam = config.camera
  const previewCamera = useMemo(() => {
    if (!resolveObjectById || !selectedResourceIds.length) {
      return null
    }

    const resourceId = selectedResourceIds[0]
    if (!resourceId || resourceId === activeSceneCameraResourceId) {
      return null
    }

    const object = resolveObjectById(resourceId)
    return object instanceof THREE.Camera ? { object, resourceId } : null
  }, [activeSceneCameraResourceId, resolveObjectById, selectedResourceIds])
  const gridSize = Math.max(gridSettings.divisions * gridSettings.cellSize, gridSettings.cellSize)

  // Camera position for CameraCommandController fallback
  const cameraPosition = useMemo(() => {
    if (!cam) return [0, 0, 0.2] as [number, number, number]
    const d = cam.distance
    const polar = (cam.polarAngle * Math.PI) / 180
    const azimuth = (cam.azimuthAngle * Math.PI) / 180
    const target = cam.target ?? [0, 0, 0]
    return [
      target[0] + d * Math.sin(polar) * Math.sin(azimuth),
      target[1] + d * Math.cos(polar),
      target[2] + d * Math.sin(polar) * Math.cos(azimuth),
    ] as [number, number, number]
  }, [cam])

  const orbitControlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  useEffect(() => {
    emitBridge({ orbitControls: orbitControlsRef.current ?? null })
  }, [emitBridge])

  // EffectViewer's onCreated gives us scene, camera, renderer for the bridge
  const handleCreated = useCallback((bridge: CoreBridge) => {
    emitBridge({
      renderer: bridge.renderer,
      scene: bridge.scene,
      camera: bridge.camera,
    })
  }, [emitBridge])

  // ModelBridgeConnector fires this when EffectModel's meshes appear in the scene
  const handleModelReady = useCallback((payload: {
    modelRoot: THREE.Object3D
    materialSlots: Map<string, THREE.Material | THREE.Material[]>
  }) => {
    emitBridge(payload)
  }, [emitBridge])

  return (
    <>
    <ViewportErrorBoundary background={config.colors.bgColor}>
        <EffectViewer
          config={config}
          artworkUrl={artworkUrl || DEFAULT_ARTWORK}
          designState={designState}
          isEditing={isEditing}
          onCreated={handleCreated}
          orbitControlsRef={orbitControlsRef}
          onModelReady={handleModelReady}
        >
        <BridgeStateSync onSync={emitBridge} />
        {/* Studio-specific OrbitControls customization */}
        <OrbitControlsOverride
          orbitControlsRef={orbitControlsRef}
          resolveObjectById={resolveObjectById}
          selectedResourceIds={selectedResourceIds}
          activeSceneCameraResourceId={activeSceneCameraResourceId}
        />
        {/* Studio controls — injected into EffectViewer's Canvas */}
        <ViewportGridHelper
          visible={gridSettings.enabled}
          size={gridSize}
          divisions={gridSettings.divisions}
        />
        <ViewportNavigationController
          orbitControlsRef={orbitControlsRef}
          enabled={!isEditing}
        />
        <EditorViewportOverlay
          selectedResourceIds={selectedResourceIds}
          resolveObjectById={resolveObjectById}
          resolveIdByObject={resolveIdByObject}
          onSelectResourceId={onSelectResourceId}
          onTransformCommit={onTransformCommit}
          onSceneChange={onSceneChange}
          orbitControlsRef={orbitControlsRef}
          transformMode={transformMode}
          transformSpace={transformSpace}
          snapSettings={transformSnapSettings}
          showGizmoHelper={showGizmoHelper}
          enableTransformControls={enableTransformControls}
          sceneObjectRevision={sceneObjectRevision}
        />
        <RenderModeController
          renderPass={renderPass}
          wireframeEnabled={wireframeEnabled}
          resolveIdByObject={resolveIdByObject}
        />
        <ActiveCameraRuntimeSync config={config} />
        <EditorCameraSettingsSync
          orbitControlsRef={orbitControlsRef}
          onCameraReplaced={(nextCamera) => {
            emitBridge({ camera: nextCamera })
          }}
        />
        <SceneObjectIcons
          resolveIdByObject={resolveIdByObject}
          sceneObjectRevision={sceneObjectRevision}
          activeSceneCameraResourceId={activeSceneCameraResourceId}
        />
        <CameraCommandController
          cameraCommand={cameraCommand}
          selectedResourceIds={selectedResourceIds}
          resolveObjectById={resolveObjectById}
          resolveIdByObject={resolveIdByObject}
          orbitControlsRef={orbitControlsRef}
          fallbackPerspectivePosition={cameraPosition}
          onCameraReplaced={(nextCamera) => {
            emitBridge({ camera: nextCamera })
          }}
          onCameraCommandConsumed={onCameraCommandConsumed}
        />
        {previewCamera ? (
          <SceneCameraPreviewRenderer cameraObject={previewCamera.object} />
        ) : null}
      </EffectViewer>
    </ViewportErrorBoundary>
    {previewCamera ? (
      <SceneCameraPreviewOverlay resourceId={previewCamera.resourceId} />
    ) : null}
    <CameraModeIndicator activeSceneCameraResourceId={activeSceneCameraResourceId} />
    </>
  )
}

/**
 * Syncs editor camera settings (FOV, near, far, projection) from the settings panel to the R3F working camera.
 * Listens for events emitted by the EditorCameraSettingsPanel.
 */
function EditorCameraSettingsSync({
  orbitControlsRef,
  onCameraReplaced,
}: {
  orbitControlsRef: RefObject<React.ComponentRef<typeof OrbitControls> | null>
  onCameraReplaced: (camera: THREE.Camera) => void
}) {
  const { camera, gl, scene, size } = useThree()

  useEffect(() => {
    const handleFov = (value: number) => {
      if (camera instanceof THREE.PerspectiveCamera && Number.isFinite(value) && value > 0 && value < 180) {
        camera.fov = value
        camera.updateProjectionMatrix()
      }
    }

    const handleNear = (value: number) => {
      if (Number.isFinite(value) && value >= 0) {
        ;(camera as THREE.PerspectiveCamera).near = value
        camera.updateProjectionMatrix()
      }
    }

    const handleFar = (value: number) => {
      if (Number.isFinite(value) && value > 0) {
        ;(camera as THREE.PerspectiveCamera).far = value
        camera.updateProjectionMatrix()
      }
    }

    const handleProjection = (value: string) => {
      const isPerspective = camera instanceof THREE.PerspectiveCamera
      if (value === 'perspective' && !isPerspective) {
        const aspect = size.width / size.height
        const ortho = camera as THREE.OrthographicCamera
        const viewHeight = (ortho.top - ortho.bottom)
        const fov = 2 * Math.atan(viewHeight / (2 * camera.position.distanceTo(orbitControlsRef.current?.target ?? new THREE.Vector3()))) * (180 / Math.PI)
        const newCamera = new THREE.PerspectiveCamera(
          Number.isFinite(fov) && fov > 0 && fov < 180 ? fov : 35,
          aspect,
          ortho.near,
          ortho.far
        )
        newCamera.position.copy(camera.position)
        newCamera.quaternion.copy(camera.quaternion)
        newCamera.updateProjectionMatrix()
        gl.render(scene, newCamera)
        onCameraReplaced(newCamera)
      } else if (value === 'orthographic' && isPerspective) {
        const persp = camera as THREE.PerspectiveCamera
        const distance = camera.position.distanceTo(orbitControlsRef.current?.target ?? new THREE.Vector3())
        const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2))
        const halfWidth = halfHeight * (size.width / size.height)
        const newCamera = new THREE.OrthographicCamera(
          -halfWidth, halfWidth, halfHeight, -halfHeight,
          persp.near, persp.far
        )
        newCamera.position.copy(camera.position)
        newCamera.quaternion.copy(camera.quaternion)
        newCamera.updateProjectionMatrix()
        gl.render(scene, newCamera)
        onCameraReplaced(newCamera)
      }
    }

    const fovHandle = editor.on('r3f:viewer:editorCameraFov', handleFov)
    const nearHandle = editor.on('r3f:viewer:editorCameraNear', handleNear)
    const farHandle = editor.on('r3f:viewer:editorCameraFar', handleFar)
    const projHandle = editor.on('r3f:viewer:editorCameraProjection', handleProjection)

    return () => {
      fovHandle.unbind()
      nearHandle.unbind()
      farHandle.unbind()
      projHandle.unbind()
    }
  }, [camera, gl, scene, size, orbitControlsRef, onCameraReplaced])

  return null
}

function CameraModeIndicator({ activeSceneCameraResourceId }: { activeSceneCameraResourceId?: string | null }) {
  const label = useMemo(() => {
    if (!activeSceneCameraResourceId) {
      return 'Editor Camera'
    }
    const observer = editor.call('entities:get', activeSceneCameraResourceId) as { get?: (path: string) => unknown } | null
    const name = observer?.get?.('name')
    return typeof name === 'string' && name ? name : 'Scene Camera'
  }, [activeSceneCameraResourceId])

  const handleBackToEditor = useCallback(() => {
    const perspectiveCamera = editor.call('camera:get', 'perspective')
    if (perspectiveCamera) {
      editor.call('camera:set', perspectiveCamera)
    }
    editor.emit('r3f:viewer:cameraPreset', 'perspective')
    editor.call('viewport:focus')
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 6,
        left: 6,
        padding: '2px 8px',
        background: activeSceneCameraResourceId
          ? 'rgba(60,140,220,0.82)'
          : 'rgba(40,44,52,0.72)',
        color: '#fff',
        fontSize: 11,
        fontFamily: 'var(--font-mono, monospace)',
        borderRadius: 3,
        pointerEvents: activeSceneCameraResourceId ? 'auto' : 'none',
        zIndex: 4,
        userSelect: 'none',
        cursor: activeSceneCameraResourceId ? 'pointer' : 'default',
      }}
      onClick={activeSceneCameraResourceId ? handleBackToEditor : undefined}
    >
      {activeSceneCameraResourceId ? '\u{1F3A5} ' : '\u{1F441} '}
      {label}
      {activeSceneCameraResourceId ? ' \u2014 click to return to Editor Camera' : ''}
    </div>
  )
}
