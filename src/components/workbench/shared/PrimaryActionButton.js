import {h} from 'preact'

export default function PrimaryActionButton({label, icon, disabled = false, onClick}) {
  return h(
    'button',
    {class: 'wb-btn wb-btn-primary', disabled, onClick},
    icon ? [h('span', {class: 'wb-btn__icon'}, icon), label] : label
  )
}
