# ONEMO 3D Studio — Editor Feature Reference

> Last verified: 2026-03-29
> Source editor version documented: v2.20.1 (current as of March 2026)
> Purpose: Feature reference for ONEMO 3D Studio, derived from source editor v2.20.1 documentation
> Next review: 2026-06-29

## Sources

| Source | URL | Verified | Notes |
|--------|-----|----------|-------|
| Editor Overview | https://developer.playcanvas.com/user-manual/editor/ | 2026-03-29 | Fetched directly |
| Editor Interface | https://developer.playcanvas.com/user-manual/editor/interface/ | 2026-03-29 | Fetched directly |
| Viewport | https://developer.playcanvas.com/user-manual/editor/interface/viewport/ | 2026-03-29 | Fetched directly |
| Inspector | https://developer.playcanvas.com/user-manual/editor/interface/inspector/ | 2026-03-29 | Fetched directly |
| Hierarchy | https://developer.playcanvas.com/user-manual/editor/interface/hierarchy/ | 2026-03-29 | Fetched directly |
| Assets Panel | https://developer.playcanvas.com/user-manual/editor/interface/assets/ | 2026-03-29 | Fetched directly |
| Toolbar | https://developer.playcanvas.com/user-manual/editor/interface/toolbar/ | 2026-03-29 | Fetched directly |
| Keyboard Shortcuts | https://developer.playcanvas.com/user-manual/editor/interface/keyboard-shortcuts/ | 2026-03-29 | Fetched directly |
| Scenes | https://developer.playcanvas.com/user-manual/editor/scenes/ | 2026-03-29 | Fetched directly |
| Version Control | https://developer.playcanvas.com/user-manual/editor/version-control/ | 2026-03-29 | Fetched directly |
| Launch Page | https://developer.playcanvas.com/user-manual/editor/interface/launch-page/ | 2026-03-29 | Fetched directly |
| Components | https://developer.playcanvas.com/user-manual/editor/scenes/components/ | 2026-03-29 | Fetched directly |
| Material Inspector | https://developer.playcanvas.com/user-manual/editor/assets/inspectors/material/ | 2026-03-29 | Fetched directly |
| Texture Inspector | https://developer.playcanvas.com/user-manual/editor/assets/inspectors/texture/ | 2026-03-29 | Fetched directly |
| Cubemap Inspector | https://developer.playcanvas.com/user-manual/editor/assets/inspectors/cubemap/ | 2026-03-29 | Fetched directly |
| Asset Types | https://developer.playcanvas.com/user-manual/editor/assets/inspectors/ | 2026-03-29 | Fetched directly |
| Physical Materials | https://developer.playcanvas.com/user-manual/graphics/physical-rendering/physical-materials/ | 2026-03-29 | Fetched directly |
| Lighting | https://developer.playcanvas.com/user-manual/graphics/lighting/lights/ | 2026-03-29 | Fetched directly |
| Shadows | https://developer.playcanvas.com/user-manual/graphics/lighting/shadows/ | 2026-03-29 | Fetched directly |
| Cameras | https://developer.playcanvas.com/user-manual/graphics/cameras/ | 2026-03-29 | Fetched directly |
| Layers | https://developer.playcanvas.com/user-manual/graphics/layers/ | 2026-03-29 | Fetched directly |
| Clustered Lighting | https://developer.playcanvas.com/user-manual/graphics/lighting/clustered-lighting/ | 2026-03-29 | Fetched directly |
| Post Effects | https://developer.playcanvas.com/user-manual/graphics/posteffects/ | 2026-03-29 | Fetched directly |
| Component: Render | https://developer.playcanvas.com/user-manual/editor/scenes/components/render/ | 2026-03-29 | Fetched directly |
| Component: Light | https://developer.playcanvas.com/user-manual/editor/scenes/components/light/ | 2026-03-29 | Fetched directly |
| Component: Camera | https://developer.playcanvas.com/user-manual/editor/scenes/components/camera/ | 2026-03-29 | Fetched directly |
| Component: Script | https://developer.playcanvas.com/user-manual/editor/scenes/components/script/ | 2026-03-29 | Fetched directly |
| Component: Collision | https://developer.playcanvas.com/user-manual/editor/scenes/components/collision/ | 2026-03-29 | Fetched directly |
| Component: RigidBody | https://developer.playcanvas.com/user-manual/editor/scenes/components/rigidbody/ | 2026-03-29 | Fetched directly |
| Component: Anim | https://developer.playcanvas.com/user-manual/editor/scenes/components/anim/ | 2026-03-29 | Fetched directly |
| Component: Sound | https://developer.playcanvas.com/user-manual/editor/scenes/components/sound/ | 2026-03-29 | Fetched directly |
| Component: Particle System | https://developer.playcanvas.com/user-manual/editor/scenes/components/particlesystem/ | 2026-03-29 | Fetched directly |
| Component: Element | https://developer.playcanvas.com/user-manual/editor/scenes/components/element/ | 2026-03-29 | Fetched directly |
| Component: Sprite | https://developer.playcanvas.com/user-manual/editor/scenes/components/sprite/ | 2026-03-29 | Fetched directly |
| Component: Screen | https://developer.playcanvas.com/user-manual/editor/scenes/components/screen/ | 2026-03-29 | Fetched directly |
| Component: GSplat | https://developer.playcanvas.com/user-manual/editor/scenes/components/gsplat/ | 2026-03-29 | Fetched directly |

---

## 1. Editor Layout & Panels

### Core Architecture

- **Browser-based editor** — runs entirely in a web browser, no installation required
- **Cloud saving** — automatic, accessible from any device
- **WYSIWYG rendering** — uses the source engine directly; what you see in viewport is what ships
- **Live link** — the editor maintains real-time connection to running application (Launch Page)

### Panel Layout

| Panel | Location | Purpose |
|-------|----------|---------|
| **Toolbar** | Top bar | Quick access to commonly used commands |
| **Hierarchy Panel** | Left side | Hierarchical tree view of all Entities in the open Scene |
| **Viewport** | Center, main area | 3D view for selecting, positioning, and orienting Entities |
| **Inspector Panel** | Right side | Detailed properties of the selected Entity, Asset, or Component |
| **Assets Panel** | Bottom | View and manage all Assets in the current Project |

### Panel Behaviors

- **SPACE** — toggles hide/show of all panels simultaneously
- Drag-and-drop assets from Assets panel into viewport or Inspector slots
- Inspector context-sensitive: switches between Entity inspector, Material inspector, Texture inspector, Cubemap inspector depending on selection

