# 監控與成本追蹤系統

## 概述

本模組實現了完整的監控與成本追蹤系統，支援：
- 每日成本摘要生成
- 週報自動彙整
- R2 歸檔存儲
- Slack 通知與告警
- Pipeline 指標監控

## 架構

### 核心流程

```
Pipeline 執行完成
    ↓
Reporting Scheduler 觸發
    ├─ 生成每日報表
    ├─ 上傳至 R2
    ├─ 保存至 KV
    └─ 發送 Slack 通知
    
週一執行時
    ├─ 生成週報
    ├─ 彙整過去 7 天數據
    ├─ 生成建議與下一步
    └─ 發送週報通知
```

### 模組結構

#### 1. 成本追蹤擴充
- `ml/cost_tracker.py` - 每日摘要、週報、R2 格式

#### 2. Worker Durable Object
- `functions/api/reporting-scheduler.js` - 報表生成與監控

#### 3. Pipeline 整合
- `functions/api/pipeline-scheduler.js` - 執行成本摘要階段
- `functions/api/cron-handler.js` - Cron 觸發成本摘要

#### 4. 配置
- `wrangler.toml` - Reporting Scheduler Durable Object 綁定

## 使用指南

### 1. 本地成本追蹤

#### 生成每日摘要

```bash
# 基本用法
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); print(t.generate_daily_summary())"

# 指定輸出目錄
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); print(t.generate_daily_summary('./reports'))"
```

#### 生成週報

```bash
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); print(t.generate_weekly_report())"
```

#### 生成 R2 上傳格式

```bash
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); import json; print(json.dumps(t.export_to_r2_format(), indent=2))"
```

#### 取得 Pipeline 指標

```bash
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); import json; print(json.dumps(t.get_pipeline_metrics(), indent=2))"
```

### 2. Worker API 端點

#### 生成每日報表

```bash
curl -X POST "https://api.example.com/reporting/daily" \
  -H "Content-Type: application/json" \
  -d '{}'
```

回應格式：

```json
{
  "success": true,
  "report": {
    "date": "2025-11-11",
    "generatedAt": "2025-11-11T10:30:00Z",
    "pipeline": {
      "status": "completed",
      "phases": {...},
      "lastRun": "2025-11-11T10:30:00Z"
    },
    "costs": {
      "totalCost": 0.15,
      "successRate": 99.5,
      "services": {...}
    },
    "summary": {
      "totalRecordsCollected": 1000,
      "totalCost": 0.15,
      "successRate": 99.5
    }
  }
}
```

#### 生成週報

```bash
curl -X POST "https://api.example.com/reporting/weekly" \
  -H "Content-Type: application/json" \
  -d '{}'
```

回應格式：

```json
{
  "success": true,
  "report": {
    "period": "2025-11-04 to 2025-11-11",
    "generatedAt": "2025-11-11T10:30:00Z",
    "dailyReports": 7,
    "aggregated": {
      "totalRecords": 7000,
      "totalCost": 1.05,
      "averageDailyCost": 0.15,
      "averageSuccessRate": 99.5
    },
    "recommendations": [
      "✅ 本週蒐集 7000 筆記錄，可進行模型訓練",
      "📈 成本上升 15%，建議優化 API 使用"
    ],
    "nextSteps": [
      "🤖 執行模型訓練 - 記錄數足夠",
      "💾 備份成本報表至 R2",
      "📧 檢查 Pipeline 執行日誌"
    ]
  }
}
```

#### 查詢報表狀態

```bash
curl -X GET "https://api.example.com/reporting/status"
```

### 3. 成本摘要格式

#### 每日摘要 (daily-summary-YYYY-MM-DD.json)

```json
{
  "date": "2025-11-11",
  "timestamp": "2025-11-11T10:30:00Z",
  "usage": {
    "serpapi": {
      "requests": 100,
      "errors": 2,
      "cost": 0.005
    },
    "valueserp": {
      "requests": 50,
      "errors": 1,
      "cost": 0.002
    },
    "zenserp": {
      "requests": 30,
      "errors": 0,
      "cost": 0.001
    }
  },
  "total": {
    "requests": 180,
    "errors": 3,
    "cost": 0.008
  },
  "recommendations": [
    "Cheapest service: ZenSERP ($0.03/1000)",
    "Consider enabling backup services for redundancy"
  ]
}
```

