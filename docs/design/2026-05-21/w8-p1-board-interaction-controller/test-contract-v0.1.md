# W8-P1 Board Interaction Controller 接线契约

> Date: 2026-05-21
> Phase: W8-P1 (Phase 8 Task 1)
> Status: pending-confirmation

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| PRD v0.5 SS2.1 | "Mode 由用户意图决定" | WorkbenchMode (`play/problem/recall/analysis`) 是路由点击的维度 |
| PRD v0.5 SS3.1 | Play Mode: "用户自由落子" | play 模式点击 = 落子写入 game tree |
| PRD v0.5 SS3.2 | Problem Mode: AI 应手必须在 problemArea 内 | problem 模式点击需受 problemArea 约束 |
| PRD v0.5 SS3.3 | Recall Mode: "用户逐手回忆" | recall 模式点击 = 提交回忆答案 |
| PRD v0.5 SS3.4 | Analysis: "允许自由摆棋" | analysis 模式点击 = scratch edit |
| Arch v0.5 SS0.3 | UI 只展示不写 store, Container/Controller 调 Service | controller 不得直接写 store |
| Arch v0.5 SS1.2 | 命令写路径: UI -> Controller -> Service -> Store/Repo | boardInteractionController 是命令路径第一站 |
| Arch v0.5 SS9.3 | "用户落子" 完整命令路径 | play: documentStore.playMove |
| Arch v0.5 SS9.5 | Recall Checkpoint 命令路径 | recall: recallService.submitRecallMove |
| Arch v0.5 SS14 | recallAnswer 不修改 game tree, scratchEdit 不修改 Attempt.userLine | executor 边界强制 |

## 1. 用户故事

作为 Workbench 训练用户，当我点击棋盘交叉点时，系统根据当前模式正确处理：
- play/problem: 落子到 game tree
- recall: 提交回忆答案
- analysis: scratch edit

## 2. 用户动作

1. play 模式点击空交叉点 -- 落子
2. play 模式 AI 回合点击 -- 被拒绝
3. problem 模式在 problemArea 内点击 -- 落子
4. problem 模式在 problemArea 外点击 -- 被拒绝
5. problem 模式 AI 回合点击 -- 被拒绝
6. recall 模式点击空交叉点 -- 提交回忆答案
7. recall 模式点击有子交叉点 -- 被拒绝
8. analysis+editWorkspace 点击 -- scratch edit
9. analysis 无 editWorkspace 点击 -- 延迟给 legacy
10. 任意模式右键 -- play 延迟给 legacy，其他被拒绝
11. 点击已占据的点（非 analysis）-- 被拒绝

## 3. 位置源

| 模式 | 位置源 | 依据 |
| --- | --- | --- |
| play | game-tree | Arch v0.5 SS9.3 |
| problem | game-tree | 同 play |
| recall | game-tree（只读） | Arch v0.5 SS14 |
| analysis | scratch | Arch v0.5 SS9.6 |

## 4. 变更契约

| 模式 | 变更契约 |
| --- | --- |
| play | playMove |
| problem | playMove |
| recall | recallAnswer |
| analysis (editWorkspace) | scratchEdit |

## 5. 预期状态流

### 5.1 完整链路

```
Goban.handleVertexMouseUp(evt, vertex)
  -> evt.vertex = vertex            // Goban.js:243
  -> onVertexClick(evt)             // Goban.js:282, single-arg
    -> Container.onVertexClick(evt)  // TrainingWorkbenchContainer.js:328
      -> evt.vertex extracted       // line 331
      -> evt.button/ctrlKey/metaKey extracted // line 332
      -> _clickController.handleBoardClick({...}) // line 330
        -> resolveBoardInteraction(resolverInput)
          -> result: BoardInteractionResult
        -> route by result.status + effectiveContract
          -> playMove:    deps.getPlayServices().documentStore.playMove(vertex)
          -> recallAnswer: deps.getRecallServiceOrStore().submitRecallMove/submitRecallAnswer
          -> scratchEdit:  deps.getEditWorkspaceDeps().invalidateEditAnalysis()
          -> deferred:     deps.getLegacySabaki().clickVertex(vertex, event)
```

