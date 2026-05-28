# Gabaki / Sabaki 训练系统模块架构文档 v0.5

> 文档类型：模块架构与实现指导  
> 对应 PRD：`docs/product/sabaki-training-prd.md`  
> 历史 PRD 基线：`docs/archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md`  
> 当前目标：在不破坏 Sabaki 既有核心架构的前提下，把训练系统从 legacy global
> mode 迁移到 `TrainingTask + WorkbenchTab + WorkbenchMode + Attempt`
> 架构；同时把 `source` 从核心模型降级为 `origin metadata`。

---

# 前置：文档关系与术语收敛

四份核心文档的权威关系固定为：

```text
UI-UX Spec v0.5        = 产品体验权威
Architecture v0.5      = 工程架构权威
Implementation Plan    = 迁移执行权威
Architecture v0.4      = legacy reference，只用于理解迁移前状态
```

开发新路径时必须以本文和 Implementation Plan 为准。v0.4 架构文档中的
`Phase`、`TrainingTaskKind`、`source_kind`、`openProblemTab`、
`openSnapshotProblemTab` 等词只能作为迁移背景，不得作为新实现主路径。

Play Mode 的普通交替落子主线以
`docs/design/play-move-committed-architecture.md` 为准。该文档定义
`PlayMoveCommitted`、AI 首手/应手、Attempt 记录、后台 analysis 调度与 overlay
边界；本文只保留摘要。

术语映射：

```text
v0.4 Phase              → v0.5 WorkbenchMode
v0.4 source_kind        → v0.5 TaskOrigin
v0.4 Problem entity     → v0.5 TrainingTask problem-like fields
v0.4 openProblemTab     → v0.5 taskImportService + openTask
v0.4 generatedProblemId → v0.5 generatedTaskId
v0.4 Review item_type   → v0.5 ReviewSchedule.taskId
```

---

# 0. v0.5 架构总原则

## 0.1 最大变化

v0.4 的架构仍然保留了过多 source / kind 分支：

```text
game
problem
snapshot_problem
recall_segment
punishment problem
review item type
```

v0.5 将这些全部降级。

新的原则：

```text
外部来源只在导入 / 创建 Task 时有意义。
进入系统后，所有材料都是标准化 TrainingTask。
```

核心架构不再围绕 source 展开，而围绕四个产品模式展开：

```text
Play
Problem
Recall
Analysis
```

## 0.2 新的核心对象

```text
TrainingTask       标准化训练材料
TaskOrigin         来源追溯 metadata，不参与流程判断
WorkbenchTab       UI 承载容器
WorkbenchMode      当前 UI 意图：play / problem / recall / analysis
TrainingAttempt    用户产出的一条线
MoveEvaluation     每手分析事实
BadMove            问题手事实
RecallSession      回忆一个 Attempt
RecallCheckpoint   Recall 中的主动纠错子流程
AnalysisContext    自由研究上下文
ReviewSchedule     对 Task 的长期调度
```

## 0.3 必须坚持的边界

```text
UI 只展示，不写业务 Store
Container / Controller 读 Store、调 Service
Service 编排业务动作
Repository 统一存取训练 DB
Adapter 隔离旧 Sabaki API
Existing Core 不知道 training 业务
```

禁止：

```text
Store 调 Service
documentStore 知道 Attempt / BadMove
engineService 知道 Problem / Review
analysisService 知道 RecallCheckpoint
snapshotService 打开 Tab
Review 直接处理 problem / recall_segment item type
根据 origin.provider 分叉主流程
```

## 0.4 正式状态机契约

模式转换必须收敛到一个可测试的状态机模块，例如
`src/modules/training/workbench/modeTransitions.ts`。Service 可以编排副作用，
但不得把 mode guard / effect 规则散落在多个 UI callback 中。

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

状态机表：

| from | event | guard | effect |
|------|-------|-------|--------|
| play / problem | submit | `activeAttempt && !frozen` | freeze attempt, create recall, `mode=recall`, `recallSubstate=normal` |
| recall | enterAnalysis | `activeRecallSession` | save `analysisReturnTarget`, `mode=analysis` |
| play / problem | enterAnalysis | `task exists` | save `analysisReturnTarget`, `mode=analysis` |
| analysis | return | `analysisReturnTarget exists` | restore previous mode, recall substate, tree position, move index |
| analysis | restartAttempt | `task exists` | create new attempt, infer `mode=play/problem` |
| recall | startCheckpoint | `activeRecallSession && checkpoint exists` | `recallSubstate=checkpoint_correction` |
| recall | revealAi | `checkpoint_correction && correction submitted` | `recallSubstate=checkpoint_ai_revealed` |
| recall | commentCheckpoint | `checkpoint_ai_revealed` | `recallSubstate=checkpoint_commenting` |
| recall | resumeRecall | `checkpoint saved/skipped` | clear active checkpoint, `recallSubstate=normal` |
| any | snapshot | capturable position exists | create new task + new tab; keep current tab mode unchanged |

必须保持的 invariant：

```text
Checkpoint 永远是 Recall substate，不是 WorkbenchMode。
Analysis → Return 必须恢复 previous mode、Recall substate、tree position 和 moveIndex。
Snapshot 不修改当前 tab，也不复用当前 tab 作为新 task。
Analysis 自由摆棋不写 Attempt.userLine。
所有非法转换必须 reject / throw，并记录结构化日志。
```

---

# 1. 读路径 vs 写路径

## 1.1 渲染读路径

```text
Store / Repository query
→ Container / ViewModel
→ UI Component
```

示例：

```text
workbenchStore.tabs + trainingRuntimeStore.activeAttemptId
→ TrainingWorkbenchContainer
→ PlayModePanel / ProblemModePanel / RecallModePanel / AnalysisModePanel
```

## 1.2 命令写路径

```text
UI Component
→ Controller / Container
→ Service
→ Store / Repository / Adapter
→ Existing Sabaki Core
```

示例：

```text
Submit Button
→ TrainingWorkbenchContainer.handleSubmit
→ workbenchFlowService.submit(tabId)
→ attemptService.freezeAttempt(...)
→ recallService.createRecallFromAttempt(...)
→ workbenchStore.updateTab({mode:'recall'})
```

## 1.3 依赖规则

```text
Store 不依赖 Service
Service 可以依赖 Store / Repository / Adapter
Container 读 Store、调 Service
Repository 不知道 UI
Adapter 不承载训练业务规则
Existing Core 不反向依赖 training
```

---

# 2. 总体分层架构

## 2.1 总体架构图

