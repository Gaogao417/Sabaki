import {h, Component} from 'preact'

import i18n from '../i18n.js'

const t = i18n.context('WorkspaceDock')

export default class WorkspaceDock extends Component {
  render({mode, editWorkspaceActive, summary, children}) {
    let isReviewDock = editWorkspaceActive || mode === 'analysis'
    let isPassiveDock = mode === 'play' || mode === 'recall'
    let activePanel = isReviewDock
      ? '复盘工作区'
      : mode === 'play'
        ? '棋盘工作区'
        : mode === 'recall'
          ? '回忆'
          : mode === 'problem'
            ? '当前题目'
            : mode === 'review'
              ? '复习'
              : mode === 'find'
                ? t('Find')
                : mode === 'guess'
                  ? t('Guess')
                  : mode === 'autoplay'
                    ? t('Autoplay')
                    : ['scoring', 'estimator'].includes(mode)
                      ? t('Scoring')
                      : '棋盘工作区'

    let shouldShowContent = isReviewDock || !isPassiveDock

    return h(
      'section',
      {
        class: `workspace-dock ${isReviewDock ? 'workspace-dock--review' : ''} ${isPassiveDock ? 'workspace-dock--passive' : ''}`,
      },
      h(
        'div',
        {class: 'workspace-dock__header'},
        h('strong', {}, activePanel),
        (isReviewDock || isPassiveDock) &&
          h('span', {class: 'workspace-dock__summary'}, summary),
      ),
      shouldShowContent && h('section', {class: 'workspace-stack'}, children),
    )
  }
}
