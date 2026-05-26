Date: 2026-05-26
Status: pending-confirmation

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | §5.2, lines 169-184 | 运行态 Workbench mode 只有 `play / problem / recall / analysis`；`Problem` entity、Review、Punishment Problem 不是新 mode。Submit 后 UI 必须进入四模式中的 `recall`，不能引入第五 mode。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.3, lines 89-110 | UI 只展示；Container/Controller 读 Store、调 Service；Service 编排业务动作；Repository 统一存取训练 DB；不得让 `snapshotService` 打开 tab 或按 `origin.provider` 分叉主流程。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §0.4, lines 112-157 | 状态机表规定 `play / problem + submit + activeAttempt && !frozen` 的 effect 是 freeze attempt、create recall、`mode=recall`、`recallSubstate=normal`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §1.1, lines 164-178 | 渲染读路径允许 `Store / Repository query -> Container / ViewModel -> UI Component`。因此 repository-backed Container/ViewModel projection 是架构允许路径，不得因本步选择 service hydration 就称其为架构禁止。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §1.2-1.3, lines 180-210 | Submit 写路径是 `UI Component -> Container -> Service -> Store / Repository / Adapter`；Container 可调 service，但不应替代 service 直接写业务 store。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §4.1-4.3, lines 447-471, 564-628 | Store 保存当前运行态，不保存完整历史事实；完整 Attempt/RecallSession 等事实属于 DB entity + Repository + Service。Architecture v0.5 只列出 `activeRecallSessionId`，没有把 `recallView` 写成硬真源。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §5.3, lines 727-802 | `workbenchFlowService` 是 mode/workflow orchestrator；API 包含 `submit(tabId)`；主干转换包含 `play/problem --submit--> recall`；Submit 必须 freeze Attempt。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §5.5, lines 903-946 | `attemptService` 管理 Play/Problem 作答事实，负责 freeze/finalize attempt，不负责直接读 engine、打开 tab 或创建 checkpoint。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §5.8, lines 1011-1054 | `recallService` 管理 RecallSession/RecallAttempt；RecallSession 显式保存 `attemptId`、`expectedMoves`、`expectedMoveIndexes` 等事实。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | §9.4, lines 1811-1825 | Submit 命令链为 `SubmitButton.onClick -> TrainingWorkbenchContainer.handleSubmit -> workbenchFlowService.submit(tabId) -> transaction/freeze/evaluate/finalize/createRecall -> workbenchStore.updateTab({mode:'recall', activeRecallSessionId}) -> trainingRuntimeStore.setActiveRecallSession(recallSessionId)`。本节不声明 `recallView` 必须存在。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | §0, lines 5-27 | UI/UX 只约束可见 Workbench 表面：四模式、顶部 mode actions、左侧当前 mode 任务面板。产品/架构判断仍以 PRD 和 Architecture 为准。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | layout, lines 33-43; component tree, lines 981-1009 | Workbench 有 TopToolbar、LeftSidebar、BoardStage、RightSidebar；ModeActions 位于顶部；左侧按 mode 切换 `PlayTaskPanel / ProblemTaskPanel / RecallTaskPanel / AnalysisTaskPanel`。本契约只验证 submit 后 Recall 左 panel 可见，不做视觉像素还原。 |

代码证据只用于锁定当前接线风险，不作为产品/架构真源：

| 证据 | 结论 |
| --- | --- |
| `src/components/workbench/shell/ModeActions.js:62-68` | `ModeActions` 以 `handler()` 无参调用 callback。测试不得伪造 `onSubmit(tabId)` payload。 |
| `src/components/workbench/panels/ProblemModePanel.js:124-128` | 左侧 `submit-answer-btn` 直接绑定 `onSubmitAnswer`，事件 payload 不承载业务 tab id。 |
| `src/components/TrainingWorkbenchContainer.js:159-162` | `handleSubmit()` 从 active tab 取 `tab.id` 并调用 `flowService.submit(activeTab.id)`。 |
| `src/components/TrainingWorkbenchContainer.js:54-58` | Container 订阅 `runtimeStore` 与 `workbenchStore` 后 re-render。 |
| `src/components/TrainingWorkbenchContainer.js:951-979` | 当前 projection 只有在 `rt.recallView` 存在时输出 active Recall props；这是本回归的当前实现接缝，不是 Architecture v0.5 硬要求。 |
| `src/components/TrainingWorkbenchContainer.js:1013-1017` | `WorkbenchShell.mode` 来自 `activeTab.mode`。 |
| `src/components/WorkbenchShell.js:86-91, 133-137` | Shell 用 `mode` 选择左侧 mode panel；`recall` 选择 `RecallModePanel`。 |
| `src/components/App.js:640-697` | App 外层仍用 legacy `sabaki.state.mode` 判断 Workbench mount/layout，这是迁移 seam，不是 Shell mode 真源。 |

## 1. 用户故事

作为训练用户，我在 Problem 做题或 Play attempt 结束时点击提交类动作，系统应冻结当前 attempt、创建 RecallSession，并让当前 Workbench 进入 Recall UI。Recall 左侧面板应显示由真实 RecallSession 派生的进度状态，而不是依赖测试或调用方预先塞入 `runtimeStore.setRecallView(...)`、手动 `workbenchStore.updateTab({mode:'recall'})` 或强行覆盖 `props.mode='recall'`。

## 2. 用户动作

