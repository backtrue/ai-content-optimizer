# API Key 輪換機制詳細指南

## 概述

系統支援為每個 SERP 服務配置多個 API Key，當一個 Key 的配額超限時，自動切換到下一個 Key，確保蒐集過程不中斷。

## 工作原理

### 單個 API Key
```
請求 1 → SerpAPI (Key #1) → 成功 ✓
請求 2 → SerpAPI (Key #1) → 成功 ✓
請求 3 → SerpAPI (Key #1) → 成功 ✓
```

### 多個 API Key (自動輪換)
```
請求 1 → SerpAPI (Key #1) → 成功 ✓
請求 2 → SerpAPI (Key #1) → 配額超限 (429)
         ↓ 自動輪換
請求 2 → SerpAPI (Key #2) → 成功 ✓
請求 3 → SerpAPI (Key #2) → 成功 ✓
請求 4 → SerpAPI (Key #2) → 配額超限 (429)
         ↓ 自動輪換
請求 4 → SerpAPI (Key #3) → 成功 ✓
```

## 配置方式

### 基本格式
```env
# 單個 Key
SERVICE_KEYS=key1

# 多個 Key (逗號分隔，無空格)
SERVICE_KEYS=key1,key2,key3
```

### 實際範例

#### SerpAPI
```env
# 單個 Key
SERPAPI_KEYS=d5d040588a63fe91e0643b2a7ee1e4a8778ea777d0a9f7e065f77cd05b2a05db

# 多個 Key
SERPAPI_KEYS=key1,key2,key3
```

#### ValueSERP
```env
# 多個 Key (你的實際 Key)
VALUESERP_KEYS=95A6F2493F944B5984BE498A9AB52528,297CBA37136D44EDBF0EB9D37CBFBBA3
```

#### ZenSERP
```env
# 多個 Key
ZENSERP_KEYS=key1,key2,key3
```

## 輪換策略

### 1. 自動輪換 (推薦)
```env
SERP_API_KEY_ROTATION=round-robin
```

**行為:**
- 依序輪換 API Key
- 配額超限時立即切換
- 自動記錄每個 Key 的使用統計

**範例:**
```
Key #1 → Key #2 → Key #3 → Key #1 → ...
```

### 2. 優先級輪換
```env
SERP_API_KEY_ROTATION=priority
```

**行為:**
- 優先使用第一個 Key
- 失敗時才切換到下一個
- 適合有主次 Key 的情況

**範例:**
```
Key #1 (失敗) → Key #2 (成功) → 繼續使用 Key #2
```

### 3. 隨機輪換
```env
SERP_API_KEY_ROTATION=random
```

**行為:**
- 隨機選擇 API Key
- 均勻分散負載
- 適合測試用途

## 配額超限檢測

系統自動檢測以下情況並輪換 API Key:

| 狀態碼 | 含義 | 動作 |
|--------|------|------|
| 429 | 速率限制 | 輪換 Key |
| 403 | 禁止 (配額超限) | 輪換 Key |
| 其他 | 其他錯誤 | 重試 |

### 檢測邏輯
```python
if "quota" in error.lower() or "429" in error or "403" in error:
    # 輪換 API Key
    service.rotate_api_key()
else:
    # 重試或切換服務
    pass
```

## 監控 API Key 使用

### 查看 API Key 統計
```bash
python3 ml/test_serp_manager.py
```

輸出範例:
```
ValueSERP:
  狀態: active
  API Key 數量: 2
  目前 API Key: #2
  API Key 統計:
    #1 (95A6F249...B52528): 成功 45, 錯誤 2
    #2 (297CBA37...FBBA3): 成功 38, 錯誤 0
```

### 查看詳細統計
```bash
python3 -c "
from ml.serp_manager import get_manager
import json
manager = get_manager()
status = manager.get_status()
print(json.dumps(status, indent=2))
"
```

### 啟用 API Key 輪換日誌
```env
SERP_LOG_API_KEY_ROTATION=true
```

輸出範例:
```
[API Key 輪換] ValueSERP: 切換到 API Key #2
[API Key 輪換] SerpAPI: 切換到 API Key #1
```

## 成本優化

### 按使用量分配 Key

```env
# 便宜的服務用多個 Key
ZENSERP_KEYS=key1,key2,key3

# 昂貴的服務用少量 Key
SERPAPI_KEYS=key1

# 中等的服務用適量 Key
VALUESERP_KEYS=key1,key2
```

### 按優先級分配 Key

```env
# 優先使用便宜的服務
SERP_SERVICE_PRIORITY=zenserp,valueserp,serpapi

# 每個服務有多個 Key 作為備份
ZENSERP_KEYS=key1,key2,key3
VALUESERP_KEYS=key1,key2
SERPAPI_KEYS=key1
```

## 實際案例

### 案例 1: ValueSERP 兩個 Key

**配置:**
```env
VALUESERP_KEYS=95A6F2493F944B5984BE498A9AB52528,297CBA37136D44EDBF0EB9D37CBFBBA3
VALUESERP_ENABLED=true
SERP_LOG_API_KEY_ROTATION=true
```

