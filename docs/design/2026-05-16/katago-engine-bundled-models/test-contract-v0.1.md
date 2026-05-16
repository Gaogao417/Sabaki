# KataGo 引擎适配 — 测试契约 v0.1

> 日期：2026-05-16
> 任务：katago-engine-bundled-models
> 状态：待确认

## 背景

### 问题

`detectEngines()` 在 macOS 上无法发现 Homebrew 安装的 KataGo。原因：`findModelFile(path.dirname(binaryPath))` 在 `/opt/homebrew/bin/` 搜索 model，但 Homebrew 的 model 在 `Cellar/katago/VERSION/share/katago/`。

### 方案决策

| 决策项 | 结论 |
|--------|------|
| Model 交付方式 | 打包进 `resources/katago_data/`，随 release 分发 |
| KataGo 二进制 | 用户自行安装，`detectEngines` 保留自动发现能力 |
| 多 model | `katago_data/` 下可有多个 `.bin.gz`，用户可选 |
| HumanSL 模型 | 必须内置（`b18c384nbt-humanv0.bin.gz`），否则 human prior 功能不可用 |
| Config | `gtp.cfg` 随 model 一起打包 |

### 当前 katago_data 内容

```
katago_data/
  gtp.cfg                                        (18KB)
  kata1-b18c384nbt-s9996604416-d4316597426.bin.gz  (93MB, analysis model)
```

还需要加入：`b18c384nbt-humanv0.bin.gz`（HumanSL model）

### 运行时路径

| 环境 | getKatagoDataPath() |
|------|---------------------|
| 开发（`app.isPackaged === false`） | `<project_root>/katago_data/` |
| 生产（`app.isPackaged === true`） | `process.resourcesPath/katago_data/` |

---

## 契约 1：getKatagoDataPath()

### 1. 用户动作

应用启动时，主进程需要定位 `katago_data/` 目录。开发和生产环境路径不同。

### 2. 状态流

纯函数，无状态变更。

### 3. 允许的副作用

- `existsSync` 只读探测（可选）
- 日志输出

### 4. 禁止的副作用

- 不得创建目录
- 不得写入文件系统
- 不得访问 `window` 或 `document`

### 5. 纯逻辑测试

| 编号 | 输入 | 预期输出 | 描述 |
|------|------|----------|------|
| T1.1a | `{ isPackaged: false, resourcesPath: '/fake/resources', cwd: '/project' }` | `/project/katago_data` | 开发环境 |
| T1.1b | `{ isPackaged: true, resourcesPath: '/app/Sabaki.app/Contents/Resources' }` | `/app/Sabaki.app/Contents/Resources/katago_data` | 生产环境 |
| T1.1c | 任意输入 | `path.isAbsolute(result) === true` | 路径始终是绝对路径 |
| T1.1d | 目录不存在 | 仍返回预期路径，不抛错 | 路径计算不依赖目录存在 |

### 6. 状态测试

不适用 — 纯函数。

### 7. 接线测试

| 编号 | 描述 | 验证点 |
|------|------|--------|
| T1.2a | IPC handler `katago:getDataPath` 存在 | `ipcMain.handle` 注册了该 channel |
| T1.2b | preload 暴露 `katago.getDataPath()` | `window.sabaki.katago.getDataPath()` 通过 IPC 返回字符串 |

### 8. 副作用测试

不适用 — 仅 `existsSync`（只读）。

### 9. UI 手动验收

- [ ] 开发模式：开发者控制台执行 `window.sabaki.katago.getDataPath()` 返回以 `katago_data` 结尾的路径
- [ ] 打包构建：路径指向 `Resources/katago_data/`

### 10. 架构契约测试

| 编号 | 契约 | 验证方式 |
|------|------|----------|
| T1.3a | 函数定义在主进程模块（main.js 或独立模块），不在 enginesyncer.js 或组件中 | 代码审查 |
| T1.3b | 渲染进程通过 IPC 访问路径，不直接调用 `process.resourcesPath` | 静态分析 |

