import {h} from 'preact'

const MODE_LABELS = {
  play: '对局面板',
  problem: '题目面板',
  recall: '复棋面板',
  analysis: '分析面板',
}

/**
 * RightModePanel renders mode-specific content in the right panel area.
 * Phase 4: placeholder content only.
 *
 * @param {Object} props
 * @param {'play'|'problem'|'recall'|'analysis'} props.mode - Current mode
 */
export default function RightModePanel({mode = 'play'}) {
  const label = MODE_LABELS[mode] || mode

  return h('div', {
    'data-testid': 'right-mode-panel',
    class: 'wb-right-mode-panel',
  },
    h('div', {
      'data-testid': 'right-panel-content',
      class: 'wb-right-mode-panel__content',
    }, label),
  )
}
