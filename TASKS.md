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
