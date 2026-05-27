Date: 2026-05-27
Role: test-auditor
Subject: diagnostics-region step2.3 tests
Contract: docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/test-contract-v0.2.md
Contract audit: docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/contract-audit-v0.2.md

# 测试审计

## 1. 结论

APPROVED

`test/training/modeStateResolver.test.js` 对 step2.3-local 的测试质量可以进入实现：DIAG-T01B/DIAG-T02B 已由真实 `resolveModeState` 覆盖并 GREEN；DIAG-T05 已写成真实 helper/export 契约测试，当前因生产未导出 `classifyModeStateDiagnostics` 而 RED；DIAG-T06/T07/T08/T09 保持 contract-approved deferred，没有在本轮测试中假装完成 shared flow/store/composition 集成。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/test-contract-v0.2.md` | approved contract | N/A | 核对 DIAG-T01B/T02B/T05 目标与 DIAG-T06/T07/T08/T09 deferred ledger。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/contract-audit-v0.2.md` | approved contract audit | N/A | 确认 test-writer 允许范围只限 `modeStateResolver.ts` / 同边界纯 helper。 |
| `test/training/modeStateResolver.test.js` | resolver diagnostics tests | 是 | `require('../../src/modules/training/workbench/modeStateResolver.ts')`，未 mock resolver/store/service/repository。 |
| `src/modules/training/workbench/modeStateResolver.ts` | production subject evidence | N/A | 确认当前只导出 `resolveModeState`，未导出 `classifyModeStateDiagnostics`，因此 DIAG-T05 RED 合法。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | scope ledger read-only | N/A | 确认 step2.3 tests 预期为 DIAG-T01B/T02B GREEN、DIAG-T05 RED、DIAG-T06/T07/T08/T09 DEFERRED。 |

## 3. 阻塞问题