```text
UI Components
  ├─ WorkbenchShell.js / Training views
  ├─ TabBar
  ├─ MaterialBrowser
  ├─ PlayModePanel
  ├─ ProblemModePanel
  ├─ RecallModePanel
  ├─ RecallCheckpointPanel
  ├─ AnalysisModePanel
  └─ ReviewInbox

Container / Controller / ViewModel
  ├─ TrainingWorkbenchContainer
  ├─ PlayModeController
  ├─ ProblemModeController
  ├─ RecallModeController
  ├─ AnalysisModeController
  ├─ TrainingOverlayViewModel
  └─ ReviewQueueContainer

Stores
  ├─ workbenchStore
  ├─ trainingRuntimeStore
  └─ reviewQueueStore?              # optional

Services
  ├─ taskImportService
  ├─ workbenchTabService
  ├─ workbenchFlowService            # Mode / workflow orchestrator
  ├─ aiMoveService                    # AI player move generation
  ├─ attemptService
  ├─ playTrainingMonitor
  ├─ recallService
  ├─ recallCheckpointService
  ├─ snapshotService
  ├─ reviewService
  ├─ evaluationRules                 # pure functions, not a service
  └─ trainingRepository

Adapters
  ├─ legacySabakiAdapter
  ├─ positionSnapshotAdapter
  ├─ analysisResultAdapter
  ├─ engineMoveAdapter?              # add when AI move command needs isolation
  ├─ boardCommandAdapter?            # add when needed
  ├─ engineAnalysisAdapter?          # add when needed
  └─ sgfAdapter?                     # add when needed

Existing Sabaki Core
  ├─ sabaki.js legacy global state / facade
  ├─ documentStore
  ├─ engineService / enginesyncer
  ├─ analysisService
  ├─ overlayStore
  ├─ hubStore
  ├─ db.js
  ├─ gametree / fileformats
  └─ existing src/modules/workbench
```

## 2.2 为什么新增 taskImportService

source 被降级后，来源处理不应该散落在 workbench / review / snapshot / problem
service 中。

统一入口：

```text
外部材料 → taskImportService → TrainingTask
```

`taskImportService`
负责把野狐、本地 SGF、101、Snapshot、BadMove、手动题等材料转成标准化 Task。

后续所有流程只处理 Task。

## 2.3 不要过早服务化

MVP 核心 Service：

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

纯函数模块：

```text
evaluationRules
reviewScheduleRules     # 可先放 reviewService 内部
```

先不要独立：

```text
problemService          # v0.5 中 Problem-like 信息先并入 TrainingTask
punishmentProblemService
moveEvaluationService
passRuleEvaluator
reviewScheduler
```

拆分检查点：

```text
如果某个模块少于约 50 行且只有一个 caller，先内联。
如果出现第二个 caller、复杂错误处理、或需要隔离 legacy API，再抽出独立模块。
```

---

# 3. 现有 Sabaki 模块定位

## 3.1 sabaki.js

定位：legacy app facade。

规则：

```text
不再新增训练业务
旧训练入口通过 legacySabakiAdapter 包装
新训练逻辑走 src/modules/training/*
```

过渡期允许：

```ts
sabaki.startTrainingTask = (taskId) => {
  return trainingServices.workbenchTabService.openTask({taskId})
}
```

长期目标：`sabaki.js` 只负责兼容旧 UI / 旧命令，不承载新训练用例。

## 3.2 documentStore

定位：棋谱 / 棋盘事实源。

负责：

```text
当前 game tree
当前 tree position
落子后的棋谱变更
棋盘导航
```

不负责：

```text
Attempt
BadMove
Recall
Review
TrainingTask
```

训练系统通过 Adapter 或现有 executor 使用它。

## 3.3 analysisService

定位：AI 分析结果缓存和事件源。

负责：

```text
当前局面分析结果
candidate moves
scoreLead / winrate / visits
analysis update event
```

不负责：

```text
BadMove
RecallCheckpoint
Attempt result
Review schedule
```

训练系统通过 `analysisResultAdapter` 读取 normalized result。

## 3.4 overlayStore

定位：显示层 overlay 状态。

不承载训练业务。

训练业务要显示 overlay，应通过：

```text
TrainingOverlayViewModel
→ derive overlay props
→ UI / overlay rendering layer
```

禁止：

```text
overlayStore → recallCheckpointService
overlayStore → badMove business logic
```

## 3.5 db.js

定位：底层 SQLite 能力。

所有训练 DB 读写统一通过：

```text
trainingRepository
```

禁止 service 直接到处调用 db.js。

---

# 4. Store 设计

## 4.1 Store 总原则

MVP 只需要：

```text
workbenchStore
trainingRuntimeStore
reviewQueueStore? optional
```

不要建立：

```text
taskStore
attemptStore
badMoveStore
recallStore
checkpointStore
snapshotStore
analysisStore
```

这些是 DB entity + Repository + Service。

## 4.2 workbenchStore

职责：管理当前打开的 Tab 和 active Tab。

```ts
type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

type WorkbenchTab = {
  id: string
  taskId: string
  mode: WorkbenchMode
  playerConfig?: WorkbenchPlayerConfig
  activeAttemptId?: string
  activeRecallSessionId?: string
  recallSubstate?: RecallSubstate
  analysisContext?: AnalysisContext
  analysisReturnTarget?: AnalysisReturnTarget
  currentTreePosition?: string
  parentTabId?: string
  childTabIds: string[]
  createdAt: string
  updatedAt: string
}

type WorkbenchStoreState = {
  tabs: WorkbenchTab[]
  activeTabId: string | null
}

type AnalysisContext = {
  taskId: string
  attemptId?: string
  recallSessionId?: string
  checkpointId?: string
  badMoveId?: string
  positionHash?: string
  positionSgf?: string
  sourceTreePosition?: string
  activeBranchId?: string
  createdFrom: 'play' | 'problem' | 'recall' | 'checkpoint' | 'bad_move' | 'snapshot'
}

type WorkbenchStore = {
  getState(): WorkbenchStoreState
  subscribe(listener: () => void): () => void

  addTab(tab: WorkbenchTab): void
  updateTab(tabId: string, patch: Partial<WorkbenchTab>): void
  removeTab(tabId: string): void
  setActiveTab(tabId: string | null): void
}

type PlayerController = 'human' | 'ai'

type WorkbenchPlayerConfig = {
  black?: PlayerController
  white?: PlayerController
  problemOpponent?: 'self' | 'ai'
  ai?: {
    engineId?: string
    maxVisits?: number
    timeLimitMs?: number
    autoPlay: boolean
    autoPlayLimits?: AutoPlayLimits
  }
}

type AutoPlayLimits = {
  maxAutoMovesPerRun: number
  stopOnPassPass: boolean
  stopOnResign: boolean
  stopOnNoLegalMove: boolean
  stopOnUserInterruption: boolean
}
```

写入者：

```text
workbenchTabService
workbenchFlowService
```

读取者：

```text
TrainingWorkbenchContainer
TabBarViewModel
ModePanelViewModel
```

## 4.3 trainingRuntimeStore

职责：保存当前训练运行态，不保存完整历史事实。

```ts
type TrainingRuntimeState = {
  activeAttemptId?: string
  activeRecallSessionId?: string
  activeCheckpointId?: string
  aiMovePending?: AiMovePending

  pendingMoveEvaluations: Record<string, MoveEvaluation>

  correctionDraft?: {
    checkpointId: string
    moves: string[]
    positionHash?: string
  }

  explorationBranches: Record<string, ExplorationBranch>
  activeExplorationBranchId?: string
  visibleBadMoveIds: string[]
}

type AiMovePending = {
  requestId: string
  tabId: string
  attemptId: string
  positionHash: string
  color: 'black' | 'white'
  startedAt: string
}

type ExplorationBranch = {
  id: string
  basePositionHash: string
  baseMoveIndex?: number
  moves: string[]
  createdFrom: {
    taskId: string
    attemptId?: string
    checkpointId?: string
    badMoveId?: string
  }
}

type TrainingRuntimeStore = {
  getState(): TrainingRuntimeState
  subscribe(listener: () => void): () => void

  setActiveAttempt(id?: string): void
  setActiveRecallSession(id?: string): void
  setActiveCheckpoint(id?: string): void
  setAiMovePending(pending?: AiMovePending): void
  upsertPendingMoveEvaluation(evaluation: MoveEvaluation): void
  removePendingMoveEvaluation(evaluationId: string): void
  setCorrectionDraft(draft?: {
    checkpointId: string
    moves: string[]
    positionHash?: string
  }): void
  upsertExplorationBranch(branch: ExplorationBranch): void
  setActiveExplorationBranch(id?: string): void
  setVisibleBadMoveIds(ids: string[]): void
}
```

