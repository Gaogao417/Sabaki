# Gabaki / Sabaki 魔改版围棋训练系统 PRD

> 版本：v0.2  
> 日期：2026-05-14  
> 文档类型：产品需求文档（PRD）  
> 核心定位：面向个人训练的围棋学习工具  
> 本版重点：将“做题模式”重新定义为完整 Play 训练系统上的显性提示 UI，而不是一套独立棋盘模式。

---

## 0. 本版结论

本产品第一阶段的核心不是“新增一个 Problem Mode”，而是把 Sabaki 的 Play 能力升级为完整训练型 Play。

完整 Play 应具备：

```text
用户正常下棋
→ 后台引擎静默分析
→ 系统持续记录坏棋 / 大损点 / 可疑点
→ 生成隐藏的 better-alternative / punishment 分支数据
→ 对局结束后进入 Recall
→ Recall 先让用户回忆棋谱和问题点
→ Analysis / Explore 中显示分支，自由摆棋研究
```

Problem 不再是另一套棋盘交互模式，而是：

```text
Play-like 落子系统
+ 同一套训练监控
+ 题目局面起点
+ 分级提示卡片
+ 提交 / 投降 / 探究状态
```

因此：

```text
Play 与 Problem 的底层训练机制一致。
区别只在 UI policy：

Play：
- 静默监控
- 不实时打断
- 不显示分级提示卡片
- 结束后通过 Recall / Analysis 消化问题

Problem：
- 同样监控
- 实时显示分级提示
- 允许主动提交 / 投降
- 答题结束后进入 Explore
```

一句话：

> Play 是训练系统的底座；Problem 是 Play 的题目化界面；Recall 是 Play 后的记忆检查；Analysis / Explore 是问题分支的研究空间。

---

## 1. 产品背景

当前项目基于 Sabaki 魔改，已经加入对战、分析、题目、复习等方向的功能探索。经过使用和架构讨论后，产品方向需要从“功能堆叠型围棋工具”收敛为一个清晰训练系统。

围棋训练不同于普通刷题：

1. 一盘棋的连续性很重要，背谱 / 回忆是基本功。
2. 单个局面如果没有局面说明，会变成茫然刷题。
3. 围棋题很难用唯一答案判断是否通过。
4. 用户错误走法本身具有训练价值，需要被系统转化为“惩罚题”。
5. 用户在实战中出现的问题，应该先在 Recall 中被重新看见，再在 Analysis 中研究，而不是立刻看答案。
6. Play 本身不应该只是“下棋”，而应该成为训练数据采集和静默诊断的过程。

因此，本产品的训练链路是：

```text
Play 实战
→ 静默训练监控
→ Recall 回忆/背谱/问题点回看
→ Analysis 复盘/自由摆棋
→ Snapshot 出题
→ Problem 做题
→ Bad Move 检测
→ Punishment Problem 惩罚题
→ Review 复习
```

---

## 2. 产品定位

### 2.1 一句话定位

一个以“实战棋谱记忆 + 静默 AI 监控 + 复盘出题 + 自由做题 + 错手惩罚题生成”为核心的个人围棋训练工具。

### 2.2 核心价值

本工具帮助用户完成四件事：

1. **把每一盘棋留下来**  
   不只是保存 SGF，而是保存为可回忆、可复盘、可出题、可复习的训练材料。

2. **把 Play 变成训练数据采集过程**  
   用户正常下棋时，系统在后台静默记录大损点、坏棋点、可疑变化和推荐惩罚手。

3. **把复盘结果变成题目**  
   通过 snapshot 机制，将关键局面转化为带局面说明、任务目标、参考变化和判断规则的题目。

4. **把错误走法变成新的训练材料**  
   用户在 Play 或 Problem 中出现坏棋，系统可以生成 bad move 记录，并在合适时机转化为惩罚题。

---

## 3. 目标用户

### 3.1 当前目标用户

第一阶段只服务一个核心用户：

- 有一定围棋基础；
- 会使用 AI 复盘；
- 想提高实战训练效率；
- 愿意自己判断提交时机；
- 重视背谱、复盘、错手惩罚和长期复习；
- 需要一个比普通 Sabaki / KataGo GUI 更贴近个人训练的工具。

### 3.2 非目标用户

第一阶段不优先服务：

- 完全不会围棋的新手；
- 只想快速看 AI 胜率的人；
- 需要标准化教学课程的机构用户；
- 需要多人题库、云端同步、社区分享的用户；
- 需要自动生成完整围棋讲解文章的用户。

---

## 4. 设计原则

### 4.1 训练优先，不做泛用棋谱编辑器

功能设计必须优先服务训练闭环，而不是追求棋谱编辑器的大而全。

### 4.2 Play 是训练入口，不只是对战入口

Play 的完整形态应包括：

```text
落子
保存棋谱
后台分析
坏棋记录
问题点记录
隐藏训练分支
对局结束后进入 Recall
```

Play 不实时打断用户，但必须为后续 Recall / Analysis / Problem / Review 积累数据。

### 4.3 回忆优先于复盘

对局结束后默认进入 Recall，而不是直接进入 AI Analysis。  
用户先尝试回忆棋局和自己的问题点，再借助 AI 复盘。

### 4.4 题目必须有局面说明

