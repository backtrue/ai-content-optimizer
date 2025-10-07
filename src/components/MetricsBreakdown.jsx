import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

export default function MetricsBreakdown({ metrics }) {
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

  return (
    <div className="card">
      <h3 className="text-xl font-bold text-gray-800 mb-6">詳細指標分析</h3>
      
      <div className="space-y-6">
        {/* AEO Metrics */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-3 text-lg">AEO/RAG 指標</h4>
          <div className="space-y-3">
            {metrics.aeo.map((metric, index) => (
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
                    style={{ width: `${metric.score * 10}%` }}
                  />
                </div>
                {metric.description && (
                  <p className="text-xs text-gray-500 ml-7">{metric.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SEO Metrics */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-3 text-lg">SEO 指標</h4>
          <div className="space-y-3">
            {metrics.seo.map((metric, index) => (
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
                    style={{ width: `${metric.score * 10}%` }}
                  />
                </div>
                {metric.description && (
                  <p className="text-xs text-gray-500 ml-7">{metric.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
