import { Readability } from '@mozilla/readability'
import { AnalysisQueue } from './queue-durable-object'

console.log('[[path]].js module 初始化')
import { parseHTML } from 'linkedom'
import {
  isScoringModelReady,
  predictAeoMetricScores,
  predictSeoMetricScores
} from './scoring-model'
import {
  coerceString,
  decodeBasicEntities,
  extractKeywordSet,
  extractSentences,
  extractWords,
  firstNonEmpty,
  harmonizeParagraphBreaks,
  htmlToStructuredText,
  markdownToPlain,
  markdownToStructuredText,
  normalizeContentVariants,
  normalizeWhitespace,
  stripHtmlTags,
  stripMarkdown
} from './content-signals'
import { calculateStructureScore } from './structure-score'

// Cloudflare Workers API endpoint for content analysis

const FETCH_MAX_BYTES = 1.5 * 1024 * 1024 // 1.5 MB
const FETCH_TIMEOUT_MS = 10_000
const FETCH_MAX_REDIRECTS = 3
const FETCH_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const EXCLUDED_SEMANTIC_TAGS = new Set([
  'head',
  'nav',
  'menu',
  'aside',
  'header',
  'footer',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'canvas',
  'svg',
  'video',
  'audio',
  'object',
  'embed',
  'picture',
  'figure',
  'figcaption',
  'noscript',
  'ins'
])

const EXCLUDED_CLASS_PATTERNS = [
  'header',
  'footer',
  'navbar',
  'nav-',
  'menu',
  'aside',
  'sidebar',
  'breadcrumb',
  'comment',
  'share',
  'pagination',
  'pager',
  'advert',
  'ad-',
  'adsense',
  'sponsored',
  'newsletter',
  'subscription',
  'cookie',
  'consent',
  'popup',
  'modal'
]

const EXCLUDED_ROLE_PATTERNS = new Set([
  'banner',
  'navigation',
  'complementary',
  'contentinfo',
  'search',
  'dialog'
])

const RATE_LIMIT_CONFIG = {
  session: { limit: 20, windowSeconds: 24 * 60 * 60 },
  ip: { limit: 40, windowSeconds: 60 * 60 }
};

export const onRequest = async (context) => {
  console.log('onRequest 入口被呼叫')
  return onRequestPost(context)
}

export default {
  async fetch(request, env, ctx) {
    console.log('default.fetch 收到請求', {
      url: request.url,
      method: request.method
    })

    // 建立與 onRequestPost 相容的 context
    const context = {
      request,
      env,
      ctx,
      data: {},
      waitUntil: (promise) => ctx?.waitUntil?.(promise)
    }

    try {
      const response = await onRequestPost(context)
      console.log('default.fetch 正常結束', {
        status: response?.status
      })
      return response
    } catch (error) {
      console.error('default.fetch 發生未捕捉錯誤', {
        message: error?.message,
        stack: error?.stack
      })
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://ragseo.thinkwithblack.com'
          }
        }
      )
    }
  }
}

function buildFallbackHcuAnswers(contentSignals = {}, contentFlags = {}, missingCritical = {}) {
  const fallback = new Map()
  const set = (id, answer, explanation) => {
    fallback.set(id, {
      id,
      answer,
      explanation: constrainLength(explanation, 120)
    })
  }

  const wordCount = Number(contentSignals.wordCount || 0)
  const paragraphCount = Number(contentSignals.paragraphCount || 0)
  const actionableStepCount = Number(contentSignals.actionableStepCount || 0)
  const actionableScore = Number(contentSignals.actionableScore || 0)
  const evidenceCount = Number(contentSignals.evidenceCount || 0)
  const externalAuthorityLinkCount = Number(contentSignals.externalAuthorityLinkCount || 0)
  const recentYearCount = Number(contentSignals.recentYearCount || 0)
  const uniqueWordRatio = Number(contentSignals.uniqueWordRatio || 0)
  const experienceCueCount = Number(contentSignals.experienceCueCount || 0)
  const caseStudyCount = Number(contentSignals.caseStudyCount || 0)
  const titleIntentMatch = Number(contentSignals.titleIntentMatch || 0)
  const hasAuthorInfo = Boolean(contentSignals.hasAuthorInfo)
  const hasPublisherInfo = Boolean(contentSignals.hasPublisherInfo)
  const hasFirstPersonNarrative = Boolean(contentSignals.hasFirstPersonNarrative)
  const hasPublishedDate = Boolean(contentSignals.hasPublishedDate)
  const hasModifiedDate = Boolean(contentSignals.hasModifiedDate)

  const depthLow = Boolean(contentFlags.depthLow)
  const depthVeryLow = Boolean(contentFlags.depthVeryLow)
  const readabilityWeak = Boolean(contentFlags.readabilityWeak)
  const evidenceWeak = Boolean(contentFlags.evidenceWeak)
  const actionableWeak = Boolean(contentFlags.actionableWeak)
  const freshnessWeak = Boolean(contentFlags.freshnessWeak)

  const deepContent = wordCount >= 650 || paragraphCount >= 8
  const enoughContent = wordCount >= 350 || paragraphCount >= 5
  const actionableStrong = actionableStepCount >= 3 || actionableScore >= 2
  const actionableSome = actionableStepCount >= 1 || actionableScore >= 1 || !actionableWeak
  const evidenceStrong = evidenceCount >= 2 || externalAuthorityLinkCount >= 2
  const evidenceSome = evidenceCount >= 1 || externalAuthorityLinkCount >= 1 || !evidenceWeak
  const uniquenessStrong = uniqueWordRatio >= 0.28 || experienceCueCount >= 2 || caseStudyCount >= 1
  const uniquenessSome = uniqueWordRatio >= 0.22 || experienceCueCount >= 1
  const freshnessGood = recentYearCount >= 1 || hasPublishedDate || hasModifiedDate
  const structureStrong = !readabilityWeak && !depthVeryLow
  const safetySignals = evidenceSome && !missingCritical.metaDescription && !missingCritical.canonical

  if (deepContent && actionableStrong) {
    set('H1', 'yes', '篇幅充足並提供具體操作步驟。')
  } else if (wordCount < 160) {
    set('H1', 'no', '篇幅過短，難以支援實際行動。')
  } else if (enoughContent && actionableSome) {
    set('H1', 'partial', '具備協助資訊，但仍可補充更明確步驟。')
  } else {
    set('H1', 'partial', '內容有限，建議增加實務指引。')
  }

  if (titleIntentMatch >= 0.5 && !missingCritical.h1Count) {
    set('H2', 'yes', '標題與開頭內容對應良好。')
  } else if (titleIntentMatch < 0.15) {
    set('H2', 'no', '標題意圖尚未在開頭清楚兌現。')
  } else {
    set('H2', 'partial', '主題大致符合，但仍可強化開頭承諾。')
  }

  if (deepContent && (actionableStrong || evidenceStrong)) {
    set('H3', 'yes', '資訊深度足夠，可協助讀者完成任務。')
  } else if (wordCount < 180) {
    set('H3', 'no', '資訊量不足，仍需補充關鍵步驟。')
  } else {
    set('H3', 'partial', '提供部分指引，建議補充操作細節。')
  }

  if (uniquenessStrong) {
    set('Q1', 'yes', '包含案例或獨特觀點，具原創性。')
  } else if (uniquenessSome) {
    set('Q1', 'partial', '展現部分自家觀點，可再增加細節。')
  } else {
    set('Q1', 'partial', '仍以整理資訊為主，建議補充自家洞察。')
  }

  if (!depthLow && deepContent) {
    set('Q2', 'yes', '篇幅與段落覆蓋完整主題。')
  } else if (depthVeryLow) {
    set('Q2', 'no', '內容深度不足，需補齊主要段落。')
  } else {
    set('Q2', 'partial', '資訊尚可，但仍可擴充主題面向。')
  }

  if (caseStudyCount > 0 || experienceCueCount >= 2) {
    set('Q3', 'yes', '提供案例或經驗，具洞察力。')
  } else if (uniquenessSome) {
    set('Q3', 'partial', '有初步案例提及，可再深化洞察。')
  } else {
    set('Q3', 'partial', '缺少案例與具體洞察，建議補充。')
  }

  if (hasAuthorInfo || hasPublisherInfo || hasFirstPersonNarrative) {
    set('E1', 'yes', '呈現作者或品牌背景，可信度良好。')
  } else if (experienceCueCount > 0) {
    set('E1', 'partial', '有經驗線索，但缺少作者／品牌揭露。')
  } else {
    set('E1', 'no', '未偵測到作者或品牌資訊。')
  }

  if (evidenceStrong) {
    set('E2', 'yes', '含外部引用或多筆佐證資料。')
  } else if (evidenceSome || freshnessGood) {
    set('E2', 'partial', '有部分資料來源，建議補充更多引用。')
  } else {
    set('E2', 'no', '缺少外部引用與年份佐證。')
  }

  if (structureStrong) {
    set('P1', 'yes', '段落結構與可讀性良好。')
  } else {
    set('P1', 'partial', '排版可再優化，避免長段落。')
  }

  if (safetySignals && !freshnessWeak) {
    set('P2', 'yes', '未偵測高風險元素，語氣穩健。')
  } else {
    set('P2', 'partial', '建議補充免責或引用，以降低風險。')
  }

  if (uniquenessStrong && evidenceSome) {
    set('C1', 'yes', '展現差異化案例或數據，具競品優勢。')
  } else if (depthVeryLow || uniqueWordRatio < 0.14) {
    set('C1', 'no', '缺乏差異化內容，競品優勢不足。')
  } else {
    set('C1', 'partial', '需補強差異化案例或專屬觀點。')
  }

  return fallback
}

