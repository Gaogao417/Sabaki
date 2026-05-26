Date: 2026-05-26
Role: contract-auditor
Subject: test-contract-v0.1.md

# 契约审计

## 1. 结论

REQUEST_CHANGES

`test-contract-v0.1.md` 的目标方向正确：它拒绝 callback-only 和手动 seeded fake state，并要求真实 submit 之后有 state-forward、projection return 和 rendered return。但当前契约还不能进入 test-writer，因为它把 service-side `runtimeStore.recallView` hydration 写成架构真源要求，缺少状态机/命令表来源的逐行覆盖表，并且有一处 layer 标注不匹配生产对象。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.1.md` | Workbench wiring 测试契约 | REQUEST_CHANGES | 需要 v0.2 修订后才能进入 test-writer。 |
| `docs/product/sabaki-training-prd.md` §5.2 | 产品真源 | checked | 四个 Workbench mode、Problem/Review/Punishment 与 runtime mode 区分。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` §§0.4, 1.1, 1.2, 1.3, 4.3, 5.3, 5.8, 9.4 | 架构真源 | checked | Submit 写路径、service/store/repository 边界、runtimeStore 职责、RecallSession 所有权。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` §0 | UI/UX 真源 | checked | 只约束可见 Workbench 表面，不覆盖业务/架构优先级。 |

## 3. 阻塞问题

| 严重级别 | 文件/行 | 问题 | 必须修改 |
| --- | --- | --- | --- |
| P1 | `test-contract-v0.1.md:12`, `50`, `70`, `94`, `119`, `207`, `213` | 契约把 service-side `runtimeStore.setRecallView` hydration 写成 Architecture §4.3/§9.4 支持的主路径。实际架构 §4.3 只声明 runtimeStore 保存当前运行态且列出 `activeRecallSessionId`，没有 `recallView/setRecallView`；§9.4 submit 链路止于 `trainingRuntimeStore.setActiveRecallSession(recallSessionId)`；§1.1 允许 read path 走 `Store / Repository query -> Container / ViewModel -> UI Component`。 | v0.2 必须把 service-side hydration 改写为“允许的当前实现/迁移策略”，而不是架构规定。可以保留为 primary path，但必须加约束：完整 RecallSession 事实仍在 repository/service；`recallView` 只是 active session 的 transient projection/cache；session id 必须与 tab/runtime active id 一致；旧 view 必须在 tab/session 切换或完成时清理；映射应通过命名 mapper/helper 或生产类型约束，不能把 panel 私有 shape 散进 service。不得仅因 service 能 hydrate 就禁止 architecture-compliant repository-backed Container/ViewModel projection；如果继续禁止，必须给出 active architecture 依据或把它标为本轮实现选择而非真源要求。 |
| P1 | `test-contract-v0.1.md:113-124`, `200-213` | 契约来自 Architecture mode table、§9.4 command chain 和 Workbench 控件清单，但缺少强制的逐行覆盖表 `Source Row / Required Behavior / Test ID / Layer / Status / Notes`。 | 新增逐行覆盖表。至少包含：PRD §5.2 四 mode 约束；Architecture state row `play/problem + submit + activeAttempt && !frozen`；Architecture §9.4 submit chain；UI/UX §0 顶部 mode actions 与左侧当前 mode panel；`Problem` top/left submit 控件；service/runtime projection；Play top end deferred；legacy App gate seam。`Status` 只能用 `RED/GREEN/DEFERRED`。当前待写测试不得标 `GREEN`；已知缺口必须标 `RED` 或 `DEFERRED`，并写 approved reason、退出条件、后续 Test ID 或任务。 |
| P1 | `test-contract-v0.1.md:132`, `206` | S2R-T03 的 Production Subject 是真实 `createWorkbenchFlowService(...).submit(tabId)`，但 Layer 标成 `CONTROLLER_STATE_TRANSITION`。该对象在 Architecture §5.3 是 service，且测试要求真实 services + in-memory repository。 | 将 S2R-T03 改为 `SERVICE_REPOSITORY_TRANSITION`，或拆分出真正 controller 的 `CONTROLLER_STATE_TRANSITION`。如果保留 `workbenchFlowService` 作为被测对象，mock 策略应按 service/repository transition 审计。 |
| P2 | `test-contract-v0.1.md:50`, `133`, `213` | 契约过度指定 store setter/notify 细节：要求 `setRecallView` 为主实现，并要求 `workbenchStore.updateTab` 与 `runtimeStore.setActiveRecallSession/setRecallView` 各自 notify。架构要求的是 submit 后 state/projection/UI 回流，不要求每个 setter 独立通知，也不要求测试锁死 setter 顺序。 | 测试主断言改为 outcome-based：真实 submit 后 repository/session、tab/runtime active id、可投影 recall surface、Container projection 和 rendered shell 成立。不要断言内部 setter 调用顺序或每个 setter 必定独立 notify；如要测 subscription，断言 store-owned state change 后 Container 观察到 re-render/projection 即可。 |
| P2 | `test-contract-v0.1.md:136`, `151`, `171-172` | fake-green guard 的静态扫描规则既偏脆也不够严密：原始字符串扫描会被注释/负向断言误伤，也漏掉 alias、helper、imported seeding helper 等手动 seed。 | v0.2 必须把 S2R-T07 改成精确 guard：限定扫描新 regression suite 及其本地 helper；忽略注释和字符串说明；禁止测试 arrange/act 中直接或间接手动 seed `runtimeStore.setRecallView(...)`、`workbenchStore.updateTab(...mode:'recall')`、`props.mode='recall'`；允许 production service 在 submit 执行期间通过真实 store API 产生状态。可以用 AST/token scan 或命名 helper 禁止列表，不要只做裸 substring。 |

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| S2R-T01 | UI_COMMAND_MAPPING | `WorkbenchShell`, `ModeActions`, `ProblemModePanel` | `local tiny stub` | 匹配 | APPROVE | 只证明 visible presentational controls 发出 semantic callback，不声称 state-forward。 |
| S2R-T02 | CONTAINER_DELEGATION | `TrainingWorkbenchContainer` handler binding | shared typed spy factory | 匹配 | APPROVE | 允许 mock `flowService`，因为只证明 active tab id delegation。必须继续禁止手动 state seed。 |
| S2R-T03 | CONTROLLER_STATE_TRANSITION | real `createWorkbenchFlowService(...).submit(tabId)` | real services + in-memory repository fake | 不匹配 | REQUEST_CHANGES | 被测对象是 service，层级应为 `SERVICE_REPOSITORY_TRANSITION`。repository fake 必须绑定 `TrainingRepository`，不要 per-file ad hoc port。 |
| S2R-T04 | STORE_SUBSCRIPTION | real stores during submit | local subscriber stubs | 部分匹配 | REQUEST_CHANGES | 可保留，但断言应是 submit 后真实 store state 能通知 Container/projection，不要锁死每个 setter 独立 notify。 |
| S2R-T05 | PROJECTION_RETURN | `TrainingWorkbenchContainer` projection after real submit | real production interface/type; in-memory repository fake | 部分匹配 | REQUEST_CHANGES | 目标正确，但不要把 projection 测试绑定到 `setRecallView` 作为唯一架构路径。断言应覆盖真实 created session 产生 active recall props。 |
| S2R-T06 | RENDERED_UI_RETURN | real `WorkbenchShell` + `RecallModePanel` | real production interface/type | 匹配 | APPROVE | 这是必要的 rendered smoke，能防止 props-only fake green。 |
| S2R-T07 | ARCHITECTURE_BOUNDARY | static fake-green guard | no mocked dependencies | 不匹配 | REQUEST_CHANGES | guard 方向正确，但裸字符串规则太脆且漏 alias/helper。按 P2 问题精修。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Architecture mode table `play/problem + submit` source row | Source row coverage table | 否 | 新增逐行覆盖表，标为 `RED`，映射到 S2R-T03/T05/T06。 |
| Architecture §9.4 submit command chain | Source row coverage table | 否 | 新增逐行覆盖表，明确哪些 Test ID 覆盖 command、repository transition、store update、runtime active id、projection return。 |
| Service-side `recallView` hydration vs repository-backed projection | Boundary refinement | 否 | v0.2 必须说明这是实现策略而非架构真源；若坚持 primary path，补 transient cache/mapper/cleanup 约束。 |
| Play 顶部 `结束当前 attempt` 可见路径 | Formal deferred row | 是 | 当前排除是可以接受的，但必须写 approved reason、退出条件、后续任务/Test ID；不能只写“另开步骤”。 |
| Full App legacy `sabaki.state.mode` gate | Manual/architecture deferred row | 是 | 现有 seam 处理方向基本正确。若 implementation 使用 `sabaki.setMode('recall')`，它只能同步 legacy mount/layout gate，必须由 architecture review 检查，不能成为 Shell mode 或业务状态真源。 |
| 非训练副作用边界：game tree、scratch、engine、IPC、source-specific tab API | Side-effect/architecture boundary evidence | 部分 | 契约已有禁止项；v0.2 应在覆盖表中标明由 S2R-T03 strict fake、S2R-T07 或后续 architecture review 覆盖，避免仅停留在文字禁令。 |

## 6. 结论与后续

v0.1 不能进入 test-writer。请先产出 `test-contract-v0.2.md`，至少完成以下修订：

1. 精炼 service-side `recallView` hydration：允许作为当前迁移实现，但不要伪装成 Architecture §4.3/§9.4 的硬要求；补 transient cache、id consistency、cleanup、mapper/type binding 约束。
2. 添加强制 Source Row 覆盖表，使用 `RED/GREEN/DEFERRED`，并给 Play end 与 App legacy seam 写清 deferred reason、退出条件和后续任务/Test ID。
3. 将 S2R-T03 改为 `SERVICE_REPOSITORY_TRANSITION`，或拆出真正 controller 层测试。
4. 将 subscription/projection 测试改为 outcome-based，避免锁死 setter 调用顺序或每个 setter 独立 notify。
5. 将 S2R-T07 改为精确 fake-green guard，禁止测试手动 seed，但允许 production submit 通过真实 store API 产生状态。

Play visible end attempt 暂不纳入本小步是可接受的；App legacy `sabaki.state.mode` seam 的处理方向也基本可接受，但必须在 v0.2 中按 deferred/boundary 行正式记录。
