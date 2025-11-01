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
- [ ] 將評分結果對應建議自動化（API / 報表格式 + 缺口對應行動模組）
- [ ] 建立評分指標追蹤面板（儀表板框架、更新節奏、自動匯出流程）
