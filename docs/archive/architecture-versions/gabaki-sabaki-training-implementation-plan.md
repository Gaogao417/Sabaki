# Gabaki / Sabaki Training Implementation Plan

> 文档类型：长期实施计划对应 PRD：`gabaki-sabaki-training-prd-v0.5.md`
> 对应架构：`gabaki-sabaki-training-architecture-v0.5.md`
> 当前代码现状：训练域已经落地一批 v0.5 切片，包括
> `TrainingTask.origin` 兼容建模、`WorkbenchTab.mode`、`openTask`、
> `workbenchFlowService`、`taskImportService`、Attempt moveActors、Problem AI
> problemArea 过滤、BadMove 派生幂等、Review `openTask`、Workbench UI shell /
> panels。后续重点不再是从零开始，而是补齐 v0.5 契约缺口，并清理仍在主路径上的
> legacy shim。

---

# 0. 文档权威关系

```text
UI-UX Spec v0.5        = 产品体验权威
Architecture v0.5      = 工程架构权威
Implementation Plan    = 迁移执行权威
Architecture v0.4      = legacy reference，只用于理解迁移前状态
```

本计划只执行 v0.5 主路径。v0.4 的 `Phase`、`TrainingTaskKind`、
`source_kind`、`openProblemTab`、`openSnapshotProblemTab` 等概念只用于识别和
迁移 legacy 代码，不得作为新实现主路径。

## 0.1 当前实现快照

已经落地：

```text
TrainingTask.origin 兼容建模
WorkbenchTab.mode
WorkbenchTab.recallSubstate / analysisReturnTarget
modeTransitions.ts 纯状态机骨架
workbenchTabService.openTask
workbenchFlowService skeleton
taskImportService skeleton + local/manual/snapshot/badMove paths
Attempt userLine + moveActors
RecallPolicy + expectedMoveIndexes 数据与派生函数
Problem AI problemArea 二次过滤
BadMove createTaskFromBadMove 幂等返回 generatedTaskId
Review openDueItem → openTask
gobanDataAdapter + boardInteractionController + projectGobanProps
workbenchPhaseService @deprecated 标记
ModeBar disabled policy / Analysis return UI policy
Workbench shell / mode panels / right panels / bottom action bar
```

部分完成：

```text
legacy kind/source/phase 仍保留为兼容字段
openGameTab / openProblemTab / openSnapshotProblemTab 仍存在
workbenchFlowService 已调用 modeTransitions，但仍有 legacy bypass、previousMode mirror 和分散 enter/exit effect
workbenchPhaseService 已 deprecated，但仍被导出、测试和部分 wrapper 使用
Snapshot 仍有 createProblemFromCurrentAnalysisPosition / Problem path，且 flowService 当前未限制 analysis-only
RecallSession 仍有 legacy source/type/startMove/endMove
Review addToReviewQueue 已有，但缺少显式 ReviewEnrollmentPolicy
Problem board path 已可按 WorkbenchMode.problem 路由，但 openProblemTab 仍会 legacy setMode('play')
Analysis workspace / overlay / scratch effect 仍主要由 sabaki.setMode('analysis') 执行
```

未完成的新契约：

```text
ModeState / companion state resolver（只读聚合 tab/runtime/overlay/engine）
ModeEnterEffect / ModeExitEffect 原子编排入口
Snapshot analysis-only precondition + child problem tab contract
FrozenAttempt / MutableAttempt 写入边界和 repository allowlist
Problem explicit mode 主路径：不再依赖 legacy play + problemView 双重真相
Problem undo 同步回滚 tree / runtime / Attempt.userLine
Recall complete 不污染 Attempt.userLine/result/status；recallCompleted/status 需迁出或 allowlist
Recall/Analysis overlay and engine projection gating
AiMovePending 竞态保护
完整 SnapshotTaskInput parent context / requestId
ExplorationBranch
ReviewEnrollmentPolicy
UI keyboard command path / compact layout / disabled reason stories
```

## 0.2 2026-05-25 Mode Orchestration Contract 对齐

本计划从 2026-05-25 起必须优先对齐
`docs/design/workbench-mode-orchestration-contract.md`。该合同是 Workbench 运行态状态机的
source of truth；当它和早期 PRD / Architecture v0.5 / 本计划旧文本冲突时，以该合同为准。

合同带来的计划修正：

```text
Snapshot 不再是任意 mode 的全局派生能力；
主路径收紧为 analysis -> snapshot problem child tab。

Problem entity / task 不是 mode；
WorkbenchMode.problem 是一等运行态 mode，不能继续依赖 sabaki.state.mode='play' + runtime.problemView。

Recall / Analysis 只能读取 FrozenAttempt；
RecallSession、RecallAttempt、Checkpoint、Comment、Snapshot 是独立事实，不能隐式补丁 Attempt.userLine/result/status。

Mode transition 必须收束 tab patch、runtime patch、overlay patch、engine/scratch effect；
不能只 patch WorkbenchTab.mode，然后把 workspace / overlay / engine 副作用留给 sabaki.setMode。

OverlayRegion 和 EngineAnalysisRegion 是受 mode 约束的 orthogonal region；
territory/compare 只属于 analysis，stale async callback 必须被 generation / target guard 丢弃。
```

当前代码和合同的对齐判断：

```text
OK:
  - modeTransitions.ts、AnalysisReturnTarget、RecallSubstate 已存在。
  - gobanDataAdapter / boardInteractionController 已把 WorkbenchMode 注入 resolver。
  - projectGobanProps 已在 recall 下隐藏 analysis overlay。
  - overlayStore 已有 analysis-only territory/compare guard 和 generation invalidation。

Gap / Risk:
  - modeTransitions.ts 和 workbenchFlowService 仍允许 snapshot from any mode。
  - snapshotService.captureSnapshotInput 支持 play/problem/recall/analysis，缺 analysis scratch precondition。
  - recallService.completeRecall 仍 patch source Attempt 的 recallCompleted/status。
  - problemFlowService.undoProblemMove 只回滚 runtime cache，未回滚 Attempt.userLine。
  - openProblemTab legacyCompatibility 仍把 sabaki.state.mode 设成 play。
  - workbenchFlowService.enterAnalysis/returnFromAnalysis 未统一创建/清理 editWorkspace、overlay、scratch analysis。
  - resolveAnalysisDisplay 仍允许 recall analysis projection；projectGobanProps 已隐藏，App/sidebar projection 需统一。
  - workbenchStore.updateTab / trainingRuntimeStore setters 仍是无 companion-state guard 的 shallow mutation。
```

---

# 1. v0.5 实施原则

## 1.1 主线目标

长期迁移目标更新为：