1. 主可见路径：Problem 顶部 `mode-action-submit` 触发 `onSubmit`。
2. 主可见路径：Problem 左侧 `submit-answer-btn` 触发 `onSubmitAnswer`。
3. Service 覆盖路径：`workbenchFlowService.submit(tabId)` 必须覆盖 `play` 和 `problem` mode 的 `activeAttempt && !frozen` state-forward 行为，因为 Architecture v0.5 mode table 把二者归为同一 submit 转换。
4. Deferred：Play 顶部 `mode-action-end` / `结束当前 attempt` 当前接到 Play end seam，不在本小步改成可见 submit 主路径。

## 3. 当前阶段

提交前：

```text
activeTab.mode = 'play' | 'problem'
activeTab.activeAttemptId exists
attempt.frozen != true
```

提交后：

```text
activeTab.mode = 'recall'
activeTab.recallSubstate = 'normal'
activeTab.activeRecallSessionId = createdSession.id
trainingRuntimeStore.activeRecallSessionId = createdSession.id
```

本步选择的实现路径还要求：

```text
trainingRuntimeStore.recallView is a transient active-session projection/cache
recallView.recallSessionId = activeTab.activeRecallSessionId = runtime.activeRecallSessionId
recallView is cleared or replaced when active tab/session changes or recall completes
```

该 `recallView` 要求是当前 repair step 的迁移实现策略，不是 Architecture v0.5 §4.3/§9.4 的硬真源。完整 RecallSession 事实仍由 repository/service 拥有。

## 4. 位置源

| 位置源 | 本契约结论 |
| --- | --- |
| `problem-attempt` | Problem submit 的业务来源：冻结当前 attempt，并用其 `userLine` 通过 `recallService` 派生 RecallSession。 |
| `game-tree` | 只作为 attempt/root position 或既有棋盘显示来源；submit-to-recall 不得直接修改正式棋谱。 |
| `scratch` | 不参与；不得创建 ExplorationBranch 或写 scratch。 |
| `reference/current` | 不参与本小步；Analysis 的 current/reference projection 不是 submit 后 Recall UI 的来源。 |

## 5. 变更契约

变更类型：`其他: submitAttemptToRecall`。

契约含义：`play/problem` submit 不是 `playMove`、不是 `scratchEdit`、不是 `recallAnswer`、不是 `variationMove`。它是一次 service-owned orchestration：freeze/finalize attempt、create RecallSession、更新 active tab 和 runtime active recall state，并产生可返回 UI 的 Recall surface。

本步选择的 implementation path：

```text
workbenchFlowService.submit(tabId)
  -> receives created RecallSession from recallService
  -> maps that session through a named mapper/helper into runtime RecallView
  -> runtimeStore stores that RecallView only as current active-session projection/cache
  -> Container subscription/projection returns Recall props
```

关键约束：

1. `runtimeStore.recallView` 只能是当前 active session 的 transient projection/cache；不得作为完整 RecallSession 事实源，不得保存历史 session 列表。
2. `recallView.recallSessionId` 必须与 `workbenchStore.activeTab.activeRecallSessionId` 和 `runtimeStore.activeRecallSessionId` 一致。projection 必须忽略或清理不一致的 stale view。
3. 新 session hydrate 前必须清理旧 view；tab/session switch、`completeRecall`、restart attempt 或离开 recall 后不得继续投影旧 session 的 `recallView`。
4. RecallSession -> RecallView 映射必须绑定生产类型，例如命名 helper `mapRecallSessionToRecallView(session)` 或同等 typed mapper；不得把 panel 私有 shape 分散在 service 内部临时拼装。
5. Repository-backed Container/ViewModel projection 是 Architecture §1.1 允许的替代路径；本步不采用它作为 primary path，是为了最小化 repair scope。如果 implementation 选择该路径，必须重新审计测试契约，不能仅因“不是 service hydration”而判为架构错误。
6. `RecallSession.expectedMoves: string[]` 到 `RecallView.expectedMoves: {sign, vertex}[]` 的精确坐标/sign 转换不是本回归主断言。测试应断言 session id、move index、expected move count、completed/state/progress 可见，并要求 mapper typed，不要锁死尚未稳定的坐标细节。

## 6. 预期状态流

完整 Workbench 接线链路：