Snapshot 出题时，题目不能只有“黑先/白先，下一手”。  
每道题必须有局面说明，至少回答：

```text
这个局面发生在什么背景下？
当前主要矛盾是什么？
哪块棋轻？哪块棋重？
谁需要攻击？谁需要安定？
为什么这个局面值得练？
```

### 4.5 做题允许自由探索

围棋题不强制用户走唯一答案。  
用户可以自由下变化，系统负责监控每一手是否出现明显坏棋。

### 4.6 提交时机由用户决定

用户认为自己已经想清楚，可以主动提交。  
系统在提交时评估整条变化是否成立。

### 4.7 错误走法自动沉淀

用户的错误走法不是简单丢弃，而是应进入训练数据：

```text
minor：记录，不一定生成题
major：记录，并可生成惩罚题草稿
severe：记录，优先生成惩罚题
```

### 4.8 引擎分析与 UI 展示必须解耦

系统应区分：

```text
analysisRunning：后台是否分析
analysisVisible：AI overlay / 推荐点是否展示
trainingMonitorEnabled：是否记录训练事件
hintCardVisible：是否显示分级提示
```

Play 和 Problem 都可以后台分析，但不一定展示 AI overlay。

---

## 5. 核心工作流

## 5.1 总体闭环

```text
1. Play
   用户和 AI / 人类对战，系统静默监控每手质量。

2. Recall
   对局结束后默认进入回忆模式。
   用户先复现棋谱，并看到自己出现问题的节点，但不直接看答案。

3. Analysis
   用户进入复盘模式。
   系统展示用户分支、AI 替代分支、惩罚分支和目差变化。

4. Snapshot to Problem
   用户从关键局面 snapshot 出正式题目。

5. Problem
   用户基于题目局面自由下变化。
   系统实时显示分级提示。

6. Submit / Surrender
   用户主动提交，或投降进入探究态。

7. Explore
   系统根据答题分支帮助回顾过程中大损的招法。

8. Punishment Problem
   对 major / severe bad move 自动生成惩罚题草稿。

9. Review
   系统根据复习计划、错误记录和题目状态安排复习。
```

---

# 6. 核心概念

## 6.1 SessionKind

```ts
type TrainingSessionKind =
  | 'play'
  | 'problem'
  | 'recall'
  | 'analysis'
  | 'review'
```

其中 `play` 与 `problem` 共享 Play-like 落子和训练监控。

## 6.2 Phase

```ts
type TrainingPhase =
  | 'live'       // Play 实战中 / Problem 答题中
  | 'answer'     // Problem 答题态
  | 'recall'     // 回忆态
  | 'explore'    // 探究态
  | 'submitted'  // 已提交
  | 'abandoned'  // 放弃 / 投降
```

## 6.3 UI Policy

不同场景不是靠重写棋盘逻辑，而是靠 UI policy 控制：

```ts
type TrainingUIPolicy = {
  analysisRunning: boolean
  analysisVisible: boolean
  trainingMonitorEnabled: boolean
  hintCardVisible: boolean
  submitVisible: boolean
  branchVisible: boolean
  recallProblemPointVisible: boolean
  allowFreeExplore: boolean
}
```

示例：

```ts
const playLivePolicy = {
  analysisRunning: true,
  analysisVisible: false,
  trainingMonitorEnabled: true,
  hintCardVisible: false,
  submitVisible: false,
  branchVisible: false,
  recallProblemPointVisible: false,
  allowFreeExplore: false
}

const problemAnswerPolicy = {
  analysisRunning: true,
  analysisVisible: false,
  trainingMonitorEnabled: true,
  hintCardVisible: true,
  submitVisible: true,
  branchVisible: false,
  recallProblemPointVisible: false,
  allowFreeExplore: false
}

const explorePolicy = {
  analysisRunning: true,
  analysisVisible: true,
  trainingMonitorEnabled: false,
  hintCardVisible: false,
  submitVisible: false,
  branchVisible: true,
  recallProblemPointVisible: false,
  allowFreeExplore: true
}
```

---

# 7. 功能需求

---

## 7.1 Play：完整训练型对战

### 7.1.1 目标

Play 不只是产生棋谱，而是产生完整训练材料：

```text
SGF
每手评估
坏棋记录
问题节点
隐藏训练分支
后续 Recall / Analysis 入口
```

### 7.1.2 基础功能

- 新建对局；
- 选择执黑 / 执白；
- 选择 AI / 人类；
- 选择 AI 强度；
- 支持让子；
- 支持时间设置；
- 支持中途保存；
- 支持对局结束自动归档；
- 保存完整 SGF；
- 保存对局元数据。

### 7.1.3 Play 中的后台监控

Play 过程中：

```text
engine 后台保持分析
AI overlay 默认关闭
系统监听用户落子
每手生成 MoveEvaluation
major / severe bad move 生成 BadMoveDraft
必要时生成 TrainingBranchDraft
UI 不实时打断用户
```

### 7.1.4 Play 结束后的默认动作

```text
保存棋局
→ 保存 PlaySession 训练数据
→ 创建默认 RecallSession
→ 进入 Recall
```

### 7.1.5 Game 数据结构

