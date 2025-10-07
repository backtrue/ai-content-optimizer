# 🚀 立即部署到 Cloudflare Pages

您的代碼已經準備好了！請按照以下步驟完成部署。

## ✅ 已完成的準備工作

- ✅ Git 倉庫已初始化
- ✅ 所有文件已提交到 main 分支
- ✅ 專案結構完整
- ✅ 配置文件就緒

## 📝 部署步驟

### 步驟 1：推送到 GitHub

您需要先將代碼推送到 GitHub（或 GitLab）。

#### 1.1 在 GitHub 上創建新倉庫

1. 前往 https://github.com/new
2. 填寫倉庫資訊：
   - Repository name: `ai-content-optimizer`（或您喜歡的名稱）
   - Description: `AI 內容優化大師 - 智慧分析內容的 SEO 與 AEO 表現`
   - 選擇 **Public** 或 **Private**
   - **不要**勾選 "Initialize this repository with a README"
3. 點擊 "Create repository"

#### 1.2 推送代碼

在終端機執行以下命令（將 `YOUR_USERNAME` 替換為您的 GitHub 用戶名）：

```bash
git remote add origin https://github.com/YOUR_USERNAME/ai-content-optimizer.git
git push -u origin main
```

### 步驟 2：部署到 Cloudflare Pages

#### 2.1 登入 Cloudflare

1. 前往 https://dash.cloudflare.com/
2. 登入您的帳號（如果沒有帳號，請先註冊 - 完全免費）

#### 2.2 創建 Pages 專案

1. 在左側選單選擇 **"Workers & Pages"**
2. 點擊 **"Create application"** 按鈕
3. 選擇 **"Pages"** 標籤
4. 點擊 **"Connect to Git"**

#### 2.3 連接 GitHub

1. 選擇 **"GitHub"**
2. 如果是第一次使用，需要授權 Cloudflare 訪問您的 GitHub
3. 選擇 `ai-content-optimizer` 倉庫
4. 點擊 **"Begin setup"**

#### 2.4 配置構建設定

填入以下資訊：

```
Project name: ai-content-optimizer
Production branch: main
Framework preset: None (重要！)
Build command: npm run build
Build output directory: dist
Root directory: (留空)
```

**重要提示**：
- Framework preset 必須選擇 **"None"**
- 不要選擇 Vite 或 React，因為我們有自定義配置

#### 2.5 設定環境變數

在 **"Environment variables"** 區域：

**選項 A：使用 OpenAI（推薦，品質最佳）**

1. 點擊 **"Add variable"**
2. Variable name: `OPENAI_API_KEY`
3. Value: 您的 OpenAI API Key（格式：`sk-...`）
4. 選擇 **"Production"** 環境

**選項 B：使用 Google Gemini（免費額度）**

1. 點擊 **"Add variable"**
2. Variable name: `GEMINI_API_KEY`
3. Value: 您的 Gemini API Key（格式：`AIza...`）
4. 選擇 **"Production"** 環境

**選項 C：暫時不設定（使用 Mock 數據測試）**

如果您還沒有 API Key，可以先不設定。應用會使用 Mock 數據，您可以測試介面功能。

#### 2.6 開始部署

1. 點擊 **"Save and Deploy"**
2. 等待構建完成（約 2-5 分鐘）
3. 構建成功後，您會看到：
   - ✅ 綠色的成功標記
   - 🌐 您的網站 URL（例如：`https://ai-content-optimizer.pages.dev`）

### 步驟 3：測試您的應用

1. 點擊提供的 URL 訪問您的網站
2. 測試功能：
   - 輸入一段測試文字（例如：一篇關於 SEO 的文章）
   - 輸入目標關鍵字（選填）
   - 點擊「開始 AI 分析」
   - 查看分析結果

## 🔑 如何獲取 API Key

### OpenAI API Key（推薦）

1. 前往 https://platform.openai.com/api-keys
2. 登入或註冊帳號
3. 點擊 **"Create new secret key"**
4. 給 Key 一個名稱（例如：`content-optimizer`）
5. 複製 Key（格式：`sk-proj-...`）
6. **重要**：立即保存，因為只會顯示一次

**費用估算**：
- 每次分析約 $0.03 USD
- 1000 次分析約 $30 USD
- 需要充值至少 $5 USD 才能使用

### Google Gemini API Key（免費）

1. 前往 https://makersuite.google.com/app/apikey
2. 登入 Google 帳號
3. 點擊 **"Create API Key"**
4. 選擇或創建 Google Cloud 專案
5. 複製 API Key（格式：`AIzaSy...`）

**免費額度**：
- 每分鐘 60 次請求
- 適合個人使用和測試

## 🎉 部署完成後

### 自定義域名（選填）

如果您想使用自己的域名：

1. 在 Cloudflare Pages 專案頁面
2. 點擊 **"Custom domains"** 標籤
3. 點擊 **"Set up a custom domain"**
4. 輸入域名（例如：`optimizer.yourdomain.com`）
5. 按照指示配置 DNS

### 更新 API Key

如果需要更新或添加 API Key：

1. 前往專案的 **"Settings"** > **"Environment variables"**
2. 添加或編輯變數
3. 點擊 **"Save"**
4. 前往 **"Deployments"** 標籤
5. 點擊最新部署旁的 **"..."** > **"Retry deployment"**

### 查看分析數據

1. 在專案頁面選擇 **"Analytics"** 標籤
2. 可以看到：
   - 訪問量統計
   - 地理分佈
   - 請求數量
   - 錯誤率

## 🐛 遇到問題？

### 構建失敗

**檢查清單**：
- ✅ Framework preset 是否設為 "None"
- ✅ Build command 是否為 `npm run build`
- ✅ Build output directory 是否為 `dist`
- ✅ 查看構建日誌找出具體錯誤

### API 請求失敗

**檢查清單**：
- ✅ 環境變數是否正確設定
- ✅ API Key 是否有效
- ✅ OpenAI 帳戶是否有足夠餘額
- ✅ 查看瀏覽器控制台的錯誤訊息

### 頁面顯示但樣式錯誤

**解決方案**：
- 清除瀏覽器緩存
- 使用無痕模式測試
- 檢查 Console 是否有 CSS 載入錯誤

## 📞 需要幫助？

如果遇到任何問題：

1. 查看 `DEPLOYMENT.md` 的詳細說明
2. 查看 Cloudflare Pages 文檔：https://developers.cloudflare.com/pages/
3. 在 GitHub 提交 Issue

## 🎊 恭喜！

您的 AI 內容優化大師已經成功部署！現在您可以：

- ✨ 分享網址給其他人使用
- 📊 分析您的內容並獲得優化建議
- 🚀 持續改進和添加新功能
- 💡 收集用戶反饋

---

**祝您使用愉快！** 🎉
