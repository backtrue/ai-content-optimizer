# ✅ 開發任務追蹤

## 2025-11-01 戰略任務列表

### 1. 評分架構與準則
- [x] 梳理 HCU / EEAT / AEO 準則，整理對應特徵與資料需求（已記錄於 `docs/product/HCU_EEAT_AEO_Scoring_Guide.md`）
- [x] 定義評分類別與權重（含總分計算方式）
- [x] 規範資料品質檢查流程（缺失值、異常值、類型）

### 2. MVP 模型與分析流程
- [x] 建立資料前處理腳本（清理、特徵工程、訓練/驗證切分）（`ml/prepare_dataset.py` 已輸出 `ml/training_prepared.csv`）
- [x] 訓練 baseline 模型並輸出 HCU/EEAT/AEO/總分（`ml/train_baseline.py` 採多目標訓練，輸出模型與摘要）
- [x] 建立模型評估指標與報告（`ml/reports/baseline_training_report.md` 與 `ml/model_training_summary.json`）
- [x] 建立人工驗證清單（`ml/manual_validation_samples.json` 抽樣 40 筆供人工比對）

### 3. 產出與工作流程整合
- [x] 設計評分輸出格式（報表、API 或 Sheets）與說明文件（`ml/reports/baseline_training_report.md`、`ml/model_training_summary.json`）
- [x] 建立優化建議生成規則（`docs/product/HCU_EEAT_AEO_Scoring_Guide.md` 補充缺口對應行動）
- [x] 規劃評分更新節奏與責任分工（`docs/product/Scoring_System_Roadmap.md` 規劃例行維運）
- [x] 設計指標追蹤面板（`docs/product/Scoring_System_Roadmap.md` 中描述指標板需求）

### 4. 長期資料與策略維護
- [x] 安排 SERP / Site 資料補抓頻率與備援機制（`docs/product/Scoring_System_Roadmap.md`）
- [x] 規劃人工標註流程，增強品牌信任與 HCU 精準度（`docs/product/Scoring_System_Roadmap.md`）
- [x] 定期檢視 Google 搜尋品質更新，調整特徵與評分架構（`docs/product/Scoring_System_Roadmap.md`）

### 5. 評分建議與追蹤優化（2025-11 後續）
- [x] 將評分結果對應建議自動化（API / 報表格式 + 缺口對應行動模組）
- [x] 建立評分指標追蹤面板（儀表板框架、更新節奏、自動匯出流程）
- [ ] 評分模型校準與訊號補強（進行中）
  - [x] 重新設計內容訊號抽取（段落統計、作者/日期/引用偵測）
  - [x] 優化 HCU 預設判斷與缺口權重
  - [ ] 驗證最新文章範例並調整模型輸出

## 2025-11-02 模型校準任務

- [x] 補齊 SERP 樣本缺失特徵欄位（entityRichnessNorm 等）
- [x] 產生以第一頁 SERP 樣本為正例的訓練資料集
- [x] 重訓模型並更新推論流程（含 API 串接）
  - [x] scoring-model.js 重構以映射 targets 結構
  - [x] 重新載入並驗證最新模型輸出
- [ ] 驗證樣本與說明文件更新

## 2025-11-02 Scoring Model Integration Session

- [x] 檢視 `ml/model_export.json` 與現行 scoring-model 結構差異
- [x] 還原 logistic 指標定義並補齊 targets 元資料
- [x] 調整 `predictSeoMetricScores` / `predictAeoMetricScores` 迭代新結構
- [x] 執行 analyze-worker 回歸測試並記錄結果
- [x] 建立 `scripts/deploy-cloudflare.sh` 一鍵部署腳本並更新文件
- [ ] 更新 scoring pipeline 文件與使用指引

## 2025-11-02 Content Signals Remediation Session

- [ ] 區分「未知」與「缺失」狀態
  - [ ] 調整 `computeContentSignals` 對缺乏 `<head>` 或 schema 的輸入，將 `hasMetaDescription`、`hasCanonical`、`hasAuthorInfo` 等改為 `unknown`
  - [ ] 在 `deriveMissingCriticalSignals` 中跳過 `unknown` 值，避免誤判為缺失
- [ ] 強化建議生成的證據驗證
  - [ ] 更新 `generateHeuristicRecommendations` 僅在 `contentSignals` / `modelContributions` 出現確切負向訊號時輸出建議
  - [ ] 為每則建議附上觸發的欄位或內容片段，並整合到 `description` 或 `evidence` 欄位
- [ ] 改善無法判斷時的 UX
  - [ ] 在 compute/guard 結果皆為 `unknown` 時回傳「缺少 HTML metadata，請提供原始頁面再檢測」
  - [ ] 調整前端 UI 顯示「偵測不到」提示，避免誤導性建議
- [ ] 補充測試與文件
  - [ ] 新增純文字輸入的回歸案例，確認不會產生錯誤建議
  - [ ] 更新相關文件記錄偵測流程與 Unknown 狀態

