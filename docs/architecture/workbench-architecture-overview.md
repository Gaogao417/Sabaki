# Workbench Architecture Overview

本文是 Gabaki / Sabaki 训练工作台的迁移架构文档。它不替代
`position-source-mutation-contract.md`，而是说明如何把当前混在 `mode`、
`sabaki.js` 大分支、棋盘事件、分析状态和 overlay 副作用里的旧架构，逐步收束到
更小、更明确、可替换的边界里。

这份文档的核心目的不是描述一个全新工作台，也不是在旧代码旁边再做一套平行系统。
它要回答的是：哪些旧路径应该冻结，哪些新边界先落地，后续代码如何一段一段迁移到
这些边界后面，直到旧的、隐式的、互相缠绕的分支可以被删除。

## Summary

重构目标不是继续完善一个通用 SGF 编辑器，而是把产品削成围棋训练工作台：

- `play`: 真实对局，落子写入 game tree。
- `problem`: 做题运行态，落子写入 mutable Attempt 和 problem runtime。
- `recall / training`: 训练答题，写入 session / attempt，不自由编辑棋盘。
- `edit / analysis`: 编辑独立棋盘局面并分析，写入 working snapshot，不污染当前 SGF tree。
- `variation analysis`: 棋谱内试变化，写入 game-tree variation 或未来临时 variation。

Workbench mode 仍然是上层主 region，但底层不再让 raw `mode` 决定一切。一次棋盘操作先由
mode orchestration 派生读写边界，再回答两个问题：

- 当前棋盘局面来自哪里？见 `PositionSource`。
- 用户操作允许写到哪里？见 `MutationContract`。

Workspace 只负责默认组合和控件布局；它不能直接成为棋盘读写权限边界。

## Migration Goal

当前架构的主要问题不是缺少功能，而是功能边界被长期堆叠在同一批入口上：

- `mode` 同时决定产品任务、棋盘读源、写入目标、交互语义、overlay 显示和分析刷新。
- `sabaki.js` 里的事件处理同时解释输入、修改 game tree、修改临时编辑状态、触发分析、
  更新 UI 状态。
- analysis、edit、recall、guess、problem、scoring 等路径复用或绕过彼此的 helper，导致
  很难从一个点击判断最终会写到哪里。
- legacy 功能仍然可用，但它们的分支继续影响新工作台设计，使新代码不得不理解旧模式。

迁移目标是用小边界替换大分支，而不是一次性重写：

1. 先定义读写边界：`PositionSource` 和 `MutationContract`。
2. 然后拆出棋盘输入解析：把 click、drag、tool、right click 等输入解析成明确的
   board interaction intent。
3. 最后把旧的 `mode` 分支逐步移动到这些边界后面，剩余无法迁移的路径保留为
   `legacyInteraction`，等待产品决策后删除或重写。

成功标准是：新增 workbench 行为不再写进 `mode` 大分支；任意一个棋盘操作都能从
source、contract、intent 三个层面看清楚“读哪里、写哪里、刷新什么”。

## Architecture Value

这套边界的价值不是消灭 dispatch。棋盘事件最后仍然需要分发到 play、scratch edit、
recall、variation 或 legacy 处理器。真正要改变的是：dispatch 不再是一个中央大函数亲自
理解所有业务，而是变成浅层路由。

现有 `Goban` props 已经是有效的渲染 contract：`signMap`、`markerMap`、`paintMap`、
`analysis` 和事件回调决定棋盘如何显示和把原始输入交给上层。但它们不回答业务状态问题：
这个局面从哪里读、这次操作允许写哪里、写完后由哪个模块负责刷新分析和 overlay。

新的边界补的是这些问题：

- `PositionSource`: 明确当前棋盘读自 game tree 还是 working snapshot。
- `MutationContract`: 明确已接受的动作允许写入 game tree、working position、training
  attempt 或 variation。
- `BoardInteractionIntent`: 明确一次原始输入被解释成什么具体动作，例如 play-stone、
  place-black-stone、erase、drag-stone、submit-recall-answer 或 legacy-toggle-dead-stone。
- Executor module: 真正执行 intent 的模块，拥有对应写入和副作用刷新，而不是把逻辑继续塞回
  `sabaki.clickVertex()`。

因此，目标不是把旧代码：

```js
if (mode === 'play') ...
else if (mode === 'analysis') ...
else if (mode === 'recall') ...
```

换成同样集中的：

```js
switch (mutationContract) ...
```

而是迁移成：

```txt
ModeState / TransitionEffect
  -> derive PositionSource + MutationContract
  -> Goban raw event
  -> boardInteractionResolver
  -> BoardInteractionIntent + PositionSource + MutationContract
  -> play / problem / scratchEdit / recall / variation / legacy executor
  -> owner service write + analysis / overlay effects
```

这使模块边界可以按“谁拥有写入和副作用”来切，而不是按 UI mode 切。一个
`scratchEdit` contract 下可以有多个 intent，但它们都归属于 scratch edit executor；
`recallAnswer` executor 不需要理解摆棋工具；`play` executor 不需要理解 marker、line 或
reference snapshot。legacy 路径也可以被隔离成 fallback executor，等待后续删除。

## Mode Orchestration Layer

[Workbench Mode Orchestration Contract](../design/workbench-mode-orchestration-contract.md)
是运行态状态机的 source of truth。它定义四个 workbench mode：

- `Play`
- `Problem`
- `Recall`
- `Analysis`

这层负责：

- `WorkbenchTab.mode`、`activeAttemptId`、`activeRecallSessionId`、`previousMode` 等 tab 字段。
- `problemView`、`recallView`、`activeCheckpointId`、`pendingMoveEvaluations` 等 runtime
  companion state。