async function evaluateHelpfulContentWithOpenAI({ content, targetKeywords, payload, contentSignals, apiKey }) {
  if (!content || typeof content !== 'string') {
    return {}
  }

  const keywordsList = Array.isArray(targetKeywords) ? targetKeywords.filter(Boolean).join(', ') : ''
  const promptContext = {
    currentScores: {
      overallScore: payload?.overallScore ?? null,
      aeoScore: payload?.aeoScore ?? null,
      seoScore: payload?.seoScore ?? null
    },
    currentMetrics: payload?.metrics ?? null,
    currentHcuReview: payload?.hcuReview ?? null,
    scoreGuards: payload?.scoreGuards ?? null,
    contentSignals: contentSignals ?? null,
    targetKeywords,
    keywordSummary: keywordsList || '（未提供）'
  }

  const prompt = `你是一位熟悉 Google Helpful Content Update、E-E-A-T 與生成式搜尋（AEO/GEO）的資深顧問。請基於以下資訊重新校準各項分數、補強 E-E-A-T 判讀，並產出改善清單：

=== 目前評分與訊號 ===
${JSON.stringify(promptContext, null, 2)}

=== 頁面內容（如需引用請擷取重點） ===
${content.slice(0, 6000)}

請輸出 JSON，格式如下：
{
  "scores": {
    "overallScore": 0-100,
    "aeoScore": 0-100,
    "seoScore": 0-100
  },
  "metrics": {
    "seo": [
      { "name": "內容意圖契合", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "洞察與證據支持", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "可讀性與敘事流暢", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" }
    ],
    "aeo": [
      { "name": "答案精準度", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "精選摘要適配", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "敘事可信度", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" }
    ]
  },
  "eeatBreakdown": {
    "experience": { "score": 0-10, "notes": "20 字內" },
    "expertise": { "score": 0-10, "notes": "20 字內" },
    "authoritativeness": { "score": 0-10, "notes": "20 字內" },
    "trust": { "score": 0-10, "notes": "20 字內" }
  },
  "highRiskFlags": [
    { "type": "harm|deception|spam|compliance", "severity": "critical|warning", "summary": "40 字內", "action": "建議對應處置 40 字內" }
  ],
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "category": "AEO|SEO|Authority|Structure|Safety",
      "issue": "簡述當前缺口 (≤40 字)",
      "action": "具體改善步驟 (≤60 字)",
      "expectedScoreGain": "以 +5 分 格式估算"
    }
  ]
}

原則：
- 請先參考 scoreGuards 與 contentSignals，如資料不足請選擇較低分並在 notes 標註原因。
- 每項 notes、summary、action 均使用繁體中文，避免 Markdown。
- 若無風險則輸出空陣列。
- 建議建議清單至少 4 條（若改善空間有限可 2-3 條）。
- 僅輸出 JSON，不要加任何說明或 Markdown。
`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO/AEO auditor who outputs concise JSON diagnostics.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.35,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI API error (${response.status} ${response.statusText}): ${text}`)
  }

  const data = await response.json()
  const contentText = data?.choices?.[0]?.message?.content
  if (!contentText) {
    return {}
  }

  try {
    return JSON.parse(contentText)
  } catch (error) {
    console.error('Failed to parse OpenAI augmentation response:', contentText, error)
    return {}
  }
}

function mergeAugmentedInsights(basePayload, augmentation) {
  if (!augmentation || typeof augmentation !== 'object') {
    return basePayload
  }

  const merged = { ...basePayload }

  if (augmentation.scores && typeof augmentation.scores === 'object') {
    const { overallScore, aeoScore, seoScore } = augmentation.scores
    if (isFiniteNumber(overallScore)) merged.overallScore = clampScore(overallScore)
    if (isFiniteNumber(aeoScore)) merged.aeoScore = clampScore(aeoScore)
    if (isFiniteNumber(seoScore)) merged.seoScore = clampScore(seoScore)
  }

  if (augmentation.metrics && typeof augmentation.metrics === 'object') {
    merged.metrics = merged.metrics || {}
    merged.metrics.seo = blendMetricArrays(merged.metrics.seo, augmentation.metrics.seo)
    merged.metrics.aeo = blendMetricArrays(merged.metrics.aeo, augmentation.metrics.aeo)
  }

  if (Array.isArray(augmentation.hcuReview) && augmentation.hcuReview.length) {
    merged.hcuReview = augmentation.hcuReview.map(normalizeHcuEntry)
  }

  if (Array.isArray(augmentation.highRiskFlags)) {
    const normalizedFlags = augmentation.highRiskFlags.map(normalizeHighRiskFlag)
    merged.highRiskFlags = Array.isArray(merged.highRiskFlags)
      ? mergeUniqueFlags(merged.highRiskFlags, normalizedFlags)
      : normalizedFlags
  }

  if (augmentation.eeatBreakdown && typeof augmentation.eeatBreakdown === 'object') {
    merged.eeatBreakdown = normalizeEeatBreakdown(augmentation.eeatBreakdown)
  }

  if (Array.isArray(augmentation.recommendations) && augmentation.recommendations.length) {
    merged.recommendations = augmentation.recommendations.map(normalizeRecommendation)
  }

  if (!merged.llmInsights) {
    merged.llmInsights = {}
  }
  merged.llmInsights.openai = {
    ...(merged.llmInsights.openai || {}),
    scores: augmentation.scores || null,
    metrics: augmentation.metrics || null,
    eeatBreakdown: augmentation.eeatBreakdown || null,
    hcuReview: augmentation.hcuReview || null,
    highRiskFlags: augmentation.highRiskFlags || null,
    recommendations: augmentation.recommendations || null
  }

  return merged
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function clampScore(value) {
  if (!isFiniteNumber(value)) return value
  return Math.min(100, Math.max(0, Math.round(value)))
}

function clamp0to10(value) {
  if (!Number.isFinite(value)) return null
  if (value < 0) return 0
  if (value > 10) return 10
  return Math.round(value * 10) / 10
}

function normalizeAugmentedMetric(entry = {}) {
  const name = typeof entry.name === 'string' ? entry.name.trim() : ''
  const score = isFiniteNumber(entry.score) ? clampScore(entry.score) : null
  const confidence = typeof entry.confidence === 'string' ? entry.confidence.trim().toLowerCase() : ''
  const allowedConfidence = new Set(['high', 'medium', 'low'])
  const notes = coerceString(entry.notes).slice(0, 120)
  return {
    name,
    score,
    confidence: allowedConfidence.has(confidence) ? confidence : undefined,
    notes
  }
}

function blendMetricArrays(base = [], augmented = []) {
  if (!Array.isArray(base) && !Array.isArray(augmented)) return []
  const map = new Map()
  if (Array.isArray(base)) {
    base.forEach(metric => {
      if (metric?.name) {
        map.set(metric.name, { ...metric })
      }
    })
  }
  if (Array.isArray(augmented)) {
    augmented.forEach(metric => {
      const normalized = normalizeAugmentedMetric(metric)
      if (!normalized.name) return
      const existing = map.get(normalized.name) || {}
      const blended = blendMetric(existing, normalized)
      map.set(normalized.name, blended)
    })
  }
  return Array.from(map.values())
}

function blendMetric(baseMetric = {}, llmMetric = {}) {
  const weightBase = typeof baseMetric.weight === 'number' ? baseMetric.weight : llmMetric.weight
  const baseScore = Number.isFinite(baseMetric.score) ? clamp0to10(baseMetric.score) : null
  const llmScore = Number.isFinite(llmMetric.score) ? clamp0to10(llmMetric.score) : null
  let score = baseScore
  if (llmScore !== null && baseScore !== null) {
    const blendRatio = llmMetric.confidence === 'high' ? 0.7
      : llmMetric.confidence === 'medium' ? 0.6
      : 0.5
    score = Math.round((llmScore * blendRatio + baseScore * (1 - blendRatio)) * 10) / 10
  } else if (llmScore !== null) {
    score = llmScore
  }
  return {
    ...baseMetric,
    ...llmMetric,
    score,
    weight: weightBase,
    description: baseMetric.description || llmMetric.notes || '',
    notes: llmMetric.notes || baseMetric.notes || undefined
  }
}

function normalizeHcuEntry(entry = {}) {
  const id = typeof entry.id === 'string' ? entry.id.trim() : ''
  const answer = typeof entry.answer === 'string' ? entry.answer.trim().toLowerCase() : 'no'
  const explanation = typeof entry.explanation === 'string' ? entry.explanation.trim() : ''
  const allowed = ['yes', 'partial', 'no']
  const normalizedAnswer = allowed.includes(answer) ? answer : 'no'
  return {
    id: id || 'UNKNOWN',
    answer: normalizedAnswer,
    explanation: explanation.slice(0, 80)
  }
}

function normalizeRecommendation(entry = {}) {
  const allowedPriority = ['critical', 'high', 'medium', 'low']
  const allowedCategory = ['內容', '信任', '讀者體驗']
  const categoryAliases = {
    SEO: '內容',
    AEO: '內容',
    Authority: '信任',
    Structure: '讀者體驗',
    Safety: '信任',
    內容: '內容',
    結構: '讀者體驗',
    'E-E-A-T': '信任',
    技術: '內容',
    風險: '信任'
  }
  const priority = typeof entry.priority === 'string' ? entry.priority.trim().toLowerCase() : 'medium'
  const inputCategory = typeof entry.category === 'string' ? entry.category.trim() : ''
  const category = categoryAliases[inputCategory] || inputCategory
  const normalizedCategory = allowedCategory.includes(category) ? category : '內容'
  const issue = constrainLength(typeof entry.issue === 'string' ? entry.issue : '', 60)
  const action = constrainLength(typeof entry.action === 'string' ? entry.action : '', 80)

  if (containsHtmlEngineering(issue) || containsHtmlEngineering(action)) {
    return null
  }

  return {
    priority: allowedPriority.includes(priority) ? priority : 'medium',
    category: normalizedCategory,
    issue,
    action,
    expectedScoreGain: coerceString(entry.expectedScoreGain).slice(0, 40)
  }
}

function normalizeHighRiskFlag(entry = {}) {
  const allowedTypes = ['harm', 'deception', 'spam', 'compliance']
  const allowedSeverity = ['critical', 'warning']
  const type = typeof entry.type === 'string' ? entry.type.trim().toLowerCase() : ''
  const severity = typeof entry.severity === 'string' ? entry.severity.trim().toLowerCase() : ''
  return {
    type: allowedTypes.includes(type) ? type : 'harm',
    severity: allowedSeverity.includes(severity) ? severity : 'warning',
    summary: coerceString(entry.summary).slice(0, 120),
    action: coerceString(entry.action).slice(0, 120)
  }
}

function normalizeEeatBreakdown(entry = {}) {
  const keys = ['experience', 'expertise', 'authoritativeness', 'trust']
  const normalized = {}
  keys.forEach((key) => {
    const value = entry[key] || {}
    normalized[key] = {
      score: isFiniteNumber(value.score) ? clampScore(value.score) : null,
      notes: coerceString(value.notes).slice(0, 60)
    }
  })
  return normalized
}

function mergeUniqueFlags(baseFlags = [], newFlags = []) {
  const keyOf = (flag) => `${flag.type || ''}-${flag.summary || ''}-${flag.severity || ''}`
  const seen = new Set(baseFlags.map((flag) => keyOf(flag)))
  const merged = [...baseFlags]
  newFlags.forEach((flag) => {
    const key = keyOf(flag)
    if (!seen.has(key)) {
      merged.push(flag)
      seen.add(key)
    }
  })
  return merged
}

function buildEvidenceEntries(key, contentSignals = {}, scoreGuards = {}) {
  const missing = scoreGuards.missingCritical || {}
  const flags = scoreGuards.contentQualityFlags || {}
  const unknownSignals = Array.isArray(contentSignals.unknownSignals) ? contentSignals.unknownSignals : []
  const entries = []

  const push = (text) => {
    if (text) entries.push(text)
  }

  switch (key) {
    case 'author':
      push(`hasAuthorInfo=${contentSignals.hasAuthorInfo}`)
      break
    case 'publisher':
      push(`hasPublisherInfo=${contentSignals.hasPublisherInfo}`)
      break
    case 'meta':
      push(`hasMetaDescription=${contentSignals.hasMetaDescription}`)
      break
    case 'canonical':
      push(`hasCanonical=${contentSignals.hasCanonical}`)
      break
    case 'evidence':
      push(`evidenceCount=${contentSignals.evidenceCount}`)
      push(`externalAuthorityLinkCount=${contentSignals.externalAuthorityLinkCount}`)
      break
    case 'structure':
      push(`h2Count=${contentSignals.h2Count}`)
      push(`listCount=${contentSignals.listCount}`)
      break
    case 'schema':
      push(`schemaInspectable=${contentSignals.inspectability?.schema}`)
      push(`unknownSignals=${unknownSignals.join(',') || 'none'}`)
      break
    case 'readability':
      push(`paragraphAverageLength=${contentSignals.paragraphAverageLength}`)
      push(`longParagraphCount=${contentSignals.longParagraphCount}`)
      break
    default:
      break
  }

  if (entries.length) return entries

  if (missing && Object.prototype.hasOwnProperty.call(missing, key)) {
    return [`missingCritical.${key}=${missing[key]}`]
  }

  if (flags && Object.prototype.hasOwnProperty.call(flags, key)) {
    return [`contentQualityFlags.${key}=${flags[key]}`]
  }

  return []
}

function formatActionWithEvidence(action, evidence = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) return action
  return `${action}（偵測：${evidence.join(' | ')}）`
}

function generateHeuristicRecommendations(payload = {}, contentSignals = {}) {
  const recommendations = []
  const scoreGuards = payload.scoreGuards || {}
  const missing = scoreGuards.missingCritical || {}
  const flags = scoreGuards.contentQualityFlags || {}

  const add = (priority, category, issue, action, expectedScoreGain, evidence = []) => {
    if (containsHtmlEngineering(issue) || containsHtmlEngineering(action)) return
    const evidenceList = Array.isArray(evidence) ? evidence.filter(Boolean) : []
    recommendations.push({
      priority,
      category,
      issue,
      action,
      expectedScoreGain,
      title: issue,
      description: action,
      evidence: evidenceList
    })
  }

  const evidence = buildEvidenceEntries('evidence', contentSignals, scoreGuards)
  if (flags.evidenceWeak || (contentSignals.evidenceCount ?? 0) < 2) {
    add(
      'high',
      '信任',
      '缺少可信引用或佐證資料',
      formatActionWithEvidence('在段落中加入最新數據、案例連結或權威引用，提升內容可信度。', evidence),
      '+6 分',
      evidence
    )
  }

  if (flags.depthLow || (contentSignals.wordCount ?? 0) < 600) {
    add(
      'high',
      '內容',
      '主題深度不足',
      '補充常見問題、比較表或實務範例，延伸說明讀者後續動作。',
      '+6 分'
    )
  }

  if (flags.readabilityWeak || (contentSignals.longParagraphCount ?? 0) > 0) {
    const readabilityEvidence = buildEvidenceEntries('readability', contentSignals, scoreGuards)
    add(
      'medium',
      '讀者體驗',
      '段落結構影響可讀性',
      formatActionWithEvidence('拆分長段、加入小標與項目符號，讓重點更易掃讀。', readabilityEvidence),
      '+4 分',
      readabilityEvidence
    )
  }

  if (flags.experienceWeak) {
    const experienceEvidence = buildEvidenceEntries('author', contentSignals, scoreGuards)
    add(
      'medium',
      '信任',
      '缺乏第一手經驗視角',
      formatActionWithEvidence('補充實際案例、個人操作心得或客戶故事，彰顯內容可信度。', experienceEvidence),
      '+4 分',
      experienceEvidence
    )
  }

  if (missing.author === true || missing.publisher === true) {
    const trustEvidence = [
      ...buildEvidenceEntries('author', contentSignals, scoreGuards),
      ...buildEvidenceEntries('publisher', contentSignals, scoreGuards)
    ]
    add(
      'high',
      '信任',
      '缺少作者或品牌身份資訊',
      formatActionWithEvidence('在文章開頭或結尾標示作者背景、品牌介紹與聯絡管道。', trustEvidence),
      '+6 分',
      trustEvidence
    )
  }

  if (flags.uniqueWordLow || (contentSignals.uniqueWordRatio ?? 1) < 0.25) {
    add(
      'medium',
      '內容',
      '敘述易重複，缺乏差異化',
      '補充新觀點或替換重複句型，加入多元情境與角色視角。',
      '+3 分'
    )
  }

  return recommendations
}

const FEATURE_RECOMMENDATION_MAP = {
  titleIntentMatch: {
    category: '內容',
    priority: 'high',
    issue: '開頭段落未清楚兌現搜尋意圖',
    action: '調整標題與首段，直接重述使用者問題並給出摘要答案。',
    expectedScoreGain: '+5 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.titleMismatch
  },
  firstParagraphAnswerQuality: {
    category: '內容',
    priority: 'high',
    issue: '首段沒有直接回答主要問題',
    action: '重寫開頭段落，提供明確結論與下一步行動提醒。',
    expectedScoreGain: '+5 分',
    condition: ({ contentSignals }) => (contentSignals?.firstParagraphAnswerQuality ?? 0) < 0.6
  },
  qaFormatScore: {
    category: '內容',
    priority: 'medium',
    issue: '缺少問答式結構，難以讓讀者快速抓重點',
    action: '以「問題＋回答」格式重組段落，讓每段直接回覆一個疑問。',
    expectedScoreGain: '+4 分',
    condition: ({ contentSignals }) => (contentSignals?.qaFormatScore ?? 0) < 0.5
  },
  semanticParagraphFocus: {
    category: '內容',
    priority: 'medium',
    issue: '段落主題分散，關鍵資訊難以辨識',
    action: '針對讀者問題拆分段落，每段只專注在一個重點並加入小標。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.semanticParagraphFocus ?? 0) < 0.55
  },
  topicCohesion: {
    category: '內容',
    priority: 'medium',
    issue: '內容跳題，主題一致性不足',
    action: '整理大綱，移除與目標問題無關的段落並補上關鍵步驟。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.topicCohesion ?? 0) < 0.6
  },
  actionableScoreNorm: {
    category: '內容',
    priority: 'high',
    issue: '缺乏可執行的步驟或清單',
    action: '補上 3-5 個具體操作步驟或檢核清單，協助讀者立即採取行動。',
    expectedScoreGain: '+6 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.actionableWeak
  },
  referenceKeywordNorm: {
    category: '內容',
    priority: 'medium',
    issue: '未涵蓋關鍵關聯詞或延伸問題',
    action: '蒐集相關長尾問題，於段落中自然回答並補充案例。',
    expectedScoreGain: '+4 分',
    condition: ({ contentSignals }) => (contentSignals?.referenceKeywordNorm ?? 0) < 0.5
  },
  evidenceCountNorm: {
    category: 'E-E-A-T',
    priority: 'high',
    issue: '缺少外部資料或統計支撐',
    action: '引用並連結 2-3 個可信來源，標註年份與關鍵數據。',
    expectedScoreGain: '+5 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.evidenceWeak
  },
  experienceCueNorm: {
    category: 'E-E-A-T',
    priority: 'medium',
    issue: '沒有展現實務經驗或案例',
    action: '補充親身經驗、客戶成果或失敗教訓，強化可信度。',
    expectedScoreGain: '+4 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.experienceWeak
  },
  entityRichnessNorm: {
    category: '內容',
    priority: 'medium',
    issue: '專有名詞與實體提及不足',
    action: '加入人物、地點、工具或數值等具體實體，提高資訊密度。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.entityRichnessNorm ?? 0) < 0.5
  },
  paragraphExtractability: {
    category: '內容',
    priority: 'medium',
    issue: '段落過長或缺少重點句，難以被擷取',
    action: '將關鍵結論獨立成 2-3 句短段落，並以粗體或小標凸顯結論。',
    expectedScoreGain: '+4 分',
    condition: ({ contentSignals }) => (contentSignals?.paragraphExtractability ?? 0) < 0.55
  },
  semanticNaturalness: {
    category: '內容',
    priority: 'medium',
    issue: '語句生硬或堆疊關鍵字，降低可信度',
    action: '重寫冗長句為口語化短句，確保段落自然易讀。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.semanticNaturalness ?? 0) < 0.6
  },
  uniqueWordRatio: {
    category: '內容',
    priority: 'medium',
    issue: '重複用詞過多，缺乏差異化內容',
    action: '補充不同角度與實例，重新敘述重複句型。',
    expectedScoreGain: '+3 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.uniqueWordLow
  },
  depthLowFlag: {
    category: '內容',
    priority: 'high',
    issue: '篇幅過短，主題面向覆蓋不足',
    action: '新增常見問題、比較表與最佳實務，至少補足 500 字。',
    expectedScoreGain: '+6 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.depthLow
  },
  readabilityWeakFlag: {
    category: '內容',
    priority: 'high',
    issue: '段落過長或句子太複雜，影響可讀性',
    action: '拆分長段、加入項目符號，並將 30 字以上長句改寫為短句。',
    expectedScoreGain: '+5 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.readabilityWeak
  },
  longParagraphPenalty: {
    category: '內容',
    priority: 'medium',
    issue: '存在 200 字以上長段落，難以掃讀',
    action: '將長段落分割為 2-3 個短段落，並於開頭加入主題句。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.longParagraphCount ?? 0) > 0
  },
  paragraphsLongFlag: {
    category: '內容',
    priority: 'medium',
    issue: '平均段落過長，手機閱讀負擔高',
    action: '控制每段 60-80 字，必要時使用項目符號分段。',
    expectedScoreGain: '+3 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.readabilityWeak
  },
  h2CountNorm: {
    category: '內容',
    priority: 'medium',
    issue: '缺少小標題支撐段落層次',
    action: '依讀者流程補上 3-5 個 H2 小標，每段聚焦一個子問題。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.h2CountNorm ?? 0) < 0.5
  },
  richSnippetFormat: {
    category: '內容',
    priority: 'medium',
    issue: '缺少列表或步驟格式，難以被摘要',
    action: '將重點整理為編號步驟、表格或比較清單，方便快速抽取。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.richSnippetFormat ?? 0) < 0.5
  },
  hcuNoRatio: {
    category: '內容',
    priority: 'high',
    issue: 'HCU 自評顯示多數問題為「不符合」',
    action: '針對 HCU 問卷中標記為 no 的題目，補上具體案例與使用者導向描述。',
    expectedScoreGain: '+6 分',
    condition: ({ hcuCounts }) => (hcuCounts?.no ?? 0) >= 1
  }
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const RECOMMENDATION_METRIC_THRESHOLD = 8

// 新指標映射（17 項純內容向指標）
const FEATURE_METRIC_OVERRIDES = {
  // HCU 指標映射
  hcuYesRatio: ['helpfulRatio', 'intentFit'],
  hcuNoRatio: ['helpfulRatio', 'intentFit'],
  hcuPartialRatio: ['helpfulRatio'],
  titleIntentMatch: ['intentFit'],
  firstParagraphAnswerQuality: ['intentFit', 'keySummary'],
  qaFormatScore: ['intentFit', 'extractability'],
  wordCountNorm: ['depthCoverage'],
  topicCohesion: ['depthCoverage'],
  semanticParagraphFocus: ['depthCoverage', 'extractability'],
  referenceKeywordNorm: ['intentExpansion'],
  actionableScoreNorm: ['actionability'],
  avgSentenceLengthNorm: ['readabilityRhythm'],
  longParagraphPenalty: ['readabilityRhythm', 'extractability'],
  listCount: ['structureHighlights'],
  tableCount: ['structureHighlights'],
  authorMentionCount: ['authorBrandSignals'],
  brandMentionCount: ['authorBrandSignals'],
  evidenceCountNorm: ['evidenceSupport'],
  externalCitationCount: ['evidenceSupport'],
  experienceCueNorm: ['experienceSignals'],
  caseStudyCount: ['experienceSignals'],
  uniqueWordRatio: ['narrativeDensity'],
  entityRichnessNorm: ['narrativeDensity'],
  recentYearCount: ['freshnessSignals'],
  hasVisibleDate: ['freshnessSignals'],
  expertTermDensity: ['expertPerspective'],
  comparisonCueCount: ['expertPerspective'],
  // AEO 指標映射
  paragraphExtractability: ['extractability'],
  hasKeyTakeaways: ['keySummary'],
  summaryCueCount: ['keySummary'],
  semanticNaturalness: ['conversationalGuidance'],
  readerCueCount: ['conversationalGuidance'],
  ctaCueCount: ['readerActivation'],
  questionCueCount: ['readerActivation']
}

function pickLowScoringMetrics(metrics = [], lowThreshold = 6, limit = 4) {
  if (!Array.isArray(metrics)) return []
  return metrics
    .filter((metric) => Number.isFinite(metric?.score))
    .filter((metric) => metric.score <= lowThreshold)
    .map((metric) => ({
      name: metric.name,
      score: metric.score,
      description: metric.description || '',
      weight: metric.weight || 0,
      evidence: Array.isArray(metric.evidence) ? metric.evidence : []
    }))
    .sort((a, b) => {
      const weightDiff = (b.weight || 0) - (a.weight || 0)
      if (Math.abs(weightDiff) > 0.01) return weightDiff
      return a.score - b.score
    })
    .slice(0, limit)
}

function buildMetricRecommendation(metric, modelContext, target = 'seo') {
  const featureKey = normalizeMetricNameToFeature(metric.name, target)
  const featureConfig = FEATURE_RECOMMENDATION_MAP[featureKey]
  if (!featureConfig) {
    return {
      priority: metric.score <= 3 ? 'high' : metric.score <= 6 ? 'medium' : 'low',
      category: '內容',
      issue: `${metric.name} 分數偏低 (${metric.score} 分)` ,
      action: metric.description || '補強該指標相關的內容與信任訊號。',
      expectedScoreGain: '+3 分',
      title: `${metric.name} 分數偏低`,
      description: metric.description || '補強該指標相關的內容與信任訊號。',
      featureKey,
      score: metric.score,
      weight: metric.weight
    }
  }

  if (typeof featureConfig.condition === 'function' && !featureConfig.condition(modelContext)) {
    return null
  }

  const priority = metric.score <= 3 ? 'high' : featureConfig.priority || 'medium'
  return {
    priority,
    category: featureConfig.category,
    issue: `${metric.name} 分數偏低（${metric.score} 分）`,
    action: featureConfig.action,
    expectedScoreGain: featureConfig.expectedScoreGain || '+4 分',
    title: `${metric.name} 分數偏低`,
    description: featureConfig.action,
    featureKey,
    score: metric.score,
    weight: metric.weight
  }
}

function normalizeMetricNameToFeature(name = '', target = 'seo') {
  const trimmed = name.trim()
  const seoMapping = {
    '內容意圖契合': 'titleIntentMatch',
    '洞察與證據支持': 'evidenceCountNorm',
    '可讀性與敘事流暢': 'readabilityWeakFlag'
  }
  const aeoMapping = {
    '答案精準度': 'actionableScoreNorm',
    '精選摘要適配': 'paragraphExtractability',
    '敘事可信度': 'semanticNaturalness'
  }
  if (target === 'seo') return seoMapping[trimmed] || trimmed
  if (target === 'aeo') return aeoMapping[trimmed] || trimmed
  return trimmed
}

function generateModelRecommendations(seoPredictions, aeoPredictions, modelContext, metrics = {}) {
  const recommendations = []
  const featureScores = new Map()

  const accumulate = (predictionMap) => {
    if (!predictionMap) return
    predictionMap.forEach((entry) => {
      if (!entry?.contributions) return
      Object.entries(entry.contributions).forEach(([feature, delta]) => {
        if (typeof delta !== 'number' || delta >= 0) return
        const current = featureScores.get(feature) || { total: 0, min: 0 }
        const total = current.total + delta
        const min = Math.min(current.min, delta)
        featureScores.set(feature, { total, min })
      })
    })
  }

  accumulate(seoPredictions)
  accumulate(aeoPredictions)

  featureScores.forEach((scoreMeta, feature) => {
    const config = FEATURE_RECOMMENDATION_MAP[feature]
    if (!config) return
    if (typeof config.condition === 'function' && !config.condition(modelContext)) return

    const magnitude = Math.abs(scoreMeta.min)
    const autoPriority = magnitude >= 2 ? 'high' : magnitude >= 1 ? 'medium' : 'low'
    const priority = config.priority || autoPriority
    const expectedScoreGain = config.expectedScoreGain || `+${Math.max(2, Math.round(magnitude * 3))} 分`

    recommendations.push({
      priority,
      category: config.category,
      issue: config.issue,
      action: config.action,
      expectedScoreGain,
      title: config.issue,
      description: config.action,
      featureKey: feature,
      impactScore: magnitude
    })
  })

  const lowSeoMetrics = pickLowScoringMetrics(metrics.seo, 6, 4)
  const lowAeoMetrics = pickLowScoringMetrics(metrics.aeo, 6, 2)
  const metricBased = [
    ...lowSeoMetrics.map((metric) => buildMetricRecommendation(metric, modelContext, 'seo')),
    ...lowAeoMetrics.map((metric) => buildMetricRecommendation(metric, modelContext, 'aeo'))
  ]
    .filter(Boolean)

  const merged = mergeRecommendations(metricBased, recommendations)

  merged.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99
    const pb = PRIORITY_ORDER[b.priority] ?? 99
    if (pa !== pb) return pa - pb
    if (Number.isFinite(b.weight) && Number.isFinite(a.weight) && b.weight !== a.weight) {
      return b.weight - a.weight
    }
    if (Number.isFinite(b.score) && Number.isFinite(a.score) && b.score !== a.score) {
      return a.score - b.score
    }
    return (b.impactScore || 0) - (a.impactScore || 0)
  })

  return merged.slice(0, 6)
}

function mergeRecommendations(primary = [], secondary = []) {
  const result = []
  const seen = new Set()

  const append = (list) => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      if (!item || typeof item !== 'object') return
      if (containsHtmlEngineering(item.issue) || containsHtmlEngineering(item.action)) return
      const key = `${item.category || ''}-${item.issue || item.title || ''}`
      if (seen.has(key)) return
      seen.add(key)
      result.push({ ...item })
    })
  }

  append(primary)
  append(secondary)
  return result
}

const HCU_QUESTION_SET = [
  { id: 'H1', category: 'helpfulness', question: '內容是否以協助人類讀者為主，而非僅為搜尋引擎打造？' },
  { id: 'H2', category: 'helpfulness', question: '內容是否真實回答標題或開頭承諾的問題？' },
  { id: 'H3', category: 'helpfulness', question: '讀者在閱讀後是否能獲得足夠資訊完成其目標？' },
  { id: 'Q1', category: 'quality', question: '內容是否提供原創的資訊、分析或實務經驗，而非淪為整理或重寫？' },
  { id: 'Q2', category: 'quality', question: '內容是否涵蓋主題所需的完整資訊（深度與廣度足夠）？' },
  { id: 'Q3', category: 'quality', question: '內容是否提供超出顯而易見的洞察或案例？' },
  { id: 'E1', category: 'expertise', question: '是否清楚展現作者或品牌的專業背景、來源與可信度？' },
  { id: 'E2', category: 'expertise', question: '是否引用可信來源並避免明顯錯誤？' },
  { id: 'P1', category: 'presentation', question: '內容在結構、排版與語言呈現上是否井然、有助閱讀？' },
  { id: 'P2', category: 'presentation', question: '是否避免干擾閱讀的廣告或不必要元素？' },
  { id: 'C1', category: 'context', question: '相較於搜尋結果競品，此內容是否提供更高的價值或獨特性？' }
]

const HCU_METRIC_RULES = [
  { scope: 'seo', metric: '內容意圖契合', questions: ['H1', 'H2', 'H3'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '洞察與證據支持', questions: ['Q1', 'Q2', 'Q3', 'E2', 'C1'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '可讀性與敘事流暢', questions: ['P1', 'H3'], caps: { partial: 6, no: 4 } },
  { scope: 'aeo', metric: '答案精準度', questions: ['H2', 'H3'], caps: { partial: 6, no: 4 } },
  { scope: 'aeo', metric: '精選摘要適配', questions: ['H2', 'H3', 'P1'], caps: { partial: 6, no: 4 } },
  { scope: 'aeo', metric: '敘事可信度', questions: ['E1', 'E2', 'Q3'], caps: { partial: 6, no: 4 } }
]

function formatHcuQuestions(questionSet = HCU_QUESTION_SET) {
  return questionSet
    .map((item, index) => `${index + 1}. [${item.id}] ${item.question}`)
    .join('\n')
}

// 禁用全局速率限制以避免記憶體洩漏
// 改由客戶端控制請求速率
const rateLimitStore = new Map()
const RATE_LIMIT_ENABLED = false

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function getClientSessionId(requestBody) {
  if (typeof requestBody?.sessionId === 'string' && requestBody.sessionId.trim()) {
    return requestBody.sessionId.trim()
  }
  if (typeof requestBody?.session === 'string' && requestBody.session.trim()) {
    return requestBody.session.trim()
  }
  return null
}

function getClientIp(request) {
  const headerKeys = ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip']
  for (const key of headerKeys) {
    const value = request.headers.get(key)
    if (value && typeof value === 'string') {
      return value.split(',')[0].trim()
    }
  }
  return null
}

function rateLimitKey(prefix, id) {
  return `${prefix}:${id}`
}

function checkRateLimit(prefix, id, config) {
  // 禁用速率限制以避免記憶體洩漏
  // 改由客戶端（serp_collection.py）控制請求速率
  if (!RATE_LIMIT_ENABLED) {
    return { allowed: true, remaining: config.limit }
  }
  
  if (!id) return { allowed: true }
  const key = rateLimitKey(prefix, id)
  const entry = rateLimitStore.get(key)
  const now = nowSeconds()

  if (!entry) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowSeconds })
    return { allowed: true, remaining: config.limit - 1 }
  }

  if (now >= entry.resetAt) {
    entry.count = 1
    entry.resetAt = now + config.windowSeconds
    return { allowed: true, remaining: config.limit - 1 }
  }

  if (entry.count >= config.limit) {
    return { allowed: false, retryAfter: entry.resetAt - now }
  }

  entry.count += 1
  return { allowed: true, remaining: config.limit - entry.count }
}

function responseWithRateLimitError(message, retryAfter, corsHeaders) {
  return new Response(
    JSON.stringify({ error: message, retryAfter }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfter ?? 60))
      }
    }
  )
}

function validateContentUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return { valid: false, error: 'contentUrl 必須是字串' }
  let url
  try {
    url = new URL(rawUrl.trim())
  } catch (error) {
    return { valid: false, error: 'URL 格式不正確' }
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: '僅支援 http/https 網址' }
  }

  return { valid: true, url }
}

async function fetchUrlContent(url, { fetch, signal }) {
  // 簡化版：快速超時以避免 Worker 資源限制
  // 完整版應在後端計算
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('fetch-timeout'), 5000) // 減少至 5 秒
  let redirectedCount = 0
  let currentUrl = url
  let response

  try {
    while (redirectedCount <= FETCH_MAX_REDIRECTS) {
      response = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': FETCH_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) {
          throw new Error(`抓取失敗：收到 ${response.status} 但無 Location 標頭`)
        }
        const nextUrl = new URL(location, currentUrl)
        if (!['http:', 'https:'].includes(nextUrl.protocol)) {
          throw new Error('抓取失敗：轉址至不支援的協定')
        }
        currentUrl = nextUrl
        redirectedCount += 1
        continue
      }

      break
    }

    if (!response) {
      throw new Error('抓取失敗：無回應')
    }

    if (response.status >= 400) {
      throw new Error(`抓取失敗：HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      throw new Error('抓取失敗：僅支援 HTML 內容')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('抓取失敗：回應無可讀取的內容')
    }

    const chunks = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (received > FETCH_MAX_BYTES) {
        throw new Error('抓取失敗：頁面大小超過限制')
      }
      chunks.push(value)
    }
    const combined = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    const decoder = new TextDecoder('utf-8', { fatal: false })
    const html = decoder.decode(combined)
    return { html, finalUrl: currentUrl.toString() }
  } finally {
    clearTimeout(timeoutId)
    controller.abort()
  }
}
function quickExtractContent(htmlText) {
  const cleanedHtml = sanitizeHtml(htmlText)
  const plain = cleanedHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!plain || plain.length < 20) {
    throw new Error('無法解析頁面正文，請確認網頁內容')
  }

  return {
    html: cleanedHtml.substring(0, 10000),
    plain: plain.substring(0, 50000),
    markdown: ''
  }
}