### 11. 测试分类

- T1.1a-d, T1.2a-b, T1.3a-b: **必须自动化**
- UI 手动验收: **手动验收**

---

## 契约 2：listBundledModels()

### 1. 用户动作

应用或引擎发现逻辑查询 `katago_data/` 中可用的 `.bin.gz` 模型文件。

### 2. 状态流

- 空 `katago_data/` → 返回 `[]`
- 包含模型 → 返回 `[{filename, path, size}]`
- 包含非模型文件 → 排除

### 3. 允许的副作用

- `readdirSync` 读取目录
- `statSync` 获取文件大小

### 4. 禁止的副作用

- 不得写入文件系统
- 不得修改应用状态
- 不得触发网络请求

### 5. 纯逻辑测试

| 编号 | 输入 | 预期输出 | 描述 |
|------|------|----------|------|
| T2.1a | `['gtp.cfg', 'model-a.bin.gz', 'model-b.bin.gz', 'readme.txt']` | `['model-a.bin.gz', 'model-b.bin.gz']` | 过滤 .bin.gz |
| T2.1b | `['model.bin', 'model.bin.gz']` | `['model.bin', 'model.bin.gz']` | 同时支持 .bin 和 .bin.gz |
| T2.1c | `['gtp.cfg', 'notes.md', '.DS_Store']` | `[]` | 排除无关文件 |
| T2.1d | `[]` | `[]` | 空目录 |
| T2.1e | `readdirSync` 抛出 ENOENT | `[]` | 目录不存在时静默返回空 |

### 6. 状态测试

| 编号 | 验证点 |
|------|--------|
| T2.2a | 每个条目包含 `{filename: string, path: string, size: number}` |
| T2.2b | `path` 是绝对路径，等于 `getKatagoDataPath() + filename` |

### 7. 接线测试

| 编号 | 描述 | 验证点 |
|------|------|--------|
| T2.3a | IPC handler `katago:listBundledModels` 返回模型数组 | 响应结构正确 |
| T2.3b | preload 暴露 `katago.listBundledModels()` | 返回数组 |

### 8. 副作用测试

不适用 — 仅文件系统读取。

### 9. UI 手动验收

- [ ] 引擎偏好设置中，model 下拉菜单列出 `katago_data/` 中所有 `.bin.gz` 文件

### 10. 架构契约测试

| 编号 | 契约 |
|------|------|
| T2.4a | 函数在主进程模块中，不在 enginesyncer.js 中 |
| T2.4b | 通过注入的 `fs` 操作，不直接依赖 Electron |

### 11. 测试分类

- T2.1a-e, T2.2a-b, T2.3a-b, T2.4a-b: **必须自动化**
- UI 手动验收: **手动验收**

---

## 契约 3：getBundledConfig()

### 1. 用户动作

引擎配置逻辑查询 `katago_data/gtp.cfg`。

### 2. 状态流

- `gtp.cfg` 存在 → `{path: '.../gtp.cfg', available: true}`
- `gtp.cfg` 不存在 → `{path: '.../gtp.cfg', available: false}`

### 3. 允许的副作用

- `existsSync` 只读检查

### 4. 禁止的副作用

- 不得创建默认配置文件
- 不得写入文件系统

### 5. 纯逻辑测试

| 编号 | 输入 | 预期输出 | 描述 |
|------|------|----------|------|
| T3.1a | `getKatagoDataPath() = '/data'`, `existsSync('/data/gtp.cfg') = true` | `{path: '/data/gtp.cfg', available: true}` | 文件存在 |
| T3.1b | `existsSync` 返回 false | `{path: '/data/gtp.cfg', available: false}` | 文件不存在 |
| T3.1c | 任意输入 | `path.isAbsolute(result.path) === true` | 路径始终绝对 |

### 6. 状态测试

不适用 — 纯函数。

### 7. 接线测试

