import type { WorkbenchMode } from '../types/index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input to the projectGobanProps pure projection function.
 * All data arrives via parameters — no store/service/adapter reads inside.
 */
export type GobanPropsInput = {
  workbenchMode: WorkbenchMode
  task: {
    problemArea?: object
    prompt?: string
    goal?: string
  } | null
  runtimeState: {
    activeCheckpointId?: string
    correctionDraft?: object
  }
  boardState: {
    gameTree: object | null
    treePosition: string
    board: object
  }
  overlayState: {
    paintMap: number[][]
    markerMap: (object | null)[][]
    dimmedStones: [number, number][]
    analysis: object | null
    overlayGhostStoneMap?: object | null
  }
  settings: {
    showMoveNumbers: boolean
    showNextMoves: boolean
    showSiblings: boolean
    showAnalysis: boolean
    showCoordinates: boolean
    showHumanPreference: boolean
    selectedTool: string
    editWorkspaceActive: boolean
    boardTransformation: number[]
    areaSelectMode: boolean
  }
  analysisData: {
    activeAnalysis: object | null
    analysisType: string
  } | null
}

/**
 * Structured Goban props output from the projection.
 * The Container passes these into WorkbenchShell -> MainBoardStage -> Goban.
 */
export type GobanPropsOutput = {
  boardStateProps: {
    gameTree: object | null
    treePosition: string
    board: object
  }
  overlayDisplayProps: {
    paintMap: number[][]
    markerMap: (object | null)[][]
    dimmedStones: [number, number][]
    analysis: object | null
    showMoveNumbers: boolean
    showNextMoves: boolean
    showSiblings: boolean
    crosshair: boolean
    overlayGhostStoneMap?: object | null
    showCoordinates: boolean
    showMoveColorization: boolean
    fuzzyStonePlacement: boolean
    animateStonePlacement: boolean
    highlightVertices: [number, number][]
    analysisType: string
    showHumanPreference: boolean
  }
  interactionProps: {
    dragMode: boolean
    drawLineMode: string | null
    areaSelectMode: boolean
    transformation: number[]
  }
  handlerProps: {
    onVertexClick: Function
    onLineDraw: Function
    onAreaSelect: Function
    onStoneDragEnd: Function | null
    onPlayVariationMoves: Function | null
  }
  analysisPanelProps: {
    engineStatus: string
    evaluation: string
    candidates: Array<{label: string; moves: string[]}>
    analysisType: string
    overlayVisible: boolean
  } | null
}

// ---------------------------------------------------------------------------
// No-op placeholder handlers
//
// The Container replaces these with real handlers wired through the
// controller/service/resolver chain. Tests verify existence and typeof only.
// ---------------------------------------------------------------------------

const noop = () => {}

// ---------------------------------------------------------------------------
// projectGobanProps
// ---------------------------------------------------------------------------

/**
 * Pure projection function: maps a state snapshot to structured Goban props.
 *
 * Per-mode behavior derives from:
 *   - Contract Section 7: projectGobanProps Function Spec
 *   - Matrix Section 2.3: Overlay Activation by Mode
 *   - Matrix Section 3.1-3.3: Goban Props by Mode
 *
 * Purity guarantees:
 *   - No imports of stores, services, sabaki.js
 *   - No global state reads or window property access
 *   - No service/repository/adapter/store calls
 *   - No mutation of input parameters
 *   - No random output or timestamp calls
 */