#### 週報 (weekly-report-YYYY-MM-DD.json)

```json
{
  "period": "2025-11-04 to 2025-11-11",
  "generatedAt": "2025-11-11T10:30:00Z",
  "dailyReports": 7,
  "aggregated": {
    "totalRecords": 7000,
    "totalCost": 1.05,
    "averageDailyCost": 0.15,
    "averageSuccessRate": 99.5
  },
  "recommendations": [...],
  "projections": {
    "monthlyRequests": 30000,
    "monthlyCost": 4.50
  }
}
```

### 4. R2 存儲結構

```
cost-reports/
├── 2025-11-11/
│   ├── daily-summary.json
│   └── weekly-report.json (週一)
├── 2025-11-10/
│   └── daily-summary.json
└── ...

reports/
├── 2025-11-11/
│   ├── daily-report.json
│   └── weekly-report.json (週一)
└── ...
```

### 5. Slack 通知

#### 每日通知（可選）

```
📊 每日報表 - 2025-11-11
蒐集記錄: 1000 筆
總成本: $0.15
成功率: 99.5%
```

#### 週報通知

```
📈 週報 2025-11-04 to 2025-11-11

蒐集記錄: 7000 筆
總成本: $1.05
日均成本: $0.15
成功率: 99.5%

建議:
✅ 本週蒐集 7000 筆記錄，可進行模型訓練
📈 成本上升 15%，建議優化 API 使用
```

## 監控指標

### 關鍵指標

| 指標 | 說明 | 目標 |
|------|------|------|
| 成功率 | API 請求成功比例 | > 95% |
| 日均成本 | 每日平均成本 | < $0.20 |
| 記錄數 | 蒐集的訓練記錄數 | > 100/天 |
| 錯誤率 | API 錯誤比例 | < 5% |

### 告警閾值

| 條件 | 告警 | 建議 |
|------|------|------|
| 成功率 < 90% | 🔴 高 | 檢查 API 配置 |
| 日均成本 > $0.50 | 🟡 中 | 優化 API 使用 |
| 記錄數 < 50/天 | 🟡 中 | 檢查 SERP 蒐集 |
| 連續 3 天失敗 | 🔴 高 | 立即介入 |

## 成本優化建議

### 1. 服務選擇

根據成本追蹤，選擇最便宜的服務：

```bash
# 查看成本對比
python3 -c "from cost_tracker import CostTracker; print(CostTracker.PRICING)"
```

### 2. 批次優化

- 增加批次大小 → 減少 API 呼叫
- 優化關鍵字選擇 → 提高命中率
- 使用 API 輪換 → 避免配額超限

### 3. 監控告警

設定 Slack 告警：

```bash
# 設定 Slack Webhook
wrangler secret put SLACK_WEBHOOK_URL
```

## 故障排除

### 問題 1：報表生成失敗

**症狀**：`Daily report generation failed`

**解決方案**：
```bash
# 檢查 Pipeline 狀態
curl -X GET "https://api.example.com/pipeline/status"

# 檢查 KV 配置
wrangler kv:key list --namespace-id <NAMESPACE_ID>
```

### 問題 2：成本數據不準確

**症狀**：`Cost mismatch`

**解決方案**：
```bash
# 重新計算成本
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); t._update_costs(); t._save_usage()"

# 驗證 API 使用量
python3 -c "from cost_tracker import get_tracker; t = get_tracker(); t.print_summary()"
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

1. **定期檢查報表**
   - 每日檢查成本摘要
   - 每週檢查週報
   - 監控成本趨勢

2. **設定告警**
   - 成功率低於 90%
   - 日均成本超過 $0.50
   - 連續 3 天無記錄

3. **優化成本**
   - 使用最便宜的服務
   - 優化批次大小
   - 監控 API 使用

4. **備份數據**
   - 定期下載 R2 報表
   - 保留至少 90 天歷史
   - 驗證數據完整性

## 下一步

- [ ] 模組 5：排程整合與 QA
- [ ] A/B 測試框架
- [ ] 成本預測模型
- [ ] 自動優化建議
- [ ] 生產環境部署

## 相關文件

- [Pipeline 自動化指南](./PIPELINE_AUTOMATION.md)
- [SERP 蒐集指南](./SERP_COLLECTION_BATCH.md)
- [模型訓練指南](./MODEL_TRAINING_DEPLOYMENT.md)
