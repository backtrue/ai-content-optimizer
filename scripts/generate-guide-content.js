import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const guidesBaseDir = path.join(projectRoot, 'public', 'docs', 'product')
const outputDir = path.join(projectRoot, 'src', 'generated')
const outputPath = path.join(outputDir, 'guideContent.json')

const SUPPORTED_LOCALES = [
  { locale: 'zh-TW', dir: guidesBaseDir },
  { locale: 'en', dir: path.join(guidesBaseDir, 'en') },
  { locale: 'ja', dir: path.join(guidesBaseDir, 'ja') }
]

function collectMarkdownFiles(directory, locale, manifest) {
  if (!fs.existsSync(directory)) return
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const filePath = path.join(directory, entry.name)
    const content = fs.readFileSync(filePath, 'utf-8')
    const key = `${locale}/${entry.name}`
    manifest[key] = content
  }
}

function main() {
  const manifest = {}
  for (const { locale, dir } of SUPPORTED_LOCALES) {
    collectMarkdownFiles(dir, locale, manifest)
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(manifest), 'utf-8')
}

main()
