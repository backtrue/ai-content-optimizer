/**
 * Cron Handler
 * 處理 Cloudflare Cron 觸發的排程任務
 * 支援關鍵字匯出、SERP 蒐集、模型訓練等自動化流程
 */

export async function onRequest({ request, env }) {
  // 驗證請求來自 Cloudflare Cron
  const cfCron = request.headers.get('CF-Cron')
  if (!cfCron) {
    return new Response(JSON.stringify({ error: 'Not a Cron request' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const url = new URL(request.url)
  const path = url.pathname

  try {
    // 路由到不同的 Cron 處理器
    if (path === '/api/cron/keyword-export') {
      return await handleKeywordExportCron(env)
    } else if (path === '/api/cron/serp-collection') {
      return await handleSerpCollectionCron(env)
    } else if (path === '/api/cron/model-training') {
      return await handleModelTrainingCron(env)
    } else {
      return new Response(JSON.stringify({ error: 'Unknown cron endpoint' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Cron 處理失敗:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 關鍵字匯出 Cron 處理器
 * 每週一 02:00 UTC 執行
 */
async function handleKeywordExportCron(env) {
  console.log('🚀 開始關鍵字匯出 Cron 任務')

  try {
    // 取得 Pipeline Scheduler Durable Object
    const schedulerId = env.PIPELINE_SCHEDULER.idFromName('default')
    const scheduler = env.PIPELINE_SCHEDULER.get(schedulerId)

    // 啟動 Pipeline（僅執行關鍵字匯出階段）
    const response = await scheduler.fetch(new Request('http://internal/pipeline/start', {
      method: 'POST',
      body: JSON.stringify({
        phases: ['keyword_export'],
        keywordLimit: 200,
        uploadToR2: true
      })
    }))

    const result = await response.json()
    console.log('✅ 關鍵字匯出完成:', result)

    // 發送通知（可選）
    if (env.SLACK_WEBHOOK_URL) {
      await notifySlack(env, {
        title: '✅ 關鍵字匯出完成',
        phase: 'keyword_export',
        result: result
      })
    }

    return new Response(JSON.stringify({
      success: true,
      phase: 'keyword_export',
      result: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ 關鍵字匯出失敗:', error)

    // 發送失敗通知
    if (env.SLACK_WEBHOOK_URL) {
      await notifySlack(env, {
        title: '❌ 關鍵字匯出失敗',
        phase: 'keyword_export',
        error: error.message
      })
    }

    return new Response(JSON.stringify({
      success: false,
      phase: 'keyword_export',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * SERP 蒐集 Cron 處理器
 * 每週一 02:30 UTC 執行
 */
async function handleSerpCollectionCron(env) {
  console.log('🚀 開始 SERP 蒐集 Cron 任務')

  try {
    // 取得最新的關鍵字匯出結果
    const schedulerId = env.PIPELINE_SCHEDULER.idFromName('default')
    const scheduler = env.PIPELINE_SCHEDULER.get(schedulerId)

    const statusResponse = await scheduler.fetch(new Request('http://internal/pipeline/status'))
    const status = await statusResponse.json()

    const keywordExportResult = status.phases.keyword_export.result
    if (!keywordExportResult) {
      throw new Error('No keyword export result found. Run keyword export first.')
    }

    console.log(`📊 準備蒐集 SERP 資料，關鍵字來源: ${keywordExportResult.r2Key}`)

    // 呼叫 SERP Collection Scheduler
    const serpSchedulerId = env.SERP_COLLECTION_SCHEDULER.idFromName('default')
    const serpScheduler = env.SERP_COLLECTION_SCHEDULER.get(serpSchedulerId)

    const serpResponse = await serpScheduler.fetch(new Request('http://internal/serp-collection/start', {
      method: 'POST',
      body: JSON.stringify({
        keywordsFile: keywordExportResult.r2Key,
        batchSize: 10,
        analyzeApiUrl: env.ANALYZE_API_URL || 'https://ragseo.thinkwithblack.com/api/analyze',
        keywordDelay: 15,
        urlDelay: 12,
        uploadToR2: true
      })
    }))

    const serpResult = await serpResponse.json()

    if (!serpResult.success) {
      throw new Error(serpResult.error || 'SERP collection failed')
    }

    console.log(`✅ SERP 蒐集完成: ${serpResult.state.recordsCollected} 筆記錄`)

    // 發送成功通知
    if (env.SLACK_WEBHOOK_URL) {
      await notifySlack(env, {
        title: '✅ SERP 蒐集完成',
        phase: 'serp_collection',
        result: {
          recordsCollected: serpResult.state.recordsCollected,
          failedRecords: serpResult.state.failedRecords,
          totalBatches: serpResult.state.totalBatches
        }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      phase: 'serp_collection',
      result: serpResult.state
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ SERP 蒐集失敗:', error)

    if (env.SLACK_WEBHOOK_URL) {
      await notifySlack(env, {
        title: '❌ SERP 蒐集失敗',
        phase: 'serp_collection',
        error: error.message
      })
    }

    return new Response(JSON.stringify({
      success: false,
      phase: 'serp_collection',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 模型訓練 Cron 處理器
 * 每週二 03:00 UTC 執行
 */
async function handleModelTrainingCron(env) {
  console.log('🚀 開始模型訓練 Cron 任務')

  try {
    // 取得 Pipeline Scheduler Durable Object
    const schedulerId = env.PIPELINE_SCHEDULER.idFromName('default')
    const scheduler = env.PIPELINE_SCHEDULER.get(schedulerId)

    const statusResponse = await scheduler.fetch(new Request('http://internal/pipeline/status'))
    const status = await statusResponse.json()

    const serpResult = status.phases.serp_collection.result
    if (!serpResult) {
      throw new Error('No SERP collection result found. Run SERP collection first.')
    }

    console.log('🤖 準備訓練模型...')

    // 此處應呼叫模型訓練 API
    // 暫時返回佔位符，實際實作在模組 3
    const result = {
      status: 'pending',
      message: 'Model training implementation pending'
    }

    return new Response(JSON.stringify({
      success: true,
      phase: 'model_training',
      result: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ 模型訓練失敗:', error)

    if (env.SLACK_WEBHOOK_URL) {
      await notifySlack(env, {
        title: '❌ 模型訓練失敗',
        phase: 'model_training',
        error: error.message
      })
    }

    return new Response(JSON.stringify({
      success: false,
      phase: 'model_training',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 發送 Slack 通知
 */
async function notifySlack(env, notification) {
  const webhookUrl = env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL 未設定，跳過通知')
    return
  }

  try {
    const payload = {
      text: notification.title,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${notification.title}*\n\n*階段*: ${notification.phase}\n*時間*: ${new Date().toISOString()}`
          }
        }
      ]
    }

    if (notification.error) {
      payload.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*錯誤*: \`${notification.error}\``
        }
      })
    }

    if (notification.result) {
      payload.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*結果*: \`\`\`${JSON.stringify(notification.result, null, 2)}\`\`\``
        }
      })
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      console.warn('Slack 通知失敗:', response.status)
    }
  } catch (error) {
    console.error('發送 Slack 通知失敗:', error)
  }
}
