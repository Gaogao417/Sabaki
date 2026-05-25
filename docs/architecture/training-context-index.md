# Training Context Index

> 文档类型：上下文导航索引
> 用途：Agent 在修改训练系统代码前，根据任务类型定位必读上下文，避免全文阅读后凭印象改代码。
> 使用方法：先判断任务属于哪个**切面**，然后只读该切面对应的文档片段和源码。

主文档层级：

| 优先级 | 文档 | 用途 |
| --- | --- | --- |
| 1 | `docs/product/sabaki-training-prd.md` | 产品闭环与能力边界。 |
| 2 | `docs/design/workbench-mode-orchestration-contract.md` | Workbench 运行态状态机 source of truth。 |
| 3 | `docs/architecture/position-source-mutation-contract.md` | 棋盘读写边界：position source、mutation contract、executor。 |
| 4 | `docs/architecture/workbench-architecture-overview.md` | 迁移架构：mode orchestration -> source/contract -> resolver -> executor -> owner service。 |
| 5 | `docs/architecture/sabaki-function-module-mapping.md` | `sabaki.js` 函数迁移目标。 |
| 6 | `docs/architecture/sabaki-state-field-mapping.md` | 字段和 companion state owner。 |

核心口径：

```text
ModeState / TransitionEffect 是上层真相。
PositionSource / MutationContract 是棋盘读写边界。
Problem entity 不是 mode；WorkbenchMode.problem 是运行态 mode。
```

---

## 切面 A：Task / Tab / Mode

触发关键词：`TrainingTask`、`WorkbenchTab`、`WorkbenchMode`、`openProblemTab`、`openGameTab`、`mode transition`、`TabService`、`workbenchFlowService`、`workbenchModeService`

### 必读

- **PRD**：核心训练闭环、Workbench Mode State Machine、Play / Recall / Analysis / Problem / Review 产品能力。
- **Mode Orchestration Contract**：状态 owner、四个 mode companion state、transition effect、非法 transition、污染风险、类型合同。
- **Position Source and Mutation Contract**：Workbench mode 到 `PositionSource` / `MutationContract` 的派生关系，尤其是 Problem 的 `problemAttemptMove`。
- **Architecture Overview**：Mode Orchestration Layer、resolver / executor / owner service 迁移路径。
- **Function / State Mapping**：函数和字段 owner，确认是否仍处于 legacy facade。

### 必须遵守

- Problem 有两个层级：
  - Problem entity / Problem task 是训练业务实体，表示一道题、惩罚题或题目来源。
  - `WorkbenchMode.problem` 是 workbench 运行态 mode，表示用户正在做题。
- Tab 是 UI 容器，Task 是业务实体，二者职责不同
- Tab 可以关闭，Task 不会因此消失
- 同一 Task 可以多次打开 Tab
- Mode transition 必须走 `workbenchFlowService` 或后续同职责的 `workbenchModeService`
- Task / Attempt / RecallSession 的状态更新由各自 service 负责，但不能绕过 mode transition guard
- 非法 mode transition 必须被拒绝
- 禁止 Component 直接写业务 Store
- 禁止往 `sabaki.js` 新增训练业务

### 相关代码

```
src/modules/training/types/task.ts
src/modules/training/types/tab.ts
src/modules/training/store/workbenchStore.ts
src/modules/training/workbench/workbenchTabService.ts
src/modules/training/workbench/workbenchFlowService.ts
src/modules/training/workbench/workbenchModeService.ts      ← 若拆分 transition effect，可新建
src/modules/training/adapter/legacySabakiAdapter.ts
src/components/TrainingWorkbenchContainer.js
```

---

## 切面 B：Attempt / MoveEvaluation / BadMove / 实时坏棋检测

触发关键词：`TrainingAttempt`、`MoveEvaluation`、`BadMove`、`PlayTrainingMonitor`、`evaluationRules`、`submitPlay`、`bad move detection`、`scoreLoss`

### 必读