---

## 2. Viewport

### Camera Modes

- **Perspective** (default) — simulates a floating movie camera in the scene; realistic depth perception
- **Orthographic — Top** — overhead view, no perspective
- **Orthographic — Bottom** — bottom view, no perspective
- **Orthographic — Front** — front-facing view, no perspective
- **Orthographic — Back** — rear view, no perspective
- **Orthographic — Left** — left-side view, no perspective
- **Orthographic — Right** — right-side view, no perspective
- **Scene Camera** — switch to any Camera Entity present in the scene
- Camera mode selector: dropdown menu in the viewport

### Camera Navigation Controls

| Control | Action |
|---------|--------|
| Left Mouse Button + Drag | Orbit (rotate around scene) |
| Middle Mouse Button + Drag | Pan view |
| Shift + Left Mouse Button + Drag | Pan view (alternate) |
| Right Mouse Button + Drag | Look around (first-person style) |
| Mouse Wheel | Zoom / dolly in and out |
| W / A / S / D | Move camera (fly mode) |
| Shift + W / A / S / D | Move camera faster (fly mode) |
| F | Focus viewport camera on selected entity |

### Transform Gizmos

| Gizmo | Description | Activation |
|-------|-------------|-----------|
| **Translate** | Arrows on ends of X/Y/Z axes; drag axis or plane | Key: 1, or Toolbar button |
| **Rotate** | Three colored rings around X/Y/Z axes | Key: 2, or Toolbar button |
| **Scale** | Cubes on ends of X/Y/Z axes | Key: 3, or Toolbar button |
| **Resize Element** | Resize gizmo for UI Element components | Toolbar button |

### Gizmo Modifier Behaviors

- **Shift + drag** — toggles snap setting during gizmo operation
- **L** — switch between local and world coordinate space

### Selection

- **Left Mouse Button** — select entity in viewport
- **Left Mouse Button + Drag** — transform entity using the active gizmo
- Multi-selection: combine with Shift in Hierarchy panel

### Render Modes (viewport visualization)

- **Default** — full lit scene
- **Wireframe** — show mesh wireframe overlay
- **Debug render modes** — visualize individual G-buffer channels: albedo, normals, AO, emission, and more

---

## 3. Hierarchy Panel

### Display

- Shows the complete **entity tree** for the open scene
- Root Entity shown at top
- Entities have parent-child nesting with indentation
- Click any entity to select it (also highlights in viewport)

### Entity Operations

| Operation | Method |
|-----------|--------|
| **Create child entity** | Toolbar button in panel, or Ctrl+E, or right-click context menu |
| **Delete entity** | Delete key, Ctrl+Backspace, or right-click > Delete |
| **Duplicate entity** | Ctrl+D, or right-click > Duplicate |
| **Rename entity** | N key, F2 key, or right-click > Rename |
| **Copy entity** | Ctrl+C |
| **Paste entity** | Ctrl+V (pastes as child of current selection, or into scene/another project) |
| **Reparent (drag)** | Click and drag entity onto a new parent |
| **Reorder (drag)** | Click and drag entity to new position in hierarchy |

### Parent-Child Transform Behavior

- Child entities inherit the **transform matrix** of their parent
- When reparenting via drag-and-drop: **world-space transforms are preserved** (entity appears to stay in place)
- Hold **Ctrl while reparenting** to disable world-space preservation (applies local transform directly)

### Search

- **Search box** in the panel header filters entities by name
- Uses **fuzzy matching** (not exact match)
- Click the magnifying glass icon to adjust search options

### Context Menu (right-click)

- Create entity
- Duplicate
- Copy
- Paste
- Rename
- Delete

---

## 4. Inspector Panel

### Inspector Types

The Inspector is context-sensitive and switches between:

1. **Entity/Component Inspector** — shows transform + all attached component properties
2. **Material Inspector** — shows all material channel properties (see Section 8)
3. **Texture Inspector** — shows texture import settings
4. **Cubemap Inspector** — shows cubemap faces and filter settings

### Entity Transform (always shown at top)

| Property | Type | Description |
|----------|------|-------------|
| **Position** | vec3 | Local XYZ position relative to parent |
| **Rotation** | vec3 | Local XYZ Euler rotation in degrees |
| **Scale** | vec3 | Local XYZ scale |

Transform values are editable via:
- Direct number input in the Inspector
- Dragging the gizmo in the Viewport

### Component Management

- **Add Component** — dropdown button in the Inspector to attach a new component
- **Remove Component** — remove button on each component header
- **Enable/Disable Component** — toggle checkbox on each component header
- Components are listed as collapsible sections below the entity transform

### Property Input Methods

- **Numbers/text** — text fields with direct input or slider
- **Asset slots** — click to highlight available assets in the Assets panel; drag-and-drop from Assets panel
- **Colors** — color picker
- **Vectors** — multi-field (x/y/z or x/y/z/w) input
- **Booleans** — checkbox
- **Enums** — dropdown select

### Copy/Paste Attributes

- Right-click an attribute label for Copy / Paste options
- Hover over attribute label for Copy / Paste button overlay
- **Type-safe**: paste enforces type matching (cannot paste string into number, etc.)
- **Multiselect paste**: with multiple entities selected, paste applies to all
- Supports undo/redo

### Live Editing

- Changes to properties in the Inspector transmit in real time to the running Launch Page if both editor and app are open

---

## 5. Assets Panel

### Core Capabilities

- Create, upload, delete, inspect, and edit any asset
- **Folder hierarchy** — create nested folders to organize assets
- **Search** — find assets by name, ID, tags, or type
- **Filter by type** — filter the asset list to a specific asset type
- **Drag-and-drop** — drag assets into viewport, Inspector property slots, or other locations
- **Move assets** — drag between folders
- **Copy/paste** — share assets between projects
- **Reference checking** — see where any asset is used in the scene

### Asset Common Properties (shown in Inspector when asset is selected)

| Property | Description |
|----------|-------------|
| **ID** | Unique identifier for script referencing (read-only) |
| **Name** | Editable display name |
| **Tags** | Labels for organization and filtering |
| **Type** | Asset classification (read-only) |
| **Exclude** | Remove asset from published builds |
| **Preload** | Load at application startup |
| **Size** | File size (read-only) |
| **Source** | Derivation reference (read-only) |
| **Created** | Creation timestamp (read-only) |

