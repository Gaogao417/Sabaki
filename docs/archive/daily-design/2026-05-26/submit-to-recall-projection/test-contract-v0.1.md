Date: 2026-05-26
Status: pending-confirmation

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | §5.2, lines 169-184 | 运行态 Workbench mode 只有 `play / problem / recall / analysis`；`Problem` entity、Review、Punishment Problem 不是新 mode。提交后 UI 必须落到这四模式中的 `recall`，不能引入第五模式。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | mode table, lines 135-139 | `play / problem` 上的 `submit` 在 `activeAttempt && !frozen` guard 下必须 freeze attempt、create recall、`mode=recall`、`recallSubstate=normal`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §4.3, lines 564-586 | `trainingRuntimeStore` 只保存当前训练运行态，不保存完整历史事实。可保存 `activeRecallSessionId` 和当前 UI view/hydration，但完整 RecallSession 事实仍属于 repository/service。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §9.4, lines 1811-1825 | Submit 链路必须是 `SubmitButton.onClick -> TrainingWorkbenchContainer.handleSubmit -> workbenchFlowService.submit(tabId) -> attempt/recall service/repository -> workbenchStore.updateTab({mode:'recall', activeRecallSessionId}) -> trainingRuntimeStore.setActiveRecallSession(recallSessionId)`。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §0, lines 5-27 | UI/UX 只约束可见表面：四模式、顶部 mode actions、左侧当前 mode 任务面板。产品/架构判断仍以 PRD 和 Architecture 为准。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | layout, lines 33-43 and component tree lines 991-1005 | Workbench 有左 panel、中央棋盘、右 panel；左侧 `ModePanel` 下按 mode 切换 `PlayTaskPanel / ProblemTaskPanel / RecallTaskPanel / AnalysisTaskPanel`。本契约只验证 submit 后 Recall 左 panel 可见，不做视觉像素还原。 |

代码证据只作为当前接线风险定位，不作为产品真源：`ModeActions` 以 `onClick: () => handler()` 调用无参 callback（`src/components/workbench/shell/ModeActions.js:62-68`）；`ProblemModePanel` 的可见 `submit-answer-btn` 调用 `onSubmitAnswer`（`src/components/workbench/panels/ProblemModePanel.js:124-128`）；`TrainingWorkbenchContainer.handleSubmit()` 从 active tab 取 `tab.id` 并调用 `flowService.submit(activeTab.id)`（`src/components/TrainingWorkbenchContainer.js:159-162`）；Container 订阅 `runtimeStore` 和 `workbenchStore` 后 forceUpdate（`src/components/TrainingWorkbenchContainer.js:54-58`）；`projectFromRuntime` 只在 `rt.recallView` 存在时输出 active Recall props（`src/components/TrainingWorkbenchContainer.js:951-979`）；`projectFromWorkbench` 从 `activeTab.mode` 输出 `WorkbenchShell.mode`（`src/components/TrainingWorkbenchContainer.js:1013-1017`）；`WorkbenchShell` 用 `mode` 选择左 panel（`src/components/WorkbenchShell.js:86-91, 133-137`）。

## 1. 用户故事

作为训练用户，我在 Problem 做题或 Play attempt 结束时点击可见提交动作，系统应冻结当前 attempt、创建 RecallSession，并让当前 Workbench 立即进入 Recall UI；Recall 左侧面板应显示真实 session 派生的进度状态，而不是依赖测试或调用方预先塞入 `runtimeStore.setRecallView(makeRecallView())` 或手动 `workbenchStore.updateTab({mode:'recall'})`。

## 2. 用户动作

1. 主可见路径：Problem mode 顶部 `提交答案` 按钮触发 `onSubmit`；Problem 左侧 `submit-answer-btn` 触发 `onSubmitAnswer`。
2. Service 覆盖路径：`workbenchFlowService.submit(tabId)` 必须同时覆盖 `play` 和 `problem` mode 的 state-forward 行为，因为 Architecture v0.5 mode table 把二者归为同一 submit 转换。
3. Deferred：Play 顶部 `结束当前 attempt` 当前接到 `handleEndPlay()` / engine stop seam，不在本小步改为 submit 主路径；如要修复 Play 可见结束按钮，应另开串行步骤，避免扩大本回归修复。

## 3. 当前阶段

