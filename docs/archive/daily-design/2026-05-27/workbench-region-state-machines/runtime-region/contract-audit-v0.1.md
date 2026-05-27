Date: 2026-05-27
Role: contract-auditor
Subject: runtime-region/test-contract-v0.1.md

# 契约审计

## 1. 结论

REQUEST_CHANGES

`test-contract-v0.1.md` 的主方向可取：authoritative source truth 已限定为 active `docs/product/`、`docs/architecture/`、`docs/ui_ux/`；`AGENTS.md`、slice plan、design notes 和当前实现被降级为 guardrail / clarification / evidence；step2.1 范围也基本限定在 runtime companion transient cleanup/activation，没有扩到 overlay、scratch、engine、snapshot、UI rendering/projection 或 `modeStateResolver` diagnostics。

但契约还不能进入 test-writer：source-row coverage 表违反状态列枚举规则，多个 DEFERRED 项没有逐项写出 approved reason、exit condition、downstream step/Test ID，且 checkpoint activation 作为本轮命名范围中的 runtime activation 缺少可执行的自动化或正式 deferred 出口。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/runtime-region/test-contract-v0.1.md` | Workbench/runtime-region 测试契约 | REQUEST_CHANGES | 主体边界正确，但 source-row status 和 deferred contract 需要修订。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | 派生 slice plan / gate ledger | checked | 仅用于 step2.1 scope 和 downstream step，不作为产品/架构真源。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow checklist | checked | 本 agent 按用户要求不修改 checklist。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.2.md` | 格式参考 | checked | 用于审计输出结构参考，不作为 runtime 契约真源。 |
| `AGENTS.md` | 仓库 guardrail | checked | child region 不反写 WorkbenchMode、测试验证最终 outcome；契约已正确标为 guardrail。 |
| `docs/product/sabaki-training-prd.md` | 产品真源 | checked | 四个 Workbench mode、checkpoint 属于 Recall 子流程、Attempt/BadMove 持久事实不得被 runtime cleanup 改写。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 架构真源 | checked | flow service、workbenchStore、trainingRuntimeStore、submit/checkpoint/analysis 状态流与契约总体对齐。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | UI/UX 真源 | checked | 四段 mode、checkpoint 是 Recall surface、Analysis return 恢复 saved target；仅用于可见状态/placement。 |

## 3. 阻塞问题

1. `Source Row` 覆盖表的 `Status` 列使用了非法混合值。
   - 位置：`test-contract-v0.1.md:54`, `:58`, `:60`, `:62`, `:63`。
   - 问题：矩阵/状态表的 `Status` 只能是 `GREEN`、`RED`、`DEFERRED` 之一；当前使用 `RED / GREEN`、`RED / DEFERRED`。这会让 test-writer 不清楚该 source row 是现有回归守护、当前缺口，还是正式 deferred。
   - 必须修：拆分 source rows，或将每一行改成一个明确状态。若一个 source row 同时包含 current-green atomicity guard 和 current-red owner gap，应拆成两行。若保留 `RTM-T07` / `RTM-T08` 为 `GREEN`，必须给出现有测试或实现证据；否则标为 `RED`。

2. DEFERRED 项没有逐项满足 approved reason、exit condition、downstream step/Test ID。
   - 位置：`test-contract-v0.1.md:289-293`, `:354-365`, `:397`, `:401`。
   - 问题：`RTM-D01` 至 `RTM-D05` 只写了简短原因或条件，未形成可审计的 deferred contract。尤其 `RTM-D01` 缺 downstream step/Test ID，`RTM-D04` 缺明确 downstream owner/Test ID，`RTM-D05` 只有“avoid scope creep”但没有后续补齐任务。
   - 必须修：新增或改写一张 deferred coverage 表，至少包含 `Deferred ID | Approved reason | Exit condition | Downstream step | Downstream Test ID/task | Activation trigger`。每个 DEFERRED 项必须完整填写；不能用 “unless touched” 替代 exit condition。

3. checkpoint runtime activation 是本轮命名范围的一部分，但当前只以不完整 deferred 处理。
   - 位置：`test-contract-v0.1.md:24`, `:60`, `:216`, `:292`, `:364`, `:397`。
   - 问题：用户给定 scope 包含 `activeCheckpointId`、`correctionDraft` 的 cleanup/activation。契约覆盖了 skip/comment/resume cleanup，却把 `startCheckpoint` activation / submitted correction draft cleanup 推给 `RTM-D04`，但没有 approved deferred 出口，也没有下游 Test ID。这样 test-writer 可能只写 cleanup，遗漏 runtime activation 的核心 row。
   - 必须修：二选一：
     - 将 checkpoint activation 纳入 MUST_AUTOMATE，新增或调整 RTM test 覆盖 `startCheckpoint`/correction draft activation 的真实 service/repository/runtime owner outcome。
     - 或正式 DEFERRED：写明 approved reason、退出条件、downstream step、downstream Test ID，并说明 step2.1 本轮允许进入 test-writer 时只覆盖 checkpoint resume cleanup，不声称覆盖 checkpoint activation。

