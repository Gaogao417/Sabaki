# Gabaki / Sabaki 训练系统模块架构文档

> 文档类型：模块架构与实现指导  
> 对应 PRD：Gabaki / Sabaki 围棋训练系统 PRD v0.4  
> 当前目标：在不破坏 Sabaki 既有核心架构的前提下，把训练系统从 legacy global mode 迁移到 `TrainingTask + WorkbenchTab + Phase + Attempt` 架构。

相关文档：

- [Training PRD v0.4](./gabaki-sabaki-training-prd-v0.4.md)
- [Training Implementation Plan](./gabaki-sabaki-training-implementation-plan.md)

---

# 1. 架构误会澄清：读路径 vs 写路径

前面曾经出现过类似图：

```text
UI
↓
Container / ViewModel
↓
Store
↓
Service
↓
Adapter
↓
Existing Core
```

这张图如果理解成“渲染读数据路径”，可以成立，因为 UI 显示数据时通常是：

```text
Store → Container / ViewModel → UI
```

但它不能作为“依赖关系图”或“命令调用图”。

## 1.1 正确的读路径 / Render Flow

```text
Store
→ Container / ViewModel
→ UI Component
```

含义：

1. Store 保存状态。
2. Container / ViewModel 订阅 Store。
3. Container / ViewModel 把 Store 状态组装成 UI props。
4. UI Component 只负责展示。

示例：

```text
workbenchStore.tabs
→ TrainingWorkbenchContainer
→ WorkbenchShell / TabBar / PhasePanel
```

## 1.2 正确的写路径 / Command Flow

```text
UI Component
→ Container / Controller
→ Service
→ Store / Repository / Adapter
→ Existing Sabaki Core
```

含义：

1. 用户点击按钮或落子。
2. Component 把事件交给 Container。
3. Container 调用 Service。
4. Service 执行业务动作。
5. Service 写 Store / Repository / Adapter。
6. Adapter 隔离旧 Sabaki API、documentStore、analysisService、engineService 等底层模块。

示例：

```text
Submit Button
→ TrainingWorkbenchContainer.onSubmit
→ workbenchPhaseService.submitPlay(tabId)
→ attemptService.freezeAttempt(...)
→ trainingRepository.saveAttempt(...)
→ workbenchStore.updateTabPhase(tabId, 'recall')
```

## 1.3 架构规定

必须遵守：

```text
Store 不依赖 Service
Service 可以依赖 Store
Container 读 Store、调 Service
Component 不直接操作业务 Store
Repository 不知道 UI
Adapter 隔离旧 Sabaki API 和底层模块
```

具体规则：

1. Store 是状态容器，不应该调用 Service。
2. Service 是业务动作和状态变化的合法入口，可以读写 Store。
3. Container 负责读 Store、调 Service。
4. Store 的最近写入者应该是 Service。
5. Store 的最近读取者通常是 Container / ViewModel。
6. 除非是非常轻的 UI 状态，比如 panel 展开/收起、hover、sidebar 宽度，否则 Container 不应该直接写 Store。
7. 涉及业务语义的动作必须走 Service：
   - 打开 Problem Tab；
   - 提交 Attempt；
   - 进入 Recall；
   - 生成 Checkpoint；
   - 保存 Snapshot；
   - 更新 Review Schedule。

---

# 2. 总体分层架构

## 2.1 总体架构图

```text
UI Components
  ├─ WorkbenchShell.js / Training views
  ├─ TabBar
  ├─ PlayPanel
  ├─ RecallPanel
  ├─ AnalysisPanel
  └─ ReviewInbox

Container / Controller / ViewModel
  ├─ TrainingWorkbenchContainer
  ├─ PlayPhaseController
  ├─ RecallPhaseController
  ├─ AnalysisPhaseController
  ├─ TrainingOverlayViewModel
  └─ ReviewQueueContainer

Stores
  ├─ workbenchStore
  ├─ trainingRuntimeStore
  └─ reviewQueueStore?            optional

Services
  ├─ workbenchTabService
  ├─ workbenchPhaseService              # Phase Orchestrator
  ├─ attemptService
  ├─ playTrainingMonitor
  ├─ recallService
  ├─ recallCheckpointService
  ├─ problemService
  ├─ snapshotService
  ├─ reviewService
  ├─ evaluationRules                    # pure functions, not a service
  └─ trainingRepository

Adapters
  ├─ legacySabakiAdapter
  ├─ positionSnapshotAdapter
  ├─ analysisResultAdapter
  ├─ boardCommandAdapter?               # optional when second caller appears
  ├─ engineAnalysisAdapter?             # optional
  └─ sgfAdapter?                        # optional

Existing Sabaki Core
  ├─ sabaki.js legacy global state / facade
  ├─ documentStore
  ├─ engineService
  ├─ enginesyncer
  ├─ analysisService
  ├─ overlayStore
  ├─ hubStore
  ├─ db.js
  ├─ gametree / fileformats
  ├─ existing src/modules/workbench
  ├─ existing WorkbenchShell.js
  └─ trainingStore.js transitional facade
```

## 2.2 分层原则

```text
UI 只展示，不写业务 Store
Container 读 Store，调 Service
Service 执行业务动作
Repository 统一访问训练 DB
Adapter 统一隔离旧 Sabaki API
Existing Core 不知道 training 业务
```

## 2.3 不要过早微服务化

本系统是 Electron / Sabaki 本地应用，不需要微服务化。

这里的 Service 是 domain service / use-case service，不是网络服务。

正确目标：

```text
少量 Store
6～8 个核心 Service
一个训练 Repository
3 个必要 Adapter
纯函数 rules 模块
```

错误目标：

```text
每个名词一个 Store
每个表一个 Service
每个名词一个 Service
只有一个 caller 的 30 行薄 Adapter
每个 Service 自己调 db.js
训练逻辑继续塞 sabaki.js
```

MVP 拆分规则：

```text
必须保留 Service：
workbenchTabService
workbenchPhaseService
attemptService
playTrainingMonitor
recallService
recallCheckpointService
problemService
snapshotService
reviewService

必须保留 Adapter：
legacySabakiAdapter
positionSnapshotAdapter
analysisResultAdapter

先不要独立成 Service：
passRuleEvaluator → evaluationRules.evaluateAttempt
moveEvaluationService → evaluationRules.evaluateMove / classifySeverity
punishmentProblemService → problemService.createPunishmentProblemFromBadMove
reviewScheduler → reviewService 内部纯函数

先不要独立成 Adapter：
boardCommandAdapter
engineAnalysisAdapter
sgfAdapter
```

拆分检查点：

