Date: 2026-05-27
Role: contract-auditor
Subject: overlay-region/test-contract-v0.1.md

# 契约审计

## 1. 结论

REQUEST_CHANGES

`test-contract-v0.1.md` 的 overlay child-region 方向基本正确：它把 `modeTransitions.ts` 保持为纯 policy、把 `modeStateResolver` 保持为只读诊断、要求 `workbenchFlowService` 只编排并通知 overlay owner，并且禁止 callback-only / setter-order fake green。

但当前契约不能进入 test-writer。主要问题是：真源表把 `docs/archive/`、`docs/design/` 和 slice plan 混入 authoritative source truth；契约来自状态机/命令矩阵却缺少强制的逐行覆盖表；`workbenchFlowService` state-forward 测试标成 `CONTROLLER_STATE_TRANSITION`，与生产对象层级不一致；deferred engine/diagnostics/runtime/scratch 缺口还需要补成正式 deferred 表。`Status: pending-confirmation` 也不能作为进入 test-writer 的状态。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.1.md` | Workbench wiring 测试契约 | REQUEST_CHANGES | 需要 v0.2 修订后才能进入 test-writer。 |
| `AGENTS.md` | 仓库 guardrails | checked | WorkbenchMode 父状态机、child region 不反写 mode、测试验证最终 outcome。 |
| `docs/product/sabaki-training-prd.md` | 产品真源 | checked | 四个 Workbench mode、Snapshot 必须经 Analysis scratch/current。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 架构真源 | checked | UI/Container/Service/Store 边界、状态机契约、overlayStore 显示层 owner。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | UI/UX 真源 | checked | UI spec 不替代 PRD / Architecture；四段 mode control 是可见表面。 |
| `docs/design/workbench-mode-orchestration-contract.md` | 设计说明 / 当前运行态参考 | checked | 可作为实现澄清，但不得覆盖 product > architecture > ui_ux 优先级。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | 实现说明 | checked | child region owner、resolver read-only、outcome-based 测试策略。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | 派生计划 | checked | 可约束本轮 scope/lock，不是产品或架构真源。 |

## 3. 阻塞问题

| 严重级别 | 文件/行 | 问题 | 必须修改 |
| --- | --- | --- | --- |
| P1 | `test-contract-v0.1.md:12-14`, `23`, `30` | 真源表把 `docs/archive/prd-versions/...`、`docs/design/...` 和 slice plan 放在同一个“真源对齐”表里，并在 `test-contract-v0.1.md:23` 复述 `docs/design` 是“最高优先级 source truth”。这违反本 gate 的真源优先级：product > architecture > ui_ux；`docs/archive/` 只能作为历史参考，slice plan 只能作为派生 scope。 | v0.2 必须把 authoritative source truth 限定为 `docs/product/`、`docs/architecture/`、`docs/ui_ux/`。`AGENTS.md`、`docs/design/`、slice plan、当前实现证据可以保留，但必须标为 guardrail / implementation clarification / derived scope / current evidence，且不能覆盖产品或架构真源。 |
| P1 | `test-contract-v0.1.md:167-180`, `255-265` | 契约明显来自架构状态机表、overlay row、Workbench command/wiring rows，但没有强制的逐行覆盖表 `Source Row / Required Behavior / Test ID / Layer / Status / Notes`。现有 OVR-C 表是验收清单，不等价于 source-row 覆盖表，因为它没有逐行追踪 source row，也没有为每个 source row 明确 `GREEN/RED/DEFERRED`。 | 新增逐行覆盖表。至少覆盖：PRD 四 mode / Snapshot scratch 约束；Architecture UI->Container->Service->Store 写路径；Architecture state-machine `enterAnalysis`、`analysis return`、`restartAttempt` rows；Architecture `overlayStore` owner row；UI/UX mode segmented control surface；slice-plan step1 overlay boundary gap。状态只能用 `GREEN`、`RED`、`DEFERRED`，当前实现缺口不得标 `GREEN`。 |
| P1 | `test-contract-v0.1.md:189-190` | OVR-T04/OVR-T05 的 Production Subject 是真实 `createWorkbenchFlowService(...)`，但 Layer 标成 `CONTROLLER_STATE_TRANSITION`。`workbenchFlowService` 是 service/orchestration boundary，不是 controller；把 service state-forward 测试标成 controller 层会误导 test-writer 的 mock 策略。 | v0.2 必须重标或拆分。若测试真实 `workbenchFlowService` 通知 overlay owner 并断言最终 tab/overlay state，优先标为 `SIDE_EFFECT_BOUNDARY`，并把真实 store outcome 写成 postcondition；若所选路径实际经过 repository/domain service，则可标 `SERVICE_REPOSITORY_TRANSITION`。只有被测对象是真实 controller 时，才能使用 `CONTROLLER_STATE_TRANSITION`。 |
| P1 | `test-contract-v0.1.md:180`, `231-236` | Deferred 项把 scratch、engine target id、runtime cleanup、modeStateResolver diagnostics 放在一起，但没有逐项 approved reason、退出条件、后续 Test ID / 任务。`step2.1/2.2/2.3` 覆盖 runtime/scratch/diagnostics 的方向基本可接受；engine target isolation 只写“DEFERRED to engine/scratch region work”，缺少明确退出条件和后续 gate。 | 新增正式 deferred coverage 表。每项都写 approved reason、exit condition、后续 task/Test ID。Engine target isolation 需要明确是否归入 `step2.2` 的 scratch/engine target slice，还是新增后续 engine-region step；不能只用笼统 “engine/scratch region work”。 |
| P2 | `test-contract-v0.1.md:2` | `Status: pending-confirmation` 不能进入 test-writer。当前 gate 结论也不是 approve，所以 pending-confirmation 必须被 v0.2 的修订状态取代。 | v0.2 可标 `draft-for-reaudit` / `revised-for-contract-audit`。只有通过后才能在 audit 文档中记录可进入 test-writer。 |
| P2 | `test-contract-v0.1.md:198-199` | OVR-T01/OVR-T02 被标 `GREEN`，但说明又说“现有测试部分覆盖 / no existing late-async test”。这容易把“当前实现看起来支持”误写成“已有契约测试覆盖”。 | 如果已有自动化测试没有覆盖 subscriber 或 late async，状态应标 `RED` 或 `DEFERRED`。只有真实现有测试完整覆盖该 Test ID，才可标 `GREEN`。 |

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| OVR-T01 | STORE_SUBSCRIPTION | real `createOverlayStore.onModeChange(nonAnalysis)` | `local tiny stub` for stateless deps | 匹配 | APPROVE | 使用真实 overlayStore，mock 的是外部 stateless deps；主断言是 overlay flags + subscriber。注意现有覆盖状态不能误标 `GREEN`。 |
| OVR-T02 | SIDE_EFFECT_BOUNDARY | real `createOverlayStore` async generation guard | local controlled Promise/callback stubs | 匹配 | APPROVE | 不 mock generation 行为；断言 late promise 后 flags 和 forbidden callbacks。 |
| OVR-T03 | ARCHITECTURE_BOUNDARY | overlay region/store module boundary | real production interface/type if checking port shape | 匹配 | APPROVE | 边界方向正确：禁止 overlay region 引入 workbench/service/repository/UI 或可写 mode API。 |
| OVR-T04 | CONTROLLER_STATE_TRANSITION | real `createWorkbenchFlowService(...).returnFromAnalysis` | shared typed spy factory / `WorkbenchFlowServiceDeps` typed helper | 部分匹配 | REQUEST_CHANGES | mock 绑定方向可接受，但 Layer 错。真实 flow service 不是 controller；改成 `SIDE_EFFECT_BOUNDARY` 或拆出真实 controller 层。主断言应继续保持 final tab + overlay state。 |
| OVR-T05 | CONTROLLER_STATE_TRANSITION | representative real `workbenchFlowService` non-return transition | shared typed spy factory / in-memory fake | 部分匹配 | REQUEST_CHANGES | 同 OVR-T04。若选择 `restartAttempt`，还要确保所需 service/repository fake 都绑定生产接口，不能 per-file 手写漂移。 |
| OVR-T06 | SIDE_EFFECT_BOUNDARY | rejected transition path in real `workbenchFlowService` | shared typed spy factory or production interface/type | 匹配 | APPROVE | 禁止 mock `assertTransition`，并断言 failed command 不通知 overlay、不清 overlay。 |
| OVR-T07 | PROJECTION_RETURN | overlay state projection to workbench props | shared typed shell/sabaki harness if activated | 匹配但 deferred | APPROVE_WITH_NOTES | Deferred reason/exit condition 写得清楚：仅在 overlay state shape、container props 或 toolbar subscription 改动时激活。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Source truth / state-machine rows | Source Row coverage table | 否 | 新增 `Source Row / Required Behavior / Test ID / Layer / Status / Notes` 表，逐行映射 active source rows，禁止把当前 dirty 行为标 `GREEN`。 |
| WorkbenchFlowService -> overlay child-region cleanup | 正确 Layer 标注 | 否 | OVR-T04/OVR-T05 必须修正 Layer；保持真实 flow/store/overlay owner，主断言为 outcome。 |
| Runtime companion cleanup | Formal deferred row | 是 | 写 approved reason、exit condition、后续 `step2.1` / Test ID。 |
| Analysis scratch lifecycle | Formal deferred row | 是 | 写 approved reason、exit condition、后续 `step2.2` / Test ID。 |
| Engine target isolation | Formal deferred row | 是，但当前不足 | 明确 downstream owner、exit condition、后续 gate；不能只写 engine/scratch region work。 |
| `modeStateResolver` production diagnostics | Formal deferred row | 是 | 写 approved reason、exit condition、后续 `step2.3` / Test ID；继续禁止 resolver repair。 |
| Rendered UI / visual selected state | Projection/rendered return | 是 | OVR-T07 / OVR-C09 的 deferred 可以接受；若实现改 projection 或 visible controls，必须激活 projection/rendered test。 |

## 6. Human Gate

- 是否接受 v0.2 将 `docs/design/` 和 slice plan 降级为 implementation clarification / derived scope，而不是 authoritative source truth。
- 是否把 engine target isolation 纳入 `step2.2` 的 scratch-region exit condition，还是新增独立 engine-region 后续 step。
- 是否要求 contract-designer 在 v0.2 中把 OVR-T04/OVR-T05 改为 `SIDE_EFFECT_BOUNDARY`，或拆分真正 controller 层测试。
- `pending-confirmation` 不能进入 test-writer；需要 v0.2 修订并重新审计。

请修复契约审计阻塞问题后再进入测试编写。
