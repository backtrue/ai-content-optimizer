# v5 Frontend Integration Guide

## Overview

This guide explains how to integrate the v5 adaptive hybrid scoring model into your existing frontend application.

## Core Components

### 1. AsyncAnalysisFlow.jsx
**Purpose**: Asynchronous analysis submission form

**Features**
- Content input (supports plain text and HTML)
- Keyword input
- Email input
- Submission status indicators
- Task ID display

**Usage**
```jsx
import AsyncAnalysisFlow from '@/components/AsyncAnalysisFlow'

export default function AnalysisPage() {
  return (
    <div>
      <AsyncAnalysisFlow />
    </div>
  )
}
```

**Props**
- `onSubmitSuccess(taskId)` - Success callback
- `onSubmitError(error)` - Error callback

### 2. V5ResultsDashboard.jsx
**Purpose**: Results display dashboard

**Features**
- Dual score display (Structure + Strategy)
- Detailed score charts
- WHY/HOW/WHAT visualization
- Improvement suggestions list

**Usage**
```jsx
import V5ResultsDashboard from '@/components/V5ResultsDashboard'

export default function ResultsPage() {
  const [results, setResults] = useState(null)
  
  return (
    <V5ResultsDashboard 
      results={results} 
      isLoading={false}
    />
  )
}
```

**Props**
- `results` - Analysis result object (contains v5Scores)
- `isLoading` - Loading state

### 3. ResultsPage.jsx
**Purpose**: Complete results query page

**Features**
- Retrieve taskId from URL parameters
- Auto-fetch results
- Display complete analysis details
- Error handling and retry

**Route Configuration**
```jsx
import ResultsPage from '@/pages/ResultsPage'

// In route configuration
{
  path: '/results/:taskId',
  element: <ResultsPage />
}
```

## Integration Steps

### Step 1: Update Route Configuration

Add the results page to `src/App.jsx` or your route configuration:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AnalysisPage from './pages/AnalysisPage'
import ResultsPage from './pages/ResultsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AnalysisPage />} />
        <Route path="/results/:taskId" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### Step 2: Update Analysis Page

Integrate `AsyncAnalysisFlow` into your analysis page:

```jsx
import AsyncAnalysisFlow from '@/components/AsyncAnalysisFlow'

export default function AnalysisPage() {
  const handleSubmitSuccess = (taskId) => {
    // Optional: Show success notification
    console.log('Task submitted:', taskId)
    // Optional: Navigate to results page
    // window.location.href = `/results/${taskId}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AsyncAnalysisFlow onSubmitSuccess={handleSubmitSuccess} />
    </div>
  )
}
```

### Step 3: Environment Variables

Ensure `.env` or `.dev.vars` contains:

```env
# API endpoint
VITE_API_ENDPOINT=http://localhost:8787/api
# Or production
VITE_API_ENDPOINT=https://api.content-optimizer.ai

# Results page base URL (for email links)
VITE_SITE_URL=http://localhost:5173
# Or production
VITE_SITE_URL=https://content-optimizer.ai
```

### Step 4: API Endpoint Verification

Ensure backend implements these endpoints:

**Submit Analysis**
```
POST /api/analyze
Content-Type: application/json

{
  "content": "Article content",
  "targetKeywords": ["keyword1", "keyword2"],
  "contentFormatHint": "plain|html|auto",
  "email": "user@example.com"
}

Response:
{
  "taskId": "uuid",
  "status": "queued"
}
```

**Query Results**
```
GET /api/results/{taskId}

Response:
{
  "taskId": "uuid",
  "status": "completed",
  "result": {
    "v5Scores": { ... },
    "strategyAnalysis": { ... },
    "recommendations": [ ... ]
  },
  "completedAt": "2025-01-01T00:00:00Z"
}
```

## Style Integration

### Tailwind CSS Configuration

Ensure `tailwind.config.js` is configured:

```js
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Color Scheme

v5 components use the following colors:

- **Structure Score**: Green (#10b981)
- **Strategy Score**: Purple (#8b5cf6)
- **Overall Score**: Blue (#667eea)
- **High Priority**: Red (#ef4444)
- **Medium Priority**: Yellow (#f59e0b)
- **Low Priority**: Blue (#3b82f6)

## Error Handling

### Common Errors and Solutions

**1. 404 - Task Not Found**
```jsx
if (response.status === 404) {
  // Results expired (7 days) or incorrect task ID
  setError('Results expired or invalid task ID')
}
```

**2. 503 - Service Unavailable**
```jsx
// Implement retry logic
const retryFetch = async (url, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      if (response.status === 503) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      throw new Error(`${response.status}`)
    } catch (e) {
      if (i === maxRetries - 1) throw e
    }
  }
}
```

**3. Network Error**
```jsx
try {
  const response = await fetch(url)
} catch (error) {
  // Network connection issue
  setError('Network connection failed. Please check your connection.')
}
```

## Testing

### Local Testing

1. **Start local Worker**
```bash
npm run dev
```

2. **Test submission**
```bash
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "test content",
    "targetKeywords": ["test"],
    "contentFormatHint": "plain",
    "email": "test@example.com"
  }'
```

3. **Test results query**
```bash
curl http://localhost:8787/api/results/{taskId}
```

### Automated Testing

Run E2E tests:
```bash
node tests/e2e-async-flow.js
```

## Performance Optimization

### 1. Results Caching

Cache results on frontend to avoid duplicate queries:

```jsx
const [cache, setCache] = useState({})

const fetchResults = async (taskId) => {
  if (cache[taskId]) {
    return cache[taskId]
  }
  
  const response = await fetch(`/api/results/${taskId}`)
  const data = await response.json()
  
  setCache(prev => ({ ...prev, [taskId]: data }))
  return data
}
```

### 2. Polling Optimization

Use exponential backoff to reduce API calls:

```jsx
const [pollInterval, setPollInterval] = useState(1000)

useEffect(() => {
  const timer = setTimeout(() => {
    fetchResults()
    // Gradually increase polling interval
    setPollInterval(prev => Math.min(prev * 1.5, 10000))
  }, pollInterval)
  
  return () => clearTimeout(timer)
}, [pollInterval])
```

### 3. Chart Optimization

Ensure dashboard charts use efficient rendering:

```jsx
// Use React.memo to avoid unnecessary re-renders
const ScoreCard = React.memo(({ score, label }) => (
  <div>
    <p className="text-2xl font-bold">{score}</p>
    <p className="text-sm text-gray-600">{label}</p>
  </div>
))
```

## Deployment Checklist

- [ ] All components imported
- [ ] Routes configured
- [ ] Environment variables set
- [ ] API endpoints verified
- [ ] Styles applied
- [ ] Error handling implemented
- [ ] Local tests passed
- [ ] E2E tests passed
- [ ] Production URLs updated
- [ ] Email templates verified

## FAQ

**Q: How do I customize dashboard colors?**
A: Modify Tailwind classes in `V5ResultsDashboard.jsx` or extend color configuration in `tailwind.config.js`.

**Q: How do I support multiple languages?**
A: Use i18n libraries (e.g., react-i18next) to provide translations for all text strings.

**Q: How do I handle long-running analyses?**
A: Implement progress indicators or allow users to analyze in background and view results later via email link.

**Q: How do I customize email templates?**
A: Modify HTML and text templates in `functions/api/email-template.js`.

## Contact Support

For integration issues:
- **Technical Support**: tech-support@content-optimizer.ai
- **Documentation**: docs.content-optimizer.ai