```text
如果某个 service / adapter 少于约 50 行且只有一个 caller，先内联；
如果出现第二个 caller、复杂错误处理、或需要隔离 legacy API，再抽出独立模块。
```

---

# 3. 现有 Sabaki 模块定位

## 3.1 sabaki.js

### 当前定位

`sabaki.js` 是 legacy global state / legacy app facade。它目前承载过多：

```text
mode
problemSession
problemAttempt
recallSession
reviewQueue
engine / board / navigation orchestration
```

### v0.4 定位

长期定位：

```text
legacy facade
```

规则：

1. 不再继续承载新增训练业务。
2. 不再新增 `startProblem` / `submitProblemAttempt` 这类训练用例。
3. 旧 API 通过 `legacySabakiAdapter` 包装。
4. 新训练逻辑走 `training/*` 下的 Service。

### 过渡策略

短期可以保留旧函数，但改为代理：

```ts
sabaki.startProblem = problemId => {
  return trainingServices.workbenchTabService.openProblemTab(problemId)
}
```

最终应把业务逻辑移出 `sabaki.js`。

## 3.2 documentStore

### 定位

棋谱 / 棋盘事实源。

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
Problem
Review
```

### 训练模块如何使用

MVP 中训练模块优先通过 `positionSnapshotAdapter` 捕获局面。落子仍可走现有 document / workbench play executor；等出现第二个明确消费者后再抽 `boardCommandAdapter`。

```text
positionSnapshotAdapter
boardCommandAdapter      # 后置
sgfAdapter               # 后置
```

禁止：

```text
documentStore → training
```

## 3.3 engineService / enginesyncer

### 定位

引擎生命周期和 GTP 能力层。

负责：

```text
启动 / 停止引擎
GTP 命令
KataGo 分析请求
引擎同步
```

不负责：

```text
BadMove
Problem
Attempt
PassRule
RecallCheckpoint
```

### 训练模块如何使用

训练模块通过：

```text
analysisResultAdapter
engineAnalysisAdapter    # 后置
```

读取 normalized analysis result。

禁止：

```text
engineService → training
engineService → badMove
engineService → problem
```

## 3.4 analysisService

### 定位

AI 分析状态和结果缓存。

负责：

```text
当前局面的分析结果
候选变化
胜率 / 目差 / visits
analysis update 事件
```

不负责：

```text
Problem
Recall
BadMove
PassRule
```

### 训练模块如何使用

通过 `analysisResultAdapter` 转换为稳定接口：

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
```

## 3.5 overlayStore

### 定位

显示层 overlay 状态。

负责：

```text
territory overlay
analysis overlay
hover overlay
board marks / transient visual state
```

不负责：

```text
RecallCheckpoint
BadMove 业务
Problem
Attempt
```

### 训练 overlay 如何实现

新增：

```text
TrainingOverlayViewModel
```

它从：

```text
trainingRuntimeStore
workbenchStore
trainingRepository
```

推导 overlay 显示需求，然后写入或驱动 overlay UI。

禁止：

```text
overlayStore → recallCheckpointService
overlayStore → badMoveService
```

## 3.6 hubStore

### 定位

既有 app-level event / UI hub 状态。训练系统不应把业务事实塞入 hubStore。

可用于：

```text
轻量通知
跨组件事件桥接
legacy UI integration
```

不应用于：

```text
Attempt 状态
BadMove 列表
RecallSession 状态
Review 队列事实
```

## 3.7 db.js

### 定位

底层持久化能力。

规则：

```text
训练业务不要散落直接调用 db.js
统一通过 trainingRepository 访问
```

错误：

```ts
recallService直接 db.prepare(...)
attemptService直接 db.run(...)
problemService直接 db.get(...)
```

正确：

```ts
recallService → trainingRepository.createRecallSession(...)
attemptService → trainingRepository.saveAttempt(...)
problemService → trainingRepository.loadProblem(...)
```

## 3.8 gametree / fileformats

### 定位

SGF / GameTree 底层能力。

MVP 中训练系统通过 `positionSnapshotAdapter` 捕获稳定局面输入；SGF 解析/构造逻辑可以先放在具体 Service 或 helper 中。等 SGF 逻辑出现第二个消费者或明显复杂化后，再抽 `sgfAdapter`。

不应该让多个业务 Service 各自重复实现 SGF 细节。

## 3.9 existing src/modules/workbench

### 定位

现有通用棋盘工作区能力。

它不是训练系统的 `training/workbench`。

规则：

```text
src/modules/workbench = 通用棋盘工作区能力
src/modules/training/workbench = 训练任务工作台能力
```

避免混淆。

## 3.10 existing WorkbenchShell.js

### 定位

当前 UI 外壳 / layout 入口。

短期：

```text
可以继续承载训练 UI
通过 Container 读取 workbenchStore
通过 Controller 调 Service
```

长期：

```text
WorkbenchShell.js 只做布局
TrainingWorkbenchContainer 负责训练业务连接
```

## 3.11 trainingStore.js 当前过渡层

### 当前定位

现在的 `trainingStore.js` 是过渡 facade，主要包装 recall/problem/review 的部分状态。

### v0.4 目标

不要继续膨胀。

应拆为：

```text
workbenchStore
trainingRuntimeStore
recallService
attemptService
reviewService
trainingRepository
```

过渡期可以保留 `trainingStore.js`，但只能做兼容代理。

---

# 4. 新增 Store 设计

## 4.1 Store 总原则

新增训练 Store 最多 2～3 个。

推荐：

```text
workbenchStore
trainingRuntimeStore
reviewQueueStore? optional
```

不要建立：

```text
problemStore
attemptStore
badMoveStore
recallStore
checkpointStore
snapshotStore
branchStore
```

这些应该是：

```text
DB entity + repository + service
```

## 4.2 workbenchStore

### 责任

管理 Tab 列表和 active Tab。

```ts
type WorkbenchStoreState = {
  tabs: WorkbenchTab[]
  activeTabId: string | null
}
```

### 写入者

```text
workbenchTabService
workbenchPhaseService
```

### 读取者

```text
TrainingWorkbenchContainer
TabBarViewModel
PhaseViewModel
```

### API 草案

```ts
type WorkbenchStore = {
  getState(): WorkbenchStoreState
  subscribe(listener: () => void): () => void

  // 只供 Service 调用
  setTabs(tabs: WorkbenchTab[]): void
  addTab(tab: WorkbenchTab): void
  updateTab(tabId: string, patch: Partial<WorkbenchTab>): void
  removeTab(tabId: string): void
  setActiveTab(tabId: string | null): void
}
```

