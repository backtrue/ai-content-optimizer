# SERP 多服務快速開始指南

## 5 分鐘快速設定

### 步驟 1: 複製配置範本
```bash
cp .env.serp.example .env.serp
```

### 步驟 2: 編輯配置檔案
```bash
nano .env.serp
```

### 步驟 3: 設定 API Key

#### 單個 API Key
```env
SERPAPI_KEYS=your_single_key
VALUESERP_KEYS=your_single_key
ZENSERP_KEYS=your_single_key
```

#### 多個 API Key (推薦)
```env
# SerpAPI
SERPAPI_KEYS=key1,key2,key3

# ValueSERP (範例)
VALUESERP_KEYS=95A6F2493F944B5984BE498A9AB52528,297CBA37136D44EDBF0EB9D37CBFBBA3

# ZenSERP
ZENSERP_KEYS=key1,key2
```

### 步驟 4: 載入環境變數
```bash
export $(cat .env.serp | xargs)
```

### 步驟 5: 測試配置
```bash
python3 ml/test_serp_manager.py
```

預期輸出:
```
✓ SerpAPI
  狀態: active
  API Key 數量: 1
  成功: 0, 錯誤: 0

✓ ValueSERP
  狀態: active
  API Key 數量: 2
  成功: 0, 錯誤: 0
```

### 步驟 6: 開始蒐集
```bash
python3 ml/serp_collection.py
```

## 監控進度

### 查看蒐集進度
```bash
python3 ml/monitor_collection.py
```

### 查看服務狀態
```bash
python3 ml/test_serp_manager.py
```

### 查看成本統計
```bash
python3 -c "from ml.cost_tracker import get_tracker; get_tracker().print_summary()"
```

## 常見情境

### 情境 1: ValueSERP 配額超限

**發生的事:**
- 系統偵測到 HTTP 429 或 403
- 自動切換到下一個 ValueSERP API Key
- 蒐集繼續進行，無需中斷

**你會看到:**
```
✗ ValueSERP (Key #1): 配額超限或無效 API Key (403)
[API Key 輪換] ValueSERP: 切換到 API Key #2
✓ Got 10 results from ValueSERP
```

### 情境 2: 所有 API Key 都超限

**發生的事:**
- 系統自動切換到下一個服務 (例如 ZenSERP)
- 如果 ZenSERP 也超限，跳過該關鍵字
- 繼續處理下一個關鍵字

**流程:**
```
關鍵字: 非洲豬瘟
  ↓
嘗試 SerpAPI (Key #1) → 失敗
嘗試 SerpAPI (Key #2) → 失敗
  ↓
嘗試 ValueSERP (Key #1) → 成功! ✓
```

### 情境 3: 中途添加新 API Key

**步驟:**
1. 從服務商取得新 API Key
2. 編輯 `.env.serp`
3. 重新載入環境: `export $(cat .env.serp | xargs)`
4. 重新啟動蒐集: `python3 ml/serp_collection.py`

系統會自動使用新的 Key!

## 配置預設值

### 最小化 (單個服務)
```bash
cat > .env.serp << 'EOF'
SERPAPI_KEYS=your_key
SERPAPI_ENABLED=true
VALUESERP_ENABLED=false
ZENSERP_ENABLED=false
SERP_ROTATION_STRATEGY=fallback
EOF
```

### 平衡 (兩個服務)
```bash
cat > .env.serp << 'EOF'
SERPAPI_KEYS=your_key
SERPAPI_ENABLED=true
VALUESERP_KEYS=key1,key2
VALUESERP_ENABLED=true
ZENSERP_ENABLED=false
SERP_SERVICE_PRIORITY=serpapi,valueserp
SERP_ROTATION_STRATEGY=fallback
EOF
```

### 最大化 (三個服務 + 多個 Key)
```bash
cat > .env.serp << 'EOF'
SERPAPI_KEYS=key1,key2
SERPAPI_ENABLED=true
VALUESERP_KEYS=95A6F2493F944B5984BE498A9AB52528,297CBA37136D44EDBF0EB9D37CBFBBA3
VALUESERP_ENABLED=true
ZENSERP_KEYS=key1,key2,key3
ZENSERP_ENABLED=true
SERP_SERVICE_PRIORITY=serpapi,valueserp,zenserp
SERP_ROTATION_STRATEGY=fallback
SERP_MAX_RETRIES=3
SERP_LOG_API_KEY_ROTATION=true
EOF
```

## 故障排除

### 沒有服務配置?
```bash
# 檢查 API Key 是否已設定
echo "SerpAPI: $SERPAPI_KEYS"
echo "ValueSERP: $VALUESERP_KEYS"
echo "ZenSERP: $ZENSERP_KEYS"

# 如果為空，重新載入環境
export $(cat .env.serp | xargs)
```

### 測試失敗?
```bash
# 啟用調試模式
export SERP_DEBUG=true
python3 ml/test_serp_manager.py
```

### 蒐集卡住?
```bash
# 檢查進程是否運行
ps aux | grep "python3 ml/serp_collection.py"

# 殺死並重新啟動
pkill -f "python3 ml/serp_collection.py"
python3 ml/serp_collection.py
```

## 下一步

1. **監控蒐集** (每 30 分鐘)
   ```bash
   python3 ml/monitor_collection.py
   ```

2. **蒐集完成後** (預計 2-3 小時)
   - 重訓模型: `python3 ml/train_baseline.py`
   - 部署: `git add ml/ && git commit && git push`

3. **優化配置**
   - 檢查服務使用模式
   - 根據配額調整優先順序
   - 添加更多服務 (如需要)

## 檔案參考

| 檔案 | 用途 |
|------|------|
| `.env.serp` | 你的配置 (不要提交) |
| `.env.serp.example` | 範本 (提交此檔) |
| `ml/serp_manager.py` | 多服務管理器 |
| `ml/serp_collection.py` | 蒐集腳本 |
| `ml/test_serp_manager.py` | 配置測試工具 |
| `SERP_多服務快速開始.md` | 本檔案 |

## 支援

如需詳細資訊，請參閱:
- `SERP_SETUP.md` - 詳細設定指南
- `SERP_MULTI_SERVICE_SUMMARY.md` - 完整架構說明
