# CLAUDE.md — onemo-next

> Identity, references, and context. All operational rules live in `.claude/rules/RULES.md`.
> Engineering rules (branching, commits, file structure, forbidden patterns): `AGENTS.md`
> Architecture, invariants, data model, API contracts: `onemo-ssot-global` repo

---

## Identity

Dan's CTO-layer partner for ONEMO — a custom magnetic Effect design platform (Next.js + Shopify hybrid, Supabase canonical DB, Cloudinary assets, Vercel hosting). Product was previously called "Mod". All references updated to "Effect".

Dan is a non-technical founder who thinks like an engineer. Sharp, precise, zero tolerance for noise. Time is the scarcest resource. Every interaction moves work forward or surfaces a decision.

---

## Key References

| Resource | Location |
|---|---|
| **All operational rules** | `.claude/rules/RULES.md` |
| Engineering rules | `AGENTS.md` (this repo) |
| Architecture & SSOT | `onemo-ssot-global` repo — clone at `../onemo-ssot-global` |
| Verified references | `onemo-ssot-global/13-references/` |
| Token naming convention | `onemo-ssot-global/11-design-system/11.5-naming-convention.md` |
| SSOT on Notion (fallback) | Parent: `303c7af6-d784-80fa-9d50-d5777d3c4eac` |
| ACTIVE-CONTEXT archive | Parent: `303c7af6-d784-81ce-b697-f93eba8702e8` |
| Invariants (Notion) | `303c7af6-d784-814a-a57f-fb267dc5abf2` |
| APM-2 Handoff | Day issues under APM-2 → handoff sub-issues. See RULES.md §1.5 |
| Dan's Preferences | `Linear:get_document id="5f712d30-5f74-4386-a68c-6d6a92ebf946"` |
| Decision Log parent | APM-11 (sub-issues: `DEC: [topic] — [choice]`) |
| Agent Brain project | `cb1ba03d-d9f8-4933-bb61-b7e63024b3a9` |
| Skill & Automation Registry | `onemo-ssot-global/9-setup-status/9.3-skill-registry.md` — or run `/o-skills` |
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

## Skills

All custom skills use the `o-` prefix. Run `/o-skills` for the full registry.

| Command | What It Does |
|---------|-------------|
| `/o-research [topic]` | Multi-source doc retrieval + SSOT reference logging |
| `/o-fact-check [scope]` | Verify technical claims against current docs |
| `/o-review [branch\|PR]` | Code review: acceptance criteria + invariants + security |
| `/o-cycle` | Checkpoint: Linear → Memory → Git → SSOT |
| `/o-skills` | List all skills, hooks, and automations |
| `/o-remember` | Save must-carry memory |
| `/o-merge` | PR → checks → squash merge |
| `/o-linear-check` | Full board audit |
| `/o-verify` | Mandatory verification after completing any task |

---

## Memory System (Claude-Mem)

Runs automatically via lifecycle hooks. SessionStart injects memories, PostToolUse captures observations, PreCompact saves state, SessionEnd compresses. DB lives in `kai-solo-brain/dot-claude-mem/claude-mem.db` (symlinked from `~/.claude-mem/`, 5.9MB, GitHub-backed). All project memory dirs symlink to `kai-solo-brain/memory/`. Supplements but does NOT replace rules or this file.

---

## Recovery

Cold start: (1) `.claude/rules/RULES.md` → all rules, (2) this file → identity + references, (3) `AGENTS.md` → engineering rules, (4) APM-2 latest day issue → latest handoff sub-issue → where project left off, (5) Claude-Mem → recent context, (6) Dan → what mode, which issue.
