# W8-P2 Executor Routing Fix — Wiring Contract v0.1

```
Date: 2026-05-21
Phase: W8-P2 Executor Routing Fix
Status: pending-confirmation
Predecessors: W8-P1, W8-P2 container-mode-routing, W8-P2 coord-fix
```

---

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| PRD v0.5 SS3.1 | Play Mode 行为 | Play 落子写入 game tree，触发 AI reply |
| PRD v0.5 SS3.3 | Recall Mode 行为 | Recall 用户逐手回忆，生成 RecallAttempt，不写 game tree |
| PRD v0.5 SS3.4 | Analysis Mode 行为 | Analysis 自由摆棋/编辑，不污染 Attempt |
| Architecture v0.5 SS0.3 | 必须坚持的边界 | Controller 只路由；Executor 执行写入 |
| Architecture v0.5 SS1.2 | 命令写路径 | UI -> Controller -> Service -> Store/Repo |
| Architecture v0.5 SS1.3 | 依赖规则 | Container 读 Store、调 Service；Store 不依赖 Service |
| Architecture v0.5 SS9.3 | 用户落子路径 | PlayModeController.handleMove -> existing play executor / documentStore append move -> engine reply -> analysis |
| Architecture v0.5 SS14 | 架构红线 | Analysis 不污染 Attempt；recall 不修改 game tree |
| playInteractionExecutor.js | 全文 | play executor 调用 documentStore.playMove，然后 engineService.generateReply，然后 analysisService.scheduleLiveAnalysis |
| recallInteractionExecutor.js | 全文 | recall executor 调用 trainingStore.submitRecallAnswer，不调用 documentStore/engineService/analysisService |
| scratchEditInteractionExecutor.js | 全文 | scratch executor 操作 working position，调用 invalidateEditAnalysis + scheduleEditWorkspaceAnalysis |

## 1. 用户故事

作为训练系统的用户，当我在棋盘上点击时，系统应通过正确的 executor 路径处理我的操作。Play 模式落子应触发 AI 回复和实时分析；Recall 模式回答应仅写入 recall store，不修改 game tree；Analysis 模式编辑应仅操作 scratch workspace，不写入 game tree 或 Attempt。

## 2. 当前缺陷

`boardInteractionController.ts` 三条 executor 路径均绕过 executor 直接调用底层 service/store：

- **Line 180-186 (playMove)**: 直接调用 `deps.getPlayServices().documentStore.playMove()` — 缺少 `engineService.generateReply` 和 `analysisService.scheduleLiveAnalysis`
- **Line 189-206 (recallAnswer)**: 直接调用 `deps.getRecallServiceOrStore().submitRecallMove()` — 绕过 `executeRecallInteraction` 的游戏树保护
- **Line 208-219 (scratchEdit)**: 直接调用 `deps.getEditWorkspaceDeps().invalidateEditAnalysis()` — 绕过 `executeScratchEdit` 的工作空间操作

## 3. 变更契约

| 路径 | 当前实现（缺陷） | 目标实现 |
| --- | --- | --- |
| playMove | 直接调用 `documentStore.playMove()` | 调用 `executePlayInteraction(result, context, {documentStore, engineService, analysisService})` |
| recallAnswer | 直接调用 `submitRecallMove()` 或 `.submitRecallAnswer()` | 调用 `executeRecallInteraction(result, {}, {trainingStore})` |
| scratchEdit | 直接调用 `invalidateEditAnalysis()` | 调用 `executeScratchEdit(result, context, deps)` |

## 4. 预期状态流

### 4.1 Play 全链路

```
Goban.handleVertexMouseUp -> evt.vertex
-> Container.onVertexClick -> extract vertex, event
-> controller.handleBoardClick(input)
-> resolveBoardInteraction -> RESOLVED, intent=play-stone, mutationContract=playMove
-> executePlayInteraction(result, {player}, {documentStore, engineService, analysisService})
   -> documentStore.playMove(vertex, {player}) -> {valid, changed, treePosition, doublePass, ...}
   -> if changed && !doublePass: engineService.generateReply(treePosition, currentPlayer)
   -> if changed: analysisService.scheduleLiveAnalysis(treePosition)
   -> return {handled, changed, treePosition, ...}
```

### 4.2 Recall 全链路

```
Goban -> Container -> controller.handleBoardClick
-> resolveBoardInteraction -> RESOLVED, intent=submit-recall-answer, mutationContract=recallAnswer
-> executeRecallInteraction(result, {}, {trainingStore})
   -> trainingStore.submitRecallAnswer(vertex) -> {handled, changed, isCorrect, ...}
   -> documentStore.playMove NOT called (game tree protection)
```

### 4.3 Scratch 全链路

```
Goban -> Container -> controller.handleBoardClick
-> resolveBoardInteraction -> RESOLVED, intent=place-black-stone, mutationContract=scratchEdit
-> executeScratchEdit(result, editWorkspaceContext, editWorkspaceDeps)
   -> placeBlackStone(snapshot, vertex) -> updated snapshot
   -> invalidateEditAnalysis()
   -> scheduleEditWorkspaceAnalysis(tab)
   -> documentStore NOT called, trainingStore NOT called
```

