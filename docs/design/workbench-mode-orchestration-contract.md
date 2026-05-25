# Workbench Mode Orchestration Contract

本文梳理 Sabaki training workbench 中 Play / Problem / Recall / Analysis 四个 mode
进入、停留、退出时必须一起管理的 companion state。

目标不是只画 mode state machine，而是明确：

- 哪块状态由谁拥有，谁可以读，谁可以写。
- 每个 mode 进入、停留、退出时哪些状态必须存在、必须清空、只能作为 projection/cache。
- board、overlay、engine、analysis、training persistence 之间的写入边界。
- 哪些现有代码已经满足合同，哪些地方是污染风险。

参考现有报告：

- `/Users/gaochong/.gemini/antigravity/brain/59c1801d-c567-445b-a06d-aa5727e3c5b0/workbench_mode_state_impact_report.md`

本文以当前代码为准。报告里部分判断和当前代码存在差异，本文会在风险处标明。

## 文档地位与抽象层

本文是 workbench 运行态状态机的最高优先级 source of truth。其它架构文档如果讨论棋盘读写
边界、函数迁移、字段 owner 或训练上下文导航，必须和本文保持一致。

统一层级如下：

```txt
ModeState / TransitionEffect
  -> derive PositionSource + MutationContract
  -> boardInteractionResolver
  -> focused executor
  -> owner service / store / repository
```

`Play / Problem / Recall / Analysis` 是 workbench 的四个运行态 mode。`mode` 是上层主
region，用来约束 companion state、transition、overlay region 和 engine/analysis region。
底层棋盘读写权限仍由 `PositionSource`、`MutationContract` 和 focused executor 保证；不得
把底层 resolver 重新写成一个巨型 `mode` switch。

`Problem` 有两个抽象层，文档和代码讨论时必须区分：

1. `Problem` entity / task: 训练业务实体，表示一道题、惩罚题或题目来源。
2. `WorkbenchMode.problem`: workbench 运行态 mode，表示用户正在做题；它拥有
   `problemView`、mutable Attempt、pending evaluations 和 visible bad move projection。

Mode transition 的唯一编排入口是 `workbenchFlowService`，或后续同职责的
`workbenchModeService`。Task、Attempt、RecallSession、Problem 等领域对象由各自 service
负责写入，但这些 service 不能绕过 mode transition guard 去制造跨 mode companion state。

## Status Legend

- **OK**: 当前代码基本符合合同。
- **Gap**: 合同应要求，但当前代码未覆盖或覆盖不完整。
- **Risk**: 当前代码可能产生跨 mode 状态污染。
- **Projection**: UI/render/cache 状态，不能成为业务真相来源。

## 状态 Owner 总览表

| 状态区域 | Owner | 可读 | 可写 | Projection / Cache | 证据 | 当前判断 |
| --- | --- | --- | --- | --- | --- | --- |
| `WorkbenchMode` / `WorkbenchTab` | `workbenchStore`，由 `workbenchTabService` / `workbenchFlowService` 编排写入 | UI、flow、legacy adapter | 只应由 workbench service 写 | 否 | `src/modules/training/types/tab.ts:1`, `src/modules/training/types/tab.ts:17`, `src/modules/training/store/workbenchStore.ts:82` | **Gap**: owner 清楚，但 `updateTab` 是无 guard shallow patch。 |
| Training runtime | `trainingRuntimeStore` | UI、flow、problem/recall/monitor | runtime setters、legacy controller、training services | `problemView` / `recallView` 是运行期视图，不是持久真相 | `src/modules/training/store/trainingRuntimeStore.ts:37`, `src/modules/training/store/trainingRuntimeStore.ts:104` | **Gap**: 字段完整，但无 mode companion 校验。 |
| Attempt | `trainingRepository` + `attemptService` | flow、problem、recall、monitor | 只应由 attempt service 写 | 否 | `src/modules/training/types/attempt.ts:18`, `src/modules/training/attempt/attemptService.ts:71`, `src/modules/training/repository/trainingRepository.ts:234` | **Risk**: `appendMove` 有 mutable guard；repository/db 泛型 update 可绕过冻结。 |
| MoveEvaluation / BadMove | repository + play/problem monitor | problem/recall/checkpoint/analysis UI | monitor、problem flow | bad move visibility 是 runtime projection | `src/modules/training/types/evaluation.ts:3`, `src/modules/training/attempt/attemptService.ts:111`, `src/modules/training/attempt/attemptService.ts:119` | **OK with guard**: 可在 attempt frozen 后继续完成 pending evaluation，但不得写 Attempt。 |
| Problem / Task | `problemService` / repo | workbench、snapshot、UI | problem service / workbench flow | 否 | `src/modules/training/types/problem.ts:28`, `src/modules/training/problem/problemService.ts:46`, `src/modules/training/workbench/workbenchFlowService.ts:193` | **Risk**: snapshot flow 当前允许任意 mode，合同应限制 Analysis。 |
| RecallSession / RecallAttempt / Checkpoint / Comment | `recallService` / `recallCheckpointService` / repo | recall UI、flow、checkpoint UI | recall services | 否 | `src/modules/training/types/recall.ts:8`, `src/modules/training/recall/recallService.ts:99`, `src/modules/training/recall/recallCheckpointService.ts:116` | **Mixed**: recall move 不改 Attempt，正确；`completeRecall` 改 Attempt，是风险。 |
| Game tree / document | `documentStore` + legacy `sabaki.state` | board、engine、analysis、training | document actions、legacy controller、play executor | 否 | `src/modules/document/documentStore.js:10`, `src/modules/document/documentStore.js:395`, `src/modules/sabaki.js:2576` | **Risk**: play/problem 写真实 tree；analysis scratch 必须隔离。 |
| Scratch analysis workspace | `sabaki.state.editWorkspace` + `scratchAnalysis` | analysis UI、overlay、analysis service | scratch executor、scratchAnalysis | scratch ownership cache 是 cache | `src/modules/sabaki.js:455`, `src/modules/analysis/scratchAnalysis.ts:127` | **OK**: `scratchAnalysis` 明确不写 SGF tree。 |
| Overlay | `overlayStore` | App/MainView/BoardToolbar | overlayStore only | App props、resolved overlay input 是 projection | `src/modules/overlays/overlayStore.ts:1`, `src/modules/overlays/overlayStore.ts:138`, `src/modules/overlays/resolveOverlayInput.ts:296` | **OK with test gap**: owner 清楚，有 generation 防 stale；缺 late async 测试。 |
| Engine / live analysis | `engineService` + `analysisService` | App、analysis service、training monitor | engineService、analysis service | ownership cache 是 cache | `src/modules/engine/engineService.js:88`, `src/modules/analysis/analysisService.ts:176`, `src/modules/analysis/analysisCache.ts:8` | **Risk**: game-tree analysis update 会写 SGF analysis props，必须和 scratch target 隔离。 |
| UI panels / bars | React props | 用户 | callback only | 是 | `src/components/WorkbenchShell.js:54`, `src/components/workbench/shell/ModeBar.js:5`, `src/components/workbench/shell/RightModePanel.js:14` | **Projection**: UI 不能成为业务真相；ModeBar 当前缺 disabled transition policy。 |
| Legacy `sabaki.state.mode` | `sabaki.js` | legacy board/app | `sabaki.setMode` | 对 workbench 来说应变成 adapter projection | `src/modules/sabaki.js:99`, `src/modules/sabaki.js:494` | **Risk**: 当前仍和 `WorkbenchTab.mode` 并存，Problem 尤其明显。 |

