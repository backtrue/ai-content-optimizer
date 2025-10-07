import { useState } from 'react'
import { FileText, Target, Sparkles } from 'lucide-react'

export default function InputSection({ onAnalyze, isLoading }) {
  const [content, setContent] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')

  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!content.trim()) {
      setError('請輸入文章內容')
      return
    }
    setError('')
    onAnalyze(content, targetKeyword)
  }

  // 中文字數統計：移除空白後計算字符數
  const wordCount = content.trim().replace(/\s/g, '').length

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
            <FileText className="w-5 h-5 text-primary-600" />
            文章內容
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="請貼上您的文章內容..."
            className={`input-field min-h-[300px] resize-y font-mono text-sm ${
              error ? 'border-red-500' : ''
            }`}
            disabled={isLoading}
          />
          <div className="flex justify-between mt-2">
            <div className="text-sm text-gray-500">
              字數統計: {wordCount} 字
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
            <Target className="w-5 h-5 text-primary-600" />
            目標關鍵字 <span className="text-sm font-normal text-gray-500">(選填)</span>
          </label>
          <input
            type="text"
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            placeholder="例如：鑄鐵鍋保養、SEO 優化技巧..."
            className="input-field"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !content.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          {isLoading ? '分析中...' : '開始 AI 分析'}
        </button>
      </form>
    </div>
  )
}
