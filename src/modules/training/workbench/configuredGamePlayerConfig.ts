import type { PlayerConfig } from '../types/index'

type ConfiguredPlayer = {
  type?: 'human' | 'engine' | string
}

type EngineSyncerRef = {
  id?: string | null
} | null

export function createConfiguredGamePlayerConfig(input: {
  black?: ConfiguredPlayer | null
  white?: ConfiguredPlayer | null
  blackSyncer?: EngineSyncerRef
  whiteSyncer?: EngineSyncerRef
}): PlayerConfig {
  const black = input.black?.type === 'engine' ? 'ai' : 'human'
  const white = input.white?.type === 'engine' ? 'ai' : 'human'
  const engineId =
    white === 'ai'
      ? input.whiteSyncer?.id
      : black === 'ai'
        ? input.blackSyncer?.id
        : undefined

  return {
    black,
    white,
    ai: {
      autoPlay: true,
      ...(engineId != null ? {engineId} : {}),
    },
  }
}
