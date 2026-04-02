import {h} from 'preact'

import i18n from '../../i18n.js'

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
  territoryMode,
  unavailableReason = null,
  territorySummary = null,
  hoveredRegion = null,
  deltaSummary = null,
  hoveredDelta = null,
  hoveredRegionDeltaSummary = null,
  diffSourceType = null,
  keyPointSummary = null,
}) {
  if (!territoryMode) return null

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
      hoveredRegionDeltaSummary != null &&
        h(
          'div',
          {class: 'overlay-status-line'},
          h(LabelValue, {
            label: t('Gain'),
            value: formatMetric(hoveredRegionDeltaSummary.strengthened),
          }),
          h(LabelValue, {
            label: t('Loss'),
            value: formatMetric(hoveredRegionDeltaSummary.weakened),
          }),
        ),
      hoveredDelta != null &&
        h(
          'div',
          {class: 'overlay-status-line'},
          h(LabelValue, {
            label: t('Point Delta'),
            value: `${hoveredDelta > 0 ? '+' : ''}${hoveredDelta.toFixed(2)}`,
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
    deltaSummary != null &&
      h(
        'div',
        {class: 'overlay-status-line'},
        h(LabelValue, {
          label: t('Black Gain'),
          value: formatMetric(deltaSummary.black),
        }),
        h(LabelValue, {
          label: t('White Gain'),
          value: formatMetric(deltaSummary.white),
        }),
      ),
    keyPointSummary != null &&
      h(
        'div',
        {class: 'overlay-status-line'},
        h(LabelValue, {
          label: t('Key Black Gain'),
          value: formatMetric(keyPointSummary.blackGain),
        }),
        h(LabelValue, {
          label: t('Key White Gain'),
          value: formatMetric(keyPointSummary.whiteGain),
        }),
      ),
    h(
      'div',
      {class: 'overlay-status-line'},
      h(
        'strong',
        {},
        diffSourceType === 'hover'
          ? t('Territory diff previewing the hovered AI candidate.')
          : diffSourceType === 'move'
            ? t('Territory diff previewing the latest move.')
            : t('Territory overlay active. Hover a region to inspect ownership.'),
      ),
    ),
  )
}
