# 测试审计

## 1. 结论

REQUEST_CHANGES

本轮已修复上次审计的两个主要缺口的一部分：新增了 S2R-T04，且 S2R-T09 已经 scoped 扫描 `workbenchFlowService.submit` body。当前 4 个 RED 失败也是真红，分别指向缺少 service-side `runtimeStore.recallView` hydration、Container projection 仍为空、真实 Shell 仍显示 Recall empty UI、stale mismatch 测试无法越过 active projection 前置条件。

但测试仍不能批准进入实现。S2R-T04 只证明 real submit 触发过某个 Container `forceUpdate` 并让 `mode` 变成 `recall`，没有证明 runtime recall surface 通过订阅回流到 Container。S2R-T09 的 submit body guard 漏掉 contract 明确禁止的 `snapshotService` submit orchestration。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/workflow-checklists/2026-05-26-submit-to-recall-projection.md` | workflow checklist | 否 | step4 retry after REQUEST_CHANGES。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.2.md` | test contract | 否 | Source row / S2R test id 真源。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-audit-v0.1.md` | prior audit | 否 | 本轮 retry 的回归标准。 |
| `test/training/workbenchFlowService.test.js` | service transition/hydration test | 是 | S2R-T03 使用真实 `createWorkbenchFlowService`、真实 stores/services、typed in-memory repository fake。 |
| `test/workbench/wiring/submit-to-recall-projection.test.js` | Workbench wiring/projection/rendered/boundary tests | 是 | S2R-T01/T02/T04/T05/T06/T07/T08/T09。 |
| `test/training/phase3TypedFakes.ts` | typed fake helper | 是 | `createPhase3StrictRecallRepository` 绑定 `TrainingRepository` subset。 |
| `test/workbench/shared/workbenchSpyFactories.ts` | shared typed spies | 是 | `createSpyFlowService` 使用 `satisfies SpyWorkbenchFlowService`，只用于 S2R-T02 delegation。 |
| `src/components/TrainingWorkbenchContainer.js` | production reference | 是 | 验证 subscription、handler signature、projection seam。 |
| `src/components/WorkbenchShell.js`, `src/components/workbench/shell/ModeActions.js`, `src/components/workbench/panels/ProblemModePanel.js`, `src/components/workbench/panels/RecallModePanel.js` | production reference | 是 | 验证 visible callbacks 和 rendered panel selection。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | production reference | 是 | 验证 submit state-forward 当前缺口和 S2R-T09 scan scope。 |

## 3. 阻塞问题

1. `test/workbench/wiring/submit-to-recall-projection.test.js:307` 的 S2R-T04 仍可能假绿，不能证明 runtime recall projection 通过 Container subscription 回流。
   - 证据：该测试在 `test/workbench/wiring/submit-to-recall-projection.test.js:309-314` 包装 `container.forceUpdate` 计数，`319-324` 只断言 `forceUpdateCount > 0` 和 `after.mode === 'recall'`。
   - 为什么阻塞：`workbenchFlowService.submit` 当前顺序是先 `workbenchStore.updateTab(...mode:'recall')`，再 `runtimeStore.setProblemView(null)` / `runtimeStore.setActiveRecallSession(...)`，见 `src/modules/training/workbench/workbenchFlowService.ts:270-278`。未来实现即使加入 `runtimeStore.setRecallView(...)`，如果 `TrainingWorkbenchContainer` 的 `runtimeStore.subscribe` 被删除或断开，当前 S2R-T04 仍会因为 `workbenchStore` 的 mode update 而通过；S2R-T05/T06 又是 submit 完成后直接 `container.render()`，也会读到最终 store state，从而无法模拟 mounted UI 是否被 runtime notify 重新渲染。
   - 要求修改：S2R-T04 应证明 real submit 后至少一次 Container subscription-driven update 观察到 active Recall projection，而不仅是 mode。可行方式是让 wrapped `forceUpdate` 捕获每次 `container.render().props`，并在 submit 后断言捕获序列中出现 `mode='recall'` 且 `state='active'` / `totalMoves` / `recallSession.active` 的 projection。不要锁死 setter 顺序或精确通知次数。

2. `test/workbench/wiring/submit-to-recall-projection.test.js:382` 的 S2R-T09 漏掉 `snapshotService` submit orchestration 禁令。
   - 证据：`forbidden` 只包含 `openGameTab`、`openProblemTab`、`openSnapshotProblemTab`、`origin.provider`、`source_kind`，见 `test/workbench/wiring/submit-to-recall-projection.test.js:388-394`。`submitSource` 确实 scoped 到 `workbenchFlowService.submit`，见 `403-411`，但没有禁止 `snapshotService` token。
   - 为什么阻塞：contract v0.2 明确禁止 `snapshotService` 承担 tab opening、submit flow orchestration 或 recall hydration。当前测试允许实现者在 `submit` body 中新增 `snapshotService.captureSnapshotInput(...)` 或类似 orchestration，并且测试仍然通过。
   - 要求修改：仅在 `submitSource` scoped body 中加入 `snapshotService` 禁令；不要全文件扫描，因为同文件 `snapshotFromCurrentContext` 合法使用 snapshot service。建议同时覆盖 `sourceKind` / `source.kind` / optional `origin?.provider` 等 source-specific branching variants，或使用更明确的 AST/token scanner。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `submit-to-recall-projection.test.js:307-324` S2R-T04 | subscription test 只证明某次 forceUpdate 和 mode outcome | 删除 runtimeStore subscription 后仍可能由 workbenchStore mode update 带绿；mounted UI 可能停在 empty Recall panel | 捕获 subscription-driven projected props，要求出现 active Recall surface。 |
| `submit-to-recall-projection.test.js:382-411` S2R-T09 | submit guard 漏掉 snapshotService orchestration | 实现可把 submit 修成 snapshot-driven path 仍通过测试 | 在 scoped `submitSource` 中禁止 `snapshotService`，保留 scoped scan 避免 unrelated false positive。 |
| `submit-to-recall-projection.test.js:371-380` S2R-T07 | 非阻塞：只扫 wiring regression suite | 目前未发现 success path 手动 seed；但 service S2R-T03 不在 T07 scan 范围 | 可选扩展到 `test/training/workbenchFlowService.test.js` 的 S2R block，或保持人工审计。 |
| `submit-to-recall-projection.test.js:357-369` S2R-T08 | 当前 RED 合法 | 它先要求真实 submit 产生 active projection，再构造 mismatch；没有断言当前错误行为 | 无需修改。 |

必查 grep 结果：

| Pattern | 命中 | 审计结论 |
| --- | --- | --- |
| `assert.ok(true`, `assert(true`, `.skip(`, `this.skip`, `TODO`, `GAP`, `current behavior`, `passthrough` | 无 in-scope 命中 | 未发现 placeholder pass 或逆向契约测试。 |
| `if (!` | `test/training/workbenchFlowService.test.js:1222` | 旧 `inferDefaultMode` helper fallback，不属于本 S2R contract；非阻塞。 |
| `Contract:` | `test/workbench/wiring/submit-to-recall-projection.test.js:4`; `test/training/workbenchFlowService.test.js:936` | 注释引用契约，非风险。 |
| `function createSpy.*Service` / `const createSpy.*Service` | target files 无本地定义；shared factory 有 typed definitions | `test/workbench/shared/workbenchSpyFactories.ts:82-155` 使用 `satisfies SpyWorkbenchFlowService`，S2R-T02 使用范围正确。 |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| PRD §5.2 Workbench runtime mode fixed set | Submit 后进入四 mode 中的 `recall`，不新增 runtime mode | S2R-T03 `test/training/workbenchFlowService.test.js:153-223`; S2R-T05 `test/workbench/wiring/submit-to-recall-projection.test.js:326-343` | covered | 当前 RED 不是 mode，而是 active recall surface。 |
| Architecture §0.4 `play/problem + submit + activeAttempt && !frozen` | freeze attempt、create RecallSession、`mode='recall'`、`recallSubstate='normal'` | S2R-T03 `test/training/workbenchFlowService.test.js:153-223` | covered | 使用真实 flow/attempt/recall services 和 typed repository fake。 |
| Architecture §9.4 submit command chain | visible/container submit 到 service/repository/store/runtime active id | S2R-T01/T02/T03 `test/workbench/wiring/submit-to-recall-projection.test.js:270-305`; `test/training/workbenchFlowService.test.js:153-223` | covered | T02 spy 只声称 delegation；T03 覆盖 state-forward。 |
| Store subscription/projection return | 真实 submit 后 store-owned state 通过 Container subscription 回流到 projected Recall surface | S2R-T04 `test/workbench/wiring/submit-to-recall-projection.test.js:307-324` | not-covered | 只断言 forceUpdate 和 mode，不证明 runtime recall surface 通过订阅回流。 |
| Service/runtime projection migration seam | submit hydrates transient active `runtimeStore.recallView` with matching ids | S2R-T03/T05/T08 | covered | 当前 RED meaningful：service 未 hydrate recallView。 |
| Rendered Recall UI return | Shell selects real RecallModePanel and shows active progress, not empty state | S2R-T06 `test/workbench/wiring/submit-to-recall-projection.test.js:345-355` | covered | 当前 RED meaningful：真实 Shell 仍显示 empty text。 |
| Fake-green exclusions | No manual success-path `setRecallView`, forced recall mode, or props override | S2R-T07 `test/workbench/wiring/submit-to-recall-projection.test.js:371-380` + manual grep | covered | 没有发现 success-path manual asserted-state mutation。S2R-T08 的 `updateTab(activeRecallSessionId)` 是负向 stale fixture。 |
| Source-specific / presentational boundary | No source-specific submit path, snapshot submit orchestration, or UI direct service/store/repository dependency | S2R-T09 `test/workbench/wiring/submit-to-recall-projection.test.js:382-421` | not-covered | UI presentational guard covered；`submitSource` scoped guard 缺 `snapshotService`。 |
| Play top end visible path | Deferred Play end-to-recall UI path | S2R-FU-PLAY-END | deferred-with-approved-reason | Contract v0.2 有 reason 和 exit condition。 |
| Legacy App mount gate | Full App `sabaki.state.mode` gate migration | S2R-FU-APP-GATE / S2R-M02 | deferred-with-approved-reason | Contract v0.2 有 reason 和 exit condition。 |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | S2R imports real `TrainingWorkbenchContainer`, `WorkbenchShell`, `createWorkbenchFlowService`, stores/services at `test/workbench/wiring/submit-to-recall-projection.test.js:23-34` and `test/training/workbenchFlowService.test.js:3-15`；in-scope tests 无 skip。 |
| 被测 handler 改成 noop 时，测试会失败吗？ | 会失败 | S2R-T02 asserts `flowService.calls.submit` with active tab id at `test/workbench/wiring/submit-to-recall-projection.test.js:294-305`；T05/T06 depend on real submit outcome。 |
| Container 不传关键 props 时，测试会失败吗？ | 会失败 | T05 asserts `mode/state/currentMove/totalMoves/progress` at `test/workbench/wiring/submit-to-recall-projection.test.js:336-342`; T06 asserts rendered Recall panel/progress at `350-354`。 |
| resolver 忽略 mode/context 时，测试会失败吗？ | 不适用 | 本 contract 没有 resolver subject；路径是 Container -> service。 |
| executor/service 写错 store 或漏写 store 时，测试会失败吗？ | 大多会失败 | T03 catches tab/runtime active id and recallView；T05/T06 catch projection/rendered return。T04 仍不能证明 runtime subscription 回流。 |
| store 更新后 UI projection 不变时，测试会失败吗？ | 会失败，但 mounted subscription 仍有缺口 | T05/T06 assert final projection/rendered VNode；T04 未证明 runtime notification 触发的 active projection。 |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | Targeted run: 82 passing, 4 failing。失败点是 missing `runtime.recallView`、projected `state='empty'`、rendered empty Recall UI、stale test blocked before mismatch。 |

## 7. 结论与后续

当前 tests 没有发现 callback-only fake green、wrong-layer state-forward mock、reverse-contract assertion，或 success-path manual asserted-state mutation。真实 service/store/projection/rendered RED 是有效的 implementation target。

但进入实现前仍需 test-writer 回补：

1. 强化 S2R-T04，使它证明 subscription-driven update 中出现 active Recall projection，而不只是 mode recall。
2. 强化 S2R-T09，在 scoped `workbenchFlowService.submit` body 中禁止 `snapshotService` submit orchestration，并覆盖 source-specific branching token variants。
