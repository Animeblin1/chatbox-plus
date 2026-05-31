import type { SearchResult } from '@shared/types'
import WebSearch from './base'

const DUCKDUCKGO_SEARCH_ENDPOINTS = ['https://html.duckduckgo.com/html/', 'https://duckduckgo.com/html/']

type DuckDuckGoSearchOptions = {
  useOfficialProxy?: boolean
}

function normalizeText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function isAdLink(url: URL) {
  const hostname = url.hostname.toLowerCase()
  if (hostname.endsWith('duckduckgo.com')) {
    return url.pathname === '/y.js' || url.searchParams.has('ad_domain') || url.searchParams.has('ad_provider')
  }
  if (hostname.endsWith('bing.com')) {
    return url.pathname.includes('/aclick')
  }
  return false
}

function normalizeDuckDuckGoLink(href: string) {
  try {
    const url = new URL(href, 'https://duckduckgo.com')
    if (isAdLink(url)) return null
    const redirectedUrl = url.searchParams.get('uddg')
    if (redirectedUrl) {
      const decodedUrl = new URL(decodeURIComponent(redirectedUrl))
      return isAdLink(decodedUrl) ? null : decodedUrl.href
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href
    }
  } catch {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href
    }
  }
  return null
}

export class DuckDuckGoSearch extends WebSearch {
  private readonly useOfficialProxy: boolean

  constructor(options: DuckDuckGoSearchOptions = {}) {
    super()
    this.useOfficialProxy = options.useOfficialProxy ?? false
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult> {
    let lastError: unknown

    for (const endpoint of DUCKDUCKGO_SEARCH_ENDPOINTS) {
      try {
        const html = await this.fetchSerp(endpoint, query, signal)
        const items = this.extractItems(html)
        if (items.length > 0) {
          return { items }
        }
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) {
      throw lastError
    }
    return { items: [] }
  }

  private async fetchSerp(endpoint: string, query: string, signal?: AbortSignal) {
    const html = await this.fetch(endpoint, {
      method: 'GET',
      query: { q: query },
      useOfficialProxy: this.useOfficialProxy,
      signal,
    })
    return html as string
  }

  private extractItems(html: string) {
    const dom = new DOMParser().parseFromString(html, 'text/html')
    const nodes = dom.querySelectorAll('.result, .results_links, .web-result')
    return Array.from(nodes)
      .slice(0, 10)
      .map((node) => {
        const nodeA =
          node.querySelector<HTMLAnchorElement>('.result__a[href]') ||
          node.querySelector<HTMLAnchorElement>('.result-link[href]') ||
          node.querySelector<HTMLAnchorElement>('a[href]')
        if (!nodeA) return null
        const href = nodeA.getAttribute('href')
        if (!href) return null
        const link = normalizeDuckDuckGoLink(href)
        if (!link) return null
        const title = normalizeText(nodeA.textContent)
        if (!title) return null
        const nodeAbstract =
          node.querySelector('.result__snippet') ||
          node.querySelector('.result-snippet') ||
          node.querySelector('.snippet')
        const snippet = normalizeText(nodeAbstract?.textContent)
        return { title, link, snippet }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }
}
