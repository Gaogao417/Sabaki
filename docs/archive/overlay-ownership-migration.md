# overlayStore 所有权迁移

## 解决的问题

### 1. overlayStore 没有 own state（"换皮"问题）

迁移前 `overlayStore` 通过 closure 捕获 `sabaki` 引用，直接读写 `sabaki.state`。
这是 Phase 10-12 "state migration" 路线的通病——代码物理搬到了新文件，但状态所有权没转移。

**修复**：overlayStore 现在 own 自己的 state（`territoryEnabled`、`territoryCompareEnabled`、
`showInfoOverlay`、`infoOverlayText`），通过 typed deps interface（`OverlayStoreDeps`）
访问外部状态，零 `sabaki` 引用。遵循 `analysisLifecycle.ts` 模式。

### 2. CTA (Check-Then-Act) 异步漏洞

原 `setTerritoryEnabled` 先乐观 `setState({territoryEnabled: true})`，再 `await ensureAnalysisReady()`。
在 await 窗口内，其他代码可能读到不一致状态（territoryEnabled=true 但无 ownership 数据），
且 post-await 代码不重新校验 mode/treePosition。

**修复**：
- setter 变成同步（写 own state），async 部分作为独立 reaction
- generation counter 丢弃过期 async 结果
- post-await 通过 `deps.getAppState()` 重新读取最新外部状态
- `onModeChange` 关闭 territory 时 bump generation，立即使 in-flight async 失效

### 3. territoryEnabled 不是真正的开关

`territoryEnabled` 原来是粘滞的用户偏好——在任何模式下都能开启，几乎不会自动关闭。
用户在复盘模式按 T 能开启，切到对局模式后 overlay 持续显示和更新。
`onModeChange` 只在 scoring/estimator 时关闭，漏掉了 recall/problem/review 等模式。

**修复**：
- `TERRITORY_ALLOWED_MODES` 只包含 `analysis`——只有分析模式允许 territory overlay
- `setTerritoryEnabled(true)` 校验当前 mode，非法模式直接 reject
- `onModeChange` 离开 analysis 时自动关闭 territoryEnabled 和 territoryCompareEnabled
- `documentStore` 导航后通过 `onNavigation()` 让 overlayStore 重新校验

### 4. InfoOverlay 状态散落在 sabaki.js

`showInfoOverlay`/`hideInfoOverlay`/`flashInfoOverlay` 三个方法和 `showInfoOverlay`、
`infoOverlayText` 两个 state 字段直接住在 sabaki.js，与 overlay 显示紧密相关但不在 overlayStore 里。

**修复**：三个方法和四个字段全部迁入 overlayStore。`hideInfoOverlayId` 定时器也变为 overlayStore
内部变量。sabaki.js 保留薄委托方法。

## 文件变更

| 文件 | 变更 |
|------|------|
| `overlayStore.ts` | 完全重写：own state + deps injection + mode validation + generation counter |
| `sabaki.js` | 移除 6 个 initial state 字段，3 个方法改为委托，更新 dep wiring |
| `App.js` | overlay state 从 `overlayStore.getState()` 读取 |
| `documentStore.js` | 移除 `territoryCompareEnabled` 直写，改用 `onOverlayNavigation` dep |
| `engineService.js` | 仅新增诊断日志（临时） |
