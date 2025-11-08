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
- [ ] 整合 `structure-score.js` 到主分析流程，計算 40% 結構分

### 3. 前端：呈現與建議
- [x] 更新 `ResultsDashboard`，顯示結構分（40%）與策略分（60%）以及各自子指標
- [x] 建立 `AsyncAnalysisFlow.jsx`，收集 Email 並提交非同步任務
- [ ] 調整 `Recommendations.jsx`，輸出結構建議與策略建議雙軌內容
- [ ] 整合 `V5ResultsDashboard.jsx` 到主應用，替換舊儀表板
- [ ] 更新相關文案與教學，強調「策略說服力 + 結構健全」的價值主張

### 4. 測試與品質驗證
- [x] 建立 3 篇黃金測試集（golden-test-set.json），用於 WHY / HOW / WHAT 分數穩定度迴歸
- [x] 建立 `run-golden-tests.js` 測試執行腳本，驗證穩定性
- [ ] 執行黃金測試集並記錄結果，確保穩定性達標（標準差 < 1.5）
- [ ] 新增純文字與 HTML 雙模式回歸測試腳本，驗證結構/策略分與建議一致性
- [ ] 記錄 Gemini 成本與延遲數據，完成壓力測試與容量評估報告
- [ ] 覆蓋非同步流程 E2E 測試：提交 → 排程 → Email → 結果頁檢視

### 5. 文件與對外溝通
- [x] 撰寫 v5 模型變更 Changelog（V5_CHANGELOG.md）
- [x] 建立使用指南（V5_USAGE_GUIDE.md），含 FAQ 與最佳實踐
- [ ] 更新 `docs/product/HCU_EEAT_AEO_Scoring_Guide.md`，納入 Mode A / Mode B 與 WHY / HOW / WHAT 說明
- [ ] 更新部署與使用指南（含 Cloudflare Worker / 前端），說明雙軌評分流程與操作步驟

### 6. 非同步通知與結果交付
- [x] 設計與實作任務排程：queue-handler.js 實作提交後排入背景分析
- [x] 建立 Email 通知服務，使用 Resend 寄送結果連結
- [x] 實作結果檢視端點（results/[taskId].js），讓使用者透過信中連結查詢
- [ ] 整合錯誤追蹤與使用者重試流程，包含配額不足與分析失敗情境
- [ ] 建立 Email 模板與結果頁面樣式
