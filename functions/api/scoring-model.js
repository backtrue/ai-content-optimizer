const DEFAULT_MODEL = {
  version: '2025-11-03-content-quality-v1',
  createdAt: '2025-11-03T15:20:00Z',
  description: 'Rule-based content quality scoring (HCU/EEAT/AEO) 無依賴 HTML/Schema 指標',
  seo: {
    metrics: {
      helpfulRatio: {
        name: 'Helpful Ratio',
        weight: 7,
        features: ['hcuYesRatio', 'hcuPartialRatio', 'hcuNoRatio'],
        score: ({ contentSignals }) => {
          const yes = clamp01(contentSignals.hcuYesRatio ?? 0)
          const partial = clamp01(contentSignals.hcuPartialRatio ?? 0)
          const no = clamp01(contentSignals.hcuNoRatio ?? 0)
          if (!yes && !partial && !no) return null
          return clamp0to10(10 * (yes + 0.5 * partial - no * 0.6))
        }
      },
      intentFit: {
        name: '搜尋意圖契合',
        weight: 15,
        features: ['titleIntentMatch', 'firstParagraphAnswerQuality', 'qaFormatScore'],
        score: ({ contentSignals }) => {
          const intent = clamp01(contentSignals.titleIntentMatch ?? 0)
          const first = clamp01(contentSignals.firstParagraphAnswerQuality ?? 0)
          const qa = clamp01(contentSignals.qaFormatScore ?? 0)
          return clamp0to10((intent * 4 + first * 4 + qa * 2) + bonusIfHigh(intent, first))
        }
      },
      depthCoverage: {
        name: '內容覆蓋與深度',
        weight: 12,
        features: ['wordCountNorm', 'topicCohesion', 'semanticParagraphFocus'],
        score: ({ contentSignals }) => {
          const word = clamp01(contentSignals.wordCountNorm ?? normalizeWordCount(contentSignals.wordCount))
          const cohesion = clamp01(contentSignals.topicCohesion ?? 0)
          const focus = clamp01(contentSignals.semanticParagraphFocus ?? 0)
          return clamp0to10(word * 4 + cohesion * 3 + focus * 3)
        }
      },
      intentExpansion: {
        name: '延伸疑問與關鍵字覆蓋',
        weight: 8,
        features: ['referenceKeywordNorm', 'qaFormatScore'],
        score: ({ contentSignals }) => {
          const ref = clamp01(contentSignals.referenceKeywordNorm ?? normalizeReferenceKeyword(contentSignals.referenceKeywordCount))
          const qa = clamp01(contentSignals.qaFormatScore ?? 0)
          return clamp0to10(ref * 6 + qa * 2)
        }
      },
      actionability: {
        name: '行動可行性',
        weight: 8,
        features: ['actionableScoreNorm', 'actionableStepCount'],
        score: ({ contentSignals }) => {
          const actionable = clamp01(contentSignals.actionableScoreNorm ?? normalizeActionableScore(contentSignals.actionableScore))
          const steps = clamp01(normalizeStepCount(contentSignals.actionableStepCount))
          return clamp0to10(actionable * 6 + steps * 4)
        }
      },
      readabilityRhythm: {
        name: '可讀性與敘事節奏',
        weight: 7,
        features: ['avgSentenceLengthNorm', 'longParagraphPenalty'],
        score: ({ contentSignals }) => {
          const sentence = clamp01(1 - (contentSignals.avgSentenceLengthNorm ?? normalizeSentenceLength(contentSignals.avgSentenceLength)))
          const longPenalty = clamp01(1 - normalizeLongParagraphPenalty(contentSignals.longParagraphCount, contentSignals.paragraphCount))
          return clamp0to10(sentence * 6 + longPenalty * 4)
        }
      },
      structureHighlights: {
        name: '結構化重點提示',
        weight: 6,
        features: ['listCount', 'tableCount'],
        score: ({ contentSignals }) => {
          const listScore = clamp01(normalizeListCount(contentSignals.listCount))
          const tableScore = clamp01(normalizeTableCount(contentSignals.tableCount))
          return clamp0to10(listScore * 6 + tableScore * 4)
        }
      },
      authorBrandSignals: {
        name: '作者與品牌辨識',
        weight: 6,
        features: ['authorMentionCount', 'brandMentionCount'],
        score: ({ contentSignals }) => {
          const author = clamp01(normalizeEntityMention(contentSignals.authorMentionCount))
          const brand = clamp01(normalizeEntityMention(contentSignals.brandMentionCount))
          return clamp0to10(author * 6 + brand * 4)
        }
      },
      evidenceSupport: {
        name: '可信證據與引用',
        weight: 10,
        features: ['evidenceCountNorm', 'externalCitationCount'],
        score: ({ contentSignals }) => {
          const evidence = clamp01(contentSignals.evidenceCountNorm ?? normalizeEvidenceCount(contentSignals.evidenceCount))
          const citation = clamp01(normalizeCitationCount(contentSignals.externalCitationCount))
          return clamp0to10(evidence * 6 + citation * 4)
        }
      },
      experienceSignals: {
        name: '第一手經驗與案例',
        weight: 11,
        features: ['experienceCueNorm', 'caseStudyCount'],
        score: ({ contentSignals }) => {
          const experience = clamp01(contentSignals.experienceCueNorm ?? normalizeExperienceCue(contentSignals.experienceCueCount))
          const cases = clamp01(normalizeCaseCount(contentSignals.caseStudyCount))
          return clamp0to10(experience * 7 + cases * 3)
        }
      },
      narrativeDensity: {
        name: '敘事具體度與資訊密度',
        weight: 10,
        features: ['uniqueWordRatio', 'entityRichnessNorm'],
        score: ({ contentSignals }) => {
          const unique = clamp01(contentSignals.uniqueWordRatio ?? 0)
          const entity = clamp01(contentSignals.entityRichnessNorm ?? normalizeEntityRichness(contentSignals.entityRichnessCount))
          return clamp0to10(unique * 5 + entity * 5)
        }
      },
      freshnessSignals: {
        name: '時效與更新訊號',
        weight: 6,
        features: ['recentYearCount', 'hasVisibleDate'],
        score: ({ contentSignals }) => {
          const years = clamp01(normalizeRecentYearCount(contentSignals.recentYearCount))
          const visibleDate = contentSignals.hasVisibleDate === true ? 1 : 0
          return clamp0to10(years * 7 + visibleDate * 3)
        }
      },
      expertPerspective: {
        name: '專家觀點與判斷',
        weight: 11,
        features: ['expertTermDensity', 'comparisonCueCount'],
        score: ({ contentSignals }) => {
          const expert = clamp01(normalizeExpertTermDensity(contentSignals.expertTermDensity))
          const comparison = clamp01(normalizeComparisonCue(contentSignals.comparisonCueCount))
          return clamp0to10(expert * 6 + comparison * 4)
        }
      }
    }
  },
  aeo: {
    metrics: {
      extractability: {
        name: '答案可抽取性',
        weight: 12,
        features: ['paragraphExtractability', 'longParagraphPenalty'],
        score: ({ contentSignals }) => {
          const extractability = clamp01(contentSignals.paragraphExtractability ?? normalizeExtractability(contentSignals.paragraphExtractability))
          const longPenalty = clamp01(1 - normalizeLongParagraphPenalty(contentSignals.longParagraphCount, contentSignals.paragraphCount))
          return clamp0to10(extractability * 7 + longPenalty * 3)
        }
      },
      keySummary: {
        name: '關鍵摘要與重點整理',
        weight: 9,
        features: ['hasKeyTakeaways', 'summaryCueCount', 'firstParagraphAnswerQuality'],
        score: ({ contentSignals }) => {
          const takeaways = contentSignals.hasKeyTakeaways ? 1 : 0
          const summaryCues = clamp01(normalizeSummaryCue(contentSignals.summaryCueCount))
          const intro = clamp01(contentSignals.firstParagraphAnswerQuality ?? 0)
          return clamp0to10(takeaways * 4 + summaryCues * 3 + intro * 3)
        }
      },
      conversationalGuidance: {
        name: '對話式語氣與指引',
        weight: 9,
        features: ['semanticNaturalness', 'readerCueCount'],
        score: ({ contentSignals }) => {
          const natural = clamp01(contentSignals.semanticNaturalness ?? 0)
          const readerCue = clamp01(normalizeReaderCue(contentSignals.readerCueCount))
          return clamp0to10(natural * 6 + readerCue * 4)
        }
      },
      readerActivation: {
        name: '讀者互動與後續引導',
        weight: 9,
        features: ['ctaCueCount', 'questionCueCount'],
        score: ({ contentSignals }) => {
          const cta = clamp01(normalizeCtaCue(contentSignals.ctaCueCount))
          const question = clamp01(normalizeQuestionCue(contentSignals.questionCueCount))
          return clamp0to10(cta * 6 + question * 4)
        }
      }
    }
  }
}