## 4.3 trainingRuntimeStore

### 责任

管理当前训练运行态，不保存完整历史事实。

```ts
type TrainingRuntimeState = {
  activeAttemptId?: string
  activeRecallSessionId?: string
  activeCheckpointId?: string

  pendingMoveEvaluations: Record<string, MoveEvaluation>

  correctionDraft?: {
    checkpointId: string
    moves: string[]
  }

  visibleBadMoveIds: string[]
}
```

### 写入者

```text
attemptService
playTrainingMonitor
recallService
recallCheckpointService
workbenchPhaseService
```

### 读取者

```text
PlayPhaseController
RecallPhaseController
TrainingOverlayViewModel
AnalysisPhaseController
```

### API 草案

```ts
type TrainingRuntimeStore = {
  getState(): TrainingRuntimeState
  subscribe(listener: () => void): () => void

  setActiveAttempt(id?: string): void
  setActiveRecallSession(id?: string): void
  setActiveCheckpoint(id?: string): void

  upsertPendingMoveEvaluation(evaluation: MoveEvaluation): void
  removePendingMoveEvaluation(evaluationId: string): void

  setCorrectionDraft(draft?: {checkpointId: string; moves: string[]}): void
  setVisibleBadMoveIds(ids: string[]): void
}
```

## 4.4 reviewQueueStore，可选

只有当 Review Inbox / 筛选 / 批量操作复杂时才需要。

```ts
type ReviewQueueState = {
  dueItems: ReviewSchedule[]
  selectedItemIds: string[]
  filters: {
    itemType?: 'problem' | 'recall_segment'
    onlyPunishment?: boolean
    dueOnly?: boolean
  }
}
```

MVP 可以先不用独立 store，由 `reviewService.getDueItems()` 直接查询。

---

# 5. 新增 Service 设计

## 5.1 Service 总原则

Service 是业务动作和状态变化入口。

允许：

```text
Service 读写 Store
Service 调 Repository
Service 调 Adapter
Service 调其他下层 Service
```

不允许：

```text
Store 调 Service
UI Component 直接调 Repository
UI Component 直接改业务 Store
Repository 调 UI
```

MVP 的 Service 拆分以“用例边界”而不是“名词边界”为准：

```text
核心 Service：
workbenchTabService
workbenchPhaseService
attemptService
playTrainingMonitor
recallService
recallCheckpointService
problemService
snapshotService
reviewService

纯函数模块：
evaluationRules
```

以下能力初始不单独建 Service：

```text
passRuleEvaluator → evaluationRules.evaluateAttempt
moveEvaluationService → evaluationRules.evaluateMove / classifySeverity
punishmentProblemService → problemService.createPunishmentProblemFromBadMove
reviewScheduler → reviewService 内部 calculateNextSchedule
```

## 5.2 workbenchTabService

### 责任

打开、关闭、切换 Tab。

### API

```ts
type WorkbenchTabService = {
  openGameTab(gameId: string): Promise<WorkbenchTab>
  openProblemTab(problemId: string, options?: {parentTabId?: string}): Promise<WorkbenchTab>
  openSnapshotProblemTab(problemId: string, options: {parentTabId: string}): Promise<WorkbenchTab>
  closeTab(tabId: string): Promise<void>
  switchTab(tabId: string): void
}
```

### 依赖

```text
workbenchStore
trainingRepository
problemService
positionSnapshotAdapter
legacySabakiAdapter
```

### 边界

不负责：

```text
评价坏棋
创建 Recall
生成 punishment problem
更新 Review
```

## 5.3 workbenchPhaseService

### 责任

Tab 内 phase 生命周期编排。它是训练流程的 Phase Orchestrator，也是唯一允许协调多个 Service 完成跨实体状态转换的入口。

Orchestrator 职责：

```text
校验 phase 状态机
调用 attempt / recall / snapshot / review 等 service
在 transaction 成功后更新 workbenchStore / trainingRuntimeStore
把失败转换为可恢复状态和日志
```

合法状态机：

```ts
const VALID_PHASE_TRANSITIONS = {
  play: ['recall'],
  recall: ['analysis', 'play'],
  analysis: ['play'],
}
```

特殊规则：

```text
analysis snapshot 不改变当前 tab.phase，而是创建新 Tab，phase='play'。
非法转换必须 reject / throw，不能静默修正。
```

### API

```ts
type WorkbenchPhaseService = {
  startPlay(tabId: string): Promise<TrainingAttempt>
  submitPlay(tabId: string): Promise<RecallSession>
  enterRecall(tabId: string, attemptId: string): Promise<RecallSession>
  completeRecall(tabId: string, recallSessionId: string): Promise<void>
  enterAnalysis(tabId: string): Promise<void>
  restartPlay(tabId: string): Promise<TrainingAttempt>
  snapshotFromAnalysis(tabId: string, input?: Partial<ProblemSnapshotInput>): Promise<WorkbenchTab>
}
```

### 依赖

```text
workbenchStore
trainingRuntimeStore
attemptService
recallService
snapshotService
workbenchTabService
reviewService
```

### 典型 submitPlay

```text
get active tab
→ get active attempt
→ transaction:
   → attemptService.freezeAttempt
   → evaluationRules.evaluateAttempt
   → recallService.createRecallFromAttempt
   → attemptService.updateStatus('recalling')
→ workbenchStore.updateTab phase='recall'
→ trainingRuntimeStore.setActiveRecallSession
```

## 5.4 attemptService

### 责任

管理一次 Play 作答事实。

### API

```ts
type AttemptService = {
  createAttempt(input: {taskId: string; tabId?: string; rootPositionSgf: string}): Promise<TrainingAttempt>
  appendMove(attemptId: string, move: string): Promise<void>
  freezeAttempt(attemptId: string): Promise<TrainingAttempt>
  saveMoveEvaluation(evaluation: MoveEvaluation): Promise<void>
  saveBadMove(badMove: BadMove): Promise<void>
  finalizeAttemptResult(attemptId: string, result: TrainingAttemptResult): Promise<void>
}
```

### 依赖

```text
trainingRepository
trainingRuntimeStore
positionSnapshotAdapter
```

### 边界

不负责：

```text
直接读 engine
直接判定 AI candidate
直接打开 Tab
```

## 5.5 playTrainingMonitor

### 责任

监听落子和 analysis update，补齐 MoveEvaluation 和 BadMove。

### API

```ts
type PlayTrainingMonitor = {
  startForAttempt(attemptId: string): void
  stopForAttempt(attemptId: string): void
  onUserMove(input: {attemptId: string; moveIndex: number; move: string}): Promise<void>
  onAnalysisUpdated(input: {positionKey: string}): Promise<void>
  failExpiredPendingEvaluations(now?: string): Promise<void>
}
```

