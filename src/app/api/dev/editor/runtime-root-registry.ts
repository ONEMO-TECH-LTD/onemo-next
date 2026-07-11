import { promises as fs } from 'node:fs'
import path from 'node:path'

import { isStoreRelativePath } from './authoring-schema'
import type { RootKind, StoreId } from './authoring-types'

export type RegisteredRoot = {
  storeId: StoreId
  kind: RootKind
  canonicalRealPath: string
}

export class RuntimeRootRegistry {
  private readonly roots = new Map<StoreId, RegisteredRoot>()

  static async create(entries: Array<{ storeId: StoreId; kind: RootKind; rootPath: string }>) {
    const registry = new RuntimeRootRegistry()
    for (const entry of entries) {
      await registry.register(entry)
    }
    return registry
  }

  async register(entry: { storeId: StoreId; kind: RootKind; rootPath: string }): Promise<RegisteredRoot> {
    if (!entry.storeId) throw namedError('STORE_ID_REQUIRED', 'storeId is required')
    const canonicalRealPath = await fs.realpath(entry.rootPath)
    const existing = this.roots.get(entry.storeId)
    if (existing && (existing.kind !== entry.kind || existing.canonicalRealPath !== canonicalRealPath)) {
      throw namedError('DUPLICATE_STORE_ID', `storeId already registered: ${entry.storeId}`)
    }
    const root = { storeId: entry.storeId, kind: entry.kind, canonicalRealPath }
    this.roots.set(entry.storeId, root)
    return root
  }

  get(storeId: StoreId): RegisteredRoot {
    const root = this.roots.get(storeId)
    if (!root) throw namedError('STORE_NOT_REGISTERED', `store is not registered: ${storeId}`)
    return root
  }

  async resolveStorePath(storeId: StoreId, relativePath: string): Promise<string> {
    if (!isStoreRelativePath(relativePath)) {
      throw namedError('INVALID_STORE_RELATIVE_PATH', `invalid store-relative path: ${relativePath}`)
    }
    const root = this.get(storeId)
    const abs = path.join(root.canonicalRealPath, relativePath)
    const ancestorReal = await this.realpathNearestExistingAncestor(path.dirname(abs))
    if (ancestorReal !== root.canonicalRealPath && !ancestorReal.startsWith(root.canonicalRealPath + path.sep)) {
      throw namedError('PATH_OUTSIDE_STORE', `path escapes store root: ${relativePath}`)
    }
    return abs
  }

  toJSON() {
    return { storeIds: Array.from(this.roots.keys()) }
  }

  private async realpathNearestExistingAncestor(start: string): Promise<string> {
    let current = start
    for (;;) {
      try {
        return await fs.realpath(current)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        const parent = path.dirname(current)
        if (parent === current) throw error
        current = parent
      }
    }
  }
}

function namedError(code: string, message: string) {
  return Object.assign(new Error(message), { status: 422, code })
}
