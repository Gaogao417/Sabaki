# Design Doc: Unified Settings Management Hub

## 1. Objective

Refactor Sabaki's settings and management surfaces into one unified,
sidebar-driven management window that matches the provided mockup:

- A macOS-style workbench panel with a fixed left sidebar.
- A wide right content area with a page title, task-specific controls,
  data/details panes, and a bottom action bar.
- Settings, engine management, FoxWQ import, 101 Weiqi sync, and game history
  should feel like sections of the same product surface, not separate drawers or
  dialogs.

This replaces the current scattered drawer model with a single predictable place
for configuration and management.

## 2. Target Interaction Model

### Current State

- Settings live in `PreferencesDrawer` (`preferences`).
- Engine management lives in `EngineManagementDrawer` (`enginemanagement`).
- Game history/choosing lives in `GameChooserDrawer` (`gamechooser`).
- New game setup lives in `NewGameDialog` (`newgame`).
- These surfaces are opened through `DrawerManager.js` and behave like separate
  overlays.

### Proposed State

- Introduce a unified **Management Hub** for persistent management tasks.
- The Hub opens as one large workbench-style panel instead of multiple unrelated
  drawers.
- Sidebar navigation switches content panes without closing the Hub.
- Existing settings are split into clear top-level categories rather than nested
  preference tabs.
- `NewGameDialog` can stay as a transient dialog for quick game creation, but
  reusable configuration should move into the Hub.

## 3. Visual Reference

The mockup style should be treated as the source of truth:

- Window shell: light, quiet macOS-style panel with subtle border and shadow.
- Sidebar: fixed width, light gray background, icon plus label navigation,
  active row highlighted in blue.
- Content area: white or near-white background, page title at top, functional
  panels below.
- Panels: thin borders, 8px radius, minimal shadow, dense but readable spacing.
- Primary actions: blue filled buttons with icons.
- Secondary actions: neutral outlined buttons with icons.
- Typography: compact, workbench-like, no oversized marketing headings.

Avoid treating this as a generic glassmorphism redesign. The screenshot is
primarily a structured settings/workbench layout with restrained visual polish.

## 4. Information Architecture

The left sidebar should contain these sections:

1. **General / 通用**
   - Application behavior, language, startup, file handling, notifications,
     autosave.
   - Migrated from `PreferencesDrawer` `GeneralTab`.

2. **Board / 棋盘**
   - Board theme, stones, coordinates, grid, move display, variation display.
   - Migrated from `PreferencesDrawer` `ThemesTab` plus board-related
     preferences.

3. **Engine / 引擎**
   - GTP engine list, engine configuration, analysis defaults, engine
     health/status.
   - Migrated from `EngineManagementDrawer`.

4. **Fox Games / 野狐对局**
   - FoxWQ UID search, public game list, selected game details, board preview,
     SGF import.
   - New feature described by `docs/design/fox_game_import_ui_ux.md` and
     `docs/product/fox_game_import_prd.md`.

5. **101 Weiqi / 101围棋**
   - Account connection, login status, wrong-problem-book sync, local cache
     settings.
   - New feature described by `docs/product/101weiqi_error_sync_prd.md`.

6. **History / 历史记录**
   - Recent games, saved sessions, local file history, search/filter.
   - Migrated from `GameChooserDrawer`.

7. **Settings / 设置** bottom item
   - Advanced preferences, reset/import/export settings, about/version metadata.
   - This item stays pinned to the bottom of the sidebar, matching the mockup.

## 5. Layout Specification

### 5.1 Shell

- Component: `src/components/ManagementHub.js`
- Opens from existing settings/history/engine entry points.
- Width should support the mockup's two-column management pages.
- Recommended desktop size: approximately 80-88vw wide and 80-88vh tall, capped
  by sensible max dimensions.
- The Hub should not block internal tab switching, but it can remain modal
  relative to the board while open.

### 5.2 Sidebar

- Component: `src/components/ManagementHubSidebar.js`
- Fixed width, approximately 160-180px.
- Top area contains primary sections.
- Bottom area contains the pinned Settings item.
- Each item uses an icon and a Chinese label. English identifiers remain in
  code.
