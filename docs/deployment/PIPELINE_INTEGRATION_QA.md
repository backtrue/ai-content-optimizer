# Pipeline 排程整合與 QA 指南

## 概述

本模組完成排名權重自動更新排程系統的整合與驗收，涵蓋：
- 完整的 Cron 排程設計
- Pipeline 狀態機驗證
- 健康檢查端點
- 端到端測試
- 生產環境部署清單

## 完整的 Pipeline 流程

### 排程時程

```
週一 02:00 UTC - 關鍵字匯出
  ↓ (延遲 30 分鐘)
週一 02:30 UTC - SERP 蒐集
  ↓ (延遲 24 小時)
週二 03:00 UTC - 模型訓練與部署
  ↓ (延遲 30 分鐘)
週二 03:30 UTC - 成本摘要與週報
```

### 時區說明

- **UTC 時間**：Cloudflare Cron 使用 UTC
- **本地時間轉換**：
  - UTC+08:00 (台灣)：週一 10:00 → 關鍵字匯出
  - UTC+08:00 (台灣)：週一 10:30 → SERP 蒐集
  - UTC+08:00 (台灣)：週二 11:00 → 模型訓練
  - UTC+08:00 (台灣)：週二 11:30 → 成本摘要

### 自訂排程

編輯 `wrangler.toml`：

```toml
# 每天 02:00 UTC 執行
[[triggers.crons]]
crons = ["0 2 * * *"]

# 每週一 02:00 UTC 執行
[[triggers.crons]]
crons = ["0 2 * * 1"]

# 每月 1 日 02:00 UTC 執行
[[triggers.crons]]
crons = ["0 2 1 * *"]

# 多個時間
[[triggers.crons]]
crons = ["0 2 * * 1", "0 14 * * 1"]  # 週一 02:00 和 14:00 UTC
```

## Pipeline 狀態機

### 狀態流轉

```
idle (初始狀態)
  ↓ startPipeline()
running
  ├─ 關鍵字匯出 (pending → running → completed/failed)
  ├─ SERP 蒐集 (pending → running → completed/failed)
  ├─ 模型訓練 (pending → running → completed/failed)
  └─ 成本摘要 (pending → running → completed/failed)
  ↓
completed / failed / cancelled
```

### 狀態查詢

```bash
# 取得完整狀態
curl -X GET "https://api.example.com/pipeline/status"

# 查詢特定階段
curl -X GET "https://api.example.com/pipeline/status" | jq '.phases.serp_collection'

# 監控進度
watch -n 5 'curl -s "https://api.example.com/pipeline/status" | jq ".phases"'
```

### 失敗重試

```bash
# 重試特定階段
curl -X POST "https://api.example.com/pipeline/retry/serp_collection"

# 重試整個 Pipeline
curl -X POST "https://api.example.com/pipeline/start"

# 取消執行中的 Pipeline
curl -X POST "https://api.example.com/pipeline/cancel"
```

## 健康檢查端點

### 基本健康檢查

```bash
# Pipeline 健康檢查
curl -X GET "https://api.example.com/pipeline/health"

# 回應格式
{
  "healthy": true,
  "status": "idle",
  "lastPhase": null,
  "phases": {
    "keyword_export": { "status": "completed", ... },
    "serp_collection": { "status": "completed", ... },
    "model_training": { "status": "completed", ... },
    "cost_summary": { "status": "completed", ... }
  }
}
```

### 各模組健康檢查

```bash
# 關鍵字匯出
curl -X GET "https://api.example.com/api/keywords/export?format=json&limit=1"

# SERP 蒐集
curl -X GET "https://api.example.com/serp-collection/status"

# 模型部署
curl -X GET "https://api.example.com/model-deployment/status"

# 報表生成
curl -X GET "https://api.example.com/reporting/status"
```

### 監控腳本

