# Gabaki / Sabaki 围棋训练系统 PRD v0.5

> 文档类型：产品需求文档  
> 基于：PRD v0.4 与本轮模式/来源建模讨论  
> v0.5 核心变化：`source` 不再作为核心建模维度；产品层明确为
> `Play / Problem / Recall / Analysis` 四个模式；`origin`
> 只作为来源追溯 metadata；主流程固定为
> `Play/Problem → Submit → Recall`，`Analysis` 作为灵活的自由研究空间。

---

# 0. v0.5 核心修订

## 0.1 保留 v0.4 的正确方向

v0.5 继续保留 v0.4 中已经成立的工程骨架：

```text
TrainingTask       = 标准化训练材料
WorkbenchTab       = UI 承载容器
TrainingAttempt    = 用户产出的一条线 / 一次作答事实
MoveEvaluation     = 每手分析事实
BadMove            = 被判定的问题手
RecallSession      = 回忆一次已冻结的 Attempt
RecallCheckpoint   = Recall 中的问题手主动纠错子流程
ReviewSchedule     = 长期复习调度
```

继续坚持：

```text
Attempt 是核心事实表
MoveEvaluation 和 BadMove 分离
Checkpoint 是 Recall 子流程
Review 是入口 / 队列，不是棋盘模式
Analysis 中自由摆棋不污染 Attempt
Snapshot 才创建新的 TrainingTask
Store 控制在 2～3 个
业务逻辑不继续塞进 sabaki.js
```

## 0.2 v0.5 的关键改变

v0.4 中把 `source` 拆成
`game / problem / snapshot_problem / recall_segment`，容易造成过度建模。v0.5 改为：

```text
source 不再是核心建模维度。
```

外部材料可能来自：

```text
野狐历史对局
本地 SGF
101 错题
本地题库
Analysis Snapshot
BadMove 派生题
Review 队列
手动创建
```

但这些来源只在“导入 / 创建 TrainingTask”的那一刻有意义。一旦材料进入系统，它们都被标准化为：

```text
TrainingTask
```

后续流程不再根据来源分叉。

## 0.3 新的核心判断

系统真正关心的不是：

```text
这个材料最早从哪里来？
```

而是：

```text
用户现在要干什么？
```

因此产品层主模式固定为四个：

```text
Play     普通对局 / 续弈 / 自由产出一条线
Problem  有题面、有目标、有提交标准的作答
Recall   回忆已提交 Attempt，并在坏棋处 checkpoint
Analysis 自由复盘、AI 对比、分支探索
```

## 0.4 流程收敛

v0.4 中的强流程是：

```text
Play → Recall → Analysis
```

v0.5 改为：

```text
主干流程：
Play / Problem → Submit → Recall

自由研究入口：
Play / Problem 可以进入 Analysis 做临时研究
Recall 可以进入 Analysis 查证
Recall 完成后推荐进入 Analysis，但不强制
任意模式都可以通过快捷键 / 按钮 Snapshot 当前局面生成新 Task
Review 打开的是普通 Task
```

也就是说：

```text
Recall 是提交后的默认下一步。
Analysis 是灵活的自由研究空间，不是强制第三关。
```

---

# 1. 产品定位

## 1.1 一句话定位

Gabaki /
Sabaki 训练系统是一个以“实战/做题产出 → 主动回忆 → 问题手自我纠错 → 自由复盘 → 派生新题 → 长期复习”为核心的个人围棋训练工作台。

## 1.2 核心价值

系统帮助用户完成五件事：

1. **把训练材料标准化**  
   无论材料来自野狐、本地 SGF、101、Snapshot、BadMove 还是 Review，进入系统后都变成统一的 `TrainingTask`。

2. **把用户产出保存成 Attempt**  
   用户在 Play / Problem 中产出一条线。提交后，这条线被冻结为
   `TrainingAttempt.userLine`。

3. **先训练自我回忆，再看 AI**  
   Submit 后默认进入 Recall，用户先复现自己的线，并在坏棋处先自己修正。

4. **把坏棋变成主动纠错 checkpoint**  
   major / severe
   BadMove 在 Recall 中触发 Checkpoint：用户先摆修正图，再看 AI 候选图，再写 comment。

5. **把任意关键局面变成新训练材料**  
   Play / Problem / Recall / Analysis 中的关键局面都可以 Snapshot 成新的
   `TrainingTask`，重新进入 Play / Problem。

## 1.3 当前目标用户

第一阶段服务一个核心用户：

