# W8-P3 Tasks 7-9 接线契约 — Player Selector + AI 设置 + Problem 约束

Date: 2026-05-21
Status: pending-audit (v0.2 — 修订版)

## 0. 真源对齐

| 真源 | 章节 | 对本契约的约束 |
| --- | --- | --- |
| PRD v0.5 SS2.2 | Play Mode: 黑白方可分别设置 human/ai | PlayerConfig.black/white: 'human'\|'ai' |
| PRD v0.5 SS2.4 | Problem Mode: 对手设置 + problemArea 约束 | problemOpponent: 'self'\|'ai' (注意: 非 'human') |
| PRD v0.5 SS4.3 L699 | problemOpponent?: 'self' \| 'ai' — PRD 类型定义 | problemOpponent 值域为 'self'\|'ai' |
| PRD v0.5 SS6.4 | Play Mode 左面板: 黑方/白方 OpponentControl | PlayModePanel 渲染两个 selector |
| PRD v0.5 SS6.5 | Problem Mode 左面板: 对手 OpponentControl + problemArea | ProblemModePanel 渲染 selector + 区域 |
| Arch v0.5 SS4.2 L438 | problemOpponent?: 'self' \| 'ai' — Architecture 类型定义 | 与 PRD 一致 |
| Arch v0.5 SS5.3 L612-L615 | updatePlayerConfig(tabId, patch) | flowService 方法（缺失，需 GAP 修复） |
| Arch v0.5 SS1.1 | Store/Repository 查询 -> Container -> UI 为合法渲染读取路径 | problemArea 可通过 repository.loadTask 读取 |

## 1. 用户故事

- **US-7.1 (Player Selector):** 作为 Play 用户，我想分别设置黑方和白方为 human 或 ai。
- **US-7.2 (AI Settings):** 作为 Play 用户，选择 ai 后我想配置 AI 参数。— **DEFERRED: 本轮不覆盖 AI 参数子对象**
- **US-8.1 (Problem Opponent):** 作为 Problem 用户，我想设置对手为 self 或 ai。
- **US-9.1 (Problem Area):** 作为 Problem 用户，我想看到 problemArea 约束区域（只读显示）。

## 2. 值域规则（修正版）

**关键**: PRD v0.5 SS4.3 和 Arch v0.5 SS4.2 定义了两组不同的值域：

| 字段 | 值域 | 来源 |
| --- | --- | --- |
| `PlayerConfig.black` / `PlayerConfig.white` | `'human' \| 'ai'` | Arch v0.5 SS4.2 |
| `PlayerConfig.problemOpponent` | `'self' \| 'ai'` | PRD v0.5 SS4.3 L699, Arch v0.5 SS4.2 L438 |
| `OpponentControl` UI 组件 | `'self' \| 'ai'` | OpponentControl 统一用 self/ai |

**不需要映射**: OpponentControl 的 `'self'`/`'ai'` 与 store 的 `problemOpponent` `'self'`/`'ai'` 一致，直接传递。但对于 `black`/`white`，OpponentControl 的 `'self'` 对应 store 的 `'human'`。

映射规则：
- Play Mode black/white: OpponentControl 'self' -> store 'human', OpponentControl 'ai' -> store 'ai'
- Problem Mode problemOpponent: OpponentControl 'self' -> store 'self', OpponentControl 'ai' -> store 'ai'（直接传递）

## 3. GAP 修复计划

### GAP-Type: PlayerConfig 类型缺少 problemOpponent

```typescript
// src/modules/training/types/tab.ts
interface PlayerConfig {
  black: 'human' | 'ai'
  white: 'human' | 'ai'
  problemOpponent?: 'self' | 'ai'  // 新增，与 PRD SS4.3 一致
}
```

### GAP-P1: workbenchFlowService 缺少 updatePlayerConfig

```typescript
// src/modules/training/workbench/workbenchFlowService.ts
updatePlayerConfig(tabId: string, patch: Partial<PlayerConfig>): void {
  const tab = this.store.getState().tabs.find(t => t.id === tabId)
  if (!tab) return
  const merged = { ...tab.playerConfig, ...patch }
  this.store.updateTab(tabId, { playerConfig: merged })
}
```

### GAP-P3: ProblemModePanel OpponentControl 硬编码

```diff
// src/components/workbench/panels/ProblemModePanel.js
- <OpponentControl value="ai" ... />
+ <OpponentControl value={props.problemOpponent || 'ai'} ... />
```

### GAP-P4: projectFromWorkbench 未投影 playerConfig