### 依赖

```text
attemptService
evaluationRules
analysisResultAdapter
positionSnapshotAdapter
trainingRepository
trainingRuntimeStore
```

### 边界

不负责：

```text
生成 punishment problem
打开 checkpoint UI
更新 review schedule
```

超时规则：

```text
pending MoveEvaluation 超过 30 秒仍没有可用 analysis result：
→ status='failed'
→ 不创建 BadMove
→ Submit 时不把该手作为 pass/fail 决定性依据
```

## 5.6 evaluationRules

### 责任

纯函数模块，计算每手亏损、severity 和 Attempt 最终结果。它不是 Service，不读写 Store / DB / Adapter。

### API

```ts
type EvaluationRules = {
  evaluateMove(input: {
    beforeEval?: NormalizedAnalysisResult
    afterEval?: NormalizedAnalysisResult
    move: string
    moveIndex: number
    passRule?: PassRule
  }): MoveEvaluation

  classifySeverity(input: {
    scoreDrop?: number
    winrateDrop?: number
    passRule?: PassRule
  }): 'none' | 'minor' | 'major' | 'severe'

  evaluateAttempt(input: {
    attempt: TrainingAttempt
    moveEvaluations: MoveEvaluation[]
    badMoves: BadMove[]
    problem?: Problem
  }): TrainingAttemptResult
}
```

### 依赖

```text
无 UI 依赖
无 DB 依赖
无 Store 依赖
```

## 5.7 recallService

### 责任

管理 RecallSession 和 RecallAttempt。

### API

```ts
type RecallService = {
  createRecallFromAttempt(attemptId: string): Promise<RecallSession>
  createRecallFromGame(input: {taskId: string; gameId: string; startMove?: number; endMove?: number}): Promise<RecallSession>
  submitRecallMove(input: {recallSessionId: string; userMove: string}): Promise<RecallAttempt>
  completeRecall(recallSessionId: string): Promise<void>
}
```

### 依赖

```text
trainingRepository
trainingRuntimeStore
recallCheckpointService
```

### 边界

Checkpoint 是子流程，但具体由 `recallCheckpointService` 处理。

## 5.8 recallCheckpointService

### 责任

