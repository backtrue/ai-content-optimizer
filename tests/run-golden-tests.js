/**
 * v5 黃金測試集執行腳本
 * 驗證 WHY/HOW/WHAT 分數穩定性
 */

import fs from 'fs'
import path from 'path'

const GOLDEN_TEST_SET = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/golden-test-set.json'), 'utf-8')
)

const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:8787/api/analyze'

/**
 * 執行單個測試用例
 */
async function runTestCase(testCase, iteration) {
  console.log(`\n[Test ${testCase.id}] 執行第 ${iteration}/3 次...`)

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testCase.content,
        targetKeywords: testCase.keywords,
        contentFormatHint: 'plain'
      })
    })

    if (!response.ok) {
      throw new Error(`API 返回 ${response.status}`)
    }

    const result = await response.json()
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
  console.log('🚀 開始 v5 黃金測試集...\n')
  console.log(`測試集: ${GOLDEN_TEST_SET.description}`)
  console.log(`目的: ${GOLDEN_TEST_SET.purpose}\n`)

  const allResults = {}
  let totalPass = 0
  let totalTests = 0

  for (const testCase of GOLDEN_TEST_SET.testCases) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`測試: ${testCase.title}`)
    console.log(`ID: ${testCase.id}`)
    console.log('='.repeat(60))

    const results = []
    for (let i = 1; i <= 3; i++) {
      const result = await runTestCase(testCase, i)
      if (result) {
        results.push(result)
        console.log(`  ✓ WHY=${result.why}, HOW=${result.how}, WHAT=${result.what}`)
      }
      await new Promise(r => setTimeout(r, 1000)) // 避免速率限制
    }

    if (results.length === 3) {
      const analysis = analyzeResults(testCase, results)
      allResults[testCase.id] = analysis

      console.log(`\n📊 分析結果:`)
      for (const [dim, data] of Object.entries(analysis)) {
        const status = data.pass && data.withinRange ? '✅' : '⚠️'
        console.log(`  ${status} ${dim.toUpperCase()}:`)
        console.log(`     平均: ${data.average} (預期: ${data.expected.min}-${data.expected.max})`)
        console.log(`     標準差: ${data.stdDev} (應 < 1.5)`)
        console.log(`     分數: [${data.scores.join(', ')}]`)

        if (data.pass && data.withinRange) totalPass++
        totalTests++
      }
    }
  }

  // 總結
  console.log(`\n${'='.repeat(60)}`)
  console.log('📈 測試總結')
  console.log('='.repeat(60))
  console.log(`通過率: ${totalPass}/${totalTests} (${Math.round((totalPass / totalTests) * 100)}%)`)

  const passRate = totalPass / totalTests
  if (passRate >= 0.8) {
    console.log('✅ 穩定性驗證通過！')
  } else {
    console.log('⚠️ 穩定性需要改進，建議調整 Prompt 或模型參數')
  }

  // 輸出詳細報告
  const reportPath = path.join(process.cwd(), 'tests/golden-test-results.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    passRate,
    totalTests,
    totalPass,
    results: allResults
  }, null, 2))

  console.log(`\n📄 詳細報告已保存至: ${reportPath}`)
}

// 執行測試
runAllTests().catch(console.error)
