Date: 2026-05-27
Status: pending-confirmation

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `AGENTS.md` | `架构边界`; `Workbench 状态机实现原则` | `WorkbenchMode` 是父状态机；mode 迁移必须走 `workbenchFlowService` 或同职责 service；analysis scratch 是 child region；child region 不能反向修改 mode；resolver/store 不得写 engine、DB、UI 或隐藏全局。 |
| `docs/product/sabaki-training-prd.md` | L8-L20 | 当前产品真源为 active PRD，运行态状态机以 mode orchestration contract 为准，架构以 Architecture v0.5 为准，棋盘读写以 Position Source/Mutation Contract 为准。 |
| `docs/product/sabaki-training-prd.md` | L235-L269 | 运行态 mode 只有 Play / Problem / Recall / Analysis；Snapshot 可在任意 mode 被发现，但创建题目前必须进入 Analysis scratch/current，不能从 live mutable context 直接派生 Problem。 |
| `docs/product/sabaki-training-prd.md` | L501-L614, L1558-L1564 | Analysis Mode 的 edit bar 操作当前 scratch/current working position；标注、摆子、删除、撤销/重做只写 scratch/current；不能改写 source `TrainingAttempt.userLine` 或 source game tree。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L89-L116 | UI 只展示，Container/Controller 调 Service，Service 编排业务动作；mode guard/effect 必须收敛，不散落在 UI callback。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L135-L154, L727-L798 | `enterAnalysis` 保存 `AnalysisReturnTarget`，`returnFromAnalysis` 只使用保存的 target，Analysis 不得隐式修改 `Attempt.userLine`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L388-L410 | `analysisService` 是 AI 分析结果缓存和事件源；不负责 BadMove、RecallCheckpoint、Attempt result、Review schedule。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L473-L508 | `workbenchStore` 拥有 tab/mode/analysisContext/analysisReturnTarget 字段；scratch region 不直接拥有 WorkbenchTab。 |
| `docs/architecture/workbench-architecture-overview.md` | L473-L485 | 长期 ownership：`workbenchStore` 拥有 editWorkspace/working positions，`analysisService` 拥有 scratch/game-tree/variation analysis lifecycle 和 write-back boundary；迁移期仍在 `sabaki.state` 的切片必须记录迁出目标。 |
| `docs/architecture/workbench-architecture-overview.md` | L487-L510, L742-L772 | Scratch analysis 调度应从 `sabaki.js` 迁到 `src/modules/analysis/scratchAnalysis.js`；scratch-analysis 是 distinct source，cache key/ownership/write-back 边界由 scratch analysis service 拥有，且不写 SGF tree。 |
| `docs/architecture/position-source-mutation-contract.md` | L27-L43, L81-L153 | `PositionSource` 区分 `game-tree` 与 `scratch`；`scratchEdit` 可写 working positions 和触发 engine analysis，但禁止写当前 SGF game tree、真实历史和当前 game-tree node。 |
| `docs/design/workbench-mode-orchestration-contract.md` | L19-L48, L121-L146 | Mode 是父 region，board/overlay/engine/analysis 受 mode 约束；Analysis board click 写 scratch workspace 并触发 scratch analysis，禁止写 source Attempt/tree。 |
| `docs/design/workbench-mode-orchestration-contract.md` | L180-L187, L201-L211, L285-L293 | `play/problem/recall -> analysis` 必须 create scratch workspace、schedule scratch analysis；`analysis -> previous` 必须清/失效 editWorkspace 并 ignore stale scratch result；`ModeEnterEffect` / `ModeExitEffect` 应成为原子编排单元。 |
| `docs/design/workbench-mode-orchestration-contract.md` | L352-L396, L440-L446, L481-L496 | AnalysisCompanion 必须包含 scratch workspace ids；EngineAnalysisRegion `kind:'scratch'` 只能写 `edit-workspace-only`；测试矩阵要求 stale scratch analysis result ignored。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | L21-L28, L121-L158, L190-L219 | Analysis scratch 是 child region，owner 为 analysis/scratch adapter；进入 Analysis 创建 scratch/current、schedule scratch analysis、使用 `workspaceId`/generation guard 忽略 stale result，退出时 teardown 或 mark inactive；flow 只发 transition intent。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | L800-L819 | UI spec 只约束 Analysis 底部 edit bar 与 Snapshot 可见位置；自由摆棋默认使用 scratch / `ExplorationBranch`，不污染 Attempt。本文不设计视觉或控件样式。 |
| `src/modules/training/workbench/modeTransitions.ts` | L65-L140, L238-L247 | 当前 pure transition policy 已将 snapshot 收紧为 analysis-only，`enterAnalysis`/`returnFromAnalysis` 不执行 effect；本 slice 不向纯 transition policy 添加副作用。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | L100-L125, L609-L660, L662-L720, L762-L819 | 当前 flow 通过 `ModeEnterEffect`/`ModeExitEffect` port 调用 analysis enter/exit side effect；step2.2 只能通过现有 `modeEffects` seam 测试，任何共享 `workbenchFlowService.ts` 生产改动必须 DEFERRED 到 step3。 |
| `src/modules/analysis/scratchAnalysis.ts` | L17-L24, L115-L125, L127-L248 | 当前 scratch analysis 已有 module-local generation、debounced schedule、editWorkspace-only write-back；缺显式 workspace target/region owner 测试。 |
| `src/modules/analysis/analysisTypes.ts` | L70-L97, L157-L166, L172-L188, L194-L195 | Analysis target 必须是 discriminated union；scratch request group 是 `scratch-analysis`；editWorkspace analysis state 是 scratch write-back target。 |
| `src/modules/analysis/analysisLifecycle.ts` | L96-L116, L567-L574 | request id 已按 requestGroup 区分；active board refresh 在 analysis+editWorkspace 时路由到 scratch analysis。 |
| `src/modules/sabaki.js` | L463-L486, L502-L574, L1702-L1710 | 迁移 seam：legacy `createAnalysisWorkspace` 和 `setMode('analysis')` 仍实际创建/清理 editWorkspace 并调度 scratch analysis；step2.2 必须把它包在 scratch region target/generation 语义后面，不能把它当最终 owner。 |