```text
UI event
  -> ModeActions.onClick() / ProblemModePanel.onClick(evt)
  -> WorkbenchShell callback prop onSubmit / onSubmitAnswer
  -> TrainingWorkbenchContainer.handleSubmit()
  -> workbenchFlowService.submit(activeTab.id)
  -> trainingRepository transaction / service orchestration
  -> attemptService.finalizeAttemptResult if configured
  -> attemptService.freezeAttempt(activeAttemptId)
  -> recallService.createRecallFromAttempt(activeAttemptId)
  -> repository persists RecallSession
  -> workbenchStore.updateTab(tabId, {mode:'recall', recallSubstate:'normal', activeRecallSessionId})
  -> trainingRuntimeStore.setProblemView(null)
  -> trainingRuntimeStore.setActiveRecallSession(recallSessionId)
  -> chosen migration path: trainingRuntimeStore.setRecallView(mapRecallSessionToRecallView(session))
  -> workbenchStore/runtimeStore subscribers notify Container
  -> Container re-renders and projects active tab + runtime state
  -> projectFromWorkbench returns mode='recall'
  -> projectFromRuntime or repository-backed ViewModel returns active Recall props
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

Split state seam：

当前 App 用 legacy `sabaki.state.mode` 判断是否挂载 Workbench layout（`src/components/App.js:640-697`），而 `WorkbenchShell.mode` 来自 `workbenchStore.activeTab.mode`。本小步不要求重写 App gate，也不把 `sabaki.state.mode` 当作 Shell mode 真源。主投影测试应保持 legacy `sabaki.state.mode` 为已挂载 Workbench 的值，同时证明 real submit 后 `WorkbenchShell.props.mode === 'recall'` 且 Recall panel 可见。

## 7. 允许的副作用

1. 通过 service/repository 冻结或 finalize 当前 attempt。
2. 通过 `recallService` 创建并持久化 RecallSession。
3. 通过 `workbenchFlowService` 更新 `workbenchStore` active tab：`mode='recall'`、`recallSubstate='normal'`、`activeRecallSessionId=session.id`。
4. 通过 `workbenchFlowService` 更新 `trainingRuntimeStore.activeRecallSessionId`。
5. 本步选择的迁移策略允许 `workbenchFlowService` 或 service-owned typed mapper 写入 `trainingRuntimeStore.recallView`，但该 view 只能是当前 active RecallSession 的 transient projection/cache。
6. 清空 submit 前的 `problemView`，并在 tab/session switch、restart 或 completion 时清空/替换 stale `recallView`。
7. Store subscribers 通知 Container re-render。测试只断言状态改变后观察到 projection/UI outcome，不锁死 setter 顺序或每个 setter 的独立通知次数。
8. 如当前存在 review queue 且 `problemView.result` 存在，Container 可继续调用既有 review schedule 更新逻辑；该行为不是本契约主断言。
9. 可记录 submit/transition/runtime logs。
10. Deferred seam：如后续 App-level 验收证明 legacy mount gate 阻断 Recall UI，可在单独审计后加入 Container-owned `sabaki.setMode?.('recall')` mirror；它只能同步 legacy gate，不得成为业务状态真源。

## 8. 禁止的副作用

1. `RecallModePanel`、`WorkbenchShell` 或 presentational panel 直接 import/call service、store、repository、Sabaki 或 DB。
2. Container 在 submit 主路径中直接 `workbenchStore.updateTab(...)` 或 `runtimeStore.setRecallView(...)` 来替代 service state-forward；Container 只负责 callback delegation、review schedule seam 和 projection。
3. 测试通过 `runtimeStore.setRecallView(makeRecallView())`、`workbenchStore.updateTab({mode:'recall'})` 或 `props.mode='recall'` 制造主 submit-to-recall 绿灯。
4. Store 直接调用 engine、DB、UI、IPC 或 repository。
5. Resolver 参与本 submit 投影修复时产生副作用。
6. `snapshotService` 承担 tab opening、submit flow orchestration 或 recall hydration。
7. 引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为 submit 主路径。
8. 用 `origin.provider`、旧 `source_kind` 或 `source/kind` 字段分支决定 submit 后进入哪个 UI。
9. 修改正式 game tree、scratch workspace、ExplorationBranch、analysis current/reference。
10. 默认展示 AI candidates 或 checkpoint correction 作为 submit 后 Recall 默认 UI。

## 9. 测试/验收契约表

### 9.1 Source Row 覆盖表

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PRD §5.2 lines 169-184: Workbench mode fixed to Play/Problem/Recall/Analysis | Submit 后只能进入四 mode 中的 `recall`；不得新增 `problem_attempt`、`review`、`punishment` 等运行态 mode。 | S2R-T03, S2R-T05 | SERVICE_REPOSITORY_TRANSITION, PROJECTION_RETURN | GREEN | 当前 tab mode 基础转换应满足；本回归仍需用真实 submit 锁定。 |
| Architecture §0.4 lines 135-139: `play/problem + submit + activeAttempt && !frozen` | `play` 与 `problem` submit 均 freeze attempt、create RecallSession、`mode='recall'`、`recallSubstate='normal'`。 | S2R-T03 | SERVICE_REPOSITORY_TRANSITION | GREEN | 基础 state-forward 行为应满足；T03 还会暴露 projection cache 缺口。 |
| Architecture §9.4 lines 1811-1825: submit command chain | 可见 submit 通过 Container 到 `workbenchFlowService.submit(tabId)`，再经 attempt/recall service/repository，最后更新 tab active recall id 与 runtime active recall id。 | S2R-T01, S2R-T02, S2R-T03, S2R-T04 | UI_COMMAND_MAPPING, CONTAINER_DELEGATION, SERVICE_REPOSITORY_TRANSITION, STORE_SUBSCRIPTION | GREEN | T01/T02 证明 UI/Container；T03/T04 证明真实 service/store outcome。 |
| UI/UX §0 lines 20-27 and component tree lines 989-999: top actions + left panel | 顶部 ModeActions 提供当前 mode action；左侧只展示当前 mode 面板；submit 后左侧应切到 Recall panel。 | S2R-T01, S2R-T06 | UI_COMMAND_MAPPING, RENDERED_UI_RETURN | RED | 控件存在应通过；真实 submit 后 Recall panel active return 是当前缺口。 |
| Current code evidence: Problem top `mode-action-submit` | Problem 顶部 `提交答案` 必须触发 semantic `onSubmit`，无业务 payload。 | S2R-T01, S2R-T02 | UI_COMMAND_MAPPING, CONTAINER_DELEGATION | GREEN | 只证明 command mapping/delegation，不证明 state-forward。 |
| Current code evidence: Problem left `submit-answer-btn` | Problem 左侧 `提交答案` 必须触发 semantic `onSubmitAnswer` 并映射到同一 submit handler。 | S2R-T01, S2R-T02 | UI_COMMAND_MAPPING, CONTAINER_DELEGATION | GREEN | 事件对象不得被当成 tab id。 |
| Service/runtime projection, current migration seam | Submit 成功后，active RecallSession facts 仍在 repository/service；runtime `recallView` 只作为 transient active projection/cache，并与 tab/runtime session id 一致。 | S2R-T03, S2R-T05, S2R-T08 | SERVICE_REPOSITORY_TRANSITION, PROJECTION_RETURN | RED | 当前 observed gap：service submit 只设置 active id，Recall panel projection 仍可能 empty。 |
| Store subscription/projection return | 真实 submit 导致 store-owned state 变化后，Container 观察到变化并投影出 Recall props；不要求 setter 顺序或每个 setter 独立通知。 | S2R-T04, S2R-T05 | STORE_SUBSCRIPTION, PROJECTION_RETURN | RED | Outcome-based；禁止断言内部 setter call order。 |
| Rendered Recall UI return | Shell 根据 projected `mode='recall'` 选择真实 `RecallModePanel`，显示 active progress，不显示 empty state。 | S2R-T06 | RENDERED_UI_RETURN | RED | 防止 props-only fake green。 |
| Play top `mode-action-end` current visible action | `结束当前 attempt` 最终应成为 Play 可见 submit/end attempt path，但本步不改。 | S2R-FU-PLAY-END | RENDERED_UI_RETURN | DEFERRED | Reason: current code routes Play `onEnd` through `handleEndPlay`/engine stop seam；本步目标是 Problem submit-to-recall projection。Exit: follow-up task rewires Play visible end to submit/end attempt and adds tests for top action -> service -> Recall UI. |
| Legacy App gate seam | `sabaki.state.mode` 只可作为 legacy mount/layout gate；Shell mode 真源必须是 Workbench active tab。 | S2R-FU-APP-GATE, S2R-M02 | ARCHITECTURE_BOUNDARY | DEFERRED | Reason: App gate rewrite is broader than submit projection. Exit: App gate reads Workbench store or approved mirror seam is added and architecture-reviewed; add App-level rendered test. |
| Architecture §0.3/§5.3 forbidden source-specific APIs | Submit path 不得按 `origin.provider/source_kind` 分支，不得引入 `openGameTab/openProblemTab/openSnapshotProblemTab`，不得让 `snapshotService` orchestrate submit。 | S2R-T07, S2R-T09 | ARCHITECTURE_BOUNDARY | GREEN | Static guard/review prevents this regression in the new suite and helpers. |

### 9.2 契约项

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| S2R-C01 | WIRING | MUST_AUTOMATE | 可见 Problem submit 命令必须通过 presentational callback 到 Container `handleSubmit()`，真实调用签名无业务 payload。 | 防止 UI 有按钮但没有进入 service。 | 只测 service 会漏掉按钮/prop 断线。 |
| S2R-C02 | STATE | MUST_AUTOMATE | `workbenchFlowService.submit` 在 active attempt 上必须把 play/problem active tab 推进到 recall，并设置 `recallSubstate='normal'`、tab/runtime `activeRecallSessionId`。 | 锁定 Architecture §0.4/§9.4 state-forward。 | 只测 callback 调用会无法发现状态没变。 |
| S2R-C03 | STATE | MUST_AUTOMATE | Submit 成功后必须产生可投影的 Recall surface。本步选择 service-side `runtimeStore.recallView` hydration，但将其定义为 transient projection/cache，完整事实仍在 repository/service。 | 这是当前 observed gap 的核心。 | Shell 可能 mode=recall 但左 panel 仍是 empty。 |
| S2R-C04 | STATE | MUST_AUTOMATE | `recallView.recallSessionId`、tab active recall id、runtime active recall id 必须一致；stale view 在 tab/session switch 或 completion 后不能继续被投影。 | 防止重复 tab/session 下显示错 session。 | 用户可能看到上一题的 Recall 进度。 |
| S2R-C05 | WIRING | MUST_AUTOMATE | `workbenchStore`/`runtimeStore` subscription 与 Container projection 必须形成 outcome：真实 submit 后 projected props/UI 改变。 | 防止状态已变但 UI 不回流。 | 只断言 store 值会漏掉 UI 不更新。 |
| S2R-C06 | UI_BEHAVIOR | MUST_AUTOMATE | Container projection 必须把 store/session state 映射到 `WorkbenchShell`：`mode='recall'`、`state='active'`、`totalMoves/currentMove/progress` 来自 active Recall surface。 | 锁定数据到 props 的返回路径。 | 只测 service 会漏掉 projection 字段缺失。 |
| S2R-C07 | UI_BEHAVIOR | MUST_AUTOMATE | Shell smoke 必须渲染真实 `WorkbenchShell`/`RecallModePanel`，看到 Recall active panel，不看到 `暂无回忆任务` empty state。 | 证明真实可见 UI 变了。 | 只看 `container.render().props` 不能证明 panel selection。 |
| S2R-C08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | fake-green guard 限定新 regression suite 和本地 helpers，忽略 comments/strings，禁止 arrange/act 直接或间接手动 seed `setRecallView`、`updateTab(mode:'recall')`、`props.mode='recall'`。 | 直接针对当前假绿来源。 | 回归会被手动 seed 掩盖。 |
| S2R-C09 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | 新 submit path 不得引入 source-specific tab open API、`snapshotService` orchestration、UI component 直接依赖 service/store/repository。 | 锁定 v0.5 边界。 | 修复 projection 时可能回退到 v0.4 source/kind 分支。 |
| S2R-C10 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | 完整 App 手动验收关注 split state seam：legacy `sabaki.state.mode` 只作为 App mount gate；Shell mode 必须由 active tab 投影为 recall。 | 防止 App 层仍显示旧 mode 布局。 | Container/Shell 测试通过但完整 App 仍挂载/样式异常。 |

## 10. 必须自动化的测试

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S2R-T01 | UI_COMMAND_MAPPING | `WorkbenchShell`, `ModeActions`, `ProblemModePanel` visible submit controls | Preact render helper, production components | One local tiny callback for `onSubmit` / `onSubmitAnswer` | `local tiny stub` | No mocked `TrainingWorkbenchContainer`; no mocked `workbenchFlowService`; no store mutation | Clicking `mode-action-submit` and `submit-answer-btn` reaches the supplied semantic callback with no business payload requirement. | S2R-T02 |
| S2R-T02 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer` handler binding | Real `TrainingWorkbenchContainer`, real `createWorkbenchStore`, real `createTrainingRuntimeStore`, active problem tab | `workbenchFlowService` typed spy; minimal Sabaki shell harness | `shared typed spy factory` from `test/workbench/shared/workbenchSpyFactories.ts`; local tiny stubs only for unused Sabaki UI methods | No manual `setRecallView`; no manual `updateTab({mode:'recall'})`; no manual `props.mode='recall'`; do not claim state-forward | Invoking projected `onSubmit`/`onSubmitAnswer` from Container calls `flowService.submit(activeTab.id)` for the active tab. | S2R-T03 |
| S2R-T03 | SERVICE_REPOSITORY_TRANSITION | Real `createWorkbenchFlowService(...).submit(tabId)` | Real `createWorkbenchFlowService`, real stores, real `createAttemptService`, real `createRecallService`, real/typed checkpoint service, in-memory repository fake seeded with active playing/problem attempt | `snapshotService` unused typed stub; `evaluationRules` local tiny function returning pass; logger | `in-memory repository fake` constrained by `TrainingRepository`; `real production interface/type`; `local tiny stub` only for pure `evaluationRules`/unused snapshot method | Do not mock `WorkbenchFlowService`, `RecallService`, `AttemptService`, `workbenchStore`, `runtimeStore`, or repository with per-file ad hoc object unless typed helper is first added | After `await service.submit(tabId)`: attempt is frozen/submitted, repository has one RecallSession from attempt, tab is `mode='recall'`, `recallSubstate='normal'`, tab/runtime active recall ids match session id, and chosen service hydration produces a transient `recallView` with the same session id. | S2R-T04, S2R-T05, S2R-T08 |
| S2R-T04 | STORE_SUBSCRIPTION | Store-to-Container notification outcome after real submit | Real `TrainingWorkbenchContainer` subscription path or an equivalent real-store observer harness; real stores from S2R-T03 | Subscriber counters/spies as local tiny callbacks only | `local tiny stub` | No mocked stores; no direct state seeding after submit; no assertion of individual setter order or exact notification count | Real submit causes store-owned state changes that are observable by a subscriber/projection harness, yielding changed projected mode/recall surface. | S2R-T05 |
| S2R-T05 | PROJECTION_RETURN | `TrainingWorkbenchContainer` projection after real submit | Real Container, real stores, real flow service from S2R-T03 harness or equivalent harness sharing the same real service | Minimal Sabaki shell harness; unused UI methods local tiny stubs | `real production interface/type`; `in-memory repository fake`; `local tiny stub` for unused shell methods | No mocked flowService; no manual `setRecallView`; no manual `updateTab({mode:'recall'})`; no direct `props.mode='recall'` override | After visible/delegated submit completes and stores notify, `container.render().props` has `mode='recall'`, `state='active'`, `currentMove=0`, `totalMoves=session.expectedMoves.length`, progress derived from active Recall surface, and does not require legacy `sabaki.state.mode === 'recall'`. | S2R-T06 |
| S2R-T06 | RENDERED_UI_RETURN | Real `WorkbenchShell` with real `RecallModePanel` selected from projected props | Production `WorkbenchShell`, `RecallModePanel`, projected props from S2R-T05 | None beyond test DOM utilities | `real production interface/type` | Do not replace `RecallModePanel` with a fake; do not assert only props | Rendered shell has `data-mode="recall"`, contains `data-testid="recall-mode-panel"` with active progress content such as `0 / N`, and does not render the empty title `暂无回忆任务`. | not-covered: full Electron/App visual acceptance remains manual in S2R-M01/S2R-M02 |
| S2R-T07 | ARCHITECTURE_BOUNDARY | Fake-green guard for the new submit-to-recall regression suite and its local helpers | AST/token scanner or lint helper over `test/workbench/wiring/submit-to-recall-projection.test.*` and local helper files imported only by that suite | None | no mocked dependencies | Do not scan broad unrelated legacy tests; do not use bare substring-only search; ignore comments and string literals; do not ban production service code | Guard fails if arrange/act directly or indirectly seeds `runtimeStore.setRecallView(...)`, `workbenchStore.updateTab(...mode:'recall')`, or `props.mode='recall'`; guard allows production submit to call real store APIs during act. | Step4 test audit |
| S2R-T08 | PROJECTION_RETURN | Stale recall projection cleanup/ignore behavior | Real stores and Container projection; real service path when switching/completing is in scope, otherwise projection-level mismatch harness | Minimal Sabaki shell harness; local tiny stubs for unused UI methods | `real production interface/type`; `local tiny stub` only for unused shell methods | No manually seeded passing state; if constructing stale state, it must be explicitly a negative/mismatch fixture, not the success path | A `recallView` whose `recallSessionId` does not match tab/runtime active recall id is not projected as active Recall UI; completion/session switch clears or replaces the view before rendered return. | S2R-T06 |
| S2R-T09 | ARCHITECTURE_BOUNDARY | Static/source boundary for new submit-to-recall implementation/tests | Source scanner over files touched by this task only | None | no mocked dependencies | Do not scan archived docs as production evidence; do not reject existing legacy APIs outside touched submit path | Touched submit/projection files do not add `openGameTab/openProblemTab/openSnapshotProblemTab`, `snapshotService` orchestration for submit, `origin.provider`/`source_kind` flow branching, or UI component service/store imports. | architecture review |