| 编号 | 描述 |
|------|------|
| T3.2a | IPC handler `katago:getBundledConfig` 返回 `{path, available}` 结构 |
| T3.2b | preload 暴露 `katago.getBundledConfig()` |

### 8. 副作用测试

不适用。

### 9. UI 手动验收

- [ ] 引擎偏好设置显示 config 文件路径
- [ ] config 缺失时显示警告

### 10. 架构契约测试

| 编号 | 契约 |
|------|------|
| T3.3a | 与 getKatagoDataPath / listBundledModels 位于同一主进程模块 |

### 11. 测试分类

- T3.1a-c, T3.2a-b, T3.3a: **必须自动化**
- UI 手动验收: **手动验收**

---

## 契约 4：detectEngines() 修改

### 1. 用户动作

用户首次打开引擎设置或点击"检测引擎"。系统扫描已知的二进制路径，使用内置 model 和 config 自动配置 KataGo。

### 2. 状态流

```
操作前: engines.list 为空或手动配置
操作后: engines.list 包含发现的引擎，args 指向内置 model 和 config
```

关键变更：`findModelFile(path.dirname(binaryPath))` → 使用 `getKatagoDataPath()` 定位内置 model。

### 3. 允许的副作用

- 读取文件系统（`existsSync`）
- 返回发现的引擎数组

### 4. 禁止的副作用

- 不得从渲染进程直接访问 `process.resourcesPath`
- 不得硬编码 model 文件名（必须通过 `listBundledModels()` 发现）
- 不得再调用 `findModelFile(path.dirname(binaryPath))` 搜索 KataGo model

### 5. 纯逻辑测试

| 编号 | 场景 | 预期输出 | 描述 |
|------|------|----------|------|
| T4.1a | 二进制 `/opt/homebrew/bin/katago` 存在，内置 model 1 个，config 存在 | `[{name:'Katago', path:'/opt/homebrew/bin/katago', args:'gtp -model ".../model.bin.gz" -config ".../gtp.cfg"'}]` | 核心修复场景 |
| T4.1b | 二进制存在，内置 model 为空 | `[]` | 无 model 则跳过 |
| T4.1c | 二进制存在，config 不存在 | args 不包含 `-config` | config 可选 |
| T4.1d | LeelaZero 二进制存在 | `[{name:'Leelaz', args:'gtp -w /dev/null'}]` | LeelaZero 不受影响 |
| T4.1e | 两个路径都有 katago | 只返回第一个（搜索顺序优先） | 不重复发现 |
| T4.1f | 所有平台（darwin/linux/win32）无二进制 | `[]` | 未安装 |
| T4.1g | 多个内置 model | args 使用第一个 model | 默认选第一个 |

### 6. 状态测试

| 编号 | 验证点 |
|------|--------|
| T4.2a | 返回值是数组，元素有 `{name, path, args, commands}` |
| T4.2b | `path` 是搜索路径中的原始路径（不是 realpath） |
| T4.2c | `args` 中 model 路径指向 `katago_data/`，不指向二进制目录 |
| T4.2d | `name` 首字母大写：`'Katago'` |

### 7. 接线测试

| 编号 | 描述 | 验证点 |
|------|------|--------|
| T4.3a | detectEngines 返回的 engine 对象被 EngineSyncer 构造函数正确消费 | `resolveEngineExecutable` 和 `parseEngineArgs` 可处理 |
| T4.3b | args 中 model 路径含空格时引号正确 | 双引号包裹 |

### 8. 副作用测试

| 编号 | 验证点 |
|------|--------|
| T4.4a | 不写入文件系统 |
| T4.4b | 不生成子进程 |

### 9. UI 手动验收

- [ ] macOS 上安装了 Homebrew KataGo 时，打开引擎偏好设置，KataGo 出现在列表中
- [ ] args 包含 `gtp -model "...katago_data/..." -config "...katago_data/gtp.cfg"`
- [ ] model 路径指向 `katago_data/` 而非 `/opt/homebrew/bin/`

