// Injects small "Browse" buttons next to Leva dropdown controls
// for asset selection (models, HDRIs, textures).
// Each button opens a native file picker, uploads the file, and reloads.

'use client'

import { useEffect } from 'react'
import { browseAndUpload } from './browseFile'

const STYLE_ID = 'leva-browse-style'
const BROWSE_CLASS = 'leva-browse-btn'

interface BrowseConfig {
  label: string           // Leva control label to attach to (e.g., "normalMap")
  type: 'shapes' | 'env' | 'materials'
  accept: string
  slot?: string
}

const BROWSE_TARGETS: BrowseConfig[] = [
  { label: 'model', type: 'shapes', accept: '.glb,.gltf' },
  { label: 'hdri', type: 'env', accept: '.exr,.hdr,.hdri' },
  { label: 'normalMap', type: 'materials', accept: 'image/*', slot: 'normal' },
  { label: 'roughnessMap', type: 'materials', accept: 'image/*', slot: 'roughness' },
  { label: 'heightMap', type: 'materials', accept: 'image/*', slot: 'height' },
  { label: 'sheenMap', type: 'materials', accept: 'image/*', slot: 'sheen' },
]

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .${BROWSE_CLASS} {
      background: #555;
      color: #fff;
      border: none;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 9px;
      cursor: pointer;
      margin-left: 4px;
      flex-shrink: 0;
      line-height: 1;
    }
    .${BROWSE_CLASS}:hover {
      background: #777;
    }
  `
  document.head.appendChild(style)
}

function findLevaRow(labelText: string): HTMLElement | null {
  const labels = document.querySelectorAll('label[class*="leva-c-"]')
  for (const el of labels) {
    if (el.textContent?.trim() === labelText) {
      // The row is the grandparent container that holds label + control
      return el.closest('[class*="leva-c-bDGmTT"]') as HTMLElement | null
    }
  }
  return null
}

export function useLevaBrowse() {
  useEffect(() => {
    ensureStyle()

    // Small delay to let Leva render its DOM
    const timer = setTimeout(() => {
      // Find all Leva label elements and match them to browse targets
      const labels = document.querySelectorAll('label[class*="leva-c-"]')

      for (const label of labels) {
        const text = label.textContent?.trim()
        const target = BROWSE_TARGETS.find(t => t.label === text)
        if (!target) continue

        // The row container is a few levels up from the label
        const row = label.closest('[class*="leva-c-"]')?.parentElement
        if (!row) continue

        // Skip if already injected
        if (row.querySelector(`.${BROWSE_CLASS}`)) continue

        // Find the select element in this row
        const select = row.querySelector('select')
        if (!select) continue

        const btn = document.createElement('button')
        btn.className = BROWSE_CLASS
        btn.textContent = '...'
        btn.title = `Import ${target.label} from file`
        btn.onclick = async (e) => {
          e.stopPropagation()
          e.preventDefault()
          const path = await browseAndUpload(target.type, target.accept, target.slot)
          if (path) window.location.reload()
        }

        // Insert the button right after the select's parent container
        const selectParent = select.parentElement
        if (selectParent) {
          selectParent.style.display = 'flex'
          selectParent.style.alignItems = 'center'
          selectParent.style.gap = '4px'
          selectParent.appendChild(btn)
        }
      }
    }, 800) // wait for Leva DOM

    return () => clearTimeout(timer)
  }, [])
}