冲突说明：

- Architecture v0.5 L1871-L1904 仍有 Snapshot 按 mode 直接捕获的旧描述；active PRD L255-L269、L562-L574 与 mode orchestration contract L213-L223 要求先进入 Analysis scratch/current。按 product > architecture > design 优先级，本契约采用 Analysis scratch/current guard。
- 现有 `createSabakiModeEffects` 位于 `workbenchFlowService.ts` L177-L219，含 legacy workspace side effect。因 step2.3 并行也可能触碰同一 shared file，本契约把移动/改写该函数的生产接线 DEFERRED 到 step3 integration；step2.2 只允许新增 analysis-region owner 并通过现有 `modeEffects` seam 注入测试。

## 1. 用户故事

作为正在从 Play / Problem / Recall 进入复盘的用户，我需要系统创建一个独立的 Analysis scratch/current workspace 并针对该 workspace 触发分析；当我返回原 mode、重开 attempt 或快速切换时，旧 workspace 的晚到分析结果不能重建 workspace、不能写到新的 workspace、不能污染正式棋谱或 source Attempt。

## 2. 用户动作

- 点击进入 Analysis / 复盘。
- 从 Recall 完成后进入 Analysis。
- 在非 Analysis mode 点击 Snapshot，系统先进入 Analysis scratch/current，不直接创建题。
- 从 Analysis 返回 previous mode。
- 从 Analysis restart attempt。
- 在 Analysis scratch workspace 中触发 scratch analysis；旧请求晚到。

## 3. 当前阶段

step2.2: Analysis scratch child-region target/generation semantics.

本阶段在 step1 overlay region 和 step2.1 runtime region 完成后执行，可与 step2.3 diagnostics contract/tests 并行。任何会与 step2.3 竞争的 `src/modules/training/workbench/workbenchFlowService.ts` 生产接线改动必须延后到 step3.integration。

## 4. 位置源

| 位置源 | 本契约状态 | 说明 |
| --- | --- | --- |
| `game-tree` | read-only seed | 进入 Analysis 时可从当前 game tree / visible source 复制出 working position，但进入后不得把 scratch analysis 写回 source tree。 |
| `scratch/current` | in-scope owner target | Analysis 主棋盘的 working position；scratch region 进入时必须生成 `{workspaceId, generation}` target。 |
| `scratch/reference` | in-scope result separation | Reference board 可被分析，结果只能写 `referenceAnalysis/referenceOwnership`，不得 bleed into current。 |
| `problem-attempt` | out-of-scope | 做题 runtime region 所属；本 slice 不迁移 problem attempt source。 |
| `reference/current` | applicable | 比较/overlay 可以读 current/reference analysis，但 overlay internals 已由 step1 负责，本 slice只保证 scratch result target 不串写。 |

