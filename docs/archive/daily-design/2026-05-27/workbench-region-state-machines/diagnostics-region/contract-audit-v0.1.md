Date: 2026-05-27
Role: contract-auditor
Subject: diagnostics-region/test-contract-v0.1.md

# 契约审计

## 1. 结论

REQUEST_CHANGES

未发现需要 `BLOCK` 的逆向契约：`test-contract-v0.1.md` 对 diagnostics / reject / repair 的区分基本清楚，也明确禁止在 integration claim 中 mock `resolveModeState`、禁止 logger-only 主验收、禁止未绑定接口的宽泛 fake。当前不能进入 test-writer 的原因是契约审计性不足：source truth 表混入 guardrail/evidence，缺少强制的 active source-row coverage 表，且若干 `GREEN` 行把“现有行为应满足”和“测试覆盖状态”混在一起，容易让 test-writer 误把待补测试当作已覆盖。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/diagnostics-region/test-contract-v0.1.md` | diagnostics-region 测试契约 | REQUEST_CHANGES | 方向正确，但 source-row coverage / status / deferred ledger 需要修订。 |
| `docs/product/sabaki-training-prd.md` | 产品真源 | checked | 四个 WorkbenchMode、Attempt 冻结、Snapshot 必须经 Analysis scratch/current。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | 架构真源 | checked | UI -> Container -> Service -> Store/Repository 写路径、非法 transition reject/log、workbenchFlowService 作为编排入口。 |
| `docs/architecture/position-source-mutation-contract.md` | 架构真源 | checked | ModeState 派生 PositionSource / MutationContract；resolver 纯读，写入进入 focused executor。 |
| `docs/architecture/workbench-architecture-overview.md` | 架构真源 | checked | mode orchestration 先于 source/contract；禁止绕过 workbenchFlowService 直接 patch store。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | UI/UX 真源 | checked | UI 固定四个 mode；RecallCheckpoint 是 Recall 表面；本 slice 不需要视觉/UI 自动化。 |
| `docs/design/workbench-mode-orchestration-contract.md` | design guardrail | checked | 仅作 guardrail；不得覆盖 active product / architecture / UI truth。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | design guardrail | checked | `modeStateResolver` 只读，preflight/postflight 可 reject/warn/log，不 repair。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/slice-plan.md` | 派生 scope ledger | checked | 仅用于 step2.3 与 step3 shared lock 范围，不作为产品/架构真源。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow ledger | checked | 只读检查；本审计未修改 checklist。 |

## 3. 阻塞问题