```bash
#!/bin/bash
# health-check.sh - 定期監控 Pipeline 健康狀態

API_URL="https://api.example.com"
SLACK_WEBHOOK="$SLACK_WEBHOOK_URL"

check_health() {
  local response=$(curl -s -X GET "$API_URL/pipeline/health")
  local healthy=$(echo $response | jq -r '.healthy')
  local status=$(echo $response | jq -r '.status')
  
  if [ "$healthy" != "true" ]; then
    echo "❌ Pipeline 不健康: $status"
    
    # 發送 Slack 告警
    curl -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"❌ Pipeline 健康檢查失敗: $status\"}"
  else
    echo "✅ Pipeline 健康: $status"
  fi
}

# 每 5 分鐘檢查一次
while true; do
  check_health
  sleep 300
done
```

## 端到端測試

### 測試清單

#### 1. 本地單元測試

```bash
# 測試關鍵字匯出
python3 scripts/export_keywords.py \
  --keywords-json '["test1", "test2"]' \
  --output-dir ./test-output

# 測試 SERP 蒐集
python3 ml/serp_collection_batch.py \
  --keywords-json '["test"]' \
  --output-dir ./test-output \
  --batch-size 1

# 測試模型訓練
python3 ml/train_model_cli.py \
  --data-dir ./test-data \
  --output-dir ./test-output
```

#### 2. Worker 功能測試

```bash
# 測試 Pipeline Scheduler
curl -X POST "https://api.example.com/pipeline/start" \
  -H "Content-Type: application/json" \
  -d '{"keywordLimit": 10}'

# 監控執行進度
curl -X GET "https://api.example.com/pipeline/status" | jq '.'

# 查詢最終結果
curl -X GET "https://api.example.com/pipeline/status" | jq '.phases'
```

#### 3. 集成測試

```bash
# 測試完整流程（本地模擬）
bash tests/e2e-pipeline-test.sh

# 測試 Cron 觸發（使用 wrangler tail）
wrangler tail --format json | grep -i "cron"
```

#### 4. 性能測試

```bash
# 測試 API 響應時間
time curl -X GET "https://api.example.com/pipeline/status"

# 測試並發請求
ab -n 100 -c 10 "https://api.example.com/pipeline/health"

# 測試大型資料集
python3 ml/serp_collection_batch.py \
  --keywords-file ./large-keywords.json \
  --output-dir ./test-output
```

### 測試腳本

建立 `tests/e2e-pipeline-test.sh`：

```bash
#!/bin/bash
# 端到端 Pipeline 測試

set -e

echo "🚀 開始端到端 Pipeline 測試"

# 1. 測試關鍵字匯出
echo "📥 測試 1: 關鍵字匯出"
python3 scripts/export_keywords.py \
  --keywords-json '["test1", "test2", "test3"]' \
  --output-dir ./test-output \
  --format json

# 2. 測試 SERP 蒐集
echo "📊 測試 2: SERP 蒐集"
python3 ml/serp_collection_batch.py \
  --keywords-json '["test1"]' \
  --output-dir ./test-output \
  --batch-size 1 \
  --keyword-delay 1 \
  --url-delay 1

# 3. 測試模型訓練
echo "🤖 測試 3: 模型訓練"
python3 ml/train_model_cli.py \
  --data-dir ./test-output \
  --output-dir ./test-output

# 4. 驗證輸出
echo "✅ 驗證輸出檔案"
ls -la ./test-output/

echo "✅ 端到端測試完成"
```

## 部署清單

### 預發布環境部署

- [ ] 部署所有 Worker 代碼
- [ ] 配置 Durable Objects
- [ ] 設定 R2 bucket
- [ ] 配置 KV 命名空間
- [ ] 設定環境變數
- [ ] 測試所有 API 端點
- [ ] 驗證 Cron 觸發
- [ ] 測試 Slack 通知
- [ ] 執行完整 Pipeline 測試
- [ ] 檢查日誌與監控

### 生產環境部署

