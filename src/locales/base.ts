/**
 * i18n 基礎配置與類型定義
 * 所有語系都應遵循此結構
 */

export interface LocaleConfig {
  code: string // 語系代碼：'zh-TW', 'en', 'ja'
  name: string // 語系名稱：中文、English、日本語
  direction: 'ltr' | 'rtl' // 文字方向
  dateFormat: string // 日期格式
  numberFormat: Intl.NumberFormat
}

export interface SEOMetadata {
  title: string
  description: string
  keywords?: string[]
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterCard?: string
}

export interface UIStrings {
  // 通用
  common: {
    loading: string
    error: string
    success: string
    cancel: string
    confirm: string
    close: string
    back: string
    next: string
    previous: string
  }

  // 導航與語系切換
  nav: {
    home: string
    about: string
    guides: string
    languageSwitch: string
    selectLanguage: string
  }

  header: {
    title: string
    subtitle: string
    description: string
  }

  // 結果儀表板
  dashboard: {
    totalScore: string
    structureScore: string
    strategyScore: string
    why: string
    how: string
    what: string
    guide: string
    viewGuide: string
    noGuideAvailable: string
    failedToLoadGuide: string
  }

  // 指南相關
  guides: {
    title: string
    description: string
    optimization: string
    reasons: string
    diagnosis: string
    improvements: string
    actions: string
    faq: string
    quickReference: string
  }

  // 非同步分析
  analysis: {
    submitEmail: string
    emailPlaceholder: string
    submit: string
    submitting: string
    checkResults: string
    resultsWillBeSent: string
    enterValidEmail: string
    asyncTitle: string
    asyncDescription: string
    queuedTitle: string
    queuedLine1: string
    queuedLine2: string
    taskIdLabel: string
    durationHint: string
    helperTip: string
    submitFailed: string
  }

  // 指標名稱
  metrics: {
    intentFit: string
    helpfulRatio: string
    depthCoverage: string
    intentExpansion: string
    actionability: string
    readabilityRhythm: string
    structureHighlights: string
    authorBrandSignals: string
    evidenceSupport: string
    experienceSignals: string
    narrativeDensity: string
    freshnessSignals: string
    expertPerspective: string
    extractability: string
    keySummary: string
    conversationalGuidance: string
    readerActivation: string
  }

  // 狀態標籤
  status: {
    excellent: string
    good: string
    fair: string
    poor: string
    veryPoor: string
  }

  // 錯誤訊息
  errors: {
    networkError: string
    serverError: string
    invalidInput: string
    notFound: string
    unauthorized: string
  }

  // 內容提交區塊
  input: {
    contentLabel: string
    contentPlaceholder: string
    wordCountLabel: string
    wordCountUnit: string
    keywordsLabel: string
    keywordsHint: string
    keywordsPlaceholder: string
    emailLabel: string
    emailOptionalHint: string
    emailPlaceholder: string
    submitSync: string
    submitAsync: string
    submitLoading: string
    errorEmptyContent: string
    errorKeywordsRequired: string
    errorKeywordsMax: string
    errorInvalidEmail: string
  }

  // 結果儀表板詳細文案
  results: {
    whyTitle: string
    whyDescription: string
    howTitle: string
    howDescription: string
    whatTitle: string
    whatDescription: string
    overallScoreTitle: string
    overallScoreDescription: string
    structureScoreTitle: string
    structureScoreDescription: string
    strategyScoreTitle: string
    strategyScoreDescription: string
    priorityRecommendations: string
    priorityRecommendationsDescription: string
    structureInsights: string
    structureInsightsDescription: string
    strategyInsights: string
    strategyInsightsDescription: string
    sourceTextReview: string
    sourceTextReviewDescription: string
    paragraph: string
    originalContent: string
    tokens: string
    segments: string
    format: string
    collapse: string
    expand: string
    keySignals: string
    evidencePoints: string
    noMetricsAvailable: string
    insufficientMetadata: string
    metadataUnavailable: string
    schemaUnavailable: string
    undetectableItems: string
    hint: string
    detectionStatus: string
    yes: string
    no: string
    loadGuideError: string
    loadGuideErrorRetry: string
    notEvaluatedYet: string
    excellentPerformance: string
    canBeImproved: string
    priorityImprovement: string
    urgentImprovement: string
    weight: string
    highPriority: string
    mediumPriority: string
    lowPriority: string
    suggestion: string
    category: string
    lowScoreWarning: string
  }

  // ScoreCard 相關文案
  scoreCard: {
    scoreComposition: string
    expandExplanation: string
    collapseExplanation: string
  }

  // 建議清單相關文案
  recommendations: {
    title: string
    noRecommendations: string
    example: string
    helpful: string
    notApplicable: string
    categoryContent: string
    categoryTrust: string
    categoryExperience: string
  }

