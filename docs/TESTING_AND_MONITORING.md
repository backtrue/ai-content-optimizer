# v5 評分系統測試與監控指南

## 📋 測試概述

v5 評分系統包含三層測試：
1. **黃金測試集**：驗證 WHY/HOW/WHAT 分數穩定性
2. **E2E 測試**：驗證完整非同步流程
3. **成本與容量監控**：收集 Gemini API 成本與效能數據

---

## 🧪 黃金測試集（Golden Test Set）

### 目的
驗證 v5 評分模型在相同內容上的**穩定性**，確保標準差 < 1.5。

### 測試用例
黃金測試集包含 3 篇精選內容，涵蓋不同難度與主題：

| 用例 | 標題 | 難度 | 預期分數範圍 |
|------|------|------|------------|
| #1 | 初級：簡單教程 | 低 | WHY: 6-8, HOW: 7-9, WHAT: 6-8 |
| #2 | 中級：深度分析 | 中 | WHY: 7-9, HOW: 6-8, WHAT: 7-9 |
| #3 | 高級：策略指南 | 高 | WHY: 8-10, HOW: 8-10, WHAT: 8-10 |

### 執行測試

#### 前置準備
```bash
# 確保本地開發伺服器運行
npm run dev

# 或啟動 Worker 開發伺服器
npm run worker:dev
```

#### 執行黃金測試
```bash
# 執行黃金測試集（每個用例執行 3 次）
API_ENDPOINT=http://localhost:8787/api/analyze npm run test:golden
```

#### 測試輸出
```
🚀 開始 v5 黃金測試集...

測試集: v5 穩定性驗證
目的: 驗證 WHY/HOW/WHAT 分數穩定性

============================================================
測試: 初級：簡單教程
ID: test-001
============================================================

[Test test-001] 執行第 1/3 次...
  ✓ WHY=7, HOW=8, WHAT=7

[Test test-001] 執行第 2/3 次...
  ✓ WHY=7, HOW=8, WHAT=7

[Test test-001] 執行第 3/3 次...
  ✓ WHY=7, HOW=8, WHAT=7

📊 分析結果:
  ✅ WHY:
     平均: 7 (預期: 6-8)
     標準差: 0 (應 < 1.5)
     分數: [7, 7, 7]

  ✅ HOW:
     平均: 8 (預期: 7-9)
     標準差: 0 (應 < 1.5)
     分數: [8, 8, 8]

  ✅ WHAT:
     平均: 7 (預期: 6-8)
     標準差: 0 (應 < 1.5)
     分數: [7, 7, 7]

============================================================
📈 測試總結
============================================================
通過率: 9/9 (100%)
✅ 穩定性驗證通過！

📄 詳細報告已保存至: tests/golden-test-results.json
```

### 解讀結果

#### 通過條件
- ✅ **標準差 < 1.5**：分數穩定性良好
- ✅ **平均分在預期範圍內**：評分邏輯正確
- ✅ **通過率 ≥ 80%**：系統整體穩定

#### 失敗排查

**問題 1：標準差過高（> 1.5）**
- **原因**：Gemini API 回應不穩定或 Prompt 不夠精確
- **解決方案**：
  - 檢查 Gemini API 配額是否充足
  - 調整 `buildAnalysisPrompt()` 中的提示詞
  - 增加 temperature 參數的穩定性

**問題 2：平均分超出預期範圍**
- **原因**：評分邏輯或計算公式有誤
- **解決方案**：
  - 檢查 `structure-score.js` 中的加權計算
  - 驗證 `analyzeWithGemini()` 中的分數提取邏輯
  - 檢查 JSON 解析是否正確

**問題 3：某個維度分數異常低**
- **原因**：該維度的提示詞可能不清晰
- **解決方案**：
  - 重新檢查 WHY/HOW/WHAT 的提示詞定義
  - 增加示例或上下文
  - 考慮調整評分標準

---

## 🔄 E2E 非同步流程測試

### 目的
驗證完整的非同步分析流程，包括：
1. Email 提交
2. Queue 處理
3. 結果儲存
4. Email 通知

### 執行測試

```bash
# 執行 E2E 測試
npm run test:e2e
```

### 測試流程

```
1. 提交分析請求（含 Email）
   ↓
2. 檢查任務是否進入 Queue
   ↓
3. 等待 Queue 處理（模擬或實際）
   ↓
4. 驗證結果是否儲存到 KV
   ↓
5. 驗證 Email 是否寄出
   ↓
6. 驗證結果查詢端點是否可訪問
```

### 測試輸出示例

