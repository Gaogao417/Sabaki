Date: 2026-05-27
Role: contract-auditor
Subject: overlay-region/test-contract-v0.2.md

# 契约审计

## 1. 结论

APPROVED

`test-contract-v0.2.md` 已关闭 v0.1 audit 的阻塞项：authoritative source truth 限定为 active `docs/product/`、`docs/architecture/`、`docs/ui_ux/`；补齐 source-row coverage；真实 `workbenchFlowService` 测试不再误标为 `CONTROLLER_STATE_TRANSITION`；runtime/scratch/engine/diagnostics/rendered/snapshot 缺口均有 approved reason、exit condition 和 downstream task/Test ID。

允许进入 test-writer 的边界：本轮只写 overlay child-region transition boundary 相关测试，优先覆盖 OVR-T01、OVR-T02、OVR-T03、OVR-T04、OVR-T05、OVR-T06、OVR-T09。OVR-T07/OVR-T08 仅在实现触碰 projection/UI/container wiring 时激活；OVR-D01 至 OVR-D06 保持 deferred，不得在 step1 中扩成 runtime、scratch、engine、diagnostics、snapshot 或视觉实现。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.2.md` | Workbench wiring 测试契约 | APPROVED | 可进入 test-writer，范围限于 overlay transition boundary。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | 派生 slice plan / gate ledger | checked | 仅用于 step1 scope 和 deferred downstream，不作为产品或架构真源。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.1.md` | 上轮 contract audit | checked | v0.1 blocker 已在 v0.2 中关闭。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow checklist | checked | 本 agent 按用户要求不修改 checklist。 |
| `AGENTS.md` | 仓库 guardrail | checked | child region 不反写 mode、测试验证最终 outcome，与 v0.2 对齐。 |
| `docs/product/sabaki-training-prd.md` | 产品真源 | checked | 四个 Workbench mode、Snapshot 必须经 Analysis scratch/current。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 架构真源 | checked | UI/Container/Service/Store 边界、状态机行、overlayStore 显示层 owner。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | UI/UX 真源 | checked | 四段 mode control 是可见 surface，不拥有业务状态。 |
| `src/modules/overlays/overlayStore.ts` | 当前实现证据 | checked | 仅用于判断测试可执行性：真实 overlayStore、subscriber、late async generation 可被测试。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | 当前实现证据 | checked | 仅用于判断测试可执行性：真实 flow/store command path 可被测试；overlay transition port 仍应先由 RED test 驱动。 |

## 3. 阻塞问题

无阻塞问题。

v0.1 blocker 关闭情况：

| v0.1 blocker | v0.2 证据 | 状态 |
| --- | --- | --- |
| 真源混入 `docs/archive/`、`docs/design/`、slice plan | `test-contract-v0.2.md:10-27` 只列 active product/architecture/ui_ux；`29-39` 将 AGENTS/design/slice/current implementation 降级为 guardrail / clarification / evidence。 | closed |
| 缺少 `Source Row / Required Behavior / Test ID / Layer / Status / Notes` 覆盖表 | `test-contract-v0.2.md:41-54` 补齐逐行覆盖，状态只使用 RED/DEFERRED，未把已知缺口标 GREEN。 | closed |
| `workbenchFlowService` state-forward 测试误标 controller 层 | `test-contract-v0.2.md:48-51`、`234-239`、`307` 将 OVR-T04/OVR-T05/OVR-T09 标为 `SIDE_EFFECT_BOUNDARY`，并要求真实 flow/store/overlay owner outcome。 | closed |
| runtime/scratch/engine/diagnostics deferred 不完整 | `test-contract-v0.2.md:283-290` 逐项写明 approved reason、exit condition、downstream step/Test ID。 | closed |
| `pending-confirmation` 不能进入 test-writer | `test-contract-v0.2.md:2` 改为 `revised-for-contract-audit`，本审计结论批准进入 test-writer。 | closed |
| OVR-T01/OVR-T02 误标 GREEN | `test-contract-v0.2.md:245-253` 将当前状态修正为 RED/DEFERRED，并说明现有覆盖不足。 | closed |

