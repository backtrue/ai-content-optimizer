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
              AI 內容優化大師
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              透過 AI 深度分析，提升內容的 SEO 與 AEO 表現
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
