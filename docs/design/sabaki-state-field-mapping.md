# Sabaki.state 字段拆分映射表

> 基于 `workbench-architecture-overview.md` 的 State Ownership Target 和
> `sabaki-function-module-mapping.md` 的迁移优先级，将 `sabaki.state` 全部字段
> 按领域归类，映射到目标 store/service。

## 总览

| 目标模块 | 字段数 | 职责 |
| --- | --- | --- |
| `documentStore` | 4 | Game Tree 状态与导航 |
| `engineService` | 11 | 引擎附加/同步/分析/genmove |
| `analysisService` | 8 | 分析请求生命周期与缓存 |
| `overlayStore` | 4 | Overlay 可见性与合成 |
| `workbenchStore` | 6 | Workspace 状态、工具选择、编辑工作区 |
| `trainingStore` | 15 | Recall/Problem/Review 会话与答题 |
| `uiStore` | 20 | 抽屉、侧栏、布局、状态覆盖 |
| `sabaki.js (facade)` | 12 | 设置驱动字段、棋盘渲染配置、文件名 |
| Legacy 冻结 | 4 | `find`/`scoring`/`guess` 旧分支 |

---

## 1. documentStore — Game Tree 状态与导航

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `gameTrees` | `GameTree[]` | `[emptyTree]` | 所有游戏树 |
| `gameIndex` | `number` | `0` | 当前游戏索引 |
| `treePosition` | `string` | `emptyTree.root.id` | 当前树节点 ID |
| `gameCurrents` | `object[]` | `[{}]` | 各游戏当前导航路径 |

**迁移阶段**: Phase 12A（先行）

**迁移策略**: `documentStore` 成为这 4 个字段的唯一写入入口，`sabaki.js` 只保留兼容 wrapper。SGF load/save 在该阶段后半迁入，不和导航/history 同步搬。

---

## 2. engineService — 引擎服务

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `engines` | `array\|null` | `null` | 引擎配置列表 |
| `attachedEngineSyncers` | `array` | `[]` | 已附加的引擎同步器 |
| `analyzingEngineSyncerId` | `string\|null` | `null` | 分析引擎同步器 ID |
| `blackEngineSyncerId` | `string\|null` | `null` | 黑方引擎 ID |
| `whiteEngineSyncerId` | `string\|null` | `null` | 白方引擎 ID |
| `engineGameOngoing` | `object\|null` | `null` | 引擎对战状态 |
| `humanSLAvailable` | `boolean` | `false` | HumanSL 是否可用 |
| `humanSLModelLoaded` | `boolean` | `false` | HumanSL 模型是否加载 |
| `humanSLProfile` | `string` | `'rank_1d'` | HumanSL 配置文件 |
| `humanSLPendingProfile` | `string\|null` | `null` | 等待切换的 HumanSL 配置 |
| `humanSLError` | `string\|null` | `null` | HumanSL 错误信息 |

**迁移阶段**: Phase 12B

**迁移策略**: `engineService` 接管 attach/detach/sync/genmove、engine game、HumanSL 和 GTP log wiring。engine 回调通过 `analysisService`/`documentStore` 公开入口写入。

---

## 3. analysisService — 分析服务

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `analysis` | `object\|null` | `null` | 当前分析结果 |
| `analysisTreePosition` | `string\|null` | `null` | 分析对应的树位置 |
| `quickAnalysisId` | `number\|null` | `null` | 快速分析 ID |
| `quickAnalysisSyncerId` | `string\|null` | `null` | 快速分析同步器 ID |
| `selectedAnalysisVertex` | `number[]\|null` | `null` | 选中的分析顶点 |
| `analysisAreaRects` | `array\|null` | `null` | 分析区域矩形 |
| `analysisAreaVertices` | `array\|null` | `null` | 分析区域顶点 |
| `analysisType` | `string\|null` | `null` | 分析类型 |

**迁移阶段**: Phase 12C

