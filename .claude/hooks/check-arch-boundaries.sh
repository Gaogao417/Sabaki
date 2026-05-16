#!/bin/bash
# 检查修改的文件是否违反 resolver/store/component 边界
# 用法：由 PostToolUse hook 调用

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

VIOLATIONS=""

# 检查 component 是否直接修改 store（sabaki.js 的 setState）
if [[ "$FILE_PATH" =~ components/ ]] && [[ "$FILE_PATH" =~ \.js$ ]]; then
  if grep -qE '(setState|setIn\s*\(|sabaki\.)' "$FILE_PATH" 2>/dev/null; then
    VIOLATIONS="$VIOLATIONS\n⚠️ Component 直接修改状态：检测到 setState/setIn/sabaki. 调用"
  fi
fi

# 检查 store 是否调用了 engine/UI
if [[ "$FILE_PATH" =~ sabaki\.js$ ]]; then
  if grep -qE '(engine|\.play|\.pause|getElementById|querySelector)' "$FILE_PATH" 2>/dev/null; then
    VIOLATIONS="$VIOLATIONS\n🔴 Store 调用 engine/UI：store 不应直接调用引擎或 UI"
  fi
fi

if [ -n "$VIOLATIONS" ]; then
  echo ""
  echo -e "$VIOLATIONS"
  echo "   文件：$FILE_PATH"
  exit 2
fi

exit 0
