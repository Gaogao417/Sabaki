Date: 2026-05-25
Contract: `test-contract-v0.2.md`
Scope:
- `test/training/taskImportService.test.js`
- `test/training/workbenchPhaseService.test.js`
- `test/training/workbenchTabService.test.js`
- `test/workbench/shared/workbenchSpyFactories.ts`

# 测试审计

## 1. 结论

APPROVE_WITH_NOTES.

重要说明：这是补做的正式测试审计。原执行顺序没有在实现前产出独立 test-auditor 报告，流程上不合格；本报告记录当前测试是否足以保护 Phase 2 cleanup 行为。

## 2. 审查范围

| 文件 | 覆盖 | 状态 | 备注 |
| --- | --- | --- | --- |
| `test/training/taskImportService.test.js` | P2-T01, P2-T02 | APPROVE | 真实 import service，in-memory repository fake。 |
| `test/training/workbenchPhaseService.test.js` | P2-T03 | APPROVE_WITH_NOTES | 真实 phase service；下游 snapshot/import/tab 为 spy。 |
| `test/training/workbenchTabService.test.js` | P2-T05 | APPROVE_WITH_NOTES | 真实 tab service + store；import fake 为 tiny stub。 |
| `test/workbench/shared/workbenchSpyFactories.ts` | typed shared factory update | APPROVE | 新增方法受 `TaskImportService` 类型约束。 |

## 3. 必查弱测试模式

| Pattern | 命中 | 审计结论 |
| --- | --- | --- |
| `assert.ok(true)` / `assert(true)` | 无本轮新增命中 | 通过。 |
| `.skip(` / `this.skip` | 无本轮新增命中 | 通过。 |
| `if (!...) return` 静默通过 | 本轮生产/测试有正常 guard，不属于测试静默通过 | 通过。 |
| callback-only 主验收 | 无；P2-T05 断言 task id、mode、active tab 和 legacy adapter 未调用 | 通过。 |
| 当前错误行为固化 | 无 | 通过。 |
| 本地生产 service spy drift | P2-T03/P2-T05 使用局部 tiny stub | APPROVE_WITH_NOTES：stub 范围小，但 JS 文件无类型约束。关键 typed shared factory 已补。 |

## 4. 覆盖矩阵

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| P2-T01 | Legacy problem becomes standard task with origin and problem-like fields | `taskImportService.test.js` P2-T01 | covered | 会在 service 缺方法、字段映射错误时失败。 |
| P2-T02 | No legacy Problem entity, no special kind/source | `taskImportService.test.js` P2-T02 | covered | 会在调用 `createProblem` 或设置 kind/source 时失败。 |
| P2-T03 | Snapshot path uses import service then `openTask`, avoids legacy creation/opening | `workbenchPhaseService.test.js` P2-T03 | covered | 会在调用 legacy `createProblemFromCurrentAnalysisPosition`、`repository.createTask` 或 `openSnapshotProblemTab` 时失败。 |
| P2-T04 | Main cleanup path has no `openSnapshotProblemTab(` inside phase service | Covered by P2-T03 behavior and architecture review | covered | P2-T03 is stronger than source-only check for this path. |
| P2-T05 | Injected import service makes `openProblemTab` delegate to import + `openTask` | `workbenchTabService.test.js` P2-T05 | covered | 会在 bypass import、wrong mode、inactive tab 或 legacy adapter call 时失败。 |

## 5. Red / Green 合法性检查

| Check | Result |
| --- | --- |
| 删除 `createTaskFromLegacyProblem` 导出 | P2-T01/P2-T02 fail。 |
| `createTaskFromLegacyProblem` no-op | P2-T01/P2-T02 fail。 |
| `snapshotFromAnalysis` 改回 legacy `createProblemFromCurrentAnalysisPosition` | P2-T03 fail。 |
| `snapshotFromAnalysis` 不调用 `openTask` | P2-T03 fail。 |
| `openProblemTab` 不调用 injected `taskImportService` | P2-T05 fail。 |
| `openProblemTab` 返回 play mode instead of problem mode on injected path | P2-T05 fail。 |

## 6. 风险和非阻塞备注

- P2-T03/P2-T05 是 service/wrapper tests，不证明 rendered UI click path；这已在 `test-contract-v0.2.md` deferred。
- `test/training/*.test.js` 局部 fake 不受 TypeScript `satisfies` 约束；本轮 fake 很小，且生产对象保持真实，因此不构成 BLOCK。后续若扩大到完整 service spy，应迁移到 typed shared factory。
- `npm test` 仍有 4 个无关 WorkbenchContainer/new-game 失败；它们不覆盖本轮 Phase 2 import/snapshot cleanup。

## 7. 建议

可以继续进入/保留当前实现，但必须承认审计是补做而非按原顺序完成。
