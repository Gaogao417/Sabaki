export {
  SCRATCH_ROLES,
  createGameTreePositionSource,
  createScratchPosition,
  createScratchPositionFromSnapshot,
  createScratchPositionSource,
  snapshotFromScratchPosition,
} from './positionSource.ts'

export type {
  GameTreePositionSource,
  PositionSource,
  ScratchPosition,
  ScratchPositionOrigin,
  ScratchPositionSource,
  ScratchRole,
  TreePosition,
} from './positionSource.ts'

export {MUTATION_CONTRACTS} from './mutationContracts.ts'
export type {MutationContract} from './mutationContracts.ts'

export {
  WORKSPACE_DEFAULTS,
  WORKSPACE_KINDS,
  createScratchEditExecutionContext,
  getMutationContractForWorkspace,
  getMutationContractFromState,
  getPositionSourceFromState,
  getWorkspaceKindFromState,
} from './workspaceDefaults.ts'
export type {ScratchEditExecutionContext, WorkspaceKind} from './workspaceDefaults.ts'

export {
  OVERLAY_LAYER_SOURCES,
  OVERLAY_RENDER_MODES,
} from './overlayLayers.ts'
export type {
  OverlayLayer,
  OverlayLayerSource,
  OverlayRenderMode,
} from './overlayLayers.ts'

// Phase 3: board interaction resolver (shadow mode)
export {BOARD_INTENTS, RESOLVE_STATUSES} from '../board-interactions/intents.ts'
export type {
  BoardInteractionResult,
  BoardIntent,
  ResolveStatus,
} from '../board-interactions/intents.ts'

export {resolveBoardInteraction} from '../board-interactions/resolveBoardInteraction.ts'
export type {
  BoardEvent,
  PointState,
  ResolverInput,
} from '../board-interactions/resolveBoardInteraction.ts'

export {createBoardInteractionContext} from '../board-interactions/createBoardInteractionContext.ts'