- Attempt mutable/frozen 边界。
- OverlayRegion 和 EngineAnalysisRegion 的进入/退出效果。
- 合法 transition、非法 transition 和污染防护。

底层 `PositionSource` / `MutationContract` 文档不取代状态机；它们是状态机派生出的棋盘读写
边界。新功能必须先经过 mode orchestration，再派生 source/contract。禁止绕过
`workbenchFlowService` 或后续同职责的 `workbenchModeService` 直接 patch store。

`Problem` 有两个层级：

- `Problem` entity / task 是训练业务对象。
- `WorkbenchMode.problem` 是用户正在做题的运行态 mode。

当前代码仍存在 `play + problemView` 的 legacy 双重真相。把 Problem 从 legacy 截获迁成显式
`WorkbenchMode.problem -> problemAttemptMove -> problemInteractionExecutor` 是第一批架构债。

## Replacement Strategy

本重构采用渐进替换策略：

- **Freeze**: 冻结 legacy 入口的产品扩展，只修兼容问题，不把新工作台语义塞回旧模式。
- **Wrap**: 先在旧入口外包一层 contract / resolver，让现有 UI 不必立刻重写。
- **Split**: 把 `sabaki.js` 中的大块事件逻辑拆成按 contract 命名的函数和纯解析函数。
- **Redirect**: 新功能只调用新边界；旧 helper 如果仍然需要，变成实现细节。
- **Delete**: 当某条旧路径已经没有新入口依赖，再删除 legacy 分支和兼容包装。

每一步都应该能单独测试、单独提交，并保持现有用户流程可用。

## Product Direction

### Core Capabilities

核心能力围绕训练和分析：

- 对局练习：正常落子、悔棋、认输、引擎对局、基础分析。
- 回忆训练：从棋谱或题目读取答案，记录正确、错误、提示和跳过。
- 摆棋分析：任意摆黑白子、删除、拖动、设置下一手、引擎分析、保存为题目。
- 变化分析：从当前棋谱节点试变化，并可与实战局面比较。
- Overlay 辅助：territory、territory compare、heatmap、human preference 等可组合显示。

### Legacy Policy

以下功能先冻结或从新工作台中心隐藏，不在新架构里继续扩展：

- `scoring`
- `estimator`
- `find`
- `guess`
- `autoplay`
- 原生 SGF edit 工具

冻结不等于立即删除。第一阶段要求是：新代码不继续扩大这些旧模式的职责，旧入口能保留兼容就保留兼容。

`guess` 与 `recall` 产品语义重叠。长期方向是保留 `recall / training`，`guess` 作为 legacy 冻结，等待 recall 稳定后再决定删除或迁移。

## Architecture Layers

### 1. Position Source

`PositionSource` 是棋盘读来源：

- `game-tree`: 从当前 SGF game tree node 读局面。
- `scratch`: 从临时 snapshot 读局面，默认不污染 SGF tree。

设计细节以 [Position Source and Mutation Contract](position-source-mutation-contract.md)
为准。全景层只要求所有棋盘渲染、分析、overlay 和交互都能明确拿到当前 source。

### 2. Working Position

`edit / analysis` 的核心数据是 working position。它应沿用现有 snapshot 的
`signMap` 形状，而不是新建一套 `stones[]` 主结构。

最小字段：

```ts
type WorkingPosition = {
  id: string
  width: number
  height: number
  signMap: number[][]
  nextPlayer: 1 | -1
  role?: 'current' | 'reference' | 'problem-attempt'
  komi?: number
  rules?: string
  source?: {
    type: 'game-tree-node' | 'manual' | 'problem'
    id?: string
  }
}
```

原因：

- 兼容 `study.js` 里的 snapshot helper。
- 兼容 `boardFromSnapshot` / `snapshotToGameTree`。
- 兼容现有 engine analysis 和 overlay 输入。
- 能直接表达 current / reference / problem attempt 等角色。

命名约定：

- 产品和架构文档中使用 `edit`、`scratchEdit`、`working position`。
- 现有代码里仍有 `scratch` / `editWorkspace` 命名，这是迁移遗留名；后续替换旧路径时再逐步重命名。
- `scratch` 不应继续作为用户可见或新架构主概念扩散。

### 3. Mutation Contract

`MutationContract` 是棋盘写权限：

- `playMove`: 写 game tree、写 history、更新当前行棋方、触发正常对局分析。
- `problemAttemptMove`: 写 mutable problem Attempt、problem runtime 和 evaluation handoff。
- `scratchEdit`: 只写 working position，可触发分析，可保存为题目。
- `recallAnswer`: 只写 RecallSession / RecallAttempt，不自由编辑局面。
- `variationMove`: 写 game-tree variation，或未来写临时 variation。

关键原则：

- Overlay 不写棋局。
- Workspace 不直接写棋局。
- Scratch edit 不写当前 SGF tree。
- Recall answer 不复用 play move 的写路径。
- Variation move 不复用 scratch edit 的写路径。

### 4. Board Interaction

棋盘交互层只负责把用户输入转成对应 contract 的 action。它是替换旧 `clickVertex`
大分支的关键中间层。

目标拆分：

- `playInteraction`: 点击空点就是真实落子。
- `problemAttemptInteraction`: 点击空点是做题落子，写 Attempt 和 problem runtime。
- `editInteraction`: 摆黑、摆白、删除、拖动、设置下一手。
- `recallAnswerInteraction`: 点击候选点，检查答案并记录尝试。
- `variationInteraction`: 从 game-tree node 试变化。
- `legacyInteraction`: 暂时承接 scoring / estimator / find / guess / autoplay。

验收标准是：看一个 interaction 就能知道它写哪里，不能再靠大段 `mode`
分支推断副作用。

