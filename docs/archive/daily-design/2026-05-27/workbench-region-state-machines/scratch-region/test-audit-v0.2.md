# 测试审计

## 1. 结论

APPROVED

Focused command:

`npx mocha --require tsx test/analysis/workbenchAnalysisScratchRegion.test.ts`

Result: 3 passing, 7 failing. This matches the approved contract's expected shape: SCR-T05A, SCR-T06A, and SCR-T10 are GREEN; SCR-T01, SCR-T02, SCR-T03, SCR-T04/SCR-T05B, SCR-T06B, and SCR-T07 remain expected RED until the scratch-region owner, target metadata, and stale target guard are implemented.

The prior REQUEST_CHANGES items are fixed: SCR-T10 scan is narrowed, enter/exit adapter payload assertions now include target and transition input, stale patch-history zero-write checks were added, and the typed port/export proof now requires concrete named type exports.

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/test-contract-v0.2.md` | approved contract | N/A | Source-row coverage, mock policy, and RED/GREEN/DEFERRED table checked. |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/contract-audit-v0.2.md` | contract audit | N/A | Contract was APPROVED. |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/test-audit-v0.1.md` | prior test audit | N/A | Prior REQUEST_CHANGES items verified against retry1 tests. |
| `test/analysis/workbenchAnalysisScratchRegion.test.ts` | TypeScript contract tests | yes | Imports real `refreshScratchAnalysis`, real `createWorkbenchFlowService`, real `createWorkbenchStore`, and expected production scratch-region module. |

## 3. 阻塞问题

无。

No BLOCK-level placeholder pass, conditional silent pass, reverse-contract assertion, mocked production scratch-region pass, or core skip was found.

Required pattern scan against `test/analysis/workbenchAnalysisScratchRegion.test.ts` returned no matches for: `assert.ok(true)`, `assert(true)`, `if (!`, `this.skip`, `.skip(`, `TODO`, `GAP`, `current behavior`, `current implementation`, `passthrough`, `calledOnce`, untyped `as any`, or `Promise<unknown>`.

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| SCR-T10 at `test/analysis/workbenchAnalysisScratchRegion.test.ts:903` | Prior false-red risk fixed | Scan now targets Attempt/repository/SGF/global-analysis write contexts instead of generic `status:` or `result:` object keys, so required scratch target fields no longer fail the boundary test. | No change required. |
| SCR-T02 at `test/analysis/workbenchAnalysisScratchRegion.test.ts:654` | Prior adapter payload fake-green fixed | `createOrStampWorkspace` and `scheduleScratchAnalysis` must receive the active target, and workspace setup must receive the upstream single-object transition input. Wrong target/generation no longer passes by call count alone. | No change required. |
| SCR-T03 at `test/analysis/workbenchAnalysisScratchRegion.test.ts:690` | Prior adapter clear fake-green fixed | `clearWorkspace` must receive the old active target and the upstream exit transition object. Clearing the wrong workspace no longer passes by call count alone. | No change required. |
| SCR-T04/SCR-T05B at `test/analysis/workbenchAnalysisScratchRegion.test.ts:833` | Prior write-then-restore fake-green fixed | The test records stale-result patch history and rejects editWorkspace/global result writes, then repeats the zero-write assertion after final state checks. | No change required. |
| SCR-T01 at `test/analysis/workbenchAnalysisScratchRegion.test.ts:52` and `test/analysis/workbenchAnalysisScratchRegion.test.ts:592` | Prior export-surface weakness fixed | The test now requires `WorkbenchAnalysisScratchAdapter`, `WorkbenchAnalysisScratchRegion`, `WorkbenchAnalysisScratchResultInput`, and `WorkbenchAnalysisScratchTarget` type exports from both the region module and `analysis/index.ts`. | No change required. |

The remaining local fakes are typed and scoped: repository/tab/snapshot fakes use `satisfies` production interfaces, the adapter call ledger is typed, and SCR-T07 uses real flow/store with injected mode effects rather than mocking the flow service or store update.

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| SCR-T01 | Scratch-region owner and typed adapter/port exports exist; analysis index re-exports them. | `workbenchAnalysisScratchRegion.test.ts` SCR-T01 | covered | Expected RED now because `workbenchAnalysisScratchRegion.ts` is absent; no skip or fake module. |
| SCR-T02 | Enter creates active scratch target, delegates workspace setup/scheduling with target and transition, and does not mutate WorkbenchTab. | `workbenchAnalysisScratchRegion.test.ts` SCR-T02 | covered | Expected RED until owner implementation exists. |
| SCR-T03 | Exit invalidates target, clears adapter with old target and transition, and rejects late old results. | `workbenchAnalysisScratchRegion.test.ts` SCR-T03 | covered | Expected RED until owner implementation exists. |
| SCR-T04 | Stale old `{workspaceId,generation}` update/final writes no editWorkspace/global/source-tree analysis state. | `workbenchAnalysisScratchRegion.test.ts` SCR-T04/SCR-T05B | covered | Expected RED; patch-history zero-write oracle is present. |
| SCR-T05A | Legacy current/reference key isolation and final pending false. | `workbenchAnalysisScratchRegion.test.ts` SCR-T05A | covered | GREEN using real `refreshScratchAnalysis`; does not claim target-aware coverage. |
| SCR-T05B | Target-aware matching/mismatched write-back. | `workbenchAnalysisScratchRegion.test.ts` SCR-T04/SCR-T05B | covered | Expected RED until explicit target guard exists. |
| SCR-T06A | `requestGroup` and `analysisSource` are `scratch-analysis`; global analysis/source tree are not updated. | `workbenchAnalysisScratchRegion.test.ts` SCR-T06A | covered | GREEN through real production path, not source scan only. |
| SCR-T06B | Scratch analysis request carries explicit `{tabId, workspaceId, generation, targetTab}` metadata. | `workbenchAnalysisScratchRegion.test.ts` SCR-T06B | covered | Expected RED because current production request omits target metadata. |
| SCR-T07 | Real `createWorkbenchFlowService` + real `createWorkbenchStore` + injected production scratch region drive enter/return outcomes. | `workbenchAnalysisScratchRegion.test.ts` SCR-T07 | covered | Expected RED until owner implementation exists; default composition remains deferred. |
| SCR-T08 | Scratch region source forbids parent runtime/repository/document/global/direct mode writers/source-specific APIs. | `workbenchAnalysisScratchRegion.test.ts` SCR-T08 | covered | Expected RED because module is absent; boundary scan will run against real source once implemented. |
| SCR-T10 | Scratch modules cannot write Attempt facts, repository/review facts, SGF tree/history/current node, or global analysis state. | `workbenchAnalysisScratchRegion.test.ts` SCR-T10 | covered | GREEN; narrowed source scan avoids false failure on scratch target state fields. |
| SCR-D01 | Shared `workbenchFlowService.ts` cleanup/default composition changes. | Contract only | deferred-with-approved-reason | Step3 integration owns shared flow/default composition. |
| SCR-D02 | Production `ctx.createModeEffects()` default scratch wrapper. | Contract only | deferred-with-approved-reason | Step3 integration owns `sabaki.js`/default composition. |
| SCR-D03 | Rendered UI/panel projection after scratch result. | Contract only | deferred-with-approved-reason | Out of this region/state-boundary slice. |
| SCR-D04 | Full engine ownership migration. | Contract only | deferred-with-approved-reason | Out of scope; step2.2 checks target metadata/stale guard only. |
| SCR-D05 | Full Snapshot from non-Analysis mode enters Analysis before persistence. | Contract only | deferred-with-approved-reason | Step3 integration owns snapshot orchestration. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产 scratch region module 删除或导出错误时，核心测试会失败还是跳过/通过？ | Fails | SCR-T01/T08 assert file existence; SCR-T02/T03/T07 import the real module and fail with `ERR_MODULE_NOT_FOUND`. |
| 被测 handler 改成 noop 时，测试会失败吗？ | Yes | SCR-T02 requires active target, workspace/schedule calls, target payloads, and transition payload; SCR-T03 requires target invalidation and stale result rejection. |
| Container 不传关键 props 时，测试会失败吗？ | Not in scope | Contract defers rendered UI/Container default composition to SCR-D02/SCR-D03; SCR-T07 verifies the real flow modeEffects seam. |
| resolver 忽略 mode/context 时，测试会失败吗？ | Not in scope | Resolver diagnostics are step2.3 scope. |
| executor 写错 store 或漏写 store 时，测试会失败吗？ | Yes for in-scope scratch writes | SCR-T05A/SCR-T06A assert final editWorkspace/global state; SCR-T04/SCR-T05B assert stale patch-history zero writes. |
| store 更新后 UI projection 不变时，测试会失败吗？ | Deferred | SCR-D03 correctly defers rendered UI/projection verification. |
| 当前未完成实现是否导致目标 contract 测试红灯？ | Yes | Focused run produced 7 expected failures and 3 expected passes. |
| tests 是否 mock 掉声称测试的 production path？ | No | `refreshScratchAnalysis`, `createWorkbenchFlowService`, and `createWorkbenchStore` are real imports; SCR-T07 does not mock flow/store state transition. |
| callback/upstream signature 是否一致？ | Yes | Enter/exit helpers build the same single-object `ModeEnterEffectInput`/`ModeExitEffectInput` shapes that `workbenchFlowService` sends through `modeEffects`. |

## 7. Human Gate

- Deferred items SCR-D01, SCR-D02, SCR-D03, SCR-D04, and SCR-D05 remain acceptable for this slice.
- This retry does not need another test-writer pass.
- Human may allow step2.2 to enter implementation-agent with the expected RED tests as implementation targets.

测试质量可以进入人工确认。
