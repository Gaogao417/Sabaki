# Sabaki.js 函数清单与模块拆解映射

> 基于 `workbench-architecture-overview.md` 的目标架构，将 `src/modules/sabaki.js` 中的
> 全部函数按职责分类，映射到目标模块。

## 总览

`sabaki.js` 当前包含约 **182 个函数/方法**，集中了应用生命周期、状态管理、引擎交互、
分析调度、文件 I/O、棋盘交互、训练会话、历史管理等几乎所有业务逻辑。按照架构文档，
这些函数应逐步迁移到以下领域模块：

| 目标模块 | 函数数量 | 职责概述 |
| --- | --- | --- |
| `workbench/board-interactions/` | 16 | 棋盘输入解析与 executor 路由 |
| `workbench/working-position/` | 13 | Working position CRUD 与棋盘互转 |
| `workbench/stores/workbenchStore` | 11 | Workspace 状态、编辑工作区、工具选择 |
| `workbench/contracts/` | 3 | PositionSource / MutationContract 定义与映射 |
| `workbench/presets/` | 2 | Workspace 默认组合 |
| `document/` | 20 | Game tree 读写、导航、SGF 写回、文件 I/O |
| `analysis/` | 30 | 分析调度、缓存、scratch/game-tree 分析 |
| `engine/` | 23 | 引擎附加/分离/同步/分析/genmove |
| `training/` | 19 | Recall/Problem/Review 会话与答题 |
| `overlays/` | 6 | Overlay 可见性、领地显示、合成 |
| `ui/` | 8 | 抽屉、侧栏、信息覆盖、忙碌状态 |
| `sabaki.js (facade)` | 11 | App 生命周期、设置、窗口、顶层装配 |

---

## 1. workbench/contracts/ — 契约定义与映射

目标文件：`positionSource.ts`、`mutationContracts.ts`、`workspaceDefaults.ts`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `getActivePositionSource` | 1169 | 根据 mode/workspace 派生活动 PositionSource | `positionSource.ts` |
| 2 | `getActiveMutationContract` | 1173 | 根据 mode/workspace 派生活动 MutationContract | `mutationContracts.ts` |
| 3 | `setMode` | 515 | 设置应用模式，隐式决定 source/contract | `workspaceDefaults.ts`（mode → 默认契约映射部分） |

**说明**：`setMode` 本身是遗留入口，拆解时其 mode → source/contract 映射逻辑应抽入
`workspaceDefaults.ts`；mode 切换的 UI 副作用留在 `sabaki.js` facade 或 `uiStore`。

---

## 2. workbench/board-interactions/ — 棋盘输入解析与执行

### 2.1 解析层

目标文件：`resolveBoardInteraction.ts`、`intents.ts`、`createBoardInteractionContext.js`、`executeBoardInteraction.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `clickVertex` | 3247 | 棋盘点击总入口，按 mode 分发到不同处理路径 | `executeBoardInteraction.js`（拆解为路由） |
| 2 | `handleEditAnalysisClick` | 1398 | 编辑分析模式的点击处理，调用 resolver + executor | 迁移后删除（被 executor 路由替代） |
| 3 | `handleEditDragEnd` | 1910 | 编辑模式拖拽结束处理 | `scratchEditInteractionExecutor.js` |

**说明**：`clickVertex` 是当前最大的分发函数（~300 行），拆解后应变成薄路由：
resolver → intent → executor。`handleEditAnalysisClick` 已部分迁移到 executor，
最终应完全移入 `executeBoardInteraction.js`。

### 2.2 playInteractionExecutor

目标文件：`executors/playInteractionExecutor.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `playMove` | 3235 | 对局落子入口 | `playInteractionExecutor.js` |
| 2 | `executePlayMove` | 1389 | 执行落子操作（含打劫/自杀检测） | `playInteractionExecutor.js` |
| 3 | `makeMove` | 3550 | 落子核心逻辑（写 game tree、历史、引擎触发） | `playInteractionExecutor.js` |
| 4 | `makeResign` | 3687 | 认输操作 | `playInteractionExecutor.js` |
| 5 | `variationMove` | 3239 | 变化落子 | → `variationInteractionExecutor.js`（见 §2.4） |

### 2.3 scratchEditInteractionExecutor

