# ONEMO 3D Studio — R3F + Three.js Capability Reference

> Last verified: 2026-03-29
> Three.js version: r175 (0.175.x) — released March 28, 2025
> @react-three/fiber version: 9.5.0 (React 19 compatible)
> @react-three/drei version: 10.7.7
> Next review: 2026-06-29

## Sources

| Source | URL | Verified | Version |
|--------|-----|----------|---------|
| Three.js GitHub docs | https://github.com/mrdoob/three.js/tree/dev/docs | 2026-03-29 | r175 |
| Three.js npm | https://www.npmjs.com/package/three | 2026-03-29 | 0.175.x |
| R3F docs | https://r3f.docs.pmnd.rs/ | 2026-03-29 | 9.5.0 |
| Drei GitHub docs | https://github.com/pmndrs/drei/blob/master/docs | 2026-03-29 | 10.7.7 |
| Context7 /mrdoob/three.js | context7.com | 2026-03-29 | r175 |
| Context7 /pmndrs/react-three-fiber | context7.com | 2026-03-29 | v9 |
| Context7 /pmndrs/drei | context7.com | 2026-03-29 | v10 |

---

## Context

ONEMO 3D Studio is built on a fork of source editor v2.20.1 and replaced the rendering engine with R3F/Three.js. This document maps every Three.js and R3F API against the ten categories needed to audit feature parity with the editor feature set.

---

## 1. Rendering — Renderer Setup, Tone Mapping, Anti-Aliasing

### WebGLRenderer

**What it does:** The primary render engine. Creates a WebGL context, draws scenes to canvas, manages GL state.

**Key properties/constructor options:**
```
antialias: boolean            — MSAA anti-aliasing (must be set at construction)
alpha: boolean                — transparent background support
precision: 'highp'|'mediump'|'lowp'
powerPreference: 'high-performance'|'low-power'|'default'
stencil: boolean
depth: boolean
logarithmicDepthBuffer: boolean — helps z-fighting at large scene scales
```

**Runtime properties:**
```
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap | PCFShadowMap | VSMShadowMap | BasicShadowMap
renderer.toneMapping = NoToneMapping | LinearToneMapping | ReinhardToneMapping
                     | CineonToneMapping | ACESFilmicToneMapping | AgXToneMapping
                     | NeutralToneMapping | CustomToneMapping
renderer.toneMappingExposure = 1.0     — float, exposure multiplier
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(width, height)
renderer.setClearColor(color, alpha)
renderer.outputColorSpace = SRGBColorSpace | LinearSRGBColorSpace
```

**Editor mapping:** Viewport rendering quality settings, shadow quality toggle, tone mapping preset picker, exposure slider.

### WebGLRenderTarget

**What it does:** Off-screen render buffer. Used for post-processing, reflections, portals.

```javascript
const rt = new THREE.WebGLRenderTarget(width, height, {
  format: RGBAFormat,
  type: HalfFloatType,
  depthBuffer: true,
  stencilBuffer: false,
  samples: 4   // MSAA on render target (Three.js r138+)
});
```

**Editor mapping:** Preview thumbnail rendering, cubemap baking, shadow map texture.

### R3F Canvas — Renderer Configuration

**What it does:** The Canvas component bootstraps WebGLRenderer, scene, camera, and render loop. All configuration is passed as props.

```jsx
<Canvas
  camera={{ position: [0, 0, 5], fov: 75, near: 0.1, far: 1000 }}
  shadows                         // enable shadow maps
  dpr={[1, 2]}                    // device pixel ratio range
  gl={{
    antialias: true,
    alpha: true,
    toneMapping: ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    outputColorSpace: SRGBColorSpace
  }}
  frameloop="always" | "demand" | "never"
  performance={{ min: 0.5, max: 1, debounce: 200 }}
  onCreated={(state) => { /* access state.gl, state.scene, state.camera */ }}
  onPointerMissed={(e) => { /* click on empty canvas */ }}
  fallback={<div>WebGL not supported</div>}
>
```

**frameloop modes:**
- `"always"` — continuous render loop (default)
- `"demand"` — only renders when `invalidate()` is called (battery-saving for static scenes)
- `"never"` — no automatic render, manual `state.gl.render()` only

**Editor mapping:** Editor viewport container, quality settings passed through gl prop.

---

## 2. Materials — All Types, Texture Maps, Color Properties

### MeshStandardMaterial

**What it does:** Physically-based material using metalness/roughness workflow. The standard choice for PBR rendering.

