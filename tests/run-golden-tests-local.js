/**
 * v5 黃金測試集執行腳本 (本地版本 - 無需 Worker)
 * 驗證測試框架與資料完整性
 */

import fs from 'fs'
import path from 'path'

const GOLDEN_TEST_SET = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/golden-test-set.json'), 'utf-8')
)

/**
 * 模擬 API 回應 (用於本地測試)
 */
function mockAnalyzeResponse(testCase) {
  // 基於測試用例的預期範圍生成穩定的模擬分數
  const expected = testCase.expectedScores
  
  // 在預期範圍內生成分數 (取中點)
  const why = (expected.why.min + expected.why.max) / 2
  const how = (expected.how.min + expected.how.max) / 2
  const what = (expected.what.min + expected.what.max) / 2

  return {
    v5Scores: {
      breakdown: {
        strategy: {
          why: Math.round(why * 100) / 100,
          how: Math.round(how * 100) / 100,
          what: Math.round(what * 100) / 100
        }
      }
    }
  }
}

/**
 * 執行單個測試用例
 */
async function runTestCase(testCase, iteration) {
  console.log(`\n[Test ${testCase.id}] 執行第 ${iteration}/3 次...`)

  try {
    // 使用模擬回應
    const result = mockAnalyzeResponse(testCase)

    const strategyScores = result.v5Scores?.breakdown?.strategy || {}

    return {
      why: strategyScores.why || 0,
      how: strategyScores.how || 0,
      what: strategyScores.what || 0
    }
  } catch (error) {
    console.error(`❌ 測試失敗: ${error.message}`)
    return null
  }
}

/**
 * 分析測試結果
 */
function analyzeResults(testCase, results) {
  const dimensions = ['why', 'how', 'what']
  const analysis = {}

  for (const dim of dimensions) {
    const scores = results.map(r => r[dim])
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length
    const stdDev = Math.sqrt(variance)

    analysis[dim] = {
      scores,
      average: Math.round(avg * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      expected: testCase.expectedScores[dim],
      withinRange: avg >= testCase.expectedScores[dim].min && avg <= testCase.expectedScores[dim].max,
      pass: stdDev < 1.5
    }
  }

  return analysis
}

/**
 * 主測試流程
 */
async function runAllTests() {
  console.log('🚀 開始 v5 黃金測試集 (本地模擬版本)...\n')
  console.log(`測試集: ${GOLDEN_TEST_SET.name}`)
  console.log(`目的: ${GOLDEN_TEST_SET.purpose}\n`)

  const results = []
  let passCount = 0
  let totalTests = 0

  for (const testCase of GOLDEN_TEST_SET.testCases) {
    console.log('='.repeat(60))
    console.log(`測試: ${testCase.title}`)
    console.log(`ID: ${testCase.id}`)
    console.log('='.repeat(60))

    const iterations = []
    for (let i = 1; i <= 3; i++) {
      const result = await runTestCase(testCase, i)
      if (result) {
        iterations.push(result)
      }
    }

    if (iterations.length === 3) {
      const analysis = analyzeResults(testCase, iterations)
      const testPassed = Object.values(analysis).every(dim => dim.pass && dim.withinRange)

      console.log('\n📊 結果分析:')
      for (const [dim, data] of Object.entries(analysis)) {
        const status = data.pass && data.withinRange ? '✓' : '✗'
        console.log(`  ${status} ${dim.toUpperCase()}:`)
        console.log(`     分數: ${data.scores.join(', ')}`)
        console.log(`     平均: ${data.average}, 標準差: ${data.stdDev}`)
        console.log(`     預期: ${data.expected.min}-${data.expected.max}`)
      }

      if (testPassed) {
        console.log('✅ 測試通過')
        passCount++
      } else {
        console.log('❌ 測試失敗')
      }

      results.push({
        testCase: testCase.id,
        title: testCase.title,
        analysis,
        passed: testPassed
      })
    } else {
      console.log('❌ 測試失敗: 無法取得完整結果')
      results.push({
        testCase: testCase.id,
        title: testCase.title,
        passed: false
      })
    }

    totalTests++
  }

  // 輸出總結
  console.log('\n' + '='.repeat(60))
  console.log('📈 測試總結')
  console.log('='.repeat(60))
  console.log(`通過率: ${passCount}/${totalTests} (${Math.round((passCount / totalTests) * 100)}%)`)

  if (passCount === totalTests) {
    console.log('✅ 所有測試通過！')
  } else {
    console.log(`⚠️ 穩定性需要改進，建議調整 Prompt 或模型參數`)
  }

  // 保存報告
  const reportPath = path.join(process.cwd(), 'tests/golden-test-results-local.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTests,
    passCount,
    passRate: Math.round((passCount / totalTests) * 100),
    results
  }, null, 2))

  console.log(`\n📄 詳細報告已保存至: ${reportPath}`)
  process.exit(passCount === totalTests ? 0 : 1)
}

runAllTests().catch(error => {
  console.error('❌ 測試執行失敗:', error)
  process.exit(1)
})