提交前：`activeTab.mode = 'play' | 'problem'`，`activeTab.activeAttemptId` 存在，attempt 未 frozen。

提交后：`activeTab.mode = 'recall'`，`activeTab.recallSubstate = 'normal'`，`activeTab.activeRecallSessionId = createdSession.id`，`trainingRuntimeStore.activeRecallSessionId = createdSession.id`，并且本契约批准的投影决策要求有可投影的 Recall view。

## 4. 位置源

| 位置源 | 本契约结论 |
| --- | --- |
| `problem-attempt` | Problem submit 的业务来源：冻结当前 attempt 并用其 `userLine` 派生 RecallSession。 |
| `game-tree` | 只作为 attempt/root position 或现有棋盘显示来源；submit-to-recall 不得直接改正式棋谱。 |
| `scratch` | 不参与；不得创建 ExplorationBranch 或写 scratch。 |
| `reference/current` | 不参与本小步；Analysis 的 current/reference 投影不作为 submit 后 Recall UI 的来源。 |

## 5. 变更契约

变更类型：`其他: submitAttemptToRecall`。

契约含义：`play/problem` submit 不是 `playMove`、不是 `scratchEdit`、不是 `recallAnswer`、不是 `variationMove`。它是一次 service-owned orchestration：freeze/finalize attempt、create RecallSession、更新 active tab 和 runtime active recall state，并产生可返回 UI 的 Recall view/projection。

本契约的 projection 决策：优先采用 **service-side runtime hydration**。`workbenchFlowService.submit` 已拿到 `recallService.createRecallFromAttempt(...)` 返回的 session，因此 submit 成功后必须把该 session 映射为当前 `runtimeStore.recallView`，再由已有 subscription/projection 回流 UI。Repository-backed lazy projection in Container 暂不批准为主路径；只有在 step2 审核确认 service 无法获得 session 内容时，才允许作为临时迁移接缝，并必须标明退出条件：service submit 可直接 hydrate 后删除 Container lazy load。

`RecallSession.expectedMoves: string[]` 到 `runtimeStore.RecallView.expectedMoves` 的精确坐标/sign 转换不是本回归的主断言。测试应断言 session id、move index、expected move count、completed/state/progress 可见，不要锁死还不存在生产 mapper 的坐标细节。

## 6. 预期状态流

完整 Workbench 接线链路：

```text
UI event
  -> ModeActions.onClick() / ProblemModePanel.onClick()
  -> WorkbenchShell callback prop onSubmit / onSubmitAnswer
  -> TrainingWorkbenchContainer.handleSubmit()
  -> workbenchFlowService.submit(activeTab.id)
  -> attemptService.freezeAttempt + evaluation/finalize if configured
  -> recallService.createRecallFromAttempt(activeAttemptId)
  -> repository persists RecallSession
  -> workbenchStore.updateTab(tabId, {mode:'recall', recallSubstate:'normal', activeRecallSessionId})
  -> trainingRuntimeStore.setProblemView(null)
  -> trainingRuntimeStore.setActiveRecallSession(recallSessionId)
  -> trainingRuntimeStore.setRecallView(hydrated view from created RecallSession)
  -> workbenchStore/runtimeStore subscriptions notify Container
  -> projectFromWorkbench returns mode='recall'
  -> projectFromRuntime returns state='active', totalMoves/currentMove/progress from recallView
  -> WorkbenchShell receives recall props
  -> WorkbenchShell selects RecallModePanel in left panel
  -> RecallModePanel renders active progress surface, not empty seeded fake state
```

上游真实调用签名必须锁定：

| 调用方签名 | 证据 | 测试风险 |
| --- | --- | --- |
| `ModeActions button.onClick -> handler()` with no args | `src/components/workbench/shell/ModeActions.js:62-68` | 测试不得用 `onSubmit(tabId)` 伪造 payload；Container 必须从 active tab 读取 tab id。 |
| `ProblemModePanel submit-answer-btn.onClick -> onSubmitAnswer(evt)` as Preact click handler, payload unused | `src/components/workbench/panels/ProblemModePanel.js:124-128` | 主测试不得绕过 visible command 后直接 `workbenchStore.updateTab({mode:'recall'})`。 |
| `TrainingWorkbenchContainer.handleSubmit()` has no public args and calls `flowService.submit(activeTab.id)` | `src/components/TrainingWorkbenchContainer.js:159-162` | 用两参数或直接传 tabId 调 handler 的测试是假绿风险。 |

