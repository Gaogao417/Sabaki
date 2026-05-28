# Gabaki / Sabaki 魔改版围棋训练系统 PRD

> 版本：v0.7  
> 文档类型：产品需求文档（PRD）  
> 核心定位：面向个人训练的围棋学习工具  
> 当前目标：从“AI 分析棋盘”升级为“Attempt 主动回忆纠错 + 复盘出题 + 自由做题 + 错手惩罚 + 长期复习”的训练系统

## 文档地位

本文是 Gabaki / Sabaki 魔改版训练系统的产品全量蓝图，定义产品目标、训练闭环、核心功能、数据对象和验收方向。

- 历史 v0.5 PRD 归档在 [Gabaki / Sabaki Training PRD v0.5](../archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md)，用于追溯 Attempt / RecallCheckpoint 的收敛口径。
- 历史 v0.6 PRD 归档在 [Gabaki / Sabaki Training PRD v0.6](../archive/prd-versions/gabaki-sabaki-training-prd-v0.6.md)，用于追溯 Game / Problem Editor / Punishment Problem / Review 的产品化扩展。
- 当前 v0.7 是 v0.5 与 v0.6 的合并修正版：保留 v0.6 的产品闭环，恢复 v0.5 的 Attempt 中心和 Recall 中主动纠错 checkpoint。
- 当前工作台视觉实现以 [Workbench UI/UX Spec](../ui_ux/workbench-ui-ux-spec.md) 为准。
- 当前六屏视觉参考归档在 [2026-05-26 Six Screen References](../ui_ux/workbench-ref-pics/2026-05-26-six-screen/)。
- 当前运行态状态机以 [Workbench Mode Orchestration Contract](../design/workbench-mode-orchestration-contract.md) 为准。
- 当前模块架构以 [Training Architecture v0.5](../architecture/gabaki-sabaki-training-architecture-v0.5.md) 为准。
- 当前长期迁移执行以 [Training Implementation Plan](../architecture/gabaki-sabaki-training-implementation-plan.md) 为准。
- 棋盘读写边界以 [Position Source and Mutation Contract](../architecture/position-source-mutation-contract.md) 为准。
- Play Mode 普通交替落子和 AI 应手边界以 [PlayMoveCommitted Architecture](../design/play-move-committed-architecture.md) 为准。
- 野狐对局数据入口以 [Fox Game Import PRD](./fox_game_import_prd.md) 为准，并必须进入本 PRD 的
  TrainingTask / Game / Recall 训练闭环。
- 101 围棋错题入口以 [101 Weiqi Error Sync PRD](./101weiqi_error_sync_prd.md) 为准，并必须进入本 PRD
  的 Problem / Review 训练闭环。
- 如 PRD 与具体 UI/UX 方案存在范围差异，产品能力边界以 PRD 为准；具体阶段的布局、视觉层级和控件呈现以对应 UI/UX 方案为准。

---

## 1. 产品背景

当前项目基于 Sabaki 魔改，已经加入了较多功能。经过试用后，产品方向需要从“功能堆叠型围棋工具”收敛为一个清晰的训练系统。

围棋训练不同于普通刷题：

- 一盘棋的连续性很重要，背谱/回忆是基本功。
- 单个局面题如果没有局面说明，容易变成茫然刷题。
- 围棋题很难用唯一答案判断是否通过。
- 用户错误走法本身具有很高训练价值，需要被系统转化为“惩罚题”。
- 对个人训练工具来说，用户可以自行决定什么时候提交答案，系统重点负责判断变化是否明显崩坏，并给出提示。

因此，本产品的核心不是单纯提供 AI 对战、AI 复盘或题库，而是建立如下训练链路：

```text
Play 对战
→ Submit / freeze TrainingAttempt
→ Recall 回忆/背谱
→ RecallCheckpoint 主动修正问题手
→ Analysis 自由复盘
→ Snapshot 出题
→ Problem 做题
→ Bad Move 检测
→ Punishment Problem 惩罚题
→ Review 复习
```

---

## 2. 产品定位

### 2.1 一句话定位

一个以“实战/做题 Attempt → 主动回忆 → 问题手自我修正 → AI 复盘出题 → 错手惩罚题 → 长期复习”为核心的个人围棋训练工具。

### 2.2 核心价值

本工具帮助用户完成五件事：

1. **把每一盘棋留下来**  
   不只是保存 SGF，而是保存为可回忆、可复盘、可出题、可复习的训练材料。

2. **把用户产出冻结成 Attempt**  
   Play / Problem 中的用户走法在提交后冻结为 `TrainingAttempt.userLine`，后续 Recall、Analysis、BadMove 和 Review 都围绕该事实展开。

3. **先自己回忆并修正问题手**  
   major / severe BadMove 不直接跳到答案，而是在 Recall 中触发 `RecallCheckpoint`：用户先摆 correction line，再 reveal AI candidates，再写 comment。

4. **把复盘结果变成题目**  
   通过 snapshot 机制，将关键局面转化为带局面说明、参考变化和判断规则的题目。

5. **把错误走法变成新的训练材料**  
   用户做题或 Recall checkpoint 中暴露出的坏棋，可以进入惩罚题 inbox 或 Review 队列，训练“对方如何惩罚这手”。

---

## 3. 目标用户

### 3.1 当前目标用户

项目第一阶段只服务一个核心用户：

- 有一定围棋基础；
- 会使用 AI 复盘；
- 想提高实战训练效率；
- 愿意自己判断提交时机；
- 重视背谱、主动纠错、复盘、错手惩罚和长期复习；
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

### 4.2 Attempt 是核心事实

系统真正要保存和训练的不是“页面状态”，而是用户在 Play / Problem 中产出的一条线：

```text
TrainingTask / Problem
→ TrainingAttempt.userLine
→ MoveEvaluation
→ BadMove
→ RecallSession
→ RecallCheckpoint
→ Analysis / Snapshot / Review
```

