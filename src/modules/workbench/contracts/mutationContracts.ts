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
  PROBLEM_ATTEMPT_MOVE: 'problemAttemptMove',
  SCRATCH_EDIT: 'scratchEdit',
  RECALL_ANSWER: 'recallAnswer',
  CHECKPOINT_CORRECTION: 'checkpointCorrection',
  VARIATION_MOVE: 'variationMove',
} as const)

export type MutationContract =
  | 'playMove'
  | 'problemAttemptMove'
  | 'scratchEdit'
  | 'recallAnswer'
  | 'checkpointCorrection'
  | 'variationMove'
