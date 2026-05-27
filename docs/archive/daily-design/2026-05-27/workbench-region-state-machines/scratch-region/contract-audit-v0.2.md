verdict: APPROVED

Date: 2026-05-27
Role: contract-auditor
Subject: scratch-region/test-contract-v0.2.md
Compared with: scratch-region/contract-audit-v0.1.md

# 契约审计

## 1. 结论

APPROVED

`test-contract-v0.2.md` 已解决 `contract-audit-v0.1.md` 的 REQUEST_CHANGES：契约状态不再 pending；active truth 与 guardrail/evidence 已拆分；补齐逐行 source-row coverage；target-aware write-back 已从 legacy key isolation 中拆出并保持 RED；mock/fake 策略明确要求 TS、`satisfies ProductionInterface`、显式返回类型或 shared typed factory。

step2.2 没有把 scratch owner、target creation、generation、target invalidation、stale-ignore、target-aware current/reference write-back boundary 推迟到 step3。shared `workbenchFlowService.ts` production/default composition 与 `ctx.createModeEffects()` wrapper 仍正确 deferred 到 step3.integration。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/test-contract-v0.2.md` | revised Analysis scratch child-region 测试契约 | APPROVED | 本轮审计主对象。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/contract-audit-v0.1.md` | prior audit | checked | v0.1 的 REQUEST_CHANGES 均已在 v0.2 中处理。 |
| `docs/product/sabaki-training-prd.md` | active product truth | checked | Snapshot 先进入 Analysis scratch/current；Analysis edit bar 只写 scratch/current working position。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | active architecture truth | checked | UI/Container/Service/Store 边界、`workbenchFlowService` mode orchestration、Analysis 不隐式改 Attempt。 |
| `docs/architecture/workbench-architecture-overview.md` | active architecture truth | checked | `workbenchStore`/`analysisService` ownership、scratch-analysis source 与 write-back boundary。 |
| `docs/architecture/position-source-mutation-contract.md` | active architecture truth | checked | `scratch/current` + `scratchEdit`，禁止写 SGF tree/history/current node。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | active UI/UX truth | checked | Analysis bottom bar placement/text and same Snapshot command-path constraint。 |

## 3. 阻塞问题

无。

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| SCR-T01 | ARCHITECTURE_BOUNDARY | `workbenchAnalysisScratchRegion.ts` and `analysis/index.ts` exports/boundary | real production interface/type | 匹配 | APPROVED | 验证 owner/typed ports/export 与 forbidden imports/globals；不伪装 state-forward。 |
| SCR-T02 | SIDE_EFFECT_BOUNDARY | production scratch region owner enter path | real production interface/type | 匹配 | APPROVED | 必须真实 region，typed legacy adapter；主断言为 active target/workspace state。 |
| SCR-T03 | SIDE_EFFECT_BOUNDARY | production scratch region owner exit path | real production interface/type | 匹配 | APPROVED | 覆盖 target invalidation、adapter teardown、late old target no recreate。 |
| SCR-T04 | SIDE_EFFECT_BOUNDARY | production scratch region + real `refreshScratchAnalysis` guard path | real production interface/type | 匹配 | APPROVED | stale `{workspaceId,generation}` update/final 必须走 production guard path，不能用 fake filter 或 source-tree spy 作为唯一 oracle。 |
| SCR-T05A | SIDE_EFFECT_BOUNDARY | existing `refreshScratchAnalysis` current/reference key isolation | real production interface/type | 匹配 | APPROVED | 正确限定为 legacy GREEN，不证明 target-aware write-back。 |
| SCR-T05B | SIDE_EFFECT_BOUNDARY | target-aware guarded current/reference write-back | real production interface/type | 匹配 | APPROVED | 明确 RED，要求 matching target writes only matching keys，mismatched target writes nothing。 |
| SCR-T06A | SIDE_EFFECT_BOUNDARY | `refreshScratchAnalysis` request options | real production interface/type | 匹配 | APPROVED | `scratch-analysis` requestGroup/source 可作为 existing GREEN，且不能只靠 string scan。 |
| SCR-T06B | SIDE_EFFECT_BOUNDARY | scratch request target metadata and stale guard | real production interface/type | 匹配 | APPROVED | 明确 RED，禁止 module-local generation-only 或 fake guard。 |
| SCR-T07 | CONTROLLER_STATE_TRANSITION | real `createWorkbenchFlowService` + real `createWorkbenchStore` + injected production scratch region | shared typed spy factory | 匹配 | APPROVED | 正确禁止 mocked flow service、mocked store update、direct tab mutation；default composition downstream 为 SCR-D02。 |
| SCR-T08 | ARCHITECTURE_BOUNDARY | scratch region source boundary | real production interface/type | 匹配 | APPROVED | 覆盖 no runtime/repository/document/window/direct WorkbenchMode writer/source-specific API。 |
| SCR-T10 | ARCHITECTURE_BOUNDARY | scratch region + scratch analysis mutation boundary | real production interface/type | 匹配 | APPROVED | 锁定 allowed working position/editWorkspace analysis writes，禁止 Attempt/SGF/history/global analysis writes。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Production `ctx.createModeEffects()` scratch wrapper/default composition | CONTROLLER_STATE_TRANSITION | 是 | SCR-D02 correctly deferred to step3.integration because it edits `src/modules/sabaki.js`/default composition and shared integration seams. |
| Shared `workbenchFlowService.ts` production composition/ordering cleanup | ARCHITECTURE_BOUNDARY | 是 | SCR-D01 correctly deferred to step3.integration; step2.2 still uses existing modeEffects seam with real flow/store. |
| Full Snapshot from non-Analysis mode before persistence/open | CONTROLLER_STATE_TRANSITION | 是 | SCR-D05 correctly deferred to step3.integration; step2.2 still proves scratch region behavior after `enterAnalysis` is invoked. |
| Rendered UI / panel projection after scratch result | RENDERED_UI_RETURN | 是 | SCR-D03 acceptable for this region/state boundary slice. |
| Full engine ownership migration | SIDE_EFFECT_BOUNDARY | 是 | SCR-D04 acceptable; step2.2 still requires scratch request target metadata and stale guard. |

No unresolved step2.2 coverage gap remains for scratch owner/export, active target creation, target invalidation, stale result ignore, target-aware current/reference write-back, or real flow seam injection.

## 6. Human Gate

- Deferred items SCR-D01, SCR-D02, SCR-D03, SCR-D04, and SCR-D05 are acceptable for this slice.
- 本轮不需要缩小范围；test-writer 可以按 v0.2 的 MUST_AUTOMATE rows 继续。
- 允许进入 test-writer。

契约质量可以进入测试编写。
