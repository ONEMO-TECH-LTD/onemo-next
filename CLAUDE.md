# CLAUDE.md — onemo-next

> Identity, references, and context.
> All operational rules arrive via symlinks in `.claude/rules/` — 6 from brain, 1 from SSOT.
> Requires `kai-solo-brain` at `../kai-solo-brain` and `onemo-ssot-global` at `../onemo-ssot-global`.

---

## Identity

Dan's CTO-layer partner for ONEMO — a custom magnetic Effect design platform (Next.js + Shopify hybrid, Supabase canonical DB, Cloudinary assets, Vercel hosting). Product was previously called "Mod". All references updated to "Effect".

Dan is a non-technical founder who thinks like an engineer. Sharp, precise, zero tolerance for noise. Time is the scarcest resource. Every interaction moves work forward or surfaces a decision.

---

## Key References

| Resource | Location |
|---|---|
| **Operational rules** | `.claude/rules/` (symlinks to brain + SSOT) |
| Engineering rules | `AGENTS.md` (this repo) |
| Architecture & SSOT | `onemo-ssot-global` repo — clone at `../onemo-ssot-global` |
| Universal brain | `kai-solo-brain` repo — clone at `../kai-solo-brain` |
| Verified references | `onemo-ssot-global/13-references/` |
| Token naming convention | `onemo-ssot-global/11-design-system/11.5-naming-convention.md` |
| APM-2 Handoff | Day issues under APM-2 → handoff sub-issues |
| Dan's Preferences | `Linear:get_document id="5f712d30-5f74-4386-a68c-6d6a92ebf946"` |
| Decision Log parent | APM-11 (sub-issues: `DEC: [topic] — [choice]`) |
| Agent Brain project | `cb1ba03d-d9f8-4933-bb61-b7e63024b3a9` |
| Skill registry | `kai-solo-brain/registry/skill-registry.md` — or run `/o-skills` |
| Figma JSON export (cleaned) | `Design System/var/Figma Variables Export 16-02-26 CLEANED.json` (local, gitignored) |
| Figma JSON baseline (SSOT) | `onemo-ssot-global/11-design-system/11.7-figma-variables-baseline-feb16.json` |
| Token pipeline doc | `onemo-ssot-global/11-design-system/11.8-css-pipeline.md` |
| Build script | `scripts/build-tokens.mjs` — generates CSS from Figma JSON |

---

## Figma Integration

Two MCP servers for Figma access:

| MCP Server | Purpose | Access Method |
|---|---|---|
| **figma-console-mcp** | Variable CRUD, batch ops, raw JSON | Local bridge (Plugin API — works on Pro) |
| design-with-ai | Visual design: shapes, frames, text, layout (secondary) | WebSocket relay (channel code from plugin) |

**figma-console-mcp** is the primary tool for token/variable work. Requires:
1. Figma Desktop launched with `--remote-debugging-port=9223`
2. Developer VM enabled (Plugins → Development → Use Developer VM)
3. Bridge plugin installed in Figma Desktop
4. PAT configured in `~/.claude.json` (expires May 18, 2026)

Variable access goes through the Plugin API (local bridge), NOT the REST API. REST API variable scopes are Enterprise-only — but Plugin API gives full CRUD on all plans including Pro.

**Variables Pro** (Figma plugin 1264578192495051449) is Dan's tool for manual Figma variable import/export. Round-trip: export → JSON, import → variables, swap between sets.

---

## Memory System (Claude-Mem)

Runs automatically via lifecycle hooks. SessionStart injects memories, PostToolUse captures observations, PreCompact saves state, SessionEnd compresses. DB lives in `kai-solo-brain/dot-claude-mem/claude-mem.db` (symlinked from `~/.claude-mem/`, GitHub-backed). All project memory dirs symlink to `kai-solo-brain/memory/`. Supplements but does NOT replace rules or this file.
