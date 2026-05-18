import {h} from 'preact'

import SectionCard from '../shared/SectionCard.js'
import MetricCard from '../shared/MetricCard.js'
import StatusChip from '../shared/StatusChip.js'
import HintCard from '../shared/HintCard.js'
import AiStatusCard from '../shared/AiStatusCard.js'

export default function ProblemModePanel() {
  return h('div', {class: 'wb-problem-panel'},
    // Card 1 - 题目信息
    h(SectionCard, {title: '题目信息', icon: '🎯'},
      h('div', {class: 'wb-problem-panel__row'},
        h(MetricCard, {label: '题面', value: '左上角黑棋的攻击'}),
      ),
      h('div', {class: 'wb-problem-panel__row'},
        h(MetricCard, {label: '目标', value: '攻击并杀白棋全部'}),
      ),
      h('div', {class: 'wb-problem-panel__row'},
        h(MetricCard, {label: 'PassRule', value: '允许'}),
      ),
      h('div', {class: 'wb-problem-panel__row'},
        h(MetricCard, {label: '当前执棋', value: h(StatusChip, {label: '黑先', type: 'default'})}),
      ),
    ),

    // Card 2 - AI 对手
    h(SectionCard, {title: 'AI 对手', icon: '🤖'},
      h('div', {class: 'wb-problem-panel__row'},
        h(MetricCard, {label: '对手', value: 'AI / 自己'}),
      ),
      h('div', {class: 'wb-problem-panel__row'},
        h('div', {class: 'wb-problem-panel__ai-row'},
          h('span', {class: 'wb-problem-panel__ai-label'}, '引擎'),
          h(AiStatusCard, {engineName: 'KataGo', connected: true}),
        ),
      ),
      h('div', {class: 'wb-problem-panel__row'},
        h(MetricCard, {label: '题目范围', value: '已设置'}),
      ),
      h('div', {class: 'wb-problem-panel__row'},
        h(MetricCard, {label: '范围外落子', value: '禁止'}),
      ),
      h('div', {class: 'wb-problem-panel__row'},
        h('a', {
          class: 'wb-problem-panel__link',
          href: '#',
          onClick: (e) => e.preventDefault(),
        }, '更多设置 >'),
      ),
    ),

    // Card 3 - 下一步 (Hint)
    h(SectionCard, {title: '下一步', icon: '💡'},
      h(HintCard, {
        hintIndex: 1,
        totalHints: 3,
        hintText: '先在角上制造要点，扩大效果。',
        canRequestMore: true,
        onRequestNext: null,
      }),
      h('div', {class: 'wb-problem-panel__hint-note'},
        h('span', {class: 'wb-problem-panel__hint-muted'}, '参考变化：提交后或 Analysis 中查看'),
      ),
    ),
  )
}
