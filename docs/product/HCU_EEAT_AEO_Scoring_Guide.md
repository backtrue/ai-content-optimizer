# HCU / EEAT / AEO 評分準則草稿

> 版本：2025-11-01
> 撰寫目的：將目前蒐集到的 SERP 特徵轉換為專注於「內容是否符合 HCU、EEAT、AEO 要求」的評分框架，供後續模型訓練與人工驗證使用。

## 1. 評分目標與共通原則
- **使命對齊**：協助使用者快速、可信地判斷內容在 SEO/AEO 上的成熟度，並指出優化方向。
- **資料來源**：`training_data.json / csv` 中的特徵欄位（由 `serp_collection.py` 分析流程產出）。
- **評分輸出**：建議拆成三大子分數（HCU、EEAT、AEO）與綜合總分，後續模型以此為監督標的。
- **共同品質檢查**：
  1. 缺失值以 `None` / 空字串標示，前處理需補值或保留旗標。
  2. 字串型數值（例：`uniqueWordRatio`）需轉換為浮點數。
  3. `serp_rank` 與 `target_score` 作為參考標籤，但需搭配人工標註強化精度。

## 2. 評分維度與對應特徵

### 2.1 Helpful Content Update（HCU）
| 子指標 | 主要特徵欄位 | 說明 |
| --- | --- | --- |
| Helpful Ratio | `hcuYesRatio`, `hcuPartialRatio`, `hcuNoRatio` | 直接度量內容「Helpful」判定比例，`hcuContentHelpfulness` 可作高層聚合。|
| 使用者需求契合 | `qaFormatScore`, `firstParagraphAnswerQuality`, `semanticParagraphFocus`, `topicCohesion`, `titleIntentMatch`, `searchIntentSatisfaction`(若後續補充) | 反映是否迅速回答問題、維持主題聚焦。|
| 行動可行性 | `actionableScoreNorm`, `referenceKeywordNorm`, `listPresent`, `tablePresent` | 可轉換成實際操作指引的程度。|
| 內容完整度 | `wordCountNorm`, `paragraphCountNorm`, `h2CountNorm`, `longParagraphPenalty`, `avgSentenceLengthNorm` | 描述內容深度與可讀性；同時檢查是否有段落過長需要拆分。|

### 2.2 EEAT（Experience, Expertise, Authoritativeness, Trustworthiness）
| 子指標 | 主要特徵欄位 | 說明 |
| --- | --- | --- |
| 作者與品牌信任 | `authorInfoPresent`, `brandEntityClarity`, `socialMediaLinksPresent`, `organizationSchemaPresent` | 作者／品牌資訊是否清楚呈現。|
| 專業證據 | `externalCitationCount`, `authorityLinkPresent`, `evidenceCountNorm`, `experienceCueNorm` | 是否引用可靠來源、展示第一手經驗。|
| 內容真實性 | `canonicalPresent`, `metaDescriptionPresent`, `hasUniqueTitle`, `hasH1Keyword` | 基本 SEO 技術指標，也能輔助判斷內容是否經過細緻設計。|
| 時效與更新 | `recentYearNorm`, `hasVisibleDate`, `hasModifiedDate`, `freshnessWeakFlag` | 資訊是否保持最新、明確標示更新時間。|
| 安全風險 | `highRiskFlags`（如有）、`safetyWarningPresent`(若補充) | 用於標記可能危害或誤導的內容。|

### 2.3 AEO / GEO（AI-SERP & Generative Experience Optimization）
| 子指標 | 主要特徵欄位 | 說明 |
| --- | --- | --- |
| 精選摘要友好 | `qaFormatScore`, `richSnippetFormat`, `paragraphExtractability`, `semanticNaturalness` | 內容是否容易被抽取為 QA / Rich Result。|
| 結構化標記 | `faqSchemaPresent`, `howtoSchemaPresent`, `articleSchemaPresent`, `multimediaSupport` | 是否提供適合 AI / 多媒體呈現的結構化資料。|
| 可引用性 | `citabilityTrustScore`, `externalCitationCount`, `metaTagsQuality` | AI 回答引用時的可信程度。|
| 行動導向 | `callToActionPresent`(需補充)、`listPresent`, `tablePresent` | 是否提供明確步驟或決策資訊，利於 AI 給建議。|