## Mode 配套状态表

### Play

| Companion state | Contract | 当前代码状态 |
| --- | --- | --- |
| `WorkbenchTab` | `mode:'play'`；可有 `activeAttemptId`；`activeRecallSessionId` 必须为空；`previousMode` 为空；`currentTreePosition` 可作为 tab-level 恢复点。 | `WorkbenchTab` 字段齐全，见 `src/modules/training/types/tab.ts:17`。 |
| Runtime | `problemView=null`，`recallView=null`，`activeCheckpointId=null`，`correctionDraft=null`；可有 live `pendingMoveEvaluations` 和 `visibleBadMoveIds`。 | runtime store 可表达，但无 mode guard，见 `src/modules/training/store/trainingRuntimeStore.ts:37`。 |
| Attempt | 只有 `status:'playing'` 可 mutable；可写 `userLine`、`moveActors`、hint metadata；submit 后必须 frozen。 | `attemptService.appendMove` 检查 playing，见 `src/modules/training/attempt/attemptService.ts:71`。 |
| Game tree | 允许落子、pass、导航、生成真实节点和 variation。 | `documentStore.playMove` 写 game tree，见 `src/modules/document/documentStore.js:395`。 |
| Overlay | territory/compare 必须 off；info overlay 可用。 | `overlayStore` 会拒绝非 analysis territory，见 `src/modules/overlays/overlayStore.ts:157`。 |
| Engine / analysis | live game-tree analysis、engine game 可用；scratch analysis 必须 absent。 | `gameTreeAnalysis` 会跳过 analysis scratch workspace，见 `src/modules/analysis/gameTreeAnalysis.ts:59`。 |
| UI projection | panels/bars 只读展示 active attempt、engine state，不拥有业务状态。 | `WorkbenchShell` 是 props layout，见 `src/components/WorkbenchShell.js:54`。 |

### Problem

| Companion state | Contract | 当前代码状态 |
| --- | --- | --- |
| `WorkbenchTab` | 应为 `mode:'problem'`，必须有 `activeAttemptId`；`activeRecallSessionId` 为空；`previousMode` 为空。 | **Gap**: `openProblemTab` 创建 tab 后 legacy setup 仍将 `sabaki.state.mode` 设为 `play`，见 `src/modules/training/workbench/workbenchTabService.ts:107` 和 `src/modules/training/workbench/workbenchTabService.ts:120`。 |
| Runtime | 必须有 `problemView`；`recallView=null`；`activeCheckpointId=null`；pending evaluations 可存在；`visibleBadMoveIds` 只属于当前 problem attempt。 | `openProblemTab` 设置 `problemView`，见 `src/modules/training/workbench/workbenchTabService.ts:166`。 |
| Attempt | submit 前 mutable；submit 后 frozen。problem undo 必须同步回滚 Attempt userLine。 | **Risk**: `undoProblemMove` 只改 runtime cache，不改 Attempt，见 `src/modules/training/problem/problemFlowService.ts:237`。 |
| Game tree | 允许在 problem area 内生成真实答题节点；submit 后禁止继续改当前 attempt line。 | legacy controller 在 play mode 截获 problem move 并写 tree，见 `src/modules/training/controller/legacyTrainingFlowController.ts:359`。 |
| Overlay | territory/compare off；analysis overlay hidden。 | overlay territory 会被拒绝，但 analysis display 是否隐藏需单独控制。 |
| Engine / analysis | 可创建 pending MoveEvaluation / BadMove；engine update 只能更新 evaluation/bad move，不得写 frozen Attempt。 | monitor update 不写 Attempt，但 transition 未停止 monitor，是风险。 |
| UI projection | Problem panel/bar 只读 `problemView` / `result` / bad move summary。 | `TrainingWorkbenchContainer` 将 runtime 映射为 props，见 `src/components/TrainingWorkbenchContainer.js:50`。 |

