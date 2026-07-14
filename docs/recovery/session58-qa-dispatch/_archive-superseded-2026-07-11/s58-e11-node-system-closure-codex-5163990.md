# s58-qa E11.2 closure re-verify — commit 5163990

Verdict: PASS.

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- Commit: `5163990`
- Live server: `http://localhost:3035`
- Fixture scope: project-only throwaway `src/app/(dev)/react-figma-components/qa-e11-node/*`

## Read coverage

- Read full closure diff `264d8a3..5163990`.
- Changed files:
  - `src/app/api/dev/editor/lib.ts`
  - `src/app/(dev)/react-figma/components-canvas/page.tsx`
  - `src/app/(dev)/react-figma/page.tsx`

## Finding #1 closure — corrupt-write refusal

Result: PASS.

Execution:
- Created a valid promoted component.
- Added `size` axis.
- Added switch connector on `size`.
- Hand-edited generated root handler to expression-bodied form:
  - `onClick={() => sizeProp == null && setSizeInternal('lg')}`
- Posted:
  - `{ kind: "remove-connector", file, mode: "switch", to: { axis: "size" } }`

Observed:
- API returned named `422`:
  - `onClick has an unrecognized shape — can't safely remove the "size" tap-switch guard (hand-edited?)`
- File remained byte-identical to the hand-edited preimage.
- Aliased binding, switch hook blob, and `@fc-connector` side-channel remained intact.

Happy-path regressions:
- Sole switch removal:
  - `200`
  - dropped `onClick`, connector blob, hook, and `useState` import.
  - restored `size = 'sm'`.
  - model connectors `[]`.
- Merged switch removal:
  - two-switch component had `size` + `tone`.
  - removing `size` returned `200`.
  - removed only `size` guard/blob.
  - preserved `tone` guard/blob and exactly one `onClick`.
  - model connectors contained only `tone`.

Probe summary:
- `/tmp/s58-e11-closure-probe.mjs`: `10/10` PASS.

## Finding #2 closure — failed node write toast

Result: PASS.

Execution:
- Opened full parent shell `/react-figma`.
- Entered component edit mode from the Components rail for `NodeUiProbe`.
- Confirmed iframe source:
  - `/react-figma/components-canvas?edit=src%2Fapp%2F(dev)%2Freact-figma-components%2Fqa-e11-node%2FNodeUiProbe.tsx`
- Real mouse drag from connector handle to `tone=accent` created `switch:tone`.
- Repeated the same drag to trigger duplicate connector refusal.

Observed:
- First drag:
  - iframe SVG/model showed `switch:tone`.
- Second drag:
  - request #187 `POST /api/dev/editor-write` returned `409 Conflict`.
  - visible parent-shell toast text appeared:
    - `axis "tone" is already a switch connector (already controllable)`

This verifies the iframe `fc-toast` postMessage relay and parent `notify()` path, not just direct iframe behavior.

## Gates

- `npm run typecheck` with the generated fixture present: PASS.
- Browser console after duplicate drag had the expected failed-resource 409, and the visible toast surfaced the named error.

## Cleanup verified

- Removed:
  - `src/app/(dev)/react-figma-components/qa-e11-node/`
  - ignored `.env.local` symlink in isolated checkout
- Final `git status --short`:
  - onemo-next QA checkout: clean at `5163990`
  - onemo-component-library: clean at `1b7732e`
