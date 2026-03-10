#!/bin/bash
# protect-worktree-cwd.sh
# PreToolUse hook on Bash: blocks git worktree remove when targeting current CWD.
# Solves DEC APM-157: prevents a session from deleting its own working directory.
#
# Root cause: on Feb 22, a session running inside a worktree ran
# "git worktree remove --force" on its own CWD, killing both active sessions.
#
# This hook reads $TOOL_INPUT (the Bash command about to execute) and blocks
# if it contains "git worktree remove" targeting the current directory.

# Only care about Bash tool calls containing "git worktree remove"
COMMAND="${TOOL_INPUT_command:-}"

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Quick check — if command doesn't mention worktree remove, allow
case "$COMMAND" in
  *"git worktree remove"*|*"git worktree prune"*)
    ;;
  *)
    exit 0
    ;;
esac

# Get current working directory (resolved, no symlinks)
CURRENT_CWD="$(pwd -P)"

# Check if we're inside a worktree
WORKTREE_DIR=""
if git rev-parse --git-common-dir >/dev/null 2>&1; then
  GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null)"
  GIT_DIR="$(git rev-parse --git-dir 2>/dev/null)"
  # If git-dir != git-common-dir, we're in a worktree
  if [ "$GIT_DIR" != "$GIT_COMMON" ] && [ "$GIT_DIR" != "." ]; then
    WORKTREE_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
  fi
fi

# If we're in a worktree, check if the remove command targets our worktree
if [ -n "$WORKTREE_DIR" ]; then
  WORKTREE_DIR_RESOLVED="$(cd "$WORKTREE_DIR" 2>/dev/null && pwd -P)"

  # Extract the path argument from the git worktree remove command
  # Pattern: git worktree remove [--force] <path>
  REMOVE_TARGET=""
  IN_REMOVE=0
  for word in $COMMAND; do
    if [ "$word" = "remove" ] && [ "$IN_REMOVE" = "0" ]; then
      IN_REMOVE=1
      continue
    fi
    if [ "$IN_REMOVE" = "1" ]; then
      case "$word" in
        --force|-f)
          continue
          ;;
        *)
          REMOVE_TARGET="$word"
          break
          ;;
      esac
    fi
  done

  if [ -n "$REMOVE_TARGET" ]; then
    # Resolve the target path
    TARGET_RESOLVED="$(cd "$REMOVE_TARGET" 2>/dev/null && pwd -P)"

    # Block if the target is our CWD or an ancestor
    case "$CURRENT_CWD" in
      "$TARGET_RESOLVED"*|"$WORKTREE_DIR_RESOLVED"*)
        if [ "$TARGET_RESOLVED" = "$WORKTREE_DIR_RESOLVED" ] || [ "$REMOVE_TARGET" = "." ]; then
          echo '{"decision":"block","reason":"BLOCKED: Cannot remove the worktree you are currently running inside. This would kill the session. Run worktree cleanup from the main worktree instead."}' >&2
          exit 2
        fi
        ;;
    esac
  fi

  # Also block "git worktree prune" from inside a worktree (it can remove our link)
  case "$COMMAND" in
    *"git worktree prune"*)
      echo '{"decision":"block","reason":"BLOCKED: git worktree prune from inside a worktree can remove the link to this worktree. Run from the main worktree instead."}' >&2
      exit 2
      ;;
  esac
fi

# Not targeting our CWD — allow
exit 0