### 10. 架构契约测试

| 编号 | 契约 |
|------|------|
| T4.5a | `detectEngines` 不直接引用 `process.resourcesPath` |
| T4.5b | `detectEngines` 仍为 `enginesyncer.js` 的导出函数 |
| T4.5c | model 路径数据通过 IPC 或注入依赖流入，渲染进程不计算 resourcesPath |
| T4.5d | `findModelFile(binaryDir)` 不再为 KataGo 调用 |

### 11. 测试分类

- T4.1a-g, T4.2a-d, T4.3a-b, T4.4a-b, T4.5a-d: **必须自动化**
- T4.3a: ⚠️ 脆弱 — 依赖 `EngineSyncer` 构造函数签名
- UI 手动验收: **手动验收**

---

## 契约 5：HumanSL 模型 — 从内置获取

### 1. 用户动作

用户启用 HumanSL 功能。系统需要 HumanSL 模型，从 `katago_data/b18c384nbt-humanv0.bin.gz` 读取，不再从 GitHub 下载。

### 2. 状态流

```
旧版: humanModelPath = join(userData, 'models', 'b18c384nbt-humanv0.bin.gz')
      ensureHumanSLModel() → 从 GitHub 下载到 userData

新版: humanModelPath = join(getKatagoDataPath(), 'b18c384nbt-humanv0.bin.gz')
      ensureHumanSLModel() → 检查内置 → 回退 userData → 不下载
```

### 3. 允许的副作用

- `existsSync` 检查模型文件
- IPC 响应返回模型信息

### 4. 禁止的副作用

- 内置模型存在时不得从网络下载
- 不得在 `katago_data/` 中创建文件（只读资源）

### 5. 纯逻辑测试

| 编号 | 输入 | 预期输出 | 描述 |
|------|------|----------|------|
| T5.1a | `enableHumanSL: true`, 内置 HumanSL model 存在 | args 包含 `-human-model ".../katago_data/b18c384nbt-humanv0.bin.gz"` | 使用内置模型 |
| T5.1b | `enableHumanSL: true`, `humanModelPath: '/custom/model.bin.gz'` | args 包含 `-human-model "/custom/model.bin.gz"` | 自定义路径优先 |
| T5.1c | `enableHumanSL: false` | args 不包含 `-human-model` | 未启用不添加 |

### 6. 状态测试

| 编号 | 场景 | 预期 |
|------|------|------|
| T5.2a | `humansl:ensureModel`, 内置 model 存在 | `{available: true, downloaded: false}` — 无网络请求 |
| T5.2b | 内置 model 不存在，userData 有 | `{available: true, path: '<userData>/models/...'}` — 回退 |
| T5.2c | 两者都没有 | `{available: false, error: '...'}` — 不自动下载 |

### 7. 接线测试

| 编号 | 描述 |
|------|------|
| T5.3a | `normalizeEngineConfig` 通过 deps 获取 `getKatagoDataPath` |
| T5.3b | `EngineSyncer.start()` 用预填充的 `humanModelPath`，不调用 `window.sabaki.humansl.ensureModel()` |

### 8. 副作用测试

| 编号 | 验证点 |
|------|--------|
| T5.4a | 内置 HumanSL model 存在时，`https.get` 未被调用 |
| T5.4b | 不创建 `.download` 临时文件 |

### 9. UI 手动验收

- [ ] 启用 HumanSL 后启动分析，HumanSL 数据出现（human ranking、human prior）
- [ ] 控制台日志中不显示下载进度
- [ ] `-human-model` 指向 `katago_data/` 路径

### 10. 架构契约测试

| 编号 | 契约 |
|------|------|
| T5.5a | HumanSL model 路径通过 IPC 传递，渲染进程不计算 |
| T5.5b | `EngineSyncer.start()` 不在渲染进程中调用 `ensureModel`（旧代码 `window.sabaki.humansl.ensureModel()` 应被移除） |
| T5.5c | `humanSLModelUrl` 和 `downloadFile` 可保留但不再为内置模型调用 |

