// AdminViewer — loads scene config from .onemo template file.
// No hardcoded defaults. Everything flows from the .onemo file.

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSceneStore } from './sceneStore'
import { parseOnemoConfig, type ParsedOnemoConfig } from '../core/onemo-loader'
import type { DesignState, ViewerConfig } from '../types'

const TEMPLATE_URL = '/api/dev/scenes/golden'

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
  templateUrl?: string
  children: (config: ViewerConfig, assetProps: AssetProps, materialPanels: React.ReactNode) => React.ReactNode
}

export default function AdminViewer({
  templateUrl = TEMPLATE_URL,
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

    parseOnemoConfig(templateUrl).then((parsed) => {
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
  }, [setBgColor, templateUrl])

  const config = useMemo<ViewerConfig | null>(() => {
    if (!templateConfig) {
      return null
    }

    const mergedColors = {
      ...templateConfig.config.colors,
      ...colors,
    }

    return {
      ...templateConfig.config,
      colors: mergedColors,
      product: {
        ...templateConfig.config.product,
        materialRoles: templateConfig.config.product.materialRoles.map((role) => {
          const color =
            role.role === 'back' ? mergedColors.backColor :
            role.role === 'frame' ? mergedColors.frameColor :
            undefined

          if (!color) {
            return role
          }

          return {
            ...role,
            defaults: {
              ...role.defaults,
              color,
            },
          }
        }),
      },
    }
  }, [colors, templateConfig])

  if (error) {
    return <div style={{ color: 'red', padding: 20 }}>Failed to load scene template: {error}</div>
  }

  if (!templateConfig || !config) {
    return <div style={{ color: '#888', padding: 20 }}>Loading scene...</div>
  }

  const assetProps: AssetProps = {
    modelPath: config.modelPath,
    hdriPath: config.environment?.preset ?? 'studio',
    onModelChange: () => {},
    onHdriChange: () => {},
  }

  return <>{children(config, assetProps, null)}</>
}
