# Play Move Post-Commit Pipeline Contract Addendum v0.2

Date: 2026-05-29
Status: confirmed

This addendum is scoped only to the architecture-reviewer REQUEST_CHANGES blockers for `test-contract-v0.1.md`.
It supersedes the stale-AI and AI-vs-AI stop details in v0.1 rows `W8-PMC-T04`, `W8-PMC-T05`, and `W8-PMC-T08`; all Snapshot, overlay, source-specific tab API, and event-bus constraints remain unchanged.

# 契约草案

## 0. 真源对齐

| 真源 | 章节/行索引 | 对本 addendum 的约束 |
| --- | --- | --- |
| `docs/product/sabaki-training-prd.md` | lines 338-359 | Play 中用户或 AI 产生一手后必须先写入棋树再进入 Attempt / AI / analysis 后置流程；AI vs AI 必须有最大手数、双 pass、resign、无合法手、用户中断保护。 |
| `docs/product/sabaki-training-prd.md` | lines 1309-1327 | `aiMoveService` 只提供下一手候选；AI 请求必须校验 `requestId / attemptId / treePosition / mode freshness`；stale AI move 不得写棋树或 Attempt。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 811-820 | `aiMoveService` 是 AI turn policy + engine request orchestration owner，但不得直接写 game tree、Attempt 或 overlay。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 824-850 | AI service API 已把 `treePosition` 放入 `maybeStartPlayTurn`、`requestAiMove` 和 `validateAiMove` 输入，freshness 必须能校验请求对应的 tree position。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 884-912 | `AiMovePending` 是异步 freshness 事实源；`requestId/tabId/attemptId/positionHash/color/startedAt` 是至少字段，失败校验必须丢弃，AI vs AI 必须受 stop 条件约束。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 1811-1835 | Play human/AI move 都走同一 post-commit pipeline；AI continuation 发生在 changed moveResult 后。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | lines 2221-2239 | 禁止恢复旧 source/origin 主流程；AI 请求必须校验 stale 条件，过期不可写。 |
| `docs/design/play-move-committed-architecture.md` | lines 100-127 | `AfterPlayMoveContext.moveResult` 可携带 `doublePass` 等 terminal metadata；context 必须来自成功 playMove 后的稳定快照，避免 stale read。 |
| `docs/design/play-move-committed-architecture.md` | lines 147-153 | stale AI result 必须 drop；fresh result 才能返回 AI Play move command。 |
| `docs/design/play-move-committed-architecture.md` | lines 197-224 | AI 首手/应手不能绕过 Play 主线，engine result 只返回 command，再由 `documentStore.playMove` 提交。 |
| `docs/design/play-move-committed-architecture.md` | lines 228-255 | `aiMoveService` 可写 `pendingAiMove`、请求 engine、返回 command；禁止直接写 Attempt、overlay 或绕过 Play command。 |
| `docs/design/play-move-committed-architecture.md` | lines 286-299 | 本 slice 必须覆盖 stale AI result ignored 和 AI vs AI stops at max-move / double-pass / resign / no-legal-move / user interruption limits。 |
| architecture-reviewer REQUEST_CHANGES | conversation blocker 1 | AI continuation 在 terminal metadata（至少 `doublePass`）出现后，必须在请求或提交 AI move 前停止。 |
| architecture-reviewer REQUEST_CHANGES | conversation blocker 2 | AI stale guard 必须包含 `treePosition` freshness；stale tree position response 不得产生 AI candidate acceptance 或写入。 |

## 1. 用户故事

作为 Play Mode 用户，我下一手导致终局元数据（例如双 pass）后，系统仍可记录已成功提交的这手，但不能再请求或提交 AI 应手。作为等待 AI 应手的用户，如果 AI 请求返回时棋树位置已变化，系统必须把该结果当作 stale 丢弃，不能接受候选手，也不能写棋树或 Attempt。

## 2. 用户动作

