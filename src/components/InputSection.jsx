import { useMemo, useRef, useState } from 'react'
import { FileText, Target, Sparkles } from 'lucide-react'

export default function InputSection({ onAnalyze, isLoading }) {
  const editorRef = useRef(null)
  const [contentPlain, setContentPlain] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [contentMarkdown, setContentMarkdown] = useState('')
  const [targetKeywordsInput, setTargetKeywordsInput] = useState('')
  const [error, setError] = useState('')

  const handleEditorInput = (event) => {
    const html = event.currentTarget.innerHTML
    const text = event.currentTarget.innerText || ''
    setContentHtml(html)
    setContentPlain(text)

    if (!text.trim()) {
      setContentMarkdown('')
    }
  }

  const handleEditorPaste = (event) => {
    const clipboard = event.clipboardData
    if (!clipboard) return

    const markdown = clipboard.getData('text/markdown')
    setContentMarkdown(markdown || '')

    const html = clipboard.getData('text/html')
    if (!html) {
      return
    }

    event.preventDefault()

    const editor = editorRef.current
    if (!editor) {
      return
    }

    editor.focus()

    const selection = typeof window !== 'undefined' ? window.getSelection() : null
    if (!selection) {
      return
    }

    if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    if (
      typeof document !== 'undefined' &&
      typeof document.execCommand === 'function' &&
      (!document.queryCommandSupported || document.queryCommandSupported('insertHTML'))
    ) {
      document.execCommand('insertHTML', false, html)
    } else if (selection.rangeCount) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const fragment = range.createContextualFragment(html)
      range.insertNode(fragment)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    const updatedHtml = editor.innerHTML
    const updatedText = editor.innerText || ''

    setContentHtml(updatedHtml)
    setContentPlain(updatedText)

    if (!updatedText.trim()) {
      setContentMarkdown('')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!contentPlain.trim()) {
      setError('請輸入文章內容')
      return
    }
    // 將輸入字串解析為關鍵字陣列：以逗號或空白分隔
    const keywords = targetKeywordsInput
      .split(/[\s,]+/)
      .map(k => k.trim())
      .filter(Boolean)

    if (keywords.length === 0) {
      setError('請輸入 1-5 個目標關鍵字')
      return
    }
    if (keywords.length > 5) {
      setError('目標關鍵字最多 5 個')
      return
    }

    setError('')
    const payload = {
      plain: contentPlain,
      html: contentHtml,
      markdown: contentMarkdown,
    }
    const meta = {
      mode: 'text'
    }
    onAnalyze(payload, keywords, meta)
  }

  // 中文字數統計：移除空白後計算字符數
  const wordCount = useMemo(
    () => contentPlain.trim().replace(/\s/g, '').length,
    [contentPlain]
  )

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <div className="rounded-lg border border-primary-600 bg-primary-50 px-4 py-3 text-sm text-primary-700">
            目前僅支援貼上文章內容進行評分，網址擷取功能暫時停用。
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
            <FileText className="w-5 h-5 text-primary-600" />
            文章內容
          </label>
          <div className="relative">
            <div
              ref={editorRef}
              className={`input-field min-h-[300px] resize-y font-mono text-sm whitespace-pre-wrap ${
                error ? 'border-red-500' : ''
              } ${isLoading ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              contentEditable={!isLoading}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              aria-label="文章內容"
            />
            {!contentPlain.trim() && (
              <span className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400">
                請貼上您的文章內容...
              </span>
            )}
          </div>
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
            目標關鍵字 <span className="text-sm font-normal text-gray-500">(必填，1-5 個，使用逗號或空白分隔)</span>
          </label>
          <input
            type="text"
            value={targetKeywordsInput}
            onChange={(e) => setTargetKeywordsInput(e.target.value)}
            placeholder="例如：鑄鐵鍋保養、SEO 優化技巧..."
            className="input-field"
            disabled={isLoading}
            required
          />
        </div>

        <button
          type="submit"
          disabled={
            isLoading ||
            !contentPlain.trim()
          }
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          {isLoading ? '分析中...' : '開始 AI 分析'}
        </button>
      </form>
    </div>
  )
}
