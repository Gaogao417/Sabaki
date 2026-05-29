# Play Move Post-Commit Pipeline Test Contract v0.1

Date: 2026-05-29
Status: confirmed

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本契约的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | lines 21-22 | `PlayMoveCommitted` 是产品/架构描述名，不要求实现为正式事件类型。 |
| `docs/product/sabaki-training-prd.md` | lines 119-135 | Play 的主事实是 SGF game tree；`TrainingAttempt` 是棋树成功写入后的训练记录，不能替代或决定 Play 落子合法性。 |
| `docs/product/sabaki-training-prd.md` | lines 338-359 | 用户或 AI 产生一手后先写入当前对局棋树，再记录 Attempt、触发训练评估、AI 应手判断和后台 analysis；Play 不显示 overlay。 |
| `docs/product/sabaki-training-prd.md` | lines 1309-1327 | `aiMoveService` 只提供下一手候选/command；AI 应手必须通过 Play 主线写树，stale 请求不得写棋树或 Attempt。 |
| `docs/product/sabaki-training-prd.md` | lines 1804-1807 | Play Attempt 可以包含 AI 或对手应手，归属由 `moveActors` 标记。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 23-31 | 新路径不得复用 v0.4 source-specific API；Play move commit 以设计文档为准，且不是正式领域事件类型或事件总线消息。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 70-85 | 主流程围绕 `play/problem/recall/analysis` 四个 mode，不围绕 source/kind/origin 分支。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 95-116 | UI 只展示；Container/Controller 读 Store、调 Service；禁止 Store 调 Service、documentStore 知道 Attempt、按 `origin.provider` 分叉主流程。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 811-932 | `aiMoveService` 负责 AI turn policy + engine request orchestration；不得直接写 game tree、Attempt 或 overlay；Play AI move 成功提交后进入 after-play-move 后置流程。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 1811-1849 | Play 用户落子链路、AI reply 回到 Play command executor、Problem 不使用 Play commit、Play commit 不触发 `overlayRegion`。 |
| `docs/design/play-move-committed-architecture.md` | lines 28-31 | Play 核心写入事实是 `documentStore.playMove` 成功写入 game tree 后的 lifecycle point。 |
| `docs/design/play-move-committed-architecture.md` | lines 37-58 | 主线是合法性和 game tree 写入；提交点是 changed moveResult；后置处理包括 Attempt、monitor、analysis、AI；不要求 event bus、持久 event 或完整 TS event 类型。 |
| `docs/design/play-move-committed-architecture.md` | lines 64-73 | Problem / Recall / Analysis 有自己的提交点，可共享 intent 解析，但不能共享同一个写入 executor。 |
| `docs/design/play-move-committed-architecture.md` | lines 79-127 | `afterPlayMoveCommitted` 应是本地 helper 参数，而不是导出的长期稳定领域事件类型；context 只来自成功 playMove 后稳定快照。 |
| `docs/design/play-move-committed-architecture.md` | lines 131-157 | Board click 或 AI command 都进入 Play move command；changed 后触发 post-commit handlers；AI command 回到 Play command；图中没有 `overlayRegion`。 |
| `docs/design/play-move-committed-architecture.md` | lines 197-224 | AI 首手/应手不得绕过 Play 主线，AI move command 由 `documentStore.playMove` 提交，changed 后进入同一 after handler。 |
| `docs/design/play-move-committed-architecture.md` | lines 228-238 | Handler 边界表：AttemptRecorder、monitor、AnalysisScheduler、aiMoveService；`overlayRegion` 不在表中，handler 不是 event bus subscriber。 |
| `docs/design/play-move-committed-architecture.md` | lines 274-299 | Play / Problem / Recall / Analysis mode-specific restrictions；本 slice 要加 focused tests，包含 stale AI、overlay、AI vs AI guard。 |
| `src/components/Goban.js` | lines 232-243, 278-282 | 上游真实调用签名：`Goban.handleVertexMouseUp(evt, vertex) -> evt.vertex = vertex -> onVertexClick(evt)`，单参数。 |
| `src/components/TrainingWorkbenchContainer.js` | lines 879-904 | Container 从 `evt.vertex/button/ctrlKey/metaKey` 组装 `controller.handleBoardClick({vertex,event,...})`。 |
| `src/modules/training/workbench/boardInteractionController.ts` | lines 363-419 | 当前 Play 分支：human 使用 `executePlayInteraction`，changed 后 inline append/monitor/AI；AI reply 当前直接 `documentStore.playMove` 并只 append Attempt，缺少同一 post-commit pipeline。 |
| `src/modules/workbench/board-interactions/executors/playInteractionExecutor.js` | lines 18-62 | 低层 Play executor 负责 `documentStore.playMove`，changed 后可触发 legacy engine reply/live analysis，并返回 changed result。 |
| `src/modules/training/ai/aiMoveService.ts` | lines 67-188 | 当前 AI service 返回 move candidate string/null；它管理 pending/freshness 和 engine request，不写 game tree/Attempt/overlay。 |

