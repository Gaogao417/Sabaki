import {h} from 'preact'

import {
  GlobalHeader,
  ModeBar,
  MainBoardStage,
  GameTabBar,
  BottomActionBar,
  RightModePanel,
  PlayModePanel,
  ProblemModePanel,
  RecallModePanel,
  AnalysisModePanel,
} from './workbench/index.js'
import TrainingDashboardDrawer from './drawers/TrainingDashboardDrawer.js'

/**
 * @callback onModeChangeCallback
 * @param {'play'|'problem'|'recall'|'analysis'} mode - New active mode
 */

/**
 * @callback onSelectGameCallback
 * @param {number} index - Index of the selected game
 */

/**
 * @callback onCloseGameCallback
 * @param {number} index - Index of the game to close
 */

/**
 * @callback onAddGameCallback
 * Called when the user requests a new game
 */

/**
 * WorkbenchShell is the top-level layout shell for the training workbench.
 * Pure front-end skeleton: all callback props are documented with @callback JSDoc.
 *
 * @param {Object} props
 * @param {'play'|'problem'|'recall'|'analysis'} props.mode - Current active mode
 * @param {onModeChangeCallback} props.onModeChange - Fired when the user switches mode
 * @param {import('preact').ComponentChildren} [props.children] - Children rendered inside MainBoardStage
 * @param {Array<{index: number, title: string, active: boolean}>} [props.games] - Game list (omit to hide GameTabBar)
 * @param {number} [props.activeIndex] - Index of the active game tab
 * @param {onSelectGameCallback} [props.onSelectGame] - Fired when a game tab is selected
 * @param {onCloseGameCallback} [props.onCloseGame] - Fired when a game tab is closed
 * @param {onAddGameCallback} [props.onAddGame] - Fired when the add-game button is clicked
 * @param {string} [props.taskTitle] - Title displayed in GlobalHeader
 * @param {Array<string>} [props.statusChips] - Status chips in GlobalHeader
 * @param {string} [props.engineName] - Engine name in GlobalHeader
 * @param {boolean} [props.engineConnected] - Engine connection status in GlobalHeader
 */
export default function WorkbenchShell({
  mode = 'play',
  onModeChange = () => {},
  children,
  games,
  activeIndex,
  onSelectGame,
  onCloseGame,
  onAddGame,
  taskTitle,
  statusChips,
  engineName,
  engineConnected,
  ...rest
}) {
  /** Left panel content per mode */
  const leftPanel = {
    play: h(PlayModePanel, {...rest}),
    problem: h(ProblemModePanel, {...rest}),
    recall: h(RecallModePanel, {...rest}),
    analysis: h(AnalysisModePanel, {...rest}),
  }

  return h('section', {class: 'workbench-shell', 'data-mode': mode},
    h('div', {class: 'workbench-shell__inner'},

      // Row 1: Chrome — GlobalHeader + GameTabBar
      h('div', {class: 'workbench-shell__chrome'},
        h(GlobalHeader, {mode, taskTitle, statusChips, engineName, engineConnected}),

        // Game tab bar (only when games prop is provided)
        games && games.length > 0 &&
          h(GameTabBar, {games, activeIndex, onSelect: onSelectGame, onClose: onCloseGame, onAdd: onAddGame}),
      ),

      // Row 2: Toolbar — ModeBar (StoneStatus + Segmented + Actions)
      h(ModeBar, {activeMode: mode, onModeChange, ...rest}),

      // Main content area
      h('div', {class: 'workbench-shell__main'},

        // Left panel: mode-specific
        h('div', {class: 'workbench-shell__left-panel'},
          leftPanel[mode] || leftPanel.play,
        ),

        // Center: board stage with children
        h('div', {class: 'workbench-shell__center'},
          h(MainBoardStage, {mode, boardProps: rest.boardProps}, children),
        ),

        // Right panel: mode-specific
        h('div', {class: 'workbench-shell__right-panel'},
          h(RightModePanel, {mode, ...rest}),
        ),
      ),

      // Bottom: action bar
      h('div', {class: 'workbench-shell__bottom'},
        h(BottomActionBar, {mode, ...rest}),
      ),
    ),

    // W8-P4: Training dashboard drawer (moved from DrawerManager to WorkbenchShell)
    h(TrainingDashboardDrawer, {
      ...rest,
      show: rest.openDrawer === 'training',
    }),
  )
}
