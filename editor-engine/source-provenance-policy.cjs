/* eslint-disable @typescript-eslint/no-require-imports -- shared by webpack and server-side authoring */
const ts = require('typescript');
const path = require('path');

const AUTHORING_SOURCE_ATTRIBUTE = 'data-onemo-source';
const AUTHORING_SOURCE_RESERVED = 'SOURCE_PROVENANCE_ATTRIBUTE_RESERVED';
const AUTHORING_SOURCE_RUNTIME_ACCESS_RESERVED = 'SOURCE_PROVENANCE_RUNTIME_ACCESS_RESERVED';
const AUTHORING_SOURCE_RUNTIME_FILE = 'src/app/(dev)/react-figma/component-authoring/source-provenance-runtime';

function assertNoAuthoredSourceProvenance(file, source, options = {}) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  const declarations = collectConstantDeclarations(sf);
  let refusal = null;

  const visit = (node) => {
    if (refusal) return;
    const runtimeSpecifier = runtimeModuleSpecifier(node, declarations);
    if (
      runtimeSpecifier && targetsRuntimeModule(file, runtimeSpecifier) &&
      !(options.allowRuntimeReader === true && isReadOnlyRuntimeImport(node))
    ) {
      refusal = {
        node,
        code: AUTHORING_SOURCE_RUNTIME_ACCESS_RESERVED,
        message: 'the editor source-provenance runtime is private to the authoring loader',
      };
      return;
    }
    if (ts.isJsxAttribute(node) && propertyName(node.name, declarations) === AUTHORING_SOURCE_ATTRIBUTE) {
      refusal = { node, code: AUTHORING_SOURCE_RESERVED, message: `${AUTHORING_SOURCE_ATTRIBUTE} is reserved for editor source provenance` };
      return;
    }
    if (ts.isJsxSpreadAttribute(node) && objectContainsReservedKey(node.expression, declarations, new Set())) {
      refusal = { node, code: AUTHORING_SOURCE_RESERVED, message: `${AUTHORING_SOURCE_ATTRIBUTE} is reserved for editor source provenance` };
      return;
    }
    if (ts.isCallExpression(node)) {
      if (isCreateElement(node.expression) && node.arguments[1] && objectContainsReservedKey(node.arguments[1], declarations, new Set())) {
        refusal = { node: node.arguments[1], code: AUTHORING_SOURCE_RESERVED, message: `${AUTHORING_SOURCE_ATTRIBUTE} is reserved for editor source provenance` };
        return;
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setAttribute') {
        if (constantString(node.arguments[0], declarations, new Set()) === AUTHORING_SOURCE_ATTRIBUTE) {
          refusal = { node: node.arguments[0], code: AUTHORING_SOURCE_RESERVED, message: `${AUTHORING_SOURCE_ATTRIBUTE} is reserved for editor source provenance` };
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!refusal) return;

  const location = sf.getLineAndCharacterOfPosition(refusal.node.getStart(sf));
  throw Object.assign(new Error(
    `${refusal.code}: ${refusal.message} at ${file}:${location.line + 1}:${location.character + 1}`,
  ), {
    code: refusal.code,
    status: 422,
    file,
    line: location.line + 1,
    col: location.character + 1,
  });
}

function isReadOnlyRuntimeImport(node) {
  if (!ts.isImportDeclaration(node) || !node.importClause || node.importClause.isTypeOnly) return false;
  const bindings = node.importClause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings) || bindings.elements.length === 0) return false;
  return bindings.elements.every((element) =>
    !element.isTypeOnly && (element.propertyName ?? element.name).text === 'readRuntimeSourceProvenance');
}

function runtimeModuleSpecifier(node, declarations) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
    return constantString(node.moduleSpecifier, declarations, new Set());
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression
  ) {
    return constantString(node.moduleReference.expression, declarations, new Set());
  }
  if (!ts.isCallExpression(node) || node.arguments.length === 0) return null;
  const callee = resolveExpression(node.expression, declarations, new Set());
  const loadsModule = callee?.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(callee) && callee.text === 'require');
  return loadsModule ? constantString(node.arguments[0], declarations, new Set()) : null;
}

