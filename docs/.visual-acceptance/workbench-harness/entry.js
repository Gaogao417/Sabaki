import {h, render} from 'preact'

const savedGames = [
  {
    id: 'kifu-1',
    title: 'Lee Sedol vs AlphaGo',
    source: 'imported_sgf',
    updatedAt: '2016-03-13',
    result: '黑中盘胜',
    tags: ['名局'],
  },
  {
    id: 'kifu-2',
    title: '柯洁 vs AlphaGo Zero',
    source: 'imported_sgf',
    updatedAt: '2017-05-23',
    result: '白中盘胜',
    tags: ['研究'],
  },
  {
    id: 'play-1',
    title: '黑方 vs 白方 #1',
    source: 'play',
    updatedAt: '2026-05-26',
    result: '对局中',
    tags: ['训练'],
  },
]

window.sabaki = {
  setting: {
    get: () => undefined,
    set: () => {},
    getThemes: () => ({}),
    onDidChange: () => {},
  },
  db: {
    getRecentGames: async () => savedGames,
    getDashboardSummary: async () => ({
      dueCount: 3,
      inboxCount: 7,
      recentPunishmentCount: 2,
    }),
    getProblemsByStatus: async () => [],
  },
}

const gameTrees = [
  makeGameTree('黑方 vs 白方 #1', '黑方', '白方', '2026-05-26', '对局中', 43),
  makeGameTree('白方 vs AI #2', '白方', 'AI 9段', '2026-05-25', '已保存', 137),
]

const activeCheckpoint = {
  id: 'cp-visual',
  severity: 'severe',
  originalLine: ['R10'],
  userCorrectionLine: ['R17', 'D3', 'Q11'],
  aiCandidateLines: [
    {label: 'AI 1', moves: ['R17', 'D3']},
    {label: 'AI 2', moves: ['Q17', 'C4']},
  ],
}

function makeGameTree(name, black, white, date, result, height) {
  return {
    root: {
      id: `${name}-root`,
      data: {GN: [name], PB: [black], PW: [white], DT: [date], RE: [result]},
    },
    getHeight: () => height,
  }
}

function noop() {}

function scenarioProps(name) {
  const common = {
    taskTitle: name.includes('problem') ? '攻击方向训练 #12' : '黑方 vs 白方 #1',
    gameTrees,
    gameIndex: 0,
    onModeChange: noop,
    onOpenGameLibrary: noop,
    onCloseLibraryDrawer: noop,
    onSwitchLibraryDrawer: noop,
    onOpenGame: noop,
    onNewGame: noop,
    onStartReview: noop,
    onStartProblem: noop,
    onUndo: noop,
    onRedo: noop,
    onPass: noop,
    onResign: noop,
    onEndAttempt: noop,
    onSubmit: noop,
    onSubmitAnswer: noop,
    onAbandon: noop,
    onRequestHint: noop,
    onEndRecall: noop,
    onAnalysis: noop,
    onSnapshot: noop,
    onSettings: noop,
    onReturn: noop,
    onEditPosition: noop,
    onSubmitCorrection: noop,
    onRevealAI: noop,
    onSkipCheckpoint: noop,
    onSaveCheckpointComment: noop,
  }

  if (name === 'problem') {
    return {
      ...common,
      mode: 'problem',
      hintLevelUsed: 1,
      badMoveCount: 0,
    }
  }

  if (name === 'recall') {
    return {
      ...common,
      mode: 'recall',
      currentMove: 23,
      totalMoves: 180,
      correctCount: 22,
      wrongCount: 1,
      progress: 13,
    }
  }

  if (name === 'checkpoint') {
    return {
      ...common,
      mode: 'recall',
      recallSubstate: 'checkpoint_ai_revealed',
      activeCheckpoint,
      activeCheckpointId: activeCheckpoint.id,
      canEditCheckpointComment: true,
    }
  }

  if (name === 'analysis') {
    return {
      ...common,
      mode: 'analysis',
      moveCount: 76,
    }
  }

  if (name === 'analysis-library') {
    return {
      ...common,
      mode: 'analysis',
      moveCount: 76,
      libraryDrawerType: 'history',
    }
  }

  if (name === 'play-kifu') {
    return {
      ...common,
      mode: 'play',
      moveCount: 42,
      libraryDrawerType: 'kifu',
    }
  }

  if (name === 'play-games') {
    return {
      ...common,
      mode: 'play',
      moveCount: 42,
      libraryDrawerType: 'game-records',
    }
  }

  return {
    ...common,
    mode: 'play',
    moveCount: 42,
    libraryDrawerType: 'history',
  }
}

function mount() {
  let scenario = window.location.hash.replace(/^#/, '') || 'problem'
  let root = document.createElement('div')
  root.className = 'visual-root'
  root.dataset.scenario = scenario
  document.body.replaceChildren(root)
  render(h(window.WorkbenchShell, scenarioProps(scenario)), root)
}

import('../../../src/components/WorkbenchShell.js').then((module) => {
  window.WorkbenchShell = module.default
  window.addEventListener('hashchange', mount)
  mount()
})
