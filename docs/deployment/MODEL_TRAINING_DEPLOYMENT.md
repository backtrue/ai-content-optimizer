# 自動化模型訓練與部署系統

## 概述

本模組實現了完整的模型訓練與部署自動化系統，支援：
- 非互動式模型訓練
- 自動模型轉檔
- 無縫部署至 Cloudflare Worker
- 性能監控與通知

## 架構

### 核心流程

```
SERP 蒐集結果
    ↓
資料準備 (Data Preparation)
    ↓
模型訓練 (Model Training) - XGBoost
    ↓
模型轉檔 (Model Conversion) - JSON 格式
    ↓
模型部署 (Model Deployment) - KV 存儲
    ↓
通知 (Slack/Email)
```

### 模組結構

#### 1. 本地訓練腳本
- `ml/train_model_cli.py` - 非互動式訓練工具

#### 2. Worker Durable Object
- `functions/api/model-deployment-scheduler.js` - 訓練與部署協調

#### 3. Pipeline 整合
- `functions/api/pipeline-scheduler.js` - 執行模型訓練階段
- `functions/api/cron-handler.js` - Cron 觸發模型訓練

#### 4. 配置
- `wrangler.toml` - Model Deployment Scheduler Durable Object 綁定

## 使用指南

### 1. 本地模型訓練

#### 基本用法

```bash
# 從訓練資料目錄訓練模型
python3 ml/train_model_cli.py \
  --data-dir ./ml/training-data \
  --output-dir ./ml/models

# 生成部署腳本
python3 ml/train_model_cli.py \
  --data-dir ./ml/training-data \
  --output-dir ./ml/models \
  --deploy
```

#### 進階選項

```bash
python3 ml/train_model_cli.py \
  --data-dir ./ml/training-data \
  --output-dir ./ml/models \
  --model-name "xgboost_v2" \
  --test-size 0.2 \
  --deploy
```

#### 參數說明

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `--data-dir` | - | 訓練資料目錄（必需） |
| `--output-dir` | `./ml/models` | 輸出目錄 |
| `--model-name` | `xgboost_model` | 模型名稱 |
| `--test-size` | 0.2 | 測試集比例 |
| `--deploy` | False | 生成部署腳本 |

#### 輸出檔案

```
./ml/models/
├── xgboost_model_20251111_103000.pkl
├── xgboost_model_config_20251111_103000.json
└── deploy_20251111_103000.sh
```

### 2. 訓練資料格式

#### JSON 格式

```json
{
  "records": [
    {
      "keyword": "iPhone 17",
      "url": "https://example.com/iphone-17",
      "title": "iPhone 17 Pro Max Review",
      "rank": 1,
      "target_score": 8.5,
      "features": {
        "hcuYesRatio": 0.85,
        "hcuPartialRatio": 0.10,
        "hcuNoRatio": 0.05,
        "titleIntentMatch": 0.95,
        "firstParagraphAnswerQuality": 0.90,
        ...
      }
    }
  ]
}
```

#### CSV 格式

```csv
keyword,url,title,rank,target_score,hcuYesRatio,hcuPartialRatio,...
iPhone 17,https://example.com/iphone-17,iPhone 17 Pro Max Review,1,8.5,0.85,0.10,...
```

### 3. Worker API 端點

#### 啟動模型訓練

```bash
curl -X POST "https://api.example.com/model-deployment/start" \
  -H "Content-Type: application/json" \
  -d '{
    "serpResultsPath": "serp-results",
    "dataDir": "./ml/training-data",
    "testSize": 0.2,
    "trainingApiUrl": "http://localhost:8000/train"
  }'
```

#### 查詢狀態

```bash
curl -X GET "https://api.example.com/model-deployment/status"
```

回應格式：

```json
{
  "status": "running",
  "currentPhase": "model_training",
  "startedAt": "2025-11-11T10:30:00Z",
  "phases": {
    "data_preparation": {
      "status": "completed",
      "result": {
        "filesCount": 10,
        "serpResultsPath": "serp-results"
      }
    },
    "model_training": {
      "status": "running",
      "result": null
    },
    "model_conversion": {
      "status": "pending",
      "result": null
    },
    "model_deployment": {
      "status": "pending",
      "result": null
    }
  }
}
```

#### 取消訓練

```bash
curl -X POST "https://api.example.com/model-deployment/cancel"
```

### 4. Pipeline 整合

#### 自動執行流程

```
關鍵字匯出 (週一 02:00)
    ↓
SERP 蒐集 (週一 02:30)
    ↓
模型訓練 (週二 03:00)
    ↓
成本摘要 (週二 03:30)
```

#### 手動觸發

