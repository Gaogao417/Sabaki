import classNames from 'classnames'
import {h, Component, toChildArray} from 'preact'

import sabaki from '../../modules/sabaki.js'
import {popupMenu, noop} from '../../modules/helper.js'
import i18n from '../../i18n.js'

import Modal from '../Modal.js'

const t = i18n.context('InfoDrawer')
const setting = {get: (key) => window.sabaki.setting.get(key)}

class InfoDrawerItem extends Component {
  render({title, children}) {
    children = toChildArray(children)

    return h(
      'li',
      {},
      h('label', {}, h('span', {}, title + ':'), children[0]),
      children.slice(1),
    )
  }
}

export default class InfoDrawer extends Component {
  constructor(props) {
    super(props)

    this.state = {
      showResult: false,
      blackName: null,
      blackRank: null,
      whiteName: null,
      whiteRank: null,
      syncerEngines: [null, null],
      gameName: null,
      eventName: null,
      gameComment: null,
      date: null,
      result: null,
      komi: null,
      handicap: 0,
      size: [null, null],
    }

    this.handleSubmitButtonClick = async (evt) => {
      evt.preventDefault()

      let emptyTree = this.props.gameTree.root.children.length === 0
      let keys = [
        'blackName',
        'blackRank',
        'whiteName',
        'whiteRank',
        'gameName',
        'eventName',
        'gameComment',
        'date',
        'result',
        'komi',
      ]

      let data = keys.reduce((acc, key) => {
        acc[key] =
          Array.isArray(this.state[key]) &&
          this.state[key].every((x) => x == null)
            ? null
            : this.state[key]
        return acc
      }, {})

      if (emptyTree) {
        data.handicap = this.state.handicap
        data.size = this.state.size
      }

      sabaki.setGameInfo(data)
      sabaki.closeDrawer()

      this.state.syncerEngines.forEach((syncerEngine, i) => {
        let playerSyncerId = null

        if (syncerEngine != null) {
          let {syncer, engine} = syncerEngine

          if (syncer == null) {
            syncer = sabaki.attachEngines([engine])[0]
          }

          playerSyncerId = syncer.id
        }

        sabaki.setState({
          [i === 0 ? 'blackEngineSyncerId' : 'whiteEngineSyncerId']:
            playerSyncerId,
        })
      })
    }

    this.handleClose = () => {
      sabaki.closeDrawer()
    }

    this.handleBoardWidthFocus = () => {
      this.combinedSizeFields = this.state.size[0] === this.state.size[1]
    }

    this.handleBoardWidthChange = (evt) => {
      let {value} = evt.currentTarget
      if (value === '' || isNaN(value)) value = null
      else value = +value

      this.setState(({size: [, height]}) => ({
        size: [value, this.combinedSizeFields ? value : height],
      }))
    }

    this.handleBoardHeightChange = (evt) => {
      let {value} = evt.currentTarget
      if (value === '' || isNaN(value)) value = null
      else value = +value

      this.setState(({size: [width]}) => ({size: [width, value]}))
    }

    this.handleSizeSwapButtonClick = () => {
      this.setState(({size}) => ({size: size.reverse()}))
    }

    this.handleSwapPlayers = () => {
      this.setState(({blackName, blackRank, whiteName, whiteRank}) => ({
        blackName: whiteName,
        whiteName: blackName,
        blackRank: whiteRank,
        whiteRank: blackRank,
      }))
    }

    this.handleDateChange = (evt) => {
      let value = evt.currentTarget.value
      this.setState({date: value || null})
    }

    this.handleShowResultClick = () => {
      this.setState({showResult: true})
    }

    this.handleInputChange = [
      'blackRank',
      'blackName',
      'whiteRank',
      'whiteName',
      'gameName',
      'eventName',
      'gameComment',
      'komi',
      'result',
      'handicap',
    ].reduce((acc, key) => {
      acc[key] = ({currentTarget}) => {
        this.setState({
          [key]: currentTarget.value === '' ? null : currentTarget.value,
        })
      }

      return acc
    }, {})

    this.handleEngineMenuClick = [0, 1].map((index) => (evt) => {
      let engines = setting.get('engines.list')
      let {attachedEngineSyncers} = this.props
      let nameKey = ['blackName', 'whiteName'][index]
      let autoName =
        this.state.syncerEngines[index] == null
          ? this.state[nameKey] == null
          : this.state[nameKey] === this.state.syncerEngines[index].engine.name

      let template = [
        {
          label: t('Manual'),
          type: 'checkbox',
          checked: this.state.syncerEngines[index] == null,
          click: () => {
            this.setState((state) => ({
              syncerEngines: Object.assign(state.syncerEngines, {
                [index]: null,
              }),
              [nameKey]: autoName ? null : state[nameKey],
            }))
          },
        },
        {type: 'separator'},
        ...attachedEngineSyncers.map((syncer) => ({
          label: syncer.engine.name || t('(Unnamed Engine)'),
          type: 'checkbox',
          checked:
            this.state.syncerEngines[index] != null &&
            this.state.syncerEngines[index].syncer === syncer,
          click: () => {
            this.setState((state) => ({
              syncerEngines: Object.assign(state.syncerEngines, {
                [index]: {syncer, engine: syncer.engine},
              }),
              [nameKey]: autoName ? syncer.engine.name : state[nameKey],
            }))
          },
        })),
        attachedEngineSyncers.length > 0 && {type: 'separator'},
        {
          label: t('Attach Engine'),
          submenu: engines.map((engine) => ({
            label: engine.name || t('(Unnamed Engine)'),
            type: 'checkbox',
            checked:
              this.state.syncerEngines[index] != null &&
              this.state.syncerEngines[index].syncer == null &&
              this.state.syncerEngines[index].engine === engine,
            click: () => {
              this.setState((state) => ({
                syncerEngines: Object.assign(state.syncerEngines, {
                  [index]: {engine},
                }),
                [nameKey]: autoName ? engine.name : state[nameKey],
              }))
            },
          })),
        },
        {
          label: t('Manage Engines…'),
          click: () => {
            sabaki.openDrawer('enginemanagement')
          },
        },
      ].filter((x) => !!x)

      let {left, bottom} = evt.currentTarget.getBoundingClientRect()
      popupMenu(template, left, bottom)
    })
  }

