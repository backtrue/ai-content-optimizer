import type { UIStrings, SEOMetadata } from './base'

export const enStrings: UIStrings = {
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous'
  },

  nav: {
    home: 'Home',
    about: 'About',
    guides: 'Optimization Guides',
    languageSwitch: 'Language',
    selectLanguage: 'Select Language'
  },

  header: {
    title: 'SrcRank: The AI Content Strategy & AEO Score',
    subtitle: 'Dual-axis scoring for structural integrity and strategic persuasion',
    description:
      'SrcRank analyzes your content on two dimensions—RAG-ready structure and AI strategic persuasion—to help you become a credible, citable source in the generative AI era.'
  },

  hero: {
    intro:
      'This tool is built by Taiwan SEO strategist <strong>Yu-Ting Chiu (Black Teacher)</strong> after years of hands-on research. It blends Google\'s Search Quality Rater Guidelines, Helpful Content Update (HCU), and global SEO evaluation standards to determine whether your content aligns with Google\'s preferences and boosts its chance of being cited by AI systems.',
    disclaimer:
      'Disclaimer: This tool provides third-party diagnostics and optimization suggestions. Search rankings and traffic growth are not guaranteed.'
  },

  dashboard: {
    totalScore: 'Total Score',
    structureScore: 'Structure Score',
    strategyScore: 'Strategy Score',
    why: 'WHY - Problem Definition',
    how: 'HOW - Implementation Method',
    what: 'WHAT - Solution',
    guide: 'Guide',
    viewGuide: 'View Optimization Guide',
    noGuideAvailable: 'No guide available',
    failedToLoadGuide: 'Failed to load optimization guide'
  },

  guides: {
    title: 'Optimization Guides',
    description: 'Detailed content optimization recommendations',
    optimization: 'Optimization Guide',
    reasons: 'Root Causes',
    diagnosis: 'Diagnostic Methods',
    improvements: 'Improvement Strategies',
    actions: 'Action Plan',
    faq: 'Frequently Asked Questions',
    quickReference: 'Quick Reference'
  },

  analysis: {
    submitEmail: 'Submit Email',
    emailPlaceholder: 'Enter your email address',
    submit: 'Submit',
    submitting: 'Submitting...',
    checkResults: 'Check Results',
    resultsWillBeSent: 'Analysis results will be sent to your email',
    enterValidEmail: 'Please enter a valid email address',
    asyncTitle: 'Async Analysis',
    asyncDescription: 'Enter your email and we’ll send the results when the analysis is finished.',
    queuedTitle: 'Analysis Submitted',
    queuedLine1: 'Your content has been added to the analysis queue.',
    queuedLine2: 'We will email the results to:',
    taskIdLabel: 'Task ID',
    durationHint: 'Analysis typically takes 1-5 minutes. Use the link in the email to view full details.',
    helperTip: 'Tip: Async analysis runs in the background so you can keep working while we process your content.',
    submitFailed: 'Submission failed. Please try again.'
  },

  metrics: {
    intentFit: 'Search Intent Satisfaction',
    helpfulRatio: 'Helpful Ratio',
    depthCoverage: 'Content Depth & Coverage',
    intentExpansion: 'Intent Expansion & Keyword Coverage',
    actionability: 'Actionability',
    readabilityRhythm: 'Readability & Narrative Rhythm',
    structureHighlights: 'Structure Highlights',
    authorBrandSignals: 'Author & Brand Recognition',
    evidenceSupport: 'Evidence & Citations',
    experienceSignals: 'First-hand Experience & Case Studies',
    narrativeDensity: 'Narrative Specificity & Information Density',
    freshnessSignals: 'Freshness & Update Signals',
    expertPerspective: 'Expert Perspective & Judgment',
    extractability: 'Answer Extractability',
    keySummary: 'Key Summary & Highlights',
    conversationalGuidance: 'Conversational Tone & Guidance',
    readerActivation: 'Reader Engagement & Follow-up'
  },

  status: {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Needs Improvement',
    veryPoor: 'Urgent Improvement Needed'
  },

  errors: {
    networkError: 'Network connection error',
    serverError: 'Server error',
    invalidInput: 'Invalid input',
    notFound: 'Not found',
    unauthorized: 'Unauthorized'
  },

  input: {
    contentLabel: 'Content',
    contentPlaceholder: 'Paste your article content here...',
    wordCountLabel: 'Word Count',
    wordCountUnit: 'characters',
    keywordsLabel: 'Target Keywords',
    keywordsHint: '(required, 1-5 keywords separated by commas or spaces)',
    keywordsPlaceholder: 'e.g. cast iron care, SEO optimization tips',
    emailLabel: 'Email Address',
    emailOptionalHint: '(optional – add to receive the results by email)',
    emailPlaceholder: 'your.email@example.com',
    submitSync: 'Start AI Analysis',
    submitAsync: 'Submit Analysis (results will be emailed)',
    submitLoading: 'Analyzing...',
    errorEmptyContent: 'Please enter your article content.',
    errorKeywordsRequired: 'Please provide between 1 and 5 target keywords.',
    errorKeywordsMax: 'You can specify up to 5 target keywords only.',
    errorInvalidEmail: 'Please enter a valid email address.'
  },

  results: {
    whyTitle: 'Why - Problem Definition',
    whyDescription: 'Why should you care about this analysis?',
    howTitle: 'How - Implementation Method',
    howDescription: 'How is your score calculated?',
    whatTitle: 'What - Solution',
    whatDescription: 'What can you do to improve?',
    overallScoreTitle: 'v5 Overall Score',
    overallScoreDescription: 'Latest v5 scoring model with structure (40%) and strategy (60%) weighted overall performance.',
    structureScoreTitle: 'Structure Score',
    structureScoreDescription: 'Review whether your content has good structure, readability, evidence, and experience support.',
    strategyScoreTitle: 'Strategy Score',
    strategyScoreDescription: 'Evaluate whether your Why / How / What strategic framework is complete and resonates with your target audience.',
    priorityRecommendations: 'Priority Improvement Recommendations',
    priorityRecommendationsDescription: 'Based on v5 scoring of structure and strategy dimensions, the following recommendations should be prioritized to quickly boost your overall score.',
    structureInsights: 'Structure Insights',
    structureInsightsDescription: 'Focus on paragraph structure, summary organization, conversational tone, and reader engagement to make content more readable and understandable.',
    strategyInsights: 'Strategy Insights',
    strategyInsightsDescription: 'Cover helpfulness, content depth, credibility, and keyword coverage to align your content with search and target reader needs.',
    sourceTextReview: 'Source Text Review',
    sourceTextReviewDescription: 'Review source content paragraph by paragraph, paired with recommendations above to adjust text, examples, and structure.',
    paragraph: 'Paragraph',
    originalContent: 'Original Content',
    tokens: 'Tokens',
    segments: 'Segments',
    format: 'Format',
    collapse: 'Collapse',
    expand: 'Expand',
    keySignals: 'Key Signals',
    evidencePoints: 'Evidence Points',
    noMetricsAvailable: 'No metrics data available at this time.',
    insufficientMetadata: 'Unable to Score: Missing HTML Metadata',
    metadataUnavailable: 'Metadata Detectable',
    schemaUnavailable: 'Schema Detectable',
    undetectableItems: 'Undetectable Items',
    hint: 'Tip: Please paste the complete page HTML or use an API that provides source code so the system can access Meta / Schema / author information and other key tags.',
    detectionStatus: 'Current Detection Status',
    yes: 'Yes',
    no: 'No',
    loadGuideError: 'Unable to load optimization guide, please try again later.',
    loadGuideErrorRetry: 'An error occurred while loading the guide, please try again later.',
    notEvaluatedYet: 'Not Yet Evaluated',
    excellentPerformance: 'Excellent Performance',
    canBeImproved: 'Can Be Improved',
    priorityImprovement: 'Priority Improvement',
    urgentImprovement: 'Urgent Improvement',
    weight: 'Weight',
    highPriority: 'High Priority',
    mediumPriority: 'Medium Priority',
    lowPriority: 'Low Priority',
    suggestion: 'Suggestion',
    category: 'Category',
    lowScoreWarning: 'This metric is currently underperforming. We recommend prioritizing improvements and refer to the metrics and recommendations below for specific actions.'
  },

  scoreCard: {
    scoreComposition: 'Score Composition',
    expandExplanation: 'Show Explanation',
    collapseExplanation: 'Hide Explanation'
  },

  recommendations: {
    title: 'Optimization Recommendations',
    noRecommendations: 'Great! There are currently no areas that need improvement.',
    example: 'Example',
    helpful: 'Helpful',
    notApplicable: 'Not Applicable',
    categoryContent: 'Content',
    categoryTrust: 'Trust',
    categoryExperience: 'Reader Experience'
  },

  v5Dashboard: {
    analyzing: 'Analysis in progress...',
    noResults: 'No Results Available',
    pleaseSubmit: 'Please submit content for analysis',
    overallScore: 'Overall Score',
    outOf: '/100',
    excellent: '🌟 Excellent - Outstanding content quality',
    good: '👍 Good - Solid foundation, room for optimization',
    fair: '⚠️ Fair - Needs improvement',
    needsImprovement: '❌ Needs Improvement - Consider revising content strategy',
    structureScore: 'Structure Score',
    strategyScore: 'Strategy Score',
    structureDetails: 'Structure Details',
    strategyDetails: 'Strategy Details (WHY/HOW/WHAT)',
    whyLabel: 'WHY - Problem Definition',
    howLabel: 'HOW - Implementation Method',
    whatLabel: 'WHAT - Solution',
    weight: 'Weight',
    suggestions: 'Improvement Suggestions',
    detectionStatus: 'Current Detection Status',
    metadataDetectable: 'Metadata Detectable',
    schemaDetectable: 'Schema Detectable',
    yes: 'Yes',
    no: 'No'
  },

  email: {
    subject: '✅ Your AI content analysis is ready',
    headerTitle: '✨ Analysis Complete',
    headerSubtitle: 'Your content has finished the AI strategy evaluation',
    scoreLabel: 'Overall Score / 100',
    structureWeight: 'Structure Score · 40% Weight',
    strategyWeight: 'Strategy Score · 60% Weight',
    recommendationsTitle: 'Priority Action Items',
    recommendationsDescription: 'Start with the items marked in red to maximize score impact.',
    recommendationsEmpty: 'Great news! There are no immediate action items required for now.',
    todoExampleLabel: 'Example',
    viewButton: 'View Full Analysis',
    viewButtonDescription: 'Tap the button to read the full breakdown, WHY / HOW / WHAT analysis, and recommendations.',
    taskIdLabel: 'Task ID',
    footerNotice: '© 2025 AI Content Optimizer | ',
    footerNoReply: 'This email was sent automatically. Please do not reply directly.',
    interpretation: {
      excellent: '🌟 Excellent - Outstanding content quality, strong AI citation potential',
      good: '👍 Good - Solid foundation, room for optimization',
      fair: '⚠️ Fair - Needs improvement, review recommendations',
      poor: '❌ Needs Improvement - Consider revisiting your content strategy'
    },
    priorityLabelHigh: 'High Priority',
    priorityLabelMedium: 'Medium Priority',
    priorityLabelLow: 'Low Priority',
    textTitle: 'AI Content Optimization Result',
    textScoreHeading: 'Overall Score',
    textBreakdownHeading: 'Score Breakdown',
    textRecommendationsHeading: 'Priority Action Items',
    textViewHeading: 'View Full Analysis'
  },

  footer: {
    copy:
      '© 2025 SrcRank (Powered by <span>YuYan Consulting Co., Ltd. (TW)</span> &amp; <a href="https://toldyou.co" target="_blank" rel="noopener noreferrer" class="text-primary-300 hover:text-primary-200 underline">Tōgen Consulting Co., Ltd. (JP)</a>). All rights reserved.'
  },

  resultsPage: {
    missingTaskId: 'Missing Task ID',
    loadingResults: 'Loading Results...',
    queryingResults: 'Querying your analysis results from server',
    queryFailed: 'Query Failed',
    noResults: 'No Results Available',
    checkTaskId: 'Please check if the task ID is correct',
    backToHome: 'Back to Home',
    analysisResults: 'Analysis Results',
    taskId: 'Task ID',
    completedAt: 'Completed At',
    submittedContent: 'Submitted Content',
    characterCount: 'Characters',
    keywords: 'Keywords',
    none: 'None',
    strategyAnalysisDetails: 'Strategy Analysis Details',
    whyProblem: 'WHY - Problem Definition',
    howImplementation: 'HOW - Implementation Method',
    whatSolution: 'WHAT - Solution',
    evidence: 'Evidence',
    improvementSuggestions: 'Improvement Suggestions',
    notFound: 'Result not found. Please check if the task ID is correct or if the result has expired (7 days).',
    resultExpired: 'Query failed'
  },

  scoreHistory: {
    title: 'Score Tracking Dashboard',
    description: 'Keep the latest 200 analyses and establish periodic tracking and automatic export processes.',
    exportButton: 'Export CSV',
    clearButton: 'Clear History',
    noHistory: 'No history records yet. After completing an analysis, the system will automatically add it to the tracking dashboard.',
    averageOverallScore: 'Average Overall Score',
    latestTrend: 'Latest Trend',
    sevenDayAnalysis: '7-Day Analysis',
    nextSchedule: 'Next Schedule',
    notScheduled: 'Not Scheduled',
    notScheduledHint: 'The system uses the latest analysis date + 7 days as the routine review date.',
    trendComparison: 'Compared with the previous overall score',
    sevenDayHint: 'Recommended at least 3 times per week to keep content fresh.',
    nextReviewHint: 'The system uses the latest analysis date + 7 days as the routine review date.',
    latestRecords: 'Latest Analysis Records',
    timeHeader: 'Time',
    keywordsHeader: 'Keywords',
    overallHeader: 'Overall',
    aeoHeader: 'AEO',
    seoHeader: 'SEO',
    gapHeader: 'Gap',
    weakFlagsHeader: 'Weak Flags',
    noGaps: 'None',
    noWeakFlags: 'None',
    exportProcess: 'Export Process',
    maintenanceSuggestions: 'Maintenance Suggestions',
    exportStep1: 'After completing an analysis, the dashboard will automatically add the record.',
    exportStep2: 'Click "Export CSV" to download the latest 200 records.',
    exportStep3: 'Upload the CSV to your data warehouse or Google Sheet for long-term tracking.',
    maintenanceStep1: 'Analyze at least 3 times per week to keep content up-to-date.',
    maintenanceStep2: 'At the beginning of each month, organize the previous month\'s CSV export and update the KPI dashboard.',
    maintenanceStep3: 'When two consecutive scores fall below 60, create a high-priority correction ticket.',
    flat: 'Flat'
  }
}

export const enSEO: Record<string, SEOMetadata> = {
  home: {
    title: 'Content Optimizer AI - SEO & AEO Scoring Analysis Tool',
    description: 'Analyze your content\'s SEO strategy and structure performance with AI-driven scoring. Get detailed optimization recommendations to improve search rankings and AI citation rates.',
    keywords: ['SEO', 'AEO', 'content optimization', 'AI analysis', 'search ranking']
  },
  guides: {
    title: 'Optimization Guides - Content Optimizer AI',
    description: 'Detailed optimization guides for each scoring metric. Understand why your score is low and get actionable improvement strategies.'
  },
  analysis: {
    title: 'Async Content Analysis - Content Optimizer AI',
    description: 'Submit your content for asynchronous AI scoring. Receive structured SEO and AEO insights directly in your inbox once processing completes.',
    keywords: ['async analysis', 'AI content scoring', 'email results', 'content audit']
  },
  results: {
    title: 'Analysis Results Dashboard - Content Optimizer AI',
    description: 'Review your completed AI content analysis with detailed structure and strategy scoring, gap diagnostics, and prioritized improvement actions.',
    keywords: ['analysis results', 'content dashboard', 'SEO insights', 'AEO scoring']
  }
}
