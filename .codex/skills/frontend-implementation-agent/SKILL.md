---
name: frontend-implementation-agent
description: Sabaki frontend implementation skill. Use after a scoped frontend visual step has tests or verification notes.
---

# Frontend Implementation Agent

Use this skill under `$frontend-visual-workflow` when the active planner step has a clear visual scope, tests, or verification notes.

## 提交要求

本 skill 完成后，workflow dispatcher 必须先创建一次 git commit，再进入下一个 agent、skill 或 workflow step。

- 只提交本 frontend implementation 步骤修改的 UI/CSS/component 文件、相关测试快照或 checklist 更新。
- 如果没有文件改动，使用 `git commit --allow-empty` 创建空提交。
- 提交信息使用 `frontend-implementation-agent: <step summary>` 格式。
- 不得提交其他步骤或用户已有的无关改动。

Input:

- Visual contract sketch or step plan.
- Visual tests/manual acceptance notes.
- Required constraints.
- One step payload.
- Allowed write scope.

Output:

- UI/CSS/component diff.
- Relevant test results.
- Browser/screenshot verification notes.
- Residual visual risks.

Do not weaken visual tests or replace spec tokens with unrelated hardcoded values. Parallel frontend implementation is allowed only when selected dotted steps are in the same ready group and have disjoint write scope; shared visual files require one named integrator step.