特别说明：当前 board resolver 没有 `problem` branch。Problem 的真实入口是
`sabaki.state.mode === 'play' && runtime.problemView`：

- `src/modules/sabaki.js:2358`
- `src/modules/workbench/board-interactions/resolveBoardInteraction.ts:251`
- `src/modules/workbench/contracts/workspaceDefaults.ts:19`

因此 Problem 是当前最大 mode 主 region 缺口。

### Recall

| Companion state | Contract | 当前代码状态 |
| --- | --- | --- |
| `WorkbenchTab` | `mode:'recall'`；必须有 `activeRecallSessionId`；`activeAttemptId` 是 frozen source attempt；`previousMode` 为空，除非临时进入 analysis。 | `workbenchFlowService.submit` 会 patch mode 和 recall id，见 `src/modules/training/workbench/workbenchFlowService.ts:92`。 |
| Runtime | 必须有 `recallView`；`problemView=null`；可有 `activeCheckpointId` 和 `correctionDraft`；pending evaluations 不得驱动 Attempt 写入。 | `recallService._createSession` 设置 active recall，见 `src/modules/training/recall/recallService.ts:211`。 |
| Attempt | source Attempt frozen；禁止 Recall 写 `userLine`、`result`、`status`。 | `submitRecallMove` 只创建 RecallAttempt / 更新 RecallSession，见 `src/modules/training/recall/recallService.ts:99`。 |
| Recall persistence | Recall 只能创建或更新 RecallSession、RecallAttempt、RecallCheckpoint、MoveComment。 | checkpoint/comment 写入见 `src/modules/training/recall/recallCheckpointService.ts:116` 和 `src/modules/training/recall/recallCheckpointService.ts:183`。 |
| Game tree | board click 只提交 recall answer 或导航既有答案线；不生成新的 Attempt line。 | legacy recall click 调用 `handleRecallMove`，见 `src/modules/sabaki.js:2566`。 |
| Overlay | territory/compare off；analysis overlay 应 hidden；info overlay 可用。 | **Gap**: `resolveAnalysisDisplay` 当前允许 recall 显示 analysis，见 `src/modules/overlays/resolveAnalysisDisplay.ts:54`。 |
| Engine / analysis | 不应触发 live game mutation；checkpoint 可以读取历史 MoveEvaluation。 | `recallCheckpointService.revealAiCandidateLines` 读取 MoveEvaluation，见 `src/modules/training/recall/recallCheckpointService.ts:140`。 |
| UI projection | Recall panel 展示 session progress/checkpoint/hint/comment，不能写 Attempt。 | `RightModePanel` 只按 props 渲染，见 `src/components/workbench/shell/RightModePanel.js:14`。 |

### Analysis

| Companion state | Contract | 当前代码状态 |
| --- | --- | --- |
| `WorkbenchTab` | `mode:'analysis'`；`previousMode` 必须记录来源 mode；source `activeAttemptId` / `activeRecallSessionId` 只作 trace/context，不是 mutable target。 | `enterAnalysis` 只 patch mode/previousMode，见 `src/modules/training/workbench/workbenchFlowService.ts:141`。 |
| Runtime | source runtime 可只读保留；如果是 completed recall 进入 analysis，必须清 `recallView`、`activeCheckpointId`、`correctionDraft`；analysis scratch state 不应塞入 TrainingRuntimeStore。 | **Gap**: `completeRecall` in flow 只 patch mode，未清 runtime，见 `src/modules/training/workbench/workbenchFlowService.ts:161`。 |
| Attempt | read-only；禁止写 `userLine/result/status`；snapshot 不改原 Attempt。 | snapshot no-mutation 有测试，但 `recallService.completeRecall` 会写 Attempt status，是风险。 |
| Game tree | 默认写 scratch workspace，不写真实 SGF tree；显式 variation move 才能写 game-tree variation。 | `scratchAnalysis` 注释说明只写 `editWorkspace`，见 `src/modules/analysis/scratchAnalysis.ts:127`。 |
| Overlay | territory/compare 仅 Analysis 可用；ownership source 来自 game-tree 或 scratch current/reference；pending/unavailable reason 来自 resolver。 | `overlayStore.setTerritoryEnabled` 和 compare guard 见 `src/modules/overlays/overlayStore.ts:138`、`src/modules/overlays/overlayStore.ts:234`。 |
| Engine / analysis | scratch analysis 写 `editWorkspace.currentAnalysis/currentOwnership`；game-tree live analysis 不得写 scratch。 | scratch refresh 写 editWorkspace，见 `src/modules/analysis/scratchAnalysis.ts:134`；engine update 在 analysis scratch 下 early return，见 `src/modules/engine/engineService.js:612`。 |
| UI projection | Analysis panel/bar 只读 engine/overlay/scratch，不拥有业务真相。 | App 汇总 overlay/analysis props，见 `src/components/App.js:463`。 |