## 5. 变更契约

| 动作 | 变更契约 | 说明 |
| --- | --- | --- |
| `enterAnalysis` / `completeRecall -> analysis` / Snapshot guard enter | 其他：`scratchRegionEnter` side effect | 不是棋盘落子；它创建/标记 scratch/current workspace target，generation +1，并调度 scratch analysis。 |
| `returnFromAnalysis` / `restartAttempt` | 其他：`scratchRegionExit` side effect | 不是棋盘落子；它使 active scratch target stale，清理/失效 workspace，并让晚到结果 ignored。 |
| Analysis edit bar / board edit | `scratchEdit` | 本 slice不实现 edit bar，但保留其写边界：只写 working position，可触发 scratch analysis。 |
| Snapshot persistence | 无变更 in step2.2 | 只允许 already-analysis + scratch/current 后续持久化；非-analysis 先 enter Analysis。完整 snapshot persistence 不属于本 slice。 |

## 6. 预期状态流

进入 Analysis 的完整链路：

`UI event -> callback prop -> TrainingWorkbenchContainer handler -> workbenchFlowService.enterAnalysis/completeRecall/snapshot guard -> workbenchStore.updateTab({mode:'analysis', previousMode, analysisReturnTarget, analysisContext}) -> overlayRegion.onWorkbenchModeTransition -> analysisScratchRegion.enterAnalysis(modeEffect input) -> legacy ModeEnterEffect adapter creates/stamps editWorkspace + schedules scratch analysis with {workspaceId,generation,tabId,targetTab} -> scratchAnalysis.refreshScratchAnalysis -> runBoardAnalysis(requestGroup:'scratch-analysis', analysisSource:'scratch-analysis') -> guarded editWorkspace-only write-back -> subscription/projection -> Analysis board/side panel reads scratch/current analysis state`

退出 Analysis 的完整链路：

`UI event -> callback prop -> TrainingWorkbenchContainer handler -> workbenchFlowService.returnFromAnalysis/restartAttempt -> workbenchStore.updateTab({mode:returnTarget.mode, previousMode:undefined, analysisReturnTarget:undefined}) -> overlayRegion.onWorkbenchModeTransition -> analysisScratchRegion.exitAnalysis(modeEffect input) -> active scratch target generation invalidated -> legacy ModeExitEffect adapter clears editWorkspace / leaves analysis -> any late scratch onAnalysisUpdate compares stale target/generation and no-ops -> subscription/projection -> previous mode UI no longer sees scratch workspace`

临时迁移接缝：

- `TrainingWorkbenchContainer._tryInstallModeEffects` currently installs `ctx.createModeEffects()` into flow service (`src/components/TrainingWorkbenchContainer.js` L964-L980). Production `ctx.createModeEffects` currently returns raw `createSabakiModeEffects(this)` (`src/modules/sabaki.js` L1067). Replacing that raw effect with `analysisScratchRegion.wrap(createSabakiModeEffects(...))` is required for production composition but DEFERRED to step3, because it may touch shared orchestration/composition with step2.3.
- step2.2 tests may inject `analysisScratchRegion` through existing `modeEffects` deps/setter and prove behavior without editing `workbenchFlowService.ts`.

## 7. 允许的副作用

- Allocate or update an analysis scratch target: `{kind:'scratch', tabId, workspaceId, generation, status:'active' | 'inactive', sourceMode, reason}`.
- Create / stamp / clear `editWorkspace` through an explicit adapter port during Analysis enter/exit.
- Schedule scratch analysis for `scratch/current` or `scratch/reference` with the active target and request group `scratch-analysis`.
- Write `editWorkspace.currentAnalysis/currentOwnership/referenceAnalysis/referenceOwnership/analysisPending` only when target `{workspaceId,generation}` is current.
- Log/debug stale ignored events with target metadata; logs are not the primary test oracle.

## 8. 禁止的副作用

