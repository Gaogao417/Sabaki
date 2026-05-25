# Sabaki — Codex 仓库上下文

本文件是 Codex 的仓库级 bootstrap 和硬边界入口。`.claude` 和 `CLAUDE.md` 暂时保留作为历史来源；新任务优先遵守本文件、`.codex/hooks.json` 和 `$sabaki-workflows` skill。

## Workflow 入口

任何 Sabaki 业务、状态、架构、Workbench 接线、测试、前端视觉或 workflow 任务，主代理第一步必须显式使用 `$sabaki-workflows`。不得只读 `AGENTS.md` 后直接进入某个角色。

`$sabaki-workflows` 是唯一 workflow 编排入口，负责请求分类、Phase Intake / Slice Planner、业务/Workbench/前端流程选择、gate ledger、角色顺序、模型策略、提交边界和审查阻断规则。

角色 skill 只作为叶子角色提示词使用。执行任一角色时，必须同时处在 `$sabaki-workflows` 和同名角色 skill 下；spawn 子代理时，子代理初始 prompt 必须点名 `$sabaki-workflows` 和对应角色 `$skill`。

`AGENTS.md` 不再重复 workflow 步骤、模型策略、切片规则、审查规则或视觉/Workbench 流程细节。需要调整流程时，修改 `$sabaki-workflows` 及其 references；本文件只保留仓库硬边界和入口规则。

## 项目概要

Sabaki 是一个围棋/SGF 编辑器，基于 Electron + React 架构。

- `src/main.js` — Electron 主进程入口
- `src/modules/sabaki.js` — 核心状态管理（类似 store）
- `src/modules/` — 业务逻辑模块（enginesyncer, gametree, territory 等）
- `src/components/` — React UI 组件
- `src/modules/overlays/` — 解析器/执行器层

## 架构边界

- **resolver 不直接修改状态** — 只做意图解析，交给 executor
- **store（sabaki.js）不调用 engine/UI** — 只管理状态
- **component 不直接修改 core store** — 必须通过 resolver/executor
- **禁止 `window.sabaki` 全局查找**，除非明确允许
- **problem 不是 board mode** — 它是独立的交互模式
- **play/recall/analysis 是 tab phase**，不是 mode
- **recall/analysis 不能修改 game tree**（只读操作）

## 常用命令

- `npm test` — 跑测试
- `npm start` — 启动开发
- `npm run build` — 构建
