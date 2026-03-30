# ONEMO 3D Studio — Source-Driven Audit Specification

> KAI-3831 deliverable. Built from source editor v2.20.1 docs + R3F/Three.js docs.
> NOT derived from our codebase — this is the external yardstick.
> Date: 2026-03-29 (revised 2026-03-30 after independent review)
>
> **Sources:**
> - `editor-feature-reference.md` — Source editor user manual (1,138 lines, 48 pages)
> - `r3f-threejs-capabilities.md` — R3F + Three.js capability reference (1,063 lines)
>
> **Review history:**
> - v1: Initial spec (2026-03-29)
> - v2: Revised after 3 independent reviewer agents identified gaps (2026-03-30)
>   - Added: Post Effects section (15), Layer System section (16), Texture/Cubemap inspectors (4.14-4.15), multi-select (2.23, 3.14), scene operations (7.9-7.12)
>   - Fixed: Ctrl+P → Ctrl+V (11.12, 3.7), parallax mapping note (8.11), code editor contradiction resolved (moved to L4)
>   - Added: 9 new L2 test cases, 5 new L3 checks, 3 new L4 exclusions

---

## How To Use This Document

This spec has 4 layers. Each layer is independently auditable.

| Layer | What it checks | Who runs it |
|-------|---------------|-------------|
| **L1 — Feature Parity** | Editor feature → R3F equivalent exists and is wired | Code audit (Composer + Codex) |
| **L2 — Visual & Interactive** | Every feature works in the browser — click it, see it, screenshot it | Browser audit (Gemini with Chrome) |
| **L3 — Code Health** | No dead code, no orphaned imports, no legacy conflicts, clean build | Static analysis (Composer + Codex) |
| **L4 — Scope Exclusions** | Features intentionally removed — verify they're gone, not half-wired | Code + browser audit |

**Status key:**
- `WIRED` — Feature exists and is connected to R3F rendering
- `STUBBED` — UI exists but action is a no-op (intentional, with rationale)
- `SKIPPED` — Intentionally removed (documented why)
- `MISSING` — Gap — should exist but doesn't
- `N/A` — Not applicable to ONEMO (cloud-only, source-editor-specific)
- `VERIFY` — Needs browser testing to confirm

**Completeness rule:** Every item in this spec MUST resolve to a final status (WIRED, STUBBED, SKIPPED, MISSING, or N/A). VERIFY is a pre-audit state, not a final state. An auditor who leaves an item as VERIFY has not completed the audit. An item marked MISSING requires a follow-up build task — the audit is not PASS while any item is MISSING.

**Bridge coverage rule:** For every component type in Section 12, the R3F bridge (`observer-r3f-bridge.ts`) must have a handling path and a corresponding mapper file. If a component type has inspector UI but no bridge, it is MISSING — not implicitly deferred. Either build the bridge, move to L4 with explicit exclusion rationale, or mark MISSING and create a build task.

---

## L1 — Feature Parity Mapping

### 1. Editor Layout & Panels

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 1.1 | Toolbar (top bar) | Preserved HTML/CSS shell | WIRED | Toolbar visible, buttons clickable |
| 1.2 | Hierarchy panel (left) | Preserved — Observer tree | WIRED | Entity tree shows, click selects |
| 1.3 | Viewport (center) | R3F Canvas replacing engine canvas | WIRED | 3D scene renders in center panel |
| 1.4 | Inspector panel (right) | Preserved — Observer-driven forms | WIRED | Properties show for selected entity |
| 1.5 | Assets panel (bottom) | Preserved HTML/CSS shell | WIRED | Asset browser shows folders/files |
| 1.6 | SPACE toggle panels | Original key handler | WIRED | Press SPACE, panels hide/show |
| 1.7 | Drag asset to viewport | R3F drop target wiring | WIRED | Drag material onto mesh in viewport |
| 1.8 | Drag asset to inspector slot | Preserved Observer binding | WIRED | Drag texture into material slot |
| 1.9 | Context-sensitive inspector | Preserved — switches on selection type | WIRED | Select entity → entity inspector; select material asset → material inspector |

