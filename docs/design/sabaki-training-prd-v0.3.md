# Gabaki / Sabaki 魔改版围棋训练系统 PRD

> 版本：v0.3  
> 文档类型：产品需求文档（PRD）  
> 核心定位：多标签页训练工作台  
> 当前目标：将“Play / Recall / Analysis / Problem / Punishment”收敛为统一的 Tab + Phase 训练模型  
> 更新日期：2026-05-14

---

## 0. 本版核心变化

本版 PRD 在 v0.1 / v0.2 的基础上做出一次关键收敛：

1. **不再把 Problem Mode 视为独立棋盘模式。**  
   Problem 是一种训练任务来源，而不是一套独立的棋盘交互系统。

2. **不再设置独立的 Punishment Tab。**  
   惩罚题仍会作为 `Problem.type = 'punishment'` 生成并进入题库 / Review 队列，但当前流程中的坏棋处理发生在 Recall 阶段。

3. **训练工作台采用多标签页模型。**  
   一个标签页对应一个训练任务：一盘棋、一道题、一次复习题、或从 Analysis 中 Snapshot 派生的新题。

4. **每个标签页内部统一经历三个阶段：**

   ```text
   Play → Recall → Analysis
   ```

5. **Snapshot 的语义升级。**  
   Snapshot 不只是保存局面，而是从当前 Analysis 派生出一个新的 Problem，并打开一个新的 Workbench Tab，进入新的 `Play → Recall → Analysis` 循环。

---

# 1. 产品定位

## 1.1 一句话定位

一个以“实战/做题自由作答 → 回忆与自我纠错 → AI 复盘与派生新题 → 长期复习”为核心的个人围棋训练工作台。

## 1.2 核心价值

本工具帮助用户完成四件事：

1. **把每一次实战或做题尝试保留下来**  
   不只是保存 SGF，而是保存为可回忆、可评价、可复盘、可派生新题的训练材料。

2. **先训练自我回忆，再看 AI 评价**  
   用户提交后不直接进入 AI 答案展示，而是先进入 Recall，回忆自己的变化、判断和错误点。

3. **把坏棋变成主动纠错 checkpoint**  
   遇到问题手时，系统不直接告诉用户答案，而是要求用户先摆出自己认为更好的图，再与 AI 候选图对比并写 comment。

4. **把新的疑问派生成新的训练任务**  
   在 Analysis 中自由摆棋时，如果产生新的值得研究的局面，用户可 Snapshot 成新题，并在新标签页中继续训练。

---

# 2. 目标用户

## 2.1 当前目标用户

第一阶段服务一个核心用户：

- 有一定围棋基础；
- 会使用 AI 复盘；
- 想提高实战训练效率；
- 愿意先自己思考，再看 AI；
- 重视背谱、复盘、纠错、错手惩罚和长期复习；
- 需要一个比普通 Sabaki / KataGo GUI 更贴近个人训练流程的工具。

## 2.2 非目标用户

第一阶段不优先服务：

- 完全不会围棋的新手；
- 只想快速看 AI 胜率的人；
- 需要标准化课程的机构用户；
- 需要社区题库、多人同步、云端协作的用户；
- 需要自动生成完整围棋讲解文章的用户。

---

# 3. 核心设计原则

## 3.1 Tab 是训练任务容器

系统不再以全局 `mode` 组织训练，而是以 `WorkbenchTab` 为单位组织训练任务。

一个 Tab 可以来自：

```text
Game
Problem
Review Item
Snapshot Problem
```

但无论来源是什么，一个 Tab 内部都遵循统一阶段：

```text
Play → Recall → Analysis
```

## 3.2 Play 是自由产出阶段

Play 阶段不是“普通下棋模式”，而是用户在当前训练任务下自由产出自己的变化线。

它可以用于：

- 下完整盘棋；
- 做一道题；
- 回到题目重新尝试；
- 复习某道到期题；
- 从 Snapshot 派生的新问题中继续探索。