### Script Asset Extra Properties

| Property | Description |
|----------|-------------|
| **Loading Order** | Script sequence manager |
| **Loading Type** | Asset / Before Engine / After Engine |

### Supported Asset Types (23 types)

| Type | Source Formats | Output Format | Purpose |
|------|---------------|---------------|---------|
| Animation | .glb, .fbx | .glb | Keyframe data |
| Audio | .mp3, .wav, .ogg | same | Sound |
| Binary | .bin | .bin | Raw data |
| Bundle | Editor-created | .tar | Bundled assets |
| CSS | .css | .css | HTML styling |
| Cubemap | Image formats | Image | Environment lighting |
| Font | .ttf, .woff | .json + .png | Text rendering |
| GSplat | .ply | .ply | 3D Gaussian Splat data |
| HTML | .html | .html | Documents |
| JSON | .json | .json | Data |
| Material | .glb, .fbx | — | 3D model surface definitions |
| Render | .glb, .fbx | .glb | 3D mesh geometry |
| Script | .js, .mjs | .js, .mjs | Game logic code |
| Shader | .glsl, .vert, .frag | same | Custom GPU rendering |
| Sprite | Editor-created | — | 2D images |
| Template | .glb | — | Reusable entity hierarchies |
| Text | .txt | .txt | Documents |
| Texture Atlas | Image formats | Image | Sprite sheets |
| Texture | Image formats | Image | Surface / UI images |
| WASM | .wasm | .wasm | WebAssembly modules |
| Container | Editor-created | — | Reusable entity container |
| Model (Legacy) | .glb, .fbx | .glb | 3D model (legacy — use Render) |
| Anim State Graph | Editor-created | .json | Animation state machine |

---

## 6. Toolbar

### Transform Mode Controls

| Button | Key | Action |
|--------|-----|--------|
| **Translate** | 1 | Activate translate gizmo in the viewport |
| **Rotate** | 2 | Activate rotate gizmo in the viewport |
| **Scale** | 3 | Activate scale gizmo in the viewport |
| **Resize Element** | — | Activate UI element resize gizmo |

### Editing Controls

| Button | Key | Action |
|--------|-----|--------|
| **World/Local** | L | Switch between world and local coordinate systems for the active gizmo |
| **Snap** | Shift+(drag) | Enable/disable snapping when using gizmos |
| **Undo** | Ctrl+Z | Undo last operation |
| **Redo** | Ctrl+Y / Ctrl+Shift+Z | Redo last operation |
| **Focus** | F | Zoom viewport camera to currently selected entity |

### Project Tools

| Button | Action |
|--------|--------|
| **Menu** | Open the main menu (common editor functions) |
| **Lightmapper** | Access bake and auto-rebake controls for runtime lightmaps |
| **Code Editor** | Open integrated browser-based code editor |
| **Publish/Download** | Publish project builds or download locally |
| **Settings** | Load Editor and Scene Settings into the Inspector |
| **Launch** | Ctrl+Enter — open project in a new browser tab (Launch Page) |

### Support/Help Controls

| Button | Action |
|--------|--------|
| **GitHub** | Report issues on GitHub |
| **Discord** | Access community Discord |
| **Forum** | Access community forum |
| **How Do I...?** | Toggle help widget in the viewport |
| **Controls** | Display keyboard shortcuts reference |

---

## 7. Scene Management

### Scene Operations

| Operation | How |
|-----------|-----|
| **Create scene** | Via editor menu |
| **Open scene** | Via editor menu |
| **Duplicate scene** | Via editor menu |
| **Delete scene** | Via editor menu |
| **Save** | Automatic (cloud-backed) |
| **Launch** | Ctrl+Enter — opens scene in new browser tab |
| **Undo** | Ctrl+Z |
| **Redo** | Ctrl+Y or Ctrl+Shift+Z |

### Scene Settings (Global Properties)

Accessible via Settings toolbar button. Includes:

- **Physics gravity** — world gravity vector
- **Ambient lighting** — global ambient color
- **Fog** — type (None / Linear / Exponential / Exponential Squared), color, start/end distance (linear), density (exponential)
- **Skybox** — assign a cubemap asset, set exposure and rotation
- **Rendering settings** — global rendering configuration

### Version Control

| Feature | Description |
|---------|-------------|
| **Checkpoints** | Snapshot of the project at a point in time; includes a descriptive message; forms a timeline; cannot be deleted; can be restored |
| **Restore checkpoint** | Roll back to any prior checkpoint state |
| **Branches** | Isolated line of development; can be closed but not deleted |
| **Merging** | Combine one branch into another; merges between checkpoints only; auto-creates a checkpoint in destination branch on merge |
| **Conflict resolution** | Visual conflict resolution when both branches edit the same data |
| **Item history** | Per-asset change tracking |

### Launch Page

- Opens the running application in a separate browser tab or torn-off window
- **Real-time live-link** — changes in the editor update in the running app immediately
- Multi-device testing: visit the launch URL on any device while logged in
- Chrome users can generate QR codes for quick mobile access
- Can be displayed side-by-side with the editor

---

## 8. Materials — Standard Material Inspector

All properties belong to the **Standard Material** (physically-based, also referred to as Physical Material).

### Texture Transform (applies to all maps when "Apply To All Maps" is enabled)

| Property | Type | Description |
|----------|------|-------------|
| **Apply To All Maps** | boolean | Apply offset/tiling/rotation uniformly to all UV maps |
| **Offset** | vec2 | UV displacement (u, v) |
| **Tiling** | vec2 | UV scale (u, v) |
| **Rotation** | float | UV rotation in degrees |

### Ambient Section

| Property | Type | Description |
|----------|------|-------------|
| **Ambient Occlusion** | texture | Pre-baked shadow / occlusion data |
| **UV Channel** | enum | UV0 or UV1 |
| **Color Channel** | enum | R, G, B, or A |
| **Occlude Specular** | enum | Off / Multiply / Gloss Based |
| **Vertex Color** | boolean | Use vertex color data for AO |
| **Color** | color3 | Ambient tint color |
| **Intensity** | float 0–1 | AO effect strength |

### Diffuse Section

| Property | Type | Description |
|----------|------|-------------|
| **Diffuse** | texture | Albedo / base color map |
| **UV Channel** | enum | UV0 or UV1 |
| **Color Channel** | enum | R, G, B, A, RGB |
| **Vertex Color** | boolean | Use vertex color data |
| **Color** | color3 | Base color tint |
| **Intensity** | float | Diffuse multiplier factor |