如果 S2R-T03/S2R-T05 需要新增 helper，先补 `test/training/shared` 或复用/扩展 `test/training/phase3TypedFakes.ts`，并用生产 `TrainingRepository` / service interfaces 约束。不得在测试文件内临时手写完整 `RecallService`、`AttemptService`、repository port 替身。

Test harness / mock manifest:

| 依赖 | 本契约要求 | Mock Contract Source |
| --- | --- | --- |
| `WorkbenchFlowService` | S2R-T03/S2R-T05 必须用真实 `createWorkbenchFlowService`; S2R-T02 才可用 typed spy。 | `real production interface/type`; S2R-T02 用 `shared typed spy factory` |
| `WorkbenchStore` / `TrainingRuntimeStore` | 必须用真实 store；状态变化由 service 触发。 | `real production interface/type` |
| `AttemptService` / `RecallService` | state-forward 主测试必须用真实 service；如果 helper 不足，先补 typed helper，不在测试内手写完整替身。 | `real production interface/type` |
| Repository | 使用 in-memory repository fake，必须实现被真实 service 实际调用的方法并记录状态。 | `in-memory repository fake` |
| `snapshotService` | Submit 主路径 unused，仅提供 typed no-op 以满足 constructor deps。 | `real production interface/type` 或 `local tiny stub` |
| `evaluationRules` / logger / subscriber counters | 只允许局部无状态 tiny stub。 | `local tiny stub` |

