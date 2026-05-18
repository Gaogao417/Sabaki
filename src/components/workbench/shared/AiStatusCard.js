import {h} from 'preact'

export default function AiStatusCard({
  engineName = 'KataGo',
  connected = false,
  label,
}) {
  let statusText = connected ? '已连接' : '未连接'
  let displayLabel = label || engineName

  return h('div', {class: 'wb-ai-status-card'},
    h('span', {
      class: `wb-ai-status-card__dot ${connected ? 'wb-ai-status-card__dot--connected' : 'wb-ai-status-card__dot--disconnected'}`,
    }),
    h('span', {class: 'wb-ai-status-card__name'}, displayLabel),
    h('span', {class: 'wb-ai-status-card__status'}, statusText)
  )
}