- **PRD**：3.4 TrainingAttempt、3.5 MoveEvaluation、3.6 BadMove、9 Play 阶段需求、10 实时坏棋检测、11 Submit / Pass Rule、20.2 验收标准 Play
- **架构**：5.4 attemptService、5.5 playTrainingMonitor、5.6 evaluationRules、9.1 用户下一手棋（命令路径示例）、9.2 用户点击 Submit、10.3 BadMove List 渲染、14 禁止事项
- **实施计划**：Phase 2 Attempt / MoveEvaluation / BadMove

### 必须遵守

- PlayTrainingMonitor 只负责 MoveEvaluation / BadMove，不生成 punishment problem
- 普通 MoveEvaluation 不保存整份 SGF
- MoveEvaluation 和 BadMove 分离，不塞进 Attempt JSON
- BadMove 绑定 MoveEvaluation
- pending evaluation 超时后标记为 failed
- Submit 走 transaction
- 阈值 MVP：major ≥ 2.0 目差、severe ≥ 5.0 目差

### 相关代码

```
src/modules/training/types/attempt.ts
src/modules/training/types/evaluation.ts
src/modules/training/types/badMove.ts
src/modules/training/attempt/attemptService.ts              ← Phase 2 待建
src/modules/training/attempt/playTrainingMonitor.ts          ← Phase 2 待建
src/modules/training/attempt/evaluationRules.ts              ← Phase 2 待建
src/modules/training/adapter/analysisResultAdapter.ts        ← Phase 2 待建
```

---

## 切面 C：Recall / Checkpoint / Comment

触发关键词：`RecallSession`、`RecallAttempt`、`RecallCheckpoint`、`recallService`、`recallCheckpointService`、`correction draft`、`comment`

### 必读

- **PRD**：2.6 Recall 优先于 Analysis、3.7 RecallSession、3.8 RecallAttempt、3.9 RecallCheckpoint、3.11 MoveComment、12 Recall 阶段需求、13 Recall Checkpoint、20.3 验收标准 Recall
- **架构**：5.7 recallService、5.8 recallCheckpointService、9.3 Recall 遇到 BadMove（命令路径示例）、14 禁止事项
- **实施计划**：Phase 3 Recall Checkpoint

### 必须遵守

- Checkpoint 是 Recall 子流程，不是独立 mode
- 只有 major / severe BadMove 才触发 Checkpoint
- 用户先摆 correction line，再看 AI candidate lines
- comment 独立保存，不嵌进 Attempt
- Checkpoint 不再作为 RecallType
- RecallType MVP 简化为 `line_recall`

### 相关代码

```
src/modules/training/types/recall.ts
src/modules/training/types/comment.ts
src/modules/training/recall/recallService.ts                 ← Phase 3 待建
src/modules/training/recall/recallCheckpointService.ts        ← Phase 3 待建
src/components/training/panels/RecallCheckpointPanel.tsx      ← Phase 3 待建
```

---

## 切面 D：Analysis / Snapshot

触发关键词：`Analysis`、`Snapshot`、`snapshotService`、`SnapshotInput`、`TrainingBranchDraft`

### 必读

- **PRD**：2.7 Analysis 是自由研究不污染 Attempt、3.10 Problem（snapshot 创建新 Problem）、14 Analysis 阶段需求、15 Snapshot、20.4 验收标准 Analysis
- **架构**：5.10 snapshotService、7.3 positionSnapshotAdapter、9.4 Analysis 中 Snapshot（命令路径示例）、14 禁止事项
- **实施计划**：Phase 4 Analysis / Snapshot

### 必须遵守

- Analysis 不产生 Attempt，不污染 Attempt 记录
- Snapshot 语义：当前局面 → 新 Problem → 新 Task → 新 Tab → Play
- snapshotService 不负责打开 Tab（由 workbenchTabService 处理）
- TrainingBranchDraft MVP 后置，需要时再引入
- Analysis 阶段 Board 操作不写入 training 事实表

### 相关代码

```
src/modules/training/types/analysis.ts
src/modules/training/types/problem.ts
src/modules/training/analysis/snapshotService.ts              ← Phase 4 待建
src/modules/training/adapter/positionSnapshotAdapter.ts
```

---

## 切面 E：Review / Punishment Problem

触发关键词：`ReviewSchedule`、`reviewService`、`Punishment Problem`、`review queue`、`spaced repetition`

### 必读