- Child region modifying `WorkbenchTab.mode`, `previousMode`, `analysisReturnTarget`, `activeAttemptId`, `activeRecallSessionId`, or `recallSubstate`.
- Child region writing `trainingRuntimeStore`, `Attempt.userLine/result/status`, RecallSession/RecallAttempt/Checkpoint, Task/Problem, ReviewSchedule, or repository.
- Scratch analysis writing `state.analysis`, `analysisTreePosition`, SGF props such as `SBKV`/`SBKS`, `documentStore`, `gameTrees`, or current game-tree node.
- Using `window.sabaki` or hidden global lookup inside the scratch region owner.
- Branching main flow by `origin.provider`, `source.kind`, old `source_kind`, `openProblemTab`, `openSnapshotProblemTab`, or source-specific tab APIs.
- Letting `snapshotService` open tabs or orchestrate mode transition.
- Depending on setter order, callback count, or logger messages as the main proof of state-forward/state-return behavior.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| SCR-T01 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `src/modules/analysis/workbenchAnalysisScratchRegion.ts` exports a production scratch-region owner (factory name may be `createWorkbenchAnalysisScratchRegion`) and `src/modules/analysis/index.ts` re-exports it; owner has no store/repository/document/window global imports. | High | 没有 owner 时 effect 继续散落在 legacy mode effects。 |
| SCR-T02 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Region enter creates/stamps one active scratch target with `workspaceId`, `generation`, `tabId`, source mode, and reason, then delegates to the existing legacy workspace adapter without changing WorkbenchTab itself. | High | 测试只看到 editWorkspace 存在，无法判断晚到结果属于哪个 workspace。 |
| SCR-T03 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Region exit invalidates the active target and clears/tears down through adapter; stale result for the old target cannot recreate `editWorkspace`. | High | 返回 mode 后 late scratch result 可能复活 Analysis workspace。 |
| SCR-T04 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | A scratch analysis update/final result carrying old `{workspaceId,generation}` is ignored: no editWorkspace analysis/ownership write, no global analysis write, no source tree write. | High | 最核心 stale-result pollution 仍无保护。 |
| SCR-T05 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Matching target result writes only the matching current/reference keys and sets `analysisPending:false`; reference result must not alter current result. | Medium | current/reference analysis 串写导致 overlay/side panel 显示错对象。 |
| SCR-T06 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Scratch refresh uses `requestGroup:'scratch-analysis'`, `analysisSource:'scratch-analysis'`, and explicit target metadata; game-tree live request group must not update editWorkspace. | High | game-tree live analysis 与 scratch analysis 混用缓存/结果。 |
| SCR-T07 | CONTROLLER_STATE_TRANSITION | MUST_AUTOMATE | Real `createWorkbenchFlowService` + real `workbenchStore` + injected production scratch region: `enterAnalysis`/`returnFromAnalysis` produce tab state transitions and scratch region enter/exit outcomes without mocking flow service. | High | region 只在 isolation 里工作，真实 flow seam 没验证。 |
| SCR-T08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Source scan proves the new scratch region owns target/generation and does not import `trainingRuntimeStore`, `trainingRepository`, `documentStore`, overlay internals, or `window.sabaki`. | High | child region 越界成新的巨型 orchestration bucket。 |
| SCR-D01 | ARCHITECTURE_BOUNDARY | DO_NOT_TEST | Moving raw `createSabakiModeEffects` implementation out of `workbenchFlowService.ts` or replacing it there. | Deferred | Shared `workbenchFlowService.ts` production edit conflicts with step2.3; step3.integration owns it. |
| SCR-D02 | CONTROLLER_STATE_TRANSITION | DO_NOT_TEST | Production `sabaki.getTrainingContext().createModeEffects` composition uses scratch region wrapper by default. | Deferred | Requires production composition edits beyond `src/modules/analysis/*`; step3.integration owns it. |
| SCR-D03 | STORE_SUBSCRIPTION | DO_NOT_TEST | Rendered UI return / panel props after scratch result. | Deferred | This slice is region/state boundary; rendered UI was not requested and would broaden into frontend verification. |
| SCR-D04 | SIDE_EFFECT_BOUNDARY | DO_NOT_TEST | Full engine ownership migration so every engine callback carries target id. | Deferred | Engine ownership migration explicitly out of scope; only scratch request target guard is in scope. |

## 10. 必须自动化的测试

