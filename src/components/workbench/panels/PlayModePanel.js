import {h} from 'preact'

import SectionCard from '../shared/SectionCard.js'
import MetricCard from '../shared/MetricCard.js'
import StatusChip from '../shared/StatusChip.js'
import AiStatusCard from '../shared/AiStatusCard.js'

export default function PlayModePanel() {
  return h('div', {class: 'wb-play-panel'},
    // Card 1 - 当前对局
    h(SectionCard, {title: '当前对局', icon: '⚫'},
      h('div', {class: 'wb-play-panel__row'},
        h(MetricCard, {label: '状态', value: h(StatusChip, {label: '进行中', type: 'active'})}),
      ),
      h('div', {class: 'wb-play-panel__row'},
        h(MetricCard, {label: '轮到', value: '● 黑棋'}),
      ),
      h('div', {class: 'wb-play-panel__row'},
        h(MetricCard, {label: '对局时间', value: '00:12:34'}),
      ),
    ),

    // Card 2 - 对弈设置
    h(SectionCard, {title: '对弈设置', icon: '⚙'},
      h('div', {class: 'wb-play-panel__row'},
        h(MetricCard, {label: '黑棋', value: 'Human'}),
      ),
      h('div', {class: 'wb-play-panel__row'},
        h('div', {class: 'wb-play-panel__setting'},
          h('span', {class: 'wb-play-panel__setting-label'}, '白棋'),
          h(AiStatusCard, {engineName: 'KataGo', connected: true}),
        ),
      ),
      h('div', {class: 'wb-play-panel__row'},
        h('div', {class: 'wb-play-panel__toggle-row'},
          h('span', {class: 'wb-play-panel__toggle-label'}, 'AI 自动落子'),
          h('label', {class: 'wb-play-panel__toggle'},
            h('input', {type: 'checkbox', checked: true, class: 'wb-play-panel__toggle-input'}),
            h('span', {class: 'wb-play-panel__toggle-slider'}),
          ),
        ),
      ),
    ),

    // Card 3 - 本局训练统计
    h(SectionCard, {title: '本局训练统计', icon: '📊'},
      h('div', {class: 'wb-play-panel__stats-grid'},
        h(MetricCard, {label: '手数', value: '12'}),
        h(MetricCard, {label: '提子', value: '黑 0 / 白 0'}),
        h(MetricCard, {label: 'pending evaluation', value: '2', change: null}),
        h(MetricCard, {label: 'bad move', value: '0', change: null}),
      ),
    ),
  )
}
