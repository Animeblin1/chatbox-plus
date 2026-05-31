import { parseHTML } from 'linkedom'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BingSearch } from './bing'

class TestDOMParser {
  parseFromString(html: string) {
    return parseHTML(html).document
  }
}

function encodeBingRedirect(url: string) {
  return `a1${Buffer.from(url, 'utf8').toString('base64url')}`
}

describe('BingSearch', () => {
  beforeAll(() => {
    vi.stubGlobal('DOMParser', TestDOMParser)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('extracts Bing organic result links and snippets', async () => {
    const search = new BingSearch()
    const targetUrl = 'https://example.com/article?ref=bing'
    const fetchSpy = vi.spyOn(search, 'fetch').mockResolvedValue(`
      <ol id="b_results">
        <li class="b_algo">
          <h2>
            <a href="/ck/a?u=${encodeBingRedirect(targetUrl)}"> Example Result </a>
          </h2>
          <div class="b_caption">
            <p> Example snippet with extra whitespace. </p>
          </div>
        </li>
      </ol>
    `)

    const result = await search.search('chatbox')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.bing.com/search',
      expect.objectContaining({
        method: 'GET',
        query: { q: 'chatbox' },
      })
    )
    expect(result.items).toEqual([
      {
        title: 'Example Result',
        link: targetUrl,
        snippet: 'Example snippet with extra whitespace.',
      },
    ])
  })

  it('falls back to the cn.bing.com endpoint when the first endpoint has no results', async () => {
    const search = new BingSearch()
    const fetchSpy = vi
      .spyOn(search, 'fetch')
      .mockResolvedValueOnce('<ol id="b_results"></ol>')
      .mockResolvedValueOnce(`
        <ol id="b_results">
          <li class="b_algo">
            <h2><a href="https://example.com/fallback">Fallback Result</a></h2>
          </li>
        </ol>
      `)

    const result = await search.search('chatbox')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1]?.[0]).toBe('https://cn.bing.com/search')
    expect(result.items[0]?.link).toBe('https://example.com/fallback')
  })

  it('passes the official proxy option to the fetch layer', async () => {
    const search = new BingSearch({ useOfficialProxy: true })
    const fetchSpy = vi.spyOn(search, 'fetch').mockResolvedValue(`
      <ol id="b_results">
        <li class="b_algo">
          <h2><a href="https://example.com/proxy">Proxy Result</a></h2>
        </li>
      </ol>
    `)

    await search.search('chatbox')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.bing.com/search',
      expect.objectContaining({
        useOfficialProxy: true,
      })
    )
  })
})