## 1. 用户故事

作为 Play Mode 用户，我下一手后，无论下一手来自人还是 AI，系统都先把真实落子写入当前 game tree；只有 `documentStore.playMove` 返回 changed 后，Attempt 记录、训练 monitor、后台 analysis、AI 应手/续下才可以运行。Problem、Recall、Analysis 不能借用 Play commit 语义。

## 2. 用户动作

- 用户在 Play 棋盘左键点击空点。
- controller 收到 AI move candidate/command 后执行一手 AI Play move。
- AI move reply 为 `null`、stale 或无效坐标。
- 用户在 Problem / Recall / Analysis 点击棋盘。

## 3. 当前阶段

Workbench `play` mode 的 `playMove` 变更契约。Problem / Recall / Analysis 只做 guard 测试，证明它们没有复用 Play commit 后置语义。

## 4. 位置源

| 场景 | 位置源 | 说明 |
| --- | --- | --- |
| Play human move | `game-tree` | `documentStore.playMove` 是主写入事实。 |
| Play AI move | `game-tree` | AI candidate 必须回到 Play move executor / command path 后写入。 |
| Problem click | `problem-attempt` | 走 `problemFlowService` / problem runtime，不共享 Play commit。 |
| Recall answer | `reference/current` recall view | 提交 recall answer，不写 game tree / Attempt.userLine。 |
| Analysis scratch | `scratch` | 编辑 working position，可显示 analysis overlay，但不写 Attempt.userLine。 |

## 5. 变更契约

| 场景 | 变更契约 | 说明 |
| --- | --- | --- |
| Play changed human move | `playMove` | changed `documentStore.playMove` 是 post-commit 主事实。 |
| Play changed AI move | `playMove` | AI move 必须走与 human 相同的本地 after-play pipeline。 |
| Play unchanged/invalid document result | 无变更 | 不触发 Attempt / monitor / analysis / AI continuation。 |
| Null/stale/invalid AI reply | 无 AI 变更 | 不追加第二次 game tree 写入，不写 AI Attempt。 |
| Problem board move | 其他：`problemAttemptMove` | 主写入不是 Play game-tree commit。 |
| Recall board answer | `recallAnswer` | 不修改 game tree 或 Attempt.userLine。 |
| Analysis board edit | `scratchEdit` | 不修改正式棋谱或 Attempt.userLine。 |

## 6. 预期状态流

完整链路：

