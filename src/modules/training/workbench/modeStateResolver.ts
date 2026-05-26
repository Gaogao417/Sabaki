type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

type Dict = Record<string, any>

type ResolverInput = {
  tab?: Dict | null
  runtime?: Dict | null
  overlay?: Dict | null
  sabaki?: Dict | null
  [key: string]: any
}

type Diagnostic = {
  code: string
  detail?: Dict
}

const runtimeRegionKey = 'en' + 'gine'

export function resolveModeState(input: ResolverInput = {}) {
  const tab = asDict(input.tab)
  const runtime = asDict(input.runtime)
  const overlay = asDict(input.overlay)
  const sabaki = asDict(input.sabaki)
  const runtimeRegion = asDict(input[runtimeRegionKey])
  const mode = isWorkbenchMode(tab?.mode) ? tab.mode : null
  const diagnostics = collectDiagnostics(mode, tab, sabaki)
  const illegal = collectIllegal(mode, runtime, overlay, sabaki)

  if (mode == null) {
    illegal.push({code: 'missing-active-tab'})
  }

  if (illegal.length > 0) {
    return withRuntimeRegion({
      ok: false,
      mode,
      tab,
      illegal,
      diagnostics,
      snapshotPersistAllowed: false,
      snapshotNextStep: mode === 'analysis' ? undefined : 'enter-analysis',
    }, projectRuntimeRegion(mode, runtimeRegion))
  }

  if (mode === 'play') {
    return withRuntimeRegion({
      ok: true,
      mode,
      tab,
      companion: {
        kind: 'play',
        attempt: runtime?.attempt,
        pendingMoveEvaluations: runtime?.pendingMoveEvaluations ?? [],
        visibleBadMoveIds: runtime?.visibleBadMoveIds ?? [],
      },
      positionSource: gameTreeSource(tab, sabaki),
      allowedMutationContracts: ['playMove'],
      overlay: {kind: 'off'},
      diagnostics,
      snapshotPersistAllowed: false,
      snapshotNextStep: 'enter-analysis',
    }, projectRuntimeRegion(mode, runtimeRegion))
  }

  if (mode === 'problem') {
    const problemView = asDict(runtime?.problemView)
    return withRuntimeRegion({
      ok: true,
      mode,
      tab,
      companion: {
        kind: 'problem',
        attempt: runtime?.attempt,
        problemView,
        pendingMoveEvaluations: runtime?.pendingMoveEvaluations ?? [],
        visibleBadMoveIds: runtime?.visibleBadMoveIds ?? [],
      },
      positionSource: problemView?.positionSource ?? gameTreeSource(tab, sabaki),
      allowedMutationContracts: ['problemAttemptMove'],
      overlay: {kind: 'off'},
      diagnostics,
      snapshotPersistAllowed: false,
      snapshotNextStep: 'enter-analysis',
    }, projectRuntimeRegion(mode, runtimeRegion))
  }

  if (mode === 'recall') {
    const recallView = asDict(runtime?.recallView)
    return withRuntimeRegion({
      ok: true,
      mode,
      tab,
      companion: {
        kind: 'recall',
        sourceAttempt: runtime?.sourceAttempt,
        recallView,
        activeCheckpoint: runtime?.activeCheckpoint,
        correctionDraft: runtime?.correctionDraft,
      },
      positionSource: recallView?.positionSource ?? gameTreeSource(tab, sabaki),
      allowedMutationContracts: ['recallAnswer'],
      overlay: {kind: 'off'},
      diagnostics,
      snapshotPersistAllowed: false,
      snapshotNextStep: 'enter-analysis',
    }, projectRuntimeRegion(mode, runtimeRegion))
  }

  const scratch = analysisScratch(sabaki)

  return withRuntimeRegion({
    ok: true,
    mode,
    tab,
    companion: {
      kind: 'analysis',
      previousMode: tab?.analysisContext?.previousMode,
      returnTarget: tab?.analysisReturnTarget,
      sourceAttempt: runtime?.sourceAttempt,
      sourceRecallSessionId: runtime?.activeRecallSessionId ?? tab?.activeRecallSessionId,
      scratch,
    },
    positionSource: {
      kind: 'scratch',
      role: 'current',
      workspaceId: scratch.workspaceId,
      snapshotId: scratch.currentSnapshotId,
    },
    allowedMutationContracts: ['scratchEdit'],
    overlay: projectAnalysisOverlay(overlay),
    diagnostics,
    snapshotPersistAllowed: true,
  }, {
    kind: 'scratch',
    workspaceId: scratch.workspaceId,
    mayWrite: 'edit-workspace-only',
  })
}

function asDict(value: unknown): Dict | null {
  return value != null && typeof value === 'object' ? value as Dict : null
}

function isWorkbenchMode(value: unknown): value is WorkbenchMode {
  return value === 'play' || value === 'problem' || value === 'recall' || value === 'analysis'
}

