// Highlights individual Leva control labels when values differ from saved baseline.
// Clicking a highlighted label resets that specific value.
// Works by DOM injection — monitors Leva's panel and adds/removes styles.

'use client'

import { useEffect } from 'react'
import { useSceneStore } from './sceneStore'

const HIGHLIGHT_COLOR = '#b45309'  // amber for changed values
const STYLE_ID = 'leva-highlight-style'

// Inject global CSS for highlighted labels
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    [data-leva-changed="true"] {
      color: ${HIGHLIGHT_COLOR} !important;
      cursor: pointer !important;
      text-decoration: underline dotted ${HIGHLIGHT_COLOR} !important;
    }
    [data-leva-changed="true"]:hover {
      opacity: 0.7;
    }
  `
  document.head.appendChild(style)
}

// Find the Leva label element for a given control name
function findLevaLabel(name: string): HTMLElement | null {
  // Leva renders control labels as <label> elements with leva-c-* classes
  const labels = document.querySelectorAll('label[class*="leva-c-"]')
  for (const el of labels) {
    if (el.textContent?.trim() === name) {
      return el as HTMLElement
    }
  }
  return null
}

export function useLevaHighlight() {
  const values = useSceneStore((s) => s._values)
  const baseline = useSceneStore((s) => s._baseline)
  const setters = useSceneStore((s) => s._setters)

  useEffect(() => {
    ensureStyle()

    // Build a flat map: controlName → { group, changed, baselineValue }
    const controls: Array<{
      group: string
      key: string
      changed: boolean
      baselineValue: unknown
    }> = []

    for (const group of Object.keys(baseline)) {
      const baseGroup = baseline[group as keyof typeof baseline] as unknown as Record<string, unknown> | undefined
      const currentGroup = values[group as keyof typeof values] as unknown as Record<string, unknown> | undefined
      if (!baseGroup || !currentGroup) continue

      for (const key of Object.keys(baseGroup)) {
        const baseVal = baseGroup[key]
        const curVal = currentGroup[key]
        controls.push({
          group,
          key,
          changed: curVal !== baseVal,
          baselineValue: baseVal,
        })
      }
    }

    // Apply highlights to DOM
    for (const ctrl of controls) {
      const label = findLevaLabel(ctrl.key)
      if (!label) continue

      if (ctrl.changed) {
        label.setAttribute('data-leva-changed', 'true')
        label.title = `Click to reset to saved value`

        // Add click handler with capture to override Leva's native copy-to-clipboard
        const handler = (e: Event) => {
          e.stopPropagation()
          e.preventDefault()
          const setter = setters[ctrl.group]
          if (setter) {
            setter({ [ctrl.key]: ctrl.baselineValue } as Record<string, number | string>)
          }
        }
        // Store handler reference for cleanup
        const existingHandler = (label as unknown as Record<string, unknown>).__resetHandler as ((e: Event) => void) | undefined
        if (existingHandler) {
          label.removeEventListener('click', existingHandler, true)
        }
        (label as unknown as Record<string, unknown>).__resetHandler = handler
        label.addEventListener('click', handler, true)  // capture phase
      } else {
        label.removeAttribute('data-leva-changed')
        label.title = ''
        const existingHandler = (label as unknown as Record<string, unknown>).__resetHandler as ((e: Event) => void) | undefined
        if (existingHandler) {
          label.removeEventListener('click', existingHandler, true)
          delete (label as unknown as Record<string, unknown>).__resetHandler
        }
      }
    }
  }, [values, baseline, setters])
}
