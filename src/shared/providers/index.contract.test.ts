import { describe, expect, it } from 'vitest'
import { settings as getDefaultSettings, newConfigs } from '../defaults'
import { MODELS_DEV_SNAPSHOT } from '../model-registry/snapshot.generated'
import { getModelsDevProviderId } from '../model-registry/provider-mapping'
import type { ProviderModelInfo, ProviderSettings, SessionSettings } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { ModelProviderEnum } from '../types/provider'
import { getAllProviders } from './index'

describe('provider control-plane contracts', () => {
  it('registers providers with unique ids', () => {
    const ids = getAllProviders().map((provider) => provider.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not register removed provider options', () => {
    const ids = getAllProviders().map((provider) => provider.id)
    expect(ids).not.toContain('qwen')
    expect(ids).not.toContain('qwen-portal')
    expect(ids).not.toContain('minimax')
    expect(ids).not.toContain('minimax-cn')
    expect(ids).not.toContain('bedrock')
  })

  it('passes network compatibility proxy setting to remaining provider models', () => {
    const dependencies: ModelDependencies = {
      platformType: 'desktop',
      request: {
        fetchWithOptions: async () => new Response(),
        apiRequest: async () => new Response(),
      },
      storage: {
        saveImage: async () => '',
        getImage: async () => '',
      },
      sentry: {
        captureException: () => {},
        withScope: () => {},
      },
      getRemoteConfig: () => ({}),
    }

    for (const provider of getAllProviders()) {
      if (provider.id === ModelProviderEnum.ChatboxAI) continue

      const providerSetting: ProviderSettings = {
        ...provider.defaultSettings,
        apiKey: 'test-api-key',
        useProxy: true,
      }
      const model: ProviderModelInfo = providerSetting.models?.[0] || { modelId: 'test-model' }
      const sessionSettings: SessionSettings = {
        provider: provider.id,
        modelId: model.modelId,
      }

      const createdModel = provider.createModel({
        settings: sessionSettings,
        globalSettings: {
          ...getDefaultSettings(),
          providers: {
            [provider.id]: providerSetting,
          },
        },
        config: newConfigs(),
        dependencies,
        providerSetting,
        formattedApiHost: providerSetting.apiHost || '',
        formattedApiPath: providerSetting.apiPath || '',
        model,
        effectiveApiKey: 'test-api-key',
      })

      expect((createdModel as { options?: { useProxy?: boolean } }).options?.useProxy).toBe(true)
    }
  })

  it('keeps models.dev mapping aligned with provider definitions', () => {
    for (const provider of getAllProviders()) {
      if (!provider.modelsDevProviderId) continue
      expect(getModelsDevProviderId(provider.id)).toBe(provider.modelsDevProviderId)
    }
  })

  it('keeps curated model ids backed by provider defaults or registry data', () => {
    for (const provider of getAllProviders()) {
      if (!provider.curatedModelIds?.length) continue

      const supportedModelIds = new Set(
        [
          ...(provider.defaultSettings?.models?.map((model) => model.modelId) || []),
          ...Object.keys(MODELS_DEV_SNAPSHOT[provider.id] || {}),
        ].map((modelId) => modelId.toLowerCase())
      )

      for (const curatedModelId of provider.curatedModelIds) {
        expect(supportedModelIds.has(curatedModelId.toLowerCase())).toBe(true)
      }
    }
  })
})
