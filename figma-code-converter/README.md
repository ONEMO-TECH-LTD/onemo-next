# figma-code-converter

Deterministic Figma → React/CSS-Modules compiler + audit console + conversion studio.
Zero LLM in the conversion path: the same frame always produces byte-identical code.

**Lives here** (repo root of onemo-next) because it is inseparable from the app: converted
screens render through the Next dev server, read the app's `tokens.css` and font library, and
promote into `src/app/(dev)/converted/`.

## The 3 ways in

| Surface | Start | What it is |
|---|---|---|
| **Studio** (the app) | `npm run studio` → `localhost:3900` | Paste a Figma link → converted, gate-checked screen as a tab. Sandbox / delete / override / promote. **[STUDIO.md](STUDIO.md)** |
| **Audit console** | part of the studio (or static `/audit-console.html`) | Inspect / Fidelity / Responsive / Theming / Structure per screen |
| **CLI** | `node bin/figma-to-code.mjs <cmd>` | `fetch` · `convert` · `check` · `watch` (live Figma-edit → rebuild with fail-closed visual gate) |

Prereq for rendering: the Next dev app running (`npm run dev`, port 3077). `FIGMA_TOKEN` comes
from the app's `.env.local` (see `studio/config.json`).

## How it is built

```
src/        the compiler: ir.mjs (Figma → IR, all layout laws) → emit.mjs (IR → TSX/CSS)
            reverse.mjs (round-trip gate) · canon-check.mjs (property order canon)
            conformance.mjs (token coverage/parity/fonts) · token-defs.mjs (theme-scoped resolver)
            fonts.mjs (packages woff2 per screen) · ds-naming.mjs (vendored naming authority)
census/     independent walker — must agree with the converter's element count
audit/      console.html (the UI) · audit-export.mjs (per-node audit.json backbone)
            anatomy.mjs · fidelity-gate.mjs · capture.mjs (Playwright) · sweep.mjs (responsive)
            theming.mjs · visual-diff.mjs
studio/     server.mjs (zero-dep node app, port 3900) · config.json (all paths/ports)
bin/        the CLI entry
test/       41 intent tests (`npm test`)
cache/      fetched Figma nodes + variable dump (gitignored; staleness-guarded)
SPEC.md · FIGMA-CANON.md · CODE-CANON.md   the laws the compiler obeys
```

**Every conversion runs four gates, all fail-loud:** census (independent count), canon
(property order), reverse round-trip (emitted CSS re-derives to the exact IR, diff 0),
conformance (every bound token resolves against the DS, value parity at frame width).
Anything unreproducible is a ledgered approximation — never silent.