## 4.4 reviewQueueStore，可选

只有当 Review Inbox 需要筛选、批量操作、排序缓存时才建。

MVP 可以由 `reviewService.getDueItems()` 直接查 DB。

---

# 5. Service 设计

## 5.1 taskImportService

### 责任

把外部材料 / 派生材料标准化成 TrainingTask。

### API

```ts
type TaskImportService = {
  importFoxGame(input: {gameId: string}): Promise<TrainingTask>
  importLocalSgf(input: {
    filePath: string
    title?: string
  }): Promise<TrainingTask>
  import101Problem(input: {problemId: string}): Promise<TrainingTask>
  createManualTask(input: CreateTrainingTaskInput): Promise<TrainingTask>
  createTaskFromSnapshot(input: SnapshotTaskInput): Promise<TrainingTask>
  createTaskFromBadMove(input: {badMoveId: string}): Promise<TrainingTask>
}
```

### 输出原则

所有方法都输出普通 `TrainingTask`。

禁止输出：

```text
snapshot_problem task kind
punishment_problem task kind
fox_game task kind
101_problem task kind
```

这些信息写入：

```text
TrainingTask.origin
```

## 5.2 workbenchTabService

### 责任

打开、关闭、切换 Tab。

### API

```ts
type WorkbenchTabService = {
  openTask(input: {
    taskId: string
    mode?: WorkbenchMode
    parentTabId?: string
  }): Promise<WorkbenchTab>

  closeTab(tabId: string): Promise<void>
  switchTab(tabId: string): void
}
```

### 默认 mode 推导

```text
如果 mode 显式传入：使用传入 mode。
如果 task 有 prompt / goal / passRule / referenceLines：默认 problem。
否则默认 play。
```

### 禁止 API

不要再新增：

```text
openGameTab
openProblemTab
openSnapshotProblemTab
openPunishmentProblemTab
openRecallSegmentTab
openFoxGameTab
open101ProblemTab
```

这些都是导入层或 Task 字段问题，不是 Workbench 打开逻辑。

## 5.3 workbenchFlowService

### 责任

Tab 内模式转换和跨实体流程编排。

它替代 v0.4 中过强的 `workbenchPhaseService`。

### API

```ts
type WorkbenchFlowService = {
  startAttempt(tabId: string): Promise<TrainingAttempt>

  updatePlayerConfig(input: {
    tabId: string
    patch: Partial<WorkbenchPlayerConfig>
  }): Promise<void>

  submit(tabId: string): Promise<RecallSession>

  enterRecall(input: {tabId: string; attemptId: string}): Promise<RecallSession>

  completeRecall(input: {tabId: string; recallSessionId: string}): Promise<void>

  enterAnalysis(input: {
    tabId: string
    context?: Partial<AnalysisContext>
    returnTarget?: AnalysisReturnTarget
  }): Promise<void>

  returnFromAnalysis(input: {
    tabId: string
  }): Promise<void>

  restartAttempt(tabId: string): Promise<TrainingAttempt>

  snapshotFromCurrentContext(input: {
    tabId: string
    reason?: string
  }): Promise<WorkbenchTab>
}
```

### 转换规则

主干转换：

```text
play/problem --submit--> recall
recall --complete--> analysis 或 end
any mode --snapshot--> new tab, mode = problem/play
```

允许的自由转换：

```text
play/problem --enterAnalysis--> analysis
recall --enterAnalysis--> analysis
analysis --returnFromAnalysis--> previous mode
analysis --restartAttempt--> play/problem
```

约束：

```text
Submit 必须 freeze Attempt。
enterAnalysis 必须保存 AnalysisReturnTarget。
returnFromAnalysis 只能使用保存过的 AnalysisReturnTarget，不允许靠临时 toMode 猜测。
Recall checkpoint 只能改变 recallSubstate，不允许把 checkpoint 变成独立 mode。
Analysis 不得隐式修改 Attempt.userLine。
Snapshot 不得复用当前 Tab 作为新 Task。
Snapshot 必须允许没有 taskId 的自由落子 Tab；这种情况下新 Task 的
origin.provider='snapshot'，但 origin.parentTaskId 省略。
非法转换必须 throw / reject 并记录日志。
```

## 5.4 aiMoveService

### 责任

根据当前 tab 的玩家配置和当前 game tree 轮次，为 AI 控制方生成下一手，并把 AI
结果交回 Play move commit 主线。

`aiMoveService` 是 AI turn policy + engine request orchestration 的 owner；不要新增只做转发的
`AiTurnScheduler`。但它也不能成为第二个 `engineService`：它不直接写 game tree、不直接写
Attempt、不更新 overlay。

### API

```ts
type AiMoveService = {
  maybeStartPlayTurn(input: {
    tabId: string
    treePosition: string
    reason: 'start' | 'resume' | 'after-mode-return'
  }): Promise<PlayMoveCommand | null>

  maybeContinueAfterPlayMove(input: {
    commit: PlayMoveCommitted
  }): Promise<PlayMoveCommand | null>

  requestAiMove(input: {
    tabId: string
    treePosition: string
    color: 'black' | 'white'
    problemArea?: ProblemArea
  }): Promise<string | null>

  validateAiMove(input: {
    tabId: string
    move: string
    color: 'black' | 'white'
    requestId: string
    treePosition: string
  }): Promise<void>
}
```

### Play Mode 规则

```text
WorkbenchPlayerConfig.black / white 决定黑白方由 human 或 ai 控制。
当前 game tree 的 next player 对应颜色为 ai 时，aiMoveService 请求引擎生成 AI move command。
AI move command 必须回到 Play move commit 主线，由 documentStore 提交后产生
PlayMoveCommitted。
黑白双方都可为 human，也都可为 ai；双方都为 ai 时必须有自动对弈节流和停止条件。
```

人人对局也可以进入 `aiMoveService` 判断入口，但必须 no-op，不得请求 engine。

### Problem Mode 规则

```text
用户方由 TrainingTask.sideToMove 决定。
problemOpponent='self' 时，用户手动控制双方落子。
problemOpponent='ai' 时，对方由 AI 应手。
```

Problem Mode 的 AI 落子必须受 `TrainingTask.problemArea` 约束：

```text
读取 task.problemArea；
转换成 analysisAreaVertices / analysisAreaRects；
请求 engine 时传入 analysis area；
对 engine 返回 move 做二次过滤；
范围外 move 必须 reject；
没有范围或没有范围内候选时，不自动落子。
```

### 异步与竞态安全

发起 AI 请求时必须记录 `AiMovePending`，至少包含
`requestId`、`tabId`、`attemptId`、`positionHash`、`color` 和 `startedAt`。

