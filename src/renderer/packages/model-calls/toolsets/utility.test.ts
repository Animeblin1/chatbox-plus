import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  csvPreviewTool,
  datetimeNowTool,
  getUtilityToolSet,
  htmlExtractTool,
  jsonQueryTool,
  textTransformTool,
  urlTool,
} from './utility'

const getToolSettingsMock = vi.fn()

vi.mock('@/stores/settingActions', () => ({
  getToolSettings: () => getToolSettingsMock(),
}))

const enabledSettings = {
  curl: {
    enabled: true,
    useOfficialProxy: false,
    timeoutMs: 15000,
    maxResponseChars: 20000,
  },
  jsonQuery: { enabled: true },
  textTransform: { enabled: true },
  datetime: { enabled: true },
  htmlExtract: { enabled: true },
  urlTool: { enabled: true },
  csvPreview: { enabled: true },
}

describe('utility toolset', () => {
  beforeEach(() => {
    getToolSettingsMock.mockReturnValue(enabledSettings)
  })

  it('queries JSON by dot and bracket path', async () => {
    const result = await jsonQueryTool.execute?.({
      json: JSON.stringify({ items: [{ title: 'Chatbox' }] }),
      path: 'items[0].title',
    })

    expect(result).toEqual({
      ok: true,
      path: 'items[0].title',
      type: 'string',
      value: 'Chatbox',
    })
  })

  it('transforms unicode text with base64', async () => {
    const encoded = await textTransformTool.execute?.({
      action: 'base64_encode',
      text: '你好 Chatbox',
    })
    expect(encoded).toMatchObject({ ok: true })

    const decoded = await textTransformTool.execute?.({
      action: 'base64_decode',
      text: (encoded as { result: string }).result,
    })
    expect(decoded).toMatchObject({
      ok: true,
      result: '你好 Chatbox',
    })
  })

  it('returns current time fields', async () => {
    const result = await datetimeNowTool.execute?.({ timeZone: 'Asia/Shanghai' })

    expect(result).toMatchObject({
      ok: true,
      timeZone: 'Asia/Shanghai',
    })
    expect(typeof (result as { iso: string }).iso).toBe('string')
    expect(typeof (result as { unixMs: number }).unixMs).toBe('number')
  })

  it('only exposes enabled utility tools', () => {
    getToolSettingsMock.mockReturnValue({
      ...enabledSettings,
      textTransform: { enabled: false },
      htmlExtract: { enabled: false },
      urlTool: { enabled: false },
      csvPreview: { enabled: false },
    })

    expect(Object.keys(getUtilityToolSet().tools)).toEqual(['json_query', 'datetime_now'])
  })

  it('extracts metadata, text, and resolved links from HTML', async () => {
    const result = await htmlExtractTool.execute?.({
      html: '<html><head><title>Example</title><meta name="description" content="Demo"></head><body><a href="/docs">Docs</a><p>Hello&nbsp;world</p></body></html>',
      baseUrl: 'https://example.com/base/',
      mode: 'all',
    })

    expect(result).toMatchObject({
      ok: true,
      metadata: {
        title: 'Example',
        description: 'Demo',
      },
      links: [{ href: 'https://example.com/docs', text: 'Docs' }],
    })
    expect((result as { text: { text: string } }).text.text).toContain('Hello world')
  })

  it('resolves URLs and updates query parameters', async () => {
    const result = await urlTool.execute?.({
      action: 'set_query',
      url: '../search?q=old',
      baseUrl: 'https://example.com/docs/page',
      queryParams: { q: 'new', page: '1' },
    })

    expect(result).toMatchObject({
      ok: true,
      href: 'https://example.com/search?q=new&page=1',
      pathname: '/search',
      query: { q: 'new', page: '1' },
    })
  })

  it('previews CSV rows as objects', async () => {
    const result = await csvPreviewTool.execute?.({
      text: 'name,score\nAlice,10\nBob,12',
      maxRows: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      delimiter: ',',
      headers: ['name', 'score'],
      rows: [{ name: 'Alice', score: '10' }],
      rowCount: 2,
      columnCount: 2,
      truncated: true,
    })
  })
})
