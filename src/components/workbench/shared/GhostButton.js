import {h} from 'preact'

export default function GhostButton({label, icon, disabled = false, onClick}) {
  return h(
    'button',
    {class: 'wb-btn wb-btn-ghost', disabled, onClick},
    icon ? [h('span', {class: 'wb-btn__icon'}, icon), label] : label
  )
}
