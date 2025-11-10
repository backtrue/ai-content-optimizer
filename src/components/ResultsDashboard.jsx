import { useState } from 'react'
import ScoreCard from './ScoreCard'
import Recommendations from './Recommendations'
import GuideModal from './GuideModal'
import { useLocale } from '../locales/useLocale'
import { Info, Target, Layers, ListChecks, MessagesSquare, Sparkles, CheckCircle2, AlertCircle, XCircle, MinusCircle, BookOpen } from 'lucide-react'

// 指標名稱到 locale key 的映射
const METRIC_NAME_TO_KEY = {
  'Helpful Ratio': 'metricHelpfulRatio',
  '搜尋意圖契合': 'metricIntentFit',
  'Search Intent Fit': 'metricIntentFit',
  '内容覆蓋與深度': 'metricDepthCoverage',
  'Content Depth & Coverage': 'metricDepthCoverage',
  '延伸疑問與關鍵字覆蓋': 'metricIntentExpansion',
  'Intent Expansion & Keyword Coverage': 'metricIntentExpansion',
  '行動可行性': 'metricActionability',
  'Actionability': 'metricActionability',
  '可讀性與敘事節奏': 'metricReadabilityRhythm',
  'Readability & Narrative Rhythm': 'metricReadabilityRhythm',
  '結構化重點提示': 'metricStructureHighlights',
  'Structure Highlights': 'metricStructureHighlights',
  '作者與品牌辨識': 'metricAuthorBrandSignals',
  'Author & Brand Recognition': 'metricAuthorBrandSignals',
  '可信證據與引用': 'metricEvidenceSupport',
  'Evidence & Citations': 'metricEvidenceSupport',
  '第一手經驗與案例': 'metricExperienceSignals',
  'First-hand Experience & Case Studies': 'metricExperienceSignals',
  '敘事具體度與資訊密度': 'metricNarrativeDensity',
  'Narrative Specificity & Information Density': 'metricNarrativeDensity',
  '時效與更新訊號': 'metricFreshnessSignals',
  'Freshness & Update Signals': 'metricFreshnessSignals',
  '專家觀點與判斷': 'metricExpertPerspective',
  'Expert Perspective & Judgment': 'metricExpertPerspective',
  '答案可抽取性': 'metricExtractability',
  'Answer Extractability': 'metricExtractability',
  '關鍵摘要與重點整理': 'metricKeySummary',
  'Key Summary & Highlights': 'metricKeySummary',
  '對話式語氣與指引': 'metricConversationalGuidance',
  'Conversational Tone & Guidance': 'metricConversationalGuidance',
  '讀者互動與後續引導': 'metricReaderActivation',
  'Reader Engagement & Follow-up': 'metricReaderActivation'
}

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
  const { strings, locale } = useLocale()
  const { results: resultsStrings } = strings
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
              <h2 className="text-xl font-semibold text-yellow-800">{resultsStrings.insufficientMetadata}</h2>
              <p className="text-sm text-yellow-700">
                {results?.message || resultsStrings.hint}
              </p>
            </div>

            <div className="rounded-lg bg-white border border-yellow-100 p-3 text-sm text-gray-700">
              <p className="font-medium text-gray-800 mb-1">{resultsStrings.detectionStatus}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <span className="font-semibold text-gray-600">{resultsStrings.metadataUnavailable}：</span>
                  <span>{inspectability.metadata === 'available' ? resultsStrings.yes : resultsStrings.no}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">{resultsStrings.schemaUnavailable}：</span>
                  <span>{inspectability.schema === 'available' ? resultsStrings.yes : resultsStrings.no}</span>
                </div>
              </div>
              {unknownSignals.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold text-gray-600">{resultsStrings.undetectableItems}：</p>
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
              {resultsStrings.hint}
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
        label: resultsStrings.notEvaluatedYet,
        icon: <MinusCircle className="w-5 h-5 text-gray-400" />,
        barClass: 'bg-gray-300',
        textClass: 'text-gray-500'
      }
    }
    if (percent >= 80) {
      return {
        label: resultsStrings.excellentPerformance,
        icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
        barClass: 'bg-green-500',
        textClass: 'text-green-600'
      }
    }
    if (percent >= 60) {
      return {
        label: resultsStrings.canBeImproved,
        icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
        barClass: 'bg-amber-400',
        textClass: 'text-amber-600'
      }
    }
    if (percent > 0) {
      return {
        label: resultsStrings.priorityImprovement,
        icon: <XCircle className="w-5 h-5 text-orange-500" />,
        barClass: 'bg-orange-500',
        textClass: 'text-orange-600'
      }
    }
    return {
      label: resultsStrings.urgentImprovement,
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
          <span>{resultsStrings.keySignals}</span>
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
        <p className="font-semibold text-gray-600 mb-1">{resultsStrings.evidencePoints}</p>
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
    return `${resultsStrings.weight} ${value}%`
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
                          {strings.results[METRIC_NAME_TO_KEY[metric?.name]] || metric?.name || '未命名指標'}
                        </span>
                        {formatWeight(metric?.weight) && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            {formatWeight(metric.weight)}
                          </span>
                        )}
                        <button
                          onClick={() => openGuideModal(metric?.name)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium transition"
                          title={resultsStrings.loadGuideError}
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{strings.dashboard.guide}</span>
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
                {METRIC_NAME_TO_KEY[metric?.name] && (
                  <p className="text-xs text-gray-500 ml-7">
                    {strings.results[METRIC_NAME_TO_KEY[metric?.name] + 'Desc'] || metric?.description}
                  </p>
                )}
                {renderFeatures(metric?.features)}
                {renderEvidence(metric?.evidence)}
              </div>
            )
          })}
          {!safeMetrics.length && (
            <p className="text-sm text-gray-500">{resultsStrings.noMetricsAvailable}</p>
          )}
        </div>
      </div>
    )
  }

  const priorityBadge = (priority) => {
    const mapping = {
      high: { label: resultsStrings.highPriority, className: 'bg-red-100 text-red-700' },
      medium: { label: resultsStrings.mediumPriority, className: 'bg-amber-100 text-amber-700' },
      low: { label: resultsStrings.lowPriority, className: 'bg-blue-100 text-blue-700' }
    }
    return mapping[priority] || { label: resultsStrings.suggestion, className: 'bg-gray-100 text-gray-600' }
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
    // 指標名稱到文件名的映射（基礎名稱，不含語系路徑）
    const guideBaseMap = {
      '搜尋意圖契合': 'search-intent-fit',
      'Search Intent Fit': 'search-intent-fit',
      'Helpful Ratio': 'helpful-ratio',
      '內容覆蓋與深度': 'content-depth-coverage',
      'Content Depth & Coverage': 'content-depth-coverage',
      '延伸疑問與關鍵字覆蓋': 'intent-expansion',
      'Intent Expansion & Keyword Coverage': 'intent-expansion',
      '行動可行性': 'actionability',
      'Actionability': 'actionability',
      '可讀性與敘事節奏': 'readability-rhythm',
      'Readability & Narrative Rhythm': 'readability-rhythm',
      '結構化重點提示': 'structure-highlights',
      'Structure Highlights': 'structure-highlights',
      '作者與品牌辨識': 'author-brand-signals',
      'Author & Brand Recognition': 'author-brand-signals',
      '可信證據與引用': 'evidence-support',
      'Evidence & Citations': 'evidence-support',
      '第一手經驗與案例': 'experience-signals',
      'First-hand Experience & Case Studies': 'experience-signals',
      '敘事具體度與資訊密度': 'narrative-density',
      'Narrative Specificity & Information Density': 'narrative-density',
      '時效與更新訊號': 'freshness-signals',
      'Freshness & Update Signals': 'freshness-signals',
      '專家觀點與判斷': 'expert-perspective',
      'Expert Perspective & Judgment': 'expert-perspective',
      '答案可抽取性': 'extractability',
      'Answer Extractability': 'extractability',
      '關鍵摘要與重點整理': 'key-summary',
      'Key Summary & Highlights': 'key-summary',
      '對話式語氣與指引': 'conversational-guidance',
      'Conversational Tone & Guidance': 'conversational-guidance',
      '讀者互動與後續引導': 'reader-activation',
      'Reader Engagement & Follow-up': 'reader-activation'
    }

    const baseFileName = guideBaseMap[metricName]
    if (!baseFileName) {
      console.warn(`未找到指標 ${metricName} 的指南`)
      return
    }

    // 依 locale 決定路徑
    const localeDir = locale === 'zh-TW' ? '' : locale === 'en' ? 'en/' : 'ja/'
    const fileName = `${baseFileName}.md`
    const filePath = `/docs/product/${localeDir}${fileName}`

    try {
      // 動態載入優化指南內容
      const response = await fetch(filePath)
      if (response.ok) {
        const content = await response.text()
        setGuideContent(content)
        setGuideTitle(`${metricName}${strings.guides.optimization}`)
        setGuideMetricName(metricName)
        setGuideModalOpen(true)
      } else {
        alert(resultsStrings.loadGuideError)
      }
    } catch (error) {
      console.error('載入指南失敗:', error)
      alert(resultsStrings.loadGuideErrorRetry)
    }
  }

  return (
    <div className="space-y-8">
      {/* WHY - 總覽 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Info className="w-4 h-4" />
          <span>{resultsStrings.whyDescription}</span>
        </div>
        <ScoreCard
          title={resultsStrings.overallScoreTitle}
          score={displayScores.overall}
          maxScore={displayScores.isV5 ? 10 : 100}
          description={displayScores.isV5
            ? resultsStrings.overallScoreDescription
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
          <span>{resultsStrings.howDescription}</span>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <ScoreCard
            title={resultsStrings.structureScoreTitle}
            score={displayScores.structure}
            maxScore={displayScores.isV5 ? 10 : 100}
            description={resultsStrings.structureScoreDescription}
            breakdown={displayScores.isV5 ? displayScores.breakdown?.structure : null}
            explanations={displayScores.isV5 ? STRUCTURE_EXPLANATIONS : null}
          />
          <ScoreCard
            title={resultsStrings.strategyScoreTitle}
            score={displayScores.strategy}
            maxScore={displayScores.isV5 ? 10 : 100}
            description={resultsStrings.strategyScoreDescription}
            breakdown={displayScores.isV5 ? displayScores.breakdown?.strategy : null}
            explanations={displayScores.isV5 ? STRATEGY_EXPLANATIONS : null}
          />
        </div>
      </section>

      {/* WHAT - 行動建議與指標 */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Layers className="w-4 h-4" />
          <span>{resultsStrings.whatDescription}</span>
        </div>

        {prioritizedRecommendations.length > 0 && (
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <MessagesSquare className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">{resultsStrings.priorityRecommendations}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {resultsStrings.priorityRecommendationsDescription}
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
                        {resultsStrings.category}：{rec.category}
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
            title: resultsStrings.structureInsights,
            description: resultsStrings.structureInsightsDescription,
            metrics: metricsAeo
          })}
          {renderMetricGroup({
            title: resultsStrings.strategyInsights,
            description: resultsStrings.strategyInsightsDescription,
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
            <span>{resultsStrings.sourceTextReview}</span>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-4">
              {resultsStrings.sourceTextReviewDescription}
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
                        {resultsStrings.paragraph} {chunk.id}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {selectedChunkIds.includes(chunk.id) ? resultsStrings.collapse : resultsStrings.expand}
                    </div>
                  </button>
                  {selectedChunkIds.includes(chunk.id) && (
                    <div className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-600">{resultsStrings.originalContent}</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded-md p-3 border border-gray-100">
                        {chunk.text}
                      </pre>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{resultsStrings.tokens}: {chunk.tokens}</span>
                        <span>{resultsStrings.segments}: {chunk.segmentCount}</span>
                        <span>{resultsStrings.format}: {chunk.sourceFormat}</span>
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
