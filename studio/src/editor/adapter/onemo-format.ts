/**
 * ONEMO Scene Format — Type Definitions
 *
 * A `.onemo` file is a ZIP containing:
 *   scene.glb       — Three.js scene graph via GLTFExporter (geometry, materials, lights, cameras, animations)
 *   studio.json     — renderer settings, environment, editor state, product mappings (this schema)
 *   environment.hdr — environment map file (optional, referenced by studio.json)
 *
 * DEC S42-SCENE: Three.js scene graph is the single source of truth.
 * The GLB handles ~90% of scene data. studio.json handles the rest.
 */

// ─── Format version ───────────────────────────────────────────────

export const ONEMO_FORMAT_VERSION = 1;

export type OnemoColorValue = string | [number, number, number];

const clampColorChannel = (value: number) => {
    return Math.max(0, Math.min(1, value));
};

export const onemoColorToHex = (value: OnemoColorValue, fallback = '#000000') => {
    if (Array.isArray(value)) {
        return `#${value
        .slice(0, 3)
        .map((channel) => {
            return Math.round(clampColorChannel(Number(channel ?? 0)) * 255).toString(16).padStart(2, '0');
        })
        .join('')}`;
    }

    return typeof value === 'string' && value ? value : fallback;
};

// ─── studio.json schema ──────────────────────────────────────────

/**
 * Renderer settings that GLB/glTF does not store.
 * These are WebGLRenderer-level properties, not scene-level.
 */
export interface OnemoRendererSettings {
    /** THREE.ToneMapping enum value. 0=No, 1=Linear, 2=Reinhard, 3=Cineon, 4=ACES, 6=AgX, 7=Neutral */
    toneMapping: number;
    /** Exposure level for tone mapping. Default 1.0 */
    toneMappingExposure: number;
    /** THREE.ColorSpace. 'srgb' or 'srgb-linear' */
    outputColorSpace: string;
    /** Enable shadow maps */
    shadowsEnabled: boolean;
    /** THREE.ShadowMapType enum. 0=Basic, 1=PCF, 2=PCFSoft, 3=VSM */
    shadowType: number;
}

/**
 * Environment configuration.
 * The actual HDR file is in the ZIP as environment.hdr (or .exr).
 * This config describes how to apply it.
 */
export interface OnemoEnvironmentSettings {
    /** Filename of the environment file in the ZIP (e.g., 'environment.hdr') or null if using preset */
    file: string | null;
    /** drei Environment preset name as fallback if no file (e.g., 'studio', 'city', 'sunset') */
    preset: string | null;
    /** Environment map intensity. Default 1.0 */
    intensity: number;
    /** Y-axis rotation in degrees. Default 0 */
    rotation: number;
    /** Ground plane projection */
    ground: {
        enabled: boolean;
        height: number;
        radius: number;
    };
}

/**
 * Scene background and atmosphere settings.
 */
export interface OnemoSceneSettings {
    /** CSS hex color or raw float RGB tuple for viewport/canvas background. */
    backgroundColor: OnemoColorValue;
    /** Fog type: 'none' | 'linear' | 'exponential' */
    fog: 'none' | 'linear' | 'exponential';
    /** Fog color as hex. e.g., '#000000' */
    fogColor: string;
    /** Fog start distance (linear fog) */
    fogNear: number;
    /** Fog end distance (linear fog) */
    fogFar: number;
    /** Fog density (exponential fog) */
    fogDensity: number;
    /** Ambient light color as [r, g, b] normalized 0-1 */
    ambientColor: [number, number, number];
    /** Ambient light intensity */
    ambientIntensity: number;
}

/**
 * Editor camera state — where the camera was when the scene was saved.
 * Used to restore the editor viewport, not the in-scene cameras.
 */