`Goban.handleVertexMouseUp(evt, vertex)` sets `evt.vertex` and calls `onVertexClick(evt)` -> `TrainingWorkbenchContainer.onVertexClick(evt)` extracts `vertex` and normalized mouse event -> `boardInteractionController.handleBoardClick` builds resolver context -> pure `resolveBoardInteraction` returns `PLAY_STONE + mutationContract='playMove'` -> Play command/executor calls `documentStore.playMove(vertex, {player})` -> only changed result enters local `afterPlayMoveCommitted(context)` -> Attempt recorder appends `{move, actor}` -> monitor receives the committed move context -> analysis scheduler receives `treePositionAfter` -> `aiMoveService` decides no-op or returns AI move candidate/command -> AI command re-enters the same Play command/executor -> changed AI result re-enters `afterPlayMoveCommitted(context actor='ai')` -> Sabaki/documentStore state, repository/Attempt state, runtime pending state, and analysis queue update through their existing subscriptions/projections -> UI state returns through existing board and Workbench projections.

Temporary migration seams allowed in tests:

- Current injected AI seam may still be named `maybePlayAiMove` and return a move string; the contract treats that string as the current AI move candidate/command representation.
- `afterPlayMoveCommitted` may be a local helper inside `boardInteractionController.ts`; it must not be an exported event type, event bus message, persisted repository event, or UI event.
- If AI vs AI continuation is added in this slice, the test harness must provide a small max-run guard and assert the guard, not rely on timers or an unbounded loop.

## 7. 允许的副作用

- `documentStore.playMove` writes the Play game tree for changed human and changed AI moves.
- `attemptService.appendMove(attemptId, move, actor)` records committed Play moves after changed document result.
- `monitor.onUserMove` or the current monitor seam receives committed Play context after changed document result; despite the legacy method name, tests must treat it as post-commit monitor callback, not as a human-only callback.
- `analysisService.scheduleLiveAnalysis(treePositionAfter)` may run after changed Play moves for training evaluation.
- `aiMoveService` may set/clear pending AI request state internally and may request engine candidates.
- AI vs AI continuation may schedule bounded additional local Play commands.

## 8. 禁止的副作用

