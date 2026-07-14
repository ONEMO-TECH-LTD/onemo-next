# s58-qa E11.2 node-system audit — commit 264d8a3

Verdict: FAIL-with-findings.

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- Commit: `264d8a3`
- Live server: `http://localhost:3035`
- Fixture scope: project-only throwaway `src/app/(dev)/react-figma-components/qa-e11-node/*`
- Component library: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

## Read coverage

- Read Framer extraction doc fully: `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-nodesystem-extraction.md`.
- Read full diff `ed597a4..264d8a3`.
- Read changed implementation files:
  - `src/app/api/dev/editor/lib.ts`
  - `src/app/(dev)/react-figma/components-canvas/page.tsx`
  - `src/app/(dev)/react-figma/page.tsx`

## Findings

### HIGH — `remove-connector` switch mode corrupts source instead of refusing unexpected `onClick` shapes

Source:
- `src/app/api/dev/editor/lib.ts:1225` rewrites the destructured prop alias back to a default.
- `src/app/api/dev/editor/lib.ts:1229` removes the connector hook/comment blob.
- `src/app/api/dev/editor/lib.ts:1238`-`1257` attempts to remove the `onClick` guard only if the remaining `onClick` is an inline block arrow, but if the handler is a different valid TSX shape it silently skips removal.
- `src/app/api/dev/editor/lib.ts:1260` only runs a syntax parse guard, so unresolved identifiers survive.
- `src/app/api/dev/editor/lib.ts:1261` writes the corrupted source.

Execution repro:
- Created a valid promoted component, added `size` axis, added switch connector.
- Hand-edited the generated root `onClick` from inline block to valid expression-body form:
  - `onClick={() => sizeProp == null && setSizeInternal('lg')}`
- Posted:
  - `{ kind: "remove-connector", file, mode: "switch", to: { axis: "size" } }`

Observed:
- API returned `200 {"ok":true,...,"newValueText":"switch connector removed: size"}`.
- File changed from the hand-edited preimage.
- Resulting source retained `onClick={() => sizeProp == null && setSizeInternal('lg')}` while the prop alias/hook were removed.
- `npm run typecheck` failed with:
  - `TS2304: Cannot find name 'sizeProp'.`
  - `TS2552: Cannot find name 'setSizeInternal'.`

Expected:
- Named `422` and byte-unchanged file for any unrecognized switch-handler shape.

Why this matters:
- The new op is explicitly the removal/re-point safety layer for connector wiring. A hand-edited but syntactically valid shape can turn a visual wire remove into a generated-code compile break.

### MED — Node-layer writes fail silently on server refusals

Source:
- `src/app/(dev)/react-figma/components-canvas/page.tsx:292`-`298` defines `nodeWrite`.
- `src/app/(dev)/react-figma/components-canvas/page.tsx:293` posts directly to `/api/dev/editor-write`.
- `src/app/(dev)/react-figma/components-canvas/page.tsx:294` returns `false` on `!r.ok` without reading or surfacing the server error.
- `src/app/(dev)/react-figma/components-canvas/page.tsx:113`-`115`, `121`-`122` call `onWrite(...)` and ignore the returned `false` except clearing busy state.

Live repro:
- Opened `http://localhost:3035/react-figma/components-canvas?edit=src/app/(dev)/react-figma-components/qa-e11-node/NodeUiProbe.tsx`.
- Real drag from connector handle to `tone=accent` created `switch:tone` wire and model connector.
- Repeated the same drag.

Observed:
- Request #46:
  - Body: `{"kind":"set-connector","file":"src/app/(dev)/react-figma-components/qa-e11-node/NodeUiProbe.tsx","mode":"switch","trigger":"tap","to":{"axis":"tone","value":"accent"},"cycle":true}`
  - Response: `409 {"error":"axis \"tone\" is already a switch connector (already controllable)"}`
- Browser console only showed the generic failed-resource 409.
- Page body showed only normal board text; the server's named error was not visible anywhere.

Expected:
- Node-layer writes should reuse the existing `engineWrite`/toast behavior or otherwise surface the server's named error.

## Positive evidence

- Clean switch removal:
  - Two switch connectors created one `onClick` attr with both guards.
  - Removing one switch left the other guard/blob intact.
  - Removing the last switch dropped `onClick`, hook blob, and `useState` import.
  - Model read after removals matched source.
- State connector:
  - Spring write produced `@fc-transition: hover hover spring 260 20 1` plus `linear(...)` CSS.
  - State remove cleared the side-channel, reset transition to `all .15s ease`, and model connectors became empty.
- Live node layer:
  - Edited board rendered 10 connector handles for the multi-axis fixture.
  - Real drag-to-wire created a `switch:tone` SVG wire and model connector.
  - Wire popover opened from SVG wire click.
  - Popover spring edit changed hover transition to `420/31/1` and model read reflected it.
  - Popover Remove removed the state connector; model then listed only `switch:tone`.
- `npm run typecheck` passed with the valid generated fixture present.

## Notes

- Multi-axis source semantics are implicit: when no non-axis base frame exists, `baseFrame()` falls back to the first `[data-component-frame]` (`components-canvas/page.tsx:68`-`70`). In my fixture, that effectively made `size=sm` the wire source. I am not failing this alone, but it should be made intentional or visually labeled if this is the intended Framer "primary" source.

## Cleanup verified

- Removed probe artifacts:
  - `src/app/(dev)/react-figma-components/qa-e11-node/`
  - ignored `.env.local` symlink in the isolated checkout
- Final `git status --short`:
  - onemo-next QA checkout: clean
  - onemo-component-library: clean
