import {h} from 'preact'

const LABELS = {play: 'Play', problem: 'Problem', recall: 'Recall', analysis: 'Analysis'}

export default function ModeChip({mode}) {
  return h('span', {class: `wb-mode-chip wb-mode-chip--${mode}`}, LABELS[mode] || mode)
}
