import {snapshotToGameTree} from '../study.js'
import type {MutationContract} from '../workbench/contracts/mutationContracts.ts'
import type {
  AnalysisContext,
  AnalysisTarget,
  EngineAnalysis,
  GameTreeLike,
  GameTreeAnalysisContext,
  OwnershipGrid,
  PlayerSign,
  ScratchAnalysisContext,
  VariationAnalysisContext,
} from './analysisTypes.ts'
import {MUTATION_CONTRACTS} from '../workbench/contracts/mutationContracts.ts'

type ScratchDeps = {
  sourceTree: GameTreeLike | null
}

type GameTreeDeps = {
  gameTree: GameTreeLike
  getPlayer: (tp: string) => PlayerSign
  analysis: EngineAnalysis | null
  ownership: OwnershipGrid | null
  mutationContract: MutationContract | null
}

type VariationDeps = {
  gameTree: GameTreeLike
  getPlayer: (tp: string) => PlayerSign
  analysis: EngineAnalysis | null
  ownership: OwnershipGrid | null
}

function buildScratchContext(
  target: Extract<AnalysisTarget, {kind: 'scratch'}>,
  deps: ScratchDeps,
): ScratchAnalysisContext | null {
  let result = snapshotToGameTree(target.snapshot, [], deps.sourceTree)
  if (result == null) return null

  return {
    kind: 'scratch',
    tab: target.tab,
    tree: result.tree,
    treePosition: result.treePosition,
    analyzePlayer: target.snapshot.nextPlayer,
    positionSource: target.positionSource,
    mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
  }
}

function buildGameTreeContext(
  target: Extract<AnalysisTarget, {kind: 'game-tree'}>,
  deps: GameTreeDeps,
): GameTreeAnalysisContext {
  return {
    kind: 'game-tree',
    tab: null,
    tree: deps.gameTree,
    treePosition: target.treePosition,
    analyzePlayer: deps.getPlayer(target.treePosition),
    positionSource: target.positionSource,
    mutationContract: deps.mutationContract ?? MUTATION_CONTRACTS.PLAY_MOVE,
    analysis: deps.analysis,
    ownership: deps.ownership,
  }
}

function buildVariationContext(
  target: Extract<AnalysisTarget, {kind: 'variation'}>,
  deps: VariationDeps,
): VariationAnalysisContext {
  return {
    kind: 'variation',
    tab: null,
    tree: deps.gameTree,
    treePosition: target.treePosition,
    analyzePlayer: deps.getPlayer(target.treePosition),
    positionSource: target.positionSource,
    mutationContract: MUTATION_CONTRACTS.VARIATION_MOVE,
    analysis: deps.analysis,
    ownership: deps.ownership,
  }
}

export type BoardAnalysisContextDeps = ScratchDeps & {
  gameTree?: GameTreeLike
  getPlayer?: (tp: string) => PlayerSign
  analysis?: EngineAnalysis | null
  ownership?: OwnershipGrid | null
  mutationContract?: MutationContract | null
  treePosition?: TreePosition
}

/**
 * Build a unified analysis context from an explicit target and dependencies.
 *
 * Replaces the old state.mode-based dispatch. The caller constructs an
 * AnalysisTarget from state; this function only uses the target's `kind`
 * discriminant to choose the right context builder.
 */
export function getBoardAnalysisContext(
  target: AnalysisTarget,
  deps: BoardAnalysisContextDeps,
): AnalysisContext | null {
  switch (target.kind) {
    case 'scratch':
      return buildScratchContext(target, {
        sourceTree: deps.sourceTree ?? null,
      })

    case 'game-tree':
      return buildGameTreeContext(target, {
        gameTree: deps.gameTree!,
        getPlayer: deps.getPlayer ?? (() => 1 as PlayerSign),
        analysis: deps.analysis ?? null,
        ownership: deps.ownership ?? null,
        mutationContract: deps.mutationContract ?? null,
      })

    case 'variation':
      return buildVariationContext(target, {
        gameTree: deps.gameTree!,
        getPlayer: deps.getPlayer ?? (() => 1 as PlayerSign),
        analysis: deps.analysis ?? null,
        ownership: deps.ownership ?? null,
      })
  }
}
