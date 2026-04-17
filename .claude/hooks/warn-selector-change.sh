#!/usr/bin/env bash
# PostToolUse for Edit/Write on content.js — remind about selector discipline.
set -euo pipefail
input="$(cat)"
file="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
case "$file" in
  */content.js)
    echo "[reminder] content.js changed — selectors are fragile. Test on job detail AND search pages before shipping." >&2
    ;;
esac
exit 0
