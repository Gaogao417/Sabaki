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

  function cloneRects(rects: AnalysisAreaRect[] | null): AnalysisAreaRect[] | null {
    if (rects == null) return null
    return rects.map(r => ({sx: r.sx, sy: r.sy, ex: r.ex, ey: r.ey}))
  }

  function cloneVertices(vertices: [number, number][] | null): [number, number][] | null {
    if (vertices == null) return null
    return vertices.map(v => [v[0], v[1]] as [number, number])
  }

  function getState(): Readonly<AnalysisAreaState> {
    return {
      analysisAreaRects: cloneRects(state.analysisAreaRects),
      analysisAreaVertices: cloneVertices(state.analysisAreaVertices),
      areaSelectMode: state.areaSelectMode,
    }
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
    let nextVertices = cloneVertices(vertices)
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
    let nextRects = hasVertices && rects != null ? cloneRects(rects) : null
    let nextVertices = hasVertices ? cloneVertices(vertices) : null
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
