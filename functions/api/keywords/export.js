/**
 * 關鍵字匯出 Worker API
 * 支援 JSON/CSV 匯出、時間範圍篩選、locale 篩選
 * 支援上傳至 R2 (Cloudflare Object Storage)
 */

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="KeywordExport"'
    }
  })
}

function badRequest(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  })
}

function successResponse(data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  })
}

/**
 * 從 KV 取得所有關鍵字
 */
async function fetchKeywordsFromKV(env, limit, since, locale) {
  const items = []
  let cursor

  do {
    const listResult = await env.KEYWORD_ANALYTICS.list({
      prefix: 'kw:',
      limit: Math.min(limit, 100),
      cursor
    })

    for (const entry of listResult.keys) {
      if (items.length >= limit) break
      const raw = await env.KEYWORD_ANALYTICS.get(entry.name)
      if (!raw) continue

      try {
        const record = JSON.parse(raw)
        
        // 時間範圍篩選
        if (since && record.timestamp < since) {
          continue
        }
        
        // Locale 篩選
        if (locale && record.locale !== locale) {
          continue
        }
        
        items.push(record)
      } catch (error) {
        console.warn('解析 keyword record 失敗:', entry.name, error)
      }
    }

    if (items.length >= limit || listResult.list_complete) {
      break
    }

    cursor = listResult.cursor
  } while (cursor)

  return items
}

/**
 * 去重關鍵字（保留最新的記錄）
 */
function deduplicateKeywords(records) {
  const deduped = {}
  
  for (const record of records) {
    const keyword = (record.keyword || '').trim()
    if (!keyword) continue
    
    // 保留最新的記錄
    if (!deduped[keyword] || record.timestamp > deduped[keyword].timestamp) {
      deduped[keyword] = record
    }
  }
  
  return deduped
}

/**
 * 轉換為 CSV 格式
 */
function convertToCSV(keywords) {
  const headers = ['keyword', 'locale', 'timestamp', 'source', 'volume', 'difficulty']
  const rows = [headers.join(',')]
  
  for (const [keyword, record] of Object.entries(keywords)) {
    const row = [
      `"${keyword.replace(/"/g, '""')}"`,
      record.locale || '',
      record.timestamp || '',
      record.source || '',
      record.volume || '',
      record.difficulty || ''
    ]
    rows.push(row.join(','))
  }
  
  return rows.join('\n')
}

/**
 * 上傳至 R2
 */
async function uploadToR2(env, filename, content, contentType) {
  if (!env.KEYWORD_EXPORTS_BUCKET) {
    console.warn('R2 bucket 未設定，跳過上傳')
    return null
  }
  
  try {
    const key = `keywords/${new Date().toISOString().split('T')[0]}/${filename}`
    await env.KEYWORD_EXPORTS_BUCKET.put(key, content, {
      httpMetadata: {
        contentType: contentType
      }
    })
    console.log(`✅ 已上傳至 R2: ${key}`)
    return key
  } catch (error) {
    console.error('R2 上傳失敗:', error)
    return null
  }
}

/**
 * 主要請求處理
 */
export async function onRequest({ request, env }) {
  // 認證檢查
  const token = (env.KEYWORD_ANALYTICS_TOKEN || '').trim()
  if (!token) {
    console.warn('KEYWORD_ANALYTICS_TOKEN 未設定')
    return unauthorizedResponse()
  }

  const authHeader = request.headers.get('Authorization') || ''
  const expectedHeader = `Bearer ${token}`
  if (authHeader !== expectedHeader) {
    return unauthorizedResponse()
  }

  // KV 存儲檢查
  if (!env.KEYWORD_ANALYTICS) {
    return new Response(JSON.stringify({ error: 'Keyword analytics storage not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const url = new URL(request.url)
  const method = request.method

  // 支援的端點：
  // GET /api/keywords/export?format=json&limit=200&since=2025-11-10T00:00:00Z&locale=zh-TW
  // GET /api/keywords/export?format=csv&...
  // POST /api/keywords/export (同上，用 JSON body)

  if (method === 'GET' || method === 'POST') {
    try {
      // 解析參數
      let params = {}
      
      if (method === 'GET') {
        params = Object.fromEntries(url.searchParams)
      } else {
        const body = await request.json()
        params = body
      }

      const format = (params.format || 'json').toLowerCase()
      if (!['json', 'csv'].includes(format)) {
        return badRequest('Invalid format. Supported: json, csv')
      }

      const limit = Math.min(
        parseInt(params.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      )
      const since = params.since || null
      const locale = params.locale || null
      const uploadToR2Flag = params.uploadToR2 === 'true' || params.uploadToR2 === true

      // 驗證時間格式
      if (since) {
        const sinceDate = new Date(since)
        if (isNaN(sinceDate.getTime())) {
          return badRequest('Invalid since parameter. Use ISO 8601 format.')
        }
      }

      // 取得關鍵字
      console.log(`📥 取得關鍵字: limit=${limit}, since=${since}, locale=${locale}`)
      const records = await fetchKeywordsFromKV(env, limit, since, locale)

      if (records.length === 0) {
        return successResponse({
          count: 0,
          deduplicatedCount: 0,
          keywords: [],
          records: [],
          message: 'No keywords found'
        })
      }

      // 去重
      const keywords = deduplicateKeywords(records)
      console.log(`✅ 去重完成: ${records.length} → ${Object.keys(keywords).length}`)

      // 準備輸出
      let content, contentType, filename
      
      if (format === 'json') {
        const output = {
          exportedAt: new Date().toISOString(),
          count: Object.keys(keywords).length,
          keywords: Object.keys(keywords),
          records: Object.values(keywords)
        }
        content = JSON.stringify(output, null, 2)
        contentType = 'application/json'
        filename = `keywords-${new Date().toISOString().split('T')[0]}.json`
      } else {
        content = convertToCSV(keywords)
        contentType = 'text/csv; charset=utf-8'
        filename = `keywords-${new Date().toISOString().split('T')[0]}.csv`
      }

      // 上傳至 R2（可選）
      let r2Key = null
      if (uploadToR2Flag) {
        r2Key = await uploadToR2(env, filename, content, contentType)
      }

      // 回傳結果
      const response = {
        success: true,
        format: format,
        count: Object.keys(keywords).length,
        filename: filename,
        r2Key: r2Key,
        exportedAt: new Date().toISOString()
      }

      // 根據格式回傳不同的 Content-Type
      if (format === 'csv') {
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Export-Metadata': JSON.stringify(response)
          }
        })
      } else {
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Export-Metadata': JSON.stringify(response)
          }
        })
      }

    } catch (error) {
      console.error('匯出失敗:', error)
      return new Response(JSON.stringify({ error: 'Export failed', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  return badRequest('Method not allowed. Use GET or POST.')
}
