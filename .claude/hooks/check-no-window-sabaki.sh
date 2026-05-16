#!/bin/bash
# 检查修改的文件是否引入了 window.sabaki 全局查找
# 用法：由 PostToolUse hook 调用，检查 Claude 编辑/写入的文件

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//')

# 只检查 src/ 下的 js 文件
if [ -z "$FILE_PATH" ] || [[ ! "$FILE_PATH" =~ ^.*src/.*\.js$ ]]; then
  exit 0
fi

if grep -q 'window\.sabaki' "$FILE_PATH" 2>/dev/null; then
  echo ""
  echo "⛔ 架构违规：检测到 window.sabaki 全局查找"
  echo "   文件：$FILE_PATH"
  echo "   架构规则：禁止 window.sabaki 全局查找，除非明确允许"
  echo "   请改用依赖注入或 resolver/executor 模式"
  exit 2
fi

exit 0
