# 🚀 SEOer 的 AEO/GEO 小幫手

由台灣 SEO 專家邱煜庭（小黑老師）研究開發，結合 Google《搜尋品質評分者指南》與 Helpful Content Update (HCU) 核心精神，打造專為內容團隊與 SEOer 設計的 AI 驅動分析工具。

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ 功能特色

- 🎯 **雙核心評分系統**：同時評估 AEO/RAG 友善度與 8 大 SEO 評分指標，協助內容貼近 Google 喜好
- 📊 **視覺化儀表板**：整合圓餅圖、進度條與佐證清單，快速洞察重點
- 💡 **智慧建議系統**：提供具體、可操作的優化建議並標示優先級
- 🤖 **AI 驅動分析**：預設採用 Google Gemini 2.x，支援 OpenAI 作為備援
- ⚡ **極速部署**：基於 Cloudflare Pages + Workers，全球 CDN 加速
- 🎨 **現代化 UI**：使用 React + TailwindCSS 打造的美觀介面
- 🔒 **安全防護**：API Key 認證、速率限制、SSRF/IDOR 防護

> **單篇內容限定**：目前版本專注於貼上文本的內部信號，不推測網域或競品資訊。當文本缺少必要線索時，AI 會回傳「文本未提供」。

## 📋 評分指標

### AEO 評估（3 大指標）
- 答案精準度：是否直接回應使用者問題並提供具體步驟
- 精選摘要適配：段落是否易於抽取、結構是否利於生成式搜尋引用
- 敘事可信度：是否引用可信來源、具備實務經驗或案例支撐

### SEO 評估（3 大指標）
- 內容意圖契合（34%）：標題承諾與核心意圖是否被完整兌現
- 洞察與證據支持（33%）：是否提供原創洞察、案例與可信引用
- 可讀性與敘事流暢（33%）：段落結構、句長與排版是否易讀可掃描

## 🛠️ 技術棧

- **前端**: React 18 + Vite
- **樣式**: TailwindCSS
- **圖標**: Lucide React
- **後端**: Cloudflare Workers (Serverless) + Durable Objects
- **AI**: Google Gemini / OpenAI GPT-4
- **儲存**: Cloudflare KV + R2
- **部署**: Cloudflare Pages + Workers

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
cp .dev.vars.example .dev.vars
# 編輯 .env 與 .dev.vars，填入必要的 API Keys
```

4. **啟動開發伺服器**
```bash
npm run dev          # 前端
npm run worker:dev   # Worker（另開終端）
```

5. **在瀏覽器中打開**
```
http://localhost:5173
```

## 🔐 安全性設定

### API Key 認證

本專案使用 API Key 保護 API 端點，防止未授權存取和資源濫用。

1. **生成安全密鑰**
```bash
openssl rand -hex 32
```

2. **設定 Worker 密鑰**
```bash
# 開發環境
echo "YOUR_KEY" | npx wrangler secret put CLIENT_API_SECRET

# 生產環境
echo "YOUR_KEY" | npx wrangler secret put CLIENT_API_SECRET --env=production
```

3. **設定前端環境變數**
```bash
# .env
VITE_API_KEY=YOUR_KEY
```

### 安全防護機制

| 機制 | 說明 |
|---|---|
| **API Key 驗證** | 所有 API 請求需帶 `X-API-Key` 標頭 |
| **速率限制** | 每 Session 每日 20 次、每 IP 每小時 40 次 |
| **SSRF 防護** | 阻擋對 localhost、內網 IP 的請求 |
| **IDOR 防護** | 分析結果需持有 ownerToken 才能存取 |

## 📦 部署到 Cloudflare

### 環境變數清單

| 變數名稱 | 說明 | 設定位置 |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API Key | Worker Secret |
| `OPENAI_API_KEY` | OpenAI API Key（備援） | Worker Secret |
| `CLIENT_API_SECRET` | API 認證密鑰 | Worker Secret |
| `VITE_API_KEY` | 前端 API Key | Pages 環境變數 |

### 使用 Wrangler CLI 部署

1. **部署 Worker**
```bash
npm run worker:deploy        # 開發環境
npm run worker:deploy:prod   # 生產環境
```

2. **設定 Secrets**
```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put CLIENT_API_SECRET
```

3. **部署前端（若使用 Cloudflare Pages）**
```bash
npm run build
wrangler pages deploy dist --project-name=ai-content-optimizer
```

### 使用 GitHub 連接自動部署（推薦）

1. 在 Cloudflare Dashboard 連接 GitHub 倉庫
2. Pages 和 Workers 會自動從 `main` 分支同步部署
3. 在 Dashboard 設定環境變數和 Secrets

## 🔑 獲取 API Key

### Google Gemini API Key
1. 前往 https://makersuite.google.com/app/apikey
2. 創建新的 API Key
3. 複製並保存

### OpenAI API Key
1. 前往 https://platform.openai.com/api-keys
2. 登入並創建新的 API Key
3. 複製 Key 並保存（只會顯示一次）

## 📖 使用說明

1. **輸入內容**：在文字框中貼上你的文章內容
2. **設定關鍵字**（選填）：輸入目標關鍵字以獲得更精準的 SEO 分析
3. **開始分析**：點擊「開始 AI 分析」按鈕
4. **查看結果**：
   - 綜合評分：整體內容品質
   - 雙核心分數：AEO 和 SEO 分別評分
   - 詳細指標：各項指標的具體分數
   - 優化建議：按優先級排序的改進建議
   - AI 引用潛力：評估內容是否具備讓 AI 模型引用的可信度與完整度

> **免責聲明**：本工具僅提供第三方檢測與優化建議，無法保證搜尋排名或流量成長。

## 🛡️ 安全性與隱私

- **API 金鑰保護**：透過 Cloudflare Secrets 儲存，前端僅持有認證用途的 Client Key。
- **API 認證**：所有端點需驗證 `X-API-Key` 標頭，防止未授權存取。
- **速率限制**：防止 API 濫用與 Denial of Wallet 攻擊。
- **SSRF 防護**：阻擋對內網資源的請求，防止伺服器端請求偽造。
- **IDOR 防護**：分析結果綁定 ownerToken，僅任務發起者可查看。
- **最小化日誌**：後端僅記錄請求摘要，避免洩漏敏感資訊。

## 🎯 未來規劃 (Roadmap)

- [ ] URL/HTML 分析功能
- [ ] 競品分析（SERP 前10名對比）
- [ ] Chrome 擴充功能
- [ ] WordPress / Notion 整合
- [x] 多語言支援（英文、日文）
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
