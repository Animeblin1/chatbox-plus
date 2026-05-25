import type { CopilotDetail } from '@shared/types'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useMemo } from 'react'
import storage, { StorageKey } from '@/storage'

const myCopilotsAtom = atomWithStorage<CopilotDetail[]>(StorageKey.MyCopilots, [], storage)

export function useMyCopilots() {
  const [copilots, setCopilots] = useAtom(myCopilotsAtom)

  // Sort my copilots: starred first
  const sortedCopilots = useMemo(() => {
    return [...copilots.filter((item) => item.starred), ...copilots.filter((item) => !item.starred)]
  }, [copilots])

  const addOrUpdate = (target: CopilotDetail) => {
    setCopilots(async (prev) => {
      const copilots = await prev
      let found = false
      const newCopilots = copilots.map((c) => {
        if (c.id === target.id) {
          found = true
          return {
            ...c,
            ...target,
            updatedAt: Date.now(),
          }
        }
        return c
      })
      if (!found) {
        newCopilots.unshift({
          ...target,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
      return newCopilots
    })
  }

  const remove = (id: string) => {
    setCopilots(async (prev) => {
      const copilots = await prev
      return copilots.filter((c) => c.id !== id)
    })
  }

  return {
    copilots: sortedCopilots,
    addOrUpdate,
    remove,
  }
}

export function useRemoteCopilotTags() {
  return { tags: [] as string[], isLoading: false, isFetching: false, isError: false }
}

type RemoteCopilotsByCursorFilters = {
  limit?: number
  tag?: string
  search?: string
}

export function useRemoteCopilotsByCursor(filters?: RemoteCopilotsByCursorFilters) {
  void filters

  return {
    copilots: [] as CopilotDetail[],
    fetchNextPage: async () => undefined,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isFetching: false,
    isError: false,
  }
}
