import { tool } from 'ai'
import z from 'zod'
import platform from '@/platform'
import * as settingActions from '@/stores/settingActions'

const CHATBOX_OFFICIAL_PROXY_URL = 'https://cors-proxy.chatboxai.app/proxy-api/completions'

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_TIMEOUT_MS = 60_000
const DEFAULT_MAX_RESPONSE_CHARS = 20_000
const MAX_RESPONSE_CHARS = 100_000
const MAX_REQUEST_BODY_CHARS = 1_000_000

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain'])
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key'])
const DISALLOWED_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
  'transfer-encoding',
  'upgrade',
])

const toolSetDescription = `
Use this tool to make HTTP requests to public web URLs.

## curl_request
Performs an HTTP request without using the operating system command line.
- Supports GET, POST, PUT, PATCH, DELETE, and HEAD.
- Use it when the user asks you to fetch a URL, inspect an API response, or make a simple HTTP request.
- Only http:// and https:// URLs are allowed.
- Localhost, loopback, and private-network addresses are blocked for safety.
- Responses are truncated by default to keep the conversation concise.
`

const MethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])

export const CurlRequestInputSchema = z.object({
  url: z.string().url().describe('The target URL. Only http:// and https:// URLs are allowed.'),
  method: MethodSchema.default('GET').optional().describe('HTTP method. Defaults to GET.'),
  headers: z.record(z.string(), z.string()).optional().describe('Optional request headers.'),
  body: z
    .string()
    .max(MAX_REQUEST_BODY_CHARS)
    .optional()
    .describe('Optional request body. Not allowed for GET or HEAD.'),
  timeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(MAX_TIMEOUT_MS)
    .optional()
    .describe('Request timeout in milliseconds. Defaults to the value in Tool Settings.'),
  followRedirects: z.boolean().default(true).optional().describe('Whether to follow redirects. Defaults to true.'),
  maxResponseChars: z
    .number()
    .int()
    .min(500)
    .max(MAX_RESPONSE_CHARS)
    .optional()
    .describe('Maximum response body characters to return. Defaults to the value in Tool Settings.'),
  useOfficialProxy: z
    .boolean()
    .optional()
    .describe('Use Chatbox official network proxy. Defaults to the value in Tool Settings.'),
})

export type CurlRequestInput = z.infer<typeof CurlRequestInputSchema>

interface NormalizedCurlRequest {
  targetUrl: URL
  requestUrl: string
  method: z.infer<typeof MethodSchema>
  headers: Record<string, string>
  body?: string
  timeoutMs: number
  followRedirects: boolean
  maxResponseChars: number
  useOfficialProxy: boolean
}

interface CurlHttpResult {
  ok: boolean
  status: number
  statusText: string
  url: string
  finalUrl: string
  redirected: boolean
  headers: Record<string, string>
  body: string
  bodyLength: number
  truncated: boolean
  elapsedMs: number
  proxied: boolean
}

interface CurlErrorResult {
  ok: false
  url: string
  error: string
  elapsedMs: number
  proxied: boolean
}

type CurlRequestResult = CurlHttpResult | CurlErrorResult

function isBlockedIPv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false

  const nums = parts.map((part) => Number(part))
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) {
    return false
  }

  const [a, b] = nums
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isBlockedIPv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
  return (
    normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
  )
}

function validateTargetUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are allowed.')
  }
  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not allowed.')
  }

  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || isBlockedIPv4(hostname) || isBlockedIPv6(hostname)) {
    throw new Error('Localhost, loopback, and private-network URLs are not allowed.')
  }
}

function normalizeHeaders(inputHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {}
  if (!inputHeaders) return headers

  for (const [name, value] of Object.entries(inputHeaders)) {
    const normalizedName = name.trim().toLowerCase()
    if (!normalizedName || DISALLOWED_REQUEST_HEADERS.has(normalizedName)) {
      continue
    }
    headers[normalizedName] = value
  }
  return headers
}

function hasSensitiveHeader(headers: Record<string, string>) {
  return Object.keys(headers).some((name) => SENSITIVE_HEADERS.has(name.toLowerCase()))
}

