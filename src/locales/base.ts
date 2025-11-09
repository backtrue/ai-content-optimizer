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
