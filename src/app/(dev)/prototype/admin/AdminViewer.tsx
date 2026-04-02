// AdminViewer — loads scene config from .onemo template file.
// No hardcoded defaults. Everything flows from the .onemo file.

'use client'

import { useState, useEffect, useRef } from 'react'
import { useSceneStore } from './sceneStore'
import { parseOnemoConfig, type ParsedOnemoConfig } from '../core/onemo-loader'
import type { DesignState, ViewerConfig } from '../types'

const TEMPLATE_URL = '/assets/templates/effect-70mm.onemo'

export interface AssetProps {
  modelPath: string
  hdriPath: string
  onModelChange: (path: string) => void
  onHdriChange: (path: string) => void
}

interface AdminViewerProps {
  artworkUrl?: string
  designState: DesignState
  isEditing: boolean
  onTextureChange?: (path: string) => void
  children: (config: ViewerConfig, assetProps: AssetProps, materialPanels: React.ReactNode) => React.ReactNode
}

export default function AdminViewer({
  children,
}: AdminViewerProps) {
  const colors = useSceneStore((s) => s.colors)
  const setBgColor = useSceneStore((s) => s.setBgColor)
  const [templateConfig, setTemplateConfig] = useState<ParsedOnemoConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Load .onemo template on mount
  useEffect(() => {
    let cancelled = false

    parseOnemoConfig(TEMPLATE_URL).then((parsed) => {
      if (cancelled) {
        URL.revokeObjectURL(parsed.modelBlobUrl)
        return
      }
      blobUrlRef.current = parsed.modelBlobUrl
      setTemplateConfig(parsed)
      // Sync bgColor to the store so the page background matches
      setBgColor(parsed.config.colors.bgColor)
    }).catch((err) => {
      if (!cancelled) {
        console.error('Failed to load .onemo template:', err)
        setError(String(err))
      }
    })

    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [setBgColor])

  if (error) {
    return <div style={{ color: 'red', padding: 20 }}>Failed to load scene template: {error}</div>
  }

  if (!templateConfig) {
    return <div style={{ color: '#888', padding: 20 }}>Loading scene...</div>
  }

  // Override colors from the store (user can change colors via ColorPanel)
  const config: ViewerConfig = {
    ...templateConfig.config,
    colors: {
      ...templateConfig.config.colors,
      ...colors,
    },
  }

  const assetProps: AssetProps = {
    modelPath: config.modelPath,
    hdriPath: config.environment?.preset ?? 'studio',
    onModelChange: () => {},
    onHdriChange: () => {},
  }

  return <>{children(config, assetProps, null)}</>
}
