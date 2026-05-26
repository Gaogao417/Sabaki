# 架构审查

## 1. 结论

APPROVE_WITH_NOTES

本轮 `submit-to-recall-projection` 主闭环成立：Problem/Play 提交经 Container 委派到 `workbenchFlowService.submit(tabId)`，service 创建真实 `RecallSession` 后同时更新 `workbenchStore` 和 `trainingRuntimeStore.recallView`，Container subscription 触发重投影，Recall UI 渲染 active progress。未发现需要阻塞的边界泄漏或假绿测试。

## 2. 严重阻塞问题

无。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| UI -> Container -> Service | 通过 | `ModeActions` 的 `mode-action-submit` 调 `onSubmit`（src/components/workbench/shell/ModeActions.js:14），`ProblemModePanel` 的 `submit-answer-btn` 调 `onSubmitAnswer`（src/components/workbench/panels/ProblemModePanel.js:123），Container 两者都绑定到 `handleSubmit` / `flowService.submit(activeTab.id)`（src/components/TrainingWorkbenchContainer.js:159, 557, 596）。 | 无阻塞。 |
| Service orchestration | 通过 | `workbenchFlowService.submit` 在 active attempt 存在时执行 transition guard、finalize/freeze、`createRecallForAttempt`、`workbenchStore.updateTab({mode:'recall', recallSubstate:'normal', activeRecallSessionId})`、`runtimeStore.setProblemView(null)`、`setActiveRecallSession`、`setRecallView`（src/modules/training/workbench/workbenchFlowService.ts:259, 281, 285, 288, 295）。 | `submit` 仍有 no-active-attempt legacy direct recall path（src/modules/training/workbench/workbenchFlowService.ts:239）；本任务测试覆盖的是真实 attempt path。 |
| Store purity | 通过 | `trainingRuntimeStore.setRecallView` 只替换内存状态并 notify（src/modules/training/store/trainingRuntimeStore.ts:205）；`workbenchStore.updateTab` 只 patch tab 并 notify（src/modules/training/store/workbenchStore.ts:91）。 | 未见 store 调 engine / DB / UI。 |
| Projection stale guard | 通过 | `projectFromRuntime(rt, activeTab)` 只有当 `rt.recallView.recallSessionId` 同时匹配 `activeTab.activeRecallSessionId` 和 `rt.activeRecallSessionId` 时才投 active Recall props（src/components/TrainingWorkbenchContainer.js:938, 951）。 | 这是本轮关键 stale-state 风险控制。 |
| Presentational UI | 通过 | `WorkbenchShell` 仅把 props 传给 mode panels（src/components/WorkbenchShell.js:58, 86），`RecallModePanel` 消费 props 渲染进度（src/components/workbench/panels/RecallModePanel.js:136）。S2R-T09 扫描 `WorkbenchShell` / `RecallModePanel` 无 `recallService`、`runtimeStore`、`repository`、`window.sabaki`（test/workbench/wiring/submit-to-recall-projection.test.js:426）。 | Container 仍是 legacy bridge，存在非本任务的 Sabaki context 读取；本轮 submit path 未新增 presentational UI 直连 service。 |

## 4. 状态和事实来源审查

真源证据：

- PRD 规定 Workbench runtime modes 只有 Play / Problem / Recall / Analysis，且 `WorkbenchMode.problem` 拥有 `problemView` 和 mutable Attempt（docs/product/sabaki-training-prd.md:169）。
- UI/UX 规定 `提交答案` 必须冻结当前 Attempt、执行评价、创建 `RecallSession` 并默认进入 Recall（docs/ui_ux/workbench-ui-ux-spec.md:501）。
- Architecture v0.5 规定 `play/problem submit` effect 是 freeze attempt、create recall、`mode=recall`、`recallSubstate=normal`（docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:137）。
- Architecture v0.5 的示例链路明确为 Submit Button -> `TrainingWorkbenchContainer.handleSubmit` -> `workbenchFlowService.submit(tabId)` -> `attemptService.freezeAttempt` -> `recallService.createRecallFromAttempt` -> `workbenchStore.updateTab({mode:'recall'})`（docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:192）。
- `trainingRuntimeStore` 职责是当前训练运行态，不保存完整历史事实（docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:564）。

派生产物冲突：未发现。`docs/archive/.../test-contract-v0.2.md`、contract audit 和 test audit 只作为任务背景与测试目标参考，未覆盖或改写 active product / architecture / ui_ux 真源。

状态风险评估：

- `RecallSession` 仍由 repository/service 创建并持久化；`runtimeStore.recallView` 是 UI projection，不替代 session 事实源（src/modules/training/workbench/workbenchFlowService.ts:192）。
- `activeRecallSessionId` 同时存在于 tab 与 runtime store；本轮用双重匹配避免 stale projection 被当前 UI 误用（src/components/TrainingWorkbenchContainer.js:951）。
- 非阻塞建议：后续 recall move / checkpoint 更新也应保持同样 session-id guard，并覆盖 session progress 更新后的 `recallView` 回流。

## 5. 副作用审查

允许副作用集中在 service 层：

- `attemptService.finalizeAttemptResult` / `freezeAttempt`（src/modules/training/workbench/workbenchFlowService.ts:278, 282）。
- `recallService.createRecallFromAttempt` 或 fallback `createRecallSession`（src/modules/training/workbench/workbenchFlowService.ts:215）。
- `workbenchStore.updateTab` 和 runtime projection setters（src/modules/training/workbench/workbenchFlowService.ts:288, 295）。

未发现本任务 submit path 引入以下禁止副作用：