AI 返回时必须重新校验：

```text
当前 active tab 仍是 pending.tabId；
activeAttemptId 仍是 pending.attemptId；
当前 positionHash 仍等于 pending.positionHash；
当前 mode 仍允许 AI 落子；
返回 move 合法；
Problem Mode 返回 move 在 task.problemArea 内。
```

任一校验失败时，旧请求结果必须丢弃，不能写入 documentStore 或 Attempt。
用户悔棋、切 Tab、进入 Analysis、重新开始 Attempt、提交 Attempt 或关闭自动对弈，
都应使旧 `AiMovePending.requestId` 失效。

AI vs AI 自动对弈必须受 `AutoPlayLimits` 限制：

```text
maxAutoMovesPerRun
stopOnPassPass
stopOnResign
stopOnNoLegalMove
stopOnUserInterruption
```

### 边界

不负责：

```text
写 game tree；
写 Attempt.userLine / moveActors；
评价坏棋；
创建 Attempt；
决定 Submit 结果；
显示或更新 overlay。
```

AI 落子必须走 Play move command / Problem move command 对应主线。Play Mode 中，
AI move 成功提交后产生 `PlayMoveCommitted`，再由 AttemptRecorder 写入 Attempt，
`moveActors` 标记为 `ai`。

Play / Problem / Recall 下 overlay projection 为 off；`aiMoveService` 不参与
`overlayRegion`。

## 5.5 attemptService

### 责任

管理一次 Play / Problem 作答事实。

### API

```ts
type AttemptService = {
  createAttempt(input: {
    taskId: string
    tabId?: string
    rootPositionSgf: string
  }): Promise<TrainingAttempt>

  appendMove(input: {
    attemptId: string
    move: string
    actor?: 'human' | 'ai'
  }): Promise<void>

  freezeAttempt(attemptId: string): Promise<TrainingAttempt>

  finalizeAttemptResult(input: {
    attemptId: string
    result: TrainingAttemptResult
  }): Promise<void>

  markAnalysisOpened(attemptId: string): Promise<void>
  completeAttempt(attemptId: string): Promise<void>
}
```

### 边界

不负责：

```text
直接读 engine
判定 bad move severity
打开 Tab
创建 RecallCheckpoint
```

## 5.6 playTrainingMonitor

### 责任

监听用户落子和 analysis update，补齐 MoveEvaluation / BadMove。

### API

```ts
type PlayTrainingMonitor = {
  startForAttempt(attemptId: string): void
  stopForAttempt(attemptId: string): void

  onUserMove(input: {
    attemptId: string
    moveIndex: number
    move: string
  }): Promise<void>

  onAnalysisUpdated(input: {positionKey: string}): Promise<void>

  failExpiredPendingEvaluations(now?: string): Promise<void>
}
```

### 超时规则

```text
pending MoveEvaluation 超过 30 秒没有可用 analysis result：
→ status = failed
→ 不创建 BadMove
→ Submit 时不作为 pass/fail 的决定性依据
```

## 5.7 evaluationRules

纯函数模块，不读写 Store / DB / Adapter。

```ts
type EvaluationRules = {
  evaluateMove(input: {
    beforeEval?: NormalizedAnalysisResult
    afterEval?: NormalizedAnalysisResult
    move: string
    moveIndex: number
    passRule?: PassRule
  }): Partial<MoveEvaluation>

  classifySeverity(input: {
    scoreDrop?: number
    winrateDrop?: number
    passRule?: PassRule
  }): 'none' | 'minor' | 'major' | 'severe'

  evaluateAttempt(input: {
    attempt: TrainingAttempt
    moveEvaluations: MoveEvaluation[]
    badMoves: BadMove[]
    task: TrainingTask
  }): TrainingAttemptResult
}
```

## 5.8 recallService

### 责任

管理 RecallSession 和 RecallAttempt。

### API

```ts
type RecallService = {
  createRecallFromAttempt(input: {
    attemptId: string
    recallPolicy?: RecallPolicy
  }): Promise<RecallSession>

  submitRecallMove(input: {
    recallSessionId: string
    userMove: string
  }): Promise<RecallAttempt>

  completeRecall(recallSessionId: string): Promise<void>
}

type RecallPolicy = 'fullLine' | 'humanMovesOnly' | 'sideToMoveOnly'
```

MVP 不做复杂 RecallSource。

Attempt 始终保存真实产出的完整线：

```text
Attempt.userLine
```

RecallSession 必须显式保存：

```ts
type RecallSession = {
  attemptId: string
  recallPolicy: RecallPolicy
  expectedMoves: string[]
  expectedMoveIndexes: number[]
}
```

策略语义：

```text
fullLine        回忆整条 Attempt.userLine，包括 AI / 对手应手
humanMovesOnly  只回忆 moveActors 标记为 human 的手
sideToMoveOnly  只回忆 TrainingTask.sideToMove 对应一方的手
```

默认策略：

```text
Play Mode    fullLine
Problem Mode humanMovesOnly，除非 task 或 UI 显式要求 fullLine
```

## 5.9 recallCheckpointService

### 责任

管理问题手主动纠错流程。

### API

```ts
type RecallCheckpointService = {
  shouldTriggerCheckpoint(input: {
    recallSessionId: string
    moveIndex: number
  }): Promise<BadMove | null>

  startCheckpoint(input: {
    recallSessionId: string
    badMoveId: string
  }): Promise<RecallCheckpoint>

  submitUserCorrectionLine(input: {
    checkpointId: string
    moves: string[]
  }): Promise<void>

  revealAiCandidateLines(checkpointId: string): Promise<ReferenceLine[]>

  saveComment(input: {
    checkpointId: string
    comment: MoveComment
  }): Promise<void>

  skipCheckpoint(checkpointId: string): Promise<void>
  resumeRecall(checkpointId: string): Promise<void>
}
```

## 5.10 snapshotService

### 责任

从当前 Workbench 上下文捕获 Snapshot 输入。

### API

```ts
type SnapshotService = {
  captureSnapshotInput(input: {
    tabId: string
    mode: WorkbenchMode
    sourceTaskId?: string
    sourceAttemptId?: string
    analysisContext?: AnalysisContext
    reason?: string
  }): Promise<SnapshotTaskInput>
}

type SnapshotTaskInput = {
  requestId: string
  positionSgf: string
  positionHash: string
  sideToMove: 'black' | 'white'
  parentTaskId?: string
  parentAttemptId?: string
  parentRecallSessionId?: string
  parentCheckpointId?: string
  parentMoveIndex?: number
  parentMode: WorkbenchMode
  sourceTreePosition?: string
  sourceBranchId?: string
  reason?: string
  inheritedProblemArea?: ProblemArea
}
```

`SnapshotService` 不创建 Tab。

`sourceTaskId` 是可选来源追溯字段，不是 Snapshot 的前置条件。对于自由落子 /
free-play Tab，`captureSnapshotInput` 必须跳过 source task 加载，不能调用
`repository.loadTask(null)` 或 `repository.loadTask(undefined)`，并返回可用于创建
普通 snapshot Task 的输入。

完整流程由 `workbenchFlowService.snapshotFromCurrentContext` 编排：

