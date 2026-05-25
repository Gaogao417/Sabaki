# Sabaki.state 字段拆分映射表

> 基于 `workbench-architecture-overview.md` 的 State Ownership Target 和
> `sabaki-function-module-mapping.md` 的迁移优先级，将 `sabaki.state` 全部字段
> 按领域归类，映射到目标 store/service。

## 总览

| 目标模块 | 字段数 | 迁移状态 | 职责 |
| --- | --- | --- | --- |
| `documentStore` | 4 | 待迁移 | Game Tree 状态与导航 |
| `engineService` | 15 | ✅ 已完成 | 引擎附加/同步/分析结果/genmove/HumanSL/控制台 |
| `analysisService` | 4 | 待迁移 | 分析区域选择与类型 |
| `overlayStore` | 4 | 待迁移 | Overlay 可见性与合成 |
| `workbenchStore` | 6+ | 待迁移 | WorkbenchTab、mode、active ids、workspace 状态、工具选择、编辑工作区 |
| `trainingRuntimeStore` / `trainingRepository` | 15+ | 待迁移 | Problem/Recall companion runtime 与训练事实表 |
| `uiStore` | 22 | 待迁移 | 抽屉、侧栏、布局、第三方面板、状态覆盖 |
| `sabaki.js (facade)` | 12 | 保留 | 设置驱动字段、棋盘渲染配置、文件名 |
| Legacy 冻结 | 4 | 冻结 | `find`/`scoring`/`guess` 旧分支 |

---

## ModeState Companion Mapping

`docs/design/workbench-mode-orchestration-contract.md` 是上层状态机 source of truth。
本字段映射表按底层字段 owner 拆分，但所有新增字段必须能归入以下 mode companion 结构：

```txt
ModeState
  ├─ WorkbenchTab fields
  │  └─ mode, activeAttemptId, activeRecallSessionId, previousMode, currentTreePosition
  ├─ TrainingRuntime companion fields
  │  └─ problemView, recallView, activeCheckpointId, correctionDraft,
  │     pendingMoveEvaluations, visibleBadMoveIds
  ├─ TrainingRepository persistence
  │  └─ Attempt, MoveEvaluation, BadMove, Problem, RecallSession,
  │     RecallAttempt, RecallCheckpoint, MoveComment
  ├─ OverlayRegion
  │  └─ territoryEnabled, territoryCompareEnabled, info overlay,
  │     ownership source, pending/unavailable reason
  └─ EngineAnalysisRegion
     └─ attached engine, analyzing syncer, game-tree live analysis,
        scratch analysis, ownership cache, engine game ongoing
```

口径：

- `WorkbenchMode.problem` 是一等运行态 mode。
- `Problem` entity / task 不是 mode，而是训练业务对象。
- `PositionSource` / `MutationContract` 是由 ModeState 派生出的棋盘读写边界。
- `overlayStore` 只接受 Analysis 相关 territory / compare；离开 Analysis 必须清理。
- `engineService` / `analysisService` 的更新必须携带 target，不能混 game-tree live analysis 和
  scratch analysis。

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

## 2. engineService — 引擎服务 ✅ 已完成

> 迁移完成：全部 15 个字段已从 `sabaki.state` 迁入 `engineService` 内部状态。
> `sabaki.state` 仅保留 `engines: null` 占位符（标注注释 "state owned by engineService"）。
> 外部通过 `engineService` 方法访问（如 `getAttachedSyncers()`, `getAnalysisForPosition()`, `getConsoleLog()`）。

### 2.1 引擎连接状态

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `engines` | `array\|null` | `null` | 引擎配置列表（sabaki.state 保留占位） |
| `attachedEngineSyncers` | `array` | `[]` | 已附加的引擎同步器 |
| `analyzingEngineSyncerId` | `string\|null` | `null` | 分析引擎同步器 ID |
| `blackEngineSyncerId` | `string\|null` | `null` | 黑方引擎 ID |
| `whiteEngineSyncerId` | `string\|null` | `null` | 白方引擎 ID |
| `engineGameOngoing` | `object\|null` | `null` | 引擎对战状态 |

### 2.2 分析结果（从 analysisService 划入）

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `analysis` | `object\|null` | `null` | 当前分析结果 |
| `analysisTreePosition` | `string\|null` | `null` | 分析对应的树位置 |
| `quickAnalysisId` | `number\|null` | `null` | 快速分析 ID |
| `quickAnalysisSyncerId` | `string\|null` | `null` | 快速分析同步器 ID |