非阻塞执行注意：OVR-T05 的 source-row 目标是 Architecture `restartAttempt` 行；test-writer 应优先选真实 `workbenchFlowService.restartAttempt`，只有生产实现证明存在等价的非 return Analysis exit path 时才可替代，并仍需断言最终 tab/overlay outcome。

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| OVR-T01 | STORE_SUBSCRIPTION | `createOverlayStore` `onModeChange(nonAnalysis)` | local tiny stub for stateless deps/callbacks | 匹配 | APPROVED | 使用真实 overlayStore 和真实 subscribe/notify path；主断言是 overlay flags + subscriber outcome。 |
| OVR-T02 | SIDE_EFFECT_BOUNDARY | `createOverlayStore` async generation guard | local controlled Promise/callback stubs | 匹配 | APPROVED | 不 mock generation；断言 late promise 后 overlay 不复活且 forbidden analysis callbacks 不触发。 |
| OVR-T03 | ARCHITECTURE_BOUNDARY | overlay region/store module boundary | real production interface/type or stateless scan helper | 匹配 | APPROVED | 保护 one-way parent-to-child boundary；禁止 overlay 引入 Workbench writer、repository、engine、UI 或 global Sabaki mode writer。 |
| OVR-T04 | SIDE_EFFECT_BOUNDARY | real `createWorkbenchFlowService(...).returnFromAnalysis` with overlay child-region port | shared typed spy factory/helper typed by `WorkbenchFlowServiceDeps`; overlay port typed by production interface | 匹配 | APPROVED | 不 mock flow service 或 workbenchStore；必须用真实 store state + real overlayStore/production adapter outcome 作为主验收。 |
| OVR-T05 | SIDE_EFFECT_BOUNDARY | real `workbenchFlowService` non-return Analysis exit, preferably `restartAttempt` | shared typed spy factory or in-memory repository fake | 匹配 | APPROVED | 不得用 legacy `sabaki.setMode` 证明 state-forward；若路径需要 service/repository fake，必须绑定生产接口。 |
| OVR-T06 | SIDE_EFFECT_BOUNDARY | rejected transition path in real `workbenchFlowService` | shared typed spy factory or production interface/type | 匹配 | APPROVED | 禁止 mock `assertTransition`；失败命令不得通知 overlay owner，也不得清 overlay。 |
| OVR-T07 | PROJECTION_RETURN | overlay state projection to workbench props | shared typed shell/sabaki harness if activated | 匹配，deferred | APPROVED | 只有 overlay state shape、container props、toolbar subscription 或 rendered selected state 被改动时激活。 |
| OVR-T08 | CONTAINER_DELEGATION | `ModeBar -> WorkbenchShell -> TrainingWorkbenchContainer.handleModeChange` command mapping | local tiny callback stub or typed service command spy | 匹配，deferred | APPROVED | 只有 UI/container handler plumbing 被改动或 audit/test needs 要求时激活；不得把 mocked flow service 的调用当作 state-forward 证明。 |
| OVR-T09 | SIDE_EFFECT_BOUNDARY | real `createWorkbenchFlowService(...).enterAnalysis` with overlay child-region port | shared typed spy factory/helper typed by `WorkbenchFlowServiceDeps`; overlay port typed by production interface | 匹配 | APPROVED | 覆盖 enterAnalysis source row；主断言是 return target、mode analysis、overlay owner notification、overlay 默认不自动开启。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Step1 overlay transition boundary | 无阻塞缺口 | 否 | 必须写 OVR-T01/T02/T03/T04/T05/T06/T09；测试必须先证明真实 production outcome，不接受 callback-only 或 logger-only。 |
| Mode segmented control / Container mapping | CONTAINER_DELEGATION | 是 | OVR-T08 的 deferred 可接受；如果 step1 改 UI/container handler，则必须激活并使用真实一参 `onModeChange(key)` 签名。 |
| Overlay props / rendered selected state | PROJECTION_RETURN / RENDERED_UI_RETURN | 是 | OVR-T07/OVR-D05 可接受；如果改 projection、toolbar props、subscription path 或 visible selected state，则必须激活 projection/rendered test。 |
| Runtime companion cleanup | runtime-region owner tests | 是 | OVR-D01 指向 step2.1 / `RUN-T01` `RUN-T02` `RUN-T03`，本轮不得混入。 |
| Analysis scratch lifecycle | scratch-region owner tests | 是 | OVR-D02 指向 step2.2 / `SCR-T01` `SCR-T02`，本轮不得写 scratch lifecycle。 |
| Engine target isolation | engine/scratch target tests | 是 | OVR-D03 指向 step2.2 / `ENG-SCR-T01`，若 step2.2 无法承接则拆 `engine-region.contract` / `ENG-T01`。 |
| `modeStateResolver` production diagnostics | diagnostics tests | 是 | OVR-D04 指向 step2.3 / `DIAG-T01` `DIAG-T02`；resolver 仍不得写状态或 repair。 |
| Snapshot scratch enforcement | snapshot/scratch tests | 是 | OVR-D06 指向 future scratch/snapshot gate / `SNAP-T01`；step1 不得触碰 snapshot flow，若触碰必须激活。 |

## 6. Human Gate

- Deferred 项可以接受：v0.2 对每项都写了 approved reason、exit condition 和 downstream step/Test ID。
- 本轮范围已经缩小到 overlay child-region transition boundary；不得扩大到 runtime、scratch、engine、diagnostics、snapshot 或视觉实现。
- 允许进入 test-writer；test-writer 必须保持真实 `overlayStore`、真实 `workbenchFlowService`、真实 `workbenchStore` 为 state-forward 主路径，生产 service/controller/store/repository fake 必须通过生产接口或 shared typed factory 绑定。

契约质量可以进入测试编写。
