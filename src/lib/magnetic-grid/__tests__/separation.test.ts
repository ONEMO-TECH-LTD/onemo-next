import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SPOT_RADIUS_MM } from '../spec'

const ROOT = join(process.cwd(), 'src/lib/magnetic-grid')
const FILES = [
  'spec.ts',
  'compute.ts',
  'compute/exact-real.ts',
  'compute/certified-real.ts',
  'compute/angle.ts',
  'compute/clearance.ts',
  'compute/offset.ts',
  'compute/region.ts',
  'compute/deepest.ts',
  'compute/seat.ts',
  'compute/centre-evidence.ts',
  'logic.ts',
  'engine.ts',
] as const

const imports = (file: string) => [...readFileSync(join(ROOT, file), 'utf8').matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1])

describe('magnetic-grid T1 separation', () => {
  it('is portable and imports only along the declared DAG', () => {
    const allowed: Record<(typeof FILES)[number], readonly string[]> = {
      'spec.ts': [],
      'compute.ts': ['./compute/seat', './compute/centre-evidence'],
      'compute/exact-real.ts': ['../spec'],
      'compute/certified-real.ts': ['../spec', './exact-real'],
      'compute/angle.ts': ['../spec', './exact-real', './certified-real'],
      'compute/clearance.ts': ['../spec', './exact-real'],
      'compute/offset.ts': ['./certified-real', '../spec', './clearance', './exact-real'],
      'compute/region.ts': ['../spec', './angle', './certified-real', './clearance', './exact-real', './offset'],
      'compute/deepest.ts': ['../spec', './certified-real', './clearance', './exact-real', './offset', './region'],
      'compute/seat.ts': ['../spec'],
      'compute/centre-evidence.ts': ['../spec', './seat'],
      'logic.ts': ['./spec'],
      'engine.ts': ['./compute', './logic', './spec'],
    }
    for (const file of FILES) {
      const text = readFileSync(join(ROOT, file), 'utf8')
      expect(text, file).not.toMatch(/\breact\b|\bnext\b|@\/app|grid-origin|grid-engine|document\.|window\./)
      expect([...new Set(imports(file))], file).toEqual(allowed[file])
    }
  })

  it('keeps spec declarative and logic free of geometry', () => {
    const spec = ts.createSourceFile('spec.ts', readFileSync(join(ROOT, 'spec.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
    const violations: string[] = []
    const walk = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) violations.push(node.getText(spec))
      if (ts.isBinaryExpression(node) && /[-+*/%]/.test(node.operatorToken.getText(spec))) violations.push(node.getText(spec))
      ts.forEachChild(node, walk)
    }
    walk(spec)
    expect(violations).toEqual([])
    expect(readFileSync(join(ROOT, 'logic.ts'), 'utf8')).not.toMatch(/Math\.(hypot|sqrt|sin|cos|atan2)|bbox\s*\(|lattice|polygon|edgeDist|contact/)
  })

  it('contains no Voting donor', () => {
    for (const file of FILES) {
      expect(readFileSync(join(ROOT, file), 'utf8'), file)
        .not.toMatch(/registrationScore|VOTING_ORDER|SEAT_WEIGHT|FLAP_WEIGHT|BALANCE_WEIGHT|centeringRef|votingOrder|positioning/)
    }
  })

  it('publishes the released 12mm spot radius', () => {
    expect(SPOT_RADIUS_MM).toBe(12)
  })
})
