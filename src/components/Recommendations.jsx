import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useLocale } from '../locales/useLocale'

const CATEGORY_MAP = {
  內容: {
    labelKey: 'categoryContent',
    className: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  信任: {
    labelKey: 'categoryTrust',
    className: 'bg-green-100 text-green-800 border-green-200'
  },
  讀者體驗: {
    labelKey: 'categoryExperience',
    className: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  結構: {
    labelKey: 'categoryStructure',
    className: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  策略: {
    labelKey: 'categoryStrategy',
    className: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  }
}

const CATEGORY_ALIASES = {
  SEO: '內容',
  AEO: '內容',
  Authority: '信任',
  Structure: '讀者體驗',
  Safety: '信任',
  內容: '內容',
  結構: '讀者體驗',
  'E-E-A-T': '信任',
  技術: '內容',
  風險: '信任'
}

const resolveCategory = (rawCategory) => {
  if (!rawCategory || typeof rawCategory !== 'string') return null
  const trimmed = rawCategory.trim()
  const normalized = CATEGORY_MAP[trimmed] ? trimmed : CATEGORY_ALIASES[trimmed]
  if (!normalized || !CATEGORY_MAP[normalized]) return null
  return CATEGORY_MAP[normalized]
}

export default function Recommendations({ recommendations = [], feedbackContext, apiBaseUrl, selectedChunkIds = [] }) {
  const { strings } = useLocale()
  const { recommendations: recStrings } = strings

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />
      default:
        return <Info className="w-5 h-5 text-gray-600" />
    }
  }

  const getPriorityBadge = (priority) => {
    const badges = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200'
    }
    const labels = {
      high: strings.results.highPriority,
      medium: strings.results.mediumPriority,
      low: strings.results.lowPriority
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${badges[priority]}`}>
        {labels[priority]}
      </span>
    )
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const safeRecommendations = Array.isArray(recommendations)
    ? recommendations.filter((rec) => rec && typeof rec === 'object')
    : []

  const sortedRecommendations = [...safeRecommendations].sort((a, b) => {
    const aPriority = priorityOrder[a?.priority] ?? 3
    const bPriority = priorityOrder[b?.priority] ?? 3
    return aPriority - bPriority
  })

  const [sendingId, setSendingId] = useState(null)
  const sendFeedback = async (recommendationId, verdict) => {
    if (!feedbackContext) return
    const { sessionId, contentHash, targetKeywords } = feedbackContext
    setSendingId(recommendationId)
    try {
      await fetch(`${apiBaseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          contentHash,
          targetKeywords,
          recommendationId,
          verdict, // 'up' | 'down'
          notes: null,
          chunkIds: selectedChunkIds
        })
      })
    } catch (e) {
      console.error('feedback failed', e)
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="card">
      <h3 className="text-xl font-bold text-gray-800 mb-6">{recStrings.title}</h3>
      
      <div className="space-y-4">
        {sortedRecommendations.map((rec, index) => (
          <div
            key={index}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {getPriorityIcon(rec.priority)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getPriorityBadge(rec.priority)}
                  {(() => {
                    const categoryInfo = resolveCategory(rec.category)
                    if (!categoryInfo) return null
                    return (
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${categoryInfo.className}`}>
                        {recStrings[categoryInfo.labelKey] || rec.category}
                      </span>
                    )
                  })()}
                </div>
                <p className="text-gray-800 font-medium mb-1">{rec.title}</p>
                <p className="text-sm text-gray-600">{rec.description}</p>
                {rec.example && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 border-l-2 border-primary-400">
                    <span className="font-semibold">{recStrings.example}：</span> {rec.example}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-50"
                    disabled={!feedbackContext || sendingId === `rec-${index}`}
                    onClick={() => sendFeedback(`rec-${index}`, 'up')}
                  >
                    {recStrings.helpful}
                  </button>
                  <button
                    className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-800 disabled:opacity-50"
                    disabled={!feedbackContext || sendingId === `rec-${index}`}
                    onClick={() => sendFeedback(`rec-${index}`, 'down')}
                  >
                    {recStrings.notApplicable}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sortedRecommendations.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>{recStrings.noRecommendations}</p>
        </div>
      )}
    </div>
  )
}