  componentWillReceiveProps({
    gameInfo,
    show,
    attachedEngineSyncers,
    blackEngineSyncerId,
    whiteEngineSyncerId,
  }) {
    if (!this.props.show && show) {
      this.setState({
        ...gameInfo,
        syncerEngines: [blackEngineSyncerId, whiteEngineSyncerId].map((id) => {
          let syncer = attachedEngineSyncers.find((syncer) => syncer.id === id)
          return syncer == null ? null : {syncer, engine: syncer.engine}
        }),
        showResult:
          !gameInfo.result ||
          gameInfo.result.trim() === '' ||
          setting.get('app.always_show_result') === true,
      })
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.show && this.props.show) {
      this.firstFocusElement.focus()
    }
  }

  shouldComponentUpdate({show}) {
    return show !== this.props.show || show
  }

  render(
    {gameTree, currentPlayer, show},
    {
      showResult,
      blackName,
      blackRank,
      whiteName,
      whiteRank,
      syncerEngines,
      gameName,
      eventName,
      gameComment,
      date,
      result,
      komi,
      handicap,
      size,
    },
  ) {
    let emptyTree = gameTree.root.children.length === 0

    return h(
      Modal,
      {
        show,
        title: t('Game Information'),
        onClose: this.handleClose,
        width: 'min(620px, calc(100vw - 48px))',
      },

      h(
        'form',
        {onSubmit: this.handleSubmitButtonClick},
        h(
          'div',
          {class: 'info-dialog__players'},
          h(
            'div',
            {class: 'info-dialog__player'},
            h('img', {
              tabIndex: 0,
              src: './node_modules/@primer/octicons/build/svg/chevron-down.svg',
              width: 16,
              height: 16,
              class: classNames('info-dialog__engine-menu', {
                active: syncerEngines[0] != null,
              }),
              onClick: this.handleEngineMenuClick[0],
            }),
            h('input', {
              type: 'text',
              ref: (el) => (this.firstFocusElement = el),
              placeholder: t('Black'),
              value: blackName,
              onInput: this.handleInputChange.blackName,
            }),
            h('input', {
              type: 'text',
              placeholder: t('Rank'),
              value: blackRank,
              onInput: this.handleInputChange.blackRank,
              class: 'info-dialog__rank-input',
            }),
          ),

          h('img', {
            class: 'info-dialog__swap',
            src: `./img/ui/player_${currentPlayer}.svg`,
            height: 28,
            title: t('Swap'),
            onClick: this.handleSwapPlayers,
          }),

          h(
            'div',
            {class: 'info-dialog__player'},
            h('input', {
              type: 'text',
              placeholder: t('White'),
              value: whiteName,
              onInput: this.handleInputChange.whiteName,
            }),
            h('input', {
              type: 'text',
              placeholder: t('Rank'),
              value: whiteRank,
              onInput: this.handleInputChange.whiteRank,
              class: 'info-dialog__rank-input',
            }),
            h('img', {
              tabIndex: 0,
              src: './node_modules/@primer/octicons/build/svg/chevron-down.svg',
              width: 16,
              height: 16,
              class: classNames('info-dialog__engine-menu', {
                active: syncerEngines[1] != null,
              }),
              onClick: this.handleEngineMenuClick[1],
            }),
          ),
        ),

        h(
          'ul',
          {class: 'info-dialog__fields'},
          h(
            InfoDrawerItem,
            {title: t('Name')},
            h('input', {
              type: 'text',
              placeholder: t('(Unnamed)'),
              value: gameName,
              onInput: this.handleInputChange.gameName,
            }),
          ),
          h(
            InfoDrawerItem,
            {title: t('Event')},
            h('input', {
              type: 'text',
              placeholder: t('None'),
              value: eventName,
              onInput: this.handleInputChange.eventName,
            }),
          ),
          h(
            InfoDrawerItem,
            {title: t('Date')},
            h('input', {
              type: 'date',
              placeholder: t('None'),
              value: date,
              onChange: this.handleDateChange,
            }),
          ),
          h(
            InfoDrawerItem,
            {title: t('Comment')},
            h('input', {
              type: 'text',
              placeholder: t('None'),
              value: gameComment,
              onInput: this.handleInputChange.gameComment,
            }),
          ),
          h(
            InfoDrawerItem,
            {title: t('Result')},
            showResult
              ? h('input', {
                  type: 'text',
                  placeholder: t('None'),
                  value: result,
                  onInput: this.handleInputChange.result,
                })
              : h(
                  'button',
                  {
                    type: 'button',
                    class: 'info-dialog__show-btn',
                    onClick: this.handleShowResultClick,
                  },
                  t('Show'),
                ),
          ),
          h(
            InfoDrawerItem,
            {title: t('Komi')},
            h('input', {
              type: 'number',
              step: 0.5,
              placeholder: 0,
              value: komi == null ? '' : komi,
              onInput: this.handleInputChange.komi,
            }),
          ),
          h(
            InfoDrawerItem,
            {title: t('Handicap')},
            h(
              'select',
              {
                selectedIndex: Math.max(0, handicap - 1),
                disabled: !emptyTree,
                onChange: this.handleInputChange.handicap,
              },

              h('option', {value: 0}, t('No stones')),
              [...Array(8)].map((_, i) =>
                h(
                  'option',
                  {value: i + 2},
                  t((p) => `${p.stones} stones`, {
                    stones: i + 2,
                  }),
                ),
              ),
            ),
          ),
          h(
            InfoDrawerItem,
            {title: t('Board Size')},
            h('input', {
              type: 'number',
              placeholder: 19,
              max: 25,
              min: 2,
              value: size[0],
              disabled: !emptyTree,
              onFocus: this.handleBoardWidthFocus,
              onInput: this.handleBoardWidthChange,
            }),
            ' ',

            h(
              'span',
              {
                title: t('Swap'),
                style: {cursor: emptyTree ? 'pointer' : 'default'},
                onClick: !emptyTree ? noop : this.handleSizeSwapButtonClick,
              },
              '×',
            ),
            ' ',

            h('input', {
              type: 'number',
              placeholder: 19,
              max: 25,
              min: 3,
              value: size[1],
              disabled: !emptyTree,
              onInput: this.handleBoardHeightChange,
            }),
          ),
        ),

        h(
          'footer',
          {class: 'info-dialog__footer'},
          h(
            'button',
            {
              type: 'button',
              class: 'modal-btn modal-btn--secondary',
              onClick: this.handleClose,
            },
            t('Cancel'),
          ),
          h(
            'button',
            {
              type: 'submit',
              class: 'modal-btn modal-btn--primary',
              onClick: this.handleSubmitButtonClick,
            },
            t('OK'),
          ),
        ),
      ),
    )
  }
}
