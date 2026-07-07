/**
 * react-figma engine · M1 selection-core (KAI-9304) — dev-only source tagging.
 *
 * Webpack `enforce:'pre'` loader: stamps host (lowercase) JSX elements with
 * `data-src="<repo-relative-file>:<line>:<col>"` in the SERVED compile only.
 * In-memory by design — the repo stays byte-identical (`git status` clean is
 * an AC). Identity IS the source location; no persisted ids (ENGINE-PLAN.md §2).
 *
 * Splice-only transform: positions come from the TypeScript parser, text is
 * inserted right after the tag name, no codegen, no added lines — so line
 * numbers downstream (SWC, sourcemaps) stay true.
 */
const ts = require('typescript');
const path = require('path');
const fs = require('fs');

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
  const real = fs.realpathSync(this.resourcePath);
  if (libRoot && real.startsWith(libRoot + path.sep)) {
    rel = `${LIB_NAME}/${path.relative(libRoot, real)}`;
  } else {
    rel = path.relative(this.rootContext || process.cwd(), this.resourcePath);
  }

  let sf;
  try {
    sf = ts.createSourceFile(this.resourcePath, source, ts.ScriptTarget.ESNext, false, ts.ScriptKind.TSX);
  } catch {
    return source; // unparseable → pass through untouched, never break the build
  }

  /** @type {{pos:number, text:string}[]} */
  const inserts = [];

  const visit = (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      /^[a-z]/.test(node.tagName.text)
    ) {
      const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      inserts.push({
        pos: node.tagName.end,
        text: ` data-src="${rel}:${lc.line + 1}:${lc.character + 1}"`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (inserts.length === 0) return source;

  // Splice from the end so earlier offsets stay valid.
  let out = source;
  for (let i = inserts.length - 1; i >= 0; i--) {
    out = out.slice(0, inserts[i].pos) + inserts[i].text + out.slice(inserts[i].pos);
  }
  return out;
};
