verdict: REQUEST_CHANGES

# 测试审计

Date: 2026-05-27
Role: test-auditor
Subject: step2.1 runtime companion region tests retry
Test file: `test/training/workbenchRuntimeRegion.test.ts`

## 1. 结论

REQUEST_CHANGES

retry 版测试已关闭 v0.1 的主要方向性问题：RTM-T10 不再只是 `runtimeRegion` token scan，已要求 production owner module、`createWorkbenchRuntimeRegion` factory export，以及 `runtimeRegion.onRecallActivated/onRecallCompleted/onCheckpointResumed` 三个具体 port call；RTM-T01..RTM-T09 仍通过 real `createWorkbenchFlowService`、real `createWorkbenchStore`、real `createTrainingRuntimeStore` 做状态前进断言；checkpoint activation 没被混入本轮 cleanup 主验收。

但 RTM-T10 的 raw setter scan 仍未完整捕获 v0.1 blocker 要求的 bracket access 与 aliased setter 变体。实现者仍可用 `runtimeStore['setActiveCheckpoint'](undefined)`、`deps.runtimeStore['setRecallView'](null)`、或 renamed/bound alias 绕过 runtime-region owner，并让 RTM-T01..RTM-T09 因 final state 正确而通过。这会误导 implementation-agent 认为 cleanup ownership 已收敛。

请修复测试审计阻塞问题后再进入实现。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-contract-v0.2.md` | approved contract | 否 | 复核 RTM-T01..RTM-T10 与 RTM-D01..D05 deferred 边界。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-audit-v0.1.md` | previous test audit | 否 | 复核 v0.1 blockers 是否关闭。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow checklist context | 否 | 只读；按用户要求未修改。 |
| `test/training/workbenchRuntimeRegion.test.ts` | SIDE_EFFECT_BOUNDARY / STORE_SUBSCRIPTION / ARCHITECTURE_BOUNDARY | 是 | 主审计对象；import real flow/store/runtime/checkpoint/recall services 和 production types。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | production source | 是 | 用于核对当前 RED shape 与 RTM-T10 boundary scan。 |
| `src/modules/training/recall/recallCheckpointService.ts` | production source | 是 | 用于核对 checkpoint cleanup 与 RTM-D04 activation deferred 边界。 |
| `src/modules/training/store/trainingRuntimeStore.ts` | production source/type | 是 | 用于核对 runtimeStore interface 与 setter variants。 |
| `src/modules/training/repository/trainingRepository.ts` | production type | 是 | 用于核对 in-memory repository fake type binding。 |
| `src/modules/training/problem/problemFlowService.ts` | production type | 是 | 用于核对 `ProblemFlowService` fake binding。 |

## 3. 阻塞问题

