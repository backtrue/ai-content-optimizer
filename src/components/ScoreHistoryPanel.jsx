import { Download, Trash2, TrendingUp, TrendingDown, CalendarClock, ListChecks } from 'lucide-react'
import { useMemo } from 'react'

const formatDateTime = (isoString) => {
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return isoString
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch (error) {
    return isoString
  }
}

const toPercent = (value) => {
  return `${Math.round(value * 100)}%`
}

export default function ScoreHistoryPanel({ history = [], onExport, onClear }) {
  const metrics = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) {
      return {
        total: 0,
        averageOverall: 0,
        averageAeo: 0,
        averageSeo: 0,
        latestTrend: 0,
        sevenDayCount: 0,
        exportable: []
      }
    }

    const total = history.length
    const sum = history.reduce(
      (acc, item) => {
        const overall = Number(item.overallScore) || 0
        const aeo = Number(item.aeoScore) || 0
        const seo = Number(item.seoScore) || 0
        acc.overall += overall
        acc.aeo += aeo
        acc.seo += seo
        const timestamp = new Date(item.timestamp)
        if (!Number.isNaN(timestamp.getTime())) {
          const diffDays = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24)
          if (diffDays <= 7) acc.lastSeven += 1
        }
        return acc
      },
      { overall: 0, aeo: 0, seo: 0, lastSeven: 0 }
    )

    const averageOverall = Math.round((sum.overall / total) || 0)
    const averageAeo = Math.round((sum.aeo / total) || 0)
    const averageSeo = Math.round((sum.seo / total) || 0)
    const latestTrend = history.length > 1 ? (Number(history[0]?.overallScore) || 0) - (Number(history[1]?.overallScore) || 0) : 0

    return {
      total,
      averageOverall,
      averageAeo,
      averageSeo,
      latestTrend,
      sevenDayCount: sum.lastSeven,
      exportable: history.slice(0, 200)
    }
  }, [history])

  const nextReviewDate = useMemo(() => {
    if (!history.length) return null
    const latest = new Date(history[0].timestamp)
    if (Number.isNaN(latest.getTime())) return null
    const review = new Date(latest)
    review.setDate(review.getDate() + 7)
    return formatDateTime(review.toISOString())
  }, [history])

  const trendIcon = metrics.latestTrend >= 0 ? TrendingUp : TrendingDown
  const trendColor = metrics.latestTrend >= 0 ? 'text-green-600' : 'text-red-500'

  return (
    <div className="card">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">評分指標追蹤面板</h2>
          <p className="text-sm text-gray-600">保留最近 200 次分析，建立週期性追蹤與自動匯出流程。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={!metrics.total}
            className={`btn-secondary inline-flex items-center gap-2 ${!metrics.total ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <Download className="w-4 h-4" /> 匯出 CSV
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!metrics.total}
            className={`inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 ${!metrics.total ? 'opacity-60 cursor-not-allowed hover:bg-transparent' : ''}`}
          >
            <Trash2 className="w-4 h-4" /> 清除歷史
          </button>
        </div>
      </div>

      {metrics.total === 0 ? (
        <p className="text-sm text-gray-500">尚未建立歷史紀錄。完成一次分析後，系統會自動加入追蹤面板。</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 p-4 bg-primary-50/40">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">平均綜合評分</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.averageOverall}</p>
              <p className="mt-1 text-xs text-gray-500">AEO {metrics.averageAeo} · SEO {metrics.averageSeo}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">最新趨勢</p>
              <div className="mt-2 flex items-center gap-2">
                <trendIcon className={`w-5 h-5 ${trendColor}`} />
                <p className={`text-xl font-bold ${trendColor}`}>
                  {metrics.latestTrend === 0 ? '持平' : `${metrics.latestTrend > 0 ? '+' : ''}${metrics.latestTrend}`}
                </p>
              </div>
              <p className="mt-1 text-xs text-gray-500">與上一筆綜合評分比較</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">7 日內分析</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.sevenDayCount}</p>
              <p className="mt-1 text-xs text-gray-500">建議每週至少 3 次，以掌握內容新鮮度。</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">下次排程</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <CalendarClock className="w-5 h-5 text-primary-500" />
                <span>{nextReviewDate || '尚未排程'}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">系統以最新一次分析日 +7 天作為例行複查日。</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-primary-600" /> 最新分析記錄
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">時間</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">關鍵字</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Overall</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">AEO</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">SEO</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">缺口</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">弱勢旗標</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.slice(0, 12).map((item) => {
                      const missing = Object.entries(item.missingCritical || {})
                        .filter(([, value]) => value === true)
                        .map(([key]) => key)
                      const weakFlags = Object.entries(item.contentQualityFlags || {})
                        .filter(([, value]) => value === true)
                        .map(([key]) => key)
                      return (
                        <tr key={item.id} className="hover:bg-primary-50/40 transition-colors">
                          <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{formatDateTime(item.timestamp)}</td>
                          <td className="px-4 py-2 text-gray-700 max-w-[160px]">
                            {Array.isArray(item.targetKeywords) && item.targetKeywords.length
                              ? item.targetKeywords.join(' / ')
                              : '—'}
                          </td>
                          <td className="px-4 py-2 font-semibold text-gray-900">{item.overallScore ?? '—'}</td>
                          <td className="px-4 py-2 text-gray-700">{item.aeoScore ?? '—'}</td>
                          <td className="px-4 py-2 text-gray-700">{item.seoScore ?? '—'}</td>
                          <td className="px-4 py-2 text-gray-700">
                            {missing.length ? (
                              <div className="space-y-1">
                                {missing.slice(0, 3).map((flag) => (
                                  <span key={flag} className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 mr-1">
                                    {flag}
                                  </span>
                                ))}
                                {missing.length > 3 && (
                                  <span className="text-xs text-gray-500">+{missing.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">無</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {weakFlags.length ? (
                              <div className="space-y-1">
                                {weakFlags.slice(0, 3).map((flag) => (
                                  <span key={flag} className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 mr-1">
                                    {flag}
                                  </span>
                                ))}
                                {weakFlags.length > 3 && (
                                  <span className="text-xs text-gray-500">+{weakFlags.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">無</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">自動匯出與維運節奏</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-3">
                  <p className="font-semibold text-primary-700">匯出流程</p>
                  <ol className="mt-2 ml-5 list-decimal space-y-1">
                    <li>完成分析後，面板會自動追加紀錄。</li>
                    <li>點擊「匯出 CSV」即可下載最近 200 筆資料。</li>
                    <li>將 CSV 上傳至資料倉儲或 Google Sheet，以便長期追蹤。</li>
                  </ol>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="font-semibold text-gray-700">維運建議</p>
                  <ul className="mt-2 ml-5 list-disc space-y-1">
                    <li>每週至少 3 次分析，確保內容保持最新。</li>
                    <li>月初整理上一月的 CSV 匯出，更新 KPI 面板。</li>
                    <li>發現連續兩次低於 60 分時，建立高優先修正單。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
