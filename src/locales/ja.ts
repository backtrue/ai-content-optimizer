import type { UIStrings, SEOMetadata } from './base'

export const jaStrings: UIStrings = {
  common: {
    loading: '読み込み中...',
    error: 'エラーが発生しました',
    success: '成功',
    cancel: 'キャンセル',
    confirm: '確認',
    close: '閉じる',
    back: '戻る',
    next: '次へ',
    previous: '前へ'
  },

  nav: {
    home: 'ホーム',
    about: 'について',
    guides: '最適化ガイド',
    languageSwitch: '言語',
    selectLanguage: '言語を選択'
  },

  header: {
    title: '源策 (Gensaku): AI時代のためのAEO/RAG戦略スコア',
    subtitle: '構造整合性とAI戦略説得力を両軸で評価するスコアリング',
    description:
      '源策 (Gensaku) は、AIに引用されるために必要な「コンテンツ構造」と「戦略的説得力」を融合して評価し、生成AI時代に信頼される引用ソースとなるよう導きます。'
  },

  dashboard: {
    totalScore: '総合スコア',
    structureScore: '構造スコア',
    strategyScore: 'ストラテジースコア',
    why: 'WHY - 問題定義',
    how: 'HOW - 実装方法',
    what: 'WHAT - ソリューション',
    guide: 'ガイド',
    viewGuide: '最適化ガイドを表示',
    noGuideAvailable: 'ガイドは利用できません',
    failedToLoadGuide: '最適化ガイドを読み込めませんでした'
  },

  guides: {
    title: '最適化ガイド',
    description: '詳細なコンテンツ最適化の推奨事項',
    optimization: '最適化ガイド',
    reasons: '根本原因',
    diagnosis: '診断方法',
    improvements: '改善戦略',
    actions: 'アクションプラン',
    faq: 'よくある質問',
    quickReference: 'クイックリファレンス'
  },

  analysis: {
    submitEmail: 'メールアドレスを送信',
    emailPlaceholder: 'メールアドレスを入力してください',
    submit: '送信',
    submitting: '送信中...',
    checkResults: '結果を確認',
    resultsWillBeSent: '分析結果はメールで送信されます',
    enterValidEmail: '有効なメールアドレスを入力してください'
  },

  metrics: {
    intentFit: '検索意図の適合度',
    helpfulRatio: 'ヘルプフルレシオ',
    depthCoverage: 'コンテンツの深さと網羅性',
    intentExpansion: '意図の拡張とキーワードカバレッジ',
    actionability: '実行可能性',
    readabilityRhythm: '可読性と物語のリズム',
    structureHighlights: '構造のハイライト',
    authorBrandSignals: '著者とブランド認識',
    evidenceSupport: 'エビデンスと引用',
    experienceSignals: '一次経験とケーススタディ',
    narrativeDensity: 'ナラティブの具体性と情報密度',
    freshnessSignals: '鮮度と更新シグナル',
    expertPerspective: '専門家の視点と判断',
    extractability: '回答の抽出可能性',
    keySummary: '主要な要約とハイライト',
    conversationalGuidance: '会話的なトーンとガイダンス',
    readerActivation: '読者エンゲージメントとフォローアップ'
  },

  status: {
    excellent: '優秀',
    good: '良好',
    fair: 'まあまあ',
    poor: '改善が必要',
    veryPoor: '緊急改善が必要'
  },

  errors: {
    networkError: 'ネットワーク接続エラー',
    serverError: 'サーバーエラー',
    invalidInput: '無効な入力',
    notFound: '見つかりません',
    unauthorized: '権限がありません'
  }
}

export const jaSEO: Record<string, SEOMetadata> = {
  home: {
    title: 'コンテンツ最適化AI - SEO＆AEOスコアリング分析ツール',
    description: 'AI駆動のスコアリングモデルを使用して、コンテンツのSEO戦略と構造パフォーマンスを分析します。詳細な最適化推奨事項を取得して、検索ランキングとAI引用率を向上させます。',
    keywords: ['SEO', 'AEO', 'コンテンツ最適化', 'AI分析', '検索ランキング']
  },
  guides: {
    title: '最適化ガイド - コンテンツ最適化AI',
    description: '各スコアリング指標の詳細な最適化ガイド。スコアが低い理由を理解し、実行可能な改善戦略を取得します。'
  }
}
