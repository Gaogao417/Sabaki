#!/usr/bin/env bash
# Auto-commit test-writer output.
#
# This hook is intentionally narrow:
# - it only runs for a turn whose transcript shows a test-writer subagent run
# - it only commits test code under test/
# - it leaves contract docs and unrelated staged files alone

set -euo pipefail

HOOK_INPUT="$(cat || true)"

TRANSCRIPT_PATH="$(
  printf '%s' "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true
)"

INPUT_CWD="$(
  printf '%s' "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true
)"

is_test_writer_turn() {
  [[ -n "$TRANSCRIPT_PATH" && -r "$TRANSCRIPT_PATH" ]] || return 1

  jq -s -e '
    def content_items:
      (.message.content // [])
      | if type == "array" then .[] else empty end;

    def is_real_user_prompt:
      .type == "user"
      and any(content_items;
        .type == "text"
        and ((.text // "") | startswith("<ide_") | not)
      );

    def is_test_writer_call:
      .type == "assistant"
      and any(content_items;
        .type == "tool_use"
        and ((.name == "Agent") or (.name == "Task"))
        and ((.input.subagent_type // "") == "test-writer")
      );

    def is_test_writer_result:
      .type == "user"
      and ((.toolUseResult.agentType // "") == "test-writer");

    (to_entries | map(select(.value | is_real_user_prompt)) | last | .key // -1) as $last_prompt
    | any(to_entries[] | select(.key > $last_prompt) | .value;
        is_test_writer_call or is_test_writer_result
      )
  ' "$TRANSCRIPT_PATH" >/dev/null 2>&1
}

if ! is_test_writer_turn; then
  exit 0
fi

START_DIR="${CLAUDE_PROJECT_DIR:-${INPUT_CWD:-}}"
if [[ -n "$START_DIR" ]]; then
  cd "$START_DIR" 2>/dev/null || exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || exit 0)"
[[ -z "$REPO_ROOT" ]] && exit 0

cd "$REPO_ROOT"

commit_files=()
while IFS= read -r -d '' entry; do
  path="${entry:3}"
  [[ -n "$path" ]] && commit_files+=("$path")
done < <(git status --porcelain -z -- test/ 2>/dev/null)

if [[ "${#commit_files[@]}" -eq 0 ]]; then
  exit 0
fi

git add -- "${commit_files[@]}"

if git diff --cached --quiet -- "${commit_files[@]}"; then
  exit 0
fi

git commit --only -m "Add test code

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>" -- "${commit_files[@]}"
