import { Loader2 } from 'lucide-react'

export default function LoadingSpinner() {
  return (
    <div className="card text-center py-12">
      <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-700 mb-2">AI 正在分析您的內容...</h3>
      <p className="text-gray-500">這可能需要幾秒鐘，請稍候</p>
    </div>
  )
}