Split state seam：当前 App 用 legacy `sabaki.state.mode` 判断是否挂载 Workbench layout（`src/components/App.js:640-697`），而 `WorkbenchShell.mode` 来自 `workbenchStore.activeTab.mode`。本小步不要求重写 App gate，也不把 `sabaki.state.mode` 当作 Shell mode 真源。主投影测试应保持 legacy `sabaki.state.mode` 为 `play` 这类已挂载 Workbench 的值，同时证明 real submit 后 `WorkbenchShell.props.mode === 'recall'` 且 Recall panel 可见。若完整 App 手动验收发现 submit 后 Workbench 被卸载或 CSS/layout 仍按 Play 错误展示，则可在 implementation step 加一个 Container-owned migration seam `sabaki.setMode?.('recall')`；该 seam 只能同步 legacy gate，不得成为业务状态真源，退出条件是 App gate 改为由 Workbench store 驱动。

## 7. 允许的副作用

1. 通过 service/repository 冻结或 finalize 当前 attempt。
2. 通过 `recallService` 创建并持久化 RecallSession。
3. 通过 `workbenchFlowService` 更新 `workbenchStore` active tab：`mode='recall'`、`recallSubstate='normal'`、`activeRecallSessionId=session.id`。
4. 通过 `workbenchFlowService` 更新 `trainingRuntimeStore`：清空 `problemView`、设置 `activeRecallSessionId`、设置本 session 的 `recallView`。
5. Store subscribers 通知 Container re-render。
6. 如当前存在 review queue 且 `problemView.result` 存在，Container 可继续调用既有 review schedule 更新逻辑；该行为不是本契约主断言。
7. 可记录 submit/transition/runtime logs。
8. 可选临时迁移接缝：Container 在 submit 成功后调用 `sabaki.setMode?.('recall')` 同步 legacy App gate；仅在 App-level 验收需要时允许。

## 8. 禁止的副作用

