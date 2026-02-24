# KAI-80 — Codex Cloud Verification Runbook

This runbook provides a reproducible verification path for the KAI-80 acceptance criteria:

- all four repos connected,
- Codex SDK installed and tested,
- brain-context file visibility (`CLAUDE.md`, `AGENTS.md`),
- `codex mcp-server` availability,
- programmatic task creation.

## 1) Automated verification script

From `onemo-next`, run:

```bash
node scripts/verify-codex-cloud.mjs --sibling-root .. --bus-dir <path-to-bus-repo> --install-sdk --run-sdk-smoke
```

### Flags

- `--sibling-root`: parent folder containing `kai-solo-brain`, `onemo-next`, `onemo-ssot-global`, `onemo-theme`.
- `--bus-dir`: repo where SDK should be installed/tested.
- `--install-sdk`: runs `npm install @openai/codex-sdk` in bus repo.
- `--run-sdk-smoke`: executes a minimal SDK task-creation smoke test.

### Smoke test prerequisites

- `OPENAI_API_KEY` must be exported in the shell where the script runs.
- `codex` CLI should be installed for the `codex exec` and `codex mcp-server` checks.

## 2) Manual fallback commands

If you need to test each acceptance criterion manually:

```bash
# Repo connectivity
for repo in kai-solo-brain onemo-next onemo-ssot-global onemo-theme; do
  echo "== $repo =="
  test -d "../$repo" && (cd "../$repo" && git remote get-url origin && git branch --show-current)
done

# Brain context visibility
test -f ../kai-solo-brain/CLAUDE.md && echo "CLAUDE.md found"
test -f ../kai-solo-brain/AGENTS.md && echo "AGENTS.md found"

# CLI capabilities
codex --version
codex exec --help
codex mcp-server --help

# SDK and programmatic task creation (from bus repo)
cd <path-to-bus-repo>
npm install @openai/codex-sdk
node -e "import('@openai/codex-sdk').then(() => console.log('sdk import ok'))"
```

## 3) Current environment note (Codex cloud container)

In this containerized environment, companion repos and the `codex` binary may be absent.
If so, the script reports explicit blockers rather than silently passing checks.

That behavior is intentional so KAI-80 can be validated consistently both locally and in cloud containers.
