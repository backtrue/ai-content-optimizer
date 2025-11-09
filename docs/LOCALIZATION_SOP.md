# 多語系維運 SOP

## 概述

本文檔說明如何維護和更新多語系內容。系統支援三種語系：
- **英文 (en)**：`/` 和 `/guides` 等
- **繁體中文 (zh-TW)**：`/zh-tw` 和 `/zh-tw/guides` 等
- **日文 (ja)**：`/jp` 和 `/jp/guides` 等

## 架構

### 語系檔案位置

```
src/locales/
├── base.ts              # 基礎配置與類型定義
├── zh-TW.ts             # 繁體中文字串與 SEO
├── en.ts                # 英文字串與 SEO
├── ja.ts                # 日文字串與 SEO
└── useLocale.tsx        # React Context 與 Hook
```

### 路由配置

```
src/router/
└── localeRouter.ts      # 多語系路由配置
```

### SEO 管理

```
src/utils/
└── seoManager.ts        # SEO metadata 管理工具
```

## 翻譯流程

### 1. 新增 UI 文案

當需要新增 UI 文案時：

1. **在 `base.ts` 中定義新的 key**
   ```typescript
   export interface UIStrings {
     newSection: {
       newKey: string
     }
   }
   ```

2. **在各語系檔案中添加翻譯**
   - `zh-TW.ts`：新增中文翻譯
   - `en.ts`：新增英文翻譯
   - `ja.ts`：新增日文翻譯

3. **在組件中使用**
   ```typescript
   import { useLocale } from '@/locales/useLocale'
   
   export function MyComponent() {
     const { t } = useLocale()
     return <div>{t('newSection.newKey')}</div>
   }
   ```

### 2. 新增優化指南

當新增優化指南時：

1. **建立指南文件**
   - 中文版：`docs/product/<指南名稱>.md`
   - 英文版：`docs/product/en/<指南名稱>.md`
   - 日文版：`docs/product/ja/<指南名稱>.md`

2. **複製到 public 目錄**
   ```bash
   cp docs/product/en/*.md public/docs/product/en/
   cp docs/product/ja/*.md public/docs/product/ja/
   ```

3. **更新 `openGuideModal` 映射**
   在 `ResultsDashboard.jsx` 中添加指南的路由映射。

### 3. 更新 SEO Metadata

#### 首頁 SEO

編輯 `src/utils/seoManager.ts` 中的 `generateHomeMetadata` 函數：

```typescript
export function generateHomeMetadata(locale: SupportedLocale): SEOMetadata {
  const metadata: Record<SupportedLocale, SEOMetadata> = {
    'zh-TW': { /* 中文 SEO */ },
    en: { /* 英文 SEO */ },
    ja: { /* 日文 SEO */ }
  }
  return metadata[locale]
}
```

#### 指南頁面 SEO

使用 `generateGuideMetadata` 函數為指南頁面生成 SEO：

```typescript
import { generateGuideMetadata, setSEOMetadata } from '@/utils/seoManager'
import { useLocale } from '@/locales/useLocale'

export function GuidePage() {
  const { locale } = useLocale()
  
  useEffect(() => {
    const metadata = generateGuideMetadata(
      '指南標題',
      '指南描述',
      locale
    )
    setSEOMetadata(metadata, locale)
  }, [locale])
}
```

## 版本控管

### 提交翻譯

1. **建立功能分支**
   ```bash
   git checkout -b feat/localization-<feature-name>
   ```

2. **提交翻譯**
   ```bash
   git add src/locales/ docs/product/
   git commit -m "feat: 新增 <功能> 的多語系翻譯

   - 英文版：<描述>
   - 日文版：<描述>
   - SEO metadata：<描述>"
   ```

3. **建立 Pull Request**
   - 標題：`[i18n] <功能名稱>`
   - 描述：列出所有新增/修改的語系檔案

### 審核檢查清單

- [ ] 所有三種語系都有翻譯
- [ ] 沒有硬編碼的中文字串
- [ ] SEO metadata 已更新
- [ ] 指南文件已複製到 public 目錄
- [ ] 路由映射已更新
- [ ] 沒有拼字錯誤

## 常見任務

### 修改現有翻譯

1. 編輯對應的語系檔案（`zh-TW.ts`、`en.ts` 或 `ja.ts`）
2. 更新 key 對應的值
3. 測試前端顯示
4. 提交 PR

### 新增新的指標

1. 在 `base.ts` 的 `UIStrings.metrics` 中添加新的 key
2. 在各語系檔案中添加翻譯
3. 更新 `ResultsDashboard.jsx` 中的指標映射
4. 建立對應的優化指南（中英日三版本）
5. 提交 PR

### 更新 Email 模板

1. 編輯 `src/components/email-template.js` 或相關檔案
2. 在各語系檔案中添加新的 key
3. 在 Email 模板中使用 i18n key
4. 測試 Email 預覽
5. 提交 PR

## 測試

### 本地測試

1. **切換語系**
   - 點擊 Header 中的語系切換選單
   - 驗證 URL 路徑變更（`/` → `/zh-tw` → `/jp`）
   - 驗證所有 UI 文案正確顯示

2. **驗證 SEO**
   - 檢查瀏覽器開發者工具中的 `<head>` 標籤
   - 驗證 `<title>`、`<meta description>`、`<link hreflang>` 等

3. **驗證指南載入**
   - 點擊各指標的「指南」按鈕
   - 驗證指南內容正確載入
   - 檢查各語系版本

### 部署前檢查

```bash
# 檢查是否有未翻譯的 key
npm run lint:i18n

# 檢查 SEO metadata 完整性
npm run check:seo

# 執行 E2E 測試
npm run test:e2e
```

## 故障排除

### 指南無法載入

1. 檢查 `public/docs/product/` 目錄中是否存在對應的 Markdown 檔案
2. 驗證 `ResultsDashboard.jsx` 中的檔案名稱映射是否正確
3. 檢查瀏覽器控制台是否有 404 錯誤

### 語系切換無效

1. 檢查 LocalStorage 是否被禁用
2. 驗證 URL 路由是否正確配置
3. 清除瀏覽器快取並重新載入

### SEO metadata 未更新

1. 檢查 `setSEOMetadata` 是否在正確的生命週期中被呼叫
2. 驗證 `<head>` 標籤中是否有重複的 meta 標籤
3. 檢查是否有其他腳本覆蓋了 SEO metadata

## 相關資源

- [i18n 架構文檔](./I18N_ARCHITECTURE.md)
- [SEO 最佳實踐](./SEO_BEST_PRACTICES.md)
- [路由配置指南](./ROUTING_GUIDE.md)
