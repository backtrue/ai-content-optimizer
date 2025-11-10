import React from 'react'
import { TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useLocale } from '../locales/useLocale'

/**
 * v5 結果儀表板
 * 顯示 40% 結構分 + 60% 策略分的雙軌評分
 */
export default function V5ResultsDashboard({ results, isLoading }) {
  const { strings } = useLocale()
  const { v5Dashboard: v5Strings } = strings
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <TrendingUp className="w-8 h-8 text-blue-600 mx-auto" />
          </div>
          <p className="text-gray-600">{v5Strings.analyzing}</p>
        </div>
      </div>
    )
  }

  if (!results?.v5Scores) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900">{v5Strings.noResults}</h3>
            <p className="text-sm text-yellow-800">{v5Strings.pleaseSubmit}</p>
          </div>
        </div>
      </div>
    )
  }

  const { structureScore, strategyScore, overallScore, breakdown, recommendations } = results.v5Scores

  return (
    <div className="space-y-6">
      {/* 總分卡片 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 mb-2">{v5Strings.overallScore}</p>
          <div className="text-5xl font-bold text-blue-600 mb-2">{overallScore}</div>
          <p className="text-sm text-gray-600">{v5Strings.outOf}</p>
        </div>

        <p className="text-center text-sm text-gray-700 mb-4">
          {overallScore >= 80 && v5Strings.excellent}
          {overallScore >= 60 && overallScore < 80 && v5Strings.good}
          {overallScore >= 40 && overallScore < 60 && v5Strings.fair}
          {overallScore < 40 && v5Strings.needsImprovement}
        </p>
      </div>

      {/* 雙軌分數 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 結構分 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{v5Strings.structureScore}</h3>
            <span className="text-2xl font-bold text-green-600">{structureScore}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${structureScore}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">40% {v5Strings.weight}</p>
        </div>

        {/* 策略分 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{v5Strings.strategyScore}</h3>
            <span className="text-2xl font-bold text-purple-600">{strategyScore}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-purple-500 h-2 rounded-full"
              style={{ width: `${strategyScore}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">60% {v5Strings.weight}</p>
        </div>
      </div>

      {/* 結構分細項 */}
      {breakdown?.structure && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{v5Strings.structureDetails}</h3>
          <div className="space-y-2">
            {Object.entries(breakdown.structure).map(([key, score]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{key}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded"
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-600 font-mono text-xs">{score}/10</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 策略分細項 */}
      {breakdown?.strategy && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{v5Strings.strategyDetails}</h3>
          <div className="space-y-3">
            {[
              { key: 'why', label: v5Strings.whyLabel, color: 'blue' },
              { key: 'how', label: v5Strings.howLabel, color: 'purple' },
              { key: 'what', label: v5Strings.whatLabel, color: 'indigo' }
            ].map(({ key, label, color }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className={`text-sm font-bold text-${color}-600`}>
                    {breakdown.strategy[key]}/10
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-${color}-500 h-2 rounded-full`}
                    style={{ width: `${(breakdown.strategy[key] / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建議 */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3">{v5Strings.suggestions}</h3>
          <div className="space-y-2">
            {recommendations.slice(0, 5).map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">{rec.title}</p>
                  <p className="text-xs text-blue-800">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