- 有一定围棋基础；
- 会使用 KataGo / AI 复盘；
- 想提高实战训练效率；
- 愿意先自己思考，再看 AI；
- 重视背谱、复盘、纠错、错手惩罚和长期复习；
- 需要一个比普通 Sabaki / KataGo GUI 更贴近个人训练流程的本地训练工具。

## 1.4 第一阶段非目标用户

MVP 不优先服务：

```text
完全不会围棋的新手
机构课程系统
云端题库和多人协作
复杂能力画像
自动生成完整围棋讲解文章
大型统计大屏
复杂 ownership / 厚薄 / 死活判断
```

---

# 2. 核心设计原则

## 2.1 Mode 由用户意图决定

产品层不再围绕 source 组织，而是围绕用户当前意图组织：

```text
Play     我现在要下 / 续弈 / 模拟产出一条实战线
Problem  我现在要解一道有目标的题
Recall   我现在要回忆刚才提交的线
Analysis 我现在要自由研究、比较、摆变化
```

## 2.2 TrainingTask 是标准化训练材料

`TrainingTask` 表示一份可训练材料。

它可能来自：

```text
野狐历史对局
本地 SGF
101 错题
本地题库
Snapshot
BadMove
Review
手动创建
```

但进入系统以后，统一成为：

```text
TrainingTask
```

Task 不因为来源不同而改变后续生命周期。

## 2.3 origin 只做追溯，不参与流程判断

`origin` 只用于：

```text
展示来源标签
追溯父任务 / 父 attempt / 父 bad move
重新同步外部材料
调试数据来源
```

`origin` 不应该决定：

```text
当前 mode
phase / mode 转换
service 分支
UI 主结构
Review 打开方式
Snapshot 打开方式
```

禁止把以下内容建成核心 source：

```text
snapshot_problem
punishment_problem
review_problem
recall_segment
fox_game
101_problem
```

它们都应该是 `origin` 或 Task 字段的一部分。

## 2.4 Play 和 Problem 都是 Attempt 产出模式

Play 和 Problem 的共同点：

```text
创建 Attempt
用户落子
后台分析
记录 MoveEvaluation
记录 BadMove
Submit
冻结 userLine
进入 Recall
```

区别只是 UI 意图：

```text
Play：无题面、低干扰、偏实战 / 续弈
Problem：有题面、目标、hint、passRule、referenceLines
```

## 2.5 Recall 是有阻碍的主动研究

Recall 的目标不是看答案，而是制造适度摩擦：

```text
复现自己的线
命中问题手时暂停
先摆自己的修正图
用户请求后再展示 AI candidates
写 comment
继续 Recall
```

Recall 训练的是：

```text
我刚才怎么想？
我哪里判断错了？
我能不能先自己修正？
我的修正图和 AI 图差在哪里？
```

## 2.6 Analysis 是低阻碍的自由研究

Analysis 的目标是降低摩擦，提高信噪比。

Analysis 中可以：

```text
看 AI candidates
看 bad move list
看 Recall comments
看用户原变化 / 修正图 / AI 图
自由摆棋
做 territory / ownership / eval 对比
Snapshot 派生新 Task
```

Analysis 中的自由摆棋默认是 exploration，不写回当前 Attempt。

Snapshot 不是 Analysis 独占能力。Play / Problem / Recall /
Analysis 中都可以通过快捷键或按钮捕获当前局面，创建新的 TrainingTask；Analysis 只是最常发生深度派生的空间。

只有 Snapshot 才会把当前探索局面变成新的 TrainingTask。

## 2.7 Review 是入口，不是棋盘模式

Review 只是一组到期任务列表。

打开 Review item 后，本质是：

```text
review item → taskId → openTask(taskId, mode)
```

Review 不应该引入独立棋盘模式，也不应该知道 punishment / snapshot / 101 /
fox 等来源细节。

---

# 3. 产品层四个主模式

## 3.1 Play Mode

### 定位

Play
Mode 用于普通对局、续弈、实战模拟、自由产出一条线。它支持黑白双方分别配置为人或 AI。

### 典型入口

```text
新对局
野狐历史对局续弈
本地 SGF 续弈
当前局面自由下
Review 打开的自由训练材料
```

### 行为

```text
打开或创建 TrainingTask
进入 Play Mode
创建 TrainingAttempt
用户自由落子
按黑白方配置决定是否由 AI 自动应手
后台分析运行
AI overlay 默认隐藏
PlayTrainingMonitor 记录 MoveEvaluation / BadMove
用户 Submit
Attempt 冻结
进入 Recall
```