```ts
type Game = {
  id: string
  title?: string
  createdAt: string
  updatedAt: string
  source: 'play' | 'import'
  sgf: string
  playerColor: 'black' | 'white'
  opponentType: 'ai' | 'human' | 'unknown'
  aiEngine?: string
  aiLevel?: string
  result?: string
  tags: string[]
  notes?: string
}
```

---

## 7.2 Training Monitor：通用坏棋监控

### 7.2.1 目标

为 Play 和 Problem 提供同一套“落子质量监控”能力。

### 7.2.2 触发时机

每当用户下一手：

```text
记录 before position
记录 user move
更新棋谱树
触发 / 等待 after position 分析
生成 MoveEvaluation
必要时生成 BadMoveDraft 和 TrainingBranchDraft
```

### 7.2.3 实时坏棋检测

基础算法：

```text
beforeEval = 当前手之前的 AI 评估
afterEval = 用户落子之后的 AI 评估
scoreDrop = afterEval.scoreLead - beforeEval.scoreLead
```

注意：scoreLead 必须统一到“当前训练方视角”。

示例：

```text
若当前训练方为黑：
scoreDrop = afterBlackLead - beforeBlackLead

若当前训练方为白：
scoreDrop = beforeBlackLead - afterBlackLead
```

### 7.2.4 默认阈值

MVP 默认：

```text
minor：亏 2 目以上
major：亏 5 目以上
severe：亏 8 目以上
```

后续可结合：

```text
布局阶段：阈值可放宽
中盘阶段：结合 winrate 与棋块状态
官子阶段：目差阈值更敏感
死活题：目标棋块状态优先
```

### 7.2.5 异步分析策略

引擎分析是异步的，因此不能简单在无 analysis 时跳过坏棋检测。

MVP 建议：

```text
允许用户继续下棋
先创建 pending MoveEvaluation
等 analysis-update 返回后补算
```

可选策略：

```text
策略 A：未分析完不允许落子
策略 B：允许落子，之后补算
```

优先采用策略 B。

---

## 7.3 Training Branch：隐藏训练分支

### 7.3.1 分支类型

训练系统生成两类分支。

#### A. Better Alternative

锚定在坏棋之前的父节点。

```text
父节点 P
├─ 用户坏棋 A
└─ AI 更好选择 B
```

回答：

```text
你刚才本来可以怎么下？
```

#### B. Punishment

锚定在坏棋之后的节点。

```text
父节点 P
└─ 用户坏棋 A
   ├─ 用户后续
   └─ 对手惩罚手 C
```

回答：

```text
你这手为什么坏？对手下一手怎么惩罚你？
```

### 7.3.2 展示策略

训练分支不应该在 Play / Problem Answer 中立刻污染变化树。

```text
Play 进行中：隐藏
Problem Answer：隐藏
Recall：只显示问题点，不显示完整答案
Analysis / Explore：显示完整分支
```

### 7.3.3 数据结构

```ts
type TrainingBranch = {
  id: string
  source: 'play' | 'problem'
  sourceSessionId: string
  anchorTreePosition: string
  kind: 'better_alternative' | 'punishment'
  triggerMoveNodeId: string
  triggerMoveIndex: number
  triggerMove: string
  severity: 'minor' | 'major' | 'severe'
  scoreDrop?: number
  moves: string[]
  visibleIn: Array<'recall' | 'analysis' | 'explore'>
  createdAt: string
}
```

MVP 可先只保存在内存 session 中，后续再持久化或注入 game tree metadata。

---

## 7.4 Recall：回忆 / 背谱 / 问题点回看

### 7.4.1 目标

训练用户对刚下过棋局的连续性记忆，并先看见自己出现问题的地方。

### 7.4.2 入口

Play 结束后默认进入。  
也可以从 Game Detail 页面手动进入。

### 7.4.3 回忆类型

#### A. 整盘回忆

用户从第 1 手开始复现整盘棋。

```text
系统隐藏后续棋谱
用户每下一手，系统判断是否与实战一致
```

#### B. 关键节点回忆

用户从系统或手动标记的关键节点开始，复现后续若干手。

#### C. 局部片段回忆

用户只回忆某个局部战斗片段。

#### D. 错误片段回忆

用户回忆自己在实战中出现失误的片段。

### 7.4.4 问题点展示

Recall 阶段可以显示：

```text
第几手出现大损
大致发生在哪个区域
严重程度 minor / major / severe
这手之后形势变化明显
```

Recall 阶段不直接显示：

```text
AI top move
完整惩罚变化
完整推荐答案
```

这些应在 Analysis / Explore 中展示。

### 7.4.5 回忆判断

每一步判断：

- 是否与实战手一致；
- 是否在同一区域；
- 是否为合理转置；
- 是否需要提示；
- 用户尝试次数。

MVP 阶段可先只做“是否与实战手一致”。

### 7.4.6 Recall 数据结构

```ts
type RecallSession = {
  id: string
  gameId: string
  mode: 'full_game' | 'key_segment' | 'local_segment' | 'mistake_segment'
  startMove: number
  endMove?: number
  attempts: RecallAttempt[]
  problemPoints?: RecallProblemPoint[]
  createdAt: string
  completedAt?: string
}

type RecallAttempt = {
  moveNumber: number
  expectedMove: string
  userMove: string
  isCorrect: boolean
  hintLevelUsed: number
  timestamp: string
}

type RecallProblemPoint = {
  moveNumber: number
  severity: 'minor' | 'major' | 'severe'
  scoreDrop?: number
  regionHint?: string
  revealed: boolean
}
```

