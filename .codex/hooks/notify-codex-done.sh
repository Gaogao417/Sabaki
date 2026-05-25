#!/usr/bin/env bash
set -euo pipefail

input="$(cat || true)"

json_value() {
  local expr="$1"
  printf '%s' "$input" | jq -r "$expr // empty" 2>/dev/null || true
}

session_id="$(json_value '.session_id // .sessionID // .thread_id // .threadID')"
cwd="$(json_value '.cwd // .directory // .project_dir // .projectDir')"

if [[ -z "$session_id" ]]; then
  session_id="${CODEX_THREAD_ID:-${CODEX_SESSION_ID:-manual}}"
fi

if [[ -z "$cwd" ]]; then
  cwd="$PWD"
fi

project="$(basename "$cwd")"
short_id="$(printf '%s' "$session_id" | cut -c1-8)"
cache_file="/tmp/codex-session-titles/$session_id"

if [[ -f "$cache_file" ]]; then
  session_title="$(cat "$cache_file")"
else
  session_title="$project | session $short_id"
fi

if command -v afplay >/dev/null 2>&1; then
  afplay /System/Library/Sounds/Glass.aiff >/dev/null 2>&1 &
fi

if command -v osascript >/dev/null 2>&1; then
  message="Done: ${session_title//\"/\\\"}"
  subtitle="Codex session $short_id"
  osascript -e "display notification \"$subtitle\" with title \"$message\"" >/dev/null 2>&1 || true
fi