这里保留两个概念：

- `BoardInteractionIntent`: 一次原始棋盘输入被解释成的具体意图，例如落子、摆黑、
  擦除、提交 recall 答案、打开候选点菜单或 legacy 死子切换。
- `MutationContract`: 这个 intent 被接受后允许写入的状态边界，例如 game tree、
  working position、training attempt 或 variation。

不要再引入独立的提交后更新管线抽象。刷新 analysis、overlay 或 UI
状态应当留在具体 executor 中，或者由 executor 返回明确 effects；否则它只会变成新的
dispatch key。一个 `scratchEdit` mutation contract 下面会有多个 intent，例如
place-stone、erase、drag-stone、mark-point、draw-line。这样才能替换旧交互逻辑，同时
避免把 contract 扩成新的巨型 mode 枚举。

建议模块边界：

- `boardInteractionResolver`: 纯解析层。输入 state 摘要、棋盘事件、当前工具、棋盘点状态；
  输出 intent、position source、mutation contract，或者明确的 legacy/deferred intent。
  它不写 state、不弹菜单、不触发 analysis。
- `playInteractionExecutor`: 只处理真实对局落子、悔棋相关的 game-tree 写入和对局分析刷新。
- `problemInteractionExecutor`: 只处理做题落子、Attempt mutable write、ProblemView、
  MoveEvaluation / BadMove handoff 和 submit 前运行态。
- `scratchEditInteractionExecutor`: 只处理 working position、marker、line、next player、
  reference snapshot 和 scratch analysis 刷新。
- `recallInteractionExecutor`: 只处理答案提交、RecallAttempt / RecallSession、提示、跳过和进度推进。
- `variationInteractionExecutor`: 只处理从 game-tree position 出发的变化写入或未来临时变化。
- `legacyInteractionExecutor`: 暂时包住 scoring、estimator、find、guess、autoplay 和原生 SGF
  edit 等未迁移路径。
- `sabaki.js`: 迁移期暂时保留协调入口，负责调用 resolver、选择 executor、
  提供必要服务和提交 executor 返回的 effects；目标是逐步把 state ownership 下沉到领域模块。

#### Sabaki Boundary Target

`sabaki.js` 当前可以继续作为过渡协调者，但它的长期职责应该收敛为 app-level coordinator /
legacy facade：

- app lifecycle、settings、window 和 top-level command facade。
- workbench、document、analysis、engine、training、overlay 等模块的装配入口。
- legacy compatibility：承接未迁移路径，隔离旧 mode 分支，保持旧行为可用。

它不应继续作为 analysis、engine、document、training、overlay 的长期业务 owner。新的
workbench 行为默认写入对应领域模块；如果迁移期必须从 `sabaki.js` 进入，也应只把它当成
facade，把状态写入、cache、request lifecycle 和 write-back 规则留在领域模块里。

拆分时应优先迁移一个小闭环，例如 analysis workspace 下的
`stone_1`、`stone_-1`、`eraser` 和 `play` 四个 intent。这个闭环能从
`clickVertex()` 移到 resolver + scratch edit executor 后，再扩展 marker、line、drag 和
reference 相关 intent。

建议目标文件夹规划：

```txt
src/modules/
  position-contracts.ts        # migration compatibility entry; may re-export workbench contracts

  workbench/
    contracts/
      positionSource.ts
      mutationContracts.ts
      workspaceDefaults.ts
      index.ts

    board-interactions/
      intents.ts
      resolveBoardInteraction.ts
      createBoardInteractionContext.js
      executeBoardInteraction.js

      executors/
        playInteractionExecutor.js
        problemInteractionExecutor.js
        scratchEditInteractionExecutor.js
        recallInteractionExecutor.js
        variationInteractionExecutor.js
        legacyInteractionExecutor.js

    working-position/
      workingPosition.js
      workingPositionBoard.js
      workingPositionMarkers.js
      workingPositionLines.js

    presets/
      workspacePresets.ts

    stores/
      workbenchStore.ts

  document/
    documentStore.ts
    gameTreeWrites.js
    sgfWriteback.js

  analysis/
    analysisService.js
    boardAnalysisContext.js
    scratchAnalysis.js
    gameTreeAnalysis.js
    analysisCache.js

  engine/
    engineService.js

  training/
    trainingStore.ts
    recallSession.js
    problemSession.js
    reviewSession.js

  overlays/
    overlayStore.ts
    overlayLayers.ts
    resolveOverlayInput.js
    composeWorkbenchOverlays.js

  ui/
    uiStore.ts
```

文件夹职责：

- `workbench/`: 工作台任务层，只拥有 workspace default、棋盘输入解释、executor 路由、
  working position helper 和 workbench 自己的 UI/task 状态。它不是 analysis、engine、
  training 或 overlay 的父包。
- `workbench/contracts/`: 只放纯定义和纯映射，不碰 UI、不写 state。现有
  `src/modules/position-contracts.ts` 可以先保留为兼容入口，并从这里 re-export，或在迁移稳定后
  拆入 `positionSource.ts`、`mutationContracts.ts` 和 `workspaceDefaults.ts`。
- `workbench/board-interactions/`: 拆 `sabaki.clickVertex()` 的主入口。resolver 解释原始输入，
  `executeBoardInteraction.js` 做很薄的 executor 路由，具体写入放进 `executors/`。
- `workbench/working-position/`: 收纳 `editWorkspace.currentSnapshot` /
  `editWorkspace.referenceSnapshot` 相关操作，包括 clone/create、snapshot 与 board 互转、
  摆子提子、marker map 和 line/arrow 操作。
- `workbench/presets/`: 收纳 workspace-level 默认组合，例如默认 source、contract、
  overlay preset 和工具栏 preset；它只选择默认值，不拥有底层写权限。
