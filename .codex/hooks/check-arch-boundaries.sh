#!/usr/bin/env bash
set -euo pipefail

input="$(cat || true)"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$repo_root" ]]; then
  exit 0
fi
cd "$repo_root"

extract_file_paths() {
  local payload="$1"

  if [[ -n "$payload" ]]; then
    printf '%s' "$payload" | jq -r '
      [
        .file_path?,
        .filePath?,
        .path?,
        .input.file_path?,
        .input.filePath?,
        .tool_input.file_path?,
        .tool_input.filePath?,
        .toolInput.file_path?,
        .toolInput.filePath?,
        .args.file_path?,
        .args.filePath?
      ]
      | map(select(type == "string" and length > 0))
      | .[]
    ' 2>/dev/null || true
  fi

  if [[ -n "${CODEX_TOOL_INPUT:-}" ]]; then
    printf '%s' "$CODEX_TOOL_INPUT" | jq -r '.file_path? // .filePath? // empty' 2>/dev/null || true
  fi
}

collect_changed_js() {
  git status --porcelain -z -- src 2>/dev/null |
    while IFS= read -r -d '' entry; do
      path="${entry:3}"
      [[ "$path" == src/*.js ]] && printf '%s\n' "$path"
    done
}

candidate_files=()
while IFS= read -r candidate; do
  candidate_files+=("$candidate")
done < <(
  {
    extract_file_paths "$input"
    collect_changed_js
  } | awk 'NF && !seen[$0]++'
)

for file_path in "${candidate_files[@]}"; do
  [[ "$file_path" == /* ]] || file_path="$repo_root/$file_path"
  [[ -f "$file_path" ]] || continue

  rel_path="${file_path#$repo_root/}"
  violations=()

  if [[ "$rel_path" =~ components/ ]] && [[ "$rel_path" =~ \.js$ ]]; then
    if grep -qE '(setState|setIn\s*\(|sabaki\.)' "$file_path" 2>/dev/null; then
      violations+=("Component appears to modify state directly: setState/setIn/sabaki. call detected.")
    fi
  fi

  if [[ "$rel_path" =~ sabaki\.js$ ]]; then
    if grep -qE '(engine|\.play|\.pause|getElementById|querySelector)' "$file_path" 2>/dev/null; then
      violations+=("Store appears to call engine or UI APIs directly.")
    fi
  fi

  if [[ "${#violations[@]}" -gt 0 ]]; then
    printf '\n[Codex guardrail] Architecture boundary warning.\n'
    printf 'File: %s\n' "$rel_path"
    for violation in "${violations[@]}"; do
      printf '%s\n' "- $violation"
    done
    exit 2
  fi
done

exit 0