export interface OnemoEditorCamera {
    /** Camera position [x, y, z] */
    position: [number, number, number];
    /** OrbitControls target [x, y, z] */
    target: [number, number, number];
    /** Field of view in degrees */
    fov: number;
    /** Near clipping plane */
    near: number;
    /** Far clipping plane */
    far: number;
}

/**
 * Material role mapping — connects mesh names in the GLB to product roles.
 * This is the product-level layer that makes the generic 3D scene into a configurable product.
 *
 * The GLB contains meshes with names (from the GLTF node names).
 * This mapping says: "the mesh named 'PRINT_SURFACE_FRONT' is the 'face' material role."
 * The configurator uses roles to know which controls affect which meshes.
 */
export interface OnemoMaterialRole {
    /** Role identifier: 'face' | 'back' | 'frame' | custom string */
    role: string;
    /** Mesh name(s) in the GLB that this role applies to. Supports glob patterns. */
    meshNames: string[];
    /** Default material overrides for this role (applied on top of GLB material) */
    defaults?: {
        color?: string;
        roughness?: number;
        metalness?: number;
        envMapIntensity?: number;
        normalScale?: number;
        bumpScale?: number;
        clearcoat?: number;
        clearcoatRoughness?: number;
        sheen?: number;
        sheenColor?: string;
        sheenRoughness?: number;
    };
    /** Default texture paths for this role */
    textures?: {
        map?: string;
        normalMap?: string;
        roughnessMap?: string;
        bumpMap?: string;
        sheenColorMap?: string;
        [key: string]: string | undefined;
    };
    /** Whether this role is user-configurable in the product configurator */
    configurable: boolean;
    /** Which properties the user can change (empty = all configurable properties) */
    configurableProperties?: string[];
}

/**
 * Product configuration — the product-level metadata that sits on top of the 3D scene.
 */
export interface OnemoProductConfig {
    /** Product type identifier (e.g., 'effect-70mm', 'effect-100mm') */
    productType: string;
    /** Material role mappings */
    materialRoles: OnemoMaterialRole[];
    /** Which artwork slot exists and what mesh it maps to */
    artworkSlot?: {
        /** Mesh name that receives the artwork texture */
        meshName: string;
        /** Material role this artwork belongs to */
        role: string;
        /** Default artwork URL (placeholder) */
        defaultUrl?: string;
        /** Texture channel for artwork ('map' = diffuse) */
        textureChannel: string;
    };
}

/**
 * The complete studio.json schema.
 * Everything that GLB doesn't store goes here.
 */
export interface OnemoStudioJson {
    /** Format version for migration support */
    version: typeof ONEMO_FORMAT_VERSION;
    /** When the file was created */
    created: string;
    /** When the file was last modified */
    modified: string;
    /** Human-readable scene name */
    name: string;
    /** Renderer settings */
    renderer: OnemoRendererSettings;
    /** Environment map configuration */
    environment: OnemoEnvironmentSettings;
    /** Scene background and atmosphere */
    scene: OnemoSceneSettings;
    /** Editor camera state at save time */
    editorCamera: OnemoEditorCamera;
    /** Product-level configuration (material roles, artwork slot, configurator mappings) */
    product: OnemoProductConfig;
    /**
     * GLB material overrides — properties that GLTFExporter can't export yet.
     * Keyed by material name in the GLB.
     * Applied after GLTFLoader to patch known exporter gaps (e.g., anisotropy until exporter support lands).
     */
    materialOverrides?: Record<string, Record<string, unknown>>;
}

// ─── User configuration schema (database JSON) ──────────────────

/**
 * A single material override from the user configurator.
 * Only stores the delta from the template defaults.
 */
export interface OnemoUserMaterialOverride {
    /** Which role this override applies to */
    role: string;
    /** Color override (hex) */
    color?: string;
    /** Any material property overrides */
    [key: string]: unknown;
}

/**
 * User design configuration — stored in the database, NOT in files.
 * References a template and stores only the user's changes.
 */
