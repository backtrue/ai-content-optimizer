# 📦 Cloudflare Pages 部署指南

本指南將詳細說明如何將 AI 內容優化大師部署到 Cloudflare Pages。

## 🎯 為什麼選擇 Cloudflare Pages？

- ✅ **免費額度充足**：每月 500 次構建，無限流量
- ✅ **全球 CDN**：超過 275 個數據中心
- ✅ **Serverless Functions**：內建 Workers 支援
- ✅ **自動 HTTPS**：免費 SSL 證書
- ✅ **Git 整合**：自動部署

## 📋 部署前準備

### 1. 準備 API Key

你需要至少一個 AI 服務的 API Key：

#### 選項 A：OpenAI（推薦）
- 前往：https://platform.openai.com/api-keys
- 創建新的 API Key
- 建議使用 GPT-4 模型以獲得最佳分析品質
- 費用：按使用量計費（約 $0.03 / 1K tokens）

#### 選項 B：Google Gemini
- 前往：https://makersuite.google.com/app/apikey
- 創建新的 API Key
- 免費額度：每分鐘 60 次請求
- 適合測試和小規模使用

### 2. 準備 Git 倉庫

確保你的代碼已推送到 GitHub 或 GitLab：

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

## 🚀 部署步驟

### 步驟 1：登入 Cloudflare

1. 前往 https://dash.cloudflare.com/
2. 登入或註冊帳號（免費）
3. 選擇左側選單的 **"Workers & Pages"**

### 步驟 2：創建 Pages 專案

1. 點擊 **"Create application"** 按鈕
2. 選擇 **"Pages"** 標籤
3. 點擊 **"Connect to Git"**

### 步驟 3：連接 Git 倉庫

1. 選擇 **GitHub** 或 **GitLab**
2. 授權 Cloudflare 訪問你的倉庫
3. 選擇 `ai-content-seoer` 倉庫
4. 點擊 **"Begin setup"**

### 步驟 4：配置構建設定

在構建配置頁面填入：

```
Project name: ai-content-optimizer (或你喜歡的名稱)
Production branch: main
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: /
```

**重要**：不要選擇任何 Framework preset，保持為 "None"

### 步驟 5：設定環境變數

在同一頁面向下滾動到 **"Environment variables"** 區域：

1. 點擊 **"Add variable"**
2. 添加以下變數之一（或兩者都添加）：

   **使用 OpenAI：**
   ```
   Variable name: OPENAI_API_KEY
   Value: sk-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **使用 Gemini：**
   ```
   Variable name: GEMINI_API_KEY
   Value: AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. 確保選擇 **"Production"** 環境

### 步驟 6：開始部署

1. 點擊 **"Save and Deploy"**
2. 等待構建完成（通常需要 2-5 分鐘）
3. 構建成功後，你會看到部署的 URL

### 使用專案內建部署腳本（CLI）

如需從終端快速部署，可以使用 `scripts/deploy-cloudflare.sh`：

```bash
./scripts/deploy-cloudflare.sh
```

- 預設會執行 `npm install`、`npm run build`，並發出：
  - `wrangler pages deploy dist --project-name ai-content-optimizer`
  - `wrangler deploy --env production`
- 可透過參數客製：
  - `--project <name>` 指定 Pages 專案名稱
  - `--worker-env <env>` 指定 analyze-worker 的 wrangler 環境
  - `--skip-install` 或 `--skip-worker` 控制流程
- 也可以利用環境變數 `CLOUDFLARE_PAGES_PROJECT`、`CLOUDFLARE_WORKER_ENV`、`DEPLOY_WORKER` 等覆寫設定。

> 使用前請先完成 `wrangler login`，或設定 Cloudflare API Token 相關環境變數。

### 步驟 7：驗證部署

1. 點擊提供的 URL（格式：`https://ai-content-optimizer.pages.dev`）
2. 測試應用程式：
   - 輸入一段測試文字
   - 點擊「開始 AI 分析」
   - 確認能正常獲得分析結果

## 🔧 部署後配置

### 自定義域名（選填）

1. 在專案頁面，點擊 **"Custom domains"** 標籤
2. 點擊 **"Set up a custom domain"**
3. 輸入你的域名（例如：`content-optimizer.yourdomain.com`）
4. 按照指示添加 DNS 記錄
5. 等待 DNS 生效（通常幾分鐘到幾小時）

