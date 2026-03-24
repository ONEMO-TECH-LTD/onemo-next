// Fetch available assets from the filesystem API
// Returns options objects ready for Leva dropdowns

'use client'

import { useState, useEffect } from 'react'

interface AssetOptions {
  models: Record<string, string>     // display name → path
  materialSets: Record<string, string>  // display name → set name
  materialTextures: Record<string, { normal?: string; roughness?: string; height?: string; sheenColor?: string }>
  hdris: Record<string, string>      // display name → path
  loaded: boolean
}

const DEFAULT: AssetOptions = {
  models: { 'Effect 70mm Step': '/assets/shapes/effect-70mm-step.glb' },
  materialSets: { 'Ultrasuede': 'ultrasuede' },
  materialTextures: {
    ultrasuede: {
      normal: '/assets/materials/ultrasuede/suede-normal.png',
      roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
      height: '/assets/materials/ultrasuede/suede-height.png',
    },
  },
  hdris: { 'studio (preset)': 'studio' },
  loaded: false,
}

export function useAssets(): AssetOptions {
  const [assets, setAssets] = useState<AssetOptions>(DEFAULT)

  useEffect(() => {
    async function load() {
      try {
        const [modelsRes, materialsRes, hdrisRes] = await Promise.all([
          fetch('/api/dev/assets?type=shapes'),
          fetch('/api/dev/assets?type=materials'),
          fetch('/api/dev/assets?type=env'),
        ])

        const modelsData = await modelsRes.json()
        const materialsData = await materialsRes.json()
        const hdrisData = await hdrisRes.json()

        // Build model options
        const models: Record<string, string> = {}
        for (const m of modelsData.models || []) {
          models[m.name] = m.path
        }

        // Build material set options + texture lookup
        const materialSets: Record<string, string> = {}
        const materialTextures: Record<string, { normal?: string; roughness?: string; height?: string; sheenColor?: string }> = {}
        for (const m of materialsData.materials || []) {
          materialSets[m.name] = m.name
          materialTextures[m.name] = m.textures
        }

        // Build HDRI options — include drei presets + custom EXR files
        const hdris: Record<string, string> = {
          'studio (preset)': 'studio',
          'city (preset)': 'city',
          'sunset (preset)': 'sunset',
          'dawn (preset)': 'dawn',
          'night (preset)': 'night',
          'warehouse (preset)': 'warehouse',
          'forest (preset)': 'forest',
          'apartment (preset)': 'apartment',
          'park (preset)': 'park',
          'lobby (preset)': 'lobby',
        }
        for (const h of hdrisData.hdris || []) {
          hdris[`${h.name} (custom)`] = h.path
        }

        setAssets({ models, materialSets, materialTextures, hdris, loaded: true })
      } catch {
        // Keep defaults on error
        setAssets((prev) => ({ ...prev, loaded: true }))
      }
    }

    load()
  }, [])

  return assets
}