export function projectGobanProps(input: GobanPropsInput | null): GobanPropsOutput {
  // When input is null (adapter unavailable), return a minimal output with
  // null board so that Container never fabricates a 19x19 zero-filled signMap.
  // Contract T2-07: Container must not fabricate board state.
  if (input == null) {
    return {
      boardStateProps: {
        gameTree: null,
        treePosition: '',
        board: null,
      },
      overlayDisplayProps: {
        paintMap: [],
        markerMap: [],
        dimmedStones: [],
        analysis: null,
        showMoveNumbers: false,
        showNextMoves: true,
        showSiblings: true,
        crosshair: false,
        showCoordinates: true,
        showMoveColorization: false,
        fuzzyStonePlacement: false,
        animateStonePlacement: false,
        highlightVertices: [],
        analysisType: '',
        showHumanPreference: false,
      },
      interactionProps: {
        dragMode: false,
        drawLineMode: null,
        areaSelectMode: false,
        transformation: [1, 0, 0, 1, 0, 0],
      },
      handlerProps: {
        onVertexClick: noop,
        onLineDraw: noop,
        onAreaSelect: noop,
        onStoneDragEnd: null,
        onPlayVariationMoves: null,
      },
      analysisPanelProps: null,
    }
  }

  const { workbenchMode, boardState, overlayState, settings, analysisData } = input

  const isAnalysisWithEditWorkspace =
    workbenchMode === 'analysis' && settings.editWorkspaceActive

  // --- overlayDisplayProps ---

  const showMoveNumbers = computeShowMoveNumbers(workbenchMode, settings)
  const showNextMoves = computeShowNextMoves(workbenchMode, settings)
  const showSiblings = computeShowSiblings(workbenchMode, settings)
  const analysis = computeAnalysis(workbenchMode, overlayState, settings)
  const analysisPanelProps = computeAnalysisPanelProps(
    workbenchMode,
    analysis,
    overlayState,
    analysisData,
  )

  const isRecall = workbenchMode === 'recall'

  const overlayDisplayProps = {
    paintMap: isRecall ? ([] as number[][]) : overlayState.paintMap,
    markerMap: isRecall ? null : overlayState.markerMap,
    dimmedStones: [] as [number, number][],
    analysis,
    showMoveNumbers,
    showNextMoves,
    showSiblings,
    crosshair: false,
    overlayGhostStoneMap: isRecall ? null : (overlayState.overlayGhostStoneMap ?? null),
    showCoordinates: settings.showCoordinates,
    showMoveColorization: false,
    fuzzyStonePlacement: false,
    animateStonePlacement: false,
    highlightVertices: [] as [number, number][],
    analysisType: analysis ? (analysisData?.analysisType ?? '') : '',
    showHumanPreference: settings.showHumanPreference,
  }

  // --- interactionProps ---

  const dragMode = isAnalysisWithEditWorkspace
  const drawLineMode = isAnalysisWithEditWorkspace
    ? computeDrawLineMode(settings.selectedTool)
    : null

  const interactionProps = {
    dragMode,
    drawLineMode,
    areaSelectMode: settings.areaSelectMode,
    transformation: settings.boardTransformation,
  }

  // --- handlerProps ---
  // No-op placeholders. Container replaces these with real handler wiring.

  const handlerProps = {
    onVertexClick: noop,
    onLineDraw: noop,
    onAreaSelect: noop,
    onStoneDragEnd: isAnalysisWithEditWorkspace ? (noop as Function) : null,
    onPlayVariationMoves: isAnalysisWithEditWorkspace ? (noop as Function) : null,
  }

  // --- boardStateProps: passthrough ---

  const boardStateProps = {
    gameTree: boardState.gameTree,
    treePosition: boardState.treePosition,
    board: boardState.board,
  }

  return {
    boardStateProps,
    overlayDisplayProps,
    interactionProps,
    handlerProps,
    analysisPanelProps,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (pure)
// ---------------------------------------------------------------------------

function computeShowMoveNumbers(
  mode: WorkbenchMode,
  settings: GobanPropsInput['settings'],
): boolean {
  if (mode === 'recall') return true
  if (mode === 'analysis' && settings.editWorkspaceActive) {
    return settings.showMoveNumbers
  }
  return false
}

function computeShowNextMoves(
  mode: WorkbenchMode,
  settings: GobanPropsInput['settings'],
): boolean {
  if (mode === 'recall') return false
  return settings.showNextMoves
}

function computeShowSiblings(
  mode: WorkbenchMode,
  settings: GobanPropsInput['settings'],
): boolean {
  if (mode === 'recall') return false
  return settings.showSiblings
}

function computeAnalysis(
  mode: WorkbenchMode,
  overlayState: GobanPropsInput['overlayState'],
  settings: GobanPropsInput['settings'],
): object | null {
  // Analysis overlay is owned by scratch analysis only.
  if (mode !== 'analysis' || !settings.editWorkspaceActive) return null
  if (settings.showAnalysis) return overlayState.analysis
  return null
}

function computeDrawLineMode(selectedTool: string): string | null {
  if (selectedTool === 'arrow' || selectedTool === 'line') {
    return selectedTool
  }
  return null
}

function computeAnalysisPanelProps(
  mode: WorkbenchMode,
  visibleAnalysis: object | null,
  overlayState: GobanPropsInput['overlayState'],
  analysisData: GobanPropsInput['analysisData'],
): GobanPropsOutput['analysisPanelProps'] {
  if (mode !== 'analysis') return null

  const rawAnalysis = asRecord(analysisData?.activeAnalysis) ??
    asRecord(overlayState.analysis)
  if (rawAnalysis == null) {
    return {
      engineStatus: '',
      evaluation: '',
      candidates: [],
      analysisType: analysisData?.analysisType ?? '',
      overlayVisible: visibleAnalysis != null,
    }
  }

  return {
    engineStatus: firstString(rawAnalysis, [
      'engineStatus',
      'status',
      'statusLabel',
      'engine',
      'label',
    ]),
    evaluation: firstString(rawAnalysis, [
      'evaluation',
      'evaluationLabel',
      'scoreLeadLabel',
      'winrateLabel',
      'scoreLabel',
    ]),
    candidates: normalizeCandidates(rawAnalysis),
    analysisType: analysisData?.analysisType ?? '',
    overlayVisible: visibleAnalysis != null,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
}

function firstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function normalizeCandidates(
  source: Record<string, unknown>,
): Array<{label: string; moves: string[]}> {
  const raw = Array.isArray(source.candidates)
    ? source.candidates
    : Array.isArray(source.variations)
      ? source.variations
      : []

  return raw.map((item, index) => {
    const record = asRecord(item) ?? {}
    const movesValue = record.moves
    const moves = Array.isArray(movesValue)
      ? movesValue.map(move => String(move))
      : typeof movesValue === 'string'
        ? movesValue.split(/\s+/).filter(Boolean)
        : []
    const label = firstString(record, ['label', 'move', 'vertex']) ||
      `candidate ${index + 1}`
    return {label, moves}
  })
}

// Default export so tryImport(mod.default || mod) resolves to the function itself.
export default projectGobanProps
