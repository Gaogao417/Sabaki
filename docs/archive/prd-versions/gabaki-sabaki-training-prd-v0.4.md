# Gabaki / Sabaki 围棋训练系统 PRD v0.4

> 文档类型：产品需求文档  
> 基于：Sabaki/Gabaki 围棋训练系统 PRD v0.3  
> v0.4 核心变化：引入 `TrainingTask`，轻量化 `WorkbenchTab`，明确 `Task / Tab / Attempt / Recall / Analysis / Review` 的边界。  
> 当前目标：跑通个人围棋训练闭环：`Play → Recall → Analysis → Snapshot → Review`。

相关文档：

- [Training Architecture](./gabaki-sabaki-training-architecture.md)
- [Training Implementation Plan](./gabaki-sabaki-training-implementation-plan.md)

---

## 0. v0.4 核心修订

v0.4 保留 v0.3 的产品大方向，但修正工程建模问题。

### 0.1 保留的产品方向

1. 不再把 `Problem Mode` 视为独立棋盘模式。
2. `Problem` 是训练任务来源，不是独立交互系统。
3. 不设置独立 `Punishment Tab`。
4. `Punishment Problem` 仍然作为 `Problem.type = 'punishment'` 进入题库 / Review 队列。
5. 当前流程中的坏棋处理发生在 Recall 阶段。
6. 每个训练任务统一经历：

```text
Play → Recall → Analysis
```

7. Snapshot 的语义是：

```text
Analysis 当前局面 → 新 Problem → 新 Workbench Tab → 从 Play 开始
```

8. 坏棋处理流程是：

```text
用户先摆修正图 → 再看 AI 候选图 → 写 comment → 继续 Recall
```

### 0.2 v0.4 主要优化

1. 引入 `TrainingTask`。
   - `TrainingTask` = 训练任务实体。
   - `WorkbenchTab` = `TrainingTask` 的 UI 承载容器。

2. `WorkbenchTab` 轻量化。
   - Tab 可以关闭。
   - Task 不应该消失。
   - 同一个 Task 可以多次打开。
   - 同一道题可以多次 Attempt。
   - Review 打开的是 Task / Problem，而不是历史 Tab。

3. `Phase` 和 `Attempt.status` 分离。
   - `WorkbenchTab.phase` 表示 UI 当前处于哪个阶段。
   - `TrainingAttempt.status` 表示一次作答生命周期到哪一步。

4. `TrainingAttempt` 成为核心事实表。
   - `MoveEvaluation`、`BadMove` 不塞进 Attempt JSON。
   - 每手评价和坏棋独立建表。

5. `BadMove` 绑定 `MoveEvaluation`。
   - `MoveEvaluation` 记录每手分析和亏损。
   - `BadMove` 只表达“这条 MoveEvaluation 被判定为坏棋”。

6. `RecallCheckpoint` 绑定 `BadMove`。
   - Checkpoint 是 Recall 中的问题手暂停纠错子流程。
   - Checkpoint 不再作为 RecallType。

7. `RecallType` MVP 简化为 `line_recall`。
   - 回忆来源通过 `source` 区分 attempt / game / segment。

8. `TrainingBranchDraft` 后置。
   - MVP 不强制 `training_branches` 表。
   - Analysis 需要 Branch List 时再引入。

9. `PlayTrainingMonitor` 不直接生成 Punishment Problem。
   - 它只负责 MoveEvaluation / BadMove。
   - Punishment Problem 由 Problem 创建能力在 Submit 后、Recall 后或用户确认后生成。

10. Review 不是特殊棋盘模式。
    - Review 是入口 / 队列。
    - Review item 打开后解析成普通 Task，然后继续 `Play → Recall → Analysis`。

11. MVP 实现必须控制工程复杂度。
    - Service 和 Adapter 只为明确边界服务，不按名词机械拆分。
    - 初始实现优先 6～8 个 Service、3 个必要 Adapter。
    - 纯计算逻辑可以先放在同一个 rules 模块，代码量膨胀后再拆。

12. Phase 必须显式状态机化。
    - 合法转换由代码层面约束。
    - 非法转换不得通过 UI 或 Service 静默发生。

13. MoveEvaluation 必须轻量存储。
    - 普通手不存整份 before / after SGF。
    - 只有 BadMove、Checkpoint、Snapshot 等需要复盘定位的节点保存局面快照。

---

# 1. 产品定位

## 1.1 一句话定位

Gabaki / Sabaki 训练系统是一个以“自由作答 / 实战产出 → 主动回忆 → 问题手自我纠错 → AI 复盘 → 派生新题 → 长期复习”为核心的个人围棋训练工作台。

## 1.2 核心价值

系统帮助用户完成四件事：

1. **把每次实战或做题保存为训练材料**  
   不只是保存 SGF，而是保存任务、作答、评价、坏棋、纠错、评论和复习状态。

2. **先训练自我回忆，再看 AI**  
   用户提交后默认进入 Recall，而不是立刻展示 AI 答案。

3. **把坏棋变成主动纠错 checkpoint**  
   用户先自己摆修正图，再看 AI 候选图，再写 comment。

4. **把复盘中的疑问变成新题**  
   Analysis 中的局面可以 Snapshot 成新 Problem，并打开新 Tab 从 Play 重新开始。

## 1.3 当前目标用户

第一阶段服务一个核心用户：

- 有一定围棋基础；
- 会使用 KataGo / AI 复盘；
- 想提高实战训练效率；
- 愿意先自己思考，再看 AI；
- 重视背谱、复盘、纠错、错手惩罚和长期复习；
- 需要一个比普通 Sabaki / KataGo GUI 更贴近个人训练流程的本地训练工具。