**All properties:**
```
color: Color               — base color (default: 0xffffff)
roughness: float [0–1]     — surface roughness (default: 1)
metalness: float [0–1]     — metalness factor (default: 0)
emissive: Color            — emissive color (default: 0x000000)
emissiveIntensity: float   — emissive multiplier (default: 1)
opacity: float [0–1]       — transparency (default: 1)
transparent: boolean       — enable transparency blending
alphaTest: float           — alpha clip threshold
side: FrontSide | BackSide | DoubleSide
wireframe: boolean
flatShading: boolean
fog: boolean               — respond to scene fog
depthTest: boolean
depthWrite: boolean
blending: NormalBlending | AdditiveBlending | ...
```

**Texture map properties (all types):**
```
map: Texture               — base color / albedo
normalMap: Texture         — surface normal perturbation (tangent space default)
normalMapType: TangentSpaceNormalMap | ObjectSpaceNormalMap
normalScale: Vector2       — normal map intensity (default: (1,1))
roughnessMap: Texture      — roughness from green channel
metalnessMap: Texture      — metalness from blue channel
emissiveMap: Texture       — emissive color map
aoMap: Texture             — ambient occlusion (red channel); requires UV2
aoMapIntensity: float      — AO intensity [0–1] (default: 1)
displacementMap: Texture   — vertex displacement (actual geometry movement)
displacementScale: float   — displacement amount (default: 0 — must be set)
displacementBias: float    — displacement offset (default: 0)
alphaMap: Texture          — grayscale opacity map (green channel used)
envMap: Texture            — environment/reflection cubemap or equirect
envMapIntensity: float     — envMap contribution multiplier (default: 1)
lightMap: Texture          — baked lighting; requires UV2
lightMapIntensity: float   — lightmap multiplier (default: 1)
bumpMap: Texture           — bump map (ignored if normalMap is set)
bumpScale: float           — bump intensity [0–1] (default: 1)
```

**Texture transform (on every Texture instance):**
```
texture.offset: Vector2    — UV offset [0–1] (default: (0,0))
texture.repeat: Vector2    — UV tiling (default: (1,1))
texture.rotation: float    — UV rotation in radians (default: 0)
texture.center: Vector2    — rotation pivot (default: (0,0))
texture.wrapS: RepeatWrapping | ClampToEdgeWrapping | MirroredRepeatWrapping
texture.wrapT: RepeatWrapping | ClampToEdgeWrapping | MirroredRepeatWrapping
texture.magFilter: LinearFilter | NearestFilter
texture.minFilter: LinearFilter | NearestFilter | LinearMipmapLinearFilter | ...
texture.anisotropy: int    — anisotropic filtering level (max: renderer.capabilities.getMaxAnisotropy())
texture.colorSpace: SRGBColorSpace | LinearSRGBColorSpace | NoColorSpace
texture.flipY: boolean     — flip texture vertically (default: true for TextureLoader)
```

**Editor mapping:** Material panel — all PBR sliders and texture slots. UV tiling controls.

### MeshPhysicalMaterial

**What it does:** Extends MeshStandardMaterial with advanced physical properties: clearcoat, transmission (glass/refraction), sheen (fabric), iridescence, anisotropy.

**Additional properties (on top of Standard):**
```
clearcoat: float [0–1]              — clearcoat layer intensity
clearcoatRoughness: float [0–1]     — clearcoat layer roughness
clearcoatMap: Texture               — clearcoat intensity map
clearcoatRoughnessMap: Texture
clearcoatNormalMap: Texture         — normal map for clearcoat layer
clearcoatNormalScale: Vector2

transmission: float [0–1]           — physical transparency (glass/liquid)
transmissionMap: Texture
ior: float                          — index of refraction (default: 1.5)
thickness: float                    — transmission volume thickness
thicknessMap: Texture
attenuationDistance: float          — volume attenuation distance
attenuationColor: Color             — volume attenuation tint
dispersion: float                   — chromatic dispersion (r174+)

sheen: float [0–1]                  — sheen layer (fabric)
sheenRoughness: float [0–1]
sheenColor: Color
sheenColorMap: Texture
sheenRoughnessMap: Texture

iridescence: float [0–1]            — thin-film iridescence
iridescenceIOR: float               — iridescence IOR
iridescenceThicknessRange: [min, max]
iridescenceMap: Texture
iridescenceThicknessMap: Texture

anisotropy: float                   — anisotropic surface reflection
anisotropyRotation: float
anisotropyMap: Texture

specularIntensity: float            — F0 specular intensity override
specularColor: Color                — F0 specular tint
specularIntensityMap: Texture
specularColorMap: Texture
```

**Editor mapping:** Advanced material panel — glass/water materials (transmission), car paint (clearcoat), fabric (sheen), gemstones (iridescence).

### ShaderMaterial

