import {h} from 'preact'

import i18n from '../i18n.js'

const t = i18n.context('WorkspaceDock')

export default function WorkspaceDock({mode, editWorkspaceActive, children}) {
  let activePanel =
    editWorkspaceActive
      ? t('Analysis Workspace')
      : mode === 'analysis'
        ? t('Analysis Tools')
        : mode === 'recall'
          ? t('Recall')
          : mode === 'problem'
            ? t('Problem')
            : mode === 'review'
              ? t('Review')
        : mode === 'find'
          ? t('Find')
          : mode === 'guess'
            ? t('Guess')
            : mode === 'autoplay'
              ? t('Autoplay')
              : ['scoring', 'estimator'].includes(mode)
                ? t('Scoring')
                : t('Board Workspace')

  return h(
    'section',
    {class: 'workspace-dock'},
    h(
      'div',
      {class: 'workspace-dock__header'},
      h('strong', {}, activePanel),
    ),
    h('section', {class: 'workspace-stack'}, children),
  )
}