### Specular / Metalness Section

**Common specular properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Enable GGX Specular** | boolean | Enables anisotropic GGX specular response |
| **Anisotropy** | texture | Anisotropy direction map |
| **Anisotropy Intensity** | float 0–1 | Anisotropy strength |
| **Anisotropy Rotation** | float | Anisotropy angle adjustment |
| **Use Metalness** | boolean | Toggle between metalness workflow and specular workflow |

**Metalness workflow properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Metalness** | texture | Per-pixel metalness map |
| **Vertex Color** | boolean | Use vertex color for metalness |
| **Metalness** | float 0–1 | Metalness factor |
| **Use Specular Color** | boolean | Enable specular color for non-metals |
| **Specular** | texture | Specular color map for non-metals |
| **Specularity Factor** | texture | Per-pixel specular intensity |

**Specular workflow properties (when Use Metalness is off):**

| Property | Type | Description |
|----------|------|-------------|
| **Specular** | texture | Specular color texture defining highlight color |
| **Vertex Color** | boolean | Use vertex colors for specular |
| **Tint** | boolean | Enable color tinting |
| **Color** | color3 | Specular highlight color |

**Glossiness properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Glossiness** | texture | Surface smoothness map |
| **Vertex Color** | boolean | Use vertex color for glossiness |
| **Glossiness** | float 0–100 | Surface sharpness / smoothness value |
| **Invert** | boolean | Treat glossiness map as roughness map |

### Emissive Section

| Property | Type | Description |
|----------|------|-------------|
| **Emissive** | texture | Light emission map |
| **UV Channel** | enum | UV0 or UV1 |
| **Color Channel** | enum | R, G, B, A, RGB |
| **Vertex Color** | boolean | Use vertex color for emission |
| **Color** | color3 | Emission tint color |
| **Intensity** | float | Emission brightness multiplier |

### Opacity Section

| Property | Type | Description |
|----------|------|-------------|
| **Blend Type** | enum | None / Alpha / Additive / Screen / (others) |
| **Opacity** | texture | Transparency map |
| **UV Channel** | enum | UV0 or UV1 |
| **Color Channel** | enum | R, G, B, or A |
| **Vertex Color** | boolean | Use vertex color for opacity |
| **Intensity** | float 0–1 | Overall opacity |
| **Alpha Test** | float 0–1 | Cutout discard threshold |
| **Alpha To Coverage** | boolean | MSAA-compatible transparency ordering |
| **Opacity Fades Specular** | boolean | Whether opacity affects specular reflections |
| **Opacity Dither** | enum | None / Bayer 8 / Blue Noise |
| **Opacity Shadow Dither** | enum | Dither pattern for shadows |
| **Alpha Fade** | float 0–1 | Fade factor |

### Normals Section

| Property | Type | Description |
|----------|------|-------------|
| **Normals** | texture | Normal map for surface detail |
| **UV Channel** | enum | UV0 or UV1 |
| **Bumpiness** | float 0–2 | Normal map intensity |

### Parallax Section

| Property | Type | Description |
|----------|------|-------------|
| **Heightmap** | texture | Elevation / displacement data |
| **UV Channel** | enum | UV0 or UV1 |
| **Color Channel** | enum | R, G, B, or A |
| **Strength** | float 0–2 | Parallax depth effect strength |

### Clear Coat Section

| Property | Type | Description |
|----------|------|-------------|
| **Clear Coat Factor** | float 0–1 | Clear coat layer intensity |
| **Clear Coat** | texture | Clear coat mask |
| **UV Channel** | enum | UV0 or UV1 |
| **Vertex Color** | boolean | Use vertex color |
| **Vertex Color Channel** | enum | R, G, B, or A |
| **Clear Coat Gloss** | texture | Clear coat smoothness map |
| **Glossiness** | float 0–1 | Clear coat smoothness value |
| **Invert** | boolean | Treat as roughness |
| **Clear Coat Normals** | texture | Clear coat normal detail |
| **Bumpiness** | float 0–2 | Clear coat normal strength |

### Sheen Section

| Property | Type | Description |
|----------|------|-------------|
| **Use Sheen** | boolean | Enable sheen effect (for fabric/cloth) |
| **Sheen** | texture | Sheen color map |
| **UV Channel** | enum | UV0 or UV1 |
| **Vertex Color** | boolean | Use vertex color |
| **Color** | color3 | Sheen tint |
| **Sheen Glossiness** | texture | Sheen smoothness map |
| **Glossiness** | float 0–1 | Sheen smoothness value |
| **Invert** | boolean | Treat as roughness |

### Refraction Section

| Property | Type | Description |
|----------|------|-------------|
| **Dynamic Refractions** | boolean | Enable real-time refraction |
| **Refraction** | texture | Refraction intensity map |
| **UV Channel** | enum | UV0 or UV1 |
| **Vertex Color** | boolean | Use vertex color |
| **Refraction** | float 0–1 | Light transmission amount |
| **Index Of Refraction** | float | IOR value (stored as 1.0/IOR) |
| **Dispersion** | float | Chromatic aberration amount |
| **Thickness** | texture | Volume density map |
| **Scale** | float | Thickness multiplier |
| **Attenuation** | color3 | Absorption color |
| **Attenuation Distance** | float | Distance for full absorption |

### Iridescence Section

| Property | Type | Description |
|----------|------|-------------|
| **Use Iridescence** | boolean | Enable thin-film iridescence |
| **Iridescence** | texture | Iridescence intensity map |
| **UV Channel** | enum | UV0 or UV1 |
| **Iridescence** | float 0–1 | Effect strength |
| **Iridescence Thickness** | texture | Film thickness map |
| **Thickness Minimum** | float | Minimum nanometers |
| **Thickness Maximum** | float | Maximum nanometers |
| **Index of Refraction** | float | Thin-film IOR |

### Environment Section

| Property | Type | Description |
|----------|------|-------------|
| **Sphere Map** | texture | Spherical environment map (alternative to cubemap) |
| **Cube Map** | texture | Environment reflection cubemap |
| **Reflectivity** | float 0–1 | Reflection visibility strength |
| **Projection** | enum | Normal or Box projection |
| **Center** | vec3 | Box projection center point |
| **Half Extents** | vec3 | Box projection dimensions |

### Lightmap Section

