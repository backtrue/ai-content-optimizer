import type { SEOMetadata, SupportedLocale } from '../locales/base'

/**
 * SEO Metadata 管理工具
 * 用於動態設定 HTML head 中的 meta 標籤
 */

export function setSEOMetadata(metadata: SEOMetadata, locale: SupportedLocale) {
  // 設定 title
  document.title = metadata.title

  // 設定或更新 meta 標籤
  updateMetaTag('description', metadata.description)
  updateMetaTag('keywords', metadata.keywords?.join(', ') || '')

  // Open Graph 標籤
  if (metadata.ogTitle) {
    updateMetaTag('og:title', metadata.ogTitle, 'property')
  }
  if (metadata.ogDescription) {
    updateMetaTag('og:description', metadata.ogDescription, 'property')
  }
  if (metadata.ogImage) {
    updateMetaTag('og:image', metadata.ogImage, 'property')
  }

  // Twitter Card
  if (metadata.twitterCard) {
    updateMetaTag('twitter:card', metadata.twitterCard)
  }

  // hreflang 標籤（用於多語系）
  updateHrefLangTags(locale)

  // Canonical 標籤
  updateCanonicalTag(locale)
}

function updateMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  if (!content) return

  let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }

  element.content = content
}

function updateHrefLangTags(currentLocale: SupportedLocale) {
  // 移除舊的 hreflang 標籤
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())

  // 建立新的 hreflang 標籤
  const locales: Array<{ code: SupportedLocale; hreflang: string; path: string }> = [
    { code: 'en', hreflang: 'en', path: '/' },
    { code: 'zh-TW', hreflang: 'zh-TW', path: '/zh-tw' },
    { code: 'ja', hreflang: 'ja', path: '/jp' }
  ]

  const currentPath = window.location.pathname.replace(/^\/(zh-tw|jp)/, '')

  for (const locale of locales) {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = locale.hreflang
    link.href = `${window.location.origin}${locale.path}${currentPath}`
    document.head.appendChild(link)
  }

  // x-default 標籤
  const xDefaultLink = document.createElement('link')
  xDefaultLink.rel = 'alternate'
  xDefaultLink.hreflang = 'x-default'
  xDefaultLink.href = `${window.location.origin}${currentPath}`
  document.head.appendChild(xDefaultLink)
}

function updateCanonicalTag(locale: SupportedLocale) {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  const currentPath = window.location.pathname.replace(/^\/(zh-tw|jp)/, '')
  const localePrefix = locale === 'en' ? '' : locale === 'zh-TW' ? '/zh-tw' : '/jp'

  canonical.href = `${window.location.origin}${localePrefix}${currentPath}`
}

/**
 * 為指南頁面生成 SEO metadata
 */
export function generateGuideMetadata(
  guideTitle: string,
  guideDescription: string,
  locale: SupportedLocale
): SEOMetadata {
  const localePrefix = locale === 'en' ? '' : locale === 'zh-TW' ? '繁體中文 | ' : '日本語 | '

  return {
    title: `${localePrefix}${guideTitle} - Content Optimizer AI`,
    description: guideDescription,
    keywords: ['SEO', 'optimization', 'guide', 'content'],
    ogTitle: guideTitle,
    ogDescription: guideDescription
  }
}

/**
 * 為首頁生成 SEO metadata
 */
export function generateHomeMetadata(locale: SupportedLocale): SEOMetadata {
  const metadata: Record<SupportedLocale, SEOMetadata> = {
    'zh-TW': {
      title: 'AI 內容優化大師 - SEO 與 AEO 評分分析工具',
      description: '使用 AI 驅動的評分模型，分析您的內容在 SEO 策略與結構方面的表現。獲得詳細的優化建議，提升搜尋排名與 AI 引用率。',
      keywords: ['SEO', 'AEO', '內容優化', 'AI 分析', '搜尋排名'],
      ogTitle: 'AI 內容優化大師',
      ogDescription: '專業的 SEO 與 AEO 內容分析工具'
    },
    en: {
      title: 'Content Optimizer AI - SEO & AEO Scoring Analysis Tool',
      description: 'Analyze your content\'s SEO strategy and structure performance with AI-driven scoring. Get detailed optimization recommendations to improve search rankings and AI citation rates.',
      keywords: ['SEO', 'AEO', 'content optimization', 'AI analysis', 'search ranking'],
      ogTitle: 'Content Optimizer AI',
      ogDescription: 'Professional SEO & AEO content analysis tool'
    },
    ja: {
      title: 'コンテンツ最適化AI - SEO＆AEOスコアリング分析ツール',
      description: 'AI駆動のスコアリングモデルを使用して、コンテンツのSEO戦略と構造パフォーマンスを分析します。詳細な最適化推奨事項を取得して、検索ランキングとAI引用率を向上させます。',
      keywords: ['SEO', 'AEO', 'コンテンツ最適化', 'AI分析', '検索ランキング'],
      ogTitle: 'コンテンツ最適化AI',
      ogDescription: 'プロフェッショナルなSEO＆AEOコンテンツ分析ツール'
    }
  }

  return metadata[locale]
}