### UI 策略

```text
不显示题面
不显示 hint card
显示对局信息 / 当前局面信息
显示黑白方控制方式：人 / AI
允许设置黑方、白方分别由人或 AI 控制
允许设置 AI 走法参数，如引擎、用时、访问数、是否自动落子
底部提供悔棋、Pass、Resign、Submit、标记疑问手
侧边栏可打开 Material Browser 查看野狐 / 本地对局，但这只是导入入口
```

## 3.2 Problem Mode

### 定位

Problem
Mode 用于有题面、有目标、有提交标准的作答。它支持选择“对方”由 AI 应手，或由用户自己摆完整变化。

### 典型入口

```text
101 错题
本地题库
Snapshot 派生题
BadMove 派生题
Review 到期题
手动创建题
```

这些入口最终都打开同一种对象：

```text
TrainingTask with prompt / goal / passRule / referenceLines
```

### 行为

```text
打开或创建 TrainingTask
进入 Problem Mode
创建 TrainingAttempt
用户阅读题面和目标
用户自由摆答案变化
如果对方配置为 AI，则用户落子后由 AI 在题目范围内自动应手
如果对方配置为自己，则用户手动控制双方落子
后台分析运行，但 AI 答案默认隐藏
用户 Submit
Attempt 冻结
进入 Recall
```

### UI 策略

```text
显示题面 prompt
显示目标 goal
显示 passRule / referenceLines 的摘要
显示对方控制方式：AI / 自己
允许切换对方由 AI 应手或由自己控制
如果启用 AI 应手，必须显示 AI 落子范围状态
允许 hint card，但不直接暴露 AI 答案
隐藏完整 move tree 或降低其优先级
底部提供悔棋、重做、放弃、Submit
```

### Problem AI 范围约束

Problem Mode 中 AI 的落子必须限制在题目范围内。

MVP 使用现有 analysis area 表达题目范围：

```text
TrainingTask.problemArea
→ analysisAreaVertices / analysisAreaRects
→ engine analysis area
→ AI move candidate filter
```

硬约束：

```text
AI 不得在题目范围外落子；
请求引擎时必须传入 analysis area；
引擎返回的推荐手还要做二次校验；
若推荐手全部超出范围，系统不得自动落子，应提示用户调整题目范围或关闭 AI 应手；
Problem Mode 没有题目范围时，不能启用 AI 应手。
```

## 3.3 Recall Mode

### 定位

Recall Mode 用于回忆已冻结的 Attempt。它是有阻碍的主动研究阶段。

### 入口

```text
Play / Problem Submit 后默认进入
Review 打开的“回忆任务”也应先转成标准 Task + Attempt，再进入 Recall
```

### 行为

```text
创建 RecallSession
expectedMoves = attempt.userLine
用户逐手回忆
每手生成 RecallAttempt
命中 major / severe BadMove 时触发 Checkpoint
Checkpoint 中用户先摆 correction line
用户请求后 reveal AI candidate lines
用户写 comment
继续 Recall
Recall 完成后可进入 Analysis，也可结束
```

### UI 策略

```text
显示回忆进度
默认不显示 AI 候选
checkpoint 时突出“先自己修正”
AI candidates 需要用户主动 reveal
comment 可以模板填空 / quick comment / skipped
允许进入 Analysis 查证，但要清楚标识这是自由研究，不是 Recall 答案页
```

## 3.4 Analysis Mode

### 定位

Analysis
Mode 是自由复盘、AI 对比和分支探索空间。Snapshot 可以在任意模式触发；在 Analysis 中通常用于把研究分支沉淀为新 Task。

### 入口

```text
Recall 完成后推荐进入
Recall 中可进入查证
Play / Problem 中可进入临时研究
直接打开某个 Task / Attempt 做复盘
```

### 行为

```text
加载当前 task / attempt / bad moves / recall comments
显示 AI candidates
允许自由摆棋 / edit position
允许对比用户原图、修正图、AI 图
允许 Snapshot 当前局面
Snapshot 创建新的 TrainingTask，并打开新 Tab
```

### UI 策略

```text
降低摩擦
提高信噪比
显示 bad move list
显示 AI eval panel
显示 move tree / branch list
显示 Recall comments
显示 Snapshot
Analysis 中自由摆棋默认不污染 Attempt
```

---

# 4. 核心概念模型

## 4.1 TrainingTask

