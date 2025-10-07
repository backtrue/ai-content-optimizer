# 🌐 Cloudflare Pages 配置指南

## ✅ 已完成
- ✅ GitHub 倉庫已創建：https://github.com/backtrue/ai-content-optimizer
- ✅ 代碼已推送到 GitHub

## 🚀 現在開始配置 Cloudflare Pages

### 步驟 1：進入 Workers & Pages

在已打開的 Cloudflare Dashboard 中：

1. 在左側選單找到並點擊 **"Workers & Pages"**
2. 點擊右上角的 **"Create application"** 按鈕
3. 選擇 **"Pages"** 標籤（不是 Workers）
4. 點擊 **"Connect to Git"** 按鈕

### 步驟 2：連接 GitHub

1. 選擇 **"GitHub"**
2. 如果是第一次使用，會要求授權：
   - 點擊 **"Authorize Cloudflare Pages"**
   - 可以選擇授權所有倉庫或僅選擇的倉庫
   - 建議選擇 **"Only select repositories"** 並選擇 `ai-content-optimizer`
3. 授權完成後，會看到倉庫列表

### 步驟 3：選擇倉庫

1. 在倉庫列表中找到 **"backtrue/ai-content-optimizer"**
2. 點擊倉庫名稱旁的 **"Begin setup"** 按鈕

### 步驟 4：配置構建設定

在 "Set up builds and deployments" 頁面填寫：

```
┌─────────────────────────────────────────────────────┐
│ Project name                                        │
│ ai-content-optimizer                                │
│ (可以保持預設或自訂)                                  │
├─────────────────────────────────────────────────────┤
│ Production branch                                   │
│ main                                                │
├─────────────────────────────────────────────────────┤
│ Framework preset                                    │
│ None                          ⚠️ 重要：選擇 None    │
├─────────────────────────────────────────────────────┤
│ Build command                                       │
│ npm run build                                       │
├─────────────────────────────────────────────────────┤
│ Build output directory                              │
│ dist                                                │
└─────────────────────────────────────────────────────┘
```

**重要提示**：
- ⚠️ **Framework preset 必須選擇 "None"**
- 不要選擇 Vite、React 或其他預設
- Root directory 留空

### 步驟 5：設定環境變數

向下滾動到 **"Environment variables (advanced)"** 區域：

#### 選項 A：使用 OpenAI（推薦，品質最佳）

1. 點擊 **"Add variable"** 按鈕
2. 填寫：
   ```
   Variable name: OPENAI_API_KEY
   Value: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. 確保選擇 **"Production"** 環境
4. 點擊 **"Save"**

**如何獲取 OpenAI API Key**：
- 前往：https://platform.openai.com/api-keys
- 點擊 "Create new secret key"
- 複製 Key（格式：sk-proj-...）
- 費用：約 $0.03/次分析

#### 選項 B：使用 Google Gemini（免費）

1. 點擊 **"Add variable"** 按鈕
2. 填寫：
   ```
   Variable name: GEMINI_API_KEY
   Value: AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. 確保選擇 **"Production"** 環境
4. 點擊 **"Save"**

**如何獲取 Gemini API Key**：
- 前往：https://makersuite.google.com/app/apikey
- 點擊 "Create API Key"
- 複製 Key（格式：AIzaSy...）
- 免費額度：每分鐘 60 次請求

#### 選項 C：暫時跳過（測試用）

如果您還沒有 API Key，可以暫時跳過此步驟。
應用會使用 Mock 數據，您可以測試介面功能。
稍後可以在 Settings 中添加 API Key。

### 步驟 6：開始部署

1. 檢查所有設定是否正確
2. 點擊頁面底部的 **"Save and Deploy"** 按鈕
3. 等待構建過程（約 2-5 分鐘）

### 步驟 7：監控構建過程

部署開始後，您會看到：

```
🔄 Building...
   ├─ Cloning repository
   ├─ Installing dependencies (npm install)
   ├─ Building project (npm run build)
   └─ Deploying to Cloudflare network
```

**構建日誌**：
- 可以點擊 "View build log" 查看詳細過程
- 如果出現錯誤，日誌會顯示具體問題

### 步驟 8：部署完成

構建成功後，您會看到：