export interface OnemoUserConfig {
    /** Unique design ID */
    id: string;
    /** User ID */
    userId: string;
    /** Template ID (references the .onemo file) */
    templateId: string;
    /** When created */
    createdAt: string;
    /** When last modified */
    modifiedAt: string;
    /** Material overrides per role */
    materials: OnemoUserMaterialOverride[];
    /** Artwork configuration */
    artwork?: {
        url: string;
        position: { x: number; y: number };
        scale: number;
        rotation: number;
    };
}

// ─── Defaults ────────────────────────────────────────────────────

export const DEFAULT_RENDERER_SETTINGS: OnemoRendererSettings = {
    toneMapping: 7, // NeutralToneMapping (THREE.NeutralToneMapping = 7)
    toneMappingExposure: 0.7,
    outputColorSpace: 'srgb',
    shadowsEnabled: false,
    shadowType: 2 // PCFSoftShadowMap
};

export const DEFAULT_ENVIRONMENT: OnemoEnvironmentSettings = {
    file: 'environment.hdr',
    preset: 'studio',
    intensity: 1.0,
    rotation: 0,
    ground: {
        enabled: false,
        height: 0,
        radius: 20
    }
};

export const DEFAULT_SCENE_SETTINGS: OnemoSceneSettings = {
    backgroundColor: '#ffffff',
    fog: 'none',
    fogColor: '#000000',
    fogNear: 1,
    fogFar: 1000,
    fogDensity: 0.01,
    ambientColor: [0.15, 0.15, 0.15],
    ambientIntensity: 0.5
};

export const DEFAULT_EDITOR_CAMERA: OnemoEditorCamera = {
    position: [0, 0.03, 0.2],
    target: [0, 0, 0],
    fov: 35,
    near: 0.001,
    far: 100
};

export const DEFAULT_PRODUCT_CONFIG: OnemoProductConfig = {
    productType: 'effect-70mm',
    materialRoles: [
        {
            role: 'face',
            meshNames: ['PRINT_SURFACE_FRONT', 'Face', 'face'],
            defaults: {
                color: '#ffffff',
                roughness: 1,
                metalness: 0,
                envMapIntensity: 0.1,
                normalScale: 0.15,
                bumpScale: 1,
                sheen: 1,
                sheenColor: '#1a1a1a',
                sheenRoughness: 0.8
            },
            textures: {
                normalMap: '/assets/materials/ultrasuede/suede-normal.png',
                roughnessMap: '/assets/materials/ultrasuede/suede-roughness.jpg',
                bumpMap: '/assets/materials/ultrasuede/suede-height.png'
            },
            configurable: true,
            configurableProperties: ['color', 'artwork']
        },
        {
            role: 'back',
            meshNames: ['BACK', 'Back', 'back'],
            defaults: {
                color: '#080808',
                roughness: 1,
                envMapIntensity: 0.1,
                normalScale: 0.15,
                bumpScale: 1,
                sheen: 1,
                sheenColor: '#1a1a1a',
                sheenRoughness: 0.8
            },
            textures: {
                normalMap: '/assets/materials/ultrasuede/suede-normal.png',
                roughnessMap: '/assets/materials/ultrasuede/suede-roughness.jpg',
                bumpMap: '/assets/materials/ultrasuede/suede-height.png'
            },
            configurable: true,
            configurableProperties: ['color']
        },
        {
            role: 'frame',
            meshNames: ['FRAME', 'Frame', 'frame'],
            defaults: {
                color: '#0f0f0f',
                roughness: 0.5,
                metalness: 0,
                clearcoat: 0.4,
                clearcoatRoughness: 0.3
            },
            configurable: true,
            configurableProperties: ['color']
        }
    ],
    artworkSlot: {
        meshName: 'PRINT_SURFACE_FRONT',
        role: 'face',
        defaultUrl: '/assets/test-artwork.png',
        textureChannel: 'map'
    }
};
