Date: 2026-05-25
Status: pending-confirmation
Updated: 2026-05-25 (v0.1-rev2: fix auditor block issues round 2 -- add PRD v0.5 to true sources, fix Layer values in Section 9+10, add P1G-T01-T04 detail rows)

# Phase 1 Contract Gaps -- Test/Acceptance Contract v0.1

# 契约草案

## 0. 真源对齐

| 真源 | 实际路径 | 章节/行索引 | 对本契约的约束 |
|------|----------|------------|----------------|
| PRD v0.5 | `docs/archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md` | Section 4.3: WorkbenchTab, WorkbenchMode, WorkbenchPlayerConfig; Section 5.1: openTask flow; Section 8.1: Task/Mode acceptance | 产品层上游约束：mode 定义、tab 结构、openTask 行为 |
| Architecture v0.5 | `docs/archive/architecture-versions/gabaki-sabaki-training-architecture-v0.5.md` | Section 0.4: "模式转换必须收敛到一个可测试的状态机模块" | Gap 1: 提取纯状态机模块 |
| Architecture v0.5 | 同上 | Section 0.4: RecallSubstate type (lines 121-124) | Gap 2: 必须定义 RecallSubstate |
| Architecture v0.5 | 同上 | Section 0.4: AnalysisReturnTarget type (lines 126-131) | Gap 3: 必须定义 AnalysisReturnTarget |
| Architecture v0.5 | 同上 | Section 4.2: WorkbenchTab with recallSubstate and analysisReturnTarget | Gap 4: 增加字段 |
| Architecture v0.5 | 同上 | Section 5.3: enterRecall API signature | Gap 5: 独立 enterRecall 方法 |
| Architecture v0.5 | 同上 | Section 5.3: "returnFromAnalysis 只能使用保存过的 AnalysisReturnTarget" | Gap 6: 签名变更 |
| Architecture v0.5 | 同上 | Section 5.3: "workbenchFlowService 替代 v0.4 中过强的 workbenchPhaseService" | Gap 7: deprecated 标记 |
| Architecture v0.5 | 同上 | Section 5.2: "禁止 API" 列表 | Gap 7: legacy 方法不扩展 |
| Architecture v0.5 | 同上 | Section 0.4: Invariants | 所有 Gap 约束基础 |

**真源路径说明**: CLAUDE.md 引用 `docs/design/` 下的文件已迁移到 `docs/archive/` 目录。`docs/archive/prd-versions/gabaki-sabaki-training-prd-v0.5.md` 和 `docs/archive/architecture-versions/gabaki-sabaki-training-architecture-v0.5.md` 是 CLAUDE.md Section 0 指定的"产品与架构唯一事实来源"的权威版本。优先级: PRD v0.5 > Architecture v0.5。

## 1. 用户故事

### US-1: 状态机可测试性
作为 workbenchFlowService 的维护者，我希望模式转换规则收敛到一个纯状态机模块 `modeTransitions.ts`，这样我可以在零 mock 的条件下穷举测试所有合法/非法转换，而不是在 Service 内联逻辑中分散测试。

### US-2: Recall 子状态可见
作为训练系统开发者，我希望 WorkbenchTab 上有 `recallSubstate` 字段，这样 Recall 检查点流程可以作为 Recall 的子状态推进，而不是独立 WorkbenchMode。

### US-3: Analysis 返回目标持久化
作为训练系统开发者，我希望 WorkbenchTab 上有 `analysisReturnTarget` 字段，保存进入 Analysis 前的 mode、recallSubstate、treePosition 和 moveIndex，这样 returnFromAnalysis 不需要猜测返回哪里。

### US-4: 显式进入 Recall
作为 workbenchFlowService 的消费者，我希望有独立的 `enterRecall({tabId, attemptId})` 方法，这样不依赖 submit 的副作用也能进入 Recall。

### US-5: Analysis Return 不猜测
作为 workbenchFlowService 的消费者，我希望 `returnFromAnalysis({tabId})` 只使用 tab 上保存的 `analysisReturnTarget`，不接受外部传入的 toMode 参数，这样不可能恢复到错误的 mode。

### US-6: Legacy Service 明确弃用
作为代码库维护者，我希望 `workbenchPhaseService` 标记 `@deprecated` 且不再扩展，这样新人不会误用它作为主路径。

## 2. 用户动作

此契约是 Phase 1 model/type/service 层，不涉及 UI 动作。间接关联的用户动作：

- 用户在 play/problem 模式点击 Submit -> 触发 `submit` 转换
- 用户点击进入 Analysis -> 触发 `enterAnalysis` 转换
- 用户在 Analysis 点击返回 -> 触发 `returnFromAnalysis` 转换
- 用户点击重新开始 -> 触发 `restartAttempt` 转换
- 用户在 Recall 中触发检查点 -> 触发 `startCheckpoint` 子状态转换
- 用户在任何模式点击 Snapshot -> 触发 `snapshot` 全局动作

## 3. 当前阶段

