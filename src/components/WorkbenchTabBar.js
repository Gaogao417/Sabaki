import {h} from 'preact'
import classNames from 'classnames'

const SOURCE_LABELS = {
  problem: '题目',
  game: '对局',
  snapshot_problem: '快照题',
  recall_segment: '复盘',
}

const PHASE_LABELS = {
  play: 'Play',
  recall: 'Recall',
  analysis: 'Analysis',
}

function WorkbenchTabItem({tab, active, onSwitch, onClose}) {
  let handleSwitch = (e) => {
    e.stopPropagation()
    onSwitch(tab.id)
  }

  let handleClose = (e) => {
    e.stopPropagation()
    onClose(tab.id)
  }

  let sourceLabel = SOURCE_LABELS[tab.sourceKind] ?? tab.sourceKind ?? ''
  let phaseLabel = PHASE_LABELS[tab.phase] ?? tab.phase

  return h(
    'button',
    {
      type: 'button',
      class: classNames('workbench-tab-bar__tab', {
        active,
      }),
      onClick: handleSwitch,
    },
    h('span', {class: 'workbench-tab-bar__label'}, `${sourceLabel} · ${phaseLabel}`),
    h('span', {
      class: 'workbench-tab-bar__close',
      onClick: handleClose,
      title: '关闭',
    }, '×'),
  )
}

export default function WorkbenchTabBar({tabs, activeTabId, onSwitchTab, onCloseTab}) {
  if (!tabs || tabs.length === 0) return null

  return h(
    'div',
    {class: 'workbench-tab-bar'},
    tabs.map((tab) =>
      h(WorkbenchTabItem, {
        key: tab.id,
        tab,
        active: tab.id === activeTabId,
        onSwitch: onSwitchTab,
        onClose: onCloseTab,
      }),
    ),
  )
}
