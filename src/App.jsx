import { useState, useMemo } from 'react'
import Header from './components/Header'
import InputSection from './components/InputSection'
import ResultsDashboard from './components/ResultsDashboard'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const [analysisResults, setAnalysisResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // session and API base
  const sessionId = useMemo(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`), [])
  const apiUrl = useMemo(() => (import.meta?.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')), [])
  const [feedbackContext, setFeedbackContext] = useState(null)

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

  const handleAnalyze = async (content, targetKeywords) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResults(null);

    try {
      const contentHash = await sha256Hex(content)
      setFeedbackContext({ sessionId, contentHash, targetKeywords })
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
            content,
            targetKeywords,
            returnChunks: true,
          }),
        },
        2, // 重試次數
        1000 // 初始重試延遲(毫秒)
      );

      // 如果代碼執行到這裡，表示請求成功

      const data = await response.json()
      setAnalysisResults(data)
    } catch (err) {
      setError(err.message)
      console.error('Analysis error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
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
            <ResultsDashboard results={analysisResults} feedbackContext={feedbackContext} apiBaseUrl={apiUrl} />
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
