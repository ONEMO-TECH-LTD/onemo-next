// Admin state: the render settings (engine config without the images) plus which stock photo, Effect
// and material are picked. Images are resolved to data URLs by assets.ts at render time.

import { normalize, type RenderConfig } from '../engine'

const KEY = 'effect-render:v1'

export interface Picks {
  stock: string
  effect: string
  material: string
}

interface Saved {
  config: RenderConfig
  picks: Picks
}

type Listener = () => void
const listeners = new Set<Listener>()

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Saved
      return { config: normalize(s.config), picks: s.picks }
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return { config: normalize(), picks: { stock: '', effect: '', material: 'suede' } }
}

let state = load()

function persist(): void {
  try {
    // images are re-resolved from the picks, so they are never stored
    const config = { ...state.config, base: { ...state.config.base, href: '' }, effect: { ...state.config.effect, href: '' }, texture: { ...state.config.texture, href: '' } }
    localStorage.setItem(KEY, JSON.stringify({ config, picks: state.picks }))
  } catch {
    /* preference only */
  }
}

export const getConfig = (): RenderConfig => state.config
export const getPicks = (): Picks => state.picks

export function setConfig(next: unknown): void {
  state = { ...state, config: normalize(next as object) }
  persist()
  listeners.forEach((l) => l())
}

export function setPick(key: keyof Picks, value: string): void {
  state = { ...state, picks: { ...state.picks, [key]: value } }
  persist()
  listeners.forEach((l) => l())
}

/** Set one value by dotted path, e.g. update('shadow.blur', 12). */
export function update(path: string, value: unknown): void {
  const next = structuredClone(state.config) as unknown as Record<string, unknown>
  const keys = path.split('.')
  let node = next
  for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>
  node[keys[keys.length - 1]] = value
  setConfig(next)
}

export function read(path: string): unknown {
  return path.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown>)?.[k], state.config)
}

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
