import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Target, Sparkles } from 'lucide-react'

export default function InputSection({ onAnalyze, onFetchUrl, isLoading }) {
  const editorRef = useRef(null)
  const [contentPlain, setContentPlain] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [contentMarkdown, setContentMarkdown] = useState('')
  const [targetKeywordsInput, setTargetKeywordsInput] = useState('')
  const [mode, setMode] = useState('text')
  const [urlInput, setUrlInput] = useState('')
  const [fetchedUrl, setFetchedUrl] = useState('')
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const [error, setError] = useState('')

  const handleEditorInput = (event) => {
    if (mode !== 'text') return
    const html = event.currentTarget.innerHTML
    const text = event.currentTarget.innerText || ''
    setContentHtml(html)
    setContentPlain(text)

    if (!text.trim()) {
      setContentMarkdown('')
    }
  }

  const handleEditorPaste = (event) => {
    if (mode !== 'text') return
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
    if (mode === 'url' && !fetchedUrl) {
      setError('請先擷取網址內容')
      return
    }
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
      mode,
      contentUrl: mode === 'url' ? fetchedUrl || urlInput.trim() : undefined,
      fetchedUrl: mode === 'url' ? fetchedUrl : undefined,
    }
    onAnalyze(payload, keywords, meta)
  }

  const resetEditorContent = (html = '') => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = html
  }

  const handleModeChange = (nextMode) => {
    if (nextMode === mode || isLoading || isFetchingUrl) return
    setError('')
    setFetchError('')
    setTargetKeywordsInput('')
    if (nextMode === 'text') {
      setMode('text')
      setUrlInput('')
      setFetchedUrl('')
      setContentPlain('')
      setContentHtml('')
      setContentMarkdown('')
      resetEditorContent('')
    } else {
      setMode('url')
      setUrlInput('')
      setFetchedUrl('')
      setContentPlain('')
      setContentHtml('')
      setContentMarkdown('')
      resetEditorContent('')
    }
  }

  const handleFetchUrlContent = async () => {
    if (!onFetchUrl || !urlInput.trim()) {
      setFetchError('請輸入要擷取的網址')
      return
    }
    try {
      setIsFetchingUrl(true)
      setFetchError('')
      setError('')
      const data = await onFetchUrl(urlInput.trim())
      const html = data?.html || ''
      const plain = data?.plain || ''
      const markdown = data?.markdown || ''
      setContentHtml(html)
      setContentPlain(plain)
      setContentMarkdown(markdown)
      setFetchedUrl(data?.finalUrl || urlInput.trim())
      resetEditorContent(html || plain.replace(/\n/g, '<br />'))
      if (!plain.trim()) {
        setFetchError('擷取內容為空，請確認網址是否正確')
      }
    } catch (fetchErr) {
      const message = fetchErr?.message || '擷取網址內容失敗'
      setFetchError(message)
      setContentHtml('')
      setContentPlain('')
      setContentMarkdown('')
      setFetchedUrl('')
      resetEditorContent('')
    } finally {
      setIsFetchingUrl(false)
    }
  }

  useEffect(() => {
    if (mode !== 'url') return
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = contentHtml || contentPlain.replace(/\n/g, '<br />')
  }, [contentHtml, contentPlain, mode])

  // 中文字數統計：移除空白後計算字符數
  const wordCount = useMemo(
    () => contentPlain.trim().replace(/\s/g, '').length,
    [contentPlain]
  )

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => handleModeChange('text')}
            className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'text'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
            } ${isLoading || isFetchingUrl ? 'cursor-not-allowed opacity-60' : ''}`}
            disabled={isLoading || isFetchingUrl}
          >
            貼上文字
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('url')}
            className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'url'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
            } ${isLoading || isFetchingUrl ? 'cursor-not-allowed opacity-60' : ''}`}
            disabled={isLoading || isFetchingUrl}
          >
            貼上網址
          </button>
        </div>

        {mode === 'url' && (
          <div className="mb-6">
            <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
              <FileText className="w-5 h-5 text-primary-600" />
              目標網址
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                className="input-field flex-1"
                placeholder="請輸入要分析的網址"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                disabled={isLoading || isFetchingUrl}
                required
              />
              <button
                type="button"
                onClick={handleFetchUrlContent}
                className="btn-primary whitespace-nowrap px-5"
                disabled={isLoading || isFetchingUrl}
              >
                {isFetchingUrl ? '擷取中...' : '擷取內容'}
              </button>
            </div>
            <div className="mt-2 text-sm">
              {fetchedUrl && (
                <p className="text-primary-600">已擷取內容：{fetchedUrl}</p>
              )}
              {fetchError && (
                <p className="text-red-600">{fetchError}</p>
              )}
              {!fetchedUrl && !fetchError && (
                <p className="text-gray-500">擷取後，內容將顯示於下方供確認（不可編輯）。</p>
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-3">
            <FileText className="w-5 h-5 text-primary-600" />
            {mode === 'text' ? '文章內容' : '擷取內容預覽'}
          </label>
          <div className="relative">
            <div
              ref={editorRef}
              className={`input-field min-h-[300px] resize-y font-mono text-sm whitespace-pre-wrap ${
                error ? 'border-red-500' : ''
              } ${isLoading || mode === 'url' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              contentEditable={mode === 'text' && !isLoading}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              aria-label="文章內容"
            />
            {!contentPlain.trim() && mode === 'text' && (
              <span className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400">
                請貼上您的文章內容...
              </span>
            )}
            {mode === 'url' && !contentPlain.trim() && (
              <span className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400">
                請先輸入網址並擷取內容...
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
            disabled={isLoading || isFetchingUrl}
            required
          />
        </div>

        <button
          type="submit"
          disabled={
            isLoading ||
            isFetchingUrl ||
            !contentPlain.trim() ||
            (mode === 'url' && !fetchedUrl)
          }
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          {isLoading ? '分析中...' : mode === 'url' ? '分析擷取內容' : '開始 AI 分析'}
        </button>
      </form>
    </div>
  )
}
