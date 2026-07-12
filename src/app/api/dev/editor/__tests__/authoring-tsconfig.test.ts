import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { readExactCompilerConfig } from '../authoring-tsconfig'
import { RuntimeRootRegistry } from '../runtime-root-registry'

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-tsconfig-'))
  const registry = await RuntimeRootRegistry.create([{ storeId: 'project-main', kind: 'project', rootPath: root }])
  return { root, registry }
}

describe('exact compiler configuration', () => {
  it('snapshots a nested root-local extends chain and freezes the derived options', async () => {
    const { root, registry } = await makeRoot()
    await fs.mkdir(path.join(root, 'config/nested'), { recursive: true })
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/index.ts'), 'export {}\n')
    await fs.writeFile(path.join(root, 'config/nested/base.json'), JSON.stringify({
      compilerOptions: { strict: true, baseUrl: '../..', paths: { '@/*': ['src/*'] } },
    }))
    await fs.writeFile(path.join(root, 'config/shared.json'), JSON.stringify({ extends: './nested/base.json' }))
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: './config/shared.json' }))

    const snapshot = await readExactCompilerConfig({ storeId: 'project-main', registry })

    expect(Object.keys(snapshot.sources).sort()).toEqual(['config/nested/base.json', 'config/shared.json', 'tsconfig.json'])
    expect(snapshot.options).toMatchObject({
      strict: true,
      baseUrl: registry.get('project-main').canonicalRealPath,
      paths: { '@/*': ['src/*'] },
    })
    expect(Object.isFrozen(snapshot.options)).toBe(true)
    expect(Object.isFrozen(snapshot.options.paths)).toBe(true)
    expect(Object.isFrozen(snapshot.options.paths?.['@/*'])).toBe(true)
  })

  it('refuses relative and absolute config-chain escapes', async () => {
    const { root, registry } = await makeRoot()
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-tsconfig-outside-'))
    const outsideConfig = path.join(outside, 'base.json')
    await fs.writeFile(outsideConfig, JSON.stringify({ compilerOptions: { strict: true } }))
    const relativeEscape = path.relative(root, outsideConfig).split(path.sep).join('/')

    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: relativeEscape }))
    await expect(readExactCompilerConfig({ storeId: 'project-main', registry }))
      .rejects.toMatchObject({ code: 'SOURCE_TSCONFIG_OUTSIDE_ROOT' })

    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: outsideConfig }))
    await expect(readExactCompilerConfig({ storeId: 'project-main', registry }))
      .rejects.toMatchObject({ code: 'SOURCE_TSCONFIG_OUTSIDE_ROOT' })
  })

  it('refuses an exact config-chain symlink before reading its target', async () => {
    const { root, registry } = await makeRoot()
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'authoring-tsconfig-symlink-'))
    await fs.writeFile(path.join(outside, 'base.json'), JSON.stringify({ compilerOptions: { strict: true } }))
    await fs.mkdir(path.join(root, 'config'), { recursive: true })
    await fs.symlink(path.join(outside, 'base.json'), path.join(root, 'config/base.json'))
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: './config/base.json' }))

    await expect(readExactCompilerConfig({ storeId: 'project-main', registry }))
      .rejects.toMatchObject({ code: 'PATH_SYMLINK_REFUSED' })
  })

  it('snapshots a root-local package config and its resolution metadata', async () => {
    const { root, registry } = await makeRoot()
    const packageRoot = path.join(root, 'node_modules/example-config')
    await fs.mkdir(packageRoot, { recursive: true })
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/index.ts'), 'export {}\n')
    await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'example-config', tsconfig: 'strict.json' }))
    await fs.writeFile(path.join(packageRoot, 'strict.json'), JSON.stringify({ compilerOptions: { strict: true } }))
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: 'example-config' }))

    const snapshot = await readExactCompilerConfig({ storeId: 'project-main', registry })

    expect(snapshot.options.strict).toBe(true)
    expect(Object.keys(snapshot.sources).sort()).toEqual([
      'node_modules/example-config/package.json',
      'node_modules/example-config/strict.json',
      'tsconfig.json',
    ])
  })
})
