import type { UIStrings, SEOMetadata } from './base'

export const zhTWStrings: UIStrings = {
  common: {
    loading: '載入中...',
    error: '發生錯誤',
    success: '成功',
    cancel: '取消',
    confirm: '確認',
    close: '關閉',
    back: '返回',
    next: '下一步',
    previous: '上一步'
  },

  nav: {
    home: '首頁',
    about: '關於',
    guides: '優化指南',
    languageSwitch: '語言',
    selectLanguage: '選擇語言'
  },

  dashboard: {
    totalScore: '總分',
    structureScore: '結構分',
    strategyScore: '策略分',
    why: 'WHY - 問題定義',
    how: 'HOW - 實現方法',
    what: 'WHAT - 解決方案',
    guide: '指南',
    viewGuide: '查看優化指南',
    noGuideAvailable: '暫無指南',
    failedToLoadGuide: '無法載入優化指南'
  },

  guides: {
    title: '優化指南',
    description: '詳細的內容優化建議',
    optimization: '優化指南',
    reasons: '根本原因',
    diagnosis: '診斷方法',
    improvements: '改善策略',
    actions: '具體行動',
    faq: '常見問題',
    quickReference: '快速參考'
  },

  analysis: {
    submitEmail: '提交電子郵件',
    emailPlaceholder: '請輸入您的電子郵件',
    submit: '提交',
    submitting: '提交中...',
    checkResults: '檢查結果',
    resultsWillBeSent: '分析結果將發送至您的電子郵件',
    enterValidEmail: '請輸入有效的電子郵件地址'
  },

  metrics: {
    intentFit: '搜尋意圖契合',
    helpfulRatio: 'Helpful Ratio',
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
  },

  status: {
    excellent: '優秀',
    good: '良好',
    fair: '尚可',
    poor: '需改進',
    veryPoor: '急需改進'
  },

  errors: {
    networkError: '網路連線錯誤',
    serverError: '伺服器錯誤',
    invalidInput: '輸入無效',
    notFound: '找不到',
    unauthorized: '未授權'
  }
}

export const zhTWSEO: Record<string, SEOMetadata> = {
  home: {
    title: '源策 (SrcRank): 您的 AI 內容策略顧問',
    description:
      '「報數據」提供客觀指標，「源策」評估內容靈魂。源策 (SrcRank) 是一個專為 AEO/GEO 時代打造的自適應評分演算法，它同時評估您內容的「內容結構」與「AI 策略說服力」。我們不再只評估關鍵字，而是讓 AI 深度解讀您內容的核心論述，幫助您的內容從「資訊」升級為「可信的引用來源」。',
    keywords: ['SEO', 'AEO', '內容優化', 'AI 分析', '搜尋排名']
  },
  guides: {
    title: '優化指南 - AI 內容優化大師',
    description: '針對每個評分指標的詳細優化指南，幫助您理解低分原因並提供改善策略。'
  }
}
