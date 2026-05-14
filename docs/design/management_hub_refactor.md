# Design Doc: Unified Settings Management Hub

## 1. Objective

Refactor Sabaki's settings and management surfaces into one unified, sidebar-driven management window that matches the provided mockup:

- A macOS-style workbench panel with a fixed left sidebar.
- A wide right content area with a page title, task-specific controls, data/details panes, and a bottom action bar.
- Settings, engine management, FoxWQ import, 101 Weiqi sync, and game history should feel like sections of the same product surface, not separate drawers or dialogs.

This replaces the current scattered drawer model with a single predictable place for configuration and management.

## 2. Target Interaction Model

### Current State

- Settings live in `PreferencesDrawer` (`preferences`).
- Engine management lives in `EngineManagementDrawer` (`enginemanagement`).
- Game history/choosing lives in `GameChooserDrawer` (`gamechooser`).
- New game setup lives in `NewGameDialog` (`newgame`).
- These surfaces are opened through `DrawerManager.js` and behave like separate overlays.

### Proposed State

- Introduce a unified **Management Hub** for persistent management tasks.
- The Hub opens as one large workbench-style panel instead of multiple unrelated drawers.
- Sidebar navigation switches content panes without closing the Hub.
- Existing settings are split into clear top-level categories rather than nested preference tabs.
- `NewGameDialog` can stay as a transient dialog for quick game creation, but reusable configuration should move into the Hub.

## 3. Visual Reference

The mockup style should be treated as the source of truth:

- Window shell: light, quiet macOS-style panel with subtle border and shadow.
- Sidebar: fixed width, light gray background, icon plus label navigation, active row highlighted in blue.
- Content area: white or near-white background, page title at top, functional panels below.
- Panels: thin borders, 8px radius, minimal shadow, dense but readable spacing.
- Primary actions: blue filled buttons with icons.
- Secondary actions: neutral outlined buttons with icons.
- Typography: compact, workbench-like, no oversized marketing headings.

Avoid treating this as a generic glassmorphism redesign. The screenshot is primarily a structured settings/workbench layout with restrained visual polish.

## 4. Information Architecture

The left sidebar should contain these sections:

1. **General / 通用**
   - Application behavior, language, startup, file handling, notifications, autosave.
   - Migrated from `PreferencesDrawer` `GeneralTab`.

2. **Board / 棋盘**
   - Board theme, stones, coordinates, grid, move display, variation display.
   - Migrated from `PreferencesDrawer` `ThemesTab` plus board-related preferences.

3. **Engine / 引擎**
   - GTP engine list, engine configuration, analysis defaults, engine health/status.
   - Migrated from `EngineManagementDrawer`.

4. **Fox Games / 野狐对局**
   - FoxWQ UID search, public game list, selected game details, board preview, SGF import.
   - New feature described by `docs/design/fox_game_import_ui_ux.md` and `docs/product/fox_game_import_prd.md`.

5. **101 Weiqi / 101围棋**
   - Account connection, login status, wrong-problem-book sync, local cache settings.
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
- Recommended desktop size: approximately 80-88vw wide and 80-88vh tall, capped by sensible max dimensions.
- The Hub should not block internal tab switching, but it can remain modal relative to the board while open.

### 5.2 Sidebar

- Component: `src/components/ManagementHubSidebar.js`
- Fixed width, approximately 160-180px.
- Top area contains primary sections.
- Bottom area contains the pinned Settings item.
- Each item uses an icon and a Chinese label. English identifiers remain in code.
- Active item uses a blue-tinted background and blue icon/text.
- Inactive items use neutral text and gray icons.

Recommended icons:

- General: home/settings-sliders icon.
- Board: grid/board icon.
- Engine: chip/cpu icon.
- Fox Games: fox icon if available; otherwise a simple custom icon or existing asset.
- 101 Weiqi: book/checklist/cloud-sync icon.
- History: clock icon.
- Settings: gear icon.

### 5.3 Content Header

Each content pane starts with:

- Large but compact page title, e.g. `野狐历史对局导入`.
- One-line subtitle explaining the task.
- No instructional paragraphs inside the app UI unless required for error/empty states.

### 5.4 Content Body

Use the mockup's structure as a reusable page template:

- **Top configuration panel**
  - Contains form controls relevant to the section.
  - Uses horizontal grouping on desktop.
  - Primary action sits on the right where appropriate.

- **Main work area**
  - For data-heavy pages: left table/list plus right details panel.
  - For settings pages: grouped settings sections in bordered panels.
  - For engine/history pages: table/list selection with detail/editor panel when useful.

- **Bottom action bar**
  - Sticky within the Hub shell.
  - Right-align primary actions.
  - Keep destructive actions secondary or separated.

## 6. Pane Requirements

### 6.1 GeneralSettingsPane

- Migrate application-level options from `PreferencesDrawer` `GeneralTab`.
- Group settings into compact bordered sections:
  - Application
  - Files
  - Behavior
  - Notifications/confirmations
- Use native-feeling controls: toggles, selects, steppers, and file pickers.

### 6.2 BoardSettingsPane

- Migrate board and theme settings from `PreferencesDrawer`.
- Provide live preview where feasible.
- Keep visual customization in one place:
  - Board theme
  - Stone style
  - Coordinates/labels
  - Move numbers and markers
  - Variation display

### 6.3 EngineManagementPane

- Migrate `EngineManagementDrawer`.
- Use a split layout:
  - Left: engine list with status.
  - Right: selected engine configuration.
- Bottom actions:
  - Add engine
  - Duplicate/copy configuration
  - Test engine
  - Save changes

### 6.4 FoxGamePane

This pane should closely match the provided screenshot.

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

