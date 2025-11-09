# PRD 協作：AI 內容優化大師 (v2.0 評分機制)

## 0. 協作目標
我們的目標是將我們在對話中共同協作、迭代並最終確定的「v5 自適應混合評分模型」規格，正式整理並填入這份 PRD 範本中。

我將扮演您的產品經理夥伴，將我們從「Why」到「What」的所有討論和結論，有系統地合成為一份可執行的產品需求文件。

---

## 1. WHY (我們的存在理由：目標)

### 1.1 Introduction (市場現況/問題)
* **目前市場/使用者遇到了什麼問題？**
    1.  **市場轉變：** AI 搜尋（AEO/GEO）正在崛起，傳統的 SEO 關鍵字堆砌和技術指標已不足以保證排名。新的戰場是內容是否能被 AI 理解、信任並「引用」。
    2.  **產品痛點 (v1)：** 我們的 v1 評分機制過於僵化。它嚴重依賴「樹狀判斷」（客觀訊號 `computeContentSignals`].js]），導致「太容易給 0 分」，特別是在使用者貼上「純文字」時，評分與現實脫鉤。
    3.  **缺乏 Aha! Moment：** 使用者最大的疑問是「**改完了，然後呢？**」。v1 產品只提供了「結構」優化，卻沒有提供「策略」上的價值，導致無法創造口碑傳遞。

* **我們看到了什麼機會？**
    1.  **新護城河：** 真正的價值不在於「預測排名」，而在於「**協助使用者寫出 AI 會引用的內容**」。
    2.  **升維打擊：** 我們有機會將產品從一個「SEO 評分器」升級為「**AI 內容策略顧問**」。
    3.  **混合模型：** 我們可以結合「客觀訊號」（穩定、便宜）和「AI 質化評估」（智能、深入）的優點，創造出業界領先的評分模型。

### 1.2 Objectives (我們的成功定義)
* **商業目標：** 透過提供真正解決「改完了，然後呢？」問題的策略價值，提升使用者滿意度和信任感，從而創造「**口碑傳遞**」，實現用戶的自然增長與高黏著度。
* **產品目標：**
    1.  正式實施「**v5 自適應混合評分模型**」，徹底解決 v1「僵化給 0 分」和「情境錯配」的問題。
    2.  將產品的核心價值主張 (Value Proposition) 從「結構優化」轉變為「**策略說服力優化**」。
    3.  提供「**雙軌建議系統**」（結構建議 + 策略建議），給予使用者真正可執行的下一步行動。

---

## 2. WHO (我們的服務對象：人)

### 2.1 Target Group (目標客群)
* (引用自 `產品需求文件 (PRD)_ AI 內容優化大師 (Content Optimizer AI).md`)
* **數位行銷經理：** 需要標準化團隊的內容品質，並監控 AEO 表現。
* **SEO 專家/顧問：** 需要快速診斷內容的「策略」問題，而不僅是「技術」問題。
* **內容創作者/文案寫手：** 希望在寫作當下就獲得「如何把故事說好」的策略反饋，而不只是「缺少 H2 標籤」的技術反饋。

### 2.2 Stakeholders (利害關係人)
* **產品負責人 (您)：** 需確保 v5 模型的改動符合產品願景、成本可控，且真正解決了 v1 的評分落差問題。
* **Gemini API (AI 供應商)：** 我們的 60% 策略分依賴其效能、穩定性與成本。
* **使用者 (TG)：** 需確保 v5 模型的評分和建議是他們能理解、信任並據以行動的。

---

## 3. HOW (我們的體驗設計：故事)

(***這是我們協作的核心：v5 模型如何解決不同 Persona 的痛點***)

### 3.1 Persona (使用者畫像) / User Story 1: 「純文字」創作者
* **背景 (Who)：** **小花**，一名內容文案寫手。她剛在 Notion/Word 寫完一篇草稿，不含任何 HTML。
* **情境 (Where/When)：** 她在發布前，想用我們的工具檢查內容品質。她複製並貼上了「純文字」草稿。
* **核心痛點/需求 (Why)：**
    * (v1 痛點)：v1 工具因為偵測不到 `<h1>`, `<h2>`, `<a>` 標籤，給了她 20 分的超低分，並建議她「加入 H1 標籤」。她感到挫折，因為她在純文字環境中無法做到。
    * (v5 需求)：她需要一個**能理解**她只是在寫「草稿」的工具，並針對她的「**文筆和論述**」給出建議。