Phase 1: Workbench Mode + openTask 骨架。约 75% 完成。
此契约补齐剩余的类型、状态机和服务签名缺口。

## 4. 位置源

| 位置源 | 用途 |
|--------|------|
| game-tree | Analysis 自由摆棋使用，不写 Attempt.userLine |
| workbench-tab | tab.mode, tab.recallSubstate, tab.analysisReturnTarget 是转换核心状态 |

## 5. 变更契约

### Gap 1: 提取 modeTransitions.ts

**新建文件**: `src/modules/training/workbench/modeTransitions.ts`

从 `workbenchFlowService.ts` 提取内联的 `MODE_TRANSITIONS` 和 `TRANSITION_RESULT` 表到独立纯函数模块。

模块必须导出：

```ts
// types already in tab.ts
import type { WorkbenchMode } from '../types/tab'
import type { RecallSubstate } from '../types/tab'

type TransitionEvent =
  | 'submit'
  | 'enterAnalysis'
  | 'returnFromAnalysis'
  | 'restartAttempt'
  | 'snapshot'
  | 'startCheckpoint'
  | 'revealAi'
  | 'commentCheckpoint'
  | 'resumeRecall'

type TransitionInput = {
  from: WorkbenchMode
  recallSubstate?: RecallSubstate
  event: TransitionEvent
  // guards need these at resolution time
  hasActiveAttempt: boolean
  isAttemptFrozen: boolean
  hasActiveRecallSession: boolean
  hasTask: boolean
  hasCheckpoint: boolean
  isCorrectionSubmitted: boolean
  isCheckpointAiRevealed: boolean
  isCheckpointSavedOrSkipped: boolean
  hasAnalysisReturnTarget: boolean
}

type TransitionResult = {
  allowed: true
  targetMode: WorkbenchMode
  targetRecallSubstate?: RecallSubstate
  effects: TransitionEffect[]
} | {
  allowed: false
  reason: string
}

type TransitionEffect =
  | 'freezeAttempt'
  | 'createRecall'
  | 'saveAnalysisReturnTarget'
  | 'clearAnalysisReturnTarget'
  | 'restorePreviousMode'
  | 'clearActiveCheckpoint'
  | 'createNewTaskAndTab'

// Core pure function
function resolveTransition(input: TransitionInput): TransitionResult

// Utility: list allowed events for a given mode state
function getAllowedEvents(mode: WorkbenchMode, recallSubstate?: RecallSubstate): TransitionEvent[]
```

状态机表必须完整覆盖 Architecture v0.5 Section 0.4 的 10 行转换。

### Gap 2: RecallSubstate 类型

**修改文件**: `src/modules/training/types/tab.ts`

新增：

```ts
export type RecallSubstate =
  | 'normal'
  | 'checkpoint_correction'
  | 'checkpoint_ai_revealed'
  | 'checkpoint_commenting'
```

### Gap 3: AnalysisReturnTarget 类型

**修改文件**: `src/modules/training/types/tab.ts`

新增：

```ts
export type AnalysisReturnTarget = {
  mode: 'play' | 'problem' | 'recall'
  recallSubstate?: RecallSubstate
  treePosition?: string
  moveIndex?: number
}
```

### Gap 4: WorkbenchTab 字段

**修改文件**: `src/modules/training/types/tab.ts`

WorkbenchTab 增加：

```ts
recallSubstate?: RecallSubstate
analysisReturnTarget?: AnalysisReturnTarget
```

同时从 WorkbenchTab 移除 `previousMode`（被 `analysisReturnTarget.mode` 替代）。

注意：这是一个 breaking change。所有读取 `tab.previousMode` 的代码必须迁移到 `tab.analysisReturnTarget?.mode`。

### Gap 5: enterRecall 方法

**修改文件**: `src/modules/training/workbench/workbenchFlowService.ts`

WorkbenchFlowService 类型签名新增：

```ts
enterRecall(input: {tabId: string; attemptId: string}): Promise<RecallSession>
```

### Gap 6: returnFromAnalysis 签名变更

**修改文件**: `src/modules/training/workbench/workbenchFlowService.ts`

从 `returnFromAnalysis(tabId: string, toMode: WorkbenchMode)` 变更为 `returnFromAnalysis(input: {tabId: string}): Promise<void>`。

实现必须：
1. 读取 `tab.analysisReturnTarget`
2. 如果 `analysisReturnTarget` 不存在，throw InvalidModeTransitionError
3. 恢复 mode = `analysisReturnTarget.mode`
4. 恢复 `recallSubstate` = `analysisReturnTarget.recallSubstate`
5. 恢复 `currentTreePosition` = `analysisReturnTarget.treePosition`
6. 清除 `analysisReturnTarget`

### Gap 7: workbenchPhaseService 弃用

**修改文件**:
- `src/modules/training/workbench/workbenchPhaseService.ts` -- 添加 `@deprecated` JSDoc
- `src/modules/training/workbench/index.ts` -- 导出添加 `@deprecated` 注释

