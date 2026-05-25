import {h} from 'preact'
import i18n from '../../i18n.js'

const t = i18n.context('TrainingDashboard')

/**
 * TrainingDashboardDrawer — presentational component.
 *
 * W8-P4 Migration: All data comes from `dashboardData` prop.
 * All actions go through callback props. No direct service/repo/db access.
 *
 * Props:
 *   - show: boolean
 *   - dashboardData: { dueItems, inboxTasks, incompleteAttempts,
 *                      incompleteRecallSessions, recentBadMoveTasks,
 *                      loading, error } | null
 *   - onOpenDueReviewItem(scheduleId)
 *   - onOpenInboxTask(taskId)
 *   - onOpenIncompleteAttempt(attemptId)
 *   - onOpenIncompleteRecallSession(sessionId)
 *   - onOpenBadMoveTask(taskId)
 *   - onRefreshDashboard()
 */
export default function TrainingDashboardDrawer({
  show,
  dashboardData,
  onOpenDueReviewItem = () => {},
  onOpenInboxTask = () => {},
  onOpenIncompleteAttempt = () => {},
  onOpenIncompleteRecallSession = () => {},
  onOpenBadMoveTask = () => {},
  onRefreshDashboard = () => {},
}) {
  if (!show) return null

  const dd = dashboardData
  const loading = dd ? dd.loading : true
  const error = dd ? dd.error : null
  const dueItems = dd ? dd.dueItems : []
  const inboxTasks = dd ? dd.inboxTasks : []
  const incompleteAttempts = dd ? dd.incompleteAttempts : []
  const incompleteRecallSessions = dd ? dd.incompleteRecallSessions : []
  const recentBadMoveTasks = dd ? dd.recentBadMoveTasks : []

  if (loading || !dd) {
    return h('div', {class: 'drawer training-dashboard show'},
      h('div', {class: 'drawer-header'},
        h('h2', {}, t('Training Dashboard')),
      ),
      h('div', {class: 'drawer-body'}, t('Loading...')),
    )
  }

  if (error) {
    return h('div', {class: 'drawer training-dashboard show'},
      h('div', {class: 'drawer-header'},
        h('h2', {}, t('Training Dashboard')),
      ),
      h('div', {class: 'drawer-body'}, t('Error loading dashboard')),
    )
  }

  return h('div', {class: 'drawer training-dashboard show'},
    h('div', {class: 'drawer-header'},
      h('h2', {}, t('Training Dashboard')),
    ),
    h('div', {class: 'drawer-body'},

      // Due for Review
      h('div', {class: 'dashboard-section'},
        h('h3', {}, t('Today')),
        h('div', {class: 'stat-row'},
          h('span', {}, t('Due for Review')),
          h('strong', {}, dueItems.length),
        ),
        h('div', {class: 'stat-row'},
          h('span', {}, t('Inbox Problems')),
          h('strong', {}, inboxTasks.length),
        ),
        h('div', {class: 'stat-row'},
          h('span', {}, t('Recent Punishment Problems')),
          h('strong', {}, recentBadMoveTasks.length),
        ),
        h('div', {class: 'dashboard-actions'},
          dueItems.length > 0 && h('button', {
            class: 'primary',
            onClick: () => onOpenDueReviewItem(dueItems[0].id),
          }, t('Start Review')),
          inboxTasks.length > 0 && h('button', {
            onClick: () => onOpenInboxTask(inboxTasks[0].id),
          }, t('Start Inbox Problem')),
        ),
      ),

      // Incomplete Attempts
      incompleteAttempts.length > 0 && h('div', {class: 'dashboard-section'},
        h('h3', {}, t('Incomplete Attempts')),
        h('ul', {class: 'problem-list'},
          ...incompleteAttempts.map((attempt) =>
            h('li', {key: attempt.id},
              h('span', {class: 'problem-title'},
                attempt.taskId ? attempt.taskId.slice(0, 8) : attempt.id.slice(0, 8)),
              h('button', {
                onClick: () => onOpenIncompleteAttempt(attempt.id),
              }, t('Resume')),
            ),
          ),
        ),
      ),

      // Incomplete Recall Sessions
      incompleteRecallSessions.length > 0 && h('div', {class: 'dashboard-section'},
        h('h3', {}, t('Incomplete Recall Sessions')),
        h('ul', {class: 'game-list'},
          ...incompleteRecallSessions.map((session) =>
            h('li', {key: session.id},
              h('span', {class: 'game-title'},
                session.taskId ? session.taskId.slice(0, 8) : session.id.slice(0, 8)),
              h('button', {
                onClick: () => onOpenIncompleteRecallSession(session.id),
              }, t('Resume')),
            ),
          ),
        ),
      ),

      // Inbox
      inboxTasks.length > 0 && h('div', {class: 'dashboard-section'},
        h('h3', {}, t('Inbox')),
        h('ul', {class: 'problem-list'},
          ...inboxTasks.map((p) =>
            h('li', {key: p.id},
              h('span', {class: 'problem-title'},
                p.title || p.id.slice(0, 8)),
              h('button', {
                onClick: () => onOpenInboxTask(p.id),
              }, t('Solve')),
            ),
          ),
        ),
      ),

      // Bad-move derived tasks
      recentBadMoveTasks.length > 0 && h('div', {class: 'dashboard-section'},
        h('h3', {}, t('Recent Punishment Problems')),
        h('ul', {class: 'problem-list'},
          ...recentBadMoveTasks.map((task) =>
            h('li', {key: task.id},
              h('span', {class: 'problem-title'},
                task.title || task.id.slice(0, 8)),
              h('button', {
                onClick: () => onOpenBadMoveTask(task.id),
              }, t('Practice')),
            ),
          ),
        ),
      ),

      // Refresh button
      h('div', {class: 'dashboard-actions'},
        h('button', {
          onClick: () => onRefreshDashboard(),
        }, t('Refresh')),
      ),
    ),
  )
}
