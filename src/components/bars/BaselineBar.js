import {h} from 'preact'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import Bar from './Bar.js'

const t = i18n.context('BaselineBar')

export default function BaselineBar({
  mode,
  dirty = false,
  hasBaseline = false,
  keyPointCount = 0,
}) {
  return h(
    Bar,
    {type: 'baseline', mode},
    h(
      'span',
      {class: 'status'},
      hasBaseline
        ? t((p) => `Baseline ready · ${p.count} key points`, {
            count: keyPointCount,
          })
        : t('No baseline yet'),
    ),
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          sabaki.resetBaselineFromCurrentPosition()
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
          sabaki.saveBaselineSnapshot()
        },
      },
      dirty ? t('Save*') : t('Save'),
    ),
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          sabaki.enterTrialMode()
        },
      },
      t('Try Moves'),
    ),
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          sabaki.clearBaselineSnapshot()
        },
      },
      t('Clear'),
    ),
  )
}