### 4.4 Deferred 全链路

```
Goban -> Container -> controller.handleBoardClick
-> resolveBoardInteraction -> DEFERRED
-> deps.getLegacySabaki().clickVertex(vertex, event)
-> NO executor called, NO documentStore/recallService called
```

## 5. 允许的副作用

1. Play: documentStore.playMove, engineService.generateReply, analysisService.scheduleLiveAnalysis (全部通过 executor)
2. Recall: trainingStore.submitRecallAnswer (通过 executor)
3. Scratch: working position ops, invalidateEditAnalysis, scheduleEditWorkspaceAnalysis (全部通过 executor)
4. Deferred: legacy sabaki.clickVertex

## 6. 禁止的副作用

1. Controller 直接调用 documentStore.playMove (必须通过 executePlayInteraction)
2. Controller 直接调用 submitRecallMove / submitRecallAnswer (必须通过 executeRecallInteraction)
3. Controller 直接调用 invalidateEditAnalysis / scheduleEditWorkspaceAnalysis (必须通过 executeScratchEdit)
4. Recall 路径写入 game tree (Arch v0.5 SS14)
5. Scratch 路径写入 game tree 或 Attempt (Arch v0.5 SS14)

## 7. 测试分层表

| Test ID | Layer | Production Subject | Real Dependencies | Mock Dependencies | Forbidden Mocks | Primary Assertion |
| --- | --- | --- | --- | --- | --- | --- |
| T-PLAY-01 | SIDE_EFFECT_BOUNDARY | controller + playInteractionExecutor | resolveBoardInteraction, createBoardInteractionContext, executePlayInteraction | documentStore (spy returning changed=true), engineService (spy), analysisService (spy) | resolveBoardInteraction, executePlayInteraction | engineService.generateReply AND analysisService.scheduleLiveAnalysis called |
| T-PLAY-02 | SIDE_EFFECT_BOUNDARY | controller + playInteractionExecutor | resolveBoardInteraction, createBoardInteractionContext, executePlayInteraction | documentStore (spy returning changed=false), engineService (spy), analysisService (spy) | resolveBoardInteraction, executePlayInteraction | engineService NOT called, analysisService NOT called |
| T-PLAY-03 | SIDE_EFFECT_BOUNDARY | controller + playInteractionExecutor | resolveBoardInteraction, createBoardInteractionContext, executePlayInteraction | documentStore (spy returning changed=true, doublePass=true), engineService (spy), analysisService (spy) | resolveBoardInteraction, executePlayInteraction | engineService NOT called; analysisService IS called |
| T-RECALL-01 | SIDE_EFFECT_BOUNDARY | controller + recallInteractionExecutor | resolveBoardInteraction, createBoardInteractionContext, executeRecallInteraction | trainingStore (spy), documentStore (spy) | resolveBoardInteraction, executeRecallInteraction | documentStore.playMove NOT called (game tree protection) |
| T-RECALL-02 | SIDE_EFFECT_BOUNDARY | controller + recallInteractionExecutor | resolveBoardInteraction, createBoardInteractionContext, executeRecallInteraction | trainingStore (spy returning {handled:true, changed:true, isCorrect:true}) | resolveBoardInteraction, executeRecallInteraction | vertex [3,3] passed through executor correctly |
| T-SCRATCH-01 | SIDE_EFFECT_BOUNDARY | controller + scratchEditInteractionExecutor | resolveBoardInteraction, createBoardInteractionContext, executeScratchEdit | editWorkspaceContext (mock with currentSnapshot), editWorkspaceDeps (spy), documentStore (spy), trainingStore (spy) | resolveBoardInteraction, executeScratchEdit | documentStore NOT called, trainingStore NOT called; executor returns {handled:true, changed:true} |
| T-SCRATCH-02 | SIDE_EFFECT_BOUNDARY | controller + scratchEditInteractionExecutor | resolveBoardInteraction, createBoardInteractionContext, executeScratchEdit | editWorkspaceContext (mock), editWorkspaceDeps (spy) | resolveBoardInteraction, executeScratchEdit | invalidateEditAnalysis AND scheduleEditWorkspaceAnalysis called via executor |
| T-DEFERRED-01 | SIDE_EFFECT_BOUNDARY | controller | resolveBoardInteraction, createBoardInteractionContext | legacySabaki (spy), documentStore (spy), engineService (spy), analysisService (spy) | resolveBoardInteraction | sabaki.clickVertex called; NO executor, NO service calls |
| T-ARCH-01 | ARCHITECTURE_BOUNDARY | boardInteractionController source code | fs (source read) | None | N/A | Source does NOT contain direct service calls outside executor invocation |

## 8. 测试契约