### 11. 测试分类

- T5.1a-c, T5.2a-c, T5.3a-b, T5.4a-b, T5.5a-c: **必须自动化**
- UI 手动验收: **手动验收**

---

## 契约 6：打包配置 — extraResources

### 1. 用户动作

开发者运行 `npm run dist:macos`（或 linux/win），构建产物包含 `katago_data/` 作为额外资源。

### 2. 状态流

```
旧版: package.json build 部分无 extraResources
新版: build.extraResources 包含 {from: 'katago_data', to: 'katago_data'}
```

### 3. 允许的副作用

- 构建过程将 `katago_data/` 复制到 `Resources/katago_data/`

### 4. 禁止的副作用

- 不得排除 `.bin.gz` 文件
- `gtp.cfg` 必须包含在输出中

### 5. 纯逻辑测试

| 编号 | 验证点 | 预期 |
|------|--------|------|
| T6.1a | `package.json` 中 `build.extraResources` 包含 `{from: 'katago_data', to: 'katago_data'}` | 结构正确 |
| T6.1b | `files` 数组不排除 `*.bin.gz` | 无排除模式 |
| T6.1c | `extraResources` 条目中 `from`/`to` 均为字符串 | 类型正确 |

### 6. 状态测试

不适用 — 静态配置验证。

### 7. 接线测试

| 编号 | 描述 |
|------|------|
| T6.2a | `extraResources.from` 与 `getKatagoDataPath()` 开发路径一致 |
| T6.2b | `extraResources.to` 与 `getKatagoDataPath()` 生产路径的子目录名匹配 |

### 8. 副作用测试

不适用 — 配置验证。

### 9. UI 手动验收

- [ ] `npm run build` 后检查 `dist/` 输出，`Resources/katago_data/` 包含 `gtp.cfg` 和 `.bin.gz`
- [ ] `.bin.gz` 文件大小与源文件一致（未截断）

### 10. 架构契约测试

| 编号 | 契约 |
|------|------|
| T6.3a | `extraResources.to` 与运行时 `getKatagoDataPath()` 的路径段一致 |
| T6.3b | `files` 数组不重复包含 `katago_data/` |

### 11. 测试分类

- T6.1a-c, T6.2a-b, T6.3a-b: **必须自动化**
- UI 手动验收: **手动验收**（必须检查真实构建产物）

---

## 测试分类汇总

| 契约 | 自动化 | 手动验收 | 暂不测试 | 脆弱度 |
|------|--------|---------|---------|--------|
| 1. getKatagoDataPath | T1.1a-d, T1.2a-b, T1.3a-b | UI 验收 x2 | — | 低 |
| 2. listBundledModels | T2.1a-e, T2.2a-b, T2.3a-b, T2.4a-b | UI 验收 x1 | — | 低 |
| 3. getBundledConfig | T3.1a-c, T3.2a-b, T3.3a | UI 验收 x2 | — | 低 |
| 4. detectEngines 修改 | T4.1a-g, T4.2a-d, T4.3a-b, T4.4a-b, T4.5a-d | UI 验收 x3 | — | 中（T4.3a） |
| 5. HumanSL 模型 | T5.1a-c, T5.2a-c, T5.3a-b, T5.4a-b, T5.5a-c | UI 验收 x3 | — | 中 |
| 6. 打包配置 | T6.1a-c, T6.2a-b, T6.3a-b | UI 验收 x2 | — | 低 |

---

## 人工审查清单

确认测试契约前，请回复以下决策：

1. **getKatagoDataPath 放哪？** main.js（已有类似路径逻辑）vs 新建 `src/modules/katagoPaths.js`
2. **多 model 选择 UI？** 立刻做下拉菜单 vs 先用第一个 model 后续再做
3. **HumanSL fallback？** 内置没有时回退下载 vs 直接报错
4. **下载代码？** 保留 `downloadFile` 和 GitHub URL vs 删掉