### 2. Viewport

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 2.1 | Perspective camera (default) | R3F PerspectiveCamera | WIRED | Default viewport is perspective |
| 2.2 | Orthographic views (Top/Bottom/Front/Back/Left/Right) | Camera mode dropdown + OrthographicCamera | VERIFY | Click each ortho mode in dropdown |
| 2.3 | Scene camera preview | Switch to entity Camera | VERIFY | Select camera entity in dropdown |
| 2.4 | Orbit (LMB + drag) | OrbitControls | WIRED | Left-click drag orbits scene |
| 2.5 | Pan (MMB + drag) | OrbitControls | WIRED | Middle-click drag pans |
| 2.6 | Pan (Shift + LMB + drag) | OrbitControls | VERIFY | Shift+left-click pans |
| 2.7 | Look around (RMB + drag) | Custom handler (not OrbitControls — requires PointerLockControls or custom) | VERIFY | Right-click drag = first-person look |
| 2.8 | Zoom (scroll wheel) | OrbitControls | WIRED | Scroll wheel zooms |
| 2.9 | WASD fly mode | Custom key handler | VERIFY | WASD moves camera in viewport |
| 2.10 | Shift+WASD faster fly | Custom key handler | VERIFY | Shift+WASD = faster movement |
| 2.11 | F = focus on selection | Camera frame-to-selection | WIRED | Press F, camera zooms to selected |
| 2.12 | Translate gizmo (key: 1) | TransformControls mode="translate" | WIRED | Press 1, translate arrows appear |
| 2.13 | Rotate gizmo (key: 2) | TransformControls mode="rotate" | WIRED | Press 2, rotation rings appear |
| 2.14 | Scale gizmo (key: 3) | TransformControls mode="scale" | WIRED | Press 3, scale cubes appear |
| 2.15 | Resize element gizmo | Custom implementation — no Three.js equivalent | VERIFY | Element resize gizmo works |
| 2.16 | Shift+drag = snap toggle | Gizmo snap setting | VERIFY | Shift toggles snap during drag |
| 2.17 | L = local/world space | TransformControls space toggle | WIRED | Press L, gizmo switches coordinate space |
| 2.18 | Click = select entity | R3F raycasting / pointer events | WIRED | Click mesh, entity selected in hierarchy |
| 2.19 | Wireframe render mode | Three.js material.wireframe | VERIFY | Toggle wireframe overlay |
| 2.20 | Debug render modes (albedo, normals, AO, emission) | Custom ShaderMaterial or scene.overrideMaterial per channel | VERIFY | Each debug mode visualizes correct channel |
| 2.21 | Grid | Drei Grid component | WIRED | Floor grid visible in viewport |
| 2.22 | GizmoHelper orientation cube | Drei GizmoHelper + GizmoViewcube | WIRED | Orientation cube visible, clickable |
| 2.23 | Multi-select (Shift+click in hierarchy) | Preserved selection system | VERIFY | Shift+click selects multiple entities |

### 3. Hierarchy Panel

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 3.1 | Entity tree display | Observer tree → React | WIRED | Full tree with indentation |
| 3.2 | Click to select | Observer selection events | WIRED | Click entity, viewport highlights it |
| 3.3 | Create child entity (Ctrl+E) | Preserved editor method | VERIFY | Ctrl+E creates new entity |
| 3.4 | Delete entity (Delete key) | Preserved editor method | VERIFY | Delete key removes entity |
| 3.5 | Duplicate entity (Ctrl+D) | Preserved editor method | VERIFY | Ctrl+D duplicates with children |
| 3.6 | Rename entity (N / F2) | Preserved editor method | VERIFY | N or F2 opens rename |
| 3.7 | Copy/Paste (Ctrl+C / Ctrl+V) | Preserved editor method | VERIFY | Copy + paste entity |
| 3.8 | Drag to reparent | Preserved UI behavior | VERIFY | Drag entity onto new parent |
| 3.9 | Drag to reorder | Preserved UI behavior | VERIFY | Drag entity to new position |
| 3.10 | World-space transform preservation on reparent | Transform math | VERIFY | Reparent preserves world position |
| 3.11 | Ctrl+reparent = no preservation | Transform math bypass | VERIFY | Ctrl+drag applies local transform |
| 3.12 | Search (fuzzy) | Preserved search box | VERIFY | Type name, entities filter |
| 3.13 | Right-click context menu | Preserved menu | VERIFY | Right-click shows create/duplicate/copy/paste/rename/delete |
| 3.14 | Multi-select (Shift+click) | Preserved selection | VERIFY | Shift+click selects multiple, inspector shows shared properties |

### 4. Inspector Panel

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 4.1 | Entity transform (Position/Rotation/Scale) | Observer → R3F object3D | WIRED | Edit position, mesh moves in viewport |
| 4.2 | Add Component dropdown | Preserved UI | VERIFY | Add Component button works |
| 4.3 | Remove Component | Preserved UI | VERIFY | Remove button on component header |
| 4.4 | Enable/Disable Component toggle | Preserved UI | VERIFY | Checkbox toggles component |
| 4.5 | Number/text input fields | Preserved forms | WIRED | Type values, properties update |
| 4.6 | Asset slot (click to highlight) | Preserved behavior | VERIFY | Click asset slot, assets panel highlights |
| 4.7 | Color picker | Preserved color widget | WIRED | Color picker opens, color changes |
| 4.8 | Vector inputs (x/y/z) | Preserved multi-field | WIRED | 3-field vector input |
| 4.9 | Boolean checkbox | Preserved | WIRED | Checkbox toggles property |
| 4.10 | Enum dropdown | Preserved | WIRED | Dropdown selects option |
| 4.11 | Copy/Paste attributes | Preserved right-click | VERIFY | Right-click attribute → copy → paste |
| 4.12 | Multi-select paste | Preserved | VERIFY | Paste applies to all selected entities |
| 4.13 | Undo/Redo on property change | Observer history | WIRED | Ctrl+Z reverts property change |
| 4.14 | Texture inspector (filtering, anisotropy, addressing) | Preserved inspector view | VERIFY | Select texture asset → filtering/anisotropy/addressing fields show |
| 4.15 | Cubemap inspector (filtering, anisotropy, face textures) | Preserved inspector view | VERIFY | Select cubemap asset → face slots + filtering fields show |

