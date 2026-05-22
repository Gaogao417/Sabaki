# Management Hub Entry-Point Audit

## 1. Purpose

Before wiring the new Management Hub, audit every existing button, menu item, drawer entry, and helper method that touches settings, engines, history, or management-like workflows.

The goal is to avoid a shallow migration where old drawers are simply wrapped by a new shell while toolbar buttons, engine controls, and contextual actions remain conceptually scattered.

## 2. Classification Rules

Use these categories for every relevant entry point:

- **Runtime control**
  - Stays close to the board because it affects the current game/session immediately.
  - Examples: start/stop analysis, pass, resign, attach active engine, toggle engine panel.

- **Management Hub deep link**
  - Opens the Hub to a specific section.
  - Examples: preferences, engine configuration, history management, FoxWQ import, 101 Weiqi sync.

- **Transient dialog**
  - Remains a focused short-lived dialog.
  - Examples: new game setup, scoring result confirmation, advanced node properties if still contextual.

- **Deferred / needs design**
  - Requires a product decision before migration.
  - Examples: controls that mix runtime state and long-term configuration.

## 3. Proposed Hub API

Introduce a single public entry point instead of overloading `openDrawer()` indefinitely:

```js
sabaki.openHub(section, navigationParams)
```

Suggested section ids:

```text
general
board
engine
foxGames
oneOhOneWeiqi
history
advanced
```

During migration, `openDrawer('preferences')`, `openDrawer('enginemanagement')`, and `openDrawer('gamechooser')` may delegate to `openHub()` after their entries are approved by this audit.

## 4. Current Findings

| File | Entry point | Current behavior | Proposed classification | Proposed target |
| --- | --- | --- | --- | --- |
| `src/menu.js` | File -> Preferences | `sabaki.openDrawer('preferences')` | Management Hub deep link | `openHub('general')` or `openHub('advanced')` |
| `src/menu.js` | File -> Game Chooser | `sabaki.openDrawer('gamechooser')` | Management Hub deep link | `openHub('history')` |
| `src/components/BoardToolbar.js` | New game button | `sabaki.openDrawer('newgame')` | Transient dialog | Keep `NewGameDialog` for now |
| `src/components/BoardToolbar.js` | Engine management button | `sabaki.openDrawer('enginemanagement')` | Management Hub deep link | `openHub('engine')` |
| `src/components/BoardToolbar.js` | Engine status button | Toggles engine floating/sidebar panel | Runtime control | Keep near board |
| `src/components/BoardToolbar.js` | Resign button | `sabaki.makeResign()` | Runtime control | Keep near board |
| `src/components/BoardToolbar.js` | Snapshot as problem | `sabaki.snapshotAsProblem()` | Runtime/control-adjacent | Keep near board unless training redesign moves it |
| `src/components/drawers/InfoDrawer.js` | Engine selection/manage action | Opens engine management from player metadata UI | Contextual deep link | `openHub('engine', {source: 'infoDrawer'})` |
| `src/components/sidebars/PeerList.js` | Attach engine menu | Opens engine picker menu | Runtime control | Keep near engine panel |
| `src/components/sidebars/PeerList.js` | Engine action context menu | Opens engine runtime actions | Runtime control | Keep near engine panel |
| `src/components/DrawerManager.js` | Preferences drawer render | Renders legacy preferences | Transitional compatibility | Keep until Hub parity |
| `src/components/DrawerManager.js` | Engine management drawer render | Renders legacy engine modal | Transitional compatibility | Keep until Hub parity |
| `src/components/DrawerManager.js` | Game chooser drawer render | Renders legacy history chooser | Transitional compatibility | Keep until Hub parity |
| `src/modules/sabaki.js` | `openDrawer('preferences')` | Opens preferences and sets `preferencesTab` | Transitional routing | Delegate to `openHub()` after audit |
| `src/modules/sabaki.js` | `openDrawer('enginemanagement')` | Opens engine management | Transitional routing | Delegate to `openHub('engine')` after audit |
| `src/modules/sabaki.js` | `openDrawer('gamechooser')` | Opens game chooser/history | Transitional routing | Delegate to `openHub('history')` after audit |

## 5. Phase 0 Questions

- Should the top board toolbar keep a visible `Engine Management` button, or should it become an engine status button with a menu item for `Manage Engines`?
- Should FoxWQ import and 101 Weiqi sync appear only inside the Hub, or should training/history surfaces also provide shortcuts into those Hub sections?
- Should `GameChooserDrawer` become `HistoryPane` in Phase 1, or remain legacy until after FoxWQ and 101 Weiqi land?
- Should `PreferencesDrawer` tabs map one-to-one into Hub sections, or should General/Board/Advanced be reorganized before migration?
- Should `openDrawer()` remain the compatibility facade, or should call sites migrate directly to `openHub()` once each entry is classified?

## 6. Phase 0 Deliverables

- This audit table reviewed and updated with all affected call sites.
- A confirmed rule for runtime controls vs. Hub deep links.
- A confirmed `openHub(section, navigationParams)` API.
- A list of Phase 1 entry points that are safe to wire.
- A list of old drawers that must remain functional during Phase 1.

## 7. Phase 1 Boundary

Phase 1 may build static Hub UI, mock panes, and approved deep links. It should not:

- Remove legacy drawers.
- Move runtime engine controls into the Hub.
- Redesign BoardToolbar without a specific entry-point decision.
- Start FoxWQ or 101 Weiqi network implementation.
- Change engine service behavior.
