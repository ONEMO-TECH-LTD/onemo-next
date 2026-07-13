/* eslint-disable @typescript-eslint/no-require-imports -- shared by webpack and server-side authoring */
const ts = require('typescript');

const AUTHORING_SOURCE_ATTRIBUTE = 'data-onemo-source';
const AUTHORING_SOURCE_RESERVED = 'SOURCE_PROVENANCE_ATTRIBUTE_RESERVED';

function assertNoAuthoredSourceProvenance(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  const declarations = collectConstantDeclarations(sf);
  let collision = null;

  const visit = (node) => {
    if (collision) return;
    if (ts.isJsxAttribute(node) && propertyName(node.name, declarations) === AUTHORING_SOURCE_ATTRIBUTE) {
      collision = node;
      return;
    }
    if (ts.isJsxSpreadAttribute(node) && objectContainsReservedKey(node.expression, declarations, new Set())) {
      collision = node;
      return;
    }
    if (ts.isCallExpression(node)) {
      if (isCreateElement(node.expression) && node.arguments[1] && objectContainsReservedKey(node.arguments[1], declarations, new Set())) {
        collision = node.arguments[1];
        return;
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setAttribute') {
        if (constantString(node.arguments[0], declarations, new Set()) === AUTHORING_SOURCE_ATTRIBUTE) {
          collision = node.arguments[0];
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!collision) return;

  const location = sf.getLineAndCharacterOfPosition(collision.getStart(sf));
  throw Object.assign(new Error(
    `${AUTHORING_SOURCE_RESERVED}: ${AUTHORING_SOURCE_ATTRIBUTE} is reserved for editor source provenance at ${file}:${location.line + 1}:${location.character + 1}`,
  ), {
    code: AUTHORING_SOURCE_RESERVED,
    status: 422,
    file,
    line: location.line + 1,
    col: location.character + 1,
  });
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
  assertNoAuthoredSourceProvenance,
};