```text
snapshotService.captureSnapshotInput
→ taskImportService.createTaskFromSnapshot
→ workbenchTabService.openTask(newTaskId)
```

当源 Tab 没有 `taskId` 时，`workbenchFlowService.snapshotFromCurrentContext` 仍走同一条
命令路径：捕获当前局面、创建 `origin.provider='snapshot'` 的新 Task、通过
`workbenchTabService.openTask` 打开新 Tab；只是不写 `origin.parentTaskId`。

### 当前局面捕获规则

Snapshot 在四个模式下的“当前局面”定义必须显式：

```text
Play:
  capture documentStore current position + activeAttemptId + moveIndex

Problem:
  capture current answer-line position + optional inherited problemArea / prompt / goal

Recall normal:
  capture recall current index 对应的 expected position，或 capture 用户当前复现位置；
  MVP 必须二选一并写入测试，不允许混用

Recall checkpoint:
  capture checkpoint correctionDraft 当前局面；
  parentCheckpointId 必须写入 origin

Analysis:
  capture active ExplorationBranch 当前局面；
  不读取 Attempt.userLine 的尾局面，除非 analysisContext 明确指向它
```

## 5.11 reviewService

### 责任

Review 队列和调度。

### API

```ts
type ReviewService = {
  getDueItems(now?: string): Promise<ReviewSchedule[]>

  openDueItem(input: {scheduleId: string}): Promise<WorkbenchTab>

  updateScheduleAfterResult(input: {
    taskId: string
    result: TrainingAttemptResult
  }): Promise<void>

  enrollTask(input: {
    taskId: string
    policy: ReviewEnrollmentPolicy
    dueAt?: string
  }): Promise<ReviewSchedule | null>
}

type ReviewEnrollmentPolicy =
  | 'none'
  | 'manual'
  | 'auto_due_now'
  | 'auto_scheduled'
```

### 关键变化

ReviewSchedule 直接引用：

```text
taskId
```

不再需要：

```text
itemType = problem / recall_segment
```

默认 enrollment 策略：

```text
Snapshot: manual
BadMove derived task: auto_due_now 或 auto_scheduled
Skipped checkpoint: manual 或 auto_scheduled
```

Analysis 中频繁创建 Snapshot 时不得默认塞满 Review Inbox；除非用户显式选择或
调用方传入 auto 策略，否则 Snapshot 只创建 Task 和“加入复习”候选。

---

# 6. Repository 设计

## 6.1 trainingRepository 定位

统一访问训练 DB。

```text
Services → trainingRepository → db.js
```

Repository 只做：

```text
entity persistence
mapping
query
transaction
```

不做：

```text
UI
业务流程编排
Adapter 操作
棋盘命令
```

## 6.2 Repository API 草案

```ts
type TrainingRepository = {
  // Task
  createTask(task: TrainingTask): Promise<TrainingTask>
  loadTask(taskId: string): Promise<TrainingTask>
  updateTask(taskId: string, patch: Partial<TrainingTask>): Promise<void>
  listTasks(filter?: TaskFilter): Promise<TrainingTask[]>
  archiveTask(taskId: string): Promise<void>

  // Attempt
  createAttempt(attempt: TrainingAttempt): Promise<TrainingAttempt>
  loadAttempt(attemptId: string): Promise<TrainingAttempt>
  listAttemptsByTask(taskId: string): Promise<TrainingAttempt[]>
  updateAttempt(
    attemptId: string,
    patch: Partial<TrainingAttempt>,
  ): Promise<void>
  listIncompleteAttempts(): Promise<TrainingAttempt[]>

  // MoveEvaluation
  createMoveEvaluation(evaluation: MoveEvaluation): Promise<MoveEvaluation>
  updateMoveEvaluation(
    evaluationId: string,
    patch: Partial<MoveEvaluation>,
  ): Promise<void>
  listMoveEvaluationsByAttempt(attemptId: string): Promise<MoveEvaluation[]>
  listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]>

  // BadMove
  createBadMove(badMove: BadMove): Promise<BadMove>
  loadBadMove(badMoveId: string): Promise<BadMove>
  listBadMovesByAttempt(attemptId: string): Promise<BadMove[]>
  listBadMovesByTask(taskId: string): Promise<BadMove[]>
  updateBadMove(badMoveId: string, patch: Partial<BadMove>): Promise<void>
  markBadMoveAsNotBad(badMoveId: string): Promise<void>

  // Recall
  createRecallSession(session: RecallSession): Promise<RecallSession>
  loadRecallSession(recallSessionId: string): Promise<RecallSession>
  updateRecallSession(
    recallSessionId: string,
    patch: Partial<RecallSession>,
  ): Promise<void>
  listIncompleteRecallSessions(): Promise<RecallSession[]>
  createRecallAttempt(attempt: RecallAttempt): Promise<RecallAttempt>
  listRecallAttempts(recallSessionId: string): Promise<RecallAttempt[]>

  // Checkpoint
  createRecallCheckpoint(
    checkpoint: RecallCheckpoint,
  ): Promise<RecallCheckpoint>
  loadRecallCheckpoint(checkpointId: string): Promise<RecallCheckpoint>
  updateRecallCheckpoint(
    checkpointId: string,
    patch: Partial<RecallCheckpoint>,
  ): Promise<void>
  listCheckpointsByRecallSession(
    recallSessionId: string,
  ): Promise<RecallCheckpoint[]>

  // Comment
  createMoveComment(comment: MoveComment): Promise<MoveComment>
  loadMoveComment(commentId: string): Promise<MoveComment>
  updateMoveComment(
    commentId: string,
    patch: Partial<MoveComment>,
  ): Promise<void>
  listCommentsByTarget(target: MoveCommentTarget): Promise<MoveComment[]>

  // Review
  createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule>
  loadReviewSchedule(scheduleId: string): Promise<ReviewSchedule>
  listDueReviewItems(now: string): Promise<ReviewSchedule[]>
  updateReviewSchedule(
    scheduleId: string,
    patch: Partial<ReviewSchedule>,
  ): Promise<void>

  // Transaction
  transaction<T>(fn: () => Promise<T>): Promise<T>
}
```

## 6.3 原子性要求

必须使用 transaction 的流程：

```text
submit：freeze attempt + evaluate result + create recall session
completeRecall：complete recall + update attempt + update review schedule
snapshot：create task + optional review enrollment + open tab 前持久化
createTaskFromBadMove：create task + update bad move + create review schedule
```

---

# 7. 数据库表设计

## 7.1 training_tasks

```sql
CREATE TABLE training_tasks (
  id TEXT PRIMARY KEY,

  title TEXT,
  initial_position_sgf TEXT NOT NULL,
  side_to_move TEXT,

  prompt TEXT,
  goal TEXT,
  pass_rule_json TEXT,
  reference_lines_json TEXT,
  problem_area_json TEXT,

  tags_json TEXT,
  difficulty INTEGER,
  status TEXT NOT NULL,

  origin_json TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
```

说明：

```text
不再有 kind / source_kind / source_problem_id / source_segment_id。
所有来源信息进入 origin_json。
Problem-like 字段直接存在 task 上。
```

## 7.2 training_attempts