- 用户或 AI 在 Play 中提交一手，`documentStore.playMove` 返回 changed 且 `moveResult.doublePass === true`。
- 用户或其他流程在 AI engine request pending 期间改变当前 `treePosition`。
- stale engine response 返回看似合法的 move。

## 3. 当前阶段

Workbench `play` mode 的 AI continuation / stale request guard。只补 reviewer blocker，不重新打开 Snapshot、overlay、event bus、Problem AI opponent、视觉或 Container callback 任务。

## 4. 位置源

| 场景 | 位置源 | 说明 |
| --- | --- | --- |
| Terminal Play move | `game-tree` | 已提交的 terminal move 仍以 `documentStore.playMove` changed result 为事实。 |
| AI pending freshness | `game-tree` | Pending request 必须绑定发起请求时的 `treePosition`，返回时与当前 active tab/document tree position 对齐。 |
| Stale AI response | 无变更 | 返回 move 不得转成 AI Play command，不得写 game tree 或 Attempt。 |

## 5. 变更契约

| 场景 | 变更契约 | 说明 |
| --- | --- | --- |
| Changed move with terminal metadata | `playMove` for committed move, then no AI continuation | Attempt/monitor/analysis 可观察已提交 move；AI continuation hard-stop。 |
| AI request pending with same `treePosition` | AI command may continue through `playMove` | 仍必须走 v0.1 的 Play command path。 |
| AI response after current `treePosition` changed | 无 AI 变更 | `aiMoveService` returns `null` / drops result；controller must not execute AI candidate. |

## 6. 预期状态流

Terminal stop:

`documentStore.playMove(...) -> changed moveResult({treePosition, doublePass:true}) -> afterPlayMoveCommitted(context) records committed move side effects -> terminal guard runs before aiMoveService.maybePlayAiMove/requestAiMove -> no engine request -> no AI command -> no second documentStore.playMove`.

Tree-position freshness:

`afterPlayMoveCommitted(context.treePositionAfter) -> aiMoveService.requestAiMove({tabId, attemptId, treePosition}) -> trainingRuntimeStore.setAiMovePending({requestId, tabId, attemptId, positionHash, treePosition, mode, color}) -> engineService.requestMove(...) pending -> active tab/document currentTreePosition changes -> engine resolves move -> aiMoveService freshness check compares pending.treePosition/request treePosition to current active treePosition -> mismatch returns null and clears only the matching pending request -> controller receives null -> no AI candidate acceptance/write`.

If no production source currently exposes a fresh tree position through `WorkbenchTab.currentTreePosition`, `workbenchStore`, or an injected document/current-position reader, implementation must add the smallest service-level seam needed inside `aiMoveService` deps. Do not make UI components or stores call the engine.

## 7. 允许的副作用

- The terminal-causing Play move may still write game tree, append Attempt, notify monitor, and schedule background analysis after changed result.
- `aiMoveService` may store `pendingAiMove.treePosition` in `trainingRuntimeStore`.
- `aiMoveService` may clear the matching pending request when a stale tree-position response is dropped.
- `workbenchStore` may be read to compare active tab, mode, attempt, and current tree position.

## 8. 禁止的副作用

- No engine request after `moveResult.doublePass === true` or equivalent terminal metadata is known.
- No AI command execution after terminal metadata, even if `AutoPlayLimits.maxAutoMovesPerRun` has remaining capacity.
- No AI candidate acceptance when pending/request `treePosition` differs from current active tree position.
- No game-tree write, Attempt append, monitor callback, analysis schedule, or recursive AI continuation for stale tree-position responses.
- No Snapshot, overlay, source-specific tab-opening API, event bus, or UI component store/service dependency changes.

## 9. 测试/验收契约表