### 2.3 HumanSL 状态

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `humanSLAvailable` | `boolean` | `false` | HumanSL 是否可用 |
| `humanSLModelLoaded` | `boolean` | `false` | HumanSL 模型是否加载 |
| `humanSLProfile` | `string` | `'rank_1d'` | HumanSL 配置文件 |
| `humanSLPendingProfile` | `string\|null` | `null` | 等待切换的 HumanSL 配置 |
| `humanSLError` | `string\|null` | `null` | HumanSL 错误信息 |

### 2.4 控制台（从 uiStore 划入）

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `consoleLog` | `array` | `[]` | GTP 命令/响应历史 |

**迁移策略**: `engineService` 接管 attach/detach/sync/genmove、engine game、HumanSL 和 GTP log wiring。engine 回调通过 `analysisService`/`documentStore` 公开入口写入。

---

## 3. analysisService — 分析服务

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `selectedAnalysisVertex` | `number[]\|null` | `null` | 选中的分析顶点 |
| `analysisAreaRects` | `array\|null` | `null` | 分析区域矩形 |
| `analysisAreaVertices` | `array\|null` | `null` | 分析区域顶点 |
| `analysisType` | `string\|null` | `null` | 分析类型 |

**迁移阶段**: Phase 12C

**迁移策略**: `analysisService` 拥有分析区域/类型选择、board/ownership 分析请求生命周期协调和 cache lookup/writeback。分析结果数据（`analysis`, `analysisTreePosition`, `quickAnalysisId`, `quickAnalysisSyncerId`）已迁入 `engineService`（见 §2.2）。`analysisService` 可调用 `documentStore`/`engineService`，但不直接持有 document state。

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

## 5. workbenchStore — WorkbenchTab / Mode / Workspace 状态

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `tabs` | `Record<string, WorkbenchTab>` | `{}` | Workbench tab map，包含 mode 和 active ids |
| `activeTabId` | `string\|null` | `null` | 当前 active tab |
| `mode` | `string` | `'play'` | legacy app mode mirror；新代码应读 `WorkbenchTab.mode` |
| `activeAttemptId` | `string\|null` | `null` | 当前 tab 的 active Attempt id |
| `activeRecallSessionId` | `string\|null` | `null` | 当前 tab 的 active RecallSession id |
| `previousMode` | `string\|undefined` | `undefined` | Analysis return target |
| `currentTreePosition` | `string\|undefined` | `undefined` | tab-level 恢复点 |
| `selectedTool` | `string` | `'stone_1'` | 选中的工具 |
| `editWorkspace` | `object\|null` | `null` | 编辑工作区（current/reference snapshot） |
| `areaSelectMode` | `boolean` | `false` | 区域选择模式 |
| `showAISuggestions` | `boolean\|null` | `null` | AI 建议显示 |
| `showHumanPreference` | `boolean\|null` | `null` | 人类偏好显示 |

**迁移阶段**: Phase 12D（workspace presets 部分）

**迁移策略**: `workbenchStore` 拥有 WorkbenchTab、mode、previousMode、active ids、
workspace kind、`editWorkspace`、selected tools 和 working positions。Mode transition 必须走
`workbenchFlowService` 或后续 `workbenchModeService`；`setMode` 只能作为 legacy facade。

---

## 6. trainingRuntimeStore / trainingRepository — 训练 companion state 与事实表

### 6.1 TrainingRuntimeStore companion fields

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `activeAttemptId` | `string\|null` | `null` | 当前 runtime active Attempt mirror |
| `activeRecallSessionId` | `string\|null` | `null` | 当前 runtime active RecallSession mirror |
| `activeCheckpointId` | `string\|null` | `null` | 当前 Recall checkpoint |
| `pendingMoveEvaluations` | `MoveEvaluation[]` | `[]` | engine pending evaluation projection |
| `correctionDraft` | `string\|null` | `null` | Recall checkpoint correction draft |
| `visibleBadMoveIds` | `string[]` | `[]` | 当前 Problem/Attempt 可见坏棋 projection |
| `recallView` | `RecallView\|null` | `null` | Recall mode runtime companion |
| `problemView` | `ProblemView\|null` | `null` | Problem mode runtime companion |
| `reviewQueueView` | `object\|null` | `null` | Review queue projection；打开具体题目后进入 Problem mode |

