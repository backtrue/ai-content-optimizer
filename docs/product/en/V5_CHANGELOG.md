# v5 Adaptive Hybrid Scoring Model - Changelog

## Overview
The v5 model is a major upgrade to the v1 scoring mechanism, splitting scores into **40% Structure + 60% AI Strategy**, supporting both HTML and plain text modes, and introducing an asynchronous email notification workflow.

## Core Changes

### 1. Scoring Architecture Upgrade
**v1 (Old)**
- Single composite score (0-100)
- Complex tree-based decision logic
- Underscores plain text input
- Cannot distinguish "structure" from "content strategy"

**v5 (New)**
- Dual-track scoring: Structure (40%) + Strategy (60%)
- Structure Score: Objective signal calculation, stable and fast
- Strategy Score: AI qualitative assessment (WHY/HOW/WHAT framework)
- Auto-adapts to HTML vs plain text mode

### 2. Structure Score (40%) Calculation

#### Mode A - HTML Content
- **Heading Structure** (15%): H1/H2 hierarchy check
- **Content Organization** (12%): Paragraph, list, table count
- **Readability** (10%): Sentence and paragraph length
- **Evidence** (15%): Citations, data, dates
- **Experience** (12%): Case studies, first-hand narratives
- **Freshness** (8%): Publication date, update signals
- **Actionability** (10%): Steps, guides, lists
- **Semantic Quality** (8%): Vocabulary diversity, heading match

#### Mode B - Plain Text Content
- **Content Length** (15%): Word count (ideal 1000+)
- **Content Organization** (15%): Paragraph structure
- **Readability** (15%): Sentence and paragraph length
- **Evidence** (20%): Citations, data, dates
- **Experience** (15%): Case studies, narratives
- **Actionability** (10%): Steps, guides
- **Freshness** (10%): Update signals

### 3. Strategy Score (60%) Calculation

#### WHY / HOW / WHAT Framework
Qualitative assessment based on Gemini AI, each dimension 1-10 points:

1. **WHY - Problem Definition**
   - Does it clearly describe reader pain points?
   - Does the opening explain "why readers need this article"?
   - High score: Specific challenges, pain points, questions
   - Low score: Jumps to solution, lacks problem setup

2. **HOW - Implementation Method**
   - Does it explain the solution's principles and steps?
   - Does it provide concrete guidance on "how" to execute?
   - High score: Step-by-step explanation, practical advice, examples
   - Low score: Only lists conclusions, lacks details

3. **WHAT - Solution**
   - Does the solution truly address the initial problem?
   - Does it clearly summarize "what the solution is" and its value?
   - High score: Clear conclusion, emphasizes reader benefits
   - Low score: Vague, disconnected from problem, lacks conclusion

#### Overall Strategy Score Calculation
```
Strategy Score = (WHY + HOW + WHAT) / 3 × 10
```

### 4. Final Score
```
v5 Overall Score = Structure Score × 0.4 + Strategy Score × 0.6
```

## Asynchronous Workflow

### New Features
- **Email Input**: Users provide email when submitting content
- **Background Queuing**: Tasks enter Cloudflare Queue
- **Async Analysis**: Backend performs analysis without blocking frontend
- **Email Notification**: Results link sent upon completion
- **Results Query**: Users view complete results via email link

### Technology Stack
- **Task Queue**: Cloudflare Queues
- **Results Storage**: Cloudflare KV (7-day expiration)
- **Email Service**: Resend
- **Query Endpoint**: `/api/results/[taskId]`

## Frontend Changes

### New Components
1. **AsyncAnalysisFlow.jsx**
   - Email input form
   - Submission status indicators
   - Task ID display

2. **V5ResultsDashboard.jsx**
   - Dual score display (Structure + Strategy)
   - Detailed score charts
   - WHY/HOW/WHAT visualization
   - Improvement suggestions list

### Removed Features
- Old single-score dashboard
- Synchronous analysis flow (replaced with async)

## API Changes

### Request Format
```json
{
  "content": "Article content",
  "targetKeywords": ["keyword1", "keyword2"],
  "contentFormatHint": "plain|html|auto",
  "email": "user@example.com"  // Required for async flow
}
```

### Response Format
```json
{
  "v5Scores": {
    "structureScore": 75,
    "strategyScore": 65,
    "overallScore": 70,
    "breakdown": {
      "structure": { ... },
      "strategy": { "why": 7, "how": 6, "what": 6 }
    },
    "recommendations": [ ... ]
  },
  "contentSignals": { ... },
  "recommendations": [ ... ]
}
```

### New Endpoints
- `POST /api/analyze` - Submit async analysis (requires email)
- `GET /api/results/[taskId]` - Query analysis results

## Testing and Validation

### Golden Test Set
- 3 representative test cases
- Covers different content types
- Expected WHY/HOW/WHAT score ranges
- Stability verification (std dev < 1.5)

### Run Tests
```bash
node tests/run-golden-tests.js
```

## Migration Guide

### Impact on Existing Users
1. **Score Changes**: New scores not directly comparable to old scores
2. **Workflow Changes**: Synchronous to asynchronous (requires email)
3. **Results Access**: Via email link instead of instant page

### Recommendations
- Notify users of new scoring system
- Explain email notification benefits
- Prepare FAQ documentation

## Cost and Performance

### Cost Estimates
- **Gemini API**: ~$0.001-0.002 per analysis
- **Resend Email**: $0.0001 per email
- **Cloudflare KV**: Low storage cost

### Performance Metrics
- **Structure Score Calculation**: < 100ms
- **Strategy Score Calculation**: 1-3 seconds (Gemini API)
- **Email Delivery**: < 500ms

## Known Limitations

1. **Strategy Score Stability**: Gemini responses may vary ±1-2 points
2. **Language Support**: Currently optimized for Chinese, limited English support
3. **Content Types**: WHY/HOW/WHAT framework best for educational/guide content, news content may score lower

## Future Improvements

- [ ] Multi-language prompt support
- [ ] Prompt variants for different content types
- [ ] Real-time analysis progress tracking
- [ ] Batch analysis support
- [ ] Results history and comparison

## Contact and Support

For questions or suggestions, please contact the product team.