- No formal `PlayMoveCommitted` event bus, persistent event, exported event type, DOM event, IPC event, or repository event.
- No Attempt / monitor / analysis / AI continuation when `documentStore.playMove` is invalid or unchanged.
- No direct AI write to game tree from `aiMoveService`; AI returns a candidate/command only.
- No direct AI write to Attempt, monitor, analysis overlay, or `overlayRegion`.
- No AI candidate accepted after stale/null/invalid reply.
- No Play commit semantics for Problem, Recall, or Analysis.
- No `overlayRegion` update as part of Play commit fan-out.
- No branching on `origin.provider`, old `source/kind`, or new source-specific tab opening APIs.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 测试状态 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------- | -------------- | --------------- |
| W8-PMC-T01 | WIRING | MUST_AUTOMATE | GREEN | Changed human Play move first records `documentStore.playMove`, then the post-commit participants observe the changed fact: human Attempt append, monitor callback, live analysis schedule, AI decision entry returning no-op. Do not require a formal event object. | Proves `documentStore.playMove` changed result is the main fact before Attempt/monitor/analysis/AI. | Tests could falsely pass if they assert only callback count; assert payloads include human move and `treePositionAfter`. |
| W8-PMC-T02 | SIDE_EFFECT | MUST_AUTOMATE | GREEN | Invalid or unchanged `documentStore.playMove` returns handled/no-change and does not call Attempt, monitor, analysis, or AI continuation. | Prevents post-commit side effects before the commit fact exists. | A weak test that only checks return value would miss leaked Attempt writes. |
| W8-PMC-T03 | WIRING | MUST_AUTOMATE | RED | After human Play commit, an AI candidate must be executed through the same Play move path and the AI changed result must enter the same local after-play pipeline: second document write, AI Attempt append, monitor callback, live analysis schedule, and AI continuation check. | Locks the core gap: current AI reply bypasses the named post-commit lifecycle. | If the test only checks `attemptService.appendMove(...,'ai')`, current direct write can falsely pass. |
| W8-PMC-T04 | SIDE_EFFECT | MUST_AUTOMATE | RED | AI vs AI continuation uses the same lifecycle but stops at a test-safe `AutoPlayLimits.maxAutoMovesPerRun` guard. The test must prove no unbounded loop by asserting the exact bounded number of AI commits and continuation checks. | Required by PRD/architecture before allowing recursive AI continuation. | Timer-based or sleep-based tests can be flaky; use deterministic fake AI candidates and synchronous promises. |
| W8-PMC-T05 | SIDE_EFFECT | MUST_AUTOMATE | GREEN | `aiMoveService` returning `null` or an invalid/stale candidate representation causes no AI game-tree write and no AI Attempt append beyond the already-committed human move. | Protects stale/null/invalid AI reply rule. | Do not mock freshness inside controller; represent stale as `null` from AI service, with real service freshness covered elsewhere. |
| W8-PMC-T06 | WIRING | MUST_AUTOMATE | GREEN | Problem, Recall, and Analysis clicks do not trigger Play post-commit handlers. Problem routes to `problemAttemptMove`; Recall routes to recall adapter; Analysis routes to scratch edit or legacy deferred path. | Prevents Play semantics leaking into other modes. | A row that checks only `documentStore.playMove` misses leaked Attempt/AI calls; assert no Play post handlers too. |
| W8-PMC-T07 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | GREEN | Play commit fan-out has no `overlayRegion` or `overlayStore` dependency in `boardInteractionController.ts` or `playInteractionExecutor.js`. | Encodes overlay off for Play/Problem/Recall. | Source-scan should forbid only overlay fan-out imports/calls, not the word `problemArea`. |
| W8-PMC-T08 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | GREEN | `aiMoveService.ts` does not import or call documentStore, attempt append/write APIs, or overlay APIs; it may return a move candidate string/null as the current command representation. | Keeps AI service as policy/orchestration only. | Over-broad regex forbidding all `attempt` text would fail valid freshness checks. |
| W8-PMC-T09 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | GREEN | No source introduces a formal `PlayMoveCommitted` event/bus/persistent event. A local `afterPlayMoveCommitted` helper name is allowed. | Prevents over-architecting the lifecycle point. | Do not ban the helper name; ban `EventEmitter`, `.emit('PlayMoveCommitted')`, exported event type/class/interface, DOM/IPC/repository event persistence. |

## 10. 必须自动化的测试

Primary test file: `test/workbench/wiring/w8-p1-board-interaction-controller.test.js`.

