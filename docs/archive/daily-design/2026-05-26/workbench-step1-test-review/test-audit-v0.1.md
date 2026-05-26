# 测试审计

## 1. 结论

BLOCK

需要退回的上游步骤：

- Uncheck `step1.4`: `test/workbench/wiring/command-map-coverage.test.js` 当前是字符串/metadata 绿灯，不能阻止外部材料命令继续留在 legacy/static path。
- Uncheck `step1.5`: `e2e/workbench-command-acceptance.spec.js` 当前把 101/Fox library command 验收到 `sabaki.toggleThirdPartyPanel`，与 active source truth 的 `taskImportService -> tabService.openTask` 路径冲突。

不需要退回 `step1.2.tests` 和 `step1.3.tests`：它们的 RED 失败是合法契约红灯，不是 fake green。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `test/training/modeStateResolver.test.js` | resolver contract test | 是，目标 `src/modules/training/workbench/modeStateResolver.ts` | 16 个 RED 都来自目标模块未实现/未导出，合法。 |
| `test/workbench/wiring/six-screen-projection.test.js` | Workbench projection wiring test | 是，真实 `TrainingWorkbenchContainer`、stores、Shell render path | 7 个 RED 对准当前静态 fallback / `window.sabaki.db` 缺口，合法。 |
| `test/workbench/wiring/command-map-coverage.test.js` | command map/static source guard | 是，`workbenchCommandMap.ts` + source text | 5 个 GREEN，但对 owner boundary 是 fake green。 |
| `e2e/workbench-command-acceptance.spec.js` | Playwright command acceptance | 是，真实 Electron app | 3 个 GREEN；library path 验收到错误 legacy owner。 |
| contract/source truth docs | 契约与真源 | 否 | 以 `docs/product/`、`docs/architecture/`、`docs/ui_ux/` 为优先真源。 |

Focused commands run:

- `npx mocha --require tsx test/training/modeStateResolver.test.js` -> 0 passing, 16 failing.
- `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js` -> 1 passing, 7 failing.
- `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js` -> 5 passing.
- `npx playwright test --project=workbench-command` -> 3 passing.

Full `npm test` was not run because the focused step1 RED suites are expected to fail until implementation; a full run would mix expected RED with unrelated noise.

## 3. 阻塞问题

1. `e2e/workbench-command-acceptance.spec.js:48`-`52`, `67`-`71` validates the wrong 101/Fox command owner.
   The test monkey-patches `window.__sabaki.toggleThirdPartyPanel`, clicks `library-source-fox` / `library-source-101`, and expects `['fox', '101']`. Production currently matches that wrong path in `src/components/TrainingWorkbenchContainer.js:405`-`410`.
   Active truth says Library/Fox/101 must enter the TrainingTask flow: `docs/ui_ux/workbench-six-screen-migration-wiring-plan.md:57`-`58`, `78`-`79`, and `docs/product/sabaki-training-prd.md:1008`-`1061`.
   Required change: replace this acceptance with an assertion that the buttons call `taskImportService` / synced task lookup and then `tabService.openTask`, or explicitly mark the command as deferred with approved reason and exit condition. Do not assert `toggleThirdPartyPanel` as success.

2. `test/workbench/wiring/command-map-coverage.test.js:59`-`70`, `73`-`92`, `95`-`106` is green while the real command path is wrong.
   It checks only that handler prop names or labels appear in source text and that command metadata says owner `taskImportService`. It does not prove `TrainingWorkbenchContainer` actually dispatches to that owner. The current production handler still calls `sabaki.toggleThirdPartyPanel` (`src/components/TrainingWorkbenchContainer.js:405`-`410`) and the test passes.
   Required change: add a real boundary assertion for high-risk commands, especially `library.fox` and `library.101`: render/click through Container with typed spies, or add a source/AST guard that maps `handlerProp -> owner service call` and fails on `toggleThirdPartyPanel`.

