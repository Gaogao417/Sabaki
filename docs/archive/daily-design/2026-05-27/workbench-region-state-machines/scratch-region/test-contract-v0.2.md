Date: 2026-05-27
Status: revised-for-contract-audit

# 契约草案

本版本修订 `contract-audit-v0.1.md` 的 REQUEST_CHANGES。`Status: revised-for-contract-audit` 表示本文件可进入 contract-audit 重审；审计通过后才可作为 test-writer 的执行范围。

## 0. 真源对齐

### 0.1 Active Source Truth

Active truth 只来自：

1. `docs/product/`
2. `docs/architecture/`
3. `docs/ui_ux/`

优先级固定为：product > architecture > ui_ux。`AGENTS.md`、`docs/design/*`、当前 source、slice plan、checklist 和旧 contract/audit 都是 guardrail、scope ledger 或 implementation evidence；它们不能覆盖 active truth。若派生产物与 active truth 冲突，派生产物作废。

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | L235-L269 | 产品运行态 mode 只有 Play / Problem / Recall / Analysis；Snapshot 全局可发现，但创建 Problem 前必须先投影到 Analysis scratch/current，不能从 live mutable context 直接创建 Problem。 |
| `docs/product/sabaki-training-prd.md` | L560-L614 | Snapshot service 只能从 Analysis scratch/current 派生；Analysis edit bar 是 scratch/current working position 的核心输入，不能改写 `TrainingAttempt.userLine`，底部 Snapshot 与顶部 Snapshot 同一 command path。 |
| `docs/product/sabaki-training-prd.md` | L1558-L1564 | Analysis edit bar 的摆子、删除、标记、线/箭头、清空、撤销/重做只修改 scratch/current working position，不能修改 frozen Attempt 或 source game tree。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L89-L116 | UI 只展示；Container/Controller 读 Store、调 Service；Service 编排业务动作；Store 不调 Service；mode guard/effect 规则不能散落在 UI callback。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L727-L798 | `workbenchFlowService` owns tab mode orchestration；`enterAnalysis` 保存 `AnalysisReturnTarget`，`returnFromAnalysis` 只能使用保存过的 target；Analysis 不得隐式修改 `Attempt.userLine`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L388-L410 | `analysisService` 是 AI 分析结果缓存和事件源，不负责 BadMove、RecallCheckpoint、Attempt result 或 Review schedule。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | L473-L508 | `workbenchStore` owns WorkbenchTab/mode/analysisContext/analysisReturnTarget；scratch region 不得反向拥有或直接改写 WorkbenchTab mode。 |
| `docs/architecture/workbench-architecture-overview.md` | L471-L500 | 长期 ownership：`workbenchStore` owns editWorkspace/working positions；`analysisService` owns scratch/game-tree/variation analysis lifecycle、ownership cache 和 write-back boundary。迁移期 `sabaki.js` 只能作为 facade。 |
| `docs/architecture/workbench-architecture-overview.md` | L744-L772 | Scratch analysis 必须从 working position 运行，distinct source 为 `scratch-analysis`，结果写回不得 dirty current SGF tree、`SBKV`/`SBKS` 或 global analysis state；`scratchAnalysis.js` owns scheduling/cache/write-back boundary。 |
| `docs/architecture/position-source-mutation-contract.md` | L27-L43 | `PositionSource` 区分 `game-tree` 与 `scratch`；`scratch` 是 temporary working snapshot，不隐式 dirty SGF tree，role 可为 current/reference/problem-attempt。 |
| `docs/architecture/position-source-mutation-contract.md` | L133-L153 | `scratchEdit` 可 mutate working positions、触发 engine analysis、保存 working position 为 problem snapshot；禁止写 current SGF game tree、真实 history 或改变 current game-tree node。 |
| `docs/architecture/position-source-mutation-contract.md` | L258-L260 | Edit analysis 的位置源是 `scratch/current`，变更契约是 `scratchEdit`。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | L803-L817 | UI/UX 只约束 Analysis 底部工具位置和文案；Analysis 自由摆棋默认使用 scratch / `ExplorationBranch`，不污染 Attempt；Snapshot 捕获 active branch/current position。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | L939-L952 | Analysis bottom bar 展示标注工具组、Edit position、Snapshot、撤销/重做/清空、缩放；底部 Snapshot 与顶部 Snapshot 必须同语义 command path。 |

### 0.2 Guardrail / Evidence / Scope

