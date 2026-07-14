# s58-qa I5 F-M11 closure re-verify — a7e9cca

Verdict: PASS.

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- Branch target: `session58-task/react-figma-engine`
- Frozen commit verified locally: `a7e9cca`
- Component library repo checked separately: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Source read / diff read:
- `git diff 11c155b..a7e9cca` touches only:
  - `src/app/api/dev/editor/lib.ts`
  - `src/app/(dev)/react-figma/page.tsx`
- Server guard read at `lib.ts:729-785` and add-axis/add-value callers at `lib.ts:819-860`.
- Semantic add-state path read at `lib.ts:581-697`.
- Board authoring block read at `page.tsx:3973-4029`.
- Components rail edit path read at `page.tsx:2216-2252` and `page.tsx:3863-3914`.

Evidence:
- Server F-M11 repro used project-only fixtures under `src/app/(dev)/react-figma-components/qa-i5-fm11`.
- Probe script: `/tmp/s58-i5-fm11-closure-probe.mjs`
- Probe output: `/tmp/s58-i5-fm11-closure-probe-results.json`

Server/write-path checks:
- `/react-figma` returned 200 on `:3035`.
- `StateAxisCollision` promoted successfully.
- `add-state loading` produced:
  - `loading?: boolean`
  - `loading = false`
  - `data-loading={loading || undefined}`
  - `.base { ... transition: all .15s ease; }`
- Then `add-variant-axis axis=loading values=idle,busy default=idle` returned HTTP 422 with the named `already exists as a semantic state` message.
- The fixture source was byte-identical before/after the rejected axis write.
- No `idle | busy` union was introduced; no TS2322 corruption path remained.

Regression checks:
- `FreeAxisRegression` promoted successfully.
- `add-variant-axis tone=[cool,warm] default=cool` returned 200.
- `add-variant-value tone=hot` returned 200.
- Resulting component had `tone?: 'cool' | 'warm' | 'hot'`.
- Component model readback had `tone` values `cool,warm,hot` and default `cool`.

Browser board-client check:
- Opened real editor at `http://localhost:3035/react-figma`.
- Switched to Components rail.
- Double-clicked `BoardReservedAxis` from the real Components rail.
- Verified component edit board rendered `Home › BoardReservedAxis`, six state chips, and the Variants authoring row.
- Filled `axis name` with `loading`.
- Snapshot showed:
  - textbox value `loading`
  - `+ axis` button disabled
  - hint text: `“loading” is a reserved state name`
- Initial console had the known mother-v2 hydration/data-eng-id mismatch only; no F-M11-specific error observed.

Typecheck:
- `npm run typecheck` with generated fixtures present exited 0.

Cleanup:
- QA fixture files removed after verification.
- Final `git status --short` checked in both repos after cleanup.
