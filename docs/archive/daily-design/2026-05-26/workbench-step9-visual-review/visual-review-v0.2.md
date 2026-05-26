# 视觉还原复审

## 1. 结论

APPROVE

`step8.4` retry3 修复了真实 Playwright 下 Library drawer 点击后不可见的问题。本轮复审同时补齐了 visual harness 的 compact breakpoint guard：harness 现在会打包真实 WorkbenchShell visual fixture，在 desktop 与 1279px compact profile 下截图，并对 board stage、bottom bar、drawer overlay、左右 panel 折叠、水平溢出和文本溢出做 computed layout 断言。

## 2. 本轮修复

- `docs/.visual-acceptance/workbench-harness/capture.js`
  - 使用 webpack 打包 harness entry，避免 Electron 直接加载 ESM/TS dependency 时等待不到 `.workbench-shell`。
  - 增加 `desktop` 与 `compact` capture profiles。
  - compact profile 覆盖 `problem` 与 `analysis-library`，验证 1279px 下 left/right panels 折叠、board stage 存在、bottom bar 在视口内、Library drawer shell 为 fixed overlay 且覆盖视口。
  - 生成 `acceptance-results.json` 和 desktop/compact screenshots。
- `style/workbench.css`
  - 允许 `.wb-visual-action` 在 compact 宽度下换行/断词，修复 Analysis bottom actions 的可见文本溢出。

## 3. 验证命令

- `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js`：8 passing。
- `npx playwright test --project=workbench-command`：3 passed。
- `node docs/.visual-acceptance/workbench-harness/capture.js`：passed，生成 desktop + compact screenshots 和 metrics。
- `npx mocha --require tsx test/workbench/css-responsive.test.js test/workbench/shell/BottomActionBar.test.js`：15 passing。
- `npm run bundle`：webpack production bundle compiled successfully。

## 4. 截图与 Metrics

输出目录：

`docs/archive/daily-design/2026-05-26/workbench-visual-acceptance/screenshots`

关键产物：

- `problem.png`, `recall.png`, `checkpoint.png`
- `analysis.png`, `analysis-library.png`
- `play-history.png`, `play-kifu.png`, `play-games.png`
- `compact-problem.png`, `compact-analysis-library.png`
- `acceptance-results.json`

Compact guard 断言：

- viewport width <= 1279。
- `.workbench-shell__left-panel` 与 `.workbench-shell__right-panel` display 为 `none`。
- document/body 无水平溢出。
- visible buttons/library drawer/action text 无 `scrollWidth > clientWidth` 溢出。
- board fallback 存在、宽度 >= 520px，并在 stage 中居中。
- bottom bar 存在且在视口内。
- Library drawer shell 为 fixed overlay，覆盖 compact viewport；drawer panel 在视口内且高度足够。

## 5. 残余风险

- visual harness 仍是 high-entropy fixture，不是完整 repository/runtime boot；真实数据回流主要由 six-screen projection、command-map、Playwright command acceptance 覆盖。
- CSS token 统一仍有后续清理空间，但不阻塞本次 wiring gate。
