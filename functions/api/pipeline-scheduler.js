/**
 * Pipeline Scheduler Durable Object
 * 管理排名權重自動更新排程的狀態機與執行流程
 * 支援 Cloudflare Cron 觸發與手動觸發
 */

export class PipelineScheduler {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.storage = state.storage
  }

  /**
   * 初始化狀態
   */
  async initialize() {
    const existing = await this.storage.get('pipeline:state')
    if (!existing) {
      await this.storage.put('pipeline:state', JSON.stringify({
        status: 'idle',
        currentPhase: null,
        startedAt: null,
        completedAt: null,
        lastError: null,
        phases: {
          keyword_export: { status: 'pending', startedAt: null, completedAt: null, result: null },
          serp_collection: { status: 'pending', startedAt: null, completedAt: null, result: null },
          model_training: { status: 'pending', startedAt: null, completedAt: null, result: null },
          cost_summary: { status: 'pending', startedAt: null, completedAt: null, result: null }
        }
      }))
    }
  }

  /**
   * 取得目前狀態
   */
  async getStatus() {
    await this.initialize()
    const state = await this.storage.get('pipeline:state')
    return JSON.parse(state)
  }

  /**
   * 更新狀態
   */
  async updateStatus(updates) {
    const current = await this.getStatus()
    const updated = { ...current, ...updates }
    await this.storage.put('pipeline:state', JSON.stringify(updated))
    return updated
  }

  /**
   * 更新特定階段狀態
   */
  async updatePhaseStatus(phase, status, result = null) {
    const current = await this.getStatus()
    const now = new Date().toISOString()
    
    current.phases[phase] = {
      ...current.phases[phase],
      status: status,
      startedAt: status === 'running' ? now : current.phases[phase].startedAt,
      completedAt: status === 'completed' || status === 'failed' ? now : current.phases[phase].completedAt,
      result: result || current.phases[phase].result
    }
    
    await this.storage.put('pipeline:state', JSON.stringify(current))
    return current
  }

  /**
   * 啟動排程
   */
  async startPipeline(options = {}) {
    const current = await this.getStatus()
    
    // 檢查是否已在執行
    if (current.status === 'running') {
      return {
        success: false,
        error: 'Pipeline already running',
        state: current
      }
    }

    const now = new Date().toISOString()
    await this.updateStatus({
      status: 'running',
      startedAt: now,
      completedAt: null,
      lastError: null
    })

    // 重置所有階段
    for (const phase of Object.keys(current.phases)) {
      await this.updatePhaseStatus(phase, 'pending', null)
    }

    // 排程各階段執行
    try {
      // 階段 1: 關鍵字匯出
      await this.executePhase('keyword_export', options)
      
      // 階段 2: SERP 蒐集
      await this.executePhase('serp_collection', options)
      
      // 階段 3: 模型訓練
      await this.executePhase('model_training', options)
      
      // 階段 4: 成本摘要
      await this.executePhase('cost_summary', options)

      // 完成
      await this.updateStatus({
        status: 'completed',
        completedAt: new Date().toISOString()
      })

      return {
        success: true,
        state: await this.getStatus()
      }
    } catch (error) {
      console.error('Pipeline 執行失敗:', error)
      await this.updateStatus({
        status: 'failed',
        lastError: error.message,
        completedAt: new Date().toISOString()
      })

      return {
        success: false,
        error: error.message,
        state: await this.getStatus()
      }
    }
  }

  /**
   * 執行特定階段
   */
  async executePhase(phase, options = {}) {
    console.log(`🚀 開始執行階段: ${phase}`)
    await this.updatePhaseStatus(phase, 'running')

    try {
      let result = null

      switch (phase) {
        case 'keyword_export':
          result = await this.executeKeywordExport(options)
          break
        case 'serp_collection':
          result = await this.executeSerpCollection(options)
          break
        case 'model_training':
          result = await this.executeModelTraining(options)
          break
        case 'cost_summary':
          result = await this.executeCostSummary(options)
          break
        default:
          throw new Error(`Unknown phase: ${phase}`)
      }

      await this.updatePhaseStatus(phase, 'completed', result)
      console.log(`✅ 階段完成: ${phase}`)
      return result
    } catch (error) {
      console.error(`❌ 階段失敗: ${phase}`, error)
      await this.updatePhaseStatus(phase, 'failed', { error: error.message })
      throw error
    }
  }

  /**
   * 執行關鍵字匯出
   */
  async executeKeywordExport(options) {
    const apiUrl = this.env.KEYWORD_EXPORT_API_URL || 'http://localhost:8787'
    const token = this.env.KEYWORD_ANALYTICS_TOKEN
    
    if (!token) {
      throw new Error('KEYWORD_ANALYTICS_TOKEN not configured')
    }

    const params = new URLSearchParams({
      format: 'json',
      limit: options.keywordLimit || 200,
      uploadToR2: 'true'
    })

    if (options.since) {
      params.append('since', options.since)
    }
    if (options.locale) {
      params.append('locale', options.locale)
    }

    const response = await fetch(`${apiUrl}/api/keywords/export?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Keyword export failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`✅ 匯出 ${data.count} 筆關鍵字`)
    
    return {
      count: data.count,
      filename: data.filename,
      r2Key: data.r2Key,
      exportedAt: data.exportedAt
    }
  }

  /**
   * 執行 SERP 蒐集
   */
  async executeSerpCollection(options) {
    console.log('📊 開始 SERP 蒐集')
    
    // 取得上一階段（關鍵字匯出）的結果
    const current = await this.getStatus()
    const keywordExportResult = current.phases.keyword_export.result
    
    if (!keywordExportResult) {
      throw new Error('No keyword export result found')
    }

    // 準備 SERP 蒐集選項
    const serpOptions = {
      keywordsFile: keywordExportResult.r2Key,
      batchSize: options.serpBatchSize || 10,
      analyzeApiUrl: options.analyzeApiUrl || 'https://ragseo.thinkwithblack.com/api/analyze',
      keywordDelay: options.keywordDelay || 15,
      urlDelay: options.urlDelay || 12,
      uploadToR2: true
    }

    // 呼叫 SERP Collection Scheduler Durable Object
    try {
      const schedulerId = this.env.SERP_COLLECTION_SCHEDULER.idFromName('default')
      const scheduler = this.env.SERP_COLLECTION_SCHEDULER.get(schedulerId)

      const response = await scheduler.fetch(new Request('http://internal/serp-collection/start', {
        method: 'POST',
        body: JSON.stringify(serpOptions)
      }))

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'SERP collection failed')
      }

      console.log(`✅ SERP 蒐集完成: ${result.state.recordsCollected} 筆記錄`)
      
      return {
        status: 'completed',
        recordsCollected: result.state.recordsCollected,
        failedRecords: result.state.failedRecords,
        totalBatches: result.state.totalBatches,
        completedAt: result.state.completedAt
      }
    } catch (error) {
      console.error('❌ SERP 蒐集失敗:', error)
      throw error
    }
  }

  /**
   * 執行模型訓練
   */
  async executeModelTraining(options) {
    console.log('🤖 開始模型訓練與部署')
    
    try {
      const deploymentId = this.env.MODEL_DEPLOYMENT_SCHEDULER.idFromName('default')
      const scheduler = this.env.MODEL_DEPLOYMENT_SCHEDULER.get(deploymentId)

      const response = await scheduler.fetch(new Request('http://internal/model-deployment/start', {
        method: 'POST',
        body: JSON.stringify({
          serpResultsPath: options.serpResultsPath || 'serp-results',
          dataDir: options.dataDir || './ml/training-data',
          testSize: options.testSize || 0.2,
          trainingApiUrl: options.trainingApiUrl || 'http://localhost:8000/train'
        })
      }))

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Model training failed')
      }

      console.log(`✅ 模型訓練完成: ${result.state.phases.model_deployment.result.modelVersion}`)
      
      return {
        status: 'completed',
        modelVersion: result.state.phases.model_deployment.result.modelVersion,
        metrics: result.state.phases.model_training.result.metrics,
        completedAt: result.state.completedAt
      }
    } catch (error) {
      console.error('❌ 模型訓練失敗:', error)
      throw error
    }
  }

  /**
   * 執行成本摘要
   */
  async executeCostSummary(options) {
    console.log('💰 開始生成成本摘要')
    
    try {
      const reportingId = this.env.REPORTING_SCHEDULER.idFromName('default')
      const scheduler = this.env.REPORTING_SCHEDULER.get(reportingId)

      // 生成每日報表
      const dailyResponse = await scheduler.fetch(new Request('http://internal/reporting/daily', {
        method: 'POST',
        body: JSON.stringify(options)
      }))

      const dailyResult = await dailyResponse.json()
      
      if (!dailyResult.success) {
        throw new Error(dailyResult.error || 'Daily report generation failed')
      }

      // 如果是週一，生成週報
      let weeklyResult = null
      if (new Date().getDay() === 1) {
        const weeklyResponse = await scheduler.fetch(new Request('http://internal/reporting/weekly', {
          method: 'POST',
          body: JSON.stringify(options)
        }))

        weeklyResult = await weeklyResponse.json()
        console.log(`✅ 週報生成完成`)
      }

      console.log(`✅ 成本摘要完成`)
      
      return {
        status: 'completed',
        daily: dailyResult.report,
        weekly: weeklyResult?.report || null,
        completedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ 成本摘要失敗:', error)
      throw error
    }
  }

  /**
   * 重試失敗的階段
   */
  async retryPhase(phase) {
    const current = await this.getStatus()
    const phaseStatus = current.phases[phase]
    
    if (!phaseStatus) {
      throw new Error(`Unknown phase: ${phase}`)
    }

    if (phaseStatus.status !== 'failed') {
      throw new Error(`Phase ${phase} is not in failed state`)
    }

    console.log(`🔄 重試階段: ${phase}`)
    return await this.executePhase(phase)
  }

  /**
   * 取消排程
   */
  async cancelPipeline() {
    const current = await this.getStatus()
    
    if (current.status !== 'running') {
      throw new Error('Pipeline is not running')
    }

    await this.updateStatus({
      status: 'cancelled',
      completedAt: new Date().toISOString()
    })

    console.log('❌ 排程已取消')
    return await this.getStatus()
  }

  /**
   * 健康檢查端點
   */
  async handleHealthCheck() {
    const status = await this.getStatus()
    return {
      healthy: true,
      status: status.status,
      lastPhase: status.currentPhase,
      phases: status.phases
    }
  }

  /**
   * 處理 HTTP 請求
   */
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // GET /pipeline/status - 取得狀態
      if (method === 'GET' && path === '/pipeline/status') {
        return new Response(JSON.stringify(await this.getStatus()), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // GET /pipeline/health - 健康檢查
      if (method === 'GET' && path === '/pipeline/health') {
        return new Response(JSON.stringify(await this.handleHealthCheck()), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // POST /pipeline/start - 啟動排程
      if (method === 'POST' && path === '/pipeline/start') {
        const options = await request.json().catch(() => ({}))
        const result = await this.startPipeline(options)
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      }

      // POST /pipeline/cancel - 取消排程
      if (method === 'POST' && path === '/pipeline/cancel') {
        const result = await this.cancelPipeline()
        return new Response(JSON.stringify({ success: true, state: result }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // POST /pipeline/retry/:phase - 重試特定階段
      if (method === 'POST' && path.startsWith('/pipeline/retry/')) {
        const phase = path.split('/').pop()
        const result = await this.retryPhase(phase)
        return new Response(JSON.stringify({ success: true, phase, state: result }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Pipeline 請求處理失敗:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

export default {
  fetch: (request, env, ctx) => {
    const id = env.PIPELINE_SCHEDULER.idFromName('default')
    const obj = env.PIPELINE_SCHEDULER.get(id)
    return obj.fetch(request)
  }
}