- `workbench/stores/`: 收纳 `workbenchStore`，拥有 WorkbenchTab、mode、previousMode、
  active ids、workspace kind、`editWorkspace`、selected tools 和 working positions。
- `document/`: 拥有 game tree、tree position、history 和 SGF 写入边界。play executor
  写真实棋谱时调用这里，而不是直接改 `sabaki.state.gameTrees`。
- `analysis/`: 回答“当前分析对象是什么”。`boardAnalysisContext.js` 是现有
  `getBoardAnalysisContext()` 的归宿；`scratchAnalysis.js` 负责 working position 转临时
  game tree 并调 engine；`gameTreeAnalysis.js` 负责当前 game tree / variation analysis。
  迁移期如果已有 `src/modules/workbench/analysis/`，它只能作为临时 shim，目标位置是
  `src/modules/analysis/`。
- `engine/`: 包住 engine attach、detach、sync、analyze 和 genmove。现有
  `enginesyncer.js` 可以先被这里包装，不要求一次性搬文件。
- `training/`: 拥有 recall / problem / review session、attempt、problem runtime projection 和
  progress。problem/recall executor 写这里，而不是复用 play move 或 scratch edit 写路径。
- `overlays/`: 沿用现有 `src/modules/overlays` 作为 overlay 领域模块，不放在
  `workbench/` 下面。它从 `PositionSource + analysis + ownership` 派生 overlay 输入，
  内部仍可调用现有 overlay helper。
- `ui/`: 放 drawers、sidebars、layout、status overlays 等非领域 UI 状态；它不拥有棋局、
  analysis、engine 或训练状态。

具体文件职责：

- `workbench/contracts/positionSource.ts`: 定义 `PositionSource`，创建 `game-tree` 和 `scratch`
  source，提供从当前 state 派生 active source 的纯 helper。
- `workbench/contracts/mutationContracts.ts`: 定义 `playMove`、`problemAttemptMove`、
  `scratchEdit`、`recallAnswer`、`variationMove` 以及 contract 判断 helper。
- `workbench/contracts/workspaceDefaults.ts`: 保留 `mode/workspace -> default source/contract`
  的兼容映射。
- `workbench/board-interactions/intents.ts`: 定义 `play-stone`、`place-black-stone`、
  `place-white-stone`、`erase-stone`、`drag-stone`、`mark-point`、`draw-line`、
  `submit-problem-move`、`submit-recall-answer`、`open-variation-menu`、`save-as-problem` 以及 legacy fallback
  intents（`legacy-toggle-dead-stones`、`legacy-find-move`、`legacy-guess-move`、
  `legacy-problem-move`、`legacy-sgf-edit`、`legacy-analysis-fallback`、
  `legacy-autoplay`、`legacy-play-right-click`）等 intent。
- `workbench/board-interactions/resolveBoardInteraction.ts`: 纯 resolver。输入 state 摘要、棋盘事件、
  当前工具和棋盘点状态；输出 intent、position source、mutation contract。
- `workbench/board-interactions/createBoardInteractionContext.js`: 从 `sabaki.state`、`inferredState`、
  `documentStore`、`workbenchStore` 和 board snapshot 组装 executor 需要的上下文。
- `workbench/board-interactions/executeBoardInteraction.js`: 只根据 resolver 结果选择 executor，
  不承载业务分支。
- `workbench/board-interactions/executors/playInteractionExecutor.js`: 正式落子、game-tree 写入、
  对局 analysis / engine move；真实写入委托给 `documentStore` 和 `analysisService`。
- `workbench/board-interactions/executors/problemInteractionExecutor.js`: 做题落子、problem
  runtime 更新、mutable Attempt 写入、pending evaluation 和 BadMove handoff；写入委托给
  training problem services，不能写 RecallSession 或 frozen Attempt。
- `workbench/board-interactions/executors/scratchEditInteractionExecutor.js`: 摆棋、擦除、拖动、
  marker、line、next player、reference snapshot 和 scratch analysis；working position 写入委托给
  `workbenchStore`，分析委托给 `analysisService`。
- `workbench/board-interactions/executors/recallInteractionExecutor.js`: 答案提交、正确/错误/提示/
  跳过、session / attempt 进度；写入委托给 `trainingStore`。
- `workbench/board-interactions/executors/variationInteractionExecutor.js`: 棋谱内试变化，
  未来可切到临时 variation；写入边界由 `documentStore` 或未来 variation owner 决定。
- `workbench/board-interactions/executors/legacyInteractionExecutor.js`: scoring、estimator、
  find、guess、autoplay、原生 SGF
  edit 的兼容包裹层，不承接新的 workbench 行为。
- `workbench/working-position/workingPosition.js`: working position 的 create/clone/metadata helper。
- `workbench/working-position/workingPositionBoard.js`: working position 与 board 的互转、落子、
  提子、擦除。
- `workbench/working-position/workingPositionMarkers.js`: marker map 的添加、删除、toggle、
  label/number 操作。
- `workbench/working-position/workingPositionLines.js`: line/arrow 的创建、删除和序列化。
- `workbench/stores/workbenchStore.ts`: workspace kind、`editWorkspace`、selected tools、
  current/reference working positions 的唯一 owner。
- `document/documentStore.ts`: `gameTrees`、`treePosition`、history 和 SGF write-back 的唯一 owner。
- `document/gameTreeWrites.js`: play move、undo/redo、variation write 等 game-tree mutation helper。
- `document/sgfWriteback.js`: 从 document state 写回 SGF properties / file payload 的边界。
- `analysis/analysisService.js`: 统一 analysis request lifecycle、取消/重启、cache lookup、
  ownership cache 和结果提交。