```text
legacy global mode
→ TrainingTask + WorkbenchTab + WorkbenchMode + Attempt
```

业务闭环更新为：

```text
Play / Problem → Submit → Recall
Recall → Analysis 可选
Analysis → Snapshot → child Problem Task / child Tab
BadMove → new TrainingTask → ReviewSchedule
```

核心变化：

```text
source 不再是核心建模维度；
origin 只做来源追溯 metadata；
Mode 表达用户当前意图；
Review 是入口 / 队列，不是棋盘模式；
Analysis 是自由研究空间，不是强制第三关。
```

## 1.2 工程边界

必须坚持：

```text
UI Component 只展示，不直接写业务 Store；
Container / Controller 读 Store、调 Service；
Service 编排业务动作；
Repository 是唯一训练 DB 入口；
Adapter 隔离 legacy Sabaki API；
Existing Core 不知道 training 业务；
Container 不直接拼装 boardState / overlayState / settings 数据；
Goban 需要的数据由专门的 adapter 输出 snapshot，Container 订阅 adapter 并传递；
点击写入统一走 boardInteractionController → resolver → executor，不走 legacy 双路径。
```

MVP 保持 Service 数量可控：

```text
taskImportService
workbenchTabService
workbenchFlowService
aiMoveService
attemptService
playTrainingMonitor
recallService
recallCheckpointService
snapshotService
reviewService
trainingRepository
```

先不要独立：

```text
problemService
punishmentProblemService
moveEvaluationService
passRuleEvaluator
reviewScheduler
```

拆分触发条件：

```text
出现第二个真实 caller；
需要隔离 legacy API；
需要独立错误恢复；
模块超过约 200 行且有多个独立变化原因。
```

## 1.3 剩余 legacy debt

这些项目不是“完全未做”，而是当前实现中仍存在的兼容层或旧入口。后续开发应继续薄化，
不能把它们恢复成新主路径：

```text
TrainingTask.kind
TrainingTask.source
TrainingTaskKind = game | problem | snapshot_problem | recall_segment
TrainingTaskSource
WorkbenchTab.phase
WorkbenchPhase
workbenchPhaseService
openGameTab / openProblemTab / openSnapshotProblemTab
generatedProblemId / generated_problem_id
Review item_type / item_id
Recall source_json / type / start_move / end_move
Problem.type = punishment 作为主流程判断
```

收敛目标：

```text
TrainingTask.origin
Problem-like 字段直接挂在 TrainingTask 上
WorkbenchTab.mode = play | problem | recall | analysis
workbenchFlowService
workbenchTabService.openTask
generatedTaskId / generated_task_id
ReviewSchedule.taskId
RecallSession.attemptId
```

`workbenchPhaseService` 的特殊规则：

```text
workbenchPhaseService = deprecated legacy compatibility service
workbenchFlowService = v0.5 workflow/use-case 主路径
modeTransitions.ts = 纯状态机表 / 纯函数，不是新 service

禁止继续扩展 workbenchPhaseService。
禁止把 Problem / Checkpoint / Snapshot / Review enrollment 等新流程加回 phaseService。
保留 phaseService 只为 legacy tests、compatibility wrappers 和渐进迁移。
```

## 1.4 实施方式：纵向切片 + 阶段式迁移

Phase 0-9 仍然是长期迁移顺序，但当前代码已经有基础 walking skeleton。后续不再
按“从 Phase 0 重新开始”执行，而是在已有切片上逐步补齐契约。

```text
已落地的基础切片：
  openTask
  render Play / Problem shell
  create Attempt
  Submit
  create RecallSession
  render Recall / Analysis shell
```

之后每个契约补齐都必须带最小 UI 或 command-path 接入：

```text
ModeEnterEffect / ModeExitEffect 补齐时，同时接 Analysis Return / Recall substate UI
RecallPolicy 补齐时，同时接 Recall expectedMoves view model
AiMovePending 补齐时，同时接 AI pending / interruption UI
SnapshotTaskInput 收紧时，同时接 Analysis-only Snapshot button / shortcut disabled reason
ReviewEnrollmentPolicy 补齐时，同时接 Review Inbox / 加入复习入口
```

每个切片都必须覆盖 service tests + 一个 UI smoke / integration test，避免 service
层长时间脱离真实工作台交互。

---

# 2. Phase 0：v0.5 模型收敛

状态：`Landed / cleanup remaining`

目标：先把类型、Repository、DB
mapper 和兼容读取统一到 v0.5 语义，不改变可见 UI 行为。

范围：

```text
src/modules/training/types/task.ts
src/modules/training/types/tab.ts
src/modules/training/types/badMove.ts
src/modules/training/types/recall.ts
src/modules/training/types/review.ts
src/modules/training/repository/trainingRepository.ts
src/modules/db/migrate.js
src/modules/db.js
```

关键任务：

1. 将 `TrainingTask` 改为标准化材料实体：
   - `initialPositionSgf`
   - `prompt`
   - `goal`
   - `passRule`
   - `referenceLines`
   - `problemArea`
   - `tags`
   - `difficulty`
   - `status`
   - `origin?: TaskOrigin`
2. 删除新代码对 `TrainingTaskKind` / `TrainingTaskSource` 的依赖。
3. 增加 `TaskOrigin`，只用于 provider、external id、父级追溯和 raw metadata。
4. 将 `WorkbenchTab.phase` 类型迁移为
   `WorkbenchTab.mode`，先保持旧 UI 兼容 mapper。
5. 将 `BadMove.generatedProblemId` 迁移为 `generatedTaskId`。
6. 将 `ReviewSchedule` 迁移为直接引用 `taskId`。
7. 将 `RecallSession` 收敛为绑定 `attemptId`，MVP 不再保留复杂 RecallSource。
8. `TrainingAttempt` 增加 `moveActors`，用于标记 human / ai 落子来源。
9. `RecallSession` 增加 `recallPolicy` 和 `expectedMoveIndexes`：
   - `fullLine`
   - `humanMovesOnly`
   - `sideToMoveOnly`
10. DB migration 采用增量兼容策略：
   - 新增 v0.5 字段；
   - 旧 `kind/source_json` 可读但不再作为新写入事实；
   - mapper 将旧 source 映射成 `origin`；
   - 旧 review item 映射成 `taskId`，无法映射时进入 migration warning。
11. 增加必要索引：
   - `training_attempts(task_id)`
   - `move_evaluations(attempt_id, move_index)`
   - `bad_moves(attempt_id)`
   - `review_schedule(due_at)`
   - `review_schedule(task_id)`
12. `trainingRepository` 暴露 v0.5 API，同时保留必要 legacy wrapper。

验收：

