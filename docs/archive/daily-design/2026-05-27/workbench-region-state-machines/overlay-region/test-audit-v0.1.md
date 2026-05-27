# 测试审计

Date: 2026-05-27
Role: test-auditor
Subject: step1 overlay child-region transition tests
Test commit: 427a2898 `test-writer: add overlay region transition tests`

## 1. 结论

REQUEST_CHANGES

当前测试没有 fake green：未 mock `workbenchFlowService`，未替换 `workbenchStore.updateTab`，没有 callback-only/logger-only 主断言，flow 测试使用真实 `createWorkbenchFlowService`、真实 `createWorkbenchStore`、真实 `overlayStore`，并要求生产 `createWorkbenchOverlayRegion` 存在后才能接入。

但覆盖仍不足以进入 implementation-agent。`OVR-T09` 只测了 `play -> analysis`，没有覆盖契约要求的 `problem/recall -> analysis` overlay region 通知；`OVR-T04` 只测了 `analysis -> recall`，没有覆盖契约要求的 `analysisReturnTarget.mode='play'|'problem'|'recall'` 全部 row；`OVR-T03` 对“public API cannot set mode”的断言仍偏弱。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.2.md` | approved contract | 否 | 审计 OVR-T01/T02/T03/T04/T05/T06/T09 和 OVR-T07/T08 deferred 条件。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.2.md` | approved contract audit | 否 | 确认 test-writer 允许范围和 deferred 边界。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow checklist | 否 | 只读；本 agent 按用户要求不修改 checklist。 |
| `test/overlays/overlayStore.test.js` | STORE_SUBSCRIPTION / SIDE_EFFECT_BOUNDARY | 是，`createOverlayStore` | T01/T02 使用真实 overlayStore、真实 subscriber、controlled promise。 |
| `test/overlays/workbenchOverlayRegionBoundary.test.js` | ARCHITECTURE_BOUNDARY | 读生产源文件 | T03 会因缺少 production region 变红，但 public API surface 断言需加强。 |
| `test/training/workbenchFlowService.test.js` | SIDE_EFFECT_BOUNDARY | 是，`createWorkbenchFlowService`、`createWorkbenchStore`、`createOverlayStore` | T04/T05/T06/T09 使用真实 flow/store；recording layer 包住 production overlay region。 |

## 3. 阻塞问题

1. `OVR-T09` 未覆盖 `problem` 和 `recall` 进入 Analysis 的 overlay transition row。
   证据：契约要求 `enterAnalysis` from `play/problem/recall` 都保存 return target、设置 Analysis、通知 overlay owner 且不自动开启 overlay，见 `test-contract-v0.2.md:49`、`:239`。测试只在 `test/training/workbenchFlowService.test.js:1175` 到 `:1198` 覆盖 `play -> analysis`。
   要求：将 T09 参数化为 `play`、`problem`、`recall` 三个 source mode，逐 row 断言 tab mode、return target、`recording.calls[0].fromMode/toMode/reason`、overlay flags false。

2. `OVR-T04` 未覆盖 `returnFromAnalysis` 的全部 target mode。
   证据：契约要求 `analysisReturnTarget.mode='play'|'problem'|'recall'` 都恢复 tab state、清 return target、清 overlay，见 `test-contract-v0.2.md:234`。测试只在 `test/training/workbenchFlowService.test.js:1201` 到 `:1238` 覆盖 `analysis -> recall`。
   要求：将 T04 参数化为 `play`、`problem`、`recall` 三个 target mode；每个 row 都应先打开 territory 或 compare，再通过真实 `returnFromAnalysis` 断言最终 tab 和 overlay false。