**What it does:** Fully custom GLSL shader material. Complete control over vertex and fragment stages.

```javascript
const mat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uTexture: { value: null },
    uColor: { value: new THREE.Color(0xff0000) }
  },
  vertexShader: `
    uniform float uTime;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
    }
  `,
  transparent: false,
  side: THREE.FrontSide,
  depthTest: true,
  depthWrite: true,
  blending: THREE.NormalBlending,
  defines: { USE_FOG: '' },
  glslVersion: THREE.GLSL3   // GLSL 3.0 (WebGL2)
});
```

**Built-in uniforms/attributes available automatically:**
```
projectionMatrix, modelViewMatrix, normalMatrix, modelMatrix
position (vec3), normal (vec3), uv (vec2), uv2 (vec2)
```

**Editor mapping:** Custom shader slot in material editor.

### Other Material Types

```
MeshBasicMaterial     — unlit, no shading (wireframe, overlays, gizmos)
MeshLambertMaterial   — diffuse only, no specular
MeshPhongMaterial     — Blinn-Phong shading (legacy but cheap)
MeshDepthMaterial     — depth visualization
MeshNormalMaterial    — world normal visualization
MeshMatcapMaterial    — matcap/lit-sphere shading (no scene lights needed)
MeshToonMaterial      — toon/cel shading with gradient map
LineBasicMaterial     — for Line/LineSegments
LineDashedMaterial    — dashed lines
PointsMaterial        — for Points geometry (particle systems)
SpriteMaterial        — for billboarded sprites
RawShaderMaterial     — like ShaderMaterial but without any injected uniforms
```

---

## 3. Geometry — All Types and Custom BufferGeometry

### Primitive Geometries

```
BoxGeometry(w, h, d, wSegs, hSegs, dSegs)
SphereGeometry(radius, widthSegs, heightSegs, phiStart, phiLength, thetaStart, thetaLength)
CylinderGeometry(radiusTop, radiusBottom, height, radialSegs, heightSegs, openEnded, thetaStart, thetaLength)
ConeGeometry(radius, height, radialSegs, heightSegs, openEnded, thetaStart, thetaLength)
PlaneGeometry(w, h, wSegs, hSegs)
CircleGeometry(radius, segments, thetaStart, thetaLength)
RingGeometry(innerRadius, outerRadius, thetaSegs, phiSegs, thetaStart, thetaLength)
TorusGeometry(radius, tube, radialSegs, tubularSegs, arc)
TorusKnotGeometry(radius, tube, tubularSegs, radialSegs, p, q)
CapsuleGeometry(radius, length, capSegs, radialSegs, heightSegs[r176])
DodecahedronGeometry(radius, detail)
IcosahedronGeometry(radius, detail)
OctahedronGeometry(radius, detail)
TetrahedronGeometry(radius, detail)
TubeGeometry(path, tubularSegs, radius, radialSegs, closed)
LatheGeometry(points, segments, phiStart, phiLength)
ExtrudeGeometry(shapes, options)
ShapeGeometry(shapes, curveSegments)
```

**Editor mapping:** Primitive object creation panel, shape picker.

### BufferGeometry (Custom)

**What it does:** Low-level geometry container. All primitives extend this. Use for custom meshes, procedural geometry, imported models.

```javascript
const geometry = new THREE.BufferGeometry();
// Float32Array attributes
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
geometry.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
geometry.setAttribute('uv2',      new THREE.BufferAttribute(uvs2, 2));  // for aoMap, lightMap
geometry.setIndex(new THREE.BufferAttribute(indices, 1));
geometry.computeVertexNormals();
geometry.computeBoundingBox();
geometry.computeBoundingSphere();

// Groups (for multi-material)
geometry.addGroup(start, count, materialIndex);
```

**Editor mapping:** Custom mesh import, GLTF geometry nodes, procedural generation.

---

## 4. Lighting — All Light Types, Shadows, Environment

### Light Types

| Light | Class | Shadows | Notes |
|-------|-------|---------|-------|
| Ambient | `AmbientLight(color, intensity)` | No | Uniform fill light, no direction |
| Hemisphere | `HemisphereLight(skyColor, groundColor, intensity)` | No | Sky/ground gradient |
| Directional | `DirectionalLight(color, intensity)` | Yes | Parallel rays (sun) |
| Point | `PointLight(color, intensity, distance, decay)` | Yes | Omni from point |
| Spot | `SpotLight(color, intensity, distance, angle, penumbra, decay)` | Yes | Cone light |
| RectArea | `RectAreaLight(color, intensity, width, height)` | No | Requires RectAreaLightUniformsLib |

### Shadow Configuration

