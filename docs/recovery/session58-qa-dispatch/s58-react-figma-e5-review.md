# s58 react-figma E6 HIGH-fix closure QA

Verdict: **PASS**

Target audited: `40ba814` on `session58-task/react-figma-engine`, live `http://localhost:3025/react-figma`.

Scope: E6 closure only - the 3 prior E5 HIGHs, E6.5 Pages/Layers divider, and no-regression gates. Queued E6 tasks KAI-9354 and KAI-9356 were not evaluated.

## Gate State

```text
git rev-parse --short HEAD
40ba814

git status --short
?? test-results/

curl http://localhost:3025/react-figma
200

git show --stat --oneline HEAD
40ba814 fix(react-figma): E6.1-E6.3 + E6.5 - real-input fixes from Codex E5 verdict + Dan live QA
src/app/(dev)/react-figma/page.tsx | 47 +++++++++++++++++++++++++-------------
```

Production/no-regression gates:

```text
npm run typecheck
exit 0

npm run build
next build --webpack exit 0

find .next/static -type f -exec grep -l 'data-src="src/' {} +
0 matches (grep exit 1)

git status --short -- src storybook package.json package-lock.json next.config.ts
0 lines
```

## Closure Probes

1. **PASS - Zoom bottom icon buttons respond to real pointer clicks.**

   Playwright real mouse click on the visible bottom `Zoom in` icon:

   ```json
   {
     "before": ["60%", "60%"],
     "afterClick1": ["75%", "75%"],
     "afterClick2": ["94%", "94%"]
   }
   ```

   Source fix: `main.onPointerDown` now returns early for interactive children before panning/pointer-capture at `src/app/(dev)/react-figma/page.tsx:2552-2564`; bottom zoom still uses real `IB` buttons at `src/app/(dev)/react-figma/page.tsx:2803-2805`.

2. **PASS - Draw-to-place writes on a real drag over the frame.**

   Instrumented real drag:

   ```json
   {
     "armedText": "Drawing text - drag on the frame - Esc to cancel",
     "iframePointerBeforeArm": "auto",
     "iframePointerArmed": "none",
     "centerArmed": { "tag": "DIV" },
     "pointerCounts": { "pd": 2, "pm": 14, "pu": 2, "pc": 0 },
     "fetches": [{ "input": "/api/dev/editor-write", "status": 200, "ok": true }]
   }
   ```

   The write created exactly one expected test diff, then I restored it:

   ```diff
   +      <span style={{ position: 'absolute', left: 133, top: 200, fontSize: 14, color: '#000' }}>Text</span>
   ```

   Source fix: iframe uses `pointerEvents: drawArm ? 'none' : 'auto'` at `src/app/(dev)/react-figma/page.tsx:2789-2791`; draw write path remains `insertDrawn -> /api/dev/editor-write` at `src/app/(dev)/react-figma/page.tsx:2540-2550`.

3. **PASS - Fresh variable bindings immediately render pills across the field components.**

   Fresh picks via the variable picker for X-position, Horizontal padding, and Opacity all rendered pills immediately; no raw input remained:

   ```json
   {
     "binds": ["X-position", "Horizontal padding", "Opacity"],
     "pills": [
       { "title": "var(--al-dim-none)", "text": "al-dim-none" },
       { "title": "var(--al-dim-none)", "text": "al-dim-none" },
       { "title": "var(--al-dim-none)", "text": "al-dim-none" }
     ],
     "inputCounts": { "x": 0, "paddingX": 0, "opacity": 0 }
   }
   ```

   Source fix: `varBinding()` and immediate pill rendering are in `InspectorField`, `AutoValueField`, and `InlineValueInput` at `src/app/(dev)/react-figma/page.tsx:371-379`, `src/app/(dev)/react-figma/page.tsx:432-450`, and `src/app/(dev)/react-figma/page.tsx:592-603`.

4. **PASS - Pages/Layers divider is real-mouse draggable.**

   Playwright stepped `mouse.down/move/up` on `aria-label="Resize Layers section"`:

   ```json
   {
     "beforeBox": { "x": 56, "y": 339, "width": 239, "height": 12 },
     "afterBox": { "x": 56, "y": 419, "width": 239, "height": 12 },
     "counters": { "pd": 1, "pm": 9, "pu": 1 },
     "deltaY": 80,
     "cursor": "ns-resize"
   }
   ```

   Source fix: pointer-capture divider handlers at `src/app/(dev)/react-figma/page.tsx:2593-2599`; 12px hit-area separator at `src/app/(dev)/react-figma/page.tsx:2700-2707`.

## Cleanup

The draw probe intentionally wrote source and was restored with `/tmp/s58-e6-draw-probe.patch`.

During the live run, the app also generated an untracked default create-page scaffold:

```text
src/app/(dev)/react-figma-pages/new-page/page.tsx
```

It matched the app's `create-page` scaffold, was outside the requested closure target, and was removed to restore the frozen source tree. Final source status is clean except untracked `test-results/`.
