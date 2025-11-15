# 系統評分自動優化流程

## 📋 概述

本文檔詳細說明系統如何自動收集用戶分析的關鍵字、SERP 排名數據，並持續優化評分模型的完整流程。

---

## 🔄 完整流程圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          用戶分析流程（前端）                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. 用戶輸入內容 + 目標關鍵字                                                │
│     ↓                                                                        │
│  2. 前端調用 /api/analyze 或 /api/analyze-worker                            │
│     ↓                                                                        │
│  3. 系統返回評分結果 (SEO/AEO 指標)                                         │
│     ↓                                                                        │
│  4. 關鍵字 + 評分數據自動記錄到 KEYWORD_ANALYTICS KV                       │
│     ↓                                                                        │
│  5. 數據同步到 Google Sheet (training_data)                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    自動化 Pipeline 流程（每週執行）                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ 週一 02:00 UTC ─────────────────────────────────────────────────────┐  │
│  │ 階段 1：關鍵字匯出                                                    │  │
│  │  - 從 KEYWORD_ANALYTICS KV 讀取用戶分析的關鍵字                    │  │
│  │  - 匯出為 JSON 格式                                                 │  │
│  │  - 上傳至 R2 bucket (keyword-exports)                              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                       │
│  ┌─ 週一 02:30 UTC ─────────────────────────────────────────────────────┐  │
│  │ 階段 2：SERP 蒐集                                                    │  │
│  │  - 讀取 R2 中的關鍵字列表                                           │  │
│  │  - 調用 SerpAPI/ValueSERP/ZenSERP 獲取排名數據                     │  │
│  │  - 對每個 URL 調用 /api/analyze 獲取內容特徵                       │  │
│  │  - 結果保存到 Google Sheet (training_data)                         │  │
│  │  - 批次結果上傳至 R2 (serp-results/)                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                       │
│  ┌─ 週二 03:00 UTC ─────────────────────────────────────────────────────┐  │
│  │ 階段 3：模型訓練與部署                                               │  │
│  │  - 從 Google Sheet 讀取所有訓練數據                                │  │
│  │  - 特徵工程：提取 50+ 個內容特徵                                    │  │
│  │  - XGBoost 模型訓練                                                │  │
│  │  - 模型評估（準確率、F1 分數等）                                    │  │
│  │  - 轉換為 JavaScript 格式                                          │  │
│  │  - 部署到 scoring-model.js                                         │  │
│  │  - 更新 KV 中的模型版本                                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                       │
│  ┌─ 週二 03:30 UTC ─────────────────────────────────────────────────────┐  │
│  │ 階段 4：成本摘要與報告                                               │  │
│  │  - 計算本週 API 成本                                                │  │
│  │  - 生成性能指標                                                     │  │
│  │  - 發送 Slack 通知                                                 │  │
│  │  - 存檔報告至 R2                                                   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 數據流詳解

### 1️⃣ 用戶分析數據收集

#### 前端收集點
```
src/pages/AnalysisPage.jsx
  ↓
  用戶輸入：
  - content (內容)
  - targetKeywords (目標關鍵字)
  - contentFormatHint (格式提示)
  ↓
  調用 /api/analyze
  ↓
  返回結果：
  {
    seo: { 17 個 SEO 指標 },
    aeo: { 17 個 AEO 指標 },
    recommendations: [ ... ]
  }
```

#### 數據記錄流程
```
functions/api/[[path]].js
  ↓
  logKeywordAnalytics() 函數
  ↓
  記錄到 KEYWORD_ANALYTICS KV：
  {
    kw:{keyword}:{timestamp}: {
      keyword: string,
      locale: string,
      sessionId: string,
      hasEmail: boolean,
      mode: 'sync' | 'async',
      contentLength: number,
      timestamp: ISO8601
    }
  }
```

#### 同步到 Google Sheet
```
ml/serp_collection.py
  ↓
  persist_progress() 函數
  ↓
  sheets_writer.append_record()
  ↓
  Google Sheet (training_data)：
  [url, keyword, serp_rank, target_score, title, feature1, feature2, ...]
```

---

### 2️⃣ 關鍵字匯出（週一 02:00）

#### 觸發方式
```
Cloudflare Cron: 0 2 * * 1 (週一 02:00 UTC)
  ↓
  functions/api/cron-handler.js
  ↓
  handleKeywordExportCron()
```

