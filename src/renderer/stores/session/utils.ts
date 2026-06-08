import * as Sentry from '@sentry/react'
import { AIProviderNoImplementedPaintError, ApiError, BaseError, NetworkError, OCRError } from '@shared/models/errors'
import type { Message, ModelProvider, Session, SessionSettings, SessionType, Settings } from '@shared/types'
import { ModelProviderEnum } from '@shared/types'
import { identity, pickBy } from 'lodash'
import { getModelDisplayName } from '@/packages/model-setting-utils'
import { commercialServicesEnabled } from '@/utils/commercial-flags'
import { trackEvent } from '@/utils/track'
import { uiStore } from '../uiStore'

export function getSessionWebBrowsing(sessionId: string, provider: string | undefined): boolean {
  const sessionValue = uiStore.getState().sessionWebBrowsingMap[sessionId]
  if (sessionValue !== undefined) {
    return sessionValue
  }
  return commercialServicesEnabled && provider === ModelProviderEnum.ChatboxAI
}

export function trackGenerateEvent(
  sessionId: string,
  settings: SessionSettings,
  globalSettings: Settings,
  sessionType: SessionType | undefined,
  options?: { operationType?: 'send_message' | 'regenerate' }
) {
  let providerIdentifier: ModelProvider = settings.provider || 'unknown'
  if (settings.provider?.startsWith('custom-provider-')) {
    const providerSettings = globalSettings.providers?.[settings.provider]
    if (providerSettings?.apiHost) {
      try {
        const url = new URL(providerSettings.apiHost)
        providerIdentifier = `custom:${url.hostname}`
      } catch {
        providerIdentifier = `custom:${providerSettings.apiHost}`
      }
    } else {
      providerIdentifier = 'custom:unknown'
    }
  }

  const webBrowsing = getSessionWebBrowsing(sessionId, settings.provider)

  trackEvent('generate', {
    provider: providerIdentifier,
    model: settings.modelId || 'unknown',
    operation_type: options?.operationType || 'unknown',
    web_browsing_enabled: webBrowsing ? 'true' : 'false',
    session_type: sessionType || 'chat',
  })
}

export function findTargetMessageIndex(
  session: Session,
  targetMsgId: string
): { messages: Message[]; index: number } | null {
  let messages = session.messages
  let targetMsgIx = messages.findIndex((m) => m.id === targetMsgId)

  if (targetMsgIx <= 0) {
    if (!session.threads) {
      return null
    }
    for (const t of session.threads) {
      messages = t.messages
      targetMsgIx = messages.findIndex((m) => m.id === targetMsgId)
      if (targetMsgIx > 0) {
        break
      }
    }
    if (targetMsgIx <= 0) {
      return null
    }
  }

  return { messages, index: targetMsgIx }
}

export async function initializeTargetMessage(
  targetMsg: Message,
  settings: SessionSettings,
  globalSettings: Settings,
  sessionType: SessionType | undefined
): Promise<Message> {
  return {
    ...targetMsg,
    cancel: undefined,
    aiProvider: settings.provider,
    model: await getModelDisplayName(settings, globalSettings, sessionType || 'chat'),
    style: sessionType === 'picture' ? settings.dalleStyle : undefined,
    generating: true,
    errorCode: undefined,
    error: undefined,
    errorExtra: undefined,
    status: [],
    firstTokenLatency: undefined,
    isStreamingMode: settings.stream !== false,
  }
}

export function handleGenerationError(err: unknown, targetMsg: Message, settings: SessionSettings): Message {
  const error = !(err instanceof Error) ? new Error(`${err}`) : err
  const isExpectedOCRError = error instanceof OCRError && error.cause instanceof BaseError

  if (
    !(
      error instanceof ApiError ||
      error instanceof NetworkError ||
      error instanceof AIProviderNoImplementedPaintError ||
      isExpectedOCRError
    )
  ) {
    Sentry.captureException(error)
  }

  let errorCode: number | undefined
  if (err instanceof BaseError) {
    errorCode = err.code
  }
  const ocrError = error instanceof OCRError ? error : undefined
  const causeError = ocrError?.cause

  return {
    ...targetMsg,
    generating: false,
    cancel: undefined,
    errorCode: ocrError ? (causeError instanceof BaseError ? causeError.code : errorCode) : errorCode,
    error: `${error.message}`,
    errorExtra: pickBy(
      {
        aiProvider: ocrError ? ocrError.ocrProvider : settings.provider,
        host:
          error instanceof NetworkError ? error.host : causeError instanceof NetworkError ? causeError.host : undefined,
        responseBody:
          error instanceof ApiError
            ? error.responseBody
            : causeError instanceof ApiError
              ? causeError.responseBody
              : undefined,
      },
      identity
    ),
    status: [],
  }
}