提交后 Attempt 必须冻结；Recall、Analysis、Punishment、Review 都引用 Attempt 事实，不反向改写它。

### 4.3 回忆优先于复盘

Play / Problem 提交后默认进入 Recall Mode，而不是直接进入 AI Analysis Mode。  
用户先尝试回忆自己的线，并在问题手处先自己修正，再借助 AI 复盘，避免形成“下完直接看答案”的习惯。

### 4.4 RecallCheckpoint 优先于直接看答案

major / severe BadMove 的第一处理不是“自动生成题”或“直接显示 AI 答案”，而是 Recall 中的主动纠错：

```text
命中 major / severe BadMove
→ 停在 checkpoint 局面
→ 用户先摆 correction line
→ 用户保存修正图
→ reveal AI candidates
→ 写 comment
→ 继续 Recall 或进入 Analysis
```

### 4.5 题目必须有局面说明

Snapshot 出题时，题目不能只有“黑先/白先，下一手”。  
每道题必须有局面说明，至少说明：

- 当前局面背景；
- 棋局矛盾；
- 本题训练目标；
- 为什么这个局面值得练。

### 4.6 做题允许自由探索

围棋题不强制用户走唯一答案。  
用户可以自由下变化，系统负责监控每一手是否出现明显坏棋。

### 4.7 提交时机由用户决定

用户认为自己已经想清楚，可以主动提交。  
系统在提交时评估整条变化是否成立。

### 4.8 错误走法自动沉淀，但不替代主动纠错

用户做题或 Recall 中的错误走法不是简单丢弃，但沉淀顺序必须保持训练性：

```text
先在 RecallCheckpoint 中主动修正
再在 Analysis 中对比研究
最后按需要生成 Punishment Problem / Review item
```

Punishment Problem 是错误沉淀机制，不是 RecallCheckpoint 的替代品。

---

## 5. 核心工作流

## 5.1 主流程总览

```text
0. Material / Library
   野狐对局、101 错题、本地 SGF、本地题库进入 TrainingTask / Game / Problem

1. Play Mode
   用户和 AI 对战 / 指定局面续弈
   用户产生 TrainingAttempt.userLine

2. Submit
   用户主动提交或对局结束
   系统冻结 Attempt，并生成 MoveEvaluation / BadMove

3. Recall Mode
   用户先回忆 Attempt 原线
   命中 major / severe BadMove 时进入 RecallCheckpoint

4. RecallCheckpoint
   用户先摆 correction line
   再 reveal AI candidates
   再写 comment
   然后继续 Recall

5. Analysis Mode
   用户进入自由复盘
   使用 AI / reference board 比较实战、修正图与推荐变化

6. Snapshot to Problem
   用户从关键局面 snapshot 出正式题目
   系统要求补充或生成局面说明

7. Problem Mode
   用户做题，自由下变化
   系统实时检测坏棋

8. Problem Submit
   用户自行决定何时提交
   系统判断变化是否通过

9. Punishment Problem
   如果用户在 Problem 或 Recall checkpoint 中出现明显坏棋
   系统自动生成“对方如何惩罚这手”的惩罚题

10. Review Mode
   系统根据复习计划、错误记录和题目状态安排复习
```

## 5.2 Workbench Mode State Machine

产品闭环中的运行态 workbench mode 只有四个：

```text
Play / Problem / Recall / Analysis
```

产品对象和运行态 mode 必须区分：

- `Problem` entity / task：一道题、惩罚题或题目来源，是训练业务对象。
- `WorkbenchMode.problem`：用户正在做题的运行态 mode，拥有 `problemView`、mutable Attempt、
  pending evaluations 和 visible bad move projection。
- `TrainingAttempt`：Play / Problem 中用户产出的一条线，是 Recall、Analysis、BadMove 和 Review
  的核心事实。提交后冻结，不因后续复盘或修正而改写。
- `RecallCheckpoint`：Recall 中的问题手主动纠错子流程，不是独立 mode，也不是普通 Problem。
- `Review`：复习队列和入口，不一定是棋盘 mode。用户从 Review 打开具体题目后进入
  `WorkbenchMode.problem`。
- `Punishment Problem`：`Problem.type = 'punishment'`，不是新 mode。

Snapshot 是全局可发现动作，但落库创建 Problem 前必须先投影到 `WorkbenchMode.analysis`
的 scratch/current 局面：

```text
Play / Problem / Recall visible position
→ enter Analysis scratch/current projection
→ Snapshot
→ Problem entity / Task
→ child Problem tab
→ WorkbenchMode.problem
```

因此 UI 可以在 Play / Problem / Recall 暴露 Snapshot 按钮，但 service 不允许从这些 live
mutable context 直接创建 Problem；必须经由 Analysis scratch source，避免把 source Attempt、
game-tree live analysis 或 recall follow-up 状态混进派生题。

---

# 6. 功能需求

---

## 6.1 Play Mode：对战模式

### 6.1.1 目标

产生真实对局素材，并保存为可训练对象。

### 6.1.2 功能描述

用户进入 Play Mode 后，可以和 AI 进行对战。对局结束后，系统自动保存棋局进入数据库，并默认进入 Recall Mode。

### 6.1.3 基础功能

- 新建对局；
- 选择执黑/执白；
- 选择 AI 强度；
- 支持让子；
- 支持时间设置；
- 支持中途保存；
- 支持对局结束自动归档；
- 保存完整 SGF；
- 保存对局元数据。

### 6.1.4 对局元数据

每盘棋至少保存：

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

### 6.1.5 对局结束后的默认动作

对局结束后：

```text
保存棋局
→ 冻结 TrainingAttempt
→ 创建默认 Recall Session
→ 进入 Recall Mode
```

### 6.1.6 PlayMoveCommitted 产品边界

Play Mode 的普通交替落子必须表现为一条稳定主线：