Forbidden test setup for the main regression suite:

```text
No runtimeStore.setRecallView(makeRecallView()) in arrange/act success path.
No workbenchStore.updateTab(...mode:'recall') in arrange/act success path.
No manual props.mode='recall' override in arrange/act success path.
No mocked flowService.submit in tests claiming state-forward/projection/rendered return.
No helper that indirectly performs those seeds before the act.
```

Allowed:

```text
Production service may call real runtimeStore/workbenchStore APIs during submit.
Negative stale-state tests may construct mismatch fixtures only to prove they are ignored/cleared, not to create the success path.
Comments and string literals explaining the forbidden patterns must not fail S2R-T07.
```

## 11. 仅手动验收

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | --- | --- | --- | --- | --- |
| S2R-M01 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | 运行应用，打开一个有 active attempt 的 Problem tab，点击 `提交答案`，确认左侧切到 Recall 面板并显示真实进度；不要求 Playwright 作为主验收。 | 观察完整 App gate、legacy mode class、真实用户点击。 | 单元/DOM 测试可能漏 App 外层 mount gate。 |
| S2R-M02 | ARCHITECTURE_BOUNDARY | MANUAL_ACCEPTANCE | 若 legacy `sabaki.state.mode` 未同步为 recall，确认 Workbench 仍被挂载且 Shell mode/left panel 由 active tab 驱动。若不成立，记录 follow-up `S2R-FU-APP-GATE`。 | 明确 split state seam。 | Container/Shell 测试通过但 App 层显示旧布局。 |

