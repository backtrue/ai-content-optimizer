import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { SupportedLocale, UIStrings, SEOMetadata } from './base'
import { supportedLocales, defaultLocale, localeConfigs, detectLocaleFromHeader } from './base'
import { zhTWStrings, zhTWSEO } from './zh-TW'
import { enStrings, enSEO } from './en'
import { jaStrings, jaSEO } from './ja'

interface LocaleContextType {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  strings: UIStrings
  seo: Record<string, SEOMetadata>
  config: typeof localeConfigs[SupportedLocale]
  t: (key: string, defaultValue?: string) => string
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

const stringsByLocale: Record<SupportedLocale, UIStrings> = {
  'zh-TW': zhTWStrings,
  en: enStrings,
  ja: jaStrings
}

const seoByLocale: Record<SupportedLocale, Record<string, SEOMetadata>> = {
  'zh-TW': zhTWSEO,
  en: enSEO,
  ja: jaSEO
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as SupportedLocale | null
    if (savedLocale && supportedLocales.includes(savedLocale)) {
      setLocaleState(savedLocale)
      setMounted(true)
      return
    }

    const pathLocale = getLocaleFromPath()
    if (pathLocale) {
      setLocaleState(pathLocale)
      localStorage.setItem('locale', pathLocale)
      setMounted(true)
      return
    }

    const headerLocale = detectLocaleFromHeader(navigator.language)
    if (headerLocale) {
      setLocaleState(headerLocale)
      localStorage.setItem('locale', headerLocale)
      setMounted(true)
      return
    }

    setMounted(true)
  }, [])

  const setLocale = (newLocale: SupportedLocale) => {
    if (supportedLocales.includes(newLocale)) {
      setLocaleState(newLocale)
      localStorage.setItem('locale', newLocale)
      updateUrlPath(newLocale)
    }
  }

  if (!mounted) {
    return children
  }

  const strings = stringsByLocale[locale]
  const seo = seoByLocale[locale]
  const config = localeConfigs[locale]

  const t = (key: string, defaultValue: string = key): string => {
    const keys = key.split('.')
    let value: any = strings

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return defaultValue
      }
    }

    return typeof value === 'string' ? value : defaultValue
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, strings, seo, config, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}

function getLocaleFromPath(): SupportedLocale | null {
  const path = window.location.pathname
  const segments = path.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const firstSegment = segments[0].toLowerCase()

  if (firstSegment === 'zh-tw') return 'zh-TW'
  if (firstSegment === 'jp') return 'ja'
  if (firstSegment === 'en' || firstSegment === '') return 'en'

  return null
}

function updateUrlPath(locale: SupportedLocale) {
  let newPath = '/'

  if (locale === 'zh-TW') {
    newPath = '/zh-tw'
  } else if (locale === 'ja') {
    newPath = '/jp'
  }

  const currentPath = window.location.pathname
  const segments = currentPath.split('/').filter(Boolean)

  if (segments.length > 0) {
    const firstSegment = segments[0].toLowerCase()
    if (['zh-tw', 'jp', 'en'].includes(firstSegment)) {
      segments.shift()
    }
  }

  const remainingPath = segments.length > 0 ? '/' + segments.join('/') : ''
  const finalPath = newPath === '/' ? remainingPath || '/' : newPath + remainingPath

  window.history.pushState({}, '', finalPath)
}

export function formatDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(localeConfigs[locale].code).format(date)
}

export function formatNumber(num: number, locale: SupportedLocale): string {
  return localeConfigs[locale].numberFormat.format(num)
}
