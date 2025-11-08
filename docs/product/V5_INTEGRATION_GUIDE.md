# v5 前端整合指南

## 概述

本指南說明如何將 v5 自適應混合評分模型整合到現有前端應用中。

## 核心組件

### 1. AsyncAnalysisFlow.jsx
**用途**：非同步分析提交表單

**功能**
- 內容輸入（支援純文字與 HTML）
- 關鍵字輸入
- Email 輸入
- 提交狀態提示
- 任務 ID 顯示

**使用方式**
```jsx
import AsyncAnalysisFlow from '@/components/AsyncAnalysisFlow'

export default function AnalysisPage() {
  return (
    <div>
      <AsyncAnalysisFlow />
    </div>
  )
}
```

**Props**
- `onSubmitSuccess(taskId)` - 提交成功回調
- `onSubmitError(error)` - 提交失敗回調

### 2. V5ResultsDashboard.jsx
**用途**：結果展示儀表板

**功能**
- 雙分數顯示（結構 + 策略）
- 細項分數圖表
- WHY/HOW/WHAT 視覺化
- 改進建議列表

**使用方式**
```jsx
import V5ResultsDashboard from '@/components/V5ResultsDashboard'

export default function ResultsPage() {
  const [results, setResults] = useState(null)
  
  return (
    <V5ResultsDashboard 
      results={results} 
      isLoading={false}
    />
  )
}
```

**Props**
- `results` - 分析結果物件（包含 v5Scores）
- `isLoading` - 載入狀態

### 3. ResultsPage.jsx
**用途**：完整結果查詢頁面

**功能**
- 透過 URL 參數獲取 taskId
- 自動查詢結果
- 顯示完整分析詳情
- 錯誤處理與重試

**路由設定**
```jsx
import ResultsPage from '@/pages/ResultsPage'

// 在路由配置中
{
  path: '/results/:taskId',
  element: <ResultsPage />
}
```

## 整合步驟

### 步驟 1：更新路由配置

在 `src/App.jsx` 或路由配置文件中新增結果頁面：

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AnalysisPage from './pages/AnalysisPage'
import ResultsPage from './pages/ResultsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AnalysisPage />} />
        <Route path="/results/:taskId" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### 步驟 2：更新分析頁面

將 `AsyncAnalysisFlow` 整合到分析頁面：

```jsx
import AsyncAnalysisFlow from '@/components/AsyncAnalysisFlow'

export default function AnalysisPage() {
  const handleSubmitSuccess = (taskId) => {
    // 可選：顯示成功提示
    console.log('任務已提交:', taskId)
    // 可選：導向結果頁面
    // window.location.href = `/results/${taskId}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AsyncAnalysisFlow onSubmitSuccess={handleSubmitSuccess} />
    </div>
  )
}
```

### 步驟 3：環境變數配置

確保 `.env` 或 `.dev.vars` 中有以下配置：

```env
# API 端點
VITE_API_ENDPOINT=http://localhost:8787/api
# 或生產環境
VITE_API_ENDPOINT=https://api.content-optimizer.ai

# 結果頁面基礎 URL（用於 Email 連結）
VITE_SITE_URL=http://localhost:5173
# 或生產環境
VITE_SITE_URL=https://content-optimizer.ai
```

### 步驟 4：API 端點驗證

確保後端已實作以下端點：

**提交分析**
```
POST /api/analyze
Content-Type: application/json

{
  "content": "文章內容",
  "targetKeywords": ["關鍵字1", "關鍵字2"],
  "contentFormatHint": "plain|html|auto",
  "email": "user@example.com"
}

Response:
{
  "taskId": "uuid",
  "status": "queued"
}
```

**查詢結果**
```
GET /api/results/{taskId}

Response:
{
  "taskId": "uuid",
  "status": "completed",
  "result": {
    "v5Scores": { ... },
    "strategyAnalysis": { ... },
    "recommendations": [ ... ]
  },
  "completedAt": "2025-01-01T00:00:00Z"
}
```

## 樣式整合

### Tailwind CSS 配置

確保 `tailwind.config.js` 已配置：

```js
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 顏色方案

