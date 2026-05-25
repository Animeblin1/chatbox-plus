import { ModelProviderEnum, type Session, type SessionMeta, type SessionSettings } from '@shared/types'
import { mapValues } from 'lodash'
import { commercialServicesEnabled } from '@/utils/commercial-flags'
import { migrateMessage } from '../../shared/utils/message'

function sanitizeSessionSettings(settings?: SessionSettings): SessionSettings | undefined {
  if (!settings || commercialServicesEnabled || settings.provider !== ModelProviderEnum.ChatboxAI) {
    return settings
  }
  const { provider: _provider, modelId: _modelId, ...rest } = settings
  return rest
}

export function migrateSession(session: Session): Session {
  return {
    ...session,
    settings: {
      // temperature未设置的时候使用默认值undefined，这样才能覆盖全局设置
      temperature: undefined,
      ...sanitizeSessionSettings(session.settings),
    },
    messages: session.messages?.map((m) => migrateMessage(m)) || [],
    threads: session.threads?.map((t) => ({
      ...t,
      messages: t.messages.map((m) => migrateMessage(m)) || [],
    })),
    messageForksHash: mapValues(session.messageForksHash || {}, (forks) => ({
      ...forks,
      lists:
        forks.lists?.map((list) => ({
          ...list,
          messages: list.messages?.map((m) => migrateMessage(m)) || [],
        })) || [],
    })),
  }
}

export function sortSessions(sessions: SessionMeta[]): SessionMeta[] {
  const reversed: SessionMeta[] = []
  const pinned: SessionMeta[] = []
  for (const sess of sessions) {
    // Skip hidden sessions (e.g., migrated picture sessions)
    if (sess.hidden) {
      continue
    }
    if (sess.starred) {
      pinned.push(sess)
      continue
    }
    reversed.unshift(sess)
  }
  return pinned.concat(reversed)
}