`TrainingTask` 是标准化训练材料。

```ts
type TrainingTask = {
  id: string

  title?: string
  initialPositionSgf: string
  sideToMove?: 'black' | 'white'

  // Problem Mode 需要；Play Mode 可以为空。
  prompt?: string
  goal?: string
  passRule?: PassRule
  referenceLines?: ReferenceLine[]
  problemArea?: MoveAreaConstraint

  // 可选展示和筛选字段。
  tags?: string[]
  difficulty?: 1 | 2 | 3 | 4 | 5
  status: 'inbox' | 'active' | 'archived'

  // 来源追溯，不参与核心流程判断。
  origin?: TaskOrigin

  createdAt: string
  updatedAt: string
}
```

`problemArea` 用于限制 Problem Mode 中 AI 应手范围，MVP 可以由现有 analysis
area 选择结果生成。

```ts
type MoveAreaConstraint = {
  source: 'analysis_area'
  vertices?: [number, number][]
  rects?: {
    x: number
    y: number
    width: number
    height: number
  }[]
}
```

### Problem-like Task 判断

MVP 可以用字段推导：

```text
有 prompt / goal / passRule / referenceLines
→ 默认以 Problem Mode 打开

没有题面和通过规则
→ 默认以 Play Mode 打开
```

必要时可以增加轻量字段：

```ts
defaultModeHint?: 'play' | 'problem'
```

但不要恢复复杂 `source kind`。

## 4.2 TaskOrigin

```ts
type TaskOrigin = {
  provider?:
    | 'fox'
    | '101'
    | 'local'
    | 'manual'
    | 'snapshot'
    | 'bad_move'
    | 'review'

  externalId?: string
  externalUrl?: string

  parentTaskId?: string
  parentAttemptId?: string
  parentBadMoveId?: string
  parentCheckpointId?: string
  parentMoveIndex?: number

  importedAt?: string
  rawMeta?: Record<string, unknown>
}
```

`TaskOrigin` 只用于：

```text
来源标签
追溯关系
外部同步
调试
```

禁止用它判断：

```text
是否进入 Play / Problem / Recall / Analysis
是否创建 Attempt
是否触发 Checkpoint
是否进入 Review
```

## 4.3 WorkbenchTab

`WorkbenchTab` 是 UI 容器。

```ts
type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

type WorkbenchTab = {
  id: string
  taskId: string

  mode: WorkbenchMode
  playerConfig?: WorkbenchPlayerConfig

  activeAttemptId?: string
  activeRecallSessionId?: string

  // Analysis 可以围绕 task / attempt / checkpoint / current position。
  analysisContext?: AnalysisContext

  currentTreePosition?: string

  parentTabId?: string
  childTabIds: string[]

  createdAt: string
  updatedAt: string
}
```

### Player / AI 配置

```ts
type PlayerController = 'human' | 'ai'

type WorkbenchPlayerConfig = {
  // Play Mode 使用。黑白双方可以分别由人或 AI 控制。
  black?: PlayerController
  white?: PlayerController

  // Problem Mode 使用。用户方由题目 sideToMove 决定；对方可由 AI 或自己控制。
  problemOpponent?: 'self' | 'ai'

  ai?: {
    engineId?: string
    maxVisits?: number
    timeLimitMs?: number
    autoPlay: boolean
  }
}
```

说明：

```text
Play Mode：black / white 可独立配置 human / ai。
Problem Mode：problemOpponent='self' 表示用户手动摆双方变化；problemOpponent='ai' 表示对方由 AI 应手。
Problem Mode 的 AI 必须受 TrainingTask.problemArea 约束。
```

### 说明

```text
Tab 可以关闭，Task 不消失。
Tab 保存 UI 当前打开状态，不保存训练事实。
Attempt / Recall / BadMove / Comment / Review 都是持久化事实。
```

## 4.4 AnalysisContext

```ts
type AnalysisContext = {
  taskId: string
  attemptId?: string
  checkpointId?: string
  positionHash?: string
  positionSgf?: string

  source:
    | 'task'
    | 'attempt'
    | 'checkpoint'
    | 'current_position'
    | 'snapshot_draft'
}
```

AnalysisContext 用于说明当前 Analysis 围绕什么材料展开，但它不是 source 建模的回潮。

它只服务 Analysis UI：

```text
加载哪些 bad moves
加载哪些 comments
加载哪些 candidate lines
Snapshot 时记录父级关系
```