| 来源类别 | 文件/行索引 | 用途 | 不可越权点 |
| --- | --- | --- | --- |
| Repository guardrail | `AGENTS.md` L24-L45 | Resolver/store/component/global lookup 边界；WorkbenchMode 父状态机；analysis scratch 是 child region；child region 不能反向修改 WorkbenchMode；测试验证 final outcome。 | 不覆盖 active PRD/Architecture/UI；只收紧边界。 |
| Design guardrail | `docs/design/workbench-mode-state-machine-implementation-notes.md` L121-L158 | Child region 模式：flow 只发送 transition intent；Analysis Scratch Region owner 为 analysis/scratch adapter；进入创建 scratch/current、schedule analysis、用 `workspaceId`/generation 忽略 stale result、退出 teardown/inactive。 | 不作为产品事实；若与 active docs 冲突，以 active docs 为准。 |
| Design guardrail | `docs/design/workbench-mode-orchestration-contract.md` L352-L396 | AnalysisCompanion/EngineAnalysisRegion 的 `workspaceId` 与 `edit-workspace-only` 写边界。 | 仅用于测试 target/generation guard，不新增 active truth 未要求的 UI 行为。 |
| Implementation evidence | `src/modules/training/workbench/workbenchFlowService.ts` L177-L219, L609-L720 | 现有 `modeEffects` seam；`enterAnalysis`/`returnFromAnalysis` 在 real flow 中调用 `activeModeEffects.enterAnalysis/exitAnalysis(input)`。 | step2.2 不修改 shared `workbenchFlowService.ts` production composition；step3.integration owns default composition。 |
| Implementation evidence | `src/modules/analysis/scratchAnalysis.ts` L17-L24, L115-L248 | 现有 module-local generation、`SCRATCH_ANALYSIS_REQUEST_GROUP`、`refreshScratchAnalysis` editWorkspace-only write-back。 | 现有 generation 不是 explicit workspace target/generation；target-aware write-back 仍为 RED。 |
| Implementation evidence | `src/modules/sabaki.js` L463-L486, L502-L574, L1685-L1710 | Legacy `editWorkspace` creation/clear/schedule facade；current composition still routes scratch analysis through play services. | Legacy side effect 是迁移接缝，不是最终 owner。 |
| Workflow scope | `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | step2.2 retry1 只写本 v0.2 contract；step3 handles shared flow/default composition integration. | checklist 不修改；不提交；不写 production/tests。 |

### 0.3 Source Row Coverage

`Status` 仅允许 `GREEN`、`RED`、`DEFERRED`。

| Source Row | Required Behavior | Test ID | Layer | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PRD L255-L269; L562-L574 Snapshot guard | Snapshot 可在任意 mode 被发现，但创建 Problem 前必须先进入 Analysis scratch/current；不能从 Play/Problem/Recall live mutable context 直接创建 Problem。 | SCR-D05 | CONTROLLER_STATE_TRANSITION | DEFERRED | Approved reason: full `snapshotFromCurrentContext` production guard touches shared `workbenchFlowService.ts`/snapshot orchestration and is step3.integration scope. Exit condition: step3 verifies Snapshot command first produces an Analysis scratch target or rejects capture before persistence. |
| PRD L591-L614; L1558-L1564 Analysis edit bar scratch-only | Edit bar mutations are `scratchEdit` against scratch/current working position; no frozen Attempt or source game-tree writes; bottom Snapshot shares top command path. | SCR-T10 | ARCHITECTURE_BOUNDARY | RED | step2.2 covers mutation/write boundary and command-path guardrails, not visual placement or E2E clicks. UI click plumbing remains frontend/workbench wiring scope. |
| Architecture v0.5 L89-L116 service/store boundaries | UI/Container/Service/Store ownership is preserved; no Store->Service, no provider branching, no scattered UI callback effect rules. | SCR-T01, SCR-T08 | ARCHITECTURE_BOUNDARY | RED | New scratch region owner must export typed ports and prove no forbidden imports/globals/direct mode writes. |
| Architecture v0.5 L727-L798 `workbenchFlowService` | Flow service owns mode transitions and saved return target; scratch child region receives transition intent and does not decide mode. | SCR-T07, SCR-T08 | CONTROLLER_STATE_TRANSITION | RED | Must use real flow/store plus injected production scratch region via existing modeEffects seam. Default production composition remains step3. |
| Architecture v0.5 L388-L410 `analysisService` boundary | Scratch analysis may cache/emit analysis updates but must not own BadMove, RecallCheckpoint, Attempt result, or Review schedule. | SCR-T08 | ARCHITECTURE_BOUNDARY | RED | Source scan plus import boundary must forbid training runtime/repository ownership from scratch region. |
| Workbench architecture L471-L500 ownership | `workbenchStore` owns editWorkspace/working positions; `analysisService` owns scratch analysis lifecycle/cache/write-back; `sabaki.js` may be facade only during migration. | SCR-T01, SCR-T02, SCR-T04, SCR-T05B, SCR-T06B | SIDE_EFFECT_BOUNDARY | RED | Explicit scratch owner + target/generation guard required in step2.2. |
| Workbench architecture L744-L772 scratch-analysis write-back | Scratch analysis source is `scratch-analysis`; write-back is editWorkspace-only, no real SGF tree, `SBKV`/`SBKS`, or global analysis state. | SCR-T04, SCR-T05A, SCR-T05B, SCR-T06A, SCR-T06B | SIDE_EFFECT_BOUNDARY | RED | Legacy key isolation/requestGroup can be GREEN separately, but target-aware write-back remains RED until explicit target metadata and guard path exist. |
| Position contract L27-L43; L133-L153; L258-L260 | Edit analysis uses `scratch/current` + `scratchEdit`; allowed working-position edits/analysis/problem snapshot; forbidden SGF tree/history/current-node writes. | SCR-T10 | ARCHITECTURE_BOUNDARY | RED | Must prove scratch region and scratch analysis write boundaries; no production edit bar UI test in this slice. |
| UI/UX L803-L817; L939-L952 Analysis bottom bar | Bottom bar contains edit tools/Edit position/Snapshot/undo/redo/clear/zoom; bottom Snapshot shares top command path; free analysis does not pollute Attempt. | SCR-M01, SCR-D05 | RENDERED_UI_RETURN | DEFERRED | UI/UX provides placement/text only. Visual/E2E click acceptance is out of this contract-designer slice; command-path guard exits in step3/workbench wiring. |
| AGENTS.md L36-L45 child-region guardrail | Analysis scratch child region may handle target/generation/cleanup/stale ignore but cannot write WorkbenchMode upward; final outcomes, not setter order or logs, are test oracles. | SCR-T03, SCR-T04, SCR-T07, SCR-T08 | ARCHITECTURE_BOUNDARY | RED | Step2.2 must not defer owner/target/generation/stale-ignore tests. |
| Current source `scratchAnalysis.ts` L179-L186 request group/source | Scratch refresh already uses `requestGroup:'scratch-analysis'` and `analysisSource:'scratch-analysis'`. | SCR-T06A | SIDE_EFFECT_BOUNDARY | GREEN | Existing production `refreshScratchAnalysis` path should keep passing; target metadata is a separate RED row. |
| Current source `scratchAnalysis.ts` L187-L198, L216-L243 current/reference keys | Existing write-back separates current and reference analysis/ownership keys and final pending state. | SCR-T05A | SIDE_EFFECT_BOUNDARY | GREEN | This is legacy key isolation only. It does not prove workspace target/generation-aware write-back. |
| Target-aware write-back requirement from design guardrail + active ownership rows | Matching result must include and validate `{workspaceId,generation,tabId,targetTab}` before writing current/reference keys; stale/old target must not write any state. | SCR-T04, SCR-T05B, SCR-T06B | SIDE_EFFECT_BOUNDARY | RED | No explicit workspace target metadata exists yet. Test-writer must not mark this GREEN from legacy key isolation. |

## 1. 用户故事

作为从 Play / Problem / Recall 进入 Analysis 的用户，我需要系统创建一个独立的 Analysis scratch/current workspace，并只针对该 workspace 触发 scratch analysis；当我返回原 mode、重开 attempt、切换 reference/current 或快速切换时，旧 workspace 的晚到分析结果不能重建 workspace、不能写到新的 workspace、不能污染正式棋谱、source Attempt、Recall/Problem runtime 或 repository。

## 2. 用户动作

- 点击进入 Analysis / 复盘。
- Recall 完成后进入 Analysis。
- 在非 Analysis mode 点击 Snapshot：本契约只要求进入 Analysis scratch/current 的 guard 作为 step3 deferred；step2.2 证明 guard 调用进入 Analysis 后 scratch region target/generation 正确。
- 从 Analysis 返回 previous mode。
- 从 Analysis restart attempt。
- 在 Analysis scratch/current 或 scratch/reference 中触发 scratch analysis；旧请求晚到。
- Analysis edit bar / board edit 的业务边界是 `scratchEdit`；视觉与完整控件点击验收不属于本 slice。

## 3. 当前阶段

step2.2: Analysis scratch child-region target/generation semantics.

本阶段在 step1 overlay region 与 step2.1 runtime region 后执行，可与 step2.3 diagnostics contract/tests 并行。任何会与 step2.3 竞争的 shared `src/modules/training/workbench/workbenchFlowService.ts` production composition 改动必须延后到 step3.integration。

## 4. 位置源

| 位置源 | 本契约状态 | 说明 |
| --- | --- | --- |
| `game-tree` | read-only seed | 进入 Analysis 时可从当前 game tree / visible source 复制 working position；进入后不得把 scratch analysis 写回 source tree。 |
| `scratch/current` | in-scope owner target | Analysis 主棋盘 working position；scratch region enter 必须生成 active `{tabId, workspaceId, generation, targetTab:'current'}` 或等价 target。 |
| `scratch/reference` | in-scope result separation | Reference board 可被分析；结果只能写 reference analysis/ownership keys，不得 bleed into current。 |
| `problem-attempt` | out-of-scope | Problem runtime region 所属；本 slice 不迁移 problem attempt source。 |
| `reference/current` | applicable | Compare/overlay 可读 current/reference analysis；overlay internals 已由 step1 负责，本 slice 只保证 scratch result target 不串写。 |

## 5. 变更契约

| 动作 | 变更契约 | 说明 |
| --- | --- | --- |
| `enterAnalysis` / `completeRecall -> analysis` / Snapshot guard enter | 其他：`scratchRegionEnter` side effect | 不是棋盘落子；创建或标记 scratch/current workspace target，generation +1，调度 scratch analysis。 |
| `returnFromAnalysis` / `restartAttempt` | 其他：`scratchRegionExit` side effect | 不是棋盘落子；使 active scratch target inactive/stale，清理或失效 workspace，让晚到结果 ignored。 |
| Analysis edit bar / board edit | `scratchEdit` | 只写 working position，可触发 scratch analysis；不得写 Attempt 或 source game tree。 |
| Snapshot persistence | 无变更 in step2.2 | 非 Analysis Snapshot guard 到 Analysis scratch/current 的完整 production orchestration 为 SCR-D05，step3.integration owns it。 |

## 6. 预期状态流

进入 Analysis 的完整链路：

`UI event -> callback prop -> TrainingWorkbenchContainer handler -> workbenchFlowService.enterAnalysis/completeRecall/snapshot guard -> workbenchStore.updateTab({mode:'analysis', previousMode, analysisReturnTarget, analysisContext}) -> overlayRegion.onWorkbenchModeTransition -> activeModeEffects.enterAnalysis(input) -> analysisScratchRegion.enterAnalysis(input) -> legacy workspace adapter creates/stamps editWorkspace + schedules scratch analysis with {tabId, workspaceId, generation, targetTab} -> refreshScratchAnalysis production guard path -> runBoardAnalysis(requestGroup:'scratch-analysis', analysisSource:'scratch-analysis', target metadata) -> guarded editWorkspace-only write-back -> subscription/projection -> Analysis board/side panel reads scratch/current analysis state`

退出 Analysis 的完整链路：

`UI event -> callback prop -> TrainingWorkbenchContainer handler -> workbenchFlowService.returnFromAnalysis/restartAttempt -> workbenchStore.updateTab({mode:returnTarget.mode, previousMode:undefined, analysisReturnTarget:undefined}) -> overlayRegion.onWorkbenchModeTransition -> activeModeEffects.exitAnalysis(input) -> analysisScratchRegion.exitAnalysis(input) -> active scratch target invalidated -> legacy adapter clears editWorkspace / leaves analysis -> late scratch onAnalysisUpdate/final compares target/generation and no-ops -> subscription/projection -> previous mode UI no longer sees scratch workspace`

### 6.1 接口签名锁定

- `workbenchFlowService.enterAnalysis` calls `activeModeEffects.enterAnalysis(input)` at `src/modules/training/workbench/workbenchFlowService.ts` L643-L653. The upstream signature is a single object argument with `tabId`, `fromMode`, `toMode:'analysis'`, `beforeTab`, `afterTab`, `analysisReturnTarget`, `analysisContext`, optional `reason`, and optional `selectedTool`.
- `workbenchFlowService.returnFromAnalysis` calls `activeModeEffects.exitAnalysis(input)` at `src/modules/training/workbench/workbenchFlowService.ts` L712-L720. The upstream signature is a single object argument with `tabId`, `fromMode:'analysis'`, `toMode`, `beforeTab`, `afterTab`, `analysisReturnTarget`, and optional `reason`.
- Tests that call scratch region handlers with positional args, partial untyped objects, or handler signatures that do not match these upstream single-object calls are 假绿风险.

### 6.2 临时迁移接缝

- `TrainingWorkbenchContainer._tryInstallModeEffects` installs `ctx.createModeEffects()` into the flow service (`src/components/TrainingWorkbenchContainer.js` L964-L980).
- Production `ctx.createModeEffects` currently returns raw legacy mode effects from `createSabakiModeEffects(this)` in `src/modules/sabaki.js` composition. Replacing/wrapping that default production composition with `analysisScratchRegion` is required, but SCR-D02 is DEFERRED to step3.integration because it touches shared flow/default composition.
- step2.2 tests must inject the production scratch region through the existing `modeEffects` seam and prove owner/target/generation/stale-ignore behavior without editing `workbenchFlowService.ts`.

## 7. 允许的副作用

- Allocate/update an analysis scratch target: `{kind:'scratch', tabId, workspaceId, generation, targetTab, status:'active' | 'inactive', sourceMode, reason}` or equivalent production type.
- Create/stamp/clear `editWorkspace` through an explicit adapter port during Analysis enter/exit.
- Schedule scratch analysis for `scratch/current` or `scratch/reference` with active target metadata and request group `scratch-analysis`.
- Write `editWorkspace.currentAnalysis/currentOwnership/referenceAnalysis/referenceOwnership/analysisPending` only when result target `{workspaceId,generation,targetTab}` is still current.
- Log stale-ignored diagnostics with target metadata; logs are never the primary oracle.

## 8. 禁止的副作用

- Child region modifying `WorkbenchTab.mode`, `previousMode`, `analysisReturnTarget`, `activeAttemptId`, `activeRecallSessionId`, `recallSubstate`, or other WorkbenchMode parent fields.
- Child region writing `trainingRuntimeStore`, `Attempt.userLine/result/status`, RecallSession/RecallAttempt/Checkpoint, Task/Problem, ReviewSchedule, repository, or review queue.
- Scratch analysis writing `state.analysis`, `analysisTreePosition`, SGF props such as `SBKV`/`SBKS`, `documentStore`, `gameTrees`, history, or current game-tree node.
- Using `window.sabaki` or hidden global lookup inside the scratch region owner.
- Branching main flow by `origin.provider`, old `source/kind`, old `source_kind`, `openGameTab`, `openProblemTab`, `openSnapshotProblemTab`, or source-specific tab APIs.
- Letting `snapshotService` open tabs or orchestrate mode transition.
- Depending on setter order, callback count, or logger messages as the main proof of state-forward/state-return behavior.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| SCR-T01 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `src/modules/analysis/workbenchAnalysisScratchRegion.ts` exports a production scratch-region owner and typed adapter/port contracts; `src/modules/analysis/index.ts` re-exports it; owner has no store/repository/document/window global imports. | High | 没有 owner 时 effect 继续散落在 legacy mode effects。 |
| SCR-T02 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Region enter creates/stamps one active scratch target with `workspaceId`, `generation`, `tabId`, `targetTab`, source mode, and reason, then delegates to the legacy workspace adapter without changing WorkbenchTab itself. | High | 测试只看到 editWorkspace 存在，无法判断晚到结果属于哪个 workspace。 |
| SCR-T03 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Region exit invalidates active target and clears/tears down through adapter; late result for old target cannot recreate `editWorkspace`. | High | 返回 mode 后 late scratch result 可能复活 Analysis workspace。 |
| SCR-T04 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | A scratch analysis update/final result carrying old `{workspaceId,generation}` is ignored through the production guard path: no editWorkspace analysis/ownership write, no global analysis write, no source tree write. | High | 最核心 stale-result pollution 仍无保护。 |
| SCR-T05A | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Legacy `refreshScratchAnalysis` key isolation writes current results only to current keys and reference results only to reference keys; final `analysisPending:false` is asserted from final `editWorkspace` state. | Medium | current/reference key regressions could break side panels/overlay. This is not target-aware proof. |
| SCR-T05B | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Target-aware write-back: matching `{workspaceId,generation,targetTab:'current'|'reference'}` writes only matching keys and final `analysisPending:false`; mismatched target writes nothing. | High | Without target-aware guard, old workspace can write into a new workspace while still preserving current/reference key names. |
| SCR-T06A | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Scratch refresh uses `requestGroup:'scratch-analysis'` and `analysisSource:'scratch-analysis'`; game-tree live request group must not update editWorkspace. | High | game-tree live analysis 与 scratch analysis 混用缓存/结果。 |
| SCR-T06B | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Scratch refresh request/update/final result carries explicit target metadata `{tabId, workspaceId, generation, targetTab}` and validates it before write-back. | High | Module-local generation alone cannot distinguish workspace target after region switch/recreate. |
| SCR-T07 | CONTROLLER_STATE_TRANSITION | MUST_AUTOMATE | Real `createWorkbenchFlowService` + real `workbenchStore` + injected production scratch region: `enterAnalysis` and `returnFromAnalysis` produce tab state transitions and scratch region enter/exit outcomes without mocking flow service. | High | Region 只在 isolation 里工作，真实 flow seam 没验证。 |
| SCR-T08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Source scan proves scratch region owns target/generation and does not import `trainingRuntimeStore`, repository, `documentStore`, overlay internals, `window.sabaki`, or direct WorkbenchMode writers/source-specific APIs. | High | Child region 越界成新的 orchestration bucket。 |
| SCR-T10 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `scratchEdit` mutation boundary for Analysis edit path is preserved: scratch region/scratch analysis modules only write working position/editWorkspace analysis state and cannot write Attempt, SGF tree/history/current node. | Medium | Edit bar/board edit could silently dirty product facts outside scratch. |
| SCR-D01 | ARCHITECTURE_BOUNDARY | DO_NOT_TEST | Moving raw `createSabakiModeEffects` implementation out of `workbenchFlowService.ts` or replacing it there. | Deferred | Shared `workbenchFlowService.ts` production edit conflicts with step2.3; step3.integration owns it. |
| SCR-D02 | CONTROLLER_STATE_TRANSITION | DO_NOT_TEST | Production `sabaki.getTrainingContext().createModeEffects` default composition uses scratch region wrapper by default. | Deferred | Requires production composition edits beyond step2.2-local analysis region files; step3.integration owns it. |
| SCR-D03 | RENDERED_UI_RETURN | DO_NOT_TEST | Rendered UI return / panel props after scratch result. | Deferred | This slice is region/state boundary; rendered UI verification belongs to later frontend/workbench wiring verification. |
| SCR-D04 | SIDE_EFFECT_BOUNDARY | DO_NOT_TEST | Full engine ownership migration so every engine callback carries target id. | Deferred | Engine ownership migration is out of scope; step2.2 covers scratch request target/generation stale guard only. |
| SCR-D05 | CONTROLLER_STATE_TRANSITION | DO_NOT_TEST | Full Snapshot from non-Analysis mode enters Analysis scratch/current before persistence and opens derived task only after capture. | Deferred | Shared snapshot orchestration in flow service is step3.integration; step2.2 only proves scratch region behavior once `enterAnalysis` is invoked. |

## 10. 必须自动化的测试

Layered test contract:

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCR-T01 | ARCHITECTURE_BOUNDARY | `src/modules/analysis/workbenchAnalysisScratchRegion.ts` and `src/modules/analysis/index.ts` | real filesystem source | none | real production interface/type | mocked module loader returning fake exports | Factory/export and typed adapter/target interfaces exist; source has no forbidden imports/globals. | SCR-T02, SCR-T07 |
| SCR-T02 | SIDE_EFFECT_BOUNDARY | production scratch region owner | production region implementation | legacy effect adapter typed by exported port | real production interface/type | mocked scratch region; mocked flow service; logger-only assertion | `enterAnalysis(input)` creates active target and stamps/creates editWorkspace without writing WorkbenchTab. | SCR-T07 |
| SCR-T03 | SIDE_EFFECT_BOUNDARY | production scratch region owner | production region implementation | legacy effect adapter typed by exported port | real production interface/type | mocked scratch region; hand-mutated final state | `exitAnalysis(input)` invalidates target and late old target cannot recreate editWorkspace. | SCR-T07 |
| SCR-T04 | SIDE_EFFECT_BOUNDARY | production scratch region + production `refreshScratchAnalysis` guard path | real `refreshScratchAnalysis`; production region guard | controlled `RunBoardAnalysis` typed stub; stateful editWorkspace adapter | real production interface/type | fake `setState` that silently filters writes; mocked region; source-tree mutation spy as only oracle | Old target/generation update/final causes zero editWorkspace/global analysis/source tree writes; final editWorkspace state remains unchanged except permitted pending cleanup. | SCR-T07 |
| SCR-T05A | SIDE_EFFECT_BOUNDARY | existing `refreshScratchAnalysis` current/reference write-back | real `refreshScratchAnalysis` | controlled `RunBoardAnalysis` typed stub | real production interface/type | asserting callback count only; manual writes to expected keys | Legacy current and reference results update only their own analysis/ownership keys; final `analysisPending:false` is asserted from final editWorkspace. | SCR-T05B |
| SCR-T05B | SIDE_EFFECT_BOUNDARY | target-aware guarded current/reference write-back | real `refreshScratchAnalysis` plus production target guard | controlled `RunBoardAnalysis` typed stub returning matching/mismatched targets | real production interface/type | target metadata omitted; broad fake analysis service; callback-count primary assertion | Matching target updates only matching keys and final pending false; mismatched target writes no current/reference keys. | SCR-T07 |
| SCR-T06A | SIDE_EFFECT_BOUNDARY | `refreshScratchAnalysis` request options | real `refreshScratchAnalysis` | production-typed `RunBoardAnalysis` spy | real production interface/type | mocked analysisService; string-only source scan as sole proof | Request options include `requestGroup` and `analysisSource` equal `scratch-analysis`; game-tree request cannot update editWorkspace. | SCR-T06B |
| SCR-T06B | SIDE_EFFECT_BOUNDARY | scratch request target metadata and stale guard | real `refreshScratchAnalysis`; production target guard | production-typed `RunBoardAnalysis` spy/stub | real production interface/type | module-local generation only; fake guard not used by production path | Request/update/final payload carries `{tabId, workspaceId, generation, targetTab}` and production guard rejects stale target before state write. | SCR-T07 |
| SCR-T07 | CONTROLLER_STATE_TRANSITION | real `createWorkbenchFlowService` with injected production scratch region | real `createWorkbenchFlowService`, real `createWorkbenchStore`, production scratch region | flow deps from shared typed factory; stateful legacy adapter fake | shared typed spy factory | mocked `workbenchFlowService`; mocked `workbenchStore.updateTab`; direct tab mutation after call | `enterAnalysis` creates tab analysis state and active scratch target; `returnFromAnalysis` restores saved mode and invalidates scratch target. | SCR-D02 |
| SCR-T08 | ARCHITECTURE_BOUNDARY | source text of scratch region module | real filesystem source | none | real production interface/type | per-file fake module source | Source forbids `window.sabaki`, repository/store/document imports, source-specific tab APIs, and direct WorkbenchMode writes. | SCR-D02 |
| SCR-T10 | ARCHITECTURE_BOUNDARY | scratch region + scratch analysis source boundary | real filesystem source; production exported types | none or local tiny callback stub for adapter only | real production interface/type | UI callback-only tests; broad per-file service fake; snapshotService fake as proof | Modules cannot write Attempt, repository, SGF tree/history/current node, or global analysis state; allowed writes are working position/editWorkspace analysis state only. | SCR-D05 |

Mock and typing policy:

- New step2.2 tests/helpers should be TypeScript (`.ts`) and bind fakes with `satisfies ProductionInterface`, explicit return types, or a shared typed spy factory. This is mandatory for `RunBoardAnalysis`, scratch adapter ports, flow deps, and repository/service deps.
- If a JavaScript test file must receive additions, that file must enable `// @ts-check` and import effective production types via JSDoc or delegate all fakes to a typed helper. Because repository `tsconfig.json` has `checkJs:false`, untyped JS additions cannot be used for broad fakes.
- Do not duplicate broad per-file service fakes. For `WorkbenchFlowService`, `WorkbenchTabService`, `SnapshotService`, `documentStore.playMove` port, `RecallService`, `AttemptService`, `ReviewService`, repository ports, and runtime store, use real production objects where the layer claims state transition, or a shared typed factory constrained by production interfaces.
- Local tiny stubs are allowed only for a single callback/delegate, such as the legacy `ModeEnterEffect`/`ModeExitEffect` adapter or controlled `RunBoardAnalysis` promise resolution, and must still be typed by production interfaces.
- Callback-called-once assertions may be auxiliary only. Primary assertions must inspect final target/workspace/write-back state.