不删除文件，不删除导出，不删除现有功能。仅标记弃用。

## 6. 预期状态流

### submit: play/problem -> recall

```
modeTransitions.resolveTransition({
  from: 'play', event: 'submit',
  hasActiveAttempt: true, isAttemptFrozen: false,
  ...
}) => { allowed: true, targetMode: 'recall', targetRecallSubstate: 'normal',
        effects: ['freezeAttempt', 'createRecall'] }

workbenchFlowService.submit(tabId):
  1. resolveTransition (pure)
  2. if !allowed: throw
  3. execute effects in order:
     - freezeAttempt -> attemptService
     - createRecall -> recallService
  4. workbenchStore.updateTab(tabId, {
       mode: 'recall',
       recallSubstate: 'normal',
       activeRecallSessionId: session.id
     })
  5. runtimeStore.setActiveRecallSession(session.id)
```

### enterAnalysis: play/problem/recall -> analysis

```
modeTransitions.resolveTransition({
  from: 'play', event: 'enterAnalysis',
  hasTask: true, ...
}) => { allowed: true, targetMode: 'analysis',
        effects: ['saveAnalysisReturnTarget'] }

workbenchFlowService.enterAnalysis({tabId, context?, returnTarget?}):
  1. resolveTransition (pure)
  2. if !allowed: throw
  3. build analysisReturnTarget from current tab state:
     { mode: tab.mode, recallSubstate: tab.recallSubstate,
       treePosition: tab.currentTreePosition, moveIndex: ... }
  4. workbenchStore.updateTab(tabId, {
       mode: 'analysis',
       analysisContext,
       analysisReturnTarget: returnTarget ?? builtTarget
     })
```

### returnFromAnalysis: analysis -> previous mode

```
modeTransitions.resolveTransition({
  from: 'analysis', event: 'returnFromAnalysis',
  hasAnalysisReturnTarget: true, ...
}) => { allowed: true, targetMode: returnTarget.mode,
        targetRecallSubstate: returnTarget.recallSubstate,
        effects: ['clearAnalysisReturnTarget', 'restorePreviousMode'] }

workbenchFlowService.returnFromAnalysis({tabId}):
  1. read tab.analysisReturnTarget
  2. if !analysisReturnTarget: throw
  3. resolveTransition (pure)
  4. if !allowed: throw
  5. workbenchStore.updateTab(tabId, {
       mode: tab.analysisReturnTarget.mode,
       recallSubstate: tab.analysisReturnTarget.recallSubstate,
       currentTreePosition: tab.analysisReturnTarget.treePosition,
       analysisReturnTarget: undefined
     })
```

### Checkpoint 子状态转换 (Phase 5 -- DEFERRED)

```
startCheckpoint: recall + recallSubstate=normal -> recall + recallSubstate=checkpoint_correction
revealAi: recall + recallSubstate=checkpoint_correction -> recall + recallSubstate=checkpoint_ai_revealed
commentCheckpoint: recall + recallSubstate=checkpoint_ai_revealed -> recall + recallSubstate=checkpoint_commenting
resumeRecall: recall + checkpoint saved/skipped -> recall + recallSubstate=normal
```

这些转换改变 recallSubstate 但不改变 tab.mode。

## 7. 允许的副作用

1. `modeTransitions.ts` 模块本身无副作用（纯函数）
2. `workbenchFlowService` 执行 modeTransitions 返回的 effects 时产生副作用：
   - `attemptService.freezeAttempt` -- DB 写入
   - `recallService.createRecallFromAttempt` / `enterRecall` -- DB 写入
   - `workbenchStore.updateTab` -- store 状态更新
   - `trainingRuntimeStore.setActiveRecallSession` -- runtime 状态更新
   - `snapshotService.captureSnapshotInput` + `taskImportService.createTaskFromSnapshot` + `tabService.openTask` -- Snapshot 副作用链
3. `@deprecated` JSDoc 添加 -- 编译时警告，无运行时副作用
4. `InvalidModeTransitionError` throw -- 结构化错误，可能被 logger 记录

## 8. 禁止的副作用

