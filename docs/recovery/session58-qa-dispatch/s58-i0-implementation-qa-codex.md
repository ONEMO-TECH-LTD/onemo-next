# s58 I0 implementation QA - Codex

Verdict: PASS for I0 implementation at `4e202a2`.

Scope:
- Branch/commit: `session58-task/react-figma-engine` @ `4e202a2`.
- QA checkout: `/tmp/s58-i0-qa-4e202a2` (own detached worktree, not designer's worktree).
- Files under test:
  - `src/app/api/dev/editor/lib.ts` (1402 lines, fully read)
  - `src/app/api/dev/editor-component-model/route.ts` (20 lines, fully read)
  - `src/app/api/dev/editor-write/route.ts` (22 lines, entrypoint read)
- Probe fixture: project-only throwaway under `src/app/(dev)/react-figma-components/qa-i0-codex/`, removed after QA.

Environment:
- Dev server: `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run dev -- --webpack -p 3035`.
- Initial run without these env vars failed in middleware before reaching the API. Restarted with inert Supabase placeholders to exercise dev API routes.

Execution evidence:
- API probe: `node /tmp/s58-i0-qa-run.mjs` -> `I0 QA PROBE: 39/39 PASS`.
- Typecheck: `npm run typecheck` -> exit 0.
- Editor route: `/react-figma` -> HTTP 200 during probe.
- Cleanup:
  - `/tmp/s58-i0-qa-4e202a2`: `git status --short` empty.
  - `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`: `git status --short` empty.
  - Ignored dev-server artifacts in the throwaway checkout only: `.next/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`.

Gate results:

1. promote-element: PASS.
   - Inline root `<div style={{...}}>` promoted to `QaI0Codex.module.css`.
   - TSX gained `import styles from './QaI0Codex.module.css'`.
   - Root style replaced with `className={styles.base}`.
   - Generated `.base` rule contained 15 lifted declarations.

2. style-object converter parity: PASS.
   - Compared generated CSS against ReactDOMServer's serialization for the same style object.
   - Verified length numbers -> px: `width`, `height`, `margin-top`, `border-radius`.
   - Verified unitless raw values: `opacity`, `z-index`, `line-height`, `font-weight`, `flex`, `order`.
   - Verified strings/custom values verbatim: `var(--qa-bg)`, `padding`, `font`, `transform`, `--qa-custom: calc(...)`.
   - Verified camelCase -> kebab-case.

3. write-scoped-declaration 4 scopes: PASS.
   - Base: `.base { color: #111111; border-color: #222222; }`.
   - Variant: `.base.secondary { background-color: #333333; color: #444444; }`.
   - Pseudo: exact signed selector `.base:hover, :global([data-fc-preview="hover"]) .base { background-color: #555555; }`.
   - Semantic: `.base[data-loading] { opacity: 0.5; }`.

4. ComponentModel READ / round-trip: PASS.
   - Model read `rootClass: "base"` and css module path.
   - Model read config variant `secondary`.
   - Model read interaction state `hover`.
   - Model read semantic state `loading`.
   - Re-read after same-value write was byte-model-stable, including semantic state.

5. idempotent/no-double promotion: PASS.
   - Re-promoting root returned `noop: true`.
   - `.base` rule count did not increase.
   - Child promotion also passed (`span5`) proving op is not root-only.

6. write serialization: PASS.
   - Six concurrent `write-scoped-declaration` POSTs against the same CSS module all landed.
   - No lost update observed.

Findings:
- None for I0 scope.

Notes:
- PASS is limited to I0 substrate: promote-element, write-scoped-declaration, ComponentModel read, queue, tsc, and route health.
- This does not certify I1+ states UI, variant board, props panel, connectors UI, structural variants, or Dan acceptance.
