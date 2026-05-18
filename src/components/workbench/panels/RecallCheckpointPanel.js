import {h} from 'preact'

import SectionCard from '../shared/SectionCard.js'
import StatusChip from '../shared/StatusChip.js'
import CommentBox from '../shared/CommentBox.js'

export default function RecallCheckpointPanel() {
  let checkpointMove = 28
  let correctionMin = 1

  return h('div', {class: 'wb-recall-checkpoint-panel'},
    // Card 1 - 检查点
    h(SectionCard, {title: '检查点', icon: '⚠'},
      h('div', {class: 'wb-recall-checkpoint-panel__checkpoint'},
        h('strong', {class: 'wb-recall-checkpoint-panel__move-label'},
          `检查点：第 ${checkpointMove} 手`,
        ),
        h('div', {class: 'wb-recall-checkpoint-panel__badge-row'},
          h(StatusChip, {label: '严重问题手', type: 'warning'}),
        ),
        h('p', {class: 'wb-recall-checkpoint-panel__desc'},
          '你在此处下出了重大恶手',
        ),
      ),
    ),

    // Card 2 - 修正任务
    h(SectionCard, {title: '修正任务', icon: '✏'},
      h('div', {class: 'wb-recall-checkpoint-panel__task'},
        h('p', {class: 'wb-recall-checkpoint-panel__task-instruction'},
          '请先绘制一条修正线',
        ),
        h('p', {class: 'wb-recall-checkpoint-panel__task-requirement'},
          `至少需要 ${correctionMin} 手修正`,
        ),
        h('div', {class: 'wb-recall-checkpoint-panel__progress-indicator'},
          h('div', {class: 'wb-recall-checkpoint-panel__progress-bar'},
            h('div', {
              class: 'wb-recall-checkpoint-panel__progress-fill',
              style: 'width: 0%',
            }),
          ),
          h('span', {class: 'wb-recall-checkpoint-panel__progress-label'}, '0 / 1'),
        ),
      ),
    ),

    // Card 3 - 快速笔记
    h(SectionCard, {title: '快速笔记', icon: '📝'},
      h(CommentBox, {
        value: '',
        maxLength: 200,
        placeholder: '记录你在此处的思考、发现或计划',
        onChange: null,
      }),
    ),
  )
}