#### 執行流程
```
Pipeline Scheduler (Durable Object)
  ↓
  executeKeywordExport()
  ↓
  1. 從 KEYWORD_ANALYTICS KV 讀取所有關鍵字
  2. 去重並排序
  3. 轉換為 JSON 格式
  4. 上傳至 R2: keyword-exports/{date}/keywords.json
  ↓
  返回結果：
  {
    count: number,
    filename: string,
    r2Key: string,
    exportedAt: ISO8601
  }
```

#### 關鍵字來源
```
KEYWORD_ANALYTICS KV 中的所有 kw:* 鍵
  ↓
  提取 keyword 字段
  ↓
  去重 + 排序
  ↓
  預設上限：200 個關鍵字（可配置）
```

---

### 3️⃣ SERP 蒐集（週一 02:30）

#### 觸發方式
```
Cloudflare Cron: 30 2 * * 1 (週一 02:30 UTC)
  ↓
  functions/api/cron-handler.js
  ↓
  handleSerpCollectionCron()
```

#### 執行流程
```
SERP Collection Scheduler (Durable Object)
  ↓
  startCollection()
  ↓
  1. 讀取 R2 中的關鍵字列表
  2. 批次分割（預設 10 個/批）
  3. 對每個批次執行：
     a. 調用 SerpAPI/ValueSERP/ZenSERP
     b. 獲取排名結果（前 10 個 URL）
     c. 對每個 URL 調用 /api/analyze
     d. 記錄結果到 Google Sheet
     e. 上傳批次結果至 R2
```

#### 數據結構
```
Google Sheet (training_data) 新增行：
{
  url: string,
  keyword: string,
  serp_rank: number (1-10),
  target_score: number (0-100),
  title: string,
  feature_1: number,
  feature_2: number,
  ...
  feature_50+: number
}

R2 存儲 (serp-results/{date}/batch-{index}.json)：
{
  batchIndex: number,
  recordCount: number,
  records: [
    {
      keyword: string,
      url: string,
      title: string,
      rank: number,
      timestamp: ISO8601,
      analysis: { ... }
    }
  ],
  uploadedAt: ISO8601
}
```

#### 特徵提取
```
/api/analyze 返回的特徵：
- contentSignals: {
    wordCount,
    paragraphCount,
    hcuYesRatio,
    hcuPartialRatio,
    hcuNoRatio,
    titleIntentMatch,
    firstParagraphAnswerQuality,
    qaFormatScore,
    topicCohesion,
    semanticParagraphFocus,
    ... (50+ 個特徵)
  }
```

---

### 4️⃣ 模型訓練與部署（週二 03:00）

#### 觸發方式
```
Cloudflare Cron: 0 3 * * 2 (週二 03:00 UTC)
  ↓
  functions/api/cron-handler.js
  ↓
  handleModelTrainingCron()
```

#### 執行流程
```
Model Deployment Scheduler (Durable Object)
  ↓
  executeModelTraining()
  ↓
  ml/train_model_cli.py
  ↓
  1. 從 Google Sheet 讀取所有訓練數據
  2. 數據清理 + 特徵工程
  3. 訓練/測試集分割 (80/20)
  4. XGBoost 模型訓練
  5. 模型評估
  6. 轉換為 JavaScript 格式
  7. 更新 functions/api/scoring-model.js
  8. 部署到 KV
```

#### 模型配置
```
XGBoost 參數：
- n_estimators: 100
- max_depth: 6
- learning_rate: 0.1
- subsample: 0.8
- colsample_bytree: 0.8

評估指標：
- 準確率 (Accuracy)
- F1 分數
- ROC-AUC
- 特徵重要性排名
```

#### 模型版本管理
```
KV 存儲 (model:config)：
{
  version: "2025-11-15-v2",
  trainedAt: ISO8601,
  trainingDataCount: number,
  accuracy: number,
  f1Score: number,
  features: [
    { name: string, importance: number },
    ...
  ],
  metrics: { ... }
}

scoring-model.js 更新：
- 新增 DEFAULT_MODEL 版本
- 更新所有特徵計算邏輯
- 更新權重配置
```

---

### 5️⃣ 成本摘要與報告（週二 03:30）

#### 觸發方式
```
Cloudflare Cron: 30 3 * * 2 (週二 03:30 UTC)
  ↓
  functions/api/cron-handler.js
  ↓
  handleCostSummaryAndReporting()
```

#### 執行流程
```
Reporting Scheduler (Durable Object)
  ↓
  1. 計算本週成本
  2. 生成性能指標
  3. 發送 Slack 通知
  4. 存檔報告至 R2
```