无。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/training/modeStateResolver.test.js:27-56` | mocked resolver / missing export fake green | 测试真实 require 生产模块，并用 export type assertion 卡住 `resolveModeState` 与 RED helper；删除模块或导出错误会失败。 | 无需修改。 |
| `test/training/modeStateResolver.test.js:446-491` | DIAG-T01B 只测部分矩阵 | 已覆盖 play/problem/recall false + `enter-analysis`、analysis scratch/current true、analysis missing scratch/current invalid + false。 | 无需修改。 |
| `test/training/modeStateResolver.test.js:592-635` | DIAG-T02B 缺少 no-repair proof | 每个缺失 companion row 都记录 `before`，对 deep-frozen input 调用真实 resolver，并断言 clone 后结构不变。 | 无需修改。 |
| `test/training/modeStateResolver.test.js:697-786` | classifier 测试不保留 illegal/diagnostic codes 或返回 repair surface | 三个 DIAG-T05 用真实 resolver output 喂真实 helper，断言 `illegalCodes` / `diagnosticCodes` 与 resolver 结果一致，并通过 `assertNoRepairSurface` 禁止 repair/patch/setter/callback/effect/write key。 | 无需修改；当前 RED 是合法目标红灯。 |
| `test/training/modeStateResolver.test.js:789-825` | source-scan-only behavior proof | source scan 只用于 DIAG-T03B 窄边界，不被用来证明 resolver projection、diagnostics classifier、flow preflight/postflight 或 store transition。 | 无需修改。 |
| `test/training/modeStateResolver.test.js` whole file | broad untyped fakes / handwritten service spies | 测试只构造 plain immutable snapshots；没有本地 fake service/controller/store，也没有 logger-only oracle。 | 无需修改。 |
| `test/training/modeStateResolver.test.js` whole file | shared flow integration slipped into step2.3 | 目标测试未 import/call `workbenchFlowService`、stores、snapshot service 或 production composition；唯一 `snapshotService` 字符串在 banned-pattern scan 中。 | 无需修改。 |

必查模式扫描结果：目标测试未命中 placeholder pass、skip、TODO、GAP/current-implementation/passthrough、callback-called/calledOnce、service spy、`as any`、`: any`、`Promise<unknown>`。唯一相关命中是生产 `modeStateResolver.ts:10` 的 index signature `any`，不是测试 fake 或 service spy。

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| Contract DIAG-T01B | Play/problem/recall must return `snapshotPersistAllowed:false` + `snapshotNextStep:'enter-analysis'`; analysis scratch/current true; analysis missing scratch/current invalid + false. | `test/training/modeStateResolver.test.js:446-491` | covered | Verified GREEN: focused mocha grep passed all 5 DIAG-T01B assertions. |
| Contract DIAG-T02B | Missing problem attempt, missing recall view, missing frozen source attempt, and missing active tab return `ok:false`, exact illegal code, and no input repair. | `test/training/modeStateResolver.test.js:592-635` | covered | Verified GREEN: focused mocha grep passed all 4 DIAG-T02B assertions. |
| Contract DIAG-T05 | Pure classifier maps preflight illegal to `reject`, preflight diagnostics-only to `allow`, postflight illegal to `invalid-after-commit`, preserves codes, and returns no repair surface. | `test/training/modeStateResolver.test.js:697-786` | covered | Expected RED: full target test fails 3 assertions because `classifyModeStateDiagnostics` is not exported yet. This is the correct implementation target. |
| Contract DIAG-T06 | Step3 real flow preflight rejects illegal state before writes/effects. | N/A in step2.3 | deferred-with-approved-reason | Deferred by `test-contract-v0.2.md:285` to `step3.integration` because `workbenchFlowService.ts` is a shared lock with step2.2. |
| Contract DIAG-T07 | Step3 real flow postflight surfaces invalid-after-commit without repair. | N/A in step2.3 | deferred-with-approved-reason | Deferred by `test-contract-v0.2.md:286` until integrated runtime/scratch/overlay ordering is stable. |
| Contract DIAG-T08 | Step3 production composition wires explicit diagnostics deps and avoids hidden global/source-specific APIs. | N/A in step2.3 | deferred-with-approved-reason | Deferred by `test-contract-v0.2.md:287` until final helper API and scratch snapshot provider shape are known. |
| Contract DIAG-T09 | Allowed diagnostics-only transitions still update stores/subscriptions/projection. | N/A in step2.3 | deferred-with-approved-reason | Deferred by `test-contract-v0.2.md:288`; rendered UI return only activates if step3 changes projection/render path. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | `getResolveModeState` / `getClassifyModeStateDiagnostics` 使用 `assert.ifError` 和 `typeof ... 'function'` export gate；DIAG-T05 当前正因缺失导出失败。 |
| 被测 handler 改成 noop 时，测试会失败吗？ | 会失败 | `resolveModeState` noop 会破坏 mode、positionSource、mutation contract、illegal/diagnostic code、snapshot matrix 断言；classifier noop 会破坏 action/code/no-repair 断言。 |
| Container 不传关键 props 时，测试会失败吗？ | 不适用 | step2.3-local 不测试 Container；DIAG-T09 rendered/store return 已 formal deferred。 |
| resolver 忽略 mode/context 时，测试会失败吗？ | 会失败 | DIAG-T01/T01B/T02A/T02B/T04 分别断言四 mode projection、snapshot affordance、illegal codes、WorkbenchTab.mode truth 与 source/provider diagnostics。 |
| executor 写错 store 或漏写 store 时，测试会失败吗？ | 本轮不适用 | executor/store integration 是 DIAG-T06/T07/T09，均 deferred 到 step3，不在 step2.3 声称 covered。 |
| store 更新后 UI projection 不变时，测试会失败吗？ | 本轮不适用 | DIAG-T09 deferred；本测试文件没有 store/subscription/rendered UI claim。 |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | `npx mocha --require tsx test/training/modeStateResolver.test.js` 结果为 25 passing、3 failing；3 个失败均为 DIAG-T05 缺少 `classifyModeStateDiagnostics` 导出。 |

Verification:

- `npx mocha --require tsx test/training/modeStateResolver.test.js --grep "DIAG-T01B|DIAG-T02B"`: 9 passing.
- `npx mocha --require tsx test/training/modeStateResolver.test.js`: 25 passing, 3 failing, all 3 expected DIAG-T05 RED failures on missing `classifyModeStateDiagnostics`.

## 7. Human Gate

- 可接受 DIAG-T06/T07/T08/T09 继续 deferred 到 `step3.integration`，本轮不得把它们记为 flow/store/composition covered。
- 可进入 step2.3 implementation-agent，范围应限于 `modeStateResolver.ts` 或同职责纯 diagnostics helper；不得修改 shared `workbenchFlowService.ts` 做集成。
- DIAG-T05 的实现必须让三个现有 RED 测试变 GREEN，并保持 code preservation 与 no-repair surface 约束。

测试质量可以进入人工确认。
