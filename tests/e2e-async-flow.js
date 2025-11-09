/**
 * v5 非同步流程 E2E 測試
 * 驗證：提交 → 排程 → Email → 結果查詢
 */

import fs from 'fs'
import path from 'path'

const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:8787/api'
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'
const RESULTS_CHECK_INTERVAL = 3000 // 3 秒檢查一次
const MAX_WAIT_TIME = 120000 // 最多等待 120 秒

/**
 * 測試用例
 */
const testCases = [
  {
    id: 'e2e_001',
    title: '純文字內容提交',
    content: '葉黃素是一種重要的營養素，對眼睛健康至關重要。許多人面臨視力衰退的問題，特別是隨著年齡增長。本文將介紹如何選擇最適合的葉黃素補充品。',
    keywords: ['葉黃素', '眼睛健康'],
    contentFormatHint: 'plain'
  },
  {
    id: 'e2e_002',
    title: 'HTML 內容提交',
    content: '<h1>遠端工作生產力指南</h1><p>遠端工作已成為現代職場的常態。許多員工在家工作時面臨專注力下降的挑戰。</p><h2>建立專用工作空間</h2><p>這是第一步。應該遠離家庭活動區域，配備舒適的椅子和適當的照明。</p>',
    keywords: ['遠端工作', '生產力'],
    contentFormatHint: 'html'
  }
]

/**
 * 提交分析任務
 */
