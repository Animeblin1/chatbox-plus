import type { SearchResult } from '@shared/types'
import WebSearch from './base'

const BING_SEARCH_ENDPOINTS = ['https://www.bing.com/search', 'https://cn.bing.com/search']

type BingSearchOptions = {
  useOfficialProxy?: boolean
}

function normalizeText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function decodeBingRedirectUrl(url: URL) {
  const encodedUrl = url.searchParams.get('u')
  if (!encodedUrl) return null

  const rawValue = encodedUrl.startsWith('a1') || encodedUrl.startsWith('a2') ? encodedUrl.slice(2) : encodedUrl
  const normalized = rawValue.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

  try {
    const decoded = globalThis.atob(padded)
    return decoded.startsWith('http') ? decoded : null
  } catch {
    return null
  }
}

function normalizeBingLink(href: string) {
  try {
    const url = new URL(href, 'https://www.bing.com')
    const decodedRedirect = decodeBingRedirectUrl(url)
    if (decodedRedirect) return decodedRedirect
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

export class BingSearch extends WebSearch {
  private readonly useOfficialProxy: boolean

  constructor(options: BingSearchOptions = {}) {
    super()
    this.useOfficialProxy = options.useOfficialProxy ?? false
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult> {
    let lastError: unknown

    for (const endpoint of BING_SEARCH_ENDPOINTS) {
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
    const nodes = dom.querySelectorAll('#b_results > li.b_algo, li.b_algo')
    return Array.from(nodes)
      .slice(0, 10)
      .map((node) => {
        const nodeA =
          node.querySelector<HTMLAnchorElement>('h2 a[href]') || node.querySelector<HTMLAnchorElement>('a.tilk[href]')
        if (!nodeA) return null
        const href = nodeA.getAttribute('href')
        if (!href) return null
        const link = normalizeBingLink(href)
        if (!link) return null
        const title = normalizeText(nodeA.textContent || nodeA.getAttribute('aria-label'))
        if (!title) return null
        const nodeAbstract =
          node.querySelector('p[class^="b_lineclamp"]') ||
          node.querySelector('.b_caption p') ||
          node.querySelector('.b_snippet')
        const snippet = normalizeText(nodeAbstract?.textContent)
        return { title, link, snippet }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }
}
