import { Sparkles } from 'lucide-react'

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              SEOer 的 AEO/GEO 小幫手
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              台灣 SEO 專家邱煜庭（小黑老師）基於 Google《搜尋品質評分者指南》與 HCU 打造的 Gemini 分析儀表板
            </p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              透過 Google 官方搜尋品質評分邏輯、Helpful Content Update 指標與實戰 SEO 實驗，檢測文章是否符合 Google 偏好，並觀測內容被 AI 引用的可行性。
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
