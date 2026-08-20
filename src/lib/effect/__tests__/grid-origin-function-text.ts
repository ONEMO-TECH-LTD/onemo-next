import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

export function canonicalCallableBodyText(file: string, name: string): string {
  const text = readFileSync(file, 'utf8')
  const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let found = ''
  const walk = (node: ts.Node) => {
    if (found) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(parsed)
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      found = node.getText(parsed)
    }
    ts.forEachChild(node, walk)
  }
  walk(parsed)
  if (!found) throw new Error(`missing callable body ${file}#${name}`)
  return found
}

export function canonicalCallableBodySha256(file: string, name: string): string {
  return createHash('sha256').update(canonicalCallableBodyText(file, name)).digest('hex')
}

export function callableBodiesAreByteEqual(
  donorFile: string,
  donorName: string,
  copyFile: string,
  copyName = donorName,
): boolean {
  return canonicalCallableBodyText(donorFile, donorName) === canonicalCallableBodyText(copyFile, copyName)
}
