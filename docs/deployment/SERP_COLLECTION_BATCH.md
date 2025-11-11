# SERP 蒐集批次化系統

## 概述

本模組實現了完整的 SERP 蒐集批次化系統，支援：
- 外部關鍵字輸入（JSON/CSV 檔案或 KV 存儲）
- 分批執行與進度追蹤
- 自動上傳至 R2
- 與 Pipeline Scheduler 整合

## 架構

### 核心組件

```
┌─────────────────────────────────────────────────┐
│   Pipeline Scheduler (Durable Object)           │
│   - 協調 SERP 蒐集階段                           │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  SERP Collection Scheduler (Durable Object)     │
│  - 批次管理                                      │
│  - 進度追蹤                                      │
│  - R2 上傳                                       │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
   ┌────────┐        ┌──────────┐
   │SERP API│        │分析 API  │
   └────────┘        └──────────┘
        │                 │
        ▼                 ▼
   ┌────────┐        ┌──────────┐
   │結果    │        │特徵提取  │
   └────────┘        └──────────┘
```

### 模組結構

#### 1. 本地批次蒐集腳本
- `ml/serp_collection_batch.py` - 支援外部關鍵字輸入、分批執行

#### 2. Worker Durable Object
- `functions/api/serp-collection-scheduler.js` - 批次管理與進度追蹤

#### 3. Pipeline 整合
- `functions/api/pipeline-scheduler.js` - 執行 SERP 蒐集階段
- `functions/api/cron-handler.js` - Cron 觸發 SERP 蒐集

#### 4. 配置
- `wrangler.toml` - SERP Collection Scheduler Durable Object 綁定

## 使用指南

### 1. 本地批次蒐集

#### 基本用法

```bash
# 從 JSON 檔案蒐集
python3 ml/serp_collection_batch.py \
  --keywords-file ./keywords-export/keywords-2025-11-11.json \
  --output-dir ./ml/serp-results

# 從 CSV 檔案蒐集
python3 ml/serp_collection_batch.py \
  --keywords-file ./keywords-export/keywords-2025-11-11.csv \
  --output-dir ./ml/serp-results

# 直接傳遞關鍵字 JSON
python3 ml/serp_collection_batch.py \
  --keywords-json '["iPhone 17", "Pixel 10", "Galaxy S25"]' \
  --output-dir ./ml/serp-results
```

#### 進階選項

```bash
python3 ml/serp_collection_batch.py \
  --keywords-file ./keywords.json \
  --output-dir ./ml/serp-results \
  --batch-size 20 \
  --analyze-api-url "https://api.example.com/api/analyze" \
  --keyword-delay 20 \
  --url-delay 15
```

#### 參數說明

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `--keywords-file` | - | 關鍵字檔案路徑 (JSON/CSV) |
| `--keywords-json` | - | 關鍵字 JSON 字串 |
| `--output-dir` | `./ml` | 輸出目錄 |
| `--batch-size` | 10 | 每批關鍵字數 |
| `--analyze-api-url` | `https://ragseo.thinkwithblack.com/api/analyze` | 分析 API URL |
| `--keyword-delay` | 15 | 關鍵字間隔（秒） |
| `--url-delay` | 12 | URL 間隔（秒） |

### 2. Worker API 端點

#### 啟動 SERP 蒐集

```bash
# 從 R2 關鍵字檔案蒐集
curl -X POST "https://api.example.com/serp-collection/start" \
  -H "Content-Type: application/json" \
  -d '{
    "keywordsFile": "keywords/2025-11-11/keywords-2025-11-11.json",
    "batchSize": 10,
    "analyzeApiUrl": "https://ragseo.thinkwithblack.com/api/analyze",
    "keywordDelay": 15,
    "urlDelay": 12,
    "uploadToR2": true
  }'

# 從 KV 取得關鍵字蒐集
curl -X POST "https://api.example.com/serp-collection/start" \
  -H "Content-Type: application/json" \
  -d '{
    "keywordCount": 200,
    "batchSize": 10,
    "uploadToR2": true
  }'

# 直接傳遞關鍵字
curl -X POST "https://api.example.com/serp-collection/start" \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["iPhone 17", "Pixel 10", "Galaxy S25"],
    "batchSize": 5,
    "uploadToR2": true
  }'
```

#### 查詢狀態

```bash
curl -X GET "https://api.example.com/serp-collection/status"
```

回應格式：

```json
{
  "status": "running",
  "currentBatch": 2,
  "totalBatches": 10,
  "processedKeywords": 15,
  "totalKeywords": 100,
  "recordsCollected": 150,
  "failedRecords": 0,
  "startedAt": "2025-11-11T10:30:00Z",
  "batches": [
    {
      "batchIndex": 1,
      "keywordCount": 10,
      "recordsCollected": 100,
      "failedRecords": 0,
      "r2Key": "serp-results/2025-11-11/batch-1.json",
      "completedAt": "2025-11-11T10:45:00Z"
    }
  ]
}
```

#### 取消蒐集

```bash
curl -X POST "https://api.example.com/serp-collection/cancel"
```

### 3. Pipeline 整合

#### 自動執行流程