### 5. Assets Panel

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 5.1 | Asset browser with folders | Preserved UI | WIRED | Folder tree + file grid visible |
| 5.2 | Create asset | Preserved UI | VERIFY | Create menu works |
| 5.3 | Upload/import asset | Preserved UI | VERIFY | Upload dialog works |
| 5.4 | Delete asset | Preserved UI | VERIFY | Delete removes asset |
| 5.5 | Search by name/ID/tags/type | Preserved search | VERIFY | Search filters assets |
| 5.6 | Filter by type | Preserved type filter | VERIFY | Type filter dropdown works |
| 5.7 | Drag-and-drop to viewport | R3F drop target | WIRED | Drag material to mesh |
| 5.8 | Drag-and-drop to inspector | Preserved binding | WIRED | Drag texture to slot |
| 5.9 | Move assets between folders | Preserved drag behavior | VERIFY | Drag asset to folder |
| 5.10 | Thumbnail previews | Three.js offscreen renderer | WIRED | Material/model/font thumbnails render |
| 5.11 | Asset reference checking | Preserved | VERIFY | See where asset is used |
| 5.12 | Asset common properties (ID, Name, Tags, Type, Preload) | Preserved inspector | VERIFY | Metadata fields visible when asset selected |

### 6. Toolbar

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 6.1 | Translate button (1) | TransformControls mode | WIRED | Button activates translate gizmo |
| 6.2 | Rotate button (2) | TransformControls mode | WIRED | Button activates rotate gizmo |
| 6.3 | Scale button (3) | TransformControls mode | WIRED | Button activates scale gizmo |
| 6.4 | World/Local toggle (L) | TransformControls space | WIRED | Button toggles coordinate space |
| 6.5 | Snap toggle | Gizmo snap config | VERIFY | Snap button toggles |
| 6.6 | Undo (Ctrl+Z) | Observer history | WIRED | Undo button / shortcut works |
| 6.7 | Redo (Ctrl+Y) | Observer history | WIRED | Redo button / shortcut works |
| 6.8 | Focus (F) | Camera frame | WIRED | Focus button / shortcut works |
| 6.9 | Menu button | Preserved UI | VERIFY | Menu opens |
| 6.10 | Lightmapper | Source-editor-specific — removed | SKIPPED | Removed from ONEMO |
| 6.11 | Publish/Download | Adapted for ONEMO | VERIFY | Status documented |
| 6.12 | Settings | Preserved | VERIFY | Opens scene settings in inspector |
| 6.13 | Launch (Ctrl+Enter) | Adapted or removed | VERIFY | Status documented |
| 6.14 | Help controls reference | Preserved | VERIFY | Shortcut reference shows |

### 7. Scene Management

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 7.1 | Save scene | SavedScene schema → JSON | WIRED | Ctrl+S produces valid JSON |
| 7.2 | Load scene | JSON → savedSceneToViewerConfig() | WIRED | Load restores scene state |
| 7.3 | Undo (Ctrl+Z) | Observer history stack | WIRED | Undo reverts last change |
| 7.4 | Redo (Ctrl+Y / Ctrl+Shift+Z) | Observer history stack | WIRED | Redo re-applies change |
| 7.5 | Scene settings — fog | R3F Fog/FogExp2 | VERIFY | Fog type/color/density settings work |
| 7.6 | Scene settings — ambient | R3F ambientLight | VERIFY | Ambient color/intensity settings work |
| 7.7 | Scene settings — skybox | R3F Environment / scene.background | VERIFY | Skybox cubemap assignment works |
| 7.8 | Scene settings — rendering | R3F Canvas gl props | VERIFY | Tone mapping, exposure, color space settings apply |
| 7.9 | Create scene | Preserved or adapted | VERIFY | Create scene operation works |
| 7.10 | Open scene | Preserved or adapted | VERIFY | Open scene operation works |
| 7.11 | Duplicate scene | Preserved or adapted | VERIFY | Duplicate scene works |
| 7.12 | Scene settings — physics gravity | Custom or stubbed | VERIFY | Gravity vector setting exists or is excluded |

### 8. Materials (Standard Material → MeshStandardMaterial)

This is the largest parity surface. The source editor's Standard Material has 15 sections.