```text
用户或 AI 产生一手
→ 写入当前对局棋树
→ 形成 PlayMoveCommitted
→ 记录到 active TrainingAttempt
→ 后台触发训练评估 / AI 应手判断 / analysis 调度
```

产品语义：

- 人人对局：黑白均由用户控制；AI 判断入口可以 no-op，但不得请求引擎。
- 人机对局：AI 首手和 AI 应手都必须像普通落子一样进入同一条对局主线，不能绕过棋树和 Attempt 记录。
- AI vs AI：允许作为自动对弈模型存在，但必须有最大手数、双 pass、resign、无合法手和用户中断保护。
- Play Mode 不显示 territory / compare / analysis overlay。系统可以在后台分析棋局用于训练评估，但 overlay 显示必须等进入 Analysis Mode。
- Play 的主事实是完整 SGF game tree；TrainingAttempt 是训练记录，不替代对局棋树。

---

## 6.2 Recall Mode：回忆 / 背谱模式

### 6.2.1 目标

训练用户对刚下过棋局的连续性记忆，培养复盘前先回忆的习惯。

### 6.2.2 设计理由

背谱是围棋基本功。  
它训练的不只是机械记忆，而是：

- 棋局进程感；
- 局部战斗顺序；
- 关键节点意识；
- 对自己实战思路的回忆；
- 对形势转折的敏感度。

### 6.2.3 模式入口

Play / Problem 提交后默认进入。  
用户也可以从 Game Detail、Attempt Detail 或 Review 中手动进入。

Recall 的输入不是 live game tree，而是冻结后的 `TrainingAttempt.userLine`。Recall 可以同时引用
原始 Game 棋谱、题目参考变化和 BadMove 列表，但不能改写已冻结 Attempt。

### 6.2.4 回忆类型

#### A. 整盘回忆

用户从第 1 手开始复现整盘棋。

```text
系统隐藏后续棋谱
用户每下一手，系统判断是否与实战一致
```

#### B. 关键节点回忆

用户从系统或手动标记的关键节点开始，复现后续若干手。

示例：

```text
第 37 手：第一次方向选择
第 58 手：战斗开始
第 92 手：胜率大幅波动
第 141 手：官子误判
```

#### C. 局部片段回忆

用户只回忆某个局部战斗片段。

示例：

```text
请复现右下战斗从第 52 手到第 68 手。
```

#### D. 错误片段回忆

用户回忆自己在实战中出现失误的片段。

---

### 6.2.5 回忆判断

每一步判断：

- 是否与实战手一致；
- 是否在同一区域；
- 是否为合理转置；
- 是否需要提示；
- 用户尝试次数。

MVP 阶段可先只做“是否与实战手一致”。

### 6.2.6 RecallCheckpoint 主动纠错

当 Recall 命中来自 Attempt 的 major / severe BadMove，系统必须进入 checkpoint 子流程。该流程是
v0.7 的训练核心：

```text
1. 停在 bad move 之前的局面
2. 标出原手与严重程度，但不立即显示 AI 正解
3. 用户在棋盘上先摆 correction line
4. 用户保存修正图
5. 系统 reveal AI candidates / AI reference line
6. 用户填写 comment：
   - 原手为什么不好？
   - 我的修正思路是什么？
   - 与 AI 的差异是什么？
7. checkpoint 完成后继续 Recall 或进入 Analysis
```

Checkpoint 状态：

```ts
type RecallCheckpoint = {
  id: string
  recallSessionId: string
  attemptId: string
  badMoveId: string
  moveNumber: number
  originalMove: string
  severity: 'major' | 'severe'
  positionBeforeMoveSgf: string
  correctionLine: string[]
  aiCandidateLines?: ReferenceLine[]
  commentId?: string
  status:
    | 'awaiting_correction'
    | 'correction_saved'
    | 'ai_revealed'
    | 'comment_saved'
    | 'skipped'
}
```

### 6.2.7 提示与反馈

普通回忆落子错误时播放错误音效，不做复杂分级提示系统。  
Checkpoint 中的提示必须遵守“先自我修正，后 reveal AI”的顺序；在 correction line 保存前，不显示完整 AI candidates。

### 6.2.8 回忆结果记录

```ts
type RecallSession = {
  id: string
  attemptId: string
  gameId?: string
  taskId?: string
  mode: 'full_game' | 'key_segment' | 'local_segment' | 'mistake_segment'
  startMove: number
  endMove?: number
  attempts: RecallAttempt[]
  checkpointIds: string[]
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
```

### 6.2.9 产出

Recall Mode 产出：

- 记错的手；
- 记不住的片段；
- 已完成或跳过的 RecallCheckpoint；
- 用户 correction line；
- AI candidates 对比；
- 用户 comment；
- 值得复盘的关键节点；
- 可选的 Punishment Problem 草稿；
- 可选的后续复习项。

---

## 6.3 Analysis Mode：复盘模式

### 6.3.1 目标

帮助用户比较实战与参考变化，找到值得出题的关键局面。

### 6.3.2 入口

- Recall Mode 结束后进入；
- RecallCheckpoint 完成后进入；
- Game Detail 页面进入；
- 题目详情页面进入；
- 惩罚题回溯进入。

### 6.3.3 核心视图

Analysis Mode 至少包含：

```text
Main Board：当前棋盘
Reference Board：参考棋盘
Move Tree：变化树
Engine Panel：AI 推荐与评估
Snapshot Panel：出题面板
Position Note：当前局面说明
```

### 6.3.4 Reference Board

Reference Board 用于展示：

- AI 推荐变化；
- 用户实战变化；
- 用户 Recall correction line；
- 用户自定义参考变化；
- 题目答案变化；
- 惩罚变化。

### 6.3.5 Current vs Reference 比较

系统应支持比较：

- 当前局面目差；
- 参考局面目差；
- 目差变化；
- 重点区域 ownership；
- 局部棋块状态；
- 先后手关系；
- 实地与潜力变化。

MVP 阶段优先实现：

