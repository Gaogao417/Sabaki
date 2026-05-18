import {h} from 'preact'

export default function HintCard({
  hintIndex = 1,
  totalHints = 3,
  hintText = '注意角部的扳接手筋',
  onRequestNext,
  canRequestMore = true,
}) {
  return h('div', {class: 'wb-hint-card'},
    h('div', {class: 'wb-hint-card__header'},
      h('span', {class: 'wb-hint-card__index'}, `Hint ${hintIndex}/${totalHints}`)
    ),
    h('p', {class: 'wb-hint-card__text'}, hintText),
    canRequestMore &&
      h('button', {
        class: 'wb-hint-card__btn',
        onClick: onRequestNext,
      }, '请求下一条提示')
  )
}