- store 内 engine / DB / IPC 调用。
- UI panel 直接 import training service/repository。
- `submit` 中根据 `origin.provider`、`source_kind`、`openProblemTab`、`openSnapshotProblemTab` 或 `snapshotService` 分叉；S2R-T09 对 submit 函数做了 scoped 扫描（test/workbench/wiring/submit-to-recall-projection.test.js:416）。
- recall / analysis 写 game tree。board mutation contract 对 recallAnswer 的禁止项是不得写 current SGF game tree、不得修改 source Attempt（docs/architecture/position-source-mutation-contract.md:154）。

## 6. 测试质量审查

通过，覆盖强度足够支撑本轮架构结论。

- Service test 使用真实 `createAttemptService`、`createRecallService`、`createTrainingRuntimeStore`、`createWorkbenchStore`，验证 submit 后真实 session、tab、runtime recall projection 一致（test/training/workbenchFlowService.test.js:149）。
- Wiring test 的 manifest 明确哪些生产模块真实执行，哪些 spy 只用于 delegation（test/workbench/wiring/submit-to-recall-projection.test.js:6）。
- S2R-T04 验证 store subscription 触发 Container `forceUpdate`，并在 subscription-driven render 中看到 Recall active props（test/workbench/wiring/submit-to-recall-projection.test.js:307）。
- S2R-T05/T06 验证真实 submit 后无需 caller seeding 即投出 active Recall props 并渲染 Recall panel（test/workbench/wiring/submit-to-recall-projection.test.js:337, 356）。
- S2R-T08 覆盖 stale recallView mismatch 被忽略（test/workbench/wiring/submit-to-recall-projection.test.js:368）。
- S2R-T07 防止成功路径在测试内手动 `setRecallView` 或手动 `updateTab({mode})` 假绿（test/workbench/wiring/submit-to-recall-projection.test.js:382）。
- Shared spies 用 TypeScript `satisfies` 绑定生产接口（test/workbench/shared/workbenchSpyFactories.ts:101），接口漂移会类型失败。

弱点备注：S2R-T09 是 source scan，属于补充防线，不应单独作为契约证明；当前已有真实 service/store/render 测试覆盖，因此不阻塞。

已复跑：

```text
npx mocha --require tsx test/training/workbenchFlowService.test.js test/workbench/wiring/submit-to-recall-projection.test.js
=> 86 passing
```

## 7. 范围控制审查

本任务相关实现集中在：

- `workbenchFlowService.submit` / `enterRecall` 从真实 `RecallSession` hydrate `runtimeStore.recallView`（src/modules/training/workbench/workbenchFlowService.ts:192, 287, 398）。
- `TrainingWorkbenchContainer.projectFromRuntime` 以 active tab/session guard 投 Recall props（src/components/TrainingWorkbenchContainer.js:938）。

未见 submit-to-recall 任务引入 source-specific 主路径或提升 archive 派生文档为事实来源。

非本任务但同一当前 diff 中可见的 checkpoint projection cache（src/components/TrainingWorkbenchContainer.js:1072）已有 implementation-plan 标注为迁移接缝；不影响本轮 submit-to-recall 结论，但后续应继续收敛到 read-model/cache owner。

## 8. 需要手动检查的文件或行

- src/modules/training/workbench/workbenchFlowService.ts:192：`mapRecallSessionToRecallView` 是新的 projection mapper。
- src/modules/training/workbench/workbenchFlowService.ts:287：submit 成功后 tab/runtime projection 更新顺序。
- src/modules/training/workbench/workbenchFlowService.ts:398：`enterRecall` 同步 hydrate projection。
- src/components/TrainingWorkbenchContainer.js:951：stale recallView matching guard。
- src/components/TrainingWorkbenchContainer.js:159：visible submit command 的 Container handler。
- test/workbench/wiring/submit-to-recall-projection.test.js:307：subscription -> projection -> UI 回流测试。

## 9. 建议操作

- 可以进入 checklist step8 更新 implementation-plan evidence/status。
- 后续 recall move progress 更新应补一条 contract/test，证明 `submitRecallMove` 后 `runtimeStore.recallView.moveIndex/userAttempts/completed` 继续从 active `RecallSession` 回流，而不是只在 enter/submit 时 hydrate。
- 保留 S2R-T08 stale guard，避免 tab/runtime/session 三处 active id 不一致时渲染旧 Recall surface。

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Problem 顶部 `提交答案` | `mode-action-submit` button click -> `onSubmit`（src/components/workbench/shell/ModeActions.js:14） | `handleSubmit` awaits `flowService.submit(activeTab.id)`（src/components/TrainingWorkbenchContainer.js:159） | Container handler acts as command binding; no panel service import | `workbenchFlowService.submit` freezes/finalizes attempt, creates `RecallSession`, updates `workbenchStore` and `runtimeStore.recallView`（src/modules/training/workbench/workbenchFlowService.ts:259, 281, 285, 288, 295） | store subscriptions call `forceUpdate`（src/components/TrainingWorkbenchContainer.js:57）；`projectFromRuntime` maps active recall props（src/components/TrainingWorkbenchContainer.js:957）；`RecallModePanel` renders progress `currentMove / totalMoves`（src/components/workbench/panels/RecallModePanel.js:136） | 通过 |
| Problem 左栏 `提交答案` | `submit-answer-btn` click -> `onSubmitAnswer`（src/components/workbench/panels/ProblemModePanel.js:123） | `shellHandlers.onSubmitAnswer = handleSubmit`（src/components/TrainingWorkbenchContainer.js:596） | Same as above | Same as above | S2R-T06 renders Recall panel with `0 / expectedMoves.length` after real submit（test/workbench/wiring/submit-to-recall-projection.test.js:356） | 通过 |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| 无 | 无 | docs/product, docs/architecture, docs/ui_ux | 无 |

可以继续。