- Active item uses a blue-tinted background and blue icon/text.
- Inactive items use neutral text and gray icons.

Recommended icons:

- General: home/settings-sliders icon.
- Board: grid/board icon.
- Engine: chip/cpu icon.
- Fox Games: fox icon if available; otherwise a simple custom icon or existing
  asset.
- 101 Weiqi: book/checklist/cloud-sync icon.
- History: clock icon.
- Settings: gear icon.

### 5.3 Content Header

Each content pane starts with:

- Large but compact page title, e.g. `野狐历史对局导入`.
- One-line subtitle explaining the task.
- No instructional paragraphs inside the app UI unless required for error/empty
  states.

### 5.4 Content Body

Use the mockup's structure as a reusable page template:

- **Top configuration panel**
  - Contains form controls relevant to the section.
  - Uses horizontal grouping on desktop.
  - Primary action sits on the right where appropriate.

- **Main work area**
  - For data-heavy pages: left table/list plus right details panel.
  - For settings pages: grouped settings sections in bordered panels.
  - For engine/history pages: table/list selection with detail/editor panel when
    useful.

- **Bottom action bar**
  - Sticky within the Hub shell.
  - Right-align primary actions.
  - Keep destructive actions secondary or separated.

## 6. Pane Requirements

Design principles for all panes:

- **Bordered panels** (`hub-panel`) group related controls; panels stack
  vertically with 20px gap.
- **Checkbox grids** use
  `display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px;` to pack
  toggles two-per-row.
- **Form rows** use `display: flex; align-items: center; gap: 8px;` with label
  on the left, control on the right, and
  `label { width: 10em; text-align: right; flex-shrink: 0; }`.
- **Path inputs** follow the old `PathInputItem` pattern: text input + folder
  browse button + invalid indicator, all inline.
- **Cards** (engine pane only) use `engine-modal-card` pattern: 18px padding,
  16px border-radius, 1px border, optional card title row with
  `display: flex; justify-content: space-between; align-items: center;`.
- Bottom action bar is sticky at the bottom of `hub-body`, not part of the
  scrollable content.

### 6.1 GeneralSettingsPane

Migrates all items from `PreferencesDrawer` `GeneralTab`. Settings are grouped
into compact bordered panels with 2-column checkbox grids. Single-column layout,
no split pane needed.

