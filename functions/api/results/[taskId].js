/**
 * Results endpoint: 查詢分析結果
 * GET /api/results/[taskId]
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
}

export async function onRequest(context) {
  const { request, env, params } = context
  const { taskId } = params
  const requestUrl = new URL(request.url)
  const ownerToken = requestUrl.searchParams.get('token')

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // 從 KV 讀取結果
    const resultKey = `analysis:${taskId}`
    const resultData = await env.ANALYSIS_RESULTS.get(resultKey)

    if (!resultData) {
      return new Response(
        JSON.stringify({
          status: 'not_found',
          message: '找不到該任務結果，請檢查 Task ID 是否正確'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = JSON.parse(resultData)

    // IDOR 防護：驗證 ownerToken
    if (result.ownerToken && result.ownerToken !== ownerToken) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: '無權存取此分析結果' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 檢查任務狀態
    if (result.status === 'queued' || result.status === 'processing') {
      return new Response(
        JSON.stringify({
          status: result.status,
          message: '分析進行中，請稍後再試',
          taskId
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (result.status === 'failed') {
      return new Response(
        JSON.stringify({
          status: 'failed',
          message: result.error || '分析失敗，請重新提交',
          taskId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 移除 ownerToken 避免洩露
    const { ownerToken: _, ...safeResult } = result

    // 成功：返回完整結果
    return new Response(
      JSON.stringify({
        status: 'completed',
        taskId,
        completedAt: safeResult.completedAt,
        result: safeResult.result
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching result:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
