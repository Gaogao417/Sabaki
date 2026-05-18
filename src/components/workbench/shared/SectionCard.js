import {h} from 'preact'

export default function SectionCard({title, icon, action, children}) {
  return h('div', {class: 'wb-section-card'}, [
    h('div', {class: 'wb-section-card__header'}, [
      icon && h('span', {class: 'wb-section-card__icon'}, icon),
      h('span', {class: 'wb-section-card__title'}, title),
      action && h('div', {class: 'wb-section-card__action'}, action)
    ]),
    h('div', {class: 'wb-section-card__body'}, children)
  ])
}
