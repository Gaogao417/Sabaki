Date: 2026-05-26
Role: contract-auditor
Subject: test-contract-v0.2.md

# 契约审计

## 1. 结论

APPROVED

`test-contract-v0.2.md` 已修复 v0.1 的关键问题：`runtimeStore.recallView` 被限定为当前迁移实现的 transient projection/cache，而不是 Architecture v0.5 的硬真源；Source Row 覆盖表完整且只使用 `RED/GREEN/DEFERRED`；S2R-T03 已按真实 service/repository transition 分层；subscription/projection 断言改为 outcome-based；fake-green guard 精确限定测试与 helper，且允许生产 submit 通过真实 store API 产生状态；Play top end 与 App legacy gate 均正式 Deferred。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.2.md` | Workbench wiring 测试契约 | APPROVED | 可进入 test-writer。 |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/contract-audit-v0.1.md` | prior audit | checked | v0.2 已覆盖 prior required changes。 |
| `docs/product/sabaki-training-prd.md` §5.2 lines 169-184 | 产品真源 | checked | 四个 Workbench runtime modes；Problem/Review/Punishment 不是新 mode。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` §§0.3, 0.4, 1.1-1.3, 4.1-4.3, 5.3, 5.5, 5.8, 9.4 | 架构真源 | checked | submit 写路径、service/store/repository 边界、runtimeStore 职责、RecallSession 所有权。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` §0 and component tree | UI/UX 真源 | checked | 顶部 mode actions 与左侧当前 mode panel。 |

## 3. 阻塞问题

无。

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| S2R-T01 | UI_COMMAND_MAPPING | `WorkbenchShell`, `ModeActions`, `ProblemModePanel` visible submit controls | `local tiny stub` | 匹配 | APPROVED | 只证明 presentational callback，无 state-forward 声称。 |
| S2R-T02 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer` handler binding | `shared typed spy factory` | 匹配 | APPROVED | 允许 typed `workbenchFlowService` spy，因为主断言仅为 active tab id delegation。 |
| S2R-T03 | SERVICE_REPOSITORY_TRANSITION | Real `createWorkbenchFlowService(...).submit(tabId)` | `in-memory repository fake`; `real production interface/type`; local tiny pure stubs | 匹配 | APPROVED | 真实 flow/attempt/recall services 与 stores，不允许 mock 被测 state-forward path。 |
| S2R-T04 | STORE_SUBSCRIPTION | Store-to-Container notification outcome after real submit | `local tiny stub` subscribers only | 匹配 | APPROVED | 主断言是 observable projection outcome，不锁 setter 顺序或通知次数。 |
| S2R-T05 | PROJECTION_RETURN | `TrainingWorkbenchContainer` projection after real submit | `real production interface/type`; `in-memory repository fake`; local tiny unused shell stubs | 匹配 | APPROVED | 禁止手动 seed recallView/mode，要求真实 submit 后 props return。 |
| S2R-T06 | RENDERED_UI_RETURN | Real `WorkbenchShell` with real `RecallModePanel` | `real production interface/type` | 匹配 | APPROVED | 渲染真实 Shell/Panel，防止 props-only fake green。 |
| S2R-T07 | ARCHITECTURE_BOUNDARY | Fake-green guard for new regression suite and local helpers | no mocked dependencies | 匹配 | APPROVED | 扫描范围、comments/strings、间接 helper seed、production submit allowlist 都已明确。 |
| S2R-T08 | PROJECTION_RETURN | Stale recall projection cleanup/ignore behavior | `real production interface/type`; local tiny unused shell stubs | 匹配 | APPROVED | mismatch fixture 只用于负向验证，不能制造 success path。 |
| S2R-T09 | ARCHITECTURE_BOUNDARY | Static/source boundary for touched submit-to-recall implementation/tests | no mocked dependencies | 匹配 | APPROVED | 限定 touched files，避免把历史 legacy API 当成本轮失败。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Play top `mode-action-end` visible end attempt path | RENDERED_UI_RETURN / service submit loop | 是 | `S2R-FU-PLAY-END` 已写 reason 与 exit condition；后续独立合同证明 Play visible end -> attempt completion -> Recall UI。 |
| App legacy `sabaki.state.mode` mount/layout gate | App-level rendered/architecture review | 是 | `S2R-FU-APP-GATE` 已写 reason 与 exit condition；后续由 Workbench store gate 或 approved one-way mirror 补齐，不得成为业务真源。 |
| Full Electron/App visual acceptance | Full app/manual acceptance | 是 | 已由 `S2R-M01` / `S2R-M02` 手动验收覆盖，不阻塞 test-writer。 |

## 6. 结论与后续

v0.2 可以进入 test-writer。后续测试必须按契约保持真实 service/store/projection state loop，不得用手动 seeded `recallView`、`mode='recall'` 或 mocked `flowService.submit` 覆盖 state-forward/projection/rendered-return 测试。