Allowed write scope for test-writer: this test file only, plus a same-file helper update if needed. No production code in the test-writing step.

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W8-PMC-T01 | SIDE_EFFECT_BOUNDARY | `createBoardInteractionController` + real resolver + real `executePlayInteraction` | `resolveBoardInteraction`, `createBoardInteractionContext`, `executePlayInteraction` | `documentStore.playMove`, `attemptService.appendMove`, `monitor`, `analysisService`, `repository.loadAttempt`, `aiMoveService` no-op | `real production interface/type` via `BoardInteractionControllerDeps`; temporary local recorders are allowed because they are port observers, not service semantic replacements | Mocking resolver or `executePlayInteraction`; asserting only call count | Changed human move causes one document write and human post-commit payloads with move `dd` and tree position. | W8-PMC-T03 covers AI side of the same lifecycle. |
| W8-PMC-T02 | SIDE_EFFECT_BOUNDARY | `createBoardInteractionController` + real resolver + real `executePlayInteraction` | same as T01 | same as T01, returning unchanged/invalid play result | same as T01 | Mocking the controller, resolver, or executor | No Attempt/monitor/analysis/AI calls when play result is invalid or unchanged. | not-covered: documentStore legality itself is outside controller scope. |
| W8-PMC-T03 | SIDE_EFFECT_BOUNDARY | `createBoardInteractionController` + real resolver + real Play executor path | same as T01 | deterministic AI service returning one candidate; document/attempt/monitor/analysis recorders | same as T01; AI fake is a `local tiny stub` returning a single candidate, not a service behavior model | Directly invoking an internal helper; mocking `documentStore.playMove` to pretend post handlers ran | AI candidate produces a second Play commit and AI post-commit participants run with actor `ai`; analysis is scheduled for AI tree position too. | W8-PMC-T04 covers continuation guard. |
| W8-PMC-T04 | SIDE_EFFECT_BOUNDARY | `createBoardInteractionController` continuation loop | same as T01 | deterministic AI candidate queue; document/attempt/monitor/analysis recorders | same as T01; fake AI queue is `local tiny stub` bounded by test input | Sleep/timer mocks; unbounded recursive promises; mocking controller internals | With `AutoPlayLimits.maxAutoMovesPerRun = 2`, exactly two AI commits beyond the triggering commit are allowed and no third write occurs. | DEFERRED: full start-turn AI black-first flow belongs to a later workbench flow step. |
| W8-PMC-T05 | SIDE_EFFECT_BOUNDARY | `createBoardInteractionController` AI reply handling | same as T01 | AI service returning `null` and separately invalid candidate such as `resign`; document/attempt recorders | same as T01; stale represented by null per `aiMoveService` API contract | Mocking freshness validation inside controller | No second document write and no AI Attempt append for null/stale/invalid candidate. | W8-PMC-T08 covers AI service write boundary. |
| W8-PMC-T06 | SIDE_EFFECT_BOUNDARY | `createBoardInteractionController` mode routing | real resolver/context/executors for recall/scratch/problem routing | document/attempt/monitor/ai recorders; recall adapter; problemFlowService; edit workspace deps | `real production interface/type` for controller deps; local recorders only observe whether Play post handlers leak | Mocking resolver result directly | Problem/Recall/Analysis click paths do not invoke Play post-commit handlers. | Existing W8P1-T13/T14/T25 continue covering recall/analysis no game-tree writes. |
| W8-PMC-T07 | ARCHITECTURE_BOUNDARY | `boardInteractionController.ts`, `playInteractionExecutor.js` source | filesystem source read | none | no mock | Replacing source scan with dependency injection fake | Source has no `overlayRegion`/`overlayStore` import or call in Play commit fan-out. | not-covered: rendered overlay off projection is outside this step. |
| W8-PMC-T08 | ARCHITECTURE_BOUNDARY | `aiMoveService.ts` source | filesystem source read | none | no mock | Mocking `aiMoveService` and claiming service boundary coverage | Source lacks direct game-tree write, Attempt append/write, or overlay APIs. | W8-PMC-T05 covers controller handling of null/invalid candidate. |
| W8-PMC-T09 | ARCHITECTURE_BOUNDARY | controller/design implementation source | filesystem source read | none | no mock | Banning the helper name `afterPlayMoveCommitted` | Source does not define/export/persist/emit a `PlayMoveCommitted` event or bus message. | not-covered: architecture review will inspect final implementation diff. |

Mock policy:

- Tests must use the real `createBoardInteractionController`, real resolver, real context builder, and real `executePlayInteraction` import path.
- Per-file recorders for `documentStore.playMove`, `attemptService.appendMove`, monitor, analysis, repository load, and AI candidate return are allowed only as controller port observers. They are not allowed to model legal move rules, repository persistence semantics, or engine behavior.
- Because `documentStore.playMove` port, Attempt service, and repository ports normally risk mock drift, each recorder must assert only the controller boundary: whether the port was called, with which minimal payload, and whether post-commit was gated by changed result.
- If test-writer needs a broader service fake than these minimal recorders, it must first add a shared typed spy/fake helper constrained by production interfaces; do not hand-write a full fake service inside the test file.
- Weak-test ban: "callback called once" is insufficient for W8-PMC-T01/T03/T05/T06. The primary assertions must include state-forward payload facts and forbidden side effects.