```text
当前变化终点目差
参考变化终点目差
二者差值
是否出现剧烈恶化
```

### 6.3.6 Snapshot 出题

用户可以从任意工作台 mode 发现 Snapshot 动作，但真正创建题目前必须落在 Analysis scratch/current
source 上。

```text
Play / Problem / Recall 点击 Snapshot
→ 系统进入 Analysis，并创建 scratch projection
→ 用户确认当前局面、参考变化和笔记
→ Snapshot 出题
```

工程约束：Snapshot service 只能从 Analysis Mode 的 scratch/current 局面派生。Play / Problem /
Recall 不能直接 snapshot 成 Problem；如果需要出题，必须先进入 Analysis 并以 scratch workspace
作为 source。

Snapshot 时必须保存：

```ts
type ProblemSnapshotInput = {
  gameId: string
  moveNumber: number
  positionSgf: string
  sideToMove: 'black' | 'white'
  referenceLine?: string[]
  currentLine?: string[]
}
```

Snapshot 后进入 Problem Editor。

### 6.3.7 Analysis Edit Bar / 标注工具栏

Analysis Mode 必须提供可直接操作当前 scratch/current 局面的 edit bar。它不是装饰性工具条，而是
Snapshot 出题、局面说明和 reference line 整理的核心输入面。

Edit bar 至少包含：

```text
选择 / 落子 / 黑白摆子 / 删除
标记：X / △ / □ / ○ / label / number
线与箭头
撤销 / 重做 / 清空
Edit position
Snapshot
缩放 / 全屏
```

工程约束：

- edit bar 只在 Analysis scratch / working position 上写入；
- edit bar 不能改写 source `TrainingAttempt.userLine`；
- edit bar 的 Snapshot 按钮必须走与顶部 Snapshot 相同的 command path；
- edit bar 的每个按钮必须有 disabled reason 和 E2E 点击验收；
- 标注、线、箭头和摆子结果必须能进入 Snapshot / Problem draft 的局面素材。

---

## 6.4 Problem Editor：题目编辑器

### 6.4.1 目标

将复盘中的关键局面整理为正式题目。

### 6.4.2 基础字段

每道题必须包含：

```ts
type Problem = {
  id: string
  sourceGameId?: string
  sourceMoveNumber?: number
  sourceProblemId?: string
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

### 6.4.3 题目类型

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

### 6.4.4 局面说明

题目必须包含 `positionDescription`。

局面说明用于回答：

```text
这个局面发生在什么背景下？
当前主要矛盾是什么？
哪块棋轻？哪块棋重？
谁需要攻击？谁需要安定？
为什么这个局面值得练？
```

示例：

```text
白棋右边尚未完全安定，黑棋中央较厚。
实战中黑选择左下补棋，但此时更重要的是利用厚势继续压迫白棋。
本题重点是判断攻击方向，而不是计算单一死活。
```

### 6.4.5 任务目标

题目必须包含 `taskGoal`。

示例：

```text
目标：找到黑棋继续攻击白棋的方向，并避免让白棋轻松安定。
```

### 6.4.6 参考变化

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

### 6.4.7 通过规则

通过规则不要求用户下出唯一答案，而是判断提交变化是否成立。

```ts
type PassRule = {
  evalDropThreshold?: number
  scoreDropThreshold?: number
  maxBadMoveCount?: number
  requireNoSevereBadMove: boolean
  compareWithReference: boolean
  targetDescription?: string
}
```

MVP 默认规则：

```text
如果用户提交变化中出现单手目差剧烈恶化，则失败。
如果整条变化终点相比参考变化亏损超过阈值，则失败。
如果没有明显坏棋，且用户主动提交，则可通过。
```

---

## 6.5 Problem Mode：做题模式

### 6.5.1 目标

用户基于题目局面自由下变化，系统监控是否出现坏棋，并在用户提交时判断是否通过。
Problem Mode 和 Play Mode 一样产出 `TrainingAttempt`；`ProblemAttempt` 只作为题目上下文中的视图名称，
不应成为脱离 Attempt 主表的第二套事实模型。

### 6.5.2 基本流程

```text
进入题目
→ 阅读局面说明
→ 用户自由下变化
→ 系统实时评估每一手
→ 若出现坏棋，给出提示
→ 用户继续探索 / 悔棋 / 看提示
→ 用户点击提交
→ 系统判断通过 / 勉强通过 / 失败
```

### 6.5.3 做题界面

应包含：

```text
Main Board：用户下变化
Reference Board：可选，默认隐藏或折叠
Problem Brief：局面说明与任务目标
Eval Monitor：目差 / 胜率变化提示
Hint Panel：提示区
Submit Button：用户主动提交
Attempt Timeline：用户本次尝试路径
```

### 6.5.4 实时坏棋检测

每当用户下一手，系统请求 AI 评估。

判断维度：

```text
1. 该手前后目差是否剧烈变化
2. 胜率是否剧烈下降
3. 是否偏离题目目标
4. 是否给对方留下明显惩罚
```

MVP 阶段优先实现：

```text
该手前后 scoreLead 变化是否超过阈值
```

### 6.5.5 坏棋提示层级

```text
Level 1：这手之后形势明显恶化。
Level 2：问题大致出在某个区域。
Level 3：对方有一手强烈反击。
Level 4：显示对方惩罚第一手。
Level 5：显示完整惩罚变化。
```

### 6.5.6 用户提交

用户可以在任意时刻点击提交。

提交时系统评估：

```text
1. 本次变化中是否出现严重坏棋
2. 终点目差是否明显低于起点
3. 终点目差是否明显低于参考变化
4. 是否存在可被立即惩罚的手
```

提交结果分为：

```text
通过：
变化基本成立，没有明显被惩罚点。

勉强通过：
整体可下，但存在轻微损失或局部处理不够简明。

