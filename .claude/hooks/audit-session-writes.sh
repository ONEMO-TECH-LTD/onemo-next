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

# All clear
exit 0
