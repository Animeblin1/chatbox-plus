import { tool, type ToolSet } from 'ai'
import z from 'zod'
import * as settingActions from '@/stores/settingActions'

const MAX_TEXT_CHARS = 500_000

const toolSetDescription = `
Use these local utility tools for exact deterministic operations.

## json_query
Parse JSON and extract a value by a simple path such as \`items[0].title\`.

## text_transform
Apply exact text transformations such as Base64, URL encoding, or SHA-256 hashing.

## datetime_now
Return the current date and time in ISO, Unix, and localized forms.

## html_extract
Extract metadata, readable text, and links from HTML.

## url_tool
Parse URLs, resolve relative links, and update query parameters.

## csv_preview
Parse CSV or TSV text into a compact structured preview.
`

function ensureToolEnabled(enabled: boolean | undefined, toolName: string) {
  if (!enabled) {
    throw new Error(`${toolName} is disabled in Tool Settings.`)
  }
}

function getValueType(value: unknown) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function parseJsonPath(path: string) {
  const tokens: Array<string | number> = []
  const segments = path.split('.').filter(Boolean)

  for (const segment of segments) {
    const nameMatch = segment.match(/^[^[]+/)
    if (nameMatch) {
      tokens.push(nameMatch[0])
    }

    const bracketRegex = /\[([^\]]+)\]/g
    for (const match of segment.matchAll(bracketRegex)) {
      const raw = match[1].trim()
      if (/^\d+$/.test(raw)) {
        tokens.push(Number(raw))
      } else {
        tokens.push(raw.replace(/^['"]|['"]$/g, ''))
      }
    }
  }

  return tokens
}

function queryJsonValue(root: unknown, path?: string) {
  if (!path?.trim()) {
    return { found: true, value: root }
  }

  let current = root
  for (const token of parseJsonPath(path.trim())) {
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token >= current.length) {
        return { found: false, value: undefined }
      }
      current = current[token]
      continue
    }

    if (!current || typeof current !== 'object' || !(token in current)) {
      return { found: false, value: undefined }
    }
    current = (current as Record<string, unknown>)[token]
  }

  return { found: true, value: current }
}

export const jsonQueryTool = tool({
  description: 'Parse JSON and optionally extract a value by a simple dot/bracket path.',
  inputSchema: z.object({
    json: z.string().max(MAX_TEXT_CHARS).describe('JSON text to parse.'),
    path: z
      .string()
      .max(1000)
      .optional()
      .describe('Optional path such as "items[0].title". If omitted, returns the parsed root value.'),
  }),
  execute: (input: { json: string; path?: string }) => {
    ensureToolEnabled(settingActions.getToolSettings().jsonQuery.enabled, 'json_query')
    try {
      const parsed = JSON.parse(input.json) as unknown
      const result = queryJsonValue(parsed, input.path)
      return {
        ok: result.found,
        path: input.path || '',
        type: result.found ? getValueType(result.value) : 'undefined',
        value: result.found ? result.value : undefined,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

function textToBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToText(text: string) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const TextTransformActionSchema = z.enum([
  'base64_encode',
  'base64_decode',
  'url_encode',
  'url_decode',
  'sha256',
  'lowercase',
  'uppercase',
])

export const textTransformTool = tool({
  description: 'Apply exact local text transformations such as Base64, URL encoding, SHA-256, or case conversion.',
  inputSchema: z.object({
    action: TextTransformActionSchema.describe('The transformation to apply.'),
    text: z.string().max(MAX_TEXT_CHARS).describe('Input text.'),
  }),
  execute: async (input: { action: z.infer<typeof TextTransformActionSchema>; text: string }) => {
    ensureToolEnabled(settingActions.getToolSettings().textTransform.enabled, 'text_transform')
    try {
      let result = ''
      switch (input.action) {
        case 'base64_encode':
          result = textToBase64(input.text)
          break
        case 'base64_decode':
          result = base64ToText(input.text)
          break
        case 'url_encode':
          result = encodeURIComponent(input.text)
          break
        case 'url_decode':
          result = decodeURIComponent(input.text)
          break
        case 'sha256': {
          const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.text))
          result = bytesToHex(digest)
          break
        }
        case 'lowercase':
          result = input.text.toLowerCase()
          break
        case 'uppercase':
          result = input.text.toUpperCase()
          break
      }
      return { ok: true, action: input.action, result }
    } catch (error) {
      return {
        ok: false,
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

export const datetimeNowTool = tool({
  description: 'Return the current date and time. Use when exact current time is needed.',
  inputSchema: z.object({
    timeZone: z
      .string()
      .max(100)
      .optional()
      .describe('Optional IANA time zone, e.g. "Asia/Shanghai" or "America/New_York".'),
  }),
  execute: (input: { timeZone?: string }) => {
    ensureToolEnabled(settingActions.getToolSettings().datetime.enabled, 'datetime_now')
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: input.timeZone,
    }

    try {
      return {
        ok: true,
        iso: now.toISOString(),
        unixMs: now.getTime(),
        unixSeconds: Math.floor(now.getTime() / 1000),
        timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        local: new Intl.DateTimeFormat(undefined, options).format(now),
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

const HtmlExtractModeSchema = z.enum(['metadata', 'text', 'links', 'all'])

function decodeHtmlEntities(text: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }

  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_match, entity: string) => {
    if (entity.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    }
    return namedEntities[entity] ?? `&${entity};`
  })
}

function getHtmlTagContent(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'))
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '').trim()) : ''
}

function getHtmlAttribute(tag: string, attrName: string) {
  const match = tag.match(new RegExp(`${attrName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

function extractHtmlMetadata(html: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? []
  const metadata: Record<string, string> = {}

  for (const tag of metaTags) {
    const name = getHtmlAttribute(tag, 'name') || getHtmlAttribute(tag, 'property')
    const content = getHtmlAttribute(tag, 'content')
    if (name && content) {
      metadata[name] = decodeHtmlEntities(content)
    }
  }

  return {
    title: getHtmlTagContent(html, 'title'),
    description: metadata.description || metadata['og:description'] || '',
    metadata,
  }
}

function extractHtmlText(html: string, maxChars: number) {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  const text = decodeHtmlEntities(
    withoutScripts
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
  return {
    text: text.slice(0, maxChars),
    textLength: Math.min(text.length, maxChars),
    truncated: text.length > maxChars,
  }
}

function extractHtmlLinks(html: string, baseUrl: string | undefined, maxLinks: number) {
  const links: Array<{ href: string; text: string }> = []
  const anchorRegex = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(anchorRegex)) {
    const rawHref = match[2] ?? match[3] ?? match[4] ?? ''
    if (!rawHref || rawHref.startsWith('#') || rawHref.toLowerCase().startsWith('javascript:')) {
      continue
    }

    let href = decodeHtmlEntities(rawHref)
    try {
      href = baseUrl ? new URL(href, baseUrl).toString() : href
    } catch {}

    links.push({
      href,
      text: decodeHtmlEntities(
        (match[5] || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      ),
    })

    if (links.length >= maxLinks) {
      break
    }
  }

  return links
}

export const htmlExtractTool = tool({
  description: 'Extract metadata, readable text, and links from an HTML document.',
  inputSchema: z.object({
    html: z.string().max(MAX_TEXT_CHARS).describe('HTML text to parse.'),
    baseUrl: z.string().max(5000).optional().describe('Optional base URL for resolving relative links.'),
    mode: HtmlExtractModeSchema.default('all').optional().describe('Which parts to extract. Defaults to all.'),
    maxTextChars: z.number().int().min(500).max(100000).default(20000).optional(),
    maxLinks: z.number().int().min(1).max(500).default(100).optional(),
  }),
  execute: (input: {
    html: string
    baseUrl?: string
    mode?: z.infer<typeof HtmlExtractModeSchema>
    maxTextChars?: number
    maxLinks?: number
  }) => {
    ensureToolEnabled(settingActions.getToolSettings().htmlExtract.enabled, 'html_extract')
    const mode = input.mode ?? 'all'
    const result: Record<string, unknown> = { ok: true, mode }

    if (mode === 'metadata' || mode === 'all') {
      result.metadata = extractHtmlMetadata(input.html)
    }
    if (mode === 'text' || mode === 'all') {
      result.text = extractHtmlText(input.html, input.maxTextChars ?? 20000)
    }
    if (mode === 'links' || mode === 'all') {
      result.links = extractHtmlLinks(input.html, input.baseUrl, input.maxLinks ?? 100)
    }

    return result
  },
})

const UrlToolActionSchema = z.enum(['parse', 'resolve', 'set_query'])

export const urlTool = tool({
  description: 'Parse URLs, resolve relative links against a base URL, or set query parameters.',
  inputSchema: z.object({
    action: UrlToolActionSchema.describe('parse, resolve, or set_query.'),
    url: z.string().max(5000).describe('URL or relative URL. Relative URLs require baseUrl.'),
    baseUrl: z.string().max(5000).optional().describe('Optional base URL for relative URL resolution.'),
    queryParams: z.record(z.string(), z.string()).optional().describe('Query parameters to set for set_query.'),
  }),
  execute: (input: {
    action: z.infer<typeof UrlToolActionSchema>
    url: string
    baseUrl?: string
    queryParams?: Record<string, string>
  }) => {
    ensureToolEnabled(settingActions.getToolSettings().urlTool.enabled, 'url_tool')
    try {
      const url = new URL(input.url, input.baseUrl)

      if (input.action === 'set_query') {
        for (const [key, value] of Object.entries(input.queryParams ?? {})) {
          url.searchParams.set(key, value)
        }
      }

      return {
        ok: true,
        href: url.toString(),
        origin: url.origin,
        protocol: url.protocol,
        username: url.username,
        passwordPresent: Boolean(url.password),
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        query: Object.fromEntries(url.searchParams.entries()),
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/, 5).join('\n')
  const commaCount = (sample.match(/,/g) ?? []).length
  const tabCount = (sample.match(/\t/g) ?? []).length
  const semicolonCount = (sample.match(/;/g) ?? []).length
  if (tabCount > commaCount && tabCount >= semicolonCount) return '\t'
  if (semicolonCount > commaCount) return ';'
  return ','
}

function parseDelimitedRows(text: string, delimiter: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"'
        i++
      } else {
        quoted = !quoted
      }
      continue
    }

    if (!quoted && char === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }

    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i++
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

export const csvPreviewTool = tool({
  description: 'Parse CSV or TSV text and return headers plus a compact row preview.',
  inputSchema: z.object({
    text: z.string().max(MAX_TEXT_CHARS).describe('CSV, TSV, or delimiter-separated text.'),
    delimiter: z
      .enum(['auto', ',', ';', 'tab'])
      .default('auto')
      .optional()
      .describe('Delimiter. Defaults to auto detection.'),
    hasHeader: z.boolean().default(true).optional().describe('Whether the first row contains headers.'),
    maxRows: z.number().int().min(1).max(200).default(20).optional().describe('Maximum rows to return.'),
  }),
  execute: (input: { text: string; delimiter?: 'auto' | ',' | ';' | 'tab'; hasHeader?: boolean; maxRows?: number }) => {
    ensureToolEnabled(settingActions.getToolSettings().csvPreview.enabled, 'csv_preview')
    const delimiter =
      input.delimiter === 'tab'
        ? '\t'
        : input.delimiter === 'auto' || !input.delimiter
          ? detectDelimiter(input.text)
          : input.delimiter
    const rows = parseDelimitedRows(input.text, delimiter)
    const hasHeader = input.hasHeader ?? true
    const maxRows = input.maxRows ?? 20
    const headers = hasHeader
      ? rows[0] || []
      : Array.from({ length: Math.max(...rows.map((row) => row.length), 0) }, (_value, index) => `column_${index + 1}`)
    const dataRows = hasHeader ? rows.slice(1) : rows
    const previewRows = dataRows
      .slice(0, maxRows)
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))

    return {
      ok: true,
      delimiter: delimiter === '\t' ? 'tab' : delimiter,
      headers,
      rows: previewRows,
      rowCount: dataRows.length,
      columnCount: headers.length,
      truncated: dataRows.length > previewRows.length,
    }
  },
})

export function getUtilityToolSet(): { description: string; tools: ToolSet } {
  const settings = settingActions.getToolSettings()
  const tools: ToolSet = {}

  if (settings.jsonQuery.enabled) {
    tools.json_query = jsonQueryTool
  }
  if (settings.textTransform.enabled) {
    tools.text_transform = textTransformTool
  }
  if (settings.datetime.enabled) {
    tools.datetime_now = datetimeNowTool
  }
  if (settings.htmlExtract.enabled) {
    tools.html_extract = htmlExtractTool
  }
  if (settings.urlTool.enabled) {
    tools.url_tool = urlTool
  }
  if (settings.csvPreview.enabled) {
    tools.csv_preview = csvPreviewTool
  }

  return {
    description: Object.keys(tools).length ? toolSetDescription : '',
    tools,
  }
}

export default {
  description: toolSetDescription,
  tools: {
    json_query: jsonQueryTool,
    text_transform: textTransformTool,
    datetime_now: datetimeNowTool,
    html_extract: htmlExtractTool,
    url_tool: urlTool,
    csv_preview: csvPreviewTool,
  },
}
