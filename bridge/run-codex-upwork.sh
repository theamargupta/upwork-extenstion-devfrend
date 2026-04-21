#!/usr/bin/env bash
# One-off launcher: run the Codex-owned upwork-apply runbook via Codex CLI.
#
# Preconditions (same as /upwork-apply):
#   - Extension loaded unpacked in Chrome, side panel open on Upwork.
#   - `upwork-agent` MCP server configured in ~/.codex/config.toml (stdio to bridge/mcp-server.js).
#   - Logged into Upwork.
#
# Usage:
#   ./bridge/run-codex-upwork.sh                          # finds a job via best-matches
#   ./bridge/run-codex-upwork.sh "<upwork job URL>"       # applies to a specific job
#
# Output: streams live + tees to bridge/codex-upwork-<timestamp>.log

set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_RUNBOOK="$REPO_ROOT/.codex/commands/upwork-apply.md"
CLAUDE_RUNBOOK="$REPO_ROOT/.claude/commands/upwork-apply.md"
RUNBOOK="$CODEX_RUNBOOK"
LOG="$REPO_ROOT/bridge/codex-upwork-$(date +%Y%m%d-%H%M%S).log"
TARGET_JOB="${1:-}"

command -v codex >/dev/null 2>&1 || { echo "codex CLI nahi mila. Install: https://github.com/openai/codex"; exit 1; }
if [ ! -f "$RUNBOOK" ]; then
  RUNBOOK="$CLAUDE_RUNBOOK"
fi
[ -f "$RUNBOOK" ] || { echo "Runbook missing: $CODEX_RUNBOOK or $CLAUDE_RUNBOOK"; exit 1; }

# Memory rules that live in Claude's memory dir and won't auto-load into Codex.
# Keep this block minimal — only rules not already in the runbook.
read -r -d '' MEMORY_PREAMBLE <<'PREAMBLE'
# MEMORY RULES (carried over from Claude Code — apply in addition to the runbook)

1. HARD STOP on yellow "preferred qualifications" / qualification-warning banner on the Apply page.
   Surface the banner text + Connects cost and ASK the user before filling the cover letter.
   Do NOT auto-dismiss or scroll past.

2. Skip clients from IN / PK. Skip jobs with effective rate below $25/hr.

3. Cloudflare Turnstile: never script-click it. If present, pause and ask the user to solve it manually.

4. Shortest-path search: best-matches feed first. Do NOT touch `/nx/search/`.

5. `upwork_apply_to_job` tool now supports both HOURLY and FIXED-PRICE natively —
   pass `milestones` + `duration` for fixed-price jobs, skip them for hourly.
   Only drop to the manual FP runbook in the command file if the high-level tool fails
   (e.g. selector drift, milestone re-render bug).

6. No code commits. You are operating the browser, not editing the repo.

PREAMBLE

TARGET_BLOCK=""
if [ -n "$TARGET_JOB" ]; then
  TARGET_BLOCK=$'\n# TARGET JOB\n\nApply to this specific job URL (skip search phase):\n\n'"$TARGET_JOB"$'\n'
else
  TARGET_BLOCK=$'\n# GOAL\n\nFind and shortlist Upwork jobs matching Amar'\''s profile from Best Matches. Present keepers + caveats, then stop for Amar to pick before applying.\n'
fi

echo "=== Codex upwork-apply started $(date) ===" | tee "$LOG"
echo "Runbook: $RUNBOOK" | tee -a "$LOG"
echo "Target:  ${TARGET_JOB:-<auto-discover from best-matches>}" | tee -a "$LOG"
echo "Log:     $LOG" | tee -a "$LOG"
echo "---" | tee -a "$LOG"

{
  echo "$MEMORY_PREAMBLE"
  echo "$TARGET_BLOCK"
  echo "# RUNBOOK"
  cat "$RUNBOOK"
  echo ""
  echo "---"
  echo "You have full approval to drive the Upwork tab via the upwork-agent MCP tools."
  echo "Do NOT ask for approval on tool calls. Do NOT submit an application without explicit user confirmation when any HARD STOP condition triggers."
  echo "Do NOT edit repo files. This is a browser-agent task, not a coding task."
} | codex exec \
    -m gpt-5.4 \
    -c model_reasoning_effort="xhigh" \
    -c approval_policy="never" \
    --sandbox workspace-write \
    --full-auto \
    --skip-git-repo-check \
    - 2>&1 | tee -a "$LOG"

EXIT=${PIPESTATUS[0]}
echo "---" | tee -a "$LOG"
echo "=== Codex exit $EXIT at $(date) ===" | tee -a "$LOG"
exit "$EXIT"
