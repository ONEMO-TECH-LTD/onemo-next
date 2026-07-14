# S58 P0 entry-seam audit ledger

Target: `ComponentCanvas.tsx` at product HEAD `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f`.

## Coverage

- [x] Lines 1-160
- [x] Lines 161-321
- [x] Full-read self-audit complete

## Notes

- The only project-component runtime is `require.context('../../react-figma-components', true, /\.tsx$/)` (lines 12-27).
- The authoritative `file` prop drives the component-mode API load (lines 111-137); the module key and export are then resolved exactly (lines 155-160).
- A successfully loaded canvas exposes `data-component-id={definition.id}` (lines 277-279), giving the stable rendered-identity seam for entry-path parity.
- Error, import-preview, and loading states are mutually exclusive before the loaded canvas (lines 254-270).
- `ComponentCanvas` has no entry-path state owner. The page owns `editingComponent`; A003/A004 therefore need to prove the same file, breadcrumb, and rendered `data-component-id`, not merely that a canvas became visible.
- Full-read self-audit found no second component-entry state owner or alternate rendered component identity.

## Required E2E delta

1. Start with a realistic project component already present, not created earlier in the same test.
2. Double-click its Components-rail row; capture the exact breadcrumb name/file and rendered `data-component-id`.
3. Return Home, open the same row through context-menu Edit, and assert the identical breadcrumb/file/`data-component-id`.
4. Assert neither path reloads the editor document, renders the legacy gallery, or requests `component-status` for another file.
5. Cover empty inventory separately: it must expose an actionable selection/extraction entry without a dead-end, after AC-X-001..003 establish a lawful real-page extraction path.

The current E2E's synthetic post-extraction double-click remains supporting evidence only. It cannot stamp AC-A-003 or AC-A-004 by itself.