## 3.3 Recall 优先于 Analysis

用户提交后，系统默认进入 Recall，而不是直接进入 Analysis。

Recall 的核心不是看答案，而是：

```text
我刚才怎么想？
我能不能复现自己的变化？
哪个问题手我现在能不能自己改？
我的修正图和 AI 图差在哪里？
```

## 3.4 Bad Move 的即时处理发生在 Recall

系统不设置独立的 Punishment Tab。

当 Recall 遇到 bad move 时，系统暂停当前 Recall，进入问题手 checkpoint：

1. 用户先摆出自己认为更好的变化；
2. 系统展示 AI 的若干候选变化；
3. 用户对比自己的原图 / 修正图 / AI 图；
4. 用户写 comment；
5. 完成后继续下一手 Recall。

## 3.5 Punishment Problem 是长期复习材料

坏棋仍然可以自动生成惩罚题：

```text
BadMove → Problem(type='punishment') → Problem Inbox / Review Queue
```

但它不会在当前流程中强行打开新 Tab。  
未来复习时，它作为普通 Problem Tab 打开，仍然经历：

```text
Play → Recall → Analysis
```

## 3.6 Analysis 是自由研究与派生新题阶段

Analysis 阶段允许用户：

- 看 AI 评价；
- 看 bad move；
- 看 AI candidate lines；
- 看用户原变化；
- 自由摆棋；
- 保存 Snapshot；
- 派生新 Problem；
- 打开新的 Workbench Tab。

Analysis 中产生的新想法不污染当前 attempt；只有 Snapshot 后，才成为新的训练任务。

---

# 4. 核心概念模型

## 4.1 WorkbenchTab

```ts
type WorkbenchTab = {
  id: string

  source:
    | {kind: 'game'; gameId: string}
    | {kind: 'problem'; problemId: string}
    | {kind: 'review'; itemId: string; itemType: 'problem' | 'recall_segment'}
    | {kind: 'snapshot'; problemId: string; parentTabId: string}

  title?: string

  rootPositionSgf: string
  currentTreeId?: string
  currentTreePosition?: string

  phase: 'play' | 'recall' | 'analysis'

  attemptIds: string[]
  activeAttemptId?: string

  recallSessionId?: string
  analysisSessionId?: string

  parentTabId?: string
  childTabIds: string[]

  createdAt: string
  updatedAt: string
}
```

### 说明

- `WorkbenchTab` 是 UI 和训练流程的基本单位。
- 一个 Tab 只负责一个训练任务。
- Snapshot 产生新 Problem 后，会打开新的 Tab。
- 回到 Play 时，应创建新的 Attempt，而不是覆盖旧 Attempt。

---

## 4.2 Tab Source

```ts
type TabSource =
  | {kind: 'game'; gameId: string}
  | {kind: 'problem'; problemId: string}
  | {kind: 'review'; itemId: string; itemType: 'problem' | 'recall_segment'}
  | {kind: 'snapshot'; problemId: string; parentTabId: string}
```

### Source 决定 UI 策略

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
const gameTabPolicy = {
  showProblemBrief: false,
  showSubmitButton: true,
  showHintCardDuringPlay: false,
  showMoveTreeDuringPlay: false,
  showAnalysisOverlayDuringPlay: false,
  allowSnapshotInAnalysis: true
}

