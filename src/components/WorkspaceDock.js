import {h} from 'preact'

import i18n from '../i18n.js'
import OverlayStatusBar from './overlays/OverlayStatusBar.js'

const t = i18n.context('WorkspaceDock')

export default function WorkspaceDock({
  mode,
  editWorkspaceActive,
  overlayStatusProps = null,
  summaryText = null,
  children,
}) {
  let activePanel =
    editWorkspaceActive
      ? t('Edit Workspace')
      : mode === 'edit'
        ? t('Edit Tools')
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
      summaryText != null && h('span', {class: 'workspace-dock__summary'}, summaryText),
    ),
    overlayStatusProps != null && h(OverlayStatusBar, overlayStatusProps),
    h('section', {class: 'workspace-stack'}, children),
  )
}