### 6.2 trainingRepository persistence

| 实体 | Owner | Mode 写入边界 |
| --- | --- | --- |
| `Attempt` | `attemptService` / repository | Play/Problem submit 前 mutable；submit 后 frozen。Recall/Analysis 不得改 `userLine/result/status`。 |
| `MoveEvaluation` | monitor / attempt service | engine update 可解析 pending evaluation，但不得污染 frozen Attempt。 |
| `BadMove` | monitor / problem service | 绑定 MoveEvaluation；可派生 punishment Problem。 |
| `Problem` / `TrainingTask` | problem service / workbench tab service | Problem entity 不是 mode；打开后进入 `WorkbenchMode.problem`。 |
| `RecallSession` / `RecallAttempt` | recall service | Recall 只能写 recall facts，不改 source Attempt line/result/status。 |
| `RecallCheckpoint` / `MoveComment` | recall checkpoint service | 只属于 Recall checkpoint 子流程。 |

**迁移阶段**: Phase 9（recall），Phase 9B（problem），Phase 12D（runtime cleanup）。

**迁移策略**: Problem executor 写 `problemView`、mutable Attempt、MoveEvaluation / BadMove
handoff。Recall executor 写 RecallSession / RecallAttempt / Checkpoint / Comment。二者都不能复用
play move 或 scratch edit 写路径，也不能绕过 mode transition guard。

---

## 7. uiStore — UI 状态

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `openDrawer` | `string\|null` | `null` | 打开的抽屉 |
| `busy` | `number` | `0` | 忙碌计数器 |
| `fullScreen` | `boolean` | `false` | 全屏状态 |
| `showMenuBar` | `boolean\|null` | `null` | 菜单栏显示 |
| `zoomFactor` | `number\|null` | `null` | 缩放因子 |
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
| `showThirdPartyPanel` | `boolean` | `false` | 第三方面板显示 |
| `thirdPartyPanelTab` | `string` | `'fox'` | 第三方面板标签页 |
| `weiqi101Connected` | `boolean` | `false` | 101Weiqi 连接状态 |

**迁移阶段**: Phase 12D

**迁移策略**: 迁出 drawer/busy/info overlay 等 UI-only state。`uiStore` 不拥有棋局、analysis、engine 或训练状态。`consoleLog` 已迁入 `engineService`（见 §2.4）。新增 3 个第三方面板字段随 uiStore 一起迁移。

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
Phase 12B: engineService ✅ 已完成
    引擎连接（engines, attachedEngineSyncers, black/whiteEngineSyncerId, engineGameOngoing）
    分析结果（analysis, analysisTreePosition, quickAnalysisId, quickAnalysisSyncerId）
    HumanSL（humanSLAvailable, humanSLModelLoaded, humanSLProfile, humanSLPendingProfile, humanSLError）
    控制台（consoleLog）
    ↓
Phase 12A: documentStore（gameTrees, treePosition, gameCurrents, gameIndex）
    ↓
Phase 12C: analysisService（selectedAnalysisVertex, analysisAreaRects, analysisAreaVertices, analysisType）
    ↓
Phase 12D: workbenchStore + trainingRuntimeStore + uiStore + legacy 冻结
           workbenchStore（tabs, activeTabId, mode, previousMode, active ids, selectedTool, editWorkspace, ...）
           trainingRuntimeStore（problemView, recallView, activeCheckpointId, pendingMoveEvaluations, ...）
           uiStore（openDrawer, busy, fullScreen, sidebar*, infoOverlay*, third-party*, ...）
           Legacy 冻结（findText, findVertex, deadStones, blockedGuesses）
```

迁移期 `sabaki.state` 仍作为 `App.js` 的兼容镜像和 change event 发布源。先收紧写入入口（某领域状态只能通过对应 store 写入），等写入入口稳定后再把内部存储从 `sabaki.state` 迁到独立 store。

### 迁移变更记录

- **engineService 完成**: 15 个字段已迁入 `engineService` 内部状态（含从 analysisService 划入的 4 个分析结果字段和从 uiStore 划入的 consoleLog）。`sabaki.state` 仅保留 `engines: null` 占位符。
- **新增字段**: `showThirdPartyPanel`、`thirdPartyPanelTab`、`weiqi101Connected` 归入 `uiStore` 目标。