**迁移策略**: `analysisService` 拥有 board/ownership 分析请求生命周期、quick analysis、cache lookup/writeback 和 game-tree vs scratch vs variation targets。可调用 `documentStore`/`engineService`，但不直接持有 document state。

---

## 4. overlayStore — Overlay 可见性与合成

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `territoryEnabled` | `boolean` | `false` | 领地显示 |
| `territoryCompareEnabled` | `boolean` | `false` | 领地对比 |
| `highlightVertices` | `array` | `[]` | 高亮顶点 |
| `playVariation` | `object\|null` | `null` | 试变化状态 |

**迁移阶段**: Phase 11

**迁移策略**: 从 `PositionSource`、analysis、ownership、reference 派生 overlay 输入。territory/compare/heatmap/human preference 的输入、层级、优先级标准化。Overlay 不能直接修改 board、game tree 或 working position。

---

## 5. workbenchStore — Workspace 状态

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `mode` | `string` | `'play'` | 应用模式 |
| `selectedTool` | `string` | `'stone_1'` | 选中的工具 |
| `editWorkspace` | `object\|null` | `null` | 编辑工作区（current/reference snapshot） |
| `areaSelectMode` | `boolean` | `false` | 区域选择模式 |
| `showAISuggestions` | `boolean\|null` | `null` | AI 建议显示 |
| `showHumanPreference` | `boolean\|null` | `null` | 人类偏好显示 |

**迁移阶段**: Phase 12D（workspace presets 部分）

**迁移策略**: 拆 `setMode` 为 workspace preset 选择、UI 副作用和 overlay 默认值。`workbenchStore` 拥有 workspace kind、`editWorkspace`、selected tools 和 working positions。

---

## 6. trainingStore — 训练会话

### 6.1 Recall

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `recallSession` | `object\|null` | `null` | 回忆会话 |
| `recallMoveIndex` | `number` | `0` | 回忆步骤索引 |
| `recallExpectedMoves` | `array` | `[]` | 回忆预期步骤 |
| `recallUserAttempts` | `array` | `[]` | 回忆用户尝试 |
| `recallShowHint` | `boolean` | `false` | 回忆提示 |
| `recallCompleted` | `boolean` | `false` | 回忆完成 |

### 6.2 Problem

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `problemSession` | `object\|null` | `null` | 题目会话 |
| `problemAttempt` | `object\|null` | `null` | 题目尝试 |
| `problemWorkspace` | `object\|null` | `null` | 题目工作区 |
| `problemEvalCache` | `array` | `[]` | 题目评估缓存 |
| `problemBadMoves` | `array` | `[]` | 题目坏步骤 |
| `problemSubmitted` | `boolean` | `false` | 题目已提交 |
| `problemResult` | `object\|null` | `null` | 题目结果 |

### 6.3 Review

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `reviewQueue` | `array` | `[]` | 复习队列 |
| `reviewCurrentIndex` | `number` | `0` | 复习当前索引 |
| `reviewTotalDue` | `number` | `0` | 复习总数 |

**迁移阶段**: Phase 9（recall），Phase 12D（problem/review legacy 冻结）

**迁移策略**: Recall executor 写 `trainingStore` 边界，不复用 play move 或 scratch edit 写路径。Problem/Review 长期被 recall 替代，短期冻结。

---