```text
类型编译通过；
旧 training task 能读取为 v0.5 TrainingTask；
新写入 task 不再需要 kind/source；
ReviewSchedule 新写入只需要 taskId；
BadMove 派生关系使用 generatedTaskId；
Problem task 可保存 problemArea；
Attempt 可保存 moveActors；
RecallSession 可保存 recallPolicy / expectedMoveIndexes；
必要索引存在；
现有入口没有可见行为变化。
```

测试：

```text
task origin mapper tests；
old source → origin compatibility tests；
WorkbenchTab phase → mode mapper tests；
ReviewSchedule taskId migration tests；
problemArea roundtrip tests；
moveActors roundtrip tests；
RecallPolicy / expectedMoveIndexes roundtrip tests；
index existence tests；
repository create/load/update task roundtrip tests。
```

---

# 3. Phase 1：Workbench Mode + openTask 骨架

状态：`Landed / mode-effect gaps remaining`

目标：用 `WorkbenchMode` 和统一 `openTask` 替代 v0.4 的 Phase / source-specific
tab API。

范围：

```text
src/modules/training/types/tab.ts
src/modules/training/store/workbenchStore.ts
src/modules/training/workbench/workbenchTabService.ts
src/modules/training/workbench/workbenchFlowService.ts
src/components/TrainingWorkbenchContainer.js
```

关键任务：

1. 定义：

```ts
type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

type RecallSubstate =
  | 'normal'
  | 'checkpoint_correction'
  | 'checkpoint_ai_revealed'
  | 'checkpoint_commenting'

type AnalysisReturnTarget = {
  mode: 'play' | 'problem' | 'recall'
  recallSubstate?: RecallSubstate
  treePosition?: string
  moveIndex?: number
}
```

2. 新建 `modeTransitions.ts`，用表驱动方式集中定义 mode / substate 的
   event、guard、effect 和 invariant。
3. 实现 `workbenchTabService.openTask({taskId, mode?, parentTabId?})`。
4. 默认 mode 推导：

```text
有 prompt / goal / passRule / referenceLines → problem
否则 → play
```

5. 将 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 改为 legacy
   compatibility wrapper，内部走 `taskImportService` 或 `openTask`。
6. `workbenchFlowService` 是 v0.5 主路径 workflow service，替代
   `workbenchPhaseService` 承载所有新流程：
   - `startAttempt`
   - `submit`
   - `enterRecall`
   - `completeRecall`
   - `enterAnalysis`
   - `returnFromAnalysis`
   - `restartAttempt`
   - `snapshotFromCurrentContext`
7. `workbenchPhaseService` 标为 deprecated legacy compatibility：
   - 不再新增 method；
   - 不再接新 UI command path；
   - 后续只允许删减、薄化或保留 legacy wrapper。
8. 转换规则：

```text
play/problem --submit--> recall
recall --complete--> analysis 或 end
analysis --snapshot--> child tab, mode = problem
play/problem --enterAnalysis--> analysis
recall --enterAnalysis--> analysis
analysis --returnFromAnalysis--> AnalysisReturnTarget
```

9. Analysis Return 必须恢复 previous mode、Recall substate、tree position 和
   moveIndex，不能只靠 `toMode` 猜测。
10. Checkpoint 是 Recall substate，不是 mode。
11. 非法转换 reject / throw 并记录日志。
12. UI panel 渲染改为按 `tab.mode` 分发。
13. `WorkbenchTab` 增加 `playerConfig`：
   - Play Mode：black / white 分别为 human 或 ai；
   - Problem Mode：problemOpponent 为 self 或 ai；
   - AI 设置包括 engineId、timeLimitMs / maxVisits、autoPlay。

当前判断（基于 2026-05-25 代码）：

```text
已落地：
  - WorkbenchMode / RecallSubstate / AnalysisReturnTarget 类型。
  - modeTransitions.ts 纯函数和基础 table-driven tests。
  - openTask 默认 mode 推导、playerConfig 存储、workbenchPhaseService deprecated 标记。
  - returnFromAnalysis 读取 analysisReturnTarget，不再接受外部 toMode。

仍需收敛：
  - modeTransitions snapshot event 仍允许 from any mode，需改为 analysis-only。
  - workbenchFlowService assertTransition 有 legacy bypass，需按合同逐步删除或隔离。
  - completeRecall 仍是 flowService 外加 recallService fire-and-forget，不是原子 TransitionEffect。
  - previousMode 仍与 analysisReturnTarget 并存；只可作为 legacy adapter projection。
  - workbenchStore.updateTab 和 runtimeStore setters 缺 companion-state invariant guard。
```

验收：

```text
openTask(problem-like task) 默认 mode = problem；
openTask(free task) 默认 mode = play；
显式 mode 优先于默认推导；
Submit 必须从 play/problem 进入 recall；
Analysis 不再被强制作为 Recall 后的第三关；
Snapshot 只允许 Analysis scratch context 派生 child Problem tab，且不改变当前 tab；
旧入口仍可兼容。
Play tab 可保存黑白方 human / ai 配置；
Problem tab 可保存对方 self / ai 配置。
```

测试：

```text
openTask default mode tests；
mode transition table-driven tests；
AnalysisReturnTarget restore tests；
RecallSubstate transition tests；
legacy openProblemTab wrapper tests；
analysis snapshot creates child tab tests；
snapshot from play/problem/recall rejected tests；
panel routing tests。
playerConfig store/update tests。
```

---

# 4. Phase 2：taskImportService 与材料入口

状态：`Landed / wrapper cleanup remaining`

目标：把所有外部来源处理集中到导入层，Workbench 后续只处理标准化 Task。

范围：

```text
src/modules/training/import/taskImportService.ts
src/modules/training/repository/trainingRepository.ts
src/modules/foxGameFetchService.js
src/modules/oneOhOneWeiqi/oneOhOneWeiqiService.js
src/components/drawers/TrainingDashboardDrawer.js
src/components/LeftSidebar.js
```

关键任务：

1. 新建 `taskImportService`：
   - `importFoxGame`
   - `importLocalSgf`
   - `import101Problem`
   - `createManualTask`
   - `createTaskFromSnapshot`
   - `createTaskFromBadMove`
2. 所有方法只输出普通 `TrainingTask`。
3. 来源写入 `origin.provider`：

```text
fox
101
local
manual
snapshot
bad_move
review
```

4. Problem-like 信息写入 Task 字段，不再创建特殊 problem kind。
5. Material Browser / Dashboard / legacy problem drawer 调用导入服务后统一
   `openTask`。
6. 禁止在 Workbench 里根据 `origin.provider` 决定主流程。

验收：