## 2025-11-04 Content Signals & Guard Alignment Session

- [ ] 抽出 `computeContentSignals` 公用模組供 Worker/Functions 共用
- [ ] 更新 analyze-worker 導入完整內容訊號計算
- [ ] 調整 `applyScoreGuards` 與 AEO/SEO 新指標對齊
- [ ] 進行「葉黃素推薦」案例驗證與結果記錄

## 2025-11-05 Analyze Worker 驗證 Session

- [ ] 建立本地分析流程（複製金鑰、啟動 worker、確認健康）
- [ ] 撰寫批次腳本抓取「葉黃素推薦」SERP 前十並呼叫 /api/analyze
- [ ] 匯總 SEO/AEO 分數並回報

## 2025-11-03 Content Score Simplification

### 指標重整（17 項）
- [x] HCU：Helpful Ratio 指標建置
- [x] HCU：搜尋意圖契合指標建置（`titleIntentMatch`、`firstParagraphAnswerQuality`、`qaFormatScore`）
- [x] HCU：內容覆蓋與深度指標建置（`wordCountNorm`、`topicCohesion`、`semanticParagraphFocus`）
- [x] HCU：延伸疑問與關鍵字覆蓋指標建置（`referenceKeywordNorm` 等）
- [x] HCU：行動可行性指標建置（`actionableScoreNorm`、`actionableStepCount`）
- [x] HCU：可讀性與敘事節奏指標建置（`avgSentenceLengthNorm`、`longParagraphPenalty`）
- [x] HCU：結構化重點提示指標建置（`listCount`、`tableCount`）
- [x] EEAT：作者與品牌辨識指標建置
- [x] EEAT：可信證據與引用指標建置（`evidenceCountNorm`、`externalCitationCount`）
- [x] EEAT：第一手經驗與案例指標建置（`experienceCueNorm`、`caseStudyCount`）
- [x] EEAT：敘事具體度與資訊密度指標建置（`uniqueWordRatio`、`entityRichnessNorm`）
- [x] EEAT：時效與更新訊號指標建置（`recentYearCount`、`hasVisibleDate` 文本偵測）
- [x] EEAT：專家觀點與判斷指標建置（專業語句、比較分析信號）
- [x] AEO：答案可抽取性指標建置（`paragraphExtractability`、`longParagraphPenalty`）
- [x] AEO：關鍵摘要與重點整理指標建置（首段/結尾摘要偵測）
- [x] AEO：對話式語氣與指引指標建置（`semanticNaturalness`、讀者導向語句）
- [x] AEO：讀者互動與後續引導指標建置（CTA、常見問題、行動呼籲語句）

### 系統調整
- [x] 重構 `scoring-model.js`，定義上述 17 項指標與權重，移除 HTML/Schema 依賴訊號
- [x] 調整 `deriveFallbackMetricScore`、score guard 及 `FEATURE_METRIC_OVERRIDES`，改用純內容訊號
- [x] 更新 `buildAnalysisPrompt`、`serializeContentSignals` 與示例輸出，對齊新指標
- [x] 清理 `generateModelRecommendations` 與 `FEATURE_RECOMMENDATION_MAP`，僅保留內容/信任/讀者體驗建議（無 Schema/meta）
- [x] 更新前端 `MetricsBreakdown`、`ResultsDashboard` 等顯示與文案
- [ ] 補齊 `docs/product/HCU_EEAT_AEO_Scoring_Guide.md`、`docs/aeo-geo-chagpt.md` 與 Changelog 說明
  - [ ] 重寫 `docs/product/HCU_EEAT_AEO_Scoring_Guide.md` 對應 17+4 指標
  - [ ] 更新 `docs/aeo-geo-chagpt.md` 聚焦內容訊號與說明範例
  - [ ] 統一更新變更記錄（Changelog）
- [ ] 新增純文字回歸測試樣本，驗證評分及建議僅涵蓋內容向訊號

## 2025-11-03 Recommendation Cleanup Session

- [x] 調整 `buildAnalysisPrompt` 與 `normalizeRecommendation`，限制 LLM 輸出僅聚焦內容品質建議
- [x] 在 `mergeRecommendations` 前新增黑名單過濾，移除含 Meta/Canonical/FAQ Schema 等關鍵字的建議
- [x] 清理 `generateHeuristicRecommendations`，刪除 HTML/Schema 相關 heuristics，僅保留內容訊號
- [ ] 新增建議匯出回歸測試（純文字輸入樣本），確認不再出現 HTML 設定項
- [x] 檢查前端建議分類顯示是否同步為「內容／信任／讀者體驗」（2025-11-03 完成）

## 2025-11-02 UI Input Simplification

- [x] 停用「貼上網址」流程，僅保留貼上文字模式
- [ ] 調整後端 `App.jsx` 相關呼叫與說明文字
- [ ] 更新文件說明僅支援貼上文字的使用流程