## 4.5 TrainingAttempt

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
  moveActors?: ('human' | 'ai')[]

  status: TrainingAttemptStatus
  result: TrainingAttemptResult

  hintLevelUsed: number
  recallCompleted: boolean
  analysisOpened: boolean
}
```

### 说明

```text
Attempt 只保存一次作答主线和生命周期。
当启用 AI 应手时，userLine 保存完整行棋线，moveActors 标记每手来源。
Pass / bad move 评价默认只评价 human 控制方的落子，除非 passRule 明确要求评价整条线。
回到 Play / Problem 再做一次，应创建新 Attempt。
Analysis 自由摆棋默认不改 userLine。
```

## 4.6 MoveEvaluation

```ts
type MoveEvaluationStatus = 'pending' | 'evaluated' | 'failed'

type MoveEvaluation = {
  id: string
  attemptId: string

  moveIndex: number
  move: string

  positionBeforeHash?: string
  positionAfterHash?: string

  // 只在关键节点保存，普通手可为空。
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

## 4.7 BadMove

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

  generatedTaskId?: string
  recallCheckpointId?: string

  createdAt: string
}
```

`generatedTaskId` 指向由该 BadMove 派生出来的训练材料，不再叫
`generatedProblemId`。

## 4.8 RecallSession

MVP 中 Recall 只回忆 Attempt。

```ts
type RecallSession = {
  id: string
  taskId: string
  attemptId: string
  tabId?: string

  expectedMoves: string[]
  currentMoveIndex: number

  completed: boolean

  createdAt: string
  completedAt?: string
}
```

如果以后需要回忆一盘棋的某个片段，不要恢复复杂
`RecallSource`。可以先创建一个 Attempt-like
record，或者在 RecallSession 中直接保存 `expectedMoves` 与 `origin`。

## 4.9 RecallAttempt

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

## 4.10 RecallCheckpoint

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

## 4.11 MoveComment

```ts
type MoveCommentTarget =
  | {kind: 'bad_move'; badMoveId: string}
  | {kind: 'checkpoint'; checkpointId: string}
  | {kind: 'move_evaluation'; moveEvaluationId: string}
  | {kind: 'position'; positionHash: string; positionSgf?: string}
  | {kind: 'task'; taskId: string}

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

## 4.12 ReviewSchedule

Review 直接调度 Task。

