const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="KeywordAnalytics"'
    }
  })
}

function badRequest(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function onRequest({ request, env }) {
  const token = (env.KEYWORD_ANALYTICS_TOKEN || '').trim()
  if (!token) {
    console.warn('KEYWORD_ANALYTICS_TOKEN 未設定，拒絕請求')
    return unauthorizedResponse()
  }

  const authHeader = request.headers.get('Authorization') || ''
  const expectedHeader = `Bearer ${token}`
  if (authHeader !== expectedHeader) {
    return unauthorizedResponse()
  }

  if (!env.KEYWORD_ANALYTICS) {
    return new Response(JSON.stringify({ error: 'Keyword analytics storage not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const url = new URL(request.url)
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT
  const sinceParam = url.searchParams.get('since')
  const locale = url.searchParams.get('locale')

  let sinceTimestamp = null
  if (sinceParam) {
    const sinceDate = new Date(sinceParam)
    if (Number.isNaN(sinceDate.getTime())) {
      return badRequest('Invalid since parameter')
    }
    sinceTimestamp = sinceDate.toISOString()
  }

  try {
    const items = []
    let cursor

    do {
      const listResult = await env.KEYWORD_ANALYTICS.list({
        prefix: 'kw:',
        limit,
        cursor
      })

      for (const entry of listResult.keys) {
        if (items.length >= limit) break
        const raw = await env.KEYWORD_ANALYTICS.get(entry.name)
        if (!raw) continue

        try {
          const record = JSON.parse(raw)
          if (sinceTimestamp && record.timestamp < sinceTimestamp) {
            continue
          }
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

    items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))

    return new Response(JSON.stringify({ count: items.length, records: items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Keyword analytics retrieval failed:', error)
    return new Response(JSON.stringify({ error: 'Failed to retrieve keyword analytics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