失败：
变化中出现明显坏棋，或提交终点相比参考变化恶化明显。
```

### 6.5.7 Attempt 数据结构

```ts
type TrainingAttempt = {
  id: string
  taskId?: string
  problemId?: string
  gameId?: string
  mode: 'play' | 'problem'
  startedAt: string
  submittedAt?: string
  status: 'playing' | 'submitted' | 'abandoned'
  userLine: string[]
  moveEvaluations: MoveEvaluation[]
  result?: 'pass' | 'soft_pass' | 'fail' | 'abandoned'
  hintLevelUsed: number
  badMoveIds: string[]
  generatedPunishmentProblemIds: string[]
}

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
  engineSuggestedPunishMove?: string
}
```

提交后 `TrainingAttempt.userLine`、`moveEvaluations`、`result` 和 `badMoveIds` 进入冻结状态。Recall
和 Analysis 可以创建 correction / reference / note，但不能改写这些提交事实。

---

## 6.6 Punishment Problem：惩罚题

### 6.6.1 目标

当用户在 Problem Attempt 或 RecallCheckpoint 中暴露出错误走法时，系统可以生成新题，训练“对方如何惩罚这手”。
Punishment Problem 是错误沉淀机制，不替代 Recall 中的主动 correction line。

### 6.6.2 生成条件

满足任一条件可生成惩罚题：

```text
1. Problem Attempt 中用户某手导致目差剧烈恶化
2. Problem Attempt 中用户某手导致胜率剧烈下降
3. AI 显示对方有明确强手
4. RecallCheckpoint 完成后，用户或系统标记“这手需要惩罚题”
5. 用户手动标记“这手需要惩罚题”
```

MVP 阶段：

```text
Problem Attempt 中 major / severe scoreDrop 可生成惩罚题草稿。
RecallCheckpoint 中已保存 correction line 后，允许手动生成惩罚题草稿。
```

### 6.6.3 自动生成内容

惩罚题包含：

```ts
type PunishmentProblem = Problem & {
  type: 'punishment'
  parentProblemId?: string
  parentAttemptId: string
  parentCheckpointId?: string
  badMove: string
  punishSide: 'black' | 'white'
  punishMove?: string
}
```

### 6.6.4 惩罚题说明模板

系统可自动生成初始说明：

```text
这是从题目《{原题标题}》中自动生成的惩罚题。
用户在该局面下选择了 {错误手}，导致形势明显恶化。
现在轮到 {惩罚方}，请找出惩罚这手的关键手段。
```

### 6.6.5 惩罚题状态

自动生成的惩罚题先进入 `inbox` 状态。

用户可选择：

```text
1. 加入正式题库
2. 编辑局面说明
3. 添加参考变化
4. 删除
5. 暂时保留
```

---

## 6.7 Review Mode：复习队列 / 入口模式

### 6.7.1 目标

根据题目状态、复习间隔和用户错误记录，安排题目复习。

Review 是产品入口和队列语义，不是独立棋盘运行态。打开普通题或惩罚题后，工作台进入
`WorkbenchMode.problem`。

### 6.7.2 复习来源

Review Mode 从以下来源抽取题目：

```text
1. 正式题库中的到期题
2. 最近做错的题
3. 最近生成的惩罚题
4. 记忆失败的 Recall Segment
5. 用户手动加入的重点题
```

### 6.7.3 复习策略

基础策略：

```text
首次做错：1 天后复习
看提示后通过：3 天后复习
独立通过：7 天后复习
连续独立通过：14 / 30 天后复习
再次失败：重置为 1 天
```

### 6.7.4 复习卡片类型

Review Mode 支持：

```text
1. 普通题
2. 惩罚题
3. 关键节点回忆
4. 局部片段回忆
```

MVP 优先支持：

```text
普通题 + 惩罚题
```

### 6.7.5 Review 数据结构

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

## 6.8 Material Library / 外部数据入口

### 6.8.1 目标

材料库是训练系统的输入层。用户不应只能从当前棋盘手动开始训练；野狐对局、101 错题、本地 SGF、
本地题库和手动创建材料都必须进入统一的 `TrainingTask` / `Game` / `Problem` 训练闭环。

材料库不是第五个 Workbench mode。打开材料后，系统根据材料类型进入：

```text
Fox / imported SGF game      -> Game + TrainingTask -> Recall 或 Play
101 wrong problem            -> TrainingTask(problem-like) -> Problem
local SGF                    -> Game / TrainingTask -> Play / Recall / Analysis
manual problem draft         -> TrainingTask(problem-like) -> Problem Editor / Problem
review due item              -> ReviewSchedule.taskId -> Problem
```

### 6.8.2 Fox / 野狐对局

野狐对局是 Play/Recall 训练素材的核心来源。

必须支持：

- 绑定并保存野狐用户名；
- 加载公开对局列表；
- 单击预览对局元数据与终局盘面；
- 双击打开对局，默认进入 Recall 训练；
- 导入到本地棋谱库，`TrainingTask.origin.provider = 'fox'`；
- 去重导入；
- 启动时后台增量同步；
- 全局状态栏或材料库中展示同步中、成功、失败和重试状态。

### 6.8.3 101 围棋错题

101 错题是 Problem/Review 训练素材的核心来源。

必须支持：

- 登录或复用 101 会话；
- 同步错题本分页；
- 抓取、解码并生成 SGF；
- 持久化为本地 `TrainingTask`，`origin.provider = '101weiqi'`；
- 离线进入 Problem Mode；
- 增量同步、失败重试和会话过期反馈；
- 同步后的题目可进入 Review。

### 6.8.4 材料库 UI

材料库必须提供可验收的数据接线，不允许只显示静态 tab：

```text
历史记录：recent activity、最近打开、最近训练、最近同步
棋谱库：本地 SGF、Fox 导入对局、Play 保存对局
对局库：active/saved games、未完成 Recall/Analysis
错题 / 题库入口：101 错题、Problem Inbox、Review 到期题
```

每个入口都必须能打开或导入真实 `TrainingTask`，并显示 loading、empty、error、syncing 和 success 状态。

---

# 7. 页面与模式设计

## 7.1 首页 / Training Dashboard

### 7.1.1 目标

首页不是功能入口堆叠，而是训练驾驶舱。

### 7.1.2 展示内容

```text
今日训练
- 到期题目数量
- 最近生成的惩罚题
- 最近未完成复盘的棋局
- 最近未完成回忆的棋局
- 当前重点标签
```

### 7.1.3 主要操作

```text
开始今日复习
继续上次回忆
继续上次复盘
开始 AI 对战
录入题目
查看题库
```

---

## 7.2 Game Detail 页面

### 7.2.1 内容

```text
棋局基本信息
SGF 棋谱
回忆记录
复盘记录
从本局生成的题目
从本局生成的惩罚题
```

### 7.2.2 操作

```text
进入回忆
进入复盘
继续分析
查看相关题目
```

---

## 7.3 Analysis 页面

核心布局：

```text
顶部：棋局信息 / 当前手数 / 模式切换
左侧：Move Tree / 变化树
中间：Main Board
右侧：Reference Board + Engine Panel
底部：Snapshot / Note / Reference Line 控制区
```

---

## 7.4 Problem 页面

核心布局：

```text
顶部：题目标题 / 类型 / 难度 / 来源
左侧：Problem Brief
中间：Main Board
右侧：Hint / Eval / Reference
底部：Attempt Timeline / Submit
```

---

## 7.5 Problem Inbox 页面

用于管理未整理题目。

来源包括：

```text
1. Analysis snapshot 生成的题
2. 做题失败自动生成的惩罚题
3. 快速录入模式生成的题
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

