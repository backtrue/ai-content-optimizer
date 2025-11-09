import { Sparkles } from 'lucide-react'
import { useLocale } from '../locales/useLocale'
import { supportedLocales, localeConfigs } from '../locales/base'

function useLocaleSafely() {
  try {
    return useLocale()
  } catch (error) {
    console.warn('[Header] Locale context unavailable, falling back to default strings.', error)
    return {
      t: (key) => key,
      locale: 'zh-TW',
      setLocale: () => {}
    }
  }
}

export default function Header() {
  const { t, locale, setLocale } = useLocaleSafely()

  const handleLocaleChange = (event) => {
    const newLocale = event.target.value
    if (supportedLocales.includes(newLocale)) {
      setLocale(newLocale)
    }
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                {t('header.title')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('header.subtitle')}
              </p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {t('header.description')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:self-start">
            <label htmlFor="language-select" className="text-sm text-gray-600 whitespace-nowrap">
              {t('nav.languageSwitch')}
            </label>
            <select
              id="language-select"
              value={locale}
              onChange={handleLocaleChange}
              className="w-full md:w-52 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-colors"
            >
              {supportedLocales.map((code) => (
                <option key={code} value={code}>
                  {localeConfigs[code].name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  )
}