## 11. 仅手动验收

| ID | 验收项 | 理由 |
| --- | --- | --- |
| SCR-M01 | After step3 integration, manually smoke: enter Analysis, edit scratch/current, trigger Snapshot affordance, return previous mode, and confirm no stale workspace/overlay returns. | Requires production default composition and UI runtime. This is not a substitute for SCR-T02/T03/T04/T05B/T06B/T07 automation. |

## 12. 不测试

| ID | 项目 | 原因 |
| --- | --- | --- |
| SCR-N01 | Analysis edit bar visual placement, CSS, icon state, responsive behavior. | 前端视觉任务，不属于 contract-designer scope。 |
| SCR-N02 | Full edit bar E2E click coverage for every button. | Product requires it, but this scratch-region slice only defines state/write boundary; frontend/workbench wiring owns UI E2E. |
| SCR-N03 | Runtime companion cleanup for problem/recall/checkpoint. | step2.1 owns runtime region。 |
| SCR-N04 | Overlay owner internals. | step1 owns overlay region。 |
| SCR-N05 | `modeStateResolver` diagnostics consumption. | step2.3 owns diagnostics。 |
| SCR-N06 | Persistent fact repair for Attempt/RecallSession/Task/SGF/comment/review. | Explicitly out of scope and forbidden as silent repair。 |
| SCR-N07 | Full engine ownership migration. | Out of scope; this slice only requires scratch target/generation and stale-result guard. |

