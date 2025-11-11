# 排名權重自動更新排程系統 - 部署檢查清單

**最後更新**：2025-11-11  
**系統版本**：v5 完整實施

---

## ✅ 預發布環境部署檢查清單

### 環境準備
- [ ] Node.js 18+ 已安裝
- [ ] Python 3.10+ 已安裝
- [ ] Wrangler CLI 已安裝 (`npm install -g wrangler`)
- [ ] Git 已初始化並配置

### 代碼檢查
- [x] 所有 Python 腳本已建立
  - `scripts/export_keywords.py`
  - `ml/serp_collection_batch.py`
  - `ml/train_model_cli.py`
- [x] 所有 Worker 代碼已建立
  - `functions/api/pipeline-scheduler.js`
  - `functions/api/serp-collection-scheduler.js`
  - `functions/api/model-deployment-scheduler.js`
  - `functions/api/reporting-scheduler.js`
  - `functions/api/cron-handler.js`
  - `functions/api/keywords/export.js`
- [x] 所有文檔已完成
  - `docs/deployment/PIPELINE_AUTOMATION.md`
  - `docs/deployment/SERP_COLLECTION_BATCH.md`
  - `docs/deployment/MODEL_TRAINING_DEPLOYMENT.md`
  - `docs/deployment/MONITORING_COST_TRACKING.md`
  - `docs/deployment/PIPELINE_INTEGRATION_QA.md`

### 配置檢查
- [x] `wrangler.toml` 已配置
  - R2 bucket 綁定
  - 5 個 Durable Objects 綁定
  - Cron 觸發配置
  - KV 命名空間綁定
  - Migrations 配置
- [ ] `.env.serp` 已配置 (本地開發)
  - SERPAPI_KEYS
  - VALUESERP_KEYS
  - ZENSERP_KEYS
- [ ] `.env` 已配置 (本地開發)
  - GEMINI_API_KEY
  - SLACK_WEBHOOK_URL (可選)

### 本地測試
- [x] Python 單元測試通過 (`pytest`)
- [x] 黃金測試集通過 (`node tests/run-golden-tests-local.js`)
- [ ] 本地 Worker 測試 (`wrangler dev`)
- [ ] 本地 API 端點測試

### Cloudflare 帳戶準備
- [ ] Cloudflare 帳戶已建立
- [ ] 專案已建立 (`wrangler init`)
- [ ] R2 bucket 已建立 (`keyword-exports`)
- [ ] KV 命名空間已建立
  - `ANALYSIS_RESULTS`
  - `KEYWORD_ANALYTICS`
- [ ] Durable Objects 已啟用
- [ ] Cron 觸發已啟用

### 預發布環境部署
- [ ] 執行部署命令
  ```bash
  wrangler deploy --env staging
  ```
- [ ] 驗證部署成功
  ```bash
  wrangler deployments list --env staging
  ```
- [ ] 測試 API 端點
  ```bash
  curl -X GET "https://<staging-url>/pipeline/health"
  ```

### 預發布環境測試
- [ ] 手動觸發 Pipeline
  ```bash
  curl -X POST "https://<staging-url>/pipeline/start" \
    -H "Content-Type: application/json" \
    -d '{"keywordLimit": 10}'
  ```
- [ ] 監控執行進度
  ```bash
  curl -X GET "https://<staging-url>/pipeline/status"
  ```
- [ ] 檢查 R2 上傳
- [ ] 檢查 KV 存儲
- [ ] 驗證 Slack 通知 (如已配置)
- [ ] 監控 7 天運行

---

## ✅ 生產環境部署檢查清單

### 預發布驗收
- [ ] 7 天監控期已完成
- [ ] 所有指標正常
  - 成功率 > 95%
  - 日均成本 < $1
  - 無重大錯誤
- [ ] 性能符合預期
  - 關鍵字匯出 < 10 分鐘
  - SERP 蒐集 < 60 分鐘
  - 模型訓練 < 30 分鐘

### 生產環境準備
- [ ] 生產環境配置已驗證
- [ ] 備份計劃已制定
- [ ] 回滾計劃已制定
- [ ] 監控告警已設定

