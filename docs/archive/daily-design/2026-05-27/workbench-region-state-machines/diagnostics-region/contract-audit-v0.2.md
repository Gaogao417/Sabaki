Date: 2026-05-27
Role: contract-auditor
Subject: diagnostics-region/test-contract-v0.2.md
Prior audit: diagnostics-region/contract-audit-v0.1.md

# 契约审计

## 1. 结论

APPROVED

`test-contract-v0.2.md` 已解决 `contract-audit-v0.1.md` 的 REQUEST_CHANGES：active truth 与 guardrail/evidence/scope ledger 已拆分，source-row coverage 使用强制列并逐行映射，`GREEN` 语义收紧为已有自动化覆盖，DIAG-T06/T07/T08/T09 已进入正式 deferred ledger，契约状态也不再是 pending。

本轮 step2.3-local 范围足够进入 test-writer：只允许补 `modeStateResolver.ts` projection/purity 与同边界纯 diagnostics classifier/helper 测试，不触碰 shared `workbenchFlowService.ts`。真实 flow preflight/postflight 集成已明确 deferred 到 `step3.integration`，不是遗漏。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/test-contract-v0.2.md` | diagnostics-region revised test contract | APPROVED | 可进入 step2.3-local test-writer。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/contract-audit-v0.1.md` | prior audit | checked | v0.1 的 REQUEST_CHANGES 均已复核。 |
| `docs/product/sabaki-training-prd.md` | 产品真源 | checked | 四个 WorkbenchMode、Attempt 冻结、Snapshot 经 Analysis scratch/current。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 架构真源 | checked | mode transition、write/read path、source-specific API 禁令、flow orchestration。 |
| `docs/architecture/position-source-mutation-contract.md` | 架构真源 | checked | resolver 纯读，PositionSource + MutationContract 边界。 |
| `docs/architecture/workbench-architecture-overview.md` | 架构真源 | checked | mode orchestration 先于 source/contract，不绕过 flow service patch store。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | UI/UX 真源 | checked | 四 mode surface、RecallCheckpoint surface、Snapshot command surface。 |

## 3. 阻塞问题

无。

已确认：

- `test-contract-v0.2.md:24-54` 将 active source truth 与 guardrail/evidence/scope ledger 拆分，且 `:20` 明确 product > architecture > ui_ux。
- `test-contract-v0.2.md:203-223` 提供 `Source Row / Required Behavior / Test ID / Layer / Status / Notes` 覆盖表。
- `test-contract-v0.2.md:12-16` 定义严格 GREEN；`test-contract-v0.2.md:260-275` 将仍需新增测试的 likely-green 行标为 RED。
- `test-contract-v0.2.md:281-288` 为 DIAG-T06/T07/T08/T09 提供 approved reason、exit condition、downstream step、downstream Test ID/task、activation trigger。
- `test-contract-v0.2.md:2` 状态已改为 `revised-for-contract-audit`。

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| DIAG-T01 | PROJECTION_RETURN | `resolveModeState` legal mode projection | none | 匹配 | APPROVED | 使用真实 resolver 与 frozen snapshots；不 mock store/service/resolver。 |
| DIAG-T01B | PROJECTION_RETURN | `resolveModeState` snapshot affordance matrix | none | 匹配 | APPROVED | RED 表示 test-writer 需补矩阵测试，不是契约缺口。 |
| DIAG-T02A | PROJECTION_RETURN | existing illegal companion diagnostics | none | 匹配 | APPROVED | 主断言为 `ok:false`、exact illegal code、no repair。 |
| DIAG-T02B | PROJECTION_RETURN | missing illegal companion matrix rows | none | 匹配 | APPROVED | RED 行有 implementation evidence，但仍要求新增自动化测试。 |
| DIAG-T03A | SIDE_EFFECT_BOUNDARY | resolver input purity | none | 匹配 | APPROVED | 用 deep-frozen snapshots 覆盖 no-mutation，而不是只靠源码扫描。 |
| DIAG-T03B | ARCHITECTURE_BOUNDARY | resolver import/call boundary | none | 匹配 | APPROVED | 仅用于窄边界扫描；不声称 state transition。 |
| DIAG-T04 | PROJECTION_RETURN | source/provider diagnostics | none | 匹配 | APPROVED | 证明 source/provider 只产出 non-blocking diagnostics，不选择 mode/contract。 |
| DIAG-T05 | SIDE_EFFECT_BOUNDARY | pure diagnostics policy/classifier | none | 匹配 | APPROVED | step2.3-local 关键 RED 测试；真实 helper + real resolver，禁止 repair ops。 |
| DIAG-T06 | SIDE_EFFECT_BOUNDARY | Step3 flow preflight integration | production interface/type or shared typed spy factory | 匹配且正式 deferred | APPROVED | 正确要求 real flow/resolver/stores；不得在 step2.3-local 落地。 |
| DIAG-T07 | SIDE_EFFECT_BOUNDARY | Step3 flow postflight integration | production interface/type or shared typed spy factory | 匹配且正式 deferred | APPROVED | postflight invalid-after-commit 与 no repair 留给 step3 real integration。 |
| DIAG-T08 | ARCHITECTURE_BOUNDARY | Step3 production composition | production interface/type | 匹配且正式 deferred | APPROVED | 明确禁止 hidden global 与 source-specific diagnostics path。 |
| DIAG-T09 | STORE_SUBSCRIPTION | Step3 allowed transition return path | production interface/type or shared typed spy factory | 匹配且正式 deferred | APPROVED | 不用 mocked stores 声称 return path；rendered-return 仅在 step3 改 projection/render 时激活。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Step2.3-local resolver snapshot matrix | PROJECTION_RETURN | 否 | test-writer 补 DIAG-T01B。 |
| Step2.3-local illegal companion missing rows | PROJECTION_RETURN | 否 | test-writer 补 DIAG-T02B。 |
| Step2.3-local diagnostics classifier/helper | SIDE_EFFECT_BOUNDARY | 否 | test-writer 补 DIAG-T05，并保持 helper 纯读、无 repair ops。 |
| Flow preflight reject before writes | SIDE_EFFECT_BOUNDARY | 是 | DIAG-T06 按 DIAG-D01 在 `step3.integration` 覆盖。 |
| Flow postflight invalid-after-commit | SIDE_EFFECT_BOUNDARY | 是 | DIAG-T07 按 DIAG-D02 在 `step3.integration` 覆盖。 |
| Production composition explicit diagnostics deps | ARCHITECTURE_BOUNDARY | 是 | DIAG-T08 按 DIAG-D03 在 `step3.integration` 覆盖。 |
| Successful allowed transition store/subscription return | STORE_SUBSCRIPTION | 是 | DIAG-T09 按 DIAG-D04 在 `step3.integration` 覆盖；只有 projection/render path 改动时才加 rendered UI return。 |

## 6. Human Gate

- 可以接受 DIAG-T06/T07/T08/T09 的 deferred 项，条件是 step3 单独集成 real flow/store/resolver/composition。
- 本轮范围应保持 step2.3-local，不允许 test-writer 或 implementation 修改 shared `workbenchFlowService.ts`。
- 允许进入 test-writer，范围限于 DIAG-T01B、DIAG-T02B、DIAG-T05 及必要的 resolver purity/boundary 补强。

契约质量可以进入测试编写。