# 8. 题目录入模式

## 8.1 目标

支持用户在心流状态下快速录入题目。

## 8.2 设计原则

录入模式只负责快速采集，不强迫用户当场完整整理。  
所有录入题目先进入 Problem Inbox。

## 8.3 快捷键

建议快捷键：

```text
S：snapshot 当前局面
B：设置黑先
W：设置白先
A：标记当前变化为参考答案
T：选择题目类型
D：设置难度
N：添加一句局面说明
Enter：保存到 Inbox
Esc：取消
```

## 8.4 快速录入字段

```ts
type QuickProblemDraft = {
  positionSgf: string
  sideToMove: 'black' | 'white'
  type?: ProblemType
  referenceLine?: string[]
  positionDescription?: string
  difficulty?: 1 | 2 | 3 | 4 | 5
}
```

---

# 9. AI / Engine 需求

## 9.1 Engine 能力

系统需要从 AI 引擎获取：

```text
1. 当前局面 scoreLead
2. 当前局面 winrate
3. 推荐候选手
4. 推荐变化
5. visits
6. ownership / territory 信息
```

MVP 必须有：

```text
scoreLead
推荐候选手
推荐变化
```

## 9.2 坏棋检测

基础算法：

```text
beforeEval = 当前手之前的 AI 评估
afterEval = 用户落子之后的 AI 评估
scoreDrop = afterEval.scoreLead - beforeEval.scoreLead
```

注意：scoreLead 需要统一到“当前做题方视角”。

示例：

```text
若当前做题方为黑：
scoreDrop = afterBlackLead - beforeBlackLead

若当前做题方为白：
scoreDrop = beforeBlackLead - afterBlackLead
```

### 9.2.1 默认阈值

MVP 可配置：

```text
minor：亏 2 目以上
major：亏 5 目以上
severe：亏 8 目以上
```

不同阶段后续可调整：

```text
布局：阈值可放宽
中盘：结合 winrate 与棋块状态
官子：目差阈值更敏感
死活：目标棋块状态优先
```

## 9.3 Play Mode AI 应手

Play Mode 中，AI 不应直接修改训练事实或 overlay。AI 能力只提供下一手候选：

```text
PlayMoveCommitted / start turn
→ aiMoveService 判断 next color 是否由 AI 控制
→ engineService.requestMove 获取候选手
→ 校验 requestId / attemptId / treePosition / mode freshness
→ 返回 AI move command
→ 通过 Play move 主线提交为新的 PlayMoveCommitted
```

验收口径：

- 人执黑、AI 执白：用户黑棋提交后，AI 白棋通过同一条 Play move 主线提交。
- AI 执黑、人执白：开局创建 Attempt 后，AI 黑棋首手通过同一条 Play move 主线提交。
- 人人对局：AI 判断返回 no-op，不触发 engine request。
- stale AI 请求、切 tab、进入 Analysis、提交 Attempt 或重新开始 Attempt 后返回的 AI move 不得写入棋树或 Attempt。

## 9.4 惩罚手生成

当用户出现 bad move：

```text
1. 用 afterEval 获取对方推荐候选手
2. 取 top move 作为惩罚第一手
3. 保存推荐变化为 punishment reference line
```

---

# 10. 数据模型总览

```text
Game
 ├─ TrainingTask / Problem
 ├─ TrainingAttempt
 │   ├─ MoveEvaluation
 │   └─ BadMove
 ├─ RecallSession
 │   └─ RecallCheckpoint
 ├─ AnalysisSession
 ├─ Problem
 │   ├─ ReferenceLine
 │   ├─ TrainingAttempt
 │   └─ ReviewSchedule
 └─ PunishmentProblem
```

## 10.1 Game

见 6.1.4。

## 10.2 Problem

见 6.4.2。

## 10.3 TrainingAttempt / ProblemAttempt View

见 6.5.7。

`ProblemAttempt` 只表示 `TrainingAttempt.mode = 'problem'` 的业务视图；实现层不得再建立一套与
`TrainingAttempt` 平行的 attempt 主事实。

## 10.4 BadMove

