# 测试审计

## 1. 结论

REQUEST_CHANGES

Focused command:

`npx mocha --require tsx test/analysis/workbenchAnalysisScratchRegion.test.ts`

Result: 3 passing, 7 failing. This matches the contract/checklist expected RED/GREEN shape: SCR-T05A, SCR-T06A, and SCR-T10 are GREEN; SCR-T01, SCR-T02, SCR-T03, SCR-T04/SCR-T05B, SCR-T06B, and SCR-T07 are RED until the scratch-region owner, target metadata, and stale guard are implemented.

However, the tests need fixes before implementation because several assertions can either false-fail a valid implementation or let incorrect adapter payloads pass.

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/test-contract-v0.2.md` | approved contract | N/A | Source-row coverage and RED/GREEN/DEFERRED status checked. |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/contract-audit-v0.2.md` | contract audit | N/A | Contract was APPROVED. |
| `test/analysis/workbenchAnalysisScratchRegion.test.ts` | TypeScript contract tests | yes | Imports real `refreshScratchAnalysis`, real `createWorkbenchFlowService`, real `createWorkbenchStore`, and expected production scratch-region module. |

## 3. 阻塞问题

No BLOCK-level placeholder pass, reverse-contract assertion, mocked scratch-region pass, or core silent skip found.

REQUEST_CHANGES issues that must be fixed before implementation:

1. `test/analysis/workbenchAnalysisScratchRegion.test.ts:792` - SCR-T10 forbids any `status:` or `result:` token as an "Attempt fact write". The contract itself requires scratch targets to carry `status:'active' | 'inactive'`, and SCR-T02/SCR-T03 assert `active.status`. A normal valid implementation will likely false-fail this source scan. Narrow the pattern to Attempt/repository write contexts instead of generic object keys.

2. `test/analysis/workbenchAnalysisScratchRegion.test.ts:584` and `test/analysis/workbenchAnalysisScratchRegion.test.ts:605` - SCR-T02/SCR-T03 only count adapter calls for workspace setup/clear. They do not assert that the adapter receives the active/old target or the real transition input. An implementation could create a correct active target but call `createOrStampWorkspace`, `scheduleScratchAnalysis`, or `clearWorkspace` with the wrong workspace/generation and still pass. Assert the full payloads.

3. `test/analysis/workbenchAnalysisScratchRegion.test.ts:523` - SCR-T01 only checks that `analysis/index.ts` contains `workbenchAnalysisScratchRegion`. Contract rows SCR-T01 and the mock policy require typed adapter/port contracts to be exported. Add assertions for the concrete exported type names, or bind the adapter fake to the production-exported port type when the module exists.

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `SCR-T10` at `test/analysis/workbenchAnalysisScratchRegion.test.ts:792` | False red from broad source scan | Generic `status:` conflicts with required scratch target status and pressures implementation toward obfuscated code. | Match only Attempt/repository fact writes, not target state fields. |
| `SCR-T02` at `test/analysis/workbenchAnalysisScratchRegion.test.ts:584` | Callback-count assertion is primary for adapter delegation | Wrong adapter target/generation could pass while scheduling the wrong workspace. | Assert `createOrStampWorkspace[0].target` and `scheduleScratchAnalysis[0].target` deep-equal the active target, and transition equals the upstream single-object input. |
| `SCR-T03` at `test/analysis/workbenchAnalysisScratchRegion.test.ts:605` | Clear call count does not prove the cleared target | Region could clear a different workspace while invalidating local state. | Assert `clearWorkspace[0].target` equals the old target and transition equals the exit input. |
| `SCR-T04/SCR-T05B` at `test/analysis/workbenchAnalysisScratchRegion.test.ts:730` | Final state is checked, but zero-write contract is not fully locked | A write-then-restore implementation could pass final-state assertions while still emitting forbidden stale writes. | Also inspect recorded `patches` and assert no stale update/final patch writes `currentAnalysis`, `currentOwnership`, `referenceAnalysis`, `referenceOwnership`, global `analysis`, or `analysisTreePosition`. |
| `SCR-T01` at `test/analysis/workbenchAnalysisScratchRegion.test.ts:523` | Export surface proof is too weak for typed port contract | A factory-only re-export can pass while typed adapter/target contracts remain unavailable to tests/helpers. | Add named type-export checks or use production-exported types for adapter/region test doubles. |