目标文件：`executors/scratchEditInteractionExecutor.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `scratchEdit` | 1513 | 棋盘编辑核心（摆子/擦除/标记/连线） | `scratchEditInteractionExecutor.js` |
| 2 | `clickEditWorkspaceVertex` | 1738 | 编辑工作区点击，委托 scratchEdit | `scratchEditInteractionExecutor.js` |
| 3 | `commitEditResult` | 1435 | 提交编辑 executor 返回的 effect | `scratchEditInteractionExecutor.js`（或 executeBoardInteraction 路由） |
| 4 | `useTool` | 3714 | 在编辑模式使用标记/连线/箭头工具 | `scratchEditInteractionExecutor.js` |

### 2.4 recallInteractionExecutor

目标文件：`executors/recallInteractionExecutor.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `recallAnswer` | 3243 | 回忆答案入口 | `recallInteractionExecutor.js` |
| 2 | `handleRecallMove` | 606 | 处理回忆模式落子（比对答案） | `recallInteractionExecutor.js` |
| 3 | `recallNavigateNext` | 610 | 回忆导航到下一步 | `recallInteractionExecutor.js` |
| 4 | `checkRecallComplete` | 620 | 检查回忆是否完成 | `recallInteractionExecutor.js` |
| 5 | `skipRecallMove` | 631 | 跳过当前回忆 | `recallInteractionExecutor.js` |
| 6 | `showRecallHint` | 635 | 显示回忆提示 | `recallInteractionExecutor.js` |

### 2.5 variationInteractionExecutor

目标文件：`executors/variationInteractionExecutor.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `variationMove` | 3239 | 变化落子 | `variationInteractionExecutor.js` |
| 2 | `playAnalysisVariation` | 5284 | 播放分析变化 | `variationInteractionExecutor.js` |

### 2.6 legacyInteractionExecutor

目标文件：`executors/legacyInteractionExecutor.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `handleProblemMove` | 732 | 问题模式落子（legacy） | `legacyInteractionExecutor.js` |
| 2 | `findMove` | 5152 | 查找棋步（legacy） | `legacyInteractionExecutor.js` |
| 3 | `findPosition` | 5115 | 查找位置（legacy） | `legacyInteractionExecutor.js` |
| 4 | `findHotspot` | 5148 | 查找热点（legacy） | `legacyInteractionExecutor.js` |

**说明**：`findPosition`/`findHotspot`/`findMove` 属于 legacy `find` 功能，冻结不再扩展。
`handleProblemMove` 属于 legacy `problem` 功能，长期将被 recall 替代。

---

## 3. workbench/working-position/ — Working Position 操作

目标文件：`workingPosition.js`、`workingPositionBoard.js`、`workingPositionMarkers.js`、`workingPositionLines.js`

### 3.1 workingPosition.js — 创建/克隆/元数据

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `createScratchSnapshotFromCurrentPosition` | 451 | 从当前 game-tree 位置创建 working position snapshot | `workingPosition.js` |
| 2 | `createAnalysisWorkspace` | 471 | 创建分析工作区（含 current/reference snapshot） | `workingPosition.js` |
| 3 | `resetAnalysisWorkspace` | 496 | 重置分析工作区 | `workingPosition.js` |
| 4 | `syncEditWorkspaceToCurrentPosition` | 1185 | 将编辑工作区同步到当前 game-tree 位置 | `workingPosition.js` |

### 3.2 workingPositionBoard.js — 棋盘互转/落子/提子/擦除

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `captureEditReference` | 1742 | 捕获当前 snapshot 到 reference tab | `workingPositionBoard.js` |
| 2 | `setEditWorkspacePlayer` | 1830 | 设置 working position 下一手玩家 | `workingPositionBoard.js` |
| 3 | `snapshotAsProblem` | 656 | 将快照保存为题目 | `workingPositionBoard.js` |
| 4 | `createProblemFromSnapshot` | 661 | 从快照创建题目（含序列化） | `workingPositionBoard.js` |
| 5 | `snapshotAsNewGame` | 5504 | 将快照另存为新游戏 | `workingPositionBoard.js`（或 `document/gameTreeWrites.js`） |

