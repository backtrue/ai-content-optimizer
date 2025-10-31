/**
 * Cloudflare Worker endpoint for content analysis
 * Deployed separately from Pages Functions to avoid timeout limits
 * Route: /api/analyze-worker (or configure in wrangler.toml)
 */

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import {
  isScoringModelReady,
  predictAeoMetricScores,
  predictSeoMetricScores
} from './scoring-model'

// Import main analysis logic from [[path]].js
// Note: This is a simplified version - in production, refactor shared logic into modules

const FETCH_MAX_BYTES = 1.5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 25_000
const FETCH_MAX_REDIRECTS = 3
const FETCH_USER_AGENT = 'AEO-GEO Analyzer/1.0 (+https://ragseo.thinkwithblack.com)'
const FETCH_MAX_RETRIES = 3
const RETRY_DELAYS_MS = [0, 1_000, 3_000]
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504])

class AnalyzeError extends Error {
  constructor(message, { status = 422, code = 'ANALYZE_ERROR', details } = {}) {
    super(message)
    this.name = 'AnalyzeError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}


/**
 * Main Worker handler
 */
export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Only POST allowed
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    try {
      const body = await request.json()
      const result = await handleAnalyzeRequest(body, env, ctx)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error) {
      const normalized = normalizeError(error)
      if (normalized.status >= 500) {
        console.error('Worker error:', normalized)
      } else {
        console.warn('Worker handled error:', normalized)
      }
      return new Response(
        JSON.stringify({
          error: normalized.message,
          code: normalized.code,
          details: normalized.details
        }),
        {
          status: normalized.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  }
}

/**
 * Handle analyze request
 */
async function handleAnalyzeRequest(requestBody, env, ctx) {
  try {
    const { contentUrl, targetKeywords = [], returnChunks = false } = requestBody

    if (!contentUrl || !Array.isArray(targetKeywords) || targetKeywords.length === 0) {
      throw new AnalyzeError('Missing contentUrl or targetKeywords', {
        status: 422,
        code: 'INVALID_PAYLOAD'
      })
    }

    // Fetch and extract content
    const { html, plain } = await fetchAndExtractContent(contentUrl)
    if (!html && !plain) {
      throw new AnalyzeError('Failed to extract content from URL', {
        status: 422,
        code: 'CONTENT_EXTRACTION_FAILED'
      })
    }

    // Build analysis context
    const contentSignals = computeContentSignals(html || plain, targetKeywords)
    const hcuReview = [] // Simplified - in production, call Gemini API
    const hcuCounts = { yes: 0, partial: 0, no: 0 }

    // Build metrics using ML model
    const modelContext = {
      contentSignals,
      contentQualityFlags: buildContentQualityFlags(contentSignals),
      missingCritical: buildMissingCritical(contentSignals),
      hcuCounts
    }

    const aeoPredictions = isScoringModelReady() ? predictAeoMetricScores(modelContext) : null
    const seoPredictions = isScoringModelReady() ? predictSeoMetricScores(modelContext) : null

    // Build metrics first
    const aeoMetrics = buildMetricsFromPredictions(aeoPredictions, 'aeo')
    const seoMetrics = buildMetricsFromPredictions(seoPredictions, 'seo')

    // Build response
    const response = {
      sourceUrl: contentUrl,
      targetKeywords,
      contentSignals,
      metrics: {
        aeo: aeoMetrics,
        seo: seoMetrics
      },
      scoreGuards: {
        contentQualityFlags: modelContext.contentQualityFlags,
        missingCritical: modelContext.missingCritical,
        hcuCounts
      },
      hcuReview,
      aeoScore: computeAverageScore(aeoMetrics),
      seoScore: computeWeightedScore(seoMetrics)
    }

    if (returnChunks) {
      response.chunks = []
    }

    return response
  } catch (error) {
    throw normalizeError(error)
  }
}

/**
 * Fetch and extract content from URL
 */
async function fetchAndExtractContent(url) {
  let lastError
  for (let attempt = 1; attempt <= FETCH_MAX_RETRIES; attempt += 1) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort('timeout'), FETCH_TIMEOUT_MS)

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': FETCH_USER_AGENT },
        redirect: 'follow',
        cf: { cacheTtl: 900, cacheEverything: true },
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const status = response.status
        const message = `Upstream responded with HTTP ${status}`
        if (RETRYABLE_STATUS_CODES.has(status) && attempt < FETCH_MAX_RETRIES) {
          await delay(RETRY_DELAYS_MS[attempt] || 0)
          continue
        }
        throw new AnalyzeError(message, {
          status: status >= 500 ? 503 : status,
          code: 'UPSTREAM_HTTP_ERROR',
          details: { status }
        })
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        throw new AnalyzeError('Fetched document is not HTML', {
          status: 422,
          code: 'NON_HTML_CONTENT',
          details: { contentType }
        })
      }

      const html = await response.text()
      const { document } = parseHTML(html)

      // Use Readability to extract main content
      const reader = new Readability(document)
      const article = reader.parse()

      if (!article || !article.content) {
        throw new AnalyzeError('Readability extraction failed', {
          status: 422,
          code: 'READABILITY_FAILURE'
        })
      }

      return {
        html: article.content,
        plain: extractPlainText(article.content)
      }
    } catch (error) {
      lastError = normalizeError(error)
      const isTimeout = error?.name === 'AbortError' || error === 'timeout'
      const retryable =
        isTimeout ||
        (error instanceof AnalyzeError && error.status >= 500 && attempt < FETCH_MAX_RETRIES)

      if (retryable && attempt < FETCH_MAX_RETRIES) {
        await delay(RETRY_DELAYS_MS[attempt] || 0)
        continue
      }

      throw normalizeError(
        isTimeout
          ? new AnalyzeError('Fetching content timed out', {
              status: 503,
              code: 'FETCH_TIMEOUT'
            })
          : error
      )
    }
  }

  throw lastError || new AnalyzeError('Failed to fetch content', {
    status: 503,
    code: 'FETCH_FAILED_UNKNOWN'
  })
}

