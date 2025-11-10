/**
 * Cloudflare Queue Handler for v5 Async Analysis
 * 處理非同步內容分析任務與 Email 通知
 */

import { Resend } from 'resend'
import { generateResultEmailHtml, generateResultEmailText } from './email-template'

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
          locale: payload.locale || 'zh-TW',
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
  
  const siteUrl = env.SITE_URL || 'https://content-optimizer.ai'
  const locale = payload.locale || 'zh-TW'
  
  const emailHtml = generateResultEmailHtml(payload.taskId, result, siteUrl, locale)
  const emailText = generateResultEmailText(payload.taskId, result, siteUrl, locale)
  
  // 依 locale 決定郵件主旨
  const subjectMap = {
    'zh-TW': '✅ 您的內容分析結果已完成',
    'en': '✅ Your Content Analysis Results Are Ready',
    'ja': '✅ コンテンツ分析結果が完成しました'
  }
  const subject = subjectMap[locale] || subjectMap['zh-TW']
  
  try {
    const response = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'noreply@content-optimizer.ai',
      to: payload.email,
      subject,
      html: emailHtml,
      text: emailText
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