```text
野狐 / 本地 SGF 导入为 free task，默认 Play；
101 / 本地题库导入为 problem-like task，默认 Problem；
Analysis Snapshot / BadMove 派生题仍是普通 Task；
origin 只用于显示、追溯、同步和调试；
openTask 不知道 fox / 101 / snapshot / bad_move。
```

测试：

```text
taskImportService output shape tests；
origin_json roundtrip tests；
problem-like default mode integration tests；
legacy problem import compatibility tests。
```

---

# 5. Phase 3：Attempt + AI Move + Submit + Recall

状态：`Partial`

目标：Play /
Problem 产生 Attempt；按玩家配置处理 AI 应手；Submit 冻结 Attempt 并默认进入 Recall。

范围：

```text
src/modules/training/attempt/attemptService.ts
src/modules/training/workbench/aiMoveService.ts
src/modules/training/recall/recallService.ts
src/modules/training/workbench/workbenchFlowService.ts
src/modules/training/store/trainingRuntimeStore.ts
src/modules/training/adapter/engineMoveAdapter.ts
src/modules/workbench/board-interactions/*
```

关键任务：

1. `attemptService.createAttempt` 在 `startAttempt` 或首手落子前创建 Attempt。
2. Play / Problem 每次用户落子后调用
   `attemptService.appendMove({actor:'human'})`。
3. 实现 `aiMoveService`：
   - Play Mode 根据 black / white human|ai 配置决定是否自动落子；
   - Problem Mode 根据 problemOpponent self|ai 决定对方是否由 AI 应手；
   - AI 走法参数来自 `tab.playerConfig.ai`；
   - 发起请求时记录 `AiMovePending(requestId, tabId, attemptId, positionHash,
     color, startedAt)`；
   - 返回时校验 active tab、active attempt、positionHash、mode、合法性和
     problemArea；
   - 过期请求必须丢弃，不能写 documentStore 或 Attempt；
   - AI 落子后统一走 board command，并调用
     `attemptService.appendMove({actor:'ai'})`。
4. Problem Mode 的 AI 应手必须受 `TrainingTask.problemArea` 约束：
   - problemArea 由 analysis area 选择生成；
   - 请求 engine 时传入 analysis area；
   - engine 返回后做二次过滤；
   - 没有 problemArea 或没有范围内候选时，不自动落子。
5. Submit 走 transaction：

```text
freeze Attempt
list MoveEvaluations
list BadMoves
evaluateAttempt
finalize Attempt result
create RecallSession from Attempt
tab.mode = recall
```

6. `RecallSession` 绑定 `attemptId`，但 `expectedMoves` 必须由 `RecallPolicy`
   派生：
   - `fullLine`
   - `humanMovesOnly`
   - `sideToMoveOnly`
   并保存 `expectedMoveIndexes`。
7. Play Mode 双方都为 AI 时必须有自动对弈节流和停止条件：
   - `maxAutoMovesPerRun`
   - `stopOnPassPass`
   - `stopOnResign`
   - `stopOnNoLegalMove`
   - `stopOnUserInterruption`
8. `trainingRuntimeStore` 只保存运行态引用和 UI draft，不保存完整业务历史。
9. 启动时能发现 incomplete attempts / recall sessions。
10. 同阶段接入 UI command path：
   - Play / Problem 的 playerConfig 控件；
   - AI pending / interruption 状态；
   - Submit 顶部主按钮和底部按钮走同一 `workbenchFlowService.submit`；
   - Recall shell 显示 `RecallSession.expectedMoves` 派生后的进度。

当前判断（基于 2026-05-25 代码）：

```text
已落地：
  - attemptService create/append/freeze/finalize 基础生命周期。
  - boardInteractionController 已在 play/problem 落子后 appendMove，并为 AI move 标记 actor='ai'。
  - aiMoveService 有 problemArea engine 参数与返回后二次过滤。
  - RecallPolicy / expectedMoveIndexes 已有类型、派生函数和 repository/service 测试。
  - TrainingWorkbenchContainer 已接 playerConfig 控件和 submit command path。

仍需收敛：
  - AiMovePending 目前不是显式 runtime fact；缺 requestId/tabId/attemptId/positionHash stale guard。
  - attemptService guard 只挡 appendMove；repository.updateAttempt 仍可直接改 frozen Attempt 的 userLine/result/status。
  - recallService.completeRecall 仍写 source Attempt.recallCompleted/status，需要迁到 RecallSession/followup state 或冻结后 metadata allowlist。
  - problemFlowService.undoProblemMove 未回滚 Attempt.userLine，Problem 三方状态可能不同步。
  - Problem submit 仍有 legacy problemService punishment path，需要和普通 Task / BadMove derivation policy 收敛。
```

验收：

```text
Play / Problem 都能创建 Attempt；
每手落子写入 userLine；
AI 落子写入 userLine 且 moveActors 标记为 ai；
Play 可配置黑白双方为 human / ai；
Problem 可配置对方为 self / ai；
Problem AI 不会在 problemArea 外落子；
旧 AI 请求不会在用户悔棋、切 Tab、进入 Analysis 或重新开始 Attempt 后写入；
Submit 后 Attempt frozen，RecallSession created，tab.mode = recall；
RecallSession.attemptId 指向被冻结 Attempt；
RecallSession.expectedMoves 与 recallPolicy / expectedMoveIndexes 一致；
Recall / Analysis 不得修改 frozen Attempt.userLine/result/status；
Problem undo 后 tree、runtime problemView、Attempt.userLine 三者一致；
tab.mode 切换为 recall；
Play / Problem UI 能通过真实 command path 创建 Attempt、触发 AI、Submit 到 Recall；
Analysis 自由摆棋不修改 Attempt.userLine。
```

测试：

```text
attemptService lifecycle tests；
aiMoveService play side controller tests；
aiMoveService problem area constraint tests；
aiMoveService stale request rejection tests；
AI vs AI auto-play limit tests；
submit transaction tests；
recallService create-from-attempt tests；
recallPolicy tests；
frozen Attempt repository write guard tests；
completeRecall no Attempt userLine/result/status write tests；
problem undo rolls back Attempt.userLine tests；
free task → Play → Submit → Recall integration tests；
problem-like task → Problem → Submit → Recall integration tests；
Play / Problem UI command-path smoke tests。
```

---

# 6. Phase 4：MoveEvaluation / BadMove

状态：`Partial`

目标：每手落子产生评价事实，major /
severe 问题手沉淀为 BadMove，但不直接创建派生题。

范围：

```text
src/modules/training/attempt/playTrainingMonitor.ts
src/modules/training/attempt/evaluationRules.ts
src/modules/training/adapter/analysisResultAdapter.ts
src/modules/training/types/evaluation.ts
src/modules/training/types/badMove.ts
```