---

## 7.5 Analysis / Explore：复盘与探究

### 7.5.1 目标

帮助用户比较实战 / 答题分支与参考变化，理解大损点。

### 7.5.2 入口

- Recall 结束后进入；
- Game Detail 页面进入；
- Problem 提交 / 投降后进入；
- 惩罚题回溯进入。

### 7.5.3 核心视图

Analysis / Explore 至少包含：

```text
Main Board：当前棋盘
Reference Board：参考棋盘
Move Tree：变化树
Engine Panel：AI 推荐与评估
Snapshot Panel：出题面板
Position Note：当前局面说明
Problem Point List：问题点列表
Training Branch List：better alternative / punishment 分支
```

### 7.5.4 Reference Board

Reference Board 用于展示：

- AI 推荐变化；
- 用户实战变化；
- 用户做题变化；
- 用户自定义参考变化；
- 题目答案变化；
- 惩罚变化。

### 7.5.5 Current vs Reference 比较

MVP 优先实现：

```text
当前变化终点目差
参考变化终点目差
二者差值
是否出现剧烈恶化
```

后续加入：

```text
ownership 差异
局部棋块状态
先后手关系
实地与潜力变化
厚薄变化
```

---

## 7.6 Snapshot to Problem：从复盘生成题目

### 7.6.1 目标

将关键局面整理为正式题目。

### 7.6.2 Snapshot 输入

```ts
type ProblemSnapshotInput = {
  gameId: string
  moveNumber: number
  positionSgf: string
  sideToMove: 'black' | 'white'
  referenceLine?: string[]
  currentLine?: string[]
  sourceBadMoveId?: string
}
```

### 7.6.3 题目必须包含

```ts
type Problem = {
  id: string
  sourceGameId?: string
  sourceMoveNumber?: number
  sourceProblemId?: string
  sourceBadMoveId?: string
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
  createdAt: string
  updatedAt: string
}
```

### 7.6.4 题目类型

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

### 7.6.5 局面说明

示例：

```text
白棋右边尚未完全安定，黑棋中央较厚。
实战中黑选择左下补棋，但此时更重要的是利用厚势继续压迫白棋。
本题重点是判断攻击方向，而不是计算单一死活。
```

### 7.6.6 任务目标

示例：

```text
目标：找到黑棋继续攻击白棋的方向，并避免让白棋轻松安定。
```

### 7.6.7 参考变化

```ts
type ReferenceLine = {
  id: string
  label: string
  moves: string[]
  description?: string
  engineEval?: {
    scoreLead?: number
    winrate?: number
    visits?: number
  }
  isPrimary: boolean
}
```

### 7.6.8 通过规则

```ts
type PassRule = {
  evalDropThreshold?: number
  scoreDropThreshold?: number
  severeDropThreshold?: number
  maxBadMoveCount?: number
  requireNoSevereBadMove: boolean
  compareWithReference: boolean
  targetDescription?: string
}
```

MVP 默认：

```text
如果用户提交变化中出现 severe bad move，则失败。
如果出现 major bad move，则通常失败或勉强通过。
如果终点相比参考变化亏损超过阈值，则失败。
如果没有明显坏棋，且用户主动提交，则通过。
```

---

## 7.7 Problem：题目化 Play

### 7.7.1 目标

用户基于题目局面自由下变化，系统实时显示分级提示，并在提交时判断是否通过。

### 7.7.2 基本流程

```text
进入题目
→ 阅读局面说明
→ 用户自由下变化
→ 系统后台评估每一手
→ 若出现坏棋，给出分级提示
→ 用户继续探索 / 悔棋 / 看提示
→ 用户点击提交或投降
→ 进入 Explore
→ 系统帮助回顾大损招法
```

### 7.7.3 Problem Answer 状态

```text
analysisRunning = true
analysisVisible = false
trainingMonitorEnabled = true
hintCardVisible = true
submitVisible = true
branchVisible = false
allowFreeExplore = false
```

用户可以：

```text
落子
悔棋
看分级提示
提交
投降
```

### 7.7.4 Problem Explore 状态

```text
analysisRunning = true
analysisVisible = true
trainingMonitorEnabled = false / readonly
hintCardVisible = false 或 review-only
submitVisible = false
branchVisible = true
allowFreeExplore = true
```

用户可以：

```text
看 AI overlay
看 bad move list
看 better alternative
看 punishment branch
自由摆棋
从某个问题点生成惩罚题
重新答题
```

### 7.7.5 做题界面

应包含：

```text
Main Board：用户下变化
Problem Brief：局面说明与任务目标
Eval Monitor：目差 / 胜率变化提示
Hint Panel：分级提示区
Submit Button：用户主动提交
Surrender Button：投降进入 Explore
Attempt Timeline：用户本次尝试路径
Problem Point List：大损招法列表
Reference Board：默认隐藏，Explore 中显示
```

### 7.7.6 坏棋提示层级

```text
Level 1：这手之后形势明显恶化。
Level 2：问题大致出在某个区域。
Level 3：对方有一手强烈反击。
Level 4：显示对方惩罚第一手。
Level 5：显示完整惩罚变化。
```

