---
name: visual-test-writer
description: Sabaki visual test writer. Use after a frontend visual step plan or contract sketch to write visual/token/layout/screenshot tests.
---

# Visual Test Writer

Use this skill under `$frontend-visual-workflow` when the active planner step has visual source refs and an allowed test surface.

## 提交要求

本 skill 完成后，workflow dispatcher 必须先创建一次 git commit，再进入下一个 agent、skill 或 workflow step。

- 只提交本 visual-test-writer 步骤修改的视觉测试、Playwright/e2e、测试夹具和 checklist 更新。
- 如果没有文件改动，使用 `git commit --allow-empty` 创建空提交。
- 提交信息使用 `visual-test-writer: <step summary>` 格式。
- 不得提交生产实现文件，除非用户明确授权并且当前 step scope 允许。
- 不得提交其他步骤或用户已有的无关改动。

Input:

- Frontend visual contract sketch or step plan.
- One step payload.
- Allowed test scope.
- Required constraints.

Output:

- Static token tests.
- CSS/static parsing tests.
- Computed-style tests.
- Playwright layout/screenshot tests when applicable.
- Manual visual acceptance notes.

Do not modify production code. Do not widen scope beyond the active step. Do not reduce visual requirements to class name, `data-testid`, or callback existence checks. Parallel visual test writing is allowed only when selected dotted steps are in the same ready group and have disjoint test scope; otherwise use the named visual test integrator step.
