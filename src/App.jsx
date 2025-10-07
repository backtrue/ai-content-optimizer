import { useState } from 'react'
import Header from './components/Header'
import InputSection from './components/InputSection'
import ResultsDashboard from './components/ResultsDashboard'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const [analysisResults, setAnalysisResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAnalyze = async (content, targetKeyword) => {
    setIsLoading(true)
    setError(null)
    setAnalysisResults(null)

    try {
      const apiUrl = process.env.REACT_APP_API_BASE_URL || 'https://ragseo.thinkwithblack.com'
      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          targetKeyword: targetKeyword.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '分析請求失敗，請稍後再試')
      }

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
            <ResultsDashboard results={analysisResults} />
          </div>
        )}
      </main>
      
      <footer className="mt-16 py-8 bg-gray-900 text-gray-300">
        <div className="container mx-auto px-4 text-center">
          <p>© 2025 AI 內容優化大師 | Powered by AI</p>
        </div>
      </footer>
    </div>
  )
}

export default App