| Property | Type | Description |
|----------|------|-------------|
| **Lightmap** | texture | Baked lighting texture |
| **UV Channel** | enum | UV0 or UV1 (typically UV1) |
| **Color Channel** | enum | R, G, B, A, RGB |
| **Vertex Color** | boolean | Use vertex color for lightmap |

### Other Section

| Property | Type | Description |
|----------|------|-------------|
| **Depth Test** | boolean | Enable occlusion/depth checking |
| **Depth Write** | boolean | Write to depth buffer |
| **Cull Mode** | enum | None / Back Faces / Front Faces |
| **Use Fog** | boolean | Apply scene fog to this material |
| **Use Lighting** | boolean | Apply dynamic lighting |
| **Use Skybox** | boolean | Use environment/skybox reflections |
| **Use Tonemap** | boolean | Apply tone mapping |
| **Vertex Color Gamma** | boolean | Interpret vertex colors as sRGB |

---

## 9. Lighting

### Light Types (Light Component)

| Type | Description |
|------|-------------|
| **Directional** | Uniform-direction light (sun equivalent); affects entire scene from one direction |
| **Omni (Point)** | Emits in all directions from a point; full sphere of influence |
| **Spot** | Emits from a point but constrained to a cone shape |

### Light Source Shapes (non-punctual area lights)

| Shape | Description |
|-------|-------------|
| **Punctual** | Infinitesimally small point (default); lowest cost |
| **Rectangle** | Flat 4-sided shape with specified width and height |
| **Disk** | Round flat shape with specified radius |
| **Sphere** | Ball-shaped with specified radius |

Note: Non-punctual shapes require more rendering resources. Punctual recommended unless area reflections are needed.

### Light Component Properties

| Property | Type | Description |
|----------|------|-------------|
| **Type** | enum | Directional / Spot / Omni |
| **Color** | color3 | Emitted light color |
| **Intensity** | float 0–32 | Light brightness scalar |
| **Range** | float | (Omni/Spot only) Distance at which light contribution falls to zero |
| **Inner Cone Angle** | float | (Spot only) Degrees from spotlight direction where falloff begins |
| **Outer Cone Angle** | float | (Spot only) Degrees from spotlight direction where light falls to zero |
| **Cast Shadows** | boolean | Enable shadow casting from this light |
| **Resolution** | enum | Shadow map size: 16x16 to 4096x4096 |
| **Shadow Bias** | float | (PCF only) Bias to reduce shadow acne artifacts |
| **Normal Offset Bias** | float | (PCF only) Normal-based offset to reduce peter-panning |
| **Distance** | float | Maximum distance from camera where shadows render |
| **Shadow Intensity** | float 0–1 | Shadow darkness (0 = no shadow, 1 = fully dark) |
| **Cookie** | texture / cubemap | (Omni/Spot only) Projected texture from the light |
| **Cookie Intensity** | float 0–1 | Cookie texture strength |
| **Cookie Channel** | enum | R / G / B / A / RGB |
| **Cookie Angle** | float | (Spot only) Cookie projection angle |
| **Cookie Offset** | vec2 | Cookie texture offset |
| **Cookie Scale** | vec2 | Cookie texture scale |
| **Cookie Falloff** | float | Cookie intensity falloff |
| **Bake Lightmap** | boolean | Enable baking this light into lightmaps |
| **Bake Direction** | boolean | Include directional information in baked lightmaps |
| **Affect Dynamic** | boolean | Whether this light affects non-lightmapped (dynamic) objects |
| **Affect Lightmapped** | boolean | Whether this light affects lightmapped objects at runtime |
| **Layers** | layer array | Which rendering layers this light affects |
| **Falloff Mode** | enum | (Omni/Spot only) Linear or Inverse Squared attenuation |
| **Shadow Update Mode** | enum | Once or Realtime shadow updates |
| **Shadow Type** | enum | PCF variants (PCF1/PCF3/PCF5) or Variance Shadow Map (VSM) |
| **Static** | boolean | Mark light as static for optimization |
| **Bake Samples** | float 1–255 | Number of samples for lightmap baking |
| **Bake Area** | float 0–180 | Degree spread for soft baked shadows |
| **Affect Specularity** | boolean | (Directional only) Contributes to specular reflections |

### Shadow System Properties

| Property | Options/Range | Description |
|----------|--------------|-------------|
| **Shadow Type** | Shadow mapping | Cross-platform shadow algorithm |
| **Map Resolution** | 16×16 to 4096×4096 | Shadow map texture size (matches Light component Resolution range) |
| **Shadow Bias** | float | Prevents banding/shadow acne artifacts |
| **Normal Offset Bias** | float | Prevents shadow acne via normal-based offset |
| **Soft Shadows (PCF)** | 3×3 kernel | 9-sample Percentage Closest Filtering |
| **Hard Shadows** | 1 sample | Single shadow map sample |
| **Cascades** | 1 / 2 / 3 / 4 | Subdivisions of camera frustum for shadow resolution |
| **Cascade Distribution** | 0–1 | Linear (0) to logarithmic (1) cascade distribution |
| **Shadow Distance** | float | Max distance from camera for directional shadow rendering |
| **Shadow Intensity** | 0–1 | Per-light shadow darkness |
| **VSM Blur Mode** | enum | Gaussian / Box blur for VSM shadows |
| **VSM Blur Size** | int | Kernel size for VSM blur |
| **VSM Bias** | float | Bias specific to VSM shadow type |

### Ambient Lighting

Configured in Scene Settings:
- Global ambient color
- Skybox as ambient source (via cubemap)

### Lightmapping

- External: baked in 3DS Max, Maya, Blender; uploaded as texture assets; applied via Physical Material lightmap slot
- Runtime: built-in lightmap generation; baked before gameplay; preview directly in editor; triggered via Lightmapper toolbar button (Ctrl+B to re-bake)

### Clustered Lighting

| Setting | Description |
|---------|-------------|
| **Shadows support** | Enable/disable shadow computation in clustered renderer |
| **Cookie support** | Enable/disable cookie textures in clustered renderer |
| **Area lights support** | Enable/disable non-punctual area light shapes |
| **Cells** | 3D grid subdivision of the visible light bounding box |
| **Max Lights Per Cell** | Maximum overlapping lights per grid cell |
| **Shadow Atlas Resolution** | Size of the shadow map atlas texture |
| **Cookie Atlas Resolution** | Size of the cookie texture atlas |
| **Atlas Split** | Automatic (equal) or manual (array subdivisions like [2,2]) |
| **Shadow Types** | PCF1 / PCF3 / PCF5 |
| **Max visible lights** | 254 per frame (8-bit index storage) |

