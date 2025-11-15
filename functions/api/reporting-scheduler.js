/**
 * Reporting Scheduler Durable Object
 * 生成排程報表、彙整 Pipeline 指標、寄送週報
 */

export class ReportingScheduler {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.storage = state.storage
  }

  /**
   * 初始化狀態
   */
  async initialize() {
    const existing = await this.storage.get('reporting:state')
    if (!existing) {
      await this.storage.put('reporting:state', JSON.stringify({
        status: 'idle',
        lastReportAt: null,
        lastWeeklyReportAt: null,
        reports: []
      }))
    }
  }

  /**
   * 取得狀態
   */
  async getStatus() {
    await this.initialize()
    const state = await this.storage.get('reporting:state')
    return JSON.parse(state)
  }

  /**
   * 生成每日報表
   */
  async generateDailyReport(options = {}) {
    console.log('📊 生成每日報表')

    try {
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]

      // 取得 Pipeline 狀態
      const pipelineId = this.env.PIPELINE_SCHEDULER.idFromName('default')
      const pipeline = this.env.PIPELINE_SCHEDULER.get(pipelineId)

      const statusResponse = await pipeline.fetch(new Request('http://internal/pipeline/status'))
      const pipelineStatus = await statusResponse.json()

      // 取得成本指標
      const costMetrics = await this.getCostMetrics()

      // 組合報表
      const report = {
        date: dateStr,
        generatedAt: now.toISOString(),
        pipeline: {
          status: pipelineStatus.status,
          phases: pipelineStatus.phases,
          lastRun: pipelineStatus.completedAt || pipelineStatus.startedAt
        },
        costs: costMetrics,
        summary: {
          totalRecordsCollected: this.estimateTotalRecords(pipelineStatus),
          totalCost: costMetrics.totalCost,
          successRate: costMetrics.successRate
        }
      }

      // 保存至 KV
      await this.env.ANALYSIS_RESULTS.put(
        `daily-report-${dateStr}`,
        JSON.stringify(report),
        { expirationTtl: 86400 * 30 } // 30 天過期
      )

      // 上傳至 R2
      if (this.env.KEYWORD_EXPORTS_BUCKET) {
        const r2Key = `reports/${dateStr}/daily-report.json`
        await this.env.KEYWORD_EXPORTS_BUCKET.put(
          r2Key,
          JSON.stringify(report, null, 2),
          { httpMetadata: { contentType: 'application/json' } }
        )
        console.log(`✅ 每日報表已上傳至 R2: ${r2Key}`)
      }

      // 更新狀態
      const state = await this.getStatus()
      state.lastReportAt = now.toISOString()
      state.reports.push({
        date: dateStr,
        type: 'daily',
        generatedAt: now.toISOString()
      })
      await this.storage.put('reporting:state', JSON.stringify(state))

      return {
        success: true,
        report: report
      }
    } catch (error) {
      console.error('❌ 每日報表生成失敗:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 生成週報
   */
  async generateWeeklyReport(options = {}) {
    console.log('📈 生成週報')

    try {
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const weekStartStr = weekStart.toISOString().split('T')[0]

      // 取得過去 7 天的報表
      const dailyReports = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateKey = date.toISOString().split('T')[0]
        try {
          const reportData = await this.env.ANALYSIS_RESULTS.get(`daily-report-${dateKey}`)
          if (reportData) {
            dailyReports.push(JSON.parse(reportData))
          }
        } catch (e) {
          console.warn(`未找到 ${dateKey} 的報表`)
        }
      }

      // 取得使用量摘要（預設過去 7 天）
      const usageSummary = await this.fetchUsageSummary(options.usageHours || 24 * 7, options.usageRecordLimit || 1000)

      // 彙整週報
      const weeklyReport = {
        period: `${weekStartStr} to ${dateStr}`,
        generatedAt: now.toISOString(),
        dailyReports: dailyReports.length,
        aggregated: {
          totalRecords: dailyReports.reduce((sum, r) => sum + (r.summary?.totalRecordsCollected || 0), 0),
          totalCost: dailyReports.reduce((sum, r) => sum + (r.costs?.totalCost || 0), 0),
          averageDailyCost: 0,
          averageSuccessRate: 0
        },
        usageSummary,
        recommendations: this.generateRecommendations(dailyReports),
        nextSteps: this.generateNextSteps(dailyReports)
      }

      // 計算平均值
      if (dailyReports.length > 0) {
        weeklyReport.aggregated.averageDailyCost = 
          weeklyReport.aggregated.totalCost / dailyReports.length
        const successRates = dailyReports
          .map(r => r.summary?.successRate || 0)
          .filter(r => r > 0)
        if (successRates.length > 0) {
          weeklyReport.aggregated.averageSuccessRate = 
            successRates.reduce((a, b) => a + b, 0) / successRates.length
        }
      }

      // 保存至 KV
      await this.env.ANALYSIS_RESULTS.put(
        `weekly-report-${dateStr}`,
        JSON.stringify(weeklyReport),
        { expirationTtl: 86400 * 90 } // 90 天過期
      )

      // 上傳至 R2
      if (this.env.KEYWORD_EXPORTS_BUCKET) {
        const r2Key = `reports/${dateStr}/weekly-report.json`
        await this.env.KEYWORD_EXPORTS_BUCKET.put(
          r2Key,
          JSON.stringify(weeklyReport, null, 2),
          { httpMetadata: { contentType: 'application/json' } }
        )
        console.log(`✅ 週報已上傳至 R2: ${r2Key}`)
      }

      // 發送通知
      if (this.env.SLACK_WEBHOOK_URL) {
        await this.notifySlack(weeklyReport)
      }

      // 寄送 Email
      await this.sendWeeklyReportEmail(weeklyReport)

      // 更新狀態
      const state = await this.getStatus()
      state.lastWeeklyReportAt = now.toISOString()
      state.reports.push({
        date: dateStr,
        type: 'weekly',
        generatedAt: now.toISOString()
      })
      await this.storage.put('reporting:state', JSON.stringify(state))

      return {
        success: true,
        report: weeklyReport
      }
    } catch (error) {
      console.error('❌ 週報生成失敗:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 取得成本指標
   */
  async getCostMetrics() {
    // 此處應從 cost_tracker.py 或 KV 取得成本數據
    // 暫時返回佔位符
    return {
      totalCost: 0,
      successRate: 100,
      services: {
        serpapi: { requests: 0, cost: 0 },
        valueserp: { requests: 0, cost: 0 },
        zenserp: { requests: 0, cost: 0 }
      }
    }
  }

  /**
   * 估計總記錄數
   */
  estimateTotalRecords(pipelineStatus) {
    let total = 0
    
    if (pipelineStatus.phases?.serp_collection?.result?.recordsCollected) {
      total += pipelineStatus.phases.serp_collection.result.recordsCollected
    }
    
    return total
  }

  /**
   * 生成建議
   */
  generateRecommendations(dailyReports) {
    const recommendations = []

    if (dailyReports.length === 0) {
      recommendations.push('未找到過去 7 天的報表，請檢查 Pipeline 執行狀態')
      return recommendations
    }

    // 檢查成功率
    const successRates = dailyReports
      .map(r => r.summary?.successRate || 0)
      .filter(r => r > 0)
    
    if (successRates.length > 0) {
      const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length
      if (avgSuccessRate < 95) {
        recommendations.push(`⚠️ 成功率偏低 (${avgSuccessRate.toFixed(2)}%)，建議檢查 API 配置`)
      }
    }

    // 檢查成本趨勢
    const costs = dailyReports.map(r => r.costs?.totalCost || 0).filter(c => c > 0)
    if (costs.length > 1) {
      const latestCost = costs[costs.length - 1]
      const previousCost = costs[costs.length - 2]
      if (latestCost > previousCost * 1.5) {
        recommendations.push(`📈 成本上升 ${((latestCost / previousCost - 1) * 100).toFixed(0)}%，建議優化 API 使用`)
      }
    }

    // 檢查記錄數
    const totalRecords = dailyReports.reduce((sum, r) => sum + (r.summary?.totalRecordsCollected || 0), 0)
    if (totalRecords > 0) {
      recommendations.push(`✅ 本週蒐集 ${totalRecords} 筆記錄，可進行模型訓練`)
    }

    return recommendations
  }

  /**
   * 生成下一步行動
   */
  generateNextSteps(dailyReports) {
    const steps = []

    const totalRecords = dailyReports.reduce((sum, r) => sum + (r.summary?.totalRecordsCollected || 0), 0)
    
    if (totalRecords > 100) {
      steps.push('🤖 執行模型訓練 - 記錄數足夠')
    } else if (totalRecords > 0) {
      steps.push(`📊 繼續蒐集 - 已有 ${totalRecords} 筆記錄，目標 100 筆`)
    } else {
      steps.push('⚠️ 檢查 SERP 蒐集狀態 - 未蒐集到記錄')
    }

    steps.push('💾 備份成本報表至 R2')
    steps.push('📧 檢查 Pipeline 執行日誌')

    return steps
  }

  async fetchUsageSummary(hours = 168, limit = 1000) {
    const token = this.env.USAGE_SUMMARY_TOKEN || this.env.KEYWORD_ANALYTICS_TOKEN
    if (!token) {
      console.warn('USAGE_SUMMARY_TOKEN/KEYWORD_ANALYTICS_TOKEN 未設定，無法取得使用量摘要')
      return null
    }

    const baseUrl = this.env.API_BASE_URL || this.env.SITE_URL || 'https://content-optimizer.ai'
    const endpoint = new URL(`/api/analytics/usage?hours=${encodeURIComponent(hours)}&limit=${encodeURIComponent(limit)}`, baseUrl)

    try {
      const response = await fetch(endpoint.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error(`Usage summary fetch failed: ${response.status}`)
      }

      const data = await response.json()
      if (!data?.ok) {
        throw new Error('Usage summary response missing ok flag')
      }
      return data
    } catch (error) {
      console.error('取得使用量摘要失敗:', error)
      return null
    }
  }

  /**
   * 發送 Slack 通知
   */
  async notifySlack(report) {
    const webhookUrl = this.env.SLACK_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('SLACK_WEBHOOK_URL 未設定')
      return
    }

    try {
      const payload = {
        text: `📈 週報 - ${report.period}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `📈 週報 ${report.period}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*蒐集記錄*\n${report.aggregated.totalRecords} 筆`
              },
              {
                type: 'mrkdwn',
                text: `*總成本*\n$${report.aggregated.totalCost.toFixed(2)}`
              },
              {
                type: 'mrkdwn',
                text: `*日均成本*\n$${report.aggregated.averageDailyCost.toFixed(2)}`
              },
              {
                type: 'mrkdwn',
                text: `*成功率*\n${report.aggregated.averageSuccessRate.toFixed(1)}%`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*建議*\n${report.recommendations.join('\n')}`
            }
          }
        ]
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

  /**
   * 寄送週報 Email
   */
  async sendWeeklyReportEmail(report) {
    try {
      if (!this.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY 未設定，略過週報 Email 寄送')
        return
      }

      const { Resend } = await import('resend')
      const resend = new Resend(this.env.RESEND_API_KEY)

      const recipients = (this.env.USAGE_REPORT_RECIPIENTS
        || this.env.WEEKLY_REPORT_RECIPIENTS
        || 'backtrue@gmail.com')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)

      if (!recipients.length) {
        console.warn('週報 Email 收件者列表為空，略過寄送')
        return
      }

      const subject = `📈 Pipeline 使用週報 (${report.period})`
      const html = this.buildWeeklyReportHtml(report)
      const text = this.buildWeeklyReportText(report)

      const response = await resend.emails.send({
        from: this.env.RESEND_FROM_EMAIL || 'noreply@content-optimizer.ai',
        to: recipients,
        subject,
        html,
        text
      })

      console.log(`📬 週報 Email 已寄送: ${response.id || 'no-id'}`)
    } catch (error) {
      console.error('週報 Email 寄送失敗:', error)
    }
  }

  buildWeeklyReportHtml(report) {
    const { aggregated, recommendations, nextSteps, usageSummary } = report
    const formatCurrency = (value) => `$${(value ?? 0).toFixed(2)}`
    const keywordStats = usageSummary?.keywordAnalytics
    const resultStats = usageSummary?.analysisResults

    return `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #f9fafb; padding: 24px;">
          <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px 32px; color: white;">
              <p style="margin: 0; opacity: 0.8; font-size: 14px;">Pipeline 每週報告</p>
              <h1 style="margin: 8px 0 0; font-size: 28px;">${report.period}</h1>
            </div>
            <div style="padding: 24px 32px;">
              <h2 style="font-size: 20px; margin-top: 0;">📊 摘要指標</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tbody>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">蒐集記錄總數</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 700; color: #111827;">${aggregated.totalRecords}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">總成本</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 700; color: #10b981;">${formatCurrency(aggregated.totalCost)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">日均成本</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 700; color: #2563eb;">${formatCurrency(aggregated.averageDailyCost)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">平均成功率</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 700; color: #f59e0b;">${(aggregated.averageSuccessRate ?? 0).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>

              <h2 style="font-size: 20px;">🧑‍💻 使用量與成功率</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tbody>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">分析請求（${keywordStats?.lastTimestamp ? `自 ${new Date(keywordStats.firstTimestamp || usageSummary?.since).toLocaleDateString()} 起` : '期間'}）</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 700; color: #111827;">${keywordStats?.total ?? 0}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">語系分佈</td>
                    <td style="text-align: right; font-size: 15px; color: #4b5563;">${keywordStats?.locales ? Object.entries(keywordStats.locales).map(([locale, count]) => `${locale}: ${count}`).join(' · ') : '—'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">任務狀態</td>
                    <td style="text-align: right; font-size: 15px; color: #4b5563;">${resultStats?.statusCounts ? Object.entries(resultStats.statusCounts).map(([status, count]) => `${status}: ${count}`).join(' · ') : '—'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">成功率</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 700; color: #059669;">${resultStats?.successRate != null ? `${(resultStats.successRate * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #4b5563;">平均分析耗時</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 700; color: #2563eb;">${resultStats?.averageAnalysisDurationMs != null ? `${resultStats.averageAnalysisDurationMs} ms` : '—'}</td>
                  </tr>
                </tbody>
              </table>

              <h2 style="font-size: 20px;">✅ 建議事項</h2>
              <ul style="padding-left: 20px; color: #374151;">
                ${(recommendations || []).map((item) => `<li style="margin: 8px 0;">${item}</li>`).join('') || '<li style="margin: 8px 0; color: #6b7280;">本週無特別建議</li>'}
              </ul>

              <h2 style="font-size: 20px;">🛠 下一步行動</h2>
              <ol style="padding-left: 20px; color: #374151;">
                ${(nextSteps || []).map((item) => `<li style="margin: 8px 0;">${item}</li>`).join('') || '<li style="margin: 8px 0; color: #6b7280;">請持續監控 Pipeline 狀態</li>'}
              </ol>
            </div>
            <div style="padding: 16px 32px; background: #f3f4f6; color: #6b7280; font-size: 13px; text-align: center;">
              如需查看更多細節，請登入 Pipeline 控制台。
            </div>
          </div>
        </body>
      </html>
    `
  }

  buildWeeklyReportText(report) {
    const { aggregated, recommendations, nextSteps, usageSummary } = report
    const formatCurrency = (value) => `$${(value ?? 0).toFixed(2)}`
    const keywordStats = usageSummary?.keywordAnalytics
    const resultStats = usageSummary?.analysisResults

    return [
      `📈 Pipeline 週報 (${report.period})`,
      '',
      '📊 摘要指標',
      `- 蒐集記錄總數：${aggregated.totalRecords}`,
      `- 總成本：${formatCurrency(aggregated.totalCost)}`,
      `- 日均成本：${formatCurrency(aggregated.averageDailyCost)}`,
      `- 平均成功率：${(aggregated.averageSuccessRate ?? 0).toFixed(1)}%`,
      '',
      '🧑‍💻 使用量與成功率',
      `- 分析請求：${keywordStats?.total ?? 0}`,
      `- 語系分佈：${keywordStats?.locales ? Object.entries(keywordStats.locales).map(([locale, count]) => `${locale}=${count}`).join(', ') : '—'}`,
      `- 任務狀態：${resultStats?.statusCounts ? Object.entries(resultStats.statusCounts).map(([status, count]) => `${status}=${count}`).join(', ') : '—'}`,
      `- 任務成功率：${resultStats?.successRate != null ? `${(resultStats.successRate * 100).toFixed(1)}%` : '—'}`,
      `- 平均分析耗時：${resultStats?.averageAnalysisDurationMs != null ? `${resultStats.averageAnalysisDurationMs} ms` : '—'}`,
      '',
      '✅ 建議事項',
      ...(recommendations?.length ? recommendations.map((item) => `- ${item}`) : ['- 本週無特別建議']),
      '',
      '🛠 下一步行動',
      ...(nextSteps?.length ? nextSteps.map((item) => `- ${item}`) : ['- 請持續監控 Pipeline 狀態']),
      '',
      '如需查看更多細節，請登入 Pipeline 控制台。'
    ].join('\n')
  }

  /**
   * 處理 HTTP 請求
   */
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // POST /reporting/daily
      if (method === 'POST' && path === '/reporting/daily') {
        const options = await request.json().catch(() => ({}))
        const result = await this.generateDailyReport(options)
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 500
        })
      }

      // POST /reporting/weekly
      if (method === 'POST' && path === '/reporting/weekly') {
        const options = await request.json().catch(() => ({}))
        const result = await this.generateWeeklyReport(options)
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 500
        })
      }

      // GET /reporting/status
      if (method === 'GET' && path === '/reporting/status') {
        return new Response(JSON.stringify(await this.getStatus()), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('報表請求處理失敗:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

export default {
  fetch: (request, env, ctx) => {
    const id = env.REPORTING_SCHEDULER.idFromName('default')
    const obj = env.REPORTING_SCHEDULER.get(id)
    return obj.fetch(request)
  }
}