关键任务：

1. `playTrainingMonitor.startForAttempt` 绑定当前 Attempt。
2. 用户落子后创建 pending MoveEvaluation。
3. analysis update 后补齐：
   - scoreDrop
   - winrateDrop
   - engineSuggestedMove
   - engineSuggestedLine
4. `evaluationRules.classifySeverity` 只做纯函数判断。
5. major / severe 创建 BadMove。
6. pending 超过 30 秒标记 failed，不创建 BadMove。
7. 普通 MoveEvaluation 只保存 hash 和评估字段；只有 BadMove / Checkpoint /
   Snapshot 保存必要 SGF snapshot。
8. BadMove 派生关系字段统一为 `generatedTaskId`。
9. 同阶段接入 UI command path：
   - Analysis 右栏展示 BadMove summary card；
   - Play / Problem 右栏展示 pending / evaluated / failed 评价状态；
   - BadMove 入口只打开 Analysis 或派生 Task，不直接创建 legacy Problem。

Mode orchestration contract 补充约束：

```text
pending MoveEvaluation 可以在 Attempt frozen 后完成；
完成后只能写 MoveEvaluation / BadMove，不得写 Attempt.userLine/result/status。
game-tree live analysis 和 scratch analysis 必须携带 target/context，
不得把 game-tree analysis 写入 editWorkspace，也不得把 scratch result 写回真实 tree。
```

验收：

```text
每手落子产生 pending MoveEvaluation；
有分析结果后 pending → evaluated；
超时 pending → failed；
major / severe 生成 BadMove；
minor / none 不生成 BadMove；
Submit 时 failed evaluation 不作为决定性 pass/fail 依据。
engine analysis update 在 Attempt frozen 后不修改 Attempt；
Analysis UI 能看到 BadMove summary，并可从该卡片进入分析或派生 Task。
```

测试：

```text
evaluationRules unit tests；
pending/evaluated/failed monitor tests；
bad move severity threshold tests；
generatedTaskId repository tests；
submit with failed evaluation tests；
post-freeze evaluation does not update Attempt tests；
analysis target isolation tests；
Analysis BadMove summary card smoke tests。
```

---

# 7. Phase 5：Recall Checkpoint / Comment

状态：`Partial`

目标：Recall 遇到 major / severe BadMove 时进入主动纠错子流程。

范围：

```text
src/modules/training/recall/recallCheckpointService.ts
src/modules/training/types/recall.ts
src/modules/training/types/comment.ts
src/components/training/panels/RecallCheckpointPanel.tsx
```

关键任务：

1. `recallCheckpointService.shouldTriggerCheckpoint` 只对 major / severe
   BadMove 返回命中。
2. `startCheckpoint` 创建 RecallCheckpoint，并设置 runtime active checkpoint。
3. 用户先提交 `userCorrectionLine`。
4. 用户主动 reveal AI candidate lines。
5. comment 作为独立 MoveComment 保存，不嵌入 Attempt。
6. `resumeRecall` 清理 checkpoint runtime 状态后继续 Recall。
7. skipped checkpoint 可进入 Review 候选，但不打断当前流程。
8. 同阶段接入 UI command path：
   - `RecallCheckpointPanel` 显示 correction / reveal / comment / resume 子状态；
   - Analysis Return 能回到 checkpoint substate；
   - 跳过 checkpoint 的 Review 候选使用同一 enrollment path。

Mode orchestration contract 补充约束：

```text
Checkpoint 是 Recall substate，不是 WorkbenchMode。
correctionDraft / activeCheckpointId 是 runtime companion state，只能在 recall 或临时 analysis return context 中存在。
Reveal AI、comment、resume 只能写 RecallCheckpoint / MoveComment / RecallSession；
不得修改 source Attempt.userLine/result/status。
```

验收：

```text
Recall 到 major/severe BadMove 暂停；
Checkpoint 是 recall 的 substate，不是 mode；
用户可先摆 correction line；
Reveal 后显示 AI candidate lines；
comment 保存后继续 Recall；
RecallCheckpointPanel 通过真实 service path 完成 correction → reveal → comment → resume；
中途崩溃后 incomplete recall/checkpoint 可被发现。
```

测试：

```text
checkpoint trigger tests；
Recall → Checkpoint → Correction → Reveal → Comment → Resume integration tests；
skipped checkpoint review candidate tests；
existing recall compatibility tests；
RecallCheckpointPanel command-path smoke tests。
```

---

# 8. Phase 6：Analysis / Snapshot Child Problem

状态：`Partial / contract realignment required`

目标：Analysis 成为低阻碍自由研究空间；Snapshot 只从 Analysis scratch context
派生 child Problem Task / child Tab，不再作为 Play / Problem / Recall 的全局动作。

范围：

```text
src/modules/training/types/analysis.ts
src/modules/training/analysis/snapshotService.ts
src/modules/training/import/taskImportService.ts
src/modules/training/workbench/workbenchFlowService.ts
src/modules/training/workbench/modeTransitions.ts
src/modules/analysis/scratchAnalysis.ts
src/components/workbench/panels/AnalysisModePanel.js
src/components/workbench/shell/ModeActions.js
src/components/workbench/shell/BottomActionBar.js
```

关键任务：

1. 定义 `AnalysisContext`：
   - `taskId`
   - `attemptId`
   - `recallSessionId`
   - `checkpointId`
   - `positionHash`
   - `positionSgf`
   - `createdFrom`
2. 定义 runtime `ExplorationBranch`：
   - `id`
   - `basePositionHash`
   - `baseMoveIndex`
   - `moves`
   - `createdFrom.taskId / attemptId / recallSessionId / checkpointId / badMoveId`
   MVP 可先不落表，但 UI runtime 必须显式保存 active branch。
3. `enterAnalysis` 可从 Play / Problem / Recall 进入，并保存 `AnalysisReturnTarget`。
4. `enterAnalysis` 的 ModeEnterEffect 必须统一编排：
   - patch tab `{mode:'analysis', previousMode, analysisReturnTarget, analysisContext}`；
   - 创建或恢复 scratch editWorkspace；
   - 清理非 analysis overlay，允许 territory pending；
   - schedule scratch analysis；
   - suspend source game-tree writes into scratch target。
5. `returnFromAnalysis` 的 ModeExitEffect 必须统一编排：
   - 只返回 `analysisReturnTarget.mode`；
   - 清 `analysisReturnTarget` / `previousMode`；
   - 清 territory/compare，bump overlay generation；
   - 清或封存 scratch editWorkspace；
   - late scratch analysis result 不得写回真实 tree / source Attempt。