### 5.2 play 状态前进

```
handleBoardClick(vertex, play)
  -> resolveBoardInteraction -> {intent: play-stone, mutationContract: playMove}
  -> documentStore.playMove(vertex)
  -> [DEFERRED] attemptService.appendMove()
  -> [DEFERRED] playTrainingMonitor.onUserMove()
  -> [DEFERRED] aiMoveService.maybePlayAiMove()
```

### 5.3 recall 状态前进

```
handleBoardClick(vertex, recall)
  -> resolveBoardInteraction -> {intent: submit-recall-answer, mutationContract: recallAnswer}
  -> recallService.submitRecallMove({recallSessionId, userMove})
    -> [if correct] advance currentMoveIndex
    -> [if hit BadMove] checkpointService.startCheckpoint()
      -> runtimeStore.setActiveCheckpoint(checkpointId)
  -> runtimeStore.subscribe -> forceUpdate -> RecallModePanel re-render
```

### 5.4 analysis 状态前进

```
handleBoardClick(vertex, analysis)
  -> resolveBoardInteraction -> {intent: place-black-stone, mutationContract: scratchEdit}
  -> [当前实现] editWorkspaceDeps.invalidateEditAnalysis()
  -> [DEFERRED] executeScratchEdit(result, context, deps)
```

### 5.5 状态回流

```
workbenchStore.subscribe -> Container.forceUpdate -> WorkbenchShell re-render
  -> projectGobanProps(snapshot) -> Goban props
  -> ModePanel props update
```

## 6. 允许的副作用

1. documentStore.playMove -- play/problem 落子
2. recallService.submitRecallMove -- recall 写入 RecallAttempt
3. checkpointService.startCheckpoint -- recall 命中 badMove
4. editWorkspace scratch 修改 -- analysis
5. legacySabaki.clickVertex -- deferred 回退

DEFERRED:
6. attemptService.appendMove
7. playTrainingMonitor.onUserMove
8. aiMoveService.maybePlayAiMove
9. executeScratchEdit

## 7. 禁止的副作用

1. recall 模式不得调用 documentStore.playMove（Arch v0.5 SS14）
2. scratch edit 不得修改 Attempt.userLine（Arch v0.5 SS14）
3. controller 不得直接写 workbenchStore 或 trainingRuntimeStore（Arch v0.5 SS0.3）
4. controller 不得直接 import engine/DB/UI 模块
5. resolveBoardInteraction 不得产生任何副作用（纯函数）

## 8. 测试契约表

| ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Forbidden Mocks | Primary Assertion |
| --- | --- | --- | --- | --- | --- | --- |
| W8P1-T01 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无（纯函数） | 无 | N/A | play+空点 -> resolved, intent=play-stone |
| W8P1-T02 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | play+AI回合 -> rejected |
| W8P1-T03 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | problem+problemArea内 -> resolved |
| W8P1-T04 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | problem+problemArea外 -> rejected |
| W8P1-T05 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | problem+AI回合 -> rejected |
| W8P1-T06 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | recall+空点 -> resolved, intent=submit-recall-answer |
| W8P1-T07 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | recall+有子点 -> rejected |
| W8P1-T08 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | analysis+editWorkspace+stone_1 -> scratchEdit |
| W8P1-T09 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | analysis 无 editWorkspace -> deferred |
| W8P1-T10 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick | documentStore (真实) | getPlayServices, getRecallServiceOrStore, getLegacySabaki | resolveBoardInteraction | play resolved -> documentStore.playMove 被调用 |
| W8P1-T11 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick | recallService (真实) | getPlayServices, getEditWorkspaceDeps, getLegacySabaki | resolveBoardInteraction | recall resolved -> recallService.submitRecallMove 被调用 |
| W8P1-T12 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick | legacySabaki (spy) | getPlayServices, getRecallServiceOrStore | resolveBoardInteraction | deferred -> legacySabaki.clickVertex 被调用 |
| W8P1-T13 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick | 无 (spy) | getRecallServiceOrStore, getLegacySabaki, getEditWorkspaceDeps | resolveBoardInteraction | recall resolved -> documentStore.playMove 不被调用 |
| W8P1-T14 | SIDE_EFFECT_BOUNDARY | boardInteractionController.handleBoardClick | 无 (spy) | getRecallServiceOrStore, getLegacySabaki, getEditWorkspaceDeps | resolveBoardInteraction | scratchEdit resolved -> documentStore.playMove 不被调用 |
| W8P1-T15 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | play+右键 -> deferred |
| W8P1-T16 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | play+有子点 -> rejected |
| W8P1-T17 | ARCHITECTURE_BOUNDARY | resolveBoardInteraction module imports | 模块源码 | 无 | N/A | 无 sabaki.js/store/service import |
| W8P1-T18 | ARCHITECTURE_BOUNDARY | boardInteractionController deps | 模块源码 | 无 | N/A | 无直接 store/service import |
| W8P1-T19 | UI_COMMAND_MAPPING | Goban + Container onVertexClick 签名 | Goban.handleVertexMouseUp 源码 | 无 | N/A | onVertexClick(evt) 单参数 |
| W8P1-T20 | CONTROLLER_STATE_TRANSITION | resolveBoardInteraction | 无 | 无 | N/A | problem 无 problemArea -> resolved |
| W8P1-T21 | SERVICE_REPOSITORY_TRANSITION | recallService.submitRecallMove | trainingRuntimeStore (真实), repository (真实) | 无 | recallService 本身 | 正确创建 RecallAttempt |
| W8P1-T22 | SERVICE_REPOSITORY_TRANSITION | recallService + checkpointService | trainingRuntimeStore, repository | 无 | recallService, checkpointService | 命中 major BadMove -> startCheckpoint 被调用 |
| W8P1-T23 | STORE_SUBSCRIPTION | trainingRuntimeStore.setActiveCheckpoint | trainingRuntimeStore (真实) | 无 | N/A | subscriber 被通知 |
| W8P1-T24 | CONTAINER_DELEGATION | Container.onVertexClick | Container, controller (真实) | sabaki context, stores | resolveBoardInteraction | 正确提取 vertex/button/ctrlKey/metaKey |

## 9. 脆弱测试警告

1. W8P1-T10-T14: 不要 mock resolveBoardInteraction，让 resolver 真实执行
2. W8P1-T24: 不要断言调用次数，验证传入参数 shape
3. W8P1-T11: 坐标格式断言要与 expectedMoves 格式一致

## 10. 不测试

- toWorkbenchMode 辅助函数
- extractProblemArea 辅助函数
- extractPlayerConfig 辅助函数

## 11. 超出范围

- GAP-P1: attemptService.appendMove 接入 -- W8-P2+
- GAP-P2: playTrainingMonitor.onUserMove -- W8-P2+
- GAP-P3: aiMoveService.maybePlayAiMove -- AI 接线
- GAP-S1: executeScratchEdit 完整执行器 -- edit workspace 完善
- GAP-Coord: vertex 到 SGF 坐标转换 -- 需要统一坐标适配器

## 12. v0.5 冲突检查

| 检查项 | 结论 |
| --- | --- |
| origin.provider 当流程分支 | 否，仅按 workbenchMode 路由 |
| source-specific API 作为新主路径 | 否 |
| container 直接写 store | 否 |
| UI component 直接依赖 service/store | 否 |
| resolver 产生副作用 | 否，纯函数 |
| recall 写入 game tree | RED: 需确认 submitRecallAnswer 不写 game tree |
| vertex 坐标格式一致性 | RED: "x,y" vs SGF 格式不一致 |

## 13. Workbench 接线清单

| 控件 | 命令 | Owner | 测试 |
| --- | --- | --- | --- |
| Goban board click | onVertexClick(evt) | Goban (presentational) | T19 |
| Container onVertexClick | handleBoardClick(input) | TrainingWorkbenchContainer | T24 |
| boardInteractionController | route to executor | boardInteractionController | T01-T18 |
| play executor | documentStore.playMove | controller deps | T10, T13 |
| recall executor | recallService.submitRecallMove | controller deps | T11, T13, T21-T23 |
| analysis executor | editWorkspaceDeps (stub) | controller deps | T08, T14 |
| legacy deferred | legacySabaki.clickVertex | controller deps | T12, T15 |
