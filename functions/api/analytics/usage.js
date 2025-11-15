/**
 * Usage summary endpoint
 * 提供近期分析請求與結果的統計摘要，方便查詢多少人使用並成功取得結果
 */

const DEFAULT_HOURS = 24
const DEFAULT_RECORD_LIMIT = 500
const MAX_RECORD_LIMIT = 5000

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function unauthorizedResponse(message = 'Unauthorized') {
  return jsonResponse({ error: message }, 401)
}

function methodNotAllowed() {
  return jsonResponse({ error: 'Method not allowed' }, 405)
}

function parseSince(url) {
  const sinceParam = url.searchParams.get('since')
  const hoursParam = url.searchParams.get('hours')

  if (sinceParam) {
    const sinceDate = new Date(sinceParam)
    if (!Number.isNaN(sinceDate.getTime())) {
      return sinceDate.toISOString()
    }
  }

  const hours = Number.isFinite(Number(hoursParam)) ? Number(hoursParam) : DEFAULT_HOURS
  const clampedHours = Math.max(1, Math.min(hours, 24 * 30))
  const sinceDate = new Date(Date.now() - clampedHours * 60 * 60 * 1000)
  return sinceDate.toISOString()
}

function parseLimit(url) {
  const limitParam = Number(url.searchParams.get('limit'))
  if (!Number.isFinite(limitParam) || limitParam <= 0) {
    return DEFAULT_RECORD_LIMIT
  }
  return Math.min(limitParam, MAX_RECORD_LIMIT)
}

function pickResultTimestamp(record) {
  if (!record || typeof record !== 'object') return null
  return record.completedAt || record.startedAt || record.createdAt || record.timestamp || null
}

async function listKvRecords(namespace, { prefix, limit }) {
  if (!namespace) return []

  const items = []
  let cursor
  const batchLimit = Math.min(1000, limit)

  do {
    const remaining = limit - items.length
    if (remaining <= 0) break

    const listResult = await namespace.list({
      prefix,
      limit: Math.min(batchLimit, remaining),
      cursor
    })

    for (const entry of listResult.keys) {
      if (items.length >= limit) break
      const raw = await namespace.get(entry.name)
      if (!raw) continue
      try {
        const record = JSON.parse(raw)
        items.push(record)
      } catch (error) {
        console.warn(`Failed to parse record ${entry.name}:`, error)
      }
    }

    if (listResult.list_complete || items.length >= limit) {
      break
    }

    cursor = listResult.cursor
  } while (cursor)

  return items
}

function summarizeKeywordRecords(records, sinceIso) {
  const stats = {
    total: 0,
    locales: {},
    modes: {},
    uniqueKeywordHashes: new Set(),
    firstTimestamp: null,
    lastTimestamp: null
  }

  for (const record of records) {
    if (!record?.timestamp) continue
    if (sinceIso && record.timestamp < sinceIso) continue

    stats.total += 1
    stats.locales[record.locale] = (stats.locales[record.locale] || 0) + 1
    stats.modes[record.mode] = (stats.modes[record.mode] || 0) + 1
    if (record.hash) {
      stats.uniqueKeywordHashes.add(record.hash)
    }

    if (!stats.firstTimestamp || record.timestamp < stats.firstTimestamp) {
      stats.firstTimestamp = record.timestamp
    }
    if (!stats.lastTimestamp || record.timestamp > stats.lastTimestamp) {
      stats.lastTimestamp = record.timestamp
    }
  }

  return {
    total: stats.total,
    locales: stats.locales,
    modes: stats.modes,
    uniqueKeywordHashCount: stats.uniqueKeywordHashes.size,
    firstTimestamp: stats.firstTimestamp,
    lastTimestamp: stats.lastTimestamp
  }
}

function summarizeAnalysisRecords(records, sinceIso) {
  const stats = {
    total: 0,
    statusCounts: {},
    completedDurations: [],
    firstTimestamp: null,
    lastTimestamp: null
  }

  for (const record of records) {
    const recordTimestamp = pickResultTimestamp(record)
    if (!recordTimestamp) continue
    if (sinceIso && recordTimestamp < sinceIso) continue

    stats.total += 1
    const status = record.status || 'unknown'
    stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1

    if (status === 'completed' && typeof record.analysisDuration === 'number') {
      stats.completedDurations.push(record.analysisDuration)
    }

    if (!stats.firstTimestamp || recordTimestamp < stats.firstTimestamp) {
      stats.firstTimestamp = recordTimestamp
    }
    if (!stats.lastTimestamp || recordTimestamp > stats.lastTimestamp) {
      stats.lastTimestamp = recordTimestamp
    }
  }

  const completed = stats.statusCounts.completed || 0
  const failed = stats.statusCounts.failed || 0
  const successDenominator = completed + failed
  const successRate = successDenominator > 0 ? completed / successDenominator : null
  const averageDuration = stats.completedDurations.length
    ? Math.round(stats.completedDurations.reduce((sum, value) => sum + value, 0) / stats.completedDurations.length)
    : null

  return {
    total: stats.total,
    statusCounts: stats.statusCounts,
    successRate,
    averageAnalysisDurationMs: averageDuration,
    firstTimestamp: stats.firstTimestamp,
    lastTimestamp: stats.lastTimestamp
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return methodNotAllowed()
  }

  const token = env.USAGE_SUMMARY_TOKEN || env.KEYWORD_ANALYTICS_TOKEN
  if (!token) {
    return jsonResponse({ error: 'USAGE_SUMMARY_TOKEN or KEYWORD_ANALYTICS_TOKEN is not configured' }, 500)
  }

  const authHeader = request.headers.get('Authorization') || ''
  if (authHeader !== `Bearer ${token}`) {
    return unauthorizedResponse()
  }

  if (!env.KEYWORD_ANALYTICS || !env.ANALYSIS_RESULTS) {
    return jsonResponse({ error: 'Required KV namespaces are not bound' }, 500)
  }

  const url = new URL(request.url)
  const sinceIso = parseSince(url)
  const recordLimit = parseLimit(url)

  const [keywordRecords, resultRecords] = await Promise.all([
    listKvRecords(env.KEYWORD_ANALYTICS, { prefix: 'kw:', limit: recordLimit }),
    listKvRecords(env.ANALYSIS_RESULTS, { prefix: 'analysis:', limit: recordLimit })
  ])

  const keywordSummary = summarizeKeywordRecords(keywordRecords, sinceIso)
  const resultSummary = summarizeAnalysisRecords(resultRecords, sinceIso)

  return jsonResponse({
    ok: true,
    since: sinceIso,
    maxRecordsScanned: recordLimit,
    keywordAnalytics: keywordSummary,
    analysisResults: resultSummary
  })
}