Layered test contract:

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCR-T01 | ARCHITECTURE_BOUNDARY | `src/modules/analysis/workbenchAnalysisScratchRegion.ts` and `src/modules/analysis/index.ts` | real filesystem source | none | real production interface/type | mocked module loader returning fake exports | Factory/export exists; source has no forbidden imports/globals. | SCR-T07 |
| SCR-T02 | SIDE_EFFECT_BOUNDARY | production scratch region owner | production region implementation | local tiny legacy effect delegate; stateful adapter implementing exported scratch adapter interface | real production interface/type | mocked scratch region; mocked workbenchFlowService; logger-only assertion | `enterAnalysis(input)` creates active target and stamps/creates editWorkspace without writing WorkbenchTab. | SCR-T07 |
| SCR-T03 | SIDE_EFFECT_BOUNDARY | production scratch region owner | production region implementation | local tiny legacy effect delegate; stateful adapter implementing exported scratch adapter interface | real production interface/type | mocked scratch region; hand-mutated final state | `exitAnalysis(input)` invalidates target and late old target cannot recreate editWorkspace. | SCR-T07 |
| SCR-T04 | SIDE_EFFECT_BOUNDARY | production scratch region + `refreshScratchAnalysis`/guarded commit path | real `scratchAnalysis.ts` functions where possible; production region guard | `RunBoardAnalysis` controlled promise stub typed as production `RunBoardAnalysis`; local adapter fake | real production interface/type | fake `setState` that silently filters writes; mocked region; source-tree mutation spy as only oracle | Old target/generation update produces zero editWorkspace/global analysis/source tree writes. | SCR-T07 |
| SCR-T05 | SIDE_EFFECT_BOUNDARY | `refreshScratchAnalysis` guarded current/reference write-back | real `scratchAnalysis.ts` functions | production-typed `RunBoardAnalysis` stub returning current/reference results | real production interface/type | asserting callback count only; manual writes to expected keys | Matching target updates only the matching analysis/ownership keys and final pending false. | SCR-T07 |
| SCR-T06 | SIDE_EFFECT_BOUNDARY | `refreshScratchAnalysis` and request options | real `scratchAnalysis.ts` functions | production-typed `RunBoardAnalysis` spy; local syncer fake | real production interface/type | mocked analysisService; string-only source scan as sole proof | Request options include `requestGroup` and `analysisSource` equal `scratch-analysis` plus target metadata; game-tree request cannot update editWorkspace. | SCR-T07 |
| SCR-T07 | CONTROLLER_STATE_TRANSITION | real `createWorkbenchFlowService` with injected production scratch region | real `createWorkbenchFlowService`, real `createWorkbenchStore`, production scratch region | repository/attempt/recall/snapshot tiny stubs from existing flow harness; stateful legacy adapter fake | real production interface/type | mocked `workbenchFlowService`; mocked `workbenchStore.updateTab`; direct tab mutation after call | `enterAnalysis` creates tab analysis state and active scratch target; `returnFromAnalysis` restores mode and invalidates scratch target. | SCR-D02 |
| SCR-T08 | ARCHITECTURE_BOUNDARY | source text of scratch region module | real filesystem source | none | real production interface/type | per-file fake module source | Source forbids `window.sabaki`, repository/store/document imports, `openProblemTab`/source-specific APIs, and direct WorkbenchMode writes. | SCR-D02 |

Mock policy:

- Any fake scratch adapter used in tests must implement the exported production adapter/type from the scratch region module. If that type does not exist, test-writer must first require it in SCR-T01 instead of hand-writing a drifting full-service fake.
- `WorkbenchFlowService`, `WorkbenchTabService`, `SnapshotService`, repository ports, and runtime store must not be per-file hand-written spies for tests that claim `CONTROLLER_STATE_TRANSITION` or state-forward/state-return coverage. Use real `createWorkbenchFlowService` and real `createWorkbenchStore` for SCR-T07.
- Local tiny stubs are allowed only for a single callback/delegate such as the legacy `ModeEnterEffect`/`ModeExitEffect` delegate or `RunBoardAnalysis` promise resolution, and must be typed by production interfaces.
- A callback-called-once assertion may be auxiliary only. The primary assertion must be final target/workspace/write-back state.

## 11. 仅手动验收

| ID | 验收项 | 理由 |
| --- | --- | --- |
| SCR-M01 | Manual smoke after step3: enter Analysis, toggle/edit scratch, return, and visually confirm no stale workspace/overlay returns. | Requires production composition and UI runtime; not needed for step2.2 contract/tests. |

## 12. 不测试

