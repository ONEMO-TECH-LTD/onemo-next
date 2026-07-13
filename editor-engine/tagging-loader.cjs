/* eslint-disable @typescript-eslint/no-require-imports -- webpack loader is intentionally CommonJS */
/**
 * react-figma engine · M1 selection-core (KAI-9304) — dev-only source tagging.
 *
 * Webpack `enforce:'pre'` loader: the retained page engine receives legacy
 * `data-src` in the SERVED compile only. Authoring-component host JSX is also
 * wrapped in a runtime boundary that records its committed DOM Element in a
 * module-private WeakMap; source content never owns that identity channel.
 * In-memory by design — the repo stays byte-identical (`git status` clean is
 * an AC). Identity IS the source location; no persisted ids (ENGINE-PLAN.md §2).
 *
 * Splice-only transform: positions come from the TypeScript parser. No authored
 * attribute/ref is replaced, and the repository bytes remain unchanged.
 */
const ts = require('typescript');
const path = require('path');
const fs = require('fs');
const { assertNoAuthoredSourceProvenance } = require('./source-provenance-policy.cjs');

const PROJECT_COMPONENT_ROOT = 'src/app/(dev)/react-figma-components';
const RUNTIME_MODULE = '@/app/(dev)/react-figma/component-authoring/source-provenance-runtime';

/* E7.1 (KAI-9375, lead F1): files from the global component library get a PACKAGE-NAME-PREFIXED
 * identity ("onemo-component-library/src/...") — never a `..`-relative path, whose depth differs
 * per checkout (worktree vs clone) and breaks selection identity. Resolved once per process. */
const LIB_NAME = 'onemo-component-library';
let libRoot = null;
try {
  libRoot = fs.realpathSync(path.dirname(require.resolve(`${LIB_NAME}/package.json`, { paths: [process.cwd()] })));
} catch { /* library not installed — repo-relative tagging only */ }

module.exports = function taggingLoader(source) {
  // Only ever wired in dev (next.config gate), but double-guard anyway.
  if (process.env.NODE_ENV === 'production') return source;

  let rel;
  let real = this.resourcePath;
  try { real = fs.realpathSync(this.resourcePath); } catch { /* transiently missing file — let webpack report it, never crash the compile */ }
  if (libRoot && real.startsWith(libRoot + path.sep)) {
    rel = `${LIB_NAME}/${path.relative(libRoot, real)}`;
  } else {
    rel = path.relative(this.rootContext || process.cwd(), this.resourcePath);
  }

  assertNoAuthoredSourceProvenance(rel, source);

  let sf;
  try {
    sf = ts.createSourceFile(this.resourcePath, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  } catch {
    return source; // unparseable → pass through untouched, never break the build
  }

  const projectComponentRoot = path.join(this.rootContext || process.cwd(), PROJECT_COMPONENT_ROOT);
  const authoringRuntime = real === projectComponentRoot || real.startsWith(projectComponentRoot + path.sep) ||
    Boolean(libRoot && (real === path.join(libRoot, 'src') || real.startsWith(path.join(libRoot, 'src') + path.sep)));
  const runtimeIdentifier = authoringRuntime ? uniqueRuntimeIdentifier(source) : null;

  /** @type {{pos:number, text:string, order:number}[]} */
  const inserts = [];

  const visit = (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      /^[a-z]/.test(node.tagName.text)
    ) {
      const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const authoredAttributes = node.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attribute) => attribute.name.getText(sf).toLowerCase());
      const provenance = `${rel}:${lc.line + 1}:${lc.character + 1}`;
      inserts.push({
        pos: node.attributes.end,
        text: authoredAttributes.includes('data-src') ? '' : ` data-src="${provenance}"`,
        order: 0,
      });
      if (runtimeIdentifier) {
        const element = ts.isJsxSelfClosingElement(node) ? node : node.parent;
        inserts.push({ pos: element.getStart(sf), text: `<${runtimeIdentifier} provenance=${JSON.stringify(provenance)}>`, order: 1 });
        inserts.push({ pos: element.end, text: `</${runtimeIdentifier}>`, order: 0 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (runtimeIdentifier) {
    inserts.push({
      pos: importInsertionPosition(sf),
      text: `${importInsertionPosition(sf) === 0 ? '' : '\n'}import { AuthoringSourceBoundary as ${runtimeIdentifier} } from ${JSON.stringify(RUNTIME_MODULE)};\n`,
      order: 2,
    });
  }

  if (inserts.length === 0) return source;

  // Splice from the end so earlier offsets stay valid.
  let out = source;
  inserts.sort((left, right) => right.pos - left.pos || right.order - left.order);
  for (const insert of inserts) {
    out = out.slice(0, insert.pos) + insert.text + out.slice(insert.pos);
  }
  return out;
};

function uniqueRuntimeIdentifier(source) {
  let suffix = 0;
  let identifier = '__ONEMO_SOURCE_BOUNDARY__';
  while (source.includes(identifier)) identifier = `__ONEMO_SOURCE_BOUNDARY_${++suffix}__`;
  return identifier;
}

function importInsertionPosition(sf) {
  let position = 0;
  for (const statement of sf.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    position = statement.end;
  }
  return position;
}