### 更新環境變數

如果需要更新 API Key：

1. 前往專案的 **"Settings"** 標籤
2. 選擇 **"Environment variables"**
3. 找到要更新的變數
4. 點擊 **"Edit"** 或 **"Delete"** 後重新添加
5. 點擊 **"Save"**
6. 重新部署專案以應用更改

### 查看部署日誌

如果部署失敗：

1. 在專案頁面選擇 **"Deployments"** 標籤
2. 點擊失敗的部署
3. 查看 **"Build log"** 找出錯誤原因
4. 常見問題：
   - 構建命令錯誤
   - 依賴安裝失敗
   - 環境變數未設定

## 🔄 自動部署

配置完成後，每次推送到 main 分支都會自動觸發部署：

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Cloudflare 會自動：
1. 檢測到新的提交
2. 開始構建
3. 部署到生產環境
4. 發送通知（如果已設定）

## 📊 監控與分析

### 查看使用統計

1. 在專案頁面選擇 **"Analytics"** 標籤
2. 可以看到：
   - 請求數量
   - 帶寬使用
   - 錯誤率
   - 地理分佈

### 設定告警

1. 前往 **"Notifications"** 設定
2. 可以設定：
   - 構建失敗通知
   - 錯誤率過高告警
   - 使用量告警

## 🐛 常見問題排查

### 問題 1：API 請求失敗

**症狀**：點擊分析按鈕後顯示錯誤

**解決方案**：
1. 檢查環境變數是否正確設定
2. 確認 API Key 有效且有足夠額度
3. 查看瀏覽器控制台的錯誤訊息
4. 檢查 Cloudflare Workers 日誌

### 問題 2：構建失敗

**症狀**：部署時構建過程失敗

**解決方案**：
1. 檢查 `package.json` 中的依賴版本
2. 確認 Node.js 版本兼容（建議 18+）
3. 查看構建日誌找出具體錯誤
4. 嘗試在本地運行 `npm run build` 測試

### 問題 3：Functions 無法運行

**症狀**：前端正常但 API 調用失敗

**解決方案**：
1. 確認 `functions/api/analyze.js` 文件存在
2. 檢查 Cloudflare Pages Functions 是否啟用
3. 查看 Functions 日誌（在 Dashboard 中）
4. 確認 CORS 設定正確

### 問題 4：樣式未正確載入

**症狀**：頁面顯示但樣式混亂

**解決方案**：
1. 清除瀏覽器緩存
2. 檢查 `tailwind.config.js` 配置
3. 確認 `postcss.config.js` 存在
4. 重新構建並部署

## 💰 成本估算

### Cloudflare Pages（免費方案）
- ✅ 500 次構建/月
- ✅ 無限請求
- ✅ 無限帶寬
- ✅ 1 個並發構建

### API 成本（OpenAI）
假設每次分析使用約 2000 tokens：
- 輸入：~1500 tokens × $0.01/1K = $0.015
- 輸出：~500 tokens × $0.03/1K = $0.015
- **每次分析成本：約 $0.03**
- 1000 次分析/月：約 $30

### API 成本（Gemini）
- 免費額度：每分鐘 60 次請求
- 適合個人使用和測試
- 超出後需要付費方案

## 🎓 進階配置

### 設定多環境

為開發和生產環境設定不同的 API Key：

1. 創建 Preview 環境變數
2. 使用不同的 API Key 或配額
3. 在 Git 分支上測試新功能

### 啟用 Web Analytics

1. 在 Cloudflare Dashboard 啟用 Web Analytics
2. 添加追蹤代碼到 `index.html`
3. 查看詳細的使用者行為數據

### 設定 Rate Limiting

保護 API 免受濫用：

1. 在 Cloudflare Workers 中添加 rate limiting
2. 使用 KV 存儲請求計數
3. 設定每 IP 的請求限制

## 📚 相關資源

- [Cloudflare Pages 文檔](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [OpenAI API 文檔](https://platform.openai.com/docs)
- [Gemini API 文檔](https://ai.google.dev/docs)

## 🆘 需要幫助？

如果遇到問題：
1. 查看本文檔的常見問題部分
2. 檢查 GitHub Issues
3. 查看 Cloudflare Community
4. 提交新的 Issue

---

祝你部署順利！🎉
