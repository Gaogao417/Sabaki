verdict: REQUEST_CHANGES

Date: 2026-05-27
Role: contract-auditor
Subject: scratch-region/test-contract-v0.1.md

# 契约审计

## 1. 结论

REQUEST_CHANGES

`test-contract-v0.1.md` 的主方向与 active product / architecture / UI 真源一致：Analysis scratch 是 child region，scratch/current 与 scratch/reference 不得污染 Attempt、Recall、repository、documentStore 或 SGF tree；step3 才整合 shared `workbenchFlowService.ts` production composition 的切分也成立。

但当前契约还不能进入 test-writer。阻塞原因是：契约状态仍是 `pending-confirmation`；source-truth 表没有把 active truth 与 guardrail / implementation evidence 分开；缺少矩阵/状态表要求的逐行 source-row coverage；且 target-aware write-back 行把已知 target metadata 缺口标成 `GREEN`，存在 test-writer 误判已覆盖的 fake-green 风险。

## 2. 审查范围

| 文件 | 类型 | 状态 | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/scratch-region/test-contract-v0.1.md` | Analysis scratch child-region 测试契约 | REQUEST_CHANGES | 本轮审计主对象。 |
| `docs/product/sabaki-training-prd.md` | active product truth | checked | 四个 Workbench mode、Snapshot 必须先进入 Analysis scratch/current、edit bar 只写 scratch/current。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md` | active architecture truth | checked | UI/Container/Service/Store 边界、`workbenchFlowService` 父状态机入口、Analysis 不改 Attempt。 |
| `docs/architecture/workbench-architecture-overview.md` | active architecture truth | checked | `workbenchStore` / `analysisService` ownership、scratch-analysis request/write-back boundary。 |
| `docs/architecture/position-source-mutation-contract.md` | active architecture truth | checked | `scratchEdit` 可写 working position 并触发 analysis，禁止写 SGF tree/history/current game-tree node。 |
| `docs/ui_ux/workbench-ui-ux-spec.md` | active UI/UX truth | checked | Analysis bottom edit bar / Snapshot 位置与 scratch / ExplorationBranch guardrail。 |
| `AGENTS.md` | repository guardrail | checked | child region 不反写 WorkbenchMode，测试必须断言最终 outcome。 |
| `docs/design/workbench-mode-orchestration-contract.md` | design guardrail | checked | 仅作为状态机 guardrail，不应覆盖 active product > architecture > ui_ux 优先级。 |
| `docs/design/workbench-mode-state-machine-implementation-notes.md` | design guardrail | checked | Analysis Scratch Region owner、workspaceId/generation stale guard。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | implementation evidence | checked | 现有 `modeEffects` seam 可支持 step2.2 注入测试；shared production composition 可 defer。 |
| `src/modules/analysis/scratchAnalysis.ts` | implementation evidence | checked | 现有 module-local generation、`scratch-analysis` request group、editWorkspace-only write-back，但缺 explicit workspace target metadata。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow ledger | checked | 仅作状态上下文；按用户要求未修改。 |

## 3. 阻塞问题

1. `test-contract-v0.1.md:1-2` 仍标为 `Status: pending-confirmation`。
   - 影响：workflow skill 明确把 `pending-confirmation` contract 当作 background only；test-writer 不应从该状态直接继续。
   - 要求：把契约状态修订为可审计/可执行状态，例如 `revised-for-contract-audit`，或在契约内明确该版本经 contract-audit 通过后可进入 test-writer。

2. `test-contract-v0.1.md:6-31` 把 `AGENTS.md`、`docs/design/*`、当前源码文件与 active docs 一起列在“真源”表。
   - 影响：Workbench wiring / state-machine 契约的产品与架构事实必须从 active `docs/product/`、`docs/architecture/`、`docs/ui_ux/` 派生，优先级为 product > architecture > ui_ux。`docs/design/*` 可以是 guardrail，源码可以是 implementation evidence，但不能与 active truth 同级。
   - 要求：补一段明确声明：active source truth 仅为 `docs/product/`、`docs/architecture/`、`docs/ui_ux/`；`AGENTS.md`、`docs/design/*`、slice/checklist、当前源码只作为 guardrail / scope ledger / implementation evidence，若冲突以 active truth 为准。