1. modeTransitions.ts 不得 import 任何 service、store、adapter 或 DB 模块
2. modeTransitions.ts 不得产生 IO 副作用（no fetch, no DB, no DOM）
3. `returnFromAnalysis` 不得接受 toMode 参数
4. Checkpoint 子状态转换不得改变 `tab.mode`（只改变 `tab.recallSubstate`）
5. Analysis 自由摆棋不得写入 `Attempt.userLine`
6. Snapshot 不得修改当前 tab 的 mode
7. Snapshot 不得复用当前 tab 作为新 task
8. workbenchPhaseService 不得获得新功能、新方法或新的 flow 编排

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
|----|------|------|------|--------|----------|
| P1G-T01 | Type | ARCHITECTURE_BOUNDARY | RecallSubstate type 存在于 tab.ts 且包含全部 4 个值 | MUST | 类型缺失导致编译错误 |
| P1G-T02 | Type | ARCHITECTURE_BOUNDARY | AnalysisReturnTarget type 存在于 tab.ts 且包含 mode, recallSubstate?, treePosition?, moveIndex? | MUST | 类型缺失导致恢复逻辑无法类型安全 |
| P1G-T03 | Type | ARCHITECTURE_BOUNDARY | WorkbenchTab 包含 recallSubstate? 和 analysisReturnTarget? 字段 | MUST | Store 无法承载新状态 |
| P1G-T04 | Pure | ARCHITECTURE_BOUNDARY | modeTransitions.ts 作为独立模块存在且可 import | MUST | 无法独立测试状态机 |
| P1G-T05 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(play, submit, hasActiveAttempt=true, isAttemptFrozen=false) => allowed=true, targetMode=recall, targetRecallSubstate=normal, effects includes freezeAttempt and createRecall | MUST | 主业务流核心转换 |
| P1G-T06 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(problem, submit, hasActiveAttempt=true, isAttemptFrozen=false) => allowed=true, targetMode=recall, targetRecallSubstate=normal | MUST | 主业务流核心转换 |
| P1G-T07 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(play, submit, hasActiveAttempt=false) => allowed=false | MUST | guard 执行正确 |
| P1G-T08 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(play, submit, isAttemptFrozen=true) => allowed=false | MUST | 防止重复 submit |
| P1G-T09 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(recall, enterAnalysis, hasActiveRecallSession=true) => allowed=true, targetMode=analysis, effects includes saveAnalysisReturnTarget | MUST | recall -> analysis 转换 |
| P1G-T10 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(play, enterAnalysis, hasTask=true) => allowed=true, targetMode=analysis, effects includes saveAnalysisReturnTarget | MUST | play -> analysis 转换 |
| P1G-T11 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(problem, enterAnalysis, hasTask=true) => allowed=true, targetMode=analysis, effects includes saveAnalysisReturnTarget | MUST | problem -> analysis 转换 |
| P1G-T12 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(analysis, returnFromAnalysis, hasAnalysisReturnTarget=true) => allowed=true, effects includes clearAnalysisReturnTarget + restorePreviousMode | MUST | 分析返回核心逻辑 |
| P1G-T13 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(analysis, returnFromAnalysis, hasAnalysisReturnTarget=false) => allowed=false, reason 包含描述 | MUST | 防止无目标返回 |
| P1G-T14 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(analysis, restartAttempt, hasTask=true) => allowed=true, effects includes createNewAttempt | MUST | 重新开始转换 |
| P1G-T15 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(any, snapshot) => allowed=true, effects includes createNewTaskAndTab, targetMode 不变 | MUST | 快照不变当前 tab |
| P1G-T16 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(recall, submit) => allowed=false | MUST | 非法转换拒绝 |
| P1G-T17 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(analysis, submit) => allowed=false | MUST | 非法转换拒绝 |
| P1G-T18 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(analysis, enterAnalysis) => allowed=false | MUST | 非法转换拒绝 |
| P1G-T19 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(play, returnFromAnalysis) => allowed=false | MUST | 非法转换拒绝 |
| P1G-T20 | Pure | CONTROLLER_STATE_TRANSITION | getAllowedEvents(play) => includes 'submit' and 'enterAnalysis' | MUST | UI 可用动作查询 |
| P1G-T21 | Pure | CONTROLLER_STATE_TRANSITION | getAllowedEvents(recall) => includes enterAnalysis + checkpoint events | MUST | recall 子状态全事件 |
| P1G-T22 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(recall, startCheckpoint, hasActiveRecallSession=true, hasCheckpoint=true) => allowed=true, targetMode=recall, targetRecallSubstate=checkpoint_correction | DEFERRED | Phase 5 基础设施不存在 |
| P1G-T23 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(recall, revealAi, recallSubstate=checkpoint_correction, isCorrectionSubmitted=true) => allowed=true, targetRecallSubstate=checkpoint_ai_revealed | DEFERRED | Phase 5 基础设施不存在 |
| P1G-T24 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(recall, commentCheckpoint, recallSubstate=checkpoint_ai_revealed) => allowed=true, targetRecallSubstate=checkpoint_commenting | DEFERRED | Phase 5 基础设施不存在 |
| P1G-T25 | Pure | CONTROLLER_STATE_TRANSITION | resolveTransition(recall, resumeRecall, isCheckpointSavedOrSkipped=true) => allowed=true, targetRecallSubstate=normal, effects includes clearActiveCheckpoint | DEFERRED | Phase 5 基础设施不存在 |
| P1G-T26 | Service | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.submit 在转换后设置 tab.recallSubstate='normal' | MUST | recallSubstate 不会被初始化 |
| P1G-T27 | Service | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.enterAnalysis 在转换时保存 analysisReturnTarget 到 tab | MUST | 返回目标丢失 |
| P1G-T29 | Service | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.returnFromAnalysis 恢复 mode, recallSubstate, currentTreePosition 并清除 analysisReturnTarget | MUST | 返回后状态不完整 |
| P1G-T30 | Service | SERVICE_REPOSITORY_TRANSITION | returnFromAnalysis 在 analysisReturnTarget 不存在时 throw InvalidModeTransitionError | MUST | 防止猜测模式 |
| P1G-T32 | Service | SERVICE_REPOSITORY_TRANSITION | enterRecall 创建 RecallSession 并设置 tab mode=recall, recallSubstate=normal, activeRecallSessionId | MUST | recall 进入逻辑不完整 |
| P1G-T33 | Type | ARCHITECTURE_BOUNDARY | workbenchPhaseService 的 createWorkbenchPhaseService 函数有 @deprecated JSDoc | MUST | 新人误用 |
| P1G-T34 | Type | ARCHITECTURE_BOUNDARY | workbenchPhaseService 导出项有 @deprecated 标记 | MUST | 新人误用 |
| P1G-T35 | Store | STORE_SUBSCRIPTION | workbenchStore.updateTab 正确持久化 recallSubstate 和 analysisReturnTarget 字段 | MUST | 新字段无法存储 |
| P1G-T36 | Service | ARCHITECTURE_BOUNDARY | modeTransitions 不 import 任何 service/store/adapter/DB | MUST | 纯函数边界违规 |
| P1G-T37 | Service | SIDE_EFFECT_BOUNDARY | Analysis 自由摆棋不写 Attempt.userLine (regression guard) | MUST | 架构核心不变量 |

