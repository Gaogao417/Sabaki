import type GameTree from '@sabaki/immutable-gametree'
import type {GameTreeDraft, TreeNode, TreeId} from '@sabaki/immutable-gametree'
import type {MutationContract} from '../workbench/contracts/mutationContracts.ts'
import type {
  GameTreePositionSource,
  ScratchPosition,
  ScratchPositionSource,
  ScratchRole,
  TreePosition,
} from '../workbench/contracts/positionSource.ts'

// ---------------------------------------------------------------------------
// Domain primitives
// ---------------------------------------------------------------------------

export type PlayerSign = 1 | -1
export type Vertex = [number, number]

/** Edit-workspace analysis tab — excludes 'problem-attempt'. */
export type ScratchAnalysisTab = Extract<ScratchRole, 'current' | 'reference'>

export type OwnershipGrid = number[][]
export type HumanPolicyMap = number[]

// ---------------------------------------------------------------------------
// Re-exports from @sabaki/immutable-gametree declaration
// ---------------------------------------------------------------------------

export type {GameTree, GameTreeDraft, TreeNode, TreeId}
export type {TreePosition} from '../workbench/contracts/positionSource.ts'

/** SGF property map — aliases TreeNode['data'] for convenience. */
export type SgfProperties = TreeNode['data']

// ---------------------------------------------------------------------------
// Engine analysis result
// ---------------------------------------------------------------------------

export type EngineAnalysisVariation = {
  vertex: Vertex
  visits: number
  winrate: number
  scoreLead: number | null
  aiPolicy: number | null
  humanPrior: number | null
  aiRank: number
  humanRank?: number
  moves: Vertex[]
}

export type EngineAnalysis = {
  sign: PlayerSign
  variations: EngineAnalysisVariation[]
  ownership: OwnershipGrid | null
  winrate: number | null
  scoreLead: number | null
  humanPolicyMap: HumanPolicyMap | null
}

// ---------------------------------------------------------------------------
// Structural helpers for snapshot→GameTree conversion
// ---------------------------------------------------------------------------

export type SnapshotToGameTreeResult = {
  tree: GameTree
  treePosition: TreePosition
}

// ---------------------------------------------------------------------------
// Analysis targets — WHAT to analyze. Domain core receives these;
// it never reads state.mode directly.
// ---------------------------------------------------------------------------

export type ScratchAnalysisTarget = {
  kind: 'scratch'
  tab: ScratchAnalysisTab
  snapshot: ScratchPosition
  positionSource: ScratchPositionSource
}

export type GameTreeAnalysisTarget = {
  kind: 'game-tree'
  treePosition: TreePosition
  positionSource: GameTreePositionSource
}

export type VariationAnalysisTarget = {
  kind: 'variation'
  treePosition: TreePosition
  positionSource: GameTreePositionSource
}

export type AnalysisTarget =
  | ScratchAnalysisTarget
  | GameTreeAnalysisTarget
  | VariationAnalysisTarget

// ---------------------------------------------------------------------------
// Analysis contexts — engine-ready descriptions built from targets + deps.
// Discriminated by `kind`, not by `source`.
// ---------------------------------------------------------------------------

export type AnalysisContextBase = {
  tree: GameTree
  treePosition: TreePosition
  analyzePlayer: PlayerSign
}

export type ScratchAnalysisContext = AnalysisContextBase & {
  kind: 'scratch'
  tab: ScratchAnalysisTab
  positionSource: ScratchPositionSource
  mutationContract: 'scratchEdit'
}

export type GameTreeAnalysisContext = AnalysisContextBase & {
  kind: 'game-tree'
  tab: null
  positionSource: GameTreePositionSource
  mutationContract: MutationContract
  analysis: EngineAnalysis | null
  ownership: OwnershipGrid | null
}

export type VariationAnalysisContext = AnalysisContextBase & {
  kind: 'variation'
  tab: null
  positionSource: GameTreePositionSource
  mutationContract: 'variationMove'
  analysis: EngineAnalysis | null
  ownership: OwnershipGrid | null
}

export type AnalysisContext =
  | ScratchAnalysisContext
  | GameTreeAnalysisContext
  | VariationAnalysisContext

// ---------------------------------------------------------------------------
// Deps / runtime types
// ---------------------------------------------------------------------------

export type EngineSyncerLike = {
  id: string
  suspended?: boolean
}

export type RunBoardAnalysisOptions = {
  syncer: EngineSyncerLike
  tree: GameTree
  treePosition: TreePosition
  analyzePlayer: PlayerSign
  requestGroup: 'analysis' | 'scratch-analysis' | 'aux'
  analysisSource?: 'game-tree' | 'scratch-analysis' | 'variation'
  skipOwnershipCache?: boolean
  onAnalysisUpdate?: (analysis: EngineAnalysis | null) => void
}

export type RunBoardAnalysis = (
  options: RunBoardAnalysisOptions,
) => Promise<EngineAnalysis | null>

export type EditWorkspaceAnalysisState = {
  activeTab: ScratchAnalysisTab
  currentSnapshot: ScratchPosition | null
  referenceSnapshot: ScratchPosition | null
  currentAnalysis: EngineAnalysis | null
  referenceAnalysis: EngineAnalysis | null
  currentOwnership: OwnershipGrid | null
  referenceOwnership: OwnershipGrid | null
  analysisPending?: boolean
}

export type AnalysisRuntimeState = {
  scratchTimer: ReturnType<typeof setTimeout> | null
  scratchGeneration: number
  gameTreeTimer: ReturnType<typeof setTimeout> | null
  scratchOwnershipCache: Record<string, OwnershipGrid>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Request group tag for scratch analysis engine calls. */
export const SCRATCH_ANALYSIS_REQUEST_GROUP = 'scratch-analysis'
