import {h} from 'preact'

import i18n from '../i18n.js'

const t = i18n.context('OverlayStatusBar')

function formatMetric(metric) {
  if (metric == null) return '0.00 / 0'
  return `${metric.sum.toFixed(2)} / ${metric.intersections}`
}

function RegionTitle({region}) {
  let title =
    region.owner === 'neutral'
      ? t('Neutral Region')
      : region.owner === 'black'
        ? t('Black Region')
        : t('White Region')

  return h(
    'div',
    {class: 'overlay-status-line'},
    h('strong', {}, title),
  )
}

function LabelValue({label, value}) {
  return h(
    'span',
    {class: 'overlay-status-pair'},
    h('strong', {}, `${label}: `),
    value,
  )
}

export default function OverlayStatusBar({
  overlayMode,
  unavailableReason = null,
  territorySummary = null,
  hoveredRegion = null,
}) {
  if (overlayMode !== 'territory') return null

  if (unavailableReason != null) {
    return h(
      'section',
      {class: 'overlay-status-bar overlay-status-warning'},
      h(
        'div',
        {class: 'overlay-status-line'},
        h('strong', {}, unavailableReason),
      ),
    )
  }

  if (hoveredRegion != null) {
    return h(
      'section',
      {class: 'overlay-status-bar'},
      h(RegionTitle, {region: hoveredRegion}),
      h(
        'div',
        {class: 'overlay-status-line'},
        h(LabelValue, {
          label: t('Total'),
          value: formatMetric(hoveredRegion.total),
        }),
        h(LabelValue, {
          label: t('Solid'),
          value: formatMetric(hoveredRegion.solid),
        }),
        h(LabelValue, {
          label: t('Influence'),
          value: formatMetric(hoveredRegion.influence),
        }),
      ),
      h(
        'div',
        {class: 'overlay-status-line'},
        h(LabelValue, {
          label: t('Vertices'),
          value: hoveredRegion.vertices.length,
        }),
      ),
    )
  }

  return h(
    'section',
    {class: 'overlay-status-bar overlay-status-idle'},
    territorySummary != null &&
      h(
        'div',
        {class: 'overlay-status-line'},
        h(LabelValue, {
          label: t('Black'),
          value: formatMetric(territorySummary.black.total),
        }),
        h(LabelValue, {
          label: t('White'),
          value: formatMetric(territorySummary.white.total),
        }),
        h(LabelValue, {
          label: t('Neutral'),
          value: formatMetric(territorySummary.neutral.total),
        }),
      ),
    h(
      'div',
      {class: 'overlay-status-line'},
      h(
        'strong',
        {},
        t('Territory overlay active. Hover a region to inspect ownership.'),
      ),
    ),
  )
}