```
┌─────────────────────────────────────────────────────────────────┐
│ 通用设置                                                        │
│ 管理应用程序的基本行为和首选项                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ 应用程序 ─────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  ☑ 启动时检查更新              ☑ 启用硬件加速              │  │
│ │  ☑ 启用声音                                                 │  │
│ │                                                           │  │
│ │  界面语言  [简体中文 (100%) ▾]      棋谱树样式  [紧凑 ▾]    │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 文件与导航 ───────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  ☑ 载入文件后跳转至末尾          ☑ 点击最后一手移除         │  │
│ │  ☑ 文件被外部修改时提示重新载入                              │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 显示 ─────────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  ☑ 显示自动落子标题              ☑ 反转胜率图              │  │
│ │  ☑ 启用不规则棋子排列            ☑ 启用棋子落子动画        │  │
│ │                                                           │  │
│ │  变化重演模式  [逐手播放 ▾]                                 │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 警告提示 ─────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  ☑ 显示劫争警告                  ☑ 显示自杀着手警告        │  │
│ │  ☑ 显示删除节点警告              ☑ 显示删除其他变化图警告  │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Setting keys mapped to UI elements:

| UI label                     | Setting key                               | Control type                             |
| ---------------------------- | ----------------------------------------- | ---------------------------------------- |
| 启动时检查更新               | `app.startup_check_updates`               | checkbox                                 |
| 启用硬件加速                 | `app.enable_hardware_acceleration`        | checkbox                                 |
| 启用声音                     | `sound.enable`                            | checkbox                                 |
| 界面语言                     | `app.lang`                                | select (from `i18n.getLanguages()`)      |
| 棋谱树样式                   | `graph.grid_size` + `graph.node_size`     | select (compact/spacious/big)            |
| 载入文件后跳转至末尾         | `game.goto_end_after_loading`             | checkbox                                 |
| 点击最后一手移除             | `edit.click_currentvertex_to_remove`      | checkbox                                 |
| 文件被外部修改时提示重新载入 | `file.show_reload_warning`                | checkbox                                 |
| 显示自动落子标题             | `comments.show_move_interpretation`       | checkbox                                 |
| 反转胜率图                   | `view.winrategraph_invert`                | checkbox                                 |
| 启用不规则棋子排列           | `view.fuzzy_stone_placement`              | checkbox                                 |
| 启用棋子落子动画             | `view.animated_stone_placement`           | checkbox                                 |
| 变化重演模式                 | `board.variation_replay_mode`             | select (disabled/move_by_move/instantly) |
| 显示劫争警告                 | `game.show_ko_warning`                    | checkbox                                 |
| 显示自杀着手警告             | `game.show_suicide_warning`               | checkbox                                 |
| 显示删除节点警告             | `edit.show_removenode_warning`            | checkbox                                 |
| 显示删除其他变化图警告       | `edit.show_removeothervariations_warning` | checkbox                                 |

### 6.2 BoardSettingsPane

Merges `PreferencesDrawer` `ThemesTab` + board-related view settings. This pane
has three distinct panels stacked vertically. Theme custom images use the same
2-column path-input grid as the old `ThemesTab`.

```
┌─────────────────────────────────────────────────────────────────┐
│ 棋盘设置                                                        │
│ 自定义棋盘外观、棋子样式和显示首选项                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ 主题 ─────────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  当前主题  [默认 ▾]  [卸载]  [安装主题…]                    │  │
│ │            by Author — Homepage   v1.0.0                   │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 自定义图片 ───────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  黑子图片  [________________________] [📂]                  │  │
│ │  白子图片  [________________________] [📂]                  │  │
│ │  棋盘图片  [________________________] [📂]                  │  │
│ │  背景图片  [________________________] [📂]                  │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 棋子与显示 ───────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  ☑ 显示落子序号                  ☑ 突出显示当前落子        │  │
│ │  ☑ 显示下一手                    ☑ 显示兄弟变化图          │  │
│ │  ☑ 显示热力图                                               │  │
│ │                                                           │  │
│ │  分析类型  [胜率 ▾]                                         │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 坐标系 ───────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  ☑ 显示坐标                                                  │  │
│ │  坐标类型  [A1 (默认) ▾]                                    │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Setting keys:

| UI label         | Setting key                   | Control type                        |
| ---------------- | ----------------------------- | ----------------------------------- |
| 当前主题         | `theme.current`               | select (from `setting.getThemes()`) |
| 卸载             | action                        | button (rimraf theme dir)           |
| 安装主题         | action                        | button (showOpenDialog .asar)       |
| 黑子图片         | `theme.custom_blackstones`    | path input + browse                 |
| 白子图片         | `theme.custom_whitestones`    | path input + browse                 |
| 棋盘图片         | `theme.custom_board`          | path input + browse                 |
| 背景图片         | `theme.custom_background`     | path input + browse                 |
| 显示落子序号     | `view.show_move_numbers`      | checkbox                            |
| 突出显示当前落子 | `view.show_move_colorization` | checkbox                            |
| 显示下一手       | `view.show_next_moves`        | checkbox                            |
| 显示兄弟变化图   | `view.show_siblings`          | checkbox                            |
| 显示热力图       | `board.show_analysis`         | checkbox                            |
| 分析类型         | `board.analysis_type`         | select (winrate/scoreLead)          |
| 显示坐标         | `view.show_coordinates`       | checkbox                            |
| 坐标类型         | `view.coordinates_type`       | select (A1/1-1/relative)            |

Custom image rows use the `PathInputItem` pattern from the old ThemesTab: label
(right-aligned, `width: 10em`) + text input (`flex: 1`) + folder browse icon
button + optional invalid-warning icon. Four rows stack vertically inside the
panel.

### 6.3 EngineManagementPane