const SEO_TARGETS = new Set(Object.keys(DEFAULT_MODEL.seo.metrics || {}))
const AEO_TARGETS = new Set(Object.keys(DEFAULT_MODEL.aeo.metrics || {}))

const TARGET_DISPLAY_NAMES = {
  HelpfulRatio: 'Helpful Ratio',
  intentFit: '搜尋意圖契合',
  depthCoverage: '內容覆蓋與深度',
  intentExpansion: '延伸疑問與關鍵字覆蓋',
  actionability: '行動可行性',
  readabilityRhythm: '可讀性與敘事節奏',
  structureHighlights: '結構化重點提示',
  authorBrandSignals: '作者與品牌辨識',
  evidenceSupport: '可信證據與引用',
  experienceSignals: '第一手經驗與案例',
  narrativeDensity: '敘事具體度與資訊密度',
  freshnessSignals: '時效與更新訊號',
  expertPerspective: '專家觀點與判斷',
  extractability: '答案可抽取性',
  keySummary: '關鍵摘要與重點整理',
  conversationalGuidance: '對話式語氣與指引',
  readerActivation: '讀者互動與後續引導'
}

let cachedModel = null

function cloneModel(model) {
  if (model === null || model === undefined) return model

  if (typeof model !== 'object') {
    return model
  }

  if (Array.isArray(model)) {
    return model.map((item) => cloneModel(item))
  }

  const cloned = {}
  for (const [key, value] of Object.entries(model)) {
    if (typeof value === 'function') {
      cloned[key] = value
    } else {
      cloned[key] = cloneModel(value)
    }
  }
  return cloned
}

