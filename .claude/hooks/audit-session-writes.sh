#!/bin/bash
# audit-session-writes.sh — Stop hook
# Checks that Linear writes during this session were all verified.
# Blocks session end if there are FAILED writes or if no APM-2 update was logged.
#
# Reads from: /tmp/claude-linear-session/writes.log
# Format per line: TIMESTAMP|OPERATION|ISSUE_ID|DETAIL|STATUS
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

# Check for APM-2 update (handoff must be updated each session)
APM2_UPDATE=$(grep "|update_issue|APM-2|" "$LOG_FILE" 2>/dev/null)
APM2_COMMENT=$(grep "|create_comment|APM-2|" "$LOG_FILE" 2>/dev/null)
if [ -z "$APM2_UPDATE" ] && [ -z "$APM2_COMMENT" ]; then
  echo "LINEAR AUDIT: No APM-2 update detected this session. Update the handoff before ending." >&2
  exit 2
fi

# All clear
exit 0