| # | Material Section | Three.js Equivalent | Expected Status | Audit Check |
|---|-----------------|-------------------|----------------|-------------|
| 8.1 | Texture transform (offset/tiling/rotation) | texture.offset / texture.repeat / texture.rotation | WIRED | Change offset → UV shifts |
| 8.2 | Apply To All Maps | Custom bridge logic | VERIFY | Toggle applies transform to all maps |
| 8.3 | **Ambient** — AO map + color + intensity | aoMap + aoMapIntensity | WIRED | AO map slot, intensity slider |
| 8.4 | **Diffuse** — map + color + intensity | map + color | WIRED | Diffuse map slot, color picker |
| 8.5 | **Specular/Metalness** — metalness map + factor | metalnessMap + metalness | WIRED | Metalness slider 0–1 |
| 8.6 | **Specular/Metalness** — glossiness/roughness | roughnessMap + roughness (inverted) | WIRED | Roughness slider 0–1 |
| 8.7 | **Specular/Metalness** — anisotropy | MeshPhysicalMaterial.anisotropy | VERIFY | Anisotropy map + intensity |
| 8.8 | **Specular workflow** (Use Metalness off) — specular color + tint | Custom bridge — no direct MeshStandardMaterial equivalent | VERIFY | Specular color/tint controls when metalness toggled off |
| 8.9 | **Emissive** — map + color + intensity | emissiveMap + emissive + emissiveIntensity | WIRED | Emissive map slot, color, intensity |
| 8.10 | **Opacity** — blend type + map + alpha test + dither | transparent + alphaMap + alphaTest | WIRED | All opacity sub-properties work (blend, alpha test, alpha-to-coverage, dither) |
| 8.11 | **Normals** — normal map + bumpiness | normalMap + normalScale | WIRED | Normal map slot, intensity slider |
| 8.12 | **Parallax** — height map + strength | Custom parallax shader (NOTE: NOT Three.js displacementMap — editor parallax is visual-only, not vertex displacement) | VERIFY | Height map slot, strength slider — verify visual parallax, not vertex displacement |
| 8.13 | **Clear Coat** — factor + gloss + normals | MeshPhysicalMaterial clearcoat + clearcoatRoughness + clearcoatNormalMap | VERIFY | Clear coat controls work |
| 8.14 | **Sheen** — color + glossiness | MeshPhysicalMaterial sheen + sheenColor + sheenRoughness | VERIFY | Sheen controls work |
| 8.15 | **Refraction** — IOR + thickness + attenuation + dispersion | MeshPhysicalMaterial transmission + ior + thickness + attenuationColor + attenuationDistance + dispersion | VERIFY | Refraction/transmission controls including dispersion |
| 8.16 | **Iridescence** — intensity + thickness + IOR | MeshPhysicalMaterial iridescence + iridescenceIOR + iridescenceThicknessRange | VERIFY | Iridescence controls work |
| 8.17 | **Environment** — sphere map + cube map + reflectivity | envMap + envMapIntensity | VERIFY | Environment map controls |
| 8.18 | **Lightmap** — map + UV channel | lightMap + lightMapIntensity (requires UV2) | VERIFY | Lightmap controls |
| 8.19 | **Other** — depth test/write, cull, fog, lighting, tonemap | material.depthTest/Write, side, fog | VERIFY | Render state controls work |
| 8.20 | UV Channel selector (UV0/UV1) per map | texture UV attribute selection | VERIFY | UV channel dropdown per map |
| 8.21 | Color channel selector (R/G/B/A) per map | Custom channel extraction shader | VERIFY | Channel selector per map |
| 8.22 | Vertex color toggle per section | vertexColors on material | VERIFY | Vertex color checkbox per section |

### 9. Lighting

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 9.1 | Directional light | THREE.DirectionalLight | WIRED | Create directional, light works |
| 9.2 | Omni/Point light | THREE.PointLight | WIRED | Create point, light works |
| 9.3 | Spot light | THREE.SpotLight | WIRED | Create spot, cone visible |
| 9.4 | Area light shapes (rect/disk/sphere) | THREE.RectAreaLight (rect only, no shadows) | VERIFY | Area lights if supported |
| 9.5 | Light color | light.color | WIRED | Color picker changes light color |
| 9.6 | Light intensity (0–32) | light.intensity | WIRED | Intensity slider works |
| 9.7 | Range (point/spot) | light.distance | WIRED | Range slider works |
| 9.8 | Spot inner/outer cone angle | light.angle + light.penumbra | WIRED | Cone angle sliders work |
| 9.9 | Cast shadows toggle | light.castShadow | WIRED | Shadow checkbox works |
| 9.10 | Shadow resolution | shadow.mapSize | VERIFY | Resolution dropdown works |
| 9.11 | Shadow bias + normal offset bias | shadow.bias + shadow.normalBias | VERIFY | Both bias sliders work |
| 9.12 | Shadow distance | shadow.camera.far | VERIFY | Distance slider works |
| 9.13 | Shadow intensity | Custom — no native Three.js per-light shadow intensity | VERIFY | Intensity control if implemented |
| 9.14 | Falloff mode (linear/inverse squared) | Custom bridge mapping | VERIFY | Falloff dropdown works |
| 9.15 | Cookie texture | N/A in Three.js (no direct equivalent) | SKIPPED | Not supported in R3F renderer |
| 9.16 | Bake lightmap | Removed — source-editor-specific | SKIPPED | Lightmapper toolbar removed |
| 9.17 | Clustered lighting settings | Removed — source-editor-specific | SKIPPED | Not applicable to Three.js renderer |