function loadConfiguredModel() {
  const globalModel = globalThis.__AEO_SCORING_MODEL__
  if (globalModel && typeof globalModel === 'object') {
    return cloneModel(globalModel)
  }

  const envModel = typeof globalThis.ML_SCORING_MODEL === 'string' ? globalThis.ML_SCORING_MODEL : null
  if (envModel) {
    try {
      const parsed = JSON.parse(envModel)
      if (parsed && typeof parsed === 'object') {
        return cloneModel(parsed)
      }
    } catch (error) {
      console.warn('Failed to parse ML_SCORING_MODEL JSON, using default model.', error)
    }
  }

  return cloneModel(DEFAULT_MODEL)
}

function getModel() {
  if (!cachedModel) {
    cachedModel = loadConfiguredModel()
  }
  return cachedModel
}

export function isScoringModelReady() {
  const model = getModel()
  return Boolean(resolveMetricConfigs(model?.seo).length || resolveMetricConfigs(model?.aeo).length)
}

export function predictSeoMetricScores(context = {}) {
  const model = getModel()
  const metricConfigs = resolveMetricConfigs(model?.seo)
  if (!metricConfigs.length) return null
  const scores = metricConfigs.map((metricConfig) => {
    const scoreFn = typeof metricConfig.score === 'function' ? metricConfig.score : null
    const score = scoreFn ? scoreFn(context) : null
    return {
      name: metricConfig.name,
      score,
      weight: metricConfig.weight,
      features: metricConfig.features
    }
  })
  return createPredictionMap(scores, model.version, 'seo')
}