## Mode 内部行为合同

| Action | Play | Problem | Recall | Analysis |
| --- | --- | --- | --- | --- |
| board click | 写 document tree；若训练 attempt active，写 mutable Attempt。 | 写 document tree + `problemView` + mutable Attempt；必须受 problem area 限制。 | 创建 RecallAttempt，推进 RecallSession 或 checkpoint；禁止写 Attempt。 | 写 scratch workspace snapshot/marker/line，触发 scratch analysis；禁止写 source Attempt 和 source tree。 |
| undo | 可回退 game-tree/history；若 training attempt active，必须同步 attempt line。 | 必须同步回滚 tree、runtime eval cache、Attempt.userLine。当前缺 Attempt rollback。 | 不回滚 source Attempt；可 skip/resume checkpoint。 | 只回滚 scratch workspace。 |
| pass / resign | 可写 playing Attempt result/status。 | 可作为 problem move 或 submit result；submit 后 frozen。 | pass 只能作为 recall answer/skip 语义。 | 不写 source。 |
| submit | freeze/finalize Attempt，创建 RecallSession。 | freeze/finalize Attempt，persist BadMove，创建 RecallSession，清 problemView。 | 非法。 | 非法。 |
| request hint | 可写 hint metadata 或 runtime hint；不得改 result。 | 可写 hint metadata/runtime hint；不得改 line/result。 | 当前 legacy 只写 `recallView.showHint`，见 `src/modules/training/controller/legacyTrainingFlowController.ts:312`。 | 不适用。 |
| checkpoint correction/comment | 非法。 | 非法。 | 只写 RecallCheckpoint / MoveComment。 | 只读展示，不回写 source。 |
| enter analysis | patch tab + mode enter effects。 | 同上；如果 problem attempt 还 mutable，必须先 freeze 或按 read-only snapshot 进入。 | 同上；recall state read-only 或 completed 后清理。 | 非法重复 enter。 |
| snapshot as problem | 非法。 | 非法。 | 非法。 | 只创建 child Problem/Task/tab；原 tab/Attempt 不变。 |
| toggle territory / compare | 非法。 | 非法。 | 非法。 | 只写 OverlayRegion；不得写 runtime/Attempt。 |
| engine analysis update | 可写 engine state/cache/pending MoveEvaluation。 | 可写 MoveEvaluation/BadMove；不得写 Attempt。 | 可供 checkpoint 读取历史 eval；不得改 source Attempt。 | scratch target 只写 editWorkspace；game-tree target 不得污染 scratch。 |

## Transition Effect 表

### play -> recall

| Effect | Contract | 当前代码 |
| --- | --- | --- |
| Precondition | active tab `mode:'play'`；有 active playing Attempt；无 active checkpoint。 | `workbenchFlowService.submit` 要求 transition 允许，见 `src/modules/training/workbench/workbenchFlowService.ts:92`。 |
| Workbench tab patch | `{mode:'recall', activeRecallSessionId, previousMode:undefined}`；保留 `activeAttemptId`。 | 当前 patch mode 和 recall id；未显式清 previousMode。 |
| Runtime patch | `problemView=null`；初始化 `recallView`；`activeCheckpointId=null`；`correctionDraft=null`。 | submit 会清 `problemView` 并 set active recall；checkpoint/draft/visible ids 未统一处理。 |
| Overlay patch | territory/compare false，generation bump。 | 若经 `sabaki.setMode` 可触发；flow service 本身没有 overlay effect。 |
| Engine / analysis side effect | 停止/冻结 play monitor；live pending eval 可完成，但只写 evaluation/bad move。 | 当前没有明确 stop monitor。 |
| Persistence writes | freeze/finalize Attempt；create RecallSession。 | 已 freeze/finalize/create recall。 |
| 清空 / 保留 | 清 play-only controls；保留 source Attempt id 和 evaluation history。 | 部分完成。 |
| 禁止污染 | engine/overlay async callback 不得写 Attempt。 | 需要 repository/service guard 和测试。 |

### problem -> recall

| Effect | Contract | 当前代码 |
| --- | --- | --- |
| Precondition | active problem companion；Attempt playing/submittable；problemView active。 | `problemFlowService.submitActiveProblem` 依赖 active problemView，见 `src/modules/training/problem/problemFlowService.ts:328`。 |
| Workbench tab patch | `{mode:'recall', activeRecallSessionId, previousMode:undefined}`；保留 `activeAttemptId` 和 problem/task trace。 | `workbenchFlowService.submit` 可做；legacy `submitProblemAttempt` 不切 recall。 |
| Runtime patch | 清 `problemView`；初始化 `recallView`；清 checkpoint/draft；visible bad moves 转 checkpoint context 或清空。 | workbench flow submit 清 problemView；legacy controller 只标记 submitted/result，见 `src/modules/training/controller/legacyTrainingFlowController.ts:425`。 |
| Overlay patch | territory/compare false。 | flow 未显式处理。 |
| Engine / analysis side effect | 停 problem monitor；pending analysis 只能落到 MoveEvaluation/BadMove。 | 未显式停。 |
| Persistence writes | freeze/finalize Attempt；persist BadMove；create punishment Problem if needed；create RecallSession。 | problem flow 可 persist bad moves/punishments；workbench flow 可 create recall，但两条路径未统一。 |
| 清空 / 保留 | 保留 Problem id/source；清 problem area runtime。 | 部分完成。 |
| 禁止污染 | submit 后 undo/problem move 不得继续写 frozen Attempt。 | 需要 guard。 |

