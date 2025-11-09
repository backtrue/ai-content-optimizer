import React, { useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * 優化指南彈出視窗
 * 用於顯示搜尋意圖契合等指標的詳細優化指南
 */
export default function GuideModal({ isOpen, onClose, title, content, metricName }) {
  const [expandedSections, setExpandedSections] = useState({})

  if (!isOpen) return null

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  // 解析 Markdown 內容為段落和章節
  const parseContent = (text) => {
    if (!text) return []

    const lines = text.split('\n')
    const sections = []
    let currentSection = null

    lines.forEach((line) => {
      // 一級標題
      if (line.startsWith('# ')) {
        if (currentSection) sections.push(currentSection)
        currentSection = {
          id: `section-${sections.length}`,
          type: 'h1',
          title: line.replace(/^# /, '').trim(),
          content: []
        }
      }
      // 二級標題
      else if (line.startsWith('## ')) {
        if (currentSection && currentSection.content.length > 0) {
          sections.push(currentSection)
          currentSection = null
        }
        if (currentSection) sections.push(currentSection)
        currentSection = {
          id: `section-${sections.length}`,
          type: 'h2',
          title: line.replace(/^## /, '').trim(),
          content: []
        }
      }
      // 三級標題
      else if (line.startsWith('### ')) {
        if (currentSection) {
          currentSection.content.push({
            type: 'h3',
            text: line.replace(/^### /, '').trim()
          })
        }
      }
      // 代碼塊
      else if (line.startsWith('```')) {
        if (currentSection) {
          currentSection.content.push({
            type: 'code-start'
          })
        }
      }
      // 列表項
      else if (line.startsWith('- ')) {
        if (currentSection) {
          currentSection.content.push({
            type: 'li',
            text: line.replace(/^- /, '').trim()
          })
        }
      }
      // 表格
      else if (line.includes('|')) {
        if (currentSection) {
          currentSection.content.push({
            type: 'table-row',
            text: line
          })
        }
      }
      // 普通段落
      else if (line.trim()) {
        if (currentSection) {
          currentSection.content.push({
            type: 'p',
            text: line.trim()
          })
        }
      }
    })

    if (currentSection) sections.push(currentSection)
    return sections
  }

  const sections = parseContent(content)

  const renderContent = (items) => {
    return items.map((item, idx) => {
      switch (item.type) {
        case 'h3':
          return (
            <h3 key={idx} className="text-sm font-semibold text-gray-900 mt-3 mb-2">
              {item.text}
            </h3>
          )
        case 'p':
          return (
            <p key={idx} className="text-sm text-gray-700 mb-2 leading-relaxed">
              {item.text}
            </p>
          )
        case 'li':
          return (
            <li key={idx} className="text-sm text-gray-700 ml-4 mb-1">
              {item.text}
            </li>
          )
        case 'table-row':
          return (
            <div key={idx} className="text-xs text-gray-600 font-mono mb-1 overflow-x-auto">
              {item.text}
            </div>
          )
        case 'code-start':
          return (
            <pre key={idx} className="bg-gray-100 p-2 rounded text-xs text-gray-700 mb-2 overflow-x-auto">
              {item.text}
            </pre>
          )
        default:
          return null
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {metricName && (
              <p className="text-sm text-gray-600 mt-1">指標：{metricName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            aria-label="關閉"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* 內容區域 */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {sections.length > 0 ? (
            sections.map((section) => (
              <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <h3 className={`font-semibold ${
                    section.type === 'h1' ? 'text-base text-gray-900' : 'text-sm text-gray-800'
                  }`}>
                    {section.title}
                  </h3>
                  {expandedSections[section.id] ? (
                    <ChevronUp className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  )}
                </button>

                {expandedSections[section.id] && (
                  <div className="px-4 py-3 bg-white border-t border-gray-200 space-y-2">
                    {renderContent(section.content)}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-600 text-center py-8">無法載入指南內容</p>
          )}
        </div>

        {/* 底部操作 */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}
