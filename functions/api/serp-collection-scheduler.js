/**
 * SERP Collection Scheduler Durable Object
 * 管理 SERP 蒐集任務的批次執行與進度追蹤
 */

export class SerpCollectionScheduler {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.storage = state.storage
  }

  /**
   * 初始化狀態
   */
  async initialize() {
    const existing = await this.storage.get('serp:collection:state')
    if (!existing) {
      await this.storage.put('serp:collection:state', JSON.stringify({
        status: 'idle',
        currentBatch: null,
        totalBatches: 0,
        processedKeywords: 0,
        totalKeywords: 0,
        recordsCollected: 0,
        failedRecords: 0,
        startedAt: null,
        completedAt: null,
        lastError: null,
        batches: []
      }))
    }
  }

  /**
   * 取得目前狀態
   */
  async getStatus() {
    await this.initialize()
    const state = await this.storage.get('serp:collection:state')
    return JSON.parse(state)
  }

  /**
   * 更新狀態
   */
  async updateStatus(updates) {
    const current = await this.getStatus()
    const updated = { ...current, ...updates }
    await this.storage.put('serp:collection:state', JSON.stringify(updated))
    return updated
  }

  /**
   * 啟動 SERP 蒐集任務
   */
  async startCollection(options = {}) {
    const current = await this.getStatus()
    
    // 檢查是否已在執行
    if (current.status === 'running') {
      return {
        success: false,
        error: 'Collection already running',
        state: current
      }
    }

    const now = new Date().toISOString()
    
    // 解析關鍵字來源
    let keywords = []
    
    if (options.keywordsFile) {
      // 從 R2 讀取關鍵字檔案
      keywords = await this.loadKeywordsFromR2(options.keywordsFile)
    } else if (options.keywords && Array.isArray(options.keywords)) {
      keywords = options.keywords
    } else if (options.keywordCount) {
      // 從 KEYWORD_ANALYTICS KV 取得最新的關鍵字
      keywords = await this.fetchKeywordsFromKV(options.keywordCount)
    } else {
      return {
        success: false,
        error: 'No keywords provided',
        state: current
      }
    }

    if (keywords.length === 0) {
      return {
        success: false,
        error: 'No keywords found',
        state: current
      }
    }

    const batchSize = options.batchSize || 10
    const totalBatches = Math.ceil(keywords.length / batchSize)

    await this.updateStatus({
      status: 'running',
      totalKeywords: keywords.length,
      totalBatches: totalBatches,
      processedKeywords: 0,
      recordsCollected: 0,
      failedRecords: 0,
      startedAt: now,
      completedAt: null,
      lastError: null,
      batches: []
    })

    // 儲存關鍵字供後續使用
    await this.storage.put('serp:collection:keywords', JSON.stringify(keywords))
    await this.storage.put('serp:collection:options', JSON.stringify(options))

    try {
      // 開始批次處理
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize
        const batchEnd = Math.min(batchStart + batchSize, keywords.length)
        const batchKeywords = keywords.slice(batchStart, batchEnd)

        console.log(`🔄 處理批次 ${batchIndex + 1}/${totalBatches}`)
        
        const batchResult = await this.processBatch(
          batchKeywords,
          batchIndex + 1,
          totalBatches,
          options
        )

        // 更新進度
        const state = await this.getStatus()
        state.batches.push(batchResult)
        state.processedKeywords += batchKeywords.length
        state.recordsCollected += batchResult.recordsCollected || 0
        state.failedRecords += batchResult.failedRecords || 0
        state.currentBatch = batchIndex + 1

        await this.storage.put('serp:collection:state', JSON.stringify(state))
      }

      // 完成
      const finalState = await this.updateStatus({
        status: 'completed',
        completedAt: new Date().toISOString()
      })

      console.log('✅ SERP 蒐集完成')
      return {
        success: true,
        state: finalState
      }
    } catch (error) {
      console.error('❌ SERP 蒐集失敗:', error)
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
   * 處理單個批次
   */
  async processBatch(batchKeywords, batchIndex, totalBatches, options) {
    const analyzeApiUrl = options.analyzeApiUrl || 'https://ragseo.thinkwithblack.com/api/analyze'
    const keywordDelay = options.keywordDelay || 15
    const urlDelay = options.urlDelay || 12

    let recordsCollected = 0
    let failedRecords = 0
    const batchRecords = []

    for (const keyword of batchKeywords) {
      try {
        // 取得 SERP 結果
        const serpResults = await this.fetchSerpResults(keyword)
        
        if (!serpResults || serpResults.length === 0) {
          console.warn(`⚠️ 未取得 ${keyword} 的 SERP 結果`)
          failedRecords++
          continue
        }

        // 分析每個 URL
        for (let rank = 0; rank < serpResults.length; rank++) {
          const result = serpResults[rank]
          const url = result.link || result.url
          
          try {
            const analysis = await this.analyzeUrl(url, keyword, analyzeApiUrl)
            
            batchRecords.push({
              keyword,
              url,
              title: result.title,
              rank: rank + 1,
              timestamp: new Date().toISOString(),
              analysis
            })
            
            recordsCollected++
            
            // 延遲
            await this.sleep(urlDelay * 1000)
          } catch (error) {
            console.error(`❌ 分析 ${url} 失敗:`, error)
            failedRecords++
          }
        }

        // 關鍵字間隔
        await this.sleep(keywordDelay * 1000)
      } catch (error) {
        console.error(`❌ 處理關鍵字 ${keyword} 失敗:`, error)
        failedRecords++
      }
    }

    // 上傳批次結果至 R2
    const r2Key = await this.uploadBatchToR2(batchRecords, batchIndex)

    return {
      batchIndex,
      totalBatches,
      keywordCount: batchKeywords.length,
      recordsCollected,
      failedRecords,
      r2Key,
      completedAt: new Date().toISOString()
    }
  }

  /**
   * 取得 SERP 結果
   */
  async fetchSerpResults(keyword) {
    try {
      // 呼叫 SERP API（假設已在 Worker 中配置）
      const response = await fetch('http://internal/api/serp/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      })

      if (response.ok) {
        const data = await response.json()
        return data.results || []
      }

      console.warn(`⚠️ SERP API 回傳 ${response.status}`)
      return []
    } catch (error) {
      console.error(`❌ SERP 蒐集失敗:`, error)
      return []
    }
  }

  /**
   * 分析 URL
   */
  async analyzeUrl(url, keyword, apiUrl) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentUrl: url,
          targetKeywords: [keyword],
          returnChunks: false
        }),
        timeout: 60000
      })

      if (response.ok) {
        return await response.json()
      }

      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      console.error(`❌ 分析失敗:`, error)
      return {
        error: error.message,
        status: 'failed'
      }
    }
  }

  /**
   * 從 R2 讀取關鍵字檔案
   */
  async loadKeywordsFromR2(r2Key) {
    try {
      if (!this.env.KEYWORD_EXPORTS_BUCKET) {
        throw new Error('R2 bucket 未設定')
      }

      const file = await this.env.KEYWORD_EXPORTS_BUCKET.get(r2Key)
      if (!file) {
        throw new Error(`R2 檔案不存在: ${r2Key}`)
      }

      const content = await file.text()
      const data = JSON.parse(content)

      if (data.keywords && Array.isArray(data.keywords)) {
        return data.keywords
      }

      return []
    } catch (error) {
      console.error(`❌ 從 R2 讀取關鍵字失敗:`, error)
      return []
    }
  }

  /**
   * 從 KV 取得關鍵字
   */
  async fetchKeywordsFromKV(limit = 200) {
    try {
      if (!this.env.KEYWORD_ANALYTICS) {
        throw new Error('KEYWORD_ANALYTICS KV 未設定')
      }

      const keywords = []
      let cursor

      do {
        const listResult = await this.env.KEYWORD_ANALYTICS.list({
          prefix: 'kw:',
          limit: 100,
          cursor
        })

        for (const entry of listResult.keys) {
          if (keywords.length >= limit) break

          const raw = await this.env.KEYWORD_ANALYTICS.get(entry.name)
          if (!raw) continue

          try {
            const record = JSON.parse(raw)
            keywords.push(record.keyword)
          } catch (error) {
            console.warn('解析 keyword record 失敗:', entry.name)
          }
        }

        if (keywords.length >= limit || listResult.list_complete) {
          break
        }

        cursor = listResult.cursor
      } while (cursor)

      return keywords
    } catch (error) {
      console.error(`❌ 從 KV 取得關鍵字失敗:`, error)
      return []
    }
  }

  /**
   * 上傳批次結果至 R2
   */
  async uploadBatchToR2(records, batchIndex) {
    try {
      if (!this.env.KEYWORD_EXPORTS_BUCKET) {
        console.warn('R2 bucket 未設定，跳過上傳')
        return null
      }

      const dateStr = new Date().toISOString().split('T')[0]
      const key = `serp-results/${dateStr}/batch-${batchIndex}.json`

      const content = JSON.stringify({
        batchIndex,
        recordCount: records.length,
        records,
        uploadedAt: new Date().toISOString()
      }, null, 2)

      await this.env.KEYWORD_EXPORTS_BUCKET.put(key, content, {
        httpMetadata: {
          contentType: 'application/json'
        }
      })

      console.log(`✅ 批次結果已上傳至 R2: ${key}`)
      return key
    } catch (error) {
      console.error(`❌ R2 上傳失敗:`, error)
      return null
    }
  }

  /**
   * 延遲函數
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 取消蒐集
   */
  async cancelCollection() {
    const current = await this.getStatus()
    
    if (current.status !== 'running') {
      throw new Error('Collection is not running')
    }

    await this.updateStatus({
      status: 'cancelled',
      completedAt: new Date().toISOString()
    })

    console.log('❌ SERP 蒐集已取消')
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
      // GET /serp-collection/status
      if (method === 'GET' && path === '/serp-collection/status') {
        return new Response(JSON.stringify(await this.getStatus()), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // POST /serp-collection/start
      if (method === 'POST' && path === '/serp-collection/start') {
        const options = await request.json().catch(() => ({}))
        const result = await this.startCollection(options)
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      }

      // POST /serp-collection/cancel
      if (method === 'POST' && path === '/serp-collection/cancel') {
        const result = await this.cancelCollection()
        return new Response(JSON.stringify({ success: true, state: result }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('SERP Collection 請求處理失敗:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

export default {
  fetch: (request, env, ctx) => {
    const id = env.SERP_COLLECTION_SCHEDULER.idFromName('default')
    const obj = env.SERP_COLLECTION_SCHEDULER.get(id)
    return obj.fetch(request)
  }
}