### 10. Camera

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 10.1 | Perspective projection | THREE.PerspectiveCamera | WIRED | Camera renders perspective |
| 10.2 | Orthographic projection + Ortho Height | THREE.OrthographicCamera | VERIFY | Camera renders orthographic, ortho height slider works |
| 10.3 | FOV | camera.fov | WIRED | FOV slider changes perspective |
| 10.4 | Near clip | camera.near | WIRED | Near clip works |
| 10.5 | Far clip | camera.far | WIRED | Far clip works |
| 10.6 | Clear color + clear buffer toggles | renderer.setClearColor | VERIFY | Clear color picker + buffer checkboxes work |
| 10.7 | Viewport rect | Custom render target | VERIFY | Split-screen viewport |
| 10.8 | Layers | Render order management | VERIFY | Layer assignment works |
| 10.9 | Priority | Render order | VERIFY | Camera priority ordering |
| 10.10 | Frustum culling | camera.frustumCulling | VERIFY | Culling checkbox works |

### 11. Keyboard Shortcuts

| # | Shortcut | Action | Expected Status | Audit Check |
|---|----------|--------|----------------|-------------|
| 11.1 | 1 | Translate gizmo | WIRED | Key activates translate |
| 11.2 | 2 | Rotate gizmo | WIRED | Key activates rotate |
| 11.3 | 3 | Scale gizmo | WIRED | Key activates scale |
| 11.4 | L | Local/world toggle | WIRED | Key toggles space |
| 11.5 | F | Focus on selection | WIRED | Key frames camera |
| 11.6 | SPACE | Toggle panels | VERIFY | Key hides/shows panels |
| 11.7 | N / F2 | Rename | VERIFY | Key opens rename |
| 11.8 | Delete / Ctrl+Backspace | Delete entity | VERIFY | Key deletes selection |
| 11.9 | Ctrl+E | Create child entity | VERIFY | Key creates entity |
| 11.10 | Ctrl+D | Duplicate | VERIFY | Key duplicates |
| 11.11 | Ctrl+C | Copy | VERIFY | Key copies |
| 11.12 | Ctrl+V | Paste | VERIFY | Key pastes |
| 11.13 | Ctrl+Z | Undo | WIRED | Key undoes |
| 11.14 | Ctrl+Y / Ctrl+Shift+Z | Redo | WIRED | Key redoes |
| 11.15 | Ctrl+Enter | Launch | VERIFY | Key launches scene |
| 11.16 | Ctrl+B | Re-bake lighting | SKIPPED | Lightmapper removed |
| 11.17 | Shift+Z | Select previous | VERIFY | Key restores selection |
| 11.18 | Ctrl+Space | Search toolbar | VERIFY | Key opens search |
| 11.19 | Shift+? | Controls reference | VERIFY | Key shows shortcuts |
| 11.20 | Shift+drag | Snap toggle | VERIFY | Modifier toggles snap |
| 11.21 | WASD | Camera fly | VERIFY | Keys move camera |
| 11.22 | LMB+drag | Orbit | WIRED | Mouse orbits |
| 11.23 | MMB+drag | Pan | WIRED | Mouse pans |
| 11.24 | RMB+drag | Look around | VERIFY | Mouse looks around |
| 11.25 | Scroll | Zoom | WIRED | Wheel zooms |

### 12. Entity Components

Every component type listed here MUST have an R3F bridge (mapper file + observer-r3f-bridge.ts routing) or an explicit L4 exclusion. Inspector UI without a bridge is MISSING, not acceptable.

