/**
 * Model Deployment Scheduler Durable Object
 * 管理模型訓練、轉檔與部署流程
 */

export class ModelDeploymentScheduler {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.storage = state.storage
  }

  /**
   * 初始化狀態
   */
  async initialize() {
    const existing = await this.storage.get('model:deployment:state')
    if (!existing) {
      await this.storage.put('model:deployment:state', JSON.stringify({
        status: 'idle',
        currentPhase: null,
        startedAt: null,
        completedAt: null,
        lastError: null,
        phases: {
          data_preparation: { status: 'pending', startedAt: null, completedAt: null, result: null },
          model_training: { status: 'pending', startedAt: null, completedAt: null, result: null },
          model_conversion: { status: 'pending', startedAt: null, completedAt: null, result: null },
          model_deployment: { status: 'pending', startedAt: null, completedAt: null, result: null }
        }
      }))
    }
  }

  /**
   * 取得目前狀態
   */
  async getStatus() {
    await this.initialize()
    const state = await this.storage.get('model:deployment:state')
    return JSON.parse(state)
  }

  /**
   * 更新狀態
   */
  async updateStatus(updates) {
    const current = await this.getStatus()
    const updated = { ...current, ...updates }
    await this.storage.put('model:deployment:state', JSON.stringify(updated))
    return updated
  }

  /**
   * 更新階段狀態
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
    
    await this.storage.put('model:deployment:state', JSON.stringify(current))
    return current
  }

  /**
   * 啟動模型訓練與部署
   */
  async startDeployment(options = {}) {
    const current = await this.getStatus()
    
    if (current.status === 'running') {
      return {
        success: false,
        error: 'Deployment already running',
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

    try {
      // 階段 1: 資料準備
      await this.executePhase('data_preparation', options)
      
      // 階段 2: 模型訓練
      await this.executePhase('model_training', options)
      
      // 階段 3: 模型轉檔
      await this.executePhase('model_conversion', options)
      
      // 階段 4: 模型部署
      await this.executePhase('model_deployment', options)

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
      console.error('模型部署失敗:', error)
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
        case 'data_preparation':
          result = await this.executeDataPreparation(options)
          break
        case 'model_training':
          result = await this.executeModelTraining(options)
          break
        case 'model_conversion':
          result = await this.executeModelConversion(options)
          break
        case 'model_deployment':
          result = await this.executeModelDeployment(options)
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
   * 執行資料準備
   */
  async executeDataPreparation(options) {
    console.log('📊 準備訓練資料')

    // 從 R2 讀取 SERP 蒐集結果
    const serpResultsPath = options.serpResultsPath || 'serp-results'
    
    try {
      if (!this.env.KEYWORD_EXPORTS_BUCKET) {
        throw new Error('R2 bucket 未設定')
      }

      // 列出所有 SERP 結果檔案
      const files = await this.env.KEYWORD_EXPORTS_BUCKET.list({
        prefix: serpResultsPath
      })

      console.log(`✅ 找到 ${files.objects.length} 個 SERP 結果檔案`)

      return {
        status: 'completed',
        filesCount: files.objects.length,
        serpResultsPath: serpResultsPath
      }
    } catch (error) {
      console.error('❌ 資料準備失敗:', error)
      throw error
    }
  }

  /**
   * 執行模型訓練
   */
  async executeModelTraining(options) {
    console.log('🤖 開始模型訓練')

    // 呼叫後端 Python 訓練腳本
    const trainingApiUrl = options.trainingApiUrl || 'http://localhost:8000/train'
    const dataDir = options.dataDir || './ml/training-data'

    try {
      const response = await fetch(trainingApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataDir: dataDir,
          testSize: options.testSize || 0.2,
          deploy: true
        }),
        timeout: 3600000 // 1 小時超時
      })

      if (!response.ok) {
        throw new Error(`訓練 API 回傳 ${response.status}`)
      }

      const result = await response.json()
      console.log(`✅ 模型訓練完成`)
      console.log(`  測試 RMSE: ${result.metrics.test_rmse.toFixed(4)}`)
      console.log(`  測試 R²: ${result.metrics.test_r2.toFixed(4)}`)

      return {
        status: 'completed',
        metrics: result.metrics,
        modelPath: result.modelPath,
        configPath: result.configPath
      }
    } catch (error) {
      console.error('❌ 模型訓練失敗:', error)
      throw error
    }
  }

  /**
   * 執行模型轉檔
   */
  async executeModelConversion(options) {
    console.log('🔄 轉檔模型配置')

    const current = await this.getStatus()
    const trainingResult = current.phases.model_training.result

    if (!trainingResult || !trainingResult.configPath) {
      throw new Error('未找到訓練結果')
    }

    try {
      // 從 R2 讀取模型配置
      const configContent = await this.env.KEYWORD_EXPORTS_BUCKET.get(trainingResult.configPath)
      if (!configContent) {
        throw new Error('模型配置檔案不存在')
      }

      const config = JSON.parse(await configContent.text())

      // 轉檔為 Worker 相容格式
      const workerConfig = this.convertToWorkerFormat(config)

      // 上傳轉檔後的配置
      const convertedPath = `model-configs/converted-${Date.now()}.json`
      await this.env.KEYWORD_EXPORTS_BUCKET.put(
        convertedPath,
        JSON.stringify(workerConfig, null, 2),
        { httpMetadata: { contentType: 'application/json' } }
      )

      console.log(`✅ 模型轉檔完成: ${convertedPath}`)

      return {
        status: 'completed',
        originalPath: trainingResult.configPath,
        convertedPath: convertedPath,
        config: workerConfig
      }
    } catch (error) {
      console.error('❌ 模型轉檔失敗:', error)
      throw error
    }
  }

  /**
   * 轉檔為 Worker 相容格式
   */
  convertToWorkerFormat(config) {
    return {
      version: config.version,
      createdAt: config.createdAt,
      description: config.description,
      trainingMetrics: config.trainingMetrics,
      trainingRecords: config.trainingRecords,
      modelConfig: {
        type: 'xgboost',
        featureNames: config.modelConfig.feature_names,
        featureImportance: config.modelConfig.feature_importance,
        hyperparameters: {
          nEstimators: config.modelConfig.n_estimators,
          maxDepth: config.modelConfig.max_depth,
          learningRate: config.modelConfig.learning_rate,
          subsample: config.modelConfig.subsample,
          colsampleBytree: config.modelConfig.colsample_bytree
        }
      },
      deployment: {
        type: 'cloudflare-worker',
        format: 'json',
        compatibility: 'scoring-model.js v2.0+'
      }
    }
  }

  /**
   * 執行模型部署
   */
  async executeModelDeployment(options) {
    console.log('🚀 開始模型部署')

    const current = await this.getStatus()
    const conversionResult = current.phases.model_conversion.result

    if (!conversionResult || !conversionResult.convertedPath) {
      throw new Error('未找到轉檔結果')
    }

    try {
      // 更新 KV 中的模型配置
      const modelConfig = conversionResult.config
      
      await this.env.ANALYSIS_RESULTS.put(
        'current-model-config',
        JSON.stringify(modelConfig),
        {
          expirationTtl: 86400 * 30 // 30 天過期
        }
      )

      console.log('✅ 模型配置已更新至 KV')

      // 發送部署通知
      if (this.env.SLACK_WEBHOOK_URL) {
        await this.notifySlack({
          title: '✅ 模型部署完成',
          version: modelConfig.version,
          metrics: modelConfig.trainingMetrics,
          records: modelConfig.trainingRecords
        })
      }

      return {
        status: 'completed',
        modelVersion: modelConfig.version,
        kvKey: 'current-model-config',
        metrics: modelConfig.trainingMetrics
      }
    } catch (error) {
      console.error('❌ 模型部署失敗:', error)
      throw error
    }
  }

  /**
   * 發送 Slack 通知
   */
  async notifySlack(notification) {
    const webhookUrl = this.env.SLACK_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('SLACK_WEBHOOK_URL 未設定')
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
              text: `*${notification.title}*\n\n*版本*: ${notification.version}\n*訓練記錄*: ${notification.records}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*測試 RMSE*: ${notification.metrics.test_rmse.toFixed(4)}\n*測試 R²*: ${notification.metrics.test_r2.toFixed(4)}`
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
   * 取消部署
   */
  async cancelDeployment() {
    const current = await this.getStatus()
    
    if (current.status !== 'running') {
      throw new Error('Deployment is not running')
    }

    await this.updateStatus({
      status: 'cancelled',
      completedAt: new Date().toISOString()
    })

    console.log('❌ 模型部署已取消')
    return await this.getStatus()
  }

  /**
   * 處理 HTTP 請求
   */
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // GET /model-deployment/status
      if (method === 'GET' && path === '/model-deployment/status') {
        return new Response(JSON.stringify(await this.getStatus()), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // POST /model-deployment/start
      if (method === 'POST' && path === '/model-deployment/start') {
        const options = await request.json().catch(() => ({}))
        const result = await this.startDeployment(options)
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      }

      // POST /model-deployment/cancel
      if (method === 'POST' && path === '/model-deployment/cancel') {
        const result = await this.cancelDeployment()
        return new Response(JSON.stringify({ success: true, state: result }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('模型部署請求處理失敗:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

export default {
  fetch: (request, env, ctx) => {
    const id = env.MODEL_DEPLOYMENT_SCHEDULER.idFromName('default')
    const obj = env.MODEL_DEPLOYMENT_SCHEDULER.get(id)
    return obj.fetch(request)
  }
}