#### 成本計算
```
ml/cost_tracker.py
  ↓
  計算項目：
  - SerpAPI 成本
  - ValueSERP 成本
  - ZenSERP 成本
  - Gemini API 成本
  - Cloudflare Worker 成本
  - R2 存儲成本
  ↓
  輸出格式：
  {
    date: ISO8601,
    services: {
      serpapi: { calls: number, cost: number },
      valueserp: { calls: number, cost: number },
      zenserp: { calls: number, cost: number },
      gemini: { calls: number, cost: number },
      cloudflare: { calls: number, cost: number },
      r2: { storage: number, cost: number }
    },
    totalCost: number,
    recordsCollected: number,
    avgCostPerRecord: number
  }
```

#### 報告內容
```
Slack 通知：
✅ 本週 SERP 蒐集完成
- 收集關鍵字數：200
- 收集 URL 數：2000
- 成功率：98%
- 總成本：$12.50
- 平均成本/記錄：$0.006

📊 模型訓練完成
- 訓練數據：2000 筆
- 準確率：92.5%
- F1 分數：0.91
- 新模型版本：2025-11-15-v2

R2 存檔：
- reports/{date}/weekly-report.json
- reports/{date}/cost-summary.json
```

---

## 🔧 系統組件

### 核心 Durable Objects

#### 1. PipelineScheduler
```
位置: functions/api/pipeline-scheduler.js
職責:
- 管理整個 Pipeline 的狀態機
- 協調各個階段的執行
- 失敗重試機制
- 健康檢查

API 端點:
- GET /pipeline/status - 取得狀態
- GET /pipeline/health - 健康檢查
- POST /pipeline/start - 啟動
- POST /pipeline/cancel - 取消
- POST /pipeline/retry/:phase - 重試階段
```

#### 2. SerpCollectionScheduler
```
位置: functions/api/serp-collection-scheduler.js
職責:
- 管理 SERP 蒐集任務
- 批次處理
- 進度追蹤
- R2 上傳

API 端點:
- GET /serp-collection/status - 取得狀態
- POST /serp-collection/start - 啟動蒐集
- POST /serp-collection/cancel - 取消蒐集
```

#### 3. ModelDeploymentScheduler
```
位置: functions/api/model-deployment-scheduler.js
職責:
- 管理模型訓練任務
- 模型版本管理
- KV 部署

API 端點:
- GET /model-deployment/status - 取得狀態
- POST /model-deployment/start - 啟動訓練
```

#### 4. ReportingScheduler
```
位置: functions/api/reporting-scheduler.js
職責:
- 生成成本報告
- Slack 通知
- 報告存檔

API 端點:
- POST /reporting/daily - 每日報告
- POST /reporting/weekly - 週報
```

### 存儲系統

#### KV Namespace
```
KEYWORD_ANALYTICS:
- kw:{keyword}:{timestamp}: 用戶分析記錄
- model:config: 當前模型配置
- model:version: 模型版本號

ANALYSIS_RESULTS:
- analysis:{taskId}: 非同步分析結果
```

#### R2 Bucket
```
keyword-exports/{date}/keywords.json - 匯出的關鍵字
serp-results/{date}/batch-{index}.json - SERP 蒐集結果
reports/{date}/weekly-report.json - 週報
reports/{date}/cost-summary.json - 成本摘要
models/{version}/model.json - 模型配置
```

#### Google Sheet
```
Sheet ID: 1TFi2lUHtlft4XuJBxTlnvi9Svd_9pXDVOLttCDB248Y
Tab 1: training_data
- 列: [url, keyword, serp_rank, target_score, title, feature1, feature2, ...]
- 用途: 訓練數據存儲

Tab 2: collection_progress
- 列: [keyword, processed_at]
- 用途: 蒐集進度追蹤
```

---

## 📈 數據流量估算

### 每週數據量
```
用戶分析：
- 日均分析次數：50-100
- 週均分析次數：350-700
- 每次分析涉及關鍵字：1-5 個
- 週均新增關鍵字：100-200 個

SERP 蒐集：
- 關鍵字數：200 個
- 每個關鍵字 URL 數：10 個
- 總 URL 數：2000 個
- 新增訓練數據：2000 筆

模型訓練：
- 訓練數據總量：2000+ 筆
- 特徵數：50+
- 模型大小：~50KB (JavaScript)
```

### 成本估算（每月）
```
SerpAPI: $0.50-1.00
ValueSERP: $0.20-0.50
ZenSERP: $0.20-0.50
Gemini API: $10-20
Cloudflare Worker: $0 (免費層)
Durable Objects: $0.15
R2 存儲: $0.50
KV 存儲: $0.50
Google Sheets: 免費
─────────────────────
總計: $12-23/月
```