## 13. 脆弱测试警告

- 不要把 `modeEffects.enterAnalysis` 被调用一次当成通过标准；必须断言 active scratch target、workspaceId/generation、write-back boundary 和 stale ignore。
- 不要把 legacy current/reference key isolation 当成 target-aware write-back。SCR-T05A 可 GREEN；SCR-T05B 必须 RED，直到 explicit target metadata 和 guard path 存在。
- 不要断言 exact setter order。允许 region 先标 target 后 delegate，也允许 delegate 后 stamp workspace，只要最终状态和 stale guard 满足契约。
- 不要用 logger 事件作为主 oracle。日志只能辅助诊断。
- 不要只做 source string scan 来证明 state-forward；source scan 只能证明 ARCHITECTURE_BOUNDARY，SCR-T07 必须走真实 flow service。
- 不要把当前 legacy `sabaki.setMode('analysis')` 自动创建 workspace 当作最终 owner；它只是迁移 seam。
- 不要在 JS 测试文件内临时手写 broad fake service。缺生产 interface 或 shared typed factory 时，测试契约要求先补 typed helper。

## 14. 超出范围

- 修改 UI/CSS/视觉验收。
- 修改 runtime companion region、overlay internals、diagnostics consumption。
- 修改 `modeTransitions.ts` pure policy，除非发现 step2.2 明确冲突；当前无需修改。
- 修改 production `src/modules/training/workbench/workbenchFlowService.ts` 来承载 scratch owner 或移动 `createSabakiModeEffects`。该共享生产接线延后 step3.integration。
- 修改 production default `ctx.createModeEffects()` composition。该接线延后 step3.integration。
- 让 `snapshotService` 承担 tab opening、mode transition 或 flow orchestration。
- 修复 legacy fallback click path 的全部 Analysis edit 行为；本 slice 只约束 enter/exit target/generation、scratch analysis stale guard 和 write-back boundary。

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当流程分支 | 不允许 | Architecture v0.5 L100-L110 禁止按 provider 分叉主流程；v0.5 L23-L35 标注 v0.4 source APIs 为迁移背景。 | Scratch target 由 mode transition + workspace target 生成，不读 origin/provider。SCR-T08 source scan。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API | 不允许 | Architecture v0.5 L23-L35 说明 v0.4 API 迁移到 v0.5 path。 | SCR-T08 source scan 禁止。 |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 不允许 | Architecture v0.5 L1146-L1158 指明 `SnapshotService` 不创建 Tab，完整流程由 flow service 编排。 | 本 slice 不改 snapshotService；Snapshot full guard/persistence 为 SCR-D05 step3。 |
| 是否让 container 直接写 store，而不是通过 service | 不允许 | Architecture v0.5 L183-L186 命令写路径为 UI -> Controller/Container -> Service -> Store/Repository/Adapter。 | 本 slice 不改 Container；SCR-T07 走 real flow service。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 不新增 | Architecture v0.5 L89-L98 要求 UI 展示、Container/Controller 调 Service。 | 不写 UI。 |
| 是否让 scratch region 修改 WorkbenchMode | 不允许 | AGENTS.md L36-L45 child region 不能反向修改 mode；flow owns transition。 | Scratch region 只能写自身 target/editWorkspace adapter；mode 由 flow service 写。SCR-T07/T08。 |
| 是否让 store 调 engine/DB/UI/IPC | 不允许 | AGENTS.md L26-L29；Architecture v0.5 L100-L110。 | Scratch analysis side effect 放在 analysis region/service，不放 store。 |
| 是否让 resolver 执行副作用或自动修复 | 不允许 | Workbench architecture L491-L500：analysis scheduling/write-back 不属于 resolver。 | 本 slice 不改 resolver；diagnostics consumption step2.3。 |
| 是否让 scratch analysis 写正式 game tree 或 Attempt | 不允许 | Position contract L133-L153；workbench architecture L744-L772。 | SCR-T04/SCR-T05B/SCR-T06B/SCR-T10 验证。 |
| 是否与 Architecture v0.5 Snapshot 旧段落冲突 | 有冲突，product 优先 | Architecture v0.5 L1887-L1891 仍描述 snapshot flow 可直接 capture/open task；PRD L255-L269/L562-L574 要求先进入 Analysis scratch/current。 | Contract 采用 PRD guard；full flow test/impl deferred to step3 as SCR-D05。 |