4. `RTM-T06` 的 temporary Analysis oracle 仍偏抽象。
   - 位置：`test-contract-v0.1.md:306`, `:388-396`, `:414`。
   - 问题：主断言写成 “preserves source runtime fields needed for return”，但未在 `RTM-T06` 行中明确最小字段组合。后文 field matrix 有更具体字段，但 test table 是 test-writer 的直接输入，当前描述仍可能被写成只断言 tab return target 而不查 runtime snapshot。
   - 必须修：在 `RTM-T06` 的 Primary Assertion 中枚举至少一条真实 source runtime 组合，例如 Problem source 的 `problemView`，Recall normal 的 `recallView/activeRecallSessionId`，以及若纳入本轮的 Recall checkpoint source 的 `activeCheckpointId/correctionDraft`。若不覆盖某个组合，必须转入正式 DEFERRED。

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RTM-T01 | SIDE_EFFECT_BOUNDARY | real `createWorkbenchFlowService(...).submit` from Play | in-memory repository fake; logger tiny stub; shared typed factory preferred | 匹配 | 可保留 | 使用真实 flow/store/runtime owner outcome；不能只断言 tab mode 或 callback。 |
| RTM-T02 | SIDE_EFFECT_BOUNDARY | real `createWorkbenchFlowService(...).submit` from Problem | production interface/type or shared typed fake for `ProblemFlowService` | 匹配 | 可保留 | 需要防止 rejected service result 先清 runtime 的假绿。 |
| RTM-T03 | SIDE_EFFECT_BOUNDARY | real `createWorkbenchFlowService(...).enterRecall` | in-memory repository fake and production service interface | 匹配 | 可保留 | 不得直接调用 runtime owner 作为唯一证明。 |
| RTM-T04 | SIDE_EFFECT_BOUNDARY | real `createWorkbenchFlowService(...).completeRecall` | production interface/type or shared typed factory for recall service port | 匹配 | 可保留 | 主验收必须包含 `activeRecallSessionId` 清理。 |
| RTM-T05 | SIDE_EFFECT_BOUNDARY | real `skipCheckpoint` / `saveCheckpointComment` with real checkpoint service | in-memory repository fake implementing actual checkpoint methods | 匹配 | 可保留 | cleanup 策略合格；activation 缺口需按阻塞问题 3 修订。 |
| RTM-T06 | SIDE_EFFECT_BOUNDARY | real `enterAnalysis` + `returnFromAnalysis` temporary path | production interface/type or shared typed factory for modeEffects | 部分匹配 | REQUEST_CHANGES | mock 策略可接受，但 Primary Assertion 必须枚举 runtime fields，避免只测 return target。 |
| RTM-T07 | SIDE_EFFECT_BOUNDARY | rejected precondition in real `workbenchFlowService` | production interface/type; tiny logger stub | 匹配 | REQUEST_CHANGES | 测试层级正确；若当前状态标 `GREEN`，需补证据或改为 `RED`。 |
| RTM-T08 | SIDE_EFFECT_BOUNDARY | mid-flight failure before submit transition commit | production interface/type or in-memory repository fake with failure injection | 匹配 | REQUEST_CHANGES | 禁止 mocked flow 抛错；若当前状态标 `GREEN`，需补证据或改为 `RED`。 |
| RTM-T09 | STORE_SUBSCRIPTION | real `createTrainingRuntimeStore.subscribe` through one real owner-driven flow | same typed deps as chosen real flow test | 匹配 | 可保留 | 断言最终 snapshot 被 subscriber 观察到，不断言 setter 次序。 |
| RTM-T10 | ARCHITECTURE_BOUNDARY | runtime-region owner module and integration boundaries | real production source/type; stateless source scan helper | 匹配 | 可保留 | 只能作为边界证明，不能替代 RTM-T01 至 RTM-T05 的真实 state-forward outcome。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Source-row coverage matrix | 明确 `Status` 枚举 | 否 | 拆分或重写混合 `RED / GREEN`、`RED / DEFERRED` 行，确保每行只用 `GREEN`、`RED` 或 `DEFERRED`。 |
| Rendered WorkbenchShell/Panel projection | RENDERED_UI_RETURN / PROJECTION_RETURN | 是，但不完整 | `RTM-D01` 需要 approved reason、exit condition、downstream step/Test ID。 |
| Analysis scratch / engine target | SIDE_EFFECT_BOUNDARY | 是，但需补完整字段 | `RTM-D02` 可指向 step2.2，但仍需具体 downstream Test ID/task 和 activation trigger。 |
| `modeStateResolver` diagnostics | ARCHITECTURE_BOUNDARY | 是，但需补完整字段 | `RTM-D03` 可指向 step2.3，但要说明 resolver 仍只做 diagnostics/reject，不写 store。 |
| Checkpoint start activation / correction draft lifecycle | SERVICE_REPOSITORY_TRANSITION / SIDE_EFFECT_BOUNDARY | 当前 deferred 不合格 | 必须纳入 MUST_AUTOMATE，或正式 deferred 到具名 downstream step/Test ID；本轮不能模糊声称覆盖 activation。 |
| `visibleBadMoveIds` / hint cache cleanup | STORE_SUBSCRIPTION 或 projection/cache owner | 是，但不完整 | `RTM-D05` 若继续 deferred，需要下游 owner 决策任务和退出条件。 |
| Temporary Analysis no-over-cleaning | SIDE_EFFECT_BOUNDARY | 否 | `RTM-T06` 必须列出具体 runtime fields/substates 的 final snapshot oracle。 |

## 6. Human Gate

- 需要人决定：checkpoint start activation / correction draft activation 是否纳入 step2.1 MUST_AUTOMATE，还是正式 deferred 到后续 recall move/runtime owner slice。
- 需要人决定：`visibleBadMoveIds` 是否仍排除在 step2.1 owner 外；若排除，必须接受一个具名 downstream owner 决策任务。
- 当前不允许进入 test-writer；先修复上述契约审计阻塞问题，再提交 revised contract。

请修复契约审计阻塞问题后再进入测试编写。