| ID | 项目 | 原因 |
| --- | --- | --- |
| SCR-N01 | Analysis edit bar visual placement, CSS, icon state, responsive behavior. | 前端视觉任务，不属于 contract-designer scope。 |
| SCR-N02 | Runtime companion cleanup for problem/recall/checkpoint. | step2.1 already owns runtime region. |
| SCR-N03 | Overlay owner internals. | step1 already owns overlay region. |
| SCR-N04 | modeStateResolver preflight/postflight diagnostics consumption. | step2.3 owns diagnostics. |
| SCR-N05 | Persistent fact repair for Attempt/RecallSession/Task/SGF/comment/review. | Explicitly out of scope and forbidden as silent repair. |
| SCR-N06 | Full engine ownership migration. | Out of scope; this slice only requires scratch target/generation and stale-result guard. |

## 13. 脆弱测试警告

- 不要把 `modeEffects.enterAnalysis` 被调用一次当成通过标准；必须断言 active scratch target、workspaceId/generation、write-back boundary 和 stale ignore。
- 不要断言 exact setter order。允许 region先标 target 后 delegate，也允许 delegate 后 stamp workspace，只要最终状态和 stale guard 满足契约。
- 不要用 logger 事件作为主 oracle。日志只能辅助诊断。
- 不要只做 source string scan 来证明 state-forward；source scan只能证明 ARCHITECTURE_BOUNDARY，SCR-T07 必须走真实 flow service。
- 不要把当前 legacy `sabaki.setMode('analysis')` 自动创建 workspace 当作最终 owner；它只是迁移 seam。
- 不要为简单 getter 或常量重复测试，除非它证明 requestGroup/source target 隔离。

## 14. 超出范围

- 修改 UI/CSS/视觉验收。
- 修改 runtime companion region、overlay internals、diagnostics consumption。
- 修改 `modeTransitions.ts` 纯 policy，除非发现 step2.2 明确冲突；当前无需修改。
- 修改 production `src/modules/training/workbench/workbenchFlowService.ts` 来承载 scratch owner 或移动 `createSabakiModeEffects`。该共享生产接线延后 step3。
- 让 `snapshotService` 承担 tab opening、mode transition 或 flow orchestration。
- 修复 legacy fallback click path 的全部 Analysis edit 行为；本 slice 只约束 enter/exit target/generation 和 scratch analysis stale guard。

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当流程分支 | 不允许 | Architecture v0.5 L100-L110 禁止按 provider 分叉主流程；modeStateResolver 当前仅做 diagnostics。 | Scratch target 由 mode transition + workspace 生成，不读 origin/provider。SCR-T08 source scan。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API | 不允许 | Architecture v0.5 L23-L35 明确 v0.4 API 只能作为迁移背景。 | SCR-T08 source scan禁止。 |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 不允许 | Architecture v0.5 L1146-L1158 指明 `SnapshotService` 不创建 Tab，完整流程由 flow service 编排。 | 本 slice不改 snapshotService；Snapshot persistence 行为 DEFERRED/现有 guard。 |
| 是否让 container 直接写 store | 不允许 | Architecture v0.5 L180-L198 命令写路径为 UI -> Container/Controller -> Service -> Store。 | 本 slice不改 Container；SCR-T07 走 real flow service。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不新增 | UI/UX spec 只提供控件位置；Architecture v0.5 L89-L98 要求 UI展示、Container调Service。 | 不写 UI。 |
| 是否让 scratch region 修改 WorkbenchMode | 不允许 | Implementation notes L121-L125 child region只接收 transition intent；AGENTS 禁止 child region 反向改 mode。 | Scratch region只能写自身 target/editWorkspace adapter；mode由 flow service写。 |
| 是否让 store 调 engine/DB/UI/IPC | 不允许 | AGENTS store boundary；Architecture v0.5 L100-L110。 | Scratch analysis side effect放在 analysis region/service，不放 store。 |
| 是否让 resolver 执行副作用或自动修复 | 不允许 | Implementation notes L63-L90, L190-L203。 | 本 slice不改 resolver；diagnostics consumption step2.3。 |
| 是否让 scratch analysis 写正式 game tree 或 Attempt | 不允许 | Position contract L133-L153；orchestration contract L238-L239, L440-L446。 | SCR-T04/SCR-T06 验证。 |
| 是否与 Architecture v0.5 Snapshot 旧段落冲突 | 有冲突，产品优先 | Architecture v0.5 L1894-L1902 说 Snapshot 可按 mode 直接捕获；PRD L255-L269/L562-L574 要求先进入 Analysis scratch。 | Contract采用 PRD/设计 guard；直接按 mode persistence 不进入 step2.2。 |