```diff
// projectFromWorkbench 或 shellProps 计算逻辑
+ blackPlayer: tab.playerConfig?.black || 'human',
+ whitePlayer: tab.playerConfig?.white || 'human',
+ problemOpponent: tab.playerConfig?.problemOpponent || 'ai',
```

### GAP-P5: Container 需新增 playerConfig change handler

```javascript
// TrainingWorkbenchContainer.js
function handleBlackPlayerChange(value) {
  if (!activeTab) return
  const mapped = value === 'self' ? 'human' : value
  flowService.updatePlayerConfig(activeTab.id, { black: mapped })
}

function handleWhitePlayerChange(value) {
  if (!activeTab) return
  const mapped = value === 'self' ? 'human' : value
  flowService.updatePlayerConfig(activeTab.id, { white: mapped })
}

function handleProblemOpponentChange(value) {
  if (!activeTab) return
  // problemOpponent 用 'self'|'ai' 直接传递，不映射
  flowService.updatePlayerConfig(activeTab.id, { problemOpponent: value })
}
```

## 4. 状态流

### 4.1 Play: 黑方/白方 Selector

```
PlayModePanel.js -> onBlackPlayerChange(value) / onWhitePlayerChange(value)
  [value 来自 OpponentControl: 'self' 或 'ai']
Container.handleBlackPlayerChange(value):
  -> mappedValue = value === 'self' ? 'human' : value  ['human'|'ai']
  -> flowService.updatePlayerConfig(activeTab.id, { black: mappedValue })
flowService.updatePlayerConfig(tabId, patch):
  -> workbenchStore.updateTab(tabId, { playerConfig: { ...tab.playerConfig, ...patch } })
subscriber -> Container.forceUpdate
projectFromWorkbench(ws) -> shellProps 包含 blackPlayer/whitePlayer
```

### 4.2 Problem: 对手 Selector

```
ProblemModePanel.js -> onOpponentChange(value)
  [value 来自 OpponentControl: 'self' 或 'ai']
Container.handleProblemOpponentChange(value):
  -> flowService.updatePlayerConfig(activeTab.id, { problemOpponent: value })
  [不映射: problemOpponent 值域本身就是 'self'|'ai']
同上链路
```

### 4.3 Problem: problemArea 约束（只读）

```
Container 初始化/渲染时:
  -> repository.loadTask(activeTab.taskId)
  -> task.problemArea (只读，渲染用)
  -> 传入 ProblemModePanel 作为 props
ProblemModePanel 渲染 problemArea 约束提示/高亮
```

## 5. 测试/验收契约表（含分层）