管理问题手暂停纠错流程。

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

  resumeRecall(checkpointId: string): Promise<void>
}
```

### 依赖

```text
trainingRepository
trainingRuntimeStore
analysisResultAdapter
moveCommentRepository via trainingRepository
```

## 5.9 problemService

### 责任

Problem CRUD 和 Problem → TrainingTask 的辅助创建。

### API

```ts
type ProblemService = {
  createProblem(input: CreateProblemInput): Promise<Problem>
  loadProblem(problemId: string): Promise<Problem>
  updateProblem(problemId: string, patch: Partial<Problem>): Promise<Problem>
  archiveProblem(problemId: string): Promise<void>
  createPunishmentProblemFromBadMove(badMoveId: string): Promise<Problem>
}
```

### 依赖

```text
trainingRepository
analysisResultAdapter
```

### 边界

`createPunishmentProblemFromBadMove` 是 MVP 中的薄 helper，用于创建 `Problem(type='punishment')`。只有当惩罚题生成逻辑增长到需要独立流程、批量去重或独立 UI 时，才拆出 `punishmentProblemService`。

## 5.10 snapshotService

### 责任

从当前 Analysis 局面创建 Problem。

### API

```ts
type SnapshotService = {
  captureSnapshotInput(input: {
    tabId: string
    sourceTaskId: string
    sourceAttemptId?: string
  }): Promise<ProblemSnapshotInput>

  createProblemFromCurrentAnalysisPosition(input: ProblemSnapshotInput): Promise<Problem>
}
```

### 依赖

```text
positionSnapshotAdapter
analysisResultAdapter
problemService
trainingRepository
```

### 边界

不负责打开 Tab。

打开 Tab 由：

```text
workbenchTabService.openSnapshotProblemTab
```

负责。

## 5.11 reviewService

### 责任

Review 队列和调度。MVP 中调度规则作为 `reviewService` 内部纯函数，不单独建 `reviewScheduler`。

### API

```ts
type ReviewService = {
  getDueItems(now?: string): Promise<ReviewSchedule[]>
  openDueItem(itemId: string): Promise<WorkbenchTab>
  updateScheduleAfterResult(input: {
    itemId: string
    itemType: 'problem' | 'recall_segment'
    result: TrainingAttemptResult
  }): Promise<void>
}
```

### 依赖

```text
trainingRepository
workbenchTabService
```

---

# 6. Repository 设计

## 6.1 trainingRepository 定位

`trainingRepository` 是训练相关 DB 的唯一入口。

```text
Services → trainingRepository → db.js
```

禁止 Service 散落直接调用 `db.js`。

## 6.2 Repository API 草案

```ts
type TrainingRepository = {
  // Task
  createTask(task: TrainingTask): Promise<TrainingTask>
  loadTask(taskId: string): Promise<TrainingTask>
  findTaskBySource(source: TrainingTaskSource): Promise<TrainingTask | null>
  updateTask(taskId: string, patch: Partial<TrainingTask>): Promise<void>

  // Attempt
  createAttempt(attempt: TrainingAttempt): Promise<TrainingAttempt>
  loadAttempt(attemptId: string): Promise<TrainingAttempt>
  listAttemptsByTask(taskId: string): Promise<TrainingAttempt[]>
  updateAttempt(attemptId: string, patch: Partial<TrainingAttempt>): Promise<void>

  // MoveEvaluation
  createMoveEvaluation(evaluation: MoveEvaluation): Promise<MoveEvaluation>
  updateMoveEvaluation(evaluationId: string, patch: Partial<MoveEvaluation>): Promise<void>
  listMoveEvaluationsByAttempt(attemptId: string): Promise<MoveEvaluation[]>

  // BadMove
  createBadMove(badMove: BadMove): Promise<BadMove>
  loadBadMove(badMoveId: string): Promise<BadMove>
  listBadMovesByAttempt(attemptId: string): Promise<BadMove[]>
  listBadMovesByTask(taskId: string): Promise<BadMove[]>
  markBadMoveAsNotBad(badMoveId: string): Promise<void>

  // Recall
  createRecallSession(session: RecallSession): Promise<RecallSession>
  loadRecallSession(sessionId: string): Promise<RecallSession>
  updateRecallSession(sessionId: string, patch: Partial<RecallSession>): Promise<void>
  createRecallAttempt(attempt: RecallAttempt): Promise<RecallAttempt>
  listRecallAttempts(sessionId: string): Promise<RecallAttempt[]>

  // Checkpoint
  createRecallCheckpoint(checkpoint: RecallCheckpoint): Promise<RecallCheckpoint>
  loadRecallCheckpoint(checkpointId: string): Promise<RecallCheckpoint>
  updateRecallCheckpoint(checkpointId: string, patch: Partial<RecallCheckpoint>): Promise<void>
  listCheckpointsByRecallSession(sessionId: string): Promise<RecallCheckpoint[]>

  // Problem
  createProblem(problem: Problem): Promise<Problem>
  loadProblem(problemId: string): Promise<Problem>
  updateProblem(problemId: string, patch: Partial<Problem>): Promise<void>

  // Comment
  createMoveComment(comment: MoveComment): Promise<MoveComment>
  loadMoveComment(commentId: string): Promise<MoveComment>
  updateMoveComment(commentId: string, patch: Partial<MoveComment>): Promise<void>

  // Review
  createReviewSchedule(schedule: ReviewSchedule): Promise<ReviewSchedule>
  listDueReviewItems(now: string): Promise<ReviewSchedule[]>
  updateReviewSchedule(id: string, patch: Partial<ReviewSchedule>): Promise<void>

  // Recovery
  listIncompleteAttempts(): Promise<TrainingAttempt[]>
  listIncompleteRecallSessions(): Promise<RecallSession[]>
  listExpiredPendingMoveEvaluations(now: string): Promise<MoveEvaluation[]>

  // Transaction
  transaction<T>(fn: () => Promise<T>): Promise<T>
}
```

## 6.3 原子性和恢复

跨实体写入必须由 `trainingRepository.transaction(...)` 包住，尤其是：

```text
submitPlay：freeze attempt + evaluate result + create recall session
completeRecall：complete recall + update attempt status + update review schedule
snapshot：create problem + create task + open tab 前的持久化
```

应用启动或打开 Training Dashboard 时，应扫描：

```text
status in ('playing', 'submitted', 'recalling', 'analyzing') 的 incomplete attempts
completed = 0 的 recall_sessions
status = 'pending' 且超时的 move_evaluations
```

MVP 可先只把这些记录展示为“继续上次训练 / 清理失败评估”的入口，完整自动恢复 UI 后置。

## 6.4 MVP 表

MVP 必做：

```text
training_tasks
training_attempts
move_evaluations
bad_moves
recall_sessions
recall_attempts
recall_checkpoints
problems
review_schedule
move_comments
```

可选：

```text
workbench_tabs        MVP 可先内存态
```

后续再做：

```text
training_branches
analysis_sessions
reference_lines
user_marks
task_tags
problem_tags
```

---

# 7. Adapter 设计

Adapter 负责把旧 Sabaki 的数据结构转换成训练模块需要的稳定接口。

MVP 必做：

```text
legacySabakiAdapter
positionSnapshotAdapter
analysisResultAdapter
```

后置：

```text
boardCommandAdapter
engineAnalysisAdapter
sgfAdapter
```

## 7.1 legacySabakiAdapter

### 责任

包装 `sabaki.js` legacy API。

```ts
type LegacySabakiAdapter = {
  getCurrentMode(): string
  setLegacyMode(mode: string): void
  getCurrentTreePosition(): string | undefined
  navigateToTreePosition(position: string): void
  notifyLegacyStateChanged(): void
}
```

使用场景：

```text
过渡期需要兼容旧 UI / 旧 mode / 旧事件
```

长期目标：减少使用。

## 7.2 boardCommandAdapter

MVP 后置。只有当 Play / Recall / Analysis 多处都需要统一棋盘命令，并且现有 workbench play executor 无法承载时再实现。

### 责任

封装棋盘命令。

```ts
type BoardCommandAdapter = {
  playMove(move: string): Promise<void>
  undoMove(): Promise<void>
  loadSgf(sgf: string): Promise<void>
  jumpToPosition(treePosition: string): Promise<void>
  getCurrentLegalMoves(): string[]
}
```

底层可能调用：

```text
sabaki.js
documentStore
gametree
```

## 7.3 positionSnapshotAdapter

### 责任

捕获当前局面，生成训练系统需要的稳定输入。

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

## 7.4 analysisResultAdapter

### 责任

把 analysisService / engine result 转换为 normalized result。

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

## 7.5 engineAnalysisAdapter

MVP 后置。当前只读取现有分析结果；当需要主动请求“非当前局面”的独立分析时再实现。

### 责任

请求或确保某个局面有分析。

```ts
type EngineAnalysisAdapter = {
  ensureAnalysisRunning(positionKey: string): Promise<void>
  requestAnalysisForPosition(positionSgf: string): Promise<void>
  stopAnalysisForPosition(positionKey: string): Promise<void>
}
```

## 7.6 sgfAdapter

MVP 后置。当前可在具体 Service/helper 中复用现有 fileformats / gametree 能力；当 SGF 构造逻辑出现第二个消费者时再抽。

### 责任

隔离 SGF / GameTree 操作。

```ts
type SgfAdapter = {
  parseMainLine(sgf: string): string[]
  buildPositionSgf(input: {rootSgf: string; moves: string[]}): string
  extractRootPosition(sgf: string): string
  serializeLineToSgf(input: {rootPositionSgf: string; moves: string[]}): string
}
```

---

# 8. 依赖关系图

## 8.1 命令路径

```text
UI Component
→ Container / Controller
→ Service
→ Store / Repository / Adapter
→ Existing Sabaki Core
```

## 8.2 渲染路径

```text
Store
→ Container / ViewModel
→ UI Component
```

## 8.3 详细依赖图

```text
TrainingWorkbenchContainer
  ├─ reads workbenchStore
  ├─ reads trainingRuntimeStore
  ├─ calls workbenchTabService
  └─ calls workbenchPhaseService

workbenchTabService
  ├─ writes workbenchStore
  ├─ calls trainingRepository
  ├─ calls problemService
  └─ calls legacySabakiAdapter

workbenchPhaseService
  ├─ writes workbenchStore
  ├─ writes trainingRuntimeStore
  ├─ calls attemptService
  ├─ calls recallService
  ├─ calls snapshotService
  ├─ calls workbenchTabService
  └─ calls reviewService

attemptService
  ├─ calls trainingRepository
  ├─ writes trainingRuntimeStore
  └─ calls positionSnapshotAdapter

playTrainingMonitor
  ├─ subscribes analysisResultAdapter
  ├─ calls attemptService
  ├─ calls evaluationRules
  ├─ calls trainingRepository
  └─ writes trainingRuntimeStore

