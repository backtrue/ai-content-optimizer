import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useLocale } from '../locales/useLocale'

const BREAKDOWN_LABEL_MAP = {
  headingStructure: '標題結構',
  contentOrganization: '內容編排',
  readability: '易讀性',
  evidence: '佐證資料',
  experience: '實務經驗',
  freshness: '時效與更新',
  actionability: '可執行性',
  semanticQuality: '語意品質',
  credibility: '可信度',
  trustSignals: '信任訊號',
  why: 'Why（為何）',
  how: 'How（如何）',
  what: 'What（做什麼）',
  overallScore: '整體策略指標',
  structure: '結構',
  strategy: '策略'
}

const STATUS_CONFIG = [
  {
    threshold: 80,
    label: '優秀',
    textClass: 'text-green-600',
    badgeClass: 'bg-green-100 text-green-700',
    strokeColor: '#22c55e'
  },
  {
    threshold: 60,
    label: '良好',
    textClass: 'text-blue-600',
    badgeClass: 'bg-blue-100 text-blue-700',
    strokeColor: '#3b82f6'
  },
  {
    threshold: 40,
    label: '中等',
    textClass: 'text-amber-600',
    badgeClass: 'bg-amber-100 text-amber-700',
    strokeColor: '#f59e0b'
  }
]

const DEFAULT_STATUS = {
  label: '需改進',
  textClass: 'text-orange-600',
  badgeClass: 'bg-orange-100 text-orange-700',
  strokeColor: '#f97316'
}

function resolveStatus(score) {
  for (const config of STATUS_CONFIG) {
    if (score >= config.threshold) {
      return config
    }
  }
  return DEFAULT_STATUS
}

export default function ScoreCard({
  title,
  score = 0,
  maxScore = 100,
  description,
  breakdown = null,
  explanations = null,
  footer
}) {
  const { strings } = useLocale()
  const { scoreCard: scoreCardStrings } = strings
  const [expandedKeys, setExpandedKeys] = useState({})
  const safeMax = Number(maxScore) || 100
  const raw = Number(score) || 0
  const normalizedScore = Math.max(0, Math.min(100, Math.round((raw / safeMax) * 100)))
  const status = resolveStatus(normalizedScore)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference
  const breakdownEntries = breakdown && typeof breakdown === 'object'
    ? Object.entries(breakdown)
    : []
  const explanationEntries = explanations && typeof explanations === 'object' ? explanations : {}

  const toggleExplanation = (key) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  return (
    <div className="card space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={status.strokeColor}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-4xl font-extrabold ${status.textClass}`}>
              {normalizedScore}
            </div>
            <div className="text-xs text-gray-500 mt-1">/ 100</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.badgeClass}`}>
          {status.label}
        </span>
      </div>

      {breakdownEntries.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">{scoreCardStrings.scoreComposition}</p>
          <div className="space-y-2">
            {breakdownEntries.map(([rawLabel, value]) => {
              const numeric = Number(value) || 0
              const pct = Math.max(0, Math.min(100, Math.round(numeric <= 1 ? numeric * 100 : numeric * 10)))
              const displayValue = numeric <= 10 ? `${numeric}/10` : `${numeric}`
              const labelKey = typeof rawLabel === 'string' ? rawLabel : String(rawLabel)
              const normalizedKey = typeof labelKey === 'string' ? labelKey.toLowerCase() : labelKey
              const translatedLabel = BREAKDOWN_LABEL_MAP[labelKey]
                || (typeof normalizedKey === 'string' ? BREAKDOWN_LABEL_MAP[normalizedKey] : undefined)
                || labelKey
              const explanation = explanationEntries[labelKey]
                || (typeof normalizedKey === 'string' ? explanationEntries[normalizedKey] : undefined)
              const explanationKey = typeof normalizedKey === 'string' ? normalizedKey : labelKey
              const isExpanded = explanation ? Boolean(expandedKeys[explanationKey]) : false

              return (
                <div key={labelKey} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 min-w-[96px]">
                      {translatedLabel}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-yellow-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-12 text-right">
                      {displayValue}
                    </span>
                  </div>
                  {explanation && (
                    <div className="bg-orange-50 border border-orange-100 rounded-lg">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-orange-700 hover:bg-orange-100 transition"
                        onClick={() => toggleExplanation(explanationKey)}
                      >
                        <span>{isExpanded ? scoreCardStrings.collapseExplanation : scoreCardStrings.expandExplanation}</span>
                        <span className="text-orange-500 font-semibold">{isExpanded ? '－' : '＋'}</span>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 text-xs text-orange-700 leading-relaxed">
                          {explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {normalizedScore < 40 && (
        <div className="flex gap-2 items-start bg-orange-50 border border-orange-100 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700 leading-relaxed">
            {strings.results.lowScoreWarning}
          </p>
        </div>
      )}

      {footer}
    </div>
  )
}
