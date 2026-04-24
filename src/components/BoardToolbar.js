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
  selected = false,
  accent = false,
  disabled = false,
  onClick,
}) {
  return h(
    'a',
    {
      href: '#',
      title: title || label,
      class: classNames('toolbar-button', {selected, accent, disabled}),
      'aria-disabled': disabled,
      onClick: (evt) => {
        evt.preventDefault()
        if (disabled) return
        onClick?.()
      },
    },
    icon
      ? h('img', {src: icon, width: 16, height: 16, alt: label})
      : label,
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
      h('span', {class: 'stone-indicator'}, sign > 0 ? t('B') : t('W')),
      h(
        'span',
        {
          class: 'name',
          title: syncer != null ? t('Engine') : player,
        },
        syncer == null ? player : syncer.engine.name,
      ),
      syncer == null && rank && h('span', {class: 'rank'}, rank),
      syncer != null && busy && h(TextSpinner),
      h('span', {class: 'captures'}, captures),
    )
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
      onCurrentPlayerClick = helper.noop,
    },
    {playerBusy},
  ) {
    return h(
      'section',
      {class: 'board-toolbar'},
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
        'div',
        {class: 'toolbar-group toolbar-controls'},
        h(
          'div',
          {class: 'toolbar-group toolbar-actions toolbar-modes'},
          h(ToolbarButton, {
            icon: './node_modules/@primer/octicons/build/svg/play.svg',
            label: t('Play'),
            selected: mode === 'play',
            onClick: () => sabaki.setMode('play'),
          }),
          h(ToolbarButton, {
            icon: './node_modules/@primer/octicons/build/svg/pencil.svg',
            label: t('Edit'),
            selected: mode === 'edit',
            onClick: () => sabaki.setMode('edit'),
          }),
        ),
        h(
          'div',
          {class: 'toolbar-group toolbar-actions toolbar-overlays'},
          h(ToolbarButton, {
            icon: './node_modules/@primer/octicons/build/svg/eye.svg',
            label: t('Territory'),
            selected: territoryEnabled,
            accent: territoryEnabled,
            onClick: () => sabaki.toggleTerritoryEnabled(),
          }),
          territoryEnabled &&
            editWorkspaceActive &&
            h(ToolbarButton, {
              icon: './node_modules/@primer/octicons/build/svg/git-compare.svg',
              label: t('Territory Compare'),
              title: t('Compare Reference against Current'),
              selected: territoryCompareEnabled,
              accent: territoryCompareEnabled,
              disabled: !territoryCompareAvailable,
              onClick: () => sabaki.toggleTerritoryCompareEnabled(),
            }),
        ),
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