## 12. 不测试

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | --- | --- | --- | --- | --- |
| S2R-N01 | UI_BEHAVIOR | DO_NOT_TEST | 不做像素、CSS token、响应式或截图还原。 | 本步是数据/projection 回归。 | 视觉范围扩大拖慢修复。 |
| S2R-N02 | SIDE_EFFECT | DO_NOT_TEST | 不覆盖 Phase 5 checkpoint comment/correction 剩余项。 | 用户明确要求小串行步骤。 | 混入 checkpoint 会导致不必要冲突。 |
| S2R-N03 | ARCHITECTURE_BOUNDARY | DO_NOT_TEST | 不测试 source-specific tab opening、snapshot、Analysis scratch、Review 队列推进全流程。 | 与 submit-to-recall projection 无关。 | 扩大到 Phase 5/Review。 |
| S2R-N04 | PURE_LOGIC | DO_NOT_TEST | 不锁死 `RecallSession.expectedMoves` string 到 panel move object 的精确坐标/sign 转换，除非实现先引入生产 mapper。 | 目前主风险是可见 UI 不回流。 | 过早冻结临时格式。 |
| S2R-N05 | UI_BEHAVIOR | DO_NOT_TEST | 不在本步测试 Play 顶部 `结束当前 attempt` 到 Recall 的可见完整闭环。 | 正式 deferred 到 follow-up。 | 与 Problem submit repair 合并会扩大 scope。 |

## 13. 脆弱测试警告

