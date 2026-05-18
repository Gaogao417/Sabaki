import {h} from 'preact'

const MODE_LABELS = {
  play: '对局模式',
  problem: '题目模式',
  recall: '回忆模式',
  analysis: '复盘模式',
}

export default function RightModePanel({
  mode = 'problem',
  children,
}) {
  return h(
    'aside',
    {class: 'wb-right-panel'},

    h(
      'div',
      {class: 'wb-right-panel__header'},
      h('span', {class: 'wb-right-panel__mode-label'}, MODE_LABELS[mode] || mode),
    ),

    h(
      'div',
      {class: 'wb-right-panel__content'},
      children || h('div', {class: 'wb-right-panel__placeholder'}, '暂无内容'),
    ),
  )
}