### 3.2 User Journey (用戶旅程)
* 1. 小花貼上她的「純文字」草稿。
* 2. 系統後端（`[[path]].js`].js]）偵測到 `contentFormatHint`].js, uploaded:backtrue/ai-content-optimizer/ai-content-optimizer-cc88d196ff5531e0884ab6a6323b34f224c4ce0a/src/App.jsx] 為 'plain'。
* 3. **(40% 結構分)**：系統自動切換到「**Plain Text 結構評分**」。只計算 `wordCount`、`longParagraphCount`、`evidenceCount` 等純文字訊號，給出 35/40 的高分。
* 4. **(60% 策略分)**：系統萃取關鍵段落，發送給 AI 評估「WHY-HOW-WHAT」框架。AI 認為「WHY」和「HOW」很強，但「WHAT (解法)」很弱，給了 30/60 分。
* 5. **(總分)**：小花看到總分 65 分。

### 3.3 Aha! Moment / MOT (關鍵時刻)
* **這個 Persona 的「Wow!」時刻是什麼？**
* 小花**沒有**因為貼上純文字而被懲罰（拿到 0 分）。
* 她收到的建議**不是**「去加 H1 標籤」，而是「**AI 策略建議：** 您的『解決方案 (WHAT)』論述偏弱，建議在結尾處更清晰地總結您的產品如何解決讀者痛點。」
* 小花：「Wow，這個工具看懂了我的**論述**，而不只是我的**格式**。」

### 3.4 User Story 2: 「技術型」SEO 專家
* **背景 (Who)：** **阿文**，一名資深 SEO 顧問。
* **情境 (Where/When)：** 他有一篇舊文章，v1 工具評分 85 分（結構良好），但在 Google 上始終排在第二頁。他對 v1 的評分感到懷疑（「評分與排名脫鉤」）。
* **核心痛點/需求 (Why)：** 他需要知道**為什麼**結構分數高，排名卻上不去。

### 3.5 User Journey (用戶旅程)
* 1. 阿文貼上帶有完整 HTML 的文章內容。
* 2. 系統偵測到 `contentFormatHint`].js, uploaded:backtrue/ai-content-optimizer/ai-content-optimizer-cc88d196ff5531e0884ab6a6323b34f224c4ce0a/src/App.jsx] 為 'html'。
* 3. **(40% 結構分)**：系統啟動「**Rich Content 結構評分**」。完整檢查 `geo-check-gemini.md` 中的所有純內容訊號（H1, H2, UL, A...）。如預期般，拿到 38/40 的高分。
* 4. **(60% 策略分)**：AI 評估「WHY-HOW-WHAT」框架。AI 發現這篇文章雖然結構漂亮，但內容只是資訊整理，缺乏痛點（WHY）和急迫性（HOW）。AI 給了 15/60 的超低分。
* 5. **(總分)**：阿文看到總分 53 分 (38 + 15)。

### 3.6 Aha! Moment / MOT (關鍵時刻)
* **這個 Persona 的「Wow!」時刻是什麼？**
* 阿文終於理解了排名上不去的原因！儀表板清楚地顯示：「**結構分：95/100 (極佳)，策略分：25/100 (差)**」。
* 他收到的建議是：「**AI 策略建議：** 您的『Problem Definition (WHY)』分數極低。文章缺乏對讀者痛點的描繪，導致說服力不足。建議在首段加入...」
* 阿文：「Wow，這工具**點出了 AI (Google) 不引用我的原因**。我的結構沒問題，是我的**策略**出錯了。」

---

## 4. WHAT (我們的具體實現：規格)

(基於 v5 自適應混合模型)