Applies to DirectionalLight, PointLight, SpotLight:

```javascript
light.castShadow = true;
light.shadow.mapSize.width = 2048;   // shadow map resolution
light.shadow.mapSize.height = 2048;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500;
light.shadow.radius = 4;             // PCF blur radius
light.shadow.bias = -0.0001;         // shadow acne prevention

// DirectionalLight — orthographic shadow camera
light.shadow.camera.left = -50;
light.shadow.camera.right = 50;
light.shadow.camera.top = 50;
light.shadow.camera.bottom = -50;
```

Shadow map types:
```
THREE.BasicShadowMap     — hard shadows, fastest
THREE.PCFShadowMap       — percentage closer filtering (soft)
THREE.PCFSoftShadowMap   — softer PCF (default recommendation)
THREE.VSMShadowMap       — variance shadow maps
```

**Mesh shadow flags:**
```
mesh.castShadow = true;
mesh.receiveShadow = true;
```

**Editor mapping:** Light properties panel (color, intensity, range, angle, penumbra), shadow settings panel (map size, type, bias), object shadow flags.

### Environment Lighting

**Three.js scene.environment:**
```javascript
scene.environment = envTexture;          // PMREMGenerator output, affects all PBR materials
scene.background = envTexture;           // sets skybox background
scene.backgroundBlurriness = 0;          // background blur (r163+)
scene.backgroundIntensity = 1;           // background brightness multiplier (r163+)
scene.environmentIntensity = 1;          // env light multiplier (r163+)
scene.environmentRotation = new THREE.Euler(0, Math.PI/2, 0);  // env rotation (r163+)
```

**PMREMGenerator** — converts equirect/cubemap HDR to pre-filtered env map:
```javascript
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
```

---

## 5. Camera — Types, Controls, Projection

### PerspectiveCamera

```javascript
const camera = new THREE.PerspectiveCamera(
  fov,    // vertical field of view in degrees (default: 50)
  aspect, // width / height (update on resize)
  near,   // near clipping plane (default: 0.1)
  far     // far clipping plane (default: 2000)
);
camera.updateProjectionMatrix();  // call after changing fov/aspect/near/far
camera.position.set(x, y, z);
camera.lookAt(target);
camera.zoom = 1;                  // zoom factor (multiplies fov)
```

**Editor mapping:** Perspective viewport camera, camera properties panel.

### OrthographicCamera

```javascript
const camera = new THREE.OrthographicCamera(
  left,   // frustum left plane
  right,  // frustum right plane
  top,    // frustum top plane
  bottom, // frustum bottom plane
  near,   // near plane
  far     // far plane
);
// Typical setup: frustum = size * aspect
camera.zoom = 1;
camera.updateProjectionMatrix();
```

**Editor mapping:** Orthographic viewport (top/front/side views).

### OrbitControls (three/addons)

```javascript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const controls = new OrbitControls(camera, renderer.domElement);

controls.target.set(x, y, z);        // orbit center
controls.enableDamping = true;        // smooth inertia
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;
controls.autoRotate = false;
controls.autoRotateSpeed = 2.0;
controls.minDistance = 1;
controls.maxDistance = 1000;
controls.minPolarAngle = 0;           // radians
controls.maxPolarAngle = Math.PI;
controls.minAzimuthAngle = -Infinity;
controls.maxAzimuthAngle = Infinity;
controls.zoomToCursor = true;         // r154+
controls.update();                    // call in animation loop
```

**Editor mapping:** Viewport navigation (orbit, pan, zoom). Must call `controls.update()` each frame.

### TransformControls (three/addons)

```javascript
import { TransformControls } from 'three/addons/controls/TransformControls.js';
const tc = new TransformControls(camera, renderer.domElement);
tc.attach(selectedObject);
tc.detach();
tc.setMode('translate' | 'rotate' | 'scale');
tc.setSpace('world' | 'local');
tc.setSize(1);                         // gizmo scale
tc.showX = true; tc.showY = true; tc.showZ = true;

// Disable orbit while dragging
tc.addEventListener('dragging-changed', (e) => {
  orbitControls.enabled = !e.value;
});
scene.add(tc);
```

**Editor mapping:** Transform gizmo (move/rotate/scale tool), world/local space toggle, axis locking.

---

## 6. Scene — Background, Environment, Fog

### Scene

```javascript
const scene = new THREE.Scene();
scene.background = null | Color | Texture | CubeTexture;
scene.backgroundBlurriness = 0;        // blur skybox (r146+)
scene.backgroundIntensity = 1;         // skybox brightness (r163+)
scene.backgroundRotation = Euler;      // skybox rotation (r163+)
scene.environment = null | Texture;    // default env map for PBR materials
scene.environmentIntensity = 1;        // env map multiplier (r163+)
scene.environmentRotation = Euler;     // env rotation (r163+)
scene.fog = null | Fog | FogExp2;
scene.overrideMaterial = null | Material;  // force material on all objects
```

