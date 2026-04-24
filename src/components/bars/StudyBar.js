import {h} from 'preact'
import classNames from 'classnames'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import Bar from './Bar.js'

const t = i18n.context('StudyBar')

function PillButton({
  label,
  selected = false,
  primary = false,
  disabled = false,
  onClick,
}) {
  return h(
    'a',
    {
      href: '#',
      class: classNames('study-pill', {selected, primary, disabled}),
      'aria-disabled': disabled,
      onClick: (evt) => {
        evt.preventDefault()
        if (disabled) return
        onClick?.()
      },
    },
    label,
  )
}

function ToolButton({label, tool, selectedTool, onClick}) {
  return h(
    PillButton,
    {
      label,
      selected: selectedTool === tool,
      onClick: () => onClick?.(tool),
    },
  )
}

export default function StudyBar({
  mode,
  studyPhase = 'baseline',
  selectedTool,
  dirty = false,
  hasBaseline = false,
  keyPointCount = 0,
  moveCount = 0,
  analysisPending = false,
  ownershipReady = false,
  trialReady = false,
  trialDirty = false,
  committed = false,
  usingSetupEdits = false,
}) {
  let baselineStepCurrent = studyPhase === 'baseline'
  let toolLabel =
    selectedTool === 'label'
      ? t('Key Points')
      : mode === 'edit'
        ? t('Analysis Mode')
        : t('Normal Mode')
  let statusText = baselineStepCurrent
    ? !hasBaseline
      ? t('No baseline yet')
      : dirty
        ? t('Baseline unsaved')
        : t('Baseline saved')
    : !trialDirty
      ? t('Trial is empty')
      : committed
        ? t('Branch already added')
        : usingSetupEdits
          ? t('Trial includes setup edits')
          : t('Trial line ready')
  let ownershipText = analysisPending
    ? t('Ownership updating...')
    : ownershipReady
      ? t('Ownership visible')
      : t('Ownership unavailable')

  return h(
    Bar,
    {
      type: 'study',
      mode,
      active: true,
      class: classNames('study', {trial: !baselineStepCurrent}),
      onClose: (evt) => {
        evt.preventDefault()
        sabaki.exitStudyMode()
      },
    },
    h(
      'div',
      {class: 'study-section study-stepper'},
      h(
        'span',
        {class: classNames('study-step', {current: baselineStepCurrent})},
        t('1. Baseline'),
      ),
      h('span', {class: 'study-step-separator'}, '->'),
      h(
        'span',
        {class: classNames('study-step', {current: !baselineStepCurrent})},
        t('2. Trial'),
      ),
    ),
    h(
      'div',
      {class: 'study-section study-summary'},
      h(
        'strong',
        {},
        baselineStepCurrent ? t('Edit Baseline') : t('Trial and Compare'),
      ),
      h('span', {class: 'status'}, statusText),
      h('span', {class: 'status'}, ownershipText),
      h('span', {class: 'status'}, toolLabel),
      h(
        'span',
        {class: 'status'},
        t((p) => `${p.count} key points`, {count: keyPointCount}),
      ),
      h(
        'span',
        {class: 'status'},
        t((p) => `${p.count} trial moves`, {count: moveCount}),
      ),
    ),
    h(
      'div',
      {class: 'study-section study-tools'},
      h('span', {class: 'study-label'}, t('Tools')),
      h(ToolButton, {
        label: t('Black'),
        tool: 'stone_1',
        selectedTool,
        onClick: (tool) =>
          sabaki.setState({selectedTool: tool, mode: 'edit'}),
      }),
      h(ToolButton, {
        label: t('White'),
        tool: 'stone_-1',
        selectedTool,
        onClick: (tool) => sabaki.setState({selectedTool: tool, mode: 'edit'}),
      }),
      h(ToolButton, {
        label: t('Erase'),
        tool: 'eraser',
        selectedTool,
        onClick: (tool) => sabaki.setState({selectedTool: tool, mode: 'edit'}),
      }),
      h(ToolButton, {
        label: t('Key Points'),
        tool: 'label',
        selectedTool,
        onClick: (tool) => sabaki.setState({selectedTool: tool, mode: 'edit'}),
      }),
    ),
    h(
      'div',
      {class: 'study-section study-actions'},
      h(PillButton, {
        label: dirty ? t('Save Baseline*') : t('Save Baseline'),
        primary: baselineStepCurrent,
        disabled: !hasBaseline,
        onClick: () => sabaki.saveBaselineSnapshot(),
      }),
      h(PillButton, {
        label: baselineStepCurrent ? t('Start Trial') : t('Back to Baseline'),
        primary: !baselineStepCurrent,
        onClick: () =>
          sabaki.setStudyPhase(baselineStepCurrent ? 'trial' : 'baseline'),
      }),
      h(PillButton, {
        label: t('Reset Trial'),
        disabled: baselineStepCurrent || !trialDirty,
        onClick: () => sabaki.resetTrialWorkspace(),
      }),
      h(PillButton, {
        label: committed ? t('Branch Added') : t('Add Branch'),
        primary: !baselineStepCurrent,
        disabled: baselineStepCurrent || !trialReady || committed,
        onClick: () => sabaki.applyTrialAsVariation(),
      }),
      h(PillButton, {
        label: t('Exit Study'),
        onClick: () => sabaki.exitStudyMode(),
      }),
    ),
  )
}
