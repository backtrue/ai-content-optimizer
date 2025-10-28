const DEFAULT_MODEL = {
  version: '1.0.0-xgboost-baseline',
  createdAt: '2025-10-28T09:08:31Z',
  description:
    'XGBoost model trained on 19 SERP ranking records. Features importance-weighted for content quality prediction. Test R²: 0.1555. Requires more training data (target: 100+ records) for production use.',
  trainingMetadata: {
    samples: 19,
    features: 33,
    modelType: 'XGBRegressor',
    testR2: 0.1555,
    testRMSE: 12.74,
    topFeatures: ['actionableWeakFlag', 'longParagraphPenalty', 'referenceKeywordNorm', 'avgSentenceLengthNorm', 'uniqueWordRatio']
  },
  seo: {
    metrics: [
      {
        name: 'E-E-A-T 信任線索',
        intercept: 3.8,
        weights: {
          hasAuthorInfo: 2.1,
          hasPublisherInfo: 1.2,
          hasArticleSchema: 0.6,
          authorityLinkPresent: 1.3,
          evidenceCountNorm: 2.0,
          experienceCueNorm: 1.0,
          hcuYesRatio: 1.2,
          hcuNoRatio: -2.5,
          missingAuthorFlag: -1.6,
          missingPublisherFlag: -1.2,
          missingCanonicalFlag: -0.4
        }
      },
      {
        name: '內容品質與原創性',
        intercept: 3.6,
        weights: {
          wordCountNorm: 2.2,
          paragraphCountNorm: 1.5,
          evidenceCountNorm: 1.8,
          uniqueWordRatio: 2.4,
          actionableScoreNorm: 1.4,
          experienceCueNorm: 1.2,
          hcuYesRatio: 1.1,
          hcuNoRatio: -2.2,
          depthLowFlag: -2.8
        }
      },
      {
        name: '人本與主題一致性',
        intercept: 3.5,
        weights: {
          titleIntentMatch: 3.0,
          actionableScoreNorm: 1.4,
          referenceKeywordNorm: 1.2,
          hasH1Keyword: 1.2,
          hcuYesRatio: 1.0,
          hcuNoRatio: -2.0,
          actionableWeakFlag: -1.6,
          missingH1Flag: -1.4
        }
      },
      {
        name: '標題與承諾落實',
        intercept: 4.0,
        weights: {
          titleIntentMatch: 2.5,
          metaDescriptionPresent: 1.0,
          hasUniqueTitle: 1.3,
          actionableScoreNorm: 1.0,
          hcuYesRatio: 0.8,
          hcuNoRatio: -1.6,
          missingH1Flag: -1.5,
          titleMismatchFlag: -2.5
        }
      },
      {
        name: '搜尋意圖契合度',
        intercept: 3.9,
        weights: {
          h2CountNorm: 2.0,
          paragraphCountNorm: 1.6,
          actionableScoreNorm: 1.5,
          wordCountNorm: 1.5,
          hcuYesRatio: 1.1,
          hcuNoRatio: -2.4,
          depthLowFlag: -1.8,
          h2CoverageMissing: -2.2,
          actionableWeakFlag: -1.6
        }
      },
      {
        name: '新鮮度與時效性',
        intercept: 3.2,
        weights: {
          hasPublishedDate: 2.2,
          hasVisibleDate: 1.0,
          hasModifiedDate: 1.0,
          recentYearNorm: 2.4,
          hcuYesRatio: 0.6,
          hcuNoRatio: -1.4,
          freshnessWeakFlag: -2.4
        }
      },
      {
        name: '使用者安全與風險',
        intercept: 4.0,
        weights: {
          metaDescriptionPresent: 1.4,
          canonicalPresent: 1.2,
          evidenceCountNorm: 1.0,
          actionableScoreNorm: 0.8,
          externalLinkPresent: 0.8,
          hcuNoRatio: -1.6,
          missingCanonicalFlag: -1.2,
          missingMetaFlag: -1.5
        }
      },
      {
        name: '結構與可讀性',
        intercept: 3.8,
        weights: {
          paragraphCountNorm: 1.8,
          h2CountNorm: 1.6,
          listPresent: 1.2,
          tablePresent: 0.9,
          longParagraphPenalty: -2.5,
          readabilityWeakFlag: -2.8,
          hcuYesRatio: 0.9,
          hcuNoRatio: -1.8
        }
      }
    ]
  },
  aeo: {
    metrics: [
      {
        name: '段落獨立性',
        intercept: 3.6,
        weights: {
          paragraphCountNorm: 2.2,
          h2CountNorm: 2.0,
          listPresent: 1.0,
          tablePresent: 0.6,
          longParagraphPenalty: -2.4,
          hcuYesRatio: 1.2,
          hcuNoRatio: -2.2
        }
      },
      {
        name: '語言清晰度',
        intercept: 4.2,
        weights: {
          avgSentenceLengthNorm: 1.5,
          uniqueWordRatio: 1.6,
          readabilityWeakFlag: -2.4,
          hcuYesRatio: 1.0,
          hcuNoRatio: -2.0,
          longParagraphPenalty: -1.2
        }
      },
      {
        name: '實體辨識',
        intercept: 4.0,
        weights: {
          entityRichnessNorm: 2.4,
          evidenceCountNorm: 1.2,
          authorityLinkPresent: 1.0,
          hcuYesRatio: 0.8,
          hcuNoRatio: -1.4
        }
      },
      {
        name: '邏輯流暢度',
        intercept: 4.0,
        weights: {
          paragraphCountNorm: 1.4,
          h2CountNorm: 1.4,
          actionableScoreNorm: 1.0,
          longParagraphPenalty: -1.6,
          readabilityWeakFlag: -1.8,
          hcuYesRatio: 0.9,
          hcuNoRatio: -1.6
        }
      },
      {
        name: '可信度信號',
        intercept: 3.5,
        weights: {
          evidenceCountNorm: 2.2,
          authorityLinkPresent: 1.4,
          hasAuthorInfo: 1.2,
          hasPublisherInfo: 1.0,
          hcuYesRatio: 0.9,
          hcuNoRatio: -2.0,
          experienceCueNorm: 1.0
        }
      }
    ]
  }
}