```sql
CREATE TABLE training_attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  tab_id TEXT,

  started_at TEXT NOT NULL,
  submitted_at TEXT,
  completed_at TEXT,

  root_position_sgf TEXT NOT NULL,
  user_line_json TEXT NOT NULL,
  move_actors_json TEXT,

  status TEXT NOT NULL,
  result TEXT NOT NULL,

  hint_level_used INTEGER DEFAULT 0,
  recall_completed INTEGER DEFAULT 0,
  analysis_opened INTEGER DEFAULT 0,

  FOREIGN KEY(task_id) REFERENCES training_tasks(id)
);
```

## 7.3 move_evaluations

```sql
CREATE TABLE move_evaluations (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,

  move_index INTEGER NOT NULL,
  move TEXT NOT NULL,

  position_before_hash TEXT,
  position_after_hash TEXT,
  position_before_sgf TEXT,
  position_after_sgf TEXT,

  before_score_lead REAL,
  after_score_lead REAL,
  score_drop REAL,

  before_winrate REAL,
  after_winrate REAL,
  winrate_drop REAL,

  engine_suggested_move TEXT,
  engine_suggested_line_json TEXT,

  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  evaluated_at TEXT,

  FOREIGN KEY(attempt_id) REFERENCES training_attempts(id)
);
```

说明：

```text
普通手只保存 hash 和评估结果。
position_before_sgf / position_after_sgf 只在关键节点保存。
```

## 7.4 bad_moves

```sql
CREATE TABLE bad_moves (
  id TEXT PRIMARY KEY,

  move_evaluation_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  task_id TEXT NOT NULL,

  move_index INTEGER NOT NULL,
  severity TEXT NOT NULL,
  punish_side TEXT NOT NULL,

  user_marked_as_not_bad INTEGER DEFAULT 0,

  generated_task_id TEXT,
  recall_checkpoint_id TEXT,

  created_at TEXT NOT NULL,

  FOREIGN KEY(move_evaluation_id) REFERENCES move_evaluations(id),
  FOREIGN KEY(attempt_id) REFERENCES training_attempts(id),
  FOREIGN KEY(task_id) REFERENCES training_tasks(id),
  FOREIGN KEY(generated_task_id) REFERENCES training_tasks(id)
);
```

## 7.5 recall_sessions

```sql
CREATE TABLE recall_sessions (
  id TEXT PRIMARY KEY,

  task_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  tab_id TEXT,

  recall_policy TEXT NOT NULL,
  expected_moves_json TEXT NOT NULL,
  expected_move_indexes_json TEXT NOT NULL,
  current_move_index INTEGER NOT NULL,

  completed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,

  FOREIGN KEY(task_id) REFERENCES training_tasks(id),
  FOREIGN KEY(attempt_id) REFERENCES training_attempts(id)
);
```

说明：

```text
MVP 不再有 source_json / type / start_move / end_move。
RecallSession 从 Attempt.userLine 派生 expected_moves_json，但必须显式保存
recall_policy 和 expected_move_indexes_json。
```

## 7.6 recall_attempts

```sql
CREATE TABLE recall_attempts (
  id TEXT PRIMARY KEY,
  recall_session_id TEXT NOT NULL,

  move_number INTEGER NOT NULL,
  expected_move TEXT NOT NULL,
  user_move TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  hint_level_used INTEGER DEFAULT 0,

  created_at TEXT NOT NULL,

  FOREIGN KEY(recall_session_id) REFERENCES recall_sessions(id)
);
```

## 7.7 recall_checkpoints

```sql
CREATE TABLE recall_checkpoints (
  id TEXT PRIMARY KEY,

  recall_session_id TEXT NOT NULL,
  bad_move_id TEXT NOT NULL,

  status TEXT NOT NULL,
  user_correction_line_json TEXT NOT NULL,
  ai_candidate_lines_json TEXT NOT NULL,
  user_comment_id TEXT,

  created_at TEXT NOT NULL,
  completed_at TEXT,

  FOREIGN KEY(recall_session_id) REFERENCES recall_sessions(id),
  FOREIGN KEY(bad_move_id) REFERENCES bad_moves(id)
);
```

## 7.8 move_comments

```sql
CREATE TABLE move_comments (
  id TEXT PRIMARY KEY,

  target_json TEXT NOT NULL,
  content TEXT NOT NULL,
  template_answers_json TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 7.9 review_schedule

```sql
CREATE TABLE review_schedule (
  id TEXT PRIMARY KEY,

  task_id TEXT NOT NULL,

  due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL,

  ease_factor REAL,
  last_result TEXT,
  consecutive_pass_count INTEGER DEFAULT 0,
  total_fail_count INTEGER DEFAULT 0,
  last_reviewed_at TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY(task_id) REFERENCES training_tasks(id)
);
```

说明：

```text
Review 不再有 item_type / item_id。
Review 直接调度 task_id。
```

## 7.10 索引与幂等约束

建议索引：

```sql
CREATE INDEX idx_attempts_task_id ON training_attempts(task_id);
CREATE INDEX idx_evaluations_attempt_move ON move_evaluations(attempt_id, move_index);
CREATE INDEX idx_bad_moves_attempt ON bad_moves(attempt_id);
CREATE INDEX idx_review_due_at ON review_schedule(due_at);
CREATE INDEX idx_review_task_id ON review_schedule(task_id);
```

幂等规则：

```text
同一个 badMoveId createTaskFromBadMove 重复调用时，不重复生成 task。
同一个 snapshot requestId 重复提交时，不重复创建 task。
submit(tabId) 对已 frozen attempt 重复调用时 reject，或返回已有 RecallSession。
AI move request 过期后不可写入 Attempt。
```

## 7.11 后置表

后续才考虑：

```text
workbench_tabs        需要恢复 Tab 时再持久化
training_branches     Analysis 分支列表复杂后再做
analysis_sessions     需要保存完整复盘会话后再做
task_tags             标签复杂后再做
external_sync_records 外部同步复杂后再做
```

---

# 8. Adapter 设计

## 8.1 MVP 必做 Adapter

```text
legacySabakiAdapter
positionSnapshotAdapter
analysisResultAdapter
```

## 8.2 legacySabakiAdapter

包装旧 Sabaki API。

```ts
type LegacySabakiAdapter = {
  getCurrentMode(): string
  setLegacyMode(mode: string): void
  getCurrentTreePosition(): string | undefined
  navigateToTreePosition(position: string): void
  notifyLegacyStateChanged(): void
}
```

## 8.3 positionSnapshotAdapter

捕获稳定局面。

```ts
type PositionSnapshot = {
  positionSgf: string
  sideToMove: 'black' | 'white'
  treePosition?: string
  moveNumber?: number
  positionHash: string
}

type PositionSnapshotAdapter = {
  captureCurrentPosition(): PositionSnapshot
  captureBeforeMove(moveIndex: number): PositionSnapshot
  captureAfterMove(moveIndex: number): PositionSnapshot
}
```

## 8.4 analysisResultAdapter

把 analysisService 输出转换成稳定接口。

```ts
type NormalizedAnalysisResult = {
  positionKey: string
  scoreLead?: number
  winrate?: number
  visits?: number
  candidateMoves: Array<{
    move: string
    scoreLead?: number
    winrate?: number
    visits?: number
    pv: string[]
  }>
}