### 3.3 workingPositionMarkers.js — Marker Map 操作

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `getEditWorkspaceTabKeys` | 1131 | 获取编辑工作区选项卡键（current/reference markerMap 键） | `workingPositionMarkers.js` |
| 2 | `toggleEditTab` | 1800 | 切换编辑选项卡（current ↔ reference） | `workingPositionMarkers.js`（或 `workbenchStore`） |

### 3.4 workingPositionLines.js — Line/Arrow 操作

暂无独立函数需迁移至此。当前 line/arrow 操作嵌在 `scratchEdit` 和 `useTool` 中，
Phase 7 迁移时将从这两个函数中提取 `addLine`、`removeLineAt` 等纯函数到此模块。

---

## 4. workbench/stores/workbenchStore — Workspace 状态

目标文件：`workbenchStore.ts`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `scheduleEditWorkspaceAnalysis` | 1864 | 调度编辑工作区分析 | `workbenchStore`（调度部分）或 `analysis/scratchAnalysis.js` |
| 2 | `refreshEditWorkspaceAnalysis` | 1878 | 刷新编辑工作区分析结果 | `analysis/scratchAnalysis.js` |
| 3 | `getBoardAnalysisContext` | 1157 | 获取棋盘分析上下文 | → `analysis/boardAnalysisContext.js`（见 §7） |
| 4 | `getPreviousTreePosition` | 1143 | 获取上一个树位置 | `workbenchStore` 或 `document/documentStore` |
| 5 | `getTerritoryCompareAvailable` | 1150 | 检查领地对比是否可用 | `workbenchStore` |
| 6 | `createProblemFromSnapshot` | 661 | 从快照创建题目 | 已在 §3.2 列出，写入 workbenchStore |

**说明**：`scheduleEditWorkspaceAnalysis` 和 `refreshEditWorkspaceAnalysis` 的调度/缓存
核心逻辑应迁入 `analysis/scratchAnalysis.js`，workbenchStore 只保留触发入口。
`getBoardAnalysisContext` 迁入 `analysis/boardAnalysisContext.js`。

---

## 5. workbench/presets/ — Workspace 默认组合

目标文件：`workspacePresets.ts`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `setMode` | 515 | mode → workspace 默认 source/contract/overlay 的映射部分 | `workspacePresets.ts`（映射表部分） |
| 2 | `setOverlayMode` | 2492 | 设置 overlay 模式 | `workspacePresets.ts`（默认 overlay 选择部分） |

**说明**：`setMode` 的 mode 切换涉及多个方面：契约映射（→ contracts）、
UI 状态（→ uiStore）、默认 overlay（→ presets）。映射表本身抽入 `workspacePresets.ts`，
副作用触发保留在 facade。

---

## 6. document/ — Game Tree 读写与文件 I/O

目标文件：`documentStore.ts`、`gameTreeWrites.js`、`sgfWriteback.js`

### 6.1 documentStore.ts — Game Tree 状态与导航

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `setCurrentTreePosition` | 3919 | 设置当前树位置（核心状态更新） | `documentStore.ts` |
| 2 | `goStep` | 3983 | 前进/后退 N 步 | `documentStore.ts` |
| 3 | `goToMoveNumber` | 3990 | 跳转到指定手数 | `documentStore.ts` |
| 4 | `goToNextFork` | 4008 | 跳到下一个分叉 | `documentStore.ts` |
| 5 | `goToPreviousFork` | 4018 | 跳到上一个分叉 | `documentStore.ts` |
| 6 | `goToComment` | 4040 | 跳到下一个/上一个有注释的节点 | `documentStore.ts` |
| 7 | `goToBeginning` | 4064 | 跳到开始 | `documentStore.ts` |
| 8 | `goToEnd` | 4071 | 跳到结束 | `documentStore.ts` |
| 9 | `goToSiblingVariation` | 4079 | 跳到同级变着 | `documentStore.ts` |
| 10 | `changeDownstreamVariation` | 4090 | 改变下游变着方向 | `documentStore.ts` |
| 11 | `goToMainVariation` | 4138 | 跳到主变化 | `documentStore.ts` |
| 12 | `goToSiblingGame` | 4157 | 跳到同级游戏 | `documentStore.ts` |
| 13 | `startAutoscrolling` | 4168 | 开始自动滚动播放 | `documentStore.ts`（或 legacy） |
| 14 | `stopAutoscrolling` | 4189 | 停止自动滚动 | `documentStore.ts`（或 legacy） |