This is the most complex pane. It uses a **split layout** like the old
`EngineManagementDrawer` but with a left engine list instead of just one global
engine. The right side uses the same **card-based grid layout** as
`EngineManagementDrawer` — each logical group is a bordered card containing a
CSS grid of form fields.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 引擎管理                                                                          │
│ 配置 GTP 引擎，设置分析默认值和引擎状态                                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ 引擎列表 ──────────┐  ┌─ 基础信息 ────────────────────────────────────────┐  │
│  │ ☑ KataGo 1.14      │  │                                               │  │
│  │   katago  ● 已就绪  │  │  引擎名称  [KataGo 1.14_____________]          │  │
│  │                     │  │  引擎类型  [KataGo ▾]                          │  │
│  │ ☐ Leela Zero       │  │  引擎路径  [C:\Games\katago.exe_____] [选择]   │  │
│  │   generic  ○ 未连接 │  │  启动参数  [gtp -config default_gtp.cfg____]  │  │
│  │                     │  │  初始命令  [________________________________]  │  │
│  │                     │  │                                               │  │
│  │                     │  └───────────────────────────────────────────────┘  │
│  │                     │                                                      │
│  │                     │  ┌─ KataGo 模型 ──────────────────────────────────┐  │
│  │                     │  │                                               │  │
│  │                     │  │  模型文件  [b18c384.bin.gz__________] [选择]   │  │
│  │                     │  │  配置文件  [default_gtp.cfg________] [选择]   │  │
│  │                     │  │                                               │  │
│  │                     │  └───────────────────────────────────────────────┘  │
│  │                     │                                                      │
│  │                     │  ┌─ 分析参数 ────────────────────────────────────┐  │
│  │                     │  │                                               │  │
│  │                     │  │  visits    [800 ]  playouts  [0   ]           │  │
│  │                     │  │  思考时间  [15  ]  候选点数量 [5   ]           │  │
│  │                     │  │  温度      [1   ]                              │  │
│  │                     │  │                                               │  │
│  │                     │  └───────────────────────────────────────────────┘  │
│  │                     │                                                      │
│  │                     │  ┌─ HumanSL / 人类视角 ────────────── ☑ 启用 ──┐  │
│  │                     │  │                                             │  │
│  │                     │  │  Human model  [model.bin.gz______] [选择]   │  │
│  │                     │  │  Profile      [rank_1d ▾]                   │  │
│  │                     │  │  Explore      [Light ▾]                     │  │
│  │                     │  │  ☑ 默认显示 AI 推荐点                       │  │
│  │                     │  │  ☑ 默认显示人类偏好点                       │  │
│  │                     │  │  Human model: 已加载                         │  │
│  │                     │  │                                             │  │
│  │                     │  │  ℹ 人类偏好表示更可能被该水平人类想到，       │  │
│  │                     │  │     不代表这手棋更好。                       │  │
│  │                     │  └─────────────────────────────────────────────┘  │
│  │                     │                                                      │
│  └─────────────────────┘                                                      │
│  │ [+ 添加引擎…]       │                                                      │
│  └─────────────────────┘                                                      │
│                                                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│                        [测试引擎]              [保存所有更改]                    │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Layout structure:

- **Left column** (`hub-table-container`, ~240px fixed): scrollable engine list
  table with columns [☑ 名称, 类型, 状态]. Footer has "添加引擎…" button.
- **Right column** (`hub-preview-pane`, `flex: 1`): vertical stack of cards,
  scrollable independently.
  - Card borders and spacing match `engine-modal-card`:
    `padding: 18px; border-radius: 16px; border: 1px solid var(--ui-border); gap: 14px`.
  - Fields inside each card use `engine-modal-grid`:
    `grid-template-columns: repeat(2, 1fr); gap: 14px 18px`. Wide fields (args,
    commands) span full width with `grid-column: 1 / -1`.
  - Path fields use `engine-modal-field--path`: inline text input + browse
    button, `grid-template-columns: 1fr auto`.
  - Analysis grid uses `engine-analysis-grid`:
    `grid-template-columns: repeat(5, minmax(80px, 1fr)); gap: 8px`.
  - HumanSL card title row has the enable toggle on the right, same as old
    `engine-modal-card__title`.
  - HumanSL card internal grid uses `engine-modal-grid--human` multi-column
    layout.
  - Conditional rendering: KataGo card and analysis card only shown when
    `kind === 'katago'`. HumanSL card only when `enableHumanSL === true`.