| ID | 类型 | 分类 | 测试状态 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------- | -------------- | --------------- |
| W8-PMC-RC-T10 | SIDE_EFFECT | MUST_AUTOMATE | RED | A changed Play move with `moveResult.doublePass === true` records the committed move side effects but does not call `aiMoveService` and does not perform a second AI `documentStore.playMove`. | Closes blocker 1 at controller boundary before engine request. | A test that only asserts maxAutoMovesPerRun misses terminal metadata. |
| W8-PMC-RC-T11 | STATE | MUST_AUTOMATE | RED | `aiMoveService.requestAiMove` stores request `treePosition` in `trainingRuntimeStore.pendingAiMove` while the engine request is pending. | Makes tree-position freshness an explicit runtime fact instead of an implicit parameter. | Without this, stale tree position cannot be audited or compared after async return. |
| W8-PMC-RC-T12 | SIDE_EFFECT | MUST_AUTOMATE | RED | If current active tree position changes before the engine resolves, `aiMoveService` returns `null`, clears only the matching pending request, and does not accept the returned move. | Closes blocker 2 in the service owner where request freshness is validated. | A controller-only fake returning null would not prove real service freshness. |
| W8-PMC-RC-T13 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | GREEN | `aiMoveService` still has no direct game-tree, Attempt, monitor, analysis overlay, or UI dependency after adding tree-position freshness. | Ensures expanded owner scope does not violate v0.5 boundaries. | Over-broad scans can falsely forbid valid `attempt` reads used for positionHash freshness. |
| W8-PMC-RC-T14 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | GREEN | The fix introduces no Snapshot orchestration, source-specific tab opening APIs, `origin.provider` flow branch, or formal PlayMoveCommitted event. | Keeps REQUEST_CHANGES narrow. | Regression risk if implementation uses old source/kind APIs as shortcut to locate tree position. |

## 10. 必须自动化的测试

Allowed test write scope:

- `test/workbench/wiring/w8-p1-board-interaction-controller.test.js` for `W8-PMC-RC-T10`.
- `test/training/aiMoveService.test.js` for `W8-PMC-RC-T11` and `W8-PMC-RC-T12`.
- `test/training/trainingRuntimeStore.test.js` only if `AiMovePending` runtime shape/subscription needs direct coverage after adding `treePosition`.

| Test ID | Layer | Production Subject | Real Dependencies | Mocked Dependencies | Mock Contract Source | Forbidden Mocks | Primary Assertion | Downstream Covered By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W8-PMC-RC-T10 | SIDE_EFFECT_BOUNDARY | `createBoardInteractionController` + real resolver + real `executePlayInteraction` | `resolveBoardInteraction`, `createBoardInteractionContext`, `executePlayInteraction` | `documentStore.playMove` returning changed `{treePosition, doublePass:true}`; port recorders for Attempt/monitor/analysis/aiMoveService | `real production interface/type` via controller deps; local recorders only observe boundary calls | Mocking controller internals; testing only call count; faking terminal stop inside aiMoveService | Committed terminal move gets expected post-commit side effects, but `aiMoveService.maybePlayAiMove` is not called and no AI document write happens. | W8-PMC-RC-T11/T12 prove service freshness for non-terminal AI request path. |
| W8-PMC-RC-T11 | STORE_SUBSCRIPTION | `createAiMoveService` + real `createTrainingRuntimeStore` | real `createAiMoveService`, real `createTrainingRuntimeStore`; real or typed `createWorkbenchStore` if active tab context is needed | deferred `engineService.requestMove`; typed repository loadAttempt fake if existing test helper is reused | `shared typed spy factory` / `real production interface/type`; existing `createPhase3EngineService` and `createPhase3AttemptRepository` are acceptable | Hand-written fake runtime store; mocking `requestAiMove`; per-file fake full repository | While engine promise is pending, `runtimeStore.getState().pendingAiMove.treePosition` equals request input treePosition and subscribers are notified if the store shape test is added here. | W8-PMC-RC-T12 covers stale return behavior. |
| W8-PMC-RC-T12 | SERVICE_REPOSITORY_TRANSITION | `createAiMoveService.requestAiMove` freshness validation | real `createAiMoveService`, real `createTrainingRuntimeStore`, real or typed `createWorkbenchStore` | deferred engine service; typed repository loadAttempt fake; current tree position changed through production store/service seam | same as W8-PMC-RC-T11 | Controller fake returning null; mocking `isAiMoveRequestFresh`; changing only Attempt userLine and claiming tree-position coverage | After current active tree position changes from requested value, resolved engine move returns `null`; matching pending is cleared; no accepted move is exposed to controller. | W8-PMC-RC-T10 prevents controller from requesting AI on terminal metadata. |
| W8-PMC-RC-T13 | ARCHITECTURE_BOUNDARY | `aiMoveService.ts` source | filesystem source read | none | no mock | Claiming source boundary via mocked service behavior | Source still lacks documentStore/playMove, Attempt append/write, monitor, analysis overlay, or UI component dependencies. | architecture-reviewer final diff. |
| W8-PMC-RC-T14 | ARCHITECTURE_BOUNDARY | changed production source | filesystem source read | none | no mock | Banning local helper names already allowed by v0.1 | Source does not introduce `openGameTab`/`openProblemTab`/`openSnapshotProblemTab`, `origin.provider` branching, Snapshot orchestration, or a formal PlayMoveCommitted event/bus. | architecture-reviewer final diff. |