## 10. 必须自动化的测试

### Layer: CONTROLLER_STATE_TRANSITION (modeTransitions.ts pure functions)

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
|---------|-------|--------------------|-------------------|---------------------|---------------------|-----------------|-------------------|-----------------------|
| P1G-T05 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | resolveTransition 输出 allowed=true, targetMode='recall', targetRecallSubstate='normal' | P1G-T26 |
| P1G-T06 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | problem->submit => recall | P1G-T26 |
| P1G-T07 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | no active attempt => allowed=false | N/A |
| P1G-T08 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | frozen attempt => allowed=false | N/A |
| P1G-T09 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | recall->enterAnalysis => analysis | P1G-T27 |
| P1G-T10 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | play->enterAnalysis => analysis | P1G-T27 |
| P1G-T11 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | problem->enterAnalysis => analysis | P1G-T27 |
| P1G-T12 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | analysis->return with target => restore | P1G-T29 |
| P1G-T13 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | analysis->return without target => disallowed | P1G-T30 |
| P1G-T14 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | analysis->restartAttempt => allowed | N/A |
| P1G-T15 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | snapshot from any mode => targetMode unchanged | N/A |
| P1G-T16 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | recall->submit => disallowed | N/A |
| P1G-T17 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | analysis->submit => disallowed | N/A |
| P1G-T18 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | analysis->enterAnalysis => disallowed | N/A |
| P1G-T19 | CONTROLLER_STATE_TRANSITION | modeTransitions.resolveTransition | none | none | N/A | any mock | play->returnFromAnalysis => disallowed | N/A |
| P1G-T20 | CONTROLLER_STATE_TRANSITION | modeTransitions.getAllowedEvents | none | none | N/A | any mock | play => includes 'submit' and 'enterAnalysis' | N/A |
| P1G-T21 | CONTROLLER_STATE_TRANSITION | modeTransitions.getAllowedEvents | none | none | N/A | any mock | recall => contains enterAnalysis + checkpoint events | N/A |

### Layer: SERVICE_REPOSITORY_TRANSITION (workbenchFlowService integration)

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
|---------|-------|--------------------|-------------------|---------------------|---------------------|-----------------|-------------------|-----------------------|
| P1G-T26 | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.submit | real workbenchStore, real modeTransitions | attemptService, recallService, repository | satisfies AttemptService/RecallService interfaces or shared typed factory | modeTransitions | tab.recallSubstate === 'normal' after submit | P1G-T35 |
| P1G-T27 | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.enterAnalysis | real workbenchStore, real modeTransitions | none needed (synchronous) | N/A | any mock | tab.analysisReturnTarget.mode === original mode, tab.analysisReturnTarget.recallSubstate === original recallSubstate | P1G-T29 |
| P1G-T29 | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.returnFromAnalysis | real workbenchStore, real modeTransitions | none needed | N/A | modeTransitions | mode, recallSubstate, currentTreePosition 恢复; analysisReturnTarget 清除 | N/A |
| P1G-T30 | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.returnFromAnalysis without target | real workbenchStore, real modeTransitions | none | N/A | modeTransitions | throws InvalidModeTransitionError | N/A |
| P1G-T32 | SERVICE_REPOSITORY_TRANSITION | workbenchFlowService.enterRecall | real workbenchStore, real modeTransitions | attemptService, recallService | satisfies AttemptService/RecallService interfaces or shared typed factory | modeTransitions | tab.mode=recall, tab.recallSubstate='normal', tab.activeRecallSessionId set | N/A |
| P1G-T35 | STORE_SUBSCRIPTION | workbenchStore.updateTab with new fields | real workbenchStore | none | N/A | any mock | getState() reflects recallSubstate and analysisReturnTarget | N/A |
| P1G-T37 | SIDE_EFFECT_BOUNDARY | Analysis mode no Attempt.userLine mutation | real evaluationRules | repository, analysisService | satisfies Repository/AnalysisService interfaces or shared typed factory | evaluationRules | No appendMove calls during analysis | N/A |

