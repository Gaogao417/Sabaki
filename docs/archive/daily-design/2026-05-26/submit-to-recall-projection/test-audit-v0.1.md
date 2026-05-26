# 测试审计

## 1. 结论

REQUEST_CHANGES

当前 4 个 RED 失败是有意义的，且没有发现主成功路径手动 `runtimeStore.setRecallView(...)`、`workbenchStore.updateTab({mode: 'recall'})` 或 `props.mode = 'recall'` 的假绿。S2R-T03/T05/T06 覆盖了真实 service/store/projection/rendered return 的核心缺口。

但还不能批准进入实现：契约要求的 S2R-T04 `STORE_SUBSCRIPTION` 没有落到测试；S2R-T09 边界 guard 没覆盖本轮最可能被修改的 `workbenchFlowService.ts` submit 实现路径。修完这两个测试覆盖缺口后可重新审计。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/workflow-checklists/2026-05-26-submit-to-recall-projection.md` | workflow checklist | 否 | step4 test audit。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.2.md` | approved contract | 否 | Source row / Test ID 真源。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/contract-audit-v0.2.md` | contract audit | 否 | 已批准 test-writer。 |
| `test/training/workbenchFlowService.test.js` | service transition test | 是 | 新 S2R-T03 hydration test 使用真实 `createWorkbenchFlowService`、真实 stores/services、typed in-memory repository fake。 |
| `test/workbench/wiring/submit-to-recall-projection.test.js` | Workbench wiring/projection/rendered/guard tests | 是 | 新 S2R-T01/T02/T05/T06/T07/T08/T09。 |
| `test/training/phase3TypedFakes.ts` | typed repository fake/helper | 是 | `createPhase3StrictRecallRepository` 绑定 `TrainingRepository` surface。 |
| `test/workbench/shared/workbenchSpyFactories.ts` | shared typed spies | 是 | S2R-T02 typed spy only；state-forward/projection tests不使用 mocked flow service。 |
| `src/components/TrainingWorkbenchContainer.js`, `src/components/WorkbenchShell.js`, `src/components/workbench/shell/ModeActions.js`, `src/components/workbench/panels/ProblemModePanel.js`, `src/components/workbench/panels/RecallModePanel.js`, `src/modules/training/workbench/workbenchFlowService.ts` | production reference | 是 | 用于验证真实调用签名、projection、service submit 当前缺口。 |

## 3. 阻塞问题

1. `S2R-T04` contract row 未实现，当前测试没有证明 store subscription / Container re-render loop。
   - 证据：`test-contract-v0.2.md` 要求 S2R-T04 覆盖 “Real submit causes store-owned state changes that are observable by a subscriber/projection harness”；但 `submit-to-recall-projection.test.js:252-375` 只有 S2R-T01/T02/T05/T06/T08/T07/T09。
   - 风险：`S2R-T05` 在 `submit-to-recall-projection.test.js:289-306` 直接再次调用 `container.render().props`，能证明 projection 读到 store 当前值，但不能证明 `TrainingWorkbenchContainer` 的 `runtimeStore/workbenchStore.subscribe -> forceUpdate` 链路仍有效。删除 `TrainingWorkbenchContainer` 的订阅仍可能不被本组测试抓住。
   - 要求：新增 S2R-T04，使用真实 stores 和真实 submit；允许本地 subscriber counter/spy，但主断言应是 submit 后 store notification 被观察到，并且 projection outcome 变为 Recall active。不要锁死每个 setter 顺序或精确 notify 次数。

2. `S2R-T09` guard 漏扫本轮 submit 实现主文件，不能防止 service submit 路径引入 source-specific orchestration。
   - 证据：`submit-to-recall-projection.test.js:345-373` 只扫描 `WorkbenchShell.js`、`RecallModePanel.js`、`TrainingWorkbenchContainer.js`。step5 scope 和契约主实现路径包含 `src/modules/training/workbench/workbenchFlowService.ts`。
   - 风险：implementation 可在 `workbenchFlowService.submit` 中新增 `snapshotService` orchestration、`openGameTab/openProblemTab/openSnapshotProblemTab` 或 `origin.provider/source_kind` 分支而 T09 仍为绿。
   - 要求：扩展 T09 为 scoped guard：只扫描 `workbenchFlowService.ts` 的 `submit`/recall mapper 实现范围，禁止 source-specific submit branching；不要全文件裸扫 `origin.provider` 或 `snapshotService`，因为 `snapshotFromCurrentContext` 现有代码会造成无关 false positive。现有 UI presentational guard 可保留。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `submit-to-recall-projection.test.js:289-306` S2R-T05 | 缺少 subscription 证明 | 直接 render 可绕过 `subscribe -> forceUpdate`，不能代表 mounted UI 自动回流 | 增加 S2R-T04 observer/subscriber harness；T05 可继续负责 projection return。 |
| `submit-to-recall-projection.test.js:345-373` S2R-T09 | boundary guard 范围过窄 | 没扫 primary service submit file，无法守住 contract 的 source-specific API 禁令 | 扫描 `workbenchFlowService.ts` submit/mapper body，同时避免扫描 unrelated snapshot function。 |
| `submit-to-recall-projection.test.js:334-343` S2R-T07 | 非阻塞：只扫 wiring suite 文件 | 当前没有假绿；但核心 S2R-T03 在 `workbenchFlowService.test.js`，未来手动 seed 该文件不会被 T07 自动抓到 | 建议把 T07 扫描范围加入本轮 S2R service test block，或在 S2R-T03 附近加等价 guard。 |
| `submit-to-recall-projection.test.js:320-331` S2R-T08 | 当前 RED 合法 | 先要求真实 submit 创建 active projection，再构造 mismatch；不会反向断言当前错误行为 | 无需修改；实现后应继续证明 stale view 不投影 active。 |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| PRD §5.2 Workbench runtime mode set | Submit 后进入四 mode 中的 `recall`，不引入第五 mode | S2R-T03 `workbenchFlowService.test.js:153-223`; S2R-T05 `submit-to-recall-projection.test.js:289-306` | covered | 当前 RED 点不是 mode，而是 recallView/projection。 |
| Architecture §0.4 `play/problem + submit + activeAttempt && !frozen` | freeze/create recall/`mode=recall`/`recallSubstate=normal` | S2R-T03 `workbenchFlowService.test.js:153-223` | covered | 使用真实 flow/attempt/recall services 和 typed in-memory repository fake。 |
| Architecture §9.4 submit command chain | UI/Container submit 到 service/repository/store/runtime active id | S2R-T01/T02/T03 `submit-to-recall-projection.test.js:253-287`, `workbenchFlowService.test.js:153-223` | covered | T02 typed spy 只覆盖 delegation；T03 真实 service 覆盖 state-forward。 |
| Store subscription/projection return | 真实 submit 后 store-owned state 被 subscriber/projection harness 观察并回流 | S2R-T04 | not-covered | 缺少独立 S2R-T04。T05 直接 render 不证明 subscription。 |
| Service/runtime projection migration seam | submit hydrates transient active `runtimeStore.recallView` with matching ids | S2R-T03/T05/T08 | covered | 当前 RED meaningful：service 未 hydrate recallView，T05/T08 随之红。 |
| Rendered Recall UI return | Shell selects real RecallModePanel and shows active progress, not empty state | S2R-T06 `submit-to-recall-projection.test.js:308-318` | covered | 当前 RED meaningful：真实 Shell 仍显示 empty text。 |
| Fake-green exclusions | No manual success-path `setRecallView`, forced recall mode, or props override | S2R-T07 `submit-to-recall-projection.test.js:334-343` | covered | 当前 suite 通过；建议扩展到 service S2R block。 |
| Source-specific / presentational boundary | No source-specific submit path or UI direct service/store/repository dependency | S2R-T09 | not-covered | UI presentational subset covered；primary `workbenchFlowService.submit` boundary not covered。 |
| Play top end visible path | Deferred Play end-to-recall UI path | S2R-FU-PLAY-END | deferred-with-approved-reason | Contract v0.2 has reason and exit condition。 |
| Legacy App mount gate | Full App `sabaki.state.mode` gate migration | S2R-FU-APP-GATE / S2R-M02 | deferred-with-approved-reason | Contract v0.2 has reason and exit condition。 |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | S2R tests import real `TrainingWorkbenchContainer`, `WorkbenchShell`, `createWorkbenchFlowService`, stores/services at `submit-to-recall-projection.test.js:23-34` and `workbenchFlowService.test.js:3-15`；无 skip。 |
| 被测 handler 改成 noop 时，测试会失败吗？ | 会失败 | S2R-T02 expects `flowService.calls.submit` with active tab id at `submit-to-recall-projection.test.js:276-286`；T05/T06 depend on handler causing real state changes。 |
| Container 不传关键 props 时，测试会失败吗？ | 会失败 | T05 asserts `mode/state/currentMove/totalMoves/progress` at `submit-to-recall-projection.test.js:299-305`; T06 asserts rendered Recall panel/progress at `313-317`。 |
| resolver 忽略 mode/context 时，测试会失败吗？ | 不适用 | 本契约没有 resolver subject；submit path is Container -> service。 |
| executor/service 写错 store 或漏写 store 时，测试会失败吗？ | 部分会失败 | T03 catches tab/runtime active id and recallView; T05/T06 catch projected UI. Missing T04 means subscriber loop break may escape。 |
| store 更新后 UI projection 不变时，测试会失败吗？ | 会失败 | T05/T06 assert projection/rendered active state。 |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | Target command: 81 passing, 4 failing. Failures are missing `runtime.recallView`, projected `state='empty'`, rendered empty Recall UI, and stale test blocked before mismatch because active projection was not created。 |

## 7. 结论与后续

当前测试没有 callback-only fake green、wrong-layer state-forward mock、reverse-contract assertion 或 manual asserted-state mutation。`S2R-T03/T05/T06/T08` 的 RED 是有效的 implementation target。

进入实现前需要 test-writer 回补：

1. 新增 `S2R-T04`，证明 real submit 后 store subscription / Container observer path 产生可观察 projection outcome。
2. 扩展 `S2R-T09`，覆盖 `workbenchFlowService.ts` 的 submit/mapper implementation scope，禁止 source-specific submit branching，同时避免 unrelated snapshot function false positive。