const problemTabPolicy = {
  showProblemBrief: true,
  showSubmitButton: true,
  showHintCardDuringPlay: true,
  showMoveTreeDuringPlay: false,
  showAnalysisOverlayDuringPlay: false,
  allowSnapshotInAnalysis: true
}
```

---

## 4.3 Phase

所有 Tab 统一包含三个阶段。

```ts
type WorkbenchPhase = 'play' | 'recall' | 'analysis'
```

### Play

用户自由行棋或作答，直到主动提交 / 投降 / 结束。

### Recall

用户回忆刚才的实战线或作答线，系统在问题点暂停并引导用户自我纠错。

### Analysis

用户查看 AI 评价、坏棋点、候选图和分支，自由摆棋，并可 Snapshot 派生新题。

---

# 5. 核心工作流

## 5.1 总览

```text
打开 Tab
→ Play：用户自由下到提交
→ Recall：用户回忆自己的变化，遇到问题手进入 checkpoint
→ Analysis：AI 评价、自由摆棋、snapshot 派生新题
→ Snapshot：新 Problem + 新 Tab
→ 新 Tab 继续 Play → Recall → Analysis
```

---

## 5.2 Game Tab 流程

```text
打开 Game Tab
→ phase = Play
→ 用户下完整盘 / 一段续弈
→ 后台静默监测 bad move
→ 用户提交 / 对局结束
→ phase = Recall
→ 用户回忆整盘或关键片段
→ Recall 遇到问题手，进入 checkpoint
→ Recall 完成后，用户可以：
   A. 进入 Analysis，自由复盘
   B. 回到 Play，再下一轮
→ Analysis 中可 Snapshot 生成新题
→ 新题打开为新的 Problem Tab
```

---

## 5.3 Problem Tab 流程

```text
打开 Problem Tab
→ phase = Play
→ 用户阅读题目说明
→ 用户自由摆出答案变化
→ 后台检测 bad move
→ 用户提交 / 投降
→ phase = Recall
→ 用户回忆自己的变化和判断
→ Recall 遇到 bad move：
   1. 暂停
   2. 用户自己摆出更好的图
   3. 系统展示 AI 候选图
   4. 用户写 comment
   5. 继续下一手 Recall
→ Recall 完成后，用户可以：
   A. 回到 Play，再试一次
   B. 进入 Analysis，看 AI 分支、惩罚线、自由摆棋