function extractReadableContent(htmlText, finalUrl) {
  // 簡化版：快速提取以避免超時
  // 完整版應在後端計算
  try {
    const { document } = parseHTML(htmlText)

    if (!document || !document.body) {
      throw new Error('無法解析頁面正文，請確認網頁內容')
    }

    // 移除負面語意標籤
    for (const tag of EXCLUDED_SEMANTIC_TAGS) {
      const nodes = Array.from(document.getElementsByTagName(tag))
      for (const node of nodes) {
        node?.remove?.()
      }
    }

    // 移除角色為導覽 / 橫幅等不相關內容
    document.querySelectorAll('[role]').forEach(node => {
      const role = (node.getAttribute('role') || '').toLowerCase()
      if (role && EXCLUDED_ROLE_PATTERNS.has(role)) {
        node.remove()
      }
    })

    // 針對常見雜訊 class/id 進行排除
    if (EXCLUDED_CLASS_PATTERNS.length) {
      const selector = EXCLUDED_CLASS_PATTERNS
        .map(pattern => `[class*="${pattern}"]`)
        .join(', ')

      if (selector) {
        document.querySelectorAll(selector).forEach(node => node.remove())
      }

      const idSelector = EXCLUDED_CLASS_PATTERNS
        .map(pattern => `[id*="${pattern}"]`)
        .join(', ')

      if (idSelector) {
        document.querySelectorAll(idSelector).forEach(node => node.remove())
      }
    }

    const body = document.body
    const cleanedHtml = sanitizeHtml(body.innerHTML || '')
    const plain = (body.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!plain || plain.length < 50) {
      return quickExtractContent(htmlText)
    }

    const htmlOutput = cleanedHtml || htmlText

    return {
      html: htmlOutput.substring(0, 10000),
      plain: plain.substring(0, 50000),
      markdown: ''
    }
  } catch (error) {
    return quickExtractContent(htmlText)
  }
}

function sanitizeHtml(html) {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/on[a-z]+\s*=\s*[^"'\s>]+/gi, '')
    .replace(/javascript:/gi, '')
}

function stripTrailingComma(text) {
  return typeof text === 'string' ? text.replace(/,\s*$/u, '') : text;
}

function appendMissingClosers(text) {
  if (typeof text !== 'string') return text;
  const stack = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      stack.push('}');
    } else if (ch === '[') {
      stack.push(']');
    } else if ((ch === '}' || ch === ']') && stack.length) {
      const expected = stack[stack.length - 1];
      if (expected === ch) {
        stack.pop();
      } else {
        break;
      }
    }
  }
  return text + stack.reverse().join('');
}

async function analyzeWithGemini(content, targetKeywords, env, contentSignals = {}) {
  try {
    console.log('Starting Gemini API call...');
    
    const firstKeyword = Array.isArray(targetKeywords) && targetKeywords.length ? targetKeywords[0] : '';
    const apiKey = env && env.GEMINI_API_KEY ? env.GEMINI_API_KEY : null;
    const forceMock = String(env?.USE_GEMINI_MOCK || '').toLowerCase() === 'true';

    if (!apiKey) {
      console.error('Gemini API key is missing');
    }

    if (forceMock || !apiKey) {
      console.warn('USE_GEMINI_MOCK 啟用或缺少 API key，本次改用模擬分析結果');
      return generateMockAnalysis(content || '', firstKeyword);
    }

    // 控制輸入長度避免超出總tokens
    const MAX_CONTENT_CHARS = 8000;
    const truncatedContent = typeof content === 'string' ? content.slice(0, MAX_CONTENT_CHARS) : content;
    const prompt = buildAnalysisPrompt(truncatedContent, targetKeywords, contentSignals);
    console.log('Prompt length:', prompt.length);
    
    // 動態選擇可用模型：呼叫 v1 ListModels 並挑選支援 generateContent 的 2.x 或 1.5 模型
    const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    console.log('Listing models from:', listUrl);
    const listRes = await fetch(listUrl);
    const listText = await listRes.text();
    if (!listRes.ok) {
      throw new Error(`ListModels failed (${listRes.status} ${listRes.statusText}): ${listText}`);
    }
    const listData = JSON.parse(listText);
    const models = Array.isArray(listData.models) ? listData.models : [];
    // 偏好順序：2.5 > 2.0 > 1.5 > 1.0；且要有 generateContent 支援
    const prefer = [
      'gemini-2.5-flash', 'gemini-2.0-pro', 'gemini-2.0-flash',
      'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'
    ];
    let chosen = null;
    for (const name of prefer) {
      const m = models.find(x => x.name?.includes(name) && (x.supportedGenerationMethods?.includes('generateContent') || x.supportedGenerationMethods?.includes('generateText')));
      if (m) { chosen = m; break; }
    }
    // 若未命中，退而求其次：任一支援 generateContent 的模型
    if (!chosen) {
      chosen = models.find((x) => {
        const supportsGeneration = x.supportedGenerationMethods?.includes('generateContent') || x.supportedGenerationMethods?.includes('generateText');
        const isHighCostPro = typeof x.name === 'string' && x.name.includes('gemini-2.5-pro');
        return supportsGeneration && !isHighCostPro;
      });
    }
    if (!chosen || !chosen.name) {
      throw new Error('No available Gemini model supporting generateContent for this API key/project');
    }
    const chosenModel = chosen.name.replace('models/', '');
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${chosenModel}:generateContent?key=${apiKey}`;
    console.log('Chosen model:', chosenModel);
    console.log('API URL:', apiUrl);
    
    // 簡化請求體，只包含必要字段
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt + '\n\n請以有效的 JSON 格式回應，不要包含任何其他文字。'
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 4096
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };
    
    console.log('Sending request to Gemini API...');
    console.log('Request URL:', apiUrl);
    console.log('Request payload summary:', JSON.stringify({
      contentLength: typeof truncatedContent === 'string' ? truncatedContent.length : 0,
      keywordCount: targetKeywords.length,
      temperature: requestBody.generationConfig.temperature,
      maxOutputTokens: requestBody.generationConfig.maxOutputTokens
    }, null, 2));
    
    let response;
    let responseText;

    const tryOnce = async () => {
      return fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    };

    // Internal retries for transient errors (429/503)
    const maxRetries = 2;
    let attempt = 0;
    let lastStatus = 0;
    while (attempt <= maxRetries) {
      response = await tryOnce();
      responseText = await response.text();
      console.log('Response status:', response.status, response.statusText);
      
      // 記錄響應頭和部分響應體（不記錄敏感信息）
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = key.toLowerCase().includes('key') ? '***REDACTED***' : value;
      });
      console.log('Response headers:', JSON.stringify(responseHeaders, null, 2));
      
      // 只記錄響應體的前 500 個字符，避免日誌過大
      console.log('Response body length:', typeof responseText === 'string' ? responseText.length : 0);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        const responseSummary = {
          candidateCount: Array.isArray(data?.candidates) ? data.candidates.length : 0,
          finishReason: data?.candidates?.[0]?.finishReason ?? data?.candidates?.[0]?.finish_reason ?? null,
          promptTokens: data?.usageMetadata?.promptTokenCount ?? data?.usage?.prompt_tokens ?? null,
          responseTokens: data?.usageMetadata?.candidatesTokenCount ?? data?.usage?.completion_tokens ?? null
        };
        console.log('Parsed response summary:', JSON.stringify(responseSummary, null, 2));
        
        const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) ? data.candidates[0].content.parts : [];
        const textPart = Array.isArray(parts) ? parts.find(p => typeof p.text === 'string') : undefined;
        if (!textPart || !textPart.text) {
          console.warn('No text part found in response，改用模擬分析結果');
          return generateMockAnalysis(content || '', firstKeyword);
        }

        // Try to parse JSON from text
        let jsonString = textPart.text;
        const jsonMatch = jsonString.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1];
        }
        try {
          const parsed = JSON.parse(jsonString);
          return parsed;
        } catch (e) {
          console.warn('Failed to parse JSON from text part，嘗試修復', e);
          const repaired = tryParseJson(jsonString);
          if (repaired) {
            console.log('tryParseJson 成功修復 Gemini 回應');
            return repaired;
          }
          console.warn('Gemini 回應仍不可解析，改用模擬分析結果');
          return generateMockAnalysis(content || '', firstKeyword);
        }
      }

      lastStatus = response.status;
      if (response.status === 429 || response.status === 503) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`Gemini transient error ${response.status}, retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
        attempt += 1;
        continue;
      }

      if (!response.ok) {
        let errorDetails;
        try {
          const errorJson = JSON.parse(responseText);
          // 過濾掉可能的敏感信息
          if (errorJson.error && errorJson.error.message) {
            errorDetails = errorJson.error.message;
          } else {
            errorDetails = JSON.stringify(errorJson, (key, value) => 
              key.toLowerCase().includes('key') ? '***REDACTED***' : value, 2);
          }
        } catch (e) {
          errorDetails = 'Failed to parse error response';
        }
        
        const errorMessage = `Gemini API 錯誤 (${response.status} ${response.statusText}): ${errorDetails}`;
        console.error(errorMessage);
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.warn(`Gemini 客戶端錯誤 ${response.status}，改用模擬分析結果`);
          const firstKeyword = Array.isArray(targetKeywords) && targetKeywords.length ? targetKeywords[0] : '';
          return generateMockAnalysis(content || '', firstKeyword);
        }
        throw new Error(errorMessage);
      }
    }
  } catch (error) {
    console.error('Unexpected error in analyzeWithGemini:', error);
    // Fallback: if model is overloaded or rate-limited, return mock to keep UX responsive
    const message = String(error.message || '');
    if (message.includes('503') || message.includes('429') || message.includes('401') || message.includes('403')) {
      console.warn('Gemini 服務異常或拒絕，改用模擬分析結果（outer catch）');
      return generateMockAnalysis(content || '', firstKeyword);
    }
    throw error;
  }
}