---

## 🚀 部署檢查清單

### 前置條件
- [ ] Cloudflare Worker 環境配置
- [ ] R2 bucket 已建立
- [ ] KV namespace 已綁定
- [ ] Google Sheet 已建立
- [ ] SerpAPI/ValueSERP/ZenSERP API Key 已配置
- [ ] Gemini API Key 已配置
- [ ] Slack Webhook URL 已配置（可選）

### 部署步驟
- [ ] 部署 Worker 代碼
- [ ] 配置 Cron 觸發
- [ ] 測試 Pipeline 狀態機
- [ ] 測試 SERP 蒐集
- [ ] 測試模型訓練
- [ ] 驗證 Google Sheet 同步
- [ ] 驗證 R2 上傳
- [ ] 驗證 Slack 通知

### 監控指標
- [ ] Pipeline 執行時間
- [ ] SERP 蒐集成功率
- [ ] 模型訓練準確率
- [ ] API 成本
- [ ] 存儲使用量
- [ ] 錯誤率

---

## 📝 配置示例

### wrangler.toml
```toml
[[env.production.crons]]
crons = ["0 2 * * 1"]  # 週一 02:00
handler = "cron-handler"

[[env.production.crons]]
crons = ["30 2 * * 1"]  # 週一 02:30
handler = "cron-handler"

[[env.production.crons]]
crons = ["0 3 * * 2"]  # 週二 03:00
handler = "cron-handler"

[[env.production.crons]]
crons = ["30 3 * * 2"]  # 週二 03:30
handler = "cron-handler"

[[durable_objects.bindings]]
name = "PIPELINE_SCHEDULER"
class_name = "PipelineScheduler"

[[durable_objects.bindings]]
name = "SERP_COLLECTION_SCHEDULER"
class_name = "SerpCollectionScheduler"

[[durable_objects.bindings]]
name = "MODEL_DEPLOYMENT_SCHEDULER"
class_name = "ModelDeploymentScheduler"

[[durable_objects.bindings]]
name = "REPORTING_SCHEDULER"
class_name = "ReportingScheduler"
```

### .env 配置
```bash
# Google Sheets
SHEETS_TRAINING_DATA_ID=1TFi2lUHtlft4XuJBxTlnvi9Svd_9pXDVOLttCDB248Y
SHEETS_TRAINING_DATA_TAB=training_data
SHEETS_PROGRESS_TAB=collection_progress
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# SERP APIs
SERPAPI_KEY=your_key
VALUESERP_KEY=your_key
ZENSERP_KEY=your_key

# Gemini
GEMINI_API_KEY=your_key

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Model Training
MODEL_TRAINING_API_URL=http://localhost:8000/train
```

---

## 🔍 故障排除

### 常見問題

#### 1. SERP 蒐集失敗
```
症狀: SERP 蒐集階段超時或返回錯誤
原因: 
- API 配額超限
- 網路連接問題
- 分析 API 故障

解決:
1. 檢查 API 配額
2. 查看 Worker 日誌
3. 重試失敗的階段
```

#### 2. 模型訓練失敗
```
症狀: 模型訓練無法完成
原因:
- 訓練數據不足
- 特徵缺失
- 記憶體不足

解決:
1. 檢查 Google Sheet 數據
2. 驗證特徵提取
3. 增加訓練數據
```

#### 3. Google Sheet 同步失敗
```
症狀: 數據未同步到 Google Sheet
原因:
- 認證失敗
- 配額限制
- Sheet 格式錯誤

解決:
1. 驗證 credentials.json
2. 檢查 Sheet ID
3. 查看 Sheets API 配額
```

---

## 📚 相關文檔

- `PIPELINE_AUTOMATION.md` - Pipeline 整體架構
- `SERP_COLLECTION_BATCH.md` - SERP 蒐集詳細指南
- `MODEL_TRAINING_DEPLOYMENT.md` - 模型訓練詳細指南
- `MONITORING_COST_TRACKING.md` - 監控與成本追蹤
- `PIPELINE_INTEGRATION_QA.md` - 集成與 QA

---

## 🎯 下一步

1. **驗證系統運行**
   - 測試各個 Pipeline 階段
   - 驗證數據流
   - 監控成本

2. **優化模型**
   - 收集更多訓練數據
   - 調整特徵工程
   - 優化超參數

3. **擴展功能**
   - 支援更多語言
   - 多模型集成
   - A/B 測試

4. **監控與告警**
   - 設置性能告警
   - 成本監控
   - 錯誤告警
