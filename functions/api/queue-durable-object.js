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

    console.log(`Task ${taskId} submitted to queue`)

    // 非同步處理（不阻塞返回）
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
    try {
      console.log(`Processing task ${task.id}...`)
      task.status = 'processing'
      task.startedAt = new Date().toISOString()

      // 執行分析
      const result = await this.analyzeContent(task.payload)

      // 儲存結果到 KV
      const resultKey = `analysis:${task.id}`
      const resultData = {
        taskId: task.id,
        status: 'completed',
        result,
        completedAt: new Date().toISOString()
      }

      await this.env.ANALYSIS_RESULTS.put(
        resultKey,
        JSON.stringify(resultData),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 天過期
      )

      // 發送 Email 通知
      if (task.payload.email) {
        await this.sendResultEmail(task.id, result, task.payload.email)
      }

      task.status = 'completed'
      task.completedAt = new Date().toISOString()

      console.log(`Task ${task.id} completed successfully`)
    } catch (error) {
      console.error(`Error processing task ${task.id}:`, error)

      task.attempts = (task.attempts || 0) + 1

      if (task.attempts >= task.maxAttempts) {
        task.status = 'failed'
        task.error = error.message
        task.failedAt = new Date().toISOString()
        console.error(`Task ${task.id} failed after ${task.maxAttempts} attempts`)
      } else {
        task.status = 'queued'
        task.lastError = error.message
        // 指數退避重試
        await new Promise(r => setTimeout(r, Math.pow(2, task.attempts) * 1000))
      }
    }
  }

  /**
   * 執行內容分析
   */
  async analyzeContent(payload) {
    // 呼叫主分析 API
    const analysisUrl = new URL('/api/analyze', this.env.SITE_URL || 'http://localhost:8787')

    const response = await fetch(analysisUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: payload.content,
        targetKeywords: payload.targetKeywords,
        contentFormatHint: payload.contentFormatHint || 'auto',
        includeRecommendations: true,
        returnChunks: false
      })
    })

    if (!response.ok) {
      throw new Error(`Analysis API failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
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
