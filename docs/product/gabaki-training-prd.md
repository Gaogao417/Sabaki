# Gabaki / Sabaki 魔改版围棋训练系统 PRD

> 版本：v0.1  
> 文档类型：产品需求文档（PRD）  
> 核心定位：面向个人训练的围棋学习工具  
> 当前目标：从“AI 分析棋盘”升级为“实战记忆 + 复盘出题 + 自由做题 + 错手惩罚题生成”的训练系统

## 文档地位

本文是 Gabaki / Sabaki 魔改版训练系统的产品全量蓝图，定义产品目标、训练闭环、核心功能、数据对象和验收方向。

- 当前工作台视觉实现以 [Workbench UI/UX Spec](../design/workbench-ui-ux-spec.md) 为准。
- 当前视觉参考图归档在 [Workbench Reference Pictures](../design/workbench-ref-pics/README.md)。
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
→ Recall 回忆/背谱
→ Analysis 复盘
→ Snapshot 出题
→ Problem 做题
→ Bad Move 检测
→ Punishment Problem 惩罚题
→ Review 复习
```

---

## 2. 产品定位

### 2.1 一句话定位

一个以“实战棋谱记忆 + AI 复盘出题 + 自由变化提交 + 错手惩罚题生成”为核心的个人围棋训练工具。

### 2.2 核心价值

本工具帮助用户完成三件事：

1. **把每一盘棋留下来**  
   不只是保存 SGF，而是保存为可回忆、可复盘、可出题、可复习的训练材料。

2. **把复盘结果变成题目**  
   通过 snapshot 机制，将关键局面转化为带局面说明、参考变化和判断规则的题目。

3. **把错误走法变成新的训练材料**  
   用户做题时出现坏棋，系统自动 snapshot 错误局面，生成“对方如何惩罚这手”的惩罚题。

---

## 3. 目标用户

### 3.1 当前目标用户

项目第一阶段只服务一个核心用户：

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

### 4.2 回忆优先于复盘

对局结束后默认进入 Recall Mode，而不是直接进入 AI Analysis Mode。  
用户先尝试回忆棋局，再借助 AI 复盘，避免形成“下完直接看答案”的习惯。

### 4.3 题目必须有局面说明

Snapshot 出题时，题目不能只有“黑先/白先，下一手”。  
每道题必须有局面说明，至少说明：

- 当前局面背景；
- 棋局矛盾；
- 本题训练目标；
- 为什么这个局面值得练。

### 4.4 做题允许自由探索

围棋题不强制用户走唯一答案。  
用户可以自由下变化，系统负责监控每一手是否出现明显坏棋。

### 4.5 提交时机由用户决定

用户认为自己已经想清楚，可以主动提交。  
系统在提交时评估整条变化是否成立。

### 4.6 错误走法自动沉淀

用户做题时的错误走法不是简单丢弃，而是自动 snapshot 成惩罚题，进入后续复习队列。

---

## 5. 核心工作流

## 5.1 主流程总览

```text
1. Play Mode
   用户和 AI 对战 / 指定局面续弈

2. Recall Mode
   对局结束后默认进入回忆模式
   用户尝试复现整盘棋或关键片段

3. Analysis Mode
   用户进入复盘模式
   使用 AI / reference board 比较实战与推荐变化

4. Snapshot to Problem
   用户从关键局面 snapshot 出正式题目
   系统要求补充或生成局面说明

5. Problem Mode
   用户做题，自由下变化
   系统实时检测坏棋

6. Submit
   用户自行决定何时提交
   系统判断变化是否通过

7. Punishment Problem
   如果用户出现明显坏棋
   系统自动生成“对方如何惩罚这手”的惩罚题

8. Review Mode
   系统根据复习计划、错误记录和题目状态安排复习
```

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
→ 创建默认 Recall Session
→ 进入 Recall Mode
```

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

Play Mode 结束后默认进入。  
用户也可以从 Game Detail 页面手动进入。

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

### 6.2.6 提示与反馈

回忆模式下落子错误时播放错误音效，不做分级提示系统。

### 6.2.7 回忆结果记录

