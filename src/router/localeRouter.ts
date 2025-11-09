/**
 * 多語系路由配置
 * 支援：/, /zh-tw, /jp
 */

import type { SupportedLocale } from '../locales/base'

export const localeRoutes = {
  home: {
    en: '/',
    'zh-TW': '/zh-tw',
    ja: '/jp'
  },
  guides: {
    en: '/guides',
    'zh-TW': '/zh-tw/guides',
    ja: '/jp/guides'
  },
  results: {
    en: '/results/:taskId',
    'zh-TW': '/zh-tw/results/:taskId',
    ja: '/jp/results/:taskId'
  }
}

/**
 * 根據語系和路由名稱生成 URL
 */
export function getLocalizedPath(routeName: keyof typeof localeRoutes, locale: SupportedLocale, params?: Record<string, string>): string {
  const routeTemplate = localeRoutes[routeName][locale]
  
  if (!params) return routeTemplate

  let path = routeTemplate
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value)
  }
  return path
}

/**
 * 從 URL 路徑提取語系
 */
export function extractLocaleFromPath(pathname: string): SupportedLocale {
  const segments = pathname.split('/').filter(Boolean)
  
  if (segments.length === 0) return 'en'
  
  const firstSegment = segments[0].toLowerCase()
  
  if (firstSegment === 'zh-tw') return 'zh-TW'
  if (firstSegment === 'jp') return 'ja'
  
  return 'en'
}

/**
 * 移除路徑中的語系前綴
 */
export function removeLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  
  if (segments.length === 0) return '/'
  
  const firstSegment = segments[0].toLowerCase()
  
  if (['zh-tw', 'jp'].includes(firstSegment)) {
    segments.shift()
  }
  
  return segments.length > 0 ? '/' + segments.join('/') : '/'
}

/**
 * 將路徑轉換為另一種語系
 */
export function switchLocale(pathname: string, fromLocale: SupportedLocale, toLocale: SupportedLocale): string {
  const basePath = removeLocalePrefix(pathname)
  
  if (toLocale === 'en') {
    return basePath
  }
  
  const prefix = toLocale === 'zh-TW' ? '/zh-tw' : toLocale === 'ja' ? '/jp' : ''
  
  return prefix + basePath
}