### 7.7.7 提交结果

```text
通过：
变化基本成立，没有明显被惩罚点。

勉强通过：
整体可下，但存在轻微损失或局部处理不够简明。

失败：
变化中出现明显坏棋，或提交终点相比参考变化恶化明显。
```

### 7.7.8 Attempt 数据结构

```ts
type ProblemAttempt = {
  id: string
  problemId: string
  phase: 'answer' | 'explore' | 'submitted' | 'abandoned'
  startedAt: string
  submittedAt?: string
  userLine: string[]
  moveEvaluations: MoveEvaluation[]
  badMoves: BadMoveDraft[]
  result?: 'pass' | 'soft_pass' | 'fail' | 'abandoned'
  hintLevelUsed: number
  generatedPunishmentProblemIds: string[]
}
```

运行时应以 `problemAttempt` 为唯一数据源，避免同时维护 `problemEvalCache`、`problemBadMoves` 等重复状态。

---

## 7.8 Bad Move

### 7.8.1 目标

记录用户在 Play 或 Problem 中出现的大损招法，为 Recall、Analysis、Punishment Problem 和 Review 提供数据。

### 7.8.2 数据结构

```ts
type MoveEvaluation = {
  moveIndex: number
  move: string
  beforeScoreLead?: number
  afterScoreLead?: number
  scoreDrop?: number
  beforeWinrate?: number
  afterWinrate?: number
  winrateDrop?: number
  isBadMove: boolean
  severity: 'none' | 'minor' | 'major' | 'severe'
  engineSuggestedBetterMove?: string
  engineSuggestedPunishMove?: string
  pending?: boolean
}

type BadMove = {
  id: string
  source: 'play' | 'problem'
  gameId?: string
  problemId?: string
  attemptId?: string
  moveIndex: number
  move: string
  positionBeforeMoveSgf: string
  positionAfterMoveSgf: string
  severity: 'minor' | 'major' | 'severe'
  scoreDrop?: number
  winrateDrop?: number
  punishSide: 'black' | 'white'
  suggestedPunishMove?: string
  generatedProblemId?: string
  createdAt: string
}
```

### 7.8.3 必须保存 SGF 快照

BadMove 必须保存：

```text
positionBeforeMoveSgf
positionAfterMoveSgf
```

否则后续无法重建惩罚题局面。

---

## 7.9 Punishment Problem：惩罚题

### 7.9.1 目标

当用户下出错误走法时，系统自动生成新题，训练“对方如何惩罚这手”。

### 7.9.2 生成条件

满足任一条件可生成惩罚题：

```text
1. 用户某手导致目差剧烈恶化
2. 用户某手导致胜率剧烈下降
3. AI 显示对方有明确强手
4. 用户手动标记“这手需要惩罚题”
```

MVP：

```text
major / severe bad move 可生成惩罚题草稿。
minor 只记录，不自动生成题。
```

### 7.9.3 惩罚题内容

```ts
type PunishmentProblem = Problem & {
  type: 'punishment'
  parentProblemId?: string
  parentGameId?: string
  parentAttemptId?: string
  badMoveId: string
  badMove: string
  punishSide: 'black' | 'white'
  punishMove?: string
}
```

### 7.9.4 惩罚题说明模板

```text
这是从《{来源标题}》中自动生成的惩罚题。
用户在该局面下选择了 {错误手}，导致形势明显恶化。
现在轮到 {惩罚方}，请找出惩罚这手的关键手段。
```

### 7.9.5 惩罚题状态

自动生成的惩罚题先进入 `inbox` 状态。

用户可选择：

```text
加入正式题库
编辑局面说明
添加参考变化
删除
暂时保留
```

---

## 7.10 Review：复习模式

### 7.10.1 目标

根据题目状态、复习间隔和错误记录安排复习。

### 7.10.2 复习来源

```text
正式题库中的到期题
最近做错的题
最近生成的惩罚题
记忆失败的 Recall Segment
用户手动加入的重点题
```

### 7.10.3 复习策略

MVP：

```text
失败：1 天后复习
看提示后通过：3 天后复习
独立通过：7 天后复习
连续独立通过：14 / 30 天后复习
再次失败：重置为 1 天
```

后续可实现 SM-2 / ease factor。

### 7.10.4 Review 数据结构

```ts
type ReviewSchedule = {
  itemId: string
  itemType: 'problem' | 'recall_segment'
  dueAt: string
  intervalDays: number
  easeFactor?: number
  lastResult?: 'pass' | 'soft_pass' | 'fail'
  consecutivePassCount: number
  totalFailCount: number
}
```

---

# 8. 页面与模式设计

## 8.1 Training Dashboard

首页不是功能入口堆叠，而是训练驾驶舱。

展示内容：

```text
今日训练
- 到期题目数量
- 最近生成的惩罚题
- 最近未完成复盘的棋局
- 最近未完成回忆的棋局
- 当前重点标签
```

主要操作：

```text
开始今日复习
继续上次回忆
继续上次复盘
开始 AI 对战
录入题目
查看题库
```

---

## 8.2 Game Detail

内容：

```text
棋局基本信息
SGF 棋谱
Play 监控摘要
Recall 记录
复盘记录
从本局生成的题目
从本局生成的惩罚题
```

