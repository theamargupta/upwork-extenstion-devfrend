#!/usr/bin/env bash
# PreToolUse for Bash — blocks git commands that reference config.js (the credentials file).
set -euo pipefail
input="$(cat)"
command="$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
case "$command" in
  *"git add"*|*"git commit"*)
    if printf '%s' "$command" | grep -qE '(^|[[:space:]/])config\.js([[:space:]]|$)'; then
      echo "Blocked: config.js contains Supabase credentials — must stay gitignored." >&2
      exit 2
    fi
    ;;
esac
exit 0
