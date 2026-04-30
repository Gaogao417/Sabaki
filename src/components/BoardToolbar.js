import {h, Component} from 'preact'
import classNames from 'classnames'

import i18n from '../i18n.js'
import sabaki from '../modules/sabaki.js'
import * as helper from '../modules/helper.js'
import TextSpinner from './TextSpinner.js'

const t = i18n.context('BoardToolbar')

function ToolbarButton({
  icon,
  label,
  title = null,
  shortcut = null,
  selected = false,
  accent = false,
  disabled = false,
  onClick,
}) {
  let tooltip = title || label
  if (shortcut != null) tooltip += ` (${shortcut})`

  return h(
    'a',
    {
      href: '#',
      title: tooltip,
      class: classNames('toolbar-button', {selected, accent, disabled}),
      'aria-disabled': disabled,
      onClick: (evt) => {
        evt.preventDefault()
        if (disabled) return
        onClick?.()
      },
    },
    icon ? h('img', {src: icon, width: 16, height: 16, alt: label}) : label,
  )
}

function WorkbenchButton({variant = 'secondary', icon, label, onClick}) {
  return h(
    'button',
    {
      type: 'button',
      class: classNames('workbench-button', `workbench-button--${variant}`),
      onClick,
    },
    icon && h('img', {src: icon, width: 14, height: 14, alt: ''}),
    h('span', {}, label),
  )
}

function ModeTab({
  mode,
  active,
  disabled = false,
  label,
  icon,
  accent,
  title = null,
  onClick,
}) {
  return h(
    'button',
    {
      type: 'button',
      class: classNames('mode-tab', `mode-tab--${accent}`, {
        active,
        disabled,
      }),
      disabled,
      title,
      onClick: () => onClick(mode),
    },
    h('img', {src: icon, width: 15, height: 15, alt: ''}),
    h('span', {}, label),
  )
}

export default class BoardToolbar extends Component {
  constructor(props) {
    super(props)

    this.state = {
      playerBusy: [false, false],
    }

    this.syncState = () => {
      this.setState({
        playerBusy: this.props.engineSyncers.map((syncer) =>
          syncer == null ? false : syncer.busy,
        ),
      })
    }

    this.handleMenuClick = () => {
      let {left, top, height} = this.menuButtonElement.getBoundingClientRect()

      helper.popupMenu(
        [
          {
            label: t('&Pass'),
            click: () => sabaki.makeMove([-1, -1]),
          },
          {
            label: t('&Resign'),
            click: () => sabaki.makeResign(),
          },
          {type: 'separator'},
          {
            label: t('Es&timate'),
            click: () => sabaki.setMode('estimator'),
          },
          {
            label: t('&Score'),
            click: () => sabaki.setMode('scoring'),
          },
          {
            label: t('&Find'),
            click: () => sabaki.setMode('find'),
          },
          {
            label: t('&Autoplay'),
            click: () => sabaki.setMode('autoplay'),
          },
          {type: 'separator'},
          {
            label: t('&Info'),
            click: () => sabaki.openDrawer('info'),
          },
        ],
        left,
        top + height,
      )
    }

    for (let syncer of this.props.engineSyncers) {
      if (syncer == null) continue
      syncer.on('busy-changed', this.syncState)
    }
  }

  componentWillReceiveProps(nextProps) {
    for (let i = 0; i < nextProps.engineSyncers.length; i++) {
      if (nextProps.engineSyncers !== this.props.engineSyncers) {
        if (this.props.engineSyncers[i] != null) {
          this.props.engineSyncers[i].removeListener(
            'busy-changed',
            this.syncState,
          )
        }

        if (nextProps.engineSyncers[i] != null) {
          nextProps.engineSyncers[i].on('busy-changed', this.syncState)
        }
      }
    }
  }

  componentWillUnmount() {
    for (let syncer of this.props.engineSyncers) {
      syncer?.removeListener('busy-changed', this.syncState)
    }
  }

  renderPlayer(sign, player, rank, captures, syncer, busy) {
    return h(
      'div',
      {
        class: classNames('toolbar-player', {
          black: sign > 0,
          white: sign < 0,
          engine: syncer != null,
        }),
      },
      h('span', {class: 'stone-indicator'}, ''),
      h(
        'div',
        {class: 'toolbar-player__text'},
        h(
          'span',
          {
            class: 'name',
            title: syncer != null ? t('Engine') : player,
          },
          sign > 0 ? '黑棋' : '白棋',
        ),
        h('span', {class: 'captures'}, `提子 ${captures}`),
      ),
      syncer == null && rank && h('span', {class: 'rank'}, rank),
      syncer != null && busy && h(TextSpinner),
    )
  }