```ts
type ReviewSchedule = {
  id: string
  taskId: string

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

# 5. 核心工作流

## 5.1 导入 / 打开材料

```text
外部材料
→ taskImportService 标准化
→ TrainingTask
→ workbenchTabService.openTask(taskId, mode?)
```

示例：

```text
野狐历史对局 → TrainingTask(origin.provider='fox') → Play Mode
101 错题 → TrainingTask(origin.provider='101', prompt/goal/passRule) → Problem Mode
Snapshot → TrainingTask(origin.provider='snapshot') → Problem 或 Play Mode
BadMove → TrainingTask(origin.provider='bad_move') → Problem Mode
Review → taskId → openTask(taskId)
```

## 5.2 Play / Problem → Submit → Recall

```text
openTask
→ tab.mode = play/problem
→ attemptService.createAttempt
→ 用户落子
→ attemptService.appendMove
→ playTrainingMonitor 创建 pending MoveEvaluation
→ 如果下一手由 AI 控制，aiMoveService 在约束内生成并落子
→ AI 落子同样 append 到 Attempt，并标记 moveActors='ai'
→ analysis update 后补齐评价
→ 用户 Submit
→ freeze Attempt
→ evaluationRules.evaluateAttempt
→ recallService.createRecallFromAttempt
→ tab.mode = recall
```

## 5.3 Recall Checkpoint

```text
Recall 用户逐手回忆
→ submitRecallMove
→ 如果 moveIndex 命中 major/severe BadMove
→ startCheckpoint
→ 用户先摆 correction line
→ 用户请求 reveal AI candidates
→ 保存 comment
→ resumeRecall
```

## 5.4 Analysis 灵活入口

Analysis 可以从以下位置进入：

```text
Recall 完成后进入
Recall 中进入查证
Play / Problem 中进入临时研究
直接打开某个 Attempt / BadMove 进入
```

Analysis 行为边界：

```text
默认不修改当前 Attempt.userLine
默认不改变 RecallSession.expectedMoves
自由摆棋属于 exploration
Snapshot 才生成新 TrainingTask
```

## 5.5 Snapshot

```text
任意 Workbench Mode 当前局面
→ snapshotService.captureSnapshotInput
→ taskImportService.createTaskFromSnapshot
→ trainingRepository.createTask
→ workbenchTabService.openTask(newTaskId, {mode:'problem'})
```

Snapshot 是全局动作：

```text
Play     可从当前实战 / 续弈局面创建新 Task
Problem  可从当前作答中间局面创建新 Task
Recall   可从当前回忆 / checkpoint 局面创建新 Task
Analysis 可从自由研究分支创建新 Task
```

UI 要求：

```text
所有模式都应支持 Snapshot 快捷键；
所有模式都应有可发现的 Snapshot 按钮或菜单项；
按钮位置可以随模式不同调整，但命令路径必须一致。
```

Snapshot 生成的是普通 `TrainingTask`，只是：

```ts
origin.provider = 'snapshot'
origin.parentTaskId = currentTaskId
origin.parentAttemptId = currentAttemptId
origin.parentMoveIndex = currentMoveIndex
```

不再生成特殊 `snapshot_problem` task kind。

## 5.6 BadMove 派生题

```text
BadMove
→ taskImportService.createTaskFromBadMove
→ TrainingTask(origin.provider='bad_move')
→ ReviewSchedule(taskId)
```

派生题不是特殊 Tab，不强制立即打开。

## 5.7 Review

```text
reviewService.getDueItems
→ 用户点击 item
→ item.taskId
→ workbenchTabService.openTask(taskId)
→ 根据 Task 字段默认进入 Play 或 Problem
```

ReviewSchedule 不再需要：

```text
item_type = problem / recall_segment
```

MVP 只调度 taskId。

---

# 6. UI 需求

## 6.1 Workbench 总布局

```text
顶部栏：当前模式、任务标题、主操作
左侧栏：Material Browser / Review Inbox / Task List
中间：Main Board
右侧栏：当前模式的辅助面板
底部栏：当前模式的工具条
```

## 6.2 Material Browser

Material Browser 只是材料入口，不是模式系统。

左侧可有：

```text
野狐
本地棋谱
101错题
本地题库
Review
手动创建
```

这些入口只负责：

```text
导入 / 创建 / 打开 TrainingTask
```

不要让这些来源决定主工作台逻辑。

## 6.3 Play Mode UI

顶部：

```text
任务标题 / 对局信息
黑方：人 / AI
白方：人 / AI
Submit
进入 Analysis
```

右侧：

```text
当前对局信息
当前训练目标，可为空
AI 走法设置：引擎、用时 / visits、自动落子
实时记录摘要：手数、pending evaluation、bad move count
```

底部：

```text
悔棋
Pass
Resign
Submit
标记疑问手
```

## 6.4 Problem Mode UI

顶部：

```text
题目标题
对方：自己 / AI
Submit
放弃
进入 Analysis
```

右侧：

```text
prompt
目标 goal
passRule 摘要
题目范围 / analysis area 状态
AI 应手设置，仅在对方=AI 时显示
hint card
referenceLines 摘要，但不直接暴露完整答案
```

底部：

```text
悔棋
重做
请求提示
Submit
```

## 6.5 Recall Mode UI

顶部：

```text
Recall 进度
当前第几手
完成 / 跳过 / 进入 Analysis
```

右侧：

```text
Recall progress
当前 checkpoint
用户 correction draft
AI candidates reveal 按钮
comment 模板
```

交互原则：

```text
默认不显示 AI 答案
先让用户摆修正图
用户请求后再 reveal
允许 quick comment / skipped
```

## 6.6 Analysis Mode UI

顶部：

```text
自由复盘
Snapshot
返回上一个模式
重新 Play / Problem
```

右侧：

```text
AI candidate lines
BadMove list
Recall comments
用户原变化 / 修正图 / AI 图对比
```

底部：

```text
自由摆棋工具
Edit position
Snapshot
标记问题点
```

Analysis 的 UI 目标：

```text
少阻碍
高信噪比
重点解释用户为什么亏
方便派生新题
```

---

# 7. MVP 范围

## 7.1 MVP 目标

跑通最短闭环：

```text
TrainingTask
→ Play / Problem 产出 Attempt
→ Submit
→ Recall 回忆 Attempt.userLine
→ major/severe BadMove 触发 Checkpoint
→ 用户摆 correction line
→ reveal AI candidates
→ 写 comment
→ Analysis 自由研究
→ Snapshot 生成新 TrainingTask
→ Review 长期复习
```

## 7.2 MVP 必做

### A. Task / Tab / Mode

- 创建标准化 TrainingTask；
- Task 支持 prompt / goal / passRule / referenceLines / problemArea；
- Task 支持 origin metadata；
- WorkbenchTab 支持 `mode = play | problem | recall | analysis`；
- 支持 openTask；
- 不再引入 snapshot_problem / punishment_problem / recall_segment task kind。

### B. Play / Problem

- 支持自由落子；
- 支持创建 Attempt；
- 支持后台分析；
- Play 支持黑白双方分别设置为人或 AI；
- Problem 支持选择对方为 AI 或自己；
- Problem AI 应手必须限制在题目 problemArea / analysis area 内；
- 支持 pending MoveEvaluation；
- 支持 BadMove 检测；
- 支持 Submit；
- Submit 后冻结 Attempt。

### C. Recall

- RecallSession 绑定 Attempt；
- expectedMoves 来自 Attempt.userLine；
- 支持逐手回忆；
- major/severe BadMove 触发 Checkpoint；
- 支持 correction line；
- 支持 reveal AI candidates；
- 支持 comment；
- 支持 complete / skipped。

### D. Analysis

- 支持查看 bad moves；
- 支持查看 AI candidates；
- 支持查看 Recall comments；
- 支持自由摆棋；
- 支持 Snapshot；
- Analysis 不污染 Attempt。

### E. Review

- ReviewSchedule 直接引用 taskId；
- 支持到期 Task 列表；
- 支持打开到期 Task；
- 根据 Attempt result 更新下次复习时间。

## 7.3 暂不做

```text
云同步
社区题库
多人协作
完整 Problem 独立实体系统
复杂 task tag 系统
完整 analysis_sessions 表
复杂 training_branches 表
完整 SM-2
复杂能力画像
自动长文讲解
```

---

# 8. 验收标准

## 8.1 Task / Mode

- 可以从外部材料创建 TrainingTask；
- `origin` 能保存来源，但不参与流程判断；
- 可以通过 openTask 打开任务；
- 有题面任务默认进入 Problem Mode；
- 无题面任务默认进入 Play Mode；
- Snapshot / BadMove 派生任务仍是普通 TrainingTask。

## 8.2 Play / Problem

- 用户可以自由下变化；
- Play Mode 可设置黑方、白方分别由人或 AI 控制；
- Problem Mode 可设置对方由 AI 应手或由自己控制；
- Problem Mode 启用 AI 时必须存在题目范围；
- Problem AI 不会在题目范围外落子；
- 系统后台分析；
- AI overlay 默认不显示；
- 系统记录 Attempt；
- 系统记录 MoveEvaluation；
- 系统检测 BadMove；
- Submit 后 Attempt 被冻结；
- Submit 后默认进入 Recall。

## 8.3 Recall

- Recall 可以复现 Attempt.userLine；
- 遇到 major/severe BadMove 时暂停；
- 用户可以先摆 correction line；
- 系统随后展示 AI candidate lines；
- 用户可以写 comment；
- comment 保存后继续 Recall；
- Recall 完成后可以进入 Analysis，但不强制。

## 8.4 Analysis

- 可以从 Recall 进入 Analysis；
- 可以查看 bad move list；
- 可以查看 AI candidates；
- 可以查看 Recall comments；
- 可以自由摆棋；
- 自由摆棋不修改 Attempt.userLine；
- Snapshot 后创建新的 TrainingTask 和新 Tab。

## 8.5 Review

- Review 能展示到期 Task；
- Review item 打开普通 Task；
- Review 不区分 problem / recall_segment item type；
- 完成训练后更新下次复习时间。

---

# 9. 风险与应对

## 9.1 Mode 和旧 Sabaki global mode 冲突

风险：旧 Sabaki 已有 mode 概念，新训练系统也有 mode，容易混乱。

应对：

```text
训练系统内部使用 WorkbenchMode
旧 Sabaki mode 通过 legacySabakiAdapter 兼容
不要让业务判断依赖旧 global mode
```

## 9.2 Problem 实体被过早抽象

风险：重新建立复杂 Problem 表后，`Task / Problem / Source` 又开始混乱。

应对：

```text
MVP 中 Problem-like 信息直接存在 TrainingTask：prompt / goal / passRule / referenceLines。
后续只有当题库管理复杂化时，再引入 ProblemLibrary / ProblemAsset。
```

## 9.3 Analysis 过于自由，污染 Attempt

风险：用户在 Analysis 中摆出的变化混入当前 Attempt。

应对：

```text
Attempt 提交后冻结。
Analysis 默认使用 scratch / exploration 上下文。
只有 Snapshot 才创建新的 TrainingTask。
```

## 9.4 Problem AI 超出题目范围

风险：Problem
Mode 中 AI 应手落到题目范围外，导致用户训练目标漂移，甚至把无关分支写入 Attempt。

应对：

```text
Problem Mode 启用 AI 应手前必须存在 problemArea；
problemArea 由现有 analysis area 表达；
请求引擎时传入 analysisAreaVertices；
引擎结果返回后必须二次过滤；
过滤后没有合法候选手时，不自动落子。
```

## 9.5 Recall 打断太重

风险：每个 bad move 都 checkpoint，会导致训练过重。

应对：

```text
MVP 只对 major / severe 触发。
minor 只记录，不暂停。
允许 quick comment / skipped。
```

## 9.5 MoveEvaluation 存储膨胀

风险：每手保存 before / after SGF 会导致 SQLite 膨胀。

应对：

```text
普通手只保存 moveIndex、move、position hash、评估结果。
BadMove / Checkpoint / Snapshot 等关键节点才保存 SGF snapshot。
普通局面需要时由 Task root + Attempt userLine 重建。
```

## 9.6 过度服务化

风险：为每个名词建一个 Service，单人开发维护成本高。

应对：

```text
按用例拆 Service，不按名词机械拆分。
evaluationRules / review schedule rules 先作为纯函数模块。
薄服务少于约 50 行且只有一个 caller 时先内联。
```

---

# 10. 推荐开发顺序

## Phase 1：Task + Tab + Mode 骨架

1. 改造 TrainingTask 类型，移除 source kind；
2. 增加 origin metadata；
3. 建立 WorkbenchMode：play / problem / recall / analysis；
4. 建立 workbenchStore；
5. 实现 workbenchTabService.openTask；
6. 根据 Task 字段推导默认 mode；
7. 跑通 Play / Problem 打开任务。

## Phase 2：Attempt / AI Move / Submit

1. 建立 training_attempts；
2. 实现 attemptService；
3. Play / Problem 落子写入 Attempt；
4. 实现 aiMoveService；
5. Play 支持黑白 human / ai；
6. Problem 支持对方 self / ai；
7. Problem AI 受 problemArea / analysis area 限制；
8. Submit 冻结 Attempt；
9. Submit 后创建 RecallSession；
10. Submit 后进入 Recall。

## Phase 3：MoveEvaluation / BadMove

1. 建立 move_evaluations；
2. 建立 bad_moves；
3. 建立 evaluationRules；
4. 建立 playTrainingMonitor；
5. 支持 pending evaluation；
6. 支持 major / severe 检测。

## Phase 4：Recall Checkpoint

1. 建立 recall_sessions / recall_attempts；
2. 建立 recallService；
3. 建立 recall_checkpoints；
4. 建立 recallCheckpointService；
5. 支持 correction line；
6. 支持 reveal AI candidates；
7. 支持 comment。

## Phase 5：Analysis / Global Snapshot

1. 建立 Analysis Mode；
2. 展示 bad move list；
3. 展示 AI candidates；
4. 展示 Recall comments；
5. 支持自由摆棋；
6. Snapshot 在所有模式创建新 TrainingTask；
7. 新 Task 打开为 Problem / Play。

## Phase 6：Review

1. 建立 review_schedule；
2. ReviewSchedule 直接引用 taskId；
3. 实现 reviewService.getDueItems；
4. 实现 openDueItem → openTask；
5. 根据训练结果更新 schedule。

---

# 11. v0.5 结论

v0.5 的核心收敛是：

```text
不要围绕“材料从哪里来”设计系统。
要围绕“用户现在要干什么”设计系统。
```

最终模型：

```text
Mode = 用户当前意图：Play / Problem / Recall / Analysis
Task = 标准化训练材料
Origin = 来源备注，不参与主流程
Attempt = 用户产出的一条线
RecallSession = 回忆一个 Attempt
RecallCheckpoint = 坏棋处的主动纠错
AnalysisContext = 自由研究上下文
ReviewSchedule = 对 Task 的长期调度
```

最终闭环：

```text
外部材料 / Snapshot / BadMove / Review
→ 标准化 TrainingTask
→ Play / Problem 产出 Attempt
→ Submit
→ Recall 主动回忆和 checkpoint 纠错
→ Analysis 自由研究
→ Snapshot 派生新 Task
→ Review 长期复习
```