## 1.4 第一阶段非目标用户

第一阶段不优先服务：

- 完全不会围棋的新手；
- 只想快速看胜率的人；
- 机构课程系统；
- 云端题库和多人协作；
- 自动生成完整围棋讲解文章；
- 完整能力画像和统计大屏。

---

# 2. 核心设计原则

## 2.1 TrainingTask 是训练任务实体

`TrainingTask` 表示一个可被训练的任务：

```text
一盘棋
一道题
一个 Snapshot 派生题
一个 Recall Segment
```

Task 是业务实体，可以长期存在，可以被重新打开，可以产生多次 Attempt。

## 2.2 WorkbenchTab 是 UI 承载容器

`WorkbenchTab` 只表示当前 UI 打开的训练工作区。

```text
TrainingTask = 要训练什么
WorkbenchTab = 当前 UI 怎么承载这个任务
```

Tab 可以关闭，Task 不应该消失。

## 2.3 所有任务统一走 Play → Recall → Analysis

无论任务来自 Game、Problem、Snapshot Problem 还是 Review，打开后都统一经历：

```text
Play → Recall → Analysis
```

## 2.4 Problem 不是独立棋盘模式

Problem 是一种任务来源，不是一个独立的棋盘交互系统。

错误方向：

```text
mode = problem
```

正确方向：

```text
Task.kind = 'problem'
Tab.phase = 'play' | 'recall' | 'analysis'
```

## 2.5 Punishment Problem 不是 Punishment Tab

坏棋可以生成惩罚题：

```text
BadMove → Problem(type='punishment') → Problem Inbox / Review Queue
```

但当前流程不自动打开 Punishment Tab。未来复习时，它作为普通 Problem Task 打开。

## 2.6 Recall 优先于 Analysis

提交后默认进入 Recall，而不是直接进入 Analysis。

Recall 的目标是训练用户：

```text
我刚才怎么想？
我能不能复现自己的变化？
这手坏在哪里？
我现在能不能先自己修正？
我的修正图和 AI 图差在哪里？
```

## 2.7 Analysis 是自由研究，不污染 Attempt

Play 提交后 Attempt 冻结。Analysis 中的自由摆棋默认属于 exploration，不写回当前 Attempt。

只有用户点击 Snapshot，当前局面才变成新的 Problem / Task。

---

# 3. 核心概念模型

## 3.1 TrainingTask

`TrainingTask` 是训练任务实体，保存任务来源和根局面。

```ts
type TrainingTaskKind =
  | 'game'
  | 'problem'
  | 'snapshot_problem'
  | 'recall_segment'

type TrainingTaskSource =
  | {kind: 'game'; gameId: string}
  | {kind: 'problem'; problemId: string}
  | {kind: 'snapshot_problem'; problemId: string; parentTaskId?: string; parentAttemptId?: string}
  | {kind: 'recall_segment'; segmentId: string; sourceAttemptId?: string; sourceGameId?: string}

type TrainingTask = {
  id: string
  kind: TrainingTaskKind
  source: TrainingTaskSource

  rootPositionSgf: string
  sideToMove?: 'black' | 'white'

  title?: string

  createdAt: string
  updatedAt: string
}
```

### 说明

- Task 是长期实体。
- Tab 关闭后 Task 仍存在。
- 同一个 Task 可以产生多次 Attempt。
- Review 打开的是 Task / Problem，不是历史 Tab。

## 3.2 WorkbenchTab

`WorkbenchTab` 是 UI 容器，只保留 UI 状态和当前运行态引用。

```ts
type WorkbenchPhase = 'play' | 'recall' | 'analysis'

type WorkbenchTab = {
  id: string
  taskId: string

  phase: WorkbenchPhase

  activeAttemptId?: string
  activeRecallSessionId?: string
  activeAnalysisSessionId?: string

  currentTreePosition?: string

  parentTabId?: string
  childTabIds: string[]

  createdAt: string
  updatedAt: string
}
```

### 说明

- `phase` 是当前 UI 处于 Play / Recall / Analysis。
- `activeAttemptId` 指当前正在训练或刚提交的一次 Attempt。
- `activeRecallSessionId` 指当前 Recall。
- `activeAnalysisSessionId` MVP 可暂不落表。
- `currentTreePosition` 是 UI 当前位置，不是业务事实源。

## 3.3 WorkbenchUiPolicy

UI 展示策略由 Task kind + Tab phase 推导。

```ts
type WorkbenchUiPolicy = {
  showProblemBrief: boolean
  showSubmitButton: boolean
  showHintCardDuringPlay: boolean
  showMoveTreeDuringPlay: boolean
  showAnalysisOverlayDuringPlay: boolean
  allowSnapshotInAnalysis: boolean
}
```

示例：

```ts
const gamePlayPolicy: WorkbenchUiPolicy = {
  showProblemBrief: false,
  showSubmitButton: true,
  showHintCardDuringPlay: false,
  showMoveTreeDuringPlay: false,
  showAnalysisOverlayDuringPlay: false,
  allowSnapshotInAnalysis: true
}

const problemPlayPolicy: WorkbenchUiPolicy = {
  showProblemBrief: true,
  showSubmitButton: true,
  showHintCardDuringPlay: true,
  showMoveTreeDuringPlay: false,
  showAnalysisOverlayDuringPlay: false,
  allowSnapshotInAnalysis: true
}
```

## 3.4 TrainingAttempt

`TrainingAttempt` 是一次 Play 阶段的作答 / 实战产出，是核心事实表。