| # | Component | R3F Equivalent | Status | Bridge file | Audit Check |
|---|-----------|---------------|--------|-------------|-------------|
| 12.1 | Render (mesh display) | R3F mesh + geometry + material | WIRED | render-mapper.ts | Entity with render shows mesh |
| 12.2 | Render — primitive types (Box/Sphere/Cylinder/Cone/Plane/Capsule) | Three.js geometry types | WIRED | render-mapper.ts | Each primitive type renders |
| 12.3 | Render — render asset | GLTF/GLB loading | WIRED | render-mapper.ts | Assigned render asset displays |
| 12.4 | Render — cast/receive shadows | mesh.castShadow/receiveShadow | WIRED | render-mapper.ts | Shadow toggles work |
| 12.5 | Render — material slots | material array on mesh | WIRED | render-mapper.ts | Per-mesh material assignment |
| 12.6 | Light | See Section 9 | WIRED | light-mapper.ts | All light types work |
| 12.7 | Camera | See Section 10 | WIRED | camera-mapper.ts | Camera properties work |
| 12.8 | Script | Script lifecycle hooks via React/custom runner | MISSING | — | Script attachment + basic lifecycle |
| 12.9 | Collision | Visual helpers (wireframe shapes) in R3F | MISSING | — | Collision shapes visible in viewport |
| 12.10 | Rigid Body | Property storage + visual indicators | MISSING | — | RB properties stored, gravity indicator |
| 12.11 | Anim (animation state graph) | THREE.AnimationMixer + basic state evaluation | MISSING | — | Animation clips play, transitions work |
| 12.12 | Animation (legacy) | THREE.AnimationMixer | MISSING | — | Legacy animation clips play |
| 12.13 | Sound | THREE.PositionalAudio / THREE.Audio | MISSING | — | Sound component plays audio |
| 12.14 | Audio Listener | THREE.AudioListener | MISSING | — | Listener attached to camera |
| 12.15 | Particle System | Three.js Points + custom particle sim | MISSING | — | Particles render in viewport |
| 12.16 | Element (UI text/image) | troika-three-text + THREE.Sprite or HTML overlay | MISSING | — | UI text/images visible |
| 12.17 | Sprite | THREE.Sprite + THREE.SpriteMaterial | MISSING | — | Sprite displays in viewport |
| 12.18 | Screen (UI root) | HTML overlay container or viewport indicator | MISSING | — | Screen boundaries visible |
| 12.19 | GSplat | Three.js gaussian splatting renderer | MISSING | — | Gaussian splat renders |
| 12.20 | Button | Event handler bridge + visual indicator | MISSING | — | Button component functional |
| 12.21 | Layout Group/Child | CSS-like layout computation or indicator | MISSING | — | Layout boundaries visible |
| 12.22 | Scroll View/Scrollbar | Scroll container + visual indicator | MISSING | — | Scroll bounds visible |
| 12.23 | Zone | Wireframe bounding box in R3F | MISSING | — | Zone volume visible |
| 12.24 | Model (legacy) | Redirect to render bridge | MISSING | — | Legacy model displays via render path |

### 13. Asset Types & Pipeline

| # | Asset Type | R3F Pipeline | Expected Status | Audit Check |
|---|-----------|-------------|----------------|-------------|
| 13.1 | Material | MeshStandardMaterial bridge | WIRED | Material assets editable |
| 13.2 | Render (.glb/.fbx) | GLTFLoader | WIRED | 3D models import |
| 13.3 | Texture (images) | TextureLoader | WIRED | Texture assets display |
| 13.4 | Cubemap | CubeTextureLoader | WIRED | Cubemap assets work |
| 13.5 | Font (.ttf/.woff) | FontFace API for thumbnails | WIRED | Font thumbnails render |
| 13.6 | Animation (.glb/.fbx) | Three.js AnimationClip | VERIFY | Animation assets play |
| 13.7 | Audio (.mp3/.wav/.ogg) | Web Audio API | VERIFY | Audio assets play |
| 13.8 | Script (.js/.mjs) | Script system preserved | VERIFY | Script assets attach |
| 13.9 | Shader (.glsl/.vert/.frag) | ShaderMaterial | VERIFY | Shader assets usable |
| 13.10 | Template | Template system preserved | VERIFY | Template instantiation works |
| 13.11 | GSplat (.ply) | Splat renderer | VERIFY | GSplat assets render |
| 13.12 | Sprite | Sprite system | VERIFY | Sprite assets display |
| 13.13 | JSON/Text/HTML/CSS/Binary/WASM | Pass-through (no render) | WIRED | Data assets accessible |
| 13.14 | Texture Atlas | Sprite sheet system | VERIFY | Texture atlas assets work |
| 13.15 | Bundle | Asset bundling system | VERIFY | Bundle assets work |

### 14. Thumbnail Rendering

| # | Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------|---------------|----------------|-------------|
| 14.1 | Material thumbnails | Three.js offscreen sphere render | WIRED | Material cards show sphere preview |
| 14.2 | Model thumbnails | Three.js offscreen mesh render | WIRED | Model cards show 3D preview |
| 14.3 | Cubemap thumbnails | Three.js offscreen cubemap render | WIRED | Cubemap cards show preview |
| 14.4 | Font thumbnails | Canvas 2D + FontFace API | WIRED | Font cards show text preview |
| 14.5 | Template thumbnails | Three.js offscreen render | VERIFY | Template cards show preview |
| 14.6 | Texture thumbnails | Image element | WIRED | Texture cards show image |

### 15. Post Effects

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 15.1 | HDR Bloom | @react-three/postprocessing or custom | VERIFY | Bloom effect if supported |
| 15.2 | SSAO | @react-three/postprocessing | VERIFY | SSAO effect if supported |
| 15.3 | Depth of Field | @react-three/postprocessing | VERIFY | DoF effect if supported |
| 15.4 | TAA (Temporal Anti-Aliasing) | Custom or built-in MSAA | VERIFY | AA approach documented |
| 15.5 | Color Grading / LUT | @react-three/postprocessing | VERIFY | Color grading if supported |
| 15.6 | Vignette | @react-three/postprocessing | VERIFY | Vignette if supported |
| 15.7 | Fringing (chromatic aberration) | @react-three/postprocessing | VERIFY | Chromatic aberration if supported |