### Layer: ARCHITECTURE_BOUNDARY

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
|---------|-------|--------------------|-------------------|---------------------|---------------------|-----------------|-------------------|-----------------------|
| P1G-T01 | ARCHITECTURE_BOUNDARY | RecallSubstate type in tab.ts | TypeScript compiler | none | N/A | any | RecallSubstate type exists with all 4 values | P1G-T05+ |
| P1G-T02 | ARCHITECTURE_BOUNDARY | AnalysisReturnTarget type in tab.ts | TypeScript compiler | none | N/A | any | AnalysisReturnTarget type exists with mode, recallSubstate?, treePosition?, moveIndex? | P1G-T29 |
| P1G-T03 | ARCHITECTURE_BOUNDARY | WorkbenchTab fields | TypeScript compiler | none | N/A | any | WorkbenchTab has recallSubstate? and analysisReturnTarget? fields | P1G-T35 |
| P1G-T04 | ARCHITECTURE_BOUNDARY | modeTransitions module existence | TypeScript import resolution | none | N/A | any | module can be imported from workbench/ path | P1G-T05+ |
| P1G-T36 | ARCHITECTURE_BOUNDARY | modeTransitions imports | TypeScript compiler | none | N/A | any | modeTransitions module does not import service/store/adapter/DB | N/A |
| P1G-T33 | ARCHITECTURE_BOUNDARY | workbenchPhaseService deprecation | TypeScript AST / JSDoc parser | none | N/A | any | createWorkbenchPhaseService has @deprecated tag | N/A |
| P1G-T34 | ARCHITECTURE_BOUNDARY | workbenchPhaseService exports deprecation | TypeScript AST / JSDoc parser | none | N/A | any | exported types have @deprecated tag | N/A |

### DEFERRED Tests (Phase 5 prerequisite)

| Test ID | Layer | Production Subject | Deferral Reason | Exit Condition |
|---------|-------|--------------------|----------------|----------------|
| P1G-T22 | CONTROLLER_STATE_TRANSITION | resolveTransition startCheckpoint | recallCheckpointService infrastructure does not exist in Phase 1 scope | Phase 5 Recall Checkpoint implementation starts |
| P1G-T23 | CONTROLLER_STATE_TRANSITION | resolveTransition revealAi | requires checkpoint_correction substate infrastructure | Phase 5 Recall Checkpoint implementation starts |
| P1G-T24 | CONTROLLER_STATE_TRANSITION | resolveTransition commentCheckpoint | requires checkpoint_ai_revealed substate infrastructure | Phase 5 Recall Checkpoint implementation starts |
| P1G-T25 | CONTROLLER_STATE_TRANSITION | resolveTransition resumeRecall | requires checkpoint lifecycle infrastructure | Phase 5 Recall Checkpoint implementation starts |

## 11. 仅手动验收

| ID | 验收内容 | 方式 |
|----|----------|------|
| P1G-MA01 | TypeScript 编译通过，WorkbenchTab 新字段不引起现有代码编译错误 | `npx tsc --noEmit` |
| P1G-MA02 | 现有 workbenchFlowService 测试全部通过（submit/enterAnalysis/returnFromAnalysis 签名变更后的回归） | `npm test` |
| P1G-MA03 | `@deprecated` 标记在 IDE 中显示删除线 | 手动在 VSCode 中验证 |
| P1G-MA04 | returnFromAnalysis 不再出现在任何调用点以 `(tabId, toMode)` 两参数形式被调用 | `grep -rn "returnFromAnalysis" src/` |

## 12. 不测试

| 项目 | 原因 |
|------|------|
| `@deprecated` 标记的运行时行为 | JSDoc 标记是编译时/IDE 提示，无运行时行为 |
| WorkbenchTab 旧字段 `previousMode` 的完整移除 | 可能需要渐进迁移，此轮仅标记为 deprecated 并确保新代码不使用 |
| Checkpoint 子状态转换的 service 编排 | Phase 5 范围 |
| RecallPolicy / expectedMoveIndexes 的完整 RecallSession 行为 | Phase 0 Recall Policy 已有独立契约，此轮只补类型 |
| AnalysisContext 的完整字段对齐 | 此轮只关注 AnalysisReturnTarget |
| workbenchTabService 中 openGameTab/openProblemTab/openSnapshotProblemTab 的移除 | Legacy 兼容性保留，标记 deprecated 即可 |

