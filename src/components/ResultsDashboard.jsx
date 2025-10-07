import ScoreGauge from './ScoreGauge'
import MetricsBreakdown from './MetricsBreakdown'
import Recommendations from './Recommendations'
import { Trophy } from 'lucide-react'

export default function ResultsDashboard({ results }) {
  const { overallScore, aeoScore, seoScore, metrics, recommendations } = results

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

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="card bg-gradient-to-br from-primary-50 to-purple-50 border-2 border-primary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10 text-primary-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">綜合評分</h2>
              <p className="text-gray-600">Overall Content Score</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}
            </div>
            <div className="text-lg text-gray-600">{getScoreLabel(overallScore)}</div>
          </div>
        </div>
      </div>

      {/* Dual Core Scores */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">AEO/RAG 友善度</h3>
          <ScoreGauge score={aeoScore} label="AEO Score" color="blue" />
          <p className="text-sm text-gray-600 mt-4">
            評估內容對 AI 檢索增強生成的友善程度
          </p>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold text-gray-800 mb-4">傳統 SEO 效能</h3>
          <ScoreGauge score={seoScore} label="SEO Score" color="purple" />
          <p className="text-sm text-gray-600 mt-4">
            評估內容的搜尋引擎優化表現
          </p>
        </div>
      </div>

      {/* Detailed Metrics */}
      <MetricsBreakdown metrics={metrics} />

      {/* Recommendations */}
      <Recommendations recommendations={recommendations} />
    </div>
  )
}