async function normalizeInput(input: CurlRequestInput): Promise<NormalizedCurlRequest> {
  const settings = settingActions.getToolSettings().curl
  if (!settings.enabled) {
    throw new Error('curl_request is disabled in Tool Settings.')
  }

  const targetUrl = new URL(input.url)
  validateTargetUrl(targetUrl)

  const method = input.method ?? 'GET'
  if ((method === 'GET' || method === 'HEAD') && input.body) {
    throw new Error(`${method} requests cannot include a body.`)
  }

  const headers = normalizeHeaders(input.headers)
  const useOfficialProxy = input.useOfficialProxy ?? settings.useOfficialProxy ?? false
  if (useOfficialProxy && hasSensitiveHeader(headers)) {
    throw new Error('Sensitive headers cannot be sent through the official proxy.')
  }

  if (input.body && !headers['content-type']) {
    headers['content-type'] = 'text/plain;charset=UTF-8'
  }

  const requestUrl = useOfficialProxy ? CHATBOX_OFFICIAL_PROXY_URL : targetUrl.toString()
  if (useOfficialProxy) {
    headers['chatbox-target-uri'] = targetUrl.toString()
    headers['chatbox-platform'] = platform.type
    headers['chatbox-version'] = (await platform.getVersion().catch(() => 'unknown')) || 'unknown'
  }

  return {
    targetUrl,
    requestUrl,
    method,
    headers,
    body: input.body,
    timeoutMs: Math.min(Math.max(input.timeoutMs ?? settings.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000), MAX_TIMEOUT_MS),
    followRedirects: input.followRedirects ?? true,
    maxResponseChars: Math.min(
      Math.max(input.maxResponseChars ?? settings.maxResponseChars ?? DEFAULT_MAX_RESPONSE_CHARS, 500),
      MAX_RESPONSE_CHARS
    ),
    useOfficialProxy,
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'))
      return
    }

    const timeout = globalThis.setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms.`))
    }, timeoutMs)

    const onAbort = () => {
      globalThis.clearTimeout(timeout)
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        globalThis.clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        globalThis.clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function createAbortController(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  return {
    signal: controller.signal,
    cleanup() {
      globalThis.clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

function headersToObject(headers: Headers) {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

async function readResponseBody(response: Response, maxChars: number) {
  if (!response.body) {
    const text = await response.text()
    const body = text.slice(0, maxChars)
    return {
      body,
      bodyLength: body.length,
      truncated: text.length > maxChars,
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let body = ''
  let truncated = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    body += decoder.decode(value, { stream: true })
    if (body.length > maxChars) {
      body = body.slice(0, maxChars)
      truncated = true
      await reader.cancel().catch(() => undefined)
      break
    }
  }

  body += decoder.decode()
  const returnedBody = body.slice(0, maxChars)
  return {
    body: returnedBody,
    bodyLength: returnedBody.length,
    truncated: truncated || body.length > maxChars,
  }
}

async function fetchWithBrowser(request: NormalizedCurlRequest, signal?: AbortSignal): Promise<Response> {
  const controller = createAbortController(request.timeoutMs, signal)
  try {
    return await fetch(request.requestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: request.followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
    })
  } finally {
    controller.cleanup()
  }
}

async function fetchWithCapacitor(request: NormalizedCurlRequest, signal?: AbortSignal): Promise<Response> {
  const { CapacitorHttp } = await import('@capacitor/core')
  const response = await withTimeout(
    CapacitorHttp.request({
      url: request.requestUrl,
      method: request.method,
      headers: request.headers,
      data: request.body,
      responseType: 'text',
    }),
    request.timeoutMs,
    signal
  )

  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
  return new Response(body, {
    status: response.status,
    statusText: response.status ? String(response.status) : '',
    headers: response.headers,
  })
}

function performRequest(request: NormalizedCurlRequest, signal?: AbortSignal): Promise<Response> {
  if (platform.type === 'mobile') {
    return fetchWithCapacitor(request, signal)
  }
  return fetchWithBrowser(request, signal)
}

export async function executeCurlRequest(
  input: CurlRequestInput,
  context: { abortSignal?: AbortSignal } = {}
): Promise<CurlRequestResult> {
  const startedAt = Date.now()
  let request: NormalizedCurlRequest | null = null

  try {
    request = await normalizeInput(input)
    const response = await performRequest(request, context.abortSignal)
    const bodyResult =
      request.method === 'HEAD'
        ? { body: '', bodyLength: 0, truncated: false }
        : await readResponseBody(response, request.maxResponseChars)

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: request.targetUrl.toString(),
      finalUrl: response.url || request.targetUrl.toString(),
      redirected: response.redirected,
      headers: headersToObject(response.headers),
      ...bodyResult,
      elapsedMs: Date.now() - startedAt,
      proxied: request.useOfficialProxy,
    }
  } catch (error) {
    return {
      ok: false,
      url: request?.targetUrl.toString() ?? input.url,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
      proxied: request?.useOfficialProxy ?? input.useOfficialProxy ?? false,
    }
  }
}

export const curlRequestTool = tool({
  description:
    'Make an HTTP request to a public web URL without using the operating system command line. Use this to fetch URLs, inspect API responses, or make simple HTTP requests.',
  inputSchema: CurlRequestInputSchema,
  execute: executeCurlRequest,
})

export default {
  description: toolSetDescription,
  tools: {
    curl_request: curlRequestTool,
  },
}
