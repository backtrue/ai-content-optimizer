const SEO_TARGETS = new Set([
  'score_hcu_proxy',
  'score_eeat_proxy'
])

const AEO_TARGETS = new Set(['score_aeo_proxy'])

const TARGET_DISPLAY_NAMES = {
  score_hcu_proxy: 'HCU Helpful Content Proxy',
  score_eeat_proxy: 'E-E-A-T Proxy',
  score_aeo_proxy: 'AEO Proxy'
}

const DEFAULT_MODEL = {
  version: '2025-11-02-serp-page1',
  createdAt: '2025-11-02T03:58:46Z',
  description: 'Logistic re-calibration from SERP page-one positives (HCU/EEAT/AEO proxies)',
  trainingMetadata: {
    samples: 1345,
    features: 73,
    modelType: 'logistic-regression',
    notes: '手動推導自 XGBoost 特徵重要性與正例資料集，保留原有線性評分流程'
  },
  dataset: {
    path: 'ml/page1_positive_samples.csv',
    records: 1345,
    feature_columns: [
      'serp_rank',
      'target_score',
      'wordCountNorm',
      'paragraphCountNorm',
      'h2CountNorm',
      'actionableScoreNorm',
      'evidenceCountNorm',
      'experienceCueNorm',
      'recentYearNorm',
      'uniqueWordRatio',
      'titleIntentMatch',
      'referenceKeywordNorm',
      'hasH1Keyword',
      'hasUniqueTitle',
      'hasAuthorInfo',
      'hasPublisherInfo',
      'hasArticleSchema',
      'hasPublishedDate',
      'hasModifiedDate',
      'hasVisibleDate',
      'metaDescriptionPresent',
      'canonicalPresent',
      'externalLinkPresent',
      'authorityLinkPresent',
      'listPresent',
      'tablePresent',
      'longParagraphPenalty',
      'avgSentenceLengthNorm',
      'depthLowFlag',
      'readabilityWeakFlag',
      'actionableWeakFlag',
      'freshnessWeakFlag',
      'titleMismatchFlag',
      'hcuYesRatio',
      'hcuNoRatio',
      'hcuPartialRatio',
      'hcuContentHelpfulness',
      'qaFormatScore',
      'firstParagraphAnswerQuality',
      'semanticParagraphFocus',
      'headingHierarchyQuality',
      'topicCohesion',
      'faqSchemaPresent',
      'howtoSchemaPresent',
      'articleSchemaPresent',
      'organizationSchemaPresent',
      'ogTagsComplete',
      'metaTagsQuality',
      'htmlStructureValidity',
      'authorInfoPresent',
      'brandEntityClarity',
      'externalCitationCount',
      'socialMediaLinksPresent',
      'reviewRatingPresent',
      'semanticNaturalness',
      'paragraphExtractability',
      'richSnippetFormat',
      'citabilityTrustScore',
      'multimediaSupport',
      'analysis_http_status',
      'analysis_error_code',
      'analysis_attempts',
      'entityRichnessNorm',
      'missingAuthorFlag',
      'missingPublisherFlag',
      'missingCanonicalFlag',
      'missingMetaFlag',
      'missingH1Flag',
      'h2CoverageMissing',
      'paragraphsLongFlag'
    ]
  },
  hyperparameters: {
    n_estimators: 200,
    max_depth: 5,
    learning_rate: 0.08,
    subsample: 0.8,
    colsample_bytree: 0.8,
    random_state: 42,
    reg_lambda: 1,
    min_child_weight: 1
  },
  targets: {
    score_hcu_proxy: {
      metrics: {
        train_rmse: 0.14636306390866977,
        train_mae: 0.1096221872677064,
        train_r2: 0.9996996807193225,
        test_rmse: 1.038821306504367,
        test_mae: 0.6645446047664398,
        test_r2: 0.9792769933946864,
        cv_r2_mean: 0.9272366070042087,
        cv_r2_std: 0.11611927512133675
      },
      featureImportance: {
        hcuNoRatio: 0.38592976331710815,
        listPresent: 0.1817331463098526,
        hcuYesRatio: 0.17839081585407257,
        hcuContentHelpfulness: 0.0823281854391098,
        tablePresent: 0.04384326562285423,
        hcuPartialRatio: 0.028851637616753578,
        wordCountNorm: 0.02698330767452717,
        avgSentenceLengthNorm: 0.017625009641051292,
        h2CountNorm: 0.008576633408665657,
        hasArticleSchema: 0.00808789674192667,
        metaDescriptionPresent: 0.007322113029658794,
        canonicalPresent: 0.00580165209248662,
        uniqueWordRatio: 0.005308046936988831,
        target_score: 0.004979643505066633,
        hasH1Keyword: 0.00462878355756402,
        referenceKeywordNorm: 0.003904263488948345,
        hasVisibleDate: 0.0022170410957187414,
        hasUniqueTitle: 0.0011213389225304127,
        analysis_attempts: 0.0008962113060988486,
        serp_rank: 0.0008150492212735116
      },
      modelPath: 'ml/models/score_hcu_proxy.json'
    },
    score_eeat_proxy: {
      metrics: {
        train_rmse: 0.15678635971082622,
        train_mae: 0.050606046803595824,
        train_r2: 0.9999851144907551,
        test_rmse: 0.3694621697622902,
        test_mae: 0.12338946797770704,
        test_r2: 0.9999207725492337,
        cv_r2_mean: 0.9639808330168096,
        cv_r2_std: 0.0638254604472671
      },
      featureImportance: {
        depthLowFlag: 0.9575852155685425,
        uniqueWordRatio: 0.03359594941139221,
        avgSentenceLengthNorm: 0.00450942711904645,
        hasVisibleDate: 0.002495763124898076,
        canonicalPresent: 0.0007051031570881605,
        hasUniqueTitle: 0.0006417009863071144,
        referenceKeywordNorm: 0.0001980849337996915,
        metaDescriptionPresent: 0.00014637813728768378,
        hasH1Keyword: 0.000054810756410006434,
        readabilityWeakFlag: 0.000023275380954146385,
        hcuNoRatio: 0.000009716589374875184,
        h2CountNorm: 0.000008846269338391721,
        hcuContentHelpfulness: 0.000007927957994979806,
        wordCountNorm: 0.000004394982170197181,
        listPresent: 0.000004061183517478639,
        hcuPartialRatio: 0.0000037918721318419557,
        hcuYesRatio: 0.0000016812450667202938,
        serp_rank: 0.000001201063582811912,
        analysis_attempts: 0.0000011106247939096647,
        target_score: 0.0000007476599535038986
      },
      modelPath: 'ml/models/score_eeat_proxy.json'
    },
    score_aeo_proxy: {
      metrics: {
        train_rmse: 0.06933942385947502,
        train_mae: 0.03926012172544234,
        train_r2: 0.9998377736000212,
        test_rmse: 2.954804829861603,
        test_mae: 0.6689611039502176,
        test_r2: 0.8090589102216745,
        cv_r2_mean: 0.7371266106518123,
        cv_r2_std: 0.24633728947132386
      },
      featureImportance: {
        listPresent: 0.3809288740158081,
        metaDescriptionPresent: 0.2833498418331146,
        tablePresent: 0.09195628762245178,
        hcuYesRatio: 0.06168481707572937,
        hcuContentHelpfulness: 0.055709585547447205,
        hcuPartialRatio: 0.03291266784071922,
        hasUniqueTitle: 0.031187327578663826,
        hcuNoRatio: 0.008556314744055271,
        hasH1Keyword: 0.008518756367266178,
        hasArticleSchema: 0.007287164684385061,
        wordCountNorm: 0.0058289142325520515,
        uniqueWordRatio: 0.005277007352560759,
        serp_rank: 0.004822743125259876,
        hasVisibleDate: 0.004676505457609892,
        target_score: 0.00456983270123601,
        avgSentenceLengthNorm: 0.004107132088392973,
        referenceKeywordNorm: 0.0036843735724687576,
        canonicalPresent: 0.0022990084253251553,
        h2CountNorm: 0.0012330744648352265,
        readabilityWeakFlag: 0.0007190345786511898
      },
      modelPath: 'ml/models/score_aeo_proxy.json'
    }
  },
  seo: {
    metrics: {
      eeatSignals: {
        name: 'E-E-A-T 信任線索',
        intercept: 3.6,
        activation: 'sigmoid',
        weights: {
          hcuContentHelpfulness: 1.8,
          hcuYesRatio: 1.4,
          experienceCueNorm: 1.6,
          evidenceCountNorm: 1.5,
          externalCitationCount: 0.8,
          authorityLinkPresent: 0.9,
          hasAuthorInfo: 1.2,
          hasPublisherInfo: 1.0,
          organizationSchemaPresent: 0.7,
          reviewRatingPresent: 0.6,
          socialMediaLinksPresent: 0.5,
          hasArticleSchema: 0.5,
          canonicalPresent: 0.6,
          metaDescriptionPresent: 0.6,
          brandEntityClarity: 0.9,
          htmlStructureValidity: 0.4,
          missingAuthorFlag: -1.8,
          missingPublisherFlag: -1.4,
          missingCanonicalFlag: -1.0,
          missingMetaFlag: -1.1,
          hcuNoRatio: -2.6
        }
      },
      contentQuality: {
        name: '內容品質與原創性',
        intercept: 3.4,
        activation: 'sigmoid',
        weights: {
          wordCountNorm: 1.2,
          paragraphCountNorm: 1.0,
          uniqueWordRatio: 1.4,
          actionableScoreNorm: 1.3,
          evidenceCountNorm: 1.1,
          experienceCueNorm: 1.2,
          qaFormatScore: 0.8,
          firstParagraphAnswerQuality: 0.8,
          semanticParagraphFocus: 0.7,
          topicCohesion: 0.9,
          hcuContentHelpfulness: 0.8,
          listPresent: 0.6,
          tablePresent: 0.5,
          referenceKeywordNorm: 0.7,
          entityRichnessNorm: 0.9,
          paragraphExtractability: 0.6,
          depthLowFlag: -2.2,
          readabilityWeakFlag: -2.0,
          longParagraphPenalty: -1.5,
          actionableWeakFlag: -1.4,
          hcuNoRatio: -2.0
        }
      },
      humanCentricity: {
        name: '人本與主題一致性',
        intercept: 3.3,
        activation: 'sigmoid',
        weights: {
          titleIntentMatch: 1.6,
          referenceKeywordNorm: 1.0,
          actionableScoreNorm: 0.9,
          hcuContentHelpfulness: 0.8,
          qaFormatScore: 0.9,
          semanticParagraphFocus: 0.8,
          topicCohesion: 0.8,
          paragraphExtractability: 0.6,
          hasUniqueTitle: 0.6,
          hasH1Keyword: 0.7,
          hcuYesRatio: 0.6,
          hcuPartialRatio: 0.3,
          hcuNoRatio: -1.8,
          titleMismatchFlag: -2.2,
          actionableWeakFlag: -1.2,
          missingH1Flag: -1.6
        }
      },
      promiseFulfillment: {
        name: '標題與承諾落實',
        intercept: 3.5,
        activation: 'sigmoid',
        weights: {
          titleIntentMatch: 1.4,
          qaFormatScore: 0.8,
          firstParagraphAnswerQuality: 0.8,
          metaDescriptionPresent: 0.8,
          hasUniqueTitle: 0.9,
          hasPublishedDate: 0.6,
          hasVisibleDate: 0.6,
          hcuContentHelpfulness: 0.6,
          actionableScoreNorm: 0.7,
          hcuYesRatio: 0.5,
          hcuNoRatio: -1.4,
          titleMismatchFlag: -2.6,
          missingH1Flag: -1.3,
          actionableWeakFlag: -1.1
        }
      },
      intentAlignment: {
        name: '搜尋意圖契合度',
        intercept: 3.4,
        activation: 'sigmoid',
        weights: {
          h2CountNorm: 1.4,
          paragraphCountNorm: 1.2,
          paragraphExtractability: 1.1,
          wordCountNorm: 1.0,
          actionableScoreNorm: 1.0,
          listPresent: 0.7,
          tablePresent: 0.5,
          qaFormatScore: 0.9,
          semanticParagraphFocus: 0.8,
          topicCohesion: 0.8,
          hcuYesRatio: 0.5,
          hcuNoRatio: -1.8,
          h2CoverageMissing: -2.4,
          depthLowFlag: -1.6,
          actionableWeakFlag: -1.3
        }
      },
      freshness: {
        name: '新鮮度與時效性',
        intercept: 3.2,
        activation: 'sigmoid',
        weights: {
          hasPublishedDate: 1.2,
          hasVisibleDate: 0.9,
          hasModifiedDate: 0.9,
          recentYearNorm: 1.4,
          semanticNaturalness: 0.5,
          hcuYesRatio: 0.4,
          hcuNoRatio: -1.2,
          freshnessWeakFlag: -2.0
        }
      },
      safetyGuard: {
        name: '使用者安全與風險',
        intercept: 3.6,
        activation: 'sigmoid',
        weights: {
          metaDescriptionPresent: 1.0,
          canonicalPresent: 0.9,
          evidenceCountNorm: 0.9,
          externalLinkPresent: 0.7,
          authorityLinkPresent: 0.8,
          actionableScoreNorm: 0.6,
          hcuNoRatio: -1.3,
          missingCanonicalFlag: -1.5,
          missingMetaFlag: -1.6,
          paragraphsLongFlag: -1.0
        }
      },
      structureReadability: {
        name: '結構與可讀性',
        intercept: 3.4,
        activation: 'sigmoid',
        weights: {
          paragraphCountNorm: 1.1,
          h2CountNorm: 1.0,
          listPresent: 0.8,
          tablePresent: 0.6,
          paragraphExtractability: 0.8,
          richSnippetFormat: 0.6,
          avgSentenceLengthNorm: -1.2,
          readabilityWeakFlag: -2.0,
          longParagraphPenalty: -1.6,
          paragraphsLongFlag: -1.4,
          hcuYesRatio: 0.4,
          hcuNoRatio: -1.2
        }
      }
    }
  },
  aeo: {
    metrics: {
      paragraphIndependence: {
        name: '段落獨立性',
        intercept: 3.5,
        activation: 'sigmoid',
        weights: {
          paragraphExtractability: 1.5,
          paragraphCountNorm: 1.2,
          listPresent: 1.0,
          tablePresent: 0.8,
          qaFormatScore: 0.9,
          longParagraphPenalty: -1.8,
          paragraphsLongFlag: -1.6,
          hcuYesRatio: 0.6,
          hcuNoRatio: -1.6
        }
      },
      languageClarity: {
        name: '語言清晰度',
        intercept: 3.8,
        activation: 'sigmoid',
        weights: {
          avgSentenceLengthNorm: -1.6,
          readabilityWeakFlag: -1.8,
          uniqueWordRatio: 1.2,
          semanticNaturalness: 1.0,
          topicCohésion: 0.6,
          paragraphóbel: -0.8,
          hcuYesRatio: 0.5,
          hcuNoRatio: -1.4
        }
      },
      entityRecognition: {
        name: '實體辨識',
        intercept: 3.4,
        activation: 'sigmoid',
        weights: {
          entityRichnessNorm: 1.4,
          externalCitationCount: 1.0,
          authorityLinkPresent: 0.9,
          evidenceCountNorm: 0.9,
          experienceCueNorm: 0.8,
          brandEntityClarity: 0.7,
          socialMediaLinksPresent: 0.5,
          reviewRatingPresent: 0.5,
          hcuYesRatio: 0.5,
          hcuNoRatio: -1.4
        }
      },
      logicFlow: {
        name: '邏輯流暢度',
        intercept: 3.6,
        activation: 'sigmoid',
        weights: {
          paragraphCountNorm: 1.0,
          paragraphExtractability: 0.9,
          semanticParagraphFocus: 0.9,
          topicCohesion: 0.9,
          actionableScoreNorm: 0.8,
          qaFormatScore: 0.8,
          hcuYesRatio: 0.5,
          hcuNoRatio: -1.2,
          readabilityWeakFlag: -1.4,
          longParagraphPenalty: -1.3
        }
      },
      credibilitySignals: {
        name: '可信度信號',
        intercept: 3.5,
        activation: 'sigmoid',
        weights: {
          evidenceCountNorm: 1.3,
          externalCitationCount: 1.0,
          authorityLinkPresent: 1.0,
          hasArticleSchema: 0.7,
          hasAuthorInfo: 0.8,
          hasPublisherInfo: 0.7,
          hcuContentHelpfulness: 0.8,
          citabilityTrustScore: 0.8,
          richSnippetFormat: 0.6,
          hcuYesRatio: 0.5,
          hcuNoRatio: -1.3
        }
      }
    }
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

function resolveMetricConfigs(section) {
  if (!section || !section.metrics) return []
  const { metrics } = section
  if (Array.isArray(metrics)) {
    return metrics
      .filter((metric) => metric && typeof metric === 'object' && typeof metric.name === 'string')
  }

  if (metrics && typeof metrics === 'object') {
    return Object.entries(metrics)
      .map(([slug, metric]) => {
        if (!metric || typeof metric !== 'object') return null
        const name = typeof metric.name === 'string' ? metric.name : TARGET_DISPLAY_NAMES[slug] || slug
        return { slug, ...metric, name }
      })
      .filter(Boolean)
  }

  return []
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
  return Boolean(resolveMetricConfigs(model?.seo).length || resolveMetricConfigs(model?.aeo).length)
}

export function predictSeoMetricScores(context = {}) {
  const model = getModel()
  const metricConfigs = resolveMetricConfigs(model?.seo)
  if (!metricConfigs.length) return null
  const features = buildFeatureVector(context)
  const results = metricConfigs.map((metricConfig) => {
    const { score, rawScore, contributions } = computeMetricScore(metricConfig, features)
    return { name: metricConfig.name, score, rawScore, contributions }
  })
  return createPredictionMap(results, model.version)
}

export function predictAeoMetricScores(context = {}) {
  const model = getModel()
  const metricConfigs = resolveMetricConfigs(model?.aeo)
  if (!metricConfigs.length) return null
  const features = buildFeatureVector(context)
  const results = metricConfigs.map((metricConfig) => {
    const { score, rawScore, contributions } = computeMetricScore(metricConfig, features)
    return { name: metricConfig.name, score, rawScore, contributions }
  })
  return createPredictionMap(results, model.version)
}

export function resetScoringModelCache() {
  cachedModel = null
}
