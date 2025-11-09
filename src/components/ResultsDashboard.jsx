import { useState } from 'react'
import ScoreCard from './ScoreCard'
import Recommendations from './Recommendations'
import { Info, Target, Layers, ListChecks, MessagesSquare, Sparkles, CheckCircle2, AlertCircle, XCircle, MinusCircle } from 'lucide-react'

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
    breakdown: v5Scores.breakdown,
    recommendations: v5Scores.recommendations || [],
    isV5: true
  } : {
    overall: overallScore,
    structure: aeoScore,
    strategy: seoScore,
    breakdown: null,
    recommendations: recommendations,
    isV5: false
  }

  const convertToPercent = (value) => {
    if (value === null || value === undefined) return null
    const num = Number(value)
    if (!Number.isFinite(num)) return null
    if (num >= 0 && num <= 1) return Math.round(num * 100)
    if (num <= 10) return Math.round(num * 10)
    return Math.round(Math.min(num, 100))
  }

  const getMetricStatus = (percent) => {
    if (percent === null) {
      return {
        label: '尚未評估',
        icon: <MinusCircle className="w-5 h-5 text-gray-400" />,
        barClass: 'bg-gray-300',
        textClass: 'text-gray-500'
      }
    }
    if (percent >= 80) {
      return {
        label: '表現優秀',
        icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
        barClass: 'bg-green-500',
        textClass: 'text-green-600'
      }
    }
    if (percent >= 60) {
      return {
        label: '尚可提升',
        icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
        barClass: 'bg-amber-400',
        textClass: 'text-amber-600'
      }
    }
    if (percent > 0) {
      return {
        label: '優先改善',
        icon: <XCircle className="w-5 h-5 text-orange-500" />,
        barClass: 'bg-orange-500',
        textClass: 'text-orange-600'
      }
    }
    return {
      label: '亟待補強',
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      barClass: 'bg-red-500',
      textClass: 'text-red-600'
    }
  }

  const renderFeatures = (features = []) => {
    const items = Array.isArray(features)
      ? features.filter((item) => typeof item === 'string' && item.trim())
      : []
    if (!items.length) return null
    return (
      <div className="text-xs text-gray-500 ml-7">
        <div className="flex items-center gap-1 font-semibold text-gray-600 mb-1">
          <Sparkles className="w-3 h-3" />
          <span>關鍵訊號</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              {item}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const renderEvidence = (evidence = []) => {
    const items = Array.isArray(evidence)
      ? evidence.filter((item) => typeof item === 'string' && item.trim())
      : []
    if (!items.length) return null
    return (
      <div className="text-xs text-gray-500 ml-7">
        <p className="font-semibold text-gray-600 mb-1">佐證重點</p>
        <ul className="list-disc list-outside ml-4 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }

  const formatWeight = (weight) => {
    const value = Number(weight)
    if (!Number.isFinite(value) || value <= 0) return null
    return `${value}%`
  }

  const renderMetricGroup = ({
    title,
    description,
    metrics: metricList
  }) => {
    const safeMetrics = Array.isArray(metricList) ? metricList : []

    return (
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {description && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        )}
        <div className="space-y-3">
          {safeMetrics.map((metric, index) => {
            const percent = convertToPercent(metric?.score)
            const status = getMetricStatus(percent)
            return (
              <div key={`${metric?.name || 'metric'}-${index}`} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="mt-0.5">{status.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {metric?.name || '未命名指標'}
                        </span>
                        {formatWeight(metric?.weight) && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            權重 {formatWeight(metric.weight)}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${status.textClass}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {percent === null ? '—' : `${percent}/100`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${status.barClass}`}
                    style={{ width: `${percent === null ? 0 : percent}%` }}
                  />
                </div>
                {metric?.description && (
                  <p className="text-xs text-gray-500 ml-7">{metric.description}</p>
                )}
                {renderFeatures(metric?.features)}
                {renderEvidence(metric?.evidence)}
              </div>
            )
          })}
          {!safeMetrics.length && (
            <p className="text-sm text-gray-500">目前尚未提供相關指標資料。</p>
          )}
        </div>
      </div>
    )
  }

  const priorityBadge = (priority) => {
    const mapping = {
      high: { label: '高優先級', className: 'bg-red-100 text-red-700' },
      medium: { label: '中優先級', className: 'bg-amber-100 text-amber-700' },
      low: { label: '低優先級', className: 'bg-blue-100 text-blue-700' }
    }
    return mapping[priority] || { label: '建議', className: 'bg-gray-100 text-gray-600' }
  }

  const prioritizedRecommendations = Array.isArray(displayScores.recommendations)
    ? displayScores.recommendations.filter((rec) => rec && rec.title)
    : []

  const effectiveRecommendations = prioritizedRecommendations.length > 0
    ? prioritizedRecommendations
    : (Array.isArray(recommendations) ? recommendations : [])

  const metricsAeo = Array.isArray(metrics?.aeo) ? metrics.aeo : []
  const metricsSeo = Array.isArray(metrics?.seo) ? metrics.seo : []

  const toggleChunk = (id) => {
    setSelectedChunkIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-8">
      {/* WHY - 總覽 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Info className="w-4 h-4" />
          <span>為什麼需要關注這份分析？</span>
        </div>
        <ScoreCard
          title="v5 綜合評分"
          score={displayScores.overall}
          maxScore={displayScores.isV5 ? 10 : 100}
          description={displayScores.isV5
            ? '最新 v5 評分模型，結構（40%）與策略（60%）加權的整體表現。'
            : '目前尚未取得 v5 評分，以下為舊版綜合分數。'}
          breakdown={displayScores.isV5 ? {
            '結構構面（40%）': displayScores.structure,
            '策略構面（60%）': displayScores.strategy
          } : null}
        />
      </section>

      {/* HOW - 主要構面 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Target className="w-4 h-4" />
          <span>分數是怎麼算出來的？</span>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <ScoreCard
            title="結構分"
            score={displayScores.structure}
            maxScore={displayScores.isV5 ? 10 : 100}
            description="檢視內容是否具備良好的結構、可讀性、證據與經驗支撐。"
            breakdown={displayScores.isV5 ? displayScores.breakdown?.structure : null}
          />
          <ScoreCard
            title="策略分"
            score={displayScores.strategy}
            maxScore={displayScores.isV5 ? 10 : 100}
            description="衡量 Why / How / What 策略框架是否完整，內容是否與目標受眾對話。"
            breakdown={displayScores.isV5 ? displayScores.breakdown?.strategy : null}
          />
        </div>
      </section>

      {/* WHAT - 行動建議與指標 */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Layers className="w-4 h-4" />
          <span>具體可以怎麼改善？</span>
        </div>

        {prioritizedRecommendations.length > 0 && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <MessagesSquare className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">優先改善建議</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              根據 v5 評分的結構與策略構面，以下建議優先處理可快速拉升整體分數。
            </p>
            <div className="space-y-3">
              {prioritizedRecommendations.map((rec, index) => {
                const badge = priorityBadge(rec.priority)
                return (
                  <div key={`${rec.title}-${index}`} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                        {rec.description && (
                          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{rec.description}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    {rec.category && (
                      <div className="mt-2 text-xs text-gray-500">
                        分類：{rec.category}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {renderMetricGroup({
            title: '結構洞察',
            description: '聚焦段落結構、摘要整理、對話語氣與互動引導，協助內容更易讀、易理解。',
            metrics: metricsAeo
          })}
          {renderMetricGroup({
            title: '策略洞察',
            description: '涵蓋 helpfulness、內容深度、可信度與關鍵字覆蓋，讓內容更貼近搜尋與目標讀者需求。',
            metrics: metricsSeo
          })}
        </div>

        {effectiveRecommendations.length > 0 && (
          <Recommendations
            recommendations={effectiveRecommendations}
            feedbackContext={feedbackContext}
            apiBaseUrl={apiBaseUrl}
            selectedChunkIds={selectedChunkIds}
          />
        )}
      </section>

      {chunks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Layers className="w-4 h-4" />
            <span>原文段落檢視</span>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-4">
              逐段檢視原文內容，搭配上方建議調整文字、例證與結構。
            </p>
            <div className="space-y-3">
              {chunks.map((chunk) => (
                <div key={chunk.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleChunk(chunk.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-primary-600" />
                      <span className="text-sm font-semibold text-gray-700">
                        段落 {chunk.id}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {selectedChunkIds.includes(chunk.id) ? '收合' : '展開'}
                    </div>
                  </button>
                  {selectedChunkIds.includes(chunk.id) && (
                    <div className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-600">原文內容</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded-md p-3 border border-gray-100">
                        {chunk.text}
                      </pre>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Tokens: {chunk.tokens}</span>
                        <span>段落數: {chunk.segmentCount}</span>
                        <span>格式: {chunk.sourceFormat}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
