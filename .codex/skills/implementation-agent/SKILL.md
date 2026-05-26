---
name: implementation-agent
description: Sabaki execution skill for implementing business/state/architecture or Workbench wiring steps after focused tests exist.
---

# Implementation Agent

Use this skill after the active planner step has a clear scope and focused tests or verification notes.

## 提交要求

本 skill 完成后，workflow dispatcher 必须先创建一次 git commit，再进入下一个 agent、skill 或 workflow step。

- 只提交本 implementation 步骤修改的生产文件、必要测试更新和 checklist 更新。
- 如果没有文件改动，使用 `git commit --allow-empty` 创建空提交。
- 提交信息使用 `implementation-agent: <step summary>` 格式。
- 不得提交其他步骤或用户已有的无关改动。

Input:

- Contract sketch or step plan.
- Focused tests and review notes.
- Required constraints.
- One step payload.
- Allowed write scope.

Output:

- Production diff.
- Touched files.
- Verification results.
- Residual risk notes.

Do not weaken tests or reinterpret the step scope. Parallel implementation is allowed only when selected dotted steps are in the same ready group and have disjoint write scope; shared production files require one named integrator step.