6. Analysis 自由摆棋默认只写 scratch workspace，不写 Attempt，也不写真实 SGF tree。
7. `snapshotService.captureSnapshotInput` 收紧为 analysis-only：
   - active tab 必须 `mode:'analysis'`；
   - 必须有 scratch/current snapshot 或 active ExplorationBranch；
   - source tab / source Attempt 只读；
   - Play / Problem / Recall 调用必须 rejected/no-op 且不创建 Task。
8. `SnapshotTaskInput` 至少包含：
   - `requestId`
   - `positionSgf`
   - `positionHash`
   - `sideToMove`
   - `parentTaskId`
   - `parentAttemptId`
   - `parentRecallSessionId`
   - `parentCheckpointId`
   - `parentMoveIndex`
   - `parentMode:'analysis'`
   - `sourceTreePosition`
   - `sourceBranchId`
   - `reason`
   - `inheritedProblemArea`
9. `taskImportService.createTaskFromSnapshot` 创建普通 TrainingTask：

```text
origin.provider = 'snapshot'
origin.parentTaskId = source task id
origin.parentAttemptId = source attempt id
origin.parentMoveIndex = source move index
```

10. `requestId` 必须保证 Analysis Snapshot 重复提交幂等。
11. `workbenchFlowService.snapshotFromCurrentContext` 编排：

```text
assert active tab mode === analysis
captureSnapshotInput
→ taskImportService.createTaskFromSnapshot
→ tabService.openTask(newTaskId, mode:'problem', parentTabId: sourceTabId)
```

12. UI Snapshot 命令只在 Analysis mode 可执行：
   - Analysis 顶部按钮、底部按钮和快捷键 `S` 调用同一 service path；
   - Play / Problem / Recall 中隐藏或 disabled，并显示不能 Snapshot 的原因；
   - Snapshot 成功状态显示 new Task / child Tab 链接，不改变当前 Analysis tab。
13. Analysis 面板展示：
   - active ExplorationBranch；
   - BadMove list；
   - AI candidate lines；
   - Recall comments；
   - source Attempt userLine；
   - checkpoint correction line。

当前判断（基于 2026-05-25 代码）：

```text
已落地：
  - flowService.snapshotFromCurrentContext 会创建 snapshot task 并 open child problem tab。
  - snapshotService.captureSnapshotInput 不打开 Tab。
  - Analysis ModeActions / BottomActionBar 已有 Snapshot 按钮。
  - Analysis no-attempt-mutation 有基础测试。

仍需收敛：
  - flowService 和 modeTransitions 仍允许 snapshot from any mode。
  - snapshotService.captureSnapshotInput 仍支持 play/problem/recall，缺 scratch workspace precondition。
  - flowService 直接 createTask，未统一走 taskImportService.createTaskFromSnapshot。
  - snapshot requestId / idempotency / parent context 不完整。
  - ModeEnterEffect / ModeExitEffect 尚未收束 overlay、scratch workspace 和 engine target。
```

验收：

```text
Analysis 可以看到当前 task / attempt / bad moves / comments；
Analysis 摆棋不污染 Attempt.userLine，也不写真实 SGF tree；
Analysis 有 active ExplorationBranch 表示当前变化线；
只有 Analysis 可 Snapshot 创建新 TrainingTask；
Play / Problem / Recall Snapshot rejected，且无 Problem/Task/Tab side effect；
Snapshot origin 包含 parent mode / parent ids / source branch；
同一 requestId 重复提交不会创建重复 Task；
Snapshot 打开 child Problem tab；
当前 Analysis tab 保持 analysis mode；
Analysis Snapshot 按钮、底部按钮和快捷键走同一 command path；
不再使用 snapshot_problem kind 作为新主路径。
```

测试：

```text
AnalysisContext tests；
ExplorationBranch runtime tests；
snapshotService analysis-only precondition tests；
SnapshotTaskInput analysis capture tests；
snapshot requestId idempotency tests；
Analysis no-attempt-mutation tests；
Analysis scratch no-game-tree-mutation tests；
snapshot from play/problem/recall rejected tests；
Analysis Snapshot button / shortcut command-path smoke tests；
Play / Problem / Recall snapshot disabled reason tests。
```

---

# 9. Phase 7：Review / BadMove 派生 Task

状态：`Partial`

目标：Review 直接调度 Task；BadMove 可派生成普通 TrainingTask 并进入长期复习队列。

范围：

```text
src/modules/training/review/reviewService.ts
src/modules/training/import/taskImportService.ts
src/modules/training/types/review.ts
src/components/drawers/TrainingDashboardDrawer.js
```

关键任务：

1. `ReviewSchedule` 改为直接引用 `taskId`。
2. `reviewService.getDueItems` 返回 due schedule / task。
3. `reviewService.openDueItem` 只做：

```text
scheduleId → taskId → workbenchTabService.openTask(taskId)
```

4. `reviewService.updateScheduleAfterResult` 根据 Attempt result 更新 schedule。
5. `taskImportService.createTaskFromBadMove` 创建：

```text
TrainingTask(origin.provider='bad_move')
```

6. 创建 BadMove 派生 Task 后：
   - 如果 `badMove.generatedTaskId` 已存在，直接返回已有 Task；
   - 更新 `badMove.generatedTaskId`
   - 根据 `ReviewEnrollmentPolicy` 创建或跳过 ReviewSchedule
7. 定义 `ReviewEnrollmentPolicy`：
   - `none`
   - `manual`
   - `auto_due_now`
   - `auto_scheduled`
8. 默认策略：
   - Analysis Snapshot：`manual`
   - BadMove derived task：`auto_due_now` 或 `auto_scheduled`
   - skipped checkpoint：`manual` 或 `auto_scheduled`
9. Punishment 不再是特殊 Tab，也不再自动打断当前流程。
10. 同阶段接入 UI command path：
   - Review Inbox 点击只走 `reviewService.openDueItem → openTask`；
   - Analysis Snapshot 成功状态提供“加入复习”入口；
   - BadMove 派生 Task 成功状态显示 enrollment 结果。

验收：

```text
BadMove 可生成普通 Task；
BadMove 派生 Task 按 policy 进入 inbox / review；
Analysis Snapshot 默认只给“加入复习”候选，不自动塞满 inbox；
同一 badMoveId 重复派生不会创建重复 Task；
Review item 打开后只是普通 openTask；
Review Inbox 和“加入复习”按钮都走真实 service path；
Review 不依赖 mode='review'；
Review 不再使用 item_type = problem / recall_segment。
```

测试：

```text
reviewService schedule tests；
ReviewEnrollmentPolicy tests；
badMove → task creation tests；
badMove derived task idempotency tests；
Review openDueItem → openTask integration tests；
Dashboard due/inbox counts tests；
Review Inbox / enroll button command-path smoke tests。
```

