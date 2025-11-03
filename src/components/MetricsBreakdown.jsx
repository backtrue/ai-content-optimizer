import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

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
          <h4 className="font-semibold text-gray-700 mb-3 text-lg">AEO 評估（答案精準度 / 精選摘要適配 / 敘事可信度）</h4>
          <div className="space-y-3">
            {aeoMetrics.map((metric, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getScoreIcon(metric.score)}
                    <span className="text-sm font-medium text-gray-700">
                      {metric.name}
                    </span>
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
          <h4 className="font-semibold text-gray-700 mb-3 text-lg">SEO 評估（內容意圖契合 / 洞察與證據支持 / 可讀性與敘事流暢）</h4>
          <div className="space-y-3">
            {seoMetrics.map((metric, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
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
