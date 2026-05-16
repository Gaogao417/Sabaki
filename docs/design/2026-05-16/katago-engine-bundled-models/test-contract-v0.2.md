# KataGo 引擎适配 — 测试契约 v0.2

> 日期：2026-05-16
> 任务：katago-engine-bundled-models
> 状态：待确认
> 变更：基于用户反馈修订，主要改动见下方 changelog

## v0.1 → v0.2 变更

1. **HumanSL model 分类**：`listBundledModels` 返回 `{kind: 'analysis' | 'humanSL'}`，新增 `selectDefaultAnalysisModel` 和 `getBundledHumanSLModel`，HumanSL 不得被选为默认 analysis model
2. **getKatagoDataPath 独立模块**：新建 `src/modules/katago/katagoBundledAssets.js`，不放 main.js
3. **多 model 本轮不做到 UI**：底层支持多 model，`detectEngines` 默认选第一个合法 analysis model
4. **HumanSL fallback 不下载**：优先级：自定义路径 → 内置 → userData 旧路径 → 报错提示
5. **downloadFile 保留不删**：从默认启动链路移除，标记 legacy，后续确认无用再删
6. **测试粒度调整**：模块放置位置等架构判断从自动化降为人工审查

---

## 背景

### 问题

`detectEngines()` 在 macOS 上无法发现 Homebrew 安装的 KataGo。原因：`findModelFile(path.dirname(binaryPath))` 在 `/opt/homebrew/bin/` 搜索 model，但 Homebrew 的 model 在 `Cellar/katago/VERSION/share/katago/`。

### 方案决策

| 决策项 | 结论 |
|--------|------|
| Model 交付方式 | 打包进 `resources/katago_data/`，随 release 分发 |
| KataGo 二进制 | 用户自行安装，`detectEngines` 保留自动发现能力 |
| 多 model | 底层支持多 model；本轮 UI 不做下拉菜单；`detectEngines` 默认选第一个合法 analysis model |
| HumanSL 模型 | 必须内置，与 analysis model 分类隔离 |
| Config | `gtp.cfg` 随 model 一起打包 |
| getKatagoDataPath | 放独立模块 `src/modules/katago/katagoBundledAssets.js`，main.js 只做 IPC 接线 |
| HumanSL fallback | 自定义路径 → 内置 → userData 旧路径 → 报错，不自动下载 |
| downloadFile | 保留但从默认链路移除，标记 legacy |

### 模块职责

```
src/modules/katago/katagoBundledAssets.js  ← 纯函数，所有路径计算和 model 发现逻辑
src/main.js                                ← IPC handler，调用 katagoBundledAssets，暴露给 renderer
src/preload.js                             ← IPC 桥接 window.sabaki.katago.*
src/modules/enginesyncer.js                ← detectEngines 使用 IPC 获取 bundled 路径
src/modules/engine/engineService.js        ← normalizeEngineConfig 使用 bundled humanSL 路径
```

### 运行时路径

| 环境 | getKatagoDataPath() |
|------|---------------------|
| 开发（`app.isPackaged === false`） | `<project_root>/katago_data/` |
| 生产（`app.isPackaged === true`） | `process.resourcesPath/katago_data/` |

---

## 契约 1：getKatagoDataPath()

> 测试文件：test/katagoBundledModels.test.js → Contract 1

### 1. 用户动作

应用启动时，主进程需要定位 `katago_data/` 目录。

### 2. 状态流

纯函数，无状态变更。

### 3. 允许的副作用

- `existsSync` 只读探测（可选）

### 4. 禁止的副作用

- 不得创建目录、写入文件
- 不得访问 `window`/`document`

### 5. 纯逻辑测试

| 编号 | 输入 | 预期输出 | 描述 |
|------|------|----------|------|
| T1.1a | `{ isPackaged: false, appRoot: '/project' }` | `/project/katago_data` | 开发环境 |
| T1.1b | `{ isPackaged: true, resourcesPath: '/app/Sabaki.app/Contents/Resources' }` | `/app/Sabaki.app/Contents/Resources/katago_data` | 生产环境 |
| T1.1c | 任意 | `path.isAbsolute(result) === true` | 路径始终绝对 |
| T1.1d | 目录不存在 | 仍返回预期路径，不抛错 | 不依赖目录存在 |

### 6-8. 状态/接线/副作用测试

不适用 — 纯函数。

### 9. UI 手动验收

- [ ] 开发模式：`window.sabaki.katago.getDataPath()` 返回以 `katago_data` 结尾的路径
- [ ] 打包构建：路径指向 `Resources/katago_data/`

