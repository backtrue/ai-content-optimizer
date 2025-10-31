# SERP 蒐集與寫入流程

## 目標
1. 成功蒐集指定 98 個關鍵字的 SERP 結果（透過 Cloud Tasks → Cloud Run worker）。
2. 將 SERP 與分析結果寫入 Google Sheet `training_data`，供後續機器學習使用。

## 系統元件
- **Cloud Tasks 佇列（`serp-collection`）**：排程批次任務。
- **Cloud Run 服務（`serp-worker`）**：接收 Cloud Tasks 觸發並執行 SERP 擷取＋分析。
- **內容分析 API（`https://ragseo.thinkwithblack.com/api/analyze`）**：為每個 SERP URL 產出內容特徵，是完成目標 2 的必要依賴。
- **Google Sheets（`training_data` 工作表）**：儲存最終 SERP 與分析結果。

## 環境設定
### 1. Cloud Run `serp-worker`
- 區域：`asia-east1`
- Service Account：`serp-worker@ragseo-476701.iam.gserviceaccount.com`
- Timeout：`900s`
- 主要環境變數（建議使用 `ml/cloud-run-env.yaml` 管理）：
  - `SERP_TASK_MODE=worker`
  - `SERPAPI_KEYS`、`VALUESERP_KEYS`、`ZENSERP_KEYS`（多組 API Key 逗號分隔）
  - `SERPAPI_ENABLED=true`、`VALUESERP_ENABLED=true`、`ZENSERP_ENABLED=true`
  - `SERP_ROTATION_STRATEGY=fallback`
  - `SERP_SERVICE_PRIORITY=serpapi,valueserp,zenserp`
  - `SERP_TASK_SYNC_TO_SHEETS=true`
  - `SHEETS_CREDENTIALS_PATH`、`SHEETS_TRAINING_DATA_ID`、`SHEETS_TRAINING_DATA_TAB`

### 2. Cloud Tasks `serp-collection`
- 地區：`asia-east1`
- 需要：
  - 建立任務的身份具備 `roles/cloudtasks.enqueuer`
  - Worker Service Account 具備 `roles/iam.serviceAccountUser`（供 Cloud Tasks OIDC token actAs）。

### 3. Google Sheets
- 將 `serp-sheet-writer-key.json` 放在專案根目錄。
- 確保執行環境設有：
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/serp-sheet-writer-key.json"
  export SHEETS_CREDENTIALS_PATH="$(pwd)/serp-sheet-writer-key.json"
  export SHEETS_TRAINING_DATA_ID=<Google Sheet ID>
  export SHEETS_TRAINING_DATA_TAB=training_data
  ```

### 4. 內容分析 API
- Cloudflare Worker：`functions/api/[[path]].js`
- 環境變數：`GEMINI_API_KEY`（以及選用的 `OPENAI_API_KEY`）。
- 若端點回傳 422/503，代表分析層故障，目標 2 即無法達成。

## 執行流程
1. **建立 Cloud Tasks**：
   ```bash
   source .venv/bin/activate
   python ml/enqueue_serp_tasks.py
   ```
   - 腳本讀取 `.env.serp`、校正 `SERP_WORKER_URL`（自動補 `/collect`），將 98 個關鍵字切成 20 批送入佇列。
2. **Cloud Tasks 呼叫 Cloud Run**：
   - 每批透過 OIDC token 呼叫 `POST /collect`，payload 包含 `keywords`、`keywordOffset`、`totalKeywords`、`syncToSheets` 等欄位。
3. **`serp-worker` 處理批次**：
   - 驗證 payload 後呼叫 `serp_collection.collect_keywords()`。
   - 主要步驟：
     1. `fetch_serp_results()` → 透過 SerpAPI/ValueSERP/ZenSERP 擷取 SERP，具輪換與錯誤處理。
     2. `analyze_url()` → 呼叫 `/api/analyze` 取得內容特徵。
     3. `persist_progress()` → 將資料寫入 Google Sheet（`sync_to_sheets=true` 時），並更新狀態檔。
4. **Google Sheet 更新**：
   - `training_data` 表新增列，含 `url`、`keyword`、`serp_rank`、`title`、`features.*`。

## 驗證步驟
1. **Cloud Tasks 控制台**：任務狀態由 Pending → Dispatched → Completed。
2. **Cloud Run 日誌**：
   - 有 `Received batch`、`Fetching SERP`、`Analyzing`、`Features extracted`。
   - 不應出現連續 422/503 或 `WORKER TIMEOUT`。
3. **Google Sheet `training_data`**：確認已新增新列且 `features` 欄位有值。

## 常見故障排查
| 階段 | 症狀 | 排查重點 |
| ---- | ---- | ---- |
| 任務建立 | `403 cloudtasks.tasks.create` | 補 `roles/cloudtasks.enqueuer` |
| Worker 啟動 | `WORKER TIMEOUT` / `SIGKILL` | 檢查環境變數、延遲載入 `KEYWORDS` 是否成功 |
| SERP API | `✗ Error: ...` | 檢查 API Key 是否配額耗盡，輪換策略是否生效 |
| `/api/analyze` | `HTTP error analyzing URL: 422/503` | 檢查 Cloudflare Worker 狀態及模型 API Key |
| Sheets 寫入 | `Missing SHEETS_*` | 確保變數與憑證路徑正確 |

---
此文件提供整個 SERP → 分析 → Google Sheet 管線的設定與檢查清單。
