import {h} from 'preact'

import GlobalHeader from './shell/GlobalHeader.js'
import ModeBar from './shell/ModeBar.js'
import MainBoardStage from './shell/MainBoardStage.js'
import RightModePanel from './shell/RightModePanel.js'
import BottomActionBar from './shell/BottomActionBar.js'
import TrainingTabBar from './shell/TrainingTabBar.js'

import PlayModePanel from './panels/PlayModePanel.js'
import ProblemModePanel from './panels/ProblemModePanel.js'
import RecallModePanel from './panels/RecallModePanel.js'
import RecallCheckpointPanel from './panels/RecallCheckpointPanel.js'
import AnalysisModePanel from './panels/AnalysisModePanel.js'

import ModeChip from './shared/ModeChip.js'
import StatusChip from './shared/StatusChip.js'
import SectionCard from './shared/SectionCard.js'
import MetricCard from './shared/MetricCard.js'
import PrimaryActionButton from './shared/PrimaryActionButton.js'
import SecondaryActionButton from './shared/SecondaryActionButton.js'
import GhostButton from './shared/GhostButton.js'
import ProblemAreaBadge from './shared/ProblemAreaBadge.js'
import AiStatusCard from './shared/AiStatusCard.js'
import HintCard from './shared/HintCard.js'
import BadMoveSummaryCard from './shared/BadMoveSummaryCard.js'
import CandidateMoveList from './shared/CandidateMoveList.js'
import CommentBox from './shared/CommentBox.js'
import SnapshotDialog from './shared/SnapshotDialog.js'
import ReviewInboxList from './shared/ReviewInboxList.js'
import TaskListItem from './shared/TaskListItem.js'

export {
  GlobalHeader,
  ModeBar,
  MainBoardStage,
  RightModePanel,
  BottomActionBar,
  TrainingTabBar,
  PlayModePanel,
  ProblemModePanel,
  RecallModePanel,
  RecallCheckpointPanel,
  AnalysisModePanel,
  ModeChip,
  StatusChip,
  SectionCard,
  MetricCard,
  PrimaryActionButton,
  SecondaryActionButton,
  GhostButton,
  ProblemAreaBadge,
  AiStatusCard,
  HintCard,
  BadMoveSummaryCard,
  CandidateMoveList,
  CommentBox,
  SnapshotDialog,
  ReviewInboxList,
  TaskListItem,
}

export function TrainingWorkbenchShell({
  mode = 'problem',
  taskTitle = '攻击题 #1024',
  statusChips = ['黑先', '未提交'],
  engineName = 'KataGo',
  engineConnected = true,
  overlayChip,
  tabs,
  actions,
  onModeChange,
  onSnapshot,
  onTabClick,
  onNewTab,
}) {
  const panels = {
    play: h(PlayModePanel),
    problem: h(ProblemModePanel),
    recall: h(RecallModePanel),
    recallCheckpoint: h(RecallCheckpointPanel),
    analysis: h(AnalysisModePanel),
  }

  return h(
    'div',
    {class: 'wb-shell'},

    h(GlobalHeader, {
      taskTitle,
      mode,
      statusChips,
      engineName,
      engineConnected,
    }),

    h(ModeBar, {activeMode: mode, onModeChange, onSnapshot}),

    h(
      'div',
      {class: 'wb-shell__main'},

      h('aside', {class: 'wb-left-sidebar'},
        h(ReviewInboxList),
      ),

      h(MainBoardStage, {overlayChip}),

      h(RightModePanel, {mode},
        panels[mode] || panels.problem,
      ),
    ),

    h(BottomActionBar, {mode, actions}),

    h(TrainingTabBar, {tabs, onTabClick, onNewTab}),
  )
}