### T-PLAY-01: Play executor 完整路径验证
- **Given**: controller with spy deps (documentStore returning {valid:true, changed:true, treePosition:'node_2'}, engineService spy, analysisService spy)
- **When**: handleBoardClick with mode=play, vertex=[3,3], empty board
- **Then**: engineService.generateReply called AND analysisService.scheduleLiveAnalysis called
- **Proof**: This CANNOT be satisfied by calling documentStore.playMove alone; only the play executor orchestrates these follow-up calls.

### T-PLAY-02: Play executor — unchanged move
- **Given**: documentStore returning {valid:true, changed:false}
- **When**: handleBoardClick with mode=play
- **Then**: engineService call count = 0, analysisService call count = 0

### T-PLAY-03: Play executor — double pass
- **Given**: documentStore returning {valid:true, changed:true, treePosition:'node_2', doublePass:true}
- **When**: handleBoardClick with mode=play
- **Then**: engineService call count = 0; analysisService call count = 1

### T-RECALL-01: Recall game tree protection
- **Given**: controller with trainingStore spy and documentStore spy
- **When**: handleBoardClick with mode=recall, vertex=[5,5]
- **Then**: documentStore.playMove call count = 0

### T-RECALL-02: Recall executor correct output
- **Given**: controller with trainingStore spy returning {handled:true, changed:true, isCorrect:true}
- **When**: handleBoardClick with mode=recall, vertex=[3,3]
- **Then**: executeRecallInteraction returns {handled:true, changed:true, isCorrect:true}

### T-SCRATCH-01: Scratch isolation boundary
- **Given**: controller with editWorkspaceContext mock (with currentSnapshot), editWorkspaceDeps spy, documentStore spy, trainingStore spy
- **When**: handleBoardClick with mode=analysis, editWorkspacePresent=true, selectedTool=stone_1
- **Then**: documentStore call count = 0; trainingStore call count = 0; executor returns {handled:true, changed:true}

### T-SCRATCH-02: Scratch analysis scheduling
- **Given**: same as T-SCRATCH-01, with invalidateEditAnalysis spy and scheduleEditWorkspaceAnalysis spy
- **When**: handleBoardClick as in T-SCRATCH-01
- **Then**: invalidateEditAnalysis call count >= 1; scheduleEditWorkspaceAnalysis call count >= 1

### T-DEFERRED-01: Deferred clean delegation
- **Given**: controller with all spy deps
- **When**: handleBoardClick triggers DEFERRED
- **Then**: legacySabaki.clickVertex call count = 1; all other deps call count = 0

### T-ARCH-01: Source code structural check
- Read boardInteractionController.ts source
- Assert: source does NOT contain `documentStore.playMove` as a direct call
- Assert: source does NOT contain `submitRecallMove` or `submitRecallAnswer` as a direct call
- Assert: source does NOT contain `invalidateEditAnalysis` as a direct call
- Assert: source DOES contain `executePlayInteraction` import
- Assert: source DOES contain `executeRecallInteraction` import
- Assert: source DOES contain `executeScratchEdit` import

## 9. Deps 形状变更

Current `getPlayServices`:
```typescript
getPlayServices: () => {
  documentStore: {playMove(vertex, options?): Promise<unknown>}
}
```

Target (must include engineService and analysisService):
```typescript
getPlayServices: () => {
  documentStore: {playMove(vertex: [number,number], options?: unknown): Promise<unknown>}
  engineService?: {generateReply(treePosition: string, player: unknown): void}
  analysisService?: {scheduleLiveAnalysis(treePosition: string): void}
}
```

## 10. 与已有测试的关系

| 已有测试 | 需更新的原因 |
| --- | --- |
| W8-P1 T10 (play resolved routes to documentStore.playMove) | controller 改为调用 executePlayInteraction；deps 需提供 engineService 和 analysisService |
| W8-P1 T11 (recall resolved routes to submitRecallMove) | controller 改为调用 executeRecallInteraction |
| W8-P1 T13 (recall does NOT call documentStore) | 仍有效但需配合新 deps 形状 |
| W8-P1 T14 (scratchEdit does NOT call documentStore) | controller 改为调用 executeScratchEdit |
| W8-P2 T2-04..T2-06 (SGF coord format) | controller 不再负责 SGF 转换；SGF 转换是 trainingStore 内部职责 |

## 11. 证据引用

| 证据 | 路径 |
| --- | --- |
| PRD v0.5 | `docs/design/gabaki-sabaki-training-prd-v0.5.md` |
| Architecture v0.5 | `docs/design/gabaki-sabaki-training-architecture-v0.5.md` |
| W3 contract | `docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md` |
| W3.5 contract | `docs/design/2026-05-21/workbench-wiring/w3.5-goban-data-source-wiring-contract-v0.1.md` |
| Play executor | `src/modules/workbench/board-interactions/executors/playInteractionExecutor.js` |
| Recall executor | `src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js` |
| Scratch executor | `src/modules/workbench/board-interactions/executors/scratchEditInteractionExecutor.js` |
| Controller (defective) | `src/modules/training/workbench/boardInteractionController.ts` |
