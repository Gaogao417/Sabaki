import {h} from 'preact'

import {
  ModeBar,
  MainBoardStage,
  GameTabBar,
  BottomActionBar,
  RightModePanel,
  PlayModePanel,
  ProblemModePanel,
  RecallModePanel,
  AnalysisModePanel,
  LibrarySideDrawer,
} from './workbench/index.js'
import WorkbenchLeftPanel from './workbench/panels/WorkbenchLeftPanel.js'
import WorkbenchRightPanel from './workbench/panels/WorkbenchRightPanel.js'
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
  gameTrees,
  gameIndex,
  libraryDrawerType,
  onCloseLibraryDrawer,
  onSwitchLibraryDrawer,
  onOpenGame,
  onOpenFoxGames,
  onOpenOneOhOneWeiqi,
  onStartReview,
  onStartProblem,
  taskTitle,
  statusChips,
  engineName,
  engineConnected,
  ...rest
}) {
  const playState = rest.playState || 'active'
  const problemState = rest.problemState || 'active'
  const recallState = rest.recallState || rest.state || 'active'
  const analysisState = rest.analysisState || 'active'
  const isCheckpoint = mode === 'recall' &&
    (rest.activeCheckpoint || rest.activeCheckpointId ||
      String(rest.recallSubstate || '').startsWith('checkpoint'))
  const checkpointLabel = getCheckpointLabel(rest.activeCheckpoint)
  const hasLeftPanel = mode === 'problem' || mode === 'analysis'

  /** Left panel content per mode */
  const leftPanel = {
    play: h(PlayModePanel, {...rest, state: playState}),
    problem: h(ProblemModePanel, {...rest, state: problemState}),
    recall: h(RecallModePanel, {
      ...rest,
      state: recallState,
      showCheckpointCommentEditor: hasLeftPanel,
    }),
    analysis: h(AnalysisModePanel, {...rest, state: analysisState}),
  }

  return h('section', {class: 'workbench-shell', 'data-mode': mode},
    h(LibrarySideDrawer, {
      open: libraryDrawerType != null,
      type: libraryDrawerType || 'history',
      gameTrees,
      gameIndex,
      onClose: onCloseLibraryDrawer,
      onSwitch: onSwitchLibraryDrawer,
      onOpenGame,
      onOpenFoxGames,
      onOpenOneOhOneWeiqi,
      onNewGame: rest.onNewGame,
      onStartReview,
      onStartProblem,
    }),
    h('div', {class: 'workbench-shell__inner'},

      // Compatibility anchors for legacy shell tests. The visible top context now lives in ModeBar.
      h('div', {class: 'workbench-shell__chrome'},
        h('div', {
          'data-testid': 'global-header',
          class: 'workbench-shell__global-header-compat',
          'aria-hidden': 'true',
        }),

        // Game tab bar (only when games prop is provided)
        games && games.length > 0 &&
          h(GameTabBar, {games, activeIndex, onSelect: onSelectGame, onClose: onCloseGame, onAdd: onAddGame}),
      ),

      // Row 2: Toolbar — ModeBar (StoneStatus + Segmented + Actions)
      h(ModeBar, {activeMode: mode, onModeChange, ...rest}),

      // Main content area
      h('div', {
        class: [
          'workbench-shell__main',
          hasLeftPanel ? 'workbench-shell__main--with-left' : 'workbench-shell__main--no-left',
          isCheckpoint ? 'workbench-shell__main--checkpoint' : '',
        ].filter(Boolean).join(' '),
      },

        // Left panel: mode-specific task surface
        h('div', {class: 'workbench-shell__left-panel'},
          h(WorkbenchLeftPanel, {
            modePanel: leftPanel[mode] || leftPanel.play,
          }),
        ),

        // Center: board stage with children
        h('div', {class: 'workbench-shell__center'},
          h(MainBoardStage, {mode, boardProps: rest.boardProps, checkpoint: isCheckpoint, checkpointLabel}, children),
          mode === 'recall' && !isCheckpoint && h('div', {class: 'wb-recall-feedback wb-recall-feedback--success'},
            h('span', {class: 'wb-recall-feedback__icon'}, '✓'),
            h('span', {}, '正确，继续。'),
          ),
        ),

        // Right panel: mode-specific inspector
        h('div', {class: 'workbench-shell__right-panel'},
          h(WorkbenchRightPanel, {
            modePanel: h(RightModePanel, {mode, ...rest}),
          }),
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

function getCheckpointLabel(checkpoint) {
  if (!checkpoint) return ''
  if (checkpoint.originalMoveLabel) return `原手 ${checkpoint.originalMoveLabel}`
  const originalLine = Array.isArray(checkpoint.originalLine)
    ? checkpoint.originalLine.filter(Boolean)
    : []
  return originalLine.length > 0 ? `原手 ${originalLine[0]}` : ''
}
