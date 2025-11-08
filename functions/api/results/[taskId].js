/**
 * Results endpoint: 查詢分析結果
 * GET /api/results/[taskId]
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export async function onRequest(context) {
  const { request, env, params } = context
  const { taskId } = params

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
    const resultKey = `result:${taskId}`
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

    // 成功：返回完整結果
    return new Response(
      JSON.stringify({
        status: 'completed',
        taskId,
        completedAt: result.completedAt,
        result: result.result,
        contentPreview: result.content.substring(0, 200) + '...'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching result:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