function stripMarkdownFences(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function tryParseJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text.trim();
  const attempts = new Set();

  const enqueue = (candidate) => {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) attempts.add(trimmed);
    }
  };

  enqueue(cleaned);
  enqueue(stripTrailingComma(cleaned));
  enqueue(appendMissingClosers(cleaned));
  enqueue(appendMissingClosers(stripTrailingComma(cleaned)));

  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastBrace !== -1) {
    const slice = cleaned.slice(0, lastBrace + 1);
    enqueue(slice);
    enqueue(appendMissingClosers(slice));
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      continue;
    }
  }

  console.error('tryParseJson failed after repair attempts', cleaned.slice(0, 200));
  return null;
}

export async function onRequestPost(context) {
  const { request } = context

  console.log('onRequestPost 進入', {
    url: request.url,
    method: request.method
  })

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://ragseo.thinkwithblack.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestUrl = new URL(request.url)
  const segments = requestUrl.pathname.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1] || ''

  if (lastSegment === 'fetch-content') {
    return handleFetchContent(context, corsHeaders)
  }

  console.log('路由至 handleAnalyzePost')

  try {
    return await handleAnalyzePost(context, corsHeaders)
  } catch (error) {
    console.error('handleAnalyzePost 發生未捕捉錯誤', {
      message: error?.message,
      stack: error?.stack
    })
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleFetchContent(context, corsHeaders) {
  const { request } = context

  let requestBody
  try {
    requestBody = await request.json()
  } catch (error) {
    return new Response(
      JSON.stringify({ error: '無效的 JSON 請求體' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const rawUrl = requestBody?.contentUrl || requestBody?.url
  if (!rawUrl) {
    return new Response(
      JSON.stringify({ error: 'contentUrl 是必填參數' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const validation = validateContentUrl(rawUrl)
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const sessionId = getClientSessionId(requestBody)
  const clientIp = getClientIp(request)

  const sessionLimit = checkRateLimit('session-fetch', sessionId, RATE_LIMIT_CONFIG.session)
  if (!sessionLimit.allowed) {
    return responseWithRateLimitError('URL 擷取次數已達上限，請稍後再試。', sessionLimit.retryAfter, corsHeaders)
  }

  const ipLimit = checkRateLimit('ip-fetch', clientIp, RATE_LIMIT_CONFIG.ip)
  if (!ipLimit.allowed) {
    return responseWithRateLimitError('URL 擷取次數已達上限，請稍後再試。', ipLimit.retryAfter, corsHeaders)
  }

  try {
    const { html, finalUrl } = await fetchUrlContent(validation.url, { fetch, signal: request.signal })
    const extracted = extractReadableContent(html, finalUrl)
    if (!extracted.plain.trim()) {
      throw new Error('擷取的頁面內容為空，請確認網址是否正確')
    }

    return new Response(
      JSON.stringify({
        ...extracted,
        finalUrl
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('抓取網址內容失敗:', error)
    return new Response(
      JSON.stringify({
        error: '擷取網址內容失敗',
        message: error.message
      }),
      {
        status: 422,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
}

async function handleAnalyzePost(context, corsHeaders) {
  console.log('=== 收到分析請求 ===')
  const { request, env } = context

  console.log('請求頭部:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2))

  try {
    console.log('開始解析請求體...')
    let requestBody
    try {
      requestBody = await request.json()
      console.log('請求體解析成功:', JSON.stringify({
        contentLength: requestBody.content?.length || 0,
        hasTargetKeywords: Array.isArray(requestBody.targetKeywords),
        targetKeywordLegacy: !!requestBody.targetKeyword,
        hasEmail: !!requestBody.email
      }, null, 2))
    } catch (e) {
      console.error('解析請求體失敗:', e)
      throw new Error('無效的 JSON 請求體')
    }

    // v5：如果提供 email，改用非同步模式
    if (requestBody.email && typeof requestBody.email === 'string' && requestBody.email.trim()) {
      console.log('偵測到 email，改用非同步模式')
      return await handleAsyncAnalysis(context, requestBody, corsHeaders)
    }

    const rawContentUrl = requestBody?.contentUrl || requestBody?.url
    const hasInlineContent = [
      requestBody?.content,
      requestBody?.contentPlain,
      requestBody?.contentHtml,
      requestBody?.contentMarkdown
    ].some(value => typeof value === 'string' && value.trim().length)

    if (rawContentUrl && !hasInlineContent) {
      const validation = validateContentUrl(rawContentUrl)
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const sessionId = getClientSessionId(requestBody)
      const clientIp = getClientIp(request)

      const sessionLimit = checkRateLimit('session-fetch', sessionId, RATE_LIMIT_CONFIG.session)
      if (!sessionLimit.allowed) {
        return responseWithRateLimitError('URL 擷取次數已達上限，請稍後再試。', sessionLimit.retryAfter, corsHeaders)
      }

      const ipLimit = checkRateLimit('ip-fetch', clientIp, RATE_LIMIT_CONFIG.ip)
      if (!ipLimit.allowed) {
        return responseWithRateLimitError('URL 擷取次數已達上限，請稍後再試。', ipLimit.retryAfter, corsHeaders)
      }

      try {
        const { html, finalUrl } = await fetchUrlContent(validation.url, { fetch, signal: request.signal })
        const extracted = extractReadableContent(html, finalUrl)
        if (!extracted.plain.trim()) {
          throw new Error('擷取的頁面內容為空，請確認網址是否正確')
        }

        requestBody.contentPlain = extracted.plain
        requestBody.contentHtml = extracted.html
        requestBody.contentMarkdown = extracted.markdown
        requestBody.contentFormatHint = 'html'
        requestBody.fetchedUrl = finalUrl
      } catch (error) {
        console.error('分析前擷取網址內容失敗:', error)
        return new Response(
          JSON.stringify({
            error: '擷取網址內容失敗',
            message: error.message
          }),
          {
            status: 422,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        )
      }
    }

    const contentVariants = normalizeContentVariants({
      contentPlain: requestBody.contentPlain,
      contentHtml: requestBody.contentHtml,
      contentMarkdown: requestBody.contentMarkdown,
      plain: requestBody.plain,
      html: requestBody.html,
      markdown: requestBody.markdown,
      content: requestBody.content,
      text: requestBody.text,
      hint: requestBody.contentFormatHint,
      rawHtml: requestBody.rawHtml
    })

    const normalizedContentVariants = {
      plain: contentVariants?.plain ?? '',
      html: contentVariants?.html ?? '',
      markdown: contentVariants?.markdown ?? '',
      hint: contentVariants?.hint ?? ''
    }

    if (normalizedContentVariants.hint !== 'html' || !normalizedContentVariants.html) {
      if (requestBody.contentUrl) {
        try {
          const extracted = await fetchAndExtractContent(requestBody.contentUrl)
          normalizedContentVariants.html = extracted.html || normalizedContentVariants.html || ''
          normalizedContentVariants.plain = extracted.plain || normalizedContentVariants.plain || ''
          normalizedContentVariants.hint = 'html'
        } catch (error) {
          console.warn('Failed to fetch content for URL hint recovery', error)
        }
      }
    }

    const chunkSourceText = deriveChunkSourceText(normalizedContentVariants)
    const chunkSourceFormat = guessChunkSourceFormat(normalizedContentVariants)

    console.log('請求體解析成功:', JSON.stringify({
      contentLengthLegacy: typeof requestBody.content === 'string' ? requestBody.content.length : 0,
      contentPlainLength: typeof normalizedContentVariants.plain === 'string' ? normalizedContentVariants.plain.length : 0,
      contentHtmlLength: typeof normalizedContentVariants.html === 'string' ? normalizedContentVariants.html.length : 0,
      contentMarkdownLength: typeof normalizedContentVariants.markdown === 'string' ? normalizedContentVariants.markdown.length : 0,
      contentFormatHint: normalizedContentVariants.hint,
      hasTargetKeywords: Array.isArray(requestBody.targetKeywords),
      targetKeywordLegacy: !!requestBody.targetKeyword
    }, null, 2))

    if (!normalizedContentVariants.plain.trim()) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const includeRecommendations = requestBody.includeRecommendations === true || requestBody.includeRecommendations === 'true'

    let targetKeywords = []
    if (Array.isArray(requestBody.targetKeywords)) {
      targetKeywords = requestBody.targetKeywords
    } else if (typeof requestBody.targetKeywords === 'string') {
      targetKeywords = requestBody.targetKeywords.split(/[\s,]+/)
    } else if (typeof requestBody.targetKeyword === 'string') {
      targetKeywords = requestBody.targetKeyword.split(/[\s,]+/)
    }
    targetKeywords = targetKeywords.map(k => String(k).trim()).filter(Boolean)

    if (targetKeywords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'targetKeywords 是必填，請輸入 1-5 個關鍵字' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (targetKeywords.length > 5) {
      return new Response(
        JSON.stringify({ error: '最多只允許 5 個關鍵字', received: targetKeywords.length }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('目標關鍵字:', targetKeywords)

    const returnChunks = Boolean(requestBody.returnChunks)

    let contentSignals
    try {
      // v5：支援 contentFormatHint 自動辨識 HTML vs 純文字
      const contentFormatHint = requestBody.contentFormatHint || 'auto'
      contentSignals = computeContentSignals({
        plain: normalizedContentVariants.plain,
        html: normalizedContentVariants.html,
        markdown: normalizedContentVariants.markdown,
        targetKeywords,
        sourceUrl: requestBody.fetchedUrl || requestBody.contentUrl || requestBody.url || null,
        contentFormatHint
      })
    } catch (error) {
      console.error('computeContentSignals 失敗', {
        errorMessage: error?.message,
        plainLength: normalizedContentVariants.plain?.length,
        htmlLength: normalizedContentVariants.html?.length,
        markdownLength: normalizedContentVariants.markdown?.length
      })
      throw new Error(`computeContentSignals failed: ${error.message}`)
    }

    const metadataKeys = ['hasMetaDescription', 'hasCanonical', 'hasAuthorInfo', 'hasPublisherInfo', 'hasPublishedDate', 'hasModifiedDate', 'hasVisibleDate']
    const schemaKeys = ['hasFaqSchema', 'hasHowToSchema', 'hasArticleSchema', 'hasOrganizationSchema']
    const isAllUnknown = (keys) => keys.every((key) => contentSignals[key] === 'unknown')
    const primarySignalsUnknown = isAllUnknown(metadataKeys) && isAllUnknown(schemaKeys)
    const hasHtmlContent = typeof normalizedContentVariants.html === 'string' && normalizedContentVariants.html.trim().length > 0

    if (primarySignalsUnknown && hasHtmlContent) {
      const responsePayload = {
        status: 'insufficient_metadata',
        message: '缺少 HTML metadata，請提供原始頁面再檢測。',
        contentSignals
      }

      return new Response(
        JSON.stringify(responsePayload),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const geminiApiKey = env.GEMINI_API_KEY
    const useGeminiMock = String(env?.USE_GEMINI_MOCK || '').toLowerCase() === 'true'
    console.log('GEMINI_API_KEY 長度:', geminiApiKey ? `${geminiApiKey.substring(0, 5)}...${geminiApiKey.substring(geminiApiKey.length - 3)}` : '未設置')

    if (!geminiApiKey && !useGeminiMock) {
      console.error('GEMINI_API_KEY is not set in environment variables，且未啟用模擬模式')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!geminiApiKey && useGeminiMock) {
      console.warn('GEMINI_API_KEY 缺失，但 USE_GEMINI_MOCK 為 true，將改用模擬分析結果')
    }

    console.log('開始處理分析請求...')
    let analysisResult
    try {
      analysisResult = await analyzeWithGemini(normalizedContentVariants.plain, targetKeywords, env, contentSignals)
      console.log('分析成功完成')
      analysisResult = coerceAnalysisResult(analysisResult)
      console.log('analysisResult 結構摘要:', {
        hasMetrics: Boolean(analysisResult?.metrics),
        seoMetricCount: Array.isArray(analysisResult?.metrics?.seo) ? analysisResult.metrics.seo.length : 0,
        aeoMetricCount: Array.isArray(analysisResult?.metrics?.aeo) ? analysisResult.metrics.aeo.length : 0,
        keys: Object.keys(analysisResult || {})
      })
    } catch (error) {
      console.error('分析過程中出錯:', error)
      const msg = String(error && error.message ? error.message : '')
      if (msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded')) {
        console.warn('偵測到模型過載/速率限制，改用模擬分析結果以維持體驗')
        const firstKeyword = Array.isArray(targetKeywords) && targetKeywords.length ? targetKeywords[0] : ''
        analysisResult = generateMockAnalysis(normalizedContentVariants.plain, firstKeyword)
        console.log('已改用模擬分析結果')
      } else {
        throw new Error(`分析失敗: ${error.message}`)
      }
    }

    let payload
    try {
      payload = normalizeAnalysisResult(analysisResult, contentSignals)
    } catch (error) {
      console.error('normalizeAnalysisResult 失敗', {
        errorMessage: error?.message,
        analysisResultKeys: Object.keys(analysisResult || {}),
        metricsPreview: {
          seo: Array.isArray(analysisResult?.metrics?.seo) ? analysisResult.metrics.seo.map((m) => m?.name) : 'none',
          aeo: Array.isArray(analysisResult?.metrics?.aeo) ? analysisResult.metrics.aeo.map((m) => m?.name) : 'none'
        }
      })
      throw new Error(`normalizeAnalysisResult failed: ${error.message}`)
    }

    let openAiAugmentation = null
    if (includeRecommendations) {
      const openaiKey = env.OPENAI_API_KEY || null
      if (openaiKey) {
        try {
          openAiAugmentation = await evaluateHelpfulContentWithOpenAI({
            content: normalizedContentVariants.plain,
            targetKeywords,
            payload,
            contentSignals,
            apiKey: openaiKey
          })
          payload = mergeAugmentedInsights(payload, openAiAugmentation)
        } catch (error) {
          console.error('OpenAI augmentation failed:', error)
        }
      }
    }

    try {
      payload = applyScoreGuards(payload, contentSignals, targetKeywords)
    } catch (error) {
      console.error('applyScoreGuards 失敗', {
        errorMessage: error?.message,
        payloadKeys: Object.keys(payload || {}),
        seoMetrics: Array.isArray(payload?.metrics?.seo) ? payload.metrics.seo.map((metric) => ({
          name: metric?.name,
          score: metric?.score
        })) : 'none',
        aeoMetrics: Array.isArray(payload?.metrics?.aeo) ? payload.metrics.aeo.map((metric) => ({
          name: metric?.name,
          score: metric?.score
        })) : 'none'
      })
      throw new Error(`applyScoreGuards failed: ${error.message}`)
    }
    const seoPredictions = payload?.scoreGuards?.seoPredictions || null
    const aeoPredictions = payload?.scoreGuards?.aeoPredictions || null
    const modelContext = payload?.scoreGuards?.modelContext || null

    if (includeRecommendations) {
      if (payload.metrics?.seo && openAiAugmentation?.metrics?.seo) {
        payload.metrics.seo = blendMetricArrays(payload.metrics.seo, openAiAugmentation.metrics.seo)
      }
      if (payload.metrics?.aeo && openAiAugmentation?.metrics?.aeo) {
        payload.metrics.aeo = blendMetricArrays(payload.metrics.aeo, openAiAugmentation.metrics.aeo)
      }

      if (openAiAugmentation?.highRiskFlags?.length) {
        payload.highRiskFlags = mergeUniqueFlags(payload.highRiskFlags || [], openAiAugmentation.highRiskFlags.map(normalizeHighRiskFlag))
      }
      if (openAiAugmentation?.eeatBreakdown) {
        payload.eeatBreakdown = normalizeEeatBreakdown(openAiAugmentation.eeatBreakdown)
      }

      const modelRecommendations = generateModelRecommendations(seoPredictions, aeoPredictions, modelContext, payload.metrics)
      const heuristicRecommendations = generateHeuristicRecommendations(payload, contentSignals)
      const combinedRecommendations = mergeRecommendations(modelRecommendations, heuristicRecommendations)

      if (!Array.isArray(payload.recommendations) || payload.recommendations.length === 0) {
        payload.recommendations = combinedRecommendations
      } else {
        payload.recommendations = mergeRecommendations(payload.recommendations, combinedRecommendations)
      }
      payload.recommendationsStatus = 'ready'
    } else {
      payload.recommendations = []
      payload.recommendationsStatus = 'not_requested'
    }

    // v5：計算結構分與策略分
    const structureScoreResult = calculateStructureScore(contentSignals, contentSignals.contentFormatHint || 'plain')
    const strategyScoreResult = analysisResult?.strategyAnalysis ? {
      why: analysisResult.strategyAnalysis.why?.score || 5,
      how: analysisResult.strategyAnalysis.how?.score || 5,
      what: analysisResult.strategyAnalysis.what?.score || 5,
      overallScore: analysisResult.overallStrategicScore || 50
    } : {
      why: 5, how: 5, what: 5, overallScore: 50
    }
    
    // 計算總分：40% 結構分 + 60% 策略分
    const v5Score = Math.round(
      (structureScoreResult.score * 0.4) + 
      (strategyScoreResult.overallScore * 10 * 0.6)
    )

    if (returnChunks && chunkSourceText) {
      const chunks = chunkContent(chunkSourceText, {
        format: chunkSourceFormat,
        html: normalizedContentVariants.html,
        markdown: normalizedContentVariants.markdown,
        plain: normalizedContentVariants.plain
      })
      payload = { ...payload, chunks, chunkSourceFormat }
    }

    if (requestBody.fetchedUrl) {
      payload = { ...payload, sourceUrl: requestBody.fetchedUrl }
    }

    payload = { ...payload, contentSignals }
    payload = { ...payload, includeRecommendations }
    
    // 新增 v5 評分結果
    payload = { 
      ...payload, 
      v5Scores: {
        structureScore: structureScoreResult.score,
        strategyScore: strategyScoreResult.overallScore,
        overallScore: v5Score,
        breakdown: {
          structure: structureScoreResult.breakdown,
          strategy: strategyScoreResult
        },
        recommendations: structureScoreResult.recommendations
      }
    }

    return new Response(
      JSON.stringify(payload),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error processing request:', error)
    const errorResponse = {
      error: 'Failed to process request',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      details: {
        name: error.name,
        ...(error.response?.status && { status: error.response.status }),
        ...(error.response?.statusText && { statusText: error.response.statusText }),
        ...(error.config && {
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers
        })
      }
    }

    console.error('Error details:', JSON.stringify(errorResponse, null, 2))

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
}

// OpenAI GPT-4 Analysis
async function analyzeWithOpenAI(content, targetKeyword, apiKey) {
  const prompt = buildAnalysisPrompt(content, targetKeyword);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO and AEO content analyst. Analyze content and provide structured feedback in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  
  return result;
}

function coerceAnalysisResult(result, depth = 0) {
  if (!result || typeof result !== 'object') return result;
  if (depth > 2) return result;

  const hasCoreFields =
    typeof result.overallScore === 'number' ||
    typeof result.aeoScore === 'number' ||
    typeof result.seoScore === 'number' ||
    (result.metrics && typeof result.metrics === 'object' && (result.metrics.aeo || result.metrics.seo));

  if (hasCoreFields) {
    return result;
  }

  const rawTextCandidates = [];

  if (typeof result.rawText === 'string') {
    rawTextCandidates.push(result.rawText);
  }

  if (result.rawResponse && typeof result.rawResponse === 'object') {
    const candidateText = extractTextFromRawResponse(result.rawResponse);
    if (candidateText) {
      rawTextCandidates.push(candidateText);
    }
  }

  for (const candidate of rawTextCandidates) {
    const cleaned = stripMarkdownFences(candidate);
    if (!cleaned) continue;
    const parsed = tryParseJson(cleaned);
    if (parsed) {
      const coerced = coerceAnalysisResult(parsed, depth + 1);
      if (coerced !== parsed) {
        return coerced;
      }
      return parsed;
    }
  }

  return { ...result };
}

function extractTextFromRawResponse(rawResponse) {
  try {
    const candidates = rawResponse?.candidates;
    if (!Array.isArray(candidates) || !candidates.length) return null;
    const parts = candidates[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const textPart = parts.find((part) => typeof part.text === 'string');
    return textPart?.text ?? null;
  } catch (error) {
    console.error('extractTextFromRawResponse failed', error);
    return null;
  }
}

/**
 * 萃取關鍵段落供 AI 策略分析
 * 返回首段、末段、以及含經驗/佐證訊號的段落
 */
function extractKeyPassages(content, contentSignals = {}) {
  if (!content || typeof content !== 'string') {
    return { firstParagraph: '', lastParagraph: '', evidenceParagraphs: [] }
  }

  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0)
  if (paragraphs.length === 0) {
    return { firstParagraph: '', lastParagraph: '', evidenceParagraphs: [] }
  }

  const firstParagraph = paragraphs[0].trim()
  const lastParagraph = paragraphs[paragraphs.length - 1].trim()

  // 尋找含經驗/佐證訊號的段落
  const evidenceParagraphs = []
  const experienceCueCount = contentSignals.experienceCueCount || 0
  const evidenceCount = contentSignals.evidenceCountNorm || 0

  if (experienceCueCount > 0 || evidenceCount > 0.3) {
    // 簡單啟發式：尋找包含「案例」、「例如」、「根據」、「研究」等關鍵詞的段落
    const keywords = ['案例', '例如', '根據', '研究', '數據', '發現', '證實', '表明', '實驗', '測試', '驗證', '證明']
    for (let i = 1; i < paragraphs.length - 1; i++) {
      const para = paragraphs[i].trim()
      if (keywords.some(kw => para.includes(kw)) && para.length > 50) {
        evidenceParagraphs.push(para)
        if (evidenceParagraphs.length >= 3) break
      }
    }
  }

  return { firstParagraph, lastParagraph, evidenceParagraphs }
}

// Build the v5 analysis prompt with WHY / HOW / WHAT strategy framework
function buildAnalysisPrompt(content, targetKeywords, contentSignals = {}) {
  const keywordsList = Array.isArray(targetKeywords) ? targetKeywords.filter(Boolean).join(', ') : ''
  const passages = extractKeyPassages(content, contentSignals)
  
  // 組合關鍵段落供 AI 評估
  const keyPassagesText = [
    passages.firstParagraph ? `【首段】\n${passages.firstParagraph}` : '',
    passages.lastParagraph ? `【末段】\n${passages.lastParagraph}` : '',
    passages.evidenceParagraphs.length > 0 ? `【佐證段落】\n${passages.evidenceParagraphs.join('\n\n')}` : ''
  ].filter(Boolean).join('\n\n')

  return `你是一位內容策略師，專門評估文章是否能被 AI 搜尋引擎引用與信任。

目標關鍵字：${keywordsList}

【待評估的關鍵段落】
${keyPassagesText}

【評估框架：WHY / HOW / WHAT】

請根據以下三個維度對上述段落進行質化評分（各 1-10 分）：

1. **Problem Definition (WHY)** - 文章是否清楚描繪讀者的痛點與問題背景？
   - 評分標準：是否開篇即交代「為什麼讀者需要這篇文章」？
   - 高分特徵：具體指出讀者面臨的挑戰、痛點或疑問。
   - 低分特徵：直接進入解決方案，缺乏問題鋪陳。

2. **Implication (HOW)** - 文章是否解釋解決方案的原理與步驟？
   - 評分標準：是否提供「如何」執行或理解的具體指引？
   - 高分特徵：分步驟說明、提供實務建議、舉例說明。
   - 低分特徵：僅列舉結論，缺乏執行細節或原理說明。

3. **Solution Fit (WHAT)** - 文章的解決方案是否切實回應初始問題？
   - 評分標準：是否清楚總結「解決方案是什麼」及其價值？
   - 高分特徵：結尾明確總結方案、強調其對讀者的實際幫助。
   - 低分特徵：解決方案模糊、與問題脫節、缺乏結論。

【輸出格式】
請以 JSON 格式回傳：
{
  "strategyScores": {
    "why": 整數(1-10),
    "how": 整數(1-10),
    "what": 整數(1-10)
  },
  "strategyAnalysis": {
    "why": { "score": 整數(1-10), "explanation": "...", "evidence": "..." },
    "how": { "score": 整數(1-10), "explanation": "...", "evidence": "..." },
    "what": { "score": 整數(1-10), "explanation": "...", "evidence": "..." }
  },
  "overallStrategicScore": 整數(1-10),
  "recommendations": [
    { "dimension": "WHY|HOW|WHAT", "priority": "high|medium|low", "suggestion": "..." }
  ]
}

【重要提醒】
- 僅依據提供的段落進行評估，不要臆測全文內容。
- 若段落不足以評估某一維度，請在 explanation 中明確標註「段落不足」。
- 嚴禁輸出 Markdown 圍欄或額外文字，僅回傳合法 JSON。`;
}

const HTML_ENGINEERING_KEYWORDS = [
  '<meta',
  '<head',
  'canonical',
  'schema',
  'faq schema',
  'structured data',
  'json-ld',
  'open graph',
  'meta ',
  'meta·',
  'robots',
  'sitemap',
  'og:'
]

function containsHtmlEngineering(text = '') {
  if (typeof text !== 'string') return false
  const lower = text.trim().toLowerCase()
  if (!lower) return false
  return HTML_ENGINEERING_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function derivePrimaryPlainContent(variants) {
  const plain = coerceString(variants?.plain || '').trim();
  if (plain) return normalizeWhitespace(plain);

  const markdown = coerceString(variants?.markdown || '').trim();
  if (markdown) return normalizeWhitespace(markdownToPlain(markdown));

  const html = coerceString(variants?.html || '').trim();
  if (html) return normalizeWhitespace(htmlToStructuredText(html));

  return '';
}

function deriveChunkSourceText(variants) {
  if (!variants) return '';
  const hint = variants.hint;
  const html = coerceString(variants.html || '').trim();
  const markdown = coerceString(variants.markdown || '').trim();
  const plain = coerceString(variants.plain || '').trim();

  if (hint === 'html' && html) return normalizeWhitespace(htmlToStructuredText(html));
  if (hint === 'markdown' && markdown) return normalizeWhitespace(markdownToStructuredText(markdown));
  if (html && !plain && !markdown) return normalizeWhitespace(htmlToStructuredText(html));
  if (markdown && !plain) return normalizeWhitespace(markdownToStructuredText(markdown));

  return normalizeWhitespace(plain || markdownToStructuredText(markdown) || htmlToStructuredText(html));
}

function guessChunkSourceFormat(variants) {
  if (!variants) return 'plain';
  if (variants.hint === 'html' || variants.hint === 'markdown' || variants.hint === 'plain') {
    if (variants.hint === 'html' && !coerceString(variants.html).trim()) return 'plain';
    if (variants.hint === 'markdown' && !coerceString(variants.markdown).trim()) return 'plain';
    return variants.hint;
  }
  if (coerceString(variants.html).trim()) return 'html';
  if (coerceString(variants.markdown).trim()) return 'markdown';
  return 'plain';
}

function computeContentSignals({ plain = '', html = '', markdown = '', targetKeywords = [], sourceUrl = null, contentFormatHint = 'auto' }) {
  // v5 版本：支援 contentFormatHint 自動辨識 HTML vs 純文字
  // contentFormatHint: 'html' | 'plain' | 'auto'（預設自動判斷）
  
  // 自動判斷內容格式
  let detectedFormat = contentFormatHint
  if (contentFormatHint === 'auto') {
    const hasHtmlTags = html && /<[a-z][^>]*>/i.test(html)
    const hasHeadTag = html && /<head[^>]*>/i.test(html)
    detectedFormat = (hasHtmlTags || hasHeadTag) ? 'html' : 'plain'
  }
  
  const signal = {
    // 基本訊號
    contentFormatHint: detectedFormat,
    hasHtml: Boolean(html && html.trim()),
    hasMarkdown: Boolean(markdown && markdown.trim()),
    hasPlain: Boolean(plain && plain.trim()),
    
    // 技術性訊號（Mode A HTML 時計算，Mode B 時標記 unknown）
    hasFaqSchema: false,
    hasHowToSchema: false,
    hasArticleSchema: false,
    hasOrganizationSchema: false,
    hasAuthorInfo: false,
    hasPublisherInfo: false,
    hasPublishedDate: false,
    hasModifiedDate: false,
    hasVisibleDate: false,
    hasMetaDescription: false,
    hasUniqueTitle: false,
    hasCanonical: false,
    
    // 內容訊號（兩種模式都計算）
    h1Count: 0,
    h1ContainsKeyword: false,
    h2Count: 0,
    h2WithKeywordCount: 0,
    paragraphAverageLength: 0,
    listCount: 0,
    tableCount: 0,
    imageCount: 0,
    imageWithAltCount: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    externalAuthorityLinkCount: 0,
    paragraphCount: 0,
    longParagraphCount: 0,
    wordCount: 0,
    sentenceCount: 0,
    avgSentenceLength: 0,
    uniqueWordRatio: 0,
    actionableStepCount: 0,
    hasNumberedSteps: false,
    hasChecklistLanguage: false,
    actionableScore: 0,
    evidenceCount: 0,
    recentYearCount: 0,
    referenceKeywordCount: 0,
    experienceCueCount: 0,
    hasFirstPersonNarrative: false,
    caseStudyCount: 0,
    titleIntentMatch: 0,
    sourceUrl,
    keywordSample: targetKeywords.slice(0, 5)
  }

  const sourceHtml = html || ''
  const hasHtml = Boolean(sourceHtml.trim())
  const hasHeadTag = hasHtml && /<head[^>]*>/i.test(sourceHtml)
  const metadataInspectable = hasHtml && hasHeadTag
  const schemaInspectable = hasHtml
  const unknownSignals = new Set()

  const markUnknown = (key) => {
    signal[key] = 'unknown'
    unknownSignals.add(key)
  }

  const setKnownBoolean = (key, value) => {
    signal[key] = Boolean(value)
    unknownSignals.delete(key)
    return signal[key]
  }

  const ensureKnownFalse = (key) => setKnownBoolean(key, false)

  const htmlPlainFallback = hasHtml ? htmlToStructuredText(sourceHtml) : ''

  const paragraphSegments = []
  let primaryH1 = ''

  const metadataFields = ['hasUniqueTitle', 'hasMetaDescription', 'hasCanonical']
  const entityFields = ['hasAuthorInfo', 'hasPublisherInfo', 'hasPublishedDate', 'hasModifiedDate', 'hasVisibleDate']
  const schemaFields = ['hasFaqSchema', 'hasHowToSchema', 'hasArticleSchema', 'hasOrganizationSchema']

  metadataFields.forEach((key) => {
    if (metadataInspectable) {
      ensureKnownFalse(key)
    } else {
      markUnknown(key)
    }
  })

  entityFields.forEach((key) => {
    if (hasHtml) {
      ensureKnownFalse(key)
    } else {
      markUnknown(key)
    }
  })

  schemaFields.forEach((key) => {
    if (schemaInspectable) {
      ensureKnownFalse(key)
    } else {
      markUnknown(key)
    }
  })

  try {
    // 簡化版：使用正則表達式而非 DOM 解析以避免超時
    // 完整版應在後端計算
    
    if (hasHtml) {
      // 快速檢查基本標籤
      if (metadataInspectable) {
        setKnownBoolean('hasUniqueTitle', /<title[^>]*>(.{1,}?)<\/title>/i.test(sourceHtml))
        setKnownBoolean('hasMetaDescription', /name=["']description["']\s+content=["'](.{30,}?)["']/i.test(sourceHtml))
        setKnownBoolean('hasCanonical', /rel=["']canonical["']/i.test(sourceHtml))
      }

      const authorMatches = /<(?:meta|span|div)[^>]*(?:name|itemprop|class|id)=["'](?:author|byline|writer)["'][^>]*>(.*?)<\//gi
      setKnownBoolean('hasAuthorInfo', authorMatches.test(sourceHtml))

      const publisherMatches = /<(?:meta|span|div)[^>]*(?:name|itemprop|class|id)=["'](?:publisher|organization|brand)["'][^>]*>/gi
      setKnownBoolean('hasPublisherInfo', publisherMatches.test(sourceHtml))

      if (signal.hasPublishedDate !== 'unknown') {
        setKnownBoolean('hasPublishedDate', /(?:datePublished|pubdate|published_time)["']?\s*[:=]\s*["']?\d{4}/i.test(sourceHtml))
      } else {
        setKnownBoolean('hasPublishedDate', /(?:datePublished|pubdate|published_time)["']?\s*[:=]\s*["']?\d{4}/i.test(sourceHtml))
      }
      if (signal.hasModifiedDate !== 'unknown') {
        setKnownBoolean('hasModifiedDate', /(?:dateModified|updated_time|modified_time)["']?\s*[:=]\s*["']?\d{4}/i.test(sourceHtml))
      } else {
        setKnownBoolean('hasModifiedDate', /(?:dateModified|updated_time|modified_time)["']?\s*[:=]\s*["']?\d{4}/i.test(sourceHtml))
      }

      // 計數基本標籤
      const h1Matches = sourceHtml.match(/<h1[^>]*>(.*?)<\/h1>/gi) || []
      signal.h1Count = h1Matches.length
      if (h1Matches.length && !primaryH1) {
        primaryH1 = stripHtmlTags(h1Matches[0]).trim()
      }
      if (!signal.h1ContainsKeyword && primaryH1 && targetKeywords.length) {
        const h1Lower = primaryH1.toLowerCase()
        signal.h1ContainsKeyword = targetKeywords.some((kw) => kw && h1Lower.includes(String(kw).toLowerCase()))
      }

      const h2Matches = sourceHtml.match(/<h2[^>]*>/gi) || []
      signal.h2Count = h2Matches.length
      
      signal.listCount = ((sourceHtml.match(/<ul[^>]*>/gi) || []).length + (sourceHtml.match(/<ol[^>]*>/gi) || []).length)
      signal.tableCount = (sourceHtml.match(/<table[^>]*>/gi) || []).length
      signal.imageCount = (sourceHtml.match(/<img[^>]*>/gi) || []).length
      
      // 檢查 Schema
      if (schemaInspectable) {
        const schemaMatches = sourceHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
        for (const match of schemaMatches) {
          try {
            const jsonStr = match.replace(/<script[^>]*>|<\/script>/gi, '')
            const json = JSON.parse(jsonStr)
            const types = Array.isArray(json['@type']) ? json['@type'] : [json['@type'] || '']
            types.forEach((type) => {
              const value = typeof type === 'string' ? type : ''
              if (!value) return
              const normalized = value.toLowerCase()
              if (normalized.includes('article') || normalized.includes('blogposting')) {
                setKnownBoolean('hasArticleSchema', true)
              }
              if (normalized.includes('faqpage')) {
                setKnownBoolean('hasFaqSchema', true)
              }
              if (normalized.includes('howto')) {
                setKnownBoolean('hasHowToSchema', true)
              }
              if (normalized.includes('organization')) {
                setKnownBoolean('hasOrganizationSchema', true)
              }
            })
          } catch (e) {
            // 忽略解析錯誤
          }
        }
      }

      // 檢查日期
      setKnownBoolean(
        'hasVisibleDate',
        /\d{4}[年\/-]/.test(sourceHtml) ||
          /(?:發佈|發布|更新)[^\n]*\d{4}[年\/-]\d{1,2}[月\/-]\d{1,2}/.test(sourceHtml)
      )
    }

    // 使用 plain text 計算字數和句子
    if (plain && plain.trim()) {
      const words = plain.split(/\s+/).filter(w => w.length > 0)
      signal.wordCount = words.length
      
      const sentences = plain.split(/[。！？\n]+/).filter(s => s.trim().length > 0)
      signal.sentenceCount = sentences.length
      signal.avgSentenceLength = sentences.length > 0 ? Math.round(signal.wordCount / sentences.length) : 0
      
      const uniqueWords = new Set(words.map(w => w.toLowerCase()))
      signal.uniqueWordRatio = uniqueWords.size > 0 ? (uniqueWords.size / words.length).toFixed(2) : 0
    }

    // 檢查關鍵字
    if (plain && targetKeywords.length > 0) {
      const plainLower = plain.toLowerCase()
      for (const kw of targetKeywords) {
        if (kw && plainLower.includes(kw.toLowerCase())) {
          signal.h1ContainsKeyword = true
          signal.referenceKeywordCount += 1
        }
      }
    }

    if (false) {
      // 保留原始 DOM 解析邏輯以備後用（已禁用）
      const anchors = []
      anchors.forEach((a) => {
        const href = (a.getAttribute('href') || '').trim()
        if (!href || href.startsWith('#')) return
        try {
          const url = new URL(href, signal.sourceUrl || 'https://example.com')
          if (url.hostname && signal.sourceUrl && new URL(signal.sourceUrl).hostname === url.hostname) {
            signal.internalLinkCount += 1
          } else {
            signal.externalLinkCount += 1
            if (/\.(gov|edu)$/i.test(url.hostname) || /^(www\.)?(nyt|bbc|forbes|bloomberg|reuters|statista|mckinsey)\./i.test(url.hostname)) {
              signal.externalAuthorityLinkCount += 1
            }
          }
        } catch (error) {}
      })
    }

    const plainCandidate = typeof plain === 'string' ? plain : ''
    const plainHasText = plainCandidate.trim().length > 0
    const htmlHasText = htmlPlainFallback.trim().length > 0

    if (plainHasText) {
      const normalized = harmonizeParagraphBreaks(plainCandidate)
      paragraphSegments.push(...normalized
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean))
    }

    if (!paragraphSegments.length && htmlHasText) {
      const normalizedHtml = harmonizeParagraphBreaks(htmlPlainFallback)
      paragraphSegments.push(...normalizedHtml
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean))
    }

    if (paragraphSegments.length) {
      signal.paragraphCount = paragraphSegments.length
      const totalLength = paragraphSegments.reduce((sum, paragraph) => sum + paragraph.length, 0)
      signal.paragraphAverageLength = Math.round(totalLength / paragraphSegments.length)
      signal.longParagraphCount = paragraphSegments.filter((paragraph) => paragraph.length > 380).length
    }

    const listSource = plainHasText ? plainCandidate : htmlPlainFallback
    if (signal.listCount === 0 && listSource.trim()) {
      const bulletMatches = listSource.match(/^\s*(?:[-*+]|[0-9]{1,2}[\.)]|[一二三四五六七八九十]{1,3}[、．.])\s+/gm) || []
      signal.listCount = bulletMatches.length ? Math.max(1, Math.round(bulletMatches.length / 2)) : signal.listCount
    }

    const tableSource = plainHasText ? plainCandidate : htmlPlainFallback
    if (signal.tableCount === 0 && tableSource.trim()) {
      const tableMatches = tableSource.match(/\|[^\n]+\|/g) || []
      signal.tableCount = tableMatches.length ? Math.max(1, Math.round(tableMatches.length / 4)) : signal.tableCount
    }

    if (plainHasText || htmlHasText) {
      const headingSource = plainHasText ? plainCandidate : htmlPlainFallback
      if (signal.h1Count === 0) {
        const h1Matches = headingSource.match(/^#\s+.+/gm) || []
        signal.h1Count = h1Matches.length
        if (h1Matches.length) {
          const firstHeading = h1Matches[0].replace(/^#\s+/, '').trim()
          if (!primaryH1) {
            primaryH1 = firstHeading
          }
          if (!signal.h1ContainsKeyword && targetKeywords.length) {
            signal.h1ContainsKeyword = targetKeywords.some((kw) => kw && firstHeading.includes(kw))
          }
        }
        if (!h1Matches.length) {
          const firstLine = paragraphSegments[0] || headingSource
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line.length > 0)
          if (firstLine) {
            signal.h1Count = 1
            if (!primaryH1) primaryH1 = firstLine
            if (!signal.h1ContainsKeyword && targetKeywords.length) {
              signal.h1ContainsKeyword = targetKeywords.some((kw) => kw && firstLine.includes(kw))
            }
          }
        }
      }

      if (signal.h2Count === 0) {
        const markdownH2 = headingSource.match(/^##\s+.+/gm) || []
        const enumeratedH2 = headingSource.match(/^[一二三四五六七八九十]{1,3}[、．.]+\s*.+/gm) || []
        const h2Texts = []
        markdownH2.forEach((heading) => {
          const text = heading.replace(/^##\s+/, '').trim()
          if (text) h2Texts.push(text)
        })
        enumeratedH2.forEach((heading) => {
          const text = heading.replace(/^[一二三四五六七八九十]{1,3}[、．.]+\s*/, '').trim()
          if (text) h2Texts.push(text)
        })
        signal.h2Count = h2Texts.length
        signal.h2WithKeywordCount = h2Texts.reduce((count, text) => {
          return count + (targetKeywords.some((kw) => kw && text.includes(kw)) ? 1 : 0)
        }, 0)
      }
    }

    const plainTextSource = normalizeWhitespace(firstNonEmpty(
      plain,
      paragraphSegments.join('\n'),
      htmlPlainFallback,
      markdown
    ))
    const sentences = extractSentences(plainTextSource)
    const words = extractWords(plainTextSource)
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()))
    signal.wordCount = words.length
    signal.sentenceCount = sentences.length
    signal.avgSentenceLength = sentences.length ? Math.round(plainTextSource.length / sentences.length) : plainTextSource.length
    signal.uniqueWordRatio = signal.wordCount ? Number((uniqueWords.size / signal.wordCount).toFixed(3)) : 0

    const actionablePatterns = [/(?:步驟|操作指引|行動計畫|清單)/g, /checklist/gi, /step\s*\d+/gi, /how\s*to/gi, /guide/gi]
    const actionableMatches = actionablePatterns.reduce((acc, pattern) => {
      const match = plainTextSource.match(pattern)
      return acc + (match ? match.length : 0)
    }, 0)
    const numberedMatches = plainTextSource.match(/(?:^|\n)\s*(?:第[一二三四五六七八九十]|[0-9]{1,2}[\.)])\s+/g) || []
    signal.hasChecklistLanguage = actionableMatches > 0
    signal.hasNumberedSteps = numberedMatches.length > 0
    signal.actionableStepCount = numberedMatches.length + signal.listCount
    signal.actionableScore = [signal.listCount > 0, signal.hasChecklistLanguage, signal.hasNumberedSteps].filter(Boolean).length

    const yearMatches = plainTextSource.match(/\b(20\d{2}|19\d{2})\b/g) || []
    signal.recentYearCount = yearMatches.filter((year) => Number(year) >= 2020).length
    const referencePatterns = [/根據/g, /研究/g, /調查/g, /報告/g, /數據顯示/g, /參考/g, /according to/gi, /study/gi, /source/gi]
    signal.referenceKeywordCount = referencePatterns.reduce((acc, pattern) => acc + (pattern.test(plainTextSource) ? 1 : 0), 0)
    referencePatterns.forEach((pattern) => pattern.lastIndex = 0)
    signal.evidenceCount = yearMatches.length + signal.referenceKeywordCount

    const firstPersonPatterns = [/\bwe\b/gi, /\bour\b/gi, /\bmy\b/gi, /我們/g, /我[們在曾有]/g]
    signal.hasFirstPersonNarrative = firstPersonPatterns.some((pattern) => pattern.test(plainTextSource))
    firstPersonPatterns.forEach((pattern) => pattern.lastIndex = 0)
    const experiencePatterns = [/案例/g, /實作/g, /體驗/g, /經驗/g, /客戶/g, /成功案例/g, /case study/gi, /testimonial/gi]
    signal.experienceCueCount = experiencePatterns.reduce((acc, pattern) => acc + (plainTextSource.match(pattern)?.length || 0), 0)
    signal.caseStudyCount = plainTextSource.match(/案例|case study/gi)?.length || 0

    const titleKeywords = extractKeywordSet(primaryH1)
    const bodyLead = paragraphSegments.slice(0, 3).join(' ') || plainTextSource.slice(0, 600)
    const bodyKeywords = extractKeywordSet(bodyLead)
    if (titleKeywords.size > 0 && bodyKeywords.size > 0) {
      let overlap = 0
      titleKeywords.forEach((keyword) => {
        if (bodyKeywords.has(keyword)) overlap += 1
      })
      signal.titleIntentMatch = Number((overlap / titleKeywords.size).toFixed(2))
    }
    if (signal.hasVisibleDate === 'unknown' && /\d{4}[年\/-]\d{1,2}[月\/-]?\d{0,2}/.test(plainTextSource)) {
      setKnownBoolean('hasVisibleDate', true)
    }
  } catch (error) {
    console.error('computeContentSignals failed', error)
  }

  signal.unknownSignals = Array.from(unknownSignals)
  signal.inspectability = {
    metadata: metadataInspectable ? 'available' : 'unavailable',
    schema: schemaInspectable ? 'available' : 'unavailable',
    rawHtmlProvided: hasHtml
  }

  return signal
}

function serializeContentSignals(signals = {}) {
  try {
    const pick = (keys = []) =>
      keys.reduce((acc, key) => {
        if (signals[key] !== undefined) acc[key] = signals[key]
        return acc
      }, {})

    const summary = {
      basics: pick(['wordCount', 'wordCountNorm', 'paragraphCount', 'paragraphCountNorm', 'avgSentenceLengthNorm']),
      helpfulRatio: pick(['hcuYesRatio', 'hcuPartialRatio', 'hcuNoRatio', 'hcuContentHelpfulness']),
      intentFit: pick(['titleIntentMatch', 'firstParagraphAnswerQuality', 'qaFormatScore']),
      depthCoverage: pick(['topicCohesion', 'semanticParagraphFocus', 'referenceKeywordNorm']),
      actionability: pick(['actionableScoreNorm', 'actionableStepCount']),
      readability: pick(['longParagraphPenalty', 'paragraphExtractability', 'semanticNaturalness', 'readerCueCount']),
      structureHighlights: pick(['listCount', 'tableCount', 'hasKeyTakeaways', 'summaryCueCount']),
      trustSignals: pick(['authorMentionCount', 'brandMentionCount', 'evidenceCountNorm', 'externalCitationCount', 'experienceCueNorm', 'caseStudyCount', 'expertTermDensity', 'comparisonCueCount']),
      freshness: pick(['recentYearCount', 'hasVisibleDate']),
      keywordCoverage: {
        targetKeywords: Array.isArray(signals.targetKeywords) ? signals.targetKeywords : undefined,
        referenceKeywordCount: signals.referenceKeywordCount
      },
      unknownSignals: Array.isArray(signals.unknownSignals) ? signals.unknownSignals : undefined
    }

    Object.keys(summary).forEach((key) => {
      if (summary[key] === undefined) {
        delete summary[key]
        return
      }
      if (summary[key] && typeof summary[key] === 'object' && !Array.isArray(summary[key]) && !Object.keys(summary[key]).length) {
        delete summary[key]
      }
    })

    return JSON.stringify(summary, null, 2)
  } catch (error) {
    console.error('serializeContentSignals failed', error)
    return '{}'
  }
}

function normalizeHcuAnswer(answer) {
  if (typeof answer !== 'string') return 'no'
  const normalized = answer.trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'y') return 'yes'
  if (normalized === 'partial' || normalized === 'maybe' || normalized === 'partially') return 'partial'
  return 'no'
}

function constrainLength(text, maxLength) {
  if (typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}…`
}

function buildContentQualityFlags(contentSignals = {}) {
  const isUnknown = (value) => value === 'unknown'
  const wordCount = Number(contentSignals.wordCount || 0)
  const paragraphCount = Number(contentSignals.paragraphCount || 0)
  const actionableScore = Number(contentSignals.actionableScore || 0)
  const actionableStepCount = Number(contentSignals.actionableStepCount || 0)
  const evidenceCount = Number(contentSignals.evidenceCount || 0)
  const externalAuthorityLinkCount = Number(contentSignals.externalAuthorityLinkCount || 0)
  const recentYearCount = Number(contentSignals.recentYearCount || 0)
  const experienceCueCount = Number(contentSignals.experienceCueCount || 0)
  const hasFirstPersonNarrative = contentSignals.hasFirstPersonNarrative === 'unknown' ? false : Boolean(contentSignals.hasFirstPersonNarrative)
  const titleIntentMatch = Number(contentSignals.titleIntentMatch || 0)
  const h1ContainsKeyword = isUnknown(contentSignals.h1ContainsKeyword) ? null : contentSignals.h1ContainsKeyword
  const longParagraphCount = Number(contentSignals.longParagraphCount || 0)
  const avgSentenceLength = Number(contentSignals.avgSentenceLength || 0)
  const uniqueWordRatio = Number(contentSignals.uniqueWordRatio || 0)
  const paragraphAverageLength = Number(contentSignals.paragraphAverageLength || 0)

  const depthLow = wordCount < 450 || paragraphCount < 4
  const depthVeryLow = (wordCount < 260 && paragraphCount < 2) || paragraphCount === 0

  return {
    wordCount,
    paragraphCount,
    depthLow,
    depthVeryLow,
    actionableWeak: actionableScore === 0 && actionableStepCount < 1,
    actionableZero: actionableStepCount === 0 && actionableScore === 0,
    evidenceWeak: evidenceCount < 1 && externalAuthorityLinkCount === 0,
    evidenceNone: evidenceCount === 0 && externalAuthorityLinkCount === 0,
    freshnessWeak: recentYearCount === 0 && !contentSignals.hasPublishedDate && !contentSignals.hasModifiedDate,
    experienceWeak: experienceCueCount === 0 && !hasFirstPersonNarrative,
    titleMismatch: titleIntentMatch < 0.3 || h1ContainsKeyword === false,
    readabilityWeak:
      longParagraphCount > Math.max(2, Math.floor(paragraphCount * 0.45)) ||
      avgSentenceLength > 140 ||
      paragraphAverageLength > 520,
    uniqueWordLow: uniqueWordRatio < 0.2,
    actionableScore,
    actionableStepCount,
    evidenceCount,
    externalAuthorityLinkCount,
    recentYearCount,
    experienceCueCount,
    titleIntentMatch,
    uniqueWordRatio
  }
}

function normalizeHcuReview(review, fallbackMap = null) {
  const answered = new Map()
  if (Array.isArray(review)) {
    review.forEach((item) => {
      if (item && typeof item.id === 'string') {
        answered.set(item.id, {
          id: item.id,
          answer: normalizeHcuAnswer(item.answer),
          explanation: constrainLength(typeof item.explanation === 'string' ? item.explanation : '', 120)
        })
      }
    })
  }

  const fallback = fallbackMap instanceof Map ? fallbackMap : new Map()

  return HCU_QUESTION_SET.map((question) => {
    if (answered.has(question.id)) return answered.get(question.id)
    if (fallback.has(question.id)) return fallback.get(question.id)
    return {
      id: question.id,
      answer: 'partial',
      explanation: '系統預設：尚待人工補充說明。'
    }
  })
}

function deriveFallbackMetricScore(metricName, scope, context = {}) {
  const signals = context.contentSignals || {}
  const num = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const clamp0to10 = (value) => {
    if (!Number.isFinite(value)) return null
    return Math.max(0, Math.min(10, value))
  }

  const seoNameMap = {
    'Helpful Ratio': 'helpfulRatio',
    '內容意圖契合': 'intentFit',
    '搜尋意圖契合': 'intentFit',
    '內容覆蓋與深度': 'depthCoverage',
    '延伸疑問與關鍵字覆蓋': 'intentExpansion',
    '行動可行性': 'actionability',
    '可讀性與敘事節奏': 'readabilityRhythm',
    '可讀性與敘事流暢': 'readabilityRhythm',
    '結構化重點提示': 'structureHighlights',
    '作者與品牌辨識': 'authorBrandSignals',
    '可信證據與引用': 'evidenceSupport',
    '洞察與證據支持': 'evidenceSupport',
    '第一手經驗與案例': 'experienceSignals',
    '敘事具體度與資訊密度': 'narrativeDensity',
    '時效與更新訊號': 'freshnessSignals',
    '專家觀點與判斷': 'expertPerspective'
  }

  const aeoNameMap = {
    '答案可抽取性': 'extractability',
    '答案精準度': 'extractability',
    '關鍵摘要與重點整理': 'keySummary',
    '精選摘要適配': 'keySummary',
    '對話式語氣與指引': 'conversationalGuidance',
    '敘事可信度': 'conversationalGuidance',
    '讀者互動與後續引導': 'readerActivation'
  }

  const resolveName = (name, map) => {
    if (typeof name !== 'string') return name
    return map[name.trim()] || name.trim()
  }

  // HCU 指標
  if (scope === 'seo') {
    const normalized = resolveName(metricName, seoNameMap)
    switch (normalized) {
      case 'helpfulRatio': {
        const yes = num(signals.hcuYesRatio)
        const partial = num(signals.hcuPartialRatio)
        const no = num(signals.hcuNoRatio)
        if (!yes && !partial && !no) return null
        return clamp0to10(10 * (yes + 0.5 * partial - no * 0.6))
      }
      case 'intentFit': {
        const intent = num(signals.titleIntentMatch)
        const first = num(signals.firstParagraphAnswerQuality)
        const qa = num(signals.qaFormatScore)
        const bonus = (intent >= 0.8 && first >= 0.8) ? 2 : (intent >= 0.7 && first >= 0.7) ? 1 : 0
        return clamp0to10((intent * 4 + first * 4 + qa * 2) + bonus)
      }
      case 'depthCoverage': {
        const word = Math.min(1, num(signals.wordCount) / 2000)
        const cohesion = num(signals.topicCohesion)
        const focus = num(signals.semanticParagraphFocus)
        return clamp0to10(word * 4 + cohesion * 3 + focus * 3)
      }
      case 'intentExpansion': {
        const ref = Math.min(1, num(signals.referenceKeywordCount) / 5)
        const qa = num(signals.qaFormatScore)
        return clamp0to10(ref * 6 + qa * 2)
      }
      case 'actionability': {
        const actionable = num(signals.actionableScoreNorm)
        const steps = Math.min(1, num(signals.actionableStepCount) / 10)
        return clamp0to10(actionable * 6 + steps * 4)
      }
      case 'readabilityRhythm': {
        const sentence = Math.min(1, num(signals.avgSentenceLength) / 25)
        const longPenalty = Math.min(1, num(signals.longParagraphCount) / Math.max(2, Math.floor(num(signals.paragraphCount) * 0.5)))
        return clamp0to10((1 - sentence) * 6 + (1 - longPenalty) * 4)
      }
      case 'structureHighlights': {
        const list = Math.min(1, num(signals.listCount) / 5)
        const table = Math.min(1, num(signals.tableCount) / 3)
        return clamp0to10(list * 6 + table * 4)
      }
      case 'authorBrandSignals': {
        const author = Math.min(1, num(signals.authorMentionCount) / 10)
        const brand = Math.min(1, num(signals.brandMentionCount) / 10)
        return clamp0to10(author * 6 + brand * 4)
      }
      case 'evidenceSupport': {
        const evidence = Math.min(1, num(signals.evidenceCount) / 8)
        const citation = Math.min(1, num(signals.externalCitationCount) / 10)
        return clamp0to10(evidence * 6 + citation * 4)
      }
      case 'experienceSignals': {
        const experience = Math.min(1, num(signals.experienceCueCount) / 5)
        const cases = Math.min(1, num(signals.caseStudyCount) / 3)
        return clamp0to10(experience * 7 + cases * 3)
      }
      case 'narrativeDensity': {
        const unique = num(signals.uniqueWordRatio)
        const entity = Math.min(1, num(signals.entityRichnessCount) / 15)
        return clamp0to10(unique * 5 + entity * 5)
      }
      case 'freshnessSignals': {
        const years = Math.min(1, num(signals.recentYearCount) / 3)
        const visible = signals.hasVisibleDate ? 1 : 0
        return clamp0to10(years * 7 + visible * 3)
      }
      case 'expertPerspective': {
        const expert = num(signals.expertTermDensity)
        const comparison = Math.min(1, num(signals.comparisonCueCount) / 3)
        return clamp0to10(expert * 6 + comparison * 4)
      }
      default:
        return null
    }
  }

  // AEO 指標
  if (scope === 'aeo') {
    const normalized = resolveName(metricName, aeoNameMap)
    switch (normalized) {
      case 'extractability': {
        const extractability = num(signals.paragraphExtractability)
        const longPenalty = Math.min(1, num(signals.longParagraphCount) / Math.max(2, Math.floor(num(signals.paragraphCount) * 0.5)))
        return clamp0to10(extractability * 7 + (1 - longPenalty) * 3)
      }
      case 'keySummary': {
        const takeaways = signals.hasKeyTakeaways ? 1 : 0
        const summary = Math.min(1, num(signals.summaryCueCount) / 3)
        const intro = num(signals.firstParagraphAnswerQuality)
        return clamp0to10(takeaways * 4 + summary * 3 + intro * 3)
      }
      case 'conversationalGuidance': {
        const natural = num(signals.semanticNaturalness)
        const reader = Math.min(1, num(signals.readerCueCount) / 5)
        return clamp0to10(natural * 6 + reader * 4)
      }
      case 'readerActivation': {
        const cta = Math.min(1, num(signals.ctaCueCount) / 3)
        const question = Math.min(1, num(signals.questionCueCount) / 5)
        return clamp0to10(cta * 6 + question * 4)
      }
      default:
        return null
    }
  }

  return null
}

function deriveMissingCriticalSignals(contentSignals = {}) {
  const isUnknown = (value) => value === 'unknown'
  const toBoolean = (value) => Boolean(value) && !isUnknown(value)
  const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

  return {
    faq: !toBoolean(contentSignals.hasFaqSchema) && !isUnknown(contentSignals.hasFaqSchema),
    howto: !toBoolean(contentSignals.hasHowToSchema) && !isUnknown(contentSignals.hasHowToSchema),
    article: !toBoolean(contentSignals.hasArticleSchema) && !isUnknown(contentSignals.hasArticleSchema),
    organization: !toBoolean(contentSignals.hasOrganizationSchema) && !isUnknown(contentSignals.hasOrganizationSchema),
    author: !toBoolean(contentSignals.hasAuthorInfo) && !isUnknown(contentSignals.hasAuthorInfo),
    publisher: !toBoolean(contentSignals.hasPublisherInfo) && !isUnknown(contentSignals.hasPublisherInfo),
    publishedDate: !toBoolean(contentSignals.hasPublishedDate) && !isUnknown(contentSignals.hasPublishedDate),
    modifiedDate: !toBoolean(contentSignals.hasModifiedDate) && !isUnknown(contentSignals.hasModifiedDate),
    visibleDate: !toBoolean(contentSignals.hasVisibleDate) && !isUnknown(contentSignals.hasVisibleDate),
    metaDescription: !toBoolean(contentSignals.hasMetaDescription) && !isUnknown(contentSignals.hasMetaDescription),
    canonical: !toBoolean(contentSignals.hasCanonical) && !isUnknown(contentSignals.hasCanonical),
    h1Keyword: !toBoolean(contentSignals.h1ContainsKeyword) && !isUnknown(contentSignals.h1ContainsKeyword),
    h1Count: toNumber(contentSignals.h1Count) !== 1,
    h2Coverage: toNumber(contentSignals.h2Count) < 2,
    paragraphsLong: toNumber(contentSignals.paragraphAverageLength) > 420,
    listMissing: toNumber(contentSignals.listCount) === 0,
    tableMissing: toNumber(contentSignals.tableCount) === 0,
    imageAltMissing: toNumber(contentSignals.imageCount) > 0 && toNumber(contentSignals.imageWithAltCount) < toNumber(contentSignals.imageCount),
    externalLinksMissing: toNumber(contentSignals.externalLinkCount) < 1,
    authorityLinksMissing: toNumber(contentSignals.externalAuthorityLinkCount) < 1
  }
}

function applyScoreGuards(payload, contentSignals = {}, targetKeywords = []) {
  if (!payload || typeof payload !== 'object') return payload || {}
  const clone = structuredClone ? structuredClone(payload) : JSON.parse(JSON.stringify(payload))

  if (clone.metrics?.aeo) {
    clone.metrics.aeo = clone.metrics.aeo.map((metric) => sanitizeMetricEntry(metric))
  }
  if (clone.metrics?.seo) {
    clone.metrics.seo = clone.metrics.seo.map((metric) => sanitizeSeoMetricEntry(metric))
  }

  const hcuAnswerMap = new Map()
  const hcuCounts = { yes: 0, partial: 0, no: 0 }
  if (Array.isArray(clone.hcuReview)) {
    clone.hcuReview.forEach(({ id, answer }) => {
      if (!id) return
      const normalized = normalizeHcuAnswer(answer)
      hcuAnswerMap.set(id, normalized)
      if (normalized in hcuCounts) {
        hcuCounts[normalized] += 1
      }
    })
  } else {
    clone.hcuReview = []
  }

  const applyHcuCaps = (score, metricName, scope) => {
    const rule = HCU_METRIC_RULES.find((item) => item.metric === metricName && item.scope === scope)
    if (!rule) return score
    const answers = rule.questions.map((qid) => hcuAnswerMap.get(qid) || 'no')
    if (answers.includes('no') && rule.caps?.no !== undefined) {
      return Math.min(score, rule.caps.no)
    }
    if (answers.includes('partial') && rule.caps?.partial !== undefined) {
      return Math.min(score, rule.caps.partial)
    }
    return score
  }

  const missingCritical = deriveMissingCriticalSignals(contentSignals)

  const contentQualityFlags = buildContentQualityFlags(contentSignals)
  const fallbackContext = {
    hcuAnswerMap,
    missingCritical,
    contentQualityFlags,
    contentSignals: contentSignals || {},
    hcuCounts
  }

  const modelContext = {
    contentSignals: contentSignals || {},
    contentQualityFlags,
    missingCritical,
    hcuCounts
  }

  const modelReady = isScoringModelReady()
  const aeoPredictions = modelReady ? predictAeoMetricScores(modelContext) : null
  const seoPredictions = modelReady ? predictSeoMetricScores(modelContext) : null

  if (Array.isArray(clone.metrics?.aeo)) {
    clone.metrics.aeo = clone.metrics.aeo.map((metric) => {
      const guarded = { ...metric }
      const prediction = aeoPredictions?.get(metric.name)
      if (prediction) {
        guarded.score = clampScore(prediction.score)
        guarded.modelVersion = prediction.modelVersion
        guarded.modelRawScore = prediction.rawScore
        guarded.modelContributions = prediction.contributions
      } else {
        if (!Number.isFinite(guarded.score)) {
          const fallbackScore = deriveFallbackMetricScore(metric.name, 'aeo', fallbackContext)
          if (Number.isFinite(fallbackScore)) {
            guarded.score = fallbackScore
          }
        }

        if (Number.isFinite(guarded.score)) {
          if (metric.name === '答案可抽取性') {
            if (missingCritical.h2Coverage || missingCritical.paragraphsLong) guarded.score = Math.min(guarded.score, 6)
            if (contentQualityFlags.readabilityWeak) guarded.score = Math.min(guarded.score, 6)
          }
          if (metric.name === '關鍵摘要與重點整理') {
            if (missingCritical.listMissing) guarded.score = Math.min(guarded.score, 6)
            if (contentQualityFlags.titleMismatch) guarded.score = Math.min(guarded.score, 6)
            if (missingCritical.h2Coverage) guarded.score = Math.min(guarded.score, 6)
          }
          if (metric.name === '對話式語氣與指引') {
            if (contentQualityFlags.semanticToneFormal) guarded.score = Math.min(guarded.score, 6)
            if (contentQualityFlags.readabilityWeak) guarded.score = Math.min(guarded.score, 5)
          }
          if (metric.name === '讀者互動與後續引導') {
            if (contentQualityFlags.actionableWeak) guarded.score = Math.min(guarded.score, 5)
            if (missingCritical.ctaMissing) guarded.score = Math.min(guarded.score, 4)
          }
          guarded.score = applyHcuCaps(guarded.score, metric.name, 'aeo')
          guarded.score = clampScore(guarded.score)
        } else {
          guarded.score = null
        }
      }
      return guarded
    })
  }

  if (Array.isArray(clone.metrics?.seo)) {
    clone.metrics.seo = clone.metrics.seo.map((metric) => {
      const guarded = { ...metric }
      const prediction = seoPredictions?.get(metric.name)
      if (prediction) {
        guarded.score = clampScore(prediction.score)
        guarded.modelVersion = prediction.modelVersion
        guarded.modelRawScore = prediction.rawScore
        guarded.modelContributions = prediction.contributions
      } else {
        const fallbackScore = deriveFallbackMetricScore(metric.name, 'seo', fallbackContext)
        if (!Number.isFinite(guarded.score)) {
          if (Number.isFinite(fallbackScore)) {
            guarded.score = fallbackScore
          }
        } else if (Number.isFinite(fallbackScore) && guarded.score < fallbackScore) {
          guarded.score = fallbackScore
        }

        const lower = (maxScore) => {
          if (Number.isFinite(guarded.score)) {
            guarded.score = Math.min(guarded.score, maxScore)
          }
        }
        switch (metric.name) {
          case 'Helpful Ratio': {
            if (hcuCounts.no >= 1) lower(6)
            if (contentQualityFlags.hcuInconsistent) lower(7)
            break
          }
          case '搜尋意圖契合': {
            if (missingCritical.h1Count || missingCritical.h1Keyword) lower(5)
            if (contentQualityFlags.titleMismatch) lower(6)
            break
          }
          case '內容覆蓋與深度': {
            if (contentQualityFlags.depthLow) lower(6)
            if (missingCritical.paragraphsShort) lower(6)
            break
          }
          case '延伸疑問與關鍵字覆蓋': {
            if (contentQualityFlags.intentNarrow) lower(6)
            break
          }
          case '行動可行性': {
            if (contentQualityFlags.actionableWeak) lower(5)
            if (missingCritical.ctaMissing) lower(5)
            break
          }
          case '可讀性與敘事節奏': {
            if (missingCritical.listMissing) lower(6)
            if (missingCritical.tableMissing) lower(6)
            if (missingCritical.paragraphsLong) lower(5)
            if (contentQualityFlags.readabilityWeak) lower(4)
            break
          }
          case '結構化重點提示': {
            if (missingCritical.listMissing && missingCritical.tableMissing) lower(4)
            break
          }
          case '作者與品牌辨識': {
            if (missingCritical.author) lower(4)
            if (missingCritical.publisher) lower(4)
            break
          }
          case '可信證據與引用': {
            if (missingCritical.externalLinksMissing) lower(5)
            if (contentQualityFlags.evidenceWeak) lower(5)
            break
          }
          case '第一手經驗與案例': {
            if (contentQualityFlags.experienceWeak) lower(5)
            break
          }
          case '敘事具體度與資訊密度': {
            if (contentQualityFlags.uniqueWordLow) lower(6)
            if (contentQualityFlags.semanticDrift) lower(6)
            break
          }
          case '時效與更新訊號': {
            if (contentQualityFlags.freshnessWeak) lower(6)
            break
          }
          case '專家觀點與判斷': {
            if (contentQualityFlags.expertVoiceWeak) lower(6)
            break
          }
          default:
            break
        }
        if (Number.isFinite(guarded.score)) {
          guarded.score = applyHcuCaps(guarded.score, metric.name, 'seo')
          guarded.score = clampScore(guarded.score)
        } else {
          guarded.score = null
        }
      }
      return guarded
    })
  }

  const aeoScore = computeAverageScore(clone.metrics?.aeo || [])
  const seoScore = computeWeightedScore(clone.metrics?.seo || [])

  if (Number.isFinite(aeoScore)) clone.aeoScore = aeoScore
  if (Number.isFinite(seoScore)) clone.seoScore = seoScore

  clone.overallScore = recomputeOverallScore(clone)

  const overallCaps = []
  if (hcuCounts.no >= 3) {
    overallCaps.push(35)
  } else if (hcuCounts.no >= 2) {
    overallCaps.push(45)
  } else if (hcuCounts.no >= 1) {
    overallCaps.push(55)
  } else if (hcuCounts.partial >= 3) {
    overallCaps.push(65)
  }

  if (contentQualityFlags.depthVeryLow) overallCaps.push(40)
  else if (contentQualityFlags.depthLow) overallCaps.push(55)
  if (contentQualityFlags.actionableWeak) overallCaps.push(60)
  if (contentQualityFlags.evidenceWeak) overallCaps.push(60)
  if (contentQualityFlags.experienceWeak) overallCaps.push(65)
  if (contentQualityFlags.titleMismatch) overallCaps.push(65)
  if (contentQualityFlags.readabilityWeak) overallCaps.push(70)

  if (overallCaps.length) {
    clone.overallScore = Math.min(clone.overallScore, ...overallCaps)
  }

  if (hcuCounts.no >= 3) {
    clone.overallScore = Math.min(clone.overallScore, 35)
  } else if (hcuCounts.no >= 2) {
    clone.overallScore = Math.min(clone.overallScore, 45)
  } else if (hcuCounts.no >= 1) {
    clone.overallScore = Math.min(clone.overallScore, 55)
  } else if (hcuCounts.partial >= 3) {
    clone.overallScore = Math.min(clone.overallScore, 65)
  }

  clone.scoreGuards = {
    missingCritical,
    hcuCounts,
    contentQualityFlags,
    eeatBreakdown: clone.eeatBreakdown || null,
    highRiskFlags: Array.isArray(clone.highRiskFlags) ? clone.highRiskFlags : [],
    appliedAt: new Date().toISOString(),
    seoPredictions,
    aeoPredictions,
    modelContext
  }

  return clone
}

function recomputeOverallScore(result) {
  const aeoScore = Number.isFinite(result.aeoScore) ? result.aeoScore : null
  const seoScore = Number.isFinite(result.seoScore) ? result.seoScore : null
  if (aeoScore === null && seoScore === null) return 0
  const base = (
    (aeoScore !== null ? aeoScore * 0.45 : 0) +
    (seoScore !== null ? seoScore * 0.55 : 0)
  )
  const raw = Math.round(base)
  if (result.highRiskFlags && Array.isArray(result.highRiskFlags) && result.highRiskFlags.some((flag) => flag?.severity === 'critical')) {
    return Math.min(raw, 40)
  }
  return raw
}

// 結構化 chunking 輔助工具（參考 chunkr 階層式分段概念）
function chunkContent(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const normalized = text.replace(/\r\n/g, '\n');
  const config = {
    targetTokens: clampPositiveInteger(options.targetTokens, 520),
    maxTokens: clampPositiveInteger(options.maxTokens, 680),
    minTokens: clampPositiveInteger(options.minTokens, 140),
    overlapTokens: clampNonNegativeInteger(options.overlapTokens, 80),
    includeLeadingContext: options.includeLeadingContext !== false,
    maxChunks: clampPositiveInteger(options.maxChunks, 500)
  };
  const sourceFormat = typeof options.format === 'string' ? options.format : 'plain';

  if (config.maxTokens < config.targetTokens) {
    config.maxTokens = config.targetTokens + 40;
  }
  if (config.minTokens > config.targetTokens) {
    config.minTokens = Math.max(60, Math.floor(config.targetTokens * 0.4));
  }

  const segments = segmentContent(normalized, config);
  if (!segments.length) {
    const fallbackText = normalized.trim();
    return fallbackText
      ? [
          {
            id: 1,
            start: 0,
            end: fallbackText.length,
            text: fallbackText,
            tokens: estimateTokens(fallbackText),
            segmentCount: 1,
            headings: [],
            leadingContext: '',
            sourceFormat
          }
        ]
      : [];
  }

  const blueprints = buildChunkBlueprints(segments, config).slice(0, config.maxChunks);
  return finalizeChunks(blueprints, normalized, config, sourceFormat);
}

function clampPositiveInteger(value, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isFinite(num) && num > 0) return num;
  return fallback;
}

function clampNonNegativeInteger(value, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
}

function segmentContent(text, config) {
  const segments = [];
  const lines = text.split('\n');
  let lineStart = 0;
  let bufferLines = [];
  let bufferStart = 0;
  let bufferEnd = 0;
  let bufferType = null;
  let bufferHeadingLevel = null;
  let inCodeFence = false;

  const flushBuffer = () => {
    if (!bufferLines.length) return;
    const segment = createSegmentFromRange(
      text,
      bufferStart,
      bufferEnd,
      bufferType || 'paragraph',
      bufferHeadingLevel
    );
    appendSegment(segment, segments, config);
    bufferLines = [];
    bufferType = null;
    bufferHeadingLevel = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const nextCharIndex = lineStart + rawLine.length;
    const hasTrailingNewline = text[nextCharIndex] === '\n' ? 1 : 0;
    const lineEndWithNewline = nextCharIndex + hasTrailingNewline;

    if (inCodeFence) {
      if (!bufferLines.length) {
        bufferStart = lineStart;
      }
      bufferLines.push(rawLine);
      bufferEnd = lineEndWithNewline;
      if (trimmed.startsWith('```')) {
        inCodeFence = false;
        flushBuffer();
      }
      lineStart = lineEndWithNewline;
      continue;
    }

    if (!trimmed.length) {
      flushBuffer();
      lineStart = lineEndWithNewline;
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushBuffer();
      inCodeFence = true;
      bufferStart = lineStart;
      bufferLines = [rawLine];
      bufferEnd = lineEndWithNewline;
      bufferType = 'code';
      lineStart = lineEndWithNewline;
      continue;
    }

    const classification = classifyLine(trimmed);

    if (classification.type === 'heading') {
      flushBuffer();
      const headingSegment = createSegmentFromRange(
        text,
        lineStart,
        lineEndWithNewline,
        'heading',
        classification.headingLevel
      );
      appendSegment(headingSegment, segments, config);
      lineStart = lineEndWithNewline;
      continue;
    }

    if (classification.type === 'image' || classification.type === 'caption') {
      flushBuffer();
      const singleSegment = createSegmentFromRange(
        text,
        lineStart,
        lineEndWithNewline,
        classification.type,
        null
      );
      appendSegment(singleSegment, segments, config);
      lineStart = lineEndWithNewline;
      continue;
    }

    if (classification.type === 'table' || classification.type === 'list' || classification.type === 'quote') {
      if (!bufferLines.length) {
        bufferStart = lineStart;
        bufferType = classification.type;
      }
      bufferHeadingLevel = bufferHeadingLevel ?? classification.headingLevel ?? null;
      bufferLines.push(rawLine);
      bufferEnd = lineEndWithNewline;
      lineStart = lineEndWithNewline;
      continue;
    }

    // Default paragraph
    if (!bufferLines.length) {
      bufferStart = lineStart;
      bufferType = 'paragraph';
    }
    bufferHeadingLevel = null;
    bufferLines.push(rawLine);
    bufferEnd = lineEndWithNewline;
    lineStart = lineEndWithNewline;
  }

  flushBuffer();
  return segments;
}

function appendSegment(segment, segments, config) {
  if (segment.tokens <= config.maxTokens) {
    segments.push(segment);
    return;
  }

  const pieces = splitLargeSegment(segment, config.maxTokens);
  for (const piece of pieces) {
    segments.push(piece);
  }
}

function createSegmentFromRange(text, start, end, type, headingLevel = null) {
  const raw = text.slice(start, end);
  const trimmed = raw.trim();
  return {
    type,
    headingLevel,
    raw,
    text: trimmed,
    start,
    end,
    tokens: estimateTokens(trimmed),
    isCaption: type === 'caption'
  };
}

function classifyLine(line) {
  if (!line) return { type: 'paragraph', headingLevel: null };

  if (/^#{1,6}\s+/.test(line)) {
    const level = line.match(/^#{1,6}/)[0].length;
    return { type: 'heading', headingLevel: level };
  }

  if (/^(?:[IVXLC]+\.)(?:\d+\.)*\s+/.test(line)) {
    const depth = line.split('.')[0]?.length ?? 1;
    return { type: 'heading', headingLevel: Math.min(6, depth + 1) };
  }

  if (/^\d+(?:\.\d+)+\s+\S/.test(line)) {
    const depth = line.split(' ')[0].split('.').length;
    return { type: 'heading', headingLevel: Math.min(6, depth) };
  }

  if (/^(\*|-|\+|\u2022|\d+[\.\)])\s+/.test(line)) {
    return { type: 'list', headingLevel: null };
  }

  if (/^>\s+/.test(line)) {
    return { type: 'quote', headingLevel: null };
  }

  if (/^\|.+\|\s*$/.test(line) || /^\s*\+-[-+]+\+\s*$/.test(line)) {
    return { type: 'table', headingLevel: null };
  }

  if (/^!\[.*\]\(.*\)/.test(line) || /<img\s.+?>/.test(line)) {
    return { type: 'image', headingLevel: null };
  }

  if (/^(?:Figure|圖|表|圖表|圖片|照片)\s*\d+[:：.\-）\)]/i.test(line)) {
    return { type: 'caption', headingLevel: null };
  }

  if (/^[A-Z0-9][A-Z0-9\s\-:]{2,}$/.test(line) && line.length <= 80) {
    return { type: 'heading', headingLevel: 2 };
  }

  return { type: 'paragraph', headingLevel: null };
}

function splitLargeSegment(segment, maxTokens) {
  const approxChars = Math.max(80, Math.floor(maxTokens * 4));
  const parts = [];
  const text = segment.raw || segment.text || '';
  const relativeStart = segment.start;
  const totalLength = text.length;
  let cursor = 0;

  while (cursor < totalLength) {
    let sliceEnd = Math.min(cursor + approxChars, totalLength);
    if (sliceEnd < totalLength) {
      const searchWindow = text.slice(sliceEnd, Math.min(sliceEnd + 120, totalLength));
      const sentenceBreak = searchWindow.search(/[\.。！？!?\n]/u);
      if (sentenceBreak !== -1) {
        sliceEnd += sentenceBreak + 1;
      }
    }

    const partText = text.slice(cursor, sliceEnd);
    const absoluteStart = relativeStart + cursor;
    const absoluteEnd = relativeStart + sliceEnd;
    const cleanPart = partText.trim();

    parts.push({
      type: segment.type,
      headingLevel: segment.headingLevel,
      raw: partText,
      text: cleanPart,
      start: absoluteStart,
      end: absoluteEnd,
      tokens: estimateTokens(cleanPart),
      isCaption: segment.isCaption
    });

    cursor = sliceEnd;
  }

  return parts;
}

function buildChunkBlueprints(segments, config) {
  const blueprints = [];
  let currentSegments = [];
  let currentTokens = 0;
  let i = 0;

  const pushCurrent = () => {
    if (!currentSegments.length) return;
    blueprints.push({
      segments: currentSegments,
      tokens: currentTokens
    });
    currentSegments = [];
    currentTokens = 0;
  };

  while (i < segments.length) {
    let segment = segments[i];

    if (segment.type === 'heading') {
      pushCurrent();
      currentSegments.push(segment);
      currentTokens = Math.max(1, segment.tokens);
      i += 1;
      continue;
    }

    let bundle = [segment];
    let bundleTokens = Math.max(1, segment.tokens);

    if (shouldPairWithNext(segment, segments[i + 1])) {
      const partner = segments[i + 1];
      bundle.push(partner);
      bundleTokens += Math.max(1, partner.tokens);
      i += 1;
    }

    if (currentTokens && currentTokens + bundleTokens > config.maxTokens) {
      pushCurrent();
    }

    for (const item of bundle) {
      currentSegments.push(item);
      currentTokens += Math.max(1, item.tokens);
    }

    const next = segments[i + 1];
    const reachedTarget = currentTokens >= config.targetTokens;
    const nextWouldOverflow = next && currentTokens + Math.max(1, next.tokens) > config.maxTokens;
    const nextIsHeading = next && next.type === 'heading';

    if (
      nextIsHeading ||
      nextWouldOverflow ||
      (reachedTarget && (!next || currentTokens >= config.targetTokens))
    ) {
      pushCurrent();
    }

    i += 1;
  }

  pushCurrent();
  return blueprints;
}

function shouldPairWithNext(current, next) {
  if (!next) return false;
  const assetTypes = new Set(['image', 'table']);
  if (assetTypes.has(current.type) && next.type === 'caption') return true;
  if (current.type === 'caption' && assetTypes.has(next.type)) return true;
  return false;
}

function finalizeChunks(blueprints, text, config, sourceFormat) {
  const chunks = [];
  const approxCharsPerToken = 4;
  const overlapChars = config.overlapTokens * approxCharsPerToken;
  let previousTail = '';

  for (const blueprint of blueprints) {
    if (!blueprint.segments || !blueprint.segments.length) continue;
    const start = Math.max(0, blueprint.segments[0].start);
    const end = Math.min(text.length, blueprint.segments[blueprint.segments.length - 1].end);
    const chunkRaw = text.slice(start, end);
    const cleaned = chunkRaw.trim();
    if (!cleaned) continue;

    const headings = collectHeadings(blueprint.segments);
    const leadingContext = config.includeLeadingContext
      ? buildLeadingContext(previousTail, headings)
      : '';
    const tokens = Math.max(1, estimateTokens(cleaned));

    chunks.push({
      id: chunks.length + 1,
      start,
      end,
      text: cleaned,
      tokens,
      segmentCount: blueprint.segments.length,
      headings,
      leadingContext,
      sourceFormat
    });

    const tail = cleaned.slice(-Math.max(overlapChars, 160));
    previousTail = tail.trimStart();
  }

  return chunks;
}

function collectHeadings(segments) {
  const headings = [];
  for (const segment of segments) {
    if (segment.type === 'heading' && segment.text) {
      headings.push(segment.text);
    }
  }
  return headings;
}

function buildLeadingContext(previousTail, headings) {
  const context = [];
  if (headings.length) {
    context.push(headings.slice(-3).join(' > '));
  }
  if (previousTail) {
    context.push(previousTail);
  }
  return context.join('\n').trim();
}

function estimateTokens(text) {
  if (typeof text !== 'string') return 0;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 0;
  const words = cleaned.split(' ');
  const avgWordLength = cleaned.length / words.length;
  const approx = Math.ceil((words.length + cleaned.length / 4) / 2);
  return Math.max(1, Math.ceil(approx * Math.max(0.7, Math.min(1.3, 4 / Math.max(1, avgWordLength)))));
}

// Mock analysis for testing without API key
function generateMockAnalysis(content, targetKeyword) {
  const wordCount = content.trim().split(/\s+/).length;
  const hasKeyword = targetKeyword && content.includes(targetKeyword);
  
  return {
    overallScore: 75,
    aeoScore: 78,
    seoScore: 72,
    metrics: {
      aeo: [
        {
          name: '答案精準度',
          score: 8,
          description: '開頭直接回覆問題並提供明確結論'
        },
        {
          name: '精選摘要適配',
          score: 7,
          description: '段落結構清楚，但仍可追加一步驟摘要'
        },
        {
          name: '敘事可信度',
          score: 7,
          description: '語氣可信且提供部分引用，可再補強案例'
        }
      ],
      seo: [
        {
          name: '內容意圖契合',
          weight: 34,
          score: hasKeyword ? 7 : 6,
          description: hasKeyword ? '內容緊扣關鍵字需求並給出操作建議' : '尚未針對目標關鍵字整理專屬指引',
          evidence: [hasKeyword ? '首段回覆「如何執行」流程' : '缺少與關鍵字對應的案例']
        },
        {
          name: '洞察與證據支持',
          weight: 33,
          score: wordCount > 500 ? 7 : 6,
          description: wordCount > 500 ? '引用 1 筆 2024 年資料並附案例' : '需補充外部引用或數據佐證',
          evidence: [wordCount > 500 ? '第四段提及 2024 年統計數據' : '全文缺乏來源引用']
        },
        {
          name: '可讀性與敘事流暢',
          weight: 33,
          score: 8,
          description: '段落分明、句子平均 30 字內，易於掃讀',
          evidence: ['使用項目符號與小標清楚結構']
        }
      ]
    },
    recommendations: [
      {
        priority: 'high',
        category: 'SEO',
        title: '優化關鍵字密度',
        description: targetKeyword 
          ? `目標關鍵字「${targetKeyword}」在文中出現次數可以增加，建議在標題和結論處自然融入。`
          : '建議設定目標關鍵字並在文章中適當分佈。',
        example: '在文章開頭、中間和結尾各出現 1-2 次'
      },
      {
        priority: 'medium',
        category: 'AEO',
        title: '增強段落獨立性',
        description: '確保每個段落都能獨立表達一個完整的概念，方便 AI 提取和理解。',
        example: '每段開頭用主題句明確說明該段重點'
      },
      {
        priority: 'medium',
        category: 'AEO',
        title: '添加數據支持',
        description: '在關鍵論點處加入具體數據、統計資料或研究結果，提升內容可信度。',
        example: '「根據 2024 年研究顯示，使用此方法可提升 35% 的效率」'
      },
      {
        priority: 'low',
        category: 'E-E-A-T',
        title: '補強權威訊號',
        description: '補充專家引言或連結至可信賴來源，提升 E-E-A-T 評分。',
        example: '引用政府或學術機構資料作為補充說明'
      }
    ],
    highRiskFlags: []
  };
}

function normalizeAnalysisResult(result, contentSignals = {}) {
  if (!result || typeof result !== 'object') return result;

  if (!result.metrics || typeof result.metrics !== 'object') {
    result.metrics = {};
  }

  result.metrics.aeo = ensureMetricShape(result.metrics.aeo, AEO_METRIC_DEFAULTS, 'aeo');
  result.metrics.seo = ensureMetricShape(result.metrics.seo, SEO_METRIC_DEFAULTS, 'seo');

  const computedAeo = computeAverageScore(result.metrics.aeo);
  const weightedSeo = computeWeightedScore(result.metrics.seo);
  const averageSeo = weightedSeo !== null ? weightedSeo : computeAverageScore(result.metrics.seo);

  if (!Number.isFinite(result.aeoScore) && computedAeo !== null) {
    result.aeoScore = computedAeo;
  }

  if (!Number.isFinite(result.seoScore) && averageSeo !== null) {
    result.seoScore = averageSeo;
  }

  const contentFlags = buildContentQualityFlags(contentSignals)
  const missingCritical = deriveMissingCriticalSignals(contentSignals)
  const fallbackHcuAnswers = buildFallbackHcuAnswers(contentSignals, contentFlags, missingCritical)
  result.hcuReview = normalizeHcuReview(result.hcuReview, fallbackHcuAnswers)

  result.recommendations = Array.isArray(result.recommendations)
    ? result.recommendations.filter((item) => item && typeof item === 'object')
    : [];

  result.highRiskFlags = Array.isArray(result.highRiskFlags)
    ? result.highRiskFlags.map((flag) => ({
        type: typeof flag?.type === 'string' ? flag.type : 'safety',
        severity: typeof flag?.severity === 'string' ? flag.severity : 'warning',
        summary: typeof flag?.summary === 'string' ? flag.summary : '',
        action: typeof flag?.action === 'string' ? flag.action : ''
      }))
    : [];

  if (!Number.isFinite(result.overallScore)) {
    if (Number.isFinite(result.aeoScore) && Number.isFinite(result.seoScore)) {
      result.overallScore = Math.round(result.aeoScore * 0.45 + result.seoScore * 0.55);
    } else if (Number.isFinite(result.seoScore)) {
      result.overallScore = Math.round(result.seoScore);
    } else if (Number.isFinite(result.aeoScore)) {
      result.overallScore = Math.round(result.aeoScore);
    }
  }

  return result;
}

function sanitizeMetricEntry(metric) {
  const rawScore = metric?.score;
  const hasFiniteScore = Number.isFinite(Number(rawScore));
  const score = hasFiniteScore ? clampScore(rawScore) : null;
  const description = typeof metric?.description === 'string' ? metric.description : '';
  const evidence = Array.isArray(metric?.evidence)
    ? metric.evidence.filter((item) => typeof item === 'string' && item.trim())
    : [];

  return {
    ...metric,
    score,
    description,
    evidence
  };
}

function sanitizeSeoMetricEntry(metric) {
  const base = sanitizeMetricEntry(metric);
  let weight = base.weight;
  if (weight === undefined && metric?.weight !== undefined) {
    weight = Number(metric.weight);
  }
  if (typeof weight === 'number' && !Number.isNaN(weight)) {
    weight = Math.max(0, weight);
  } else {
    weight = undefined;
  }
  return {
    ...base,
    weight
  };
}

function computeAverageScore(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null;
  let total = 0;
  let count = 0;
  metrics.forEach((metric) => {
    if (!Number.isFinite(metric?.score)) return;
    const score = clampScore(metric.score);
    total += score;
    count += 1;
  });
  if (count === 0) return null;
  const averageOutOfTen = total / count;
  return Math.round(averageOutOfTen * 10);
}

function computeWeightedScore(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  metrics.forEach((metric) => {
    if (typeof metric.weight === 'number' && Number.isFinite(metric?.score)) {
      const score = clampScore(metric.score);
      weightedSum += metric.weight * score;
      totalWeight += metric.weight;
    }
  });
  if (totalWeight <= 0) return null;
  const averageOutOfTen = weightedSum / totalWeight;
  return Math.round(averageOutOfTen * 10);
}

const AEO_METRIC_DEFAULTS = [
  { name: '答案可抽取性', weight: 12, description: '結論是否濃縮易摘錄，段落結構是否利於抽取。' },
  { name: '關鍵摘要與重點整理', weight: 9, description: '是否提供重點摘要、段落要點與快速複習。' },
  { name: '對話式語氣與指引', weight: 9, description: '語句是否自然、親切，並提供具體操作提示。' },
  { name: '讀者互動與後續引導', weight: 9, description: '是否引導讀者採取下一步並維繫互動。' }
]

const SEO_METRIC_DEFAULTS = [
  { name: 'Helpful Ratio', weight: 7, description: 'HCU 問卷整體 helpful 表現與違規比例。' },
  { name: '搜尋意圖契合', weight: 15, description: '內容是否滿足搜尋意圖並快速回答核心問題。' },
  { name: '內容覆蓋與深度', weight: 12, description: '篇幅、主題聚焦與段落細節是否充足。' },
  { name: '延伸疑問與關鍵字覆蓋', weight: 8, description: '是否回應關聯問題並涵蓋關鍵詞脈絡。' },
  { name: '行動可行性', weight: 8, description: '是否提供明確可執行步驟與實作建議。' },
  { name: '可讀性與敘事節奏', weight: 7, description: '句長、段落節奏與長段落比例是否友善。' },
  { name: '結構化重點提示', weight: 6, description: '是否善用條列、表格等結構強調重點。' },
  { name: '作者與品牌辨識', weight: 6, description: '是否明示作者、品牌或來源背景。' },
  { name: '可信證據與引用', weight: 10, description: '是否使用外部引用、數據與可信來源。' },
  { name: '第一手經驗與案例', weight: 11, description: '是否展現實務經驗、案例或獨特觀點。' },
  { name: '敘事具體度與資訊密度', weight: 10, description: '是否具體描述，資訊充足且有差異化。' },
  { name: '時效與更新訊號', weight: 6, description: '是否有近期年份、更新提醒或可見日期。' },
  { name: '專家觀點與判斷', weight: 11, description: '是否展現專家語彙、比較與專業判斷。' }
]

function ensureMetricShape(metrics, defaults, scope) {
  const existing = new Map()
  if (Array.isArray(metrics)) {
    metrics.forEach((metric) => {
      if (metric && typeof metric.name === 'string') {
        existing.set(metric.name, metric)
      }
    })
  }

  return defaults.map((item) => {
    const baseline = existing.get(item.name) || {}
    const baselineScore = baseline.score
    const hasFiniteScore = Number.isFinite(Number(baselineScore))
    const score = hasFiniteScore ? clampScore(baselineScore) : null
    const description = typeof baseline.description === 'string' && baseline.description.trim()
      ? baseline.description
      : item.description || ''
    const evidence = Array.isArray(baseline.evidence)
      ? baseline.evidence.filter((text) => typeof text === 'string' && text.trim())
      : []
    const weight = item.weight ?? baseline.weight

    const normalizedMetric = {
      ...item,
      ...baseline,
      name: item.name,
      score,
      description,
      evidence
    }

    if (typeof weight === 'number') {
      normalizedMetric.weight = weight
    }

    return scope === 'aeo'
      ? sanitizeMetricEntry(normalizedMetric)
      : sanitizeSeoMetricEntry(normalizedMetric)
  })
}

/**
 * 非同步分析處理
 * 使用 Durable Object 隊列提交任務
 */
async function handleAsyncAnalysis(context, requestBody, corsHeaders) {
  const { env } = context

  try {
    console.log('準備提交非同步分析任務...')

    // 取得 Durable Object 實例
    const queueId = env.ANALYSIS_QUEUE.idFromName('default')
    const queueObject = env.ANALYSIS_QUEUE.get(queueId)

    // 準備分析負載
    const analysisPayload = {
      content: requestBody.content || requestBody.contentPlain || '',
      contentHtml: requestBody.contentHtml || '',
      contentMarkdown: requestBody.contentMarkdown || '',
      targetKeywords: requestBody.targetKeywords || [],
      contentFormatHint: requestBody.contentFormatHint || 'auto',
      email: requestBody.email,
      includeRecommendations: requestBody.includeRecommendations === true || requestBody.includeRecommendations === 'true'
    }

    // 提交到 Durable Object 隊列
    const submitResponse = await queueObject.fetch(new Request('http://localhost/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisPayload)
    }))

    const result = await submitResponse.json()

    console.log('非同步任務已提交:', result)

    return new Response(
      JSON.stringify({
        status: 'queued',
        taskId: result.taskId,
        message: '分析任務已提交，結果將透過 Email 寄送',
        email: requestBody.email
      }),
      {
        status: 202,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('非同步分析提交失敗:', error)
    return new Response(
      JSON.stringify({
        error: '提交分析任務失敗',
        message: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
}