- `analysis/boardAnalysisContext.js`: 从 active source 生成 engine 可分析的 tree/context。
- `analysis/scratchAnalysis.js`: working position analysis 的调度、结果写回和 ownership 缓存。
- `analysis/gameTreeAnalysis.js`: 当前 game tree 和 variation analysis 的调度入口。
- `engine/engineService.js`: engine attach/detach/sync/analyze/genmove 的 facade，内部可包装
  现有 engine helper。
- `training/trainingStore.ts`: recall/problem/review session、attempt、problem runtime projection 和 progress 的唯一 owner。
- `overlays/overlayStore.ts`: territory/compare/heatmap visibility 与 overlay input state。
- `overlays/overlayLayers.ts`: overlay layer contract 和 layer id/source/render mode 常量。
- `overlays/resolveOverlayInput.js`: 从 source、analysis、ownership、reference 派生 overlay input。
- `overlays/composeWorkbenchOverlays.js`: workbench overlay 组合入口，内部复用现有 overlay modules。
- `ui/uiStore.ts`: drawers、sidebars、layout、status overlays 等 UI-only state。

### State Ownership Target

长期 state ownership 应按领域拆开，而不是继续堆回 `sabaki.js`：

- `documentStore`: 拥有 `gameTrees`、`treePosition`、history 和 SGF 写入。
- `workbenchStore`: 拥有 WorkbenchTab、mode、previousMode、active ids、workspace kind、
  `editWorkspace`、selected tools 和 working positions。
- `analysisService`: 拥有 scratch / game-tree / variation analysis request lifecycle、
  ownership cache 和 write-back boundary。
- `engineService`: 拥有 engine attach、detach、sync、analyze 和 genmove。
- `trainingStore`: 拥有 recall / problem / review session、attempt、problem runtime projection 和 progress。
- `overlayStore`: 拥有 territory / compare / heatmap visibility 与 overlay input。
- `uiStore`: 拥有 drawers、sidebars、layout 和 status overlays。

迁移期可以保留 `sabaki.js` 对这些模块的 facade 调用，但新增状态切片应优先进入上述 owner。
如果某个切片暂时仍在 `sabaki.state`，对应 phase 需要记录迁出目标，避免后续重构把 analysis、
engine、training 或 overlay 状态重新塞回主文件。

### 5. Analysis

Analysis 必须分成两类：

Analysis 是 executor / service effect，不是棋盘输入 intent。`BoardInteractionIntent`
只表达用户输入意图，例如落子、摆子、擦除、拖动、提交答案或打开菜单；它不应该出现
`start-analysis`、`refresh-analysis`、`run-engine-analysis` 这类把执行副作用塞回 intent
枚举的项。某个 intent 被 executor 接受后，executor 可以调用 `analysisService` 或具体
analysis module 触发分析，但分析调度和结果写回不属于 resolver。

Scratch analysis 的运行时调度应从 `sabaki.js` 迁到 `src/modules/analysis/scratchAnalysis.js`。
`sabaki.js` 在迁移期只传入依赖，例如当前 working position、engine facade、settings 和
提交结果的回调；request lifecycle、cache key、ownership cache、取消/重启策略以及写回边界
由 scratch analysis service 拥有。

#### Edit Analysis

用于摆棋、讲棋、生成题目。

- `PositionSource = scratch`
- `MutationContract = scratchEdit`
- 分析对象是 working position。
- 分析结果可用于 overlay、侧栏、题目保存。
- 不修改当前 SGF tree。

#### Variation Analysis

用于棋谱内试变化。

- `PositionSource = game-tree`
- `MutationContract = variationMove`
- 分析对象是当前 game-tree position 或 variation position。
- 可以和实战主线、reference snapshot 或上一手 ownership 比较。

第一阶段优先稳定 edit analysis；variation analysis 先保留 contract 和入口语义，避免过早扩大重构面。

### 6. Overlay Composition

Overlay 不重写。现有 `BoardOverlayStack`、`paintMap`、`markerMap`、
`composeMarkerMaps` 仍是优先实现路径。

需要补的是 composition contract：

```ts
type OverlayLayer = {
  id: string
  priority: number
  opacity: number
  hitTest: boolean
  source: 'ownership' | 'territoryDiff' | 'heatmap' | 'humanPreference'
  renderMode: 'paint' | 'marker' | 'tooltip' | 'sidebar'
}
```

必须明确：

- 谁是主视觉 paint layer。
- 谁只能做 marker。
- 谁只能进 tooltip 或 sidebar。
- 多个 paint layer 同时开启时按什么优先级和透明度合成。
- hover / hit test 读取哪个 layer 的语义。

Overlay 输入来自 `PositionSource` 派生出的 board、ownership、diff、analysis
metadata。Overlay 不能直接修改 board、game tree 或 working position。

### 7. Workspace

Workspace 是任务层，只负责编排默认组合：

| Workspace | Position source | Mutation contract | Default overlay | Main controls |
| --- | --- | --- | --- | --- |
| Play | `game-tree` | `playMove` | Minimal | 新对局、悔棋、认输、引擎 |
| Problem | `game-tree` or `scratch/problem-attempt` | `problemAttemptMove` | Hidden / problem hints | 提示、悔棋、提交、坏棋反馈 |
| Recall | `game-tree` or `scratch/problem-attempt` | `recallAnswer` | Hidden | 提示、跳过、进度、结束 |
| Edit Analysis | `scratch/current` | `scratchEdit` | Territory / ownership | 摆黑、摆白、删除、下一手、保存题目 |
| Variation Analysis | `game-tree` | `variationMove` | Compare / territory | 候选点、变化树、回到实战、snapshot |

