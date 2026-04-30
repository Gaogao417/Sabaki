import {h, Component} from 'preact'

import i18n from '../i18n.js'
import sabaki from '../modules/sabaki.js'

const t = i18n.context('WorkspaceDock')

export default class WorkspaceDock extends Component {
  render({mode, editWorkspaceActive, summary, treePosition, children}) {
    let isReviewDock = editWorkspaceActive || mode === 'analysis'
    let isPassiveDock = mode === 'play' || mode === 'recall'
    let activePanel = isReviewDock
      ? '复盘工作区'
      : mode === 'play'
        ? '对局工作区'
        : mode === 'recall'
          ? '回忆工作区'
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
    let simpleTools =
      isPassiveDock &&
      h(
        'div',
        {class: 'workspace-dock__tools'},
        h(
          'button',
          {type: 'button', class: 'dock-tool', onClick: () => sabaki.undo()},
          '悔棋',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'dock-tool',
            onClick: () => sabaki.makeMove([-1, -1]),
          },
          '停一手',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'dock-tool dock-tool--danger',
            onClick: () => sabaki.makeResign(),
          },
          '认输',
        ),
        h('span', {class: 'dock-divider'}),
        h(
          'button',
          {
            type: 'button',
            class: 'dock-tool dock-tool--active',
            onClick: () =>
              sabaki.setComment(treePosition || sabaki.state.treePosition, {
                hotspot: true,
                moveAnnotation: 'IT',
              }),
          },
          '标记重点复盘',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'dock-tool',
            onClick: () => sabaki.setMode('analysis'),
          },
          '重点复盘',
        ),
      )

    return h(
      'section',
      {
        class: `workspace-dock ${isReviewDock ? 'workspace-dock--review' : ''} ${isPassiveDock ? 'workspace-dock--passive' : ''}`,
      },
      h(
        'div',
        {class: 'workspace-dock__header'},
        h(
          'div',
          {class: 'workspace-dock__status'},
          h('strong', {}, activePanel),
          (isReviewDock || isPassiveDock) &&
            h('span', {class: 'workspace-dock__summary'}, summary),
        ),
        simpleTools,
      ),
      shouldShowContent && h('section', {class: 'workspace-stack'}, children),
      isReviewDock &&
        h(
          'div',
          {class: 'workspace-dock__review-actions'},
          h('button', {type: 'button', class: 'dock-tool'}, '撤销'),
          h(
            'button',
            {type: 'button', class: 'dock-tool', disabled: true},
            '重做',
          ),
          h('button', {type: 'button', class: 'dock-tool'}, '清空'),
          h('button', {type: 'button', class: 'dock-tool'}, '100%'),
        ),
    )
  }
}