---

## 10. Camera Component Properties

| Property | Type | Description |
|----------|------|-------------|
| **Projection** | enum | Perspective or Orthographic |
| **Field of View** | float (degrees) | (Perspective only) Angle between top and bottom clip planes |
| **Ortho Height** | float (world units) | (Orthographic only) Distance between top and bottom clip planes |
| **Near Clip** | float | Distance from camera eye to near clip plane |
| **Far Clip** | float | Distance from camera eye to far clip plane |
| **Clear Color** | color4 | Color used to clear the render target before rendering |
| **Clear Color Buffer** | boolean | Whether to clear the color buffer before rendering |
| **Clear Depth Buffer** | boolean | Whether to clear the depth buffer before rendering |
| **Viewport** | rect (0–1 normalized) | Rectangle specifying which portion of the render target to render to |
| **Layers** | layer array | Which layers this camera renders (only matching mesh instances are rendered) |
| **Priority** | integer | Rendering order for multiple cameras; lower numbers render first |
| **Depth Grabpass** | boolean | Render scene depth to texture for shader access |
| **Color Grabpass** | boolean | Render scene color to texture for shader access |
| **Frustum Culling** | boolean | Only render visible mesh instances |
| **Tonemapping** | enum | Linear / Filmic / Hejl / ACES / ACES2 / Neutral |
| **Gamma** | enum | 1.0 or 2.2 gamma correction |

### Camera Notes

- At least one camera entity required in a scene to render anything
- Viewport supports split-screen: multiple cameras can each render to different viewport rects
- Camera entities can be selected in the viewport's camera mode dropdown to preview their view

---

## 11. Keyboard Shortcuts

### Camera Navigation (Viewport active)

| Shortcut | Action |
|----------|--------|
| Left Mouse Button + Drag | Orbit around scene |
| Middle Mouse Button + Drag | Pan view |
| Shift + Left Mouse Button + Drag | Pan view (alternate) |
| Right Mouse Button + Drag | Look around |
| Mouse Wheel | Zoom / dolly |
| W / A / S / D | Move camera |
| Shift + W / A / S / D | Move camera faster |

### Mouse Actions

| Shortcut | Action |
|----------|--------|
| Left Mouse Button | Select entity |
| Left Mouse Button + Drag | Transform entity with active gizmo |

### Entity & Scene Operations

| Shortcut | Action | Context |
|----------|--------|---------|
| Ctrl+Enter | Launch scene in new tab | General |
| Ctrl+E | Create new child entity | General |
| Ctrl+D | Duplicate selected entity (and children) | General |
| N or F2 | Rename selected entity or asset | General |
| Ctrl+C | Copy entity or asset | General |
| Ctrl+V | Paste entity or asset | General |
| Delete or Ctrl+Backspace | Delete selection | General |
| Ctrl+Z | Undo last action | General |
| Ctrl+Y or Ctrl+Shift+Z | Redo last action | General |
| Ctrl+B | Re-bake lighting | General |
| Shift+Z | Select previously selected items | General |
| Space | Hide / show all panels | General |
| Ctrl+Space | Toggle search toolbar | General |
| Shift+? | Display editor controls reference | General |

### Viewport-Specific Shortcuts

| Shortcut | Action |
|----------|--------|
| F | Focus viewport on selected entity |
| 1 | Activate translate gizmo |
| 2 | Activate rotate gizmo |
| 3 | Activate scale gizmo |
| L | Switch local / world space |
| Shift + (drag) | Toggle snap during gizmo operation |
| Ctrl + (while reparenting) | Disable world-space preservation |

*Note: On Mac, substitute Cmd for Ctrl throughout.*

---

## 12. Entity Components — All Types & Properties

### 12.1 Render Component

Renders 3D geometry at the entity's location.

| Property | Type | Description |
|----------|------|-------------|
| **Type** | enum | Asset / Box / Capsule / Cone / Cylinder / Plane / Sphere |
| **Asset** | render asset | Render asset to display (single assignment) |
| **Root Bone** | entity | (Skinned meshes) Entity serving as skeleton root |
| **Cast Shadows** | boolean | Cast shadows onto other mesh instances |
| **Cast Lightmap Shadows** | boolean | Cast shadows into lightmaps during baking |
| **Receive Shadows** | boolean | Receive shadows from other mesh instances |
| **Static** | boolean | Hint to engine for optimization (entity never moves) |
| **Lightmapped** | boolean | Use lightmap data instead of dynamic lights |
| **Lightmap Size Multiplier** | float | Adjust baked lighting resolution on this mesh |
| **Custom AABB** | boolean/vec3 | Manual bounding box for visibility culling |
| **Batch Group** | int | Batch group assignment for draw call batching |
| **Layers** | layer array | Which render layers display this mesh |
| **Materials** | material array | Per-mesh-instance material assignments |

### 12.2 Light Component

See Section 9 for all properties.

### 12.3 Camera Component

See Section 10 for all properties.

### 12.4 Script Component

Runs custom JavaScript on the entity.

| Feature | Description |
|---------|-------------|
| **Add script** | Dropdown to select existing scripts or type name to create new |
| **Drag-and-drop** | Drag script assets from Assets panel onto the Script component |
| **Script attributes** | Custom-defined attributes appear in Inspector; types: boolean, number, string, vec2/3/4, rgb/rgba color, asset, entity, curve, JSON |
| **Execution order** | Multiple scripts execute top-to-bottom in listed order; reorder via drag |
| **Enable/disable** | Per-script toggle |
| **Edit button** | Opens Code Editor for that script |
| **Parse** | Refresh attribute definitions after code changes |
| **Remove** | Remove individual script (X button) |

### 12.5 Collision Component

Assigns a collision volume to the entity for physics.

| Property | Type | Description |
|----------|------|-------------|
| **Type** | enum | Box / Sphere / Capsule / Cylinder / Cone / Mesh / Compound |
| **Half Extents** | vec3 | (Box only) Half-extents of collision box |
| **Radius** | float | (Sphere/Capsule/Cylinder/Cone) Shape radius |
| **Height** | float | (Capsule/Cylinder/Cone) Shape height |
| **Axis** | enum | (Capsule/Cylinder/Cone) Align with local X / Y / Z |
| **Model Asset** | model asset | (Mesh only) Source model for collision mesh |
| **Render Asset** | render asset | (Mesh only) Alternative source (mutually exclusive with Model Asset) |
| **Convex Hull** | boolean | (Mesh only) Treat as convex hull for dynamic bodies |
| **Position Offset** | vec3 | Positional offset relative to entity |
| **Rotation Offset** | vec3 | Rotational offset in degrees |