```ts
type BadMove = {
  id: string
  problemId?: string
  attemptId: string
  checkpointId?: string
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

## 10.5 AnalysisSession

```ts
type AnalysisSession = {
  id: string
  gameId: string
  createdAt: string
  updatedAt: string
  currentMoveNumber: number
  currentLine: string[]
  referenceLine?: string[]
  notes: PositionNote[]
  snapshots: string[]
}
```

## 10.6 PositionNote

```ts
type PositionNote = {
  id: string
  gameId?: string
  problemId?: string
  moveNumber?: number
  positionSgf: string
  text: string
  createdAt: string
  updatedAt: string
}
```

---

# 11. MVP 范围

## 11.1 MVP 目标

跑通最短训练闭环：

```text
Play 结束
→ Submit / freeze Attempt
→ Recall 背谱
→ RecallCheckpoint 主动修正 major / severe BadMove
→ Analysis 对比原线 / 修正图 / AI candidates
→ Analysis snapshot 出题
→ Problem 做题
→ 提交判断
→ 坏棋生成惩罚题
```

## 11.2 MVP 必做功能

### A. Play 后保存棋局

- 完成对局保存；
- 保存 SGF；
- 创建 Game 记录；
- 对局结束后进入 Recall Mode。

### B. Recall Mode v1

- 支持整盘回忆；
- 判断是否与实战手一致；
- 记录错误手；
- 错误时播放提示音；
- 对 major / severe BadMove 生成 RecallCheckpoint；
- Checkpoint 中用户必须先保存 correction line，才能 reveal AI candidates；
- Checkpoint 支持保存用户 comment；
- 允许结束后进入 Analysis Mode。

### C. Analysis Mode v1

- 支持 Main Board；
- 支持 Reference Board；
- 支持当前变化与参考变化切换；
- 支持展示 Recall correction line 与 AI candidates 对比；
- 支持 snapshot 当前局面。

### D. Problem Editor v1

- 生成题目；
- 要求填写局面说明；
- 要求填写任务目标；
- 题目进入题库或 inbox。

### E. Problem Mode v1

- 用户自由下变化；
- 系统调用引擎评估；
- 检测每手 scoreDrop；
- 用户主动提交；
- 显示通过 / 勉强通过 / 失败。

### F. Punishment Problem v1

- 检测到严重 bad move 后自动生成惩罚题草稿；
- 所有 bad move 写入 bad_moves 表；
- 惩罚题进入 inbox；
- 惩罚题说明使用模板自动生成。

### G. Review Mode v1

- 显示到期题；
- 支持普通题和惩罚题；
- 根据结果更新复习间隔。

### H. Material Library / External Data v1

- 野狐对局可查询、预览、导入并默认进入 Recall；
- 101 错题可同步、解码、缓存并进入 Problem；
- 本地 SGF / Play 保存对局能进入棋谱库；
- 材料库 tabs 展示真实数据、空态、错误态和同步态。

### I. Analysis Edit Bar v1

- Analysis 底部 edit bar 可操作 scratch/current 局面；
- 支持摆子、删除、标记、线/箭头、撤销、重做、清空；
- Snapshot 使用 edit bar 当前局面作为可选来源；
- edit bar 不污染 Attempt 和真实 game tree。

---

## 11.3 MVP 暂不做

暂不做：

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
```

---

# 12. 验收标准

## 12.1 Play → Recall

- 用户完成一盘对局后（确认比分或认输），系统自动保存棋局到 games 表；
- 系统创建并冻结本局 `TrainingAttempt.userLine`；
- 系统自动进入 Recall Mode；
- 用户可以从头复现棋谱；
- 系统可以判断每手是否与实战一致；
- 落子错误时播放提示音；
- 系统记录回忆错误点；
- major / severe BadMove 会进入 RecallCheckpoint。

## 12.2 RecallCheckpoint

- Checkpoint 停在 bad move 前局面；
- UI 标出原手、严重程度和目差变化；
- 保存 correction line 前不得展示完整 AI candidates；
- 用户可以保存 correction line；
- 保存后可以 reveal AI candidates；
- 用户可以写 comment；
- 完成后可以继续 Recall 或进入 Analysis；
- Checkpoint 不改写原始 Attempt。

## 12.3 Recall → Analysis

- 用户可以从回忆模式进入复盘模式；
- 复盘模式可以定位到回忆错误点；
- 用户可以在复盘模式中查看原始棋谱、用户修正图和 AI candidates。

## 12.4 Analysis → Problem

- 用户可以在任意 mode 发现 Snapshot 入口；
- 系统必须先投影到 Analysis scratch/current，再创建 Problem；
- 题目必须包含局面说明；
- 题目必须包含先行方；
- 保存后进入题库或 inbox。

## 12.5 Problem Attempt

- 用户可以在题目中自由下变化；
- 系统可以对每手请求 AI 评估；
- 系统可以检测 scoreDrop；
- 系统可以提示坏棋；
- 用户可以自行点击提交；
- 系统给出通过 / 勉强通过 / 失败结论；
- 提交后 Attempt 冻结，并可进入 Recall。

## 12.6 Punishment Problem

- 用户下出严重坏棋后，系统可以生成 bad move 记录并存入 bad_moves 表；
- 系统可以根据 AI top move 生成惩罚题；
- 惩罚题包含来源题、错误手、惩罚方、局面说明模板；
- 惩罚题进入 inbox；
- 惩罚题生成不跳过 RecallCheckpoint 的 correction line。

## 12.7 Review

- 系统能展示到期题；
- 用户完成复习后，系统更新下一次复习时间；
- 做错题会更快再次出现；
- 通过题会延长复习间隔。

## 12.8 Material Library / External Data

- 野狐用户名保存后，材料库能加载、预览并导入真实对局；
- 野狐对局双击打开后默认进入 Recall 或可直接进入 Analysis；
- 101 登录会话有效时，能同步错题、解码 SGF 并生成可离线训练的 Problem Task；
- 101 / Fox 后台同步状态必须在 UI 中可见，并支持失败重试；
- 材料库历史记录、棋谱库、对局库、错题入口都必须来自 repository / sync service / runtime projection，不能只展示静态 mock。

## 12.9 Analysis Edit Bar