export function predictAeoMetricScores(context = {}) {
  const model = getModel()
  const metricConfigs = resolveMetricConfigs(model?.aeo)
  if (!metricConfigs.length) return null
  const scores = metricConfigs.map((metricConfig) => {
    const scoreFn = typeof metricConfig.score === 'function' ? metricConfig.score : null
    const score = scoreFn ? scoreFn(context) : null
    return {
      name: metricConfig.name,
      score,
      weight: metricConfig.weight,
      features: metricConfig.features
    }
  })
  return createPredictionMap(scores, model.version, 'aeo')
}

export function resetScoringModelCache() {
  cachedModel = null
}

// ============ 輔助函式 ============

function clamp01(value) {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function clamp0to10(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(10, value))
}

function bonusIfHigh(intent, first) {
  if (intent >= 0.8 && first >= 0.8) return 2
  if (intent >= 0.7 && first >= 0.7) return 1
  return 0
}

function normalizeWordCount(count) {
  if (!count) return 0
  return Math.min(1, count / 2000)
}

function normalizeReferenceKeyword(count) {
  if (!count) return 0
  return Math.min(1, count / 5)
}

function normalizeActionableScore(score) {
  return clamp01(score)
}

function normalizeStepCount(count) {
  if (!count) return 0
  return Math.min(1, count / 10)
}

function normalizeSentenceLength(length) {
  if (!length) return 0
  return Math.min(1, length / 25)
}

function normalizeLongParagraphPenalty(longCount, totalCount) {
  if (!totalCount || totalCount === 0) return 0
  return Math.min(1, longCount / Math.max(2, totalCount * 0.5))
}

function normalizeListCount(count) {
  if (!count) return 0
  return Math.min(1, count / 5)
}

function normalizeTableCount(count) {
  if (!count) return 0
  return Math.min(1, count / 3)
}

function normalizeEntityMention(count) {
  if (!count) return 0
  return Math.min(1, count / 10)
}

function normalizeEvidenceCount(count) {
  if (!count) return 0
  return Math.min(1, count / 8)
}

function normalizeCitationCount(count) {
  if (!count) return 0
  return Math.min(1, count / 10)
}

function normalizeExperienceCue(count) {
  if (!count) return 0
  return Math.min(1, count / 5)
}

function normalizeCaseCount(count) {
  if (!count) return 0
  return Math.min(1, count / 3)
}

function normalizeEntityRichness(count) {
  if (!count) return 0
  return Math.min(1, count / 15)
}

function normalizeRecentYearCount(count) {
  if (!count) return 0
  return Math.min(1, count / 3)
}

function normalizeExtractability(value) {
  return clamp01(value)
}

function normalizeSummaryCue(count) {
  if (!count) return 0
  return Math.min(1, count / 3)
}

function normalizeReaderCue(count) {
  if (!count) return 0
  return Math.min(1, count / 5)
}

function normalizeCtaCue(count) {
  if (!count) return 0
  return Math.min(1, count / 3)
}

function normalizeQuestionCue(count) {
  if (!count) return 0
  return Math.min(1, count / 5)
}

function normalizeExpertTermDensity(density) {
  return clamp01(density)
}

function normalizeComparisonCue(count) {
  if (!count) return 0
  return Math.min(1, count / 3)
}

function resolveMetricConfigs(metricsObj) {
  if (!metricsObj || typeof metricsObj !== 'object') return []

  const container = typeof metricsObj.metrics === 'object' && metricsObj.metrics
    ? metricsObj.metrics
    : metricsObj

  const entries = Array.isArray(container)
    ? container
    : Object.values(container)

  return entries.filter((metric) => metric && typeof metric === 'object' && typeof metric.score === 'function')
}

function createPredictionMap(scores, version, target) {
  if (!Array.isArray(scores) || !scores.length) return null

  const entries = scores.map((s) => ({
    name: s.name,
    score: s.score,
    weight: s.weight,
    features: s.features
  }))

  const map = new Map(entries.map((entry) => [entry.name, {
    score: entry.score,
    weight: entry.weight,
    features: entry.features
  }]))

  return {
    version,
    target,
    predictions: entries,
    predictionMap: map,
    get(name) {
      return this.predictionMap.get(name) || null
    },
    has(name) {
      return this.predictionMap.has(name)
    },
    timestamp: new Date().toISOString()
  }
}