```
🚀 開始 E2E 非同步流程測試...

[E2E] 步驟 1: 提交分析請求
  ✓ 任務 ID: task_1731098400000_abc123xyz
  ✓ 狀態: queued

[E2E] 步驟 2: 檢查 Queue 狀態
  ✓ 任務已進入 Queue
  ✓ 位置: 1/5

[E2E] 步驟 3: 等待處理（最多 30 秒）
  ⏳ 等待中... (5s)
  ⏳ 等待中... (10s)
  ✓ 任務已完成

[E2E] 步驟 4: 驗證結果儲存
  ✓ 結果已保存到 KV
  ✓ 結構分: 75
  ✓ 策略分: 68

[E2E] 步驟 5: 驗證 Email 通知
  ✓ Email 已寄出
  ✓ 收件人: test@example.com
  ✓ 主旨: ✨ 您的內容分析結果已準備好

[E2E] 步驟 6: 驗證結果查詢
  ✓ 可透過 /api/results/task_1731098400000_abc123xyz 查詢
  ✓ 回應時間: 145ms

✅ E2E 測試通過！
```

### 常見問題排查

| 問題 | 原因 | 解決方案 |
|------|------|--------|
| Queue 超時 | 分析耗時過長 | 檢查 Gemini API 配額；增加超時時間 |
| Email 未寄出 | Resend API 配額不足 | 檢查 RESEND_API_KEY；確認配額 |
| 結果查詢 404 | KV 儲存失敗 | 檢查 KV binding；驗證 taskId 格式 |

---

## 📊 成本與容量監控

### 監控指標

#### 1. Gemini API 成本
```
每次分析成本 = (輸入 token 數 × 輸入價格) + (輸出 token 數 × 輸出價格)

Gemini 2.0 Flash 定價（2025-11）：
- 輸入：$0.075 / 百萬 token
- 輸出：$0.30 / 百萬 token
```

#### 2. 回應時間
```
目標：< 10 秒（同步）/ < 60 秒（非同步）

監控項目：
- 平均回應時間
- P95 回應時間（95% 請求在此時間內完成）
- P99 回應時間
```

#### 3. 錯誤率
```
目標：< 1%

監控項目：
- API 錯誤率（429, 500 等）
- JSON 解析失敗率
- 超時率
```

### 收集監控數據

#### 方式 1：本地開發環境
```bash
# 執行 1000 次分析並收集數據
npm run benchmark:local
```

#### 方式 2：生產環境
在 `functions/api/[[path]].js` 中添加監控代碼：

```javascript
// 記錄分析時間
const startTime = Date.now()
const result = await analyzeWithGemini(...)
const duration = Date.now() - startTime

// 記錄 token 使用量
const inputTokens = result.usage?.prompt_tokens || 0
const outputTokens = result.usage?.completion_tokens || 0

// 發送到監控系統
await logMetrics({
  timestamp: new Date().toISOString(),
  duration,
  inputTokens,
  outputTokens,
  cost: (inputTokens * 0.075 + outputTokens * 0.30) / 1000000,
  status: 'success'
})
```

### 監控報告範本

```json
{
  "period": "2025-11-09 至 2025-11-15",
  "totalRequests": 1250,
  "successRate": 99.2,
  "metrics": {
    "gemini": {
      "avgResponseTime": 3.5,
      "p95ResponseTime": 8.2,
      "p99ResponseTime": 12.1,
      "totalTokens": 2500000,
      "totalCost": 18.75,
      "costPerRequest": 0.015
    },
    "errors": {
      "rate": 0.8,
      "breakdown": {
        "timeout": 5,
        "jsonParseError": 3,
        "apiError": 2
      }
    }
  },
  "recommendations": [
    "回應時間穩定，無需優化",
    "成本在預期範圍內",
    "建議增加錯誤重試機制"
  ]
}
```

---

## 🚀 持續監控清單

### 每日檢查
- [ ] 錯誤率是否 < 1%
- [ ] 平均回應時間是否 < 10 秒
- [ ] Gemini API 配額是否充足

### 每週檢查
- [ ] 執行黃金測試集（確保穩定性）
- [ ] 檢查成本趨勢
- [ ] 分析常見錯誤模式

### 每月檢查
- [ ] 執行完整 E2E 測試
- [ ] 生成成本與容量報告
- [ ] 評估是否需要調整模型或提示詞

---

## 📈 性能優化建議

### 降低成本
1. **減少 token 使用**：
   - 縮短提示詞
   - 使用更精確的關鍵詞提取

2. **批量處理**：
   - 合併多個分析請求
   - 使用 Cloudflare Queue 進行非同步處理

### 加快回應
1. **並行處理**：
   - 同時計算結構分與策略分
   - 使用 Promise.all()

2. **快取結果**：
   - 快取相同內容的分析結果
   - 使用 Cloudflare KV 進行短期快取

### 提升穩定性
1. **增加重試機制**：
   - 指數退避重試
   - 備援 API（OpenAI）

2. **監控告警**：
   - 錯誤率 > 2% 時告警
   - 回應時間 > 15 秒時告警

---

**最後更新**：2025-11-09  
**版本**：v5.0