→ Analysis 中可 Snapshot
→ 新 Snapshot 打开为新 Problem Tab
```

---

## 5.4 Review 流程

```text
Review Queue 抽出到期题
→ 打开 Problem Tab
→ Play → Recall → Analysis
→ 根据提交结果和 Recall checkpoint 完成情况更新 review_schedule
```

其中 `Problem.type = 'punishment'` 的题，也作为普通 Problem Tab 处理。

---

# 6. Play 阶段需求

## 6.1 目标

让用户在不被 AI 答案打断的情况下，完整表达自己的实战或做题变化。

## 6.2 行为

Play 阶段中：

- 用户可以自由落子；
- 系统后台分析；
- 系统记录每手评估；
- 系统记录 bad move；
- 系统可生成 hidden branch draft；
- 普通 Game Tab 默认不显示分级提示；
- Problem Tab 可显示分级提示；
- AI overlay 默认关闭；
- 用户主动点击提交后进入 Recall。

## 6.3 后台分析策略

必须拆分：

```ts
analysisRunning: boolean
analysisVisible: boolean
trainingMonitorEnabled: boolean
hintCardVisible: boolean
```

Game Tab Play：

```ts
analysisRunning = true
analysisVisible = false
trainingMonitorEnabled = true
hintCardVisible = false
```

Problem Tab Play：

```ts
analysisRunning = true
analysisVisible = false
trainingMonitorEnabled = true
hintCardVisible = true
```

Analysis Phase：

```ts
analysisRunning = true
analysisVisible = true
trainingMonitorEnabled = false // 或 readonly
hintCardVisible = false
```

---

# 7. Attempt 数据模型

## 7.1 Attempt

一次 Play 阶段提交形成一个 Attempt。  
同一个 Tab 可以有多次 Attempt。

```ts
type TrainingAttempt = {
  id: string
  tabId: string

  sourceKind: 'game' | 'problem' | 'review' | 'snapshot'
  sourceId?: string

  startedAt: string
  submittedAt?: string

  rootPositionSgf: string
  userLine: string[]

  moveEvaluations: MoveEvaluation[]
  badMoves: BadMove[]
  trainingBranches: TrainingBranchDraft[]

  result?: 'pending_recall' | 'pass' | 'soft_pass' | 'fail' | 'abandoned'

  hintLevelUsed: number
  recallCompleted: boolean
  analysisOpened: boolean

  generatedProblemIds: string[]
}
```

## 7.2 MoveEvaluation

```ts
type MoveEvaluation = {
  id: string
  attemptId: string

  moveIndex: number
  move: string

  positionBeforeSgf?: string
  positionAfterSgf?: string

  beforeScoreLead?: number
  afterScoreLead?: number
  scoreDrop?: number

  beforeWinrate?: number
  afterWinrate?: number
  winrateDrop?: number

  isBadMove: boolean
  severity: 'none' | 'minor' | 'major' | 'severe'

  engineSuggestedMove?: string
  engineSuggestedLine?: string[]

  status: 'pending' | 'evaluated' | 'failed'
}
```

## 7.3 BadMove

```ts
type BadMove = {
  id: string
  tabId: string
  attemptId: string

  moveIndex: number
  move: string

  positionBeforeMoveSgf: string
  positionAfterMoveSgf: string

  severity: 'minor' | 'major' | 'severe'

  scoreDrop?: number
  winrateDrop?: number

  punishSide: 'black' | 'white'
  suggestedPunishMove?: string
  suggestedPunishLine?: string[]

  recallCheckpointId?: string
  generatedProblemId?: string

  createdAt: string
}
```

---

# 8. 实时坏棋检测

## 8.1 核心原则

坏棋检测属于完整 Play 系统，不属于 Problem 专用逻辑。

因此应存在统一模块：

```text
PlayTrainingMonitor
```

它在 Game Tab 和 Problem Tab 中都启用，只是 UI 展示策略不同。

## 8.2 检测流程

```text
用户落子
→ document/gameTree append node
→ engine/analysis 后台分析
→ PlayTrainingMonitor 获取 before/after eval
→ MoveEvaluationService 计算 scoreDrop / winrateDrop
→ 判定 severity
→ 记录 MoveEvaluation
→ 如为 bad move，生成 BadMove + TrainingBranchDraft
→ 根据 UI policy 决定是否实时提示
```

## 8.3 异步分析策略

引擎分析是异步的，不应因为当前没有 analysis 结果就跳过检测。

MVP 推荐策略：

```text
允许用户继续下
先记录 pending MoveEvaluation
analysis-update 到来后补算 scoreDrop
```

## 8.4 阈值

MVP 默认：

```text
minor：亏 2 目以上
major：亏 5 目以上
severe：亏 8 目以上
```

但 Problem 的 `passRule` 可以覆盖默认值。

---

# 9. Training Branch

## 9.1 分支类型

系统记录两类训练分支：

```ts
type TrainingBranchKind =
  | 'better_alternative'
  | 'punishment'
```

### better_alternative

锚定在坏棋之前的父节点，回答：

```text
这手本来可以怎么下？
```

### punishment

锚定在坏棋之后的节点，回答：

```text
这手为什么坏？对手怎么惩罚？
```

## 9.2 数据结构

```ts
type TrainingBranchDraft = {
  id: string
  tabId: string
  attemptId: string

  kind: 'better_alternative' | 'punishment'

  anchorTreePosition: string
  triggerMoveIndex: number
  triggerMove: string

  moves: string[]

  scoreDrop?: number
  severity: 'minor' | 'major' | 'severe'

  visibleIn: Array<'recall' | 'analysis'>
  generatedFromEngine: boolean

  createdAt: string
}
```

## 9.3 展示策略

Play 阶段：

```text
默认隐藏
Problem Tab 可用 hint card 显示部分信息
```

Recall 阶段：

```text
用于问题手 checkpoint
但 AI 图应在用户先摆修正图后展示
```

Analysis 阶段：

```text
完整展示，可自由跳转、比较、摆棋
```

---

# 10. Recall 阶段需求

## 10.1 目标

Recall 是用户提交后的主动回忆与自我纠错阶段。

它不是简单看答案，也不只是背谱，而是训练用户：

- 复现自己的变化；
- 解释自己的判断；
- 在问题手处先自己修正；
- 再对比 AI 图；
- 用围棋语言 comment 自己的错误。

## 10.2 Recall 类型

```ts
type RecallType =
  | 'game_line'
  | 'attempt_line'
  | 'key_segment'
  | 'bad_move_checkpoint'