> **補充**：括號中註記「需補充」代表目前資料尚未覆蓋的欄位，可於後續資料蒐集或解析流程加入。

## 3. 建議權重（草案）
- **HCU**：35%
  - Helpful Ratio 15%
  - 使用者需求契合 10%
  - 行動可行性 5%
  - 內容完整度 5%
- **EEAT**：35%
  - 作者與品牌信任 10%
  - 專業證據 12%
  - 內容真實性 6%
  - 時效與更新 5%
  - 安全風險 2%
- **AEO/GEO**：30%
  - 精選摘要友好 12%
  - 結構化標記 8%
  - 可引用性 6%
  - 行動導向 4%

權重可在模型訓練後視驗證結果微調，或讓模型自行學習；此處提供初始規劃，便於人工檢查對齊。

## 4. 資料品質與前處理需求
1. **缺失值檢查**：各特徵需統計 null 比例，>30% 的欄位視為低可靠度，需補值或降低權重。
2. **型別轉換**：`uniqueWordRatio` 目前為字串，訓練前請轉成浮點數；布林欄位統一轉為 0/1。
3. **標準化與縮放**：對於 `wordCountNorm`, `externalCitationCount` 等 0–1 值，使用 MinMax 縮放可保持原意；對於計數或比率建議保留原尺度。
4. **標籤設計**：
   - 短期可沿用 `target_score` 作為整體品質 proxy。
   - 中長期需建立人工標註集，分別標記 HCU / EEAT / AEO 等級，以提升模型精度。
5. **資料切分**：保持關鍵字層級的 stratified split，避免同一 keyword 的紀錄同時出現在 train/test。

## 5. 後續工作建議
- 依此框架更新 `TASKS.md` 中「資料前處理」與「模型訓練」項目的需求。
- 安排人工標註流程，至少針對 50–100 筆內容標記 HCU / EEAT / AEO 等級，用於校準模型。
- 與產品文件（如 `seo-review-guidelines.md`）同步，確保人工審查與模型策略一致。

## 6. 建議生成規範（2025-11-03 更新）
- **分類統一**：後端建議僅輸出「內容」「信任」「讀者體驗」三大類，`normalizeRecommendation` 會將舊有別名（如 SEO、結構、E-E-A-T 等）映射回這三類，避免技術向分類回流。@functions/api/[[path]].js#476-509
- **黑名單過濾**：合併建議時透過 `containsHtmlEngineering` 判斷 `issue` 與 `action`，凡含 meta/canonical/schema/HTML 指令的項目直接丟棄，確保輸出僅聚焦文本調整。@functions/api/[[path]].js#498-505 @functions/api/[[path]].js#1049-1063
- **Heuristic 限縮**：`generateHeuristicRecommendations` 僅針對內容深度、可信引用與可讀性痛點產生建議，移除原本的結構化標記與技術設定提示。@functions/api/[[path]].js#612-704
- **Prompt 對齊**：`buildAnalysisPrompt` 已強調僅提供內容修正方針，並禁止 meta/canonical/schema 操作；LLM 回傳的建議仍會經上述過濾再輸出，降低技術建議外漏風險。@functions/api/[[path]].js#1745-2014
- **後續事項**：
  1. ✅ 前端建議分類標籤改為「內容／信任／讀者體驗」，並套用別名映射。@src/components/Recommendations.jsx#1-134
  2. ⏳ 撰寫純文字輸入回歸測試，驗證建議輸出不再含 HTML/Schema 指令。@functions/api/[[path]].js#612-704

---

> 此文件為草稿，後續根據模型結果與實務驗證持續修訂。