### 6.2 gameTreeWrites.js — Game Tree Mutation

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `makeMainVariation` | 5572 | 将当前变着设为主变化 | `gameTreeWrites.js` |
| 2 | `shiftVariation` | 5595 | 移动变着顺序（左/右） | `gameTreeWrites.js` |
| 3 | `removeNode` | 5620 | 删除节点 | `gameTreeWrites.js` |
| 4 | `removeOtherVariations` | 5673 | 删除其他所有变着 | `gameTreeWrites.js` |
| 5 | `copyVariation` | 5408 | 复制变着 | `gameTreeWrites.js` |
| 6 | `cutVariation` | 5426 | 剪切变着 | `gameTreeWrites.js` |
| 7 | `pasteVariation` | 5431 | 粘贴变着 | `gameTreeWrites.js` |
| 8 | `flattenVariation` | 5459 | 扁平化变着（子树变新根） | `gameTreeWrites.js` |
| 9 | `setPlayer` | 5308 | 设置节点行棋方（PL 属性） | `gameTreeWrites.js` |
| 10 | `getGameInfo` | 5186 | 获取游戏信息 | `gameTreeWrites.js` |
| 11 | `setGameInfo` | 5190 | 设置游戏信息 | `gameTreeWrites.js` |
| 12 | `getComment` | 5326 | 获取节点注释 | `gameTreeWrites.js` |
| 13 | `setComment` | 5356 | 设置节点注释（含多个 SGF 属性） | `gameTreeWrites.js` |
| 14 | `getEmptyGameTree` | 2612 | 创建空游戏树 | `gameTreeWrites.js` |

### 6.3 sgfWriteback.js — SGF 文件读写

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `saveFile` | 3012 | 保存 SGF 文件 | `sgfWriteback.js` |
| 2 | `getSGF` | 3042 | 生成 SGF 字符串 | `sgfWriteback.js` |
| 3 | `getBoardAscii` | 3065 | 棋盘转 ASCII 文本 | `sgfWriteback.js` |
| 4 | `generateTreeHash` | 3166 | 生成游戏树哈希 | `sgfWriteback.js` |
| 5 | `generateFileHash` | 3170 | 生成文件哈希 | `sgfWriteback.js` |
| 6 | `loadFile` | 2872 | 加载 SGF 文件 | `sgfWriteback.js` |
| 7 | `loadContent` | 2935 | 加载内容字符串 | `sgfWriteback.js` |
| 8 | `loadGameTrees` | 2965 | 加载游戏树数组到状态 | `sgfWriteback.js` |
| 9 | `newFile` | 2845 | 新建空文件 | `sgfWriteback.js` |
| 10 | `askForSave` | 3182 | 询问用户是否保存 | `sgfWriteback.js` |
| 11 | `askForReload` | 3201 | 询问用户是否重新加载 | `sgfWriteback.js` |

---

## 7. analysis/ — 分析服务

目标文件：`analysisService.js`、`boardAnalysisContext.js`、`scratchAnalysis.js`、`gameTreeAnalysis.js`、`analysisCache.js`

### 7.1 analysisService.js — 分析请求生命周期

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `startAnalysis` | 4870 | 启动引擎分析 | `analysisService.js` |
| 2 | `stopAnalysis` | 4909 | 停止分析 | `analysisService.js` |
| 3 | `waitForQuickAnalysis` | 4938 | 等待快速分析完成 | `analysisService.js` |
| 4 | `quickAnalyzeAllNodes` | 4988 | 快速分析所有节点 | `analysisService.js` |
| 5 | `stopQuickAnalysis` | 5102 | 停止快速分析 | `analysisService.js` |
| 6 | `analyzeMove` | 4842 | 分析指定位置 | `analysisService.js` |
| 7 | `scheduleLiveAnalysis` | 4854 | 调度实时分析 | `gameTreeAnalysis.js` |
| 8 | `ensureAnalysisReady` | 1208 | 确保分析引擎就绪（附加引擎并等待） | `analysisService.js` |
| 9 | `attachDefaultAnalysisEngine` | 1254 | 附加默认分析引擎 | `analysisService.js` |
| 10 | `runBoardAnalysis` | 2177 | 运行棋盘分析（核心） | `analysisService.js` |
| 11 | `runOwnershipAnalysis` | 2347 | 运行所有权分析 | `analysisService.js` |
| 12 | `refreshActiveBoardAnalysis` | 1177 | 刷新当前活动棋盘分析 | `analysisService.js` |

