import { afterEach, describe, expect, it, vi } from 'vitest'
import { executeCurlRequest } from './curl'

vi.mock('@/platform', () => ({
  default: {
    type: 'desktop',
    getVersion: vi.fn(async () => 'test-version'),
  },
}))

vi.mock('@/stores/settingActions', () => ({
  getToolSettings: vi.fn(() => ({
    curl: {
      enabled: true,
      useOfficialProxy: false,
      timeoutMs: 15000,
      maxResponseChars: 20000,
    },
  })),
}))

describe('curl_request tool', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('performs a basic GET request', async () => {
    const fetchMock = vi.fn(() => {
      return new Response('hello world', {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeCurlRequest({ url: 'https://example.com/page' })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/page',
      expect.objectContaining({
        method: 'GET',
        redirect: 'follow',
      })
    )
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      body: 'hello world',
      truncated: false,
      proxied: false,
    })
  })

  it('returns non-2xx HTTP responses without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return new Response('not found', {
          status: 404,
          statusText: 'Not Found',
        })
      })
    )

    const result = await executeCurlRequest({ url: 'https://example.com/missing' })

    expect(result).toMatchObject({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      body: 'not found',
    })
  })

  it('truncates large response bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return new Response('a'.repeat(600), { status: 200 })
      })
    )

    const result = await executeCurlRequest({
      url: 'https://example.com/large',
      maxResponseChars: 500,
    })

    expect(result).toMatchObject({
      ok: true,
      body: 'a'.repeat(500),
      bodyLength: 500,
      truncated: true,
    })
  })

  it('blocks non-public URL targets', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeCurlRequest({ url: 'http://127.0.0.1:3000/status' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: false,
      error: 'Localhost, loopback, and private-network URLs are not allowed.',
    })
  })

  it('uses Chatbox official proxy when requested', async () => {
    const fetchMock = vi.fn(() => {
      return new Response('proxied', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeCurlRequest({
      url: 'https://example.com/proxied',
      useOfficialProxy: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cors-proxy.chatboxai.app/proxy-api/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'chatbox-target-uri': 'https://example.com/proxied',
          'chatbox-platform': 'desktop',
          'chatbox-version': 'test-version',
        }),
      })
    )
    expect(result).toMatchObject({
      ok: true,
      body: 'proxied',
      proxied: true,
    })
  })
})