```ts
type TrainingAttemptStatus =
  | 'playing'
  | 'submitted'
  | 'recalling'
  | 'analyzing'
  | 'completed'
  | 'abandoned'

type TrainingAttemptResult =
  | 'pending'
  | 'pass'
  | 'soft_pass'
  | 'fail'
  | 'abandoned'

type TrainingAttempt = {
  id: string
  taskId: string
  tabId?: string

  startedAt: string
  submittedAt?: string
  completedAt?: string

  rootPositionSgf: string
  userLine: string[]

  status: TrainingAttemptStatus
  result: TrainingAttemptResult

  hintLevelUsed: number
  recallCompleted: boolean
  analysisOpened: boolean
}
```

### 说明

- Attempt 只存一次作答的主线和生命周期。
- `MoveEvaluation`、`BadMove`、`RecallSession` 独立存储。
- 回到 Play 再试一次，应创建新 Attempt，不覆盖旧 Attempt。

## 3.5 MoveEvaluation

`MoveEvaluation` 记录每手分析和亏损。

```ts
type MoveEvaluationStatus = 'pending' | 'evaluated' | 'failed'

type MoveEvaluation = {
  id: string
  attemptId: string

  moveIndex: number
  move: string

  positionBeforeHash?: string
  positionAfterHash?: string

  // 仅对 BadMove / Checkpoint / Snapshot 等关键节点保存。
  positionBeforeSgf?: string
  positionAfterSgf?: string

  beforeScoreLead?: number
  afterScoreLead?: number
  scoreDrop?: number

  beforeWinrate?: number
  afterWinrate?: number
  winrateDrop?: number

  engineSuggestedMove?: string
  engineSuggestedLine?: string[]

  status: MoveEvaluationStatus

  createdAt: string
  evaluatedAt?: string
}
```

### 说明

- 引擎分析异步时，先创建 `pending`。
- analysis update 到来后补算并改成 `evaluated`。
- 普通 MoveEvaluation 只保存 `moveIndex`、`move`、position hash 和评估结果。
- `positionBeforeSgf` / `positionAfterSgf` 只允许用于 BadMove、Checkpoint、Snapshot 等关键节点，避免每手保存 SGF 导致训练库膨胀。

## 3.6 BadMove

`BadMove` 表示某条 `MoveEvaluation` 被判定为坏棋。

```ts
type BadMoveSeverity = 'minor' | 'major' | 'severe'

type BadMove = {
  id: string
  moveEvaluationId: string
  attemptId: string
  taskId: string

  moveIndex: number
  severity: BadMoveSeverity

  punishSide: 'black' | 'white'

  userMarkedAsNotBad?: boolean

  generatedProblemId?: string
  recallCheckpointId?: string

  createdAt: string
}
```

### 说明

- `BadMove` 默认不重复保存整份 `positionBeforeSgf` / `positionAfterSgf`。
- 需要局面时优先通过 `moveEvaluationId` 查 `MoveEvaluation` 的 hash 并从任务主线重建。
- 如果该坏棋进入 Checkpoint 或 Punishment Problem，可在关联实体中保存必要 SGF snapshot。
- 如果未来为性能冗余，也只能有限冗余 `moveIndex / severity / taskId` 这类索引字段。

## 3.7 RecallSession

MVP 简化 RecallType，只用 `line_recall`。

```ts
type RecallSource =
  | {kind: 'attempt'; attemptId: string}
  | {kind: 'game'; gameId: string; startMove?: number; endMove?: number}
  | {kind: 'segment'; segmentId: string}

type RecallSession = {
  id: string
  taskId: string
  tabId?: string

  type: 'line_recall'
  source: RecallSource

  startMove: number
  endMove?: number

  expectedMoves: string[]
  currentMoveIndex: number

  completed: boolean

  createdAt: string
  completedAt?: string
}
```

### 说明

- RecallSession = 回忆一条线。
- Checkpoint = RecallSession 中遇到问题手时的子流程。
- `bad_move_checkpoint` 不再作为 RecallType。

## 3.8 RecallAttempt

```ts
type RecallAttempt = {
  id: string
  recallSessionId: string

  moveNumber: number
  expectedMove: string
  userMove: string

  isCorrect: boolean
  hintLevelUsed: number

  createdAt: string
}
```

## 3.9 RecallCheckpoint

`RecallCheckpoint` 绑定 `BadMove`。

```ts
type RecallCheckpointStatus =
  | 'pending_correction'
  | 'ai_revealed'
  | 'commented'
  | 'skipped'

type ReferenceLine = {
  id?: string
  label: string
  moves: string[]
  source: 'engine' | 'user' | 'game' | 'manual'
  scoreLead?: number
  winrate?: number
}

type RecallCheckpoint = {
  id: string
  recallSessionId: string
  badMoveId: string

  status: RecallCheckpointStatus

  userCorrectionLine: string[]
  aiCandidateLines: ReferenceLine[]

  userCommentId?: string

  createdAt: string
  completedAt?: string
}
```

### 说明

- 原变化来自 `TrainingAttempt.userLine`。
- AI 推荐来自 `MoveEvaluation.engineSuggestedLine` 或 checkpoint 的 `aiCandidateLines`。
- 用户修正图存在 `userCorrectionLine`。
- comment 独立存在 `MoveComment`。

## 3.10 Problem