**蒐集過程:**
```
[1/100] 非洲豬瘟
  ✓ Got 8 results from ValueSERP (Key #1)

[2/100] 張峻
  ✓ Got 8 results from ValueSERP (Key #1)

...

[50/100] 某個關鍵字
  ✗ ValueSERP (Key #1): 配額超限 (429)
  [API Key 輪換] ValueSERP: 切換到 API Key #2
  ✓ Got 8 results from ValueSERP (Key #2)

[51/100] 下一個關鍵字
  ✓ Got 8 results from ValueSERP (Key #2)
```

### 案例 2: 三個服務各有多個 Key

**配置:**
```env
SERPAPI_KEYS=key1,key2
SERPAPI_ENABLED=true

VALUESERP_KEYS=95A6F2493F944B5984BE498A9AB52528,297CBA37136D44EDBF0EB9D37CBFBBA3
VALUESERP_ENABLED=true

ZENSERP_KEYS=key1,key2,key3
ZENSERP_ENABLED=true

SERP_SERVICE_PRIORITY=serpapi,valueserp,zenserp
```

**蒐集過程:**
```
[1/100] 關鍵字 1
  嘗試 SerpAPI (Key #1) → 成功 ✓

[2/100] 關鍵字 2
  嘗試 SerpAPI (Key #1) → 配額超限
  [API Key 輪換] SerpAPI: 切換到 Key #2
  嘗試 SerpAPI (Key #2) → 成功 ✓

[3/100] 關鍵字 3
  嘗試 SerpAPI (Key #2) → 配額超限
  [API Key 輪換] SerpAPI: 切換到 Key #1 (循環)
  嘗試 SerpAPI (Key #1) → 配額超限
  [服務切換] 切換到 ValueSERP
  嘗試 ValueSERP (Key #1) → 成功 ✓
```

## 中途添加新 Key

### 步驟 1: 編輯配置
```bash
nano .env.serp
```

### 步驟 2: 添加新 Key
```env
# 原來
VALUESERP_KEYS=95A6F2493F944B5984BE498A9AB52528

# 修改為
VALUESERP_KEYS=95A6F2493F944B5984BE498A9AB52528,297CBA37136D44EDBF0EB9D37CBFBBA3,new_key_here
```

### 步驟 3: 重新載入環境
```bash
export $(cat .env.serp | xargs)
```

### 步驟 4: 重新啟動蒐集
```bash
# 殺死舊進程
pkill -f "python3 ml/serp_collection.py"

# 啟動新進程 (會使用新 Key)
python3 ml/serp_collection.py
```

## 故障排除

### 所有 Key 都超限?

**症狀:**
```
✗ ValueSERP (Key #1): 配額超限 (429)
✗ ValueSERP (Key #2): 配額超限 (429)
✗ ValueSERP (Key #3): 配額超限 (429)
```

**解決方案:**
1. 獲取新的 API Key
2. 添加到配置: `VALUESERP_KEYS=old_keys,new_key`
3. 重新載入環境並重啟蒐集

### API Key 沒有輪換?

**檢查:**
```bash
# 確認配置正確
echo $VALUESERP_KEYS

# 啟用日誌
export SERP_LOG_API_KEY_ROTATION=true
python3 ml/test_serp_manager.py
```

### 統計數據不正確?

**重置統計:**
```bash
# 刪除舊的使用記錄
rm ml/api_usage.json

# 重新啟動蒐集
python3 ml/serp_collection.py
```

## 最佳實踐

### 1. 為每個服務準備多個 Key
```env
# 至少 2 個 Key
VALUESERP_KEYS=key1,key2

# 最好 3+ 個 Key
ZENSERP_KEYS=key1,key2,key3
```

### 2. 監控 Key 使用情況
```bash
# 定期檢查
python3 ml/test_serp_manager.py
```

### 3. 提前添加新 Key
- 不要等到所有 Key 都超限
- 當某個 Key 接近配額時就添加新 Key
- 保持至少 1 個可用的 Key

### 4. 記錄 Key 的配額信息
```
ValueSERP Key #1: 100 請求/月 (已用 95)
ValueSERP Key #2: 100 請求/月 (已用 50)
```

### 5. 定期檢查成本
```bash
python3 -c "from ml.cost_tracker import get_tracker; get_tracker().print_summary()"
```

## 常見問題

### Q: 可以添加無限個 Key 嗎?
**A:** 可以。系統支援任意數量的 Key，但建議不超過 10 個以保持管理簡單。

### Q: Key 會自動重試嗎?
**A:** 會。系統會重試最多 3 次 (可配置)，然後才切換 Key。

### Q: 舊 Key 會被刪除嗎?
**A:** 不會。系統會循環使用所有 Key，直到全部超限。

### Q: 能否手動選擇 Key?
**A:** 目前不支援。系統自動管理 Key 輪換。

### Q: 如何知道哪個 Key 超限了?
**A:** 查看統計資訊:
```bash
python3 ml/test_serp_manager.py
```

## 總結

✅ **多 Key 輪換系統**
- 自動切換 API Key
- 配額超限檢測
- 詳細的使用統計
- 成本優化
- 無縫故障轉移

🚀 **立即開始:**
```bash
# 編輯配置
nano .env.serp

# 設定多個 Key
VALUESERP_KEYS=key1,key2,key3

# 啟動蒐集
export $(cat .env.serp | xargs)
python3 ml/serp_collection.py
```
