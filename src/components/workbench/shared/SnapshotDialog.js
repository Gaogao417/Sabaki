import {h, Component} from 'preact'

export default class SnapshotDialog extends Component {
  constructor(props) {
    super(props)
    this.state = {
      title: '',
      goal: '',
      area: 'full',
      mode: 'problem',
    }

    this.handleTitleInput = (evt) => this.setState({title: evt.currentTarget.value})
    this.handleGoalInput = (evt) => this.setState({goal: evt.currentTarget.value})
    this.handleAreaChange = (evt) => this.setState({area: evt.currentTarget.value})
    this.handleModeChange = (evt) => this.setState({mode: evt.currentTarget.value})

    this.handleCreate = () => {
      let {onCreate} = this.props
      if (onCreate) onCreate(this.state)
    }

    this.handleClose = () => {
      let {onClose} = this.props
      if (onClose) onClose()
    }

    this.stopPropagation = (evt) => evt.stopPropagation()
  }

  render({open = false, sourceLabel = '当前局面'}, {title, goal, area, mode}) {
    if (!open) return null

    return h('div', {class: 'wb-snapshot-dialog', onClick: this.handleClose},
      h('div', {class: 'wb-snapshot-dialog__overlay'}),
      h('div', {class: 'wb-snapshot-dialog__card', onClick: this.stopPropagation},
        h('h3', {class: 'wb-snapshot-dialog__title'}, `创建快照 — ${sourceLabel}`),

        h('label', {class: 'wb-snapshot-dialog__label'}, '标题'),
        h('input', {
          class: 'wb-snapshot-dialog__input',
          type: 'text',
          value: title,
          placeholder: '输入任务标题',
          onInput: this.handleTitleInput,
        }),

        h('label', {class: 'wb-snapshot-dialog__label'}, '目标'),
        h('input', {
          class: 'wb-snapshot-dialog__input',
          type: 'text',
          value: goal,
          placeholder: '描述练习目标',
          onInput: this.handleGoalInput,
        }),

        h('label', {class: 'wb-snapshot-dialog__label'}, '区域'),
        h('select', {
          class: 'wb-snapshot-dialog__select',
          value: area,
          onChange: this.handleAreaChange,
        },
          h('option', {value: 'full'}, '全局'),
          h('option', {value: 'topleft'}, '左上'),
          h('option', {value: 'topright'}, '右上'),
          h('option', {value: 'bottomleft'}, '左下'),
          h('option', {value: 'bottomright'}, '右下'),
        ),

        h('label', {class: 'wb-snapshot-dialog__label'}, '模式'),
        h('div', {class: 'wb-snapshot-dialog__radios'},
          h('label', {class: 'wb-snapshot-dialog__radio'},
            h('input', {
              type: 'radio',
              name: 'snapshot-mode',
              value: 'problem',
              checked: mode === 'problem',
              onChange: this.handleModeChange,
            }),
            'Problem'
          ),
          h('label', {class: 'wb-snapshot-dialog__radio'},
            h('input', {
              type: 'radio',
              name: 'snapshot-mode',
              value: 'play',
              checked: mode === 'play',
              onChange: this.handleModeChange,
            }),
            'Play'
          ),
        ),

        h('div', {class: 'wb-snapshot-dialog__actions'},
          h('button', {
            class: 'wb-snapshot-dialog__btn wb-snapshot-dialog__btn--cancel',
            onClick: this.handleClose,
          }, '取消'),
          h('button', {
            class: 'wb-snapshot-dialog__btn wb-snapshot-dialog__btn--create',
            onClick: this.handleCreate,
          }, '创建'),
        )
      )
    )
  }
}