### play/problem/recall -> analysis

| Effect | Contract | 当前代码 |
| --- | --- | --- |
| Precondition | source mode 非 analysis；如果 source attempt mutable，必须先 freeze 或创建 read-only snapshot context。 | `MODE_TRANSITIONS` 允许 play/problem/recall enterAnalysis，见 `src/modules/training/workbench/workbenchFlowService.ts:8`。 |
| Workbench tab patch | `{mode:'analysis', previousMode:sourceMode}`。 | 已做，见 `src/modules/training/workbench/workbenchFlowService.ts:141`。 |
| Runtime patch | source companion 只读保留；completed recall path 应清 `recallView/activeCheckpoint/correctionDraft`。 | 未统一处理。 |
| Overlay patch | territory 默认可 pending；compare 默认 false；info overlay 可保留。 | `sabaki.setMode('analysis')` 会触发 overlay mode change，flow 没有。 |
| Engine / analysis side effect | create scratch workspace；schedule scratch analysis；suspend game-tree live writes into scratch target。 | legacy `setMode` 创建 workspace 并 schedule，见 `src/modules/sabaki.js:494`。 |
| Persistence writes | 可选 create independent AnalysisSession；不得写 Attempt line/result/status。 | 当前没有 dedicated AnalysisSession persistence。 |
| 清空 / 保留 | 保留 source ids for return/snapshot trace；scratch 是新 orthogonal region。 | 部分完成。 |
| 禁止污染 | scratch edits 不得写 source game tree/Attempt。 | scratchAnalysis OK；legacy click path仍需约束。 |

### recall -> analysis

`recall -> analysis` 是上一条的特化，但需要额外约束 Recall persistence：

| Effect | Contract | 当前代码 |
| --- | --- | --- |
| Precondition | active recall session；无未完成阻塞 checkpoint，或明确允许 pause checkpoint。 | flow `completeRecall` 不检查 checkpoint。 |
| Workbench tab patch | `{mode:'analysis', previousMode:'recall'}` 或 completed recall 直接 `{mode:'analysis', previousMode:undefined}`。 | `workbenchFlowService.completeRecall` 只 `{mode:'analysis'}`，见 `src/modules/training/workbench/workbenchFlowService.ts:161`。 |
| Runtime patch | complete path 清 `recallView/activeCheckpoint/correctionDraft`；temporary analysis path 保留 read-only recallView。 | legacy `endRecallSession` 清 recallView 并 `setMode('analysis')`，见 `src/modules/training/controller/legacyTrainingFlowController.ts:321`。 |
| Persistence writes | 只写 RecallSession / RecallAttempt / Checkpoint / followup state。 | **Risk**: `recallService.completeRecall` 写 Attempt `recallCompleted` 和 `status:'analyzing'`，见 `src/modules/training/recall/recallService.ts:183`。 |
| 禁止污染 | Recall 不得改 Attempt.userLine/result/status。 | 需要调整或明确 allowlist。 |

### analysis -> previous mode

| Effect | Contract | 当前代码 |
| --- | --- | --- |
| Precondition | current tab `mode:'analysis'`；`previousMode` 存在；目标必须等于 previousMode。 | `returnFromAnalysis` 没校验目标是否等于 previousMode，见 `src/modules/training/workbench/workbenchFlowService.ts:151`。 |
| Workbench tab patch | `{mode:previousMode, previousMode:undefined}`。 | 已 patch。 |
| Runtime patch | 恢复对应 source companion；如果 recall 已 completed，不允许恢复 mutable recall。 | 未统一。 |
| Overlay patch | 清 territory/compare；generation bump；丢弃 pending unavailable/pending state。 | `overlayStore.onModeChange` 可做，见 `src/modules/overlays/overlayStore.ts:292`。 |
| Engine / analysis side effect | 清 `editWorkspace`；stop/ignore scratch result；resume source mode analysis policy。 | legacy `setMode` leaving analysis 会清 workspace，见 `src/modules/sabaki.js:494`。 |
| Persistence writes | 无。 | 无。 |
| 禁止污染 | stale `ensureAnalysisReady` 不得重开 territory/compare；scratch result 不得写 game-tree live state。 | overlay generation 基础已具备，缺测试。 |

### analysis -> snapshot problem child tab

