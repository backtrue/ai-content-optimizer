# SERP Multi-Service System - Complete Summary

## Overview

Implemented a robust, cost-efficient multi-service SERP management system that automatically switches between providers when quotas are exceeded or errors occur.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  serp_collection.py                      │
│              (Main collection script)                    │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐  ┌──────────┐  ┌────────┐
   │SerpAPI  │  │ValueSERP │  │ZenSERP │
   └────┬────┘  └────┬─────┘  └───┬────┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────▼────────────┐
        │   serp_manager.py       │
        │  (Failover logic)       │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   cost_tracker.py       │
        │  (Usage & pricing)      │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   analyze-worker.js     │
        │  (Feature extraction)   │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   training_data.csv     │
        │   training_data.json    │
        └─────────────────────────┘
```

## Key Features

### 1. Multi-Service Support
- **SerpAPI**: Fast, reliable, good free tier
- **ValueSERP**: Cost-effective, good coverage
- **ZenSERP**: Budget option, decent reliability

### 2. Automatic Failover
- Detects quota exceeded (HTTP 429, 403)
- Switches to next available service
- Retries with exponential backoff
- Tracks error patterns

### 3. Cost Optimization
- Tracks usage per service
- Calculates estimated costs
- Accounts for free tiers
- Provides optimization recommendations
- Exports usage to CSV

### 4. Service Status Monitoring
- Success/error counts per service
- Last error tracking
- Real-time status display
- Service availability checking

## Configuration

### Quick Setup (5 minutes)

```bash
# 1. Copy template
cp .env.serp.example .env.serp

# 2. Add your API keys
nano .env.serp

# 3. Load environment
export $(cat .env.serp | xargs)

# 4. Test
python3 ml/test_serp_manager.py

# 5. Start collection
python3 ml/serp_collection.py
```

### Environment Variables

```env
# API Keys
SERPAPI_KEY=your_key
VALUESERP_KEY=your_key
ZENSERP_KEY=your_key

# Service Control
SERPAPI_ENABLED=true
VALUESERP_ENABLED=true
ZENSERP_ENABLED=false

# Rotation Strategy
SERP_ROTATION_STRATEGY=fallback  # or: priority, round-robin, random
SERP_SERVICE_PRIORITY=serpapi,valueserp,zenserp

# Retry Configuration
SERP_MAX_RETRIES=3
SERP_RETRY_DELAY_MS=1000

# Rate Limiting
SERP_RATE_LIMIT_RPM=60

# Debugging
SERP_DEBUG=false
SERP_LOG_FAILURES=true
```

## Usage Examples

### Example 1: Basic Collection

```bash
export $(cat .env.serp | xargs)
python3 ml/serp_collection.py
```

Output:
```
[1/100] Processing keyword: 非洲豬瘟
  Fetching SERP for: 非洲豬瘟
    ✓ Got 8 results from SerpAPI
    Analyzing: https://...
      ✓ Features extracted
    ...
```

### Example 2: Monitor Progress

```bash
python3 ml/monitor_collection.py
```

Output:
```
SERP Collection Progress
Total records: 45
Unique keywords: 12

Top keywords:
  非洲豬瘟: 8 records
  張峻: 7 records
  水龍吟: 6 records
```

### Example 3: Check Service Status

```bash
python3 ml/test_serp_manager.py
```

Output:
```
✓ SerpAPI
  Status: active
  Success: 45
  Errors: 2

✓ ValueSERP
  Status: active
  Success: 0
  Errors: 0

✗ ZenSERP
  Status: disabled
```

### Example 4: View Cost Summary

```bash
python3 -c "from ml.cost_tracker import get_tracker; get_tracker().print_summary()"
```

Output:
```
API Usage & Cost Report

Service      Requests    Errors    Cost
SerpAPI      450         2         $0.0225
ValueSERP    0           0         $0.0000
ZenSERP      0           0         $0.0000
TOTAL        450         2         $0.0225