type AnalysisResultAdapter = {
  getAnalysisForPosition(positionKey: string): NormalizedAnalysisResult | null
  getCurrentAnalysis(): NormalizedAnalysisResult | null
  subscribeAnalysisUpdates(listener: (positionKey: string) => void): () => void
}
```

## 8.5 后置 Adapter

```text
boardCommandAdapter：当 Play / Recall / Analysis 多处都需要统一棋盘命令时再抽。
engineAnalysisAdapter：当需要主动请求非当前局面分析时再抽。
sgfAdapter：当 SGF 构造/解析逻辑出现第二个消费者时再抽。
```

---

# 9. 关键命令路径

## 9.1 导入野狐 / 101 / 本地材料

```text
MaterialBrowser click import
→ taskImportService.importFoxGame / import101Problem / importLocalSgf
→ trainingRepository.createTask({origin_json})
→ workbenchTabService.openTask({taskId})
→ workbenchStore.addTab
```

## 9.2 打开 Task

```text
openTask(taskId, mode?)
→ trainingRepository.loadTask(taskId)
→ infer default mode if mode missing
→ create WorkbenchTab
→ workbenchStore.addTab
→ workbenchStore.setActiveTab
```

默认 mode：

```text
有 prompt / goal / passRule / referenceLines → problem
否则 → play
```

## 9.3 PlayMoveCommitted 与用户落子

```text
User clicks board intersection
→ boardInteractionController resolves PLAY_STONE + mutationContract='playMove'
→ Play move command
→ documentStore.playMove(vertex, actor='human')
→ PlayMoveCommitted(treePositionBefore, treePositionAfter, color, move, actor)
→ AttemptRecorder appendMove({attemptId, move, actor:'human'})
→ playTrainingMonitor.onUserMove(commit)
→ analysis scheduler schedules live/background analysis
→ aiMoveService.maybeContinueAfterPlayMove(commit)
→ if next side is AI:
     create AiMovePending(requestId, tabId, attemptId, positionHash, color)
     requestAiMove with playerConfig
     validateAiMove including request freshness
     return AI Play move command
     documentStore.playMove(aiMove, actor='ai')
     PlayMoveCommitted(actor='ai')
     AttemptRecorder appendMove({attemptId, move: aiMove, actor:'ai'})
```

PlayMode 的主写入事实是 `documentStore` / SGF game tree。Attempt、monitor、analysis
调度、AI 应手都是 `PlayMoveCommitted` 之后的 subscriber / side effect。

PlayMoveCommitted 不触发 `overlayRegion`。Play / Problem / Recall 的 overlay projection 是
off；territory / compare / analysis overlay 只属于 Analysis Mode 或 mode transition cleanup。

Problem Mode 不使用 `PlayMoveCommitted`。Problem 棋盘点击产生 `ProblemMoveCommitted`
或同职责事件，主写入是 `problemFlowService`、`problemView` 和 mutable Attempt line。
Problem AI 应手必须受 `task.problemArea` 约束；任何过期或范围外 AI 落子都不允许进入
Problem runtime 或 Attempt。

analysis update 后：

```text
analysisService emits update
→ analysisResultAdapter subscriber
→ playTrainingMonitor.onAnalysisUpdated(positionKey)
→ analysisResultAdapter.getAnalysisForPosition(...)
→ evaluationRules.evaluateMove
→ trainingRepository.updateMoveEvaluation(status='evaluated')
→ if severity != none:
     trainingRepository.createBadMove
     trainingRuntimeStore.setVisibleBadMoveIds
```

## 9.4 Submit

```text
SubmitButton.onClick
→ TrainingWorkbenchContainer.handleSubmit
→ workbenchFlowService.submit(tabId)
→ trainingRepository.transaction:
   → attemptService.freezeAttempt(activeAttemptId)
   → trainingRepository.listMoveEvaluationsByAttempt
   → trainingRepository.listBadMovesByAttempt
   → evaluationRules.evaluateAttempt
   → attemptService.finalizeAttemptResult
   → recallService.createRecallFromAttempt(attemptId)
→ workbenchStore.updateTab({mode:'recall', activeRecallSessionId})
→ trainingRuntimeStore.setActiveRecallSession(recallSessionId)
```

## 9.5 Recall Checkpoint

```text
User submits recall move
→ RecallModeController.handleRecallMove(userMove)
→ recallService.submitRecallMove
→ trainingRepository.createRecallAttempt
→ recallCheckpointService.shouldTriggerCheckpoint
→ if major/severe:
     recallCheckpointService.startCheckpoint
     trainingRuntimeStore.setActiveCheckpoint
     UI enters checkpoint substate
