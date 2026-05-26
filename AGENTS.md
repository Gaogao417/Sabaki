# Sabaki — Codex 仓库上下文

本文件只保留 Sabaki 的基础项目上下文和架构边界。

Workflow skills 只在用户明确要求时使用；不要因为任务属于 Sabaki 就自动进入 workflow。

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
