#!/bin/bash
# s58 durable lead watcher — runs detached (survives the lead's Claude session).
# Polls the engine build every 5 min; logs everything; DMs @s58-lead only on a material change/flag.
# Kill: touch /Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-watch/STOP  (or: pkill -f s58-watch/watch.sh)

DIR="/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-watch"
WT="/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-figma-engine"
LIB="/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library"
LOG="$DIR/watch.log"
STATE="$DIR/last_head"
KAIMSG="$(command -v kai-msg)"
START=$(date +%s)

mkdir -p "$DIR"
echo "$(date '+%Y-%m-%d %H:%M:%S') WATCHER START pid=$$" >> "$LOG"

while true; do
  # kill switch + 7-day auto-expiry
  [ -f "$DIR/STOP" ] && { echo "$(date '+%H:%M:%S') STOP file — exiting" >> "$LOG"; rm -f "$DIR/STOP"; exit 0; }
  [ $(( $(date +%s) - START )) -gt 604800 ] && { echo "$(date '+%H:%M:%S') 7d expiry — exiting" >> "$LOG"; exit 0; }

  ts=$(date '+%H:%M:%S')
  flag=""

  # 1) new commit on the engine branch
  head=$(git -C "$WT" rev-parse --short HEAD 2>/dev/null)
  last=$(cat "$STATE" 2>/dev/null)
  if [ -n "$head" ] && [ "$head" != "$last" ]; then
    line=$(git -C "$WT" log --oneline -1 2>/dev/null)
    echo "$ts COMMIT $line" >> "$LOG"
    flag="$flag | new commit: $line"
    echo "$head" > "$STATE"
  fi

  # 2) engine worktree dirty — LOG ONLY, never a flag: during an active build the worktree is always
  #    dirty (in-progress edits + test probes). Only LIBRARY pollution (#3) and editor-500 (#4) are real.
  wtpoll=$(git -C "$WT" status --porcelain 2>/dev/null | grep -vE '\.next|tsbuildinfo|next-env' )
  [ -n "$wtpoll" ] && echo "$ts WT-DIRTY(info) $(echo "$wtpoll" | tr '\n' ';')" >> "$LOG"

  # 3) CRITICAL: two-repo pollution in the component library (the thing that 500'd the editor)
  libpoll=$(git -C "$LIB" status --porcelain 2>/dev/null)
  [ -n "$libpoll" ] && { echo "$ts LIB-POLLUTION $(echo "$libpoll" | tr '\n' ';')" >> "$LOG"; flag="$flag | CRITICAL library pollution: $(echo "$libpoll" | head -3 | tr '\n' ';')"; }

  # 4) editor hard-break (500 = real build error; timeouts/000 = recompiling, ignored)
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://localhost:3025/react-figma 2>/dev/null)
  [ "$code" = "500" ] && { echo "$ts EDITOR-500" >> "$LOG"; flag="$flag | editor HTTP 500 (build broken)"; }

  # escalate to the lead ONLY when the flag set CHANGES (dedupe — no 5-min spam on a standing condition)
  if [ -n "$flag" ]; then
    sig=$(echo "$flag" | md5 2>/dev/null || echo "$flag" | md5sum 2>/dev/null)
    lastsig=$(cat "$DIR/last_sig" 2>/dev/null)
    if [ "$sig" != "$lastsig" ]; then
      [ -n "$KAIMSG" ] && "$KAIMSG" send @s58-lead "[WATCHER $ts]${flag}" >/dev/null 2>&1
      echo "$sig" > "$DIR/last_sig"
    fi
  else
    rm -f "$DIR/last_sig"
  fi

  sleep 300
done
