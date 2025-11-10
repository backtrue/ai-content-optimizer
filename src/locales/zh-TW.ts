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

  header: {
    title: '源策 (SrcRank): 您的 AI 內容策略顧問',
    subtitle: '結合 AEO/GEO 評分標準，打造可被 AI 引用的內容體系',
    description:
      '源策以雙軸評分架構評估內容的「結構完整性」與「AI 策略說服力」，協助您在生成式 AI 時代成為可信的引用來源。'
  },

  hero: {
    intro:
      '本工具由台灣 SEO 專家<strong>邱煜庭（小黑老師）</strong>歷時多年的實戰研究打造，評分邏輯結合 Google 官方《搜尋品質評分者指南》、Helpful Content Update (HCU) 以及各項國際 SEO 評估標準，協助判斷文章是否貼近 Google 喜好並提高被 AI 模型引用的機會。',
    disclaimer:
      '免責聲明：本工具僅作為第三方檢測與優化建議參考，無法保證搜尋排名或流量成長。'
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
    enterValidEmail: '請輸入有效的電子郵件地址',
    asyncTitle: '非同步分析',
    asyncDescription: '輸入您的 Email，分析完成後我們會寄送結果連結。',
    queuedTitle: '分析已提交',
    queuedLine1: '您的內容已加入分析序列。',
    queuedLine2: '分析完成後，系統將把結果寄送至：',
    taskIdLabel: '任務 ID',
    durationHint: '分析通常需要 1-5 分鐘。請使用 Email 內的連結查看完整結果。',
    helperTip: '提示：非同步分析在背景執行，處理期間您可以持續作業。',
    submitFailed: '提交失敗，請重試。'
  },

  email: {
    subject: '✅ 您的內容分析結果已完成',
    headerTitle: '✨ 分析完成',
    headerSubtitle: '您的內容已完成 AI 策略評估',
    scoreLabel: '綜合評分 / 100',
    structureWeight: '結構分 · 40% 權重',
    strategyWeight: '策略分 · 60% 權重',
    recommendationsTitle: '優先待辦清單',
    recommendationsDescription: '以下為依優先級整理的建議，建議先處理紅色標記項目以快速拉升分數。',
    recommendationsEmpty: '太棒了！目前沒有需要立即處理的待辦事項。',
    todoExampleLabel: '範例',
    viewButton: '查看完整結果',
    viewButtonDescription: '點擊按鈕查看詳細分數拆解、WHY/HOW/WHAT 分析與優化建議。',
    taskIdLabel: '任務 ID',
    footerNotice: '© 2025 SrcRank | ',
    footerNoReply: '此 Email 為系統自動寄送，請勿直接回覆。',
    interpretation: {
      excellent: '🌟 優秀 - 內容品質卓越，具備 AI 引用潛力',
      good: '👍 良好 - 內容有基礎，可進一步優化',
      fair: '⚠️ 中等 - 建議依建議清單逐步改善',
      poor: '❌ 需改進 - 建議重新檢視內容策略'
    },
    priorityLabelHigh: '高優先級',
    priorityLabelMedium: '中優先級',
    priorityLabelLow: '低優先級',
    textTitle: 'AI 內容優化分析結果',
    textScoreHeading: '綜合評分',
    textBreakdownHeading: '分數拆解',
    textRecommendationsHeading: '優先待辦清單',
    textViewHeading: '查看完整結果'
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
  },

  input: {
    contentLabel: '文章內容',
    contentPlaceholder: '請貼上您的文章內容...',
    wordCountLabel: '字數統計',
    wordCountUnit: '字',
    keywordsLabel: '目標關鍵字',
    keywordsHint: '（必填，1-5 個，使用逗號或空白分隔）',
    keywordsPlaceholder: '例如：鑄鐵鍋保養、SEO 優化技巧...',
    emailLabel: 'Email 地址',
    emailOptionalHint: '（選填，填寫後將以 Email 寄送結果）',
    emailPlaceholder: 'your.email@example.com',
    submitSync: '開始 AI 分析',
    submitAsync: '提交分析（結果將寄送至信箱）',
    submitLoading: '分析中...',
    errorEmptyContent: '請輸入文章內容',
    errorKeywordsRequired: '請輸入 1-5 個目標關鍵字',
    errorKeywordsMax: '目標關鍵字最多 5 個',
    errorInvalidEmail: '請輸入有效的 Email 地址'
  },

  results: {
    whyTitle: '為什麼需要關注這份分析？',
    whyDescription: '為什麼需要關注這份分析？',
    howTitle: '分數是怎麼算出來的？',
    howDescription: '分數是怎麼算出來的？',
    whatTitle: '具體可以怎麼改善？',
    whatDescription: '具體可以怎麼改善？',
    overallScoreTitle: 'v5 綜合評分',
    overallScoreDescription: '最新 v5 評分模型，結構（40%）與策略（60%）加權的整體表現。',
    structureScoreTitle: '結構分',
    structureScoreDescription: '檢視內容是否具備良好的結構、可讀性、證據與經驗支撐。',
    strategyScoreTitle: '策略分',
    strategyScoreDescription: '衡量 Why / How / What 策略框架是否完整，內容是否與目標受眾對話。',
    priorityRecommendations: '優先改善建議',
    priorityRecommendationsDescription: '根據 v5 評分的結構與策略構面，以下建議優先處理可快速拉升整體分數。',
    structureInsights: '結構洞察',
    structureInsightsDescription: '聚焦段落結構、摘要整理、對話語氣與互動引導，協助內容更易讀、易理解。',
    strategyInsights: '策略洞察',
    strategyInsightsDescription: '涵蓋 helpfulness、內容深度、可信度與關鍵字覆蓋，讓內容更貼近搜尋與目標讀者需求。',
    sourceTextReview: '原文段落檢視',
    sourceTextReviewDescription: '逐段檢視原文內容，搭配上方建議調整文字、例證與結構。',
    paragraph: '段落',
    originalContent: '原文內容',
    tokens: 'Tokens',
    segments: '段落數',
    format: '格式',
    collapse: '收合',
    expand: '展開',
    keySignals: '關鍵訊號',
    evidencePoints: '佐證重點',
    noMetricsAvailable: '目前尚未提供相關指標資料。',
    insufficientMetadata: '無法評分：缺少 HTML metadata',
    metadataUnavailable: 'Metadata 可檢測',
    schemaUnavailable: 'Schema 可檢測',
    undetectableItems: '無法判斷的項目',
    hint: '提示：請直接貼上完整頁面 HTML 或使用提供原始碼的 API，以便系統取用 Meta / Schema / 作者資訊等關鍵標記。',
    detectionStatus: '目前偵測狀態',
    yes: '是',
    no: '否',
    loadGuideError: '無法載入優化指南，請稍後重試。',
    loadGuideErrorRetry: '載入指南時發生錯誤，請稍後重試。',
    notEvaluatedYet: '尚未評估',
    excellentPerformance: '表現優秀',
    canBeImproved: '尚可提升',
    priorityImprovement: '優先改善',
    urgentImprovement: '亟待補強',
    weight: '權重',
    highPriority: '高優先級',
    mediumPriority: '中優先級',
    lowPriority: '低優先級',
    suggestion: '建議',
    category: '分類',
    lowScoreWarning: '目前此項指標表現偏低，建議優先改善，並參考下方指標與建議清單找到具體行動。'
  },

  scoreCard: {
    scoreComposition: '分數構成',
    expandExplanation: '展開說明',
    collapseExplanation: '收合說明'
  },

  recommendations: {
    title: '優化建議清單',
    noRecommendations: '太棒了！目前沒有需要改進的地方。',
    example: '範例',
    helpful: '有幫助',
    notApplicable: '不適用',
    categoryContent: '內容',
    categoryTrust: '信任',
    categoryExperience: '讀者體驗'
  },

  v5Dashboard: {
    analyzing: '分析進行中...',
    noResults: '無可用結果',
    pleaseSubmit: '請提交內容進行分析',
    overallScore: '綜合評分',
    outOf: '/100',
    excellent: '🌟 優秀 - 內容品質卓越',
    good: '👍 良好 - 內容有基礎，可進一步優化',
    fair: '⚠️ 中等 - 需要改進',
    needsImprovement: '❌ 需改進 - 建議重新調整內容策略',
    structureScore: '結構分',
    strategyScore: '策略分',
    structureDetails: '結構分細項',
    strategyDetails: '策略分細項 (WHY/HOW/WHAT)',
    whyLabel: 'WHY - 問題定義',
    howLabel: 'HOW - 實現方法',
    whatLabel: 'WHAT - 解決方案',
    weight: '權重',
    suggestions: '改進建議',
    detectionStatus: '目前偵測狀態',
    metadataDetectable: 'Metadata 可檢測',
    schemaDetectable: 'Schema 可檢測',
    yes: '是',
    no: '否'
  },

  footer: {
    copy:
      '© 2025 SrcRank（由 <span>煜言顧問有限公司 (TW)</span> 與 <a href="https://toldyou.co" target="_blank" rel="noopener noreferrer" class="text-primary-300 hover:text-primary-200 underline">燈言顧問株式会社 (JP)</a> 提供）All Rights Reserved.'
  },

  resultsPage: {
    missingTaskId: '缺少任務 ID',
    loadingResults: '載入結果中...',
    queryingResults: '正在從伺服器查詢您的分析結果',
    queryFailed: '查詢失敗',
    noResults: '無可用結果',
    checkTaskId: '請檢查任務 ID 是否正確',
    backToHome: '返回首頁',
    analysisResults: '分析結果',
    taskId: '任務 ID',
    completedAt: '完成時間',
    submittedContent: '提交的內容',
    characterCount: '字數',
    keywords: '關鍵字',
    none: '無',
    strategyAnalysisDetails: '策略分析詳情',
    whyProblem: 'WHY - 問題定義',
    howImplementation: 'HOW - 實現方法',
    whatSolution: 'WHAT - 解決方案',
    evidence: '佐證',
    improvementSuggestions: '改進建議',
    notFound: '找不到該任務的結果。請檢查任務 ID 是否正確，或結果是否已過期（7 天）。',
    resultExpired: '查詢失敗'
  },

  scoreHistory: {
    title: '評分指標追蹤面板',
    description: '保留最近 200 次分析，建立週期性追蹤與自動匯出流程。',
    exportButton: '匯出 CSV',
    clearButton: '清除歷史',
    noHistory: '尚未建立歷史紀錄。完成一次分析後，系統會自動加入追蹤面板。',
    averageOverallScore: '平均綜合評分',
    latestTrend: '最新趨勢',
    sevenDayAnalysis: '7 日內分析',
    nextSchedule: '下次排程',
    notScheduled: '尚未排程',
    notScheduledHint: '系統以最新一次分析日 +7 天作為例行複查日。',
    trendComparison: '與上一筆綜合評分比較',
    sevenDayHint: '建議每週至少 3 次，以掌握內容新鮮度。',
    nextReviewHint: '系統以最新一次分析日 +7 天作為例行複查日。',
    latestRecords: '最新分析記錄',
    timeHeader: '時間',
    keywordsHeader: '關鍵字',
    overallHeader: 'Overall',
    aeoHeader: 'AEO',
    seoHeader: 'SEO',
    gapHeader: '缺口',
    weakFlagsHeader: '弱勢旗標',
    noGaps: '無',
    noWeakFlags: '無',
    exportProcess: '匯出流程',
    maintenanceSuggestions: '維運建議',
    exportStep1: '完成分析後，面板會自動追加紀錄。',
    exportStep2: '點擊「匯出 CSV」即可下載最近 200 筆資料。',
    exportStep3: '將 CSV 上傳至資料倉儲或 Google Sheet，以便長期追蹤。',
    maintenanceStep1: '每週至少 3 次分析，確保內容保持最新。',
    maintenanceStep2: '月初整理上一月的 CSV 匯出，更新 KPI 面板。',
    maintenanceStep3: '發現連續兩次低於 60 分時，建立高優先修正單。',
    flat: '持平'
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
  },
  analysis: {
    title: '非同步內容分析 - AI 內容優化大師',
    description: '提交內容進行非同步 AI 評分，分析完成後系統會將結構與策略洞察寄送至您的 Email。',
    keywords: ['非同步分析', 'AI 內容評分', 'Email 結果', '內容稽核']
  },
  results: {
    title: '分析結果儀表板 - AI 內容優化大師',
    description: '檢視完整的 AI 內容分析結果，包含結構與策略雙軌分數、缺口診斷與優先改善建議。',
    keywords: ['分析結果', '內容儀表板', 'SEO 洞察', 'AEO 評分']
  }
}
