// File in / file out for the admin: dropped or picked files become a source; the render can be
// downloaded or copied, and the config exported or imported as JSON.

import { DEFAULT_SOURCES, renderThermal } from '../engine'
import { getConfig, setConfig } from './state'

function readAs(file: File, as: 'text' | 'dataURL'): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    if (as === 'text') r.readAsText(file)
    else r.readAsDataURL(file)
  })
}

/** Turn a dropped/picked file into the source. Returns a message for the status line. */
export async function loadFile(file: File): Promise<string> {
  const c = getConfig()
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    setConfig({ ...c, source: { kind: 'svg', markup: await readAs(file, 'text') } })
    return `SVG loaded: ${file.name}`
  }
  if (file.type.startsWith('image/')) {
    const mode = c.source.kind === 'image' ? c.source.mode : DEFAULT_SOURCES.image.mode
    setConfig({ ...c, source: { kind: 'image', href: await readAs(file, 'dataURL'), mode } })
    return `Image loaded: ${file.name}`
  }
  if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
    setConfig(JSON.parse(await readAs(file, 'text')))
    return `Config loaded: ${file.name}`
  }
  if (file.type.startsWith('text/')) {
    setConfig({ ...c, source: { ...DEFAULT_SOURCES.text, text: (await readAs(file, 'text')).trim().slice(0, 200) } })
    return `Text loaded: ${file.name}`
  }
  return `Unsupported file: ${file.name}`
}

function download(name: string, body: string, type: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSvg(): void {
  download('thermal.svg', renderThermal(getConfig()).svg, 'image/svg+xml')
}

export function downloadConfig(): void {
  download('thermal-config.json', JSON.stringify(getConfig(), null, 2), 'application/json')
}

export async function copy(what: 'svg' | 'config'): Promise<string> {
  const text = what === 'svg' ? renderThermal(getConfig()).svg : JSON.stringify(getConfig(), null, 2)
  try {
    await navigator.clipboard.writeText(text)
    return `${what === 'svg' ? 'SVG' : 'Config'} copied (${(text.length / 1024).toFixed(1)} KB)`
  } catch {
    return 'Clipboard blocked — use Download instead'
  }
}