| 严重度 | 文件/行号 | 问题 | 必须修改 |
| --- | --- | --- | --- |
| blocking | `test/training/workbenchRuntimeRegion.test.ts:442` | `assertNoDirectRuntimeSetterCalls` 的 bracket regex 要求 `runtimeStore?.[` / `runtimeStore.[` 形态，不能匹配合法的 non-optional bracket access：`runtimeStore['setProblemView'](...)`、`deps.runtimeStore['setActiveCheckpoint'](...)`。这没有关闭 v0.1 要求的 bracket access 变体。 | 扫描必须同时捕获 optional bracket `runtimeStore?.['setX'](...)` 和 non-optional bracket `runtimeStore['setX'](...)` / `deps.runtimeStore['setX'](...)`。 |
| blocking | `test/training/workbenchRuntimeRegion.test.ts:466` | checkpoint cleanup 的 bracket regex 同样漏掉 `runtimeStore['setActiveCheckpoint'](undefined)` 和 `deps.runtimeStore['setActiveCheckpoint'](undefined)`。resume/skip cleanup 可继续 raw write active checkpoint 而不触发 RTM-T10。 | 加固 `assertNoCheckpointCleanupSetterCalls`，覆盖 non-optional bracket cleanup。 |
| blocking | `test/training/workbenchRuntimeRegion.test.ts:447` 和 `test/training/workbenchRuntimeRegion.test.ts:452` | destructured/aliased setter scan 只覆盖同名 destructuring 或同名 assignment，例如 `const {setActiveCheckpoint} = runtimeStore` / `setActiveCheckpoint = runtimeStore.setActiveCheckpoint`。它漏掉 renamed destructuring 和 bound/general alias，例如 `const {setActiveCheckpoint: clearCheckpoint} = runtimeStore`、`const clearCheckpoint = runtimeStore.setActiveCheckpoint.bind(runtimeStore)`、`const clearCheckpoint = runtimeStore['setActiveCheckpoint']`。 | RTM-T10 必须捕获 renamed destructured setter 与 aliased setter usage，至少覆盖 cleanup setters 在 flow/checkpoint service 中被别名后调用的常见形态。 |

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/training/workbenchRuntimeRegion.test.ts:431-477` | RTM-T10 boundary scan 可被等价语法绕过。 | RTM-T10 是唯一防止 scattered runtime cleanup 留在 flow/checkpoint service 的 architecture-boundary test；若 bracket/alias 变体漏检，错误实现可以绕过 owner 但状态测试仍绿。 | 修复第 3 节 blocker；修复后保持 RTM-D04 activation 不被误伤。 |
| `test/training/workbenchRuntimeRegion.test.ts:764-775` | checkpoint service scan 有意移除 `startCheckpoint` / `submitUserCorrectionLine`，这对 RTM-D04 是正确的，但必须继续扫描 resume/skip cleanup。 | 当前 helper 会保留 `skipCheckpoint` / `resumeRecall` body，因此 current raw cleanup 会被阻止；但 bracket/alias 漏洞会削弱这个保证。 | 加固 bracket/alias 后保留现有 deferred exclusion，不要把 `startCheckpoint` 的 `setActiveCheckpoint(id)` / `setCorrectionDraft(...)` 当 blocker。 |
| `test/training/workbenchRuntimeRegion.test.ts:144-176` | 本地 in-memory repository fake 扩展 `calls/data`。 | 命中必查模式 `calls = {`，但该 fake 声明为 `TrainingRepository & {...}`，并实现 production repository surface；不是 unbound spy。 | 可接受；保持 production type binding。 |
| `test/training/workbenchRuntimeRegion.test.ts:509-520` | 本地 `ProblemFlowService` fake。 | fake 被显式声明为 `ProblemFlowService`，只模拟 Problem submit command port，不替换 `workbenchFlowService`。 | 可接受；后续扩大 Problem service behavior 时应迁移到 shared typed factory 或更真实 service path。 |

必查 grep 结果：未发现 `assert.ok(true)`、`assert(true)`、`.skip(`、`this.skip`、`TODO`、`GAP`、`current behavior`、`current implementation`、`calledOnce`、callback-only、`as any`、`: any`、`Promise<unknown>`。唯一命中是 `calls = {`，已按上表判定为 typed in-memory fake extension。

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| RTM-T01 | Play submit uses real flow/store/runtime and activates recall runtime while clearing stale problem/checkpoint/draft after success. | `test/training/workbenchRuntimeRegion.test.ts:480` | covered | Uses real `service.submit`; current RED at `:499` on stale checkpoint. |
| RTM-T02 | Problem submit clears problem runtime and checkpoint transients only after successful recall creation. | `test/training/workbenchRuntimeRegion.test.ts:503` | covered | `ProblemFlowService` fake is production type-bound; current RED at `:539` on stale checkpoint. |
| RTM-T03 | Explicit `enterRecall({tabId, attemptId})` activates recall runtime and removes stale problem/checkpoint state. | `test/training/workbenchRuntimeRegion.test.ts:543` | covered | Uses real `enterRecall`; current RED at `:559` because stale `problemView` remains. |
| RTM-T04 | `completeRecall` final path clears completed recall runtime while transitioning to Analysis. | `test/training/workbenchRuntimeRegion.test.ts:564` | covered | Uses real flow and typed recallService port; current RED at `:586` because `activeRecallSessionId` remains. |
| RTM-T05 | Checkpoint resume/skip/comment cleanup clears checkpoint runtime, keeps recall active, and does not write protected Attempt fields. | `test/training/workbenchRuntimeRegion.test.ts:591` | covered | GREEN for skip path with real checkpoint service/repository/runtime store; does not cover activation. |
| RTM-T06 | Temporary Analysis from Problem and Recall-normal preserves source runtime fields. | `test/training/workbenchRuntimeRegion.test.ts:630` | covered | GREEN; covers `problemView`, `recallView`, and `activeRecallSessionId`; checkpoint source remains deferred. |
| RTM-T07 | Invalid transition rejects without tab/runtime mutation. | `test/training/workbenchRuntimeRegion.test.ts:660` | covered | GREEN; asserts tab and runtime snapshots, not logs/call count. |
| RTM-T08 | Submit failure before transition commit preserves source tab/runtime snapshots. | `test/training/workbenchRuntimeRegion.test.ts:678` | covered | GREEN; failure injected through typed recallService port, not mocked flow. |
| RTM-T09 | Real runtimeStore subscriber observes owner-driven cleaned recall runtime snapshot. | `test/training/workbenchRuntimeRegion.test.ts:707` | covered | Current RED at `:725` because owner-cleaned subscriber snapshot is absent. |
| RTM-T10 | Runtime-region owner owns cleanup boundary and imports no forbidden dependencies; flow/checkpoint services stop scattered raw cleanup. | `test/training/workbenchRuntimeRegion.test.ts:734` | not-covered | Improved factory/export/port assertions exist, but raw setter scan still misses bracket/alias variants. |
| RTM-D01 | Rendered WorkbenchShell/Panel projection after runtime cleanup. | Contract deferred ledger | deferred-with-approved-reason | No rendered UI/projection assertions in this test file. |
| RTM-D02 | Analysis scratch workspace / engine target cleanup. | Contract deferred ledger | deferred-with-approved-reason | No scratch/engine assertions mixed into step2.1. |
| RTM-D03 | `modeStateResolver` diagnostics. | Contract deferred ledger | deferred-with-approved-reason | No resolver diagnostics assertions mixed into step2.1. |
| RTM-D04 | Checkpoint activation, correction draft activation/submit lifecycle, checkpoint-source temporary Analysis. | Contract deferred ledger | deferred-with-approved-reason | `startCheckpoint` activation and `setCorrectionDraft(...)` are excluded from RTM-T10 cleanup scan; this is correct. |
| RTM-D05 | `visibleBadMoveIds` / hint cache cleanup. | Contract deferred ledger | deferred-with-approved-reason | No visible bad move or hint cache assertions mixed into step2.1. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | RTM-T10 requires `src/modules/training/workbench/workbenchRuntimeRegion.ts` exists and exports `createWorkbenchRuntimeRegion` at `test/training/workbenchRuntimeRegion.test.ts:777-790`. |
| 被测 handler/flow 改成 noop 时，测试会失败吗？ | 会失败 | RTM-T01..T05/T09 assert real tab/runtime final state after real flow commands; noop flow cannot satisfy the state assertions. |
| Container 不传关键 props 时，测试会失败吗？ | 本轮不测，合理 | Contract defers UI command mapping/rendered return; test file imports no Container/UI and does not claim UI coverage. |
| resolver 忽略 mode/context 时，测试会失败吗？ | 本轮不测，合理 | RTM-D03 is formally deferred; no `modeStateResolver` import or assertions. |
| executor/flow 写错 store 或漏写 store 时，测试会失败吗？ | 状态 outcome 会失败；owner boundary 仍需修复 | T01..T05/T09 catch wrong final state. RTM-T10 currently can miss direct raw store writes using bracket/alias syntax, hence REQUEST_CHANGES. |
| store 更新后 UI projection 不变时，测试会失败吗？ | 本轮不测，合理 | RTM-D01 rendered/projection return is deferred; T09 only proves real store subscriber observes runtime snapshot. |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` produced 4 passing / 6 failing. Failures are stale checkpoint cleanup (T01/T02), stale problemView (T03), active recall session cleanup (T04), missing owner-cleaned subscriber snapshot (T09), and missing runtime owner integration (T10). |

验证命令：

| 命令 | 结果 |
| --- | --- |
| `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` | expected RED shape: 4 passing, 6 failing |

## 7. Human Gate

- 不建议进入 implementation-agent，直到 RTM-T10 bracket/alias raw setter scan 加固并重新复审。
- 可以继续接受 RTM-D01..D05 deferred；当前 retry 没有把 rendered UI、scratch/engine、resolver diagnostics、checkpoint activation 或 visible bad move cache 混入 step2.1。
- 修复范围应只改 `test/training/workbenchRuntimeRegion.test.ts` 的 RTM-T10 helper/assertions 或等价 shared test helper；不要改 production、contract 或 checklist 来绕过本审计。
- 修复后目标仍应保持 `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` 为 4 passing / 6 failing，且失败来自缺 runtime owner/cleanup，不是 harness crash。

请修复测试审计阻塞问题后再进入实现。