### 12.6 Rigid Body Component

Adds entity to physics simulation.

| Property | Type | Description |
|----------|------|-------------|
| **Type** | enum | Static / Dynamic / Kinematic |
| **Mass** | float (kg) | (Dynamic only) Body mass in kilograms |
| **Linear Damping** | float 0–1 | (Dynamic only) Proportion of linear velocity lost per second |
| **Angular Damping** | float 0–1 | (Dynamic only) Proportion of angular velocity lost per second |
| **Linear Factor** | vec3 | (Dynamic only) Per-axis movement control (0 = locked) |
| **Angular Factor** | vec3 | (Dynamic only) Per-axis rotation control (0 = locked) |
| **Friction** | float 0–1 | Velocity loss when in contact with other bodies |
| **Restitution** | float 0–1 | Bounciness of the body |

### 12.7 Anim Component

Plays animations via a state graph.

| Property | Type | Description |
|----------|------|-------------|
| **State Graph** | animstategraph asset | Animation state machine definition |
| **Animation Assets** | asset slots (per layer) | Connect animation clips to state graph states |
| **Activate** | boolean | Auto-play on scene launch |
| **Speed** | float 0–2 | Playback speed multiplier for all animations |
| **Root Bone** | entity | Optional entity to use as skeleton root |
| **Normalize Weights** | boolean | Normalize layer weights to sum to 1 |
| **Layer Masks** | bone masks | Limit which skeleton bones each layer affects |

### 12.8 Sound Component

Plays audio from the entity's location.

**Component-level properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Positional** | boolean | Enable 3D spatial audio |
| **Volume** | float 0–1 | Master volume multiplier for all slots |
| **Pitch** | float | Playback speed multiplier (1 = original pitch) |
| **Ref Distance** | float | (Positional) Reference distance for volume reduction |
| **Max Distance** | float | (Positional) Distance where falloff stops |
| **Distance Model** | enum | (Positional) Linear / Exponential / Inverse |
| **Roll-off Factor** | float | (Positional) Rate of volume falloff |

**Per-slot properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Name** | string | Identifier for script reference |
| **Asset** | audio asset | Audio file to play |
| **Start Time** | float (seconds) | Beginning point in audio file |
| **Duration** | float (seconds) | Length to play (blank = play to end) |
| **Auto Play** | boolean | Play on scene load |
| **Overlap** | boolean | Allow simultaneous instances |
| **Loop** | boolean | Loop continuously |
| **Volume** | float 0–1 | Slot volume |
| **Pitch** | float | Slot playback speed |

### 12.9 Particle System Component

Emits and simulates particles.

| Property | Type | Description |
|----------|------|-------------|
| **Particle Count** | int | Maximum particles managed simultaneously |
| **Lifetime** | float (seconds) | Duration from particle birth to death |
| **Emission Rate** | float | Min interval (seconds) between spawns |
| **Emission Rate 2** | float | Max interval; random value chosen between Rate 1 and Rate 2 |
| **Start Angle** | float (degrees) | Min initial rotation |
| **Start Angle 2** | float (degrees) | Max initial rotation |
| **Local Velocity** | curve | Velocity relative to emitter's local space |
| **Velocity** | curve | Velocity in world space |
| **Radial Speed** | curve | Outward velocity from emitter center |
| **Scale** | curve | Particle size over lifetime |
| **Color** | curve | Color changes over lifetime |
| **Opacity** | curve | Transparency over lifetime |
| **Rotation Speed** | curve | Angular velocity over lifetime |
| **Emitter Shape** | enum | Box or Sphere |
| **Emitter Extents / Radius** | vec3 / float | Spatial bounds for spawning |
| **Inner Extents / Radius** | vec3 / float | Inner boundary for spawn zone (hollow emitter) |
| **Auto Play** | boolean | Start on creation |
| **Loop** | boolean | Continuous vs. single burst |
| **Pre Warm** | boolean | Initialize as if already cycled (looping only) |
| **Blend Type** | enum | Alpha / Additive / Multiply |
| **Depth Write** | boolean | Write to depth buffer |
| **Softening** | float | Fade particles near surfaces |

### 12.10 Element Component (UI)

Defines a UI element (text, image, or layout group).

**Common properties (all types):**

| Property | Type | Description |
|----------|------|-------------|
| **Type** | enum | Group / Image / Text |
| **Preset** | enum | Layout presets for anchor + pivot |
| **Anchor** | vec4 | Position reference point within parent |
| **Pivot** | vec2 | (0,0 = bottom-left, 1,1 = top-right) |
| **Width / Height** | float (pixels) | Element dimensions |
| **Margin** | vec4 (L/B/R/T) | Distance from element edges to anchor |
| **Use Input** | boolean | Enable input event detection |
| **Batch Group** | int | Rendering batch assignment |
| **Layers** | layer array | Render layer assignment |

**Text-specific properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Font** | font asset | Font for text rendering |
| **Text** | string | Content to display |
| **Font Size** | float (pixels) | Text size |
| **Min / Max Font Size** | float | Auto-fit range |
| **Color** | color3 | Text tint |
| **Opacity** | float 0–1 | Transparency |
| **Alignment** | enum | Text alignment within bounds |
| **Line Height** | float | Vertical line spacing |
| **Wrap Lines** | boolean | Enable word wrapping |
| **Max Lines** | int | Maximum lines before clipping |
| **Spacing** | float | Character spacing multiplier |
| **Outline Color / Thickness** | color + float | Text border |
| **Shadow Color / Offset** | color + vec2 | Drop shadow |
| **Auto Width / Height** | boolean | Auto-size based on content |

**Image-specific properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Color** | color3 | Tint color |
| **Opacity** | float 0–1 | Transparency |
| **Texture / Sprite / Material** | asset | Image source (mutually exclusive) |
| **Rect** | vec4 (normalized UV) | UV coordinates for texture display |
| **Frame** | int | Sprite frame index |
| **Fit Mode** | enum | Stretch / Contain / Cover |
| **Mask** | boolean | Limit child rendering to element bounds |

### 12.11 Sprite Component

Renders 2D images at the entity's location.