操作：

```text
进入回忆
进入复盘
查看问题点
查看相关题目
```

---

## 8.3 Recall 页面

核心布局：

```text
顶部：棋局信息 / 当前回忆进度
中间：Main Board
右侧：Recall Panel
底部：问题点 Timeline
```

问题点 Timeline 显示：

```text
第几手
严重程度
是否已经回忆到
是否已进入 Analysis 查看
```

---

## 8.4 Analysis / Explore 页面

核心布局：

```text
顶部：棋局信息 / 当前手数 / 模式切换
左侧：Move Tree / 变化树
中间：Main Board
右侧：Reference Board + Engine Panel
底部：Snapshot / Note / Reference Line / Problem Point
```

---

## 8.5 Problem 页面

核心布局：

```text
顶部：题目标题 / 类型 / 难度 / 来源
左侧：Problem Brief
中间：Main Board
右侧：Hint / Eval / Reference
底部：Attempt Timeline / Submit
```

Answer 态：

```text
Reference 默认隐藏
AI overlay 关闭
HintCard 开启
Submit 可用
```

Explore 态：

```text
Reference 显示
AI overlay 开启
分支显示
Submit 不可用
允许自由摆棋
```

---

## 8.6 Problem Inbox

用于管理未整理题目。

来源包括：

```text
Analysis snapshot 生成的题
Play / Problem bad move 生成的惩罚题
快速录入模式生成的题
外部题库同步生成的题
```

操作：

```text
编辑
加入正式题库
归档
删除
批量打标签
```

---

# 9. 数据模型总览

```text
Game
 ├─ PlaySession
 │   ├─ MoveEvaluation
 │   ├─ BadMove
 │   └─ TrainingBranch
 ├─ RecallSession
 │   └─ RecallAttempt
 ├─ AnalysisSession
 ├─ Problem
 │   ├─ ReferenceLine
 │   ├─ ProblemAttempt
 │   │   ├─ MoveEvaluation
 │   │   ├─ BadMove
 │   │   └─ TrainingBranch
 │   └─ ReviewSchedule
 └─ PositionNote
```

## 9.1 DB 表

MVP 预计至少包含：

```text
games
recall_sessions
recall_attempts
problems
problem_attempts
bad_moves
review_schedule
```

可选新增：

```text
play_sessions
move_evaluations
training_branches
position_notes
```

如果暂不新增表，可以先把 PlaySession / TrainingBranch 作为 JSON 字段存在 session 或 problem_attempt 中。

---

# 10. 模块拆分方案

本 PRD 要求训练逻辑从巨型 `trainingStore` 中拆出。  
已有的 `engine / analysis / document` 模块不动，训练模块只消费它们的数据，不反向污染。

## 10.1 推荐目录

```text
src/modules/training/
  index.js

  trainingStore.js
  trainingRepository.js

  session/
    trainingSessionService.js
    trainingModePolicy.js

  monitor/
    playTrainingMonitor.js
    moveEvaluationService.js
    analysisSnapshotAdapter.js
    trainingBranchService.js
    positionSnapshotService.js

  problem/
    problemService.js
    problemAttemptService.js
    punishmentProblemService.js
    passRuleEvaluator.js

  recall/
    recallService.js
    recallProblemPointService.js

  review/
    reviewService.js
    reviewScheduler.js

  game/
    trainingGameService.js

  ui/
    trainingSelectors.js
```

## 10.2 模块职责

### trainingStore

只做前端状态容器：

```text
getState
setState
subscribe
```

不负责业务计算，不直接写 DB，不直接读 engine。

### trainingRepository

所有 DB / IPC 读写集中在这里：

```text
saveGame / getGame
saveRecallSession / saveRecallAttempts
getProblem / saveProblem
saveProblemAttempt / updateProblemAttempt
saveBadMove / updateBadMoveGeneratedProblem
getDueReviews / upsertReviewSchedule
```

### playTrainingMonitor

Play 和 Problem 共用的坏棋监控器：

```text
监听落子
获取 before / after eval
生成 MoveEvaluation
生成 BadMoveDraft
生成 TrainingBranchDraft
```

### moveEvaluationService

纯逻辑：

```text
scoreDrop 计算
winrateDrop 计算
side perspective 统一
severity 判定
passRule 阈值覆盖
```

### analysisSnapshotAdapter

隔离 training 与 engine / analysis：

```text
getSnapshotForPosition
getCurrentSnapshot
waitForSnapshot
```

### trainingBranchService

生成 better alternative / punishment 分支。

### positionSnapshotService

生成局面 SGF 快照：

```text
positionBeforeMoveSgf
positionAfterMoveSgf
currentPositionSgf
```

### problemAttemptService

管理做题 attempt：

```text
startAttempt
appendMoveEvaluation
undoLastMove
submitAttempt
surrenderAttempt
enterExplore
```

### passRuleEvaluator

判断：

```text
pass
soft_pass
fail
```

### punishmentProblemService

负责：

```text
badMove -> punishment problem draft
保存 punishment problem
回填 badMove.generatedProblemId
```

### recallService

管理背谱 session。

### recallProblemPointService

从 PlaySession 的 bad moves 中提取 Recall 问题点。

### reviewScheduler

