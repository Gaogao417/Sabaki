verdict: APPROVED

Date: 2026-05-27
Role: contract-auditor
Subject: runtime-region/test-contract-v0.2.md

# 契约审计

## 1. 结论

APPROVED

`test-contract-v0.2.md` 可以进入 test-writer。v0.1 审计中列出的阻塞项已关闭：source-row status 已改为单一合法值；RTM-D01..D05 均补齐 approved reason、exit condition、downstream step/Test ID 和 activation trigger；checkpoint activation 选择正式 deferred 到 step2.1b；RTM-T06 已枚举 Problem 与 Recall-normal 的具体 runtime fields，并把 checkpoint source fields 转入 RTM-D04。

本契约没有把 scratch、engine、diagnostics、rendered UI 或 checkpoint activation 混入 step2.1 的 runtime cleanup 主验收。MUST_AUTOMATE 测试具备生产对象、真实依赖、禁止 mock、主断言和 RED/GREEN 状态，足以交给 test-writer。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-contract-v0.2.md` | Workbench/runtime-region 测试契约 | APPROVED | 本轮审计主对象。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/contract-audit-v0.1.md` | previous audit | checked | 四个 blocker 已逐项复核。 |
| `docs/product/sabaki-training-prd.md` | active product truth | checked | 四个 Workbench mode、Problem runtime、RecallCheckpoint 子流程和持久事实边界与契约一致。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | active architecture truth | checked | flow 仍是父状态机/编排入口；runtime owner 只写 transient runtime；store/service/UI/repository 边界保持清楚。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | active UI/UX truth | checked | 仅用于 visible mode/checkpoint surface/return target 约束；rendered UI 自动化已 deferred。 |
| `AGENTS.md` | repository guardrail | checked | child region 不反写 WorkbenchMode、不改持久事实、不用日志作主要 oracle。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | scope ledger | checked | step2.1 只覆盖 runtime companion cleanup ownership。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow ledger | checked | 仅作状态上下文；按用户要求未修改。 |

## 3. 阻塞问题

无。

通过理由：

1. `test-contract-v0.2.md:42-65` 的 active source row coverage 表使用单一合法 `Status`，无 `RED / GREEN` 或 `RED / DEFERRED` 混合值。
2. `test-contract-v0.2.md:315-321` 的 Deferred Ledger 对 RTM-D01..D05 均有 approved reason、exit condition、downstream step、downstream Test ID/task 和 activation trigger。
3. `test-contract-v0.2.md:278`, `:320`, `:349`, `:361-363`, `:397-399`, `:416` 将 checkpoint activation、correction draft activation/submit lifecycle、checkpoint-source temporary Analysis 正式 deferred 到 step2.1b，没有声称本轮覆盖。
4. `test-contract-v0.2.md:292` 的 RTM-T06 主断言明确覆盖 Problem source `problemView`、Recall-normal source `recallView` 与 `activeRecallSessionId`，并把 checkpoint fields 转入 RTM-D04。
5. `test-contract-v0.2.md:101`, `:259`, `:275-279`, `:351-364`, `:380-381` 明确排除 scratch、engine、diagnostics、rendered UI、snapshot、source-specific tab opening 和 checkpoint activation。

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RTM-T01 | SIDE_EFFECT_BOUNDARY | real `createWorkbenchFlowService(...).submit` from Play | in-memory repository fake implementing production methods; logger tiny stub; typed/shared no-op deps | 是 | APPROVED | 主断言看 tab + runtime final state，禁止 mocked flow、setter spy、callback/logger-only。 |
| RTM-T02 | SIDE_EFFECT_BOUNDARY | real submit from Problem | production `ProblemFlowService` interface or shared typed fake | 是 | APPROVED | 明确防止 rejected service result 被 early cleanup 假绿。 |
| RTM-T03 | SIDE_EFFECT_BOUNDARY | real `enterRecall({tabId, attemptId})` | in-memory repository fake plus production service interfaces | 是 | APPROVED | 不允许直接调用 runtime owner 作为唯一证明。 |
| RTM-T04 | SIDE_EFFECT_BOUNDARY | real `completeRecall` final path | production recall service port or shared typed factory | 是 | APPROVED | 主断言包含 `activeRecallSessionId` 清理，覆盖 v0.1 缺口。 |
| RTM-T05 | SIDE_EFFECT_BOUNDARY | real `skipCheckpoint` / `saveCheckpointComment` with real checkpoint service | in-memory repository fake implementing actual checkpoint methods | 是 | APPROVED | 覆盖 resume cleanup；明确不覆盖 `startCheckpoint` activation。 |
| RTM-T06 | SIDE_EFFECT_BOUNDARY | real `enterAnalysis` + `returnFromAnalysis` temporary path | production/shared typed modeEffects adapter | 是 | APPROVED | 明确 Problem/Recall-normal runtime fields；checkpoint source deferred。 |
| RTM-T07 | SIDE_EFFECT_BOUNDARY | rejected precondition in real flow service | production interface/type; tiny logger/stateless deps | 是 | APPROVED | GREEN regression guard 可保留，但测试必须扩到 tab + runtime snapshot。 |
| RTM-T08 | SIDE_EFFECT_BOUNDARY | mid-flight failure before submit transition commit | production interface/type or in-memory repository fake with failure injection | 是 | APPROVED | 禁止 mocked flow throw；主断言 deep runtime snapshot unchanged。 |
| RTM-T09 | STORE_SUBSCRIPTION | real `createTrainingRuntimeStore.subscribe` through owner-driven flow | same typed deps as selected flow test | 是 | APPROVED | 只断言 final snapshot 被观察到，不锁 setter 次序。 |
| RTM-T10 | ARCHITECTURE_BOUNDARY | runtime-region owner module and integration boundaries | real production source/type; stateless source scan helper | 是 | APPROVED | 边界扫描不能替代 RTM-T01..T05 state-forward outcome。 |