```
關鍵字匯出 (週一 02:00)
    ↓
SERP 蒐集 (週一 02:30)
    ↓
模型訓練 (週二 03:00)
```

#### 手動觸發

```bash
# 啟動完整 Pipeline（包含 SERP 蒐集）
curl -X POST "https://api.example.com/pipeline/start" \
  -H "Content-Type: application/json" \
  -d '{
    "keywordLimit": 200,
    "serpBatchSize": 10,
    "analyzeApiUrl": "https://ragseo.thinkwithblack.com/api/analyze"
  }'

# 查詢 Pipeline 狀態
curl -X GET "https://api.example.com/pipeline/status"

# 重試 SERP 蒐集階段
curl -X POST "https://api.example.com/pipeline/retry/serp_collection"
```

## 輸出格式

### 本地輸出

#### JSON 格式

```json
{
  "batchIndex": 1,
  "recordCount": 100,
  "records": [
    {
      "keyword": "iPhone 17",
      "url": "https://example.com/iphone-17",
      "title": "iPhone 17 Pro Max Review",
      "rank": 1,
      "timestamp": "2025-11-11T10:30:00Z",
      "analysis_status": "success",
      "analysis": {
        "hcuYesRatio": 0.85,
        "helpfulRatio": 8.5,
        "intentFit": 9.0,
        ...
      }
    }
  ],
  "uploadedAt": "2025-11-11T10:45:00Z"
}
```

#### CSV 格式

```csv
keyword,url,title,rank,timestamp,analysis_status,analysis_error,...
iPhone 17,https://example.com/iphone-17,iPhone 17 Pro Max Review,1,2025-11-11T10:30:00Z,success,...
```

#### 摘要檔案

```json
{
  "status": "completed",
  "total_keywords": 100,
  "total_records": 1000,
  "processed_count": 1000,
  "failed_count": 0,
  "elapsed_seconds": 3600,
  "output_dir": "./ml",
  "completed_at": "2025-11-11T11:30:00Z"
}
```

### R2 存儲結構

```
serp-results/
├── 2025-11-11/
│   ├── batch-1.json
│   ├── batch-2.json
│   ├── batch-3.json
│   └── batch-10.json
└── 2025-11-12/
    ├── batch-1.json
    └── ...
```

## 進度追蹤

### 本地進度

```bash
# 監控本地執行進度
tail -f ml/serp_results_*.json

# 查看摘要
cat ml/batch_summary_*.json
```

### Worker 進度

```bash
# 實時監控 Worker 日誌
wrangler tail --format json | grep "SERP"

# 查詢 SERP Collection 狀態
curl -X GET "https://api.example.com/serp-collection/status"
```

## 成本估算

### 每月成本（假設 1000 個關鍵字，10 個 URL/關鍵字）

| 服務 | 用量 | 成本 |
|------|------|------|
| SERP API | 1000 次 | $0.05-0.10 |
| 分析 API | 10,000 次 | $0 (內部) |
| Cloudflare Worker | 1000 次 | $0 (免費層) |
| R2 存儲 | 50 MB | $0.015 |
| **合計** | - | **~$0.07** |

## 故障排除

### 問題 1：SERP API 失敗

**症狀**：`SERP collection failed`

**解決方案**：
```bash
# 檢查 SERP API 配置
echo $SERPAPI_KEY
echo $VALUESERP_KEY

# 測試 SERP API
python3 -c "from serp_manager import get_manager; m = get_manager(); print(m.fetch('test'))"
```

### 問題 2：分析 API 超時

**症狀**：`Analyze URL timeout`

**解決方案**：
```bash
# 增加 URL 延遲
python3 ml/serp_collection_batch.py \
  --keywords-file keywords.json \
  --url-delay 20  # 增加延遲

# 減少批次大小
python3 ml/serp_collection_batch.py \
  --keywords-file keywords.json \
  --batch-size 5  # 減少批次大小
```

### 問題 3：R2 上傳失敗

**症狀**：`R2 upload failed`

**解決方案**：
```bash
# 驗證 R2 bucket
wrangler r2 bucket list

# 檢查 bucket 權限
wrangler r2 bucket info keyword-exports
```

## 最佳實踐

1. **批次大小選擇**
   - 推薦：10-20 個關鍵字/批次
   - 太小：效率低
   - 太大：容易超時

2. **延遲設定**
   - 關鍵字延遲：15-30 秒
   - URL 延遲：10-15 秒
   - 根據 API 限制調整

3. **進度監控**
   - 定期檢查 R2 上傳狀態
   - 監控失敗記錄
   - 設定告警閾值

4. **錯誤恢復**
   - 使用 `--batch-size 1` 識別問題關鍵字
   - 跳過失敗的關鍵字
   - 稍後重試

## 下一步

- [ ] 模組 3：自動化模型訓練與部署
- [ ] 模組 4：監控與成本追蹤
- [ ] 模組 5：排程整合與 QA
- [ ] 生產環境部署
- [ ] 監控與優化

## 相關文件

- [Pipeline 自動化指南](./PIPELINE_AUTOMATION.md)
- [關鍵字匯出指南](./PIPELINE_AUTOMATION.md#關鍵字匯出)
- [模型訓練指南](../product/V5_USAGE_GUIDE.md)