---

# 10. Phase 8：UI Hardening / 工作台体验验收

状态：`Partial`

目标：做 UI 完整性收尾、体验硬化和截图验收。Phase 8 不是第一次 UI 集成；
Phase 3-7 的 service 能力必须已经带真实 UI command path 和 smoke test。

范围：

```text
src/components/TrainingWorkbenchContainer.js
src/components/WorkbenchShell.js
src/components/LeftSidebar.js
src/components/BoardToolbar.js
src/components/drawers/TrainingDashboardDrawer.js
src/components/bars/ProblemBar.js
src/components/bars/RecallBar.js
```

关键任务：

1. 审核 Phase 3-7 已接入的 UI command path，消除临时 mock handler 或 legacy-only
   callback。
2. 顶部 / 左栏 / 右栏 / 底部按 `tab.mode` 读取 view model，并保持切换模式时棋盘
   不跳动。
3. Play / Problem / Recall / Analysis 的主操作各自只有一个当前最强主按钮；
   顶部、底部和快捷键不得出现语义不一致的 Submit / Snapshot / Return。
   Snapshot 只能在 Analysis mode 可执行；其它 mode 必须隐藏或 disabled，并给出原因。
4. 复核底层棋盘接线债务，若仍未收敛则补齐：
   - `gobanDataAdapter` 输出 `GobanPropsInput`；
   - `boardInteractionController` 统一 click → resolver → executor；
   - Container 订阅 adapter、转发 `onVertexClick`，移除硬编码和 `...state` 全量透传。
5. Material Browser 和 Review Inbox 都只是入口，不成为 mode。
6. Training Dashboard 展示：
   - due review
   - inbox tasks
   - incomplete attempts
   - incomplete recall sessions
   - recent bad-move derived tasks
7. 紧凑窗口规则：
   - `<1440px` 左栏默认可折叠，右栏默认 drawer / overlay；
   - Bottom Action Bar 保留主按钮和 2-3 个常用动作；
   - 棋盘优先保持稳定，不因面板内容变化跳动。
8. 键盘流：
   - `Space` 下一步 / 提交 recall move；
   - `Enter` 当前主动作；
   - `A` Enter Analysis / Return；
   - `S` Analysis Snapshot；非 Analysis mode 下不触发派生 Task；
   - `H` Hint；
   - `Cmd/Ctrl+Z` Undo。
9. 空态 / 加载态 / 错误态必须组件化覆盖：
   - 没有 active task；
   - engine 未连接；
   - analysis result pending；
   - AI move pending；
   - problemArea 未设置；
   - Recall 无 expected moves；
   - Analysis Snapshot 当前局面不可捕获；
   - 非 Analysis mode 不能 Snapshot。
10. 截图 / Storybook 验收覆盖 1440px、紧凑窗口和关键 disabled 状态。
11. 保持 Sabaki 现有棋盘、引擎、分析、overlay 行为可用。

验收：

```text
用户可以从材料入口打开 Play / Problem；
Play / Problem / Recall / Analysis 的核心 command path 已在 Phase 3-7 接入；
Phase 8 不新增业务流程，只修正 UI 一致性、可达性和状态覆盖；
紧凑窗口下主按钮和棋盘仍可用；
键盘 shortcut 与按钮走同一 service path；
非 Analysis mode 的 Snapshot UI 不会调用 flowService.snapshotFromCurrentContext；
空态 / loading / error / disabled 状态给出 inline reason；
Review 打开 due item 后进入 Play 或 Problem；
UI 不直接写 business store；
Container 不直接拼装 board 数据，通过 adapter 订阅；
点击写入走统一 executor 路径，不调 sabaki.clickVertex。
```

测试：

```text
TrainingWorkbenchContainer mode routing tests；
Play / Problem / Recall / Analysis smoke tests；
Review Inbox open task integration tests；
compact layout smoke tests；
keyboard shortcut command-path tests；
Analysis-only Snapshot UI gating tests；
disabled reason / empty-state story tests；
1440px + compact screenshot checks；
legacy ProblemBar compatibility regression tests。
```

---

# 11. Phase 9：Legacy Cleanup

状态：`Pending`

目标：训练业务不再依赖 `sabaki.js` global training state 和 legacy mode。

关键任务：

1. 逐步删除或薄化：
   - `problemSession`
   - `problemAttempt`
   - `problemEvalCache`
   - `problemBadMoves`
   - `problemSubmitted`
   - `reviewQueue`
   - legacy recall state
2. 移除 `mode='problem'` / `mode='review'` 作为业务判断来源。
3. `mode='recall'` 可短期兼容，但业务事实以 `WorkbenchTab.mode`
   和训练事实表为准。
4. UI 组件从直接调用 `sabaki.*` 改为 Container callbacks。
5. `trainingStore.js` 完成迁移后删除或只保留 shim。
6. 删除不再使用的：
   - `openSnapshotProblemTab`
   - `openPunishmentProblemTab`
   - `openRecallSegmentTab`
   - source-kind 分支
   - review item-type 分支

验收：

```text
Problem / Review / Recall 业务事实来自 training stores + repository；
sabaki.js 训练函数只剩薄代理或已删除；
board interaction 不再把 problem/review 当特殊 legacy mode；
旧数据仍可通过 repository mapper 读取。
```

---

# 12. 后置优化

后置能力：

```text
workbench_tabs 持久化和恢复
TrainingBranch 可视化
更智能的 bad move 判定：winrate / ownership / 阶段判断 / 棋块状态
用户标记“不是坏棋”
SM-2 或更完整的 Review 策略
训练统计与能力画像
boardCommandAdapter
engineAnalysisAdapter
sgfAdapter
复杂 reference_lines 独立表
external_sync_records
```

不进入 MVP：

```text
根据 origin.provider 分叉主流程
RecallSegment 作为独立 source
Punishment Tab
Analysis 自动写 Attempt
每个 entity 一个 Store
完整云同步 / 多人协作
复杂能力画像大屏
```

---

# 13. 总体里程碑

```text
Phase 0  v0.5 模型收敛                 Landed / cleanup remaining
Phase 1  Workbench Mode + openTask      Landed / mode-effect gaps remaining
Phase 2  taskImportService              Landed / wrapper cleanup remaining
Phase 3  Attempt + AI Move + Recall     Partial
Phase 4  MoveEvaluation + BadMove       Partial
Phase 5  Recall Checkpoint              Partial
Phase 6  Analysis + Snapshot Child      Partial / contract realignment required
Phase 7  Review + BadMove 派生 Task     Partial
Phase 8  UI Hardening / 工作台体验验收  Partial
Phase 9  Legacy Cleanup                 Pending
```

