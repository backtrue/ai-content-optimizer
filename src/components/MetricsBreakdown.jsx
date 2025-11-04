import { CheckCircle2, AlertCircle, XCircle, Sparkles } from 'lucide-react'

export default function MetricsBreakdown({ metrics }) {
  const aeoMetrics = Array.isArray(metrics?.aeo) ? metrics.aeo : []
  const seoMetrics = Array.isArray(metrics?.seo) ? metrics.seo : []

  const formatWeight = (weight) => {
    const value = Number(weight)
    if (!Number.isFinite(value) || value <= 0) return null
    return `${value}%`
  }

  const renderEvidence = (evidence = []) => {
    const items = Array.isArray(evidence)
      ? evidence.filter(item => typeof item === 'string' && item.trim())
      : []

    if (!items.length) return null

    return (
      <div className="text-xs text-gray-500 ml-7">
        <p className="font-semibold text-gray-600 mb-1">佐證依據</p>
        <ul className="list-disc list-outside ml-4 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }

  const renderFeatures = (features = []) => {
    const items = Array.isArray(features)
      ? features.filter(item => typeof item === 'string' && item.trim())
      : []

    if (!items.length) return null

    return (
      <div className="text-[11px] text-gray-500 ml-7">
        <div className="flex items-center gap-1 font-semibold text-gray-600 mb-1">
          <Sparkles className="w-3 h-3" />
          <span>關鍵訊號</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const getScoreIcon = (score) => {
    if (score >= 8) return <CheckCircle2 className="w-5 h-5 text-green-600" />
    if (score >= 6) return <AlertCircle className="w-5 h-5 text-yellow-600" />
    return <XCircle className="w-5 h-5 text-red-600" />
  }
  const getScoreBarColor = (score) => {
    if (score >= 8) return 'bg-green-600'
    if (score >= 6) return 'bg-yellow-600'
    return 'bg-red-600'
  }
  const getBarWidth = (score) => {
    const clamped = Math.min(10, Math.max(0, Number(score) || 0))
    return `${clamped * 10}%`
  }

  return (
    <div className="card">
      <h3 className="text-xl font-bold text-gray-800 mb-6">內容指標分析</h3>

      <div className="space-y-6">
        {/* AEO Metrics */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="font-semibold text-gray-700 text-lg">AEO 評估（4 項指標）</h4>
            <p className="text-xs text-gray-500">聚焦答案抽取、摘要整理、語氣與互動指引</p>
          </div>
          <div className="space-y-3">
            {aeoMetrics.map((metric, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getScoreIcon(metric.score)}
                    <span className="text-sm font-medium text-gray-700">
                      {metric.name}
                    </span>
                    {formatWeight(metric.weight) && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        權重 {formatWeight(metric.weight)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {metric.score}/10
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getScoreBarColor(metric.score)}`}
                    style={{ width: getBarWidth(metric.score) }}
                  />
                </div>
                {metric.description && (
                  <p className="text-xs text-gray-500 ml-7">{metric.description}</p>
                )}
                {renderFeatures(metric.features)}
                {renderEvidence(metric.evidence)}
              </div>
            ))}
            {!aeoMetrics.length && (
              <p className="text-sm text-gray-500">尚未提供 AEO 指標資料。</p>
            )}
          </div>
        </div>

        {/* SEO Metrics */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="font-semibold text-gray-700 text-lg">SEO 評估（13 項指標）</h4>
            <p className="text-xs text-gray-500">涵蓋 helpfulness、意圖契合、深度、信任與專家性</p>
          </div>
          <div className="space-y-3">
            {seoMetrics.map((metric, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getScoreIcon(metric.score)}
                    <span className="text-sm font-medium text-gray-700">
                      {metric.name}
                    </span>
                    {formatWeight(metric.weight) && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                        權重 {formatWeight(metric.weight)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {metric.score}/10
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getScoreBarColor(metric.score)}`}
                    style={{ width: getBarWidth(metric.score) }}
                  />
                </div>
                {metric.description && (
                  <p className="text-xs text-gray-500 ml-7">{metric.description}</p>
                )}
                {renderFeatures(metric.features)}
                {renderEvidence(metric.evidence)}
              </div>
            ))}
            {!seoMetrics.length && (
              <p className="text-sm text-gray-500">尚未提供 SEO 指標資料。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