v5 組件使用以下顏色：

- **結構分**：綠色 (#10b981)
- **策略分**：紫色 (#8b5cf6)
- **總分**：藍色 (#667eea)
- **高優先級建議**：紅色 (#ef4444)
- **中優先級建議**：黃色 (#f59e0b)
- **低優先級建議**：藍色 (#3b82f6)

## 錯誤處理

### 常見錯誤與解決方案

**1. 404 - 任務不存在**
```jsx
if (response.status === 404) {
  // 結果已過期（7 天）或任務 ID 錯誤
  setError('結果已過期或任務 ID 錯誤')
}
```

**2. 503 - 服務暫時不可用**
```jsx
// 實現重試邏輯
const retryFetch = async (url, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      if (response.status === 503) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      throw new Error(`${response.status}`)
    } catch (e) {
      if (i === maxRetries - 1) throw e
    }
  }
}
```

**3. 網路錯誤**
```jsx
try {
  const response = await fetch(url)
} catch (error) {
  // 網路連線問題
  setError('網路連線失敗，請檢查您的網路設定')
}
```

## 測試

### 本地測試

1. **啟動本地 Worker**
```bash
npm run dev
```

2. **測試提交**
```bash
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "test content",
    "targetKeywords": ["test"],
    "contentFormatHint": "plain",
    "email": "test@example.com"
  }'
```

3. **測試結果查詢**
```bash
curl http://localhost:8787/api/results/{taskId}
```

### 自動化測試

執行 E2E 測試：
```bash
node tests/e2e-async-flow.js
```

## 效能優化

### 1. 結果快取

在前端快取結果以避免重複查詢：

```jsx
const [cache, setCache] = useState({})

const fetchResults = async (taskId) => {
  if (cache[taskId]) {
    return cache[taskId]
  }
  
  const response = await fetch(`/api/results/${taskId}`)
  const data = await response.json()
  
  setCache(prev => ({ ...prev, [taskId]: data }))
  return data
}
```

### 2. 輪詢優化

使用指數退避策略減少 API 呼叫：

```jsx
const [pollInterval, setPollInterval] = useState(1000)

useEffect(() => {
  const timer = setTimeout(() => {
    fetchResults()
    // 逐漸增加輪詢間隔
    setPollInterval(prev => Math.min(prev * 1.5, 10000))
  }, pollInterval)
  
  return () => clearTimeout(timer)
}, [pollInterval])
```

### 3. 圖片最佳化

確保儀表板中的圖表使用高效的渲染：

```jsx
// 使用 React.memo 避免不必要的重新渲染
const ScoreCard = React.memo(({ score, label }) => (
  <div>
    <p className="text-2xl font-bold">{score}</p>
    <p className="text-sm text-gray-600">{label}</p>
  </div>
))
```

## 部署檢查清單

- [ ] 所有組件已匯入
- [ ] 路由已配置
- [ ] 環境變數已設定
- [ ] API 端點已驗證
- [ ] 樣式已應用
- [ ] 錯誤處理已實作
- [ ] 本地測試通過
- [ ] E2E 測試通過
- [ ] 生產環境 URL 已更新
- [ ] Email 模板已驗證

## 常見問題

**Q: 如何自訂儀表板的顏色？**
A: 修改 `V5ResultsDashboard.jsx` 中的 Tailwind 類別，或在 `tailwind.config.js` 中擴展顏色配置。

**Q: 如何支援多語言？**
A: 在組件中使用 i18n 庫（如 react-i18next），為所有文本字符串提供翻譯。

**Q: 如何處理長時間的分析？**
A: 實現進度指示器或允許使用者在後台進行分析，稍後透過 Email 連結查看結果。

**Q: 如何自訂 Email 模板？**
A: 修改 `functions/api/email-template.js` 中的 HTML 和文本模板。

## 聯絡支援

如有整合問題，請聯絡：
- **技術支援**：tech-support@content-optimizer.ai
- **文檔**：docs.content-optimizer.ai