## 16. Workbench 接线清单（如适用）

本 slice 不是前端控件接线任务；以下仅描述 mode-effect/region 接线。UI control placement 和 visual state 只从 UI/UX spec 读取，不在本 slice 实现。

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Enter Analysis action | `enterAnalysis` | `TrainingWorkbenchContainer` delegates; `workbenchFlowService` owns transition; scratch region owns workspace target | PRD L501-L614; Arch L752-L756 | tab mode -> analysis; scratch target active; editWorkspace created/stamped | Analysis projection sees scratch/current and `scratchEdit` workspace | SCR-T02, SCR-T07 | step2.2 tests; production default composition step3 |
| Complete Recall -> Analysis | `completeRecall` then enter Analysis effect | `workbenchFlowService`; runtime cleanup step2.1; scratch region target step2.2 | Arch L775-L786 | tab mode -> analysis; scratch target active; runtime cleanup handled by runtime region | Analysis projection reads source trace + scratch | SCR-T02, SCR-T07 | step2.2 tests |
| Return from Analysis | `returnFromAnalysis` | `workbenchFlowService` parent; scratch region exit | Arch L758-L760, L784-L795 | tab restored to saved target; scratch target inactive; editWorkspace cleared/invalidated | Previous mode projection no scratch | SCR-T03, SCR-T07 | step2.2 tests |
| Restart Attempt from Analysis | `restartAttempt` | `workbenchFlowService` parent; scratch region exit | Arch L762, L787 | tab exits analysis; scratch target inactive | target mode projection no scratch | SCR-T03 or SCR-T07 | step2.2 tests; must not hide stale-ignore behind step3 |
| Scratch analysis async result | guarded write-back | scratch region + `scratchAnalysis` production path | Workbench architecture L744-L772 | matching target writes editWorkspace only; stale target no-ops | projection receives only current workspace result | SCR-T04, SCR-T05A, SCR-T05B, SCR-T06A, SCR-T06B | step2.2 tests |
| Analysis edit bar mutation boundary | `scratchEdit` | future scratch edit executor / analysis service; not presentational component | PRD L591-L614; position contract L133-L153 | working position/editWorkspace only; may trigger scratch analysis | Snapshot/problem draft can use working position | SCR-T10; UI E2E out of scope | step2.2 boundary; frontend wiring later |
| Production default mode effects composition | `ctx.createModeEffects()` wrapper | `sabaki.getTrainingContext` composition + flow service setter | Container L964-L980; flow modeEffects seam | default app uses scratch region wrapper, not raw legacy effect | real UI gets same region behavior | SCR-D02 | step3.integration |

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| step2.2.contract retry1 | this file only | step2.2.contract-audit REQUEST_CHANGES | 只读设计/源码并写 v0.2 contract | 无；不要改 checklist/v0.1。 |
| step2.2.tests | `test/analysis/workbenchAnalysisScratchRegion.test.ts`; optional focused TS helper; optional focused additions to existing scratch tests only with effective type checking | approved v0.2 contract | 不改 production；锁 scratch target/generation/stale/write-back tests | Avoid broad JS fakes; use TS `satisfies`/shared typed factory. |
| step2.2.impl | `src/modules/analysis/workbenchAnalysisScratchRegion.ts`, `src/modules/analysis/index.ts`, focused additions in `src/modules/analysis/scratchAnalysis.ts`/types | test audit approval | Disjoint from step2.3 diagnostics | Do not edit shared `workbenchFlowService.ts`; if required, leave production composition to step3。 |
| step2.3.contract/tests/impl | `modeStateResolver.ts`, diagnostics tests | step1.review | Does not need analysis scratch files | Shared `workbenchFlowService.ts` integration must wait step3。 |
| step3.integration | `workbenchFlowService.ts`, `src/modules/sabaki.js`, production composition tests, Snapshot guard orchestration | step2.1/2.2/2.3 reviews | Serial integrator resolves shared seams | Highest risk: ordering between runtime cleanup, scratch enter/exit, overlay, diagnostics pre/postflight, Snapshot guard。 |