根据结果计算下一次复习时间。

---

## 10.3 依赖方向

依赖必须单向：

```text
UI
 ↓
trainingSessionService / problemService / recallService / reviewService
 ↓
playTrainingMonitor / moveEvaluationService / trainingBranchService
 ↓
analysisSnapshotAdapter / positionSnapshotService
 ↓
engineService / analysisService / documentStore
```

禁止反向依赖：

```text
engineService 不知道 training
analysisService 不知道 problem
documentStore 不知道 badMove
```

---

# 11. MVP 范围

## 11.1 MVP 目标

跑通最短训练闭环：

```text
Play 静默监控
→ Play 结束进入 Recall
→ Recall 看到问题点
→ Analysis 显示分支
→ Snapshot 出题
→ Problem 答题
→ Submit 判断
→ BadMove 生成惩罚题
→ Review 到期题
```

## 11.2 MVP 必做

### A. Play 静默监控

- Play 时后台 engine 分析；
- overlay 默认关闭；
- 每手生成 MoveEvaluation；
- major / severe bad move 生成 BadMoveDraft；
- 对局结束后保存训练摘要。

### B. Recall v1

- 支持整盘回忆；
- 判断是否与实战手一致；
- 显示问题点位置和严重程度；
- 不直接显示 AI 正解；
- 允许结束后进入 Analysis。

### C. Analysis / Explore v1

- 支持 Main Board；
- 支持问题点列表；
- 支持查看 punishment / better alternative 分支；
- 支持 snapshot 当前局面。

### D. Problem Editor v1

- 生成题目；
- 要求填写局面说明；
- 要求填写任务目标；
- 题目进入题库或 inbox。

### E. Problem v1

- 用户自由下变化；
- 系统调用引擎评估；
- 检测每手 scoreDrop；
- 显示分级提示；
- 用户主动提交 / 投降；
- 提交后进入 Explore。

### F. Punishment Problem v1

- major / severe bad move 后自动生成惩罚题草稿；
- bad move 写入 bad_moves；
- bad move 必须带 before / after SGF；
- 惩罚题进入 inbox。

### G. Review v1

- 显示到期题；
- 支持普通题和惩罚题；
- 根据结果更新复习间隔。

---

## 11.3 MVP 暂不做

```text
云同步
多人账号
复杂能力画像
社区题库
自动长文讲解
精细 ownership 比较
完整死活状态判断
复杂标签体系
可视化统计大屏
完整 SM-2
复杂题库同步
```

---

# 12. 验收标准

## 12.1 Play → Recall

- 用户完成一盘对局后，系统保存 game；
- Play 过程中后台记录至少 move evaluations；
- major / severe 问题点被记录；
- 对局结束后进入 Recall；
- Recall 能显示问题点，但不直接显示答案。

## 12.2 Recall → Analysis

- 用户可以从 Recall 进入 Analysis；
- Analysis 可以定位到 Recall 中的问题点；
- Analysis 可以查看原始棋谱；
- Analysis 可以显示对应 training branch。

## 12.3 Analysis → Problem

- 用户可以在任意局面 snapshot；
- 题目必须包含局面说明；
- 题目必须包含先行方；
- 保存后进入题库或 inbox。

## 12.4 Problem Attempt

- 用户可以在题目中自由下变化；
- 系统可以对每手请求 / 等待 AI 评估；
- 系统可以检测 scoreDrop；
- 系统可以显示坏棋提示；
- 用户可以点击提交；
- 用户可以投降进入 Explore；
- 系统给出 pass / soft_pass / fail。

## 12.5 BadMove

- BadMove 必须保存 moveIndex、move、severity、scoreDrop；
- BadMove 必须保存 positionBeforeMoveSgf 与 positionAfterMoveSgf；
- BadMove 应保存 suggestedPunishMove；
- BadMove 可以关联 generatedProblemId。

## 12.6 Punishment Problem

- 用户下出严重坏棋后，系统可以生成惩罚题草稿；
- 惩罚题包含来源题 / 来源棋局、错误手、惩罚方、局面说明模板；
- 惩罚题进入 inbox。

## 12.7 Review

- 系统能展示到期题；
- 用户完成复习后，系统更新下一次复习时间；
- 做错题会更快再次出现；
- 通过题会延长复习间隔。

---

# 13. 关键风险与应对

## 13.1 围棋题通过标准不稳定

风险：AI top move 不等于人类唯一正解。

应对：

```text
不按唯一答案判断
看是否明显坏棋
看提交变化是否整体成立
看与参考变化差距是否超过阈值
```

## 13.2 目差波动不一定代表坏棋

风险：布局或复杂战斗中，AI 目差可能波动，单纯按目差判断会误伤。

应对：

```text
MVP 先接受粗糙判断
允许用户手动覆盖
后续加入 winrate / ownership / 棋块状态
```

## 13.3 引擎分析异步导致漏判

风险：用户快速下子时，当前局面的 analysis 还没返回。

应对：

```text
创建 pending evaluation
analysis-update 返回后补算
必要时在 UI 显示“评估中”
```

## 13.4 自动分支污染棋谱树

风险：实时注入 what-if 分支会让变化树混乱。

应对：

```text
先生成 TrainingBranchDraft
Play / Answer 中隐藏
Analysis / Explore 中再显示或注入
```