1. **Callback-only 假绿**：`flowService.submit` spy 被调用一次只能证明 `CONTAINER_DELEGATION`，不能证明 state-forward 或 UI return。
2. **手动状态假绿**：主 regression suite 里任何 success-path `runtimeStore.setRecallView(...)`、`workbenchStore.updateTab({mode:'recall'})` 或 `props.mode='recall'` 都会掩盖真实 submit 没有可见 Recall UI 的 bug。
3. **裸 substring 假红/漏报**：S2R-T07 不得只做全仓字符串搜索；它必须限制到新 regression suite/local helpers，忽略 comments/strings，并能发现间接 helper seeding。
4. **Props-only 假绿**：`container.render().props.mode === 'recall'` 只能证明 `PROJECTION_RETURN`，不能证明真实 `RecallModePanel` 被 Shell 选中；必须有 S2R-T06 rendered smoke。
5. **过度指定**：不要断言随机 session id 格式、时间戳、日志顺序、内部 Promise 顺序、setter 顺序或每个 setter 独立 notification，除非该顺序本身成为业务契约。
6. **Split state 假设**：不要把 legacy `sabaki.state.mode` 当成 `WorkbenchShell.mode` 真源；测试必须让 active tab mode 驱动 Shell mode。
7. **Mock drift**：`RecallService`、`AttemptService`、repository、flow service 不得在单个测试文件里手写完整替身；使用真实服务或 typed fake/helper。

## 14. 超出范围

1. 修复 Play 顶部 `结束当前 attempt` 的完整 submit UX。
2. 重写 App Workbench mount gate 以包含 Problem 或完全移除 legacy `sabaki.state.mode` gate。
3. Phase 5 checkpoint correction/comment UI、AI reveal、checkpoint queue。
4. Recall move input / `recallAnswer` 提交流程。
5. Snapshot、Analysis return target、source-specific tab APIs。
6. 任何视觉重构、CSS、布局、design token。

Deferred follow-ups:

| Follow-up ID | Scope | Deferred reason | Exit condition |
| --- | --- | --- | --- |
| S2R-FU-PLAY-END | Play top `mode-action-end` visible end attempt -> submit/end attempt -> Recall UI | Current code routes Play top end through `handleEndPlay`/engine stop seam; changing it with Problem submit projection would widen service and UX scope. | Separate contract/test proves `mode-action-end` in Play triggers the approved attempt completion command, freezes/finalizes attempt, creates RecallSession, and renders Recall panel. |
| S2R-FU-APP-GATE | App legacy `sabaki.state.mode` Workbench mount/layout gate | App shell migration is broader than Container/Shell projection. The seam may remain if Workbench stays mounted and Shell mode is active-tab driven. | Either App gate reads Workbench store directly, or an approved one-way mirror seam syncs legacy mode after service success; architecture review confirms it is not business truth. |

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 不允许 | PRD §5.2 区分业务对象和 mode；Architecture §0.3 lines 100-110 禁止按 `origin.provider` 分叉主流程。 | 测试/实现不得按 origin/source_kind 决定 Recall UI。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 不允许 | Architecture lines 23-25 和 §5.3 lines 711-725 禁止 v0.4 source-specific tab opening API 作为新主路径。 | Submit-to-recall 不调用 tab open API；S2R-T09 扫描 touched files。 |
| 是否让 `snapshotService` 承担 Architecture v0.5 未分配的 tab opening / flow orchestration | 不允许 | Architecture §0.3 line 107 禁止 snapshotService 打开 Tab；§9.4 submit 不包含 snapshotService。 | `snapshotService` 在 harness 中只能是 unused typed stub。 |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 不允许用于 submit 主路径 | Architecture §1.2/§9.4 把 submit store writes 放在 service chain 后。 | Container 只做 callback delegation、review schedule seam 和 projection；submit state mutation 属于 service。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不允许 | Architecture §0.3 lines 91-98：UI 只展示；Container/Controller 读 Store、调 Service。 | `RecallModePanel` / `WorkbenchShell` 保持 props-only；S2R-T09 检查 touched UI files。 |
| 是否把 `runtimeStore.recallView` 当作 Architecture §4.3/§9.4 硬真源 | 不允许 | §4.3 lines 564-628 只声明当前运行态和 active ids；§9.4 lines 1811-1825 止于 active recall id。 | v0.2 明确把 `recallView` 定义为当前迁移策略的 transient projection/cache。 |
| 是否声称 repository-backed Container/ViewModel projection 架构禁止 | 不允许 | Architecture §1.1 lines 164-178 允许 `Store / Repository query -> Container / ViewModel -> UI Component`。 | 本步选择 service hydration 作为 primary implementation path，但不否定 repository-backed projection。 |
| 是否把 `problem` 当作棋盘 mode 或引入第五 mode | 不允许 | PRD §5.2 lines 171-184；Architecture §0.4 lines 118-133。 | Submit 后 mode 必须为四模式中的 `recall`。 |
| 是否让 Recall submit 修改正式棋谱或 scratch | 不允许 | 本契约位置源排除 scratch/game-tree mutation；Architecture §0.4 line 156 禁止 Analysis 自由摆棋写 Attempt.userLine，submit 更不得写 scratch/game tree。 | Service 只写 attempt/recall/session runtime。 |
| 是否要求 legacy `sabaki.state.mode` 成为 Shell mode 真源 | 不允许 | 当前代码 Shell mode 来自 `projectFromWorkbench`; App gate seam 是迁移问题。 | 本步测试 active tab projection；App gate 处理正式 deferred。 |

## 16. Workbench 接线清单（如适用）

### 16.1 控件清单

