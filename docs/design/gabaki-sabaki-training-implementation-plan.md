# Gabaki / Sabaki Training Implementation Plan

> 文档类型：长期实施计划对应 PRD：`gabaki-sabaki-training-prd-v0.5.md`
> 对应架构：`gabaki-sabaki-training-architecture-v0.5.md`
> 当前代码现状：训练域已落地一部分 v0.4 骨架，包括
> `TrainingTask.kind/source`、`WorkbenchTab.phase`、`workbenchPhaseService`、`openGameTab/openProblemTab/openSnapshotProblemTab`、`training_bad_moves.generated_problem_id`、legacy
> Review item type 等。v0.5 的第一步不是继续加功能，而是把这些 v0.4 建模收敛到
> `TrainingTask + TaskOrigin + WorkbenchMode + Attempt`。

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
任意 Mode → Snapshot → new TrainingTask
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

## 1.3 v0.4 遗留收敛清单

继续开发前需要逐步消除或薄化：

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

替换目标：

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

---

# 2. Phase 0：v0.5 模型收敛

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
9. DB migration 采用增量兼容策略：
   - 新增 v0.5 字段；
   - 旧 `kind/source_json` 可读但不再作为新写入事实；
   - mapper 将旧 source 映射成 `origin`；
   - 旧 review item 映射成 `taskId`，无法映射时进入 migration warning。
10. `trainingRepository` 暴露 v0.5 API，同时保留必要 legacy wrapper。

验收：

```text
类型编译通过；
旧 training task 能读取为 v0.5 TrainingTask；
新写入 task 不再需要 kind/source；
ReviewSchedule 新写入只需要 taskId；
BadMove 派生关系使用 generatedTaskId；
Problem task 可保存 problemArea；
Attempt 可保存 moveActors；
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
repository create/load/update task roundtrip tests。
```

---