- **Bottom action bar**: sticky. Primary "保存所有更改" right-aligned.
  "测试引擎" secondary.

Setting keys:

| UI label           | Setting key / engine field                                                             | Control type              |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------- |
| 引擎列表           | `engines.list`                                                                         | table with select         |
| 引擎名称           | engine.`name`                                                                          | text input                |
| 引擎类型           | engine.`kind`                                                                          | select (generic/katago)   |
| 引擎路径           | engine.`path`                                                                          | path input + browse       |
| 启动参数           | engine.`args`                                                                          | text input (wide)         |
| 初始命令           | engine.`commands`                                                                      | text input (wide)         |
| 模型文件           | engine.`modelPath`                                                                     | path input + browse       |
| 配置文件           | engine.`configPath`                                                                    | path input + browse       |
| visits             | engine.`analysis.visits`                                                               | number input              |
| playouts           | engine.`analysis.playouts`                                                             | number input              |
| 思考时间           | engine.`analysis.maxTime`                                                              | number input (step 0.1)   |
| 候选点数量         | engine.`analysis.candidates`                                                           | number input              |
| 温度               | engine.`analysis.temperature`                                                          | number input (step 0.1)   |
| 启用 HumanSL       | engine.`enableHumanSL`                                                                 | checkbox (card title)     |
| Human model        | engine.`humanModelPath`                                                                | path input + browse       |
| Profile            | engine.`humanSLProfile`                                                                | select (rank_5k..rank_9d) |
| Explore            | engine.`humanSLExplore`                                                                | select (off/light/strong) |
| 默认显示 AI 推荐点 | engine.`defaultShowAISuggestions` → `board.show_ai_suggestions`, `board.show_analysis` | checkbox                  |
| 默认显示人类偏好点 | engine.`defaultShowHumanPreference` → `board.show_human_preference`                    | checkbox                  |

### 6.4 FoxGamePane

This pane should closely match the provided screenshot. No changes from the
current layout — this section is kept for reference.

Desktop layout:

- Header title: `野狐历史对局导入`
- Subtitle: `根据用户 ID 搜索公开历史对局，并打开到本地棋盘`
- Search configuration panel:
  - `野狐用户 ID` input
  - `排序方式` select
  - Blue `搜索历史对局` button with search icon
- Main area:
  - Left bordered panel: search results table
  - Right bordered panel: selected game details and board preview
- Bottom action bar:
  - `刷新列表`
  - `复制 chessid`
  - Blue `打开到本地棋盘`

Table columns:

- Date / 日期
- Black / 黑方
- White / 白方
- Result / 结果
- Moves / 手数
- `chessid`

### 6.5 OneOhOneWeiqiSettingsPane

No layout changes from current design. This section is kept for reference.

This pane configures syncing a user's 101 Weiqi wrong-problem book into Sabaki's
local training cache.

Desktop layout:

- Header title: `101围棋错题同步`
- Subtitle: `登录 101围棋后同步错题本题目到本地，供训练和复盘使用`
- Account panel:
  - Login status
  - Username input
  - Password input or secure login action
  - `登录` / `退出登录` button
- Sync panel:
  - Last sync time
  - Total synced problems
  - Local cache location
  - `同步错题本` primary action
- Advanced panel:
  - Request interval / rate limit
  - Whether to download thumbnails
  - Whether to overwrite locally cached decoded problem data
  - Clear local 101 Weiqi cache

Implementation constraints:

- Do not store plaintext passwords in regular preferences.
- Prefer session cookies or OS-protected storage for persisted login state.
- Only sync the authenticated user's own wrong-problem book.
- Treat 101 Weiqi network, parsing, decoding, and local cache logic as domain
  services, not Hub UI logic.

### 6.6 HistoryPane

