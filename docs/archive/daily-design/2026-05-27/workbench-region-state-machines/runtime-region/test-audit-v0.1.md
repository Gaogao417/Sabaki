verdict: REQUEST_CHANGES

# 测试审计

Date: 2026-05-27
Role: test-auditor
Subject: step2.1 runtime companion region tests
Test file: `test/training/workbenchRuntimeRegion.test.ts`

## 1. 结论

REQUEST_CHANGES

RTM-T01..RTM-T09 的状态前进测试方向正确：它们使用 real `createWorkbenchFlowService`、real `createWorkbenchStore`、real `createTrainingRuntimeStore`，并用 production type/interface 约束 repository/service fake。当前命令 `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` 结果为 4 passing / 6 failing，失败点落在 stale runtime cleanup、owner-driven subscription、runtime owner module missing，不是 skip、placeholder pass 或 harness 崩坏。

但 RTM-T10 的架构边界测试存在假绿风险，不能进入 implementation-agent。它只禁止当前代码里的 `runtimeStore?.setX` optional-call 形态和 checkpoint service 的两个精确字符串；实现者仍可用 `runtimeStore.setX(...)`、`deps.runtimeStore?.setX(...)`、destructured setter、`setActiveCheckpoint(void 0)` 等方式继续让 flow/checkpoint service 直接拥有 cleanup，同时让 RTM-T01..T09 final-state tests 变绿。RTM-T10 需要加固为能阻止这些错误实现，同时仍不能误伤 RTM-D04 deferred 的 checkpoint activation。

请修复测试审计阻塞问题后再进入实现。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-contract-v0.2.md` | approved contract | 否 | 审计 RTM-T01..RTM-T10 与 RTM-D01..D05 deferred 边界。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/contract-audit-v0.2.md` | contract audit approval | 否 | 确认 checkpoint activation、scratch、diagnostics、UI return 已正式 deferred。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow checklist | 否 | 只读；按用户要求本 agent 不修改 checklist。 |
| `test/training/workbenchRuntimeRegion.test.ts` | SIDE_EFFECT_BOUNDARY / STORE_SUBSCRIPTION / ARCHITECTURE_BOUNDARY | 是 | 主审计对象；import real flow/store/runtime/checkpoint/recall services。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | production source | 是 | 用于核对当前 RED 点和 RTM-T10 scan。 |
| `src/modules/training/recall/recallCheckpointService.ts` | production source | 是 | 用于核对 checkpoint cleanup 与 activation deferred 边界。 |
| `src/modules/training/repository/trainingRepository.ts` | production type | 是 | 用于核对 in-memory repository fake type binding。 |
| `src/modules/training/problem/problemFlowService.ts` | production type | 是 | 用于核对 ProblemFlowService fake binding。 |

## 3. 阻塞问题

| 严重度 | 文件/行号 | 问题 | 必须修改 |
| --- | --- | --- | --- |
| blocking | `test/training/workbenchRuntimeRegion.test.ts:677-685` | RTM-T10 source scan 太窄，不能证明 runtime-region owner 是唯一 cleanup owner。`flowSource` 只禁止 `runtimeStore?.(setProblemView|setActiveRecallSession|setRecallView|setActiveCheckpoint|setCorrectionDraft|clearCorrectionDraft)`，漏掉 `runtimeStore.setX(...)`、`deps.runtimeStore?.setX(...)`、destructured setter、bracket access、helper wrapper 等直接 store 写法。`checkpointSource` 只禁止 `runtimeStore.setActiveCheckpoint(undefined)` 和 `runtimeStore.clearCorrectionDraft(checkpointId)` 两个精确字符串。 | 加固 RTM-T10，使它能捕获 flow/checkpoint service 对 in-scope cleanup setters 的直接调用变体；至少覆盖 optional/non-optional `runtimeStore`、`deps.runtimeStore`、destructured setter、`undefined`/`void 0` cleanup 形态。对 checkpoint service 只禁止 resume/skip/comment cleanup raw writes，不禁止 RTM-D04 deferred 的 `startCheckpoint` activation `setActiveCheckpoint(id)` / `setCorrectionDraft(...)`。 |
| blocking | `test/training/workbenchRuntimeRegion.test.ts:663-678` | RTM-T10 只检查 owner module exists、source contains `WorkbenchRuntimeRegion`、flow source contains `runtimeRegion`。这可以被注释、未调用变量或空 module 满足，不能证明 production exported owner/adapter boundary 被真实组合。 | 增加 production owner export/port 断言，例如 require/import `workbenchRuntimeRegion.ts` 并断言稳定 factory/type export，或在 flow source 中断言实际调用 runtime-region port method。命名可由 test-writer 固定，但必须比 `/runtimeRegion/` token 更具体。 |