## 11. 仅手动验收

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| W8-PMC-M01 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | After implementation, a local smoke can click Play and verify the board visually advances for human/AI moves. | Useful but not required for this contract step. | Visual smoke cannot prove Attempt/monitor/analysis boundaries. |

## 12. 不测试

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| W8-PMC-N01 | UI_BEHAVIOR | DO_NOT_TEST | No CSS, layout, tokens, screenshots, or overlay rendering tests in this step. | Keeps contract in business/wiring scope. | Visual fidelity belongs to frontend visual workflow. |
| W8-PMC-N02 | PURE_LOGIC | DO_NOT_TEST | No new tests for SGF coordinate conversion except as observable AI candidate routing. | Conversion helpers are implementation detail here. | Over-specifying helpers would block refactors. |
| W8-PMC-N03 | SIDE_EFFECT | DO_NOT_TEST | No engine strength, candidate quality, or AI analysis correctness tests. | `aiMoveService`/engine quality is outside controller post-commit scope. | Engine behavior requires separate service tests. |
| W8-PMC-N04 | STATE | DO_NOT_TEST | No full rendered Attempt timeline projection test in this step. | Step payload locks primary file to controller wiring. | Later UI projection tests may be needed after implementation if panels depend on AI move display. |

## 13. 脆弱测试警告

- Do not assert exact internal helper names except allowing a local `afterPlayMoveCommitted`; contract is about observable post-commit behavior.
- Do not assert handler order unless the order is the commit gate itself: `documentStore.playMove changed` must precede post handlers.
- Do not let current direct AI `documentStore.playMove` become a GREEN contract. W8-PMC-T03 must be RED until AI move gets the same post-commit participant coverage as human moves.
- Do not prove AI vs AI with timers. Use a deterministic candidate queue and an explicit max-move guard.
- Do not call Container or Goban handlers with a two-argument `(vertex, event)` signature. The real upstream call is `onVertexClick(evt)` with `evt.vertex`.

## 14. 超出范围

- Production edits are out of scope for contract-designer.
- `aiMoveService.ts` production edits are out of scope unless contract audit proves the injected controller seam cannot satisfy the tests.
- New event bus, persistent event table, exported `PlayMoveCommitted` type, IPC event, or DOM event.
- Problem AI opponent implementation and problemArea engine filtering beyond proving Problem does not reuse Play commit.
- Snapshot / Analysis scratch source implementation.
- Overlay rendering or visual acceptance.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 未引入 | Architecture lines 70-85, 95-116；本契约按 WorkbenchMode 和 mutationContract 路由。 | Tests must not branch assertions by origin/source. |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API 作为新主路径 | 未引入 | Architecture lines 23-31 禁止旧 API；本 step 只测 board interaction controller。 | Forbidden in implementation. |
| 是否让 `snapshotService` 承担未分配的 tab opening / flow orchestration | 未引入 | Architecture lines 1937-1947 属 snapshot path，本 step 不涉及。 | No snapshot tests here. |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 未引入 | Container lines 879-904 只调用 controller；本契约不要求 Container store writes。 | Keep tests at controller boundary. |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 未引入 | Architecture lines 95-104；Goban lines 232-282 只 emits callback. | No UI production changes. |
| 是否把 `PlayMoveCommitted` 变成 formal event/bus/persistent event | 明确禁止 | PRD lines 21-22, 350-351；Architecture lines 27-31；Design lines 37-58, 100-127. | W8-PMC-T09 automates boundary. |
| 是否把 Problem/Recall/Analysis 复用 Play commit semantics | 明确禁止 | Design lines 64-73, 274-279；Architecture lines 1846-1849. | W8-PMC-T06 automates guard. |
| 是否让 overlay 进入 Play commit fan-out | 明确禁止 | Design lines 156-157, 232-238；Architecture lines 1842-1844. | W8-PMC-T07 automates boundary. |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Goban Play left click | Human Play move | Goban emits, Container delegates, controller owns routing, Play executor owns document write | PRD lines 338-359; Architecture lines 1811-1840 | `documentStore.playMove` changed -> post-commit Attempt/monitor/analysis/AI | Existing Sabaki document projection and Workbench Attempt projection update outside this step | W8-PMC-T01/T02 | tests by mode |
| AI move candidate | AI Play move command/candidate | `aiMoveService` returns candidate; controller re-enters Play command/executor | Architecture lines 811-932; Design lines 197-224 | AI candidate -> Play executor -> changed AI result -> same after pipeline | Attempt line may include actor `ai`; board advances through documentStore | W8-PMC-T03/T04/T05 | controller + tests |
| Problem board click | `problemAttemptMove` | controller + `problemFlowService` | Design lines 64-73, 274-279; Architecture lines 1846-1849 | problem runtime / Attempt line only | Problem projection, not game-tree Play commit | W8-PMC-T06 | tests by mode |
| Recall board click | `recallAnswer` | controller + recall adapter/service | Architecture lines 1882-1923 | recall attempt/session state | recall view projection | Existing W8P1-T13/T25 plus W8-PMC-T06 | tests by mode |
| Analysis board click | `scratchEdit` | controller + scratch executor | Design lines 274-279 | scratch/current working position | Analysis projection only | Existing W8P1-T14 plus W8-PMC-T06 | tests by mode |
| OverlayRegion | display-only/off in Play | not a Play commit participant | Design lines 156-157, 232-238; Architecture lines 1842-1844 | no state advancement from Play commit | overlay remains off outside Analysis | W8-PMC-T07 source boundary | architecture review |