优先级判断：

```text
Phase 0-2 已经形成 v0.5 基础切片，但仍要清掉 legacy 主路径残留；
Phase 1 的下一步不是再补类型，而是把 TransitionEffect / companion invariant 收束到 flow service；
Phase 3-7 已有服务骨架和部分测试，下一步重点是补齐 mode orchestration contract 并同步接 UI command path；
Phase 8 已有 UI shell/panels，只做体验硬化、状态覆盖和截图验收；
Phase 9 只在新路径稳定后做，不提前做破坏性删除。
```

---

# 14. 当前最小实现切面

## 已完成（2026-05-20 至 2026-05-25）

```text
W0 控件清单: w0-control-inventory-and-command-map-v0.1.md ✅
W1 状态所有权: w1-state-ownership-and-wiring-contract-v0.1.md ✅
  - workbenchStore / runtimeStore 订阅 ✅
  - Container projection 基础 ✅
W2 Shell/Tab 接线: w2-shell-and-tab-wiring-contract-v0.1.md ✅
  - mode bar, tab bar, bottom bar handlers ✅
  - flowService (submit/enterAnalysis/returnFromAnalysis) ✅
W3 Goban 接线管道层: w3-goban-wiring-contract-v0.1.md ✅
  - projectGobanProps 纯投影函数 ✅ (289 tests passing)
  - resolveBoardInteraction WorkbenchMode 扩展 ✅
  - MainBoardStage 渲染真实 Goban ✅
  - WorkbenchShell 透传 boardProps ✅
  - GAP-G4 recall overlay 泄露防护 ✅
W3.5 数据源 + 点击控制器 ✅
  - gobanDataAdapter snapshot + subscribe ✅
  - boardInteractionController click → resolver → executor ✅
  - Container 订阅 adapter + 转发 onVertexClick ✅
  - playInteractionExecutor 接通 documentStore.playMove ✅
Phase 0/1 gap cleanup ✅
  - workbenchPhaseService @deprecated ✅
  - modeTransitions.ts / AnalysisReturnTarget / RecallSubstate ✅
  - RecallPolicy / expectedMoveIndexes schema + mapper + tests ✅
  - playerConfig store/update tests ✅
```

## 合同对齐待做（Mode Orchestration）

```text
ModeState / companion resolver: 只读聚合 tab/runtime/overlay/engine state
ModeEnterEffect / ModeExitEffect: tab/runtime/overlay/engine/scratch effect 原子编排
Snapshot: 从 any-mode 收紧到 analysis-only child problem tab
FrozenAttempt: repository allowlist + Recall/Analysis no-write guard
Problem: 显式 WorkbenchMode.problem 主路径 + undo 同步 Attempt.userLine
Recall complete: 不再写 source Attempt.userLine/result/status，recallCompleted/status 迁出或 allowlist
Analysis projection: resolveAnalysisDisplay / App / Sidebar 与 projectGobanProps gating 统一
Stale async: overlay / scratch analysis / AI move 都有 generation 或 requestId guard
```

下一轮真实优先级：

```text
1. ModeState / companion resolver（只读，不改业务），作为 transition guard 输入。
2. ModeEnterEffect / ModeExitEffect 收束到 workbenchFlowService 或同职责 workbenchModeService。
3. Snapshot analysis-only：modeTransitions、flowService、snapshotService、UI disabled reason、测试一起改。
4. FrozenAttempt 写入边界：repository.updateAttempt allowlist + Recall/Analysis no-write tests。
5. Problem explicit mode：openProblemTab legacy setMode('play') 降级为 adapter projection；undo 回滚 Attempt.userLine。
6. Recall complete 污染清理：RecallSession/followup state 承担完成标记，Attempt 不再被复盘写状态。
7. AiMovePending + stale AI request rejection + auto-play limits。
8. ReviewEnrollmentPolicy：Analysis Snapshot 默认 manual，BadMove derived task 默认 auto。
9. UI keyboard command path + compact layout + disabled reason / key empty states。
```

执行原则：

```text
第 1-2 项是后续所有 mode 行为的前置，不做可见功能扩张；
第 3-8 项每完成一个，都必须同阶段接对应 UI command path 和 smoke test；
第 9 项只做横向体验硬化，不补做前面阶段遗漏的业务接线。
```

必须补的测试：

```text
mode transition table-driven tests
Analysis return restore tests
ModeEnterEffect / ModeExitEffect transition tests
Snapshot analysis-only rejection + requestId idempotency tests
FrozenAttempt repository write guard tests
Recall complete no Attempt pollution tests
Problem undo Attempt rollback tests
Analysis/Recall projection gating tests
AI stale request rejection tests
ReviewEnrollmentPolicy tests
UI keyboard command-path and disabled-state tests
```

文档更新验收：

```text
只更新 implementation plan，不改代码、不改架构文档、不改 UI spec。
运行 git diff --check。
代码测试不作为本次文档更新前置条件；当前工作区可能没有可用 mocha binary。
```

---

# 15. 架构红线

必须坚持：

```text
source 不再是核心建模维度
origin 只做追溯，不参与主流程判断
WorkbenchTab 保存 UI 状态，不保存训练事实
Attempt 是用户产出的一条线
RecallSession 绑定 Attempt
RecallPolicy 显式决定 expectedMoves，不靠隐式 userLine 推断
Checkpoint 是 Recall 子流程
Analysis Return 必须恢复 AnalysisReturnTarget
Analysis 不污染 Attempt
Analysis Snapshot 创建 child Problem Task / child Tab，不复用或修改当前 Tab
Problem AI 落子必须受 problemArea / analysis area 限制
AI 请求过期后不可写入 documentStore 或 Attempt
Analysis Snapshot / BadMove 派生必须幂等
ReviewSchedule 直接引用 taskId
Store 控制在 2～3 个
Repository 是唯一训练 DB 入口
Existing Core 不知道 training 业务
workbenchPhaseService 只作为 deprecated legacy compatibility，不承载新流程
```

禁止恢复：

```text
TrainingTaskKind = game | problem | snapshot_problem | recall_segment
ReviewItemType = problem | recall_segment
openSnapshotProblemTab 作为新主路径
openPunishmentProblemTab
openRecallSegmentTab
给 workbenchPhaseService 新增业务能力
根据 origin.provider 选择主流程
每个实体一个 Store
Analysis 自动写回 Attempt.userLine
Problem AI 在题目范围外自动落子
旧 AI 请求在切 Tab / 悔棋 / 进入 Analysis 后继续落子
Play / Problem / Recall 直接 Snapshot 创建 Task
Analysis Snapshot 默认自动塞满 Review Inbox
```