| ID | 类型 | 契约 | Production Subject | Real Deps | Mock Deps | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T7-01 | CONTAINER_DELEGATION | handleBlackPlayerChange('ai') 调用 flowService.updatePlayerConfig(tabId, {black:'ai'}) | Container.handleBlackPlayerChange | Container render | flowService.updatePlayerConfig (spy) | workbenchStore | flowService.updatePlayerConfig 被调用，参数 patch 包含 {black:'ai'} | T7-03 |
| T7-02 | CONTAINER_DELEGATION | handleWhitePlayerChange('self') 调用 flowService.updatePlayerConfig(tabId, {white:'human'}) | Container.handleWhitePlayerChange | Container render | flowService.updatePlayerConfig (spy) | workbenchStore | 参数 patch 包含 {white:'human'}（映射 self->human） | T7-03 |
| T7-03 | CONTROLLER_STATE_TRANSITION | updatePlayerConfig({black:'ai'}) 后 tab.playerConfig.black === 'ai' | flowService.updatePlayerConfig | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore, flowService | store tab.playerConfig.black === 'ai' | T7-06 |
| T7-04 | CONTROLLER_STATE_TRANSITION | updatePlayerConfig 浅合并：改 black 不影响 white | flowService.updatePlayerConfig | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore | 改 {black:'ai'} 后 tab.playerConfig.white 保持原值 | — |
| T7-05 | PROJECTION_RETURN | updatePlayerConfig 后 projectFromWorkbench 返回正确 blackPlayer/whitePlayer | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象.blackPlayer === 'ai' | — |
| T7-06 | STORE_SUBSCRIPTION | updatePlayerConfig 后 subscriber 收到通知 | workbenchStore.subscribe | 真实 workbenchStore | 无 | — | subscriber callback 被调用 | — |
| T7-07 | UI_COMMAND_MAPPING | PlayModePanel 渲染黑方/白方 OpponentControl，值来自 props | PlayModePanel | preact render | 无 | — | OpponentControl 的 value prop 等于传入的 blackPlayer/whitePlayer | — |
| T7-08 | UI_COMMAND_MAPPING | PlayModePanel onBlackPlayerChange/onWhitePlayerChange 点击触发正确 callback | PlayModePanel | preact render | callback spy | — | 对应 callback 被调用 | T7-01, T7-02 |
| T7-09 | CONTAINER_DELEGATION | handleProblemOpponentChange('self') 调用 updatePlayerConfig(tabId, {problemOpponent:'self'}) | Container.handleProblemOpponentChange | Container render | flowService.updatePlayerConfig (spy) | workbenchStore | 参数 patch 包含 {problemOpponent:'self'}（不映射） | T7-10 |
| T7-10 | CONTROLLER_STATE_TRANSITION | updatePlayerConfig({problemOpponent:'ai'}) 后 tab.playerConfig.problemOpponent === 'ai' | flowService.updatePlayerConfig | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore, flowService | store tab.playerConfig.problemOpponent === 'ai' | T7-06 |
| T7-11 | PROJECTION_RETURN | updatePlayerConfig 后 projectFromWorkbench 返回正确 problemOpponent | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象.problemOpponent === 'ai' | — |
| T7-12 | UI_COMMAND_MAPPING | ProblemModePanel OpponentControl 值来自 props 而非硬编码 | ProblemModePanel | preact render | 无 | — | OpponentControl 的 value prop 等于传入的 problemOpponent（非硬编码 'ai'） | — |
| T7-13 | UI_COMMAND_MAPPING | ProblemModePanel onOpponentChange 点击触发正确 callback | ProblemModePanel | preact render | callback spy | — | callback 被调用 | T7-09 |
| T7-14 | CONTAINER_DELEGATION | handler 在 activeTab null 时不调用 flowService | Container playerConfig handlers | Container render (无 activeTab) | flowService (spy) | — | flowService 方法未被调用 | — |
| T7-15 | ARCHITECTURE_BOUNDARY | Container 不直接写 store，只通过 flowService | Container handlers | Container render | flowService (spy), workbenchStore (spy) | — | workbenchStore.updateTab 未被 Container 直接调用 | — |
| T7-16 | CONTROLLER_STATE_TRANSITION | problemArea 从 repository.loadTask 正确读取到 Container props | Container (初始化/渲染路径) | Container render | repository.loadTask (stub, 返回含 problemArea 的 task) | — | Container shellProps 包含正确 problemArea 值 | — |
| T7-17 | PROJECTION_RETURN | problemArea 在 shellProps 中正确投影 | projectFromWorkbench | 真实 projection 函数 | 无 | — | 返回对象包含 problemArea | — |
| T7-18 | ARCHITECTURE_BOUNDARY | updatePlayerConfig 空补丁不修改任何字段 | flowService.updatePlayerConfig | 真实 workbenchStore, 真实 flowService | 无 | workbenchStore | 空 patch 后 tab.playerConfig 与之前完全相同 | — |

## 6. DEFERRED（本轮不覆盖）

| 项目 | 原因 | 退出条件 |
| --- | --- | --- |
| AI 参数配置 (engineId, maxVisits, timeLimitMs, autoPlay) | PRD SS4.3 定义了 ai? 子对象，但 UI 和接线复杂度高 | 后续 Task 专门覆盖 AI 设置 |
| Problem Mode 无 problemArea 时禁用 AI 应手 | PRD SS3.2 硬约束 | 需要 problemArea 守卫逻辑实施 |
| OpponentControl disabled 状态 | OpponentControl 支持 disabled prop | 需配合 problemArea 守卫 |
| aiMoveService 读取 playerConfig 进行 AI 回合判断 | 不属于 player selector 接线范围 | aiMoveService 单元测试覆盖 |

## 7. v0.5 冲突检查

| 检查项 | 结论 |
| --- | --- |
| problemOpponent 值域 'self'\|'ai' vs PRD SS4.3 | 一致 — 直接使用 'self'\|'ai'，不做映射 |
| black/white 值域 'human'\|'ai' vs Arch v0.5 SS4.2 | 一致 — OpponentControl 'self' 映射为 'human' |
| Container 不直接写 store | 通过 |
| UI component 不直接依赖 service/store | 通过 |
| updatePlayerConfig 浅合并语义 | 通过 |
| problemArea 只读路径 | 通过 |
| origin.provider 分支 | 未使用，通过 |