Recommendations:
1. Cheapest service: ZenSERP ($0.03/1000)
2. Consider enabling backup services
```

## Failover Scenarios

### Scenario 1: SerpAPI Quota Exceeded

```
Keyword: 非洲豬瘟
  Try SerpAPI → HTTP 429 (Quota exceeded)
  Try ValueSERP → Success! Got 10 results
  Record: SerpAPI quota_exceeded, ValueSERP active
```

### Scenario 2: All Services Fail

```
Keyword: 某個關鍵字
  Try SerpAPI → Error: Invalid API key
  Try ValueSERP → Error: Network timeout
  Try ZenSERP → Error: API error
  Result: Skip keyword, continue with next
```

### Scenario 3: Add New API Key Mid-Collection

```bash
# Update .env.serp with new key
nano .env.serp

# Reload environment
export $(cat .env.serp | xargs)

# Restart collection (will use new key)
python3 ml/serp_collection.py
```

## File Structure

```
ml/
├── serp_manager.py          # Multi-service manager
├── serp_collection.py       # Collection script (updated)
├── cost_tracker.py          # Cost tracking
├── test_serp_manager.py     # Configuration tester
├── monitor_collection.py    # Progress monitor
├── training_data.csv        # Output: features
├── training_data.json       # Output: full data
├── api_usage.json           # Usage tracking
└── api_usage.csv            # Usage export

.env.serp                     # Configuration (don't commit)
.env.serp.example            # Template (commit this)

SERP_SETUP.md               # Detailed guide
SERP_QUICK_START.md         # Quick start
SERP_MULTI_SERVICE_SUMMARY.md # This file
```

## Pricing Comparison

| Service | Free Tier | Price/1000 | Best For |
|---------|-----------|-----------|----------|
| SerpAPI | 100/month | $0.05 | Reliability |
| ValueSERP | 100/month | $0.04 | Balance |
| ZenSERP | 100/month | $0.03 | Budget |

**Example Cost for 1000 Requests:**
- SerpAPI: $0.05
- ValueSERP: $0.04
- ZenSERP: $0.03

**Example Cost for 100,000 Requests:**
- SerpAPI: $5.00
- ValueSERP: $4.00
- ZenSERP: $3.00

## Best Practices

### 1. Start Simple
- Begin with one service
- Monitor quota usage
- Add more services as needed

### 2. Monitor Costs
- Check `api_usage.csv` regularly
- Review cost recommendations
- Optimize service priority based on usage

### 3. Maintain Redundancy
- Always have 2+ services enabled
- Test failover regularly
- Keep backup API keys updated

### 4. Optimize Configuration
- Use `fallback` strategy for reliability
- Set priority based on cost/performance
- Adjust retry settings based on network

### 5. Log Everything
- Enable `SERP_LOG_FAILURES=true`
- Review error patterns
- Adjust configuration based on data

## Troubleshooting

### No Services Available
```bash
# Check if keys are set
echo $SERPAPI_KEY
echo $VALUESERP_KEY
echo $ZENSERP_KEY

# If empty, reload
export $(cat .env.serp | xargs)
```

### Collection Stuck
```bash
# Check process
ps aux | grep "python3 ml/serp_collection.py"

# Kill and restart
pkill -f "python3 ml/serp_collection.py"
python3 ml/serp_collection.py
```

### High Error Rate
```bash
# Enable debug mode
export SERP_DEBUG=true
python3 ml/test_serp_manager.py

# Check API key validity
# Check provider status pages
# Review error messages
```

## Integration with ML Pipeline

After collection completes:

```bash
# 1. Verify data
python3 ml/monitor_collection.py

# 2. Train model
python3 ml/train_baseline.py

# 3. Review costs
python3 -c "from ml.cost_tracker import get_tracker; get_tracker().print_summary()"