```

### game_line

用于 Game Tab，回忆实战棋谱。

### attempt_line

用于 Problem Tab / Review Tab，回忆刚才提交的作答线。

### key_segment

回忆关键片段。

### bad_move_checkpoint

Recall 中遇到问题手时的暂停纠错流程。

---

## 10.3 RecallSession

```ts
type RecallSession = {
  id: string
  tabId: string
  attemptId?: string
  gameId?: string

  type: RecallType

  startMove: number
  endMove?: number

  expectedMoves: string[]
  currentMoveIndex: number

  attempts: RecallAttempt[]
  checkpoints: RecallCheckpoint[]

  completed: boolean

  createdAt: string
  completedAt?: string
}
```

## 10.4 RecallAttempt

```ts
type RecallAttempt = {
  id: string
  recallSessionId: string

  moveNumber: number
  expectedMove: string
  userMove: string

  isCorrect: boolean
  hintLevelUsed: number

  timestamp: string
}
```

---

# 11. Recall Checkpoint：问题手主动纠错

## 11.1 触发条件

满足任一条件可触发 checkpoint：

```text
1. 当前 recall 到的 moveIndex 对应 bad move
2. scoreDrop 达到 major / severe
3. 用户手动标记“这里要停一下”
4. 系统识别为关键转折点
```

MVP 优先：

```text
只对 major / severe bad move 触发 checkpoint
```

## 11.2 Checkpoint 流程

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

## 11.3 RecallCheckpoint 数据结构

```ts
type RecallCheckpoint = {
  id: string
  tabId: string
  recallSessionId: string
  attemptId?: string
  badMoveId?: string

  moveIndex: number
  positionBeforeSgf: string

  originalMove: string
  originalLine?: string[]

  userCorrectionLine: string[]

  aiCandidateLines: ReferenceLine[]

  userComment: string

  status: 'pending' | 'commented' | 'skipped'

  createdAt: string
  completedAt?: string
}
```

## 11.4 Comment 模板

用户 comment 至少回答其中 1-2 项：

```text
1. 我原来的图坏在哪里？
2. 我的修正图比原图好在哪里？
3. 我的修正图和 AI 推荐图差在哪里？
4. 这个局面的核心矛盾是什么？
5. 这手以后我应该记住的判断规则是什么？
```

---

# 12. Analysis 阶段需求

## 12.1 目标

Analysis 是自由研究、AI 对比和新问题派生阶段。

## 12.2 功能

Analysis 中应支持：

```text
Main Board
Move Tree
AI Eval Panel
Bad Move List
Training Branch List
Reference Lines
Recall Comments
Snapshot Button
自由摆棋 / Edit Position
```

## 12.3 Analysis 行为边界

Analysis 中的自由摆棋默认不算入当前 Attempt。

如果用户在 Analysis 中发现新问题，应点击 Snapshot：

```text
当前局面 → 新 Problem → 新 WorkbenchTab → phase = Play
```

---

# 13. Snapshot

## 13.1 目标

Snapshot 是从当前 Analysis 派生新训练任务的动作。

## 13.2 行为

用户点击 Snapshot 后：

```text
1. 保存当前局面为 Problem
2. 记录来源 tab / attempt / moveIndex
3. 填写或生成 positionDescription
4. 填写 taskGoal
5. 保存到 Problem Inbox 或 active problem
6. 打开新 WorkbenchTab
7. 新 Tab phase = Play
```

## 13.3 Snapshot 数据结构

```ts
type ProblemSnapshotInput = {
  sourceTabId: string
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

---

# 14. Problem

## 14.1 Problem 数据结构

```ts
type Problem = {
  id: string

  sourceGameId?: string
  sourceProblemId?: string
  sourceTabId?: string
  sourceAttemptId?: string
  sourceMoveIndex?: number

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

  parentProblemId?: string
  parentSnapshotReason?: string

  createdAt: string
  updatedAt: string
}
```

## 14.2 ProblemType

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
```

## 14.3 Punishment Problem

Punishment Problem 不再对应独立 Tab 类型。  
它只是 Problem 的一种类型。

```ts
type PunishmentProblem = Problem & {
  type: 'punishment'
  parentProblemId?: string
  parentAttemptId: string
  badMoveId: string
  badMove: string
  punishSide: 'black' | 'white'
  punishMove?: string
}
```

生成后进入：

```text
Problem Inbox
或 Review Queue
```

未来复习时作为普通 Problem Tab 打开。

---

# 15. Submit / Pass Rule

## 15.1 提交

用户在 Play 阶段可以随时提交。

提交后：

```text
1. 冻结当前 userLine
2. 完成当前 attempt
3. 生成 pending / evaluated MoveEvaluation
4. 进入 Recall
```

## 15.2 提交结果

最终结果可以在 Recall 后或 Analysis 后确认。

```text
pass：变化基本成立
soft_pass：整体可下，但有小损或不简明
fail：出现明显坏棋，或终点明显低于参考变化
abandoned：用户投降 / 做不下去了
```

## 15.3 PassRule

```ts
type PassRule = {
  evalDropThreshold?: number
  scoreDropThreshold?: number
  severeDropThreshold?: number

  maxBadMoveCount?: number
  requireNoSevereBadMove: boolean

  compareWithReference: boolean
  referenceScoreDropThreshold?: number

  targetDescription?: string
}
```

---

# 16. Review

## 16.1 目标

Review 根据题目状态、bad move、checkpoint comment 和复习间隔安排后续训练。

## 16.2 Review 来源

```text
1. 普通 Problem
2. Punishment Problem
3. 最近失败的 Attempt
4. 最近未完成 Recall Checkpoint 的题
5. 用户手动加入重点复习的题
```

## 16.3 ReviewSchedule

```ts
type ReviewSchedule = {
  itemId: string
  itemType: 'problem' | 'recall_segment'

  dueAt: string
  intervalDays: number

  easeFactor?: number
  lastResult?: 'pass' | 'soft_pass' | 'fail' | 'abandoned'

  consecutivePassCount: number
  totalFailCount: number

  lastReviewedAt?: string
}
```

## 16.4 MVP 调度规则

```text
fail / abandoned：1 天后
soft_pass：3 天后
pass：7 天后
连续 pass：14 / 30 天后
```

后续可引入 SM-2 或更细策略。

---

# 17. 数据表建议

MVP 可保留已有 7 张表，并补充 Tab / Checkpoint 表。

## 17.1 已有核心表

```text
games
recall_sessions
recall_attempts
problems
problem_attempts
bad_moves
review_schedule
```

## 17.2 建议新增

```text
workbench_tabs
recall_checkpoints
training_branches
move_comments
```

### workbench_tabs

记录多标签页状态，可选持久化。MVP 也可以只做内存态。

### recall_checkpoints

记录问题手主动纠错流程。

### training_branches

记录 better alternative / punishment 分支草稿。

### move_comments

记录用户对某手、某个 bad move 或某个 position 的 comment。

---

# 18. 模块拆分建议

训练相关逻辑不要继续堆在 `trainingStore.js`。  
应按职责拆分。

```text
src/modules/training/
  index.js

  store/
    trainingStore.js

  repository/
    trainingRepository.js

  workbench/
    workbenchTabStore.js
    workbenchTabService.js
    workbenchPhaseService.js
    workbenchUiPolicy.js

  attempt/
    attemptService.js
    playTrainingMonitor.js
    moveEvaluationService.js
    passRuleEvaluator.js

  recall/
    recallService.js
    recallCheckpointService.js
    recallReportService.js

  analysis/
    trainingAnalysisService.js
    snapshotService.js
    trainingBranchService.js

  problem/
    problemService.js
    punishmentProblemService.js

  review/
    reviewService.js
    reviewScheduler.js

  adapter/
    analysisSnapshotAdapter.js
    positionSnapshotService.js
```

## 18.1 关键依赖方向

```text
UI
 ↓
WorkbenchTabService / WorkbenchPhaseService
 ↓
AttemptService / RecallService / TrainingAnalysisService
 ↓
PlayTrainingMonitor / MoveEvaluationService / SnapshotService
 ↓
analysisSnapshotAdapter / positionSnapshotService
 ↓
engineService / analysisService / document
```

禁止反向依赖：

```text
engineService 不知道 training
analysisService 不知道 problem
document 不知道 badMove
```

训练模块消费 engine / analysis / document，但不污染它们。

---

# 19. MVP 范围

## 19.1 MVP 目标

跑通最短闭环：

```text
Problem Tab
→ Play 自由作答
→ Submit
→ Recall 回忆作答线
→ 遇到 bad move 进入 checkpoint
→ 用户摆修正图 + comment
→ Analysis 查看 AI 图
→ Snapshot 创建新 Problem Tab
```

同时支持 Game Tab：

```text
Game Tab
→ Play 对局 / 续弈
→ Submit
→ Recall 回忆实战线
→ Analysis 复盘
→ Snapshot 出题
```

## 19.2 MVP 必做

### A. Workbench Tab

- 支持打开 Game Tab；
- 支持打开 Problem Tab；
- 支持从 Snapshot 打开新 Problem Tab；
- 每个 Tab 有独立 phase。

### B. Play Phase

- 支持自由落子；
- 支持后台分析；
- 支持提交；
- 支持记录 Attempt；
- 支持记录 MoveEvaluation；
- 支持记录 BadMove。

### C. Recall Phase

- 支持回忆 attempt line；
- 支持回忆 game line；
- 支持遇到 bad move 暂停；
- 支持用户摆 correction line；
- 支持展示 AI candidate lines；
- 支持用户写 comment；
- 支持继续 Recall。

### D. Analysis Phase

- 支持查看 bad move；
- 支持查看 AI 候选变化；
- 支持自由摆棋；
- 支持 Snapshot。

### E. Snapshot

- 支持从当前局面创建 Problem；
- 支持打开新 Tab；
- 保存来源关系。

### F. Review

- 支持读取到期 Problem；
- Punishment Problem 作为普通 Problem 打开；
- 根据结果更新复习时间。

---

# 20. MVP 暂不做

暂不做：

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
```

---

# 21. 验收标准

## 21.1 Tab / Phase

- 可以打开一个 Problem Tab；
- Tab 初始进入 Play；
- 用户提交后进入 Recall；
- Recall 完成后可以进入 Analysis；
- Analysis 中 Snapshot 可以创建新 Problem 并打开新 Tab；
- 新 Tab 从 Play 开始。

## 21.2 Play

- 用户可以自由下变化；
- 系统后台分析；
- AI overlay 默认不显示；
- 系统可以记录 move evaluations；
- 系统可以检测 bad move；
- 用户可以提交；
- 提交后当前 attempt 被保存。

## 21.3 Recall

- Recall 可以复现用户刚才提交的变化；
- 遇到 bad move 时暂停；
- 用户可以先摆 correction line；
- 系统随后展示 AI candidate lines；
- 用户可以写 comment；
- comment 保存后继续下一手 Recall。

## 21.4 Analysis

- 用户可以看到当前 attempt 的 bad move；
- 用户可以看到 AI candidate lines；
- 用户可以自由摆棋；
- 用户可以从当前局面 Snapshot；
- Snapshot 后创建新 Problem Tab。

## 21.5 Punishment Problem

- bad move 可以生成 `Problem.type = 'punishment'`；
- punishment problem 进入题库 / Review；
- 当前流程不会自动打开 Punishment Tab；
- 未来 Review 打开时，作为普通 Problem Tab 处理。

## 21.6 Review

- 系统能展示到期题；
- 用户完成 Review 后更新下次复习时间；
- 做错题更快再次出现；
- 通过题延长复习间隔。

---

# 22. 风险与应对

## 22.1 Tab 状态复杂

风险：多标签页会增加状态管理复杂度。

应对：

```text
MVP 中 workbench_tabs 可先做内存态；
只持久化 Problem / Attempt / Recall / BadMove / Comment；
Tab 恢复后续再做。
```

## 22.2 Recall checkpoint 可能打断过多

风险：每个 bad move 都 checkpoint，会导致 Recall 变得很重。

应对：

```text
MVP 只对 major / severe bad move 触发；
minor 只记录，不暂停。
```

## 22.3 用户 comment 成本高

风险：要求每次写 comment 可能影响流畅度。

应对：

```text
允许 quick comment；
提供模板；
允许跳过；
但 skipped checkpoint 进入后续 review 提醒。
```

## 22.4 AI 目差波动误判

风险：布局或复杂战斗中，scoreDrop 不一定代表真正坏棋。

应对：

```text
MVP 接受粗糙判断；
支持用户手动标记“不是坏棋”；
后续引入 winrate、ownership、棋块状态、阶段判断。
```

## 22.5 Analysis 中摆棋污染 Attempt

风险：复盘探索线和作答线混在一起。

应对：

```text
Play 提交后 Attempt 冻结；
Analysis 中的新摆法默认属于 exploration；
只有 Snapshot 才创建新 Problem / 新 Tab。
```

---

# 23. 推荐开发顺序

## Phase 1：Tab + Phase 骨架

1. 建立 WorkbenchTab 数据结构；
2. 支持 Problem Tab / Game Tab；
3. 支持 phase 切换：Play → Recall → Analysis；
4. 支持 Snapshot 打开新 Tab。

## Phase 2：Attempt 与坏棋检测

1. 抽出 MoveEvaluationService；
2. 抽出 PlayTrainingMonitor；
3. 统一 Attempt 为唯一数据源；
4. 支持 pending evaluation；
5. 写入 BadMove 的 before/after SGF。

## Phase 3：Recall Checkpoint

1. Recall 能复现 attempt line；
2. major/severe bad move 触发 checkpoint；
3. 用户摆 correction line；
4. 展示 AI candidate lines；
5. 保存 user comment；
6. 继续 Recall。

## Phase 4：Analysis 与 Snapshot

1. Analysis 展示 bad move list；
2. 展示 training branches；
3. 支持自由摆棋；
4. Snapshot 创建 Problem；
5. 打开新 Tab。

## Phase 5：Review 与长期复习

1. Review Queue；
2. Punishment Problem 进入题库；
3. 到期题打开 Problem Tab；
4. 根据结果更新 schedule。

---

# 24. 当前版本结论

本产品第一阶段不追求成为完整围棋平台，而是验证一个核心训练闭环：

```text
一个训练任务
→ 用户先自己下出变化
→ 提交后先 Recall
→ 问题手处先自己修正
→ 再对比 AI 图并 comment
→ Analysis 中自由研究
→ Snapshot 派生新题
→ 新题打开新 Tab
→ 长期进入 Review
```

最终架构应收敛为：

```text
Tab Source = 任务来源
Phase = Play / Recall / Analysis
Attempt = 用户一次提交的变化
Checkpoint = Recall 中的问题手主动纠错
Snapshot = Analysis 中派生新任务
Review = 长期复习调度
```

一句话总结：

> **一道题不是一个孤立页面，而是一个可反复 Play、Recall、Analysis，并能不断派生新问题的训练标签页。**