  renderModeActions(mode) {
    if (mode === 'play' || mode === 'recall') {
      return [
        h(WorkbenchButton, {
          variant: 'primary',
          icon: './node_modules/@primer/octicons/build/svg/plus.svg',
          label: '新对局',
          onClick: () => sabaki.newFile({playSound: true, showInfo: true}),
        }),
        h(WorkbenchButton, {
          icon: './node_modules/@primer/octicons/build/svg/gear.svg',
          label: '对局设置',
          onClick: () => sabaki.openDrawer('info'),
        }),
        h(WorkbenchButton, {
          variant: 'danger',
          icon: './node_modules/@primer/octicons/build/svg/stop.svg',
          label: '认输',
          onClick: () => sabaki.makeResign(),
        }),
      ]
    }

    if (mode === 'analysis') {
      return [
        h(WorkbenchButton, {
          variant: 'primary',
          icon: './node_modules/@primer/octicons/build/svg/pencil.svg',
          label: '新建题目',
          onClick: () => sabaki.snapshotAsProblem(),
        }),
        h(WorkbenchButton, {
          icon: './node_modules/@primer/octicons/build/svg/gear.svg',
          label: '复盘设置',
          onClick: () => sabaki.openDrawer('preferences'),
        }),
        h(WorkbenchButton, {
          icon: './node_modules/@primer/octicons/build/svg/list-unordered.svg',
          label: '',
          onClick: () => sabaki.resetAnalysisWorkspace(),
        }),
        h(WorkbenchButton, {
          variant: 'danger',
          icon: './node_modules/@primer/octicons/build/svg/stop.svg',
          label: '认输',
          onClick: () => sabaki.makeResign(),
        }),
      ]
    }

    return null
  }

  render(
    {
      mode,
      editWorkspaceActive,
      territoryEnabled,
      territoryCompareEnabled,
      territoryCompareAvailable = false,
      currentPlayer,
      playerNames,
      playerRanks,
      playerCaptures,
      engineSyncers,
      enginePanelOpen,
      recallSession,
      openDrawer,
      onCurrentPlayerClick = helper.noop,
      onEnginePanelToggle = helper.noop,
    },
    {playerBusy},
  ) {
    let workbenchMode = ['play', 'recall', 'analysis'].includes(mode)
    let modes = [
      {
        mode: 'play',
        label: '对局模式',
        icon: './node_modules/@primer/octicons/build/svg/play.svg',
        accent: 'play',
        active: mode === 'play',
      },
      {
        mode: 'recall',
        label: '回忆模式',
        icon: './node_modules/@primer/octicons/build/svg/light-bulb.svg',
        accent: 'recall',
        active: mode === 'recall',
        disabled: recallSession == null,
        title:
          recallSession == null ? '暂无回忆任务，请从训练面板开始。' : null,
      },
      {
        mode: 'analysis',
        label: '复盘模式',
        icon: './node_modules/@primer/octicons/build/svg/pencil.svg',
        accent: 'analysis',
        active: mode === 'analysis',
      },
    ]

    let handleModeSelect = (nextMode) => {
      sabaki.setMode(nextMode)
    }

    return h(
      'section',
      {class: 'board-toolbar mode-bar'},
      h(
        'div',
        {class: 'toolbar-group toolbar-players'},
        this.renderPlayer(
          1,
          playerNames[0] || t('Black'),
          playerRanks[0],
          playerCaptures[0],
          engineSyncers[0],
          playerBusy[0],
        ),
        h(
          'a',
          {
            href: '#',
            class: 'toolbar-current-player',
            title: t('Change Player'),
            onClick: (evt) => {
              evt.preventDefault()
              onCurrentPlayerClick()
            },
          },
          h('img', {
            src: `./img/ui/player_${currentPlayer}.svg`,
            height: 21,
            alt: currentPlayer < 0 ? t('White to play') : t('Black to play'),
          }),
        ),
        this.renderPlayer(
          -1,
          playerNames[1] || t('White'),
          playerRanks[1],
          playerCaptures[1],
          engineSyncers[1],
          playerBusy[1],
        ),
      ),
      h(
        'nav',
        {class: 'mode-tabs', 'aria-label': 'Workbench modes'},
        modes.map((item) =>
          h(ModeTab, {
            key: item.mode,
            ...item,
            onClick: handleModeSelect,
          }),
        ),
      ),
      h(
        'div',
        {class: 'toolbar-group toolbar-controls'},
        h('div', {class: 'mode-actions'}, this.renderModeActions(mode)),
        !workbenchMode &&
          h(
            'div',
            {class: 'toolbar-group toolbar-actions toolbar-overlays'},
            h(ToolbarButton, {
              icon: './node_modules/@primer/octicons/build/svg/server.svg',
              label: '引擎',
              selected: enginePanelOpen,
              accent: enginePanelOpen,
              onClick: onEnginePanelToggle,
            }),
            h(ToolbarButton, {
              icon: './node_modules/@primer/octicons/build/svg/eye.svg',
              label: t('Territory'),
              shortcut: 'T',
              selected: territoryEnabled,
              accent: territoryEnabled,
              onClick: () => sabaki.toggleTerritoryEnabled(),
            }),
            territoryEnabled &&
              editWorkspaceActive &&
              h(ToolbarButton, {
                icon: './node_modules/@primer/octicons/build/svg/git-compare.svg',
                label: t('Territory Compare'),
                shortcut: 'Shift+T',
                selected: territoryCompareEnabled,
                accent: territoryCompareEnabled,
                disabled: !territoryCompareAvailable,
                onClick: () => sabaki.toggleTerritoryCompareEnabled(),
              }),
          ),
        !workbenchMode &&
          h(
            'a',
            {
              ref: (el) => (this.menuButtonElement = el),
              href: '#',
              class: 'toolbar-menu',
              title: t('More Actions'),
              onClick: (evt) => {
                evt.preventDefault()
                this.handleMenuClick()
              },
            },
            h('img', {
              src: './node_modules/@primer/octicons/build/svg/three-bars.svg',
              height: 18,
              alt: t('More Actions'),
            }),
          ),
      ),
    )
  }
}
