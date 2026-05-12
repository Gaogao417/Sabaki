import i18n from '../../i18n.js'

const t = i18n.context('OverlayStatusBar')

/**
 * Translate an unavailable reason code into a display string.
 * Returns null for null input. Falls through unknown codes as-is.
 */
export function translateUnavailableReason(reason) {
  if (reason == null) return null

  switch (reason) {
    case 'scoring-or-estimator':
      return t('Territory overlay is unavailable while scoring or estimating.')
    case 'analysis-engine-required':
      return t('Start engine analysis first.')
    case 'ownership-pending':
      return t('Waiting for ownership data...')
    case 'ownership-unavailable':
      return t('The current analysis engine does not provide ownership data.')
    case 'hover-pending':
      return t('Loading territory diff preview...')
    default:
      return reason
  }
}