- [ ] 備份現有配置
- [ ] 部署到生產環境
- [ ] 驗證所有端點
- [ ] 監控初期運行
- [ ] 檢查成本指標
- [ ] 驗證報表生成
- [ ] 設定告警規則
- [ ] 文檔更新
- [ ] 團隊培訓
- [ ] 上線確認

### 部署命令

```bash
# 預發布環境
wrangler deploy --env staging

# 生產環境
wrangler deploy --env production

# 驗證部署
wrangler deployments list

# 查看日誌
wrangler tail --env production
```

## 監控與告警

### 關鍵指標

| 指標 | 告警閾值 | 檢查頻率 |
|------|---------|---------|
| Pipeline 狀態 | 失敗 | 每 5 分鐘 |
| API 成功率 | < 95% | 每小時 |
| 成本 | > $1/天 | 每天 |
| 記錄數 | < 100/天 | 每天 |

### Slack 告警設定

```bash
# 設定 Slack Webhook
wrangler secret put SLACK_WEBHOOK_URL

# 格式: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 告警規則

```javascript
// 在 Cron 處理器中設定
if (pipelineStatus.status === 'failed') {
  await notifySlack({
    title: '❌ Pipeline 執行失敗',
    error: pipelineStatus.lastError,
    severity: 'high'
  })
}

if (costMetrics.totalCost > 1.0) {
  await notifySlack({
    title: '⚠️ 成本超過預算',
    cost: costMetrics.totalCost,
    severity: 'medium'
  })
}
```

## 故障排除

### 常見問題

#### Q1: Cron 未觸發

**症狀**：Pipeline 未在預定時間執行

**解決方案**：
```bash
# 驗證 Cron 配置
cat wrangler.toml | grep -A 2 "triggers.crons"

# 檢查 Worker 日誌
wrangler tail --format json | grep -i "cron"

# 手動觸發測試
curl -X POST "https://api.example.com/pipeline/start"
```

#### Q2: Pipeline 卡住

**症狀**：Pipeline 狀態一直是 running

**解決方案**：
```bash
# 取消 Pipeline
curl -X POST "https://api.example.com/pipeline/cancel"

# 重新啟動
curl -X POST "https://api.example.com/pipeline/start"

# 檢查日誌
wrangler tail --format json | tail -100
```

#### Q3: 成本異常高

**症狀**：日均成本 > $1

**解決方案**：
```bash
# 檢查 API 使用量
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); t.print_summary()"

# 優化批次大小
# 編輯 wrangler.toml 中的 SERP 蒐集參數

# 減少關鍵字數量
# 編輯 Pipeline 啟動參數
```

## 性能基準

### 預期執行時間

| 階段 | 預期時間 | 備註 |
|------|---------|------|
| 關鍵字匯出 | 5 分鐘 | 200 個關鍵字 |
| SERP 蒐集 | 30-60 分鐘 | 200 個關鍵字 × 10 個 URL |
| 模型訓練 | 15-30 分鐘 | 1000+ 筆記錄 |
| 成本摘要 | 5 分鐘 | 彙整與上傳 |
| **總計** | **60-120 分鐘** | - |

### 成本估算

| 項目 | 每月成本 |
|------|---------|
| SERP API | $0.50-1.00 |
| Cloudflare Worker | $0 (免費層) |
| Durable Objects | $0.15 |
| R2 存儲 | $0.50 |
| KV 存儲 | $0.50 |
| **總計** | **~$1.65-2.15** |

## 下一步

- [ ] 完成預發布環境測試
- [ ] 執行生產環境部署
- [ ] 監控初期運行（7 天）
- [ ] 收集用戶反饋
- [ ] 優化性能與成本
- [ ] 實施 A/B 測試
- [ ] 擴展功能

## 相關文件

- [Pipeline 自動化指南](./PIPELINE_AUTOMATION.md)
- [SERP 蒐集指南](./SERP_COLLECTION_BATCH.md)
- [模型訓練指南](./MODEL_TRAINING_DEPLOYMENT.md)
- [監控與成本追蹤](./MONITORING_COST_TRACKING.md)
