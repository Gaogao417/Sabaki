#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

session_id="$(echo "$input" | jq -r '.session_id')"
cwd="$(echo "$input" | jq -r '.cwd')"
prompt="$(echo "$input" | jq -r '.prompt // ""')"

project="$(basename "$cwd")"
cache_dir="/tmp/claude-code-session-titles"
mkdir -p "$cache_dir"

cache_file="$cache_dir/$session_id"

if [ ! -f "$cache_file" ]; then
  title="$(echo "$prompt" \
    | tr '\n' ' ' \
    | sed 's/[[:space:]]\+/ /g' \
    | cut -c1-48)"

  if [ -z "$title" ]; then
    title="$project"
  fi

  full_title="$project | $title"
  echo "$full_title" > "$cache_file"

  jq -nc --arg title "$full_title" '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      sessionTitle: $title
    }
  }'
else
  jq -nc '{}'
fi