```ts
type ProblemType =
  | 'best_move'
  | 'direction_judgement'
  | 'local_fight'
  | 'life_and_death'
  | 'tesuji'
  | 'endgame'
  | 'shape'
  | 'punishment'
  | 'review_memory'

type PassRule = {
  scoreDropThreshold?: number
  severeDropThreshold?: number
  winrateDropThreshold?: number

  maxBadMoveCount?: number
  requireNoSevereBadMove: boolean

  compareWithReference: boolean
  referenceScoreDropThreshold?: number

  targetDescription?: string
}

type Problem = {
  id: string

  type: ProblemType

  positionSgf: string
  sideToMove: 'black' | 'white'

  title?: string
  positionDescription: string
  taskGoal: string

  referenceLines: ReferenceLine[]
  passRule: PassRule

  tags: string[]
  difficulty?: 1 | 2 | 3 | 4 | 5

  status: 'inbox' | 'active' | 'archived'

  sourceGameId?: string
  sourceProblemId?: string
  sourceTaskId?: string
  sourceAttemptId?: string
  sourceMoveIndex?: number

  parentProblemId?: string
  parentSnapshotReason?: string

  createdAt: string
  updatedAt: string
}
```

## 3.11 MoveComment

```ts
type MoveCommentTarget =
  | {kind: 'bad_move'; badMoveId: string}
  | {kind: 'checkpoint'; checkpointId: string}
  | {kind: 'move_evaluation'; moveEvaluationId: string}
  | {kind: 'position'; positionHash: string; positionSgf?: string}

type MoveComment = {
  id: string
  target: MoveCommentTarget

  content: string

  templateAnswers?: {
    originalBadBecause?: string
    correctionBetterBecause?: string
    diffWithAi?: string
    keyConflict?: string
    futureRule?: string
  }

  createdAt: string
  updatedAt: string
}
```

## 3.12 ReviewSchedule

```ts
type ReviewItemType = 'problem' | 'recall_segment'

type ReviewSchedule = {
  id: string

  itemId: string
  itemType: ReviewItemType

  dueAt: string
  intervalDays: number

  easeFactor?: number
  lastResult?: 'pass' | 'soft_pass' | 'fail' | 'abandoned'

  consecutivePassCount: number
  totalFailCount: number

  lastReviewedAt?: string
  createdAt: string
  updatedAt: string
}
```

---

# 4. TrainingTask / WorkbenchTab / Phase / Attempt 的关系

## 4.1 核心关系

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
ReviewSchedule → Problem / RecallSegment
```

## 4.2 Phase 与 Attempt.status 的区别

```text
WorkbenchTab.phase = UI 当前在哪
TrainingAttempt.status = 一次作答生命周期在哪
```

示例：

```text
用户做题中：
  tab.phase = play
  attempt.status = playing

用户点击 Submit：
  tab.phase = recall
  attempt.status = recalling

用户完成 Recall 进入 Analysis：
  tab.phase = analysis
  attempt.status = analyzing 或 completed

用户回到 Play 再做一次：
  tab.phase = play
  oldAttempt.status = completed
  newAttempt.status = playing
