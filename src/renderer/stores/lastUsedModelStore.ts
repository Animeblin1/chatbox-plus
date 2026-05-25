import { createStore } from 'zustand'
import { combine, persist } from 'zustand/middleware'
import { ModelProviderEnum } from '@shared/types'
import { commercialServicesEnabled } from '@/utils/commercial-flags'
import { safeStorage } from './safeStorage'

type ModelSelection = {
  provider: string
  modelId: string
}

type State = {
  chat?: ModelSelection
  picture?: ModelSelection
  task?: ModelSelection
}

function sanitizeModelSelection(model?: ModelSelection) {
  if (!commercialServicesEnabled && model?.provider === ModelProviderEnum.ChatboxAI) {
    return undefined
  }
  return model
}

export const lastUsedModelStore = createStore(
  persist(
    combine(
      {
        chat: undefined,
        picture: undefined,
      } as State,
      (set) => ({
        setChatModel: (provider: string, modelId: string) => {
          if (!commercialServicesEnabled && provider === ModelProviderEnum.ChatboxAI) {
            return
          }
          set({
            chat: {
              provider,
              modelId,
            },
          })
        },
        setPictureModel: (provider: string, modelId: string) => {
          if (!commercialServicesEnabled && provider === ModelProviderEnum.ChatboxAI) {
            return
          }
          set({
            picture: {
              provider,
              modelId,
            },
          })
        },
      })
    ),
    {
      name: 'last-used-model',
      version: 1,
      migrate: (persisted) => {
        const state = (persisted || {}) as State
        return {
          ...state,
          chat: sanitizeModelSelection(state.chat),
          picture: sanitizeModelSelection(state.picture),
          task: sanitizeModelSelection(state.task),
        }
      },
      skipHydration: true,
      storage: safeStorage,
    }
  )
)

let initLastUsedModelStorePromise: Promise<State> | undefined
export const initLastUsedModelStore = async () => {
  if (!initLastUsedModelStorePromise) {
    initLastUsedModelStorePromise = new Promise<State>((resolve) => {
      const unsub = lastUsedModelStore.persist.onFinishHydration((val) => {
        unsub()
        resolve(val)
      })
      lastUsedModelStore.persist.rehydrate()
    })
  }
  return initLastUsedModelStorePromise
}