### Fog

```javascript
scene.fog = new THREE.Fog(color, near, far);          // linear fog
scene.fog = new THREE.FogExp2(color, density);        // exponential fog
```

**Editor mapping:** Scene settings panel — background color/texture, fog toggle (type, color, near/far or density).

---

## 7. Interaction — Gizmos, Selection, Orbit/Pan/Zoom

### Raycasting (Three.js)

```javascript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// On click
mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

raycaster.setFromCamera(mouse, camera);
const intersects = raycaster.intersectObjects(scene.children, true);
// intersects[0].object — first hit
// intersects[0].point — world-space hit position
// intersects[0].face — hit triangle
// intersects[0].distance — distance from camera

// Configure
raycaster.near = 0;
raycaster.far = Infinity;
raycaster.params.Points.threshold = 1;  // points picking tolerance
raycaster.params.Line.threshold = 1;    // line picking tolerance
```

**Editor mapping:** Object selection in viewport, picking system.

### R3F Pointer Events (declarative raycasting)

```jsx
<mesh
  onClick={(e) => { e.stopPropagation(); selectObject(e.object); }}
  onContextMenu={(e) => showContextMenu(e)}
  onDoubleClick={(e) => focusObject(e.object)}
  onPointerOver={(e) => setHovered(true)}
  onPointerOut={(e) => setHovered(false)}
  onPointerDown={(e) => startDrag(e)}
  onPointerUp={(e) => endDrag(e)}
  onPointerMove={(e) => onDrag(e)}
>
```

**Event object properties:**
```
e.object          — intersected THREE.Object3D
e.point           — world-space intersection Vector3
e.face            — intersected face
e.distance        — distance from camera
e.stopPropagation() — stop event from reaching objects behind
e.nativeEvent     — original DOM event
```

### Drei — GizmoHelper

```jsx
<GizmoHelper alignment="bottom-right" margin={[80, 80]}>
  <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
  {/* or: <GizmoViewcube /> */}
</GizmoHelper>
```

**What it does:** Corner axis indicator showing camera orientation. Clicking an axis navigates the camera to that view.

**Editor mapping:** Viewport orientation cube/widget.

### Drei — TransformControls

```jsx
<TransformControls mode="translate" | "rotate" | "scale">
  <mesh position={[1, 0, 0]}>...</mesh>
</TransformControls>

// Or attach to ref:
<TransformControls object={meshRef} mode="translate" />

// Auto-disables OrbitControls during drag:
<TransformControls mode="translate" />
<OrbitControls makeDefault />
```

**Editor mapping:** Move/rotate/scale gizmo in editor viewport.

### Drei — OrbitControls

```jsx
<OrbitControls
  makeDefault             // sets as default controls in useThree state
  enableDamping           // inertia
  dampingFactor={0.05}
  enablePan
  enableZoom
  minDistance={1}
  maxDistance={500}
  minPolarAngle={0}
  maxPolarAngle={Math.PI}
  autoRotate={false}
  autoRotateSpeed={2}
  target={[0, 0, 0]}
  zoomToCursor
/>
```

**Editor mapping:** Viewport navigation controls.

### Drei — Grid

```jsx
<Grid
  args={[10, 10]}         // grid size
  cellSize={1}            // cell spacing
  cellThickness={1}
  cellColor="#6f6f6f"
  sectionSize={5}
  sectionThickness={1.5}
  sectionColor="#9d4b4b"
  fadeDistance={25}
  fadeStrength={1}
  followCamera={false}
  infiniteGrid={true}
/>
```

**Editor mapping:** Viewport floor grid.

---

## 8. Math — Vector, Matrix, Quaternion Operations

### Vector2

```javascript
const v = new THREE.Vector2(x, y);
v.set(x, y); v.copy(other); v.add(v2); v.sub(v2);
v.multiply(v2); v.divide(v2); v.multiplyScalar(s); v.divideScalar(s);
v.length(); v.lengthSq(); v.normalize(); v.dot(v2);
v.distanceTo(v2); v.clamp(min, max); v.lerp(v2, alpha);
v.angle();   // angle from positive x axis
```

### Vector3

