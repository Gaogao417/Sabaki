/**
 * Overlay state ownership: territory, compare, info overlay.
 *
 * This module OWNS its state (territoryEnabled, territoryCompareEnabled,
 * showInfoOverlay, infoOverlayText). All dependencies are injected through
 * OverlayStoreDeps — zero sabaki references.  Follows the analysisLifecycle.ts
 * pattern: typed deps, own state, event notification.
 *
 * The async engine-capability check runs as a separate reaction, not inside the
 * setter. This eliminates the CTA (Check-Then-Act) window: the setter is synchronous,
 * and stale async results are discarded via a generation counter.
 */

// ---------------------------------------------------------------------------
// State & Deps types
// ---------------------------------------------------------------------------

export type OverlayState = {
  territoryEnabled: boolean
  territoryCompareEnabled: boolean
  showInfoOverlay: boolean
  infoOverlayText: string
}

export type OverlayStoreDeps = {
  // State reads (read-only access to external state)
  getAppState: () => {
    mode: string
    editWorkspace: any
    treePosition: string
    analysisTreePosition: string
    currentOwnership: (syncer: any) => any
  }

  // Async capability check
  ensureAnalysisReady: (opts: {requireOwnership: boolean}) => Promise<any>

  // Analysis triggers
  analyzeMove: (treePosition: string) => void
  scheduleEditWorkspaceAnalysis: () => void
  captureEditReference: () => void

  // Settings
  getInfoOverlayDuration: () => number

  // React notification — triggers App.js setState to re-render
  notifyChange: () => void

  // Logger
  logger: {
    debug: (source: string, message: string, data?: any) => void
    info: (source: string, message: string, data?: any) => void
    warn: (source: string, message: string, data?: any) => void
    error: (source: string, message: string, data?: any) => void
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOverlayStore(deps: OverlayStoreDeps) {
  let state: OverlayState = {
    territoryEnabled: false,
    territoryCompareEnabled: false,
    showInfoOverlay: false,
    infoOverlayText: '',
  }

  let generation = 0
  let hideInfoOverlayTimer: ReturnType<typeof setTimeout> | null = null

  // Observer pattern: local subscribers notified on every state change
  let listeners = new Set<() => void>()

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  function emitChange() {
    deps.notifyChange()
    for (let listener of listeners) listener()
  }

  function snapshot() {
    return {
      territoryEnabled: state.territoryEnabled,
      territoryCompareEnabled: state.territoryCompareEnabled,
      mode: deps.getAppState().mode,
      gen: generation,
    }
  }

  // ---------------------------------------------------------------------------
  // State reads
  // ---------------------------------------------------------------------------

  function getState(): Readonly<OverlayState> {
    return state
  }

  function getTerritoryCompareAvailable(): boolean {
    let app = deps.getAppState()
    return (
      app.mode === 'analysis' && app.editWorkspace?.referenceSnapshot != null
    )
  }

  // ---------------------------------------------------------------------------
  // Info overlay
  // ---------------------------------------------------------------------------

  function showInfoOverlay(text: string): void {
    state.showInfoOverlay = true
    state.infoOverlayText = text
    emitChange()
  }

  function hideInfoOverlay(): void {
    state.showInfoOverlay = false
    emitChange()
  }

  function flashInfoOverlay(text: string, duration?: number): void {
    if (duration == null) duration = deps.getInfoOverlayDuration()

    showInfoOverlay(text)

    if (hideInfoOverlayTimer != null) clearTimeout(hideInfoOverlayTimer)
    hideInfoOverlayTimer = setTimeout(() => hideInfoOverlay(), duration)
  }

  // ---------------------------------------------------------------------------
  // Territory enabled
  // ---------------------------------------------------------------------------

  function setTerritoryEnabled(territoryEnabled: boolean): boolean {
    let app = deps.getAppState()
    deps.logger.debug('overlay.setTerritoryEnabled', 'Set territory requested', {
      requested: territoryEnabled,
      current: state.territoryEnabled,
      mode: app.mode,
      treePosition: app.treePosition,
    })

    if (territoryEnabled === state.territoryEnabled) return true

    if (!territoryEnabled) {
      hideInfoOverlay()
      state.territoryEnabled = false
      deps.logger.info('overlay.territory_disabled', 'Territory overlay disabled')
      emitChange()
      return true
    }

    // Reject if current mode doesn't allow territory overlay
    if (!TERRITORY_ALLOWED_MODES.has(app.mode)) {
      deps.logger.warn('overlay.territory_rejected', 'Territory rejected outside analysis', {
        requested: territoryEnabled,
        mode: app.mode,
        treePosition: app.treePosition,
      })
      return false
    }

    // Mutually exclusive: disable compare when enabling territory
    state.territoryCompareEnabled = false

    // Sync: record intent, trigger render (UI shows "pending" via resolveOverlayInput)
    hideInfoOverlay()
    state.territoryEnabled = true
    deps.logger.info('overlay.territory_enabled', 'Territory overlay enabled (sync)', snapshot())
    emitChange()

    // Async reaction: confirm engine capability
    let gen = ++generation
    deps.logger.debug('overlay.territory_awaiting_engine', 'Awaiting engine for territory', {gen})
    deps.ensureAnalysisReady({requireOwnership: true}).then((syncer) => {
      deps.logger.debug('overlay.territory_engine_resolved', 'Engine resolved for territory', {
        requestedGen: gen,
        currentGen: generation,
        stale: gen !== generation,
        stillEnabled: state.territoryEnabled,
        syncerOk: syncer != null,
        ...snapshot(),
      })

      // Double-check: territoryEnabled may have been turned off by onModeChange
      if (gen !== generation || !state.territoryEnabled) return

      if (syncer == null) {
        state.territoryEnabled = false
        deps.logger.warn('overlay.territory_rollback', 'Territory rollback (no syncer)', snapshot())
        emitChange()
        return
      }

      // Re-read latest external state after await
      let appAfter = deps.getAppState()
      deps.logger.debug('overlay.territory_post_await', 'Post-await state check', {
        mode: appAfter.mode,
        treePosition: appAfter.treePosition,
        analysisTreePosition: appAfter.analysisTreePosition,
        ownership: appAfter.currentOwnership(syncer) != null,
      })

      if (
        appAfter.mode !== 'analysis' &&
        (appAfter.analysisTreePosition !== appAfter.treePosition ||
          appAfter.currentOwnership(syncer) == null)
      ) {
        deps.logger.debug('overlay.territory_trigger_analyze', 'Triggering analyzeMove', {
          treePosition: appAfter.treePosition,
        })
        deps.analyzeMove(appAfter.treePosition)
      } else if (appAfter.mode === 'analysis') {
        deps.logger.debug('overlay.territory_trigger_edit_analysis', 'Triggering scheduleEditWorkspaceAnalysis')
        deps.scheduleEditWorkspaceAnalysis()
      }
    })

    return true
  }

  function toggleTerritoryEnabled(): boolean {
    return setTerritoryEnabled(!state.territoryEnabled)
  }

  // ---------------------------------------------------------------------------
  // Territory compare enabled
  // ---------------------------------------------------------------------------

  function setTerritoryCompareEnabled(
    territoryCompareEnabled: boolean,
  ): boolean {
    if (territoryCompareEnabled === state.territoryCompareEnabled) return true

    if (!territoryCompareEnabled) {
      state.territoryCompareEnabled = false
      emitChange()
      return true
    }

    let app = deps.getAppState()
    if (app.mode !== 'analysis') return false
    if (app.editWorkspace == null) return false

    if (app.editWorkspace.referenceSnapshot == null) {
      deps.captureEditReference()
    }

    // Mutually exclusive: disable territory when enabling compare
    state.territoryEnabled = false

    hideInfoOverlay()

    let gen = ++generation
    deps.ensureAnalysisReady({requireOwnership: true}).then((syncer) => {
      if (gen !== generation) return

      if (syncer == null) {
        state.territoryCompareEnabled = false
        emitChange()
        return
      }

      if (!getTerritoryCompareAvailable()) {
        return
      }

      deps.scheduleEditWorkspaceAnalysis()
      state.territoryCompareEnabled = true
      emitChange()
    })

    return true
  }

  function toggleTerritoryCompareEnabled(): boolean {
    return setTerritoryCompareEnabled(!state.territoryCompareEnabled)
  }

  // ---------------------------------------------------------------------------
  // Cross-domain: mode change & navigation revalidation
  // ---------------------------------------------------------------------------

  const TERRITORY_ALLOWED_MODES = new Set(['analysis'])

  /** Called after mode changes. Turns off overlays that are incompatible with
   *  the new mode. Territory overlays are only valid in analysis mode. */
  function onModeChange(mode: string): void {
    let changed = false

    deps.logger.debug('overlay.onModeChange', 'Mode change notification', {
      mode,
      territoryEnabled: state.territoryEnabled,
      territoryCompareEnabled: state.territoryCompareEnabled,
      allowed: TERRITORY_ALLOWED_MODES.has(mode),
    })

    if (!TERRITORY_ALLOWED_MODES.has(mode) && state.territoryEnabled) {
      deps.logger.warn('overlay.mode_clear_territory', 'Clearing territory outside analysis', {
        mode,
        territoryEnabled: state.territoryEnabled,
        territoryCompareEnabled: state.territoryCompareEnabled,
      })
      state.territoryEnabled = false
      generation++ // invalidate any in-flight async reaction
      changed = true
    }

    if (mode !== 'analysis' && state.territoryCompareEnabled) {
      deps.logger.warn('overlay.mode_clear_compare', 'Clearing territory compare outside analysis', {
        mode,
        territoryEnabled: state.territoryEnabled,
        territoryCompareEnabled: state.territoryCompareEnabled,
      })
      state.territoryCompareEnabled = false
      generation++ // invalidate any in-flight async reaction
      changed = true
    }

    if (changed) emitChange()
  }

  /** Called after tree position changes. Turns off territoryCompareEnabled if
   *  the new position makes compare unavailable (e.g. left analysis mode). */
  function onNavigation(): void {
    if (state.territoryCompareEnabled && !getTerritoryCompareAvailable()) {
      state.territoryCompareEnabled = false
      emitChange()
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    getState,
    subscribe,
    getTerritoryCompareAvailable,
    showInfoOverlay,
    hideInfoOverlay,
    flashInfoOverlay,
    setTerritoryEnabled,
    toggleTerritoryEnabled,
    setTerritoryCompareEnabled,
    toggleTerritoryCompareEnabled,
    onModeChange,
    onNavigation,
  }
}
