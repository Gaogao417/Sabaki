verdict: APPROVED

# 测试审计

Date: 2026-05-27
Role: test-auditor
Subject: step2.1 runtime companion region tests retry2
Test file: `test/training/workbenchRuntimeRegion.test.ts`

## 1. 结论

APPROVED

retry2 关闭了 v0.2 audit 的阻塞问题。RTM-T10 现在先剥离允许的 out-of-scope 函数体，再禁止 cleanup scope 中出现 owner-controlled runtime setter token；这个策略足以覆盖 v0.2 要求的 non-optional bracket access、optional bracket access、renamed destructuring、aliased setter、bound setter 等常见绕过方式。

RTM-D04 deferred 边界仍然成立：`startCheckpoint` activation 的 `setActiveCheckpoint(id)` / `setCorrectionDraft(...)` 不会被本轮 blocker 误伤；`skipCheckpoint` / `resumeRecall` cleanup scope 中的 raw `setActiveCheckpoint(undefined)` / `clearCorrectionDraft(...)` 仍会被 RTM-T10 阻止。

`npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` 结果为 4 passing / 6 failing，失败来自缺 runtime owner/cleanup 和缺 runtimeRegion integration，不是 harness crash。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-contract-v0.2.md` | approved contract | 否 | 复核 RTM-T01..RTM-T10 与 RTM-D01..D05 deferred ledger。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-audit-v0.1.md` | previous audit | 否 | 初版 RTM-T10 boundary/source scan blocker 背景。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-audit-v0.2.md` | previous audit | 否 | retry blocker: bracket access 与 renamed/aliased/bound setter 变体。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow checklist context | 否 | 只读；按用户要求未修改。 |
| `test/training/workbenchRuntimeRegion.test.ts` | SIDE_EFFECT_BOUNDARY / STORE_SUBSCRIPTION / ARCHITECTURE_BOUNDARY | 是 | 主审计对象；真实 import flow/store/runtime/checkpoint/recall service 与 production types。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | production source | 是 | 用于核对 RTM-T10 flow cleanup scan 与当前 RED 失败来源。 |
| `src/modules/training/recall/recallCheckpointService.ts` | production source | 是 | 用于核对 RTM-T10 checkpoint cleanup scan 与 RTM-D04 activation deferred。 |
| `src/modules/training/store/trainingRuntimeStore.ts` | production source/type | 是 | 用于核对 runtimeStore in-scope setter surface。 |
| `src/modules/training/repository/trainingRepository.ts` | production type | 是 | 用于核对 in-memory repository fake 是否 type-bound。 |
| `src/modules/training/problem/problemFlowService.ts` | production type | 是 | 用于核对 ProblemFlowService fake 是否 interface-bound。 |

## 3. 阻塞问题

无。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么不会阻塞 | implementation 要求 |
| --- | --- | --- | --- |
| `test/training/workbenchRuntimeRegion.test.ts:431-463` | RTM-T10 是文本级 source scan，不是 AST 语义分析。 | retry2 的 `source.includes(setter)` 在剥离允许函数体后禁止 cleanup scope 出现 setter token，可覆盖本轮要求的 dot、bracket、renamed destructuring、alias、bound alias 常见形态。恶意动态拼接如 `runtimeStore['set' + 'ActiveCheckpoint']` 仍属于代码审查/architecture review 可拦截的规避写法。 | implementation 不得用动态 computed property 或拆字符串方式绕开 runtime-region owner。 |
| `test/training/workbenchRuntimeRegion.test.ts:465-484` | checkpoint cleanup helper 同时有宽 token scan 与特定 cleanup call regex。 | 这正好满足 retry2 目标：`setActiveCheckpoint(undefined)` / `clearCorrectionDraft(...)` 在 cleanup scope 中不能存在；activation scope 被剥离。 | `skipCheckpoint` 和 `resumeRecall` cleanup 必须走 runtime-region owner/port。 |
| `test/training/workbenchRuntimeRegion.test.ts:772-779` | `startCheckpoint` / `submitUserCorrectionLine` 等函数体被剥离，可能看起来放松了 checkpoint service scan。 | 这是 RTM-D04 的正式 deferred 边界；本轮只覆盖 resume/skip/comment cleanup，不覆盖 checkpoint activation 或 correction draft submit lifecycle。 | 不要在 step2.1 实现里顺手重构 activation；后续 step2.1b 另立 contract。 |
| `test/training/workbenchRuntimeRegion.test.ts:144-176` | 命中必查模式 `calls = {`，本地 in-memory repository fake 记录调用。 | fake 显式声明为 `TrainingRepository & {...}`，并以 `const repository: RuntimeRegionRepository` 实现 production repository surface，不是 unbound spy。 | 保持 fake 与 production interface 绑定；若 repository surface 扩大，应让类型绑定暴露缺口。 |
| `test/training/workbenchRuntimeRegion.test.ts:517-528` | 本地 `ProblemFlowService` fake 只返回 problem submit result。 | fake 显式标注 `ProblemFlowService`，只模拟 narrow command port；被测主体仍是 real `workbenchFlowService`，不是 mocked flow。 | 若后续扩大 Problem submit 行为，应迁移到更真实 service path 或 shared typed factory。 |

必查 grep 结果：未发现 `assert.ok(true)`、`assert(true)`、`.skip(`、`this.skip`、`TODO`、`GAP`、`current behavior`、`current implementation`、`calledOnce`、callback-only、`as any`、`: any`、`Promise<unknown>`。唯一命中是 `calls = {`，已按上表判定为 production type-bound fake extension。

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| RTM-T01 | Play submit uses real flow/store/runtime and activates recall runtime while clearing stale problem/checkpoint/draft after success. | `test/training/workbenchRuntimeRegion.test.ts:488-509` | covered | Uses real `service.submit`; current RED at `:507` on stale checkpoint cleanup. |
| RTM-T02 | Problem submit clears problem runtime and checkpoint transients only after successful recall creation. | `test/training/workbenchRuntimeRegion.test.ts:511-549` | covered | `ProblemFlowService` fake is production interface-bound; current RED at `:547` on stale checkpoint cleanup. |
| RTM-T03 | Explicit `enterRecall({tabId, attemptId})` activates recall runtime and removes stale problem/checkpoint state. | `test/training/workbenchRuntimeRegion.test.ts:551-570` | covered | Uses real `enterRecall`; current RED at `:567` because stale `problemView` remains. |
| RTM-T04 | `completeRecall` final path clears completed recall runtime while transitioning to Analysis. | `test/training/workbenchRuntimeRegion.test.ts:572-597` | covered | Uses real flow and type-bound recall service port; current RED at `:594` because active recall session remains. |
| RTM-T05 | Checkpoint resume/skip/comment cleanup clears checkpoint runtime, keeps recall active, and does not write protected Attempt fields. | `test/training/workbenchRuntimeRegion.test.ts:599-636` | covered | Uses real flow, real checkpoint service, real stores, typed repository fake. Covers skip path outcome; RTM-T10 keeps resume/comment cleanup boundary covered at source level. |
| RTM-T06 | Temporary Analysis from Problem and Recall-normal preserves source runtime fields. | `test/training/workbenchRuntimeRegion.test.ts:638-665` | covered | GREEN; asserts concrete `problemView`, `recallView`, and `activeRecallSessionId`; checkpoint-source Analysis remains RTM-D04 deferred. |
| RTM-T07 | Invalid transition rejects without tab/runtime mutation. | `test/training/workbenchRuntimeRegion.test.ts:668-683` | covered | GREEN; asserts deep tab and runtime snapshots, not logger output. |
| RTM-T08 | Submit failure before transition commit preserves source tab/runtime snapshots. | `test/training/workbenchRuntimeRegion.test.ts:686-712` | covered | GREEN; failure injected through type-bound recall service port, not mocked flow. |
| RTM-T09 | Real runtimeStore subscriber observes owner-driven cleaned recall runtime snapshot. | `test/training/workbenchRuntimeRegion.test.ts:715-739` | covered | Current RED at `:733` because owner-cleaned subscriber snapshot is absent. |
| RTM-T10 | Runtime-region owner owns cleanup boundary and imports no forbidden dependencies; flow/checkpoint services stop scattered raw cleanup. | `test/training/workbenchRuntimeRegion.test.ts:742-807` | covered | retry2 requires concrete `runtimeRegion.onRecallActivated/onRecallCompleted/onCheckpointResumed`, owner module/factory export, owner forbidden-import scan, and cleanup-scope setter-token ban after allowed bodies are stripped. |
| RTM-D01 | Rendered WorkbenchShell/Panel projection after runtime cleanup. | Contract deferred ledger | deferred-with-approved-reason | Rendered UI/projection remains downstream; this file imports no Container/Shell/Panel. |
| RTM-D02 | Analysis scratch workspace / engine target cleanup. | Contract deferred ledger | deferred-with-approved-reason | No scratch/engine assertions mixed into step2.1. |
| RTM-D03 | `modeStateResolver` diagnostics. | Contract deferred ledger | deferred-with-approved-reason | No resolver diagnostics assertions mixed into step2.1. |
| RTM-D04 | Checkpoint activation, correction draft activation/submit lifecycle, checkpoint-source temporary Analysis. | Contract deferred ledger | deferred-with-approved-reason | `startCheckpoint` / `submitUserCorrectionLine` bodies are stripped before cleanup-scope scan; no activation assertion is claimed. |
| RTM-D05 | `visibleBadMoveIds` / hint cache cleanup. | Contract deferred ledger | deferred-with-approved-reason | No visible bad move or hint cache assertions mixed into step2.1. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | RTM-T10 requires `src/modules/training/workbench/workbenchRuntimeRegion.ts` to exist and export `createWorkbenchRuntimeRegion` at `test/training/workbenchRuntimeRegion.test.ts:785-799`. |
| 被测 handler/flow 改成 noop 时，测试会失败吗？ | 会失败 | RTM-T01..T05/T09 assert real tab/runtime final state after real flow commands; noop flow cannot satisfy those assertions. |
| Container 不传关键 props 时，测试会失败吗？ | 本轮不测，合理 | Contract defers UI command mapping/rendered return; this test file imports no Container/UI and does not claim UI coverage. |
| resolver 忽略 mode/context 时，测试会失败吗？ | 本轮不测，合理 | RTM-D03 is formally deferred; no `modeStateResolver` import or assertion appears. |
| executor/flow 写错 store 或漏写 store 时，测试会失败吗？ | 会失败 | RTM-T01..T05/T09 assert real store outcome/subscription; RTM-T10 also rejects cleanup-scope raw runtime setter ownership in flow/checkpoint services. |
| store 更新后 UI projection 不变时，测试会失败吗？ | 本轮不测，合理 | RTM-D01 rendered/projection return is deferred; RTM-T09 only proves real runtime store subscription. |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | Mocha produced 4 passing / 6 failing. Failures are stale checkpoint cleanup, stale problemView cleanup, active recall session cleanup, missing owner-cleaned subscriber snapshot, and missing runtimeRegion integration. |

验证命令：

| 命令 | 结果 |
| --- | --- |
| `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` | 4 passing / 6 failing, expected RED shape. |

失败摘要：

| Test | 当前失败原因 |
| --- | --- |
| RTM-T01 | `runtime.activeCheckpointId` remains `cp_stale` instead of `undefined`. |
| RTM-T02 | `runtime.activeCheckpointId` remains `cp_stale` instead of `undefined`. |
| RTM-T03 | stale `problemView` remains instead of `null`. |
| RTM-T04 | `activeRecallSessionId` remains `rs_1` instead of `undefined`. |
| RTM-T09 | subscriber never observes owner-cleaned final snapshot. |
| RTM-T10 | `workbenchFlowService.ts` does not yet contain `runtimeRegion.onRecallActivated(...)`; runtime owner/integration is absent. |

## 7. Human Gate

Implementation entry notes:

- 可以进入 implementation-agent 的人工确认；测试已经能阻止常见假绿实现，包括 flow/checkpoint service 继续用 dot/bracket/destructured/aliased/bound runtime setter 直接 cleanup。
- implementation 应新增 production runtime-region owner module，例如 `src/modules/training/workbench/workbenchRuntimeRegion.ts`，并导出 `createWorkbenchRuntimeRegion`。
- `workbenchFlowService` 应通过 typed runtime-region port 调用 `onRecallActivated`、`onRecallCompleted`、`onCheckpointResumed`，而不是直接拥有 in-scope cleanup setter。
- `recallCheckpointService.skipCheckpoint` / `resumeRecall` 的 resume/skip cleanup raw writes 必须迁出或通过 owner port；`startCheckpoint` activation 和 correction draft activation/submit lifecycle 不在本轮实现范围，除非先开 step2.1b contract。
- runtime owner 不得 import `workbenchStore`、`workbenchFlowService`、UI components、repository、snapshot/tab service、overlay/scratch/engine 或 `window.sabaki`；只写 in-scope runtime transient fields。
- 实现后目标应从当前 4 passing / 6 failing 变为本文件全绿；如触碰 UI projection、scratch/engine、resolver diagnostics、checkpoint activation 或 visible bad move cache，应拆下游契约，不要扩大 step2.1。

测试质量可以进入人工确认。
