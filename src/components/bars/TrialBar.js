import {h} from 'preact'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import Bar from './Bar.js'

const t = i18n.context('TrialBar')

export default function TrialBar({mode, moveCount = 0}) {
  return h(
    Bar,
    {type: 'trial', mode},
    h(
      'span',
      {class: 'status'},
      t((p) => `Trial line · ${p.count} moves`, {count: moveCount}),
    ),
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          sabaki.undoTrialMove()
        },
      },
      t('Undo'),
    ),
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          sabaki.resetTrialWorkspace()
        },
      },
      t('Reset'),
    ),
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          sabaki.applyTrialAsVariation()
        },
      },
      t('Apply Variation'),
    ),
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          sabaki.setMode('baseline')
        },
      },
      t('Back to Baseline'),
    ),
  )
}