## 13.5 惩罚题数量爆炸

风险：用户做题频繁出错，自动生成大量惩罚题。

应对：

```text
minor 只记录
major / severe 才生成草稿
同一 attempt 中相似 bad move 合并
惩罚题先进 inbox
```

## 13.6 Store 变成巨石

风险：trainingStore 同时管理 DB、业务逻辑、状态、UI，难以维护。

应对：

```text
trainingStore 只做状态容器
业务拆到 service
DB 拆到 repository
纯逻辑拆到 evaluator / scheduler
```

---

# 14. 推荐开发顺序

## Phase 1：先修数据一致性和纯逻辑

1. 抽 `moveEvaluationService`；
2. 统一 `problemAttempt` 为唯一数据源；
3. 删除 / 废弃 `problemEvalCache` 与 `problemBadMoves` 双份状态；
4. 让 passRule 接管阈值，而不是硬编码。

## Phase 2：补齐 BadMove 快照

1. 抽 `positionSnapshotService`；
2. 写入 `positionBeforeMoveSgf`；
3. 写入 `positionAfterMoveSgf`；
4. 写入 `winrateDrop`；
5. 确保惩罚题可以从 badMove 重建局面。

## Phase 3：抽 ProblemAttemptService

1. startProblem；
2. handleProblemMove；
3. undoProblemMove；
4. submitProblemAttempt；
5. surrender / enterExplore。

## Phase 4：抽 PlayTrainingMonitor

1. 让 Play 和 Problem 共用 move evaluation；
2. Play 静默记录；
3. Problem 实时提示；
4. 对局结束后把问题点交给 Recall。

## Phase 5：训练分支

1. 抽 trainingBranchService；
2. 生成 better alternative；
3. 生成 punishment branch；
4. Analysis / Explore 中展示；
5. 暂不强制实时注入 game tree。

## Phase 6：Recall 问题点

1. Recall 显示 Play 中的大损点；
2. 不显示答案；
3. Analysis 中再显示完整分支。

## Phase 7：Review 与 Inbox 优化

1. 惩罚题进入 inbox；
2. 到期题显示；
3. 复习结果更新 schedule；
4. 后续再实现 SM-2。

---

# 15. 后续迭代方向

## 15.1 更智能的 Recall

- 支持关键节点自动抽取；
- 根据胜率 / 目差波动生成回忆片段；
- 支持局部片段复现；
- 支持错手片段复习。

## 15.2 更强的题目说明生成

- 根据 AI 推荐变化自动生成局面说明；
- 根据 current/reference 差异生成“为什么这手重要”；
- 根据用户错手生成专门的错误解释。

## 15.3 Reference / Current 高级比较

- ownership 差异图；
- 领地变化高亮；
- 棋块状态变化；
- 先后手变化；
- 厚薄变化标注。

## 15.4 能力画像

基于题目标签和结果统计：

```text
攻击方向
治孤
死活
手筋
官子
形势判断
背谱能力
惩罚能力
```

## 15.5 专题训练

支持用户选择：

```text
今日只练惩罚题
今日只练攻击方向
今日只复习最近三盘棋
今日只背谱
今日只做官子题
```

---

# 16. 术语表

## Game

一盘完整棋局，通常来自 Play 或外部 SGF 导入。

## Play

完整训练型对战模式。用户正常下棋，系统后台静默分析和记录问题点。

## Training Monitor

通用训练监控器。监听用户落子，计算每手质量，记录 bad move 和训练分支。

## Recall

回忆模式。用户在不看完整棋谱和 AI 答案的情况下复现棋局，并看到自己问题点。

## Analysis

复盘模式。用户借助 AI、reference board、变化树分析棋局。

## Explore

Problem 提交 / 投降后的探究态，本质上接近 Analysis，但上下文来自一次 attempt。

## Snapshot

从某一局面创建题目的动作。

## Problem

题目化 Play。使用同一套落子和训练监控，但显示分级提示和提交按钮。

## Problem Attempt

用户做某一道题的一次尝试。

## Bad Move

用户在 Play 或 Problem 中出现的明显坏棋。

## Training Branch

系统基于 bad move 生成的隐藏训练分支，包括 better alternative 和 punishment。

## Punishment Problem

由 Bad Move 自动生成的新题，训练“对方如何惩罚这手”。

## Reference Line

参考变化，可以来自 AI 推荐、用户手动选择或题目答案。

## Review

复习模式，根据复习计划安排题目和回忆片段。

---

# 17. 当前版本结论

本产品第一阶段不追求成为完整围棋平台，而要优先验证一件事：

> 一盘实战棋，能否稳定转化为可回忆、可复盘、可做题、可惩罚、可复习的训练材料。

v0.2 的关键设计是：

```text
不要把 Problem 做成另一套棋盘模式。
先把 Play 升级成完整训练型 Play。
Problem 只是 Play 的题目化 UI。
```

只要以下闭环跑通，产品就具备核心价值：

```text
下完一盘棋
→ 系统静默记录问题
→ 先背下来并看到问题点
→ 再复盘关键处
→ 把关键局面变成题
→ 做题时自由探索
→ 系统检查是否有坏棋
→ 坏棋自动变成惩罚题
→ 以后反复复习
```