```javascript
const v = new THREE.Vector3(x, y, z);
v.set(x,y,z); v.copy(other); v.add(v2); v.sub(v2);
v.multiply(v2); v.multiplyScalar(s); v.divideScalar(s);
v.length(); v.normalize(); v.dot(v2); v.cross(v2);
v.distanceTo(v2); v.applyMatrix4(m4); v.applyQuaternion(q);
v.lerp(v2, alpha); v.clamp(min, max);
v.setFromMatrixPosition(m4); v.setFromMatrixScale(m4);
v.project(camera); v.unproject(camera);
v.angleTo(v2);
```

**Editor mapping:** Position, scale, normal vectors. World/local coordinate transforms.

### Quaternion

```javascript
const q = new THREE.Quaternion();
q.setFromEuler(euler);
q.setFromAxisAngle(axis, angle);
q.setFromRotationMatrix(m4);
q.multiply(q2); q.conjugate(); q.invert();
q.slerp(q2, alpha);
q.normalize();
q.dot(q2);
// Euler ↔ Quaternion:
const euler = new THREE.Euler().setFromQuaternion(q);
```

**Editor mapping:** Rotation representation. Used internally for smooth interpolation (vs Euler gimbal lock).

### Euler

```javascript
const e = new THREE.Euler(x, y, z, 'XYZ');
// Order options: 'XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'
e.set(x, y, z, order);
e.setFromQuaternion(q, order);
e.setFromRotationMatrix(m4, order);
```

**Editor mapping:** Rotation input (degrees converted to radians) in inspector panel.

### Matrix4

```javascript
const m = new THREE.Matrix4();
m.set(...16 values);
m.identity();
m.makeTranslation(x, y, z);
m.makeRotationX(theta); m.makeRotationY(theta); m.makeRotationZ(theta);
m.makeScale(x, y, z);
m.compose(position, quaternion, scale);
m.decompose(position, quaternion, scale);
m.multiply(m2); m.premultiply(m2);
m.invert(); m.transpose();
m.lookAt(eye, target, up);
// Object3D.matrix, Object3D.matrixWorld use this
```

**Editor mapping:** Object transform matrices. Used for world-space conversions, parenting hierarchies.

### Box3

```javascript
const box = new THREE.Box3();
box.setFromObject(mesh);       // compute AABB from object (including children)
box.setFromPoints(points);
box.expandByObject(mesh);
box.intersectsBox(box2);
box.containsPoint(point);
box.getCenter(target);
box.getSize(target);
box.distanceToPoint(point);
```

**Editor mapping:** Selection bounding boxes, frustum culling, "focus on selection" camera framing.

### Color

```javascript
const c = new THREE.Color();
c.set(0xff0000);         // hex integer
c.set('#ff0000');        // hex string
c.set('red');            // CSS name
c.setRGB(r, g, b);       // 0–1 float components
c.setHSL(h, s, l);
c.setHex(0xff0000);
c.getHexString();        // 'ff0000'
c.lerp(c2, alpha);
c.multiply(c2);
c.convertSRGBToLinear(); c.convertLinearToSRGB();
```

**Editor mapping:** Color pickers for material, light, background properties.

---

## 9. Asset Loading — Textures, GLTF Models, HDR

### TextureLoader

```javascript
const loader = new THREE.TextureLoader();
const texture = loader.load('path/to/image.jpg', onLoad, onProgress, onError);

// Async
const texture = await loader.loadAsync('path/to/image.jpg');
texture.colorSpace = THREE.SRGBColorSpace;   // for color textures
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(2, 2);
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

**Wrap modes:** `ClampToEdgeWrapping` (default), `RepeatWrapping`, `MirroredRepeatWrapping`

### CubeTextureLoader

```javascript
const loader = new THREE.CubeTextureLoader().setPath('textures/cube/');
const cubeTexture = loader.load(['px.jpg','nx.jpg','py.jpg','ny.jpg','pz.jpg','nz.jpg']);
scene.background = cubeTexture;
scene.environment = cubeTexture;
```

### RGBELoader (HDR equirect)

```javascript
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
const hdrTexture = await new RGBELoader().loadAsync('environment.hdr');
hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.background = hdrTexture;
scene.environment = hdrTexture;
// Or pre-filter with PMREMGenerator for PBR
```

### GLTFLoader

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const gltf = await loader.loadAsync('model.glb');
// gltf.scene      — THREE.Group scene root
// gltf.scenes     — array of scenes
// gltf.nodes      — named nodes
// gltf.materials  — named materials
// gltf.meshes     — named meshes
// gltf.animations — AnimationClip array
scene.add(gltf.scene);
```

### Drei — useGLTF (R3F wrapper)

```jsx
import { useGLTF } from '@react-three/drei';

function Model() {
  const { scene, nodes, materials, animations } = useGLTF('/model.glb');
  return <primitive object={scene} />;
}

// Preload
useGLTF.preload('/model.glb');
```