recallService
  ├─ calls trainingRepository
  ├─ calls recallCheckpointService
  └─ writes trainingRuntimeStore

recallCheckpointService
  ├─ calls trainingRepository
  ├─ calls analysisResultAdapter
  └─ writes trainingRuntimeStore

snapshotService
  ├─ calls positionSnapshotAdapter
  ├─ calls analysisResultAdapter
  ├─ calls problemService
  └─ calls trainingRepository

problemService
  └─ calls trainingRepository

reviewService
  ├─ calls trainingRepository
  ├─ calls internal schedule rules
  └─ calls workbenchTabService

trainingRepository
  └─ calls db.js

Adapters
  ├─ call sabaki.js
  ├─ call documentStore
  ├─ call engineService / enginesyncer
  ├─ call analysisService
  └─ call gametree / fileformats
```

## 8.4 禁止反向依赖

禁止：

```text
Store → Service
documentStore → training
engineService → badMove / problem
analysisService → problem / recall
overlayStore → recallCheckpointService
repository → UI
problemService → UI
Component → 直接改业务 Store
```

允许：

```text
Container 读 Store
Container 调 Service
Service 读写 Store
Service 调 Repository
Service 调 Adapter
Adapter 调 legacy Sabaki / documentStore / analysisService / engineService
Store 通知订阅者
```

---

# 9. 命令路径示例

## 9.1 用户下一手棋

```text
User clicks board intersection
→ Board Component emits onPlayMove(move)
→ PlayPhaseController.handlePlayMove(move)
→ existing play executor / documentStore playMove
→ documentStore / gametree append node
→ attemptService.appendMove(activeAttemptId, move)
→ playTrainingMonitor.onUserMove({attemptId, moveIndex, move})
→ positionSnapshotAdapter.capture position hash
→ trainingRepository.createMoveEvaluation(status='pending', position hashes)
→ trainingRuntimeStore.upsertPendingMoveEvaluation
→ existing analysisService schedules analysis
```

analysis update 后：

```text
analysisService emits update
→ analysisResultAdapter subscriber
→ playTrainingMonitor.onAnalysisUpdated(positionKey)
→ analysisResultAdapter.getAnalysisForPosition(before/after)
→ evaluationRules.evaluateMove(...)
→ trainingRepository.updateMoveEvaluation(status='evaluated')
→ if severity != none:
     trainingRepository.createBadMove(...)
     attemptService.saveBadMove(...)
     trainingRuntimeStore.setVisibleBadMoveIds(...)
```

## 9.2 用户点击 Submit

```text
SubmitButton.onClick
→ TrainingWorkbenchContainer.handleSubmit
→ workbenchPhaseService.submitPlay(tabId)
→ workbenchStore.get active tab
→ trainingRepository.transaction:
   → attemptService.freezeAttempt(activeAttemptId)
   → trainingRepository.listMoveEvaluationsByAttempt
   → trainingRepository.listBadMovesByAttempt
   → evaluationRules.evaluateAttempt(...)
   → attemptService.finalizeAttemptResult(...)
   → recallService.createRecallFromAttempt(attemptId)
→ workbenchStore.updateTab({phase:'recall', activeRecallSessionId})
→ trainingRuntimeStore.setActiveRecallSession(recallSessionId)
```

## 9.3 Recall 遇到 BadMove

```text
User submits recall move
→ RecallPhaseController.handleRecallMove(userMove)
→ recallService.submitRecallMove(...)
→ trainingRepository.createRecallAttempt(...)
→ recallCheckpointService.shouldTriggerCheckpoint({recallSessionId, moveIndex})
→ if major/severe BadMove:
     recallCheckpointService.startCheckpoint(...)
     trainingRuntimeStore.setActiveCheckpoint(checkpointId)
     UI enters checkpoint substate
```

用户摆修正图：

```text
User plays correction line
→ RecallCheckpointController records draft
→ trainingRuntimeStore.setCorrectionDraft(...)
→ User submits correction
→ recallCheckpointService.submitUserCorrectionLine(...)
→ trainingRepository.updateRecallCheckpoint(...)
→ recallCheckpointService.revealAiCandidateLines(...)
→ analysisResultAdapter / trainingRepository load candidate lines
→ UI displays original line / correction line / AI lines
```

用户写 comment：

```text
User writes comment
→ recallCheckpointService.saveComment(...)
→ trainingRepository.createMoveComment(...)
→ trainingRepository.updateRecallCheckpoint(status='commented')
→ recallCheckpointService.resumeRecall(...)
→ trainingRuntimeStore.setActiveCheckpoint(undefined)
```

## 9.4 Analysis 中 Snapshot

```text
SnapshotButton.onClick
→ AnalysisPhaseController.handleSnapshot
→ workbenchPhaseService.snapshotFromAnalysis(tabId)
→ snapshotService.captureSnapshotInput({tabId, sourceTaskId, sourceAttemptId})
→ positionSnapshotAdapter.captureCurrentPosition()
→ analysisResultAdapter.getCurrentAnalysis()
→ snapshotService.createProblemFromCurrentAnalysisPosition(input)
→ problemService.createProblem(...)
→ trainingRepository.createProblem(...)
→ trainingRepository.createTask(kind='snapshot_problem')
→ workbenchTabService.openSnapshotProblemTab(problemId, {parentTabId: tabId})
→ workbenchStore.addTab(newTab)
→ workbenchStore.setActiveTab(newTab.id)
```

## 9.5 Review 打开到期题

```text
ReviewInbox item click
→ ReviewQueueContainer.handleOpenDueItem(itemId)
→ reviewService.openDueItem(itemId)
→ trainingRepository.loadReviewSchedule(itemId)
→ if itemType='problem':
     workbenchTabService.openProblemTab(problemId)
→ if itemType='recall_segment':
     workbenchTabService.openRecallSegmentTab(segmentId)
