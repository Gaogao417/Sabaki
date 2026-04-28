import {h, Component} from 'preact'
import sabaki from '../../modules/sabaki.js'
import i18n from '../../i18n.js'

const t = i18n.context('TrainingDashboard')

class TrainingDashboardDrawer extends Component {
  constructor() {
    super()
    this.state = {
      summary: null,
      loading: true,
      inboxProblems: [],
    }
  }

  async componentWillReceiveProps(nextProps) {
    if (nextProps.show && !this.props.show) {
      this.setState({loading: true})
      try {
        let summary = await window.sabaki.db.getDashboardSummary()
        let inboxProblems = await window.sabaki.db.getProblemsByStatus('inbox', 10)
        this.setState({summary, inboxProblems, loading: false})
      } catch (err) {
        console.error('Failed to load dashboard:', err)
        this.setState({loading: false})
      }
    }
  }

  render({show}) {
    if (!show) return null
    let {summary, loading, inboxProblems} = this.state

    if (loading || !summary) {
      return h('div', {class: 'drawer training-dashboard'},
        h('div', {class: 'drawer-header'},
          h('h2', {}, t('Training Dashboard')),
          h('button', {class: 'drawer-close', onClick: () => sabaki.closeDrawer()}, '✕'),
        ),
        h('div', {class: 'drawer-body'}, t('Loading...')),
      )
    }

    return h('div', {class: 'drawer training-dashboard'},
      h('div', {class: 'drawer-header'},
        h('h2', {}, t('Training Dashboard')),
        h('button', {class: 'drawer-close', onClick: () => sabaki.closeDrawer()}, '✕'),
      ),
      h('div', {class: 'drawer-body'},
        h('div', {class: 'dashboard-section'},
          h('h3', {}, t('Today')),
          h('div', {class: 'stat-row'},
            h('span', {}, t('Due for Review')),
            h('strong', {}, summary.dueCount),
          ),
          h('div', {class: 'stat-row'},
            h('span', {}, t('Inbox Problems')),
            h('strong', {}, summary.inboxCount),
          ),
          h('div', {class: 'stat-row'},
            h('span', {}, t('Recent Punishment Problems')),
            h('strong', {}, summary.recentPunishmentCount),
          ),
          h('div', {class: 'dashboard-actions'},
            summary.dueCount > 0 && h('button', {
              class: 'primary',
              onClick: () => { sabaki.closeDrawer(); sabaki.startReviewSession() },
            }, t('Start Review')),
            inboxProblems.length > 0 && h('button', {
              onClick: () => {
                sabaki.closeDrawer()
                sabaki.startProblem(inboxProblems[0].id)
              },
            }, t('Start Inbox Problem')),
          ),
        ),
        summary.recentGames.length > 0 && h('div', {class: 'dashboard-section'},
          h('h3', {}, t('Recent Games')),
          h('ul', {class: 'game-list'},
            ...summary.recentGames.map((game) =>
              h('li', {key: game.id},
                h('span', {class: 'game-title'}, game.title || `Game ${game.id.slice(0, 8)}`),
                h('span', {class: 'game-date'}, new Date(game.createdAt).toLocaleDateString()),
                h('button', {
                  onClick: () => {
                    sabaki.closeDrawer()
                    sabaki.startRecallSession(game.id)
                  },
                }, t('Recall')),
              ),
            ),
          ),
        ),
        inboxProblems.length > 0 && h('div', {class: 'dashboard-section'},
          h('h3', {}, t('Inbox')),
          h('ul', {class: 'problem-list'},
            ...inboxProblems.map((p) =>
              h('li', {key: p.id},
                h('span', {class: 'problem-type-badge', 'data-type': p.type}, p.type),
                h('span', {class: 'problem-title'}, p.title || p.id.slice(0, 8)),
                h('button', {
                  onClick: () => { sabaki.closeDrawer(); sabaki.startProblem(p.id) },
                }, t('Solve')),
              ),
            ),
          ),
        ),
      ),
    )
  }
}

export default TrainingDashboardDrawer