Workspace 可以设置默认值，但不拥有底层写权限。

## Data Flow

### Play Move

```txt
User click
  -> playInteraction
  -> playMove contract
  -> game tree mutation
  -> history
  -> board render
  -> engine analysis / overlay refresh
```

### Problem Attempt Move

```txt
User click
  -> problemAttemptInteraction
  -> problemAttemptMove contract
  -> problem runtime + mutable Attempt write
  -> pending MoveEvaluation / BadMove handoff
  -> board render
  -> submit transition freezes Attempt and enters Recall
```

### Scratch Edit

```txt
User click or drag
  -> editInteraction
  -> scratchEdit contract
  -> working position mutation
  -> edit board render
  -> edit engine analysis
  -> overlay refresh
  -> optional save as problem
```

### Recall Answer

```txt
User click
  -> recallAnswerInteraction
  -> recallAnswer contract
  -> compare with expected move
  -> write attempt/session
  -> advance, hint, wrong state, or completion
```

### Overlay Render

```txt
PositionSource
  -> board + analysis + ownership + marker data
  -> overlay composition
  -> paintMap / markerMap / tooltip / sidebar
  -> Goban render
```

## Implementation Roadmap

### Phase 0: Baseline and Freeze Legacy Direction

- Treat the current mixed `mode` dispatch as the legacy baseline to be migrated.
- Document that scoring, estimator, find, guess, autoplay, and native SGF edit are legacy.
- Keep old behavior compatible where practical.
- Stop adding new workbench behavior to legacy mode branches.
- Require every new workbench behavior to state its `ModeState` / transition effect first,
  then its derived `PositionSource`, `MutationContract`, and `BoardInteractionIntent`.
- Use [Workbench Coding Conduct](../guides/workbench-coding-conduct.md) as the
  implementation gate.
- Use [Workbench Phase 0 Behavior Baseline Tests](workbench-phase0-behavior-baseline-tests.md)
  and [Workbench Test Writing Conduct](workbench-test-writing-conduct.md) as the testing gate.

### Phase 1: Stabilize Contracts

- Keep `src/modules/position-contracts.ts` as the shared contract module for now.
- If `src/modules/workbench/contracts/` is introduced, re-export or wrap the existing
  helpers first instead of moving imports across the codebase in one large patch.
- Ensure `sabaki.js` can expose the active `PositionSource` and `MutationContract`.
- Map the current workspace or mode to the default source and contract:
  `play -> game-tree + playMove`,
  `problem -> game-tree/problem-attempt + problemAttemptMove`,
  `recall -> game-tree/problem-attempt + recallAnswer`,
  `analysis/edit -> scratch/current + scratchEdit`,
  `variation-analysis -> game-tree + variationMove`,
  and unmigrated modes to legacy or null.
- Add tests for workspace-to-contract and state-to-source mapping.
- Do not change board-click behavior in this phase.

### Phase 2: Promote Working Position Helpers

- Introduce `src/modules/workbench/working-position/` as a wrapper around the existing
  snapshot shape used by `editWorkspace.currentSnapshot` and `referenceSnapshot`.
- Keep `signMap` as the primary board data shape so the helpers remain compatible with
  `study.js`, `boardFromSnapshot`, `snapshotToGameTree`, engine analysis, and overlays.
- Add focused helpers for create, clone, snapshot-to-board, board-to-snapshot,
  place black, place white, erase, and set next player.
- Keep marker, line, drag, reference snapshot, and save-problem helpers for later phases.
- Add tests proving working positions can be mutated and rendered without touching the
  current SGF tree.

### Phase 3: Introduce Board Interaction Resolver in Shadow Mode

- Create the initial `src/modules/workbench/board-interactions/` files:
  `intents.ts`, `resolveBoardInteraction.ts`, and `createBoardInteractionContext.js`.
- Add a pure resolver that receives a compact state/workspace summary, board event,
  selected tool, point state, active `PositionSource`, and active `MutationContract`.
- Return `BoardInteractionIntent`, `PositionSource`, `MutationContract`, and, when needed,
  an explicit legacy or deferred reason.
- Keep the resolver side-effect free: no state writes, no menus, no analysis refresh,
  and no dependency on a global interaction state.
- Do not route live behavior through the resolver yet. Use tests, and optionally
  debug-only observation, to compare what the resolver would do.
- Add matrix tests for workspace or mode, tool, mouse button, modifiers, empty/occupied
  point state, expected intent, source, and contract.

### Phase 4: Build the First Scratch Edit Executor

- Add `executeBoardInteraction.js` only as a thin router and create
  `executors/scratchEditInteractionExecutor.js`.
- Migrate only the smallest edit-analysis loop first:
  `stone_1`, `stone_-1`, `eraser`, and `play` as next-player placement if the current
  tool semantics require it.
- Formalize the executor input as `ScratchEditExecutionContext` with a pure helper
  `createScratchEditExecutionContext()` so Phase 5 wiring does not need to hand-assemble
  objects in `sabaki.clickVertex()`.
- The context carries: `activeTab` (`current`/`reference`), `currentSnapshot` and
  `referenceSnapshot`, `currentMarkerMap` and `referenceMarkerMap`, `currentLines` and
  `referenceLines`, `lineFirstVertex` for two-click line drawing state, plus
  `positionSource` and `mutationContract` derived from state.
- The executor returns a structured effect instead of mutating state directly:

  ```ts
  type ScratchEditEffect = {
    handled: boolean      // executor recognized the intent
    changed: boolean      // state was actually modified
    reason?: string       // why an operation was skipped
    tab?: string          // which tab was affected
    snapshot?: object     // updated working position
    markerMap?: MarkerCell[][]
    lines?: LineEntry[]
    lineFirstVertex?: {type: string, vertex: number[]} | null
    newTab?: string       // for tab switching
    capturedSnapshot?: object  // for reference capture
  }
  ```

