#!/bin/bash
# audit-session-writes.sh — Stop hook
# Checks that Linear writes during this session were all verified.
# Blocks session end if there are FAILED writes or if no handoff sub-issue was created.
#
# Reads from: /tmp/claude-linear-session/writes.log
# Format per line: TIMESTAMP|OPERATION|ISSUE_ID|DETAIL|STATUS
#
# Handoff protocol (DEC APM-61): Each session creates a handoff sub-issue
# under a day issue under APM-2. The hook checks for create_issue writes
# with the handoff label pattern.
#
# Exit 2 = block session end (user sees warning)
# Exit 0 = allow

LOG_DIR="/tmp/claude-linear-session"
LOG_FILE="${LOG_DIR}/writes.log"

# If no log file exists, session had no Linear writes — allow
if [ ! -f "$LOG_FILE" ]; then
  exit 0
fi

# Check for FAILED writes
FAILED=$(grep "|FAILED$" "$LOG_FILE" 2>/dev/null)
if [ -n "$FAILED" ]; then
  FAIL_COUNT=$(echo "$FAILED" | wc -l | tr -d ' ')
  echo "LINEAR AUDIT: ${FAIL_COUNT} FAILED write(s) detected this session. Fix before ending:" >&2
  echo "$FAILED" | while IFS='|' read -r ts op issue detail status; do
    echo "  - ${ts}: ${op} on ${issue} — ${status}" >&2
  done
  exit 2
fi

# Check for handoff creation (new protocol: sub-issue under day issue under APM-2)
# We look for any create_issue call that succeeded — the handoff sub-issue
HANDOFF_CREATED=$(grep "|create_issue|" "$LOG_FILE" 2>/dev/null | grep "|SUCCESS$")
# Also accept update_issue or create_comment on APM-2 hierarchy as valid handoff activity
APM2_ACTIVITY=$(grep -E "\|(update_issue|create_comment)\|APM-" "$LOG_FILE" 2>/dev/null | grep "|SUCCESS$")

if [ -z "$HANDOFF_CREATED" ] && [ -z "$APM2_ACTIVITY" ]; then
  echo "LINEAR AUDIT: No handoff sub-issue created this session. Create one under today's day issue (APM-2 hierarchy) before ending." >&2
  echo "  Protocol: create day issue under APM-2 if needed, then create handoff sub-issue under the day issue." >&2
  exit 2
fi

# DEC APM-167: Decision vault enforcement — check if DEC issues were created but vault not modified
DEC_ISSUES=$(grep "|create_issue|" "$LOG_FILE" 2>/dev/null | grep -i "DEC\|decision" | grep "|OK$\|SUCCESS$")
if [ -n "$DEC_ISSUES" ]; then
  BRAIN_REPO=""
  CWD_PARENT="$(cd "$(pwd)/.." 2>/dev/null && pwd)"
  if [ -d "$CWD_PARENT/kai-solo-brain" ]; then
    BRAIN_REPO="$CWD_PARENT/kai-solo-brain"
  elif [ -d "$HOME/Dev/onemo-dev/kai-solo-brain" ]; then
    BRAIN_REPO="$HOME/Dev/onemo-dev/kai-solo-brain"
  fi
  if [ -n "$BRAIN_REPO" ]; then
    VAULT_MODIFIED=$(cd "$BRAIN_REPO" && git diff --name-only HEAD 2>/dev/null | grep "universal-decisions.md")
    VAULT_COMMITTED=$(cd "$BRAIN_REPO" && git log --oneline --since="4 hours ago" --all -- "memory/decisions/universal-decisions.md" 2>/dev/null)
    if [ -z "$VAULT_MODIFIED" ] && [ -z "$VAULT_COMMITTED" ]; then
      echo "DECISION VAULT AUDIT (APM-167): DEC-related issues were created in Linear but the vault (universal-decisions.md) was NOT updated. Write decisions to vault before ending." >&2
    fi
  fi
fi

# All clear
exit 0
