// editor/tool-config.ts — RUNTIME tool-enable config ADAPTER (Phase 4 · blueprint §0.2/§0a/inv 30).
//
// Disabling a tool MUST be a runtime config flag with NO code change (§0a). This module is ONLY a
// runtime adapter — it parses a runtime channel (a URL flag now; a product config store later) into the
// `toolEnabled` predicate the composer reads. It is NOT a source-const toggle: editing a const would be a
// code change and would FAIL §0a (the design-gate blocker pixel caught). Default = every tool enabled.

import type { ToolEnabled } from './descriptors/types'

/** Parse the dev/runtime disable flag (`?disable=radius,vignette`) into a set of disabled tool ids.
 *  A runtime channel — flipping the URL disables a tool live, zero source edit. */
export function parseDisabledTools(search: string | URLSearchParams | null | undefined): Set<string> {
  if (!search) return new Set()
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const raw = params.get('disable')
  if (!raw) return new Set()
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
}

/** Build the `toolEnabled` predicate from a runtime-disabled set (default: all enabled). The product can
 *  supply its own set from a settings/feature-flag store — same predicate, same composer, no code change. */
export function makeToolEnabled(disabled: Set<string> = new Set()): ToolEnabled {
  return (id: string) => !disabled.has(id)
}

/** Convenience: the predicate straight from a runtime search string (the dev/proof path). */
export function toolEnabledFromSearch(search: string | URLSearchParams | null | undefined): ToolEnabled {
  return makeToolEnabled(parseDisabledTools(search))
}
