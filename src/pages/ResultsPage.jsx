import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader } from 'lucide-react'
import V5ResultsDashboard from '../components/V5ResultsDashboard'
import { useLocale } from '../locales/useLocale'
import { apiFetch } from '../utils/api'

/**
 * 結果查詢頁面
 * 透過 taskId 從 KV 查詢分析結果
 */
export default function ResultsPage() {
  const { strings } = useLocale()
  const { resultsPage: rpStrings } = strings
  const { taskId } = useParams()
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchResults = async () => {
      if (!taskId) {
        setError(rpStrings.missingTaskId)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // 從 URL 獲取 ownerToken（若有）
        const urlParams = new URLSearchParams(window.location.search)
        const token = urlParams.get('token') || ''
        const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : ''

        const response = await apiFetch(`/api/results/${taskId}${tokenQuery}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError(rpStrings.notFound)
          } else if (response.status === 403) {
            setError('無權存取此分析結果')
          } else {
            setError(`${rpStrings.resultExpired}：${response.status} ${response.statusText}`)
          }
          setLoading(false)
          return
        }

        const data = await response.json()
        setResults(data)
        setError(null)
      } catch (err) {
        console.error('Query failed:', err)
        setError(`${rpStrings.resultExpired}：${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [taskId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{rpStrings.loadingResults}</h2>
          <p className="text-gray-600">{rpStrings.queryingResults}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{rpStrings.queryFailed}</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <a
                href="/"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                {rpStrings.backToHome}
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{rpStrings.noResults}</h2>
          <p className="text-gray-600">{rpStrings.checkTaskId}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 頁面標題 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">{rpStrings.analysisResults}</h1>
          </div>
          <p className="text-gray-600">
            {rpStrings.taskId}: <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{taskId}</span>
          </p>
          {results.completedAt && (
            <p className="text-gray-600 text-sm mt-2">
              {rpStrings.completedAt}: {new Date(results.completedAt).toLocaleString('zh-TW')}
            </p>
          )}
        </div>

        {/* 主儀表板 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <V5ResultsDashboard results={results.result} isLoading={false} />
        </div>

        {/* 原始內容摘要 */}
        {results.content && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{rpStrings.submittedContent}</h2>
            <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              <p className="text-gray-700 text-sm whitespace-pre-wrap">
                {results.content.substring(0, 500)}
                {results.content.length > 500 && '...'}
              </p>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {rpStrings.characterCount}: {results.content.length} | {rpStrings.keywords}: {results.keywords?.join(', ') || rpStrings.none}
            </p>
          </div>
        )}

        {/* 詳細分析 */}
        {results.result?.strategyAnalysis && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{rpStrings.strategyAnalysisDetails}</h2>
            <div className="space-y-6">
              {[
                { key: 'why', label: rpStrings.whyProblem, icon: '🤔' },
                { key: 'how', label: rpStrings.howImplementation, icon: '🛠️' },
                { key: 'what', label: rpStrings.whatSolution, icon: '✨' }
              ].map(({ key, label, icon }) => {
                const analysis = results.result.strategyAnalysis[key]
                return (
                  <div key={key} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{icon}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
                      <span className="ml-auto text-2xl font-bold text-blue-600">{analysis.score}/10</span>
                    </div>
                    <p className="text-gray-700 mb-2">{analysis.explanation}</p>
                    {analysis.evidence && (
                      <p className="text-sm text-gray-600 italic">
                        <strong>{rpStrings.evidence}:</strong> {analysis.evidence}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 建議 */}
        {results.result?.recommendations && results.result.recommendations.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{rpStrings.improvementSuggestions}</h2>
            <div className="space-y-4">
              {results.result.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${rec.priority === 'high'
                      ? 'bg-red-50 border-red-500'
                      : rec.priority === 'medium'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-blue-50 border-blue-500'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${rec.priority === 'high'
                              ? 'bg-red-200 text-red-800'
                              : rec.priority === 'medium'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-blue-200 text-blue-800'
                            }`}
                        >
                          {rec.priority.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{rec.dimension}</span>
                      </div>
                      <p className="text-gray-700">{rec.suggestion}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 返回按鈕 */}
        <div className="text-center">
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            {rpStrings.backToHome}
          </a>
        </div>
      </div>
    </div>
  )
}