async function submitAnalysis(testCase) {
  console.log(`\n📤 提交任務: ${testCase.id}`)

  try {
    const response = await fetch(`${API_ENDPOINT}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testCase.content,
        targetKeywords: testCase.keywords,
        contentFormatHint: testCase.contentFormatHint,
        email: TEST_EMAIL
      })
    })

    if (!response.ok) {
      throw new Error(`提交失敗: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const taskId = data.taskId || data.id

    if (!taskId) {
      throw new Error('回應中缺少 taskId')
    }

    console.log(`✅ 任務已提交，ID: ${taskId}`)
    return taskId
  } catch (error) {
    console.error(`❌ 提交失敗: ${error.message}`)
    throw error
  }
}

/**
 * 查詢結果
 */
async function queryResults(taskId) {
  try {
    const response = await fetch(`${API_ENDPOINT}/results/${taskId}`)

    if (response.status === 404) {
      return null // 結果尚未準備好
    }

    if (!response.ok) {
      throw new Error(`查詢失敗: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ 查詢失敗: ${error.message}`)
    throw error
  }
}

/**
 * 等待結果
 */
async function waitForResults(taskId, maxWait = MAX_WAIT_TIME) {
  console.log(`⏳ 等待結果（最多 ${maxWait / 1000} 秒）...`)

  const startTime = Date.now()

  while (Date.now() - startTime < maxWait) {
    const results = await queryResults(taskId)

    if (results) {
      console.log(`✅ 結果已準備好`)
      return results
    }

    console.log(`  ⏱️ 檢查中... (${Math.round((Date.now() - startTime) / 1000)}s)`)
    await new Promise(r => setTimeout(r, RESULTS_CHECK_INTERVAL))
  }

  throw new Error(`超時：${maxWait / 1000} 秒內未收到結果`)
}

/**
 * 驗證結果
 */
function validateResults(results, testCase) {
  console.log(`\n🔍 驗證結果...`)

  const errors = []

  // 檢查基本結構
  if (!results.result) {
    errors.push('缺少 result 欄位')
  }

  if (!results.result?.v5Scores) {
    errors.push('缺少 v5Scores 欄位')
  }

  const { v5Scores } = results.result || {}

  // 檢查分數範圍
  if (v5Scores?.structureScore === undefined) {
    errors.push('缺少 structureScore')
  } else if (v5Scores.structureScore < 0 || v5Scores.structureScore > 100) {
    errors.push(`structureScore 超出範圍: ${v5Scores.structureScore}`)
  }

  if (v5Scores?.strategyScore === undefined) {
    errors.push('缺少 strategyScore')
  } else if (v5Scores.strategyScore < 0 || v5Scores.strategyScore > 100) {
    errors.push(`strategyScore 超出範圍: ${v5Scores.strategyScore}`)
  }

  if (v5Scores?.overallScore === undefined) {
    errors.push('缺少 overallScore')
  } else if (v5Scores.overallScore < 0 || v5Scores.overallScore > 100) {
    errors.push(`overallScore 超出範圍: ${v5Scores.overallScore}`)
  }

  // 檢查策略分析
  if (!results.result?.strategyAnalysis) {
    errors.push('缺少 strategyAnalysis')
  } else {
    const { why, how, what } = results.result.strategyAnalysis
    if (!why || !how || !what) {
      errors.push('缺少 WHY/HOW/WHAT 分析')
    }
    if (why?.score < 1 || why?.score > 10) {
      errors.push(`WHY 分數超出範圍: ${why?.score}`)
    }
    if (how?.score < 1 || how?.score > 10) {
      errors.push(`HOW 分數超出範圍: ${how?.score}`)
    }
    if (what?.score < 1 || what?.score > 10) {
      errors.push(`WHAT 分數超出範圍: ${what?.score}`)
    }
  }

  // 檢查建議
  if (!Array.isArray(results.result?.recommendations)) {
    errors.push('缺少 recommendations 陣列')
  }

  if (errors.length > 0) {
    console.log(`❌ 驗證失敗:`)
    errors.forEach(err => console.log(`   - ${err}`))
    return false
  }

  console.log(`✅ 驗證通過`)
  console.log(`   結構分: ${v5Scores.structureScore}`)
  console.log(`   策略分: ${v5Scores.strategyScore}`)
  console.log(`   總分: ${v5Scores.overallScore}`)
  console.log(`   WHY: ${results.result.strategyAnalysis.why.score}/10`)
  console.log(`   HOW: ${results.result.strategyAnalysis.how.score}/10`)
  console.log(`   WHAT: ${results.result.strategyAnalysis.what.score}/10`)

  return true
}

/**
 * 執行單個 E2E 測試
 */
async function runE2ETest(testCase) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`測試: ${testCase.title}`)
  console.log(`ID: ${testCase.id}`)
  console.log('='.repeat(60))

  try {
    // 1. 提交
    const taskId = await submitAnalysis(testCase)

    // 2. 等待結果
    const results = await waitForResults(taskId)

    // 3. 驗證
    const isValid = validateResults(results, testCase)

    return {
      testCase: testCase.id,
      taskId,
      passed: isValid,
      results
    }
  } catch (error) {
    console.error(`❌ 測試失敗: ${error.message}`)
    return {
      testCase: testCase.id,
      passed: false,
      error: error.message
    }
  }
}

/**
 * 主測試流程
 */
async function runAllE2ETests() {
  console.log('🚀 開始 v5 非同步流程 E2E 測試\n')
  console.log(`API 端點: ${API_ENDPOINT}`)
  console.log(`測試 Email: ${TEST_EMAIL}\n`)

  const results = []
  let passCount = 0

  for (const testCase of testCases) {
    const result = await runE2ETest(testCase)
    results.push(result)

    if (result.passed) {
      passCount++
    }

    // 避免速率限制
    await new Promise(r => setTimeout(r, 2000))
  }

  // 總結
  console.log(`\n${'='.repeat(60)}`)
  console.log('📈 E2E 測試總結')
  console.log('='.repeat(60))
  console.log(`通過: ${passCount}/${testCases.length}`)

  if (passCount === testCases.length) {
    console.log('✅ 所有 E2E 測試通過！')
  } else {
    console.log('⚠️ 部分測試失敗，詳見下方')
  }

  // 輸出詳細報告
  const reportPath = path.join(process.cwd(), 'tests/e2e-async-results.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      passCount,
      totalTests: testCases.length,
      results
    }, null, 2)
  )

  console.log(`\n📄 詳細報告已保存至: ${reportPath}`)
}

// 執行測試
runAllE2ETests().catch(console.error)