This pane configures syncing a user's 101 Weiqi wrong-problem book into Sabaki's local training cache.

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
- Treat 101 Weiqi network, parsing, decoding, and local cache logic as domain services, not Hub UI logic.

### 6.6 HistoryPane

- Migrate `GameChooserDrawer`.
- Use a searchable list/table.
- Provide preview/details for the selected history item.
- Opening a game should use the same bottom action bar pattern as Fox Games.

### 6.7 AdvancedSettingsPane

- Replaces the ambiguous old "settings" catch-all.
- Contains:
  - Import/export settings
  - Reset settings
  - App metadata
  - Diagnostic or developer-only options if currently exposed

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
- Do not move engine, document, SGF, FoxWQ, or 101 Weiqi domain logic into the Hub component.

## 8. Integration Points

Do not update existing open actions until the entry-point audit is complete. The first task is to classify each button/menu item as runtime control, configuration/management, or contextual deep link.

Target mapping after audit:

- Preferences/settings action -> `ManagementHub` with `activeSection = "general"` or `"advanced"`.
- Engine management action -> `activeSection = "engine"`.
- Game chooser/history action -> `activeSection = "history"`.
- FoxWQ import entry -> `activeSection = "foxGames"`.
- 101 Weiqi sync/settings entry -> `activeSection = "oneOhOneWeiqi"`.

`DrawerManager.js` should keep legacy drawers during migration, then remove only after equivalent Hub panes are complete and tested.

The audit checklist and current findings live in `docs/design/management_hub_entrypoint_audit.md`.

## 9. Responsive Behavior

- Desktop: use the full sidebar plus two-column content where useful.
- Medium width: keep sidebar visible, collapse right detail panes below lists when needed.
- Narrow width: sidebar may become icon-only; content stacks vertically.
- Tables must remain usable through horizontal scroll or reduced columns.
- Bottom action bar remains visible and must not overlap content.

## 10. Development Strategy

Development should happen in three steps:

1. **Audit entry points first.**
   - Inventory all buttons, menu items, drawers, popup menus, and helper methods that open settings, engine management, game history, or related management surfaces.
   - Decide which actions stay near the board because they are runtime controls.
   - Decide which actions become Management Hub deep links.
   - Decide which old drawers remain transient dialogs.

2. **Freeze the frontend shell.**
   - Build the Management Hub shell, sidebar, page templates, and static panes for Fox Games and 101 Weiqi before either network feature is implemented.
   - Lock the component names, props, empty/loading/error states, table columns, action bar placement, and visual behavior.
   - Use mock data for Fox Games and 101 Weiqi so the UI can be reviewed independently from scraping/API risk.
   - This becomes the shared merge base for both feature worktrees.

3. **Split new feature implementation into two worktrees.**
   - `fox_game_import` worktree owns FoxWQ services, store, SGF import path, and integration with `FoxGamePane`.
   - `101weiqi` worktree owns 101 Weiqi auth, wrong-problem-book scraping, decoding, local cache, and integration with `OneOhOneWeiqiSettingsPane`.
   - Both worktrees should treat the Management Hub components as a fixed frontend contract unless a deliberate contract change is agreed first.

Recommended branch/worktree shape:

```text
main
  management-hub-ui-contract
    feature/fox-game-import
    feature/101weiqi-error-sync
```

The `management-hub-ui-contract` work should merge before the two feature branches start heavy implementation. If both features need a UI contract change later, make that change in the shared UI branch first, then rebase or merge it into both feature worktrees.

## 11. Implementation Phases

0. **Entry-point and button audit**
   - Produce or update `docs/design/management_hub_entrypoint_audit.md`.
   - Review `src/menu.js`, `src/components/BoardToolbar.js`, `src/components/drawers/InfoDrawer.js`, `src/components/sidebars/PeerList.js`, `src/components/DrawerManager.js`, and `src/modules/sabaki.js`.
   - Classify each relevant action as runtime control, Hub deep link, or legacy transient dialog.
   - Define the public API for Hub deep links, e.g. `openHub(section, navigationParams)`.
   - Do not wire Preferences to the Hub until this classification is reviewed.

1. **Frontend contract**
   - Add `ManagementHub`, sidebar, active section state, and placeholder panes.
   - Implement the final static layout for Fox Games and 101 Weiqi using mock data.
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
   - Keep UI changes limited to the already agreed `FoxGamePane` contract where possible.

5. **101 Weiqi feature worktree**
   - Connect to the wrong-problem-book sync service from the PRD.
   - Keep UI changes limited to the already agreed `OneOhOneWeiqiSettingsPane` contract where possible.

6. **History migration**
   - Port `GameChooserDrawer` into `HistoryPane`.
   - Align selection, preview, and open actions with the common Hub pattern.

7. **Legacy cleanup**
   - Update `DrawerManager.js` after parity is reached.
   - Remove legacy drawers only when routes/actions/tests no longer depend on them.

## 12. Acceptance Criteria

- `docs/design/management_hub_entrypoint_audit.md` exists and classifies the affected buttons/menu items before Hub wiring begins.
- All settings and management entry points open the same Management Hub shell.
- Sidebar navigation works without closing the Hub.
- General, Board, Engine, Fox Games, 101 Weiqi, History, and Settings sections are reachable.
- Fox Games and 101 Weiqi panes can be reviewed with mock data before either backend integration is complete.
- The Fox Games pane visually matches the provided mockup's structure.
- The 101 Weiqi pane can log in, show sync status, and trigger wrong-problem-book sync without exposing stored credentials.
- Existing preference keys and engine configuration behavior continue to work.
- Existing keyboard/menu actions still open the expected management section.
- The Hub remains usable at common desktop and narrow window sizes.