### 7.2 boardAnalysisContext.js — 分析上下文

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `getBoardAnalysisContext` | 1157 | 获取棋盘分析上下文 | `boardAnalysisContext.js` |
| 2 | `getAnalysisSyncerId` | 2398 | 获取分析引擎同步器 ID | `boardAnalysisContext.js` |
| 3 | `setAnalysisArea` | 5223 | 设置分析区域 | `boardAnalysisContext.js` |
| 4 | `setAnalysisAreaRects` | 5232 | 设置分析区域矩形 | `boardAnalysisContext.js` |
| 5 | `clearAnalysisArea` | 5243 | 清除分析区域 | `boardAnalysisContext.js` |
| 6 | `toggleAreaSelectMode` | 5252 | 切换区域选择模式 | `boardAnalysisContext.js` |
| 7 | `setSelectedAnalysisVertex` | 5280 | 设置选中的分析顶点 | `boardAnalysisContext.js` |
| 8 | `toggleShowAISuggestions` | 5256 | 切换 AI 建议显示 | `boardAnalysisContext.js` |
| 9 | `toggleShowHumanPreference` | 5270 | 切换人类偏好显示 | `boardAnalysisContext.js` |

### 7.3 scratchAnalysis.js — Working Position 分析

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `scheduleEditWorkspaceAnalysis` | 1864 | 调度编辑工作区分析 | `scratchAnalysis.js` |
| 2 | `refreshEditWorkspaceAnalysis` | 1878 | 刷新编辑工作区分析结果 | `scratchAnalysis.js` |

### 7.4 gameTreeAnalysis.js — Game Tree 分析

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `scheduleLiveAnalysis` | 4854 | 调度 game tree 实时分析 | `gameTreeAnalysis.js` |

### 7.5 analysisCache.js — 分析缓存

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `getOwnershipCacheKey` | 1072 | 获取所有权缓存键 | `analysisCache.js` |
| 2 | `cacheOwnership` | 1077 | 缓存所有权数据 | `analysisCache.js` |
| 3 | `getCachedOwnership` | 1083 | 获取缓存的所有权 | `analysisCache.js` |
| 4 | `cacheScratchOwnership` | 1088 | 缓存草稿所有权 | `analysisCache.js` |
| 5 | `getCachedScratchOwnership` | 1094 | 获取缓存的草稿所有权 | `analysisCache.js` |
| 6 | `cachePreviewOwnership` | 1099 | 缓存预览所有权 | `analysisCache.js` |
| 7 | `getCachedPreviewOwnership` | 1105 | 获取缓存的预览所有权 | `analysisCache.js` |
| 8 | `getCurrentOwnership` | 1112 | 获取当前所有权 | `analysisCache.js` |
| 9 | `getOwnershipForTreePosition` | 2504 | 获取指定树位置的所有权 | `analysisCache.js` |

---

## 8. engine/ — 引擎服务