## 11. 仅手动验收

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| W8-PMC-RC-M01 | UI_BEHAVIOR | MANUAL_ACCEPTANCE | Optional smoke: play two passes in Play with AI enabled and confirm no extra AI move appears after terminal double pass. | Useful sanity check after tests pass. | Manual smoke cannot prove stale async response was dropped. |

## 12. 不测试

| ID | 类型 | 分类 | 契约 | 重要性 | 遗漏风险 |
| --- | ---- | -------------- | -------- | -------------- | --------------- |
| W8-PMC-RC-N01 | UI_BEHAVIOR | DO_NOT_TEST | No visual/CSS/layout/screenshot tests. | REQUEST_CHANGES are business/state boundaries. | Visual tests would not prove AI freshness. |
| W8-PMC-RC-N02 | SIDE_EFFECT | DO_NOT_TEST | No Snapshot, overlay, Problem AI area, or Recall behavior expansion. | Keeps scope narrow. | Reopening old scopes risks unrelated regressions. |
| W8-PMC-RC-N03 | PURE_LOGIC | DO_NOT_TEST | No engine move quality or SGF coordinate conversion tests. | Existing contract covers invalid candidate handling enough for this blocker. | Over-specifying engine output blocks refactors. |

## 13. 脆弱测试警告

- Do not make `W8-PMC-RC-T10` pass by letting controller call `aiMoveService` and relying on a fake service to no-op; the contract is "no AI request after terminal metadata."
- Do not represent tree-position staleness only as Attempt `userLine`/`positionHash` change. That is already covered by existing P3 stale tests and does not close blocker 2.
- Do not use current code's `allowTerminalCheck` behavior as the contract. Terminal metadata is a hard stop, not permission for one extra engine request.
- Do not use a per-file handwritten fake runtime store for pending shape. Use the real `createTrainingRuntimeStore` or a shared typed helper.

## 14. 超出范围

- Production edits beyond `boardInteractionController.ts`, `aiMoveService.ts`, and `trainingRuntimeStore.ts` are out of scope unless implementation proves a typed current-position reader is needed.
- No production or test edits by contract-designer.
- No event bus, persistent event, exported `PlayMoveCommitted` type, Snapshot orchestration, overlay fan-out, or UI component dependency changes.

## 15. v0.5 冲突检查

