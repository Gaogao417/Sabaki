#!/usr/bin/env bash
set -euo pipefail

input="$(cat || true)"

json_value() {
  local expr="$1"
  printf '%s' "$input" | jq -r "$expr // empty" 2>/dev/null || true
}

session_id="$(json_value '.session_id // .sessionID // .thread_id // .threadID')"
cwd="$(json_value '.cwd // .directory // .project_dir // .projectDir')"
prompt="$(json_value '.prompt // .message // .input.prompt')"

if [[ -z "$session_id" ]]; then
  session_id="${CODEX_THREAD_ID:-${CODEX_SESSION_ID:-manual}}"
fi

if [[ -z "$cwd" ]]; then
  cwd="$PWD"
fi

project="$(basename "$cwd")"
cache_dir="/tmp/codex-session-titles"
mkdir -p "$cache_dir"

cache_file="$cache_dir/$session_id"

if [[ ! -f "$cache_file" ]]; then
  title="$(printf '%s' "$prompt" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g' | cut -c1-48)"

  if [[ -z "$title" ]]; then
    title="$project"
  fi

  full_title="$project | $title"
  printf '%s\n' "$full_title" > "$cache_file"

  jq -nc --arg title "$full_title" '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      sessionTitle: $title
    }
  }'
else
  jq -nc '{}'
fi
