/**
 * Overlay state ownership: territory, compare, and overlay mode.
 *
 * Phase 11 completion — overlay control layer extracted from sabaki.js.
 * During migration, sabaki.state remains the storage; this module owns the
 * write entrypoints and the domain logic around when/how to toggle overlays.
 *
 * @param {object} sabaki
 * @param {{
 *   ensureAnalysisReady?: (opts?: {requireOwnership?: boolean}) => Promise<object|null>,
 *   analyzeMove?: (treePosition: string) => Promise<void>,
 *   scheduleEditWorkspaceAnalysis?: (tab?: string|null) => void,
 *   captureEditReference?: () => void,
 *   hideInfoOverlay?: () => void,
 * }} [deps]
 */
export function createOverlayStore(sabaki, deps = {}) {
  let {
    ensureAnalysisReady,
    analyzeMove,
    scheduleEditWorkspaceAnalysis,
    captureEditReference,
    hideInfoOverlay,
  } = deps

  // Fallbacks — call through sabaki when dep not explicitly provided
  let resolveEnsureAnalysis = ensureAnalysisReady ?? ((opts) =>
    sabaki.ensureAnalysisReady(opts))
  let resolveAnalyzeMove = analyzeMove ?? ((tp) =>
    sabaki.analyzeMove(tp))
  let resolveScheduleEditAnalysis = scheduleEditWorkspaceAnalysis ?? (() =>
    sabaki.scheduleEditWorkspaceAnalysis())
  let resolveCaptureRef = captureEditReference ?? (() =>
    sabaki.captureEditReference())
  let resolveHideInfo = hideInfoOverlay ?? (() =>
    sabaki.hideInfoOverlay())

  function getTerritoryCompareAvailable(state = sabaki.state) {
    return (
      state.mode === 'analysis' &&
      state.editWorkspace?.referenceSnapshot != null
    )
  }

  async function setTerritoryEnabled(territoryEnabled) {
    console.log('[territory.set]', {
      territoryEnabled,
      currentState: sabaki.state.territoryEnabled,
      mode: sabaki.state.mode,
    })

    if (territoryEnabled === sabaki.state.territoryEnabled) return true

    if (!territoryEnabled) {
      resolveHideInfo()
      sabaki.setState({
        territoryEnabled: false,
      })
      return true
    }

    resolveHideInfo()
    sabaki.setState({territoryEnabled: true})

    let syncer = await resolveEnsureAnalysis({requireOwnership: true})
    if (syncer == null) {
      console.log('[territory.no_syncer]', 'ensureAnalysisReady returned null')
      sabaki.setState({
        territoryEnabled: false,
        territoryCompareEnabled: false,
      })
      return false
    }

    console.log('[territory.syncer_ready]', {
      mode: sabaki.state.mode,
      analysisTreePosition: sabaki.state.analysisTreePosition,
      treePosition: sabaki.state.treePosition,
      currentOwnership: sabaki.getCurrentOwnership(syncer) != null,
    })

    if (
      sabaki.state.mode !== 'analysis' &&
      (sabaki.state.analysisTreePosition !== sabaki.state.treePosition ||
        sabaki.getCurrentOwnership(syncer) == null)
    ) {
      console.log('[territory.analyze_move]', {treePosition: sabaki.state.treePosition})
      resolveAnalyzeMove(sabaki.state.treePosition)
    } else if (sabaki.state.mode === 'analysis') {
      console.log('[territory.schedule_edit]')
      resolveScheduleEditAnalysis()
    }

    return true
  }

  async function toggleTerritoryEnabled() {
    return await setTerritoryEnabled(!sabaki.state.territoryEnabled)
  }

  async function setTerritoryCompareEnabled(territoryCompareEnabled) {
    if (territoryCompareEnabled === sabaki.state.territoryCompareEnabled)
      return true

    if (!territoryCompareEnabled) {
      sabaki.setState({territoryCompareEnabled: false})
      return true
    }

    if (sabaki.state.mode !== 'analysis') return false
    if (sabaki.state.editWorkspace == null) return false

    if (sabaki.state.editWorkspace.referenceSnapshot == null) {
      resolveCaptureRef()
    }

    resolveHideInfo()
    let syncer = await resolveEnsureAnalysis({requireOwnership: true})
    if (syncer == null) {
      sabaki.setState({territoryCompareEnabled: false})
      return false
    }

    if (!getTerritoryCompareAvailable()) {
      return false
    }

    resolveScheduleEditAnalysis()
    sabaki.setState({territoryCompareEnabled: true})
    return true
  }

  async function toggleTerritoryCompareEnabled() {
    return await setTerritoryCompareEnabled(
      !sabaki.state.territoryCompareEnabled,
    )
  }

  async function setOverlayMode(overlayMode) {
    if (overlayMode === 'territory') {
      return await setTerritoryEnabled(true)
    }

    if (overlayMode === 'off') {
      return await setTerritoryEnabled(false)
    }

    return false
  }

  return {
    getTerritoryCompareAvailable,
    setTerritoryEnabled,
    toggleTerritoryEnabled,
    setTerritoryCompareEnabled,
    toggleTerritoryCompareEnabled,
    setOverlayMode,
  }
}