```

## 4.3 为什么不能让 Tab 承担全部业务含义

如果 Tab 既保存 source，又保存 rootPosition，又保存 attemptIds，又保存 recallSession，又保存 analysisSession，它会变成混合体：

```text
UI 状态 + 业务实体 + 训练事实 + 持久化实体
```

这会造成几个问题：

1. Tab 关闭后数据归属不清。
2. Review 重新打开时无法判断是复用旧 Tab 还是新建任务。
3. 同一道题多次 Attempt 会和 Tab 生命周期纠缠。
4. Snapshot 派生关系会混在 UI 层。

因此 v0.4 明确：

```text
TrainingTask 承担业务身份
WorkbenchTab 承担 UI 容器
TrainingAttempt 承担一次作答事实
```

## 4.4 Phase 状态机

`WorkbenchTab.phase` 必须通过显式状态机转换。

```text
play     -- submit   --> recall
recall   -- complete --> analysis
recall   -- restart  --> play
analysis -- restart  --> play
analysis -- snapshot --> 新 Tab: play
```

MVP 禁止以下隐式转换：

```text
play → analysis
play → play 覆盖当前 Attempt
recall → analysis 但 RecallSession 未完成且未显式跳过
snapshot 后复用当前 Tab 作为新题
```

如果业务需要新增转换，必须先更新状态机表和测试，再接 UI。

---

# 5. Play → Recall → Analysis 工作流

## 5.1 总览

```text
打开 Task
→ 创建 / 激活 WorkbenchTab
→ phase = Play
→ 用户自由下棋 / 做题
→ 后台分析和坏棋监测
→ 用户 Submit
→ 冻结 Attempt
→ phase = Recall
→ 用户回忆自己的变化
→ 遇到 major/severe BadMove 进入 Checkpoint
→ 用户先摆修正图
→ 系统展示 AI 候选图
→ 用户写 comment
→ 继续 Recall
→ Recall 完成
→ phase = Analysis
→ 用户看 AI、看坏棋、自由摆棋
→ Snapshot 当前局面
→ 创建新 Problem + 新 TrainingTask + 新 WorkbenchTab
→ 新 Tab 从 Play 开始
```

## 5.2 状态流

```text
TrainingTask: 持续存在
WorkbenchTab: play → recall → analysis
TrainingAttempt: playing → submitted → recalling → analyzing/completed
MoveEvaluation: pending → evaluated/failed
BadMove: created → checkpointed? → punishmentProblemGenerated?
RecallSession: active → completed
RecallCheckpoint: pending_correction → ai_revealed → commented/skipped
```

---

# 6. Game Task 流程

## 6.1 打开 Game Task

```text
选择一盘棋 / 当前对局 / 续弈局面
→ 创建 TrainingTask(kind='game')
→ 打开 WorkbenchTab
→ tab.phase = play
→ 创建 TrainingAttempt
```

## 6.2 Play

用户可以：

- 下完整盘；
- 从某个局面续弈；
- 自由产生自己的实战线。

后台：

- engine analysis running；
- analysis overlay 默认不可见；
- PlayTrainingMonitor 记录 MoveEvaluation；
- 检测 BadMove 但默认不实时打断。

## 6.3 Submit

```text
用户提交 / 对局结束
→ freeze Attempt
→ 进入 Recall
```

## 6.4 Recall

用户回忆实战线或关键片段。遇到 major/severe BadMove 时暂停，进入 checkpoint。

## 6.5 Analysis

用户查看：

- bad move list；
- AI candidate lines；
- 用户原变化；
- Recall comments；
- 自由摆棋。

可 Snapshot 派生 Problem。

---

# 7. Problem Task 流程

## 7.1 打开 Problem Task

```text
选择 Problem
→ 创建 / 读取 TrainingTask(kind='problem')
→ 打开 WorkbenchTab
→ tab.phase = play
→ 创建 TrainingAttempt
```

## 7.2 Play

用户阅读题目说明，自由摆出答案变化。

Problem Task 的 UI 策略：

```text
showProblemBrief = true
showSubmitButton = true
showHintCardDuringPlay = true
showMoveTreeDuringPlay = false
showAnalysisOverlayDuringPlay = false
```

## 7.3 Submit

提交后：

```text
冻结 userLine
补齐 pending MoveEvaluation
根据 passRule 初步判断
进入 Recall
```

## 7.4 Recall Checkpoint

遇到 major/severe BadMove：

```text
暂停 Recall
→ 用户先摆更好图
→ 提交修正图
→ 展示 AI 候选图 / 用户原图 / 用户修正图
→ 用户写 comment
→ 保存 checkpoint
→ 继续 Recall
```

## 7.5 Analysis

用户查看 AI 评价，自由摆棋，并可 Snapshot 成新题。

---

# 8. Review 流程

## 8.1 Review 的定位

Review 不是棋盘模式，也不是独立 Tab 类型。

```text
Review = 入口 / 队列
```

Review item 被打开后，应解析为：

```text
Problem Task
或 Recall Segment Task
```

然后继续普通流程：

```text
Play → Recall → Analysis
```

## 8.2 Review 来源

Review item 可以来自：

1. 普通 Problem；
2. Punishment Problem；
3. 最近失败的 Attempt；
4. 未完成或 skipped 的 RecallCheckpoint；
5. 用户手动加入重点复习的题。

## 8.3 Review 更新规则 MVP

```text
fail / abandoned：1 天后
soft_pass：3 天后
pass：7 天后
连续 pass：14 / 30 天后
```

后续可以引入 SM-2 或更细策略。

---

# 9. Play 阶段需求

## 9.1 目标

Play 阶段让用户在不被 AI 答案打断的情况下，完整表达自己的实战或做题变化。

## 9.2 行为

Play 阶段中：

- 用户可以自由落子；
- 系统后台分析；
- 系统记录每手评价；
- 系统记录 bad move；
- AI overlay 默认关闭；
- 用户主动点击 Submit 后进入 Recall。

## 9.3 分析开关拆分

必须拆分：

```ts
type PlayAnalysisRuntimeFlags = {
  analysisRunning: boolean
  analysisVisible: boolean
  trainingMonitorEnabled: boolean
  hintCardVisible: boolean
}
```

Game Task Play：

```ts
{
  analysisRunning: true,
  analysisVisible: false,
  trainingMonitorEnabled: true,
  hintCardVisible: false
}
```

Problem Task Play：

```ts
{
  analysisRunning: true,
  analysisVisible: false,
  trainingMonitorEnabled: true,
  hintCardVisible: true
}
```

Analysis Phase：

```ts
{
  analysisRunning: true,
  analysisVisible: true,
  trainingMonitorEnabled: false,
  hintCardVisible: false
}
```

---

# 10. 实时坏棋检测

## 10.1 核心原则

坏棋检测属于完整 Play 系统，不属于 Problem 专用逻辑。

统一模块：

```text
PlayTrainingMonitor
```

它在 Game Task 和 Problem Task 中都启用，只是 UI 展示策略不同。

## 10.2 检测流程

```text
用户落子
→ document / gametree append node
→ attemptService.appendMove
→ playTrainingMonitor 创建 pending MoveEvaluation
→ engine / analysis 后台分析
→ analysis update 到来
→ playTrainingMonitor 调 evaluationRules
→ MoveEvaluation pending → evaluated
→ 若达到阈值，创建 BadMove
→ UI 根据 policy 决定是否提示
```

## 10.3 异步分析策略

引擎分析是异步的，不应因为当前没有 analysis 结果就跳过检测。

MVP 策略：

```text
允许用户继续下
先记录 pending MoveEvaluation
analysis update 到来后补算 scoreDrop / winrateDrop
超过超时时间仍无结果，则标记 failed
```

默认超时：

```text
pending MoveEvaluation 超过 30 秒没有可用 analysis result：
→ status = failed
→ 不创建 BadMove
→ Submit 时该手不作为 pass/fail 的决定性依据
→ UI 可显示“评估失败，可稍后重试”
```

后续可以按引擎配置、访问次数、局面复杂度调整超时时间。

## 10.4 阈值 MVP

```text
minor：亏 2 目以上
major：亏 5 目以上
severe：亏 8 目以上
```

Problem 的 `passRule` 可以覆盖默认阈值。

## 10.5 PlayTrainingMonitor 的边界

它只负责：

```text
pending MoveEvaluation
evaluated MoveEvaluation
BadMove
必要时 basic branch draft
```

它不负责：

```text
生成 punishment problem
打开新 Tab
写 Review Schedule
展示 UI
```

Punishment Problem 由 Problem 创建能力在 Submit 后、Recall 后或用户确认后生成。MVP 可以将该能力放入 `problemService.createPunishmentProblemFromBadMove(...)`，等逻辑变复杂后再拆独立服务。

---

# 11. Submit / Pass Rule

## 11.1 Submit 行为

用户在 Play 阶段可以随时 Submit。

提交后：

```text
1. 冻结当前 userLine
2. Attempt.status = submitted / recalling
3. 等待或补齐关键 MoveEvaluation
4. 初步计算 result = pending / pass / soft_pass / fail
5. 创建 RecallSession
6. tab.phase = recall
```

## 11.2 结果类型

```text
pass：变化基本成立
soft_pass：整体可下，但有小损或不简明
fail：出现明显坏棋，或终点明显低于参考变化
abandoned：用户投降 / 做不下去了
pending：评价未完成
```

## 11.3 PassRule

```ts
type PassRule = {
  scoreDropThreshold?: number
  severeDropThreshold?: number
  winrateDropThreshold?: number

  maxBadMoveCount?: number
  requireNoSevereBadMove: boolean

  compareWithReference: boolean
  referenceScoreDropThreshold?: number

  targetDescription?: string
}
```

## 11.4 PassRuleEvaluator

```ts
type PassRuleEvaluator = {
  evaluateAttempt(input: {
    attempt: TrainingAttempt
    moveEvaluations: MoveEvaluation[]
    badMoves: BadMove[]
    problem?: Problem
  }): TrainingAttemptResult
}
```

---

# 12. Recall 阶段需求

## 12.1 目标

Recall 是用户提交后的主动回忆与自我纠错阶段。

它不是简单看答案，也不只是背谱，而是训练用户：

- 复现自己的变化；
- 解释自己的判断；
- 在问题手处先自己修正；
- 再对比 AI 图；
- 用围棋语言 comment 自己的错误。

## 12.2 RecallSession MVP

MVP 统一为：

```ts
type RecallType = 'line_recall'
```

通过 `source` 区分：

```text
attempt line
game line
segment line
```

## 12.3 Recall 行为

```text
创建 RecallSession
→ expectedMoves 来自 attempt.userLine / game main line / segment
→ 用户逐手回忆
→ 每手生成 RecallAttempt
→ 如果当前 moveIndex 命中 major/severe BadMove
→ 触发 RecallCheckpoint
→ Checkpoint 完成后继续 Recall
→ expectedMoves 完成
→ RecallSession.completed = true
```

---

# 13. Recall Checkpoint

## 13.1 触发条件

MVP 只对 major / severe bad move 触发。

```text
currentMoveIndex 对应 BadMove
并且 severity ∈ ['major', 'severe']
```

后续可以增加：

- 用户手动标记“这里停一下”；
- 系统识别关键转折点；
- skipped checkpoint 进入 Review。

## 13.2 Checkpoint 流程

```text
A. 系统暂停 Recall
   “这里是你刚才变化中损失较大的地方。”