3. `test-contract-v0.1.md:198-238` 有 wiring/status tables，但缺少必需的逐行覆盖表。
   - 影响：契约来自命令/状态表，却没有 `Source Row | Required Behavior | Test ID | Layer | Status | Notes` 表；test-writer 无法逐行确认 PRD Snapshot guard、Analysis edit bar scratch-only、position-source mutation、scratch-analysis write-back、child-region no upward mode write 是否都被映射。
   - 要求：新增逐行 coverage 表，`Status` 只能是 `GREEN`、`RED`、`DEFERRED`。至少覆盖 PRD `5.2` / `6.3.6` / `6.3.7`、Architecture v0.5 `0.3` / `0.4` / `5.3`、Workbench architecture scratch-analysis ownership、Position mutation `scratchEdit`、UI/UX Analysis bottom bar、AGENTS child-region guardrail。

4. `test-contract-v0.1.md:230-234` 将 target-aware write-back 相关行标为 `GREEN`，同时承认 explicit workspace target metadata 仍是 `RED`。
   - 影响：SCR-T05 的契约是 matching target result 写回 current/reference 并隔离 pending/final state；如果没有 explicit `{workspaceId,generation}` target metadata，当前只能证明 legacy current/reference key isolation，不能证明 target-aware write-back。`reference result write-back` 备注里的 “simulated; make it production refresh path if practical” 也弱化了 MUST_AUTOMATE。
   - 要求：把 target-aware current/reference write-back 改为 `RED`，或拆成两行：legacy key isolation 可 `GREEN`，workspace target/generation-aware write-back 必须 `RED` 并由 SCR-T05/SCR-T06 自动化。删除 “if practical”，要求使用 real `refreshScratchAnalysis` / production guard path where possible，并断言最终 editWorkspace state。

5. `test-contract-v0.1.md:130-146`、`:242-254` 的 mock binding 还不够精确，尤其允许改 `test/scratchAnalysisTests.js` 时仓库 `tsconfig.json` 为 `checkJs:false`。
   - 影响：仅写 “real production interface/type” 容易退化成 JS hand-written broad fake；对 `RunBoardAnalysis`、legacy adapter、flow deps 的假实现若没有 TS 绑定，会产生 mock drift。
   - 要求：明确 test-writer 必须使用 TS 测试/helper、`satisfies ProductionInterface`、显式返回类型或 shared typed factory。若在 JS 测试文件新增 fake，必须启用 `// @ts-check` 并有可生效的类型导入，或改写为 TS 测试/typed helper。禁止每个测试文件复制 broad service fake。

## 4. 分层与 Mock 策略审计