Mock binding note: 仓库 `tsconfig.json` 启用 `allowJs` 但 `checkJs=false`。test-writer 若在 JS 测试里写 service/repository fake，不能只靠 JSDoc 约束；必须使用 TS 测试/helper、shared typed factory，或显式绑定 production interface/type，满足契约 `test-contract-v0.2.md:342-343` 的 mock drift 防护。

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Rendered WorkbenchShell/Panel return | RENDERED_UI_RETURN / PROJECTION_RETURN | 是，RTM-D01 | runtime owner landing 后，进入 `RTM-UI-T01` / `RTM-UI-T02` 或后续 UI/projection slice。 |
| Analysis scratch / engine target | SIDE_EFFECT_BOUNDARY | 是，RTM-D02 | step2.2 `analysis-scratch-region` 覆盖 target/generation/stale result。 |
| `modeStateResolver` diagnostics | ARCHITECTURE_BOUNDARY | 是，RTM-D03 | step2.3 只做 diagnostics/reject，不写 store、不自动 repair。 |
| Checkpoint activation / correction draft / checkpoint temporary Analysis | SERVICE_REPOSITORY_TRANSITION / SIDE_EFFECT_BOUNDARY | 是，RTM-D04 | step2.1b `recall-runtime-activation` 覆盖 RTM-ACT-T01..T03。 |
| `visibleBadMoveIds` / hint cache cleanup | STORE_SUBSCRIPTION / projection-cache owner | 是，RTM-D05 | step2.1c 决定 owner 后补 RTM-CACHE-T01/T02。 |

这些缺口均有正式 deferred ledger，不阻塞 step2.1 test-writer。

## 6. Human Gate

- 可以接受 RTM-D01..D05 作为本轮正式 deferred；它们不会被 test-writer 当作 step2.1 已覆盖。
- 本轮 test-writer 只应写 RTM-T01..RTM-T10，不得把 checkpoint activation、scratch/engine、diagnostics 或 rendered UI 混入 runtime cleanup slice。
- 允许进入 test-writer。关键进入条件是：真实 `workbenchFlowService`、真实 stores、production runtime-region owner/adapter；禁止 mocked flow/runtimeStore/runtime owner；所有 service/repository fake 必须有 production interface/type 或 shared typed factory 绑定。

契约质量可以进入测试编写。
