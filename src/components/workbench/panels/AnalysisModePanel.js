import {h, Component} from 'preact'

import SectionCard from '../shared/SectionCard.js'
import BadMoveSummaryCard from '../shared/BadMoveSummaryCard.js'
import MetricCard from '../shared/MetricCard.js'
import StatusChip from '../shared/StatusChip.js'

const TABS = ['坏手分析', '候选点', '变化图', '评论', 'Snapshot']

class AnalysisModePanel extends Component {
  constructor(props) {
    super(props)
    this.state = {activeTab: 0}
    this.handleTabClick = (index) => {
      this.setState({activeTab: index})
    }
  }

  render(_, {activeTab}) {
    return h('div', {class: 'wb-analysis-panel'},
      // Channel tabs
      h('div', {class: 'wb-analysis-panel__tabs'},
        TABS.map((tab, i) =>
          h('button', {
            key: i,
            class: `wb-analysis-panel__tab ${i === activeTab ? 'wb-analysis-panel__tab--active' : ''}`,
            onClick: () => this.handleTabClick(i),
          }, tab),
        ),
      ),

      // Tab content (default: 坏手分析)
      activeTab === 0 && h('div', {class: 'wb-analysis-panel__content'},
        // Card 1 - 最大问题手
        h(SectionCard, {title: '最大问题手', icon: '❗'},
          h(BadMoveSummaryCard, {
            moveNumber: 33,
            loss: '6.8',
            description: '此手伸进左上角的主动权却未取得...',
            userMove: 'D7',
            aiMove: 'E6',
          }),
        ),

        // Card 2 - 用户 vs AI
        h(SectionCard, {title: '用户 vs AI', icon: '⚔'},
          h('div', {class: 'wb-analysis-panel__comparison'},
            h(MetricCard, {label: '用户下法', value: 'D7'}),
            h(MetricCard, {label: 'AI 推荐', value: 'E6'}),
            h('div', {class: 'wb-analysis-panel__verdict'},
              h(MetricCard, {label: '评价', value: h(StatusChip, {label: '好手', type: 'good'})}),
            ),
          ),
        ),

        // Card 3 - 要点总结
        h(SectionCard, {title: '要点总结', icon: '📋'},
          h('ul', {class: 'wb-analysis-panel__key-points'},
            h('li', {class: 'wb-analysis-panel__key-point'},
              '白棋 E6 扳可以持续保持对左上角的压力。',
            ),
            h('li', {class: 'wb-analysis-panel__key-point'},
              '此时 D7 过早靠住...',
            ),
            h('li', {class: 'wb-analysis-panel__key-point'},
              '建议优先在外面行棋...',
            ),
          ),
        ),
      ),

      // Placeholder content for other tabs
      activeTab !== 0 && h('div', {class: 'wb-analysis-panel__content'},
        h(SectionCard, {title: TABS[activeTab]},
          h('div', {class: 'wb-analysis-panel__placeholder'},
            h('span', {}, `${TABS[activeTab]} 内容加载中...`),
          ),
        ),
      ),
    )
  }
}

export default AnalysisModePanel
