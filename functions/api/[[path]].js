import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import {
  isScoringModelReady,
  predictAeoMetricScores,
  predictSeoMetricScores
} from './scoring-model'

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
      { "name": "E-E-A-T 信任線索", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "內容品質與原創性", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "人本與主題一致性", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "標題與承諾落實", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "搜尋意圖契合度", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "新鮮度與時效性", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "使用者安全與風險", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" }
    ],
    "aeo": [
      { "name": "段落獨立性", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "語言清晰度", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "實體辨識", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "邏輯流暢度", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" },
      { "name": "可信度信號", "score": 0-10, "confidence": "high|medium|low", "notes": "20-40 字" }
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
      "category": "內容|結構|E-E-A-T|技術|風險",
      "issue": "簡述當前缺口 (<=40 字)",
      "action": "具體改善步驟 (<=60 字)",
      "expectedScoreGain": "以「+5 分」格式估算"
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
  const allowedCategory = ['內容', '結構', 'E-E-A-T', '技術', '風險']
  const priority = typeof entry.priority === 'string' ? entry.priority.trim().toLowerCase() : 'medium'
  const category = typeof entry.category === 'string' ? entry.category.trim() : '內容'
  return {
    priority: allowedPriority.includes(priority) ? priority : 'medium',
    category: allowedCategory.includes(category) ? category : '內容',
    issue: coerceString(entry.issue).slice(0, 120),
    action: coerceString(entry.action).slice(0, 160),
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

function generateHeuristicRecommendations(payload = {}, contentSignals = {}) {
  const recommendations = []
  const scoreGuards = payload.scoreGuards || {}
  const missing = scoreGuards.missingCritical || {}
  const seoMetrics = Array.isArray(payload.metrics?.seo) ? payload.metrics.seo : []

  function add(priority, category, issue, action, expectedScoreGain) {
    recommendations.push({
      priority,
      category,
      issue,
      action,
      expectedScoreGain,
      title: issue,
      description: action
    })
  }

  const eatScore = seoMetrics.find((metric) => metric?.name === 'E-E-A-T 信任線索')?.score ?? null
  if (missing.author || missing.publisher || (isFiniteNumber(eatScore) && eatScore <= 4)) {
    add(
      'critical',
      'E-E-A-T',
      '缺少作者與品牌信任信號',
      '補充作者/品牌介紹、加入客服或社群管道，並於段落內引用可靠來源。',
      '+8 分'
    )
  }

  if (missing.metaDescription || missing.canonical) {
    add(
      'high',
      '技術',
      'Meta 與 Canonical 缺失降低搜尋信號',
      '撰寫 120 字以內的精準 Meta Description 並補上 rel="canonical"。',
      '+5 分'
    )
  }

  const depthFlags = scoreGuards.contentQualityFlags || {}
  if (depthFlags.depthLow || depthFlags.actionableZero || depthFlags.evidenceNone) {
    add(
      'high',
      '內容',
      '內容深度與佐證不足',
      '為三個產地各補充 2~3 個量化數據或評測經驗，並加入 1-2 個外部權威連結。',
      '+10 分'
    )
  }

  if (missing.faq || missing.howto) {
    add(
      'medium',
      '結構',
      '缺乏可被 AI 直接引用的 FAQ/HowTo 結構',
      '新增 FAQ 或沖煮步驟段落並套用 FAQPage/HowTo Schema。',
      '+6 分'
    )
  }

  if (!contentSignals.externalLinkCount || contentSignals.externalLinkCount === 0) {
    add(
      'medium',
      'E-E-A-T',
      '無外部權威引用',
      '連結到產地莊園、比賽或認證的官方頁面，強化可信度。',
      '+4 分'
    )
  }

  if (Array.isArray(payload.metrics?.seo)) {
    const readabilityScore = seoMetrics.find((metric) => metric?.name === '結構與可讀性')?.score ?? null
    if (isFiniteNumber(readabilityScore) && readabilityScore < 6 && contentSignals.h2Count < 4) {
      add(
        'medium',
        '結構',
        '段落與標題結構可再優化',
        '將「運送/訂閱/莊園故事」各拆為問句式 H2，並增設段落摘要。',
        '+3 分'
      )
    }
  }

  return recommendations
}

const FEATURE_RECOMMENDATION_MAP = {
  metaDescriptionPresent: {
    category: '技術',
    priority: 'high',
    issue: '缺少 Meta Description 與摘要訊號',
    action: '撰寫 120 字內、含主要關鍵字的 Meta Description，確保描述涵蓋使用者意圖。',
    expectedScoreGain: '+4 分',
    condition: ({ missingCritical }) => missingCritical?.metaDescription === true
  },
  canonicalPresent: {
    category: '技術',
    priority: 'high',
    issue: '缺少 Canonical 導致搜尋辨識困難',
    action: '補上 rel="canonical" 指向原始頁面，避免複製內容稀釋權重。',
    expectedScoreGain: '+4 分',
    condition: ({ missingCritical }) => missingCritical?.canonical === true
  },
  hasAuthorInfo: {
    category: 'E-E-A-T',
    priority: 'high',
    issue: '頁面缺少作者資訊削弱信任度',
    action: '在頁首或文末加入作者介紹與專業授權連結，補充聯絡方式。',
    expectedScoreGain: '+6 分',
    condition: ({ missingCritical }) => missingCritical?.author === true
  },
  hasPublisherInfo: {
    category: 'E-E-A-T',
    priority: 'high',
    issue: '頁面缺少品牌／出版者資訊',
    action: '補充品牌或組織資訊、社群連結，並維護公司頁面 Schema。',
    expectedScoreGain: '+5 分',
    condition: ({ missingCritical }) => missingCritical?.publisher === true
  },
  hasArticleSchema: {
    category: '結構',
    priority: 'medium',
    issue: '缺乏 Article/BlogPosting Schema',
    action: '加入 Article 結構化資料，標註作者、發布時間與主題，使搜尋更易理解內容。',
    expectedScoreGain: '+4 分',
    condition: ({ contentSignals }) => contentSignals?.hasArticleSchema === false
  },
  listPresent: {
    category: '結構',
    priority: 'medium',
    issue: '缺少條列整理降低可掃讀性',
    action: '整理重點段落為條列式（清單或步驟），對應使用者操作或比較需求。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.listCount || 0) === 0
  },
  tablePresent: {
    category: '結構',
    priority: 'medium',
    issue: '缺乏表格整理數據或比較',
    action: '將規格、價格、差異重點轉換為表格呈現，強化決策效率。',
    expectedScoreGain: '+3 分',
    condition: ({ contentSignals }) => (contentSignals?.tableCount || 0) === 0
  },
  actionableScoreNorm: {
    category: '內容',
    priority: 'high',
    issue: '操作指引不足，難以轉化為實際行動',
    action: '補充步驟化教學、清單或案例成果，至少新增 3 個具體行動建議。',
    expectedScoreGain: '+6 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.actionableWeak
  },
  experienceCueNorm: {
    category: 'E-E-A-T',
    priority: 'medium',
    issue: '缺少經驗案例或第一手實證',
    action: '新增實測心得、客戶引用或案例證言，提高體驗與可信度。',
    expectedScoreGain: '+4 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.experienceWeak
  },
  evidenceCountNorm: {
    category: 'E-E-A-T',
    priority: 'high',
    issue: '缺少外部佐證與權威來源',
    action: '引用並連結 2~3 個可信的統計或專家研究，並標註來源年份。',
    expectedScoreGain: '+5 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.evidenceWeak
  },
  recentYearNorm: {
    category: '新鮮度',
    priority: 'medium',
    issue: '內容缺乏近期年份更新',
    action: '補充近三年內的統計或政策動態，更新頁面發布／修改時間。',
    expectedScoreGain: '+4 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.freshnessWeak
  },
  titleIntentMatch: {
    category: '內容',
    priority: 'medium',
    issue: '標題與主題關鍵字對應度不足',
    action: '重新撰寫標題與前導段落，明確涵蓋主關鍵字與使用者意圖。',
    expectedScoreGain: '+3 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.titleMismatch
  },
  uniqueWordRatio: {
    category: '內容',
    priority: 'medium',
    issue: '字詞多樣性不足，內容顯得重複',
    action: '補充專業名詞、使用情境與差異化觀點，降低重複句型。',
    expectedScoreGain: '+3 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.uniqueWordLow
  },
  avgSentenceLengthNorm: {
    category: '結構',
    priority: 'low',
    issue: '句子偏長導致閱讀負擔',
    action: '拆分冗長句子、加上過場語與小標，讓每句平均不超過 24 個字。',
    expectedScoreGain: '+2 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.readabilityWeak
  },
  depthLowFlag: {
    category: '內容',
    priority: 'high',
    issue: '內容深度與段落數不足',
    action: '延伸常見問題、比較表與使用案例，補足至少 3 個段落與 500 字以上內容。',
    expectedScoreGain: '+6 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.depthLow
  },
  readabilityWeakFlag: {
    category: '結構',
    priority: 'medium',
    issue: '可讀性不足，需要優化排版',
    action: '加入 H2/H3 標題、條列與段落摘要，確保段落平均長度低於 350 字。',
    expectedScoreGain: '+3 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.readabilityWeak
  },
  actionableWeakFlag: {
    category: '內容',
    priority: 'high',
    issue: '缺乏可立即執行的建議',
    action: '提供逐步操作、檢核清單或工具下載，引導使用者下一步。',
    expectedScoreGain: '+5 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.actionableWeak
  },
  freshnessWeakFlag: {
    category: '新鮮度',
    priority: 'medium',
    issue: '缺少近期更新與維護訊號',
    action: '補上最新趨勢、調整發布/更新日期，並新增 2023 年後的統計或政策。',
    expectedScoreGain: '+3 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.freshnessWeak
  },
  titleMismatchFlag: {
    category: '內容',
    priority: 'high',
    issue: '標題承諾與內文落差過大',
    action: '校對標題與主段落是否對應，必要時重寫標題或補充對應內容。',
    expectedScoreGain: '+5 分',
    condition: ({ contentQualityFlags }) => contentQualityFlags?.titleMismatch
  },
  externalLinkPresent: {
    category: 'E-E-A-T',
    priority: 'medium',
    issue: '缺乏外部引用降低可信度',
    action: '補上至少 2 個外部權威出處（官方統計、專家評論），並標註連結。',
    expectedScoreGain: '+4 分',
    condition: ({ missingCritical }) => missingCritical?.externalLinksMissing === true
  },
  authorityLinkPresent: {
    category: 'E-E-A-T',
    priority: 'medium',
    issue: '未引用權威來源或機構',
    action: '連結到政府、學術或知名媒體等高可信度來源，補強權威度。',
    expectedScoreGain: '+4 分',
    condition: ({ missingCritical }) => missingCritical?.authorityLinksMissing === true
  },
  hasPublishedDate: {
    category: '新鮮度',
    priority: 'medium',
    issue: '頁面缺少發布日期標記',
    action: '在頁首或文末補上發布／更新日期，並以 Schema 標記時間。',
    expectedScoreGain: '+3 分',
    condition: ({ missingCritical }) => missingCritical?.publishedDate === true
  },
  hasVisibleDate: {
    category: '新鮮度',
    priority: 'medium',
    issue: '缺乏可見的內容時間資訊',
    action: '在文章中顯示最新更新日期與資訊來源年份，提升時效信任。',
    expectedScoreGain: '+3 分',
    condition: ({ missingCritical }) => missingCritical?.visibleDate === true
  }
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

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
    'E-E-A-T 信任線索': 'hasAuthorInfo',
    '內容品質與原創性': 'depthLowFlag',
    '人本與主題一致性': 'titleIntentMatch',
    '標題與承諾落實': 'metaDescriptionPresent',
    '搜尋意圖契合度': 'actionableScoreNorm',
    '新鮮度與時效性': 'recentYearNorm',
    '使用者安全與風險': 'metaDescriptionPresent',
    '結構與可讀性': 'readabilityWeakFlag'
  }
  const aeoMapping = {
    '段落獨立性': 'paragraphCountNorm',
    '語言清晰度': 'avgSentenceLengthNorm',
    '實體辨識': 'entityRichnessNorm',
    '邏輯流暢度': 'actionableScoreNorm',
    '可信度信號': 'evidenceCountNorm'
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
  { scope: 'seo', metric: '人本與主題一致性', questions: ['H1', 'H2'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '搜尋意圖契合度', questions: ['H2', 'H3', 'C1'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '內容品質與原創性', questions: ['Q1', 'Q2', 'Q3', 'C1'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: 'E-E-A-T 信任線索', questions: ['E1'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '標題與承諾落實', questions: ['H2'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '新鮮度與時效性', questions: ['E2'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '結構與可讀性', questions: ['P1'], caps: { partial: 6, no: 4 } },
  { scope: 'seo', metric: '使用者安全與風險', questions: ['P2'], caps: { partial: 6, no: 5 } },
  { scope: 'aeo', metric: '段落獨立性', questions: ['H3', 'Q2', 'Q3'], caps: { partial: 6, no: 5 } },
  { scope: 'aeo', metric: '語言清晰度', questions: ['H1', 'P1'], caps: { partial: 6, no: 5 } },
  { scope: 'aeo', metric: '邏輯流暢度', questions: ['H3'], caps: { partial: 6, no: 5 } },
  { scope: 'aeo', metric: '可信度信號', questions: ['E1', 'E2'], caps: { partial: 5, no: 4 } }
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
    
    const apiKey = env && env.GEMINI_API_KEY ? env.GEMINI_API_KEY : null;
    
    if (!apiKey) {
      console.error('Gemini API key is missing');
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
          console.warn('No text part found in response. Returning raw response for debugging.');
          return { rawResponse: data };
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
          console.error('Failed to parse JSON from text part, returning raw text.', e);
          return { rawText: textPart.text, rawResponse: data };
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
        throw new Error(errorMessage);
      }
    }
  } catch (error) {
    console.error('Unexpected error in analyzeWithGemini:', error);
    // Fallback: if model is overloaded or rate-limited, return mock to keep UX responsive
    if (String(error.message || '').includes('503') || String(error.message || '').includes('429')) {
      console.warn('Gemini overloaded/rate-limited, falling back to mock analysis (outer catch)');
      const firstKeyword = Array.isArray(targetKeywords) && targetKeywords.length ? targetKeywords[0] : '';
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

  return handleAnalyzePost(context, corsHeaders)
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
        targetKeywordLegacy: !!requestBody.targetKeyword
      }, null, 2))
    } catch (e) {
      console.error('解析請求體失敗:', e)
      throw new Error('無效的 JSON 請求體')
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

    let contentVariants = normalizeContentVariants(requestBody)
    if (contentVariants.hint !== 'html' || !contentVariants.html.trim()) {
      if (requestBody.contentUrl) {
        try {
          const extracted = await fetchAndExtractContent(requestBody.contentUrl)
          contentVariants = {
            ...contentVariants,
            html: extracted.html || contentVariants.html,
            plain: extracted.plain || contentVariants.plain,
            markdown: contentVariants.markdown,
            hint: 'html'
          }
        } catch (error) {
          console.warn('Failed to fetch content for URL hint recovery', error)
        }
      }
    }
    const {
      plain: contentPlain,
      html: contentHtml,
      markdown: contentMarkdown,
      hint: contentFormatHint
    } = contentVariants
    const primaryContent = derivePrimaryPlainContent(contentVariants)
    const normalizedContentVariants = {
      ...contentVariants,
      plain: primaryContent
    }
    const chunkSourceText = deriveChunkSourceText(normalizedContentVariants)
    const chunkSourceFormat = guessChunkSourceFormat(normalizedContentVariants)

    console.log('請求體解析成功:', JSON.stringify({
      contentLengthLegacy: typeof requestBody.content === 'string' ? requestBody.content.length : 0,
      contentPlainLength: normalizedContentVariants.plain.length,
      contentHtmlLength: normalizedContentVariants.html.length,
      contentMarkdownLength: normalizedContentVariants.markdown.length,
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

    const contentSignals = computeContentSignals({
      plain: normalizedContentVariants.plain,
      html: normalizedContentVariants.html,
      markdown: normalizedContentVariants.markdown,
      targetKeywords,
      sourceUrl: requestBody.fetchedUrl || requestBody.contentUrl || requestBody.url || null
    })

    const geminiApiKey = env.GEMINI_API_KEY
    console.log('GEMINI_API_KEY 長度:', geminiApiKey ? `${geminiApiKey.substring(0, 5)}...${geminiApiKey.substring(geminiApiKey.length - 3)}` : '未設置')

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('開始處理分析請求...')
    let analysisResult
    try {
      analysisResult = await analyzeWithGemini(normalizedContentVariants.plain, targetKeywords, env, contentSignals)
      console.log('分析成功完成')
      analysisResult = coerceAnalysisResult(analysisResult)
    } catch (error) {
      console.error('分析過程中出錯:', error)
      const msg = String(error && error.message ? error.message : '')
      if (msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded')) {
        console.warn('偵測到模型過載/速率限制，改用模擬分析結果以維持體驗')
        const firstKeyword = Array.isArray(targetKeywords) && targetKeywords.length ? targetKeywords[0] : ''
        analysisResult = generateMockAnalysis(normalizedContentVariants.plain, firstKeyword)
      } else {
        throw new Error(`分析失敗: ${error.message}`)
      }
    }

    let payload = normalizeAnalysisResult(analysisResult, contentSignals)

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

    payload = applyScoreGuards(payload, contentSignals, targetKeywords)
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

// Build the analysis prompt (multiple keywords)
function buildAnalysisPrompt(content, targetKeywords, contentSignals = {}) {
  const keywordsList = Array.isArray(targetKeywords) ? targetKeywords.filter(Boolean).join(', ') : '';
  const signals = serializeContentSignals(contentSignals)
  const hcuQuestions = formatHcuQuestions()
  return `你是一位嚴謹的 SEO 與 AEO 分析專家。請僅依據使用者提供的目標關鍵字進行分析，不要臆測或自行假設任何關鍵字。

文章內容：
${content}

目標關鍵字（1-5 個，僅限以下清單）：${keywordsList}

已解析的頁面結構與訊號（請務必據此評分，缺失即視為不符合）：
${signals}

請依照上述訊號遵循以下原則：
- 篇幅不足（wordCount < 600 或 paragraphCount < 6）視為內容深度不足。
- 行動性弱（actionableScore ≤ 1 或 actionableStepCount < 3）視為未完全回應使用者需求。
- 若 evidenceCount < 2、recentYearCount = 0 或 externalAuthorityLinkCount = 0，可信度與 E-E-A-T 必須降為 partial/no。
- 若 experienceCueCount < 1 或 hasFirstPersonNarrative = false，視為缺乏第一手經驗支撐。
- titleIntentMatch < 0.4 或 h1ContainsKeyword = false 時，須在 HCU 問卷中標示為 partial/no。

請先依據以下 Helpful Content Update (HCU) 問卷逐題判斷內容是否符合：
${hcuQuestions}
每題必須輸出 "answer": "yes|partial|no" 以及 40 字內的說明；若資料不足必須回答 "no" 或 "partial"。

請以 JSON 格式回傳分析結果，包含以下結構：
{
  "overallScore": 整數(0-100),
  "aeoScore": 整數(0-100),
  "seoScore": 整數(0-100),
  "hcuReview": [
    { "id": "...", "answer": "yes|partial|no", "explanation": "..." }
  ],
  "metrics": {
    "aeo": [
      { "name": "段落獨立性", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "語言清晰度", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "實體辨識", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "邏輯流暢度", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "可信度信號", "score": 整數(0-10), "description": "簡短描述" }
    ],
    "seo": [
      { "name": "E-E-A-T 信任線索", "weight": 18, "score": 整數(0-10), "description": "評估文本中呈現的專業背景、經驗與可信度證據（如作者簡介、引用來源）", "evidence": ["指出文本中的可信度線索，若缺少請說明"] },
      { "name": "內容品質與原創性", "weight": 18, "score": 整數(0-10), "description": "衡量內容是否提供深度洞察、獨特案例或自家觀點，而非重複常識", "evidence": ["列出展現原創洞察或研究的段落"] },
      { "name": "人本與主題一致性", "weight": 12, "score": 整數(0-10), "description": "判斷內容是否為真實使用者需求而寫，並與文中標題/主題保持一致", "evidence": ["說明內容如何回應使用者需求或指出偏離之處"] },
      { "name": "標題與承諾落實", "weight": 10, "score": 整數(0-10), "description": "檢查標題或開頭承諾是否在正文中兌現，避免誇大", "evidence": ["比較標題/開頭與正文的對應關係"] },
      { "name": "搜尋意圖契合度", "weight": 12, "score": 整數(0-10), "description": "衡量內容是否完整回答主要問題或達成相關任務", "evidence": ["指出滿足意圖的段落，或註記缺少資訊"] },
      { "name": "新鮮度與時效性", "weight": 8, "score": 整數(0-10), "description": "檢視文本是否提供最新數據、更新時間或具時效性的資訊", "evidence": ["列出最新年份或說明資訊過時"] },
      { "name": "使用者安全與風險", "weight": 12, "score": 整數(0-10), "description": "評估內容是否含有潛在誤導、風險或未標示的限制／免責", "evidence": ["指出危險段落或說明安全防護措施"] },
      { "name": "結構與可讀性", "weight": 10, "score": 整數(0-10), "description": "判斷段落結構、排版提示、語句長度是否有利於閱讀與行動裝置瀏覽", "evidence": ["示例說明段落、列表或格式改善點"] }
    ]
  },
  "perKeyword": [
    { "keyword": "...", "density": "...", "intentFit": "...", "coverage": "..." }
  ],
  "recommendations": [
    { "priority": "high|medium|low", "category": "AEO|SEO|E-E-A-T|Safety", "title": "...", "description": "...", "example": "..." }
  ],
  "highRiskFlags": [
    { "type": "harm|deception|spam", "severity": "critical|warning", "summary": "...", "action": "..." }
  ]
}

重要：
- 僅使用提供的目標關鍵字進行分析，不得臆測新增或替換。
- 僅依據貼上內容本身的文字線索與上述「頁面訊號」進行評估；若文本未提供所需資訊，請於 description 與 evidence 中明確標註「文本未提供」。
- 如頁面訊號顯示缺少某項結構(例如：缺少 FAQ schema 或作者資訊)，對應指標最高分僅能給 4 分。
- 若內容不足以評估，請在描述與建議中明確指出不足與需要補充的資訊。
- highRiskFlags 為必填欄位，若無風險請輸出空陣列。
- 必須輸出上述 8 項 \`metrics.seo\` 指標，不可刪減或整併。
- 每項 description 請以 1–2 句繁體中文撰寫，總字數不超過 70 字。
- 每項 evidence 最多 2 條，單條字數不超過 40 字。
- 嚴禁輸出 Markdown 圍欄或額外文字，僅回傳合法 JSON。`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && value.length) return value.join('\n');
  }
  return '';
}

function coerceString(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(coerceString).join('\n');
  if (typeof value === 'object' && typeof value.toString === 'function') return value.toString();
  return '';
}

function normalizeContentVariants(source = {}) {
  const plain = firstNonEmpty(
    source.contentPlain,
    source.plain,
    typeof source.content === 'string' ? source.content : '',
    source.text
  );
  const html = firstNonEmpty(source.contentHtml, source.html, source.rawHtml);
  const markdown = firstNonEmpty(source.contentMarkdown, source.markdown, source.rawMarkdown);
  const hintSource = coerceString(source.contentFormatHint || source.hint || '');
  const hint = hintSource.trim().toLowerCase();

  return {
    plain: coerceString(plain),
    html: coerceString(html),
    markdown: coerceString(markdown),
    hint: hint === 'html' || hint === 'markdown' || hint === 'plain' ? hint : ''
  };
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

function htmlToStructuredText(html) {
  if (typeof html !== 'string' || !html.trim()) return '';
  let output = html.replace(/\r\n/g, '\n');
  output = output.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1>/gi, '');

  output = output.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const prefix = '#'.repeat(Number(level) || 1);
    const headingText = stripHtmlTags(inner).trim();
    return `\n${prefix} ${headingText}\n`;
  });

  const blockTags = [
    'p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'nav',
    'li', 'ul', 'ol', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'figure', 'figcaption'
  ];
  for (const tag of blockTags) {
    const regex = new RegExp(`<\\s*${tag}[^>]*>`, 'gi');
    output = output.replace(regex, '\n');
    const closeRegex = new RegExp(`<\\/\\s*${tag}\\s*>`, 'gi');
    output = output.replace(closeRegex, '\n');
  }

  output = output.replace(/<br\s*\/?\s*>/gi, '\n');
  output = stripHtmlTags(output);
  output = decodeBasicEntities(output);
  return normalizeWhitespace(output);
}

function markdownToStructuredText(markdown) {
  if (typeof markdown !== 'string') return '';
  return normalizeWhitespace(markdown.replace(/\r\n/g, '\n'));
}

function markdownToPlain(markdown) {
  const structured = markdownToStructuredText(markdown);
  return normalizeWhitespace(stripMarkdown(structured));
}

function stripMarkdown(markdown) {
  if (!markdown) return '';
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
    .replace(/\|\s?\|/g, ' ');
}

function stripHtmlTags(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ');
}

function decodeBasicEntities(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeWhitespace(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \f\v]{2,}/g, ' ')
    .trim();
}

function harmonizeParagraphBreaks(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
    .replace(/([。！？!?])(?!\s*\n)/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function computeContentSignals({ plain = '', html = '', markdown = '', targetKeywords = [], sourceUrl = null }) {
  // 簡化版本：只計算基本信號以避免 Worker 超時
  // 完整版本應在後端服務中計算
  const signal = {
    hasHtml: Boolean(html && html.trim()),
    hasMarkdown: Boolean(markdown && markdown.trim()),
    hasPlain: Boolean(plain && plain.trim()),
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
    hasCanonical: false,
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
  const htmlPlainFallback = hasHtml ? htmlToStructuredText(sourceHtml) : ''

  const paragraphSegments = []
  let primaryH1 = ''

  try {
    // 簡化版：使用正則表達式而非 DOM 解析以避免超時
    // 完整版應在後端計算
    
    if (hasHtml) {
      // 快速檢查基本標籤
      signal.hasUniqueTitle = /<title[^>]*>(.{1,}?)<\/title>/i.test(sourceHtml)
      signal.hasMetaDescription = /name=["']description["']\s+content=["'](.{30,}?)["']/i.test(sourceHtml)
      signal.hasCanonical = /rel=["']canonical["']/i.test(sourceHtml)

      const authorMatches = /<(?:meta|span|div)[^>]*(?:name|itemprop|class|id)=["'](?:author|byline|writer)["'][^>]*>(.*?)<\//gi
      signal.hasAuthorInfo = authorMatches.test(sourceHtml)

      const publisherMatches = /<(?:meta|span|div)[^>]*(?:name|itemprop|class|id)=["'](?:publisher|organization|brand)["'][^>]*>/gi
      signal.hasPublisherInfo = publisherMatches.test(sourceHtml)

      if (!signal.hasPublishedDate) {
        signal.hasPublishedDate = /(?:datePublished|pubdate|published_time)["']?\s*[:=]\s*["']?\d{4}/i.test(sourceHtml)
      }
      if (!signal.hasModifiedDate) {
        signal.hasModifiedDate = /(?:dateModified|updated_time|modified_time)["']?\s*[:=]\s*["']?\d{4}/i.test(sourceHtml)
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
      const schemaMatches = sourceHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
      for (const match of schemaMatches) {
        try {
          const jsonStr = match.replace(/<script[^>]*>|<\/script>/gi, '')
          const json = JSON.parse(jsonStr)
          const type = json['@type'] || ''
          if (type.includes('Article') || type.includes('BlogPosting')) signal.hasArticleSchema = true
          if (type.includes('FAQPage')) signal.hasFaqSchema = true
          if (type.includes('HowTo')) signal.hasHowToSchema = true
        } catch (e) {
          // 忽略解析錯誤
        }
      }
      
      // 檢查日期
      signal.hasVisibleDate = /\d{4}[年\/-]/.test(sourceHtml)
      signal.hasVisibleDate ||= /(?:發佈|發布|更新)[^\n]*\d{4}[年\/-]\d{1,2}[月\/-]\d{1,2}/.test(sourceHtml)
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
  } catch (error) {
    console.error('computeContentSignals failed', error)
  }

  return signal
}

function serializeContentSignals(signals = {}) {
  try {
    return JSON.stringify(signals, null, 2)
  } catch (error) {
    return '{}'
  }
}

function extractSentences(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const matches = normalized.match(/[^。！？!?\.]+[。！？!?\.]?/g)
  return matches ? matches.map((sentence) => sentence.trim()).filter(Boolean) : [normalized]
}

function extractWords(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  const matches = text.match(/[A-Za-z\u4e00-\u9fff0-9]+/g)
  return matches ? matches : []
}

function extractKeywordSet(text) {
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
  const wordCount = Number(contentSignals.wordCount || 0)
  const paragraphCount = Number(contentSignals.paragraphCount || 0)
  const actionableScore = Number(contentSignals.actionableScore || 0)
  const actionableStepCount = Number(contentSignals.actionableStepCount || 0)
  const evidenceCount = Number(contentSignals.evidenceCount || 0)
  const externalAuthorityLinkCount = Number(contentSignals.externalAuthorityLinkCount || 0)
  const recentYearCount = Number(contentSignals.recentYearCount || 0)
  const experienceCueCount = Number(contentSignals.experienceCueCount || 0)
  const hasFirstPersonNarrative = Boolean(contentSignals.hasFirstPersonNarrative)
  const titleIntentMatch = Number(contentSignals.titleIntentMatch || 0)
  const h1ContainsKeyword = contentSignals.h1ContainsKeyword
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
  if (scope !== 'seo') return null

  const signals = context.contentSignals || {}
  const flags = context.contentQualityFlags || {}
  const missing = context.missingCritical || {}

  const num = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const clamp0to10 = (value) => {
    if (!Number.isFinite(value)) return null
    return Math.max(0, Math.min(10, value))
  }

  switch (metricName) {
    case 'E-E-A-T 信任線索': {
      let score = 10
      if (missing.author) score -= 2
      if (missing.publisher) score -= 2
      if (missing.authorityLinksMissing) score -= 1
      if (!signals.hasArticleSchema) score -= 1
      const evidenceCount = num(signals.evidenceCount ?? flags.evidenceCount)
      if (evidenceCount >= 4) score += 2
      else if (evidenceCount >= 2) score += 1
      const experienceCueCount = num(signals.experienceCueCount ?? flags.experienceCueCount)
      if (experienceCueCount >= 2) score += 1
      return clamp0to10(score)
    }
    case '內容品質與原創性': {
      let score = 10
      if (flags.depthLow) score -= 2
      if (flags.uniqueWordLow) score -= 1
      const evidenceCount = num(signals.evidenceCount ?? flags.evidenceCount)
      if (evidenceCount === 0) score -= 2
      else if (evidenceCount < 2) score -= 1
      const experienceCueCount = num(signals.experienceCueCount ?? flags.experienceCueCount)
      if (experienceCueCount >= 3) score += 2
      else if (experienceCueCount >= 1) score += 1
      const actionableScore = num(signals.actionableScore ?? flags.actionableScore)
      if (actionableScore >= 2) score += 1
      return clamp0to10(score)
    }
    case '人本與主題一致性': {
      let score = 7
      const titleIntentMatch = num(signals.titleIntentMatch ?? flags.titleIntentMatch)
      if (titleIntentMatch >= 0.8) score += 2
      else if (titleIntentMatch >= 0.6) score += 1
      else if (titleIntentMatch < 0.3) score -= 2
      if (flags.actionableWeak) score -= 2
      if (missing.h1Keyword) score -= 2
      const actionableScore = num(signals.actionableScore ?? flags.actionableScore)
      if (actionableScore >= 2) score += 1
      const referenceKeywordCount = num(signals.referenceKeywordCount)
      if (referenceKeywordCount === 0) score -= 1
      return clamp0to10(score)
    }
    case '標題與承諾落實': {
      let score = 8
      if (flags.titleMismatch) score -= 3
      if (missing.h1Count) score -= 2
      if (flags.actionableWeak) score -= 1
      if (signals.hasMetaDescription) score += 1
      if (signals.hasUniqueTitle) score += 1
      return clamp0to10(score)
    }
    case '搜尋意圖契合度': {
      let score = 8
      if (missing.h2Coverage) score -= 3
      if (flags.depthLow) score -= 2
      if (flags.actionableWeak) score -= 1
      const actionableScore = num(signals.actionableScore ?? flags.actionableScore)
      if (actionableScore >= 2) score += 2
      else if (actionableScore === 0) score -= 2
      const paragraphCount = num(signals.paragraphCount)
      if (paragraphCount >= 6) score += 1
      else if (paragraphCount <= 2) score -= 1
      return clamp0to10(score)
    }
    case '新鮮度與時效性': {
      let score = 6
      if (signals.hasPublishedDate) score += 2
      if (signals.hasVisibleDate) score += 1
      if (signals.hasModifiedDate) score += 1
      const recentYearCount = num(signals.recentYearCount ?? flags.recentYearCount)
      if (recentYearCount >= 2) score += 1
      if (recentYearCount === 0) score -= 3
      return clamp0to10(score)
    }
    case '使用者安全與風險': {
      let score = 8
      if (missing.metaDescription) score -= 3
      if (missing.canonical) score -= 2
      const evidenceCount = num(signals.evidenceCount ?? flags.evidenceCount)
      if (evidenceCount === 0) score -= 2
      const actionableScore = num(signals.actionableScore ?? flags.actionableScore)
      if (actionableScore === 0) score -= 1
      if (signals.externalAuthorityLinkCount > 0) score += 1
      return clamp0to10(score)
    }
    case '結構與可讀性': {
      let score = 8
      if (flags.readabilityWeak) score -= 4
      const paragraphCount = num(signals.paragraphCount)
      if (paragraphCount <= 1) score -= 3
      else if (paragraphCount <= 3) score -= 1
      const listCount = num(signals.listCount)
      if (listCount > 0) score += 1
      const tableCount = num(signals.tableCount)
      if (tableCount > 0) score += 1
      const longParagraphCount = num(signals.longParagraphCount)
      if (longParagraphCount > Math.max(2, Math.floor(paragraphCount * 0.5))) score -= 1
      return clamp0to10(score)
    }
    default:
      return null
  }
}

function deriveMissingCriticalSignals(contentSignals = {}) {
  return {
    faq: !contentSignals.hasFaqSchema,
    howto: !contentSignals.hasHowToSchema,
    article: !contentSignals.hasArticleSchema,
    author: !contentSignals.hasAuthorInfo,
    publisher: !contentSignals.hasPublisherInfo,
    publishedDate: !contentSignals.hasPublishedDate,
    modifiedDate: !contentSignals.hasModifiedDate,
    visibleDate: !contentSignals.hasVisibleDate,
    metaDescription: !contentSignals.hasMetaDescription,
    canonical: !contentSignals.hasCanonical,
    h1Keyword: !contentSignals.h1ContainsKeyword,
    h1Count: Number(contentSignals.h1Count || 0) !== 1,
    h2Coverage: Number(contentSignals.h2Count || 0) < 2,
    paragraphsLong: Number(contentSignals.paragraphAverageLength || 0) > 420,
    listMissing: Number(contentSignals.listCount || 0) === 0,
    tableMissing: Number(contentSignals.tableCount || 0) === 0,
    imageAltMissing: Number(contentSignals.imageCount || 0) > 0 && Number(contentSignals.imageWithAltCount || 0) < Number(contentSignals.imageCount || 0),
    externalLinksMissing: Number(contentSignals.externalLinkCount || 0) < 1,
    authorityLinksMissing: Number(contentSignals.externalAuthorityLinkCount || 0) < 1
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
          if (metric.name === '段落獨立性' && missingCritical.h2Coverage) {
            guarded.score = Math.min(guarded.score, 5)
          }
          if (metric.name === '段落獨立性' && contentQualityFlags.depthVeryLow) {
            guarded.score = Math.min(guarded.score, 4)
          }
          if (metric.name === '語言清晰度' && missingCritical.paragraphsLong) {
            guarded.score = Math.min(guarded.score, 6)
          }
          if (metric.name === '語言清晰度' && contentQualityFlags.readabilityWeak) {
            guarded.score = Math.min(guarded.score, 5)
          }
          if (metric.name === '可信度信號' && (missingCritical.externalLinksMissing || missingCritical.authorityLinksMissing)) {
            guarded.score = Math.min(guarded.score, 4)
          }
          if (metric.name === '可信度信號' && contentQualityFlags.evidenceWeak) {
            guarded.score = Math.min(guarded.score, 3)
          }
          if (metric.name === '語言清晰度' && contentQualityFlags.uniqueWordLow) {
            guarded.score = Math.min(guarded.score, 6)
          }
          if (metric.name === '實體辨識' && contentQualityFlags.uniqueWordLow) {
            guarded.score = Math.min(guarded.score, 5)
          }
          if (metric.name === '邏輯流暢度' && (contentQualityFlags.actionableWeak || contentQualityFlags.readabilityWeak)) {
            guarded.score = Math.min(guarded.score, 5)
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
          case 'E-E-A-T 信任線索':
            if (missingCritical.author || missingCritical.publisher) lower(4)
            if (missingCritical.authorityLinksMissing) lower(4)
            break
          case '內容品質與原創性':
            if (missingCritical.externalLinksMissing) lower(5)
            if (contentQualityFlags.depthLow) lower(6)
            if (contentQualityFlags.uniqueWordLow) lower(5)
            if (contentQualityFlags.experienceWeak) lower(5)
            break
          case '人本與主題一致性':
            if (missingCritical.h1Count || missingCritical.h1Keyword) lower(5)
            if (contentQualityFlags.titleMismatch) lower(5)
            if (contentQualityFlags.actionableWeak) lower(5)
            break
          case '標題與承諾落實':
            if (missingCritical.h1Count) lower(6)
            if (contentQualityFlags.titleMismatch) lower(4)
            break
          case '搜尋意圖契合度':
            if (missingCritical.h2Coverage) lower(6)
            if (contentQualityFlags.actionableWeak) lower(4)
            if (contentQualityFlags.depthLow) lower(6)
            break
          case '新鮮度與時效性':
            if (missingCritical.publishedDate || missingCritical.visibleDate) lower(3)
            if (missingCritical.modifiedDate) lower(4)
            if (contentQualityFlags.freshnessWeak) lower(3)
            break
          case '使用者安全與風險':
            if (missingCritical.metaDescription || missingCritical.canonical) lower(6)
            if (contentQualityFlags.evidenceWeak) lower(5)
            break
          case '結構與可讀性':
            if (missingCritical.listMissing) lower(5)
            if (missingCritical.tableMissing) lower(6)
            if (missingCritical.paragraphsLong) lower(5)
            if (contentQualityFlags.readabilityWeak) lower(4)
            break
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
          name: '段落獨立性',
          score: 8,
          description: '段落主題明確，結構良好'
        },
        {
          name: '語言清晰度',
          score: 7,
          description: '語言表達清晰，但部分句子可以更簡潔'
        },
        {
          name: '實體辨識',
          score: 8,
          description: '包含豐富的實體和專有名詞'
        },
        {
          name: '邏輯流暢度',
          score: 8,
          description: '論述邏輯連貫，易於理解'
        },
        {
          name: '可信度信號',
          score: 7,
          description: '建議增加更多數據和來源引用'
        }
      ],
      seo: [
        {
          name: 'E-E-A-T 信任線索',
          weight: 18,
          score: 7,
          description: '文本提供基本背景與來源，但仍可補充更多權威佐證',
          evidence: ['導言段提到作者具多年經驗', '內文引用 1 筆 2023 年業界調查']
        },
        {
          name: '內容品質與原創性',
          weight: 18,
          score: hasKeyword ? 7 : 6,
          description: hasKeyword ? '主內容結構完整且包含親身案例' : '內容尚未針對目標關鍵字提供具體案例',
          evidence: [wordCount > 500 ? '第三段描述實際實施流程' : '篇幅不足 500 字，缺少深度資訊']
        },
        {
          name: '人本與主題一致性',
          weight: 12,
          score: 7,
          description: '全文聚焦解決使用者問題，無刻意堆疊關鍵字',
          evidence: ['第二段直接回答「該怎麼做」的提問']
        },
        {
          name: '標題與承諾落實',
          weight: 10,
          score: 7,
          description: '標題承諾的步驟在正文中都有對應段落',
          evidence: ['標題寫「三步驟」，內文第 3-5 段逐一說明']
        },
        {
          name: '搜尋意圖契合度',
          weight: 12,
          score: 7,
          description: '內容回答主要問題並提供操作步驟',
          evidence: ['結論提供可執行清單對應讀者意圖']
        },
        {
          name: '新鮮度與時效性',
          weight: 8,
          score: wordCount > 500 ? 7 : 6,
          description: wordCount > 500 ? '引用 2024 年資料維持時效性' : '缺少發布或更新時間資訊',
          evidence: [wordCount > 500 ? '第四段引用「2024 年統計」' : '全文未標示年份']
        },
        {
          name: '使用者安全與風險',
          weight: 12,
          score: 7,
          description: '內容無明顯危害，但建議補充資料來源以降低誤導風險',
          evidence: ['無極端承諾或危險指引', '建議加入引用佐證關鍵數據']
        },
        {
          name: '結構與可讀性',
          weight: 10,
          score: 8,
          description: '段落切分良好，適合行動裝置閱讀',
          evidence: ['使用條列整理步驟', '句子長度適中，易於掃讀']
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
  { name: '段落獨立性', description: '評估各段是否能獨立傳達重點，利於 AI 抽取答案。' },
  { name: '語言清晰度', description: '檢查句構與用詞是否清晰易懂，避免曖昧語句。' },
  { name: '實體辨識', description: '評估是否明確提及品牌、產品、地點等實體名稱。' },
  { name: '邏輯流暢度', description: '判斷段落安排是否具備起承轉合，方便理解脈絡。' },
  { name: '可信度信號', description: '檢視是否有數據、案例或來源支撐，提高可信度。' }
]

const SEO_METRIC_DEFAULTS = [
  { name: 'E-E-A-T 信任線索', weight: 18, description: '作者、品牌背景與來源引用是否充分展現專業與可信度。' },
  { name: '內容品質與原創性', weight: 18, description: '內容是否提供深度洞察、案例或自家觀點。' },
  { name: '人本與主題一致性', weight: 12, description: '內容是否貼近讀者需求且與標題主題一致。' },
  { name: '標題與承諾落實', weight: 10, description: '標題或開頭承諾是否在正文中兌現，避免誇大。' },
  { name: '搜尋意圖契合度', weight: 12, description: '內容是否完整回應搜尋者意圖並提供後續行動。' },
  { name: '新鮮度與時效性', weight: 8, description: '是否提供最新資料或標註更新時間。' },
  { name: '使用者安全與風險', weight: 12, description: '內容是否避免錯誤指引並提供必要免責或安全提醒。' },
  { name: '結構與可讀性', weight: 10, description: '段落、列表、排版是否利於掃讀與行動裝置瀏覽。' }
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