| 检查项 | 结论 | 证据 | 处理 |
| --- | --- | --- | --- |
| 是否把 `origin.provider` 或旧 `source/kind` 当作流程分支 | 禁止 | Architecture lines 2221-2239；本 addendum 使用 Workbench mode + active tree position freshness。 | W8-PMC-RC-T14 source boundary。 |
| 是否引入 `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` 等 source-specific API | 禁止 | v0.1 已禁止；本 blocker 不涉及 tab opening。 | W8-PMC-RC-T14。 |
| 是否让 `snapshotService` 承担 tab opening / flow orchestration | 禁止 | 本 addendum 无 Snapshot scope。 | W8-PMC-RC-T14。 |
| 是否让 container 直接写 store，而不是通过 v0.5 指定 service | 禁止 | Freshness owner 是 `aiMoveService` + runtime/workbench store reads。 | No Container production scope。 |
| 是否让 UI component 直接依赖 service/store/repository/Sabaki | 禁止 | UI 不参与 REQUEST_CHANGES。 | No UI production/test scope。 |
| 是否让 `aiMoveService` 直接写 game tree / Attempt / overlay | 禁止 | Architecture lines 811-820, 914-932；Design lines 228-255。 | W8-PMC-RC-T13。 |
| 是否把 `treePosition` freshness 降级为 `positionHash` freshness | 冲突 | PRD lines 1317-1327 explicitly list `treePosition` freshness。 | W8-PMC-RC-T11/T12 必须独立证明。 |

## 16. Workbench 接线清单（如适用）

| 控件/区域 | 命令 | Owner | v0.5 来源 | 状态前进 | 状态回流 | 测试策略 | 并行归属 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Play board committed move | Post-commit AI continuation decision | `boardInteractionController` for terminal stop before service call | PRD lines 355-357; Design lines 100-127, 286-299 | changed Play move side effects occur; terminal metadata prevents AI request/write | No additional UI projection expected | W8-PMC-RC-T10 | controller/tests |
| AI pending request | Request/freshness management | `aiMoveService` + `trainingRuntimeStore` | Architecture lines 824-912; PRD lines 1309-1327 | pending records `treePosition`; stale response returns null | Existing store subscription can notify pending state observers if any | W8-PMC-RC-T11/T12 | service/store/tests |

Production owner scope decision:

- Yes, the implementation owner must expand beyond `src/modules/training/workbench/boardInteractionController.ts`.
- `boardInteractionController.ts` owns terminal metadata stop before AI request/submission.
- `src/modules/training/ai/aiMoveService.ts` owns request `treePosition` capture and freshness validation.
- `src/modules/training/store/trainingRuntimeStore.ts` is allowed/expected if `AiMovePending` needs a `treePosition` field and runtime shape coverage.

## 17. 任务并行建议（如适用）

| 并行任务 | 写入范围 | 依赖 | 可并行原因 | 合并风险 |
| --- | --- | --- | --- | --- |
| contract addendum | this addendum + slice ledger | architecture review blockers | completed by this gate | Low. |
| controller terminal tests | `test/workbench/wiring/w8-p1-board-interaction-controller.test.js` | v0.2 | Disjoint from service freshness tests | Low if test files stay separate. |
| AI service freshness tests | `test/training/aiMoveService.test.js`, maybe `test/training/trainingRuntimeStore.test.js` | v0.2 | Disjoint from controller test file | Medium if store shape also touches shared typed fakes. |
| implementation controller | `src/modules/training/workbench/boardInteractionController.ts` | tests/review | Terminal stop is local | Low. |
| implementation service/store | `src/modules/training/ai/aiMoveService.ts`, `src/modules/training/store/trainingRuntimeStore.ts`, maybe typed fake helper updates | tests/review | Freshness owner is service/store | Medium due type shape fan-out. |
| architecture review retry | final diff | implementation + verification | read-only | Low. |

Required constraints for downstream:

- `W8-PMC-RC-T10` must fail before the terminal guard if current implementation requests AI after `doublePass`.
- `W8-PMC-RC-T12` must fail before tree-position freshness is added; an existing positionHash stale test does not satisfy it.
- Tree-position freshness must be proven in real `aiMoveService`, not in a controller fake.
- The accepted implementation may add `treePosition?: string` to `AiMovePending`; if it does, tests must keep shared typed fakes synchronized with the production type.
- Do not reopen Snapshot/overlay/event bus/source-specific API work while fixing these blockers.
