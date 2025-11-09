/**
 * Email 結果通知模板
 * 使用 Resend 寄送分析結果
 */

export function generateResultEmailHtml(taskId, results, siteUrl) {
  const { v5Scores } = results
  const { structureScore, strategyScore, overallScore } = v5Scores || {}

  const resultUrl = `${siteUrl}/results/${taskId}`
  const scoreColor = overallScore >= 80 ? '#10b981' : overallScore >= 60 ? '#3b82f6' : '#f59e0b'

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const todoItems = Array.isArray(v5Scores?.recommendations)
    ? [...v5Scores.recommendations]
        .filter((rec) => rec && typeof rec === 'object')
        .sort((a, b) => {
          const aPriority = priorityOrder[a?.priority] ?? 3
          const bPriority = priorityOrder[b?.priority] ?? 3
          return aPriority - bPriority
        })
        .slice(0, 3)
    : []

  const todoSectionHtml = todoItems.length
    ? todoItems
        .map((rec) => {
          const priorityLabel = rec?.priority === 'high'
            ? '高優先級'
            : rec?.priority === 'medium'
              ? '中優先級'
              : '低優先級'
          const priorityColor = rec?.priority === 'high'
            ? '#dc2626'
            : rec?.priority === 'medium'
              ? '#d97706'
              : '#2563eb'
          return `
            <li class="todo-item">
              <div class="todo-header">
                <span class="todo-priority" style="color: ${priorityColor}; border-color: ${priorityColor};">${priorityLabel}</span>
                ${rec?.category ? `<span class="todo-category">${rec.category}</span>` : ''}
              </div>
              <p class="todo-title">${rec?.title || '待辦事項'}</p>
              <p class="todo-description">${rec?.description || '請登入平台查看詳細說明。'}</p>
              ${rec?.example ? `<p class="todo-example">範例：${rec.example}</p>` : ''}
            </li>
          `
        })
        .join('')
    : '<li class="todo-item empty">太棒了！目前沒有需要即刻處理的待辦事項。</li>'

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 內容優化分析結果</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px 24px;
    }
    .score-card {
      background-color: #f3f4f6;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      text-align: center;
    }
    .score-value {
      font-size: 48px;
      font-weight: 700;
      color: ${scoreColor};
      margin: 0;
    }
    .score-label {
      font-size: 14px;
      color: #6b7280;
      margin: 8px 0 0 0;
    }
    .score-interpretation {
      font-size: 14px;
      color: #374151;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }
    .breakdown {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .breakdown-item {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
    }
    .breakdown-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .breakdown-value {
      font-size: 28px;
      font-weight: 600;
      color: #1f2937;
    }
    .breakdown-bar {
      width: 100%;
      height: 4px;
      background-color: #e5e7eb;
      border-radius: 2px;
      margin-top: 8px;
      overflow: hidden;
    }
    .breakdown-bar-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    .structure-bar {
      background-color: #10b981;
    }
    .strategy-bar {
      background-color: #8b5cf6;
    }
    .todo-block {
      margin: 32px 0;
      padding: 24px;
      background-color: #fff7ed;
      border-radius: 8px;
      border-left: 4px solid #f97316;
    }
    .todo-block h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #b45309;
    }
    .todo-block p {
      margin: 0 0 16px 0;
      color: #92400e;
      font-size: 14px;
    }
    .todo-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 16px;
    }
    .todo-item {
      background-color: #fff5f0;
      border: 1px solid #fed7aa;
      border-radius: 6px;
      padding: 16px;
    }
    .todo-item.empty {
      text-align: center;
      color: #6b7280;
      background-color: #f3f4f6;
      border-color: #e5e7eb;
    }
    .todo-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .todo-priority {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border: 1px solid;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .todo-category {
      font-size: 12px;
      color: #6b7280;
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 999px;
      padding: 2px 8px;
    }
    .todo-title {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: #7c2d12;
    }
    .todo-description {
      margin: 0;
      color: #92400e;
      font-size: 14px;
      line-height: 1.5;
    }
    .todo-example {
      margin: 12px 0 0 0;
      font-size: 12px;
      color: #7c2d12;
      background-color: #fffbeb;
      border-left: 3px solid #f97316;
      padding: 8px 12px;
      border-radius: 4px;
    }
    .cta-button {
      display: inline-block;
      background-color: #667eea;
      color: white;
      padding: 12px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin: 24px 0;
      transition: background-color 0.2s;
    }
    .cta-button:hover {
      background-color: #5568d3;
    }
    .cta-section {
      text-align: center;
      margin: 32px 0;
      padding: 24px;
      background-color: #f0f4ff;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .cta-section p {
      margin: 0 0 16px 0;
      color: #374151;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .task-id {
      font-family: 'Courier New', monospace;
      background-color: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>✨ 分析完成</h1>
      <p>您的內容已完成 AI 策略評估</p>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Main Score -->
      <div class="score-card">
        <p class="score-value">${overallScore}</p>
        <p class="score-label">綜合評分 / 100</p>
        <p class="score-interpretation">
          ${overallScore >= 80 ? '🌟 優秀 - 內容品質卓越，已具備 AI 引用潛力' : 
            overallScore >= 60 ? '👍 良好 - 內容有基礎，可進一步優化' : 
            overallScore >= 40 ? '⚠️ 中等 - 需要改進' : 
            '❌ 需改進 - 建議重新調整內容策略'}
        </p>
      </div>

      <!-- Breakdown -->
      <div class="breakdown">
        <div class="breakdown-item">
          <div class="breakdown-label">結構分</div>
          <div class="breakdown-value">${structureScore}</div>
          <div class="breakdown-bar">
            <div class="breakdown-bar-fill structure-bar" style="width: ${structureScore}%"></div>
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">40% 權重</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-label">策略分</div>
          <div class="breakdown-value">${strategyScore}</div>
          <div class="breakdown-bar">
            <div class="breakdown-bar-fill strategy-bar" style="width: ${strategyScore}%"></div>
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">60% 權重</div>
        </div>
      </div>

      <!-- TODO -->
      <div class="todo-block">
        <h4>優先待辦清單</h4>
        <p>以下是系統依照優先級整理出的行動建議，建議先從紅色標記的項目著手：</p>
        <ul class="todo-list">
          ${todoSectionHtml}
        </ul>
      </div>

      <!-- CTA -->
      <div class="cta-section">
        <p><strong>查看完整分析結果</strong></p>
        <p>點擊下方按鈕查看詳細的評分細項、WHY/HOW/WHAT 分析和改進建議。</p>
        <a href="${resultUrl}" class="cta-button">查看完整結果</a>
      </div>

      <!-- Task ID -->
      <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          任務 ID: <span class="task-id">${taskId}</span>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 12px 0;">
        © 2025 AI 內容優化大師 | 
        <a href="${siteUrl}">返回首頁</a>
      </p>
      <p style="margin: 0;">
        此 Email 由自動系統寄送，請勿直接回覆。
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export function generateResultEmailText(taskId, results, siteUrl) {
  const { v5Scores } = results
  const { structureScore, strategyScore, overallScore } = v5Scores || {}

  const resultUrl = `${siteUrl}/results/${taskId}`

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const todoItems = Array.isArray(v5Scores?.recommendations)
    ? [...v5Scores.recommendations]
        .filter((rec) => rec && typeof rec === 'object')
        .sort((a, b) => {
          const aPriority = priorityOrder[a?.priority] ?? 3
          const bPriority = priorityOrder[b?.priority] ?? 3
          return aPriority - bPriority
        })
        .slice(0, 3)
    : []

  const todoText = todoItems.length
    ? todoItems
        .map((rec, index) => {
          const priorityLabel = rec?.priority === 'high'
            ? '【高優先級】'
            : rec?.priority === 'medium'
              ? '【中優先級】'
              : '【低優先級】'
          const title = rec?.title || `待辦事項 ${index + 1}`
          const description = rec?.description ? ` - ${rec.description}` : ''
          return `${index + 1}. ${priorityLabel}${title}${description}`
        })
        .join('\n')
    : '目前沒有需要即刻處理的待辦事項，再接再厲！'

  return `
AI 內容優化分析結果
==================

綜合評分: ${overallScore}/100

${overallScore >= 80 ? '🌟 優秀 - 內容品質卓越，已具備 AI 引用潛力' : 
  overallScore >= 60 ? '👍 良好 - 內容有基礎，可進一步優化' : 
  overallScore >= 40 ? '⚠️ 中等 - 需要改進' : 
  '❌ 需改進 - 建議重新調整內容策略'}

分數細項
-------
結構分: ${structureScore}/100 (40% 權重)
策略分: ${strategyScore}/100 (60% 權重)

優先待辦清單
-----------
${todoText}

查看完整結果
-----------
點擊下方連結查看詳細的評分細項、WHY/HOW/WHAT 分析和改進建議：

${resultUrl}

任務 ID: ${taskId}

---
© 2025 AI 內容優化大師
此 Email 由自動系統寄送，請勿直接回覆。
  `.trim()
}