### 生產環境部署
- [ ] 執行部署命令
  ```bash
  wrangler deploy --env production
  ```
- [ ] 驗證部署成功
  ```bash
  wrangler deployments list --env production
  ```
- [ ] 測試 API 端點
  ```bash
  curl -X GET "https://<production-url>/pipeline/health"
  ```

### 生產環境驗收
- [ ] 首次 Cron 觸發成功
- [ ] Pipeline 執行完成
- [ ] 所有階段正常運作
- [ ] 報表生成正確
- [ ] 成本符合預期

### 生產環境監控
- [ ] 設定 Slack 告警
- [ ] 設定成本告警 (> $2/天)
- [ ] 設定性能告警 (成功率 < 90%)
- [ ] 每日檢查報表
- [ ] 每週檢查成本

---

## 🔧 常見問題與解決方案

### 部署失敗

**問題**：`wrangler deploy` 失敗

**解決方案**：
```bash
# 1. 檢查登入狀態
wrangler login

# 2. 驗證配置
wrangler publish --dry-run

# 3. 查看詳細錯誤
wrangler deploy --verbose
```

### Durable Objects 未初始化

**問題**：`Durable Object not found`

**解決方案**：
```bash
# 1. 驗證 wrangler.toml 配置
grep -A 2 "durable_objects.bindings" wrangler.toml

# 2. 執行 migration
wrangler migrations create v1

# 3. 重新部署
wrangler deploy
```

### R2 上傳失敗

**問題**：`R2 bucket not found`

**解決方案**：
```bash
# 1. 列出所有 bucket
wrangler r2 bucket list

# 2. 建立 bucket (如不存在)
wrangler r2 bucket create keyword-exports

# 3. 驗證 wrangler.toml 綁定
grep "KEYWORD_EXPORTS_BUCKET" wrangler.toml
```

### Cron 未觸發

**問題**：Pipeline 未在預定時間執行

**解決方案**：
```bash
# 1. 驗證 Cron 配置
grep -A 1 "triggers.crons" wrangler.toml

# 2. 查看 Worker 日誌
wrangler tail --env production

# 3. 手動觸發測試
curl -X POST "https://<url>/pipeline/start"
```

---

## 📊 監控指標

### 關鍵指標
- **成功率**：> 95%
- **日均成本**：< $1
- **平均執行時間**：60-120 分鐘
- **記錄數**：> 100/天

### 告警規則
| 指標 | 閾值 | 動作 |
|------|------|------|
| 成功率 | < 90% | 立即告警 |
| 日均成本 | > $2 | 日報告 |
| 執行時間 | > 180 分鐘 | 檢查日誌 |
| 記錄數 | < 50/天 | 檢查 SERP |

---

## 🔐 安全檢查清單

### 環境變數
- [ ] 所有 API Key 已安全存儲
- [ ] 無 Key 硬編碼在代碼中
- [ ] `.env` 檔案已加入 `.gitignore`
- [ ] 生產環境使用 Wrangler secrets

### 訪問控制
- [ ] R2 bucket 權限已設定
- [ ] KV 命名空間權限已設定
- [ ] Durable Objects 訪問已限制
- [ ] API 端點已認證

### 備份與恢復
- [ ] R2 數據已備份
- [ ] KV 數據已備份
- [ ] 回滾計劃已制定
- [ ] 災難恢復計劃已制定

---

## 📞 支援聯絡

### 文檔
- [完整部署指南](./docs/deployment/PIPELINE_AUTOMATION.md)
- [測試報告](./DEPLOYMENT_TEST_REPORT.md)
- [故障排除指南](./docs/deployment/PIPELINE_INTEGRATION_QA.md)

### 快速命令

```bash
# 查看狀態
wrangler deployments list

# 查看日誌
wrangler tail

# 本地測試
wrangler dev

# 部署
wrangler deploy --env staging
wrangler deploy --env production
```

---

**檢查清單版本**：v1.0  
**最後更新**：2025-11-11  
**維護者**：AI Content Optimizer Team
