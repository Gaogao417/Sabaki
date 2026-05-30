import type {MutationContract} from '../contracts/mutationContracts.ts'
import type {PositionSource} from '../contracts/positionSource.ts'

export type BoardInteractionPolicy = {
  positionSource: PositionSource | null
  mutationContract: MutationContract | null
  selectedTool: string
  readOnly?: boolean
  readOnlyReason?: string
  allowedVertices?: [number, number][]
  lineFirstVertex?: {type: string; vertex: [number, number]} | null
}
