import {h} from 'preact'

import SectionCard from '../shared/SectionCard.js'
import MetricCard from '../shared/MetricCard.js'
import StatusChip from '../shared/StatusChip.js'

export default function RecallModePanel() {
  let current = 28
  let total = 78
  let correct = 22
  let wrong = 6
  let skipped = 0
  let percent = Math.round((current / total) * 100)

  return h('div', {class: 'wb-recall-panel'},
    // Card 1 - 回忆进度
    h(SectionCard, {title: '回忆进度', icon: '📈'},
      h('div', {class: 'wb-recall-panel__progress-wrap'},
        h('div', {class: 'wb-recall-panel__progress-bar'},
          h('div', {
            class: 'wb-recall-panel__progress-fill',
            style: `width: ${percent}%`,
          }),
        ),
        h('div', {class: 'wb-recall-panel__progress-text'},
          `${current}/${total} (${percent}%)`),
      ),
      h('div', {class: 'wb-recall-panel__stats-row'},
        h(MetricCard, {label: '正确', value: `${correct}`}),
        h(MetricCard, {label: '错误', value: `${wrong}`}),
        h(MetricCard, {label: '跳过', value: `${skipped}`}),
      ),
    ),

    // Card 2 - 当前手
    h(SectionCard, {title: '当前手', icon: '✋'},
      h('div', {class: 'wb-recall-panel__prompt'},
        h('strong', {}, `请回忆第 ${current} 手`),
      ),
      h('div', {class: 'wb-recall-panel__row'},
        h(MetricCard, {label: '当前执棋', value: h(StatusChip, {label: '● 黑', type: 'default'})}),
      ),
    ),

    // Card 3 - 轻提示
    h(SectionCard, {title: '轻提示', icon: '💭'},
      h('p', {class: 'wb-recall-panel__hint-text'},
        '需要时可进入 Analysis 查证',
      ),
      h('p', {class: 'wb-recall-panel__hint-muted'},
        '但 Analysis 是自由研究，不是 Recall 答案页',
      ),
    ),
  )
}
