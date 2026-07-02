#!/bin/zsh
# ONEMO Storybook auto-launcher — boots the dev server (if down) and opens it.
CONS="/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-consolidation"
PORT=6017

if ! curl -sf -o /dev/null "http://localhost:${PORT}/index.json"; then
  echo "Starting ONEMO Storybook on :${PORT}…"
  (cd "$CONS" && nohup npm run storybook -- -p "${PORT}" --ci >/tmp/onemo-storybook.log 2>&1 &)
  for i in {1..50}; do
    curl -sf -o /dev/null "http://localhost:${PORT}/index.json" && break
    sleep 3
  done
fi

open -a "Google Chrome" "http://localhost:${PORT}"
