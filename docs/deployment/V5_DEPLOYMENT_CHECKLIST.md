# v5 部署檢查清單

## 環境準備

### Cloudflare 配置
- [ ] 確認 `wrangler.toml` 已配置 KV Namespace
  - [ ] `ANALYSIS_RESULTS` KV binding
  - [ ] 預覽環境 ID 已設定
  - [ ] 生產環境 ID 已設定

- [ ] 確認 Queues 配置
  - [ ] `analysis-queue` 已建立
  - [ ] 消費者配置正確（max_batch_size=10）
  - [ ] 死信隊列已設定

- [ ] 環境變數已設定
  - [ ] `GEMINI_API_KEY` - Gemini API 金鑰
  - [ ] `RESEND_API_KEY` - Resend Email API 金鑰
  - [ ] `SITE_URL` - 結果查詢頁面 URL

### 本地開發環境
- [ ] Node.js 版本 >= 18
- [ ] Wrangler CLI 已安裝 (`npm install -g wrangler`)
- [ ] 依賴已安裝 (`npm install`)

## 代碼檢查

### 後端
- [ ] `[[path]].js` 已匯入 `calculateStructureScore`
- [ ] `computeContentSignals` 支援 `contentFormatHint` 參數
- [ ] `buildAnalysisPrompt` 已改為 WHY/HOW/WHAT 框架
- [ ] `queue-handler.js` 已實作
- [ ] `results/[taskId].js` 端點已建立
- [ ] `structure-score.js` 已實作

### 前端
- [ ] `AsyncAnalysisFlow.jsx` 已建立
- [ ] `V5ResultsDashboard.jsx` 已建立
- [ ] 主應用已整合新組件
- [ ] 舊儀表板已移除或隱藏

### 測試
- [ ] `golden-test-set.json` 已建立
- [ ] `run-golden-tests.js` 已建立

## 功能驗證

### 本地測試
- [ ] 執行 `npm run dev` 啟動本地 Worker
- [ ] 測試純文字分析
  ```bash
  curl -X POST http://localhost:8787/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"content":"test content","targetKeywords":["test"],"contentFormatHint":"plain"}'
  ```

- [ ] 測試 HTML 分析
  ```bash
  curl -X POST http://localhost:8787/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"content":"<h1>Test</h1><p>content</p>","targetKeywords":["test"],"contentFormatHint":"html"}'
  ```

- [ ] 驗證 v5Scores 在回應中
- [ ] 驗證結構分與策略分計算正確

### 黃金測試集
- [ ] 執行 `node tests/run-golden-tests.js`
- [ ] 驗證所有測試用例通過
- [ ] 檢查穩定性報告（標準差 < 1.5）

### 非同步流程
- [ ] 測試 Email 提交
- [ ] 驗證任務進入 Queue
- [ ] 檢查 KV 中的結果儲存
- [ ] 測試結果查詢端點
- [ ] 驗證 Email 通知寄送

## 部署前檢查

### 代碼品質
- [ ] 無 console.error 或 console.warn（除了日誌）
- [ ] 無硬編碼的 API Key
- [ ] 無未使用的導入或變數
- [ ] 代碼風格一致

### 安全性
- [ ] 敏感資訊已從代碼中移除
- [ ] 環境變數已正確設定
- [ ] CORS 設定正確
- [ ] 無 SQL 注入或 XSS 風險

### 效能
- [ ] 結構分計算 < 100ms
- [ ] 策略分計算 < 3 秒
- [ ] 無記憶體洩漏
- [ ] KV 查詢 < 100ms

## 部署步驟

### 預發布環境
```bash
# 1. 部署到預發布
wrangler deploy --env preview

# 2. 測試預發布環境
curl https://preview.content-optimizer.workers.dev/api/analyze

# 3. 驗證 KV 和 Queue
wrangler kv:key list --binding=ANALYSIS_RESULTS --env preview
```

### 生產環境
```bash
# 1. 最終檢查
npm run test

# 2. 部署到生產
wrangler deploy --env production

# 3. 驗證生產環境
curl https://content-optimizer.workers.dev/api/analyze

# 4. 監控日誌
wrangler tail --env production
```

## 部署後驗證

### 功能驗證
- [ ] 分析端點正常運作
- [ ] Email 通知正常寄送
- [ ] 結果查詢端點正常
- [ ] 黃金測試集通過

### 監控
- [ ] 檢查 Cloudflare 儀表板
  - [ ] Worker 請求數正常
  - [ ] 錯誤率 < 1%
  - [ ] CPU 時間正常

- [ ] 檢查 Queue 狀態
  - [ ] 任務正常處理
  - [ ] 無死信隊列堆積

- [ ] 檢查 KV 使用量
  - [ ] 儲存空間正常
  - [ ] 無過期資料堆積

### 用戶反饋
- [ ] 收集初期用戶反饋
- [ ] 監控錯誤報告
- [ ] 追蹤性能指標

## 回滾計畫

如果部署出現問題：

```bash
# 1. 立即回滾到上一版本
git revert HEAD

# 2. 重新部署
wrangler deploy --env production

# 3. 通知用戶
# 發送公告說明服務恢復
```

## 文檔更新

- [ ] 更新 README.md 中的 v5 說明
- [ ] 發布 V5_CHANGELOG.md
- [ ] 發布 V5_USAGE_GUIDE.md
- [ ] 更新 API 文檔
- [ ] 通知用戶新功能

## 後續優化

部署後的優化項目：

- [ ] 監控 Gemini API 成本
- [ ] 優化 Prompt 以降低成本
- [ ] 收集用戶反饋
- [ ] 改進 WHY/HOW/WHAT 框架
- [ ] 新增支援的內容類型

## 聯絡方式

部署期間的聯絡：
- **技術支援**：tech-support@content-optimizer.ai
- **緊急回滾**：ops-team@content-optimizer.ai
- **用戶溝通**：support@content-optimizer.ai
