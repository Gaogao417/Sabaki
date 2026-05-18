import {h} from 'preact'

export default function BadMoveSummaryCard({
  moveNumber = 42,
  loss = '3.5',
  description = '此手方向错误，应先处理角部薄弱之处',
  userMove = 'D4',
  aiMove = 'Q16',
}) {
  return h('div', {class: 'wb-bad-move-summary'},
    h('div', {class: 'wb-bad-move-summary__header'},
      h('span', {class: 'wb-bad-move-summary__title'},
        `第 ${moveNumber} 手，亏 ${loss} 目`
      )
    ),
    h('p', {class: 'wb-bad-move-summary__desc'}, description),
    h('div', {class: 'wb-bad-move-summary__comparison'},
      h('span', {class: 'wb-bad-move-summary__move wb-bad-move-summary__move--user'},
        `你的落子: ${userMove}`
      ),
      h('span', {class: 'wb-bad-move-summary__move wb-bad-move-summary__move--ai'},
        `AI 推荐: ${aiMove}`
      )
    )
  )
}
