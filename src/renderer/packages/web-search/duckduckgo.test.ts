import { parseHTML } from 'linkedom'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DuckDuckGoSearch } from './duckduckgo'

class TestDOMParser {
  parseFromString(html: string) {
    return parseHTML(html).document
  }
}

describe('DuckDuckGoSearch', () => {
  beforeAll(() => {
    vi.stubGlobal('DOMParser', TestDOMParser)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('extracts DuckDuckGo html results and decodes redirect links', async () => {
    const search = new DuckDuckGoSearch()
    const targetUrl = 'https://example.com/article?a=1'
    const fetchSpy = vi.spyOn(search, 'fetch').mockResolvedValue(`
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/y.js?ad_domain=example-ad.com">Ad Result</a>
      </div>
      <div class="results_links result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(targetUrl)}"> Example Result </a>
        <a class="result__snippet"> Example snippet. </a>
      </div>
      <div class="result">Missing link should be ignored</div>
    `)

    const result = await search.search('chatbox')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://html.duckduckgo.com/html/',
      expect.objectContaining({
        method: 'GET',
        query: { q: 'chatbox' },
      })
    )
    expect(result.items).toEqual([
      {
        title: 'Example Result',
        link: targetUrl,
        snippet: 'Example snippet.',
      },
    ])
  })

  it('falls back to duckduckgo.com when the html subdomain has no results', async () => {
    const search = new DuckDuckGoSearch()
    const fetchSpy = vi
      .spyOn(search, 'fetch')
      .mockResolvedValueOnce('<div class="results"></div>')
      .mockResolvedValueOnce(`
        <div class="web-result">
          <a class="result-link" href="https://example.com/fallback">Fallback Result</a>
        </div>
      `)

    const result = await search.search('chatbox')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1]?.[0]).toBe('https://duckduckgo.com/html/')
    expect(result.items[0]?.link).toBe('https://example.com/fallback')
  })

  it('passes the official proxy option to the fetch layer', async () => {
    const search = new DuckDuckGoSearch({ useOfficialProxy: true })
    const fetchSpy = vi.spyOn(search, 'fetch').mockResolvedValue(`
      <div class="result">
        <a class="result__a" href="https://example.com/proxy">Proxy Result</a>
      </div>
    `)

    await search.search('chatbox')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://html.duckduckgo.com/html/',
      expect.objectContaining({
        useOfficialProxy: true,
      })
    )
  })
})
