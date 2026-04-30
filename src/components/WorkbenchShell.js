import {h, Component} from 'preact'

import BoardToolbar from './BoardToolbar.js'
import MainView from './MainView.js'
import LeftSidebar from './LeftSidebar.js'
import Sidebar from './Sidebar.js'
import WorkspaceDock from './WorkspaceDock.js'
import EditBar from './bars/EditBar.js'
import GuessBar from './bars/GuessBar.js'
import RecallBar from './bars/RecallBar.js'
import ProblemBar from './bars/ProblemBar.js'
import AutoplayBar from './bars/AutoplayBar.js'
import ScoringBar from './bars/ScoringBar.js'
import FindBar from './bars/FindBar.js'

import sabaki from '../modules/sabaki.js'
import * as gametree from '../modules/gametree.js'

export default class WorkbenchShell extends Component {
  constructor(props) {
    super(props)

    this.handleTogglePlayer = () => {
      let {
        treePosition,
        currentPlayer,
        editWorkspaceActive,
        editCurrentPlayer,
      } = this.props
      let player = editWorkspaceActive ? editCurrentPlayer : currentPlayer
      if (editWorkspaceActive) {
        sabaki.setEditWorkspacePlayer(-player)
      } else {
        sabaki.setPlayer(treePosition, -player)
      }
    }

    this.handleToolButtonClick = (evt) => {
      sabaki.setState({selectedTool: evt.tool})
    }

    this.handleFindButtonClick = (evt) =>
      sabaki.findMove(evt.step, {
        vertex: this.props.findVertex,
        text: this.props.findText,
      })
  }

  render(props) {
    let {
      mode,
      gameIndex,
      gameTree,
      gameCurrents,
      treePosition,
      currentPlayer,
      editWorkspaceActive,
      editRenderBoard,
      editCurrentPlayer,
      editLines,
      gameInfo,
      recallSession,
      openDrawer,

      scoringMethod,
      scoreBoard,
      areaMap,

      selectedTool,
      findText,
      editWorkspace: editWs,
    } = props

    let board = editWorkspaceActive
      ? editRenderBoard
      : gametree.getBoard(gameTree, treePosition)
    if (board == null) {
      board = gametree.getBoard(gameTree, treePosition)
    }
    currentPlayer = editWorkspaceActive ? editCurrentPlayer : currentPlayer

    let engineSyncers = [
      props.blackEngineSyncerId,
      props.whiteEngineSyncerId,
    ].map((id) =>
      props.attachedEngineSyncers.find((syncer) => syncer.id === id),
    )

    let workspaceSummary =
      mode === 'analysis'
        ? `当前第 ${gameTree.getLevel(treePosition)} 手 | 关键点 0 · 题目 0`
        : mode === 'play'
          ? `当前第 ${gameTree.getLevel(treePosition)} 手 | 未连接引擎`
          : mode === 'recall'
            ? `当前进度 ${sabaki.state.recallMoveIndex}/${sabaki.state.recallExpectedMoves.length} | 等待输入下一手`
            : ''

    let komi = +gametree.getRootProperty(gameTree, 'KM', 0)
    let handicap = +gametree.getRootProperty(gameTree, 'HA', 0)

    return h(
      'section',
      {class: 'workbench-shell'},

      h(
        'div',
        {class: 'workbench-shell__inner'},

        h(
          'div',
          {class: 'workbench-shell__top'},
          h(BoardToolbar, {
            mode,
            editWorkspaceActive,
            territoryEnabled: props.territoryMode,
            territoryCompareEnabled: props.territoryCompareEnabled,
            territoryCompareAvailable: sabaki.getTerritoryCompareAvailable(),
            currentPlayer,
            playerNames: gameInfo.playerNames,
            playerRanks: gameInfo.playerRanks,
            playerCaptures: [1, -1].map((sign) => board.getCaptures(sign)),
            engineSyncers,
            enginePanelOpen: props.enginePanelOpen,
            recallSession,
            openDrawer,
            onEnginePanelToggle: props.onEnginePanelToggle,
            onCurrentPlayerClick: this.handleTogglePlayer,
          }),
        ),

        h(
          'div',
          {class: 'workbench-shell__main'},

          h(
            'div',
            {class: 'workbench-shell__left'},
            h(LeftSidebar, props),
          ),

          h(
            'div',
            {class: 'workbench-shell__center'},
            h(MainView, {...props, workbenchShell: true}),
          ),

          h(
            'div',
            {class: 'workbench-shell__right'},
            h(Sidebar, props),
          ),
        ),

        h(
          'div',
          {class: 'workbench-shell__bottom'},
          h(
            WorkspaceDock,
            {
              mode,
              editWorkspaceActive,
              summary: workspaceSummary,
            },
            h(EditBar, {
              mode,
              selectedTool,
              onToolButtonClick: this.handleToolButtonClick,
              editWorkspace: editWs,
            }),

            h(GuessBar, {
              mode,
              treePosition,
            }),

            h(RecallBar, {
              mode,
              recallMoveIndex: sabaki.state.recallMoveIndex,
              recallExpectedMoves: sabaki.state.recallExpectedMoves,
              recallCompleted: sabaki.state.recallCompleted,
              recallUserAttempts: sabaki.state.recallUserAttempts,
              recallShowHint: sabaki.state.recallShowHint,
            }),

            h(ProblemBar, {
              mode,
              problemSession: sabaki.state.problemSession,
              problemAttempt: sabaki.state.problemAttempt,
              problemSubmitted: sabaki.state.problemSubmitted,
              problemResult: sabaki.state.problemResult,
              problemBadMoves: sabaki.state.problemBadMoves,
              reviewQueue: sabaki.state.reviewQueue,
              reviewCurrentIndex: sabaki.state.reviewCurrentIndex,
              reviewTotalDue: sabaki.state.reviewTotalDue,
            }),

            h(AutoplayBar, {
              mode,
              gameTree,
              gameCurrents: gameCurrents[gameIndex],
              treePosition,
            }),

            h(ScoringBar, {
              type: 'scoring',
              mode,
              method: scoringMethod,
              scoreBoard,
              areaMap,
              komi,
              handicap,
            }),

            h(ScoringBar, {
              type: 'estimator',
              mode,
              method: scoringMethod,
              scoreBoard,
              areaMap,
              komi,
              handicap,
            }),

            h(FindBar, {
              mode,
              findText,
              onButtonClick: this.handleFindButtonClick,
            }),
          ),
        ),
      ),
    )
  }
}
