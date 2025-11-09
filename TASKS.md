# ✅ 開發任務追蹤

## 2025-11-09 v5 自適應混合評分導入

### 1. 後端：AI 策略分（60%）
- [x] 實作 `extractKeyPassages`，輸出首段、末段與含經驗/佐證訊號的段落
- [x] 重寫 `buildAnalysisPrompt`，改為 WHY / HOW / WHAT 策略師提示並移除舊訊號指令
- [ ] 更新 `analyzeWithGemini` 以採用新提示、驗證輸出 JSON 並強化錯誤處理
- [ ] 建立 Gemini 回應記錄與重試機制，確保延遲或配額錯誤時的 fallback 策略

### 2. 後端：結構分（40%）
- [x] 支援 `contentFormatHint`，自動辨識 HTML 與純文字來源（Worker / Functions 同步）
- [x] 改寫 `computeContentSignals`，移除 Schema/Meta 檢查並僅保留內容向訊號
- [x] 建立 Mode A（HTML）內容訊號計算：H1/H2、清單、表格、作者/日期文字等
- [x] 建立 Mode B（Plain Text）內容訊號計算：字數、長段落、佐證、經驗、年份等
- [x] 整合 `structure-score.js` 到主分析流程，計算 40% 結構分

### 3. 前端：呈現與建議
- [x] 建立 `V5ResultsDashboard.jsx`，顯示結構分（40%）與策略分（60%）以及各自子指標
- [x] 建立 `AsyncAnalysisFlow.jsx`，收集 Email 並提交非同步任務
- [x] 建立 `ResultsPage.jsx`，完整結果查詢與展示
- [x] 新增結構分與策略分展開式說明 UI，補足 WHY / HOW / WHAT 文案
- [x] 整合到主應用路由，優先使用 v5Scores（ResultsDashboard 已支援）
- [x] 更新相關文案與教學，強調「策略說服力 + 結構健全」的價值主張
  - [x] 撰寫 `docs/V5_SCORING_GUIDE.md` - 完整評分模型指南
  - [x] 撰寫 `docs/TESTING_AND_MONITORING.md` - 測試與監控指南

### 4. 測試與品質驗證
- [x] 建立 3 篇黃金測試集（golden-test-set.json），用於 WHY / HOW / WHAT 分數穩定度迴歸
- [x] 建立 `run-golden-tests.js` 測試執行腳本，驗證穩定性
- [x] 建立 `e2e-async-flow.js` 端到端非同步流程測試
- [ ] 執行黃金測試集並記錄結果，確保穩定性達標（標準差 < 1.5）
- [ ] 執行 E2E 測試並驗證完整流程
- [ ] 記錄 Gemini 成本與延遲數據，完成壓力測試與容量評估報告

### 5. 文件與對外溝通
- [x] 撰寫 v5 模型變更 Changelog（V5_CHANGELOG.md）
- [x] 建立使用指南（V5_USAGE_GUIDE.md），含 FAQ 與最佳實踐
- [x] 建立部署檢查清單（V5_DEPLOYMENT_CHECKLIST.md）
- [x] 建立前端整合指南（V5_INTEGRATION_GUIDE.md）
- [x] 撰寫實作總結（V5_IMPLEMENTATION_SUMMARY.md）
- [x] 新增 `docs/V5_SCORING_GUIDE.md`，詳細說明結構分與策略分
- [x] 新增 `docs/TESTING_AND_MONITORING.md`，含測試執行與監控指南
- [ ] 更新 `docs/product/HCU_EEAT_AEO_Scoring_Guide.md`，納入 Mode A / Mode B 與 WHY / HOW / WHAT 說明

### 6. 非同步通知與結果交付
- [x] 設計與實作任務排程：改用 Durable Objects SQLite（免費方案支援）
- [x] 建立 AnalysisQueue Durable Object 類別，實現隊列管理
- [x] 建立 Email 通知服務，使用 Resend 寄送結果連結
- [x] 實作結果檢視端點（results/[taskId].js），讓使用者透過信中連結查詢
- [x] 建立 Email 模板（email-template.js）與結果頁面樣式
- [x] 擴充 Email 模板，加入優先待辦清單區塊
- [x] 部署到 Cloudflare Workers（已成功部署）
- [ ] 整合錯誤追蹤與使用者重試流程，包含配額不足與分析失敗情境

### 7. 預發布與部署準備
- [ ] 執行黃金測試集驗證穩定性（標準差 < 1.5）
- [ ] 執行 E2E 測試驗證完整流程
- [ ] 收集 Gemini 成本與延遲數據（1 週監控）
- [ ] 預發布環境部署與測試
- [ ] 生產環境部署
- [ ] 監控初期運行與優化
