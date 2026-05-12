/**
 * Write-permission contract ids.
 *
 * These values name the durable state a committed action may write. They should
 * stay thin: raw input meaning belongs in a BoardInteractionIntent resolver, and
 * concrete refresh/overlay side effects belong in the executor that handles that
 * intent.
 */
export const MUTATION_CONTRACTS = Object.freeze({
  PLAY_MOVE: 'playMove',
  SCRATCH_EDIT: 'scratchEdit',
  RECALL_ANSWER: 'recallAnswer',
  VARIATION_MOVE: 'variationMove',
} as const)

export type MutationContract =
  | 'playMove'
  | 'scratchEdit'
  | 'recallAnswer'
  | 'variationMove'