```

用户提交 correction：

```text
User plays correction line
→ trainingRuntimeStore.setCorrectionDraft
→ recallCheckpointService.submitUserCorrectionLine
→ trainingRepository.updateRecallCheckpoint
```

Reveal AI：

```text
RevealButton.onClick
→ recallCheckpointService.revealAiCandidateLines
→ analysisResultAdapter / repository load candidates
→ UI displays original / correction / AI lines
```

Comment：

```text
User writes comment
→ recallCheckpointService.saveComment
→ trainingRepository.createMoveComment
→ trainingRepository.updateRecallCheckpoint(status='commented')
→ recallCheckpointService.resumeRecall
→ trainingRuntimeStore.setActiveCheckpoint(undefined)
```

## 9.6 进入 Analysis

```text
EnterAnalysisButton.onClick
→ workbenchFlowService.enterAnalysis({tabId, context, returnTarget})
→ workbenchStore.updateTab({mode:'analysis', analysisContext, analysisReturnTarget})
→ attemptService.markAnalysisOpened? if attempt exists
→ AnalysisModePanel loads badMoves / comments / candidates
```

Analysis 不改变 Attempt.userLine。

## 9.7 Snapshot

```text
SnapshotButton.onClick
→ workbenchFlowService.snapshotFromCurrentContext({tabId, reason})
→ snapshotService.captureSnapshotInput({tabId, mode: activeTab.mode, ...})
→ taskImportService.createTaskFromSnapshot
→ trainingRepository.createTask(origin.provider='snapshot')
→ workbenchTabService.openTask({taskId:newTaskId, mode:'problem', parentTabId:tabId})
```

Snapshot 是全局命令，不是 Analysis 专属命令：

```text
Play     捕获 documentStore 当前局面 + activeAttemptId + moveIndex
Problem  捕获当前作答线局面 + optional inherited problemArea
Recall   normal 捕获 recall 当前 expected position 或用户复现位置，MVP 二选一
Recall   checkpoint 捕获 correctionDraft，origin 写 parentCheckpointId
Analysis 捕获 active ExplorationBranch 当前局面
```

快捷键和按钮应走同一条 command path。

## 9.8 BadMove 派生 Task

```text
CreatePunishmentTaskButton.onClick 或 Recall complete 后自动创建
→ taskImportService.createTaskFromBadMove({badMoveId})
→ if badMove.generatedTaskId exists: return existing task
→ trainingRepository.createTask(origin.provider='bad_move')
→ trainingRepository.updateBadMove({generatedTaskId})
→ reviewService.enrollTask({policy:'auto_due_now' 或 'auto_scheduled'})
```

## 9.9 Review 打开到期 Task

```text
ReviewInbox item click
→ reviewService.openDueItem({scheduleId})
→ trainingRepository.loadReviewSchedule(scheduleId)
→ workbenchTabService.openTask({taskId})
```

---

# 10. 渲染路径

## 10.1 主工作台

```text
workbenchStore.activeTab
+ trainingRuntimeStore
→ TrainingWorkbenchContainer
→ choose panel by tab.mode
```

```ts
switch (tab.mode) {
  case 'play': return <PlayModePanel />
  case 'problem': return <ProblemModePanel />
  case 'recall': return <RecallModePanel />
  case 'analysis': return <AnalysisModePanel />
}
```

## 10.2 Play / Problem UI Policy

```text
TrainingTask fields
+ WorkbenchMode
→ workbenchUiPolicy
→ panel props
```

示例：

```ts
const isProblemLike = !!(
  task.prompt ||
  task.goal ||
  task.passRule ||
  task.referenceLines?.length
)
```

Player controls:

```text
Play panel shows black/white human|ai selectors.
Problem panel shows opponent self|ai selector.
Problem panel disables AI opponent unless task.problemArea exists.
Problem panel shows problemArea / analysis area status when AI opponent is enabled.
```

## 10.3 BadMove List

```text
activeAttemptId
→ trainingRepository.listBadMovesByAttempt
→ join MoveEvaluation
→ BadMoveList
```

## 10.4 Recall Checkpoint UI

```text
trainingRuntimeStore.activeCheckpointId
→ trainingRepository.loadRecallCheckpoint
→ load BadMove / MoveEvaluation / Comment
→ RecallCheckpointPanel
```

## 10.5 Analysis UI

```text
analysisContext
+ taskId
+ attemptId
→ load bad moves / move evaluations / comments / candidate lines
→ AnalysisModePanel
```

---

# 11. 目录结构建议

```text
src/modules/training/
  index.ts

  types/
    task.ts
    tab.ts
    attempt.ts
    evaluation.ts
    badMove.ts
    recall.ts
    checkpoint.ts
    analysis.ts
    review.ts
    comment.ts

  store/
    workbenchStore.ts
    trainingRuntimeStore.ts
    reviewQueueStore.ts          # optional

  repository/
    trainingRepository.ts
    trainingMappers.ts
    migrations/
      001_training_tasks.sql
      002_training_attempts.sql
      003_move_evaluations.sql
      004_bad_moves.sql
      005_recall.sql
      006_comments_review.sql

  import/
    taskImportService.ts

  workbench/
    workbenchTabService.ts
    workbenchFlowService.ts
    workbenchUiPolicy.ts
    aiMoveService.ts
    modeTransitions.ts

  attempt/
    attemptService.ts
    playTrainingMonitor.ts
    evaluationRules.ts

  recall/
    recallService.ts
    recallCheckpointService.ts

  analysis/
    snapshotService.ts

  review/
    reviewService.ts
    reviewScheduleRules.ts       # optional; can start inside reviewService

  adapter/
    legacySabakiAdapter.ts
    positionSnapshotAdapter.ts
    analysisResultAdapter.ts
    engineMoveAdapter.ts          # optional until engine move command needs isolation
    boardCommandAdapter.ts        # optional
    engineAnalysisAdapter.ts      # optional
    sgfAdapter.ts                 # optional

src/components/training/
  TrainingWorkbenchContainer.tsx
  MaterialBrowser.tsx
  ReviewInbox.tsx
  TabBar.tsx
  panels/
    PlayModePanel.tsx
    ProblemModePanel.tsx
    RecallModePanel.tsx
    RecallCheckpointPanel.tsx
    AnalysisModePanel.tsx
    BadMoveList.tsx
    SnapshotButton.tsx
```

---

# 12. 实施阶段

> 实施阶段和最小切面见 `gabaki-sabaki-training-implementation-plan.md`

---

# 13. 测试策略

## 13.1 Unit Tests

```text
workbenchUiPolicy 推导
modeTransitions 合法/非法转换
evaluationRules severity / attempt result
taskImportService 输出标准 Task
aiMoveService Problem 范围过滤
reviewScheduleRules
```

## 13.2 Repository Tests

使用真实 SQLite test db：

```text
create/load/update task
origin_json roundtrip
problem_area_json roundtrip
attempt lifecycle
move_actors_json roundtrip
move_evaluation pending/evaluated/failed
bad_move generated_task_id
recall_session attempt_id binding
recall_policy / expected_move_indexes roundtrip
review_schedule task_id binding
repository indexes exist
transaction rollback
snapshot requestId idempotency
badMove derived task idempotency
```

## 13.3 Service Tests

```text
openTask 默认 mode 推导
modeTransitions table-driven tests
submit 创建 RecallSession
RecallPolicy fullLine / humanMovesOnly / sideToMoveOnly tests
Recall checkpoint 流程
Snapshot 创建新 Task 但不打开旧 Tab
Review openDueItem 只通过 taskId 打开
Analysis 不修改 Attempt.userLine
Play 黑白 AI 配置触发正确方自动落子
Problem AI 应手必须限制在 problemArea 内
AI stale request rejection tests
ReviewEnrollmentPolicy tests
```

## 13.4 Integration Tests

```text
Problem-like task → Problem Mode → Submit → Recall
Free task → Play Mode → Submit → Recall
Play Mode black/white human|ai → AI auto move
Problem Mode opponent=ai → constrained AI reply
Recall major BadMove → Checkpoint → Comment → Resume
Play / Problem / Recall / Analysis → Snapshot → New Task
Review item → openTask
```

---

# 14. 架构红线

必须坚持：

```text
source 不再是核心建模维度
origin 只做追溯，不参与主流程判断
WorkbenchTab 保存 UI 状态，不保存训练事实
Attempt 是用户产出的一条线
RecallSession 绑定 Attempt
RecallPolicy 显式决定 expectedMoves，不靠 Attempt.userLine 隐式推断
Checkpoint 是 Recall substate，不是 WorkbenchMode
Analysis Return 必须恢复 AnalysisReturnTarget
Analysis 不污染 Attempt
Snapshot 创建新 Task，不复用当前 Tab
Problem AI 落子必须受 task.problemArea / analysis area 限制
AI 请求必须校验 requestId / attemptId / positionHash，过期不可写
ReviewSchedule 直接引用 taskId
Store 控制在 2～3 个
Repository 是唯一训练 DB 入口
Existing Core 不知道 training 业务
```

禁止恢复：

```text
TrainingTaskKind = game | problem | snapshot_problem | recall_segment
ReviewItemType = problem | recall_segment
openSnapshotProblemTab
openPunishmentProblemTab
openRecallSegmentTab
根据 origin.provider 选择主流程
Problem AI 在题目范围外自动落子
每个实体一个 Store
```

---

# 15. 架构结论

v0.5 的架构核心是：

```text
导入层处理来源。
训练层处理 Task。
工作台处理 Mode。
Attempt 记录用户产出。
Recall 训练主动回忆。
Analysis 承载自由研究。
Review 调度 Task。
```

最终依赖方向：

```text
UI
→ Controller / Container
→ Service
→ Repository / Store / Adapter
→ Existing Sabaki Core
```

最终主链路：

```text
外部材料
→ taskImportService
→ TrainingTask(origin metadata)
→ workbenchTabService.openTask
→ Play / Problem
→ Attempt
→ Submit
→ Recall
→ Checkpoint
→ Analysis
→ Snapshot
→ new TrainingTask
→ ReviewSchedule
```
