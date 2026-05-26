# 测试审计

## 1. 结论

APPROVE

`step1.4` 和 `step1.5` retry 后已移除上一版 BLOCK 中的 reverse-contract / fake-green 风险。不要 uncheck 上游步骤；`step2` may proceed.

后续 implementation 必须满足这些当前预期 RED suites：

- `npx mocha --require tsx test/training/modeStateResolver.test.js` -> 0 passing, 16 failing；等待 `modeStateResolver.ts` 实现。
- `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js` -> 1 passing, 7 failing；等待六屏 projection / presentational boundary 实现。
- `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js` -> 4 passing, 1 failing；等待 101/Fox command 从 `toggleThirdPartyPanel` 改为 `taskImportService -> tabService.openTask`。
- `npx playwright test --project=workbench-command` -> 2 passing, 1 failing；等待 Library 101/Fox click path import/resolve task and open Workbench task tabs。

Focused commands run:

- `npx mocha --require tsx test/training/modeStateResolver.test.js`
- `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js`
- `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js`
- `npm run bundle -- --mode development`
- `npx playwright test --project=workbench-command`

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `test/training/modeStateResolver.test.js` | resolver contract test | 是，目标 `src/modules/training/workbench/modeStateResolver.ts` | 无 mock；缺模块时 16 个测试红灯，合法。 |
| `test/workbench/wiring/six-screen-projection.test.js` | Workbench projection wiring test | 是，真实 `TrainingWorkbenchContainer`、stores、Shell render path | 高熵 sentinel + negative fallback assertions 能抓住静态投影；7 个当前红灯合法。 |
| `test/workbench/wiring/command-map-coverage.test.js` | command map / owner dispatch guard | 是，`workbenchCommandMap.ts` + container/source scans | retry 后新增 external material owner-dispatch guard，当前红在 legacy `toggleThirdPartyPanel`。 |
| `e2e/workbench-command-acceptance.spec.js` | Playwright Electron command acceptance | 是，真实 renderer app / Workbench stores / `tabService.openTask` | retry 后 101/Fox clicks 禁止 legacy panel，并要求 import/lookup + openTask。 |

## 3. 阻塞问题

