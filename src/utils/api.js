/**
 * API 配置與工具函數
 * 集中管理 API 基礎 URL 與認證標頭
 */

// 從環境變數獲取配置
export const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')

// API Key（從環境變數獲取，開發環境可能不需要）
export const API_KEY = import.meta?.env?.VITE_API_KEY || ''

/**
 * 獲取 API 請求標頭
 * 包含 Content-Type 和 API Key（若有設定）
 */
export function getApiHeaders(additionalHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...additionalHeaders
    }

    // 若有 API Key 則加入標頭
    if (API_KEY) {
        headers['X-API-Key'] = API_KEY
    }

    return headers
}

/**
 * 帶有重試機制的 fetch 包裝器
 * @param {string} url - 請求 URL
 * @param {object} options - fetch 選項
 * @param {number} retries - 重試次數
 * @param {number} delay - 重試延遲（毫秒）
 */
export async function fetchWithRetry(url, options = {}, retries = 2, delay = 1000) {
    // 合併預設標頭
    const mergedOptions = {
        ...options,
        headers: getApiHeaders(options.headers),
        mode: 'cors',
        credentials: 'include'
    }

    let lastError

    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, mergedOptions)

            if (response.ok) {
                return response
            }

            // 429 表示速率限制，特殊處理
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
                throw new Error(`請求頻率過高，請在 ${retryAfter} 秒後重試`)
            }

            // 401 表示認證失敗，不重試
            if (response.status === 401) {
                throw new Error('API 認證失敗，請檢查 API Key 設定')
            }

            // 如果是 5xx 錯誤，才重試
            if (response.status < 500 || response.status >= 600) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
            }

            // 獲取錯誤訊息
            let errorMessage = `HTTP error! status: ${response.status}`
            try {
                const errorData = await response.json()
                errorMessage = errorData.message || errorMessage
            } catch (e) {
                console.error('解析錯誤響應失敗:', e)
            }

            throw new Error(errorMessage)
        } catch (error) {
            lastError = error

            // 如果不是最後一次重試，等待一段時間再重試
            if (i < retries) {
                console.warn(`請求失敗，${delay}ms 後重試 (${i + 1}/${retries})`, error)
                await new Promise((resolve) => setTimeout(resolve, delay))
                // 指數退避
                delay *= 2
            }
        }
    }

    throw lastError
}

/**
 * 簡單的 API 請求（無重試）
 */
export async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`

    const response = await fetch(url, {
        ...options,
        headers: getApiHeaders(options.headers),
        mode: 'cors'
    })

    return response
}
