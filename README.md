# 🚀 AI 內容優化大師 (Content Optimizer AI)

一個強大的 AI 驅動內容分析工具，幫助創作者優化文章的 SEO 與 AEO（Answer Engine Optimization）表現。

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ 功能特色

- 🎯 **雙核心評分系統**：同時評估 AEO/RAG 友善度與 8 大 SEO 評分指標
- 📊 **視覺化儀表板**：整合圓餅圖、進度條與佐證清單，快速洞察重點
- 💡 **智慧建議系統**：提供具體、可操作的優化建議並標示優先級
- 🤖 **AI 驅動分析**：預設採用 Google Gemini 2.x，支援 OpenAI 作為備援
- ⚡ **極速部署**：基於 Cloudflare Pages，全球 CDN 加速
- 🎨 **現代化 UI**：使用 React + TailwindCSS 打造的美觀介面

> **單篇內容限定**：目前版本專注於貼上文本的內部信號，不推測網域或競品資訊。當文本缺少必要線索時，AI 會回傳「文本未提供」。

## 📋 評分指標

### AEO/RAG 友善度
- 段落獨立性與主題集中度
- 語言清晰度與簡潔性
- 實體辨識與語意豐富度
- 邏輯流暢度與論證結構
- 可信度信號（數據、來源等）

### 傳統 SEO 效能（8 大指標）
- E-E-A-T 信任線索（18%）
- 內容品質與原創性（18%）
- 人本與主題一致性（12%）
- 標題與承諾落實（10%）
- 搜尋意圖契合度（12%）
- 新鮮度與時效性（8%）
- 使用者安全與風險（12%）
- 結構與可讀性（10%）

## 🛠️ 技術棧

- **前端**: React 18 + Vite
- **樣式**: TailwindCSS
- **圖標**: Lucide React
- **後端**: Cloudflare Workers (Serverless)
- **AI**: OpenAI GPT-4 / Google Gemini
- **部署**: Cloudflare Pages

## 🚀 快速開始

### 前置需求

- Node.js 18+ 
- npm 或 pnpm
- Cloudflare 帳號
- Google Gemini API Key（推薦）或 OpenAI API Key（備援）

### 本地開發

1. **克隆專案**
```bash
git clone <your-repo-url>
cd ai-content-seoer
```

2. **安裝依賴**
```bash
npm install
```

3. **設定環境變數**
```bash
cp .env.example .env
# 編輯 .env 或 .dev.vars，填入 GEMINI_API_KEY（必要）與選用的 OPENAI_API_KEY
```

4. **啟動開發伺服器**
```bash
npm run dev
```

5. **在瀏覽器中打開**
```
http://localhost:5173
```

### 測試 API（可選）

如果要在本地測試 Cloudflare Workers 函數：

```bash
npm run worker:dev
```

## 📦 部署到 Cloudflare Pages

### 方法一：使用 Cloudflare Dashboard（推薦）

1. **登入 Cloudflare Dashboard**
   - 前往 https://dash.cloudflare.com/
   - 選擇 "Workers & Pages"

2. **創建新專案**
   - 點擊 "Create application" > "Pages" > "Connect to Git"
   - 連接你的 GitHub/GitLab 倉庫
   - 選擇此專案

3. **配置構建設定**
   ```
   Framework preset: None
   Build command: npm run build
   Build output directory: dist
   ```

4. **設定環境變數**
   - 在 Settings > Environment variables 中添加：
     - `OPENAI_API_KEY` 或 `GEMINI_API_KEY`

5. **部署**
   - 點擊 "Save and Deploy"
   - 等待構建完成

### 方法二：使用 Wrangler CLI

1. **安裝 Wrangler**
```bash
npm install -g wrangler
```

2. **登入 Cloudflare**
```bash
wrangler login
```

3. **構建專案**
```bash
npm run build
```

4. **部署**
```bash
wrangler pages deploy dist --project-name=ai-content-optimizer
```

5. **設定環境變數**
```bash
wrangler pages secret put GEMINI_API_KEY
# 如需 OpenAI 備援，可另外設定：
wrangler pages secret put OPENAI_API_KEY
```

## 🔑 獲取 API Key

### OpenAI API Key
1. 前往 https://platform.openai.com/api-keys
2. 登入並創建新的 API Key
3. 複製 Key 並保存（只會顯示一次）

### Google Gemini API Key
1. 前往 https://makersuite.google.com/app/apikey
2. 創建新的 API Key
3. 複製並保存

## 📖 使用說明

1. **輸入內容**：在文字框中貼上你的文章內容
2. **設定關鍵字**（選填）：輸入目標關鍵字以獲得更精準的 SEO 分析
3. **開始分析**：點擊「開始 AI 分析」按鈕
4. **查看結果**：
   - 綜合評分：整體內容品質
   - 雙核心分數：AEO 和 SEO 分別評分
   - 詳細指標：各項指標的具體分數
   - 優化建議：按優先級排序的改進建議

## 🛡️ 安全性與隱私

- **API 金鑰保護**：僅透過 Cloudflare Pages Secrets 儲存，前端從不暴露。
- **最小化日誌**：後端僅記錄請求與回應摘要（如 token 數、候選數），避免洩漏文章內容或敏感資訊。
- **輸出校驗**：防呆邏輯會過濾非物件建議、修補不完整 JSON，確保前端穩定展示。

## 🎯 未來規劃 (Roadmap)

- [ ] URL/HTML 分析功能
- [ ] 競品分析（SERP 前10名對比）
- [ ] Chrome 擴充功能
- [ ] WordPress / Notion 整合
- [ ] 多語言支援（英文、日文等）
- [ ] 歷史記錄與趨勢分析
- [ ] 團隊協作功能
- [ ] API 開放給第三方使用

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 💬 聯絡方式

如有問題或建議，歡迎透過 Issue 聯繫我們。

---

**Made with ❤️ for Content Creators**