3. `OVR-T03` 对 public API 不能 set mode 的断言不足。
   证据：契约要求 overlay region/store 不引入 parent writer，且 public API cannot set mode，见 `test-contract-v0.2.md:233`、`:301`。当前测试只检查存在 `WorkbenchOverlayRegion`、`onWorkbenchModeTransition`、`createWorkbenchOverlayRegion` 和若干 import/call regex，见 `test/overlays/workbenchOverlayRegionBoundary.test.js:23` 到 `:36`、`:46` 到 `:60`；它不能阻止 production module 额外导出 `setMode` / `setWorkbenchMode` / `updateTab` 这类向上写 mode 的 API。
   要求：在 T03 中对实际导出的 region object/API surface 做负断言，至少禁止 `setMode`、`setWorkbenchMode`、`updateTab`、`updateWorkbenchMode` 这类 mode writer 方法；源码扫描也应覆盖 `deps.workbenchStore.updateTab` 这类间接 upward writer。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/training/workbenchFlowService.test.js:1175` | T09 row coverage 不足 | 实现只在 `play -> analysis` 通知 overlay，漏掉 `problem/recall -> analysis`，测试仍可能绿。 | 参数化 source modes：`play`、`problem`、`recall`。 |
| `test/training/workbenchFlowService.test.js:1201` | T04 row coverage 不足 | 实现只在返回 Recall 时清 overlay，返回 Play/Problem 时漏清，测试仍可能绿。 | 参数化 target modes：`play`、`problem`、`recall`。 |
| `test/overlays/workbenchOverlayRegionBoundary.test.js:23` | API boundary 扫描偏窄 | production region 可额外暴露 mode writer API，但当前断言只要求有 transition port。 | 断言 exported region/API surface 不包含 mode writer；补强 upward writer regex。 |
| `test/training/workbenchFlowService.test.js:142` | local `createMockDeps` 未由 TS 接口强约束 | 本轮 overlay flow command 未使用 repository/attempt/snapshot/tab fakes，因此不是当前 fake-green；但如果后续 T05 扩展到真实 attempt/repository path，手写 fake 会漂移。 | 若实现让 restart path 调用这些依赖，测试必须改用 typed shared factory 或 in-memory repository fake。 |
| `test/training/workbenchFlowService.test.js:2034` | 旧 `describe.skip` fallback | 该 skip 属于 out-of-scope `inferDefaultMode` helper，不影响 overlay step；不是本轮核心契约 skip。 | 无需本轮修改；不得为 OVR-T01/T09 等核心 row 添加 skip。 |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| OVR-T01 | Real `overlayStore.onModeChange(nonAnalysis)` clears active territory/compare and fires subscriber/notify outcome. | `test/overlays/overlayStore.test.js:125` | covered | Covers play/problem/recall and both territory + compare. |
| OVR-T02 | Late `ensureAnalysisReady` after leaving Analysis cannot revive overlay or schedule analysis side effects. | `test/overlays/overlayStore.test.js:187` | covered | Covers territory and compare; asserts flags false and no `analyzeMove` / `scheduleEditWorkspaceAnalysis`. |
| OVR-T03 | Overlay region/store import/API boundary; public API cannot set Workbench mode. | `test/overlays/workbenchOverlayRegionBoundary.test.js:15` | not-covered | Partial existence/import scan exists, but public API mode-writer prohibition is not enforced. |
| OVR-T04 | Real `returnFromAnalysis` restores target mode and clears overlay for target play/problem/recall. | `test/training/workbenchFlowService.test.js:1201` | not-covered | Partial recall row only; play/problem rows missing. |
| OVR-T05 | Representative non-return Analysis exit clears overlay through same child-region path. | `test/training/workbenchFlowService.test.js:1241` | covered | Uses real flow/store/overlay; `restartAttempt` to problem is an accepted representative row. |
| OVR-T06 | Rejected transition does not notify overlay region and does not clear overlay. | `test/training/workbenchFlowService.test.js:1275` | covered | Covers analysis-without-target rejection with overlay still true and zero region calls. |
| OVR-T07 | Overlay state projection to Workbench props. | Contract `test-contract-v0.2.md:237`, `:251` | deferred-with-approved-reason | Step1 does not change projection/container props; exit condition is overlay state shape, toolbar props, subscription path, or rendered selected state changes. |
| OVR-T08 | ModeBar/Shell/Container command mapping with one-arg `onModeChange(key)`. | Contract `test-contract-v0.2.md:238`, `:252` | deferred-with-approved-reason | Step1 does not edit UI/container plumbing; activate only if handler path changes. |
| OVR-T09 | Real `enterAnalysis` from play/problem/recall notifies overlay owner and leaves overlay false. | `test/training/workbenchFlowService.test.js:1175` | not-covered | Partial play row only; problem/recall rows missing. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | 当前 `workbenchOverlayRegion.ts` 不存在，目标命令得到 1 passing / 6 failing；失败点是 missing module / missing file。 |
| 被测 handler/region 改成 noop 时，测试会失败吗？ | T04/T05 会失败；T09 enter-row 对 region noop 不敏感 | T04/T05 先打开 overlay，再要求 final overlay false；region noop 会留下 true。T09 只要求 notification 和 overlay 默认 false。 |
| Container 不传关键 props 时，测试会失败吗？ | 本轮不测 | OVR-T08 deferred 是合理的，因为 step1 未触碰 UI/container。 |
| resolver 忽略 mode/context 时，测试会失败吗？ | 本轮不测 | Resolver diagnostics 属于后续 step；不是 overlay transition step1。 |
| executor/flow 写错 store 或漏写 store 时，测试会失败吗？ | 会失败，但 T04/T09 row 不完整 | Flow 测试断言真实 tab state 和 overlay state；但目前只覆盖 T09 play row、T04 recall row。 |
| store 更新后 UI projection 不变时，测试会失败吗？ | 本轮不测 | OVR-T07 deferred 是合理的，除非 implementation 改 projection/state shape。 |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | `npx mocha --require tsx test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js --grep "Workbench overlay region boundary|step1 overlay child-region transition boundary"` 失败 6 项，指向缺少 production overlay region/flow dependency。 |

## 7. Human Gate

- 不建议接受当前测试进入 implementation-agent；先补齐 T04/T09 row 覆盖并加强 T03 API boundary。
- OVR-T07/OVR-T08 deferred 可以继续接受，前提是 implementation-agent 不改 projection、toolbar props、subscription path、ModeBar/Shell/Container handler plumbing。
- 若 human 决定缩小契约为 representative rows，必须先更新 contract v0.2 或新增 approved override；否则当前 tests 与 approved contract 不一致。
- 修复后应重跑：`npx mocha --require tsx test/overlays/overlayStore.test.js`，以及 `npx mocha --require tsx test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js --grep "Workbench overlay region boundary|step1 overlay child-region transition boundary"`。

请修复测试审计阻塞问题后再进入实现。