## 18. RED/GREEN/DEFERRED 状态表

| 字段/事件 | Mode/State | 期望值/行为 | 测试 ID | 测试状态 | GAP/Deferred |
| --- | --- | --- | --- | --- | --- |
| `analysisScratchRegion` export | module boundary | Exists under `src/modules/analysis/*`, exported through `analysis/index.ts`, with typed ports and no forbidden imports/globals. | SCR-T01 | RED | No explicit scratch region owner yet. |
| `enterAnalysis` target | play/problem/recall -> analysis | Creates active scratch target with `workspaceId`, generation, `tabId`, targetTab, and stamps/creates editWorkspace. | SCR-T02 | RED | Current raw `ModeEnterEffect` creates workspace but has no explicit target/generation semantics. |
| `completeRecall` target | recall -> analysis | Same as enter with reason/context preserved; runtime cleanup not in this slice. | SCR-T02/SCR-T07 | RED | Flow calls enter effect, but no scratch region target owner. |
| `returnFromAnalysis` exit | analysis -> previous | Invalidates target and clears/tears down workspace; old result cannot re-open workspace. | SCR-T03/SCR-T07 | RED | Legacy exit clears workspace, but no target invalidation proof. |
| `restartAttempt` exit | analysis -> play/problem/recall | Same exit/stale semantics as return path. | SCR-T03/SCR-T07 | RED | Must not be deferred: it is an owner/target/generation/stale-ignore exit path. |
| stale `onAnalysisUpdate` | exited or new generation | No editWorkspace/global analysis/source tree write for old target. | SCR-T04 | RED | Existing module generation exists, but no workspace target/generation contract test. |
| legacy current result key isolation | active scratch/current | Existing refresh writes only current analysis/ownership keys and final pending false. | SCR-T05A | GREEN | Legacy key isolation only; does not prove target-aware write-back. |
| legacy reference result key isolation | active scratch/reference | Existing refresh writes only reference analysis/ownership keys and final pending false. | SCR-T05A | GREEN | Must use real `refreshScratchAnalysis` with final editWorkspace state assertions. |
| target-aware current write-back | active scratch/current | Matching target writes only current keys; mismatched target writes nothing. | SCR-T05B | RED | Requires explicit `{workspaceId,generation,targetTab}` metadata and production guard. |
| target-aware reference write-back | active scratch/reference | Matching target writes only reference keys; current keys unchanged; mismatched target writes nothing. | SCR-T05B | RED | Requires explicit target metadata and guard. |
| request group/source | scratch analysis | `requestGroup:'scratch-analysis'`, `analysisSource:'scratch-analysis'`. | SCR-T06A | GREEN | Existing `scratchAnalysis.ts` sets group/source. |
| request target metadata | scratch analysis | Scratch request/update/final carries explicit `{tabId, workspaceId, generation, targetTab}` target metadata. | SCR-T06B | RED | Existing scratch path has module generation but no explicit workspace target metadata. |
| game-tree live scheduling boundary | analysis with scratch active | Game-tree live request group cannot update editWorkspace and scratch result cannot update global analysis/tree. | SCR-T04/SCR-T06A/SCR-T10 | RED | Existing source has partial guards; step2.2 target guard and boundary tests must lock it. |
| Snapshot non-analysis guard | play/problem/recall Snapshot | Full Snapshot command enters Analysis scratch/current before persistence. | SCR-D05 | DEFERRED | Approved reason: shared flow/snapshot production orchestration is step3. Exit condition: step3 verifies guard before capture/persist/open. |
| UI bottom bar rendered placement | Analysis UI | Bottom bar has edit tools/Edit position/Snapshot/undo/redo/clear/zoom. | SCR-M01/SCR-N01 | DEFERRED | Approved reason: frontend visual/E2E scope, not scratch-region contract. |
| production default composition | app runtime | `ctx.createModeEffects()` returns scratch region wrapper around legacy effect. | SCR-D02 | DEFERRED | Step3 integration owns `sabaki.js`/shared composition. |
| shared `workbenchFlowService.ts` cleanup | shared orchestration | Raw workspace effect should eventually leave flow file or be wrapped without direct owner leakage. | SCR-D01 | DEFERRED | Parallel constraint: do not make shared production edit in step2.2. |