这些问题不是当前 RED/GREEN 数量问题，而是实现后可能出现的假绿问题：生产代码可以绕开 runtime-region owner 继续由 flow/checkpoint service 直接清理 runtime，RTM-T01..T09 仍可能因 final state 正确而通过。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/training/workbenchRuntimeRegion.test.ts:658-685` | 架构边界 scan 可被语法变体绕过。 | RTM-T10 是唯一证明 cleanup owner 边界的测试；如果它只匹配当前 optional setter 写法，错误 implementation 可用等价 store write 变体通过。 | 按阻塞问题加固 source scan 或改用 AST/structured scan；RTM-T10 仍只能作为补充，不能替代 RTM-T01..T05/T09 outcome tests。 |
| `test/training/workbenchRuntimeRegion.test.ts:515-551` | RTM-T05 只覆盖 `skipCheckpoint` 分支。 | 契约允许 "skip or save+resume" 作为 RTM-T05 representative path，但 implementation 仍必须让 `saveCheckpointComment -> resumeRecall` 使用同一 owner cleanup。当前 T10 精确字符串 scan 还能卡住现有 `resumeRecall` raw cleanup；加固时不要丢失这一点。 | 非单独 blocker；随 T10 加固一起确保 comment/resume cleanup raw writes 不能假绿。 |
| `test/training/workbenchRuntimeRegion.test.ts:144-176` | 本地 in-memory repository fake 扩展 `calls/data`。 | 命中必查模式 `calls = {`，但该 fake 不是 fake-green：`RuntimeRegionRepository = TrainingRepository & {...}`，且 `repository: RuntimeRegionRepository` 对象实现 production repository surface。 | 可接受；保持 production type binding，不要改成 untyped JS/JSDoc fake。 |
| `test/training/workbenchRuntimeRegion.test.ts:433-444` | 本地 `ProblemFlowService` fake。 | 该 fake 只模拟 Problem submit command port，并显式声明 `const problemFlowService: ProblemFlowService`，不是完整未绑定 service spy。 | 可接受；后续若扩大 Problem service behavior，应迁移到 shared typed factory 或更真实 service path。 |

必查 grep 结果：未发现 `assert.ok(true)`、`assert(true)`、`.skip(`、`this.skip`、`TODO`、`GAP`、`current behavior`、`current implementation`、`calledOnce`、callback-only、`as any`、`: any`、`Promise<unknown>`。唯一命中是 `calls = {`，已按上表判断为 typed in-memory fake extension。

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| RTM-T01 | Play submit uses real flow/store/runtime and activates recall runtime while clearing stale problem/checkpoint/draft after success. | `test/training/workbenchRuntimeRegion.test.ts:404-425` | covered | Uses real `service.submit`; currently fails at `:423` on stale checkpoint not cleared, expected RED. |
| RTM-T02 | Problem submit clears problem runtime and checkpoint transients only after successful recall creation. | `test/training/workbenchRuntimeRegion.test.ts:427-465` | covered | `ProblemFlowService` fake is production type-bound; currently fails at `:463` on stale checkpoint not cleared. |
| RTM-T03 | Explicit `enterRecall({tabId, attemptId})` activates recall runtime and removes stale problem/checkpoint state. | `test/training/workbenchRuntimeRegion.test.ts:467-486` | covered | Uses real `enterRecall`; currently fails at `:483` because stale `problemView` remains. |
| RTM-T04 | `completeRecall` final path clears completed recall runtime while transitioning to Analysis. | `test/training/workbenchRuntimeRegion.test.ts:488-513` | covered | Uses real flow and type-bound recallService port; currently fails at `:510` because `activeRecallSessionId` remains. |
| RTM-T05 | Checkpoint resume/skip/comment cleanup clears checkpoint runtime, keeps recall active, and does not write protected Attempt fields. | `test/training/workbenchRuntimeRegion.test.ts:515-551` | covered | Covers skip path with real `createRecallCheckpointService`, real stores, in-memory repository; does not mix checkpoint activation. |
| RTM-T06 | Temporary Analysis from Problem and Recall-normal preserves source runtime fields. | `test/training/workbenchRuntimeRegion.test.ts:554-582` | covered | Covers only Problem source `problemView` and Recall-normal `recallView/activeRecallSessionId`; checkpoint source is not mixed in. |
| RTM-T07 | Invalid transition rejects without tab/runtime mutation. | `test/training/workbenchRuntimeRegion.test.ts:584-600` | covered | Current GREEN; asserts deep tab and runtime snapshots, not logger/call count. |
| RTM-T08 | Submit failure before transition commit preserves source tab/runtime snapshots. | `test/training/workbenchRuntimeRegion.test.ts:602-629` | covered | Current GREEN; failure is injected through type-bound recallService port, not mocked flow. |
| RTM-T09 | Real runtimeStore subscriber observes owner-driven cleaned recall runtime snapshot. | `test/training/workbenchRuntimeRegion.test.ts:631-656` | covered | Uses real subscription; currently fails at `:649` because owner-cleaned snapshot is absent. |
| RTM-T10 | Runtime-region owner owns cleanup boundary and imports no forbidden dependencies; flow/checkpoint services stop scattered raw cleanup. | `test/training/workbenchRuntimeRegion.test.ts:658-685` | not-covered | Current RED for missing module, but future false-green risk remains because boundary scan is too narrow. Must fix before implementation. |
| RTM-D01 | Rendered WorkbenchShell/Panel projection after runtime cleanup. | Contract deferred ledger | deferred-with-approved-reason | No rendered Shell/Panel/projection assertions appear in the test file. |
| RTM-D02 | Analysis scratch workspace / engine target cleanup. | Contract deferred ledger | deferred-with-approved-reason | Test file has no scratch/engine behavior assertions; RTM-T10 owner forbidden-import scan is boundary-only. |
| RTM-D03 | `modeStateResolver` diagnostics. | Contract deferred ledger | deferred-with-approved-reason | No resolver diagnostics tests are mixed in. |
| RTM-D04 | Checkpoint activation, correction draft activation/submit lifecycle, checkpoint-source temporary Analysis. | Contract deferred ledger | deferred-with-approved-reason | Test setup seeds stale checkpoint/draft at `:389-400` and `:519-524`; no `startCheckpoint` or checkpoint-source temporary Analysis assertions are present. |
| RTM-D05 | `visibleBadMoveIds` / hint cache cleanup. | Contract deferred ledger | deferred-with-approved-reason | No visible bad move or hint cache assertions are present. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | `RTM-T10` checks `src/modules/training/workbench/workbenchRuntimeRegion.ts` exists at `test/training/workbenchRuntimeRegion.test.ts:659-665`; current run fails with "runtime region owner module must exist". |
| 被测 handler/flow 改成 noop 时，测试会失败吗？ | 会失败 | T01/T02/T03/T04/T05/T06/T08/T09 assert final real store state after real flow commands, not call count or callbacks. |
| Container 不传关键 props 时，测试会失败吗？ | 本轮不测，合理 | Contract says UI command mapping/rendered return is deferred; this test file imports no Container/UI and does not claim rendered UI coverage. |
| resolver 忽略 mode/context 时，测试会失败吗？ | 本轮不测，合理 | RTM-D03 is formally deferred; test file has no `modeStateResolver` import or assertions. |
| executor/flow 写错 store 或漏写 store 时，测试会失败吗？ | 状态 outcome 会失败；owner boundary 仍需加固 | T01-T05/T09 catch wrong final runtime/tab state. T10 currently may miss direct raw store writes with alternate syntax, hence REQUEST_CHANGES. |
| store 更新后 UI projection 不变时，测试会失败吗？ | 本轮不测，合理 | RTM-D01 rendered/projection return is deferred; T09 only proves real store subscriber observes runtime snapshot. |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` produced 4 passing / 6 failing. Failures are T01 stale checkpoint, T02 stale checkpoint, T03 stale problemView, T04 activeRecallSession, T09 missing owner-cleaned subscriber snapshot, T10 missing owner module. |

已运行验证：

| 命令 | 结果 |
| --- | --- |
| `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` | expected RED shape: 4 passing, 6 failing |
| `npx tsc --noEmit` | not available in this repo: `typescript` is not installed; type binding was audited from TS imports/annotations and production type references, not from a compiler run. |

## 7. Human Gate

- 不建议进入 implementation-agent，直到 RTM-T10 加固并重新审计。
- 可以继续接受 RTM-D01..D05 deferred；当前测试没有把 rendered UI、scratch/engine、resolver diagnostics、checkpoint activation 或 visibleBadMove cache 混入 step2.1。
- 修复范围应只改 `test/training/workbenchRuntimeRegion.test.ts` 的 RTM-T10/boundary helper 或等价 shared test helper；不要改 production、runtime contract 或 checklist 来绕过本审计。
- 修复后目标仍应保持 `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts` 为 4 passing / 6 failing，且失败点仍来自缺 runtime-region owner/cleanup，而不是 harness/type/import bug。

请修复测试审计阻塞问题后再进入实现。
