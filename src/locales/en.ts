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
    enterValidEmail: 'Please enter a valid email address'
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
  }
}
