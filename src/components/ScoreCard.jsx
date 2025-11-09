import { TrendingUp, AlertCircle } from 'lucide-react'

export default function ScoreCard({ 
  title, 
  score, 
  maxScore = 100,
  description,
  breakdown = null,
  color = 'blue',
  showTrend = false,
  trendDirection = 'up'
}) {
  // 統一轉換為 0-100 分制
  const normalizedScore = Math.round((score / maxScore) * 100)
  
  // 根據分數決定顏色和標籤
  const getScoreStatus = (s) => {
    if (s >= 80) return { color: 'from-green-500 to-emerald-500', label: '優秀', textColor: 'text-green-600' }
    if (s >= 60) return { color: 'from-blue-500 to-cyan-500', label: '良好', textColor: 'text-blue-600' }
    if (s >= 40) return { color: 'from-yellow-500 to-orange-500', label: '中等', textColor: 'text-yellow-600' }
    return { color: 'from-orange-500 to-red-500', label: '需改進', textColor: 'text-orange-600' }
  }

  const status = getScoreStatus(normalizedScore)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        {showTrend && (
          <div className="flex items-center gap-1">
            <TrendingUp className={`w-4 h-4 ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`} />
            <span className={`text-xs font-semibold ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trendDirection === 'up' ? '↑' : '↓'}
            </span>
          </div>
        )}
      </div>

      {/* 圓形進度條 */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* 背景圓 */}
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            {/* 進度圓 */}
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={status.color.split(' ')[1]}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{
                background: `linear-gradient(135deg, ${status.color})`
              }}
            />
          </svg>
          {/* 中心文字 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-4xl font-bold ${status.textColor}`}>
              {normalizedScore}
            </div>
            <div className="text-xs text-gray-500 mt-1">/ 100</div>
          </div>
        </div>
      </div>

      {/* 狀態標籤 */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.textColor} bg-opacity-10`}
              style={{ backgroundColor: status.textColor.replace('text-', 'bg-').replace('-600', '-100') }}>
          {status.label}
        </span>
      </div>

      {/* 分解數據 */}
      {breakdown && (
        <div className="border-t pt-4 mt-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">組成分析</p>
          <div className="space-y-2">
            {Object.entries(breakdown).map(([key, value]) => {
              const val = typeof value === 'number' ? value : 0
              const pct = Math.round((val / 10) * 100)
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-16 capitalize">{key}:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${status.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-10 text-right">{val}/10</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 警告提示 */}
      {normalizedScore < 40 && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex gap-2">
          <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700">
            此項評分較低，建議優先改善。查看下方建議了解改進方向。
          </p>
        </div>
      )}
    </div>
  )
}