## 16. Workbench 接线清单（如适用）

本 slice 不是前端控件接线任务；以下仅描述 mode-effect/region 接线，不要求 UI panel callback plumbing。

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Enter Analysis action | `enterAnalysis` | `TrainingWorkbenchContainer` delegates; `workbenchFlowService` owns transition; scratch region owns workspace target | PRD L501-L614; Arch L752-L756 | tab mode -> analysis; scratch target active; editWorkspace created/stamped | Analysis projection sees scratch/current and `scratchEdit` | SCR-T02, SCR-T07 | step2.2 tests; production composition step3 |
| Complete Recall -> Analysis | `completeRecall` then enter Analysis effect | `workbenchFlowService`; runtime cleanup step2.1; scratch region target step2.2 | Orchestration L189-L199 | tab mode -> analysis; scratch target active; runtime cleanup handled by runtime region | Analysis projection reads source trace + scratch | SCR-T02/SCR-T07 with reason `recall-complete` if practical | step2.2 tests |
| Return from Analysis | `returnFromAnalysis` | `workbenchFlowService` parent; scratch region exit | Arch L758-L760; Orchestration L201-L211 | tab restored to saved target; scratch target inactive; editWorkspace cleared/invalidated | Previous mode projection no scratch | SCR-T03, SCR-T07 | step2.2 tests |
| Restart Attempt from Analysis | `restartAttempt` | `workbenchFlowService` parent; scratch region exit | Arch L762-L763 | tab exits analysis; scratch target inactive | target mode projection no scratch | Optional in SCR-T03 or SCR-T07; can be deferred if return path covers same exit effect | step2.2 tests |
| Scratch analysis async result | guarded write-back | `analysisScratchRegion` + `scratchAnalysis` | Notes L148-L158; scratchAnalysis.ts L127-L248 | matching target writes editWorkspace only; stale target no-ops | projection receives only current workspace result | SCR-T04, SCR-T05, SCR-T06 | step2.2 tests |
| Production default mode effects composition | `ctx.createModeEffects()` wrapper | `sabaki.getTrainingContext` composition + flow service setter | Container L964-L980; sabaki.js L1067 | default app uses scratch region wrapper, not raw legacy effect | real UI gets same region behavior | SCR-D02 | step3.integration |

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| step2.2.contract | this file only | step1.review, step2.1 complete | 只读设计/源码并写契约 | 无 |
| step2.2.tests | `test/analysis/workbenchAnalysisScratchRegion.test.ts` or `test/training/workbenchScratchRegion.test.ts`; optional focused additions to `test/scratchAnalysisTests.js` | approved contract | 不改 production；只锁 scratch tests | 需避免修改 shared flow tests过大；若需要 flow test，使用 existing `modeEffects` injection seam。 |
| step2.2.impl | `src/modules/analysis/workbenchAnalysisScratchRegion.ts`, `src/modules/analysis/index.ts`, possible small additions in `src/modules/analysis/scratchAnalysis.ts`/types | test audit approval | 与 step2.3 diagnostics disjoint | 不得改 shared `workbenchFlowService.ts`; if required, leave RED/DEFERRED to step3。 |
| step2.3.contract/tests/impl | `modeStateResolver.ts`, diagnostics tests | step1.review | Does not need analysis scratch files | Shared `workbenchFlowService.ts` integration must wait step3。 |
| step3.integration | `workbenchFlowService.ts`, `src/modules/sabaki.js`, production composition tests | step2.1/2.2/2.3 reviews | Serial integrator resolves shared seams | Highest risk: ordering between runtime cleanup, scratch enter/exit, overlay, diagnostics pre/postflight。 |

