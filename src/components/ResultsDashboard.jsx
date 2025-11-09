import { useState } from 'react'
import ScoreCard from './ScoreCard'
import Recommendations from './Recommendations'
import GuideModal from './GuideModal'
import { Info, Target, Layers, ListChecks, MessagesSquare, Sparkles, CheckCircle2, AlertCircle, XCircle, MinusCircle, BookOpen } from 'lucide-react'

const OVERALL_EXPLANATIONS = {
  '結構構面（40%）': '內容的段落編排、可讀性、證據與經驗等結構訊號，占 v5 評分 40%，確保文章骨架穩固。',
  '策略構面（60%）': '黃金圈 WHY/HOW/WHAT 策略深度，占 60%，反映內容是否真正回應讀者與搜尋需求。'
}

const STRUCTURE_EXPLANATIONS = {
  headingStructure: '檢查 H1/H2 層級是否清楚、標題命名是否聚焦主題，讓讀者與搜尋引擎快速掌握大綱。',
  contentOrganization: '評估段落、清單、表格等結構化元素的運用，確保資訊有條理、不散亂。',
  readability: '衡量句子長度與長段落比例，確認語句流暢、段落適中，減輕閱讀負擔。',
  evidence: '檢視是否援引數據、年份與可靠來源，佐證內容主張並提升可信度。',
  experience: '偵測第一人稱經驗、案例或實作心得，強化 EEAT 的「經驗」信號。',
  freshness: '確認是否揭露更新日期並引用近期資訊，避免過時內容影響搜尋可信度。',
  actionability: '看內容是否提供步驟、檢核表或具體建議，協助讀者立即採取行動。',
  semanticQuality: '針對 HTML 模式評估語意自然度與段落聚焦度，避免堆砌關鍵字。',
  contentLength: '純文字模式下評估字數與段落密度是否足以完整回答主題、維持節奏。'
}

const STRATEGY_EXPLANATIONS = {
  why: '說明為什麼這個主題重要，是否具體描繪讀者痛點與情境，建立內容可信賴的理由。',
  how: '評估內容是否提供清楚步驟、方法與執行準則，讓讀者知道該怎麼做。',
  what: '檢查最終主張與行動呼籲是否明確，幫助讀者了解下一步或可得到的價值。',
  overallScore: '黃金圈三構面平均後的策略表現，用來衡量整體說服力與敘事完整度。'
}

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
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [guideContent, setGuideContent] = useState('')
  const [guideTitle, setGuideTitle] = useState('')
  const [guideMetricName, setGuideMetricName] = useState('')

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
                        <button
                          onClick={() => openGuideModal(metric?.name)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium transition"
                          title="查看優化指南"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>指南</span>
                        </button>
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

  const openGuideModal = async (metricName) => {
    // 指標名稱到文件名的映射
    const guideMap = {
      '搜尋意圖契合': '搜尋意圖契合優化指南.md',
      'intentFit': '搜尋意圖契合優化指南.md',
      'Helpful Ratio': 'Helpful_Ratio優化指南.md',
      'helpfulRatio': 'Helpful_Ratio優化指南.md',
      '內容覆蓋與深度': '內容覆蓋與深度優化指南.md',
      'depthCoverage': '內容覆蓋與深度優化指南.md',
      '延伸疑問與關鍵字覆蓋': '延伸疑問與關鍵字覆蓋優化指南.md',
      'intentExpansion': '延伸疑問與關鍵字覆蓋優化指南.md',
      '行動可行性': '行動可行性優化指南.md',
      'actionability': '行動可行性優化指南.md',
      '可讀性與敘事節奏': '可讀性與敘事節奏優化指南.md',
      'readabilityRhythm': '可讀性與敘事節奏優化指南.md',
      '結構化重點提示': '結構化重點提示優化指南.md',
      'structureHighlights': '結構化重點提示優化指南.md',
      '作者與品牌辨識': '作者與品牌辨識優化指南.md',
      'authorBrandSignals': '作者與品牌辨識優化指南.md',
      '可信證據與引用': '可信證據與引用優化指南.md',
      'evidenceSupport': '可信證據與引用優化指南.md',
      '第一手經驗與案例': '第一手經驗與案例優化指南.md',
      'experienceSignals': '第一手經驗與案例優化指南.md',
      '敘事具體度與資訊密度': '敘事具體度與資訊密度優化指南.md',
      'narrativeDensity': '敘事具體度與資訊密度優化指南.md',
      '時效與更新訊號': '時效與更新訊號優化指南.md',
      'freshnessSignals': '時效與更新訊號優化指南.md',
      '專家觀點與判斷': '專家觀點與判斷優化指南.md',
      'expertPerspective': '專家觀點與判斷優化指南.md',
      '答案可抽取性': '答案可抽取性優化指南.md',
      'extractability': '答案可抽取性優化指南.md',
      '關鍵摘要與重點整理': '關鍵摘要與重點整理優化指南.md',
      'keySummary': '關鍵摘要與重點整理優化指南.md',
      '對話式語氣與指引': '對話式語氣與指引優化指南.md',
      'conversationalGuidance': '對話式語氣與指引優化指南.md',
      '讀者互動與後續引導': '讀者互動與後續引導優化指南.md',
      'readerActivation': '讀者互動與後續引導優化指南.md'
    }

    const fileName = guideMap[metricName]
    if (!fileName) {
      console.warn(`未找到指標 ${metricName} 的指南`)
      return
    }

    try {
      // 動態載入優化指南內容
      const response = await fetch(`/docs/product/${fileName}`)
      if (response.ok) {
        const content = await response.text()
        setGuideContent(content)
        setGuideTitle(`${metricName}優化指南`)
        setGuideMetricName(metricName)
        setGuideModalOpen(true)
      } else {
        alert('無法載入優化指南，請稍後重試。')
      }
    } catch (error) {
      console.error('載入指南失敗:', error)
      alert('載入指南時發生錯誤，請稍後重試。')
    }
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
          explanations={displayScores.isV5 ? OVERALL_EXPLANATIONS : null}
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
            explanations={displayScores.isV5 ? STRUCTURE_EXPLANATIONS : null}
          />
          <ScoreCard
            title="策略分"
            score={displayScores.strategy}
            maxScore={displayScores.isV5 ? 10 : 100}
            description="衡量 Why / How / What 策略框架是否完整，內容是否與目標受眾對話。"
            breakdown={displayScores.isV5 ? displayScores.breakdown?.strategy : null}
            explanations={displayScores.isV5 ? STRATEGY_EXPLANATIONS : null}
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

      {/* 優化指南彈出視窗 */}
      <GuideModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        title={guideTitle}
        content={guideContent}
        metricName={guideMetricName}
      />
    </div>
  )
}