- The distinction between `handled` (executor recognized the intent) and `changed`
  (state was actually modified) lets the router distinguish "routed correctly but
  no-op" from "fell through to wrong executor".
- The scratch edit executor may update working positions through `workbenchStore` and
  trigger scratch analysis through `analysisService`.
- It must not write game tree nodes, SGF properties, real move history, variation state,
  or recall session state.
- Verify edit-analysis placement/removal works, the displayed board comes from the
  working position, and the current SGF tree is unchanged.

### Phase 5: Redirect Only the Edit-Analysis Click Loop

- Change `sabaki.clickVertex()` narrowly:
  `createBoardInteractionContext() -> resolveBoardInteraction() ->
  executeBoardInteraction() -> scratchEditInteractionExecutor()`.
- Apply this only to the migrated edit-analysis intents from Phase 4.
- Unmigrated tools (markers, lines, labels, numbers) fall back to the legacy
  `scratchEdit` handler inside `clickVertex()`. The fallback is explicit:
  if the resolver returns a `LEGACY_*` intent or the executor returns
  `{handled: false}`, `clickVertex()` continues into the old branch.
- Keep play, recall, scoring, estimator, find, guess, autoplay, legacy problem, review, and
  native SGF edit on legacy paths.
- Keep `sabaki.js` as the transition coordinator / legacy facade, but move
  edit-analysis state ownership into workbench and analysis modules instead of adding
  new behavior directly to `clickVertex()`.
- Add regression coverage proving old play/recall/legacy behavior is unchanged.

### Phase 6: Stabilize Scratch Analysis

- Ensure edit analysis runs from the working position, including ownership and analysis
  result write-back, without dirtying the current SGF tree.
- Scratch analysis runs as a distinct analysis source (`scratch-analysis`) with isolated
  ownership cache, preventing any writes to the real SGF tree (`SBKV`/`SBKS`) or global
  analysis state.
- `createScratchAnalysisContext()` converts a working position snapshot into an
  engine-analyzable context:

  ```ts
  type ScratchAnalysisContext = {
    source: 'scratch-analysis'
    tab: 'current' | 'reference'
    tree: GameTree             // converted from snapshot
    treePosition: string
    analyzePlayer: number      // from snapshot.nextPlayer
    syncerId: string
  }
  ```

- Cache keys use a content-based signature: `[syncerId, snapshotSignature].join(':')`.
  The signature is derived from the snapshot's `signMap` content, so any stone change
  naturally invalidates the cache without manual key management.
- Extract the core of `refreshEditWorkspaceAnalysis()` into a scratch analysis service:
  `sabaki.js` passes dependencies and commits returned results, while
  `src/modules/analysis/scratchAnalysis.js` owns scheduling, cache keys, ownership cache,
  and write-back boundaries. A temporary `src/modules/workbench/analysis/` shim may exist
  during migration, but it should not become the final owner.
- Keep the product UI allowed to show one "Analysis" entry, but internally treat this path
  as `scratch-analysis`.

### Phase 7: Extend Edit Analysis

- Extend `src/modules/workbench/working-position/` and `scratchEditInteractionExecutor`
  in this order:
  drag stone, marker tools, line/arrow tools, set next player, reference snapshot,
  and save as problem.
- Marker tools (`cross`, `triangle`, `square`, `circle`, `label`, `number`) are handled
  by `workingPositionMarkers.js`, which provides:
  `toggleCoordLabel()` for coordinate labels (e.g. `"A1"`, `"B2"` using board height),
  `toggleNumberLabel()` for sequential numbering with gap detection,
  `setLabelMarker()` for custom labels, and `createEmptyMarkerMap()`.
- Line/arrow tools use a two-click state machine: the first click stores
  `{type: lineType, vertex}` in `context.lineFirstVertex`; the second click completes
  the line from `v1` to `v2` and clears the state. `workingPositionLines.js` provides
  `addLine()`, `removeLineAt()` and `createEmptyLines()`, all returning immutable
  new arrays.
- Drag stone is handled by `moveWorkingStone()` in `workingPositionBoard.js`, which
  validates that the target is empty and within bounds before moving. Stone placement
  uses `board.makeMove()` for automatic capture handling.
- Set next player normalizes the sign (`sign > 0 ? 1 : -1`) via `setWorkingNextPlayer()`.
- Reference capture clones the snapshot (stripping `id`, `role` and metadata), determines
  source/target tab based on `activeTab`, and may switch tabs after capture.
- Save as problem delegates snapshot serialization to the executor caller; the executor
  only returns the effect `{handled: true, changed: true, snapshot: ...}`.
- The dual-tab structure (`current`/`reference`) means each effect must specify which tab
  it affects via the `tab` field, and the caller applies state to the correct slot.
- Keep these writes scoped to working position or edit workspace state.
- Add tests at each step so marker/line/reference behavior does not leak into game-tree
  mutation helpers.

### Phase 8: Migrate Play Interaction

- Add `src/modules/workbench/board-interactions/executors/playInteractionExecutor.js`
  for real game play.
- Move real move placement, game-tree mutation, history, current-player updates, engine
  move generation, and play-analysis refresh behind the play executor, with durable
  writes delegated to `documentStore`, engine effects to `engineService`, and analysis
  refresh to `analysisService`.
- Reuse low-level board calculation helpers only when appropriate; do not reuse
  scratch edit write paths.
- Verify play mode writes the game tree while edit analysis writes only working positions.

### Phase 9: Migrate Recall and Training Interaction

