// Admin state: one ThermalConfig, persisted per browser. The shell only ever holds a config — all
// rendering goes through the engine's public API.

import { normalizeConfig, type ThermalConfig } from '../engine'

const KEY = 'thermal-svg:config:v1'

type Listener = (c: ThermalConfig) => void

function load(): ThermalConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalizeConfig(JSON.parse(raw))
  } catch {
    /* storage blocked or corrupt — fall back to defaults */
  }
  return normalizeConfig()
}

let config = load()
const listeners = new Set<Listener>()

export function getConfig(): ThermalConfig {
  return config
}

export function setConfig(next: unknown): void {
  config = normalizeConfig(next as object)
  try {
    localStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    /* image sources can exceed the storage quota — the session keeps working */
  }
  listeners.forEach((l) => l(config))
}

/** Set one value by dotted path, e.g. update('stripe.period', 300). */
export function update(path: string, value: unknown): void {
  const next = structuredClone(config) as unknown as Record<string, unknown>
  const keys = path.split('.')
  let node = next
  for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>
  node[keys[keys.length - 1]] = value
  setConfig(next)
}

export function read(path: string): unknown {
  return path.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown>)?.[k], config)
}

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