| Effect | Contract | 当前代码 |
| --- | --- | --- |
| Precondition | `mode:'analysis'`；有 scratch/current snapshot；source tab/Attempt read-only。 | `workbenchFlowService.snapshotFromCurrentContext` 当前不限制 mode，见 `src/modules/training/workbench/workbenchFlowService.ts:193`。 |
| Workbench tab patch | 原 tab 不变；创建 child tab `{mode:'problem', parentTabId}`；parent `childTabIds` 增加。 | child tab flow 已有，见 `src/modules/training/workbench/workbenchTabService.ts:206`。 |
| Runtime patch | 原 runtime 不变；child tab 初始化自己的 problemView/attempt。 | 当前 open child task/problem 路径需统一。 |
| Overlay patch | 原 analysis overlay 可保持；child problem 默认 off。 | 未统一。 |
| Engine / analysis side effect | capture snapshot；不得复用 source live target。 | snapshot service no-mutation 测试已有。 |
| Persistence writes | create Problem / Task / child Attempt；可写 parent-child trace；不得 update source Attempt。 | `analysisNoMutation` 测试覆盖原 Attempt 不变。 |
| 禁止污染 | snapshot 不得把 scratch edits 写回 source Attempt/tree。 | 当前 snapshot from non-analysis 太宽，应收紧。 |

## 非法 Transition 与污染风险

| 非法 transition / action | 为什么非法 | 错误执行会污染什么 | 防护 |
| --- | --- | --- | --- |
| `recall -> submit` | Recall submit 语义是 RecallAttempt，不是 Attempt submit。 | 可能重新 freeze source Attempt 或覆盖 result/status。 | action resolver 按 mode 分派；service 层拒绝 frozen Attempt submit。 |
| `analysis -> submit` | Analysis 没有 mutable Attempt。 | scratch edits 被当作真实 userLine/result。 | `ModeState.analysis` 不暴露 `MutableAttempt`。 |
| `non-analysis -> returnFromAnalysis` | 没有 scratch exit context。 | 清错 overlay/engine，丢 source runtime。 | transition precondition 校验当前 mode。 |
| `analysis -> arbitrary mode` | 只能回 previousMode 或 snapshot child。 | recallView/problemView 互串，previousMode 丢失。 | `returnFromAnalysis(previousMode)` 不接受任意 target。 |
| `recall -> play/problem` 未完成退出 | Recall session/checkpoint 仍 active。 | 后续 board click 可能同时写 recall 和 game tree。 | 必须 complete/abandon/pause recall。 |
| `play/problem/recall -> snapshot problem` | snapshot 应是 analysis scratch 的派生。 | live mutable Attempt 被复制成 child problem，source trace 混乱。 | snapshot precondition 限制 analysis + scratch workspace。 |
| 非 analysis toggle territory/compare | territory/compare 依赖 analysis/ownership source。 | stale ownership 被显示到 play/recall/problem。 | `OverlayStore` 已拒绝；补 UI disabled 和 async 测试。 |
| Recall 修改 Attempt.userLine/result/status | Recall 是 follow-up session，不是原 attempt 编辑。 | frozen Attempt 被训练复盘污染。 | `FrozenAttempt` 类型 + repository allowlist。 |
| Analysis snapshot 修改原 Attempt | snapshot 是派生 Problem/Task。 | 原训练记录被派生题污染。 | snapshot tests + service guard。 |
| scratch analysis 写 game tree | scratch 是临时工作区。 | SGF tree 出现分析摆棋产生的节点/props。 | `AnalysisTarget` discriminated union；executor 分离。 |
| game-tree live analysis 写 scratch | live analysis 是当前真实 tree 的分析。 | analysis panel/territory 展示错 target。 | engine update 必须携带 target id 并校验。 |

## 现有最高风险点

1. **Problem mode 双重真相**

   `WorkbenchMode` 有 `problem`，但 board resolver 没有 problem branch，legacy 通过
   `sabaki.state.mode === 'play' && runtime.problemView` 截获 problem move。

   - `src/modules/workbench/board-interactions/resolveBoardInteraction.ts:251`
   - `src/modules/workbench/contracts/workspaceDefaults.ts:19`
   - `src/modules/sabaki.js:2358`

   合同要求：`WorkbenchTab.mode` 是主 region；legacy `sabaki.state.mode` 只能是 adapter projection。

2. **Frozen Attempt guard 不完整**

   `attemptService.appendMove` 会拒绝非 playing attempt，但 repository/db patch 能直接写
   `userLine/result/status`。

   - `src/modules/training/attempt/attemptService.ts:71`
   - `src/modules/training/repository/trainingRepository.ts:234`
   - `src/modules/db.js:595`

   合同要求：冻结后只允许写独立 followup state，或显式 allowlist metadata。

3. **Recall complete 污染 Attempt**

   `recallService.completeRecall` 写回 source Attempt：

   - `src/modules/training/recall/recallService.ts:183`

   合同建议：`recallCompleted` / next-stage status 放到 RecallSession、FollowupState 或独立
   AttemptProgress 表；若必须保留在 Attempt，必须声明为 frozen metadata allowlist，并禁止写
   `userLine/result/status`。

4. **Problem undo 不回滚 Attempt**

   `problemFlowService.undoProblemMove` 更新 runtime cache；legacy controller 导航 tree parent；
   但 Attempt.userLine 不回滚。

   - `src/modules/training/problem/problemFlowService.ts:237`
   - `src/modules/training/controller/legacyTrainingFlowController.ts:452`

   合同要求：problem undo 后 tree、runtime、Attempt line 三者长度一致。