→ new tab phase='play'
```

Review 完成后：

```text
attempt result finalized
→ reviewService.updateScheduleAfterResult(...)
→ reviewService.calculateNextDue(...)
→ trainingRepository.updateReviewSchedule(...)
```

---

# 10. 渲染路径示例

## 10.1 TabBar 渲染

```text
workbenchStore.tabs / activeTabId
→ TabBarViewModel
→ TabBar Component
```

## 10.2 Phase Panel 渲染

```text
workbenchStore.activeTab.phase
+ trainingRuntimeStore.activeAttemptId / activeRecallSessionId / activeCheckpointId
→ TrainingWorkbenchContainer
→ PlayPanel / RecallPanel / AnalysisPanel
```

## 10.3 BadMove List 渲染

```text
activeAttemptId
→ AnalysisPhaseViewModel calls trainingRepository.listBadMovesByAttempt
→ combines with MoveEvaluation
→ BadMoveList Component
```

## 10.4 Training Overlay 渲染

```text
trainingRuntimeStore.visibleBadMoveIds
+ active checkpoint
+ current tree position
→ TrainingOverlayViewModel
→ overlay props / board marks
→ UI Component
```

注意：

```text
overlayStore 不知道 BadMove 业务。
```

---

# 11. 数据模型和表关系

## 11.1 实体关系

```text
TrainingTask 1 - N WorkbenchTab
TrainingTask 1 - N TrainingAttempt
TrainingAttempt 1 - N MoveEvaluation
MoveEvaluation 0/1 - 1 BadMove
TrainingAttempt 1 - 1/N RecallSession
RecallSession 1 - N RecallAttempt
RecallSession 1 - N RecallCheckpoint
BadMove 0/1 - 1 RecallCheckpoint
BadMove 0/1 - 1 PunishmentProblem
Problem 1 - N ReviewSchedule item
ReviewSchedule → Problem / RecallSegment
```

## 11.2 MVP 表

### training_tasks

```sql
CREATE TABLE training_tasks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_game_id TEXT,
  source_problem_id TEXT,
  source_segment_id TEXT,
  parent_task_id TEXT,
  parent_attempt_id TEXT,
  source_json TEXT,
  root_position_sgf TEXT NOT NULL,
  side_to_move TEXT,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### training_attempts

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
  status TEXT NOT NULL,
  result TEXT NOT NULL,
  hint_level_used INTEGER DEFAULT 0,
  recall_completed INTEGER DEFAULT 0,
  analysis_opened INTEGER DEFAULT 0,
  FOREIGN KEY(task_id) REFERENCES training_tasks(id)
);
```

### move_evaluations

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
position_before_sgf / position_after_sgf 只允许关键节点使用；
普通手只保存 hash 和评估结果，避免每手 SGF 膨胀。
```

### bad_moves

```sql
CREATE TABLE bad_moves (
  id TEXT PRIMARY KEY,
  move_evaluation_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  move_index INTEGER NOT NULL,
  severity TEXT NOT NULL,
  punish_side TEXT NOT NULL,
  position_before_sgf TEXT,
  position_after_sgf TEXT,
  user_marked_as_not_bad INTEGER DEFAULT 0,
  generated_problem_id TEXT,
  recall_checkpoint_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(move_evaluation_id) REFERENCES move_evaluations(id),
  FOREIGN KEY(attempt_id) REFERENCES training_attempts(id),
  FOREIGN KEY(task_id) REFERENCES training_tasks(id)
);
```

### recall_sessions

```sql
CREATE TABLE recall_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  tab_id TEXT,
  type TEXT NOT NULL,
  source_json TEXT NOT NULL,
  start_move INTEGER NOT NULL,
  end_move INTEGER,
  expected_moves_json TEXT NOT NULL,
  current_move_index INTEGER NOT NULL,
  completed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(task_id) REFERENCES training_tasks(id)
);
```

### recall_attempts

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

### recall_checkpoints

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

### problems

