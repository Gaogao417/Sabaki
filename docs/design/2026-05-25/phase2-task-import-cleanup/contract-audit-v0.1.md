Date: 2026-05-25
Scope:
- `test-contract-v0.1.md`
- `test-contract-v0.2.md`

# 契约审计

## 1. 结论

APPROVE_WITH_NOTES for `test-contract-v0.2.md`.

重要说明：这是补做的正式审计。原执行顺序没有在写测试前产出独立 contract-auditor 报告，流程上不合格；本报告用于补齐审计产物，并记录 v0.1 的修订原因。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `test-contract-v0.1.md` | 测试/验收契约 | REQUEST_CHANGES | 缺少后续实现新增的 `P2-T05` tab-service wrapper cleanup 行；Contract Audit 写在同一文件中，不是独立审计产物。 |
| `test-contract-v0.2.md` | 测试/验收契约 | APPROVE_WITH_NOTES | 补齐 `P2-T05`、deferred coverage 和 mock 策略，可作为本轮契约真源。 |

## 3. 阻塞问题

无仍未解决的阻塞问题。

已修复问题：

| 严重级别 | 文件 | 问题 | 处理 |
| --- | --- | --- | --- |
| P1 | `test-contract-v0.1.md` | 测试代码后来加入 `P2-T05`，但契约没有对应行，导致 test-writer/test-auditor 无法完整追踪。 | 新增 `test-contract-v0.2.md`，把 `P2-T05` 加入测试契约。 |
| P2 | `test-contract-v0.1.md` | 审计结论写在契约内，不满足独立审计关口。 | 新增本独立 contract audit 报告。 |

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| P2-T01 | SERVICE_REPOSITORY_TRANSITION | `taskImportService.createTaskFromLegacyProblem` | in-memory repository fake | 匹配 | APPROVE | 被测 service 真实，repository fake 只提供 `getProblem/createTask/createProblem`。 |
| P2-T02 | ARCHITECTURE_BOUNDARY | `taskImportService.createTaskFromLegacyProblem` | in-memory repository fake | 匹配 | APPROVE | 断言不创建 legacy Problem、不设置 `kind/source`。 |
| P2-T03 | SIDE_EFFECT_BOUNDARY | `workbenchPhaseService.snapshotFromAnalysis` | downstream service/tab spies | 匹配 | APPROVE_WITH_NOTES | 被测 phase service 真实；mock 的是下游边界。不是 UI wiring 闭环测试。 |
| P2-T04 | ARCHITECTURE_BOUNDARY | source text | static source inspection | 匹配 | APPROVE_WITH_NOTES | v0.2 允许作为架构审查项；不单独要求新增 source-only test。 |
| P2-T05 | SIDE_EFFECT_BOUNDARY | `workbenchTabService.openProblemTab` | local tiny import fake + real store | 匹配 | APPROVE_WITH_NOTES | 被测 tab service 和 store 真实；import fake 只返回标准 task，避免把完整 import service mock 当作状态所有者。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Material Browser / legacy problem drawer UI click path | RENDERED_UI_RETURN | 是 | 后续 Workbench wiring 合同必须命名具体 UI 组件和 handler。 |
| 删除 `openProblemTab/openSnapshotProblemTab` 导出 | ARCHITECTURE_BOUNDARY | 是 | 迁移完成后再移除；本轮只要求生产主路径不走 snapshot legacy wrapper。 |

## 6. Human Gate

- 是否接受本轮不覆盖 UI rendered path：建议接受，本任务是 Phase 2 service/wrapper cleanup，不是 Workbench 控件接线。
- 是否允许 v0.2 作为补正契约继续进入 test audit：建议允许。

契约质量可以进入测试审计。