1. `RecallModePanel`、`WorkbenchShell` 或 presentational panel 直接 import/call service、store、repository、Sabaki 或 DB。
2. Container 在 submit 主路径中直接 `workbenchStore.updateTab(...)` 或 `runtimeStore.setRecallView(...)` 来替代 service state-forward；Container 只负责 callback delegation 和 projection。
3. 测试通过 `runtimeStore.setRecallView(makeRecallView())` 或 `workbenchStore.updateTab({mode:'recall'})` 制造主 submit-to-recall 绿灯。
4. Store 直接调用 engine、DB、UI、IPC 或 repository。
5. Resolver 参与本 submit 投影修复时产生副作用。
6. `snapshotService` 承担 tab opening、submit flow orchestration 或 recall hydration。
7. 引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为 submit 主路径。
8. 用 `origin.provider`、旧 `source_kind` 或 `source/kind` 字段分支决定 submit 后进入哪个 UI。
9. 修改正式 game tree、scratch workspace、ExplorationBranch、analysis current/reference。
10. 默认展示 AI candidates 或 checkpoint correction 作为 submit 后 Recall 默认 UI。

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| S2R-C01 | WIRING | MUST_AUTOMATE | 可见 Problem submit 命令必须通过 presentational callback 到 Container `handleSubmit()`，真实调用签名无业务 payload。 | 防止 UI 有按钮但没有进入 service。 | 只测 service 会漏掉按钮/prop 断线。 |
| S2R-C02 | STATE | MUST_AUTOMATE | `workbenchFlowService.submit` 在 active attempt 上必须把 play/problem active tab 推进到 recall，并设置 `recallSubstate='normal'`、tab/runtime `activeRecallSessionId`。 | 锁定 Architecture §9.4 state-forward。 | 只测 callback 调用会无法发现状态没变。 |
| S2R-C03 | STATE | MUST_AUTOMATE | Submit 成功后必须产生可投影的 Recall view：本契约批准 service-side `runtimeStore.setRecallView` hydration，来自 created RecallSession，而不是测试手动 seed。 | 这是当前 observed gap 的核心。 | Shell 可能 mode=recall 但左 panel 仍是 empty。 |
| S2R-C04 | WIRING | MUST_AUTOMATE | `workbenchStore` 和 `runtimeStore` subscription 必须触发 Container re-render/projection；测试应观察真实 store setter 后的 props/UI 变化。 | 防止状态已变但 UI 不回流。 | 只断言 store 值会漏掉 UI 不更新。 |
| S2R-C05 | UI_BEHAVIOR | MUST_AUTOMATE | Container projection 必须把 store state 映射到 `WorkbenchShell`：`mode='recall'`、`state='active'`、`totalMoves/currentMove/progress` 来自 hydrated recallView。 | 锁定数据到 props 的返回路径。 | 只测 service 会漏掉 projection 字段缺失。 |
| S2R-C06 | UI_BEHAVIOR | MUST_AUTOMATE | Shell smoke 必须渲染真实 `WorkbenchShell`/`RecallModePanel`，看到 Recall active panel，不看到 `暂无回忆任务` empty state。 | 证明真实可见 UI 变了。 | 只看 `container.render().props` 不能证明 panel selection。 |
| S2R-C07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | fake-green guard：主 submit-to-recall 测试文件不得出现 `runtimeStore.setRecallView(` 或 `workbenchStore.updateTab(...mode:'recall')` 作为 arrange/act。 | 直接针对当前假绿来源。 | 回归会被手动 seed 掩盖。 |
| S2R-C08 | ARCHITECTURE_BOUNDARY | MANUAL_ACCEPTANCE | 完整 App 手动验收关注 split state seam：legacy `sabaki.state.mode` 只作为 App mount gate；Shell mode 必须由 active tab 投影为 recall。 | 防止 App 层仍显示旧 mode 布局。 | Container/Shell 测试通过但完整 App 仍挂载/样式异常。 |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S2R-T01 | UI_COMMAND_MAPPING | `WorkbenchShell`, `ModeActions`, `ProblemModePanel` visible submit controls | Preact render helper, production components | One local tiny callback for `onSubmit` / `onSubmitAnswer` | `local tiny stub` | No mocked `TrainingWorkbenchContainer`; no mocked `workbenchFlowService`; no store mutation | Clicking `mode-action-submit` and `submit-answer-btn` reaches the supplied semantic callback with no business payload requirement. | S2R-T02 |
| S2R-T02 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer` handler binding | Real `TrainingWorkbenchContainer`, real `createWorkbenchStore`, real `createTrainingRuntimeStore`, active problem tab | `workbenchFlowService` typed spy; minimal Sabaki shell harness | `shared typed spy factory` from `test/workbench/shared/workbenchSpyFactories.ts`; local tiny stubs only for unused Sabaki UI methods | No manual `setRecallView`; no manual `updateTab({mode:'recall'})`; do not claim state-forward | Invoking projected `onSubmit`/`onSubmitAnswer` from Container calls `flowService.submit(activeTab.id)` for the active tab. | S2R-T03 |
| S2R-T03 | CONTROLLER_STATE_TRANSITION | Real `createWorkbenchFlowService(...).submit(tabId)` | Real `createWorkbenchFlowService`, real stores, real `createAttemptService`, real `createRecallService`, real/typed checkpoint service, in-memory repository fake seeded with active playing attempt | `snapshotService` unused typed stub; `evaluationRules` local tiny function returning pass; logger | `in-memory repository fake` constrained by `TrainingRepository`; `real production interface/type`; `local tiny stub` only for pure `evaluationRules`/unused snapshot method | Do not mock `WorkbenchFlowService`, `RecallService`, `AttemptService`, `workbenchStore`, `runtimeStore`, or repository with per-file ad hoc object unless typed helper is first added | After `await service.submit(tabId)`: attempt is frozen/submitted, repository has one RecallSession from attempt, tab is `mode='recall'`, `recallSubstate='normal'`, tab/runtime active recall ids match session id. | S2R-T04, S2R-T05 |
| S2R-T04 | STORE_SUBSCRIPTION | `createWorkbenchStore` and `createTrainingRuntimeStore` notifications during real submit | Same harness as S2R-T03 with real stores | Subscriber counters/spies as local tiny callbacks | `local tiny stub` | No mocked stores; no direct state seeding after submit | Real submit fires both workbench and runtime subscribers at least once after the service-owned state changes. | S2R-T05 |
| S2R-T05 | PROJECTION_RETURN | `TrainingWorkbenchContainer` projection after real submit | Real Container, real stores, real flow service from S2R-T03 harness or an equivalent harness sharing the same real service | Minimal Sabaki shell harness; unused UI methods local tiny stubs | `real production interface/type`; `in-memory repository fake`; `local tiny stub` for unused shell methods | No mocked flowService; no manual `setRecallView`; no manual `updateTab({mode:'recall'})`; no direct `props.mode='recall'` override | After visible/delegated submit completes and stores notify, `container.render().props` has `mode='recall'`, `state='active'`, `currentMove=0`, `totalMoves=session.expectedMoves.length`, and does not depend on legacy `sabaki.state.mode` being `recall`. | S2R-T06 |
| S2R-T06 | RENDERED_UI_RETURN | Real `WorkbenchShell` with real `RecallModePanel` selected from projected props | Production `WorkbenchShell`, `RecallModePanel`, projected props from S2R-T05 | None beyond test DOM utilities | `real production interface/type` | Do not replace `RecallModePanel` with a fake; do not assert only props | Rendered shell has `data-mode="recall"`, contains `data-testid="recall-mode-panel"` with active progress content such as `0 / N`, and does not render the empty title `暂无回忆任务`. | not-covered: full Electron/App visual acceptance remains manual in S2R-M01 |
| S2R-T07 | ARCHITECTURE_BOUNDARY | Static fake-green guard for the new submit-to-recall test file | Node `fs` reading `test/workbench/wiring/submit-to-recall-projection.test.js` | None | no mocked dependencies | Do not whitelist broad comments that hide forbidden setup; do not scan unrelated legacy tests | The new main submit-to-recall test file contains no `runtimeStore.setRecallView(` and no `workbenchStore.updateTab(...mode:'recall')` arrangement in this regression suite. | Step4 test audit |

如果 S2R-T03 需要新增 helper，先补 `test/training/shared` 或复用/扩展 `test/training/phase3TypedFakes.ts`，并用生产 `TrainingRepository` / service interfaces 约束。不得在测试文件内临时手写完整 `RecallService`、`AttemptService`、repository port 替身。

Test harness / mock manifest:

| 依赖 | 本契约要求 | Mock Contract Source |
| --- | --- | --- |
| `WorkbenchFlowService` | S2R-T03/S2R-T05 必须用真实 `createWorkbenchFlowService`; S2R-T02 才可用 typed spy。 | `real production interface/type`; S2R-T02 用 `shared typed spy factory` |
| `WorkbenchStore` / `TrainingRuntimeStore` | 必须用真实 store；状态变化由 service 触发。 | `real production interface/type` |
| `AttemptService` / `RecallService` | state-forward 主测试必须用真实 service；如果 helper 不足，先补 typed helper，不在测试内手写完整替身。 | `real production interface/type` |
| Repository | 使用 in-memory repository fake，必须实现被真实 service 实际调用的方法并记录状态。 | `in-memory repository fake` |
| `snapshotService` | Submit 主路径 unused，仅提供 typed no-op 以满足 constructor deps。 | `real production interface/type` 或 `local tiny stub` |
| `evaluationRules` / logger / subscriber counters | 只允许局部无状态 tiny stub。 | `local tiny stub` |

Forbidden test setup for the main regression suite: no `runtimeStore.setRecallView(makeRecallView())`, no `workbenchStore.updateTab(...mode:'recall')`, no manual `props.mode='recall'`, no mocked `flowService.submit` in tests claiming state-forward/projection/rendered return.

## 11. 仅手动验收

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | --- | --- | --- | --- | --- |
| S2R-M01 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | 运行应用，打开一个有 active attempt 的 Problem tab，点击 `提交答案`，确认左侧切到 Recall 面板并显示真实进度；不要求 Playwright 作为主验收。 | 观察完整 App gate、legacy mode class、真实用户点击。 | 仅单元/DOM 测试可能漏 App 外层 mount gate。 |
| S2R-M02 | ARCHITECTURE_BOUNDARY | MANUAL_ACCEPTANCE | 若 legacy `sabaki.state.mode` 未同步为 recall，确认 Workbench 仍被挂载且 Shell mode/left panel 由 active tab 驱动；若不成立，记录为后续 legacy mirror seam。 | 明确 split state seam。 | 容器层通过但 App 层显示旧布局。 |

## 12. 不测试

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | --- | --- | --- | --- | --- |
| S2R-N01 | UI_BEHAVIOR | DO_NOT_TEST | 不做像素、CSS token、响应式或截图还原。 | 本步是数据/projection 回归。 | 视觉范围扩大拖慢修复。 |
| S2R-N02 | SIDE_EFFECT | DO_NOT_TEST | 不覆盖 Phase 5 checkpoint comment/correction 剩余项。 | 用户明确要求小串行步骤。 | 混入 checkpoint 会导致不必要冲突。 |
| S2R-N03 | ARCHITECTURE_BOUNDARY | DO_NOT_TEST | 不测试 source-specific tab opening、snapshot、Analysis scratch、Review 队列推进全流程。 | 与 submit-to-recall projection 无关。 | 扩大到 Phase 5/Review。 |
| S2R-N04 | PURE_LOGIC | DO_NOT_TEST | 不锁死 `RecallSession.expectedMoves` string 到 panel move object 的精确坐标/sign 转换，除非实现先引入生产 mapper。 | 目前主风险是可见 UI 不回流。 | 过早冻结临时格式。 |

## 13. 脆弱测试警告

1. **Callback-only 假绿**：`flowService.submit` spy 被调用一次只能证明 `CONTAINER_DELEGATION`，不能证明 state-forward 或 UI return。
2. **手动状态假绿**：主 regression test 里任何 `runtimeStore.setRecallView(makeRecallView())` 或 `workbenchStore.updateTab({mode:'recall'})` 都会掩盖真实 submit 没有可见 Recall UI 的 bug。
3. **Props-only 假绿**：`container.render().props.mode === 'recall'` 只能证明 `PROJECTION_RETURN`，不能证明真实 `RecallModePanel` 被 Shell 选中；必须有 S2R-T06 rendered smoke。
4. **过度指定**：不要断言随机 session id 格式、时间戳、日志顺序、内部 Promise 顺序，除非该顺序是 Architecture §9.4 的业务契约。
5. **Split state 假设**：不要把 legacy `sabaki.state.mode` 当成 `WorkbenchShell.mode` 真源；测试必须让 active tab mode 驱动 Shell mode。
6. **Mock drift**：`RecallService`、`AttemptService`、repository、flow service 不得在单个测试文件里手写完整替身；使用真实服务或 typed fake/helper。

## 14. 超出范围

1. 修复 Play 顶部 `结束当前 attempt` 的完整 submit UX。
2. 重写 App Workbench mount gate 以包含 Problem 或完全移除 legacy `sabaki.state.mode` gate。
3. Phase 5 checkpoint correction/comment UI、AI reveal、checkpoint queue。
4. Recall move input / `recallAnswer` 提交流程。
5. Snapshot、Analysis return target、source-specific tab APIs。
6. 任何视觉重构、CSS、布局、design token。

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 不允许 | PRD §5.2 区分业务对象和 mode；本契约只按 active tab mode + activeAttempt guard submit。 | 测试/实现不得按 origin/source_kind 决定 Recall UI。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 不允许 | Architecture §9.4 submit 主路径是 `workbenchFlowService.submit(tabId)`。 | Submit-to-recall 不调用 tab open API；这些只可存在于其他入口测试。 |
| 是否让 `snapshotService` 承担 Architecture v0.5 未分配的 tab opening / flow orchestration | 不允许 | §9.4 不包含 snapshotService。 | `snapshotService` 在 harness 中只能是 unused typed stub。 |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 不允许用于 submit 主路径 | §9.4 把 store writes 放在 `workbenchFlowService.submit` 后。 | Container 只做 callback delegation、review schedule seam 和 projection；submit state mutation 属于 service。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不允许 | UI/UX §0 只给布局/控件；架构边界要求 panel presentational。 | `RecallModePanel` / `WorkbenchShell` 保持 props-only。 |
| 是否把 `problem` 当作棋盘 mode 或引入第五 mode | 不允许 | PRD §5.2 lines 171-184；Architecture mode type lines 119-128。 | Submit 后 mode 必须为四模式中的 `recall`。 |
| 是否让 Recall submit 修改正式棋谱或 scratch | 不允许 | 本契约位置源排除 scratch/game-tree mutation。 | Service 只写 attempt/recall/session runtime。 |
| 是否要求 legacy `sabaki.state.mode` 成为 Shell mode 真源 | 不允许 | 当前代码 Shell mode 来自 `projectFromWorkbench`; App gate seam 是迁移问题。 | 本步测试 active tab projection；可选 `sabaki.setMode('recall')` 仅同步 App gate。 |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Problem top action `mode-action-submit` | `submitAttemptToRecall` | presentational component emits `onSubmit`; Container owns active tab lookup; service owns write | Architecture §9.4 lines 1814-1825; UI/UX §0 top toolbar | none in component; Container calls `flowService.submit(activeTab.id)` | service store updates -> subscription -> Shell props | S2R-T01, S2R-T02 | panel callback plumbing |
| Problem left `submit-answer-btn` | `submitAttemptToRecall` | `ProblemModePanel` emits `onSubmitAnswer`; Container maps to same handler | UI/UX left mode task surface lines 991-999; Architecture §9.4 | none in panel; same service command | same as top action | S2R-T01, S2R-T02 | panel callback plumbing |
| `workbenchFlowService.submit` | freeze/finalize/create recall/hydrate view | controller/service | Architecture mode table lines 135-139 and §9.4 | attempt frozen, RecallSession persisted, tab/runtimestore updated, recallView hydrated | stores notify Container | S2R-T03, S2R-T04 | controller/service |
| `runtimeStore.recallView` | service-side hydration | service/runtime store | Architecture §4.3 current runtime state; §9.4 active recall id | `setRecallView` from created session, clear `problemView` | `projectFromRuntime` produces active Recall props | S2R-T03, S2R-T05 | controller/service + container/projection |
| Container projection | mode and recall props | `TrainingWorkbenchContainer` | Architecture read path; UI/UX left panel | no new business write | `mode='recall'`, `state='active'`, progress/count props | S2R-T05 | container/projection |
| `WorkbenchShell` left panel | select `RecallModePanel` | Shell presentational | UI/UX component tree lines 991-1005 | no state write | active Recall panel visible; empty state absent | S2R-T06 | shell smoke |
| Play top `mode-action-end` | end current attempt | deferred | UI/UX Play actions; Architecture play/problem submit table | current code uses `handleEndPlay` / engine stop seam | not part of this small repair | DEFERRED: separate Play end contract | out of scope |
| Legacy App mount gate | optional mirror `sabaki.setMode('recall')` | Container migration seam only if needed | Current code evidence `App.js:640-697`, not product truth | optional legacy state sync after service success | prevents App unmount/layout mismatch | manual S2R-M02; no primary unit unless implementation adds seam | architecture review |

订阅契约：`workbenchStore.updateTab` 和 `runtimeStore.setActiveRecallSession/setRecallView` 必须各自 notify；Container subscriptions must observe the notifications and re-render. S2R-T04 proves store notifications; S2R-T05 proves projection after those notifications. S2R-T06 proves rendered return.

弱测试禁令：不得把“callback 被调用一次”作为主验收。它只能覆盖 S2R-T01/S2R-T02，后续必须由 S2R-T03/S2R-T05/S2R-T06 证明 state-forward 和 UI return。

## 17. 任务并行建议（如适用）

本 step 是一个小串行 contract，不拆并行 worker。后续可按 checklist 串行执行：

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| step2 contract audit | 本 contract review notes only | step1 | 串行审核，不并行 | 审核反馈可能要求 contract v0.2 |
| step3 tests | `test/training/workbenchFlowService.test.js`, `test/workbench/wiring/submit-to-recall-projection.test.js`, typed helper if needed | step2 | 当前计划串行；service/projection tests 共享 harness，避免并行写冲突 | 最容易引入 fake-green setup，需 step4 audit |
| step5 implementation | `workbenchFlowService.ts`; `TrainingWorkbenchContainer.js` only if projection fallback/legacy mirror approved | step4 | 串行锁 service/projection shared files | Service hydration 与 Container fallback 不应同时成为主路径 |
| architecture review | no production writes | step6 | 验证完整 loop | 若发现 legacy App gate 必须另开 follow-up |
