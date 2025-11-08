/**
 * v5 Structure Score Calculator
 * 根據 contentFormatHint 計算 40% 結構分
 * Mode A (HTML): 完整 HTML 訊號檢查
 * Mode B (Plain Text): 純文字訊號檢查
 */

/**
 * 計算結構分（40%）
 * @param {Object} contentSignals - 內容訊號
 * @param {string} contentFormat - 'html' 或 'plain'
 * @returns {Object} { score: 0-100, breakdown: {...}, recommendations: [...] }
 */
export function calculateStructureScore(contentSignals = {}, contentFormat = 'plain') {
  const breakdown = {}
  const weights = {}
  let totalScore = 0
  let totalWeight = 0

  if (contentFormat === 'html') {
    // Mode A: HTML 模式 - 完整檢查
    breakdown.headingStructure = calculateHeadingScore(contentSignals)
    weights.headingStructure = 15
    
    breakdown.contentOrganization = calculateContentOrgScore(contentSignals)
    weights.contentOrganization = 12
    
    breakdown.readability = calculateReadabilityScore(contentSignals)
    weights.readability = 10
    
    breakdown.evidence = calculateEvidenceScore(contentSignals)
    weights.evidence = 15
    
    breakdown.experience = calculateExperienceScore(contentSignals)
    weights.experience = 12
    
    breakdown.freshness = calculateFreshnessScore(contentSignals)
    weights.freshness = 8
    
    breakdown.actionability = calculateActionabilityScore(contentSignals)
    weights.actionability = 10
    
    breakdown.semanticQuality = calculateSemanticScore(contentSignals)
    weights.semanticQuality = 8
  } else {
    // Mode B: 純文字模式 - 簡化檢查
    breakdown.contentLength = calculateLengthScore(contentSignals)
    weights.contentLength = 15
    
    breakdown.contentOrganization = calculateContentOrgScore(contentSignals)
    weights.contentOrganization = 15
    
    breakdown.readability = calculateReadabilityScore(contentSignals)
    weights.readability = 15
    
    breakdown.evidence = calculateEvidenceScore(contentSignals)
    weights.evidence = 20
    
    breakdown.experience = calculateExperienceScore(contentSignals)
    weights.experience = 15
    
    breakdown.actionability = calculateActionabilityScore(contentSignals)
    weights.actionability = 10
    
    breakdown.freshness = calculateFreshnessScore(contentSignals)
    weights.freshness = 10
  }

  // 計算加權平均
  for (const [key, score] of Object.entries(breakdown)) {
    const weight = weights[key] || 0
    totalScore += score * weight
    totalWeight += weight
  }

  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0

  return {
    score: Math.min(100, Math.max(0, finalScore)),
    breakdown,
    weights,
    recommendations: generateStructureRecommendations(breakdown, contentFormat)
  }
}

/**
 * 標題結構評分（HTML 模式）
 */
function calculateHeadingScore(signals) {
  const h1Count = signals.h1Count || 0
  const h2Count = signals.h2Count || 0

  // 理想：1 個 H1，3-5 個 H2
  if (h1Count === 1 && h2Count >= 3 && h2Count <= 5) return 10
  if (h1Count === 1 && h2Count >= 2 && h2Count <= 6) return 8
  if (h1Count >= 1 && h2Count >= 1) return 6
  if (h1Count >= 1) return 4
  return 2
}

/**
 * 內容組織評分
 */
function calculateContentOrgScore(signals) {
  const listCount = signals.listCount || 0
  const tableCount = signals.tableCount || 0
  const paragraphCount = signals.paragraphCount || 0

  // 結構化元素
  const structureScore = Math.min(5, (listCount + tableCount) * 1.5)

  // 段落數量
  let paragraphScore = 0
  if (paragraphCount >= 8) paragraphScore = 5
  else if (paragraphCount >= 5) paragraphScore = 4
  else if (paragraphCount >= 3) paragraphScore = 2
  else paragraphScore = 1

  return Math.round((structureScore + paragraphScore) / 2)
}

/**
 * 可讀性評分
 */
function calculateReadabilityScore(signals) {
  const avgSentenceLength = signals.avgSentenceLength || 0
  const longParagraphCount = signals.longParagraphCount || 0
  const paragraphCount = signals.paragraphCount || 1

  // 句子長度（理想 15-25 字）
  let sentenceScore = 10
  if (avgSentenceLength > 30) sentenceScore = 5
  else if (avgSentenceLength > 25) sentenceScore = 7
  else if (avgSentenceLength < 10) sentenceScore = 6

  // 段落長度（長段落比例）
  const longParagraphRatio = longParagraphCount / paragraphCount
  let paragraphScore = 10
  if (longParagraphRatio > 0.5) paragraphScore = 4
  else if (longParagraphRatio > 0.3) paragraphScore = 7
  else paragraphScore = 9

  return Math.round((sentenceScore + paragraphScore) / 2)
}