3. `e2e/workbench-command-acceptance.spec.js:74`-`118` is too weak for the edit-bar command contract.
   It proves selecting the line tool changes `sabaki.state.selectedTool` and does not change source game-tree node count. PRD requires edit bar writes stay on Analysis scratch and feed Snapshot/Problem draft material (`docs/product/sabaki-training-prd.md:608`-`614`); UI plan requires edit tools route through scratch command paths (`docs/ui_ux/workbench-six-screen-migration-wiring-plan.md:60`-`61`).
   Required change: either rename/scope this as a tool-selection smoke, or add a command acceptance that performs a scratch edit and asserts scratch/current changes while source game tree remains unchanged.

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `command-map-coverage.test.js:59`-`70` | `container.includes(handlerProp)` fake green | Handler prop can appear in destructuring, comments, or wrong owner handler. It does not prove service boundary crossing. | Add owner-to-call assertion for each high-risk command or convert to generated coverage table only, not wiring proof. |
| `command-map-coverage.test.js:95`-`106` | metadata green while production path wrong | `WORKBENCH_COMMANDS` says owner `taskImportService`, but Container dispatches to `sabaki.toggleThirdPartyPanel`. | Assert metadata and implementation agree. |
| `e2e/workbench-command-acceptance.spec.js:47`-`72` | reverse-contract / current wrong behavior | It blesses the legacy third-party panel as acceptance for Fox/101 instead of import/open TrainingTask flow. | Rewrite around `taskImportService` / `tabService.openTask` effect or approved deferred status. |
| `e2e/workbench-command-acceptance.spec.js:12` | no harness/mock manifest | The E2E group does not declare layer, production subject, real dependencies, mocked globals, or primary assertions. | Add a short manifest header per test group. |
| `test/workbench/wiring/command-map-coverage.test.js:1` | no harness/mock manifest | Workbench wiring/static command test does not declare what is real vs scanned text. | Add manifest: layer, subject, real source files, mocks none, primary assertion limits. |
| `six-screen-projection.test.js:216`-`253`, `350`-`365` | local service/tab fakes are untyped JS | Not currently blocking because primary assertions are projection text, but if reused as service transition proof the fakes can drift from production interfaces. | Prefer shared typed factories when asserting service/tab behavior; keep these fakes source-data-only. |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| WMSR-T01 | Play resolves from `WorkbenchTab.mode`, game-tree source, `playMove`, no scratch persistence. | `modeStateResolver.test.js:314`-`327` | covered | RED legitimate: target module absent. |
| WMSR-T02 | Problem requires `problemView`, problem-attempt source, `problemAttemptMove`, ignores legacy Sabaki mode. | `modeStateResolver.test.js:329`-`348` | covered | RED legitimate. |
| WMSR-T03 | Recall uses frozen source attempt, checkpoint companion, `recallAnswer`, no mutable attempt. | `modeStateResolver.test.js:350`-`377` | covered | RED legitimate. |
| WMSR-T04 | Analysis uses scratch/current, saved return target, analysis overlay/engine, snapshot allowed only there. | `modeStateResolver.test.js:379`-`404` | covered | RED legitimate. |
| WMSR-T05 | Illegal companion states return stable diagnostics, not coerced legal state. | `modeStateResolver.test.js:407`-`502` | covered | RED legitimate. |
| WMSR-T06 | Resolver is pure over deep-frozen inputs. | `modeStateResolver.test.js:540`-`560` | covered | RED legitimate because resolver cannot load. |
| WMSR-T07 | Resolver has no store/service/repository/engine/document/global imports. | `modeStateResolver.test.js:563`-`599` | covered | RED legitimate: file does not exist. |
| WMSR-T08 | `tab.mode` is truth; legacy/source mismatch becomes diagnostic only. | `modeStateResolver.test.js:505`-`537` | covered | RED legitimate. |
| S6P-C01/C02 | Problem left/right panels project repository task + runtime/eval data, not static copy. | `six-screen-projection.test.js:553`-`606` | covered | RED legitimate; failure shows static text/values. |
| S6P-C03 | Recall normal projects active `recallView` progress/status/errors. | `six-screen-projection.test.js:608`-`634` | covered | RED legitimate; status still static. |
| S6P-C04 | Recall checkpoint joins checkpoint, bad move, evaluation, correction draft, AI, comment. | `six-screen-projection.test.js:636`-`669` | covered | RED legitimate; score drop/static fields still wrong. |
| S6P-C05 | Analysis projects context/tree/issues/reference/correction/engine/evaluation from source data. | `six-screen-projection.test.js:671`-`728` | covered | RED legitimate; static analysis panel still visible. |
| S6P-C06 | Library projects history/kifu/records/101/Fox/source states and stays non-mode. | `six-screen-projection.test.js:730`-`800` | covered | RED legitimate; static history and global DB gap remain. |
| S6P-C07 | Presentational panel/drawer files do not read service/store/repository/window source. | `six-screen-projection.test.js:802`-`833` | covered | RED legitimate on `LibrarySideDrawer.js` global DB read. |
| S6P-C08 | Suite contains high-entropy sentinels and no direct final-panel render. | `six-screen-projection.test.js:835`-`879` | covered | GREEN valid as an auxiliary self-guard. |
| Command map step10 | Every visible command has owner, disabled reason, and implementation dispatch to that owner. | `command-map-coverage.test.js` | not-covered | Metadata is covered; real owner dispatch is not. |
| Playwright command step11 / Library | 101/Fox entries open/import real TrainingTasks and expose source states. | `e2e/workbench-command-acceptance.spec.js:47`-`72` | not-covered | Current test asserts legacy `toggleThirdPartyPanel`. |
| Playwright command step11 / Edit bar | Edit-bar commands mutate Analysis scratch/current only and protect source tree. | `e2e/workbench-command-acceptance.spec.js:74`-`118` | not-covered | Source tree protection is covered; scratch mutation path is not. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | `modeStateResolver` 会失败；command-map 会在 imported map 删除时失败；E2E library wrong owner 仍可能绿。 | Resolver run 0/16 passing; command-map imports production map; E2E validates legacy panel, not task import. |
| 被测 handler 改成 noop 时，测试会失败吗？ | mode analysis E2E 会失败；library/import owner 不足； command-map 不会发现 noop if prop name remains. | `command-map-coverage.test.js:59`-`70`; `e2e` only observes `toggleThirdPartyPanel` calls. |
| Container 不传关键 props 时，测试会失败吗？ | six-screen source projection会失败；command-map 可能仍绿。 | Six-screen asserts visible high-entropy text; command-map only scans names/labels. |
| resolver 忽略 mode/context 时，测试会失败吗？ | 会失败。 | Legal/illegal resolver tests assert mode, companion, mutation contract, diagnostics. |
| executor 写错 store 或漏写 store 时，测试会失败吗？ | 本 step 多数不覆盖 executor；edit-bar E2E只覆盖 source tree unchanged，未覆盖 scratch write. | Edit-bar test line 98-117 checks `selectedTool` and node count only. |
| store 更新后 UI projection 不变时，测试会失败吗？ | six-screen projection会失败。 | Current RED failures prove static projection is caught. |
| 当前未完成实现是否导致目标 contract 测试红灯？ | resolver/six-screen 是红灯；command-map/E2E library 是假绿。 | Focused Mocha and Playwright results above. |

## 7. Human Gate

- 是否接受 `step1.5` 的 Library E2E 仅作为 legacy drawer scaffold？本审计建议不接受，因为它与 active source truth 冲突并会误导后续实现进度。
- 是否把 edit-bar E2E 当前版本降级为 tool-selection smoke，并另开 scratch mutation acceptance？若不降级，必须补 scratch/current mutation 断言。
- 是否允许进入 `step2`：不建议。请先退回并修复 `step1.4`、`step1.5`，或者由 human 明确缩小本轮 command acceptance 范围并记录 deferred exit condition。

请修复测试审计阻塞问题后再进入实现。
