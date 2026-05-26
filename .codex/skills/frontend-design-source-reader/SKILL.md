---
name: frontend-design-source-reader
description: Sabaki frontend visual source reader. Use to read UI specs, screenshots/Figma refs, CSS, and components before visual contract design.
---

# Frontend Design Source Reader

Use this skill under `$frontend-visual-workflow`.

## 提交要求

本 skill 完成后，workflow dispatcher 必须先创建一次 git commit，再进入下一个 agent、skill 或 workflow step。

- 如果写入了视觉真源索引或 checklist 更新，只提交这些本 skill 产出的文件。
- 如果本 skill 只读且没有文件改动，使用 `git commit --allow-empty` 创建空提交。
- 提交信息使用 `frontend-design-source-reader: <step summary>` 格式。
- 不得提交其他步骤或用户已有的无关改动。

Input:

- User goal.
- One planner step payload when Phase Intake produced a step plan.
- UI/UX specs, screenshots, Figma refs, or design notes.
- Current CSS/components.

Output:

- Visual source index with exact source refs.
- Required layout, dimensions, token names, copy, states, responsive behavior, screenshot/manual acceptance expectations.
- Current implementation gaps.

This role is read-only unless the active workflow asks for an archived source index. Do not write tests or production code.