| 控件/区域 | 状态 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Problem top action `mode-action-submit` | active | `submitAttemptToRecall` | presentational component emits `onSubmit`; Container owns active tab lookup; service owns write | Architecture §9.4; UI/UX §0 top toolbar | none in component; Container calls `flowService.submit(activeTab.id)` | service store updates -> subscription -> Shell props | S2R-T01, S2R-T02 | panel callback plumbing |
| Problem left `submit-answer-btn` | active | `submitAttemptToRecall` | `ProblemModePanel` emits `onSubmitAnswer`; Container maps to same handler | UI/UX left mode task surface; Architecture §9.4 | none in panel; same service command | same as top action | S2R-T01, S2R-T02 | panel callback plumbing |
| `workbenchFlowService.submit` | active | freeze/finalize/create recall/hydrate transient view | service | Architecture §0.4, §5.3, §9.4 | attempt frozen, RecallSession persisted, tab/runtime active ids updated, chosen transient recallView hydrated | stores notify Container; Container projects Recall props | S2R-T03, S2R-T04, S2R-T05 | controller/service |
| `runtimeStore.recallView` | active migration cache | active Recall view cache | service/runtime store | Current implementation seam; Architecture §4.3 only allows current runtime state, not full facts | set from typed mapper after created session; clear/replace on mismatch, switch, completion | projection yields active Recall panel only when ids match | S2R-T03, S2R-T05, S2R-T08 | controller/service + container/projection |
| Container projection | active | mode and recall props | `TrainingWorkbenchContainer` | Architecture §1.1 read path; UI/UX left panel | no business write | `mode='recall'`, `state='active'`, progress/count props | S2R-T05 | container/projection |
| `WorkbenchShell` left panel | active | select `RecallModePanel` | Shell presentational | UI/UX component tree lines 981-1009 | no state write | active Recall panel visible; empty state absent | S2R-T06 | shell smoke |
| Play top `mode-action-end` | deferred | end current attempt | deferred; later Container/service decision | UI/UX Play actions; Architecture play/problem submit row | no change in this step | not part of this repair | S2R-FU-PLAY-END | out of scope |
| Legacy App mount gate | deferred boundary | optional legacy mirror only after approval | App/Container migration seam, not business owner | Current code evidence, not product truth | no change in this step | Shell mode remains active-tab driven | S2R-M02, S2R-FU-APP-GATE | architecture review |

### 16.2 命令清单

| 语义命令 | Presentational component | `TrainingWorkbenchContainer` | Controller | Service | Existing Sabaki command |
| --- | --- | --- | --- | --- | --- |
| `submitAttemptToRecall` | Emits `onSubmit` / `onSubmitAnswer` only | Resolves active tab id and calls `flowService.submit(activeTab.id)` | No separate controller in this step | `workbenchFlowService.submit` owns orchestration; `attemptService`/`recallService` own facts | none |
| `hydrateActiveRecallProjection` | none | reads projected store state only | none | service-owned mapper writes transient runtime cache for this chosen path | none |
| `endPlayVisibleAttempt` | current Play top `onEnd` exists | deferred | deferred | deferred | current engine/legacy seam remains out of scope |
| `legacyAppGateMirror` | none | deferred optional seam only after audit | none | none | optional `sabaki.setMode?.('recall')` mirror if approved; not business truth |

### 16.3 状态前进、回流和订阅契约

| 契约 | 要求 |
| --- | --- |
| 状态前进 | Real submit must create/freeze/finalize domain facts through repository/services, then set active tab `mode='recall'`, `recallSubstate='normal'`, active recall ids, and chosen transient RecallView cache with matching id. |
| 状态回流 | Store state must project to `WorkbenchShell` props: `mode='recall'`, active Recall panel state, `currentMove=0`, `totalMoves=session.expectedMoves.length`, and non-empty progress surface. |
| 订阅 | Tests assert observable outcome after store-owned state changes. They must not require a specific setter sequence, a fixed notification count, or separate notification per setter. |

弱测试禁令：不得把“callback 被调用一次”作为主验收。它只能覆盖 S2R-T01/S2R-T02，后续必须由 S2R-T03/S2R-T05/S2R-T06 证明 state-forward 和 UI return。

## 17. 任务并行建议（如适用）

本 step 是一个小串行 contract retry，不拆并行 worker。后续可按 checklist 串行执行：

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| step2 contract audit | 本 contract review notes only | step1 | 串行审核，不并行 | 审核反馈可能要求 contract v0.3 |
| step3 tests by mode | `test/training/workbenchFlowService.test.js`, `test/workbench/wiring/submit-to-recall-projection.test.js`, typed helper if needed | step2 | 当前计划串行；service/projection tests 共享 harness，避免并行写冲突 | 最容易引入 fake-green setup，需 step4 audit |
| step3 helper/guard | `test/workbench/wiring/submit-to-recall-projection.test.*` local helper or shared typed fake only if needed | step2 | 可与 test design分工，但同一 suite 最好单 owner 合并 | AST guard 误扫 comments/strings 或漏 helper alias |
| step5 implementation | `src/modules/training/workbench/workbenchFlowService.ts`; typed mapper/helper; `TrainingWorkbenchContainer.js` only if projection fallback/legacy mirror is explicitly approved | step4 | 串行锁 service/projection shared files | Service hydration 与 Container repository-backed fallback 不应同时成为未审计双主路径 |
| architecture review | no production writes | step6 | 验证完整 loop | 若发现 legacy App gate 必须另开 follow-up |
