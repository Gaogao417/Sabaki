import {h, Component} from 'preact'
import sabaki from '../../modules/sabaki.js'
import i18n from '../../i18n.js'

const t = i18n.context('ProblemEditorDrawer')

class ProblemEditorDrawer extends Component {
  constructor() {
    super()
    this.state = {
      type: 'best_move',
      sideToMove: 'black',
      title: '',
      positionDescription: '',
      taskGoal: '',
      difficulty: null,
      tags: '',
      saving: false,
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.show && !this.props.show) {
      this.setState({
        type: 'best_move',
        sideToMove: 'black',
        title: '',
        positionDescription: '',
        taskGoal: '',
        difficulty: null,
        tags: '',
        saving: false,
      })
    }
  }

  handleSave(status) {
    let {type, sideToMove, title, positionDescription, taskGoal, difficulty, tags} = this.state
    if (!positionDescription.trim() || !taskGoal.trim()) {
      return
    }

    this.setState({saving: true})
    sabaki.createProblemFromSnapshot({
      type,
      sideToMove,
      title: title.trim() || null,
      positionDescription: positionDescription.trim(),
      taskGoal: taskGoal.trim(),
      difficulty,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      status,
    })
  }

  render({show}) {
    if (!show) return null

    let {type, sideToMove, title, positionDescription, taskGoal, difficulty, tags, saving} = this.state

    return h('div', {class: 'drawer problem-editor-drawer'},
      h('div', {class: 'drawer-header'},
        h('h2', {}, t('Create Problem')),
        h('button', {
          class: 'drawer-close',
          onClick: () => sabaki.closeDrawer(),
        }, '✕'),
      ),
      h('div', {class: 'drawer-body'},
        h('div', {class: 'form-group'},
          h('label', {}, t('Type')),
          h('select', {
            value: type,
            onChange: (e) => this.setState({type: e.target.value}),
          },
            ...['best_move', 'direction_judgement', 'local_fight', 'life_and_death', 'tesuji', 'endgame', 'shape'].map((t) =>
              h('option', {value: t}, t.replace(/_/g, ' ')),
            ),
          ),
        ),
        h('div', {class: 'form-group'},
          h('label', {}, t('Side to Move')),
          h('div', {class: 'toggle-group'},
            h('button', {
              class: sideToMove === 'black' ? 'active' : '',
              onClick: () => this.setState({sideToMove: 'black'}),
            }, t('Black')),
            h('button', {
              class: sideToMove === 'white' ? 'active' : '',
              onClick: () => this.setState({sideToMove: 'white'}),
            }, t('White')),
          ),
        ),
        h('div', {class: 'form-group'},
          h('label', {}, t('Title')),
          h('input', {
            type: 'text',
            value: title,
            onInput: (e) => this.setState({title: e.target.value}),
            placeholder: t('Optional title'),
          }),
        ),
        h('div', {class: 'form-group'},
          h('label', {}, t('Position Description') + ' *'),
          h('textarea', {
            value: positionDescription,
            onInput: (e) => this.setState({positionDescription: e.target.value}),
            placeholder: t('Describe the position background, key tensions, and why it is worth practicing...'),
            rows: 4,
          }),
        ),
        h('div', {class: 'form-group'},
          h('label', {}, t('Task Goal') + ' *'),
          h('textarea', {
            value: taskGoal,
            onInput: (e) => this.setState({taskGoal: e.target.value}),
            placeholder: t('What should the solver try to accomplish?'),
            rows: 2,
          }),
        ),
        h('div', {class: 'form-group'},
          h('label', {}, t('Difficulty')),
          h('select', {
            value: difficulty || '',
            onChange: (e) => this.setState({difficulty: e.target.value ? +e.target.value : null}),
          },
            h('option', {value: ''}, t('Not set')),
            ...[1, 2, 3, 4, 5].map((d) => h('option', {value: d}, d)),
          ),
        ),
        h('div', {class: 'form-group'},
          h('label', {}, t('Tags')),
          h('input', {
            type: 'text',
            value: tags,
            onInput: (e) => this.setState({tags: e.target.value}),
            placeholder: t('Comma-separated tags'),
          }),
        ),
      ),
      h('div', {class: 'drawer-footer'},
        h('button', {
          disabled: saving || !positionDescription.trim() || !taskGoal.trim(),
          onClick: () => this.handleSave('inbox'),
        }, t('Save to Inbox')),
        h('button', {
          disabled: saving || !positionDescription.trim() || !taskGoal.trim(),
          class: 'primary',
          onClick: () => this.handleSave('active'),
        }, t('Save as Active')),
      ),
    )
  }
}

export default ProblemEditorDrawer