Note: Source editor had both modern (HDR-aware) and legacy post effects. ONEMO may implement a subset via @react-three/postprocessing, or these may be deferred. The audit must document which are wired, stubbed, or excluded.

### 16. Layer System

| # | Editor Feature | R3F Equivalent | Expected Status | Audit Check |
|---|---------------|---------------|----------------|-------------|
| 16.1 | Default layer stack (7 layers: World, Depth, Skybox, Immediate, UI) | R3F render order + Three.js layers | VERIFY | Default layers exist or equivalent render ordering |
| 16.2 | Layer assignment on Render/Camera/Light components | Three.js object.layers | VERIFY | Components have layer controls |
| 16.3 | Sort modes (Material/Mesh, Back-to-Front, Front-to-Back) | Three.js renderOrder + custom sorting | VERIFY | Transparency sorting works correctly |
| 16.4 | Opaque/Transparent sub-layer separation | Built-in Three.js transparency handling | VERIFY | Opaque renders before transparent |

---

## L2 — Visual & Interactive Test Plan

These tests MUST be run in a real browser against `http://127.0.0.1:3487`.

### Test Group A: Layout Verification
1. Screenshot full page — verify 5-panel layout (toolbar top, hierarchy left, viewport center, inspector right, assets bottom)
2. Press SPACE — verify all panels toggle
3. Resize browser window — verify panels adapt

### Test Group B: Viewport Interaction
1. Left-click drag in viewport — verify orbit
2. Middle-click drag — verify pan
3. Scroll wheel — verify zoom
4. Press 1, click entity, drag gizmo — verify translate
5. Press 2, drag ring — verify rotate
6. Press 3, drag cube — verify scale
7. Press L — verify local/world toggle
8. Press F with entity selected — verify camera focuses
9. Click GizmoHelper cube face — verify camera snaps to ortho view
10. WASD keys — verify camera fly mode
11. Shift+WASD — verify faster camera fly
12. Right-click drag — verify look-around (first-person)
13. Toggle wireframe render mode — verify wireframe overlay
14. Toggle debug render mode (if available) — verify channel visualization

### Test Group C: Hierarchy + Selection
1. Click entity in hierarchy — verify inspector updates + viewport highlights
2. Click 3+ different entities — verify inspector switches each time
3. Right-click entity — verify context menu appears
4. Drag entity onto another — verify reparenting works
5. Shift+click multiple entities — verify multi-selection works
6. Type in hierarchy search box — verify entities filter
7. Ctrl+E — verify new entity created
8. Select entity, press Delete — verify entity removed
9. Ctrl+D — verify entity duplicated

### Test Group D: Inspector Editing
1. Select mesh entity — verify transform fields (Position/Rotation/Scale)
2. Change position X value — verify mesh moves in viewport
3. Select material asset — verify material properties show
4. Change diffuse color — verify viewport material updates
5. Change roughness slider — verify viewport reflection changes
6. Assign texture to map slot — verify texture appears on mesh
7. Ctrl+Z after change — verify undo works
8. Select texture asset — verify texture inspector shows (filtering, anisotropy)
9. Select cubemap asset — verify cubemap inspector shows (faces, filtering)

### Test Group E: Asset Operations
1. Open assets panel — verify folder/file structure
2. Double-click folder — verify navigation
3. Drag material onto viewport mesh — verify material applies
4. Check material thumbnail — verify sphere preview renders
5. Check model thumbnail — verify 3D preview renders
6. Check font thumbnail — verify text preview renders
7. Check cubemap thumbnail — verify cubemap preview renders

### Test Group F: Save/Load
1. Press Ctrl+S — verify JSON output produced
2. Inspect JSON — verify it contains scene data (not legacy Observer metadata)
3. Modify scene, save, reload — verify state persists

### Test Group G: Network Integrity
1. Open DevTools → Network tab → reload page
2. List ALL requests to external domains (not localhost:3487)
3. Flag any requests to playcanvas.com, api.github.com, or other unexpected domains

### Test Group H: Branding Sweep
1. Check for "PlayCanvas" text anywhere in visible UI
2. Check for "JOHN LEMON PUBLIC PROJECT" in sidebar
3. Check for "BUILDS & PUBLISH" button
4. Check for Version Control modal
5. Check for playcanvas.com links in UI
6. Check for source editor community links (GitHub issues, Discord, Forum)

### Test Group I: Scene Settings
1. Open scene settings (Settings toolbar button)
2. Change fog settings — verify viewport fog updates
3. Change ambient lighting — verify viewport ambient changes
4. Assign skybox cubemap — verify background changes
5. Change rendering settings (if available) — verify viewport updates

---

## L3 — Code Health Checklist