## 13. 脆弱测试警告

| 风险 | 说明 | 缓解 |
|------|------|------|
| resolveTransition 的 effects 列表精确匹配 | 测试断言 effects 严格等于 ['freezeAttempt', 'createRecall'] 可能对未来新增 effect 过度敏感 | 断言 effects 包含必要 effect（用 includes 或 superset），不要求精确顺序 |
| returnFromAnalysis 恢复的字段列表 | 断言所有 4 个字段（mode, recallSubstate, currentTreePosition, analysisReturnTarget）精确匹配 | 使用对象部分匹配而非全等断言 |
| enterRecall 创建 RecallSession 的内部实现路径 | 不应断言 createRecallFromAttempt vs createRecallSession 的选择 | 断言最终 tab 状态正确即可 |
| Mock stub 必须绑定生产接口 | JS 测试中的 stub 没有编译期类型检查 | stub 对象使用 JSDoc `@type {AttemptService & {calls:...}}` 或迁移为 TS 测试文件 |
| TypeScript import 检查 | P1G-T36 不应在运行时用正则匹配 import 路径 | 应使用 TypeScript compiler API 或依赖 tsc 编译通过 |

## 14. 超出范围

| 项目 | 原因 |
|------|------|
| UI 组件变更 | Phase 1 纯 model/type/service 层 |
| RecallCheckpointService 完善 | Phase 5 |
| RecallPolicy / expectedMoveIndexes 实现 | Phase 0 已有独立契约 |
| AnalysisModePanel / RecallModePanel 的 recallSubstate 渲染 | 需要 UI wiring，Phase 2+ |
| WorkbenchTab.previousMode 的完全移除 | 渐进迁移，需要所有消费者适配后才能移除 |
| snapshotService 的 SnapshotTaskInput 完整字段 | Architecture v0.5 的完整 SnapshotTaskInput 定义超出了 Phase 1 范围 |
| AiMovePending 竞态保护 | Phase 3 范围 |
| ExplorationBranch 类型 | Phase 4 范围 |

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
|--------|------|------|------|
| returnFromAnalysis 是否使用 toMode 参数 | CONFLICT: 当前实现 `returnFromAnalysis(tabId, toMode)` 接受 toMode，违反 Architecture v0.5 "不允许靠临时 toMode 猜测" | workbenchFlowService.ts line 211 | 必须改为 `returnFromAnalysis({tabId})` 签名，从 tab.analysisReturnTarget 读取 |
| previousMode 是否被 analysisReturnTarget 替代 | CONFLICT: 当前 WorkbenchTab 使用 `previousMode?: WorkbenchMode`，缺少 recallSubstate/treePosition/moveIndex | tab.ts line 34 | 必须新增 analysisReturnTarget 字段，previousMode 标记 deprecated |
| RecallSubstate 是否存在 | CONFLICT: 当前 RecallSubstate 类型不存在于任何文件中 | grep 结果: 无 RecallSubstate 定义 | 必须在 tab.ts 新增类型 |
| workbenchPhaseService 是否仍在扩展 | CONFLICT: 仍被 index.ts 正式导出，无 deprecated 标记 | index.ts lines 8-15 | 必须添加 @deprecated |
| openSnapshotProblemTab 是否在主路径使用 | CONFLICT: workbenchPhaseService.snapshotFromAnalysis 调用 tabService.openSnapshotProblemTab | workbenchPhaseService.ts line 158 | phaseService 已 deprecated，其内部调用 legacy API 不阻塞此轮 |
| modeTransitions 是否为内联逻辑 | CONFLICT: MODE_TRANSITIONS 和 TRANSITION_RESULT 内联在 workbenchFlowService.ts lines 9-23 | workbenchFlowService.ts | 必须提取为独立模块 |
| enterRecall 是否存在 | CONFLICT: Architecture v0.5 Section 5.3 定义 enterRecall 为独立方法，但当前实现中不存在 | workbenchFlowService.ts: 无 enterRecall 方法 | 必须新增 |
| 是否把 origin.provider 当作流程分支 | OK: 此轮不涉及 origin 分支逻辑 | N/A | 无处理 |
| 是否让 container 直接写 store | OK: 此轮不涉及 container 层 | N/A | 无处理 |
| 是否让 snapshotService 打开 tab | OK: 此轮不修改 snapshotService | N/A | 无处理 |

## 16. 状态机表展开

Architecture v0.5 Section 0.4 的 10 行转换 + 补充的非法转换行：