function targetsRuntimeModule(file, specifier) {
  const source = specifier.replace(/\\/g, '/').split(/[?#]/, 1)[0].replace(/\.[cm]?[jt]sx?$/, '');
  let resolved;
  if (source.startsWith('@/')) resolved = `src/${source.slice(2)}`;
  else if (source.startsWith('.')) resolved = path.posix.join(path.posix.dirname(file.replace(/\\/g, '/')), source);
  else resolved = source.replace(/^\/+/, '');
  resolved = path.posix.normalize(resolved);
  return resolved === AUTHORING_SOURCE_RUNTIME_FILE || resolved.endsWith(`/${AUTHORING_SOURCE_RUNTIME_FILE}`);
}

function collectConstantDeclarations(sf) {
  const declarations = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const declarationList = node.parent;
      if (ts.isVariableDeclarationList(declarationList) && declarationList.flags & ts.NodeFlags.Const) {
        declarations.set(node.name.text, declarations.has(node.name.text) ? null : node.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return declarations;
}

function unwrap(expression) {
  let current = expression;
  while (
    current && (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current)
    )
  ) current = current.expression;
  return current;
}

function constantString(expression, declarations, seen) {
  const current = unwrap(expression);
  if (!current) return null;
  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) return current.text;
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return null;
    const initializer = declarations.get(current.text);
    if (!initializer) return null;
    seen.add(current.text);
    const value = constantString(initializer, declarations, seen);
    seen.delete(current.text);
    return value;
  }
  if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = constantString(current.left, declarations, new Set(seen));
    const right = constantString(current.right, declarations, new Set(seen));
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(current)) {
    let value = current.head.text;
    for (const span of current.templateSpans) {
      const part = constantString(span.expression, declarations, new Set(seen));
      if (part === null) return null;
      value += part + span.literal.text;
    }
    return value;
  }
  if (
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression) &&
    current.expression.name.text === 'join'
  ) {
    const target = resolveExpression(current.expression.expression, declarations, new Set(seen));
    if (!target || !ts.isArrayLiteralExpression(target)) return null;
    const separator = current.arguments.length === 0
      ? ','
      : constantString(current.arguments[0], declarations, new Set(seen));
    if (separator === null) return null;
    const values = target.elements.map((element) => constantString(element, declarations, new Set(seen)));
    return values.some((value) => value === null) ? null : values.join(separator);
  }
  return null;
}

function resolveExpression(expression, declarations, seen) {
  const current = unwrap(expression);
  if (!current || !ts.isIdentifier(current)) return current;
  if (seen.has(current.text)) return null;
  const initializer = declarations.get(current.text);
  if (!initializer) return current;
  seen.add(current.text);
  return resolveExpression(initializer, declarations, seen);
}

function objectContainsReservedKey(expression, declarations, seen) {
  const current = resolveExpression(expression, declarations, seen);
  if (!current) return false;
  if (ts.isCallExpression(current) && isObjectAssign(current.expression)) {
    return current.arguments.some((argument) => objectContainsReservedKey(argument, declarations, new Set(seen)));
  }
  if (!ts.isObjectLiteralExpression(current)) return false;
  return current.properties.some((property) => {
    if (ts.isSpreadAssignment(property)) {
      return objectContainsReservedKey(property.expression, declarations, new Set(seen));
    }
    return property.name ? propertyName(property.name, declarations) === AUTHORING_SOURCE_ATTRIBUTE : false;
  });
}

function propertyName(name, declarations) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) return constantString(name.expression, declarations, new Set());
  return null;
}

function isCreateElement(expression) {
  return (ts.isIdentifier(expression) && expression.text === 'createElement') ||
    (ts.isPropertyAccessExpression(expression) && expression.name.text === 'createElement');
}

function isObjectAssign(expression) {
  return ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) && expression.expression.text === 'Object' &&
    expression.name.text === 'assign';
}

module.exports = {
  AUTHORING_SOURCE_ATTRIBUTE,
  AUTHORING_SOURCE_RESERVED,
  AUTHORING_SOURCE_RUNTIME_ACCESS_RESERVED,
  assertNoAuthoredSourceProvenance,
};
