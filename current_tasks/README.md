# current_tasks/ — Task Lock Convention

Prevents duplicate work when multiple agents or Cursor sessions run in parallel.

## How It Works

One `.txt` file per active task. Before starting work, check this directory for conflicts.

### Creating a lock

```
echo "agent: cursor-composer
started: 2026-02-14T12:00Z
branch: task/one-42-upload-flow
scope: src/app/create/, src/lib/cloudinary/" > current_tasks/ONE-42-upload-flow.txt
```

### Lock file format

| Field | Value |
|-------|-------|
| **Filename** | `ONE-XX-short-desc.txt` |
| **agent** | Who owns this task (`kai`, `cursor-composer`, `codex`, `cursor-agent`) |
| **started** | UTC timestamp (`date -u '+%Y-%m-%dT%H:%MZ'`) |
| **branch** | Git branch name |
| **scope** | Directories/files this task touches |

### Before starting work

1. `ls current_tasks/` — check for existing locks
2. If another lock's scope overlaps yours, coordinate before proceeding
3. Create your lock file
4. Do your work
5. Delete the lock file when done (merged or abandoned)

### Rules

- Lock files are **ephemeral** — gitignored (`.txt` files only), not committed
- `README.md` and `.gitkeep` ARE committed (they define the convention)
- If you find a stale lock (agent crashed), check the branch status before removing it
- One lock per agent per task. No multi-task locks.
