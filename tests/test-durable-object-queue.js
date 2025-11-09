/**
 * Durable Object 隊列測試
 * 驗證非同步分析流程
 */

const API_BASE = process.env.API_BASE || 'http://localhost:8787'

async function testAsyncAnalysis() {
  console.log('🧪 開始 Durable Object 隊列測試...\n')

  const testContent = `
    # AI 行銷新時代：從工具使用者到策略規劃者

    當 AI 工具百花齊放，真正拉開差距的，往往不是你會用多少工具，而是你能不能用邏輯帶領 AI 工作。

    ## 為什麼「學邏輯」比「學工具」更重要？

    中小企業行銷人最常遇到的問題，就是「忙，但沒方向」。每天上架貼文、下廣告，但沒有策略、沒有 KPI，更沒有數據追蹤。

    AI 的確能放大行銷效果，但方向錯了，它也會放大失敗。真正的核心，仍然是「創造價值、解決問題」。

    ## 從工具操作者，進化為 AI 指揮官

    當策略邏輯清晰後，AI 與 MarTech 才能被「正確地招募」進你的團隊。

    AI 不是單一工具，而是一支可以被你指揮的「團隊」。
  `

  const testPayload = {
    content: testContent,
    targetKeywords: ['AI', '行銷', '策略'],
    contentFormatHint: 'plain',
    email: 'test@example.com',
    includeRecommendations: true
  }

  try {
    // 1. 提交非同步分析
    console.log('📤 步驟 1：提交非同步分析任務...')
    const submitResponse = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    })

    if (!submitResponse.ok) {
      throw new Error(`提交失敗: ${submitResponse.status} ${submitResponse.statusText}`)
    }

    const submitResult = await submitResponse.json()
    console.log('✅ 提交成功')
    console.log(`   狀態: ${submitResult.status}`)
    console.log(`   任務 ID: ${submitResult.taskId}`)
    console.log(`   Email: ${submitResult.email}\n`)

    const taskId = submitResult.taskId

    // 2. 等待分析完成
    console.log('⏳ 步驟 2：等待分析完成（最多 30 秒）...')
    let analysisResult = null
    let attempts = 0
    const maxAttempts = 30

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000))
      attempts++

      const queryResponse = await fetch(`${API_BASE}/api/results/${taskId}`)

      if (queryResponse.status === 404) {
        process.stdout.write('.')
        continue
      }

      if (!queryResponse.ok) {
        throw new Error(`查詢失敗: ${queryResponse.status}`)
      }

      analysisResult = await queryResponse.json()

      if (analysisResult.status === 'completed') {
        console.log('\n✅ 分析完成')
        break
      }

      process.stdout.write('.')
    }

    if (!analysisResult || analysisResult.status !== 'completed') {
      throw new Error('分析超時或未完成')
    }

    // 3. 驗證結果
    console.log('\n📊 步驟 3：驗證分析結果...')

    const result = analysisResult.result
    if (!result) {
      throw new Error('結果為空')
    }

    // 檢查 v5 評分
    if (result.v5Scores) {
      console.log('✅ v5 評分存在')
      console.log(`   結構分: ${result.v5Scores.structureScore}`)
      console.log(`   策略分: ${result.v5Scores.strategyScore}`)
      console.log(`   總分: ${result.v5Scores.overallScore}`)
    } else {
      console.warn('⚠️  v5 評分不存在')
    }

    // 檢查 SEO 指標
    if (result.metrics?.seo) {
      console.log(`✅ SEO 指標: ${result.metrics.seo.length} 項`)
    }

    // 檢查 AEO 指標
    if (result.metrics?.aeo) {
      console.log(`✅ AEO 指標: ${result.metrics.aeo.length} 項`)
    }

    // 檢查 HCU 評論
    if (result.hcuReview) {
      console.log(`✅ HCU 評論: ${result.hcuReview.length} 項`)
    }

    console.log('\n✨ 測試成功！非同步流程運作正常\n')

    return {
      success: true,
      taskId,
      result
    }
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// 執行測試
testAsyncAnalysis().then(result => {
  process.exit(result.success ? 0 : 1)
})