# 3. Phase 1：Workbench Mode + openTask 骨架

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
```

2. 实现 `workbenchTabService.openTask({taskId, mode?, parentTabId?})`。
3. 默认 mode 推导：

```text
有 prompt / goal / passRule / referenceLines → problem
否则 → play
```

4. 将 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 改为 legacy
   compatibility wrapper，内部走 `taskImportService` 或 `openTask`。
5. 新建 `workbenchFlowService`，替代 `workbenchPhaseService`：
   - `startAttempt`
   - `submit`
   - `enterRecall`
   - `completeRecall`
   - `enterAnalysis`
   - `returnFromAnalysis`
   - `restartAttempt`
   - `snapshotFromCurrentContext`
6. 转换规则：

```text
play/problem --submit--> recall
recall --complete--> analysis 或 end
any mode --snapshot--> new tab, mode = problem/play
play/problem --enterAnalysis--> analysis
recall --enterAnalysis--> analysis
analysis --returnFromAnalysis--> previous mode
```

7. 非法转换 reject / throw 并记录日志。
8. UI panel 渲染改为按 `tab.mode` 分发。
9. `WorkbenchTab` 增加 `playerConfig`：
   - Play Mode：black / white 分别为 human 或 ai；
   - Problem Mode：problemOpponent 为 self 或 ai；
   - AI 设置包括 engineId、timeLimitMs / maxVisits、autoPlay。

验收：

```text
openTask(problem-like task) 默认 mode = problem；
openTask(free task) 默认 mode = play；
显式 mode 优先于默认推导；
Submit 必须从 play/problem 进入 recall；
Analysis 不再被强制作为 Recall 后的第三关；
Snapshot 不改变当前 tab，而是创建新 tab；
旧入口仍可兼容。
Play tab 可保存黑白方 human / ai 配置；
Problem tab 可保存对方 self / ai 配置。
```

测试：

```text
openTask default mode tests；
mode transition table-driven tests；
legacy openProblemTab wrapper tests；
snapshot creates child tab tests；
panel routing tests。
playerConfig store/update tests。
```

---

# 4. Phase 2：taskImportService 与材料入口

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
Snapshot / BadMove 派生题仍是普通 Task；
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

6. `RecallSession` 只绑定 `attemptId`，`expectedMoves` 来自 `Attempt.userLine`。
7. `trainingRuntimeStore` 只保存运行态引用和 UI draft，不保存完整业务历史。
8. 启动时能发现 incomplete attempts / recall sessions。

验收：

```text
Play / Problem 都能创建 Attempt；
每手落子写入 userLine；
AI 落子写入 userLine 且 moveActors 标记为 ai；
Play 可配置黑白双方为 human / ai；
Problem 可配置对方为 self / ai；
Problem AI 不会在 problemArea 外落子；
Submit 后 Attempt.status = submitted/recalling；
RecallSession.attemptId 指向被冻结 Attempt；
tab.mode 切换为 recall；
Analysis 自由摆棋不修改 Attempt.userLine。
```

测试：

```text
attemptService lifecycle tests；
aiMoveService play side controller tests；
aiMoveService problem area constraint tests；
submit transaction tests；
recallService create-from-attempt tests；
free task → Play → Submit → Recall integration tests；
problem-like task → Problem → Submit → Recall integration tests。
```

---

# 6. Phase 4：MoveEvaluation / BadMove

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

验收：

```text
每手落子产生 pending MoveEvaluation；
有分析结果后 pending → evaluated；
超时 pending → failed；
major / severe 生成 BadMove；
minor / none 不生成 BadMove；
Submit 时 failed evaluation 不作为决定性 pass/fail 依据。
```

测试：

```text
evaluationRules unit tests；
pending/evaluated/failed monitor tests；
bad move severity threshold tests；
generatedTaskId repository tests；
submit with failed evaluation tests。
```

---

# 7. Phase 5：Recall Checkpoint / Comment

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

验收：

```text
Recall 到 major/severe BadMove 暂停；
Checkpoint 是 recall 的 substate，不是 mode；
用户可先摆 correction line；
Reveal 后显示 AI candidate lines；
comment 保存后继续 Recall；
中途崩溃后 incomplete recall/checkpoint 可被发现。
```

测试：

```text
checkpoint trigger tests；
Recall → Checkpoint → Correction → Reveal → Comment → Resume integration tests；
skipped checkpoint review candidate tests；
existing recall compatibility tests。
```

---

# 8. Phase 6：Analysis / Global Snapshot

目标：Analysis 成为低阻碍自由研究空间；Snapshot 成为所有模式可用的全局派生 Task 能力。

范围：

```text
src/modules/training/types/analysis.ts
src/modules/training/analysis/snapshotService.ts
src/modules/training/import/taskImportService.ts
src/modules/training/workbench/workbenchFlowService.ts
src/components/training/panels/AnalysisModePanel.tsx
```

关键任务：

1. 定义 `AnalysisContext`：
   - `taskId`
   - `attemptId`
   - `checkpointId`
   - `positionHash`
   - `positionSgf`
   - `source`
2. Analysis 面板展示：
   - BadMove list
   - AI candidate lines
   - Recall comments
   - Attempt userLine
   - correction line
3. `enterAnalysis` 可从 Play / Problem / Recall / completed Recall 进入。
4. Analysis 自由摆棋默认不写回 Attempt。
5. `snapshotService.captureSnapshotInput` 支持从 Play / Problem / Recall /
   Analysis 捕获当前局面和父级关系，不打开 Tab。
6. `taskImportService.createTaskFromSnapshot` 创建普通 TrainingTask：

```text
origin.provider = 'snapshot'
origin.parentTaskId = currentTaskId
origin.parentAttemptId = currentAttemptId
origin.parentMoveIndex = currentMoveIndex
```

7. `workbenchFlowService.snapshotFromCurrentContext` 编排：

```text
captureSnapshotInput
→ createTaskFromSnapshot
→ openTask(newTaskId, mode:'problem' 或默认推导)
```

8. UI 必须提供统一 Snapshot 命令：
   - 所有模式支持快捷键；
   - 所有模式有按钮或菜单入口；
   - 快捷键和按钮走同一条 service path。

验收：

```text
Analysis 可以看到当前 task / attempt / bad moves / comments；
Analysis 摆棋不污染 Attempt.userLine；
Play / Problem / Recall / Analysis 都可 Snapshot 创建新 TrainingTask；
Snapshot 打开新 Tab；
当前 Tab 保持原 mode；
不再使用 snapshot_problem kind。
```

测试：

```text
AnalysisContext tests；
snapshotService unit tests；
Analysis no-attempt-mutation tests；
Play / Problem / Recall / Analysis snapshot integration tests。
```

---

# 9. Phase 7：Review / BadMove 派生 Task

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
   - 更新 `badMove.generatedTaskId`
   - 创建 ReviewSchedule(taskId)
7. Punishment 不再是特殊 Tab，也不再自动打断当前流程。

验收：

```text
BadMove 可生成普通 Task；
派生 Task 进入 inbox / review；
Review item 打开后只是普通 openTask；
Review 不依赖 mode='review'；
Review 不再使用 item_type = problem / recall_segment。
```

测试：

```text
reviewService schedule tests；
badMove → task creation tests；
Review openDueItem → openTask integration tests；
Dashboard due/inbox counts tests。
```

---

# 10. Phase 8：UI 集成与工作台体验

目标：把 v0.5 模式模型接到可用工作台，而不是只停留在 service 层。

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

0. **gobanDataAdapter**（输出 GobanPropsInput）：
   - 订阅 documentStore / editWorkspace → 输出 boardState snapshot
   - 订阅 overlayStore / engine → 输出 overlayState snapshot
   - 读取用户设置 → 输出 settings snapshot
   - 暴露 subscribe(callback) → Container 订阅
   - 输出格式 = projectGobanProps 的 GobanPropsInput 类型

1. **boardInteractionController**（统一点击路径）：
   - 接收 Container 传来的 click event + vertex
   - 调 resolveBoardInteraction → 结果路由到 executor
   - playInteractionExecutor 调 documentStore.playMove
   - recallInteractionExecutor 调 recallService
   - scratchEditInteractionExecutor 调 working-position ops
   - workbench 路径不调 sabaki.clickVertex

2. **Container 接线**：
   - 订阅 gobanDataAdapter，传输出给 projectGobanProps
   - onVertexClick 转发给 boardInteractionController
   - 移除所有硬编码输入
   - 移除 `...state` 全量透传依赖

3. 顶部 / 左栏 / 右栏 / 底部按 `tab.mode` 读取 view model。
4. Play / Problem 的主操作是 Submit / Enter Analysis / Snapshot。
5. Recall 的主操作是 Recall move / Checkpoint / Complete / Enter Analysis /
   Snapshot。
6. Analysis 的主操作是 Snapshot / Return。
7. Play Mode UI 提供黑方 / 白方 human|ai selector 和 AI 走法设置。
6. Problem Mode UI 提供对方 self|ai selector，并在 opponent=ai 时显示题目范围 /
   analysis area 状态。
7. Problem Mode 禁止在没有 problemArea 时启用 AI 应手。
8. Material Browser 和 Review Inbox 都只是入口，不成为 mode。
9. Training Dashboard 展示：
   - due review
   - inbox tasks
   - incomplete attempts
   - incomplete recall sessions
   - recent bad-move derived tasks
10. 保持 Sabaki 现有棋盘、引擎、分析、overlay 行为可用。

验收：

```text
用户可以从材料入口打开 Play / Problem；
Play / Problem 可 Submit 进入 Recall；
Play 可选择黑白方为人或 AI；
Problem 可选择对方为 AI 或自己；
Problem AI 应手必须受题目 analysis area 限制；
Recall 可进入 Checkpoint；
所有模式可通过快捷键 / 按钮 Snapshot；
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
legacy ProblemBar compatibility regression tests。
```

---

# 11. Phase 9：Legacy Cleanup

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
Phase 0  v0.5 模型收敛                 已完成
Phase 1  Workbench Mode + openTask      已完成
Phase 2  taskImportService              已完成 (skeleton)
Phase 3  Attempt + AI Move + Recall     进行中
         - attemptService, recallService 已有
         - aiMoveService 待实现
         - W3 Goban 管道层已完成，数据源层待做
Phase 4  MoveEvaluation + BadMove       2-3 周
Phase 5  Recall Checkpoint              2-3 周
Phase 6  Analysis + Global Snapshot     2-3 周
Phase 7  Review + BadMove 派生 Task     1-2 周
Phase 8  UI 集成与工作台体验            2-3 周
Phase 9  Legacy Cleanup                 2 周
```

