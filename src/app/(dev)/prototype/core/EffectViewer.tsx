// Core EffectViewer — pure Canvas wrapper, no Leva, no store
// Receives all config as typed props. Both Studio and Create use this.

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, GizmoHelper, GizmoViewcube, TransformControls, useGLTF } from '@react-three/drei'
import React, { Suspense, useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { applyOnemoSceneState } from '../../../../../studio/src/editor/adapter/onemo-deserialize'
import EffectModel from './EffectModel'
import { loadOnemoTemplate } from './onemo-loader'
import type { ViewerConfig, DesignState } from '../types'

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
      kind: 'preset'
      preset: ViewerCameraPreset
      seq: number
    }

interface EffectViewerProps {
  config: ViewerConfig
  artworkUrl?: string
  templateUrl?: string
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
  cameraCommand?: ViewerCameraCommand | null
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

function collectMaterialSlots(root: THREE.Object3D) {
  const materialSlots = new Map<string, THREE.Material | THREE.Material[]>()

  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      materialSlots.set(child.uuid, child.material)
    }
  })

  return materialSlots
}

function applyEditorCameraState(
  camera: THREE.Camera,
  orbitControls: React.ComponentRef<typeof OrbitControls> | null,
  editorCamera: {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
    near: number
    far: number
  }
) {
  camera.position.set(...editorCamera.position)

  if ('near' in camera) {
    ;(camera as THREE.Camera & { near: number }).near = editorCamera.near
  }

  if ('far' in camera) {
    ;(camera as THREE.Camera & { far: number }).far = editorCamera.far
  }

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = editorCamera.fov
  }

  if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
    camera.updateProjectionMatrix()
  }

  const target = new THREE.Vector3(...editorCamera.target)
  if (orbitControls) {
    orbitControls.target.copy(target)
    orbitControls.update()
  } else {
    camera.lookAt(target)
  }
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
  showGizmoHelper,
  enableTransformControls,
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
  showGizmoHelper?: boolean
  enableTransformControls?: boolean
}) {
  const { camera, scene, gl } = useThree()
  const selectedObject = useMemo(() => {
    if (!selectedResourceIds.length || !resolveObjectById) {
      return null
    }

    return resolveObjectById(selectedResourceIds[0])
  }, [resolveObjectById, selectedResourceIds])

  const transformControlsRef = useRef<React.ComponentRef<typeof TransformControls>>(null)
  const lightProxyRef = useRef<THREE.Group>(new THREE.Group())
  const isDraggingRef = useRef(false)
  const dragStartTransformRef = useRef<EffectViewerTransformSnapshot | null>(null)
  const dragResourceIdRef = useRef<string | null>(null)
  const pointerRef = useRef(new THREE.Vector2())
  const raycasterRef = useRef(new THREE.Raycaster())
  const selectedLight = selectedObject instanceof THREE.Light ? selectedObject : null
  const transformTarget = selectedLight ?? selectedObject
  // eslint-disable-next-line react-hooks/refs -- lightProxyRef is a stable Group instance, safe to access during render
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
    }

    const handleObjectChange = () => {
      if (selectedLight) {
        selectedLight.position.copy(lightProxyRef.current.position)
        selectedLight.updateMatrixWorld(true)
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
    !(transformTarget instanceof THREE.Camera) &&
    (selectedLight ? true : !!transformTarget.parent)

  return (
    <>
      {/* eslint-disable-next-line react-hooks/refs -- lightProxyRef is a stable Group instance, safe to access during render */}
      {selectedLight ? <primitive object={lightProxyRef.current} /> : null}
      <SelectionOutline target={selectedObject} />
      {canTransform ? (
        <TransformControls
          ref={transformControlsRef}
          object={transformObject!}
          mode={transformMode}
          space={transformSpace}
          size={0.95}
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

function CameraCommandController({
  cameraCommand,
  selectedResourceIds,
  resolveObjectById,
  resolveIdByObject,
  orbitControlsRef,
  fallbackPerspectivePosition,
}: {
  cameraCommand: ViewerCameraCommand | null
  selectedResourceIds: string[]
  resolveObjectById?: (resourceId: string) => THREE.Object3D | null
  resolveIdByObject?: (object: THREE.Object3D) => string | null
  orbitControlsRef: RefObject<React.ComponentRef<typeof OrbitControls> | null>
  fallbackPerspectivePosition: [number, number, number]
}) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const animationRef = useRef<{
    alpha: number
    fromPosition: THREE.Vector3
    toPosition: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
  } | null>(null)

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

    let direction = camera.position.clone().sub(currentTarget)
    if (direction.lengthSq() === 0) {
      direction = new THREE.Vector3(...fallbackPerspectivePosition).normalize()
    } else {
      direction.normalize()
    }

    if (cameraCommand.kind === 'preset') {
      switch (cameraCommand.preset) {
        case 'front':
          direction = new THREE.Vector3(0, 0, 1)
          break
        case 'back':
          direction = new THREE.Vector3(0, 0, -1)
          break
        case 'left':
          direction = new THREE.Vector3(-1, 0, 0)
          break
        case 'right':
          direction = new THREE.Vector3(1, 0, 0)
          break
        case 'top':
          direction = new THREE.Vector3(0, 1, 0)
          break
        case 'bottom':
          direction = new THREE.Vector3(0, -1, 0)
          break
        case 'perspective':
        default:
          direction = new THREE.Vector3(...fallbackPerspectivePosition).normalize()
          break
      }
    }

    animationRef.current = {
      alpha: 0,
      fromPosition: camera.position.clone(),
      toPosition: target.clone().add(direction.multiplyScalar(radius * 2.6)),
      fromTarget: currentTarget,
      toTarget: target.clone(),
    }
  }, [camera, cameraCommand, fallbackPerspectivePosition, orbitControlsRef, resolveIdByObject, resolveObjectById, scene, selectedResourceIds])

  useFrame((_, delta) => {
    const animation = animationRef.current
    const controls = orbitControlsRef.current
    if (!animation || !controls) {
      return
    }

    animation.alpha = Math.min(1, animation.alpha + delta * 3.5)
    const eased = 1 - Math.pow(1 - animation.alpha, 3)

    camera.position.lerpVectors(animation.fromPosition, animation.toPosition, eased)
    controls.target.lerpVectors(animation.fromTarget, animation.toTarget, eased)
    camera.lookAt(controls.target)
    controls.update()

    if (animation.alpha >= 1) {
      animationRef.current = null
    }
  })

  return null
}

export default function EffectViewer({
  config,
  artworkUrl,
  templateUrl,
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
  cameraCommand = null,
}: EffectViewerProps) {
  // Preload the model
  if (!templateUrl && config.modelPath) {
    useGLTF.preload(config.modelPath)
  }

  const bridgeRef = useRef<Partial<EffectViewerBridge>>({})
  const loadedTemplateRootRef = useRef<THREE.Group | null>(null)
  const emitBridge = useCallback((patch: Partial<EffectViewerBridge>) => {
    Object.assign(bridgeRef.current, patch)

    if (
      onBridgeReady &&
      bridgeRef.current.scene &&
      bridgeRef.current.camera &&
      bridgeRef.current.renderer &&
      bridgeRef.current.modelRoot &&
      bridgeRef.current.materialSlots
    ) {
      onBridgeReady(bridgeRef.current as EffectViewerBridge)
    }
  }, [onBridgeReady])

  const cam = config.camera
  const env = config.environment

  // Camera position from spherical coordinates (distance, polar, azimuth)
  const cameraPosition = useMemo(() => {
    if (!cam) return [0, 0, 0.2] as [number, number, number]
    const d = cam.distance
    const polar = (cam.polarAngle * Math.PI) / 180
    const azimuth = (cam.azimuthAngle * Math.PI) / 180
    return [
      d * Math.sin(polar) * Math.sin(azimuth),
      d * Math.cos(polar),
      d * Math.sin(polar) * Math.cos(azimuth),
    ] as [number, number, number]
  }, [cam])

  // Environment rotation as euler
  const envRotation = useMemo(() => {
    if (!env) return undefined
    const rad = (env.envRotation * Math.PI) / 180
    return new THREE.Euler(0, rad, 0)
  }, [env])

  const orbitControlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  useEffect(() => {
    emitBridge({
      orbitControls: orbitControlsRef.current ?? null,
    })
  }, [emitBridge])
  const handleCreated = useCallback(({ gl, scene, camera }: { gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera }) => {
    emitBridge({
      renderer: gl,
      scene,
      camera,
    })

    if (templateUrl) {
      void loadOnemoTemplate(templateUrl, gl)
      .then((result) => {
        scene.clear()
        applyOnemoSceneState(scene, result.scene)
        scene.add(result.scene)
        loadedTemplateRootRef.current = result.scene

        applyEditorCameraState(camera, orbitControlsRef.current, result.studioJson.editorCamera)
        requestAnimationFrame(() => {
          applyEditorCameraState(camera, orbitControlsRef.current, result.studioJson.editorCamera)
        })

        emitBridge({
          modelRoot: result.scene,
          materialSlots: collectMaterialSlots(result.scene),
          orbitControls: orbitControlsRef.current ?? null,
        })
      })
      .catch((error) => {
        console.error('[effect-viewer] Failed to load .onemo template', error)
      })
    }
  }, [emitBridge, templateUrl])
  useEffect(() => {
    return () => {
      if (loadedTemplateRootRef.current?.parent) {
        loadedTemplateRootRef.current.parent.remove(loadedTemplateRootRef.current)
      }
    }
  }, [])
  const handleLightRef = useCallback((light: THREE.PointLight | null) => {
    if (light) {
      emitBridge({
        keyLight: light,
      })
    }
  }, [emitBridge])
  const handleModelReady = useCallback((payload: {
    modelRoot: THREE.Object3D
    materialSlots: Map<string, THREE.Material | THREE.Material[]>
  }) => {
    emitBridge(payload)
  }, [emitBridge])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: config.colors.bgColor }}>
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: config.scene.exposure,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2]}
        camera={{
          position: cameraPosition,
          fov: cam?.fov ?? 35,
          near: 0.001,
          far: 100,
        }}
        onCreated={handleCreated}
      >
        {!templateUrl && config.modelPath && (
          <pointLight
            ref={handleLightRef}
            name="Bridge Light"
            position={[0.02, 0.02, 0.12]}
            intensity={2.2}
            distance={0.8}
            castShadow
          />
        )}
        <Suspense fallback={null}>
          {!templateUrl && env && (
            <Environment
              {...(env.customHdri
                ? { files: env.customHdri }
                : { preset: (env.preset ?? 'studio') as 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'park' | 'lobby' }
              )}
              environmentIntensity={config.scene.envIntensity}
              environmentRotation={envRotation}
              ground={env.groundEnabled ? {
                height: env.groundHeight,
                radius: env.groundRadius,
              } : undefined}
            />
          )}
          {!templateUrl && config.modelPath && (
            <EffectModel
              modelPath={config.modelPath}
              artworkUrl={artworkUrl || DEFAULT_ARTWORK}
              designState={designState}
              face={config.face}
              back={config.back}
              frame={config.frame}
              scene={config.scene}
              onReady={handleModelReady}
            />
          )}
        </Suspense>

        <OrbitControls
          ref={orbitControlsRef}
          makeDefault
          target={[0, 0, 0]}
          enableDamping={cam?.enableDamping ?? true}
          dampingFactor={cam?.dampingFactor ?? 0.1}
          autoRotate={cam?.autoRotate ?? false}
          autoRotateSpeed={cam?.autoRotateSpeed ?? 2}
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
          showGizmoHelper={showGizmoHelper}
          enableTransformControls={enableTransformControls}
        />
        <RenderModeController
          renderPass={renderPass}
          wireframeEnabled={wireframeEnabled}
          resolveIdByObject={resolveIdByObject}
        />
        <CameraCommandController
          cameraCommand={cameraCommand}
          selectedResourceIds={selectedResourceIds}
          resolveObjectById={resolveObjectById}
          resolveIdByObject={resolveIdByObject}
          orbitControlsRef={orbitControlsRef}
          fallbackPerspectivePosition={cameraPosition}
        />
      </Canvas>
    </div>
  )
}
