import {h} from 'preact'

const DEFAULT_ITEMS = [
  {id: 1, title: '星位定式复习', mode: 'problem', dueDate: '2026-05-18', overdue: false},
  {id: 2, title: '角部死活练习', mode: 'problem', dueDate: '2026-05-16', overdue: true},
  {id: 3, title: '布局纠错', mode: 'play', dueDate: '2026-05-20', overdue: false},
]

function formatDate(dateStr) {
  return dateStr
}

export default function ReviewInboxList({
  items = DEFAULT_ITEMS,
}) {
  return h('div', {class: 'wb-review-inbox'},
    h('div', {class: 'wb-review-inbox__header'}, `待复习 (${items.length})`),
    h('ul', {class: 'wb-review-inbox__list'},
      items.map((item) =>
        h('li', {class: 'wb-review-inbox__item', key: item.id},
          h('span', {class: 'wb-review-inbox__title'}, item.title),
          h('span', {
            class: `wb-review-inbox__chip wb-review-inbox__chip--${item.mode}`,
          }, item.mode),
          h('span', {class: 'wb-review-inbox__due'},
            item.overdue
              ? h('span', {class: 'wb-review-inbox__overdue'}, '已逾期')
              : formatDate(item.dueDate)
          )
        )
      )
    )
  )
}
