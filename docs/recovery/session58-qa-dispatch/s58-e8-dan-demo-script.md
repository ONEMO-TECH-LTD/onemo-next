# E8 — Dan's acceptance demo script (the goal's final gate)

Build: http://localhost:3025/react-figma · HEAD 4c41997 (frozen, both QA gates running)
Hard-reload first (⌘⇧R).

## 1 · Run the deterministic audits yourself (30 sec — this is the "no agent discipline" proof)
In any terminal:
```
cd ~/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-figma-engine
node editor-engine/audit/inspector-conformance.mjs   # anatomy matrix vs the measured Figma contract
node editor-engine/audit/input-behavior.mjs          # real-input behavior gates
```
Green = every value matches the contract measured from YOUR Figma file; any drift prints the exact field + expected vs actual and exits red. Run twice — output is identical (determinism proven).

## 2 · Click-through per goal item
1/5 — select any element: every input is Inter 11px in the 24px grey field, exact Figma ink.
2/3 — click ⬡ on X-position, pick any variable → the pill shows the RAW VALUE in a white capsule (the capsule IS the badge; plain values get none). Hover the pill → full Figma name. CLICK the pill → picker reopens WITH that variable highlighted blue and scrolled into view.
4 — picker rows are Figma original names (groups from the variable path), raw value right-aligned; type in Search.
6/7 — drag the right panel's left edge: stops at 241 min / 480 max; the input fields grow with it, never below Figma's 88px.
8 — scroll the inspector: Link To is the last section; type a URL, Enter — one clean link write.
9 — Scroll row: Visible/Hidden/Scroll/Auto → live overflow. Interactions section (before Link): Hover + Tap rows (Opacity %, Scale) → writes REAL .cls:hover / .cls:active rules into the element's CSS module (inline-styled elements show the honest 'extract to a component first' message).
10 — select an element, type 45 in Rotation, Enter → shows 45°; ⌘Z → previous value back. Change the frame preset → ⌘Z restores the frame.
11 — type into any field, DON'T press Enter, click anywhere else → value snaps back, nothing applied. Enter → applies.
12 — hover any field's leading icon → ←→ cursor; drag left/right → value scrubs; release → single change (one ⌘Z undoes it).

## 3 · What is NOT claimed
- Acceptance — this document is the request for it, not the claim of it.
