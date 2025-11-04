import { useState, useMemo, useEffect } from 'react'
import Header from './components/Header'
import InputSection from './components/InputSection'
import ResultsDashboard from './components/ResultsDashboard'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const [analysisResults, setAnalysisResults] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [analysisHistory, setAnalysisHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // session and API base
  const sessionId = useMemo(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`), [])
  const apiUrl = useMemo(() => (import.meta?.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')), [])
  const [feedbackContext, setFeedbackContext] = useState(null)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const removeLegacyUrlElements = () => {
      try {
        // 移除所有包含「貼上網址」或「貼上文字」文字的按鈕
        const buttons = Array.from(document.querySelectorAll('button'))
        buttons.forEach((btn) => {
          const text = btn.textContent?.trim() || ''
          if (text === '貼上網址' || text === '貼上文字') {
            console.log(`[RemoveLegacy] Removing button: "${text}"`)
            btn.remove()
          }
        })

        // 移除所有 URL 類型的輸入框
        const urlInputs = Array.from(document.querySelectorAll('input[type="url"]'))
        urlInputs.forEach((input) => {
          console.log('[RemoveLegacy] Removing URL input')
          const group = input.closest('.mb-6') || input.closest('div[class*="mb-"]') || input.parentElement
          if (group && group !== document.body) {
            group.remove()
          } else {
            input.remove()
          }
        })

        // 移除可能的 tab 容器（包含「貼上網址」或「貼上文字」的按鈕組）
        const allDivs = Array.from(document.querySelectorAll('div'))
        allDivs.forEach((div) => {
          const btns = div.querySelectorAll('button')
          const hasLegacyTabs = Array.from(btns).some((btn) => {
            const text = btn.textContent?.trim() || ''
            return text === '貼上網址' || text === '貼上文字'
          })
          if (hasLegacyTabs && btns.length <= 3) {
            // 假設 tab 容器最多只有 2-3 個按鈕
            console.log('[RemoveLegacy] Removing tab container')
            div.remove()
          }
        })
      } catch (error) {
        console.warn('removeLegacyUrlElements failed', error)
      }
    }

    // 立即執行一次
    removeLegacyUrlElements()

    // 持續監聽 DOM 變化
    const observer = new MutationObserver(() => {
      removeLegacyUrlElements()
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: false })

    // 額外的定時檢查（防止某些動態渲染的情況）
    const interval = setInterval(removeLegacyUrlElements, 500)

    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [])

  // 帶有重試機制的 API 請求函數
  const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
    let lastError;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, options);
        
        if (response.ok) {
          return response;
        }
        
        // 如果是 5xx 錯誤，才重試
        if (response.status < 500 || response.status >= 600) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        // 獲取錯誤訊息
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // 無法解析 JSON 錯誤響應
          console.error('解析錯誤響應失敗:', e);
        }
        
        throw new Error(errorMessage);
        
      } catch (error) {
        lastError = error;
        
        // 如果不是最後一次重試，等待一段時間再重試
        if (i < retries) {
          console.warn(`請求失敗，${delay}ms 後重試 (${i + 1}/${retries})`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
          // 指數退避
          delay *= 2;
        }
      }
    }
    
    throw lastError;
  };

  // string sha256 helper (Web Crypto)
  const sha256Hex = async (text) => {
    const enc = new TextEncoder()
    const data = enc.encode(text)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const bytes = Array.from(new Uint8Array(hash))
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleAnalyze = async (contentPayload, targetKeywords, meta = {}) => {
    setIsLoading(true)
    setError(null)
    setAnalysisResults(null)
    setRecommendations([])
    setIsLoadingRecommendations(false)

    try {
      const plainText = typeof contentPayload?.plain === 'string' ? contentPayload.plain : ''
      const htmlText = typeof contentPayload?.html === 'string' ? contentPayload.html : ''
      const markdownText = typeof contentPayload?.markdown === 'string' ? contentPayload.markdown : ''
      const formatHint = markdownText
        ? 'markdown'
        : htmlText
          ? 'html'
          : 'plain'

      const contentHash = await sha256Hex(plainText)
      setFeedbackContext({ sessionId, contentHash, targetKeywords, format: formatHint, sourceUrl: null })
      const response = await fetchWithRetry(
        `${apiUrl}/api/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            content: plainText,
            contentPlain: plainText,
            contentHtml: htmlText || null,
            contentMarkdown: markdownText || null,
            contentFormatHint: formatHint,
            targetKeywords,
            returnChunks: true,
            sessionId,
            mode: meta.mode,
            includeRecommendations: false,
          }),
        },
        2, // 重試次數
        1000 // 初始重試延遲(毫秒)
      );

      // 如果代碼執行到這裡，表示請求成功

      const data = await response.json()

      if (data?.status === 'insufficient_metadata') {
        setAnalysisResults({
          status: 'insufficient_metadata',
          message: data?.message || '缺少 HTML metadata，請提供原始頁面再檢測。',
          contentSignals: data?.contentSignals || null,
          recommendationsStatus: 'unavailable'
        })
        setRecommendations([])
        return
      }

      const initialResults = {
        ...data,
        rawInput: {
          content: plainText,
          contentPlain: plainText,
          contentHtml: htmlText || null,
          contentMarkdown: markdownText || null,
          contentFormatHint: formatHint
        },
        targetKeywords,
        recommendationsStatus: data?.recommendationsStatus || 'not_requested'
      }
      setAnalysisResults(initialResults)
      setRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : [])
      const timestamp = new Date().toISOString()
      setAnalysisHistory((prev) => {
        const next = [
          {
            id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp,
            targetKeywords,
            overallScore: data?.overallScore ?? null,
            aeoScore: data?.aeoScore ?? null,
            seoScore: data?.seoScore ?? null,
            missingCritical: data?.scoreGuards?.missingCritical || data?.missingCritical || null,
            contentQualityFlags: data?.scoreGuards?.contentQualityFlags || data?.contentQualityFlags || null
          },
          ...prev
        ]
        return next.slice(0, 200)
      })
    } catch (err) {
      setError(err.message)
      console.error('Analysis error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateRecommendations = async () => {
    if (!analysisResults || analysisResults?.status === 'insufficient_metadata') return
    setIsLoadingRecommendations(true)
    setError(null)
    setRecommendations([])
    setAnalysisResults((prev) => (prev ? { ...prev, recommendationsStatus: 'loading' } : prev))
    try {
      const {
        rawInput = {},
        targetKeywords = [],
        scoreGuards,
        contentSignals,
        chunks
      } = analysisResults || {}
      const response = await fetchWithRetry(
        `${apiUrl}/api/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            content: rawInput?.content ?? null,
            contentPlain: rawInput?.contentPlain ?? null,
            contentHtml: rawInput?.contentHtml ?? null,
            contentMarkdown: rawInput?.contentMarkdown ?? null,
            contentFormatHint: rawInput?.contentFormatHint ?? null,
            targetKeywords,
            sessionId,
            includeRecommendations: true,
            returnChunks: Boolean(chunks?.length),
            scoreGuards,
            contentSignals
          })
        },
        2,
        1000
      )

      const data = await response.json()
      setAnalysisResults((prev) => ({
        ...prev,
        ...data,
        recommendationsStatus: data?.recommendationsStatus || 'ready'
      }))
      setRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : [])
    } catch (err) {
      setError(err.message)
      console.error('Generate recommendations error:', err)
      setAnalysisResults((prev) => (prev ? { ...prev, recommendationsStatus: 'failed' } : prev))
    } finally {
      setIsLoadingRecommendations(false)
    }
  }

  const handleExportHistory = () => {
    if (!analysisHistory.length) return
    const headers = ['timestamp', 'keywords', 'overall', 'aeo', 'seo', 'missingCritical', 'contentQualityFlags']
    const rows = analysisHistory.map((item) => {
      const keywords = Array.isArray(item.targetKeywords) ? item.targetKeywords.join('|') : ''
      const missing = item.missingCritical ? Object.entries(item.missingCritical).filter(([, v]) => v === true).map(([k]) => k).join('|') : ''
      const flags = item.contentQualityFlags ? Object.entries(item.contentQualityFlags).filter(([, v]) => v === true).map(([k]) => k).join('|') : ''
      return [item.timestamp, keywords, item.overallScore ?? '', item.aeoScore ?? '', item.seoScore ?? '', missing, flags]
    })
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => {
        if (cell === null || cell === undefined) return ''
        const value = String(cell)
        if (value.includes(',') || value.includes('\"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `analysis-history-${Date.now()}.csv`)
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleClearHistory = () => {
    if (!window.confirm('確定要清除所有分析歷史紀錄嗎？')) return
    setAnalysisHistory([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <section className="mb-8">
          <div className="bg-white border border-primary-100/60 rounded-2xl shadow-sm p-6 space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              本工具由台灣 SEO 專家<strong>邱煜庭（小黑老師）</strong>歷時多年的實戰研究打造，評分邏輯結合 Google 官方《搜尋品質評分者指南》、Helpful Content Update (HCU) 以及各項國際 SEO 評估標準，協助判讀文章是否貼近 Google 喜好並提高被 AI 模型引用的機會。
            </p>
            <p className="text-xs text-gray-500">
              免責聲明：本工具僅作為第三方檢測與優化建議參考，無法保證搜尋排名或流量成長。
            </p>
          </div>
        </section>
        <InputSection onAnalyze={handleAnalyze} isLoading={isLoading} />
        
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="font-semibold">錯誤</p>
            <p>{error}</p>
          </div>
        )}
        
        {isLoading && (
          <div className="mt-8">
            <LoadingSpinner />
          </div>
        )}
        
        {analysisResults && !isLoading && (
          <div className="mt-8">
            <ResultsDashboard
              results={analysisResults}
              recommendations={recommendations}
              onGenerateRecommendations={handleGenerateRecommendations}
              generatingRecommendations={isLoadingRecommendations}
              feedbackContext={feedbackContext}
              apiBaseUrl={apiUrl}
            />
          </div>
        )}
      </main>
      
      <footer className="mt-16 py-8 bg-gray-900 text-gray-300">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p>
            © 2025 AEO/GEO 小幫手 (由 煜言顧問有限公司(TW) 及{' '}
            <a
              href="https://toldyou.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-300 hover:text-primary-200 underline transition-colors"
            >
              燈言顧問株式会社(JP)
            </a>{' '}
            提供). All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