No `assert.ok(true)`, `assert(true)`, `it.skip`, `this.skip`, `TODO`, `GAP`, `current behavior`, `passthrough`, or conditional silent pass was found in the required pattern scan.

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| SCR-T01 | Scratch-region owner and typed adapter/port export exists; no forbidden imports/globals. | `workbenchAnalysisScratchRegion.test.ts` SCR-T01 | not-covered | Owner existence is RED as expected, but typed port export coverage is too weak. |
| SCR-T02 | Enter creates active scratch target and delegates workspace setup without mutating WorkbenchTab. | `workbenchAnalysisScratchRegion.test.ts` SCR-T02 | not-covered | RED as expected; adapter payload assertion must be strengthened. |
| SCR-T03 | Exit invalidates target, clears adapter, and rejects late old results. | `workbenchAnalysisScratchRegion.test.ts` SCR-T03 | not-covered | RED as expected; clear payload assertion must be strengthened. |
| SCR-T04 | Stale old target update/final writes no editWorkspace/global/source-tree state. | `workbenchAnalysisScratchRegion.test.ts` SCR-T04/SCR-T05B | not-covered | RED as expected; final state is asserted, but patch history should also prove zero stale writes. |
| SCR-T05A | Legacy current/reference key isolation and final pending false. | `workbenchAnalysisScratchRegion.test.ts` SCR-T05A | covered | GREEN; uses real `refreshScratchAnalysis` and final editWorkspace assertions. |
| SCR-T05B | Target-aware matching/mismatched write-back. | `workbenchAnalysisScratchRegion.test.ts` SCR-T04/SCR-T05B | not-covered | RED as expected; needs stronger zero-write oracle. |
| SCR-T06A | `requestGroup` and `analysisSource` are `scratch-analysis`; global analysis/source tree not updated. | `workbenchAnalysisScratchRegion.test.ts` SCR-T06A | covered | GREEN; real production path, not source scan only. |
| SCR-T06B | Scratch request carries explicit `{tabId, workspaceId, generation, targetTab}` metadata. | `workbenchAnalysisScratchRegion.test.ts` SCR-T06B | not-covered | RED as expected. |
| SCR-T07 | Real flow/store with injected production scratch region drives enter/return outcomes. | `workbenchAnalysisScratchRegion.test.ts` SCR-T07 | not-covered | RED as expected; uses real flow/store and injection seam, not default composition. |
| SCR-T08 | Scratch region source forbids parent/runtime/repository/document/global/direct mode writers. | `workbenchAnalysisScratchRegion.test.ts` SCR-T08 | not-covered | RED as expected because module is absent; source scan is limited but acceptable as architecture-boundary evidence after SCR-T10 false-red fix. |
| SCR-T10 | Scratch modules cannot write Attempt/repository/SGF/history/current-node/global analysis state. | `workbenchAnalysisScratchRegion.test.ts` SCR-T10 | not-covered | Current GREEN is unreliable because the generic `status:` ban conflicts with required target state. |
| SCR-D01 | Shared `workbenchFlowService.ts` cleanup/default composition changes. | Contract only | deferred-with-approved-reason | Step3 integration owns shared flow/default composition. Test file does not require production edits there. |
| SCR-D02 | Production `ctx.createModeEffects()` default scratch wrapper. | Contract only | deferred-with-approved-reason | Step3 integration owns `sabaki.js`/default composition. |
| SCR-D03 | Rendered UI/panel projection after scratch result. | Contract only | deferred-with-approved-reason | Out of this region/state-boundary slice. |
| SCR-D04 | Full engine ownership migration. | Contract only | deferred-with-approved-reason | Out of scope; step2.2 only checks target metadata/stale guard. |
| SCR-D05 | Full Snapshot from non-Analysis mode enters Analysis before persistence. | Contract only | deferred-with-approved-reason | Step3 integration owns snapshot orchestration. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产 scratch region module 删除或导出错误时，核心测试会失败还是跳过/通过？ | Fails | SCR-T01/T02/T03/T07 fail on missing `src/modules/analysis/workbenchAnalysisScratchRegion.ts`; no skip. |
| 被测 handler 改成 noop 时，测试会失败吗？ | Mostly yes, but adapter payload gap remains | Active target, call counts, and stale rejection would fail for pure noop; wrong payloads can still pass until SCR-T02/T03 are strengthened. |
| Container 不传关键 props 时，测试会失败吗？ | Not in scope | Contract defers UI/rendered wiring; SCR-T07 uses real flow seam, not Container. |
| resolver 忽略 mode/context 时，测试会失败吗？ | Not in scope | Scratch region tests do not cover resolver; diagnostics are step2.3. |
| executor 写错 store 或漏写 store 时，测试会失败吗？ | Partially | SCR-T05A/SCR-T06A assert final editWorkspace/global state. SCR-T04 should add patch-history checks for zero stale writes. |
| store 更新后 UI projection 不变时，测试会失败吗？ | Deferred | SCR-D03 correctly defers rendered UI/projection checks. |
| 当前未完成实现是否导致目标 contract 测试红灯？ | Yes | Focused run produced 7 expected failures and 3 expected passes. |
| 测试是否编辑或要求 shared `workbenchFlowService.ts` default composition？ | No | Test scope imports real `createWorkbenchFlowService` and injects `modeEffects`; `git diff --name-only` shows no `workbenchFlowService.ts` or `sabaki.js` diff. SCR-D01/SCR-D02 stay deferred. |

## 7. Human Gate

- 是否接受 deferred 项：SCR-D01/SCR-D02/SCR-D03/SCR-D04/SCR-D05 remain acceptable for step3 or later scope.
- 是否扩大或缩小本轮范围：do not expand into shared `workbenchFlowService.ts` default composition; fix only the test assertions above.
- 是否允许进入 implementation-agent：not yet. Fix SCR-T10 false-red, adapter payload assertions, and typed port export coverage first.

请修复测试审计阻塞问题后再进入实现。
