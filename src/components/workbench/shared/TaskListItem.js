import {h} from 'preact'
import ModeChip from './ModeChip.js'

export default function TaskListItem({
  title = '未命名任务',
  mode = 'play',
  active = false,
  onClick,
}) {
  return h('div', {
    class: `wb-task-item ${active ? 'wb-task-item--active' : ''}`,
    onClick,
  },
    h('span', {class: 'wb-task-item__title'}, title),
    h(ModeChip, {mode}),
    active && h('span', {class: 'wb-task-item__indicator'}, '●')
  )
}