无。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/workbench/wiring/command-map-coverage.test.js:93`-`105` | 一般 handler 覆盖仍是 source `includes` 级别 | 对非 101/Fox command，它证明 handler prop 名称存在，但不证明每个 handler 都跨到 owner service。 | 非阻塞；当前 step1.4 的高风险 external owner path 已补红灯。后续新增高风险 command 时应补 owner-specific guard 或 E2E。 |
| `e2e/workbench-command-acceptance.spec.js:28`-`144` | E2E monkey-patch import/repository methods | 这是可接受的 deterministic E2E harness，但若未来 production service 方法被删除，patch 可能掩盖接口漂移。 | 非阻塞；建议后续加 `expect(typeof originalImportFoxGame).toBe('function')` / `originalImport101Problem` existence guard，或复用 typed shared factory 做 lower-layer contract。 |
| `e2e/workbench-command-acceptance.spec.js:236`-`290` | edit-bar 仍是 tool-selection smoke | 它不声称 scratch/current mutation covered；PRD 的 scratch mutation 要求尚未由此 suite 覆盖。 | 已在 test manifest 中声明 deferred exit condition；实际 scratch/current mutation 需由 `step8.5` / `step9.2` 补 acceptance。 |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| WMSR-T01 | Play resolves from `WorkbenchTab.mode`, game-tree source, `playMove`, no scratch persistence. | `modeStateResolver.test.js:314`-`327` | covered | RED legitimate: target module absent. |
| WMSR-T02 | Problem requires `problemView`, problem-attempt source, `problemAttemptMove`, ignores legacy Sabaki mode. | `modeStateResolver.test.js:329`-`348` | covered | RED legitimate. |
| WMSR-T03 | Recall uses frozen source attempt, checkpoint companion, `recallAnswer`, no mutable attempt. | `modeStateResolver.test.js:350`-`377` | covered | RED legitimate. |
| WMSR-T04 | Analysis uses scratch/current, saved return target, analysis overlay/engine, snapshot allowed only there. | `modeStateResolver.test.js:379`-`404` | covered | RED legitimate. |
| WMSR-T05 | Illegal companion states return stable diagnostics, not coerced legal state. | `modeStateResolver.test.js:407`-`502` | covered | RED legitimate. |
| WMSR-T06 | Resolver is pure over deep-frozen inputs. | `modeStateResolver.test.js:540`-`560` | covered | RED legitimate. |
| WMSR-T07 | Resolver has no store/service/repository/engine/document/global imports. | `modeStateResolver.test.js:563`-`599` | covered | RED legitimate. |
| WMSR-T08 | `tab.mode` is truth; legacy/source mismatch becomes diagnostic only. | `modeStateResolver.test.js:505`-`537` | covered | RED legitimate. |
| S6P-C01/C02 | Problem left/right panels project repository task + runtime/eval data, not static copy. | `six-screen-projection.test.js:553`-`606` | covered | RED legitimate; static fallback is caught. |
| S6P-C03 | Recall normal projects active `recallView` progress/status/errors. | `six-screen-projection.test.js:608`-`634` | covered | RED legitimate. |
| S6P-C04 | Recall checkpoint joins checkpoint, bad move, evaluation, correction draft, AI, comment. | `six-screen-projection.test.js:636`-`669` | covered | RED legitimate. |
| S6P-C05 | Analysis projects context/tree/issues/reference/correction/engine/evaluation from source data. | `six-screen-projection.test.js:671`-`728` | covered | RED legitimate. |
| S6P-C06 | Library projects history/kifu/records/101/Fox/source states and stays non-mode. | `six-screen-projection.test.js:730`-`800` | covered | RED legitimate. |
| S6P-C07 | Presentational panel/drawer files do not read service/store/repository/window source. | `six-screen-projection.test.js:802`-`833` | covered | RED legitimate on current `LibrarySideDrawer.js` global read. |
| S6P-C08 | Suite contains high-entropy sentinels and no direct final-panel render. | `six-screen-projection.test.js:835`-`879` | covered | GREEN valid auxiliary self-guard. |
| Command map step10 | Every visible command has owner, handler, disabled reason, visible affordance, and high-risk owner-dispatch guard. | `command-map-coverage.test.js:65`-`181` | covered | Retry fixed prior fake green: 101/Fox now fail on legacy path at `:165`-`:179`. |
| Playwright command step11 / mode | Mode command enters analysis and returns through Workbench tab state. | `e2e/workbench-command-acceptance.spec.js:174`-`195` | covered | GREEN valid; asserts active tab mode and return target. |
| Playwright command step11 / Library | 101/Fox entries import or resolve synced tasks, forbid legacy panel, and open Workbench task tabs. | `e2e/workbench-command-acceptance.spec.js:197`-`234` | covered | RED legitimate: current production still calls `toggleThirdPartyPanel`. |
| Playwright command step11 / Edit bar | Edit-bar click smoke selects annotation tool and protects source game tree. | `e2e/workbench-command-acceptance.spec.js:236`-`290` | covered | Scoped as smoke only; scratch/current mutation deferred to `step8.5` / `step9.2`. |
| PRD/UI plan edit-bar scratch mutation | Edit bar writes only Analysis scratch/current and feeds Snapshot / Problem material. | `e2e/workbench-command-acceptance.spec.js:15`-`17`, `:236`-`:290` | deferred-with-approved-reason | This step1 retry explicitly scopes current E2E as tool-selection smoke; architecture plan assigns full scratch mutation to `step8.5` and E2E expansion to `step9.2`. Exit condition: add real scratch/current mutation acceptance before final command acceptance. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败。 | `modeStateResolver` 缺模块时 16 failures；command map imports production map；E2E uses real app. |
| 被测 handler 改成 noop 时，测试会失败吗？ | 关键 step1 handler 会失败。 | 101/Fox handler 留在 legacy/no import path 时 command-map and E2E both fail；mode handler noop 会使 active tab mode assertions fail。 |
| Container 不传关键 props 时，测试会失败吗？ | six-screen 会失败；command-map 对高风险 owner path 会失败。 | Six-screen asserts rendered high-entropy text; command-map extracts actual handler body for 101/Fox. |
| resolver 忽略 mode/context 时，测试会失败吗？ | 会失败。 | Legal/illegal resolver cases assert mode, companion, mutation contract, diagnostics, and purity. |
| executor 写错 store 或漏写 store 时，测试会失败吗？ | step1 仅部分覆盖；后续 scratch executor 仍 deferred。 | Library E2E asserts `tabService.openTask`; edit-bar scratch mutation is explicitly deferred to later steps. |
| store 更新后 UI projection 不变时，测试会失败吗？ | 会失败。 | Six-screen projection current RED proves static UI projection is caught. |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 会。 | Resolver 16 RED, six-screen 7 RED, command-map 1 RED, Playwright library 1 RED. |

## 7. Human Gate

- 不需要退回 `step1.4` 或 `step1.5`；retry 后测试质量可以进入人工确认。
- 可以进入 `step2`。
- Human 需要确认 edit-bar scratch mutation继续按计划在 `step8.5` / `step9.2` 补完整 acceptance，不把当前 smoke 当作完整 scratch mutation 覆盖。

测试质量可以进入人工确认。
