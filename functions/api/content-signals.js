export function coerceString(value) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value)
    } catch (error) {
      console.error('coerceString stringify failed', error)
      return ''
    }
  }
  return ''
}

globalThis.__contentSignalsShared = globalThis.__contentSignalsShared || {}
const cache = globalThis.__contentSignalsShared

export const normalizeWhitespace = (text) => {
  if (typeof text !== 'string') return ''
  if (cache[`norm:${text}`]) return cache[`norm:${text}`]
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \f\v]{2,}/g, ' ')
    .trim()
  cache[`norm:${text}`] = normalized
  return normalized
}

export function stripHtmlTags(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ')
}

export function decodeBasicEntities(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

export function htmlToStructuredText(html) {
  if (typeof html !== 'string' || !html.trim()) return ''
  let output = html.replace(/\r\n/g, '\n')
  output = output.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1>/gi, '')

  output = output.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const prefix = '#'.repeat(Number(level) || 1)
    const headingText = stripHtmlTags(inner).trim()
    return `\n${prefix} ${headingText}\n`
  })

  const blockTags = [
    'p',
    'div',
    'section',
    'article',
    'header',
    'footer',
    'aside',
    'nav',
    'li',
    'ul',
    'ol',
    'blockquote',
    'pre',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'figure',
    'figcaption'
  ]
  for (const tag of blockTags) {
    const regex = new RegExp(`<\\s*${tag}[^>]*>`, 'gi')
    output = output.replace(regex, '\n')
    const closeRegex = new RegExp(`<\\/\\s*${tag}\\s*>`, 'gi')
    output = output.replace(closeRegex, '\n')
  }

  output = output.replace(/<br\s*\/?\s*>/gi, '\n')
  output = stripHtmlTags(output)
  output = decodeBasicEntities(output)
  return normalizeWhitespace(output)
}

export function markdownToStructuredText(markdown) {
  if (typeof markdown !== 'string') return ''
  return normalizeWhitespace(markdown.replace(/\r\n/g, '\n'))
}

export function markdownToPlain(markdown) {
  const structured = markdownToStructuredText(markdown)
  return normalizeWhitespace(stripMarkdown(structured))
}

export function stripMarkdown(markdown) {
  if (!markdown) return ''
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}(#{1,6})\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/>\s?/g, '')
    .replace(/\|\s?\|/g, ' ')
}

export function harmonizeParagraphBreaks(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
    .replace(/([。！？!?])(?!\s*\n)/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
    if (Array.isArray(value) && value.length) return value.join('\n')
  }
  return ''
}

export function extractSentences(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const matches = normalized.match(/[^。！？!?\.]+[。！？!?\.]?/g)
  return matches ? matches.map((sentence) => sentence.trim()).filter(Boolean) : [normalized]
}

export function extractWords(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  const matches = text.match(/[A-Za-z\u4e00-\u9fff0-9]+/g)
  return matches ? matches : []
}

export function extractKeywordSet(text) {
  const keywords = new Set()
  if (typeof text !== 'string') return keywords
  const words = extractWords(text)
  words.forEach((word) => {
    const normalized = word.toLowerCase()
    if (normalized.length >= 2 && !/^[0-9]+$/.test(normalized)) {
      keywords.add(normalized)
    }
  })
  return keywords
}

export function normalizeContentVariants(source = {}) {
  const plain = firstNonEmpty(
    source.contentPlain,
    source.plain,
    typeof source.content === 'string' ? source.content : '',
    source.text
  )
  const html = firstNonEmpty(source.contentHtml, source.html, source.rawHtml)
  const markdown = firstNonEmpty(source.contentMarkdown, source.markdown, source.rawMarkdown)
  const hintSource = coerceString(source.contentFormatHint || source.hint || '')
  const hint = hintSource.trim().toLowerCase()

  const variants = {
    hint,
    plain: coerceString(plain).trim(),
    html: coerceString(html).trim(),
    markdown: coerceString(markdown).trim()
  }

  const normalized = {
    hint: variants.hint || (variants.html ? 'html' : variants.markdown ? 'markdown' : 'plain'),
    plain: '',
    html: variants.html,
    markdown: variants.markdown
  }

  if (variants.plain) {
    normalized.plain = normalizeWhitespace(variants.plain)
    return normalized
  }

  if (variants.markdown) {
    normalized.plain = normalizeWhitespace(markdownToStructuredText(variants.markdown))
    return normalized
  }

  if (variants.html) {
    normalized.plain = normalizeWhitespace(htmlToStructuredText(variants.html))
    return normalized
  }

  normalized.plain = ''
  return normalized
}