No layout changes from current design. This section is kept for reference.

- Migrate `GameChooserDrawer`.
- Use a searchable list/table.
- Provide preview/details for the selected history item.
- Opening a game should use the same bottom action bar pattern as Fox Games.

### 6.7 AdvancedSettingsPane

Migrates the logging/diagnostic options from `PreferencesDrawer` `EnginesTab`
top section, plus import/export/reset and app metadata. Single-column layout
with bordered panels.

```
┌─────────────────────────────────────────────────────────────────┐
│ 设置                                                            │
│ 高级选项、日志、导入/导出和关于信息                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ 日志 ─────────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  ☑ 启用应用日志                    ☑ 启用 GTP 日志        │  │
│ │  ☑ 将日志写入文件                                            │  │
│ │  日志目录  [________________________] [📂]                  │  │
│ │  GTP 日志目录  [____________________] [📂]                  │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 数据管理 ─────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  [导出设置…]    [导入设置…]    [重置为默认值]               │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ 关于 ─────────────────────────────────────────────────────┐  │
│ │                                                           │  │
│ │  Sabaki v0.55.0                                           │  │
│ │  Electron xxx / Chrome xxx                                │  │
│ │  [GitHub]  [反馈问题]                                      │  │
│ │                                                           │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Setting keys:

| UI label       | Setting key                | Control type                    |
| -------------- | -------------------------- | ------------------------------- |
| 启用应用日志   | `app.logging_enabled`      | checkbox                        |
| 启用 GTP 日志  | `gtp.console_log_enabled`  | checkbox                        |
| 将日志写入文件 | `app.logging_file_enabled` | checkbox                        |
| 日志目录       | `app.logging_file_path`    | path input + browse (directory) |
| GTP 日志目录   | `gtp.console_log_path`     | path input + browse (directory) |

## 7. Component Architecture

Recommended structure:

```text
src/components/
  ManagementHub.js
  ManagementHubSidebar.js
  management/
    GeneralSettingsPane.js
    BoardSettingsPane.js
    EngineManagementPane.js
    FoxGamePane.js
    OneOhOneWeiqiSettingsPane.js
    HistoryPane.js
    AdvancedSettingsPane.js
```

State ownership:

- Add a small `hubStore` or equivalent local app state for:
  - `isOpen`
  - `activeSection`
  - optional section-specific navigation params
- Keep domain data in existing domain stores/services where possible.
- Do not move engine, document, SGF, FoxWQ, or 101 Weiqi domain logic into the
  Hub component.

## 8. Integration Points

Do not update existing open actions until the entry-point audit is complete. The
first task is to classify each button/menu item as runtime control,
configuration/management, or contextual deep link.

Target mapping after audit:

- Preferences/settings action -> `ManagementHub` with
  `activeSection = "general"` or `"advanced"`.
- Engine management action -> `activeSection = "engine"`.
- Game chooser/history action -> `activeSection = "history"`.
- FoxWQ import entry -> `activeSection = "foxGames"`.
- 101 Weiqi sync/settings entry -> `activeSection = "oneOhOneWeiqi"`.

`DrawerManager.js` should keep legacy drawers during migration, then remove only
after equivalent Hub panes are complete and tested.

The audit checklist and current findings live in
`docs/design/management_hub_entrypoint_audit.md`.

## 9. Responsive Behavior

- Desktop: use the full sidebar plus two-column content where useful.
- Medium width: keep sidebar visible, collapse right detail panes below lists
  when needed.
- Narrow width: sidebar may become icon-only; content stacks vertically.
- Tables must remain usable through horizontal scroll or reduced columns.
- Bottom action bar remains visible and must not overlap content.

## 10. Development Strategy

Development should happen in three steps:

1. **Audit entry points first.**
   - Inventory all buttons, menu items, drawers, popup menus, and helper methods
     that open settings, engine management, game history, or related management
     surfaces.
   - Decide which actions stay near the board because they are runtime controls.
   - Decide which actions become Management Hub deep links.
   - Decide which old drawers remain transient dialogs.

2. **Freeze the frontend shell.**
   - Build the Management Hub shell, sidebar, page templates, and static panes
     for Fox Games and 101 Weiqi before either network feature is implemented.
   - Lock the component names, props, empty/loading/error states, table columns,
     action bar placement, and visual behavior.
   - Use mock data for Fox Games and 101 Weiqi so the UI can be reviewed
     independently from scraping/API risk.
   - This becomes the shared merge base for both feature worktrees.

3. **Split new feature implementation into two worktrees.**
   - `fox_game_import` worktree owns FoxWQ services, store, SGF import path, and
     integration with `FoxGamePane`.
   - `101weiqi` worktree owns 101 Weiqi auth, wrong-problem-book scraping,
     decoding, local cache, and integration with `OneOhOneWeiqiSettingsPane`.
   - Both worktrees should treat the Management Hub components as a fixed
     frontend contract unless a deliberate contract change is agreed first.

Recommended branch/worktree shape:

```text
main
  management-hub-ui-contract
    feature/fox-game-import
    feature/101weiqi-error-sync