### 10. 架构契约（人工审查）

- 函数在 `src/modules/katago/katagoBundledAssets.js`，不在 main.js/enginesyncer.js
- 渲染进程通过 IPC 访问，不直接调用 `process.resourcesPath`

### 11. 测试分类

- T1.1a-d: **必须自动化**
- UI 验收: **手动验收**
- 架构契约: **人工审查**（代码审查时确认）

---

## 契约 2：listBundledModels + model 分类

> 测试文件：test/katagoBundledModels.test.js → Contract 2, 2b, 2c

### 1. 用户动作

引擎发现逻辑查询 `katago_data/` 中可用的 model 文件，按类型分类。

### 2. 状态流

- 空 `katago_data/` → `[]`
- 包含模型 → `[{filename, path, size, kind: 'analysis' | 'humanSL'}]`
- HumanSL 模型 → `kind: 'humanSL'`，不被 `selectDefaultAnalysisModel` 选中

### 3. 允许的副作用

- `readdirSync`, `statSync` 只读

### 4. 禁止的副作用

- 不得写入文件系统、触发网络请求

### 5. 纯逻辑测试

| 编号 | 输入 | 预期输出 | 描述 |
|------|------|----------|------|
| T2.1a | 目录含 .bin.gz 和非模型文件 | 只返回模型文件 | 过滤 |
| T2.1b | 目录含 .bin 和 .bin.gz | 两者都返回 | 双扩展名支持 |
| T2.1c | 目录含无关文件 | `[]` | 排除 |
| T2.1d | 空目录 | `[]` | 空结果 |
| T2.1e | ENOENT | `[]` | 静默失败 |
| T2.1f | 模型文件 | `{filename, path, size, kind}` | 字段完整性 |
| T2.1g | `b18c384nbt-humanv0.bin.gz` | `kind: 'humanSL'` | HumanSL 分类 |
| T2.1h | 任意模型 | `path.isAbsolute(result.path)` | 绝对路径 |

### 6. Model 选择测试

| 编号 | 场景 | 预期 |
|------|------|------|
| T2.2a | 混合模型列表（humanSL + analysis） | `selectDefaultAnalysisModel` 返回第一个 analysis |
| T2.2b | 只有 humanSL 模型 | `selectDefaultAnalysisModel` 返回 null |
| T2.2c | 空列表 | `selectDefaultAnalysisModel` 返回 null |
| T2.2d | 混合模型列表 | `getBundledHumanSLModel` 返回 humanSL 模型 |
| T2.2e | 无 humanSL 模型 | `getBundledHumanSLModel` 返回 null |

### 7-8. 接线/副作用测试

不适用 — 纯函数。

### 9. UI 手动验收

- [ ] 引擎偏好设置中列出可用的 analysis model（本轮不做下拉，后续再做）

### 10. 架构契约（人工审查）

- 函数在 `katagoBundledAssets.js` 中
- 通过注入的 `fs` 操作，不直接依赖 Electron

### 11. 测试分类

- T2.1a-h, T2.2a-e: **必须自动化**
- UI 验收: **手动验收**
- 架构: **人工审查**

---

## 契约 3：getBundledConfig()

> 测试文件：test/katagoBundledModels.test.js → Contract 3

### 1. 用户动作

引擎配置逻辑查询 `katago_data/gtp.cfg`。

### 5. 纯逻辑测试

| 编号 | 场景 | 预期 |
|------|------|------|
| T3.1a | config 存在 | `{path: '.../gtp.cfg', available: true}` |
| T3.1b | config 不存在 | `{path: '.../gtp.cfg', available: false}` |
| T3.1c | 任意 | 绝对路径 |

### 11. 测试分类

- T3.1a-c: **必须自动化**

---

## 契约 4：detectEngines() 修改

> 测试文件：test/katagoBundledModels.test.js → Contract 4

### 1. 用户动作

系统扫描已知二进制路径，使用内置 analysis model 和 config 自动配置 KataGo。

### 2. 状态流

```
操作前: findModelFile(path.dirname(binaryPath)) 搜索二进制目录
操作后: model 路径来自 getKatagoDataPath()，通过 IPC 获取
```

### 4. 禁止的副作用

- 不得从渲染进程直接访问 `process.resourcesPath`
- 不得硬编码 model 文件名（必须通过 `listBundledModels` 发现）
- 不得将 HumanSL model 选为 `-model` 参数

### 5. 纯逻辑测试

| 编号 | 场景 | 预期 |
|------|------|------|
| T4.1a | 无二进制 | `[]` |
| T4.1b | 有返回值时字段完整 | `{name, path, args, commands}` |
| T4.1c | name 首字母大写 | `'Katago'` |