- Add `src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js`.
- Treat board clicks as answer submissions, not game moves.
- Write correct, wrong, hint, skip, attempt, session, and progress state through
  `trainingStore` boundaries only.
- Prevent recall from calling play move helpers or mutating the current SGF tree.

### Phase 9B: Migrate Problem Interaction

- Add `src/modules/workbench/board-interactions/executors/problemInteractionExecutor.js`.
- Treat `WorkbenchMode.problem` as a first-class mode, not `play + problemView`.
- Board clicks write mutable Attempt and problem runtime until submit.
- Submit freezes/finalizes the Attempt and enters the mode transition that creates Recall.
- Problem may use game-tree rendering during migration, but it must not become ordinary
  `playMove`; Attempt, ProblemView, MoveEvaluation, BadMove, and punishment Problem writes
  stay in training services.

### Phase 10: Split Analysis Contexts

- Introduce `src/modules/analysis/boardAnalysisContext.js`,
  `src/modules/analysis/scratchAnalysis.js`, and
  `src/modules/analysis/gameTreeAnalysis.js`. If any of these started under
  `src/modules/workbench/analysis/`, move them behind top-level analysis exports or leave
  only compatibility re-exports there.
- Make every analysis request state whether it analyzes a working position, the current
  game-tree position, or a variation position.
- Split analysis state, cache, and write-back ownership into `analysisService` and the
  concrete analysis modules; this phase is not only about extracting context helpers.
- Build and verify scratch analysis first, then clean up game-tree analysis, and only
  then expand variation analysis.

### Phase 11: Add Overlay Input Contracts

- Keep the current `BoardOverlayStack`, `paintMap`, `markerMap`, and marker composition
  implementation path.
- Add `src/modules/overlays/overlayLayers.ts`, `src/modules/overlays/resolveOverlayInput.js`,
  and `src/modules/overlays/composeWorkbenchOverlays.js` as an input-normalization layer.
- Derive overlay input from `PositionSource`, board, analysis result, ownership,
  reference/current snapshots, and hover semantics.
- Verify territory, territory compare, heatmap, and human preference have explicit
  `paint`, `marker`, `tooltip`, or `sidebar` roles and do not compete for the same
  primary visual channel without priority rules.

### Phase 12: Service Ownership and Legacy Deletion

- Treat Phase 12 as several ownership migrations, not a single cleanup pass. By this point
  the facade services may exist, but many of them can still delegate back into `sabaki.js`.
- Run Phase 12 serially as `12A document -> 12B engine -> 12C analysis -> 12D ui/legacy`.
  Engine and analysis depending on documentStore for the current tree/position is an
  ordinary service dependency, not a circular dependency.
- During migration, `sabaki.state` may remain the compatibility mirror and App.js change
  event source. The first ownership milestone is stricter write ownership: document writes
  go through documentStore, engine writes through engineService, and analysis writes through
  analysisService. Moving the internal storage out of `sabaki.state` can happen later.
- Move document ownership first, in small steps: make `documentStore` own the public write
  entrypoints for `gameTrees`, `treePosition`, `gameCurrents`, history, and navigation before
  moving SGF load/save. Keep `gameTreeWrites` focused on pure game-tree mutations.
- Move engine ownership next: `engineService` should own attach/detach/sync/genmove,
  engine-game loops, HumanSL state, and GTP log wiring. Engine callbacks should read/write
  document or analysis state through service boundaries instead of direct `sabaki.state`
  mutation.
- Finish analysis ownership after document and engine boundaries are stable:
  `analysisService` should own board/ownership analysis request lifecycle, quick analysis,
  cache lookup/writeback, and game-tree vs scratch vs variation targets. This is a
  continuation of Phase 10, not just a helper extraction.
- Move layout defaults, controls, and overlay defaults into workspace-level presets only
  after source, contract, resolver, executor, and overlay input boundaries are stable.
- Move drawers, busy state, info overlays, and other UI-only state into `uiStore`.
- New features must pass mode orchestration first, then derive workspace/source/contract.
- Hide legacy entrances before deleting code. `find`, `problem`, `guess`, `scoring`, and
  other legacy branches should be frozen or wrapped before removal. Legacy `problem` means the
  old `play + problemView` interception path; it should migrate to first-class
  `WorkbenchMode.problem`, not be deleted as a product capability.
- Delete legacy branches only after migrated workspaces no longer depend on them and
  tests or telemetry confirm the branch is unused.

## Open Research Questions

These questions should be answered before large code movement:

- Can existing `editWorkspace` become the permanent edit analysis state, or does it need a renamed wrapper?
- Does engine analysis for working positions currently convert snapshots to temporary game trees, and does that affect cache keys or history?
- Which existing overlay data depends on `treePosition`, and which only needs board + ownership?
- Should variation analysis write real game-tree variations in phase one, or use temporary variations first?
- What exact payload is saved when a working position becomes a problem: snapshot, next player, rules, komi, reference answer, key points, engine evaluation?
- Which legacy UI entrances should be hidden first without deleting code?
- Which legacy paths should be wrapped first, and which should remain untouched until product deletion?
- What telemetry or tests are needed before deleting a legacy branch?

## Current Code Anchors

- `src/modules/position-contracts.ts`: shared contract types and helpers.
- `src/modules/study.js`: snapshot helpers and working-position board conversion.
- `src/modules/sabaki.js`: current legacy state host and transition facade; still contains
  legacy mode switch, edit workspace, and interaction dispatch until state slices migrate.
- `src/components/overlays/BoardOverlayStack.js`: current overlay composition entry point.
- `src/components/MainView.js`: current bridge from state to Goban props.
- `src/components/WorkbenchShell.js`: current workspace shell and layout coordinator.

The intended direction is evolutionary: define the boundaries first, then move code behind those boundaries in small PRs.