```bash
# 啟動完整 Pipeline（包含模型訓練）
curl -X POST "https://api.example.com/pipeline/start" \
  -H "Content-Type: application/json" \
  -d '{
    "keywordLimit": 200,
    "serpBatchSize": 10,
    "testSize": 0.2
  }'

# 查詢 Pipeline 狀態
curl -X GET "https://api.example.com/pipeline/status"

# 重試模型訓練階段
curl -X POST "https://api.example.com/pipeline/retry/model_training"
```

## 模型配置格式

### 訓練後的模型配置

```json
{
  "version": "2025-11-11-ml-v103000",
  "createdAt": "2025-11-11T10:30:00Z",
  "description": "XGBoost scoring model trained on SERP data",
  "trainingMetrics": {
    "train_mse": 0.1234,
    "test_mse": 0.1567,
    "train_rmse": 0.3513,
    "test_rmse": 0.3959,
    "train_mae": 0.2456,
    "test_mae": 0.2789,
    "train_r2": 0.9234,
    "test_r2": 0.9012
  },
  "trainingRecords": 1000,
  "modelConfig": {
    "model_type": "xgboost",
    "n_estimators": 100,
    "max_depth": 6,
    "learning_rate": 0.1,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "feature_names": [
      "hcuYesRatio",
      "hcuPartialRatio",
      ...
    ],
    "feature_importance": {
      "f0": 150,
      "f1": 120,
      ...
    }
  },
  "deployment": {
    "type": "xgboost",
    "format": "json",
    "compatibility": "scoring-model.js v2.0+"
  }
}
```

## 部署流程

### 自動部署

模型訓練完成後，系統會自動：

1. **轉檔模型配置** - 轉換為 Worker 相容格式
2. **上傳至 R2** - 保存轉檔後的配置
3. **更新 KV** - 將最新模型配置寫入 `current-model-config` 鍵
4. **發送通知** - Slack 通知部署完成

### 手動部署

```bash
# 1. 訓練模型
python3 ml/train_model_cli.py \
  --data-dir ./ml/training-data \
  --output-dir ./ml/models \
  --deploy

# 2. 執行部署腳本
bash ./ml/models/deploy_*.sh

# 3. 驗證部署
curl -X GET "https://api.example.com/api/health"
```

## 性能指標

### 模型評估指標

| 指標 | 說明 | 目標 |
|------|------|------|
| RMSE | 均方根誤差 | < 0.5 |
| MAE | 平均絕對誤差 | < 0.4 |
| R² | 決定係數 | > 0.85 |

### 訓練時間

| 資料量 | 訓練時間 | 部署時間 |
|--------|---------|---------|
| 100 筆 | 5 分鐘 | 1 分鐘 |
| 1000 筆 | 15 分鐘 | 1 分鐘 |
| 10000 筆 | 60 分鐘 | 2 分鐘 |

## 故障排除

### 問題 1：訓練資料不足

**症狀**：`ValueError: 未找到訓練資料`

**解決方案**：
```bash
# 檢查資料目錄
ls -la ./ml/training-data/

# 確保有 JSON 或 CSV 檔案
# 檢查檔案格式是否正確
```

### 問題 2：模型性能不佳

**症狀**：`test_r2 < 0.8`

**解決方案**：
```bash
# 增加訓練資料
# 調整超參數
python3 ml/train_model_cli.py \
  --data-dir ./ml/training-data \
  --test-size 0.15  # 減少測試集

# 檢查特徵品質
```

### 問題 3：部署失敗

**症狀**：`Model deployment failed`

**解決方案**：
```bash
# 檢查 KV 配置
wrangler kv:key list --namespace-id <NAMESPACE_ID>

# 檢查 R2 bucket
wrangler r2 bucket list

# 查看 Worker 日誌
wrangler tail --format json
```

## 最佳實踐

1. **定期訓練**
   - 每週訓練一次（自動排程）
   - 監控模型性能趨勢
   - 保存訓練歷史

2. **資料品質**
   - 確保訓練資料的多樣性
   - 移除異常值
   - 驗證特徵值範圍

3. **版本管理**
   - 使用時間戳記標記模型版本
   - 保留舊模型以便回滾
   - 記錄訓練參數

4. **監控與告警**
   - 監控模型性能指標
   - 設定告警閾值
   - 定期檢查預測結果

## 下一步

- [ ] 模組 4：監控與成本追蹤
- [ ] 模組 5：排程整合與 QA
- [ ] A/B 測試框架
- [ ] 模型版本管理
- [ ] 生產環境部署

## 相關文件

- [Pipeline 自動化指南](./PIPELINE_AUTOMATION.md)
- [SERP 蒐集指南](./SERP_COLLECTION_BATCH.md)
- [成本追蹤指南](../product/COST_TRACKING.md)