### 6. Post-fix 契约测试（实现后会通过）

| 编号 | 验证点 | 预期 |
|------|--------|------|
| T4.2a | katago args 不含 `/opt/homebrew/bin/` | model 指向 katago_data |
| T4.2b | katago args 含 `-config` | config 被包含 |
| T4.2c | `-model` 不含 `human` | analysis model 不是 humanSL |

### 9. UI 手动验收

- [ ] macOS + Homebrew KataGo：引擎偏好设置中 KataGo 出现
- [ ] args 含 `gtp -model "...katago_data/..." -config "...katago_data/gtp.cfg"`
- [ ] `-model` 指向 analysis model，`-human-model` 指向 humanSL model

### 10. 架构契约（人工审查）

- `detectEngines` 不直接引用 `process.resourcesPath`
- model 路径通过 IPC 或注入流入渲染进程

### 11. 测试分类

- T4.1a-c, T4.2a-c: **必须自动化**
- UI 验收: **手动验收**
- 架构: **人工审查**

---

## 契约 5：HumanSL 模型 — 从内置获取

> 测试文件：test/katagoBundledModels.test.js → Contract 5

### 1. 用户动作

启用 HumanSL 功能。系统从 `katago_data/b18c384nbt-humanv0.bin.gz` 读取模型，不下载。

### 2. HumanSL fallback 优先级

```
1. 用户自定义 humanModelPath
2. 内置 katago_data/b18c384nbt-humanv0.bin.gz
3. userData 旧路径 models/b18c384nbt-humanv0.bin.gz（兼容）
4. 都没有 → 报错/提示，不自动下载
```

### 4. 禁止的副作用

- 内置模型存在时不得从网络下载
- 不得在 `katago_data/` 中创建文件

### 5. 纯逻辑测试

| 编号 | 场景 | 预期 |
|------|------|------|
| T5.1a | `enableHumanSL: true`，无自定义路径 | args 含 `-human-model` 指向 katago_data |
| T5.1b | `enableHumanSL: true`，有自定义路径 | args 含 `-human-model` 指向自定义路径 |
| T5.1c | `enableHumanSL: false` | args 不含 `-human-model` |
| T5.1d | 完整 args 组装 | `-model` 是 analysis，`-human-model` 是 humanSL，两者不同 |
| T5.1e | 检查 humanSL model 文件存在 | katago_data 中应有 `b18c384nbt-humanv0.bin.gz` |

### 11. 测试分类

- T5.1a-d: **必须自动化**
- T5.1e: **必须自动化**（契约测试，文件缺失时 FAIL 以提醒补充）
- UI 验收: **手动验收**

---

## 契约 6：打包配置 — extraResources

> 测试文件：test/katagoBundledModels.test.js → Contract 6

### 5. 纯逻辑测试

| 编号 | 验证点 |
|------|--------|
| T6.1a | `build.extraResources` 包含 `{from: 'katago_data', to: 'katago_data'}` |
| T6.1b | `files` 不排除 `.bin.gz` |

### 9. UI 手动验收

- [ ] 以 `package.json` 实际打包脚本为准（如 `npm run dist:macos`），检查 `Resources/katago_data/` 包含 `gtp.cfg` 和 `.bin.gz`
- [ ] `.bin.gz` 文件大小与源文件一致

### 11. 测试分类

- T6.1a-b: **必须自动化**
- UI 验收: **手动验收**

---

## 测试分类汇总

| 契约 | 自动化 | 手动验收 | 人工审查 |
|------|--------|---------|---------|
| 1. getKatagoDataPath | T1.1a-d | UI x2 | 模块位置、IPC 隔离 |
| 2. listBundledModels | T2.1a-h, T2.2a-e | UI x1 | 模块位置 |
| 3. getBundledConfig | T3.1a-c | — | — |
| 4. detectEngines | T4.1a-c, T4.2a-c | UI x3 | resourcesPath 隔离 |
| 5. HumanSL | T5.1a-e | UI x1 | downloadFile 状态 |
| 6. 打包配置 | T6.1a-b | UI x2 | — |

---

## 人工审查清单

实施前需确认：

- [ ] `src/modules/katago/katagoBundledAssets.js` 已创建
- [ ] main.js 只做 IPC 接线，不含业务逻辑
- [ ] `downloadFile` 和 `humanSLModelUrl` 保留但从默认启动链路移除
- [ ] `engineSearchPaths` 未被修改
- [ ] `katago_data/b18c384nbt-humanv0.bin.gz` 已添加
