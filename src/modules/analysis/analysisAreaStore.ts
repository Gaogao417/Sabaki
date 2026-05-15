/**
 * Analysis area selection state: rects, vertices, select mode.
 *
 * This module OWNS its state. Zero deps, zero engine references.
 * Setters return `changed: boolean` so callers decide side effects.
 * Subscribers receive typed events so they can filter by concern:
 *   - UI subscriber: reacts to all events (re-render)
 *   - Engine subscriber: reacts only to areaChanged / areaCleared
 */

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type AnalysisAreaStoreEvent =
  | {type: 'areaChanged'}
  | {type: 'areaCleared'}
  | {type: 'areaSelectModeChanged'}

// ---------------------------------------------------------------------------
// State type
// ---------------------------------------------------------------------------

export type AnalysisAreaRect = {sx: number; sy: number; ex: number; ey: number}

export type AnalysisAreaState = {
  analysisAreaRects: AnalysisAreaRect[] | null
  analysisAreaVertices: [number, number][] | null
  areaSelectMode: boolean
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAnalysisAreaStore() {
  let state: AnalysisAreaState = {
    analysisAreaRects: null,
    analysisAreaVertices: null,
    areaSelectMode: false,
  }

  let listeners = new Set<(event: AnalysisAreaStoreEvent) => void>()

  function subscribe(
    listener: (event: AnalysisAreaStoreEvent) => void,
  ): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function emit(event: AnalysisAreaStoreEvent) {
    for (let listener of listeners) listener(event)
  }

  function getState(): Readonly<AnalysisAreaState> {
    return state
  }

  // ---------------------------------------------------------------------------
  // State comparison helper
  // ---------------------------------------------------------------------------

  function rectsEqual(
    a: AnalysisAreaRect[] | null,
    b: AnalysisAreaRect[] | null,
  ): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    if (a.length !== b.length) return false
    return a.every(
      (r, i) =>
        r.sx === b[i].sx &&
        r.sy === b[i].sy &&
        r.ex === b[i].ex &&
        r.ey === b[i].ey,
    )
  }

  function verticesEqual(
    a: [number, number][] | null,
    b: [number, number][] | null,
  ): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    if (a.length !== b.length) return false
    return a.every((v, i) => v[0] === b[i][0] && v[1] === b[i][1])
  }

  // ---------------------------------------------------------------------------
  // Setters — each returns changed: boolean
  // ---------------------------------------------------------------------------

  function setAnalysisArea(
    vertices: [number, number][] | null,
  ): boolean {
    let nextRects: AnalysisAreaRect[] | null = null
    let nextVertices = vertices
    if (
      rectsEqual(state.analysisAreaRects, nextRects) &&
      verticesEqual(state.analysisAreaVertices, nextVertices)
    ) {
      return false
    }
    state = {...state, analysisAreaRects: nextRects, analysisAreaVertices: nextVertices}
    emit({type: 'areaChanged'})
    return true
  }

  function setAnalysisAreaRects(
    rects: AnalysisAreaRect[] | null,
    vertices: [number, number][] | null,
  ): boolean {
    let hasVertices = vertices != null && vertices.length > 0
    let nextRects = hasVertices && rects != null ? rects : null
    let nextVertices = hasVertices ? vertices : null
    if (
      rectsEqual(state.analysisAreaRects, nextRects) &&
      verticesEqual(state.analysisAreaVertices, nextVertices)
    ) {
      return false
    }
    state = {
      ...state,
      analysisAreaRects: nextRects,
      analysisAreaVertices: nextVertices,
    }
    emit({type: 'areaChanged'})
    return true
  }

  function clearAnalysisArea(): boolean {
    if (
      state.analysisAreaRects === null &&
      state.analysisAreaVertices === null
    ) {
      return false
    }
    state = {
      ...state,
      analysisAreaRects: null,
      analysisAreaVertices: null,
    }
    emit({type: 'areaCleared'})
    return true
  }

  function toggleAreaSelectMode(): boolean {
    state = {...state, areaSelectMode: !state.areaSelectMode}
    emit({type: 'areaSelectModeChanged'})
    return true
  }

  function setAreaSelectMode(enabled: boolean): boolean {
    if (state.areaSelectMode === enabled) return false
    state = {...state, areaSelectMode: enabled}
    emit({type: 'areaSelectModeChanged'})
    return true
  }

  function resetOnModeChange(): boolean {
    if (!state.areaSelectMode) return false
    state = {...state, areaSelectMode: false}
    emit({type: 'areaSelectModeChanged'})
    return true
  }

  return {
    getState,
    subscribe,
    setAnalysisArea,
    setAnalysisAreaRects,
    clearAnalysisArea,
    toggleAreaSelectMode,
    setAreaSelectMode,
    resetOnModeChange,
  }
}
