/**
 * Durable Object 實現非同步分析隊列
 * 替代 Cloudflare Queues（免費方案可用）
 */

export class AnalysisQueue {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.queue = []
    this.processing = false
  }

  /**
   * 提交分析任務到隊列
   */
  async submitTask(payload) {
    const taskId = crypto.randomUUID()
    const task = {
      id: taskId,
      payload,
      status: 'queued',
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 3
    }

    // 儲存到記憶體隊列
    this.queue.push(task)

    // 儲存初始狀態到 KV
    const resultKey = `analysis:${taskId}`
    await this.env.ANALYSIS_RESULTS.put(
      resultKey,
      JSON.stringify({
        taskId,
        status: 'queued',
        createdAt: new Date().toISOString()
      }),
      { expirationTtl: 7 * 24 * 60 * 60 }
    )

    console.log(`Task ${taskId} submitted to queue`)

    // 立即開始處理隊列（不等待完成）
    this.processQueue().catch(err => console.error('Queue processing error:', err))

    return { taskId, status: 'queued' }
  }

  /**
   * 處理隊列中的任務
   */
  async processQueue() {
    if (this.processing) return

    this.processing = true
    try {
      while (this.queue.length > 0) {
        const task = this.queue[0]

        if (task.status === 'queued') {
          await this.processTask(task)
        }

        // 移除已完成或失敗的任務
        if (task.status === 'completed' || task.status === 'failed') {
          this.queue.shift()
        } else {
          break
        }
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * 處理單個任務
   */
  async processTask(task) {
    const taskStartTime = Date.now()
    try {
      console.log(`[Task ${task.id}] 開始處理...`)
      task.status = 'processing'
      task.startedAt = new Date().toISOString()

      // 更新 KV 狀態為 processing
      const resultKey = `analysis:${task.id}`
      const kvUpdateStart = Date.now()
      await this.env.ANALYSIS_RESULTS.put(
        resultKey,
        JSON.stringify({
          taskId: task.id,
          status: 'processing',
          startedAt: task.startedAt
        }),
        { expirationTtl: 7 * 24 * 60 * 60 }
      )
      console.log(`[Task ${task.id}] KV 更新耗時: ${Date.now() - kvUpdateStart}ms`)

      // 執行分析
      console.log(`[Task ${task.id}] 開始呼叫分析 API...`)
      const analysisStart = Date.now()
      const result = await this.analyzeContent(task.payload)
      const analysisDuration = Date.now() - analysisStart
      console.log(`[Task ${task.id}] 分析耗時: ${analysisDuration}ms`)

      // 驗證結果結構
      if (!result) {
        throw new Error('分析 API 返回空結果')
      }
      console.log(`[Task ${task.id}] 結果結構: ${JSON.stringify(result).substring(0, 100)}...`)

      // 儲存結果到 KV
      const resultData = {
        taskId: task.id,
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
        analysisDuration
      }

      const kvSaveStart = Date.now()
      await this.env.ANALYSIS_RESULTS.put(
        resultKey,
        JSON.stringify(resultData),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 天過期
      )
      console.log(`[Task ${task.id}] 結果保存耗時: ${Date.now() - kvSaveStart}ms`)

      // 發送 Email 通知
      if (task.payload.email) {
        console.log(`[Task ${task.id}] 開始發送 Email 至 ${task.payload.email}...`)
        const emailStart = Date.now()
        await this.sendResultEmail(task.id, result, task.payload.email)
        console.log(`[Task ${task.id}] Email 發送耗時: ${Date.now() - emailStart}ms`)
      }

      task.status = 'completed'
      task.completedAt = new Date().toISOString()

      const totalDuration = Date.now() - taskStartTime
      console.log(`[Task ${task.id}] ✅ 完成！總耗時: ${totalDuration}ms`)
    } catch (error) {
      console.error(`[Task ${task.id}] ❌ 錯誤: ${error.message}`)

      task.attempts = (task.attempts || 0) + 1

      if (task.attempts >= task.maxAttempts) {
        task.status = 'failed'
        task.error = error.message
        task.failedAt = new Date().toISOString()

        // 更新 KV 狀態為 failed
        const resultKey = `analysis:${task.id}`
        await this.env.ANALYSIS_RESULTS.put(
          resultKey,
          JSON.stringify({
            taskId: task.id,
            status: 'failed',
            error: error.message,
            failedAt: task.failedAt,
            attempts: task.attempts
          }),
          { expirationTtl: 7 * 24 * 60 * 60 }
        )

        console.error(`[Task ${task.id}] 失敗！已重試 ${task.maxAttempts} 次`)
      } else {
        task.status = 'queued'
        task.lastError = error.message
        const retryDelay = Math.pow(2, task.attempts) * 1000
        console.log(`[Task ${task.id}] 將在 ${retryDelay}ms 後重試（第 ${task.attempts + 1} 次）`)
        // 指數退避重試
        await new Promise(r => setTimeout(r, retryDelay))
      }
    }
  }

  /**
   * 執行內容分析
   * 呼叫 API 但不帶 email 以避免無限迴圈
   */
  async analyzeContent(payload) {
    const analysisUrl = new URL('/api/analyze', this.env.SITE_URL || 'http://localhost:8787')

    console.log(`Calling analysis API: ${analysisUrl.toString()}`)

    const response = await fetch(analysisUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: payload.content,
        contentHtml: payload.contentHtml || '',
        contentMarkdown: payload.contentMarkdown || '',
        targetKeywords: payload.targetKeywords || [],
        contentFormatHint: payload.contentFormatHint || 'auto',
        includeRecommendations: true,
        returnChunks: false
        // 注意：不帶 email，避免無限迴圈
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Analysis API error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Analysis API failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Analysis result received:', JSON.stringify(result).substring(0, 200))
    return result
  }

  /**
   * 發送結果 Email
   */
  async sendResultEmail(taskId, result, userEmail) {
    try {
      // 動態匯入 Resend 和 email 模板
      const { Resend } = await import('resend')
      const { generateResultEmailHtml, generateResultEmailText } = await import('./email-template.js')

      const resend = new Resend(this.env.RESEND_API_KEY)
      const siteUrl = this.env.SITE_URL || 'https://content-optimizer.ai'
      const resultsUrl = `${siteUrl}/results/${taskId}`

      const emailHtml = generateResultEmailHtml(taskId, result, siteUrl)
      const emailText = generateResultEmailText(taskId, result, siteUrl)

      const response = await resend.emails.send({
        from: this.env.RESEND_FROM_EMAIL || 'noreply@content-optimizer.ai',
        to: userEmail,
        subject: '✨ 您的內容分析結果已準備好',
        html: emailHtml,
        text: emailText,
        reply_to: 'support@content-optimizer.ai'
      })

      console.log(`Email sent to ${userEmail}:`, response)
      return response
    } catch (error) {
      console.error(`Failed to send email to ${userEmail}:`, error)
      throw error
    }
  }

  /**
   * 查詢任務狀態
   */
  async getTaskStatus(taskId) {
    // 從隊列中查找任務
    const task = this.queue.find(t => t.id === taskId)
    return task || { error: 'Task not found' }
  }

  /**
   * 獲取隊列統計
   */
  async getQueueStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      tasks: this.queue.map(t => ({
        id: t.id,
        status: t.status,
        attempts: t.attempts,
        createdAt: t.createdAt
      }))
    }
  }

  /**
   * 處理 Durable Object 請求
   */
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/submit' && request.method === 'POST') {
      const payload = await request.json()
      const result = await this.submitTask(payload)
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (path.startsWith('/status/')) {
      const taskId = path.split('/').pop()
      const status = await this.getTaskStatus(taskId)
      return new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (path === '/stats') {
      const stats = await this.getQueueStats()
      return new Response(JSON.stringify(stats), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response('Not found', { status: 404 })
  }
}