B. 用户不看 AI 答案，先摆出自己认为更好的变化

C. 用户提交修正图

D. 系统展示 AI 候选图
   - AI 主推荐
   - AI 次选
   - 用户原变化
   - 用户修正图

E. 用户写 comment
   - 我的原图坏在哪里？
   - 我的修正图和 AI 图差在哪里？
   - 这个局面的关键词是什么？
   - 我下次应该记住什么？

F. 保存 checkpoint

G. 继续下一手 Recall
```

## 13.3 Comment 模板

用户 comment 至少回答 1～2 项：

```text
1. 我原来的图坏在哪里？
2. 我的修正图比原图好在哪里？
3. 我的修正图和 AI 推荐图差在哪里？
4. 这个局面的核心矛盾是什么？
5. 这手以后我应该记住的判断规则是什么？
```

## 13.4 降低成本策略

允许：

```text
quick comment
模板填空
暂时 skipped
之后进入 Review 提醒
```

---

# 14. Analysis 阶段需求

## 14.1 目标

Analysis 是自由研究、AI 对比和新问题派生阶段。

## 14.2 功能

Analysis 中应支持：

```text
Main Board
Move Tree
AI Eval Panel
Bad Move List
Reference Lines
Recall Comments
Snapshot Button
自由摆棋 / Edit Position
```

## 14.3 行为边界

Analysis 中自由摆棋默认不算入当前 Attempt。

如果用户在 Analysis 中发现新问题，应点击 Snapshot：

```text
当前局面 → 新 Problem → 新 TrainingTask → 新 WorkbenchTab → phase = Play
```

## 14.4 TrainingBranch 后置

MVP 不强制 `training_branches` 表。

Analysis 中展示材料可以先由以下数据组装：

```text
attempt.userLine
moveEvaluation.engineSuggestedLine
recallCheckpoint.userCorrectionLine
recallCheckpoint.aiCandidateLines
move_comments
```

等需要完整 Branch List、跳转、比较、筛选时，再引入 `TrainingBranch`。

---

# 15. Snapshot

## 15.1 目标

Snapshot 是从当前 Analysis 局面派生新训练任务的动作。

## 15.2 行为

用户点击 Snapshot 后：

```text
1. 捕获当前局面
2. 保存为 Problem
3. 记录来源 task / attempt / moveIndex
4. 填写或生成 positionDescription
5. 填写 taskGoal
6. 创建 TrainingTask(kind='snapshot_problem')
7. 打开新 WorkbenchTab
8. 新 Tab phase = Play
```

## 15.3 SnapshotInput

```ts
type ProblemSnapshotInput = {
  sourceTaskId: string
  sourceAttemptId?: string
  sourceGameId?: string
  sourceProblemId?: string
  sourceMoveIndex?: number

  positionSgf: string
  sideToMove: 'black' | 'white'

  currentLine?: string[]
  referenceLines?: ReferenceLine[]

  snapshotReason?: string
}
```

## 15.4 服务边界

```text
snapshotService：负责从当前 Analysis 位置创建 Problem
workbenchTabService：负责打开新 Tab
```

不要让 `snapshotService` 直接操作 UI Tab。

---

# 16. Problem / Punishment Problem

## 16.1 Problem 定位

Problem 是训练任务来源之一。打开 Problem 时，系统创建或读取 `TrainingTask(kind='problem')`，再打开 Tab。

## 16.2 Punishment Problem

Punishment Problem 是 Problem 的一种类型：

```ts
type PunishmentProblemMeta = {
  parentAttemptId: string
  badMoveId: string
  badMove: string
  punishSide: 'black' | 'white'
  punishMove?: string
}
```

生成关系：

```text
BadMove → problemService.createPunishmentProblemFromBadMove → Problem(type='punishment') → ReviewSchedule
```

## 16.3 不自动打开 Punishment Tab

当前流程中，坏棋处理发生在 Recall Checkpoint。Punishment Problem 进入题库 / Review，不强行打断当前流程。

---

# 17. Review

## 17.1 Review 入口

Review 页面 / 队列展示到期题。

```text
reviewService.getDueItems()
```

用户打开某个 Review item：

```text
reviewService.openDueItem(item)
→ 解析为 Problem Task 或 Recall Segment Task
→ workbenchTabService.openProblemTab / openRecallSegmentTab
```

## 17.2 调度更新

在以下时机更新：

```text
Attempt completed
Recall completed
Checkpoint skipped/commented
Analysis closed 或用户确认完成
```

MVP 可以在 `completeRecall` 或 `finalizeAttemptResult` 后更新。

---

# 18. MVP 范围

## 18.1 MVP 目标

跑通最短闭环：

```text
Problem Task
→ Play 自由作答
→ Submit
→ Recall 回忆作答线
→ 遇到 major/severe BadMove 进入 Checkpoint
→ 用户摆修正图 + comment
→ Analysis 查看 AI 图
→ Snapshot 创建新 Problem Task + 新 Tab
```

同时支持 Game Task：

```text
Game Task
→ Play 对局 / 续弈
→ Submit
→ Recall 回忆实战线
→ Analysis 复盘
→ Snapshot 出题
```

## 18.2 MVP 必做

### A. TrainingTask / WorkbenchTab

- 支持创建 Game Task；
- 支持创建 Problem Task；
- 支持 Snapshot Problem Task；
- 支持 Tab phase 切换；
- `workbench_tabs` 可先内存态。

### B. Play Phase

- 支持自由落子；
- 支持后台分析；
- 支持 Submit；
- 支持记录 Attempt；
- 支持记录 MoveEvaluation；
- 支持记录 BadMove。

### C. Recall Phase

- 支持回忆 attempt line；
- 支持回忆 game line；
- 支持 major/severe BadMove 暂停；
- 支持用户摆 correction line；
- 支持展示 AI candidate lines；
- 支持用户写 comment；
- 支持继续 Recall。

### D. Analysis Phase

- 支持查看 bad move；
- 支持查看 AI 候选变化；
- 支持自由摆棋；
- 支持 Snapshot。

### E. Review

- 支持读取到期 Problem；
- Punishment Problem 作为普通 Problem 打开；
- 根据结果更新复习时间。

---

# 19. 暂不做范围

MVP 暂不做：

```text
云同步
社区题库
多人协作
复杂能力画像
自动长文讲解
复杂 ownership / 厚薄 / 死活状态判断
完整 SM-2
复杂 Tab 恢复
复杂标签体系
统计大屏
训练分支可视化大系统
完整 analysis_sessions
复杂 reference_lines 独立管理
```

---

# 20. 验收标准

## 20.1 Task / Tab / Phase

- 可以创建 Problem Task；
- 可以打开 Problem Tab；
- Tab 初始进入 Play；
- 用户提交后进入 Recall；
- Recall 完成后可以进入 Analysis；
- Analysis 中 Snapshot 可以创建新 Problem、TrainingTask，并打开新 Tab；
- 新 Tab 从 Play 开始。

## 20.2 Play

- 用户可以自由下变化；
- 系统后台分析；
- AI overlay 默认不显示；
- 系统可以记录 MoveEvaluation；
- 系统可以检测 BadMove；
- 用户可以 Submit；
- Submit 后当前 Attempt 被冻结保存。

## 20.3 Recall

- Recall 可以复现用户刚才提交的变化；
- 遇到 major/severe BadMove 时暂停；
- 用户可以先摆 correction line；
- 系统随后展示 AI candidate lines；
- 用户可以写 comment；
- comment 保存后继续下一手 Recall。

## 20.4 Analysis

- 用户可以看到当前 Attempt 的 BadMove；
- 用户可以看到 AI candidate lines；
- 用户可以看到 Recall comments；
- 用户可以自由摆棋；
- 用户可以从当前局面 Snapshot；
- Snapshot 后创建新 Problem Task 和新 Tab。

## 20.5 Punishment Problem

- BadMove 可以生成 `Problem.type = 'punishment'`；
- Punishment Problem 进入题库 / Review；
- 当前流程不会自动打开 Punishment Tab；
- Review 打开时作为普通 Problem Task 处理。

## 20.6 Review

- 系统能展示到期题；
- 用户完成 Review 后更新下次复习时间；
- 做错题更快再次出现；
- 通过题延长复习间隔。

---

# 21. 风险与应对

## 21.1 Task / Tab 状态复杂

风险：Task 和 Tab 分离后，状态模型变复杂。

应对：

```text
MVP 中 workbench_tabs 可先只做内存态；
只持久化 Task / Attempt / Recall / BadMove / Comment / Problem / Review。
```

## 21.2 Recall Checkpoint 打断过多

风险：每个 bad move 都 checkpoint，会导致 Recall 太重。

应对：

```text
MVP 只对 major / severe 触发；
minor 只记录，不暂停。
```

## 21.3 Comment 成本高

风险：用户不愿意每次写长 comment。

应对：

```text
允许 quick comment；
提供模板；
允许 skipped；
skipped checkpoint 进入 Review 提醒。
```

## 21.4 AI 目差波动误判

风险：布局或复杂战斗中，scoreDrop 不一定代表真正坏棋。

应对：

```text
MVP 接受粗糙判断；
支持用户标记“不是坏棋”；
后续引入 winrate、ownership、棋块状态、阶段判断。
```

## 21.5 Analysis 污染 Attempt

风险：复盘探索线和作答线混在一起。

应对：

```text
Play 提交后 Attempt 冻结；
Analysis 中的新摆法默认属于 exploration；
只有 Snapshot 才创建新 Problem / Task。
```

## 21.6 Service 过度膨胀

风险：所有逻辑都塞进一个 `trainingService`，或反过来为每个名词都创建一个 Service，导致单人开发维护成本过高。

应对：

```text
按用例拆 service，但 MVP 控制在 6～8 个；
纯计算规则先合并为 evaluationRules / review rules；
薄服务少于约 50 行且只有一个 caller 时先内联；
按事实拆 table；
store 控制在 2～3 个。
```

## 21.7 MoveEvaluation 存储膨胀

风险：每手保存 before / after SGF 会让训练库随棋局数量快速膨胀，影响 SQLite 查询和备份。

应对：

```text
普通手只保存 moveIndex、move、position hash 和评估结果；
BadMove / Checkpoint / Snapshot 等关键节点才保存 SGF snapshot；
需要普通局面时，从 TrainingTask root + Attempt userLine 重建。
```

## 21.8 Phase 状态污染

风险：如果 phase 转换只是散落在 UI 事件中，可能出现 Attempt 未冻结就进入 Analysis、Recall 未结束就 Snapshot 等异常状态。

应对：

```text
workbenchPhaseService 作为唯一 Phase Orchestrator；
所有 phase 转换走显式 transition table；
非法转换直接拒绝并记录日志；
Phase 状态机必须有 table-driven 单元测试。
```

## 21.9 异常恢复不足

风险：应用崩溃、引擎分析失败或持久化中断会留下 incomplete attempt / recall / pending evaluation。

应对：

```text
关键写入用 SQLite transaction；
pending MoveEvaluation 超时后标记 failed；
启动时扫描 incomplete Attempt / RecallSession；
Dashboard 提供“继续上次训练”入口，完整恢复 UI 可后置。
```

---

# 22. 推荐开发顺序

## Phase 1：Task + Tab + Phase 骨架

1. 建立 `TrainingTask` 数据结构；
2. 建立轻量 `WorkbenchTab`；
3. 建立 `workbenchStore`；
4. 实现 `workbenchTabService`；
5. 支持 Problem Task / Game Task；
6. 实现显式 Phase 状态机和非法转换保护；
7. 支持 phase 切换：Play → Recall → Analysis；
8. `Problem Mode` 改为 `Problem Task + tab.phase = play`。

## Phase 2：Attempt 与坏棋检测

1. 建立 `training_attempts`；
2. 抽出 `attemptService`；
3. 建立 `evaluationRules` 纯函数模块；
4. 抽出 `playTrainingMonitor`；
5. 支持 pending evaluation 和 30 秒 failed 兜底；
6. 写入轻量 `move_evaluations`；
7. 写入 `bad_moves`，只对关键节点保存 SGF snapshot。

## Phase 3：Recall Checkpoint

1. 建立 `recall_sessions` / `recall_attempts`；
2. 抽出 `recallService`；
3. 建立 `recall_checkpoints`；
4. 抽出 `recallCheckpointService`；
5. major/severe BadMove 触发 checkpoint；
6. 用户摆 correction line；
7. 展示 AI candidate lines；
8. 保存 comment；
9. 继续 Recall。

## Phase 4：Analysis 与 Snapshot

1. Analysis 展示 bad move list；
2. 展示 AI candidate lines；
3. 展示 Recall comments；
4. 支持自由摆棋；
5. 抽出 `snapshotService`；
6. Snapshot 创建 Problem；
7. 创建 Snapshot Problem Task；
8. 打开新 Tab。

## Phase 5：Review 与长期复习

1. 建立 `review_schedule`；
2. 抽出 `reviewService`，调度规则先内联为纯函数；
3. Punishment Problem 进入题库；
4. 到期题打开 Problem Task；
5. 根据结果更新 schedule。

---

# 23. v0.4 结论

v0.4 的核心收敛是：

```text
TrainingTask = 训练任务实体
WorkbenchTab = UI 承载容器
TrainingAttempt = 一次作答事实
MoveEvaluation = 每手评价
BadMove = 被判定的问题手
RecallSession = 回忆一条线
RecallCheckpoint = 问题手主动纠错
Problem = 可复习的训练题
ReviewSchedule = 长期复习调度
```

最终闭环：

```text
一个 TrainingTask
→ 用户在 Tab 中 Play
→ 提交形成 Attempt
→ Recall 回忆自己的线
→ BadMove 处先自我修正
→ 再看 AI 候选图并 comment
→ Analysis 自由研究
→ Snapshot 派生新 Problem / Task / Tab
→ 进入长期 Review
```