/**
 * 證據評分
 */
function calculateEvidenceScore(signals) {
  const evidenceCount = signals.evidenceCount || 0
  const recentYearCount = signals.recentYearCount || 0
  const externalCitationCount = signals.externalCitationCount || 0

  let score = 0
  if (evidenceCount > 5) score += 3
  else if (evidenceCount > 2) score += 2
  else if (evidenceCount > 0) score += 1

  if (recentYearCount > 0) score += 2
  if (externalCitationCount > 0) score += 3

  return Math.min(10, score)
}

/**
 * 經驗評分
 */
function calculateExperienceScore(signals) {
  const experienceCueCount = signals.experienceCueCount || 0
  const caseStudyCount = signals.caseStudyCount || 0
  const hasFirstPersonNarrative = signals.hasFirstPersonNarrative || false

  let score = 0
  if (experienceCueCount > 3) score += 4
  else if (experienceCueCount > 0) score += 2

  if (caseStudyCount > 0) score += 3
  if (hasFirstPersonNarrative) score += 2

  return Math.min(10, score)
}

/**
 * 新鮮度評分
 */
function calculateFreshnessScore(signals) {
  const recentYearCount = signals.recentYearCount || 0
  const hasVisibleDate = signals.hasVisibleDate || false

  let score = 0
  if (hasVisibleDate) score += 5
  if (recentYearCount > 0) score += 5

  return Math.min(10, score)
}

/**
 * 行動性評分
 */
function calculateActionabilityScore(signals) {
  const actionableStepCount = signals.actionableStepCount || 0
  const hasNumberedSteps = signals.hasNumberedSteps || false
  const hasChecklistLanguage = signals.hasChecklistLanguage || false

  let score = 0
  if (actionableStepCount > 5) score += 4
  else if (actionableStepCount > 2) score += 3
  else if (actionableStepCount > 0) score += 1

  if (hasNumberedSteps) score += 2
  if (hasChecklistLanguage) score += 2

  return Math.min(10, score)
}

/**
 * 語意品質評分（HTML 模式）
 */
function calculateSemanticScore(signals) {
  const uniqueWordRatio = signals.uniqueWordRatio || 0
  const titleIntentMatch = signals.titleIntentMatch || 0

  let score = 0
  if (uniqueWordRatio > 0.6) score += 5
  else if (uniqueWordRatio > 0.4) score += 3
  else score += 1

  if (titleIntentMatch > 0.5) score += 3
  else if (titleIntentMatch > 0.2) score += 1

  return Math.min(10, score)
}

/**
 * 內容長度評分（純文字模式）
 */
function calculateLengthScore(signals) {
  const wordCount = signals.wordCount || 0

  // 理想：1000+ 字
  if (wordCount >= 1500) return 10
  if (wordCount >= 1000) return 9
  if (wordCount >= 800) return 7
  if (wordCount >= 500) return 5
  if (wordCount >= 300) return 3
  return 1
}

/**
 * 生成結構分建議
 */
function generateStructureRecommendations(breakdown, contentFormat) {
  const recommendations = []

  // 標題結構
  if (contentFormat === 'html' && breakdown.headingStructure < 6) {
    recommendations.push({
      priority: 'high',
      category: '結構',
      title: '改善標題結構',
      description: '建議使用 1 個 H1 與 3-5 個 H2 標題來組織內容'
    })
  }

  // 內容組織
  if (breakdown.contentOrganization < 6) {
    recommendations.push({
      priority: 'high',
      category: '結構',
      title: '增加結構化元素',
      description: '補充列表、表格或其他結構化元素以提升可掃讀性'
    })
  }

  // 可讀性
  if (breakdown.readability < 6) {
    recommendations.push({
      priority: 'medium',
      category: '讀者體驗',
      title: '改善可讀性',
      description: '拆分長段落或簡化句子結構，提升閱讀體驗'
    })
  }

  // 證據
  if (breakdown.evidence < 5) {
    recommendations.push({
      priority: 'high',
      category: '信任',
      title: '補充佐證資料',
      description: '引用數據、研究或權威來源以增強可信度'
    })
  }

  // 經驗
  if (breakdown.experience < 5) {
    recommendations.push({
      priority: 'medium',
      category: '信任',
      title: '分享實務經驗',
      description: '加入案例研究或第一手經驗以提升說服力'
    })
  }

  // 新鮮度
  if (breakdown.freshness < 5) {
    recommendations.push({
      priority: 'low',
      category: '信任',
      title: '更新發布日期',
      description: '標示最近的更新日期或加入最新年份的資訊'
    })
  }

  // 行動性
  if (breakdown.actionability < 5) {
    recommendations.push({
      priority: 'medium',
      category: '內容',
      title: '提升行動指引',
      description: '補充具體步驟、清單或操作指南'
    })
  }

  return recommendations
}