/**
 * Extract plain text from HTML
 */
function extractPlainText(html) {
  if (!html) return ''
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text
}

/**
 * Compute content signals (simplified version)
 */
function computeContentSignals(content, keywords) {
  const wordCount = content.split(/\s+/).length
  const paragraphCount = (content.match(/<p[^>]*>/gi) || []).length || 1
  const h2Count = (content.match(/<h2[^>]*>/gi) || []).length
  const h1Count = (content.match(/<h1[^>]*>/gi) || []).length

  return {
    wordCount,
    paragraphCount,
    h2Count,
    h1Count,
    hasMetaDescription: false,
    hasCanonical: false,
    hasArticleSchema: false,
    hasAuthorInfo: false,
    hasPublisherInfo: false,
    hasPublishedDate: false,
    hasModifiedDate: false,
    hasVisibleDate: false,
    externalLinkCount: 0,
    externalAuthorityLinkCount: 0,
    listCount: (content.match(/<ul[^>]*>|<ol[^>]*>/gi) || []).length,
    tableCount: (content.match(/<table[^>]*>/gi) || []).length,
    imageCount: (content.match(/<img[^>]*>/gi) || []).length,
    imageWithAltCount: (content.match(/<img[^>]*alt="[^"]*"[^>]*>/gi) || []).length,
    actionableScore: 0,
    evidenceCount: 0,
    experienceCueCount: 0,
    recentYearCount: 0,
    referenceKeywordCount: keywords.length,
    titleIntentMatch: 0.5,
    uniqueWordRatio: 0.6,
    paragraphAverageLength: wordCount / Math.max(1, paragraphCount),
    longParagraphCount: 0,
    sentenceCount: (content.match(/[.!?]+/g) || []).length,
    avgSentenceLength: 0,
    h1ContainsKeyword: false,
    hasUniqueTitle: false,
    hasFirstPersonNarrative: false
  }
}

/**
 * Build content quality flags
 */
function buildContentQualityFlags(signals) {
  return {
    depthLow: signals.wordCount < 450,
    depthVeryLow: signals.wordCount < 260,
    readabilityWeak: false,
    actionableWeak: signals.actionableScore < 1,
    actionableZero: signals.actionableScore === 0,
    evidenceWeak: signals.evidenceCount < 2,
    evidenceNone: signals.evidenceCount === 0,
    freshnessWeak: false,
    experienceWeak: signals.experienceCueCount === 0,
    titleMismatch: false,
    uniqueWordLow: signals.uniqueWordRatio < 0.5
  }
}

/**
 * Build missing critical signals
 */
function buildMissingCritical(signals) {
  return {
    author: !signals.hasAuthorInfo,
    publisher: !signals.hasPublisherInfo,
    publishedDate: !signals.hasPublishedDate,
    modifiedDate: !signals.hasModifiedDate,
    visibleDate: !signals.hasVisibleDate,
    metaDescription: !signals.hasMetaDescription,
    canonical: !signals.hasCanonical,
    h1Count: signals.h1Count === 0,
    h1Keyword: !signals.h1ContainsKeyword,
    h2Coverage: signals.h2Count === 0,
    externalLinksMissing: signals.externalLinkCount === 0,
    authorityLinksMissing: signals.externalAuthorityLinkCount === 0,
    paragraphsLong: signals.paragraphAverageLength > 420,
    listMissing: signals.listCount === 0,
    tableMissing: signals.tableCount === 0
  }
}

/**
 * Build metrics from predictions
 */
function buildMetricsFromPredictions(predictions, scope) {
  if (!predictions) return []

  const metricNames = scope === 'aeo'
    ? ['段落獨立性', '語言清晰度', '實體辨識', '邏輯流暢度', '可信度信號']
    : ['E-E-A-T 信任線索', '內容品質與原創性', '人本與主題一致性', '標題與承諾落實', '搜尋意圖契合度', '新鮮度與時效性', '使用者安全與風險', '結構與可讀性']

  return metricNames.map((name) => {
    const pred = predictions.get(name)
    return {
      name,
      score: pred?.score || 0,
      description: '',
      evidence: [],
      modelVersion: pred?.modelVersion,
      modelRawScore: pred?.rawScore,
      modelContributions: pred?.contributions
    }
  })
}

/**
 * Compute average score
 */
function computeAverageScore(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null
  let total = 0
  let count = 0
  metrics.forEach((m) => {
    if (Number.isFinite(m.score)) {
      total += m.score
      count += 1
    }
  })
  return count > 0 ? Math.round((total / count) * 10) : null
}

/**
 * Compute weighted score
 */
function computeWeightedScore(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null
  let weightedSum = 0
  let totalWeight = 0

  const weights = {
    'E-E-A-T 信任線索': 18,
    '內容品質與原創性': 18,
    '人本與主題一致性': 12,
    '標題與承諾落實': 10,
    '搜尋意圖契合度': 12,
    '新鮮度與時效性': 8,
    '使用者安全與風險': 12,
    '結構與可讀性': 10
  }

  metrics.forEach((m) => {
    const weight = weights[m.name] || 1
    if (Number.isFinite(m.score)) {
      weightedSum += m.score * weight
      totalWeight += weight
    }
  })

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) : null
}

function normalizeError(error) {
  if (error instanceof AnalyzeError) {
    return error
  }

  if (error instanceof Error) {
    return new AnalyzeError(error.message || 'Internal server error', {
      status: 500,
      code: 'UNHANDLED_ERROR'
    })
  }

  return new AnalyzeError('Internal server error', {
    status: 500,
    code: 'UNKNOWN_ERROR'
  })
}