# 4. Deploy
git add ml/
git commit -m "feat: Updated training data and model"
git push origin main
```

## Performance Metrics

### Collection Speed
- 100 keywords × 8-10 URLs = ~800-1000 requests
- 8 seconds per URL (rate limiting)
- **Total time**: 2-3 hours

### Success Rate
- Target: >95% successful requests
- Acceptable: >80% successful requests
- Current: Monitor via `api_usage.csv`

### Cost Efficiency
- Average: $0.04 per 1000 requests
- Budget: $0.03 per 1000 requests (ZenSERP)
- Premium: $0.05 per 1000 requests (SerpAPI)

## Future Enhancements

1. **Automatic Quota Management**
   - Detect quota reset times
   - Schedule collection around resets

2. **Machine Learning for Service Selection**
   - Learn optimal service per keyword
   - Predict failures before they happen

3. **Real-time Monitoring Dashboard**
   - Web UI for status tracking
   - Cost visualization
   - Alert system

4. **Advanced Retry Strategies**
   - Exponential backoff
   - Jitter for distributed requests
   - Circuit breaker pattern

5. **Integration with Other APIs**
   - Add more SERP providers
   - Support for other search engines
   - Multi-region support

## Support & Documentation

- **Quick Start**: See `SERP_QUICK_START.md`
- **Detailed Setup**: See `SERP_SETUP.md`
- **Cost Tracking**: See `ML_TRAINING_PROGRESS.md`
- **佇列化流程**：參考下方新章節

## Cloud Tasks 背景佇列流程（2025-10-30 新增）

- 目的：避免 Cloud Run Job 的 600 秒限制，改以 Cloud Tasks + Cloud Run Service 逐批處理。
- 架構：

  | 元件 | 角色 | 主要檔案/服務 |
  | --- | --- | --- |
  | Enqueuer | 切批並投遞任務 | `ml/enqueue_serp_tasks.py` |
  | Queue | 管理排程與重試 | Cloud Tasks（預設 queue `serp-collection`） |
  | Worker | 接收批次並串接 `collect_keywords` | Cloud Run + `ml/serp_worker.py` |
  | 核心邏輯 | SERP 抓取與分析 | `ml/serp_collection.py` |

- 主要環境變數：
  - `SERP_TASK_QUEUE`, `SERP_TASK_LOCATION`
  - `SERP_WORKER_URL`
  - `SERP_TASK_SERVICE_ACCOUNT`（需 Cloud Tasks Enqueuer + Cloud Run Invoker）
  - `SERP_TASK_BATCH_SIZE`, `SERP_TASK_SPACING_SECONDS`
  - `SERP_TASK_KEYWORD_DELAY`, `SERP_TASK_URL_DELAY`

- 部署步驟摘要：
  1. 建立佇列：
     ```bash
     gcloud tasks queues create serp-collection \
       --location=asia-east1 \
       --max-attempts=5 \
       --max-dispatches-per-second=2 \
       --max-concurrent-dispatches=3
     ```
  2. 部署 Worker：
     ```bash
     gcloud run deploy serp-worker \
       --source ml \
       --entry-point create_app \
       --region asia-east1 \
       --service-account serp-worker@ragseo-476701.iam.gserviceaccount.com \
       --timeout 900s
     ```
  3. 於 `.env.serp` 內設定相關變數後，執行 `python ml/enqueue_serp_tasks.py` 投遞任務。

- Worker 預設僅同步 Google Sheets，`persistLocal=False` 以避免 Cloud Run ephemeral filesystem。若需本地輸出，可在 payload 啟用 `persistLocal` 與 `updateStatus`。

- 監控：
  - Cloud Tasks console 檢視佇列與重試狀態。
  - Cloud Run logs 觀察批次結果與錯誤。
  - Google Sheets `collection_progress` 標籤同步批次進度。

## Summary

✅ **Multi-service SERP management system**
- Automatic failover between 3+ providers
- Cost tracking and optimization
- Real-time status monitoring
- Seamless API key rotation
- Production-ready reliability

🚀 **Ready to use:**
```bash
cp .env.serp.example .env.serp
# Add your API keys
export $(cat .env.serp | xargs)
python3 ml/serp_collection.py
```

---

**Last Updated**: 2025-10-28  
**Status**: Production Ready  
**Version**: 1.0.0