| 字段/事件 | from | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
|-----------|------|------------|---------|----------|--------------|
| submit | play | allowed=true, targetMode=recall, recallSubstate=normal, effects=[freezeAttempt, createRecall] (guard: activeAttempt && !frozen) | P1G-T05 | GREEN | -- |
| submit | problem | allowed=true, targetMode=recall, recallSubstate=normal, effects=[freezeAttempt, createRecall] (guard: activeAttempt && !frozen) | P1G-T06 | GREEN | -- |
| submit | play (no attempt) | allowed=false | P1G-T07 | GREEN | -- |
| submit | play (frozen) | allowed=false | P1G-T08 | GREEN | -- |
| enterAnalysis | recall | allowed=true, targetMode=analysis, effects=[saveAnalysisReturnTarget] (guard: activeRecallSession) | P1G-T09 | GREEN | -- |
| enterAnalysis | play | allowed=true, targetMode=analysis, effects=[saveAnalysisReturnTarget] (guard: task exists) | P1G-T10 | GREEN | -- |
| enterAnalysis | problem | allowed=true, targetMode=analysis, effects=[saveAnalysisReturnTarget] (guard: task exists) | P1G-T11 | GREEN | -- |
| returnFromAnalysis | analysis (with target) | allowed=true, restore previous mode, recallSubstate, treePosition, moveIndex | P1G-T12 | GREEN | -- |
| returnFromAnalysis | analysis (no target) | allowed=false | P1G-T13 | GREEN | -- |
| restartAttempt | analysis | allowed=true, infer mode=play/problem | P1G-T14 | GREEN | -- |
| snapshot | any | allowed=true, effects=[createNewTaskAndTab], current tab mode unchanged | P1G-T15 | GREEN | -- |
| startCheckpoint | recall (normal) | allowed=true, recallSubstate=checkpoint_correction | P1G-T22 | DEFERRED | Phase 5 prerequisite: checkpoint infrastructure |
| revealAi | recall (checkpoint_correction) | allowed=true, recallSubstate=checkpoint_ai_revealed | P1G-T23 | DEFERRED | Phase 5 prerequisite: checkpoint infrastructure |
| commentCheckpoint | recall (checkpoint_ai_revealed) | allowed=true, recallSubstate=checkpoint_commenting | P1G-T24 | DEFERRED | Phase 5 prerequisite: checkpoint infrastructure |
| resumeRecall | recall (checkpoint saved/skipped) | allowed=true, recallSubstate=normal, effects=[clearActiveCheckpoint] | P1G-T25 | DEFERRED | Phase 5 prerequisite: checkpoint infrastructure |
| submit | recall | allowed=false | P1G-T16 | GREEN | -- |
| submit | analysis | allowed=false | P1G-T17 | GREEN | -- |
| enterAnalysis | analysis | allowed=false | P1G-T18 | GREEN | -- |
| returnFromAnalysis | play | allowed=false | P1G-T19 | GREEN | -- |
| returnFromAnalysis | problem | allowed=false | P1G-T19 | GREEN | -- |
| returnFromAnalysis | recall | allowed=false | P1G-T19 | GREEN | -- |

## 17. 任务并行建议

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
|----------|----------|------|------------|----------|
| Worker A: Type 层 | types/tab.ts (新增 RecallSubstate, AnalysisReturnTarget, WorkbenchTab 字段) | 无 | 纯类型变更，不涉及运行时 | 低：类型变更可能引起其他文件编译错误，需要 Worker B/C 同步适配 |
| Worker B: modeTransitions.ts | 新文件 src/modules/training/workbench/modeTransitions.ts | Worker A 的类型 | 纯函数模块，无副作用 | 低：新文件不冲突 |
| Worker C: workbenchFlowService 重构 | workbenchFlowService.ts (使用 modeTransitions, 新签名) | Worker A + Worker B | 服务层重构 | 中：签名变更影响所有调用方和测试 |
| Worker D: 弃用标记 | workbenchPhaseService.ts + index.ts (JSDoc only) | 无 | 纯注释变更 | 低 |
| Worker E: 现有测试适配 | test/training/workbenchFlowService.test.js + test/training/workbenchPhaseService.test.js | Worker A + Worker C | 测试适配 | 中：需要和 Worker C 保持同步 |

推荐顺序：A -> B -> C + D (并行) -> E

## 18. 现有测试迁移影响

### workbenchFlowService.test.js

此文件中的以下测试需要适配：

1. **returnFromAnalysis 测试 (line 492-514)**: 当前测试调用 `service.returnFromAnalysis('tab_1', 'recall')` 传入两参数。必须改为 `service.returnFromAnalysis({tabId: 'tab_1'})`，并且 tab 需要先设置 `analysisReturnTarget`。

2. **enterAnalysis 测试 (line 480-489)**: 当前断言 `tab.previousMode === 'problem'`。需改为断言 `tab.analysisReturnTarget.mode === 'problem'`。

3. **restartAttempt 测试 (line 529-551)**: 当前从 `tab.previousMode` 推断目标 mode。如果 `previousMode` 被标记 deprecated 但仍保留，测试仍可通过；如果移除，需要适配。

### workbenchPhaseService.test.js

此文件应标记为测试 deprecated 模块。不需要修改功能，但建议在 describe 块添加注释说明此模块已被 workbenchFlowService 替代。

### workbenchStore.test.js

需要新增测试验证 `recallSubstate` 和 `analysisReturnTarget` 字段的 roundtrip。