```

The `management-hub-ui-contract` work should merge before the two feature
branches start heavy implementation. If both features need a UI contract change
later, make that change in the shared UI branch first, then rebase or merge it
into both feature worktrees.

## 11. Implementation Phases

0. **Entry-point and button audit**
   - Produce or update `docs/design/management_hub_entrypoint_audit.md`.
   - Review `src/menu.js`, `src/components/BoardToolbar.js`,
     `src/components/drawers/InfoDrawer.js`,
     `src/components/sidebars/PeerList.js`, `src/components/DrawerManager.js`,
     and `src/modules/sabaki.js`.
   - Classify each relevant action as runtime control, Hub deep link, or legacy
     transient dialog.
   - Define the public API for Hub deep links, e.g.
     `openHub(section, navigationParams)`.
   - Do not wire Preferences to the Hub until this classification is reviewed.

1. **Frontend contract**
   - Add `ManagementHub`, sidebar, active section state, and placeholder panes.
   - Implement the final static layout for Fox Games and 101 Weiqi using mock
     data.
   - Define stable props/events for pane-to-store integration.
   - Wire only the audited and approved entry points to open the Hub.

2. **Settings migration**
   - Move `GeneralTab` into `GeneralSettingsPane`.
   - Move board/theme settings into `BoardSettingsPane`.
   - Preserve existing preference keys and behavior.

3. **Engine migration**
   - Port `EngineManagementDrawer` into `EngineManagementPane`.
   - Keep engine service/store APIs unchanged unless a real gap appears.

4. **Fox Games feature worktree**
   - Connect to FoxWQ fetch/import services from the PRD.
   - Keep UI changes limited to the already agreed `FoxGamePane` contract where
     possible.

5. **101 Weiqi feature worktree**
   - Connect to the wrong-problem-book sync service from the PRD.
   - Keep UI changes limited to the already agreed `OneOhOneWeiqiSettingsPane`
     contract where possible.

6. **History migration**
   - Port `GameChooserDrawer` into `HistoryPane`.
   - Align selection, preview, and open actions with the common Hub pattern.

7. **Legacy cleanup**
   - Update `DrawerManager.js` after parity is reached.
   - Remove legacy drawers only when routes/actions/tests no longer depend on
     them.

## 12. Acceptance Criteria

- `docs/design/management_hub_entrypoint_audit.md` exists and classifies the
  affected buttons/menu items before Hub wiring begins.
- All settings and management entry points open the same Management Hub shell.
- Sidebar navigation works without closing the Hub.
- General, Board, Engine, Fox Games, 101 Weiqi, History, and Settings sections
  are reachable.
- Fox Games and 101 Weiqi panes can be reviewed with mock data before either
  backend integration is complete.
- The Fox Games pane visually matches the provided mockup's structure.
- The 101 Weiqi pane can log in, show sync status, and trigger
  wrong-problem-book sync without exposing stored credentials.
- Existing preference keys and engine configuration behavior continue to work.
- Existing keyboard/menu actions still open the expected management section.
- The Hub remains usable at common desktop and narrow window sizes.