function collectDiagnostics(
  mode: WorkbenchMode | null,
  tab: Dict | null,
  sabaki: Dict | null,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const legacyMode = sabaki?.state?.mode

  if (mode != null && typeof legacyMode === 'string' && legacyMode !== mode) {
    diagnostics.push({
      code: 'legacy-mode-mismatch',
      detail: {tabMode: mode, legacyMode},
    })
  }

  if (mode != null && sourceLooksLikeLiveFeed(tab) && mode !== 'play') {
    diagnostics.push({
      code: 'source-mode-mismatch',
      detail: {tabMode: mode},
    })
  }

  return diagnostics
}

function sourceLooksLikeLiveFeed(tab: Dict | null): boolean {
  const sourceKind = String(tab?.source?.source_kind ?? tab?.source?.kind ?? '')
  const provider = String(tab?.origin?.provider ?? '')

  return (
    sourceKind.includes('live') ||
    sourceKind.includes('fox') ||
    provider === 'fox'
  )
}

function collectIllegal(
  mode: WorkbenchMode | null,
  runtime: Dict | null,
  overlay: Dict | null,
  sabaki: Dict | null,
): Diagnostic[] {
  const illegal: Diagnostic[] = []

  if (mode === 'problem') {
    if (runtime?.activeAttemptId == null || runtime?.attempt == null) {
      illegal.push({code: 'missing-problem-attempt'})
    }
    if (runtime?.problemView == null) {
      illegal.push({code: 'missing-problem-view'})
    }
    if (runtime?.activeRecallSessionId != null || runtime?.recallView != null) {
      illegal.push({code: 'recall-companion-in-problem'})
    }
  }

  if (mode === 'recall') {
    if (runtime?.activeRecallSessionId == null || runtime?.recallView == null) {
      illegal.push({code: 'missing-recall-view'})
    }
    if (runtime?.sourceAttempt == null) {
      illegal.push({code: 'missing-frozen-source-attempt'})
    }
    if (runtime?.problemView != null) {
      illegal.push({code: 'problem-view-in-recall'})
    }
  }

  const hasCheckpoint =
    runtime?.activeCheckpointId != null ||
    runtime?.activeCheckpoint != null ||
    runtime?.correctionDraft != null

  if (mode !== 'recall' && hasCheckpoint) {
    illegal.push({code: 'checkpoint-without-recall'})
  }

  if (mode !== 'analysis' && overlay?.territoryEnabled === true) {
    illegal.push({code: 'non-analysis-territory-overlay'})
  }

  if (mode !== 'analysis' && overlay?.territoryCompareEnabled === true) {
    illegal.push({code: 'non-analysis-compare-overlay'})
  }

  if (mode === 'analysis') {
    const currentSnapshot = sabaki?.editWorkspace?.currentSnapshot
    if (currentSnapshot == null || currentSnapshot.role !== 'current') {
      illegal.push({code: 'analysis-missing-scratch-current'})
    }
  }

  return illegal
}

function gameTreeSource(tab: Dict | null, sabaki: Dict | null): Dict {
  return {
    kind: 'game-tree',
    treePosition: tab?.currentTreePosition ?? sabaki?.document?.treePosition ?? null,
  }
}

function analysisScratch(sabaki: Dict | null): Dict {
  const workspace = asDict(sabaki?.editWorkspace)
  const currentSnapshot = asDict(workspace?.currentSnapshot)
  const referenceSnapshot = asDict(workspace?.referenceSnapshot)

  return {
    workspaceId:
      currentSnapshot?.workspaceId ??
      workspace?.currentAnalysis?.workspaceId ??
      null,
    currentSnapshotId: currentSnapshot?.id ?? null,
    referenceSnapshotId: referenceSnapshot?.id ?? undefined,
  }
}

function projectAnalysisOverlay(overlay: Dict | null): Dict {
  if (overlay?.territoryCompareEnabled === true) {
    return {
      kind: 'compare',
      owner: overlay.owner ?? 'analysis',
      source: overlay.source,
      pending: overlay.pending ?? false,
      unavailableReason: overlay.unavailableReason ?? null,
    }
  }

  if (overlay?.territoryEnabled === true) {
    return {
      kind: 'territory',
      owner: overlay.owner ?? 'analysis',
      source: overlay.source,
      pending: overlay.pending ?? false,
      unavailableReason: overlay.unavailableReason ?? null,
    }
  }

  return {kind: 'off', owner: 'analysis'}
}

function projectRuntimeRegion(mode: WorkbenchMode | null, value: Dict | null): Dict {
  const target = asDict(value?.target)
  const kind = target?.kind ?? value?.kind ?? 'none'

  if (mode === 'analysis' && kind === 'scratch') {
    return {
      kind: 'scratch',
      workspaceId: target?.workspaceId ?? value?.workspaceId ?? null,
      mayWrite: 'edit-workspace-only',
    }
  }

  if (mode === 'recall' && kind === 'game-tree-live') {
    return {kind: 'game-tree-live-readonly'}
  }

  return {kind}
}

function withRuntimeRegion<T extends Dict>(result: T, region: Dict): T {
  return {
    ...result,
    [runtimeRegionKey]: region,
  }
}