## 19. downstream required_constraints

```yaml
required_constraints:
  step2_2_tests:
    allowed_test_scope:
      - test/analysis/workbenchAnalysisScratchRegion.test.ts
      - test/training/workbenchScratchRegion.test.ts
      - typed shared test helpers under test/**/shared/
      - focused additions to existing scratch analysis tests only with // @ts-check and effective production type imports, or by delegating fakes to TS helpers
      - focused additions to test/training/workbenchFlowService.test.js only if they use existing modeEffects injection seam and do not require production flow edits
    forbidden:
      - mocked workbenchFlowService for SCR-T07
      - mocked workbenchStore.updateTab for SCR-T07
      - callback-only primary assertions
      - broad per-file fake services not typed by production interfaces
      - untyped JS fake services while tsconfig checkJs is false
      - production edits
    must_use:
      - real refreshScratchAnalysis / production guard path for SCR-T04, SCR-T05A, SCR-T05B, SCR-T06A, SCR-T06B whenever asserting write-back
      - final editWorkspace state assertions for pending/current/reference/ownership keys
      - TS satisfies ProductionInterface, explicit return types, or shared typed factory for fakes
  step2_2_impl:
    allowed_production_scope:
      - src/modules/analysis/workbenchAnalysisScratchRegion.ts
      - src/modules/analysis/index.ts
      - src/modules/analysis/scratchAnalysis.ts
      - src/modules/analysis/analysisTypes.ts
    forbidden_production_scope:
      - src/modules/training/workbench/workbenchFlowService.ts
      - src/modules/sabaki.js production default composition
      - UI/CSS/component visual files
      - repository/runtime/recall/problem services
    must_not_defer:
      - scratch region owner/export
      - active target creation
      - target invalidation
      - stale result ignore
      - target-aware current/reference write-back
      - typed tests for real flow seam injection
  step3_integration:
    owns:
      - production default modeEffects composition
      - shared workbenchFlowService ordering/composition cleanup
      - Snapshot guard orchestration before persistence/open
      - integration between runtime, scratch, overlay, and diagnostics child regions
```
