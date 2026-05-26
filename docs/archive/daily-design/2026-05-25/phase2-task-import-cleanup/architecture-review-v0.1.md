Date: 2026-05-25
Diff Scope:
- `b926fe31 test(training): phase2 task import cleanup contract`
- `20a18319 feat(training): route phase2 material wrappers through task import`

# 架构审查

## 1. 结论

APPROVE_WITH_NOTES.

重要说明：这是补做的正式架构审查。原执行顺序没有在实现后产出独立 architecture-reviewer 报告，流程上不合格；本报告只审查当前 Phase 2 diff 是否违反架构边界。

## 2. 严重阻塞问题

无。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
| --- | --- | --- | --- |
| Import ownership | OK | `taskImportService.createTaskFromLegacyProblem` 负责从 legacy problem 生成标准 task；snapshot path 调用 `taskImportService.createTaskFromSnapshot`。 | `taskImportService` 仍读取 legacy `repository.getProblem`，这是本轮 wrapper cleanup 的兼容入口。 |
| Tab ownership | OK | `workbenchPhaseService.snapshotFromAnalysis` 最终调用 `tabService.openTask({taskId, mode:'problem', parentTabId})`。 | `openSnapshotProblemTab` 仍导出但不在 cleaned snapshot path 使用。 |
| Store ownership | OK | `workbenchTabService.openProblemTab` 使用 production `openTask` 更新 workbench store；没有 UI component 直接写 store。 | Wrapper 内设置 `runtimeStore.setProblemView` 是既有 tab-service compatibility behavior。 |
| Snapshot side-effect boundary | OK | cleaned path 不再调用 `snapshotService.createProblemFromCurrentAnalysisPosition` 或 `repository.createTask`。 | `workbenchPhaseService` 是 deprecated service；长期应迁到 `workbenchFlowService` 主路径。 |
| `origin.provider` boundary | OK | `rg` 没发现 `workbenchPhaseService` / `workbenchTabService` 根据 `origin.provider` 分支。 | `taskImportService` 只写 origin metadata。 |
| Hidden global | OK | 本 diff 只调整 dependency injection in `sabaki.getTrainingContext`; 没新增 `window.sabaki` 查找。 | `sabaki.js` 既有 global/db seam 不属于本轮新增。 |

## 4. 状态和事实来源审查

真源约束：

- PRD v0.5: 外部材料进入系统后统一为 `TrainingTask`，`origin` 只追溯来源，不参与流程判断。
- Architecture v0.5: v0.4 `openProblemTab/openSnapshotProblemTab` 是迁移背景；v0.5 主路径是 `taskImportService + openTask`。
- Implementation Plan Phase 2: 状态为 landed / wrapper cleanup remaining；本轮正是清理 wrapper。

当前实现与真源一致：

- legacy problem wrapper 在生产注入 `taskImportService` 时走 `createTaskFromLegacyProblem -> openTask`。
- analysis snapshot wrapper 走 `captureSnapshotInput -> createTaskFromSnapshot -> openTask`。
- Mode 由 task problem-like 字段或显式 `mode:'problem'` 决定，不按 `origin.provider` 分支。

## 5. 副作用审查

| 副作用 | 状态 | 证据 |
| --- | --- | --- |
| 创建 legacy Problem | 未发生于 cleaned snapshot path | P2-T03 断言 `createProblemFromCurrentAnalysisPosition` 未调用。 |
| 直接 repository task create in phase service | 未发生 | P2-T03 断言 `repository.createTask` 未调用。 |
| legacy snapshot tab opening | 未发生于 cleaned path | P2-T03 断言 `openSnapshotProblemTab` 未调用。 |
| game-tree/scratch/Attempt mutation | 未新增 | 本 diff 只处理 task import/open wrapper；无 resolver/executor 或 game-tree 写入。 |

## 6. 测试质量审查

状态：APPROVE_WITH_NOTES。

- P2-T01/P2-T02 使用真实 `taskImportService`，保护 task shape 和 no legacy Problem boundary。
- P2-T03 使用真实 `workbenchPhaseService`，保护 snapshot orchestration boundary。
- P2-T05 使用真实 `workbenchTabService` 和 production store，保护 injected import-service wrapper path。
- typed shared `createSpyTaskImportService` 已同步新增方法，降低 TS wiring tests 的 mock drift。

非阻塞风险：

- JS tests 的 local tiny stubs 不受 TS interface 约束；当前范围小，可接受。
- rendered UI click path deferred，后续 Workbench wiring 合同应补。

## 7. 范围控制审查

OK。实现没有扩大到 Phase 3+ Attempt/AI/Recall，也没有做 UI/CSS 改动。新增行为限制在 Phase 2 import/wrapper cleanup。

## 8. 需要手动检查的文件或行

| 文件 | 关注点 |
| --- | --- |
| `src/modules/training/workbench/workbenchTabService.ts` | `openProblemTab` 仍保留 fallback legacy branch；这是兼容接缝，后续迁移完成后应删除。 |
| `src/modules/training/workbench/workbenchPhaseService.ts` | deprecated service 现在依赖 optional `taskImportService`；生产已注入，测试旧构造若调用 `snapshotFromAnalysis` 必须显式提供。 |
| `src/modules/sabaki.js` | DI 顺序调整为先创建 `taskImportService` 再注入 tab/phase service。 |

## 9. 建议操作

- 保留当前实现。
- 不要把本补审视为流程合格的先例；下一 Phase 必须按 contract audit -> test audit -> implementation -> architecture review 顺序执行。
- 后续 wiring/UI 任务必须用 Workbench Wiring Workflow，补真实 UI event -> container -> service -> store -> projection 链路。

## 10. Workbench 接线闭环追踪（本轮适用的 wrapper path）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Analysis snapshot wrapper | Deferred UI event | Deferred | `workbenchPhaseService.snapshotFromAnalysis` | `snapshotService.captureSnapshotInput -> taskImportService.createTaskFromSnapshot -> tabService.openTask` | New tab returned with `mode:'problem'`, parent linked by `openTask` | OK for service/wrapper layer; UI rendered path deferred. |
| Legacy problem wrapper | Deferred UI event | Deferred | `workbenchTabService.openProblemTab` compatibility wrapper | `taskImportService.createTaskFromLegacyProblem -> openTask`; runtime problem view set when attempt service exists | Active tab becomes imported task tab with `mode:'problem'` on injected path | OK for wrapper cleanup; UI rendered path deferred. |

## 11. 真源冲突清单

无 unresolved 冲突。

可以继续。