目标文件：`engineService.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `attachEngines` | 4269 | 附加一个或多个引擎 | `engineService.js` |
| 2 | `detachEngines` | 4515 | 分离引擎 | `engineService.js` |
| 3 | `syncEngine` | 4555 | 同步引擎到指定棋局位置 | `engineService.js` |
| 4 | `generateMove` | 4593 | 使用引擎生成一手棋 | `engineService.js` |
| 5 | `startEngineGame` | 4754 | 启动引擎对战 | `engineService.js` |
| 6 | `stopEngineGame` | 4820 | 停止引擎对战 | `engineService.js` |
| 7 | `startStopEngineGame` | 4834 | 切换引擎对战状态 | `engineService.js` |
| 8 | `getAnalyzeCommand` | 1944 | 获取分析命令名称 | `engineService.js` |
| 9 | `engineSupportsOwnership` | 1951 | 检查引擎是否支持所有权分析 | `engineService.js` |
| 10 | `getAnalysisVisitLimit` | 2088 | 获取分析访问次数限制 | `engineService.js` |
| 11 | `getAnalysisMaxTime` | 2098 | 获取分析最大时间 | `engineService.js` |
| 12 | `getGenmoveAnalyzeCommand` | 2105 | 获取 genmove 分析命令 | `engineService.js` |
| 13 | `buildAnalyzeArgs` | 2111 | 构建分析命令参数 | `engineService.js` |
| 14 | `buildGenmoveAnalyzeArgs` | 2147 | 构建 genmove 分析参数 | `engineService.js` |
| 15 | `configureKataAnalysis` | 2008 | 配置 KataGo 分析参数 | `engineService.js` |
| 16 | `prepareAnalysis` | 2169 | 准备分析（配置引擎） | `engineService.js` |
| 17 | `prepareHumanSL` | 2163 | 准备 HumanSL 功能 | `engineService.js` |
| 18 | `updateHumanSLStateFromSyncer` | 1956 | 从同步器更新 HumanSL 状态 | `engineService.js` |
| 19 | `detectHumanSL` | 1976 | 检测引擎 HumanSL 支持 | `engineService.js` |
| 20 | `setHumanSLProfile` | 1987 | 设置 HumanSL 配置文件 | `engineService.js` |
| 21 | `refreshHumanSLAnalysis` | 2002 | 刷新 HumanSL 分析 | `engineService.js` |
| 22 | `addEngineLogEntry` | 4196 | 添加引擎日志条目 | `engineService.js` |
| 23 | `handleCommandSent` | 4215 | 处理引擎命令发送事件 | `engineService.js` |

### 引擎配置辅助

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `normalizeEngineConfig` | 2654 | 规范化引擎配置 | `engineService.js` |
| 2 | `getConfiguredEngine` | 2691 | 获取配置的引擎 | `engineService.js` |
| 3 | `getOrAttachEngine` | 2697 | 获取或附加引擎 | `engineService.js` |
| 4 | `waitForEngineCommands` | 1312 | 等待引擎命令可用 | `engineService.js` |

### 引擎游戏启动

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `startConfiguredGame` | 2716 | 启动配置好的游戏（含引擎） | `engineService.js`（或 facade 协调） |

---

## 9. training/ — 训练会话

目标文件：`trainingStore.ts`、`recallSession.js`、`problemSession.js`、`reviewSession.js`

### 9.1 recallSession.js — 回忆会话

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `startRecallSession` | 602 | 启动回忆会话 | `recallSession.js` |
| 2 | `endRecallSession` | 627 | 结束回忆会话 | `recallSession.js` |
| 3 | `handleRecallMove` | 606 | 处理回忆落子（比对答案） | → `recallInteractionExecutor.js`（见 §2.4） |
| 4 | `recallNavigateNext` | 610 | 回忆导航下一步 | `recallSession.js` |
| 5 | `checkRecallComplete` | 620 | 检查回忆是否完成 | `recallSession.js` |
| 6 | `skipRecallMove` | 631 | 跳过当前回忆 | `recallSession.js` |
| 7 | `showRecallHint` | 635 | 显示回忆提示 | `recallSession.js` |
| 8 | `getTrainingStore` | 1365 | 获取训练存储实例 | `trainingStore.ts` |
| 9 | `getPlayServices` | 1376 | 获取游戏服务（训练用） | `trainingStore.ts` |
| 10 | `saveCurrentGame` | 639 | 保存当前游戏（训练后触发） | `trainingStore.ts` 或 `document/sgfWriteback.js` |

### 9.2 problemSession.js — 问题/题目会话

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `startProblem` | 696 | 启动问题模式 | `problemSession.js` |
| 2 | `submitProblemAttempt` | 841 | 提交问题尝试 | `problemSession.js` |
| 3 | `generatePunishmentProblem` | 934 | 生成惩罚题目 | `problemSession.js` |
| 4 | `undoProblemMove` | 971 | 撤销问题落子 | `problemSession.js` |
| 5 | `exitProblemMode` | 1001 | 退出问题模式 | `problemSession.js` |

### 9.3 reviewSession.js — 复习会话

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `startReviewSession` | 1013 | 启动复习会话 | `reviewSession.js` |
| 2 | `advanceReview` | 1029 | 前进到下一个复习项目 | `reviewSession.js` |

---

## 10. overlays/ — Overlay 可见性与合成

目标文件：`overlayStore.ts`、`overlayLayers.ts`、`resolveOverlayInput.js`、`composeWorkbenchOverlays.js`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `setTerritoryEnabled` | 2414 | 设置领地显示启用 | `overlayStore.ts` |
| 2 | `toggleTerritoryEnabled` | 2450 | 切换领地显示 | `overlayStore.ts` |
| 3 | `setTerritoryCompareEnabled` | 2454 | 设置领地对比启用 | `overlayStore.ts` |
| 4 | `toggleTerritoryCompareEnabled` | 2486 | 切换领地对比 | `overlayStore.ts` |
| 5 | `setOverlayMode` | 2492 | 设置 overlay 模式 | `overlayStore.ts` |
| 6 | `getTerritoryCompareAvailable` | 1150 | 检查领地对比是否可用 | `overlayStore.ts` 或 `resolveOverlayInput.js` |

---

## 11. ui/ — UI 状态

目标文件：`uiStore.ts`

| # | 函数名 | 行号 | 用途 | 目标文件 |
| --- | --- | --- | --- | --- |
| 1 | `openDrawer` | 592 | 打开抽屉界面 | `uiStore.ts` |
| 2 | `closeDrawer` | 596 | 关闭抽屉界面 | `uiStore.ts` |
| 3 | `setBusy` | 1043 | 设置忙碌状态 | `uiStore.ts` |
| 4 | `showInfoOverlay` | 1048 | 显示信息覆盖层 | `uiStore.ts` |
| 5 | `hideInfoOverlay` | 1055 | 隐藏信息覆盖层 | `uiStore.ts` |
| 6 | `flashInfoOverlay` | 1059 | 闪烁信息覆盖层 | `uiStore.ts` |
| 7 | `clearConsole` | 1068 | 清空控制台日志 | `uiStore.ts` |
| 8 | `setBoardTransformation` | 5170 | 设置棋盘变换 | `uiStore.ts` |
| 9 | `pushBoardTransformation` | 5176 | 叠加棋盘变换 | `uiStore.ts` |

---

## 12. sabaki.js (facade/coordinator) — 保留入口

这些函数在迁移完成后仍保留在 `sabaki.js` 中，作为应用级协调器和遗留门面：

| # | 函数名 | 行号 | 用途 | 保留原因 |
| --- | --- | --- | --- | --- |
| 1 | `constructor` | 84 | 应用初始化、模块装配 | App lifecycle |
| 2 | `_initAppInfo` | 289 | 初始化应用信息 | App lifecycle |
| 3 | `_setupWindowStateSync` | 294 | 窗口状态同步 | App lifecycle |
| 4 | `setState` | 314 | 更新状态并触发 change 事件 | 顶层状态协调 |
| 5 | `getInferredState` | 324 | 获取推断状态（计算属性聚合） | 顶层状态聚合 |
| 6 | `inferredState` (getter) | 409 | 推断状态 getter | 顶层状态聚合 |
| 7 | `updateSettingState` | 413 | 根据设置键更新状态 | 设置协调 |
| 8 | `waitForRender` | 445 | 等待渲染完成 | App lifecycle |
| 9 | `getPlayer` | 5211 | 获取当前行棋方 | 薄查询，可迁入 document |
| 10 | `openNodeMenu` | 5742 | 打开节点菜单 | UI 命令门面 |
| 11 | `openCommentMenu` | 5788 | 打开注释菜单 | UI 命令门面 |
| 12 | `openVariationMenu` | 5875 | 打开变化菜单 | UI 命令门面 |
| 13 | `openEnginesMenu` | 5930 | 打开引擎菜单 | UI 命令门面 |
| 14 | `openEngineActionMenu` | 5955 | 打开引擎操作菜单 | UI 命令门面 |
| 15 | `recordHistory` | 2530 | 记录历史状态 | → `documentStore.ts`（长期迁出） |
| 16 | `clearHistory` | 2571 | 清空历史 | → `documentStore.ts` |
| 17 | `checkoutHistory` | 2576 | 检出历史 | → `documentStore.ts` |
| 18 | `undo` | 2594 | 撤销 | → `documentStore.ts` |
| 19 | `redo` | 2602 | 重做 | → `documentStore.ts` |

**说明**：菜单函数（`openNodeMenu` 等）长期可迁入 `ui/`，但迁移期保留在 facade。
历史函数（`recordHistory` 等）应在 documentStore 就绪后迁出。

---

## 13. 跨模块/未分类

以下函数涉及多个模块职责，需要进一步拆解：

| # | 函数名 | 行号 | 用途 | 拆解说明 |
| --- | --- | --- | --- | --- |
| 1 | `clickVertex` | 3247 | 棋盘点击总入口 | 拆为：resolver 路由（→ board-interactions）+ 各 executor 调用 |
| 2 | `useTool` | 3714 | 编辑工具使用 | 拆为：marker（→ workingPositionMarkers）+ line（→ workingPositionLines）+ executor 调用 |
| 3 | `scratchEdit` | 1513 | 草稿编辑核心 | 拆为：board 操作（→ workingPositionBoard）+ marker（→ workingPositionMarkers）+ executor 协调 |
| 4 | `makeMove` | 3550 | 落子核心逻辑 | 拆为：game tree 写入（→ gameTreeWrites）+ 分析触发（→ analysisService）+ executor 协调 |
| 5 | `setCurrentTreePosition` | 3919 | 设置当前树位置 | 拆为：导航（→ documentStore）+ 编辑工作区同步（→ workingPosition）+ 分析调度（→ analysisService） |
| 6 | `startConfiguredGame` | 2716 | 启动配置游戏 | 拆为：引擎装配（→ engineService）+ 文件创建（→ documentStore）+ 游戏循环（→ engineService） |

---

## 迁移优先级建议

当前代码已经推进到 Phase 10 收尾、Phase 11 开始；`sabaki.js` 中也已经接入
`documentStore`、`engineService`、`analysisService`、`trainingStore` 等 facade。因此后续
不应再按原先的粗粒度 Phase 12 一次性“presets + legacy 清理”收尾，而应拆成几条明确的
服务所有权迁移线。

1. **Phase 1-9（已基本完成）**：contracts、working-position helpers、board-interaction
   resolver/executor、scratch/play/recall 初步服务边界。
2. **Phase 10（收尾）**：继续把 analysis state、cache、request lifecycle、SGF write-back
   从 `sabaki.js` 迁入 `analysisService`，不是只抽 `boardAnalysisContext`。
3. **Phase 11（进行中）**：overlay 输入契约模块化。保留现有 `BoardOverlayStack` 渲染路径，
   先把 territory、compare、heatmap、human preference 的输入、层级、优先级标准化。
4. **Phase 12A：document ownership**：扩展 `documentStore` 接管 `gameTrees`、
   `treePosition`、`gameCurrents`、history、导航、SGF load/save；`sabaki.js` 只保留兼容
   wrapper。`gameTreeWrites.js` 只放纯 game-tree mutation。
5. **Phase 12B：engine ownership**：扩展 `engineService` 接管 attach/detach/sync/genmove、
   engine game、HumanSL 和 GTP log wiring；engine 回调通过 `analysisService`/`documentStore`
   公开入口写入。
6. **Phase 12C：analysis ownership**：迁出 `runBoardAnalysis`、`runOwnershipAnalysis`、
   `startAnalysis`、`stopAnalysis`、`quickAnalyzeAllNodes`、cache/writeback lifecycle，并修正
   play executor 与 engine reply 之间的当前行棋方传递边界。
7. **Phase 12D：workspace presets + uiStore + legacy 冻结**：拆 `setMode` 为 workspace
   preset 选择、UI 副作用和 overlay 默认值；迁出 drawer/busy/info overlay 等 UI-only state；
   `find`、`problem`、`guess`、`scoring` 等 legacy 分支先冻结/包进 legacy executor，再根据
   测试覆盖逐步隐藏和删除入口。

最终目标不是让 `sabaki.js` 变成零函数，而是只保留 app lifecycle、service 装配、顶层
`setState`/`inferredState`、菜单门面和兼容 wrapper。