## 7. uiStore — UI 状态

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `openDrawer` | `string\|null` | `null` | 打开的抽屉 |
| `busy` | `number` | `0` | 忙碌计数器 |
| `fullScreen` | `boolean` | `false` | 全屏状态 |
| `showMenuBar` | `boolean\|null` | `null` | 菜单栏显示 |
| `zoomFactor` | `number\|null` | `null` | 缩放因子 |
| `consoleLog` | `array` | `[]` | 控制台日志 |
| `showLeftSidebar` | `boolean` | setting | 左侧栏显示 |
| `leftSidebarWidth` | `number` | setting | 左侧栏宽度 |
| `showWinrateGraph` | `boolean` | setting | 胜率图显示 |
| `showGameGraph` | `boolean` | setting | 棋谱图显示 |
| `showCommentBox` | `boolean` | setting | 注释框显示 |
| `sidebarWidth` | `number` | setting | 侧栏宽度 |
| `graphGridSize` | `number\|null` | `null` | 棋谱网格大小 |
| `graphNodeSize` | `number\|null` | `null` | 棋谱节点大小 |
| `preferencesTab` | `string` | `'general'` | 设置页标签 |
| `infoOverlayText` | `string` | `''` | 信息覆盖层文字 |
| `showInfoOverlay` | `boolean` | `false` | 信息覆盖层显示 |
| `showInputBox` | `boolean` | `false` | 输入框显示 |
| `inputBoxText` | `string` | `''` | 输入框文字 |
| `onInputBoxSubmit` | `function` | `noop` | 输入框提交回调 |
| `onInputBoxCancel` | `function` | `noop` | 输入框取消回调 |

**迁移阶段**: Phase 12D

**迁移策略**: 迁出 drawer/busy/info overlay 等 UI-only state。`uiStore` 不拥有棋局、analysis、engine 或训练状态。

---

## 8. sabaki.js (facade) — 设置/渲染配置

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `representedFilename` | `string\|null` | `null` | 当前文件名 |
| `boardTransformation` | `string` | `''` | 棋盘变换 |
| `scoringMethod` | `string\|null` | `null` | 计分方法 |
| `coordinatesType` | `string\|null` | `null` | 坐标类型 |
| `showAnalysis` | `boolean\|null` | `null` | 分析显示 |
| `showCoordinates` | `boolean\|null` | `null` | 坐标显示 |
| `showMoveColorization` | `boolean\|null` | `null` | 落子着色 |
| `showMoveNumbers` | `boolean\|null` | `null` | 手数显示 |
| `showNextMoves` | `boolean\|null` | `null` | 下一手显示 |
| `showSiblings` | `boolean\|null` | `null` | 同级变着显示 |
| `fuzzyStonePlacement` | `boolean\|null` | `null` | 模糊落子 |
| `animateStonePlacement` | `boolean\|null` | `null` | 落子动画 |

**保留原因**: 这些字段由 `updateSettingState` 从用户设置驱动，属于 app-level 渲染配置。部分（`boardTransformation`）可能后续迁入 `uiStore`，但迁移期保留在 facade。

---

## 9. Legacy 冻结

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `findText` | `string` | `''` | 查找文本（find mode） |
| `findVertex` | `array\|null` | `null` | 查找顶点（find mode） |
| `deadStones` | `array` | `[]` | 死子列表（scoring mode） |
| `blockedGuesses` | `array` | `[]` | 猜测封锁点（guess mode） |

**策略**: 冻结不再扩展。长期等 `recall` 稳定后决定删除 `guess`/`find`/`scoring` 分支。

---

## 迁移顺序

按 `sabaki-function-module-mapping.md` 的建议，迁移串行执行：

```
Phase 12A: documentStore（gameTrees, treePosition, gameCurrents, gameIndex）
    ↓
Phase 12B: engineService（engines, attachedEngineSyncers, humanSL*, engineGameOngoing, ...）
    ↓
Phase 12C: analysisService（analysis, analysisTreePosition, quickAnalysis*, analysisArea*, ...）
    ↓
Phase 12D: workbenchStore + uiStore + legacy 冻结
           workbenchStore（mode, selectedTool, editWorkspace, areaSelectMode, ...）
           uiStore（openDrawer, busy, fullScreen, consoleLog, sidebar*, infoOverlay*, ...）
           Legacy 冻结（findText, findVertex, deadStones, blockedGuesses）
```

迁移期 `sabaki.state` 仍作为 `App.js` 的兼容镜像和 change event 发布源。先收紧写入入口（某领域状态只能通过对应 store 写入），等写入入口稳定后再把内部存储从 `sabaki.state` 迁到独立 store。
