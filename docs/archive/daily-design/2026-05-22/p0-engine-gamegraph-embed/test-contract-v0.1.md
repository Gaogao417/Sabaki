# P0 接线契约 — EnginePeerList 与 GameGraph 嵌入 WorkbenchShell

Date: 2026-05-22
Version: v0.3
Status: revised (addresses audit round 2: gameTree source, gameCurrents indexing, P0-T13)

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| UI/UX spec SS13 L932-944 | RightSidebar 包含 VariationTreePanel | GameGraph 归属右侧边栏，作为 VariationTreePanel 的 P0 实现 |
| UI/UX spec SS4.1 L210 | 右栏卡片承载辅助信息、分析空态、提示、反馈和变化树 | GameGraph 为右栏核心内容之一 |
| UI/UX spec SS5 L287 | Play 右栏卡片: 3. 变化树 | Play 模式右栏应显示变化树 |
| UI/UX spec SS7 L559 | Recall 右栏: 4. 轻量变化树 | Recall 模式右栏应显示轻量变化树 |
| UI/UX spec SS8 L730 | Analysis 右栏: 3. 变化树 | Analysis 模式右栏应显示变化树 |
| Architecture v0.5 SS3.1 L269-284 | sabaki.js 是 legacy facade; 新训练走 training/* | EnginePeerList 的 selectedEngineSyncerId 是 LocalSidebar 局部状态，不需要新 store |
| Architecture v0.5 SS3.2 L288-309 | documentStore 管理棋谱/棋盘事实; gameTree + treePosition | GameGraph 读取 documentStore 提供的 gameTree 和 treePosition |
| Architecture v0.5 SS3.3 L310-333 | analysisService 管理 AI 分析结果缓存 | EnginePeerList 通过 engineService 获取 syncer 列表，与 analysisService 无直接关系 |
| Architecture v0.5 SS1.1 L88-99 | 渲染读路径: Store/Repository -> Container/ViewModel -> UI | Engine props 和 game tree props 由 Container 从 sabaki.state 投影到 Shell |
| Architecture v0.5 SS1.2 L104-122 | 命令写路径: UI -> Controller/Container -> Service -> Store/Adapter | GameGraph node click -> sabaki.setCurrentTreePosition 走 legacy adapter 路径 |
| Architecture v0.5 SS0.3 L67-81 | UI 只展示不写 store; Container/Controller 读 Store 调 Service | Container 投影引擎状态但不直接修改 store |

**说明**: PRD v0.5 和 Architecture v0.5 未为 EnginePeerList 和 GameGraph 定义新的产品行为。这两个组件是已有 Sabaki 核心功能的布局迁移 -- 从旧 TripleSplitContainer/LeftSidebar/Sidebar 迁入 WorkbenchShell 三栏布局。本契约只定义接线，不定义新产品行为。

## 1. 用户故事

- **US-P0.1 (Engine Peer List):** 作为用户，我想在 workbench 左栏看到已连接的引擎列表，以便选择和管理引擎连接。
- **US-P0.2 (Engine Select):** 作为用户，我想点击引擎列表中的引擎来选中它，以便后续 GTP Console（P1）能向该引擎发送命令。
- **US-P0.3 (Engine Attach):** 作为用户，我想通过引擎列表工具栏的"连接引擎"按钮打开引擎菜单，以便连接新引擎。
- **US-P0.4 (Engine Game Toggle):** 作为用户，我想通过引擎列表工具栏的"引擎对局"按钮启动/停止引擎对局，以便使用引擎对弈。
- **US-P0.5 (Game Graph View):** 作为用户，我想在 workbench 右栏看到变化树（GameGraph），以便可视化浏览当前棋谱的所有变化。
- **US-P0.6 (Game Graph Navigate):** 作为用户，我想点击变化树中的节点来导航到该位置，以便快速跳转到棋谱中的特定局面。

## 2. 用户动作

| ID | 动作 | UI 组件 | Callback prop | Container handler |
| --- | --- | --- | --- | --- |
| A-P0.1 | 点击引擎列表中的引擎 | EnginePeerList -> EnginePeerListItem `onClick` | `onEngineSelect({syncer})` | 本地状态（不经过 Container） |
| A-P0.2 | 右键引擎列表中的引擎 | EnginePeerList -> EnginePeerListItem `onContextMenu` | 内部调用 `sabaki.openEngineActionMenu` | 不经过 Container（内部副作用） |
| A-P0.3 | 点击"连接引擎"按钮 | EnginePeerList ToolBar `handleAttachEngineButtonClick` | 内部调用 `sabaki.openEnginesMenu` | 不经过 Container（内部副作用） |
| A-P0.4 | 点击"引擎对局"按钮 | EnginePeerList ToolBar `handleStartStopGameButtonClick` | 内部调用 `engineService.startStopEngineGame` | 不经过 Container（内部副作用） |
| A-P0.5 | 点击变化树节点 | GameGraph `handleNodeClick` -> `onNodeClick(evt)` | `onNodeClick({gameTree, treePosition})` | `handleGraphClick` -> `sabaki.setCurrentTreePosition(gameTree, treePosition)` |

**上游调用签名锁定**:

- `EnginePeerListItem.handleClick:69` -> `onClick({syncer})` -- 参数为包含 syncer 对象的事件
- `EnginePeerList.handleEngineClick:143` -> `onEngineSelect(evt)` -- 透传 EnginePeerListItem 的 onClick 事件
- `GameGraph.handleNodeClick:345-381` -> `onNodeClick(Object.assign(evt, {gameTree, treePosition}))` -- 调用签名: `onNodeClick(evt)` 单参数，其中 `evt.gameTree` 和 `evt.treePosition` 是被 assign 上去的
- `GameGraphNode.handleClick:46-56` -> `onNodeClick(Object.assign(evt, {gameTree, treePosition}))` -- 与 GameGraph.handleNodeClick 调用签名一致

**假绿风险警告**: EnginePeerList 和 GameGraph 的 onNodeClick/onEngineSelect 都是单参数调用。Container handler 不得假设参数结构为多参数形式。

## 3. 当前阶段

P0 是 workbench 接线的基础设施任务。当前阶段不涉及任何训练业务 mode 转换、Attempt 提交或 Recall 流程。它只涉及将已有的核心 UI 组件（EnginePeerList、GameGraph）嵌入到新的 WorkbenchShell 布局中。

## 4. 位置源

| 组件 | 位置源 | 说明 |
| --- | --- | --- |
| EnginePeerList | App.js 显式 props | App.js:700-704 传入 `attachedEngineSyncers`, `blackEngineSyncerId`, `whiteEngineSyncerId`, `engineGameOngoing`。Container 通过 `this.props` 接收，`const { sabaki, ...shellProps } = this.props` 中 `shellProps` 已包含这些字段。直接通过 `...shellProps` 透传到 Shell。 |
| GameGraph | `...state` via `...inferredState` spread | App.js:591-593 执行 `state = {...state, ...inferredState}`，将 `sabaki.inferredState.gameTree`（getter，返回 `state.gameTrees[state.gameIndex]`）展开为具体值。因此 App.js:699 的 `...state` 已包含 `gameTree`、`treePosition`、`graphGridSize`、`graphNodeSize`、`showGameGraph`、`gameCurrents`、`gameIndex`。Container 不需要从 sabaki.state 单独读取 gameTree。 |

**BLOCK-2 解答**: Engine props 通过 `this.props` (App.js 显式传入) 透传，不走 `projectFromWorkbench`。Game tree props 全部通过 `...state` 传入 Container props（App.js:591-593 已经将 inferredState.gameTree 展开到 state 中）。Container 不需要额外从 sabaki.state 读取 gameTree。

**gameCurrents 索引**: `Sidebar.js:777` 传递 `gameCurrents[gameIndex]` 给 GameGraph。Container 需要在投影中执行 `gameCurrents[gameIndex]` 索引操作，传递当前游戏的 currents 对象（而非完整数组）给 Shell。

## 5. 变更契约

### 5.0 布局共存方案

**左栏**: WorkbenchLeftPanel 是新组件，在 WorkbenchShell 的 `workbench-shell__left-panel` div 内渲染。它上下两段布局：
1. **上段**: EnginePeerList（引擎列表，固定高度约 200px，可滚动）
2. **下段**: 当前 mode panel（PlayModePanel / ProblemModePanel / RecallModePanel / AnalysisModePanel）

WorkbenchShell.js 的 `leftPanel[mode]` dict 仍然负责选择当前 mode panel。WorkbenchLeftPanel 替换当前 Shell 中直接渲染 `leftPanel[mode]` 的逻辑：

```diff
- h('div', {class: 'workbench-shell__left-panel'},
-   leftPanel[mode] || leftPanel.play,
- ),
+ h('div', {class: 'workbench-shell__left-panel'},
+   h(WorkbenchLeftPanel, {engineProps: rest, modePanel: leftPanel[mode] || leftPanel.play}),
+ ),
```

**右栏**: WorkbenchRightPanel 替换当前 `RightModePanel`。它上下两段布局：
1. **上段**: GameGraph（变化树，flex-grow 占满可用空间）
2. **下段**: 保留原 RightModePanel 的 mode-specific 内容（PlayRightPanel / ProblemRightPanel / RecallRightPanel / AnalysisRightPanel），这部分 P0 不修改

WorkbenchShell.js 右栏修改：

```diff
- h('div', {class: 'workbench-shell__right-panel'},
-   h(RightModePanel, {mode, ...rest}),
- ),
+ h('div', {class: 'workbench-shell__right-panel'},
+   h(WorkbenchRightPanel, {
+     mode,
+     gameTree: rest.gameTree,
+     treePosition: rest.treePosition,
+     graphGridSize: rest.graphGridSize,
+     graphNodeSize: rest.graphNodeSize,
+     showGameGraph: rest.showGameGraph,
+     gameCurrents: rest.gameCurrents,  // indexed: Container does gameCurrents[gameIndex] before passing
+     onGraphClick: rest.onGraphClick,
+     modePanel: h(RightModePanel, {mode, ...rest}),
+   }),
+ ),
```

**BLOCK-3 解答**: WorkbenchLeftPanel 包裹 EnginePeerList + ModePanel（上下排列），WorkbenchRightPanel 包裹 GameGraph + RightModePanel（上下排列）。两个 wrapper 都是 presentational，通过 props 接收所有数据和回调。

| 动作 | 变更类型 | 说明 |
| --- | --- | --- |
| A-P0.1 Engine Select | 无业务变更 | 仅更新 WorkbenchLeftPanel 内部 selectedEngineSyncerId 局部状态 |
| A-P0.2 Engine Context Menu | 无业务变更 | 内部调用 sabaki.openEngineActionMenu |
| A-P0.3 Attach Engine | 无业务变更 | 内部调用 sabaki.openEnginesMenu |
| A-P0.4 Engine Game Toggle | 无业务变更 | 内部调用 engineService.startStopEngineGame |
| A-P0.5 Graph Node Click | `game-tree` 位置变更 | 调用 sabaki.setCurrentTreePosition，改变当前棋谱浏览位置 |

## 6. 预期状态流

### 6.1 EnginePeerList 状态流 (A-P0.1 ~ A-P0.4)

EnginePeerList 的交互不经过 TrainingWorkbenchContainer handler 链路。它的 selectedEngineSyncerId 是 WorkbenchLeftPanel 组件的局部 Preact state，引擎 attach/detach/engine-game 的操作通过内部直接调用 sabaki 全局方法完成。

```
App.js render
  -> sabaki.state.attachedEngineSyncers (from engineService.getAttachedSyncers())
  -> TrainingWorkbenchContainer render()
     -> project engine props: attachedEngineSyncers, blackEngineSyncerId, whiteEngineSyncerId, analyzingEngineSyncerId, engineGameOngoing
     -> WorkbenchShell (left-panel area)
        -> WorkbenchLeftPanel (new wrapper)
           -> EnginePeerList (existing component, imported from sidebars/PeerList.js)

EnginePeerList internal state: selectedEngineSyncerId (local Preact state)
EnginePeerList callbacks: onEngineSelect({syncer}) -> updates local state
EnginePeerList internals: sabaki.openEnginesMenu, sabaki.openEngineActionMenu, engineService.startStopEngineGame
```

**读路径 (状态回流)**:
```
sabaki 'state-change' event (or engine service events)
  -> App.js re-render
  -> engineService.getAttachedSyncers() / getBlackSyncerId() / ...
  -> TrainingWorkbenchContainer render()
  -> projectFromWorkbench / direct props spread
  -> WorkbenchShell
  -> WorkbenchLeftPanel
  -> EnginePeerList (receives updated attachedEngineSyncers, etc.)
```

**说明**: EnginePeerList 直接 import sabaki 模块 (`../../modules/sabaki.js`) 并在内部调用 `sabaki.openEnginesMenu`、`sabaki.openEngineActionMenu` 和 `sabaki.getPlayServices().engineService.startStopEngineGame`。这是已有行为，P0 不修改这些内部调用。这些是遗留迁移接缝，退出条件是未来将 EnginePeerList 重构为通过 props 接收这些 callbacks。

### 6.2 GameGraph 状态流 (A-P0.5)

```
App.js render
  -> sabaki.state.gameTrees[gameIndex] = gameTree
  -> sabaki.state.treePosition
  -> sabaki.state.graphGridSize, graphNodeSize, showGameGraph
  -> TrainingWorkbenchContainer render()
     -> project game tree props: gameTree, treePosition, graphGridSize, graphNodeSize, showGameGraph
     -> WorkbenchShell (right-panel area)
        -> WorkbenchRightPanel (new wrapper)
           -> GameGraph (existing component, imported from sidebars/GameGraph.js)

User click on graph node:
  GameGraphNode.handleClick:46 -> onNodeClick(Object.assign(evt, {gameTree, treePosition}))
  GameGraph.handleNodeClick:345 -> props.onNodeClick(evt)  [单参数 evt, evt.gameTree + evt.treePosition]
  WorkbenchRightPanel.onNodeClick(evt)
  TrainingWorkbenchContainer.handleGraphClick(evt)  [evt.gameTree, evt.treePosition]
  sabaki.setCurrentTreePosition(evt.gameTree, evt.treePosition)
  sabaki.state.treePosition updated
  sabaki 'change' event -> App re-render
  -> Container re-render
  -> GameGraph receives new treePosition
```

**读路径 (状态回流)**:
```
sabaki.setCurrentTreePosition called
  -> documentStore.setCurrentTreePosition
  -> sabaki.state.treePosition updated
  -> sabaki 'change' event fired
  -> App.js setState -> re-render
  -> TrainingWorkbenchContainer re-render
  -> project gameTree + treePosition
  -> WorkbenchRightPanel
  -> GameGraph (receives new treePosition, re-renders to highlight new current node)
```

## 7. 允许的副作用

| 副作用 | 触发点 | 说明 |
| --- | --- | --- |
| `sabaki.setCurrentTreePosition(gameTree, treePosition)` | Container.handleGraphClick | 导航棋谱位置，这是 GameGraph 的核心交互 |
| `sabaki.openEnginesMenu({x, y})` | EnginePeerList 内部 | 打开引擎菜单，已有行为 |
| `sabaki.openEngineActionMenu(syncerId, {x, y})` | EnginePeerList 内部 | 打开引擎操作菜单，已有行为 |
| `engineService.startStopEngineGame(treePosition)` | EnginePeerList 内部 | 启动/停止引擎对局，已有行为 |
| Container `forceUpdate` on sabaki state change | Container subscriber | 已有订阅机制 |

## 8. 禁止的副作用

| 禁止项 | 原因 |
| --- | --- |
| Container 直接写入 workbenchStore / runtimeStore | P0 不涉及训练业务状态变更 |
| GameGraph node click 修改 gameTree 结构 | Navigation 只读，不应增删节点 |
| WorkbenchLeftPanel / WorkbenchRightPanel 直接依赖 service | Panel 是 presentational wrapper，只接收 props |
| 新建 store 管理 engine list 或 graph state | Architecture v0.5 未定义这些 store，使用已有 sabaki state |
| Container 直接 import engineService | Engine props 由 App.js 传入，Container 不直接查找 engineService |

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| P0-T01 | CONTAINER_DELEGATION | WIRING | Container projects engine props (attachedEngineSyncers, blackEngineSyncerId, whiteEngineSyncerId, analyzingEngineSyncerId, engineGameOngoing) into shell props | HIGH | Missing engine list in workbench |
| P0-T02 | CONTAINER_DELEGATION | WIRING | Container projects game tree props (gameTree, treePosition, graphGridSize, graphNodeSize, showGameGraph, gameCurrents[gameIndex]) into shell props; all from this.props via ...state (App.js:591-593 already includes gameTree) | HIGH | Missing game graph in workbench |
| P0-T03 | CONTAINER_DELEGATION | WIRING | Container handleGraphClick calls sabaki.setCurrentTreePosition(evt.gameTree, evt.treePosition) | HIGH | Graph navigation broken |
| P0-T04 | CONTAINER_DELEGATION | WIRING | Container passes engine props from this.props to Shell via ...shellProps spread; values match App.js input | MEDIUM | Engine state not visible |
| P0-T05 | UI_COMMAND_MAPPING | WIRING | WorkbenchLeftPanel renders EnginePeerList component when engine props provided | HIGH | Engine list not shown |
| P0-T06 | UI_COMMAND_MAPPING | WIRING | WorkbenchRightPanel renders GameGraph component when gameTree provided and showGameGraph=true | HIGH | Game graph not shown |
| P0-T07 | PROJECTION_RETURN | STATE | After Container re-render with updated props (new treePosition), WorkbenchRightPanel passes new treePosition to GameGraph | HIGH | Graph highlight stale |
| P0-T08 | CONTAINER_DELEGATION | WIRING | Container handleGraphClick uses single-argument evt signature (evt.gameTree, evt.treePosition), not multi-argument | HIGH | Runtime TypeError (historical lesson) |
| P0-T09 | ARCHITECTURE_BOUNDARY | ARCHITECTURE_BOUNDARY | WorkbenchLeftPanel does not import service/store/repository directly | MEDIUM | Architecture violation |
| P0-T10 | ARCHITECTURE_BOUNDARY | ARCHITECTURE_BOUNDARY | WorkbenchRightPanel does not import service/store/repository directly | MEDIUM | Architecture violation |
| P0-T11 | ARCHITECTURE_BOUNDARY | ARCHITECTURE_BOUNDARY | Container does not directly import engineService; engine props come from App.js | MEDIUM | Hidden global dependency |
| P0-T12 | CONTAINER_DELEGATION | WIRING | shellHandlers includes onGraphClick handler that maps to handleGraphClick | HIGH | Handler not wired to Shell |
| P0-T13 | UI_COMMAND_MAPPING | WIRING | WorkbenchShell passes onGraphClick to WorkbenchRightPanel | MEDIUM | Handler not reaching panel |
| P0-T14 | PROJECTION_RETURN | STATE | EnginePeerList selectedEngineSyncerId is local to WorkbenchLeftPanel, not in global store | LOW | Unnecessary global state |
| P0-T15 | SIDE_EFFECT_BOUNDARY | SIDE_EFFECT | GameGraph node click only calls sabaki.setCurrentTreePosition; does not modify workbenchStore or runtimeStore | MEDIUM | Side effect leakage |

## 10. 必须自动化的测试

### 测试分层契约

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-T01 | CONTAINER_DELEGATION | Container.render() projects engine props to shell | Container render | sabaki mock (provides getTrainingContext + state), App.js-style props with engine fields | real production interface (App.js:700-704 props shape) | workbenchStore, flowService, engineService direct import | render output contains attachedEngineSyncers, blackEngineSyncerId, whiteEngineSyncerId, engineGameOngoing props with values matching Container input props | P0-T05 |
| P0-T02 | CONTAINER_DELEGATION | Container.render() projects game tree props to shell | Container render | sabaki mock + Container props with gameTree, treePosition, graphGridSize, graphNodeSize, gameCurrents array, gameIndex | real production interface (App.js:699 ...state shape with inferredState spread) | gametree module | render output contains gameTree, treePosition, graphGridSize, graphNodeSize, showGameGraph, gameCurrents (indexed by gameIndex) props with values matching inputs | P0-T06 |
| P0-T03 | CONTAINER_DELEGATION | Container.handleGraphClick calls sabaki.setCurrentTreePosition | Container handleGraphClick | sabaki mock with setCurrentTreePosition spy | real production interface (sabaki.setCurrentTreePosition signature) | sabaki real module | setCurrentTreePosition called with (evt.gameTree, evt.treePosition) from single-argument evt | P0-T07 |
| P0-T05 | UI_COMMAND_MAPPING | WorkbenchLeftPanel renders EnginePeerList | WorkbenchLeftPanel render, EnginePeerList real component | none (renders with real EnginePeerList) | N/A | EnginePeerList mock | rendered output contains element with class 'engine-peer-list' or data-testid for engine list | P0-T14 |
| P0-T06 | UI_COMMAND_MAPPING | WorkbenchRightPanel renders GameGraph and passes onNodeClick callback | WorkbenchRightPanel render, GameGraph real component | none | N/A | GameGraph mock | rendered output contains GameGraph component receiving onNodeClick callback from WorkbenchRightPanel props | P0-T07 |
| P0-T07 | PROJECTION_RETURN | After Container re-render with new treePosition prop, WorkbenchRightPanel passes updated treePosition to GameGraph | Container render with changed props | sabaki mock, Container props updated to new treePosition | real production interface | sabaki real module | Second render output contains updated treePosition matching new input prop value | -- |
| P0-T04 | CONTAINER_DELEGATION | Container passes engine props from this.props to Shell unchanged | Container render | sabaki mock + Container props with specific engine values (e.g. attachedEngineSyncers = [{id:'s1'}]) | real production interface (App.js:700-04) | workbenchStore, flowService, engineService direct import | render output contains attachedEngineSyncers etc. with exact values from input props, not hardcoded defaults | P0-T05 |
| P0-T08 | CONTAINER_DELEGATION | handleGraphClick receives single-argument evt with {gameTree, treePosition} | Container handleGraphClick | sabaki mock | real production interface (GameGraph.handleNodeClick L376-381 calling convention) | sabaki real module | handleGraphClick(evt) where evt = {gameTree, treePosition} calls setCurrentTreePosition(evt.gameTree, evt.treePosition) -- no undefined args | P0-T03 |
| P0-T09 | ARCHITECTURE_BOUNDARY | WorkbenchLeftPanel has no import of service/store/repository | WorkbenchLeftPanel source | N/A (static analysis) | N/A | N/A | AST / import check: no imports from modules/training/*, no direct sabaki import | -- |
| P0-T10 | ARCHITECTURE_BOUNDARY | WorkbenchRightPanel has no import of service/store/repository | WorkbenchRightPanel source | N/A (static analysis) | N/A | N/A | AST / import check: no imports from modules/training/*, no direct sabaki import | -- |
| P0-T11 | ARCHITECTURE_BOUNDARY | Container does not import engineService directly | Container source | N/A (static analysis) | N/A | N/A | No `require('engineService')` or `import engineService` in Container | -- |
| P0-T12 | CONTAINER_DELEGATION | shellHandlers includes onGraphClick | Container render | sabaki mock | real production interface | sabaki real module | shellHandlers.onGraphClick is a function that delegates to handleGraphClick | P0-T03 |
| P0-T13 | CONTAINER_DELEGATION | WorkbenchShell passes onGraphClick to WorkbenchRightPanel | WorkbenchShell render | WorkbenchShell render output | real production interface (Shell props) | sabaki real module | Shell render output for right-panel area passes onGraphClick as prop to WorkbenchRightPanel | P0-T06 |
| P0-T15 | SIDE_EFFECT_BOUNDARY | GameGraph click does not modify workbenchStore | Container handleGraphClick | sabaki mock with setCurrentTreePosition spy, workbenchStore mock with updateTab spy | real production interface | sabaki real module, workbenchStore real module | After handleGraphClick, workbenchStore.updateTab was NOT called | -- |

### Mock Contract Source 说明

| Mock | 来源 | 约束 |
| --- | --- | --- |
| sabaki mock | real production interface -- `sabaki.getTrainingContext()` 返回 `{runtimeStore, workbenchStore, legacyTrainingFlowController, flowService, tabService, repository}` 的 shape | 必须提供 `getTrainingContext()`, `state` 对象, `setCurrentTreePosition` 方法 |
| workbenchStore mock | shared typed spy factory -- 复用 `test/**/shared/*SpyFactories.ts` 或同级 helper | 必须提供 `getState()`, `subscribe()`, `updateTab()` 方法 |
| runtimeStore mock | shared typed spy factory | 必须提供 `getState()`, `subscribe()` 方法 |

**弱测试禁令**: P0-T01 和 P0-T02 不能只断言 "Container render 返回的对象包含某个 key"。必须验证 key 的值是从 sabaki mock 提供的 engine/game props 正确投影而来，而不是 Container 硬编码的默认值。

**gameCurrents 说明**: GameGraph 依赖 `gameCurrents` prop（`gameCurrents[gameIndex]`），用于渲染当前手数指示线。此 prop 通过 `...state` 从 App.js 传入 Container（state 包含 `gameCurrents` 数组）。Container 不需要特殊投影，`...shellProps` 自然包含此字段。

## 11. 仅手动验收

| 验收项 | 验收方法 | 退出条件 |
| --- | --- | --- |
| EnginePeerList 在 workbench 左栏正确渲染，显示已连接引擎 | 启动应用，连接引擎，视觉确认左栏顶部显示引擎列表 | 视觉确认 |
| GameGraph 在 workbench 右栏正确渲染，显示当前棋谱变化树 | 启动应用，加载棋谱，视觉确认右栏显示变化树图形 | 视觉确认 |
| 点击变化树节点，棋盘正确跳转到对应位置 | 手动点击变化树中不同节点，确认棋盘和变化树高亮同步 | 手动交互 |
| EnginePeerList 与下方 ModePanel 的布局不互相挤压 | 切换不同 mode，确认引擎列表和 mode panel 都完整显示 | 视觉确认 |
| 窗口 resize 时左右栏布局不导致棋盘跳动 | 缩放窗口，确认棋盘位置稳定 | 视觉确认 |

## 12. 不测试

| 项目 | 原因 |
| --- | --- |
| EnginePeerList 内部 selectedEngineSyncerId 状态管理 | 已有 LeftSidebar 测试覆盖，P0 只是布局迁移 |
| EnginePeerList 右键菜单 (openEngineActionMenu) | 已有行为，非 P0 接线范围 |
| EnginePeerList 连接引擎按钮 (openEnginesMenu) | 已有行为，非 P0 接线范围 |
| EnginePeerList 引擎对局按钮 (startStopEngineGame) | 已有行为，非 P0 接线范围 |
| GameGraph 拖拽平移功能 | 已有 GameGraph 测试覆盖 |
| GameGraph 缩放功能 | 已有 GameGraph 测试覆盖 |
| GtpConsole 渲染和交互 | DEFERRED to P1 |
| WinrateGraph 渲染 | DEFERRED to P1/P2 |
| CommentBox 渲染 | DEFERRED to P1/P2 |
| GameGraph 在 problem 模式的行为 | Problem 模式右栏内容由 ProblemRightPanel 定义，GameGraph 是否在 problem 模式显示由实施决定 |
| CSS 样式、动画、过渡效果 | 前端视觉任务，非接线契约范围 |

## 13. 脆弱测试警告

| 风险 | 说明 | 缓解措施 |
| --- | --- | --- |
| EnginePeerList 渲染依赖 DOM 结构 | EnginePeerList 使用 `<div class="engine-peer-list"><ul><li>` 结构，断言此结构会与实现耦合 | 使用 `data-testid` 或组件引用，而非 CSS class |
| GameGraph 渲染依赖 SVG/canvas 内部结构 | GameGraph 使用 SVG 渲染节点和边，断言 SVG 结构会极其脆弱 | 只断言 GameGraph 组件被渲染并接收正确 props，不断言内部 SVG 结构 |
| sabaki mock 的 state shape 偏差 | 如果 mock 提供的 sabaki.state 缺少 graphGridSize/graphNodeSize 等字段，测试通过但运行时失败 | 使用真实的 sabaki.state 初始值作为 mock 基础 |
| handleGraphClick 参数签名 | 历史教训: Goban 调用 onVertexClick(evt) 单参数，Container 按 (vertex, event) 两参数接收导致运行时 TypeError。GameGraph 的 onNodeClick 也是单参数模式 | P0-T08 专门锁定单参数签名 |

## 14. 超出范围

| 项目 | 原因 |
| --- | --- |
| WorkbenchLeftPanel / WorkbenchRightPanel 的 CSS 样式 | 前端视觉任务 |
| SplitContainer 集成（引擎列表与 GTP Console 上下分栏） | P1 (GTP Console 接入后) |
| WinrateGraph 嵌入右栏 | P1/P2 |
| CommentBox 嵌入右栏 | P1/P2 |
| AnalysisSummaryCard 嵌入右栏 | P1/P2 |
| EnginePeerList selectedEngineSyncerId 与 GTP Console 联动 | P1 (需要 GTP Console) |
| Problem 模式右栏是否显示 GameGraph | 待 UI/UX spec 明确 |

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 origin.provider 或旧 source/kind 当作流程分支 | 未使用 | P0 不涉及任何 source 判断 | PASS |
| 是否引入 openGameTab / openProblemTab 等 source-specific API | 未引入 | P0 不创建新 API | PASS |
| 是否让 snapshotService 承担 tab opening / flow orchestration | 未涉及 | P0 不涉及 snapshotService | PASS |
| 是否让 Container 直接写 store | 未直接写 | Container 只读 sabaki.state 投影 props; handleGraphClick 调用 sabaki.setCurrentTreePosition 是读 legacy 路径 | PASS |
| 是否让 UI component 直接依赖 service/store/repository | EnginePeerList 内部有 sabaki import | `PeerList.js:4` import sabaki; 但这是已有遗留行为，P0 不新增此类依赖。WorkbenchLeftPanel/WorkbenchRightPanel 不得直接 import sabaki | CONDITIONAL PASS (遗留迁移接缝，退出条件: EnginePeerList 重构为 props-based) |
| 是否新建 store | 否 | P0 使用 sabaki.state 和 Container 局部状态 | PASS |

## 16. Workbench 接线清单

### 16.1 控件清单

| 控件/区域 | 状态 | 命令 | v0.5 来源 |
| --- | --- | --- | --- |
| WorkbenchLeftPanel (new) | active | 包装 EnginePeerList + ModePanel | UI/UX spec SS13 L932-937 LeftSidebar |
| EnginePeerList (existing) | active | 引擎选择/管理 | Architecture v0.5 SS3.1 legacy facade |
| ModePanel (existing) | active | 各 mode 左栏内容 | UI/UX spec SS5-8 左栏规格 |
| WorkbenchRightPanel (new) | active | 包装 GameGraph | UI/UX spec SS13 L942 VariationTreePanel |
| GameGraph (existing) | active | 变化树浏览和导航 | UI/UX spec SS5 L287 变化树 |
| GtpConsole | deferred | 引擎命令控制台 | P1 |
| WinrateGraph | deferred | 胜率曲线 | P1/P2 |
| CommentBox | deferred | 评论编辑 | P1/P2 |

### 16.2 命令清单

| 语义命令 | Presentational Component | TrainingWorkbenchContainer | Controller/Service | Existing Sabaki Command |
| --- | --- | --- | --- | --- |
| EnginePeerList select engine | EnginePeerList -> onEngineSelect({syncer}) | 不经过 Container (WorkbenchLeftPanel 局部状态) | 无 | 无 |
| EnginePeerList context menu | EnginePeerList 内部 | 不经过 Container | 无 | sabaki.openEngineActionMenu |
| EnginePeerList attach engine | EnginePeerList 内部 | 不经过 Container | 无 | sabaki.openEnginesMenu |
| EnginePeerList toggle engine game | EnginePeerList 内部 | 不经过 Container | engineService.startStopEngineGame | sabaki.getPlayServices().engineService |
| GameGraph navigate node | GameGraph -> onNodeClick(evt) | handleGraphClick -> sabaki.setCurrentTreePosition | 无 | sabaki.setCurrentTreePosition |

### 16.3 状态前进契约

| 用户动作 | 改变的状态 | Store/Service/Sabaki |
| --- | --- | --- |
| Engine select | WorkbenchLeftPanel local state: selectedEngineSyncerId | 无全局状态变更 |
| Graph node click | sabaki.state.treePosition | sabaki.setCurrentTreePosition(gameTree, treePosition) -> documentStore |

### 16.4 状态回流契约

| 状态变更 | 投影路径 | UI 更新 |
| --- | --- | --- |
| sabaki.state.treePosition 变化 | App re-render -> Container -> gameTree/treePosition props -> WorkbenchRightPanel -> GameGraph | GameGraph 高亮当前节点变化 |
| engine syncers 列表变化 | App re-render -> Container -> attachedEngineSyncers props -> WorkbenchLeftPanel -> EnginePeerList | 引擎列表更新 |
| engine black/white syncer 变化 | App re-render -> Container -> blackEngineSyncerId/whiteEngineSyncerId props -> WorkbenchLeftPanel -> EnginePeerList | 引擎黑白标识更新 |

### 16.5 订阅契约

| Store/Event | Subscriber | 触发 UI 更新 |
| --- | --- | --- |
| sabaki 'change' event | App.js setState -> Container re-render | EnginePeerList + GameGraph props 更新 |
| workbenchStore subscribe | Container.forceUpdate | Mode 切换可能导致左右面板内容变化 |
| runtimeStore subscribe | Container.forceUpdate | 训练运行态更新 |

### 16.6 并行拆分建议

| Worker | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| Worker A: Contracts & docs | docs/design/2026-05-22/p0-engine-gamegraph-embed/* | 无 | 只写文档，不影响代码 | 低 |
| Worker B: WorkbenchLeftPanel | src/components/workbench/panels/WorkbenchLeftPanel.js (new), src/components/WorkbenchShell.js (left panel section) | EnginePeerList import, WorkbenchShell layout | 左栏写入不与右栏冲突 | 中 (Shell 布局可能合并冲突) |
| Worker C: WorkbenchRightPanel | src/components/workbench/panels/WorkbenchRightPanel.js (new), src/components/WorkbenchShell.js (right panel section) | GameGraph import, WorkbenchShell layout | 右栏写入不与左栏冲突 | 中 (Shell 布局可能合并冲突) |
| Worker D: Container wiring | src/components/TrainingWorkbenchContainer.js | Worker B/C 定义的新组件 | 需要新组件的 prop interface | 低 |
| Worker E: Tests | test/**/p0-engine-gamegraph-embed/* | Worker B/C/D 的接口定义 | 测试文件独立于生产代码 | 低 |
| Worker F: Architecture review | 只读审查 | Worker B/C/D 完成后 | 只读审查不写代码 | 无 |

**建议**: Worker B 和 Worker C 可以并行，但需要对 WorkbenchShell.js 的修改做协调（建议由一个 worker 负责 Shell 修改，另一个 worker 只负责 Panel 组件文件）。Worker D 应在 B/C 完成后开始。

### 16.7 弱测试禁令

以下断言不得作为主验收:

- "EnginePeerList callback 被调用一次" -- 只能作为 UI_COMMAND_MAPPING 的辅助检查
- "Container render 返回的对象包含 gameTree key" -- 必须验证值来自 sabaki.state，不是硬编码默认值
- "handleGraphClick 被调用" -- 必须验证 setCurrentTreePosition 收到正确参数，不能只验证调用发生

### 16.8 v0.5 冲突检查（补充）

| 检查项 | 结论 | 处理 |
| --- | --- | --- |
| EnginePeerList 内部 sabaki import 是否违反 Architecture v0.5 SS0.3 | 是遗留行为，P0 不新增。EnginePeerList 在 LeftSidebar 中已有 sabaki import | 标记为遗留迁移接缝，退出条件: 重构为 props-based |
| GameGraph 不通过 workbenchFlowService | 正确 -- GameGraph navigation 是 documentStore 层操作，不涉及训练业务 flow | PASS |
| Container 是否应为 graph click 创建新的 flowService 方法 | 不需要 -- setCurrentTreePosition 是已有 Sabaki core 操作，不需要经过 flowService | PASS |
| graphGridSize/graphNodeSize 从哪里来 | sabaki.state (由 setting.get 映射，见 sabaki.js L418-419) | App.js 已传入 sabaki.state，Container 从 state 解构 |

## 17. 任务并行建议

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| WorkbenchLeftPanel 组件创建 | src/components/workbench/panels/WorkbenchLeftPanel.js (new file) | EnginePeerList import | 独立新文件 | 低 |
| WorkbenchRightPanel 组件创建 | src/components/workbench/panels/WorkbenchRightPanel.js (new file) | GameGraph import | 独立新文件 | 低 |
| WorkbenchShell 布局修改 | src/components/WorkbenchShell.js (修改 left-panel 和 right-panel div) | 依赖 Worker B/C 的组件存在 | 需要协调 Shell 文件 | 中 |
| Container 接线 | src/components/TrainingWorkbenchContainer.js (增加 engine props 投影和 handleGraphClick) | 依赖 Shell 和 Panel 组件的 prop 接口 | 独立修改 Container 文件 | 中 |
| 测试编写 | test/**/*P0*.test.js | 依赖所有生产代码接口 | 独立测试文件 | 低 |
| workbench/index.js export 更新 | src/components/workbench/index.js (增加新组件 export) | 依赖 Worker B/C 创建的组件 | 单文件修改 | 低 |

**推荐执行顺序**: B/C (并行创建 Panel 组件) -> index.js export -> Shell 布局修改 -> Container 接线 -> 测试 -> 架构审查
