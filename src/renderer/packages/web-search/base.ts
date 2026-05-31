import { CapacitorHttp } from '@capacitor/core'
import type { SearchResult } from '@shared/types'
import { type FetchOptions, ofetch } from 'ofetch'
import platform from '@/platform'

const CHATBOX_OFFICIAL_PROXY_URL = 'https://cors-proxy.chatboxai.app/proxy-api/completions'

type WebSearchFetchOptions = FetchOptions & {
  useOfficialProxy?: boolean
}

export interface ParseLinkResult {
  url: string
  title: string
  content: string
}

function appendQuery(url: string, query?: FetchOptions['query']) {
  if (!query) return url

  const normalizedUrl = new URL(url)
  const params = new URLSearchParams(query as Record<string, string>)
  params.forEach((value, key) => {
    normalizedUrl.searchParams.set(key, value)
  })
  return normalizedUrl.toString()
}

function toPlainHeaders(headers?: WebSearchFetchOptions['headers']) {
  const plainHeaders: Record<string, string> = {}
  if (!headers) return plainHeaders

  new Headers(headers as HeadersInit).forEach((value, key) => {
    plainHeaders[key] = value
  })
  return plainHeaders
}

abstract class WebSearch {
  abstract search(query: string, signal?: AbortSignal): Promise<SearchResult>

  supportsParseLink = false

  /**
   * Parse/extract readable content from a URL.
   * Override in subclasses that support this capability.
   */
  parseLink(_url: string, _signal?: AbortSignal): Promise<ParseLinkResult | null> {
    return Promise.resolve(null)
  }

  async fetch(url: string, options: WebSearchFetchOptions) {
    const targetUrl = appendQuery(url, options.query)
    const requestUrl = options.useOfficialProxy ? CHATBOX_OFFICIAL_PROXY_URL : url
    const { origin } = new URL(requestUrl)
    const headers = {
      ...toPlainHeaders(options.headers),
      ...(options.useOfficialProxy
        ? {
            'CHATBOX-TARGET-URI': targetUrl,
            'CHATBOX-PLATFORM': platform.type,
            'CHATBOX-VERSION': await platform.getVersion().catch(() => 'unknown'),
          }
        : {}),
    }

    if (platform.type === 'mobile') {
      const { data } = await CapacitorHttp.request({
        url: requestUrl,
        method: options.method,
        headers: {
          ...headers,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
          origin,
          referer: origin,
        },
        params: options.useOfficialProxy ? undefined : options.query,
        data: options.body,
      })

      return data
    } else {
      return ofetch(requestUrl, {
        ...options,
        headers,
        query: options.useOfficialProxy ? undefined : options.query,
      })
    }
  }
}

export default WebSearch