5. **Analysis enter/exit effect 被拆散**

   `workbenchFlowService.enterAnalysis` 只 patch tab；真正 create workspace、overlay mode change、
   scratch analysis schedule 在 `sabaki.setMode('analysis')`。

   - `src/modules/training/workbench/workbenchFlowService.ts:141`
   - `src/modules/sabaki.js:494`

   合同要求：ModeEnterEffect / ModeExitEffect 是一个原子编排单元。

6. **Recall 仍可能显示 analysis projection**

   `resolveAnalysisDisplay` 允许 recall 显示 analysis。

   - `src/modules/overlays/resolveAnalysisDisplay.ts:54`

   如果产品合同要求 recall 不暴露 analysis hint，需要在 projection 层关闭，并加测试。

7. **snapshotFromCurrentContext 入口过宽**

   当前 tests 允许任意 mode snapshot；合同要求 `analysis -> snapshot problem child tab`。

   - `src/modules/training/workbench/workbenchFlowService.ts:193`
   - `test/training/workbenchFlowService.test.js:560`

   合同要求：非 analysis snapshot rejected；原 tab/Attempt 不变。

## TypeScript 类型合同

```ts
type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis';

type MutableAttempt = TrainingAttempt & {
  status: 'playing';
  userLine: string[];
  moveActors: MoveActor[];
};

type FrozenAttempt = Omit<TrainingAttempt, 'status' | 'userLine' | 'moveActors'> & {
  status: Exclude<TrainingAttemptStatus, 'playing'>;
  readonly userLine: readonly string[];
  readonly moveActors: readonly MoveActor[];
};

type PlayCompanion = {
  kind: 'play';
  attempt?: MutableAttempt;
  pendingMoveEvaluations: MoveEvaluation[];
  visibleBadMoveIds: string[];
};

type ProblemCompanion = {
  kind: 'problem';
  attempt: MutableAttempt;
  problemView: ProblemView;
  pendingMoveEvaluations: MoveEvaluation[];
  visibleBadMoveIds: string[];
};

type RecallCompanion = {
  kind: 'recall';
  sourceAttempt: FrozenAttempt;
  recallView: RecallView;
  activeCheckpoint?: RecallCheckpoint;
  correctionDraft?: string;
};

type AnalysisCompanion = {
  kind: 'analysis';
  previousMode: Exclude<WorkbenchMode, 'analysis'>;
  sourceAttempt?: FrozenAttempt;
  sourceRecallSessionId?: string;
  scratch: {
    workspaceId: string;
    currentSnapshotId: string;
    referenceSnapshotId?: string;
  };
};

type OverlayRegion =
  | {
      kind: 'off';
      territoryEnabled: false;
      territoryCompareEnabled: false;
    }
  | {
      kind: 'territory';
      owner: 'analysis';
      source: 'game-tree' | 'scratch-current';
      pending: boolean;
      unavailableReason?: OverlayUnavailableReason;
    }
  | {
      kind: 'compare';
      owner: 'analysis';
      source: 'scratch-current-vs-reference';
      pending: boolean;
      unavailableReason?: OverlayUnavailableReason;
    };

type EngineAnalysisRegion =
  | {kind: 'none'}
  | {
      kind: 'game-tree-live';
      targetTreePosition: TreePosition;
      mayWrite: 'engine-cache-and-move-evaluation';
    }
  | {
      kind: 'scratch';
      workspaceId: string;
      mayWrite: 'edit-workspace-only';
    };

type ModeState =
  | {
      mode: 'play';
      tab: WorkbenchTab & {mode: 'play'};
      companion: PlayCompanion;
      overlay: OverlayRegion;
      engine: EngineAnalysisRegion;
    }
  | {
      mode: 'problem';
      tab: WorkbenchTab & {mode: 'problem'};
      companion: ProblemCompanion;
      overlay: OverlayRegion;
      engine: EngineAnalysisRegion;
    }
  | {
      mode: 'recall';
      tab: WorkbenchTab & {mode: 'recall'};
      companion: RecallCompanion;
      overlay: OverlayRegion;
      engine: EngineAnalysisRegion;
    }
  | {
      mode: 'analysis';
      tab: WorkbenchTab & {mode: 'analysis'};
      companion: AnalysisCompanion;
      overlay: OverlayRegion;
      engine: EngineAnalysisRegion;
    };

type PersistenceWrite =
  | {kind: 'attempt-freeze'; attemptId: string}
  | {kind: 'attempt-finalize'; attemptId: string}
  | {kind: 'move-evaluation-upsert'; evaluationId: string}
  | {kind: 'bad-move-create'; badMoveId: string}
  | {kind: 'recall-session-create' | 'recall-session-update'; recallSessionId: string}
  | {kind: 'recall-attempt-create'; recallAttemptId: string}
  | {kind: 'recall-checkpoint-update'; checkpointId: string}
  | {kind: 'move-comment-create'; commentId: string}
  | {kind: 'problem-create'; problemId: string}
  | {kind: 'task-create'; taskId: string};

type ForbiddenWrite =
  | {target: 'attempt.userLine' | 'attempt.result' | 'attempt.status'; after: 'attempt-frozen'}
  | {target: 'game-tree'; during: 'scratch-analysis'}
  | {target: 'editWorkspace'; during: 'game-tree-live-analysis'}
  | {target: 'overlay.territory' | 'overlay.compare'; outside: 'analysis'}
  | {target: 'problemView'; outside: 'problem'}
  | {target: 'recallView'; outside: 'recall-or-analysis-return-context'};

type TransitionEffect = {
  name: string;
  precondition(ctx: ModeState): boolean;
  tabPatch: Partial<WorkbenchTab>;
  runtimePatch: Partial<TrainingRuntimeState>;
  overlayPatch: Partial<OverlayState>;
  engineEffects: EngineEffect[];
  persistence: PersistenceWrite[];
  forbiddenWrites: ForbiddenWrite[];
};

type ModeExitEffect = Pick<
  TransitionEffect,
  'runtimePatch' | 'overlayPatch' | 'engineEffects' | 'forbiddenWrites'
>;

type ModeEnterEffect = Pick<
  TransitionEffect,
  'tabPatch' | 'runtimePatch' | 'overlayPatch' | 'engineEffects' | 'persistence'
>;
```