### Drei — useTexture (R3F wrapper)

```jsx
import { useTexture } from '@react-three/drei';

function Surface() {
  const [colorMap, normalMap, roughnessMap] = useTexture([
    '/textures/color.jpg',
    '/textures/normal.jpg',
    '/textures/roughness.jpg'
  ]);
  return (
    <mesh>
      <planeGeometry />
      <meshStandardMaterial map={colorMap} normalMap={normalMap} roughnessMap={roughnessMap} />
    </mesh>
  );
}
```

### LoadingManager

```javascript
const manager = new THREE.LoadingManager();
manager.onStart = (url, loaded, total) => {};
manager.onLoad = () => { /* all loaded */ };
manager.onProgress = (url, loaded, total) => {};
manager.onError = (url) => {};

const loader = new THREE.TextureLoader(manager);
```

**Editor mapping:** Asset import, progress indicators, loading states.

---

## 10. UI Integration — R3F React Bridge

### useThree Hook

```jsx
import { useThree } from '@react-three/fiber';

function Component() {
  // Reactive — re-renders on size change
  const { camera, scene, gl, size, viewport, raycaster, performance } = useThree();

  // Selective subscription (no re-render for other state changes)
  const camera = useThree((state) => state.camera);
  const setCamera = useThree((state) => state.setCamera);

  // Full state model keys:
  // gl           — WebGLRenderer
  // scene        — THREE.Scene
  // camera       — active camera
  // raycaster    — built-in raycaster
  // size         — { width, height, top, left, updateStyle }
  // viewport     — { width, height, factor, distance } in world units
  // clock        — THREE.Clock
  // pointer      — normalized mouse Vector2
  // performance  — { current, min, max, debounce, regress }
  // invalidate() — trigger re-render (demand mode)
  // advance()    — advance one frame (never mode)
}
```

### useFrame Hook

```jsx
import { useFrame } from '@react-three/fiber';

function AnimatedMesh() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    // state = full useThree state
    // delta = time since last frame in seconds
    meshRef.current.rotation.y += delta;
  });

  // Render priority (lower = earlier)
  useFrame(() => {}, -1);   // runs before default render
  useFrame(() => {}, 1);    // runs after default render (post-processing)
}
```

### Imperative Refs

```jsx
const meshRef = useRef();
// Access Three.js object directly:
// meshRef.current — THREE.Mesh
// meshRef.current.position — Vector3
// meshRef.current.material — Material
// meshRef.current.geometry — BufferGeometry
```

### R3F JSX ↔ Three.js Mapping

All Three.js constructors become JSX elements. Constructor args become `args` prop:

```jsx
// THREE.BoxGeometry(1, 2, 3) →
<boxGeometry args={[1, 2, 3]} />

// THREE.MeshStandardMaterial({ color: 'red' }) →
<meshStandardMaterial color="red" roughness={0.5} />

// THREE.DirectionalLight(0xffffff, 1) →
<directionalLight color={0xffffff} intensity={1} position={[5, 10, 5]} castShadow />

// Nested attach:
<mesh>
  <boxGeometry />
  <meshStandardMaterial>
    <canvasTexture attach="map" image={canvas} />
  </meshStandardMaterial>
</mesh>
```

### React Suspense Integration

```jsx
// Async asset loading integrates with Suspense
<Canvas>
  <Suspense fallback={<LoadingSpinner />}>
    <Model />    {/* useGLTF / useTexture suspend until loaded */}
  </Suspense>
</Canvas>
```

### Drei — Html (2D UI in 3D space)

```jsx
<Html
  position={[0, 1, 0]}      // world-space position
  transform                   // project into 3D space with perspective
  occlude                     // hide behind 3D objects
  center                      // center on anchor point
  distanceFactor={10}         // scale with distance (perspective)
  zIndexRange={[100, 0]}      // z-order
  portal={domRef}             // render to specific DOM node
>
  <div className="label">Object Name</div>
</Html>
```

**Editor mapping:** Object labels, property overlays, HUD elements anchored to 3D positions.

### Performance Optimization

**InstancedMesh** — single draw call for many identical objects:
```jsx
<instancedMesh ref={ref} args={[geometry, material, count]}>
  {/* setMatrixAt(i, matrix) to position each instance */}
</instancedMesh>
```

**LOD (Level of Detail):**
```javascript
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);    // visible at distance 0+
lod.addLevel(medDetailMesh, 50);    // visible at distance 50+
lod.addLevel(lowDetailMesh, 200);   // visible at distance 200+
scene.add(lod);
```

**On-demand rendering:**
```jsx
<Canvas frameloop="demand">
  {/* useThree().invalidate() to trigger renders */}
</Canvas>
```

