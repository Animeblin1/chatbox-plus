/** biome-ignore-all lint/suspicious/noExplicitAny: any */
/** biome-ignore-all lint/suspicious/noFallthroughSwitchClause: migrate */

import * as defaults from '@shared/defaults'
import { ModelProviderEnum, type ProviderSettings, type Settings, SettingsSchema } from '@shared/types'
import type { DocumentParserConfig } from '@shared/types/settings'
import deepmerge from 'deepmerge'
import type { WritableDraft } from 'immer'
import { createStore, useStore } from 'zustand'
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getLogger } from '@/lib/utils'
import platform from '@/platform'
import storage from '@/storage'
import { commercialServicesEnabled } from '@/utils/commercial-flags'
import { mergeProviderSettings, type ProviderSettingsUpdate } from './providerSettings'

const log = getLogger('settings-store')

/**
 * Returns platform-specific default document parser configuration.
 * - Desktop: 'local' (has full Node.js environment for local parsing)
 * - Mobile/Web: 'none' (only basic text file support by default)
 */
export function getPlatformDefaultDocumentParser(): DocumentParserConfig {
  return platform.type === 'desktop' ? { type: 'local' } : { type: 'none' }
}

function sanitizeNoCommercialSettings<T extends Record<string, any>>(input: T): T {
  if (commercialServicesEnabled || !input) {
    return input
  }

  const settings: Record<string, any> = { ...input }
  if (settings.extension) {
    settings.extension = { ...settings.extension }
    if (settings.extension.webSearch?.provider === 'build-in') {
      settings.extension.webSearch = {
        ...settings.extension.webSearch,
        provider: 'bing',
      }
    }
    if (settings.extension.documentParser?.type === 'chatbox-ai') {
      settings.extension.documentParser = getPlatformDefaultDocumentParser()
    }
    if (settings.extension.knowledgeBase?.models) {
      const models = { ...settings.extension.knowledgeBase.models }
      if (models.embedding?.providerId === ModelProviderEnum.ChatboxAI) {
        models.embedding = null
      }
      if (models.rerank?.providerId === ModelProviderEnum.ChatboxAI) {
        models.rerank = null
      }
      settings.extension.knowledgeBase = {
        ...settings.extension.knowledgeBase,
        models,
      }
    }
  }

  if (settings.providers?.[ModelProviderEnum.ChatboxAI]) {
    settings.providers = { ...settings.providers }
    delete settings.providers[ModelProviderEnum.ChatboxAI]
  }

  for (const key of ['defaultChatModel', 'threadNamingModel', 'searchTermConstructionModel', 'ocrModel']) {
    if (settings[key]?.provider === ModelProviderEnum.ChatboxAI) {
      settings[key] = undefined
    }
  }

  if (Array.isArray(settings.favoritedModels)) {
    settings.favoritedModels = settings.favoritedModels.filter((model) => model.provider !== ModelProviderEnum.ChatboxAI)
  }

  if (settings.mcp?.enabledBuiltinServers?.length) {
    settings.mcp = {
      ...settings.mcp,
      enabledBuiltinServers: [],
    }
  }

  settings.licenseKey = ''
  settings.licenseInstances = undefined
  settings.licenseDetail = undefined
  settings.licenseActivationMethod = undefined
  settings.lastSelectedLicenseByUser = undefined
  settings.memorizedManualLicenseKey = ''
  settings.autoUpdate = false
  settings.betaUpdate = false

  return settings as T
}

type Action = {
  setSettings: (nextStateOrUpdater: Partial<Settings> | ((state: WritableDraft<Settings>) => void)) => void
  getSettings: () => Settings
}