  // V5 儀表板相關文案
  v5Dashboard: {
    analyzing: string
    noResults: string
    pleaseSubmit: string
    overallScore: string
    outOf: string
    excellent: string
    good: string
    fair: string
    needsImprovement: string
    structureScore: string
    strategyScore: string
    structureDetails: string
    strategyDetails: string
    whyLabel: string
    howLabel: string
    whatLabel: string
    weight: string
    suggestions: string
    detectionStatus: string
    metadataDetectable: string
    schemaDetectable: string
    yes: string
    no: string
  }

  // Email 通知模板
  email: {
    subject: string
    headerTitle: string
    headerSubtitle: string
    scoreLabel: string
    structureWeight: string
    strategyWeight: string
    recommendationsTitle: string
    recommendationsDescription: string
    recommendationsEmpty: string
    todoExampleLabel: string
    viewButton: string
    viewButtonDescription: string
    taskIdLabel: string
    footerNotice: string
    footerNoReply: string
    interpretation: {
      excellent: string
      good: string
      fair: string
      poor: string
    }
    priorityLabelHigh: string
    priorityLabelMedium: string
    priorityLabelLow: string
    textTitle: string
    textScoreHeading: string
    textBreakdownHeading: string
    textRecommendationsHeading: string
    textViewHeading: string
  }

  // 首頁英雄區塊
  hero: {
    intro: string
    disclaimer: string
  }

  // 頁尾
  footer: {
    copy: string
  }

  // 結果頁面相關文案
  resultsPage: {
    missingTaskId: string
    loadingResults: string
    queryingResults: string
    queryFailed: string
    noResults: string
    checkTaskId: string
    backToHome: string
    analysisResults: string
    taskId: string
    completedAt: string
    submittedContent: string
    characterCount: string
    keywords: string
    none: string
    strategyAnalysisDetails: string
    whyProblem: string
    howImplementation: string
    whatSolution: string
    evidence: string
    improvementSuggestions: string
    notFound: string
    resultExpired: string
  }

  // 評分歷史面板相關文案
  scoreHistory: {
    title: string
    description: string
    exportButton: string
    clearButton: string
    noHistory: string
    averageOverallScore: string
    latestTrend: string
    sevenDayAnalysis: string
    nextSchedule: string
    notScheduled: string
    notScheduledHint: string
    trendComparison: string
    sevenDayHint: string
    nextReviewHint: string
    latestRecords: string
    timeHeader: string
    keywordsHeader: string
    overallHeader: string
    aeoHeader: string
    seoHeader: string
    gapHeader: string
    weakFlagsHeader: string
    noGaps: string
    noWeakFlags: string
    exportProcess: string
    maintenanceSuggestions: string
    exportStep1: string
    exportStep2: string
    exportStep3: string
    maintenanceStep1: string
    maintenanceStep2: string
    maintenanceStep3: string
    flat: string
  }
}

export const localeConfigs: Record<string, LocaleConfig> = {
  'zh-TW': {
    code: 'zh-TW',
    name: '繁體中文',
    direction: 'ltr',
    dateFormat: 'yyyy年MM月dd日',
    numberFormat: new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  },
  en: {
    code: 'en',
    name: 'English',
    direction: 'ltr',
    dateFormat: 'MMM dd, yyyy',
    numberFormat: new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  },
  ja: {
    code: 'ja',
    name: '日本語',
    direction: 'ltr',
    dateFormat: 'yyyy年MM月dd日',
    numberFormat: new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  }
}

export const defaultLocale = 'en'
export const supportedLocales = ['zh-TW', 'en', 'ja'] as const
export type SupportedLocale = typeof supportedLocales[number]

/**
 * 根據 IP 地理位置判斷預設語系
 * 此函數應在伺服器端或 CDN 邊緣運行
 */
export function detectLocaleFromIP(countryCode?: string): SupportedLocale {
  if (!countryCode) return defaultLocale

  const countryToLocale: Record<string, SupportedLocale> = {
    TW: 'zh-TW',
    CN: 'zh-TW', // 簡體中文使用者也提供繁體選項
    HK: 'zh-TW',
    MO: 'zh-TW',
    JP: 'ja',
    US: 'en',
    GB: 'en',
    CA: 'en',
    AU: 'en',
    // 其他國家預設為英文
  }

  return countryToLocale[countryCode.toUpperCase()] || defaultLocale
}

/**
 * 根據 Accept-Language 標頭判斷語系
 */
export function detectLocaleFromHeader(acceptLanguage?: string): SupportedLocale {
  if (!acceptLanguage) return defaultLocale

  const languages = acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0].trim().toLowerCase())

  for (const lang of languages) {
    if (lang.includes('zh')) return 'zh-TW'
    if (lang.includes('ja')) return 'ja'
    if (lang.includes('en')) return 'en'
  }

  return defaultLocale
}
