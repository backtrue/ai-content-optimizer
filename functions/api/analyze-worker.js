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
const SEO_METRIC_ORDER = [
  'Helpful Ratio',
  '搜尋意圖契合',
  '內容覆蓋與深度',
  '延伸疑問與關鍵字覆蓋',
  '行動可行性',
  '可讀性與敘事節奏',
  '結構化重點提示',
  '作者與品牌辨識',
  '可信證據與引用',
  '第一手經驗與案例',
  '敘事具體度與資訊密度',
  '時效與更新訊號',
  '專家觀點與判斷'
]

const AEO_METRIC_ORDER = [
  '答案可抽取性',
  '關鍵摘要與重點整理',
  '對話式語氣與指引',
  '讀者互動與後續引導'
]

const SEO_METRIC_DESCRIPTIONS = {
  'Helpful Ratio': '綜合 HCU yes/partial/no 比例評估 helpful 程度。',
  '搜尋意圖契合': '檢查標題、首段與問答格式是否兌現搜尋意圖。',
  '內容覆蓋與深度': '衡量段落是否完整回答所有核心面向。',
  '延伸疑問與關鍵字覆蓋': '評估是否涵蓋延伸疑問與相關長尾關鍵詞。',
  '行動可行性': '檢視是否提供可操作步驟、清單或指引。',
  '可讀性與敘事節奏': '判斷句長與段落節奏是否易於掃讀。',
  '結構化重點提示': '確認是否使用列表、表格等強調重點。',
  '作者與品牌辨識': '檢查作者、品牌與來源資訊是否清晰。',
  '可信證據與引用': '評估是否引用可信來源或統計數據。',
  '第一手經驗與案例': '檢查是否分享案例、實務經驗或證言。',
  '敘事具體度與資訊密度': '衡量內容是否具體並包含足夠實體細節。',
  '時效與更新訊號': '確認是否提及最近年份或更新資訊。',
  '專家觀點與判斷': '評估是否提供比較、評析與專家觀點。'
}

const AEO_METRIC_DESCRIPTIONS = {
  '答案可抽取性': '確認段落結論是否易於直接引用。',
  '關鍵摘要與重點整理': '檢查首段或結尾是否整理核心重點。',
  '對話式語氣與指引': '衡量語句是否自然並回應讀者提問。',
  '讀者互動與後續引導': '評估是否提供 CTA、FAQ 或下一步指引。'
}

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

    const aeoSup = isScoringModelReady() ? predictAeoMetricScores(modelContext) : null
    const seoSup = isScoringModelReady() ? predictSeoMetricScores(modelContext) : null

    // Build metrics first
    const aeoMetrics = buildMetricsFromPredictions(aeoSup, 'aeo')
    const seoMetrics = buildMetricsFromPredictions(seoSup, 'seo')

    const aeoScore = computeWeightedScore(aeoMetrics)
    const seoScore = computeWeightedScore(seoMetrics)
    const overallScore = computeOverallScore({ aeoScore, seoScore })

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
      aeoScore,
      seoScore,
      overallScore
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
  const entries = Array.isArray(predictions?.predictions) ? [...predictions.predictions] : []
  if (!entries.length) return []

  const order = scope === 'aeo' ? AEO_METRIC_ORDER : SEO_METRIC_ORDER
  const descriptions = scope === 'aeo' ? AEO_METRIC_DESCRIPTIONS : SEO_METRIC_DESCRIPTIONS

  entries.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))

  return entries.map((pred) => {
    const rawScore = Number(pred?.score)
    const score = Number.isFinite(rawScore) ? Math.round(rawScore * 10) / 10 : null
    return {
      name: pred?.name ?? '未知指標',
      score: score ?? 0,
      weight: pred?.weight,
      description: descriptions[pred?.name] || '',
      evidence: [],
      features: pred?.features || [],
      modelVersion: predictions?.version,
      modelRawScore: rawScore,
      modelContributions: pred?.contributions || null
    }
  })
}

/**
 * Compute weighted score
 */
function computeWeightedScore(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null
  let weightedSum = 0
  let totalWeight = 0

  metrics.forEach((m) => {
    const score = Number(m?.score)
    const weight = Number(m?.weight)
    if (!Number.isFinite(score)) return
    const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 1
    weightedSum += score * safeWeight
    totalWeight += safeWeight
  })

  if (totalWeight <= 0) return null
  const average = weightedSum / totalWeight
  return Math.round(average * 10)
}

function computeOverallScore({ aeoScore, seoScore }) {
  const hasAeo = Number.isFinite(aeoScore)
  const hasSeo = Number.isFinite(seoScore)
  if (!hasAeo && !hasSeo) return null

  const weightAeo = hasAeo ? 0.45 : 0
  const weightSeo = hasSeo ? 0.55 : 0
  const weightSum = weightAeo + weightSeo
  const base = weightSum > 0
    ? ((hasAeo ? aeoScore * weightAeo : 0) + (hasSeo ? seoScore * weightSeo : 0)) / weightSum
    : 0
  const clamped = Math.max(0, Math.min(100, base))
  return Math.round(clamped)
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