let cachedModel = null

function cloneModel(model) {
  if (!model) return null
  if (typeof structuredClone === 'function') return structuredClone(model)
  return JSON.parse(JSON.stringify(model))
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
  if (cachedModel) return cachedModel
  cachedModel = loadConfiguredModel()
  return cachedModel
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function clamp0to10(value) {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 10) return 10
  return value
}

function normalize(value, max) {
  if (!Number.isFinite(value)) return 0
  if (max <= 0) return 0
  return clamp01(value / max)
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safeBoolean(value) {
  return value ? 1 : 0
}

function buildFeatureVector(context = {}) {
  const signals = context.contentSignals || {}
  const flags = context.contentQualityFlags || {}
  const missing = context.missingCritical || {}
  const hcuCounts = context.hcuCounts || { yes: 0, partial: 0, no: 0 }

  const totalHcu = hcuCounts.yes + hcuCounts.partial + hcuCounts.no
  const hcuYesRatio = totalHcu > 0 ? hcuCounts.yes / totalHcu : 0
  const hcuPartialRatio = totalHcu > 0 ? hcuCounts.partial / totalHcu : 0
  const hcuNoRatio = totalHcu > 0 ? hcuCounts.no / totalHcu : 0

  const actionableScore = safeNumber(signals.actionableScore ?? flags.actionableScore)
  const evidenceCount = safeNumber(signals.evidenceCount ?? flags.evidenceCount)
  const experienceCueCount = safeNumber(signals.experienceCueCount ?? flags.experienceCueCount)
  const referenceKeywordCount = safeNumber(signals.referenceKeywordCount)
  const sentenceCount = safeNumber(signals.sentenceCount)
  const avgSentenceLength = safeNumber(signals.avgSentenceLength)

  const uniqueWordRatio = Number.isFinite(signals.uniqueWordRatio)
    ? clamp01(signals.uniqueWordRatio)
    : Number.isFinite(flags.uniqueWordRatio)
    ? clamp01(flags.uniqueWordRatio)
    : 0

  const entityRichnessNorm = normalize(safeNumber(signals.keywordSample?.length || 0), 8)

  return {
    wordCountNorm: normalize(safeNumber(signals.wordCount), 1500),
    paragraphCountNorm: normalize(safeNumber(signals.paragraphCount), 12),
    h2CountNorm: normalize(safeNumber(signals.h2Count), 8),
    actionableScoreNorm: normalize(actionableScore, 4),
    evidenceCountNorm: normalize(evidenceCount, 6),
    experienceCueNorm: normalize(experienceCueCount, 4),
    recentYearNorm: normalize(safeNumber(signals.recentYearCount ?? flags.recentYearCount), 3),
    uniqueWordRatio,
    titleIntentMatch: clamp01(safeNumber(signals.titleIntentMatch ?? flags.titleIntentMatch)),
    referenceKeywordNorm: normalize(referenceKeywordCount, 6),
    hasH1Keyword: safeBoolean(signals.h1ContainsKeyword),
    hasUniqueTitle: safeBoolean(signals.hasUniqueTitle),
    hasAuthorInfo: safeBoolean(signals.hasAuthorInfo),
    hasPublisherInfo: safeBoolean(signals.hasPublisherInfo),
    hasArticleSchema: safeBoolean(signals.hasArticleSchema),
    hasPublishedDate: safeBoolean(signals.hasPublishedDate),
    hasModifiedDate: safeBoolean(signals.hasModifiedDate),
    hasVisibleDate: safeBoolean(signals.hasVisibleDate),
    metaDescriptionPresent: safeBoolean(signals.hasMetaDescription),
    canonicalPresent: safeBoolean(signals.hasCanonical),
    externalLinkPresent: safeBoolean(safeNumber(signals.externalLinkCount) > 0),
    authorityLinkPresent: safeBoolean(safeNumber(signals.externalAuthorityLinkCount) > 0),
    listPresent: safeBoolean(safeNumber(signals.listCount) > 0),
    tablePresent: safeBoolean(safeNumber(signals.tableCount) > 0),
    longParagraphPenalty: safeBoolean(safeNumber(signals.paragraphAverageLength) > 420),
    avgSentenceLengthNorm: normalize(avgSentenceLength || (sentenceCount ? safeNumber(signals.wordCount) / sentenceCount : 0), 40),
    entityRichnessNorm,
    depthLowFlag: safeBoolean(flags.depthLow),
    readabilityWeakFlag: safeBoolean(flags.readabilityWeak),
    actionableWeakFlag: safeBoolean(flags.actionableWeak),
    freshnessWeakFlag: safeBoolean(flags.freshnessWeak),
    titleMismatchFlag: safeBoolean(flags.titleMismatch),
    missingAuthorFlag: safeBoolean(missing.author),
    missingPublisherFlag: safeBoolean(missing.publisher),
    missingCanonicalFlag: safeBoolean(missing.canonical),
    missingMetaFlag: safeBoolean(missing.metaDescription),
    missingH1Flag: safeBoolean(missing.h1Count),
    h2CoverageMissing: safeBoolean(missing.h2Coverage),
    paragraphsLongFlag: safeBoolean(missing.paragraphsLong),
    hcuYesRatio,
    hcuPartialRatio,
    hcuNoRatio
  }
}

function computeMetricScore(metricConfig, features) {
  let rawScore = safeNumber(metricConfig.intercept, 0)
  const contributions = {}

  if (metricConfig.weights && typeof metricConfig.weights === 'object') {
    for (const [featureKey, weight] of Object.entries(metricConfig.weights)) {
      const featureValue = features[featureKey] ?? 0
      const contribution = featureValue * weight
      contributions[featureKey] = contribution
      rawScore += contribution
    }
  }

  if (metricConfig.activation === 'sigmoid') {
    const activated = 1 / (1 + Math.exp(-rawScore))
    const score = clamp0to10(activated * 10)
    return { score, rawScore: activated * 10, contributions }
  }

  const score = clamp0to10(rawScore)
  return { score, rawScore, contributions }
}

function createPredictionMap(results, modelVersion) {
  if (!Array.isArray(results) || !results.length) return null
  const map = new Map()
  results.forEach((item) => {
    if (item && typeof item.name === 'string') {
      map.set(item.name, {
        name: item.name,
        score: item.score,
        rawScore: item.rawScore,
        contributions: item.contributions,
        modelVersion
      })
    }
  })
  return map
}

export function isScoringModelReady() {
  const model = getModel()
  return Boolean(model?.seo?.metrics?.length || model?.aeo?.metrics?.length)
}

export function predictSeoMetricScores(context = {}) {
  const model = getModel()
  if (!model?.seo?.metrics?.length) return null
  const features = buildFeatureVector(context)
  const results = model.seo.metrics.map((metricConfig) => {
    const { score, rawScore, contributions } = computeMetricScore(metricConfig, features)
    return { name: metricConfig.name, score, rawScore, contributions }
  })
  return createPredictionMap(results, model.version)
}

export function predictAeoMetricScores(context = {}) {
  const model = getModel()
  if (!model?.aeo?.metrics?.length) return null
  const features = buildFeatureVector(context)
  const results = model.aeo.metrics.map((metricConfig) => {
    const { score, rawScore, contributions } = computeMetricScore(metricConfig, features)
    return { name: metricConfig.name, score, rawScore, contributions }
  })
  return createPredictionMap(results, model.version)
}

export function resetScoringModelCache() {
  cachedModel = null
}
