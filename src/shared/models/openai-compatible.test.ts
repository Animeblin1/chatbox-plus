import type { ModelDependencies } from '@shared/types/adapters'
import { describe, expect, it, vi } from 'vitest'
import { fetchRemoteModels } from './openai-compatible'

const mockDependencies = {} as ModelDependencies

function mockModelsResponse(data: unknown[]) {
  return new Response(
    JSON.stringify({
      object: 'list',
      data,
    }),
    { status: 200 }
  )
}

describe('fetchRemoteModels', () => {
  it('infers image model type from OpenAI-compatible model ids', async () => {
    const customFetch = vi.fn().mockResolvedValue(
      mockModelsResponse([
        { id: 'gpt-image-2', object: 'model', created: 0 },
        { id: 'dall-e-3', object: 'model', created: 0 },
        { id: 'gpt-5.5', object: 'model', created: 0 },
      ])
    )

    const models = await fetchRemoteModels(
      {
        apiHost: 'https://example.com/v1',
        apiKey: 'test-key',
        customFetch,
      },
      mockDependencies
    )

    expect(models).toEqual([
      { modelId: 'gpt-image-2', type: 'image' },
      { modelId: 'dall-e-3', type: 'image' },
      { modelId: 'gpt-5.5', type: 'chat' },
    ])
  })

  it('infers image model type from output modalities', async () => {
    const customFetch = vi.fn().mockResolvedValue(
      mockModelsResponse([
        {
          id: 'provider/custom-generator',
          object: 'model',
          created: 0,
          architecture: {
            input_modalities: ['text'],
            output_modalities: ['image'],
          },
        },
      ])
    )

    const models = await fetchRemoteModels(
      {
        apiHost: 'https://example.com/v1',
        apiKey: 'test-key',
        customFetch,
      },
      mockDependencies
    )

    expect(models[0]).toMatchObject({
      modelId: 'provider/custom-generator',
      type: 'image',
    })
  })
})
