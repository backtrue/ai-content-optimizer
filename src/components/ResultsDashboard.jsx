import { useState } from 'react'
import ScoreGauge from './ScoreGauge'
import MetricsBreakdown from './MetricsBreakdown'
import Recommendations from './Recommendations'
// import ScoreHistoryPanel from './ScoreHistoryPanel'
import { Trophy, Sparkles } from 'lucide-react'

export default function ResultsDashboard({
  results,
  recommendations = [],
  onGenerateRecommendations,
  generatingRecommendations = false,
  feedbackContext,
  apiBaseUrl /*, history = [], onExportHistory, onClearHistory */
}) {
  if (results?.status === 'insufficient_metadata') {
    const unknownSignals = Array.isArray(results?.contentSignals?.unknownSignals)
      ? results.contentSignals.unknownSignals
      : []
    const inspectability = results?.contentSignals?.inspectability || {}

    return (
      <div className="space-y-6">
        <div className="card border border-yellow-200 bg-yellow-50">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl font-semibold text-yellow-800">無法評分：缺少 HTML metadata</h2>
              <p className="text-sm text-yellow-700">
                {results?.message || '偵測不到 `<head>` 區塊或結構化資料，請提供完整 HTML 後再重新檢測。'}
              </p>
            </div>

            <div className="rounded-lg bg-white border border-yellow-100 p-3 text-sm text-gray-700">
              <p className="font-medium text-gray-800 mb-1">目前偵測狀態</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <span className="font-semibold text-gray-600">Metadata 可檢測：</span>
                  <span>{inspectability.metadata === 'available' ? '是' : '否'}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Schema 可檢測：</span>
                  <span>{inspectability.schema === 'available' ? '是' : '否'}</span>
                </div>
              </div>
              {unknownSignals.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold text-gray-600">無法判斷的項目：</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {unknownSignals.map((flag) => (
                      <span key={flag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500">
              提示：請直接貼上完整頁面 HTML 或使用提供原始碼的 API，以便系統取用 Meta / Schema / 作者資訊等關鍵標記。
            </p>
          </div>
        </div>
      </div>
    )
  }

  const {
    overallScore,
    aeoScore,
    seoScore,
    metrics,
    chunks = [],
    recommendationsStatus,
    v5Scores
  } = results
  const [selectedChunkIds, setSelectedChunkIds] = useState([])

  // 優先使用 v5Scores，若無則使用舊版評分
  const displayScores = v5Scores ? {
    overall: v5Scores.overallScore,
    structure: v5Scores.structureScore,
    strategy: v5Scores.strategyScore,
    isV5: true
  } : {
    overall: overallScore,
    structure: aeoScore,
    strategy: seoScore,
    isV5: false
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreLabel = (score) => {
    if (score >= 80) return '優秀'
    if (score >= 60) return '良好'
    return '需改進'
  }

  const toggleChunk = (id) => {
    setSelectedChunkIds((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="card bg-gradient-to-br from-primary-50 to-purple-50 border-2 border-primary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10 text-primary-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {displayScores.isV5 ? 'v5 綜合評分' : '綜合評分'}
              </h2>
              <p className="text-gray-600">
                {displayScores.isV5 ? 'v5 Overall Score (結構 40% + 策略 60%)' : 'Overall Content Score'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${getScoreColor(displayScores.overall * 10)}`}>
              {displayScores.overall}
            </div>
            <div className="text-lg text-gray-600">{getScoreLabel(displayScores.overall * 10)}</div>
          </div>
        </div>
      </div>

      {/* Dual Core Scores */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {displayScores.isV5 ? '結構分' : 'AEO/RAG 友善度'}
          </h3>
          <ScoreGauge 
            score={displayScores.isV5 ? displayScores.structure * 10 : aeoScore} 
            label={displayScores.isV5 ? "Structure Score" : "AEO Score"} 
            color="blue" 
          />
          <p className="text-sm text-gray-600 mt-4">
            {displayScores.isV5 
              ? '評估內容的結構、可讀性、證據與經驗 (40% 權重)'
              : '評估內容對 AI 檢索增強生成的友善程度'
            }
          </p>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {displayScores.isV5 ? '策略分' : '傳統 SEO 效能'}
          </h3>
          <ScoreGauge 
            score={displayScores.isV5 ? displayScores.strategy * 10 : seoScore} 
            label={displayScores.isV5 ? "Strategy Score" : "SEO Score"} 
            color="purple" 
          />
          <p className="text-sm text-gray-600 mt-4">
            {displayScores.isV5 
              ? '評估內容的 Why/How/What 策略完整度 (60% 權重)'
              : '評估內容的搜尋引擎優化表現'
            }
          </p>
        </div>
      </div>

      {/* Detailed Metrics */}
      <MetricsBreakdown metrics={metrics} />

      {/* Chunk Visualization */}
      {chunks.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Chunk Visualization</h3>
          <p className="text-sm text-gray-600 mb-4">
            選擇與建議最相關的分段（Chunk），查看來源格式、段落標題與切分上下文。
          </p>
          <div className="space-y-3 max-h-96 overflow-auto pr-1">
            {chunks.map((c) => (
              <label
                key={c.id}
                className="flex gap-3 p-3 border border-gray-100 rounded-lg hover:border-primary-200 hover:bg-primary-50/30 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-1.5"
                  checked={selectedChunkIds.includes(c.id)}
                  onChange={() => toggleChunk(c.id)}
                />
                <div className="flex-1 text-sm text-gray-700 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">
                      Chunk #{c.id} · {c.tokens ?? '?'} tokens
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                      {c.sourceFormat?.toUpperCase?.() || 'PLAIN'}
                    </span>
                    {Array.isArray(c.headings) && c.headings.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.headings.slice(-3).map((heading, idx) => (
                          <span
                            key={`${c.id}-h-${idx}`}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                            title={heading}
                          >
                            {heading.length > 28 ? `${heading.slice(0, 28)}…` : heading}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {c.leadingContext && (
                    <p className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1 line-clamp-2" title={c.leadingContext}>
                      {c.leadingContext}
                    </p>
                  )}
                  <p className="line-clamp-3 leading-relaxed" title={c.text}>
                    {c.text}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-800">優化建議清單</h3>
            <p className="text-sm text-gray-600">先查看評分再決定是否產生建議，節省 LLM 成本</p>
          </div>
          {onGenerateRecommendations && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
              onClick={onGenerateRecommendations}
              disabled={
                generatingRecommendations ||
                recommendationsStatus === 'loading'
              }
            >
              <Sparkles className="w-4 h-4" />
              {generatingRecommendations || recommendationsStatus === 'loading' ? '產生中…' : '產生優化建議'}
            </button>
          )}
        </div>

        {recommendationsStatus === 'failed' && (
          <div className="p-3 bg-red-50 border border-red-100 text-sm text-red-700 rounded">
            建議生成失敗，請稍後再試一次。
          </div>
        )}

        {recommendationsStatus === 'not_requested' && recommendations.length === 0 && (
          <div className="p-6 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
            <p className="font-medium">尚未產生優化建議</p>
            <p className="text-sm">當你需要具體調整方向時，再按下上方按鈕即可。</p>
          </div>
        )}

        {recommendationsStatus !== 'not_requested' && (
          <Recommendations
            recommendations={recommendations}
            feedbackContext={feedbackContext}
            apiBaseUrl={apiBaseUrl}
            selectedChunkIds={selectedChunkIds}
          />
        )}
      </div>

      {/* Score History Panel disabled for now */}
      {/* <ScoreHistoryPanel history={history} onExport={onExportHistory} onClear={onClearHistory} /> */}
    </div>
  )
}