- **PRD**：2.5 Punishment Problem 不是 Punishment Tab、3.12 ReviewSchedule、8 Review 流程、16 Problem / Punishment Problem、17 Review、20.5 验收标准 Punishment Problem、20.6 验收标准 Review
- **架构**：5.11 reviewService、5.9 problemService、4.4 reviewQueueStore（可选）、9.5 Review 打开到期题（命令路径示例）、14 禁止事项
- **实施计划**：Phase 5 Review / Punishment

### 必须遵守

- Punishment Problem 是 `Problem.type = 'punishment'`，进入题库 / Review 队列
- 不自动打开 Punishment Tab
- Review 打开的是 Task / Problem，不是历史 Tab
- Review 不是特殊棋盘模式
- review 调度规则归入 reviewService
- Review 更新规则 MVP 保持简单

### 相关代码

```
src/modules/training/types/review.ts
src/modules/training/types/problem.ts
src/modules/training/review/reviewService.ts                  ← Phase 5 待建
src/modules/training/problem/problemService.ts                ← Phase 5 待建
```

---

## 切面 F：Legacy 清理 / Adapter

触发关键词：`legacySabakiAdapter`、`trainingStore.js`、`sabaki.js cleanup`、`migration`、`strangler pattern`

### 必读

- **PRD**：0.2 v0.4 主要优化（整体迁移方向）、18 MVP 范围、19 暂不做范围
- **架构**：3.1 sabaki.js、3.11 trainingStore.js 当前过渡层、7.1 legacySabakiAdapter、13 从当前代码迁移的步骤、14.5 Existing Core 红线
- **实施计划**：Phase 6 Legacy Cleanup

### 必须遵守

- 新训练业务不继续塞进 `sabaki.js`
- Adapter 只隔离 legacy API，不承载训练业务规则
- 旧表和旧 state 保留兼容读取
- 新流程写入新事实表
- 每个阶段结束时应用必须可运行

### 相关代码

```
src/modules/training/adapter/legacySabakiAdapter.ts
src/modules/training/trainingStore.js
src/modules/sabaki.js
```

---

## 切面 G：Store / Repository（基础设施层）

触发关键词：`workbenchStore`、`trainingRuntimeStore`、`trainingRepository`、`DB migration`、`transaction`

### 必读

- **PRD**：18.1 MVP 目标（工程约束部分）
- **架构**：4.1 Store 总原则、4.2 workbenchStore、4.3 trainingRuntimeStore、6 Repository 设计、14.1 Store 红线、14.3 Repository 红线、11 数据模型和表关系
- **实施计划**：Phase 0 基础设施

### 必须遵守

- Store 不调用 Service / Repository / Adapter
- Store 只保存状态和通知订阅者
- Service 写 Store，Container 读 Store
- Store 控制在 2～3 个
- Repository 是训练 DB 唯一入口
- Repository 不调 Service、不知道 UI
- 关键写入必须走 transaction
- 每个 Service 不直接散落写 `db.js`

### 相关代码

```
src/modules/training/store/workbenchStore.ts
src/modules/training/store/trainingRuntimeStore.ts
src/modules/training/repository/trainingRepository.ts
```

---

## 全局架构红线（所有切面都必须遵守）

无论任务属于哪个切面，以下红线始终生效：

```text
1. 新训练业务不要继续塞进 sabaki.js
2. Store 不调用 Service
3. Component 不直接写业务 Store（通过 Service）
4. Mode transition 必须走 workbenchFlowService / workbenchModeService
5. Repository 是训练 DB 唯一入口
6. Adapter 只隔离 legacy API，不承载业务规则
7. Problem entity 不是 mode；WorkbenchMode.problem 是一等运行态 mode
8. Attempt 是核心事实表
9. MoveEvaluation 和 BadMove 分离
10. 每个 Phase 实施结束后应用必须可运行
```

---

## 如何使用本索引

```text
用户任务
  → 判断属于哪个切面（A~G）
  → 读取该切面的「必读」文档片段
  → 读取「相关代码」
  → 输出 Context Digest
  → 写最小修改计划
  → 改代码
  → 跑测试 / 自检
```

不要这样做：

```text
用户任务 → 全文读 PRD → 自己总结 → 凭印象改代码
```