| Test ID | Layer | Production Subject | Mock Contract Source | Mock 策略是否匹配 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| SCR-T01 | ARCHITECTURE_BOUNDARY | `workbenchAnalysisScratchRegion.ts` export / boundary | `real production interface/type` | 部分匹配 | REQUEST_CHANGES | 需要先导出 typed adapter/port，并要求 source truth / guardrail 分层；source scan 不能替代 state-forward。 |
| SCR-T02 | SIDE_EFFECT_BOUNDARY | production scratch region enter owner | exported production scratch adapter interface | 匹配 | APPROVED | 覆盖 target/generation enter，不 mock flow，不以 callback count 为主断言。 |
| SCR-T03 | SIDE_EFFECT_BOUNDARY | production scratch region exit owner | exported production scratch adapter interface | 匹配 | APPROVED | 覆盖 invalidate + late old target cannot recreate workspace。 |
| SCR-T04 | SIDE_EFFECT_BOUNDARY | scratch region + guarded refresh/update path | production `RunBoardAnalysis` type + adapter type | 部分匹配 | REQUEST_CHANGES | 主断言要求 final state 可以；仍需补 TS/typed factory 约束，避免 JS broad fake。 |
| SCR-T05 | SIDE_EFFECT_BOUNDARY | guarded current/reference write-back | production `RunBoardAnalysis` type | 不完全匹配 | REQUEST_CHANGES | 状态表把 target-aware write-back 标 `GREEN`；必须改为 RED 或拆分 legacy GREEN 与 target-aware RED。 |
| SCR-T06 | SIDE_EFFECT_BOUNDARY | request options / scratch-analysis source isolation | production `RunBoardAnalysis` type | 部分匹配 | REQUEST_CHANGES | requestGroup/source 行可 GREEN；target metadata 行为仍 RED，且 mock binding 需具体化。 |
| SCR-T07 | CONTROLLER_STATE_TRANSITION | real `createWorkbenchFlowService` + real `workbenchStore` + production scratch region injection | production interfaces/shared typed stubs | 匹配 | APPROVED | 正确禁止 mocked flow service；step3 default composition deferred 不隐藏本轮 owner/flow seam 测试。 |
| SCR-T08 | ARCHITECTURE_BOUNDARY | scratch region module boundary | real filesystem source | 匹配 | APPROVED | 覆盖 no `window.sabaki`、no repository/document imports、no direct WorkbenchMode writes；建议 source scan 同时覆盖 indirect writer tokens。 |

## 5. 覆盖缺口

| 控件/流程 | 缺少层级 | 是否 Deferred | 要求 |
| --- | --- | --- | --- |
| Contract source-row traceability | ARCHITECTURE_BOUNDARY / coverage ledger | 否 | 新增 `Source Row | Required Behavior | Test ID | Layer | Status | Notes` 表，状态仅用 GREEN/RED/DEFERRED。 |
| Matching target write-back for current/reference | SIDE_EFFECT_BOUNDARY | 否 | SCR-T05 必须作为 step2.2 RED 自动化，断言 final editWorkspace keys、ownership keys、`analysisPending:false`，且 old target 不写任何 state。 |
| JS/TS fake binding for `RunBoardAnalysis` / adapters / flow deps | all state-forward and side-effect rows | 否 | 使用 `satisfies`、显式返回类型或 shared typed factory；JS 文件需有效 type checking 或改 TS/helper。 |
| Production `ctx.createModeEffects()` scratch wrapper | CONTROLLER_STATE_TRANSITION / production composition | 是，SCR-D02 | Deferred 到 step3 可接受；step2.2 仍必须用 existing `modeEffects` seam + real flow/store 证明 owner outcome。 |
| Shared `workbenchFlowService.ts` production composition / ordering | SIDE_EFFECT_BOUNDARY / integration | 是，SCR-D01 | Deferred 到 step3 可接受；不得在 step2.2 修改 shared production wiring。 |
| Rendered UI / panel projection after scratch result | PROJECTION_RETURN / RENDERED_UI_RETURN | 是，SCR-D03 | 本 slice 是 region/state boundary，UI return deferred 可接受。 |
| Full engine callback ownership migration | SIDE_EFFECT_BOUNDARY | 是，SCR-D04 | Dedicated engine-region or step3+ follow-up 可接受；但 step2.2 仍必须覆盖 scratch request target/generation stale guard。 |

## 6. Human Gate

- Deferred 项 SCR-D01、SCR-D02、SCR-D03、SCR-D04 可以接受；它们没有把 step2.2 必须证明的 scratch owner target/generation、stale ignore、write-back boundary 或 no upward mode write 藏到 step3。
- 不应允许 test-writer 继续，直到契约修订 `pending-confirmation` 状态、source truth 分层、source-row coverage 表、SCR-T05/SCR-T06 状态标记和 typed fake binding。
- 修订后可保持本轮范围：step2.2 只写 scratch region owner、stale-result ignore、write-back boundary、real flow seam tests；production default composition 仍留给 step3。

请修复契约审计阻塞问题后再进入测试编写。