```ts
type RecallSession = {
  id: string
  gameId: string
  mode: 'full_game' | 'key_segment' | 'local_segment' | 'mistake_segment'
  startMove: number
  endMove?: number
  attempts: RecallAttempt[]
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

### 6.2.8 产出

Recall Mode 产出：

- 记错的手；
- 记不住的片段；
- 值得复盘的关键节点；
- 可选的后续复习项。

---

## 6.3 Analysis Mode：复盘模式

### 6.3.1 目标

帮助用户比较实战与参考变化，找到值得出题的关键局面。

### 6.3.2 入口

- Recall Mode 结束后进入；
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

用户在复盘中可以将当前局面 snapshot 为题目。

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
type ProblemAttempt = {
  id: string
  problemId: string
  startedAt: string
  submittedAt?: string
  userLine: string[]
  moveEvaluations: MoveEvaluation[]
  result?: 'pass' | 'soft_pass' | 'fail' | 'abandoned'
  hintLevelUsed: number
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

---

## 6.6 Punishment Problem：惩罚题

### 6.6.1 目标

当用户在做题中下出错误走法时，系统自动生成新题，训练“对方如何惩罚这手”。

### 6.6.2 生成条件

满足任一条件可生成惩罚题：

```text
1. 用户某手导致目差剧烈恶化
2. 用户某手导致胜率剧烈下降
3. AI 显示对方有明确强手
4. 用户手动标记“这手需要惩罚题”
```

MVP 阶段：

```text
只要 scoreDrop 超过阈值，即可生成惩罚题草稿。
```

### 6.6.3 自动生成内容

惩罚题包含：

```ts
type PunishmentProblem = Problem & {
  type: 'punishment'
  parentProblemId: string
  parentAttemptId: string
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

## 6.7 Review Mode：复习模式

### 6.7.1 目标

根据题目状态、复习间隔和用户错误记录，安排题目复习。

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

## 9.3 惩罚手生成

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
 ├─ RecallSession
 ├─ AnalysisSession
 ├─ Problem
 │   ├─ ReferenceLine
 │   ├─ ProblemAttempt
 │   │   ├─ MoveEvaluation
 │   │   └─ BadMove
 │   │       └─ PunishmentProblem
 │   └─ ReviewSchedule
```

## 10.1 Game

见 6.1.4。

## 10.2 Problem

见 6.4.2。

## 10.3 ProblemAttempt

见 6.5.7。

## 10.4 BadMove

```ts
type BadMove = {
  id: string
  problemId: string
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
→ Recall 背谱
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
- 允许结束后进入 Analysis Mode。

### C. Analysis Mode v1

- 支持 Main Board；
- 支持 Reference Board；
- 支持当前变化与参考变化切换；
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
- 系统自动进入 Recall Mode；
- 用户可以从头复现棋谱；
- 系统可以判断每手是否与实战一致；
- 落子错误时播放提示音；
- 系统记录回忆错误点。

## 12.2 Recall → Analysis

- 用户可以从回忆模式进入复盘模式；
- 复盘模式可以定位到回忆错误点；
- 用户可以在复盘模式中查看原始棋谱。

## 12.3 Analysis → Problem

- 用户可以在任意局面 snapshot；
- 题目必须包含局面说明；
- 题目必须包含先行方；
- 保存后进入题库或 inbox。

## 12.4 Problem Attempt

- 用户可以在题目中自由下变化；
- 系统可以对每手请求 AI 评估；
- 系统可以检测 scoreDrop；
- 系统可以提示坏棋；
- 用户可以自行点击提交；
- 系统给出通过 / 勉强通过 / 失败结论。

## 12.5 Punishment Problem

- 用户下出严重坏棋后，系统可以生成 bad move 记录并存入 bad_moves 表；
- 系统可以根据 AI top move 生成惩罚题；
- 惩罚题包含来源题、错误手、惩罚方、局面说明模板；
- 惩罚题进入 inbox。

## 12.6 Review

- 系统能展示到期题；
- 用户完成复习后，系统更新下一次复习时间；
- 做错题会更快再次出现；
- 通过题会延长复习间隔。

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
3. Problem 数据；
4. ProblemAttempt 数据；
5. BadMove / PunishmentProblem 数据。

## Phase 2：最小可用训练链路

1. Play 结束进入 Recall；
2. Recall 完成进入 Analysis；
3. Analysis snapshot 出题；
4. Problem Mode 做题；
5. 提交判断；
6. 生成惩罚题。

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

用户做某一道题的一次尝试。

## Bad Move

用户做题过程中出现的明显坏棋。

## Punishment Problem

由 Bad Move 自动生成的新题，训练“对方如何惩罚这手”。

## Reference Line

参考变化，可以来自 AI 推荐、用户手动选择或题目答案。

## Review Mode

复习模式，根据复习计划安排题目和回忆片段。

---

# 17. 当前版本结论

本产品的第一阶段不追求成为完整围棋平台，而要优先验证一件事：

> 一盘实战棋，能否稳定转化为可回忆、可复盘、可做题、可惩罚、可复习的训练材料。

只要以下闭环跑通，产品就具备核心价值：

```text
下完一盘棋
→ 先背下来
→ 再复盘关键处
→ 把关键局面变成题
→ 做题时自由探索
→ 系统检查是否有坏棋
→ 坏棋自动变成惩罚题
→ 以后反复复习
```
