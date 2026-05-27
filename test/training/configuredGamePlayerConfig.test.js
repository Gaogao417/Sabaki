import assert from 'assert'

import {createConfiguredGamePlayerConfig} from '../../src/modules/training/workbench/configuredGamePlayerConfig.ts'

describe('configured game player config', () => {
  it('maps human black versus AI white to Workbench play playerConfig', () => {
    const result = createConfiguredGamePlayerConfig({
      black: {type: 'human'},
      white: {type: 'engine'},
      blackSyncer: null,
      whiteSyncer: {id: 'engine_white'},
    })

    assert.deepStrictEqual(result, {
      black: 'human',
      white: 'ai',
      ai: {
        autoPlay: true,
        engineId: 'engine_white',
      },
    })
  })

  it('maps AI black versus human white to the black engine id', () => {
    const result = createConfiguredGamePlayerConfig({
      black: {type: 'engine'},
      white: {type: 'human'},
      blackSyncer: {id: 'engine_black'},
      whiteSyncer: null,
    })

    assert.deepStrictEqual(result, {
      black: 'ai',
      white: 'human',
      ai: {
        autoPlay: true,
        engineId: 'engine_black',
      },
    })
  })
})