| 严重度 | 位置 | 问题 | 必须修复 |
| --- | --- | --- | --- |
| P1 | `test-contract-v0.1.md:10-38` | `## 0. 真源对齐` 的表头是“真源”，但表内同时列入 `AGENTS.md`、`docs/design/`、当前源码、slice plan、checklist。正文说明它们只是 guardrail / evidence / scope，但表结构仍会把非 active source truth 写成同级事实来源。 | 拆成两张表：active source truth 只保留 `docs/product/`、`docs/architecture/`、`docs/ui_ux/`；`AGENTS.md`、`docs/design/`、当前源码、slice plan/checklist 移到 Guardrail / Evidence / Scope Ledger，并写明若冲突以 active truth 为准。 |
| P1 | `test-contract-v0.1.md:212-236` | 契约来自状态/事件矩阵，但没有强制的 `Source Row / Required Behavior / Test ID / Layer / Status / Notes` 逐行覆盖表。现有表缺 `Source Row` 和 `Layer`，也不能直接证明每条 active PRD/Architecture/UI row 如何落到 Test ID。 | 新增 exact-column source-row coverage 表，至少覆盖 active PRD 四 mode/Attempt/Snapshot 行、Architecture state-machine/write-path/source-specific API 禁令、PositionSource/MutationContract 边界、UI 四 mode/Checkpoint surface。状态只能是 `GREEN`、`RED`、`DEFERRED`。 |
| P1 | `test-contract-v0.1.md:216-229`, `:221-223` | 多个行标 `GREEN` 但备注写 “Existing resolver behavior should satisfy” 或 “If not covered, add step2.3 test”。这把“当前实现看起来满足”和“测试契约覆盖完成”混在一起，test-writer 可能误以为无需新增对应测试。 | 将 `GREEN` 定义清楚。若表示当前生产行为已存在但本轮仍要补自动化测试，应在测试状态表中标为 `RED` 或另列 “implementation evidence: likely green”。只有已有自动化契约完整覆盖时才能标 `GREEN`。 |
| P2 | `test-contract-v0.1.md:190`, `:199-202`, `:233-236`, `:317-329` | Step3 flow preflight/postflight integration 已多处写成 deferred，方向正确，但缺少正式 Deferred Ledger 的完整字段：approved reason、exit condition、downstream step、downstream Test ID/task、activation trigger。 | 为 DIAG-T06、DIAG-T07、DIAG-T08、DIAG-T09 增加 deferred ledger。approved reason 应明确是 `workbenchFlowService.ts` shared lock / step2.2 parallel risk；exit condition 应指向 `step3.integration` 单次集成真实 flow/store/resolver/composition。 |
| P2 | `test-contract-v0.1.md:2` | `Status: pending-confirmation` 不能作为进入 test-writer 的契约状态。 | 修订后改为 `revised-for-contract-audit` 或等价状态；通过审计后再由 audit 明确允许进入 test-writer。 |

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| DIAG-T01 | PROJECTION_RETURN | `resolveModeState` legal mode projection | none | 匹配 | APPROVE_AFTER_FIXES | 使用真实 resolver 和 immutable snapshots；不 mock resolver/store/service。 |
| DIAG-T02 | PROJECTION_RETURN | `resolveModeState` illegal companion diagnostics | none | 匹配 | APPROVE_AFTER_FIXES | 主断言是 `ok:false` / `illegal[]` / no repair；适合 step2.3-local scope。 |
| DIAG-T03 | ARCHITECTURE_BOUNDARY | `modeStateResolver.ts` source boundary | none | 部分匹配 | REQUEST_CHANGES | source scan 只能证明 import/call boundary；“不 mutate frozen input graphs” 应由真实 resolver + frozen input behavior test 覆盖，不能只靠 scan。 |
| DIAG-T04 | PROJECTION_RETURN | `resolveModeState` source/provider diagnostics | none | 匹配 | APPROVE_AFTER_FIXES | 锁定 source/provider 仅 diagnostic，不作为 mode 或 mutation contract 选择器。 |
| DIAG-T05 | SIDE_EFFECT_BOUNDARY | diagnostics policy/classifier helper | none | 匹配 | APPROVE_AFTER_FIXES | step2.3-local 关键测试；必须真实 helper + real resolver，decision 不返回 repair ops。 |
| DIAG-T06 | SIDE_EFFECT_BOUNDARY | Step3 `createWorkbenchFlowService` preflight integration | production interface/type or shared typed spy factory | 匹配但 deferred ledger 不完整 | REQUEST_CHANGES | 正确禁止 mock flow/resolver/stores；需正式 defer 到 step3。 |
| DIAG-T07 | SIDE_EFFECT_BOUNDARY | Step3 postflight integration | production interface/type or shared typed spy factory | 匹配但 deferred ledger 不完整 | REQUEST_CHANGES | 正确要求 real flow/stores/resolver；需正式 defer 到 step3。 |
| DIAG-T08 | ARCHITECTURE_BOUNDARY | Step3 production composition | real production interface/type | 匹配但 deferred ledger 不完整 | REQUEST_CHANGES | 正确禁止 hidden global / source-specific APIs；需正式 defer 到 step3 composition。 |
| DIAG-T09 | STORE_SUBSCRIPTION | Step3 allowed transition return path | production interface/type or shared typed spy factory | 匹配但 deferred ledger 不完整 | REQUEST_CHANGES | 正确不 claim rendered UI；需正式说明 projection/rendered UI activation condition。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Active source truth row mapping | Source-row coverage | 否 | 新增 exact-column source-row table；不得把 design/archive/current code 当 active source truth。 |
| Resolver mutation/no-repair proof | PROJECTION_RETURN / SIDE_EFFECT_BOUNDARY | 否 | DIAG-T02/T05 应使用 frozen input / observable decision 证明 no repair；DIAG-T03 的 source scan 只能作辅助边界证据。 |
| Flow preflight reject before writes | SIDE_EFFECT_BOUNDARY | 是，但 ledger 不完整 | DIAG-T06 正式 deferred 到 `step3.integration`；写 approved reason、exit condition、downstream Test ID。 |
| Flow postflight invalid-after-commit | SIDE_EFFECT_BOUNDARY | 是，但 ledger 不完整 | DIAG-T07 正式 deferred 到 `step3.integration`；不得在 step2.3-local claim flow coverage。 |
| Production composition explicit diagnostics deps | ARCHITECTURE_BOUNDARY | 是，但 ledger 不完整 | DIAG-T08 正式 deferred 到 `step3.integration`；禁止 hidden `window.sabaki` 和 source-specific tab APIs。 |
| Successful allowed transition store/subscription return | STORE_SUBSCRIPTION / RENDERED_UI_RETURN | 是，但 ledger 不完整 | DIAG-T09 可 defer；若 step3 改 projection/render path，再激活 rendered Shell/Panel test。 |

## 6. Human Gate

- Deferred 项方向可以接受，但必须先补正式 deferred ledger，再由 reviewer 确认是否接受。
- 本轮范围可以保持 step2.3-local：`modeStateResolver.ts` projection/diagnostics + pure classifier/helper；不得触碰 shared `workbenchFlowService.ts` 生产集成。
- 目前不允许进入 test-writer；修订后需重新 contract-audit。

请修复契约审计阻塞问题后再进入测试编写。
