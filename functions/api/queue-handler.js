/**
 * Cloudflare Queue Handler for v5 Async Analysis
 * 處理非同步內容分析任務與 Email 通知
 */

import { Resend } from 'resend'

/**
 * 主要 Queue 消費者：處理分析任務
 */
export async function handleAnalysisQueue(batch, env) {
  console.log(`[Queue] 處理 ${batch.messages.length} 個分析任務`)
  
  for (const message of batch.messages) {
    try {
      const payload = message.body
      console.log(`[Queue] 處理任務: ${payload.taskId}`)
      
      // 執行分析
      const result = await performAnalysis(payload, env)
      
      // 儲存結果到 KV
      await env.ANALYSIS_RESULTS.put(
        `result:${payload.taskId}`,
        JSON.stringify({
          taskId: payload.taskId,
          email: payload.email,
          content: payload.content,
          keywords: payload.keywords,
          result,
          completedAt: new Date().toISOString(),
          status: 'completed'
        }),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 天過期
      )
      
      // 寄送 Email 通知
      await sendResultEmail(payload, result, env)
      
      // 確認消息已處理
      message.ack()
      console.log(`[Queue] 任務完成: ${payload.taskId}`)
    } catch (error) {
      console.error(`[Queue] 任務失敗: ${error.message}`)
      // 不 ack，讓 Queue 重試
    }
  }
}

/**
 * 執行內容分析（簡化版，實際應呼叫完整分析邏輯）
 */
async function performAnalysis(payload, env) {
  const { content, keywords, contentFormatHint = 'auto' } = payload
  
  // 這裡應該呼叫完整的分析邏輯
  // 暫時返回模擬結果
  return {
    structureScore: 75,
    strategyScore: 65,
    overallScore: 70,
    strategyAnalysis: {
      why: { score: 7, explanation: '清楚描繪問題背景', evidence: '首段提及痛點' },
      how: { score: 6, explanation: '提供基本步驟', evidence: '中段有操作指引' },
      what: { score: 6, explanation: '解決方案尚可', evidence: '結尾有總結' }
    },
    recommendations: [
      { dimension: 'WHY', priority: 'high', suggestion: '加強問題描述的具體性' },
      { dimension: 'HOW', priority: 'medium', suggestion: '補充更多實務案例' }
    ]
  }
}

/**
 * 發送結果 Email
 */
async function sendResultEmail(payload, result, env) {
  const resend = new Resend(env.RESEND_API_KEY)
  
  const resultUrl = `${env.SITE_URL}/results/${payload.taskId}`
  
  const emailHtml = `
    <h2>您的內容分析結果已完成</h2>
    <p>親愛的使用者，</p>
    <p>您提交的內容分析已完成。以下是摘要：</p>
    
    <h3>評分摘要</h3>
    <ul>
      <li><strong>結構分：</strong> ${result.structureScore}/100</li>
      <li><strong>策略分：</strong> ${result.strategyScore}/100</li>
      <li><strong>總分：</strong> ${result.overallScore}/100</li>
    </ul>
    
    <h3>策略分析</h3>
    <ul>
      <li><strong>WHY (問題定義)：</strong> ${result.strategyAnalysis.why.score}/10 - ${result.strategyAnalysis.why.explanation}</li>
      <li><strong>HOW (實現方法)：</strong> ${result.strategyAnalysis.how.score}/10 - ${result.strategyAnalysis.how.explanation}</li>
      <li><strong>WHAT (解決方案)：</strong> ${result.strategyAnalysis.what.score}/10 - ${result.strategyAnalysis.what.explanation}</li>
    </ul>
    
    <h3>建議</h3>
    <ul>
      ${result.recommendations.map(rec => `<li>[${rec.priority.toUpperCase()}] ${rec.dimension}: ${rec.suggestion}</li>`).join('')}
    </ul>
    
    <p><a href="${resultUrl}">點擊此處查看完整分析結果</a></p>
    
    <p>感謝使用 AI 內容優化大師！</p>
  `
  
  try {
    const response = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'noreply@content-optimizer.ai',
      to: payload.email,
      subject: '✅ 您的內容分析結果已完成',
      html: emailHtml
    })
    
    console.log(`[Email] 已寄送至 ${payload.email}:`, response.id)
    return response
  } catch (error) {
    console.error(`[Email] 寄送失敗: ${error.message}`)
    throw error
  }
}

/**
 * 提交分析任務到 Queue
 */
export async function submitAnalysisTask(payload, env) {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const queue = env.ANALYSIS_QUEUE
  await queue.send({
    taskId,
    ...payload,
    submittedAt: new Date().toISOString()
  })
  
  console.log(`[Queue] 任務已提交: ${taskId}`)
  
  return { taskId, status: 'queued' }
}
