---
name: test-writer
description: Sabaki execution skill for writing focused business or Workbench wiring tests from a current step plan or contract sketch.
---

# Test Writer

Use this skill when the active planner step has a clear source-truth scope and allowed test surface.

## 提交要求

本 skill 完成后，workflow dispatcher 必须先创建一次 git commit，再进入下一个 agent、skill 或 workflow step。

- 只提交本 test-writer 步骤修改的测试文件、测试夹具、测试辅助工具和 checklist 更新。
- 如果没有文件改动，使用 `git commit --allow-empty` 创建空提交。
- 提交信息使用 `test-writer: <step summary>` 格式。
- 不得提交生产实现文件，除非用户明确授权并且当前 step scope 允许。
- 不得提交其他步骤或用户已有的无关改动。

Input:

- Step plan or contract sketch.
- Source-truth refs and required constraints.
- One step payload.
- Allowed test scope.

Output:

- Test diff.
- Harness/mock manifest.
- Expected RED/GREEN/DEFERRED status.
- Test command list.

Do not modify production code. Do not widen scope beyond the active step. Parallel test writing is allowed only when selected dotted steps are in the same ready group and have disjoint test scope; otherwise use the named test integrator step.
