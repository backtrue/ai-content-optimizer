import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const distDir = path.join(projectRoot, 'dist')
const indexPath = path.join(distDir, 'index.html')

// SEO metadata per locale
const localeMetadata = {
  en: {
    lang: 'en',
    title: 'Content Optimizer AI - SEO & AEO Scoring Analysis Tool',
    description: 'Analyze your content\'s SEO strategy and structure performance with AI-driven scoring. Get detailed optimization recommendations to improve search rankings and AI citation rates.',
    ogTitle: 'Content Optimizer AI',
    ogDescription: 'Professional SEO & AEO content analysis tool',
    ogLocale: 'en_US'
  },
  'zh-TW': {
    lang: 'zh-TW',
    title: 'AI 內容優化大師 - SEO 與 AEO 評分分析工具',
    description: '使用 AI 驅動的評分模型，分析您的內容在 SEO 策略與結構方面的表現。獲得詳細的優化建議，提升搜尋排名與 AI 引用率。',
    ogTitle: 'AI 內容優化大師',
    ogDescription: '專業的 SEO 與 AEO 內容分析工具',
    ogLocale: 'zh_TW'
  },
  ja: {
    lang: 'ja',
    title: 'コンテンツ最適化AI - SEO＆AEOスコアリング分析ツール',
    description: 'AI駆動のスコアリングモデルを使用して、コンテンツのSEO戦略と構造パフォーマンスを分析します。詳細な最適化推奨事項を取得して、検索ランキングとAI引用率を向上させます。',
    ogTitle: 'コンテンツ最適化AI',
    ogDescription: 'プロフェッショナルなSEO＆AEOコンテンツ分析ツール',
    ogLocale: 'ja_JP'
  }
}

function generateLocaleHTML(baseHTML, locale, metadata) {
  let html = baseHTML

  // Replace lang attribute
  html = html.replace(/(<html[^>]*lang=")[^"]*/, `$1${metadata.lang}`)

  // Replace title
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${metadata.title}</title>`)

  // Replace description meta
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*"/,
    `$1${metadata.description}"`
  )

  // Replace og:title
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*"/,
    `$1${metadata.ogTitle}"`
  )

  // Replace og:description
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*"/,
    `$1${metadata.ogDescription}"`
  )

  // Replace og:locale
  html = html.replace(
    /(<meta\s+property="og:locale"\s+content=")[^"]*"/,
    `$1${metadata.ogLocale}"`
  )

  return html
}

async function main() {
  try {
    // Read base HTML
    if (!fs.existsSync(indexPath)) {
      console.error(`❌ Base HTML not found: ${indexPath}`)
      console.error('   Run "npm run build" first')
      process.exit(1)
    }

    const baseHTML = fs.readFileSync(indexPath, 'utf-8')
    console.log('✓ Read base HTML from dist/index.html')

    // Generate locale-specific HTML files
    for (const [locale, metadata] of Object.entries(localeMetadata)) {
      if (locale === 'en') {
        // English is default, update in-place
        const enHTML = generateLocaleHTML(baseHTML, locale, metadata)
        fs.writeFileSync(indexPath, enHTML, 'utf-8')
        console.log('✓ Updated dist/index.html (English)')
      } else {
        // Create locale subdirectories
        const localeDir = path.join(distDir, locale === 'zh-TW' ? 'zh-tw' : 'jp')
        fs.mkdirSync(localeDir, { recursive: true })

        const localeHTML = generateLocaleHTML(baseHTML, locale, metadata)
        const localeIndexPath = path.join(localeDir, 'index.html')
        fs.writeFileSync(localeIndexPath, localeHTML, 'utf-8')
        console.log(`✓ Generated ${localeDir}/index.html (${locale})`)
      }
    }

    console.log('\n✅ Multi-locale HTML generation complete!')
    console.log('   dist/index.html (English)')
    console.log('   dist/zh-tw/index.html (Traditional Chinese)')
    console.log('   dist/jp/index.html (Japanese)')
  } catch (error) {
    console.error('❌ Error generating locale HTML:', error)
    process.exit(1)
  }
}

main()