- Analysis edit bar 的每个按钮都有可见 affordance、disabled reason 和 command handler；
- 摆子、删除、标记、线/箭头、清空和撤销/重做只修改 scratch/current working position；
- edit bar Snapshot 与顶部 Snapshot 使用同一条 service command path；
- edit bar 操作后创建的 Snapshot 可以进入 Problem Editor / Problem；
- 任何 edit bar 操作都不能修改 frozen Attempt 或 source game tree。

## 12.10 Frontend Playwright E2E / Command Coverage

- Workbench 六个 canonical states 必须有 Playwright 截图验收：Problem、Recall、RecallCheckpoint、
  Play + library drawer、Analysis、Analysis + library drawer；
- 每个可见按钮、快捷键、drawer tab、mode segment 必须出现在 command map 中；
- Playwright 至少点击一次每类主 command：submit、enter/return analysis、snapshot、problem undo/abandon、
  recall hint/skip/checkpoint、edit bar tool、library open/import/sync retry；
- disabled 状态必须验证不会触发副作用，并显示与按钮一致的 disabled reason；
- E2E 不能只检查元素存在，必须验证 UI command 到 service/store/projection 的一段真实结果。

---

# 13. 风险与难点

## 13.1 围棋题通过标准不稳定

风险：  
AI top move 不等于人类唯一正解，过度依赖 AI 第一选点会导致训练体验僵硬。

应对：  
通过标准不看唯一答案，而看：

```text
是否出现明显坏棋
提交变化是否整体成立
与参考变化差距是否超过阈值
```

## 13.2 目差波动不一定代表坏棋

风险：  
布局或复杂战斗中，AI 目差可能波动，单纯按目差判断会误伤。

应对：

MVP 先接受粗糙判断，后续加入：

```text
阶段判断
winrate
ownership
目标棋块状态
用户手动覆盖判断
```

## 13.3 自动生成题目说明质量不够

风险：  
如果局面说明太空泛，题目仍然会茫然。

应对：

MVP 允许用户手动填写；后续再引入模板和 AI 辅助生成。

## 13.4 惩罚题数量爆炸

风险：  
用户做题时频繁出错，会自动生成大量惩罚题，导致 inbox 污染。

应对：

```text
只对 major/severe bad move 自动生成
minor bad move 只记录，不生成题
同一 attempt 中相似 bad move 合并
惩罚题先进入 inbox，不直接进入正式题库
```

---

# 14. 后续迭代方向

## 14.1 更智能的 Recall

- 支持关键节点自动抽取；
- 根据胜率/目差波动生成回忆片段；
- 支持局部片段复现；
- 支持错手片段复习。

## 14.2 更强的题目说明生成

- 根据 AI 推荐变化自动生成局面说明；
- 根据 current/reference 差异生成“为什么这手重要”；
- 根据用户错手生成专门的错误解释。

## 14.3 Reference / Current 高级比较

- ownership 差异图；
- 领地变化高亮；
- 棋块状态变化；
- 先后手变化；
- 厚薄变化标注。

## 14.4 能力画像

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

## 14.5 专题训练

支持用户选择：

```text
今日只练惩罚题
今日只练攻击方向
今日只复习最近三盘棋
今日只背谱
今日只做官子题
```

---

# 15. 推荐开发顺序

## Phase 1：数据与流程骨架

1. Game 数据保存；
2. RecallSession 数据；
3. TrainingAttempt 数据；
4. MoveEvaluation / BadMove 数据；
5. RecallCheckpoint 数据；
6. Problem / PunishmentProblem 数据。

## Phase 2：最小可用训练链路

1. Play 结束进入 Recall；
2. Submit 冻结 Attempt 并生成 BadMove；
3. Recall 中完成 Checkpoint 修正；
4. Recall 完成进入 Analysis；
5. Analysis snapshot 出题；
6. Problem Mode 做题；
7. 提交判断；
8. 生成惩罚题。

## Phase 3：体验优化

1. 快捷键；
2. Inbox 管理；
3. 局面说明模板；
4. Reference Board 交互；
5. Review 调度。

## Phase 4：训练增强

1. 关键节点自动发现；
2. current/reference 高级比较；
3. 惩罚题去重；
4. 复习统计；
5. 能力画像。

---

# 16. 术语表

## Game

一盘完整棋局，通常来自 Play Mode 或外部 SGF 导入。

## Recall Mode

回忆模式。用户在不看完整棋谱的情况下复现刚下过的棋。

## Analysis Mode

复盘模式。用户借助 AI、reference board、变化树分析棋局。

## Snapshot

从某一局面创建题目的动作。

## Problem

正式题目，包含局面、先行方、说明、目标、参考变化和通过规则。

## Problem Attempt

用户做某一道题的一次尝试。实现层是 `TrainingAttempt.mode = 'problem'` 的视图，不是独立主事实表。

## Bad Move

用户在 Play / Problem Attempt 或 RecallCheckpoint 中暴露出的明显坏棋。

## Punishment Problem

由 Bad Move 自动生成的新题，训练“对方如何惩罚这手”。

## Reference Line

参考变化，可以来自 AI 推荐、用户手动选择或题目答案。

## Review Mode

复习模式，根据复习计划安排题目和回忆片段。

---

# 17. 当前版本结论

本产品的第一阶段不追求成为完整围棋平台，而要优先验证一件事：

> 一条用户真实 Attempt，能否稳定转化为可回忆、可主动修正、可复盘、可做题、可惩罚、可复习的训练材料。

只要以下闭环跑通，产品就具备核心价值：

```text
下完一盘棋
→ 冻结自己的 Attempt
→ 先背下来
→ 遇到问题手先自己摆修正图
→ 再看 AI candidates 并写 comment
→ 再复盘关键处
→ 把关键局面变成题
→ 做题时自由探索
→ 系统检查是否有坏棋
→ 坏棋自动变成惩罚题
→ 以后反复复习
```
