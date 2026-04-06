# 11 — Gen AI Integration Hooks

> Three integration points wired in the architecture, built later.
> AI is a translator and content engine, not the renderer or primary UI.

## Phase: [v5]

## Principle [v5]

From Session 37 + GPT Pro AI Configurator review:

- **AI = translator, not renderer.** Build a deterministic configurator first. AI sits on top.
- **Config object = source of truth.** The DesignSession drives everything. AI writes to it via typed actions.
- **Don't make chat the primary UI.** Make it a sidecar assistant.

## Hook 1: Video Texture ("Image Comes Alive") [v5]

After design finishes, AI generates a short animation of the artwork content.

```typescript
const videoTexture = new THREE.VideoTexture(videoElement)
faceMaterial.map = videoTexture
```

Standard Three.js — no architecture change. Product module already manages the face texture.

**Pipeline:**
```
DesignSession → Job Queue → AI Provider (Veo 3 / Kling) → GeneratedMedia → CDN
```

Independent of the viewer. `domain/generated-media.ts` schema (empty for v1-v4).

## Hook 2: AI Intent Parsing [v5]

Natural language → typed configuration actions:

```
User: "make it blue"
  → AI parser (Gemini 2.5 Flash)
  → SET_ZONE_COLOR { zone: "face", color: "#1a3a6b" }
  → Rules validator (rejects illegal combinations)
  → DesignSession update
  → Viewer re-renders
```

Action types:
- `SET_ZONE_COLOR` — change surface color
- `SET_MATERIAL` — change surface material
- `APPLY_DECAL` — position artwork
- `SUGGEST_PATTERN` — generate pattern for surface

## Hook 3: Render Factory for Content [v5]

Dedicated render pages produce AI-generated content:
- Social-media-ready product shots
- Dynamic storefront imagery
- Video captures from 3D viewport

Same render factory as preview generation (see [07-preview-render-factory.md](07-preview-render-factory.md)), extended with:
- Video capture mode (frame sequence → MP4)
- Multiple scene/lighting setups per design
- AI-suggested camera angles