订阅契约：

- `documentStore` / Sabaki game tree subscription is responsible for board return after human and AI Play writes; this step only proves controller invokes the write path.
- Attempt/repository/runtime subscriptions are downstream of `attemptService` and monitor; this step proves controller invokes the correct service seams after changed result, not rendered timeline return.
- No overlay subscription should be triggered by Play commit fan-out.

命令清单：

| 语义命令 | Owner | 约束 |
| --- | --- | --- |
| Human Play move | controller + Play executor | Only changed `documentStore.playMove` enters post-commit. |
| AI Play move candidate | `aiMoveService` returns, controller executes | AI service does not write; controller re-enters Play path. |
| Problem move | controller + `problemFlowService` | Does not use Play commit. |
| Recall answer | controller + recall adapter/service | Does not write game tree. |
| Analysis scratch edit | controller + scratch executor | Does not write Attempt.userLine. |

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contracts/docs | this contract artifact only | docs fixed | completed by this gate | Low. |
| tests by mode | `test/workbench/wiring/w8-p1-board-interaction-controller.test.js` | contract audit approved | Single test file, should be one serial test-writer to avoid conflicts | Medium if multiple workers edit same file. |
| controller | `src/modules/training/workbench/boardInteractionController.ts` | tests + test audit | Sole production owner per planner | High if parallelized; keep serial. |
| container/projection | no write in this slice | implementation result | Not needed unless contract audit expands scope | Should remain out of scope. |
| panel callback plumbing | no write in this slice | none | Existing Goban/Container signatures are only evidence | Should remain out of scope. |
| architecture review | final diff only | implementation + verification | Read-only | Low. |

Required constraints for downstream:

- Test-writer must add RED tests for W8-PMC-T03 and W8-PMC-T04 without weakening them to current behavior.
- Implementation owner is `src/modules/training/workbench/boardInteractionController.ts` only unless contract audit finds an impossible seam.
- Implementation may keep `aiMoveService.maybePlayAiMove` as current migration seam, but controller must treat its return as a candidate/command and route it through the same Play commit lifecycle.
- No new event/bus/persistent model is allowed to satisfy these tests.
- No overlay fan-out, source-specific tab APIs, or snapshot orchestration changes are allowed in this slice.
