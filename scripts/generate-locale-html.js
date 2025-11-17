import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const distDir = path.join(projectRoot, 'dist')
const indexPath = path.join(distDir, 'index.html')
const publicDocsDir = path.join(projectRoot, 'public', 'docs')
const distDocsDir = path.join(distDir, 'docs')

function copyDirRecursive(source, destination) {
  if (!fs.existsSync(source)) return
  const stats = fs.statSync(source)
  if (stats.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true })
    for (const entry of fs.readdirSync(source)) {
      copyDirRecursive(path.join(source, entry), path.join(destination, entry))
    }
  } else {
    fs.copyFileSync(source, destination)
  }
}

// SEO metadata per locale
const localeMetadata = {
  en: {
    lang: 'en',
    title: 'SrcRank: The AI Content Strategy & AEO Score',
    description: 'Stop guessing what AI wants. SrcRank analyzes your content on two dimensions: Structural Integrity for RAG retrievability and Strategic Persuasion. It moves beyond keywords to evaluate your content\'s core logic, helping you become a credible, citable source in the generative AI era.',
    ogTitle: 'SrcRank: The AI Content Strategy & AEO Score',
    ogDescription: 'Analyze your content\'s structural integrity and strategic persuasion for AI citation',
    ogLocale: 'en_US'
  },
  'zh-TW': {
    lang: 'zh-TW',
    title: '源策 (SrcRank): 您的 AI 內容策略顧問',
    description: '「報數據」提供客觀指標，「源策」評估內容靈魂。源策 (SrcRank) 是一個專為 AEO/GEO 時代打造的自適應評分演算法，它同時評估您內容的「純內容結構」與「AI 策略說服力」。我們不再只評估關鍵字，而是讓 AI 深度解讀您內容的核心論述，幫助您的內容從「資訊」升級為「可信的引用來源」。',
    ogTitle: '源策 (SrcRank): 您的 AI 內容策略顧問',
    ogDescription: '評估內容結構與 AI 策略說服力，助您成為可信的引用來源',
    ogLocale: 'zh_TW'
  },
  ja: {
    lang: 'ja',
    title: '源策 (Gensaku): AI時代のためのAEO/RAG戦略スコア',
    description: '「源策 (ゲンサク)」は、AIの引用元 (Source) となるための「戦略 (Strategy)」を評価するアルゴリズムです。客観的な「コンテンツ構造」と、AIが評価する「戦略的説得力」を融合。AIがコンテンツの核心的な論理フレームワークを深く読み解き、あなたのコンテンツがAIの「原作 (Gensaku)」として引用されるに値する「典拠 (Tenkyo)」となるよう導きます。',
    ogTitle: '源策 (Gensaku): AI時代のためのAEO/RAG戦略スコア',
    ogDescription: 'AIの引用元となるための戦略を評価し、あなたのコンテンツを信頼できる情報源へ',
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

    // Copy docs assets to dist/docs
    if (fs.existsSync(publicDocsDir)) {
      fs.rmSync(distDocsDir, { recursive: true, force: true })
      copyDirRecursive(publicDocsDir, distDocsDir)
      console.log('✓ Copied docs assets to dist/docs')
    } else {
      console.warn('⚠️ public/docs not found, skipped copying guide assets')
    }

    console.log('\n✅ Multi-locale HTML generation complete!')
    console.log('   dist/index.html (English)')
    console.log('   dist/zh-tw/index.html (Traditional Chinese)')
    console.log('   dist/jp/index.html (Japanese)')
    console.log('   dist/docs/ (Guide markdown assets)')
  } catch (error) {
    console.error('❌ Error generating locale HTML:', error)
    process.exit(1)
  }
}

main()
