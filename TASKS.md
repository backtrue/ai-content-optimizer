# ✅ 開發任務追蹤

## 2025-11-09 v5 自適應混合評分導入

### 1. 後端：AI 策略分（60%）
- [ ] 實作 `extractKeyPassages`，輸出首段、末段與含經驗/佐證訊號的段落
- [ ] 重寫 `buildAnalysisPrompt`，改為 WHY / HOW / WHAT 策略師提示並移除舊訊號指令
- [ ] 更新 `analyzeWithGemini` 以採用新提示、驗證輸出 JSON 並強化錯誤處理
- [ ] 建立 Gemini 回應記錄與重試機制，確保延遲或配額錯誤時的 fallback 策略

### 2. 後端：結構分（40%）
- [ ] 支援 `contentFormatHint`，自動辨識 HTML 與純文字來源（Worker / Functions 同步）
- [ ] 改寫 `computeContentSignals`，移除 Schema/Meta 檢查並僅保留內容向訊號
- [ ] 建立 Mode A（HTML）內容訊號計算：H1/H2、清單、表格、作者/日期文字等
- [ ] 建立 Mode B（Plain Text）內容訊號計算：字數、長段落、佐證、經驗、年份等
- [ ] 更新 `scoring-model.js`，實作雙模式 40% 結構分與策略分整合的權重配置

### 3. 前端：呈現與建議
- [ ] 更新 `ResultsDashboard`，顯示結構分（40%）與策略分（60%）以及各自子指標
- [ ] 調整 `Recommendations.jsx`，輸出結構建議與策略建議雙軌內容
- [ ] 更新輸入流程：收集 Email、顯示非同步分析提示並引導使用者查看通知信
- [ ] 更新相關文案與教學，強調「策略說服力 + 結構健全」的價值主張

### 4. 測試與品質驗證
- [ ] 建立 10 篇黃金測試集，用於 WHY / HOW / WHAT 分數穩定度迴歸
- [ ] 新增純文字與 HTML 雙模式回歸測試腳本，驗證結構/策略分與建議一致性
- [ ] 記錄 Gemini 成本與延遲數據，完成壓力測試與容量評估報告
- [ ] 覆蓋非同步流程 E2E 測試：提交 → 排程 → Email → 結果頁檢視

### 5. 文件與對外溝通
- [ ] 更新 `docs/product/HCU_EEAT_AEO_Scoring_Guide.md`，納入 Mode A / Mode B 與 WHY / HOW / WHAT 說明
- [ ] 撰寫 v5 模型變更 Changelog 與落地紀錄
- [ ] 更新部署與使用指南（含 Cloudflare Worker / 前端），說明雙軌評分流程與操作步驟
- [ ] 新增非同步分析與 Email 通知使用指南（含 FAQ 與成本說明）

### 6. 非同步通知與結果交付
- [ ] 設計與實作任務排程：提交後排入背景分析、狀態持久化
- [ ] 建立 Email 通知服務，寄送含分析結果連結與摘要的信件
- [ ] 實作結果檢視端點／頁面，讓使用者透過信中連結追蹤進度與最終建議
- [ ] 整合錯誤追蹤與使用者重試流程，包含配額不足與分析失敗情境