| # | Check | How to verify | Pass criteria |
|---|-------|--------------|---------------|
| 3.1 | No direct `from 'playcanvas'` in editor UI | `grep -r "from 'playcanvas'" src/editor/ src/common/` excluding `playcanvas-compat.ts` | Zero hits |
| 3.2 | No direct `from 'playcanvas'` in viewport | `grep -r "from 'playcanvas'" src/editor/viewport/` excluding `viewport-engine.ts` | Zero hits |
| 3.3 | playcanvas-compat.ts reads from globalThis.pc | Read file, verify pattern | All exports use `read()` from `globalThis.pc` |
| 3.4 | viewport-engine.ts exports from compat | Read file, verify re-export | Exports via `@/common/playcanvas-compat` |
| 3.5 | No orphaned legacy imports | `grep -r "import.*from 'playcanvas'" src/` | Only in compat shim and vendored files |
| 3.6 | Clean TypeScript build | `npm run typecheck` | Zero errors |
| 3.7 | Clean lint | `npm run lint` | Zero errors |
| 3.8 | No dead code in launch/ | Verify `src/launch/` deleted | Directory does not exist |
| 3.9 | No expose.ts | Verify `src/editor/expose.ts` deleted | File does not exist |
| 3.10 | Vendored engine runtime exists | Verify `vendor/playcanvas/playcanvas.js` exists | File present, ~3.7MB |
| 3.11 | No engine npm dependency | Read package.json dependencies | `playcanvas` not in dependencies |
| 3.12 | No legacy branding in howdoi.json | Read howdoi.json | No playcanvas.com URLs |
| 3.13 | Tests pass | `npm test` | All tests pass |
| 3.14 | No runtime `window.pc.*` bypassing compat shim | `grep -r "window\.pc\." src/` or `grep -r "globalThis\.pc\." src/` excluding playcanvas-compat.ts | Zero hits |
| 3.15 | No unused engine-specific dependencies | Check package.json for orphaned packages | No source-engine-specific packages remain |
| 3.16 | No legacy branding in CSS/HTML | `grep -rI "playcanvas\|PlayCanvas" src/ sass/` excluding compat shim, LICENSE, vendor | Zero hits in UI-visible code |
| 3.17 | No hardcoded development URLs | `grep -r "localhost:" src/` excluding test files | Zero hits or only in dev config |
| 3.18 | No leftover console.log debug statements | `grep -r "console\.log" src/editor/adapter/` | Zero hits in adapter layer |

---

## L4 — Scope Exclusions (Intentionally Removed/Skipped)

Features from the source editor that are intentionally NOT in ONEMO 3D Studio. Verify they're cleanly removed.

| # | Feature | Reason Excluded | Verify |
|---|---------|----------------|--------|
| 4.1 | Cloud saving | ONEMO uses local save/load | No cloud save UI or network calls |
| 4.2 | Version control (checkpoints/branches/merge) | ONEMO uses git | No VC modal or UI |
| 4.3 | Launch page (live-link) | Replaced with ONEMO workflow | Launch dir deleted, no launch UI, no real-time live-link |
| 4.4 | Publishing (web/mobile/desktop) | ONEMO has own publish flow | No legacy publish UI |
| 4.5 | Collaboration (multi-user, chat) | Not needed for solo studio | No collaboration UI |
| 4.6 | Source editor hosting | ONEMO self-hosted | No external hosting UI |
| 4.7 | Community links (GitHub/Discord/Forum) | ONEMO branding | No source editor community links |
| 4.8 | Lightmapper (bake) | Source-editor-specific | No bake UI, Ctrl+B disabled |
| 4.9 | Cookie textures (light projections) | No Three.js equivalent (renderer limitation) | Not in light inspector |
| 4.10 | Clustered lighting settings | Source-editor-specific renderer | Not in scene settings |
| 4.11 | Layer composition editor | Simplified — basic layer ordering via Three.js layers API | Verify render ordering works without full layer editor |
| 4.12 | Code editor (integrated) | External editor preferred | Verify toolbar button removed or redirects |
| 4.13 | How Do I widget | Source editor help system | Verify removed or replaced |
| 4.14 | Deprecated components (Animation Legacy, Model Legacy) | Replaced by Anim and Render | Verify deprecated components not available in Add Component |
| 4.15 | Lightmap-related render properties | Lightmapper removed — orphaned properties | Verify Cast Lightmap Shadows, Lightmapped, Lightmap Size Multiplier either hidden or non-functional |
| 4.16 | Post effects (if not implemented) | Deferred to future iteration | Document which effects exist vs excluded |

---

## Audit Execution Order

1. **L3 first** — code health (fast, automated, catches structural issues)
2. **L1 second** — feature parity mapping (code reading, traces wiring)
3. **L4 third** — scope exclusions (verify clean removal)
4. **L2 last** — visual/interactive tests (browser, slowest, highest confidence)

Each layer produces a findings report with the status key (WIRED/STUBBED/SKIPPED/MISSING/N/A).

Gaps found → filed as Linear issues → fixed → re-audited.