### 4.1 Aspect 1: 後端 - 評分模型核心 (60% AI 策略分)
* **Feature:** 升級 `analyzeWithGemini`].js] 函數。
* **Spec 1.1:** 實作「關鍵段落萃取」邏輯。必須能從全文中，提取出「首段」、「末段」、以及包含「經驗訊號」（`experienceCueCount`）和「佐證訊號」（`evidenceCount`）的段落。
* **Spec 1.2:** 徹底改寫 `buildAnalysisPrompt`].js]。
    * **(MUST)** 移除「`已解析的內容訊號（請務必據此評分...）`」].js] 的硬性指令。
    * **(MUST)** 新 Prompt 必須要求 AI 扮演「內容策略師」。
    * **(MUST)** 新 Prompt 必須要求 AI **僅**針對萃取的段落，對「`Problem Definition (WHY)`」、「`Implication (HOW)`」、「`Solution Fit (WHAT)`」三個指標（1-10分）進行質化評分。
    * **(MUST)** AI 必須回傳 JSON 格式的分數與評語。

### 4.2 Aspect 2: 後端 - 評分模型核心 (40% 自適應結構分)
* **Feature:** 升級 `computeContentSignals`].js] 和 `scoring-model.js`。
* **Spec 2.1:** `computeContentSignals` 必須能接收 `contentFormatHint`].js, uploaded:backtrue/ai-content-optimizer/ai-content-optimizer-cc88d196ff5531e0884ab6a6323b34f224c4ce0a/src/App.jsx] ('html' vs 'plain')。
* **Spec 2.2:** `computeContentSignals` 必須**移除所有**「技術性」檢查（Schema, meta, title, canonical）。
* **Spec 2.3 (Mode A - HTML):** 當 `contentFormatHint` = 'html'，必須啟動「Rich Content 結構評分」，偵測 `geo-check-gemini.md` 和 `aeo-geo-chagpt.md` 中所有「純內容」可偵測的 HTML 訊號（H1, H2, UL, A, IMG alt, Table, 可見的作者/日期文字等）。
* **Spec 2.4 (Mode B - Plain Text):** 當 `contentFormatHint` = 'plain'，必須啟動「Plain Text 結構評分」，**僅**偵測不依賴 HTML 的訊號（wordCount, longParagraphCount, evidenceCount, experienceCueCount, recentYearCount 等）。
* **Spec 2.5:** `scoring-model.js` 必須建立兩套獨立的 40% 結構分計算模型（Mode A 和 Mode B），並由 Spec 2.1 的開關觸發。

### 4.3 Aspect 3: 前端 - 儀表板 (`ResultsDashboard.jsx`)
* **Feature:** 升級儀表板以反映 v5 模型。
* **Spec 3.1:** 儀表板**不應**只顯示一個「總分」。
* **Spec 3.2:** 儀表板**必須**清楚地拆分為兩個獨立的分數：「**結構分數 (40%)**」和「**策略分數 (60%)**」，並顯示各自的得分。
* **Spec 3.3:** 「結構分數」的子指標應根據 Mode A / Mode B 動態顯示。
* **Spec 3.4:** 「策略分數」的子指標必須顯示為 `Problem (WHY)`、`Implication (HOW)`、`Solution (WHAT)`。

### 4.4 Aspect 4: 前端 - 建議系統 (`Recommendations.jsx`)
* **Feature:** 升級建議系統為「雙軌制」。
* **Spec 4.1:** **(軌道 1 - 結構建議)**：來自 40% 結構分。如果是 Mode A (HTML)，建議可以是「H2 標題不足」；如果是 Mode B (Plain Text)，建議必須是「段落過長」。
* **Spec 4.2:** **(軌道 2 - 策略建議)**：來自 60% AI 策略分。建議必須是針對 WHY, HOW, WHAT 的質化建議（例如：「AI 評估您的『WHY』分數偏低，建議...」）。

---

## 5. 待辦/風險 (Open Questions)
* **(風險) AI 成本與延遲：** 即使使用「關鍵段落萃取」，60% 的 AI 策略分仍可能導致成本和 API 延遲上升。需要進行壓力測試。
* **(風險) AI 穩定性：** 60% 的 AI 策略分是否「隨機」？我們需要建立一個「黃金測試集」（Golden Set），包含 10 篇固定的文章，反覆測試 v5 提示，確保 WHY-HOW-WHAT 的評分穩定性。
* **(待辦) 權重調校：** 40% 結構分中，Mode A 和 Mode B 內部的子指標權重（在 `scoring-model.js` 中）需要重新設定和校準。
* **(待辦) 框架適用性：** 「WHY-HOW-WHAT」框架是否適用於所有類型的文章（例如：新聞稿 vs. 產品開箱）？可能需要為不同「內容類型」設計不同的 AI 提示（v5.1）。