**Adaptive DPR:**
```jsx
<Canvas
  dpr={[1, 2]}
  performance={{ min: 0.5, max: 1, debounce: 200 }}
>
```

---

## Capability Summary Table

| Feature | Three.js API | R3F/Drei Wrapper | Editor Panel Equivalent |
|---------|-------------|-----------------|------------------------|
| Renderer setup | `WebGLRenderer` | `<Canvas gl={...}>` | Quality settings |
| Tone mapping | `renderer.toneMapping` | `<Canvas gl={{ toneMapping }}>` | Post-process settings |
| Anti-aliasing | `{ antialias: true }` | `<Canvas gl={{ antialias: true }}>` | Quality settings |
| Shadow maps | `renderer.shadowMap` | `<Canvas shadows>` | Shadow settings |
| PBR material | `MeshStandardMaterial` | `<meshStandardMaterial>` | Material editor |
| Advanced PBR | `MeshPhysicalMaterial` | `<meshPhysicalMaterial>` | Material editor (glass/clearcoat) |
| Custom shader | `ShaderMaterial` | `<shaderMaterial uniforms={...}>` | Shader editor |
| Texture maps | All maps on Material | Props on material JSX | Texture slots |
| UV tiling | `texture.repeat/offset` | Props on `<texture>` | UV settings |
| Primitive geo | `BoxGeometry`, etc. | `<boxGeometry args={...}>` | Primitive shapes |
| Custom mesh | `BufferGeometry` | `<bufferGeometry>` | Mesh import |
| Directional light | `DirectionalLight` | `<directionalLight>` | Light panel |
| Point light | `PointLight` | `<pointLight>` | Light panel |
| Spot light | `SpotLight` | `<spotLight>` | Light panel |
| Area light | `RectAreaLight` | `<rectAreaLight>` | Light panel |
| Ambient/hemi | `AmbientLight`, `HemisphereLight` | `<ambientLight>`, `<hemisphereLight>` | Light panel |
| Env lighting | `scene.environment` + PMREMGenerator | `<Environment preset="...">` | Environment panel |
| Perspective camera | `PerspectiveCamera` | `<Canvas camera={{ fov }}>` | Camera settings |
| Ortho camera | `OrthographicCamera` | Custom camera | Ortho viewport |
| Orbit navigation | `OrbitControls` | `<OrbitControls makeDefault>` | Viewport navigation |
| Transform gizmo | `TransformControls` | `<TransformControls mode>` | Move/rotate/scale tool |
| Orientation widget | — | `<GizmoHelper>` + `<GizmoViewport>` | Viewport gizmo cube |
| Floor grid | — | `<Grid>` | Viewport grid |
| HDRI background | `RGBELoader` + scene.background | `<Environment background files="...">` | Scene background |
| Scene fog | `Fog` / `FogExp2` | `<fog>` / `<fogExp2>` | Scene settings |
| Object picking | `Raycaster` | R3F pointer events | Click selection |
| GLTF import | `GLTFLoader` | `useGLTF()` | Asset import |
| Texture loading | `TextureLoader` | `useTexture()` | Asset import |
| Math types | `Vector3`, `Quaternion`, etc. | Same (Three.js math) | Inspector values |
| Bounding box | `Box3.setFromObject()` | Same | Selection highlight |
| HTML overlays | — | `<Html>` | 2D labels/tooltips |
| Instancing | `InstancedMesh` | `<instancedMesh>` | Performance (repeat objects) |
| Frame loop | `renderer.setAnimationLoop()` | `useFrame()` | Runtime loop |
| Renderer state | — | `useThree()` | N/A |

---

## Key Version Notes (2025)

- **Three.js r175** (March 2025): Latest stable. `scene.environmentRotation`, `scene.backgroundRotation` available since r163. `dispersion` on MeshPhysicalMaterial added in r174. `CapsuleGeometry` `heightSegments` added in r176.
- **@react-three/fiber v9.5.0**: React 19 compatible. `frameloop="demand"` for editor-style on-demand rendering is production stable.
- **@react-three/drei v10.7.7**: `TransformControls` auto-disables `OrbitControls` when `makeDefault` is set. `Environment` supports `ground` prop for ground-projected HDRI.
- **Color space**: Legacy `outputEncoding` and `THREE.sRGBEncoding` deprecated in r152. Use `outputColorSpace = THREE.SRGBColorSpace` and `texture.colorSpace = THREE.SRGBColorSpace`.
- **Transmission**: Was `transparency` before r119. Now `transmission`. Requires `WebGLRenderTarget` with `MeshTransmissionMaterial` in Drei for best results.