优先级判断：

```text
Phase 0-1 是 v0.5 地基，必须先做；
Phase 2 防止 source 逻辑继续扩散；
Phase 3-5 构成训练价值主干；
Phase 6-7 完成派生题和长期复习闭环；
Phase 8 让能力进入真实工作台；
Phase 9 只在新路径稳定后做。
```

---

# 14. 当前最小实现切面

## 已完成（2026-05-20）

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
```

## W3 待做（数据源层 + 点击控制器）

```text
gobanDataAdapter: 订阅 board/overlay/settings 数据源，输出 GobanPropsInput snapshot + subscribe
boardInteractionController: 统一 click → resolver → executor 路径
Container: 订阅 adapter + 转发 click，移除所有硬编码
playInteractionExecutor: 接通 documentStore.playMove（替代 sabaki.clickVertex 降级）
```

第一轮必须完成：

```text
1. types/task.ts：TrainingTask + TaskOrigin
2. types/tab.ts：WorkbenchMode / WorkbenchTab
3. db migration：training_tasks origin_json + problem-like fields
4. repository mapper：old source → origin
5. workbenchTabService.openTask
6. workbenchFlowService skeleton
7. workbenchUiPolicy 默认 mode 推导
```

第二轮：

```text
1. taskImportService skeleton
2. importLocalSgf / createManualTask
3. legacy openProblemTab wrapper → import/openTask
4. openTask 跑通 Play / Problem 两种 UI
```

第三轮：

```text
1. attemptService 与 v0.5 task 字段对齐
2. aiMoveService skeleton
3. Play black/white human|ai
4. Problem opponent self|ai
5. Problem AI problemArea 约束
6. submit → recall transaction
7. recall_sessions attemptId 化
8. Play / Problem 落子写 Attempt
```

第四轮：

```text
1. playTrainingMonitor 接入 mode
2. generatedProblemId → generatedTaskId
3. BadMove 派生 Task
4. ReviewSchedule taskId 化
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
Checkpoint 是 Recall 子流程
Analysis 不污染 Attempt
Snapshot 创建新 Task，不复用当前 Tab
Problem AI 落子必须受 problemArea / analysis area 限制
ReviewSchedule 直接引用 taskId
Store 控制在 2～3 个
Repository 是唯一训练 DB 入口
Existing Core 不知道 training 业务
```

禁止恢复：

```text
TrainingTaskKind = game | problem | snapshot_problem | recall_segment
ReviewItemType = problem | recall_segment
openSnapshotProblemTab 作为新主路径
openPunishmentProblemTab
openRecallSegmentTab
根据 origin.provider 选择主流程
每个实体一个 Store
Analysis 自动写回 Attempt.userLine
Problem AI 在题目范围外自动落子
```
