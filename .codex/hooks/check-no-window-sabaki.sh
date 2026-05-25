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

collect_changed_src_js() {
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
    collect_changed_src_js
  } | awk 'NF && !seen[$0]++'
)

for file_path in "${candidate_files[@]}"; do
  [[ "$file_path" == /* ]] || file_path="$repo_root/$file_path"
  [[ -f "$file_path" ]] || continue

  rel_path="${file_path#$repo_root/}"
  [[ "$rel_path" == src/*.js ]] || continue

  if grep -q 'window\.sabaki' "$file_path" 2>/dev/null; then
    printf '\n[Codex guardrail] Architecture violation: detected window.sabaki global lookup.\n'
    printf 'File: %s\n' "$rel_path"
    printf 'Rule: avoid window.sabaki unless explicitly approved as a legacy migration seam.\n'
    exit 2
  fi
done

exit 0