这些类型不是临时建议，而是后续实现应收束到的合同形状。实现可以分阶段落地，但新增
mode、transition、overlay 或 engine/analysis 行为必须能投影到这些 discriminated union。

设计重点：

- `mode` 是主 region。
- `OverlayRegion` 和 `EngineAnalysisRegion` 是受 mode 约束的 orthogonal region。
- `MutableAttempt` 只在 Play/Problem 中出现。
- Recall/Analysis 只能拿到 `FrozenAttempt`。
- snapshot、checkpoint、comment、evaluation 都是独立 persistence write，不是对 Attempt 的隐式补丁。

## 测试用例矩阵

| 测试 | Given | When | Then | 当前覆盖 |
| --- | --- | --- | --- | --- |
| submit 冻结 Attempt 后进入 Recall | Play/Problem active attempt，problemView 可存在 | submit | Attempt frozen；RecallSession created；tab mode recall；`problemView=null`；overlay off；active checkpoint clear | submit/clear problemView 已有：`test/training/workbenchFlowService.test.js:396`；overlay/checkpoint/monitor 缺。 |
| Recall move 不修改 frozen Attempt | frozen source Attempt + active recall session | submitRecallMove correct/wrong | create RecallAttempt；advance RecallSession 或 checkpoint；`repository.updateAttempt` 不被调用 | recall move 有基础覆盖；需要加 updateAttempt spy。 |
| completeRecall 不污染 Attempt | active recall completed | completeRecall | 只写 RecallSession/followup；不写 `Attempt.userLine/result/status` | 当前代码会写 Attempt status；需要先决策或改测试。 |
| enterAnalysis 初始化 scratch workspace | source mode play/problem/recall | enterAnalysis | tab previousMode set；`editWorkspace` created；scratch analysis scheduled；territory pending allowed | tab patch 有测：`test/training/workbenchFlowService.test.js:471`；workspace/overlay 缺。 |
| leaveAnalysis 清 scratch overlay/compare | analysis + territory/compare enabled + pending ensure | return previous | territory/compare false；editWorkspace null；late async result ignored | overlay clear 有测：`test/overlays/overlayStore.test.js:63`；late async 缺。 |
| engine analysis update 只解析 pending MoveEvaluation | active monitor + pending eval + frozen Attempt | analysis-update | MoveEvaluation updated；BadMove maybe created；Attempt untouched | monitor eval 有测：`test/training/playTrainingMonitor.test.js:130`；Attempt no-write spy 缺。 |
| snapshotFromAnalysis 保持 source 不变 | analysis scratch workspace + source Attempt/tab | snapshot | source tab/Attempt unchanged；child Problem/Task created；child tab parent linked | no-mutation 有测：`test/training/analysisNoMutation.test.js:188`；非 analysis reject 缺。 |
| snapshot from non-analysis rejected | play/problem/recall | snapshot | throw or no-op；no Problem/Task created | 当前 tests 允许任意 mode，需改。 |
| problem undo 同步回滚 | problem attempt line length N | undo | tree parent；runtime cache rollback；Attempt.userLine length N-1 | 当前缺，且代码有风险。 |
| recall hides analysis projection | recall mode + active engine analysis | render overlay/analysis display | no AI next/sibling/territory compare shown | 当前 `resolveAnalysisDisplay` 允许 recall；需按产品 contract 改。 |
| ModeBar illegal transition disabled | any mode | click invalid mode action | 不调用 flow 或 flow 拒绝；无 partial patch | 当前 ModeBar 无 policy，需补。 |
| stale scratch analysis result ignored | enter analysis，schedule scratch，leave before resolve | stale onAnalysisUpdate | 不重建 editWorkspace，不写 overlay，不写 source tree | scratchAnalysis 有 generation/current guard；需测试。 |

## 推荐落地顺序

1. 定义 `ModeState` / companion state resolver，只读聚合现有 store，不先改业务。
2. 给 `workbenchFlowService` 增加 `ModeEnterEffect` / `ModeExitEffect`，把 tab patch、runtime patch、overlay patch、engine side effect 收束到一个入口。
3. 收紧 Attempt 写入：repository 层区分 mutable/frozen write，Recall/Analysis 只能拿 `FrozenAttempt`。
4. 把 Problem 从 legacy `play + problemView` 迁到显式 `mode:'problem'` resolver/executor。
5. 收紧 snapshot precondition：只允许 Analysis scratch workspace 派生 child Problem/Task。
6. 补测试矩阵，尤其是 transition patch 和 stale async pollution。
