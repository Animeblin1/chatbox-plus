import { afterEach, describe, expect, it } from 'vitest'
import { enrichModelFromRegistry, setRuntimeRegistry } from './enrich'
import { MODELS_DEV_SNAPSHOT } from './snapshot.generated'

describe('enrichModelFromRegistry', () => {
  afterEach(() => {
    setRuntimeRegistry(MODELS_DEV_SNAPSHOT)
  })

  it('preserves manually saved capabilities when registry metadata exists', () => {
    setRuntimeRegistry({
      openai: {
        'gpt-5.5': {
          modelId: 'gpt-5.5',
          name: 'GPT 5.5',
          type: 'chat',
          capabilities: ['tool_use', 'reasoning'],
          contextWindow: 128000,
          maxOutput: 8192,
        },
      },
    })

    const enriched = enrichModelFromRegistry(
      {
        modelId: 'gpt-5.5',
        capabilities: ['vision'] as const,
      },
      'openai'
    )

    expect(enriched.capabilities).toEqual(['vision', 'tool_use', 'reasoning'])
  })
})
