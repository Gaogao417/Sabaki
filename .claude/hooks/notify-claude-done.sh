#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

session_id="$(echo "$input" | jq -r '.session_id')"
cwd="$(echo "$input" | jq -r '.cwd')"
project="$(basename "$cwd")"
short_id="$(echo "$session_id" | cut -c1-8)"

cache_file="/tmp/claude-code-session-titles/$session_id"

if [ -f "$cache_file" ]; then
  session_title="$(cat "$cache_file")"
else
  session_title="$project | session $short_id"
fi

message="Done: ${session_title//\"/\\\"}"
subtitle="Resume: claude -r ${short_id}..."

afplay /System/Library/Sounds/Glass.aiff >/dev/null 2>&1 &

osascript -e "display notification \"$subtitle\" with title \"$message\""
