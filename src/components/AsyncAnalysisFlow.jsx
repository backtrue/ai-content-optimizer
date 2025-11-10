import React, { useState } from 'react'
import { AlertCircle, Mail, CheckCircle2, Clock } from 'lucide-react'
import { useLocale } from '../locales/useLocale'

/**
 * 非同步分析流程組件
 * 支援 Email 輸入與非同步任務追蹤
 */
export default function AsyncAnalysisFlow({ onSubmit, isLoading }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [taskId, setTaskId] = useState(null)
  const [error, setError] = useState(null)
  const { strings, t } = useLocale()
  const { analysis, common } = strings

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // 驗證 Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError(t('analysis.enterValidEmail'))
      return
    }

    try {
      const result = await onSubmit({ email })
      setTaskId(result.taskId)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || analysis.submitFailed)
    }
  }

  if (submitted && taskId) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">{analysis.queuedTitle}</h3>
        </div>

        <div className="space-y-3 text-sm text-blue-800">
          <p>✅ {analysis.queuedLine1}</p>
          <p>📧 {analysis.queuedLine2}</p>
          <p className="font-mono bg-white p-2 rounded border border-blue-200">{email}</p>

          <div className="bg-white p-3 rounded border border-blue-200 mt-4">
            <p className="text-xs text-gray-600 mb-1">{analysis.taskIdLabel}：</p>
            <p className="font-mono text-xs break-all">{taskId}</p>
          </div>

          <div className="flex items-start gap-2 mt-4 p-3 bg-white rounded border border-blue-200">
            <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs">{analysis.durationHint}</p>
          </div>
        </div>

        <button
          onClick={() => {
            setSubmitted(false)
            setTaskId(null)
            setEmail('')
          }}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          {common.back}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">{analysis.asyncTitle}</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">{analysis.asyncDescription}</p>

      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={analysis.emailPlaceholder || 'your@email.com'}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          disabled={isLoading}
        />

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !email}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium transition-colors"
        >
          {isLoading
            ? analysis.submitting
            : email.trim()
              ? analysis.submitEmail
              : analysis.submit}
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-4">💡 {analysis.helperTip}</p>
    </form>
  )
}