export const settingsStore = createStore<Settings & Action>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...SettingsSchema.parse(defaults.settings()),
        setSettings: (val) => set(val),
        getSettings: () => {
          const store = get()
          return SettingsSchema.parse(store)
        },
      })),
      {
        name: 'settings',
        storage: createJSONStorage(() => ({
          getItem: async (key) => {
            const res = await storage.getItem<(Settings & { __version?: number }) | null>(key, null)
            if (res) {
              const { __version = 0, ...state } = res
              const sanitizedState = sanitizeNoCommercialSettings(state)
              return JSON.stringify({
                state: sanitizedState,
                version: __version,
              })
            }

            return null
          },
          setItem: async (name, value) => {
            const { state, version } = JSON.parse(value) as { state: Settings; version?: number }
            await storage.setItem(name, { ...sanitizeNoCommercialSettings(state), __version: version || 0 })
          },
          removeItem: async (name) => await storage.removeItem(name),
        })),
        version: 2,
        partialize: (state) => {
          try {
            return SettingsSchema.parse(state)
          } catch {
            return state
          }
        },
        migrate: (persisted: any, version) => {
          // merge the newly added fields in defaults.settings() into the persisted values (deep merge).
          const settings: any = deepmerge(defaults.settings(), persisted, {
            arrayMerge: (_target, source) => source,
          })

          switch (version) {
            case 0:
              // fix typo
              settings.shortcuts.inputBoxSendMessage =
                settings.shortcuts.inpubBoxSendMessage || settings.shortcuts.inputBoxSendMessage
              settings.shortcuts.inputBoxSendMessageWithoutResponse =
                settings.shortcuts.inpubBoxSendMessageWithoutResponse ||
                settings.shortcuts.inputBoxSendMessageWithoutResponse
            case 1:
              if (settings.licenseKey && !settings.licenseActivationMethod) {
                settings.licenseActivationMethod = 'manual'
                settings.memorizedManualLicenseKey = settings.licenseKey
              }
            default:
              break
          }

          // Apply platform-specific default for documentParser if not set
          if (!settings.extension?.documentParser) {
            settings.extension = {
              ...settings.extension,
              documentParser: getPlatformDefaultDocumentParser(),
            }
          }

          return SettingsSchema.parse(sanitizeNoCommercialSettings(settings))
        },
        skipHydration: true,
      }
    )
  )
)

let _initSettingsStorePromise: Promise<Settings> | undefined
export const initSettingsStore = async () => {
  if (!_initSettingsStorePromise) {
    _initSettingsStorePromise = new Promise<Settings>((resolve) => {
      const unsub = settingsStore.persist.onFinishHydration((val) => {
        const providers = val?.providers
        const providersCount =
          providers && typeof providers === 'object' && !Array.isArray(providers) ? Object.keys(providers).length : 0
        if (providersCount === 0) {
          log.info(`[CONFIG_DEBUG] onFinishHydration: providersCount=0`)
        }
        unsub()
        resolve(val)
      })
      settingsStore.persist.rehydrate()
    })
  }

  return await _initSettingsStorePromise
}

settingsStore.subscribe((state, prevState) => {
  // 如果快捷键配置发生变化，需要重新注册快捷键
  if (state.shortcuts !== prevState.shortcuts) {
    platform.ensureShortcutConfig(state.shortcuts)
  }
  // 如果代理配置发生变化，需要重新注册代理
  if (state.proxy !== prevState.proxy) {
    platform.ensureProxyConfig({ proxy: state.proxy })
  }
  // 如果开机自启动配置发生变化，需要重新设置开机自启动
  if (Boolean(state.autoLaunch) !== Boolean(prevState.autoLaunch)) {
    platform.ensureAutoLaunch(state.autoLaunch)
  }
})

export function useSettingsStore<U>(selector: Parameters<typeof useStore<typeof settingsStore, U>>[1]) {
  return useStore<typeof settingsStore, U>(settingsStore, selector)
}

export const useLanguage = () => useSettingsStore((state) => state.language)
export const useTheme = () => useSettingsStore((state) => state.theme)
export const useMcpSettings = () => useSettingsStore((state) => state.mcp)

export const useProviderSettings = (providerId: string) => {
  const providers = useSettingsStore((state) => state.providers)

  const providerSettings = providers?.[providerId]

  const setProviderSettings = (val: ProviderSettingsUpdate) => {
    settingsStore.setState((currentSettings) => {
      return mergeProviderSettings(currentSettings, providerId, val)
    })
  }

  return {
    providerSettings,
    setProviderSettings,
  }
}