```sql
CREATE TABLE problems (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  position_sgf TEXT NOT NULL,
  side_to_move TEXT NOT NULL,
  title TEXT,
  position_description TEXT,
  task_goal TEXT,
  reference_lines_json TEXT,
  pass_rule_json TEXT,
  tags_json TEXT,
  difficulty INTEGER,
  status TEXT NOT NULL,
  source_game_id TEXT,
  source_problem_id TEXT,
  source_task_id TEXT,
  source_attempt_id TEXT,
  source_move_index INTEGER,
  parent_problem_id TEXT,
  parent_snapshot_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### review_schedule

```sql
CREATE TABLE review_schedule (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  ease_factor REAL,
  last_result TEXT,
  consecutive_pass_count INTEGER DEFAULT 0,
  total_fail_count INTEGER DEFAULT 0,
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### move_comments

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

## 11.3 可选和后置表

### workbench_tabs，可选

MVP 可先内存态。需要恢复 Tab 时再持久化。

### training_branches，后置

等 Analysis 真的需要 Branch List、跳转、比较、筛选时再引入。

### analysis_sessions，后置

MVP 中 Analysis 可不落表。Snapshot 和 comments 已经能保存关键产物。

### reference_lines，后置

MVP 可先 JSON 存在 Problem / Checkpoint / MoveEvaluation。

### user_marks，后置

用于“不是坏棋”“重点复习”“手动关键点”等用户标记。

---

# 12. 目录结构建议

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
    problem.ts
    review.ts
    comment.ts

  store/
    workbenchStore.ts
    trainingRuntimeStore.ts
    reviewQueueStore.ts        # optional

  repository/
    trainingRepository.ts
    trainingMappers.ts
    migrations/
      001_training_tasks.sql
      002_training_attempts.sql
      003_move_evaluations.sql
      004_bad_moves.sql
      005_recall.sql
      006_problems_review_comments.sql

  workbench/
    workbenchTabService.ts
    workbenchPhaseService.ts
    workbenchUiPolicy.ts

  attempt/
    attemptService.ts
    playTrainingMonitor.ts
    evaluationRules.ts

  recall/
    recallService.ts
    recallCheckpointService.ts

  problem/
    problemService.ts

  analysis/
    snapshotService.ts

  review/
    reviewService.ts

  adapter/
    legacySabakiAdapter.ts
    positionSnapshotAdapter.ts
    analysisResultAdapter.ts
    boardCommandAdapter.ts      # optional, add when needed
    engineAnalysisAdapter.ts    # optional, add when needed
    sgfAdapter.ts               # optional, add when needed

src/components/training/
  TrainingWorkbenchContainer.tsx
  PlayPhaseController.tsx
  RecallPhaseController.tsx
  AnalysisPhaseController.tsx
  ReviewQueueContainer.tsx
  TrainingOverlayViewModel.ts
  panels/
    PlayPanel.tsx
    RecallPanel.tsx
    RecallCheckpointPanel.tsx
    AnalysisPanel.tsx
    BadMoveList.tsx
    SnapshotButton.tsx
```

## 12.1 与现有 workbench 区分

```text
src/modules/workbench
  = 现有通用棋盘工作区能力

src/modules/training/workbench
  = 训练任务工作台业务能力
```

不要把训练 Tab / Phase 逻辑塞进现有 `src/modules/workbench`。

---

# 13. 从当前代码迁移的步骤

## Phase 1：隔离 legacy facade

1. 新建 `legacySabakiAdapter`。
2. 把当前 `sabaki.js` 里训练相关入口包一层 adapter。
3. 明确新代码不再往 `sabaki.js` 增加训练业务。
4. `trainingStore.js` 标记为 transitional facade。

## Phase 2：建立 Task / Tab 骨架

1. 新建 `TrainingTask` 类型。
2. 新建 `WorkbenchTab` 类型。
3. 新建 `workbenchStore`。
4. 新建 `workbenchTabService`。
5. 新建 `workbenchPhaseService`，实现显式 phase transition table。
6. `startProblem(problemId)` 改为：

```text
problemId → Problem Task → WorkbenchTab phase='play'
```

7. 不再把 Problem 作为独立 `mode='problem'`。

## Phase 3：迁移 Attempt

1. 新建 `training_attempts`。
2. 新建 `attemptService`。
3. 旧 `problemAttempt` 字段逐步迁入 `TrainingAttempt`。
4. Play 中落子调用 `attemptService.appendMove`。
5. Submit 调用 `attemptService.freezeAttempt`。

## Phase 4：迁移坏棋检测

1. 新建 `move_evaluations`。
2. 新建 `bad_moves`。
3. 建立 `evaluationRules`。
4. 抽出 `playTrainingMonitor`。
5. 当前 `handleProblemMove` 中的坏棋判断迁移到 monitor。
6. 支持 pending evaluation 和超时 failed。
7. 普通 MoveEvaluation 只保存 position hash，BadMove / Checkpoint 才保存 SGF snapshot。

## Phase 5：迁移 Recall

1. 新建 `recall_sessions` / `recall_attempts`。
2. 新建 `recallService`。
3. 当前 `trainingStore.js` 的 recall 方法迁移到 `recallService`。
4. 新建 `recall_checkpoints`。
5. 新建 `recallCheckpointService`。
6. major/severe BadMove 触发 checkpoint。

## Phase 6：迁移 Snapshot

1. 新建 `snapshotService`。
2. 新建 `positionSnapshotAdapter`。
3. 当前 `createProblemFromSnapshot` 拆成：

```text
snapshotService.createProblemFromCurrentAnalysisPosition
workbenchTabService.openSnapshotProblemTab
```

4. Snapshot 后创建新 Task + 新 Tab。

## Phase 7：迁移 Review

1. 新建 `reviewService`，调度规则先内联为纯函数。
2. Review item 打开时解析成 Problem Task / Recall Segment Task。
3. 不建立 Review 专用棋盘 mode。

## Phase 8：清理 legacy mode

1. 逐步减少 `mode='problem'`。
2. `mode='recall'` 可以短期兼容，但业务判断改用 `tab.phase`。
3. `mode='analysis'` 可以继续映射到 `tab.phase='analysis'`。
4. 最终训练流程不依赖全局 mode。

---

# 14. 禁止事项和架构红线

## 14.1 Store 红线

禁止：

```text
Store 调 Service
Store 调 Repository
Store 调 Adapter
每个实体一个 Store
业务 Component 直接改 Store
```

允许：

```text
Store 保存状态
Store 通知订阅者
Service 写 Store
Container 读 Store
```

## 14.2 Service 红线

禁止：

```text
一个 trainingService 包揽所有训练逻辑
Service 直接操作 UI Component
Service 到处直接 db.js
PlayTrainingMonitor 生成 punishment problem
snapshotService 打开 Tab
problemService 操作 UI
```

## 14.3 Repository 红线

禁止：

```text
Repository 知道 UI
Repository 调 Service
Repository 调 Adapter 做棋盘操作
多个 Service 分散写 db.js
```

Repository 只做：

```text
entity persistence
mapping
query
transaction
```

## 14.4 Adapter 红线

禁止：

```text
Adapter 承载训练业务规则
Adapter 判断 pass/fail
Adapter 生成 BadMove
Adapter 写 ReviewSchedule
```

Adapter 只做：

```text
legacy API 包装
数据格式转换
底层能力隔离
```

## 14.5 Existing Core 红线

禁止：

```text
documentStore 知道 Attempt / BadMove
engineService 知道 Problem / Review
analysisService 知道 RecallCheckpoint
overlayStore 知道训练业务
sabaki.js 继续新增训练业务
```

## 14.6 PRD 实现红线

必须坚持：

```text
Problem 不是独立棋盘 mode
Punishment 不是独立 Tab
Review 不是特殊棋盘模式
Checkpoint 是 Recall 子流程
TrainingTask 是业务任务实体
WorkbenchTab 是 UI 承载容器
Attempt 是核心事实表
MoveEvaluation 和 BadMove 分离
Store 控制在 2～3 个
Phase 转换必须走显式状态机
普通 MoveEvaluation 不保存整份 SGF
```

---

# 15. 最小实现切面建议

如果交给 AI coding agent，第一轮不要让它实现全系统。建议第一轮只做：

```text
1. types/
2. workbenchStore
3. trainingRuntimeStore
4. trainingRepository skeleton
5. workbenchTabService
6. workbenchPhaseService skeleton
7. legacySabakiAdapter skeleton
8. 把 openProblemTab 跑通
```

第二轮做：

```text
1. attemptService
2. training_attempts migration
3. submitPlay skeleton
4. createRecallFromAttempt skeleton
```

第三轮做：

```text
1. evaluationRules
2. playTrainingMonitor
3. move_evaluations / bad_moves
4. pending evaluation + failed timeout
```

第四轮做：

```text
1. recallCheckpointService
2. recall_checkpoints
3. correctionDraft
4. comment 保存
```

第五轮做：

```text
1. snapshotService
2. Snapshot → Problem → Task → Tab
3. reviewService MVP
```

---

# 16. 架构结论

训练系统的长期结构应该是：

```text
TrainingTask = 任务实体
WorkbenchTab = UI 容器
TrainingAttempt = 作答事实
MoveEvaluation = 每手分析事实
BadMove = 问题手事实
RecallSession = 回忆流程
RecallCheckpoint = 问题手纠错流程
Problem = 可复习训练题
ReviewSchedule = 长期调度
```

模块边界应该是：

```text
UI 展示
Container 读 Store / 调 Service
Service 编排业务
Repository 统一存取
Adapter 隔离旧 Sabaki
Existing Core 保持干净
```

最重要的工程纪律是：

```text
不要继续把训练业务塞进 sabaki.js
不要让每个名词变成 Store
不要让 Store 调 Service
不要让旧 document / engine / analysis / overlay 模块知道 training
```