## 18. RED/GREEN/DEFERRED 状态表

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `analysisScratchRegion` export | module boundary | Exists under `src/modules/analysis/*`, exported through `analysis/index.ts`, no forbidden imports/globals. | SCR-T01 | RED | No explicit scratch region owner yet. |
| `enterAnalysis` target | play/problem/recall -> analysis | Creates active `scratch` target with `workspaceId` + generation and stamps/creates editWorkspace. | SCR-T02 | RED | Current raw `ModeEnterEffect` creates workspace but has no explicit target/generation semantics. |
| `completeRecall` target | recall -> analysis | Same as enter with reason `recall-complete`; runtime cleanup not in this slice. | SCR-T02/SCR-T07 | RED | Flow calls enter effect, but no scratch region target owner. |
| `returnFromAnalysis` exit | analysis -> previous | Invalidates target and clears/tears down workspace; old result cannot re-open workspace. | SCR-T03/SCR-T07 | RED | Legacy exit clears workspace, but no target invalidation proof. |
| `restartAttempt` exit | analysis -> play/problem/recall | Same exit semantics as return path. | SCR-T03 or optional SCR-T07 | DEFERRED | Approved reason: return path proves exit owner; restart full integration can land in step3 if test scope grows. Exit condition: step3 verifies both exit callers use same scratch region. |
| stale `onAnalysisUpdate` | exited or new generation | No editWorkspace/global analysis/source tree write for old target. | SCR-T04 | RED | Existing module generation exists, but no workspace target/generation contract test. |
| matching result write-back | active scratch/current | Writes only current keys and sets pending false. | SCR-T05 | GREEN | Existing `scratchAnalysisTests.js` has write-back isolation; add target metadata assertions after region lands. |
| reference result write-back | active scratch/reference | Writes only reference keys; current keys unchanged. | SCR-T05 | GREEN | Existing reference bleed test is simulated; make it production refresh path if practical. |
| request group | scratch analysis | `requestGroup:'scratch-analysis'`, `analysisSource:'scratch-analysis'`. | SCR-T06 | GREEN | Existing `scratchAnalysis.ts` sets group/source. |
| request target metadata | scratch analysis | Scratch request/result carries explicit `{workspaceId,generation}` target metadata. | SCR-T06 | RED | Existing scratch path has module generation but no explicit workspace target metadata. |
| game-tree live scheduling | analysis with scratch active | Game-tree live analysis scheduling does not run while analysis+editWorkspace is active. | SCR-T06 | GREEN | `gameTreeAnalysis.ts` skips scheduling when analysis+editWorkspace active. |
| full engine callback target migration | any async engine callback | Every engine callback carries target id and ignores stale target. | SCR-D04 | DEFERRED | Approved reason: engine ownership migration is out of scope. Exit condition: dedicated engine-region slice or step3+ follow-up owns it. |
| production default composition | app runtime | `ctx.createModeEffects()` returns scratch region wrapper around legacy effect. | SCR-D02 | DEFERRED | Step3 integration owns `sabaki.js`/shared composition. |
| shared `workbenchFlowService.ts` cleanup | shared orchestration | Raw workspace effect should eventually leave flow file or be wrapped without direct owner leakage. | SCR-D01 | DEFERRED | Parallel constraint: do not make shared production edit in step2.2. |

## 19. downstream required_constraints

```yaml
required_constraints:
  step2_2_tests:
    allowed_test_scope:
      - test/analysis/workbenchAnalysisScratchRegion.test.ts
      - test/training/workbenchScratchRegion.test.ts
      - test/scratchAnalysisTests.js
      - focused additions to test/training/workbenchFlowService.test.js only if they use existing modeEffects injection and do not require production flow edits
    forbidden:
      - mocked workbenchFlowService for SCR-T07
      - callback-only primary assertions
      - hand-written full fake services not typed by production interfaces
      - production edits
  step2_2_impl:
    allowed_production_scope:
      - src/modules/analysis/workbenchAnalysisScratchRegion.ts
      - src/modules/analysis/index.ts
      - src/modules/analysis/scratchAnalysis.ts
      - src/modules/analysis/analysisTypes.ts
    forbidden_production_scope:
      - src/modules/training/workbench/workbenchFlowService.ts
      - src/modules/training/workbench/modeStateResolver.ts
      - src/modules/training/store/trainingRuntimeStore.ts
      - src/modules/overlays/*
      - UI/CSS/component visual files
    must_defer_to_step3:
      - production createModeEffects composition in src/modules/sabaki.js
      - any shared workbenchFlowService.ts production wiring/change
      - final ordering between runtimeRegion, overlayRegion, diagnostics pre/postflight, and scratchRegion
  architecture_boundaries:
    scratch_region_must_not:
      - write WorkbenchTab.mode or any parent mode field
      - write Attempt/Recall/Task/repository/documentStore/gameTrees
      - read window.sabaki or hidden globals
      - branch on origin.provider/source.kind/source_kind as flow policy
    scratch_region_must:
      - expose a typed adapter/port for legacy workspace side effects
      - carry workspaceId and generation on enter/schedule/result
      - ignore stale target/generation results
      - write scratch analysis results only to editWorkspace/working position state
```