**Simple sprite properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Type** | enum | Simple or Animated |
| **Sprite** | sprite asset | Sprite asset to display |
| **Frame** | int | Frame index to display |
| **Color** | color3 | Tint color |
| **Opacity** | float 0–1 | Transparency |
| **Flip X** | boolean | Horizontal flip |
| **Flip Y** | boolean | Vertical flip |
| **Batch Group** | int | Batch group assignment |
| **Layers** | layer array | Render layers |
| **Draw Order** | int | Render order within layer (lower = renders first) |

**Animated sprite additional properties:**

| Property | Type | Description |
|----------|------|-------------|
| **Speed** | float | Animation clip playback speed multiplier |
| **Auto Play** | string | Which clip to auto-play on enable |

### 12.12 Screen Component (UI Root)

Defines the rendering space for UI elements.

| Property | Type | Description |
|----------|------|-------------|
| **Screen Space** | boolean | Render as 2D overlay (vs. world-space UI) |
| **Resolution** | vec2 | (Non-screen-space) Screen coordinate dimensions |
| **Ref Resolution** | vec2 | Reference resolution for Blend scale mode |
| **Scale Mode** | enum | None (no scaling) / Blend |
| **Scale Blend** | float 0–1 | Horizontal (0) vs. vertical (1) weighting in Blend mode |
| **Priority** | int 0–127 | Render order among Screen components in same layer |

### 12.13 GSplat Component

Renders a 3D Gaussian Splat.

| Property | Type | Description |
|----------|------|-------------|
| **Asset** | gsplat asset | GSplat asset to render (single assignment) |
| **Layers** | layer array | Which render layers to render into |

### 12.14 Audio Listener Component

Specifies where the listener is for 3D audio. No configurable properties beyond enable/disable.

### 12.15 Button Component

Creates a UI button. Part of the UI system (used with Element, Screen, Script components).

### 12.16 Layout Child Component

Overrides default Layout Group properties for a single element within a Layout Group.

### 12.17 Layout Group Component

Automatically sets position and scale of child UI elements (auto-layout container).

### 12.18 Scrollbar Component

Defines a scrolling control for use with a Scroll View component.

### 12.19 Scroll View Component

Defines a scrollable area in a user interface.

### 12.20 Deprecated Components (do not use in new projects)

- **Animation (Legacy)** — replaced by Anim component
- **Model (Legacy)** — replaced by Render component

---

## 13. Layer System

| Concept | Description |
|---------|-------------|
| **Layer** | A list of meshes to render; divided into Opaque and Transparent sub-layers |
| **Layer Composition** | `pc.LayerComposition` — sequences all sub-layers for the render pipeline |
| **Camera Priority** | Lower camera priority values render first |
| **Sort modes** | Material/Mesh (default opaque), Back-to-Front (default transparent), Front-to-Back, Manual, None |
| **Draw Bucket** | `drawBucket` property (0–255, default 127) for coarse sorting |
| **Component layer assignment** | All render components (Render, Element, Sprite, Particle System) and cameras/lights have `layers` properties |

**Default layer stack (7 layers):**
1. World — Opaque
2. Depth — Opaque
3. Skybox — Opaque
4. World — Transparent
5. Immediate — Opaque
6. Immediate — Transparent
7. UI — Transparent

---

## 14. Asset Inspectors (Non-Material)

### Texture Inspector

| Property | Description |
|----------|-------------|
| **Filtering** | Point (no filtering) or Linear (interpolated) |
| **Anisotropy** | 1–16; improves oblique-angle texture quality |
| **Texture Addressing** | How coordinates outside 0–1 range are sampled (wrap, clamp, mirror, etc.) |

### Cubemap Inspector

| Property | Description |
|----------|-------------|
| **Filtering** | Magnification interpolation mode |
| **Anisotropy** | 1–16; oblique-angle sampling quality |
| **Face Textures** | Six texture slots for cubemap faces (shown in cross layout preview) |

---

## 15. Post Effects

### Modern Post Processing (built-in, HDR-aware)

- HDR physically-based Bloom
- Screen Space Ambient Occlusion (SSAO)
- Depth of Field (DoF)
- Temporal Anti-Aliasing (TAA)
- Color grading and LUT support
- Vignette
- Fringing (chromatic aberration)

### Legacy Post Effects (script-based)

- Bloom
- Brightness-Contrast
- Hue-Saturation
- FXAA (Fast Approximate Anti-Aliasing)
- Sepia
- Vignette

Post effects are attached to Camera entities via the post effects pipeline.

---

## 16. Collaboration Features

| Feature | Description |
|---------|-------------|
| **Real-time multi-user** | Multiple developers work simultaneously on the same scene |
| **Viewport camera visibility** | See other users' viewport cameras and active selections |
| **Built-in chat** | In-editor chat between collaborators |
| **Live-link (Launch Page)** | All collaborators' changes update the running app in real-time |

---

## 17. Publishing

| Target | Description |
|--------|-------------|
| **Web (hosted)** | Publish directly to hosted environment |
| **Web (self-hosted)** | Download build for self-hosting |
| **Mobile — iOS/Android** | Export for mobile platforms |
| **Desktop — Windows/macOS/Linux** | Desktop export |
| **Playable Ads** | Advertising format export |

---

## Relevant to Fork Audit (ONEMO 3D Studio)

This document is the definitive yardstick for auditing the ONEMO 3D Studio fork of the source editor with R3F rendering engine replacement. Key areas where the fork diverges from the source editor and must be verified:

1. **Viewport rendering** — R3F/Three.js replaces the source engine renderer; all gizmos, debug render modes, and camera controls must work against R3F
2. **Material inspector** — Full Standard Material property set (all 15 sections above) must be preserved; property bindings connect to Three.js/R3F materials instead of source engine materials
3. **Light component** — Light types, shadow settings, and cookie properties must map to Three.js lights
4. **Camera component** — All properties must connect to R3F camera system
5. **Scene settings (fog, ambient, skybox)** — Must connect to R3F scene configuration
6. **Render component** — Primitive types and render asset handling must work with R3F mesh system
7. **Post effects** — Modern HDR pipeline and legacy effects must connect to R3F post-processing
8. **Layer system** — Default layer stack must be preserved or mapped to R3F render order
9. **Keyboard shortcuts** — All 25+ shortcuts must function correctly in the forked editor
10. **Asset pipeline (23 types)** — All asset types must remain functional; Render/Material/Texture/Cubemap import paths are highest priority