```
✅ Success! Your site is live!

🌐 https://ai-content-optimizer-xxx.pages.dev
```

**恭喜！您的應用已經上線了！** 🎉

---

## 🧪 測試您的應用

1. 點擊提供的 URL 訪問網站
2. 測試功能：
   - 輸入一段測試文字（例如：一篇關於 SEO 的文章）
   - 輸入目標關鍵字（選填）
   - 點擊「開始 AI 分析」
   - 查看分析結果

### 測試文字範例

您可以使用以下文字測試：

```
搜尋引擎優化（SEO）是提升網站在搜尋結果中排名的重要策略。
透過優化網站內容、改善使用者體驗、建立高品質的反向連結，
可以有效提升網站的可見度。現代 SEO 不僅關注關鍵字密度，
更重視內容的價值和使用者意圖的滿足。隨著 AI 技術的發展，
答案引擎優化（AEO）也變得越來越重要，內容創作者需要確保
文章能被 AI 正確理解和引用。
```

目標關鍵字：`SEO 優化`

---

## 🎨 進階配置（選填）

### 綁定自定義域名

1. 在專案頁面，點擊 **"Custom domains"** 標籤
2. 點擊 **"Set up a custom domain"**
3. 輸入您的域名（例如：`optimizer.yourdomain.com`）
4. 按照指示添加 DNS 記錄：
   ```
   Type: CNAME
   Name: optimizer
   Target: ai-content-optimizer-xxx.pages.dev
   ```
5. 等待 DNS 生效（通常幾分鐘到幾小時）

### 更新環境變數

如果需要更新或添加 API Key：

1. 前往專案的 **"Settings"** 標籤
2. 選擇 **"Environment variables"**
3. 找到要更新的變數，點擊 **"Edit"**
4. 或點擊 **"Add variable"** 添加新變數
5. 點擊 **"Save"**
6. 前往 **"Deployments"** 標籤
7. 點擊最新部署旁的 **"..."** > **"Retry deployment"**

### 設定 Preview 環境

為開發分支設定預覽環境：

1. 在 **"Settings"** > **"Builds & deployments"**
2. 啟用 **"Preview deployments"**
3. 選擇要預覽的分支（例如：`dev`）
4. 每次推送到該分支都會創建預覽 URL

---

## 📊 監控與分析

### 查看訪問統計

1. 在專案頁面選擇 **"Analytics"** 標籤
2. 可以看到：
   - 📈 請求數量
   - 🌍 地理分佈
   - ⚡ 回應時間
   - ❌ 錯誤率

### 查看 Functions 日誌

1. 在專案頁面選擇 **"Functions"** 標籤
2. 可以看到 API 調用日誌
3. 用於調試 API 問題

---

## 🔄 自動部署

配置完成後，每次推送到 GitHub 都會自動觸發部署：

```bash
# 修改代碼後
git add .
git commit -m "Update feature"
git push origin main

# Cloudflare 會自動：
# 1. 檢測到新提交
# 2. 開始構建
# 3. 部署到生產環境
```

---

## 🐛 常見問題

### 問題 1：構建失敗 - "Framework preset error"

**解決方案**：確保 Framework preset 設為 **"None"**

### 問題 2：API 請求失敗

**檢查清單**：
- ✅ 環境變數是否正確設定
- ✅ API Key 是否有效
- ✅ OpenAI 帳戶是否有餘額
- ✅ 查看瀏覽器 Console 的錯誤訊息

### 問題 3：樣式未正確顯示

**解決方案**：
- 清除瀏覽器緩存（Cmd + Shift + R）
- 使用無痕模式測試
- 檢查 Console 是否有 CSS 載入錯誤

### 問題 4：Functions 無法運行

**檢查清單**：
- ✅ `functions/api/analyze.js` 文件是否存在
- ✅ 查看 Functions 日誌
- ✅ 確認 CORS 設定正確

---

## 🎉 完成！

您的 AI 內容優化大師已經成功部署到 Cloudflare Pages！

**您的網站**：https://ai-content-optimizer-xxx.pages.dev

**下一步**：
1. ✨ 測試所有功能
2. 📊 分析一些真實內容
3. 🔗 分享給朋友使用
4. 💡 收集反饋並改進

---

**需要幫助？** 隨時詢問我！ 😊
