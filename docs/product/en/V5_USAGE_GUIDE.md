# v5 Adaptive Hybrid Scoring - Usage Guide

## Quick Start

### 1. Submit Content for Analysis

#### Step 1: Access the Analysis Page
Visit the AI Content Optimizer's analysis page.

#### Step 2: Paste Your Content
- Supports plain text or HTML format
- Recommended: 300+ characters
- System automatically detects format

#### Step 3: Enter Target Keywords
- Maximum 5 keywords
- Separate with commas
- Example: "lutein, eye health, supplements"

#### Step 4: Enter Email Address
- Results link will be sent upon completion
- Ensure email address is correct

#### Step 5: Submit
Click the "Submit Analysis" button. Your content enters the analysis queue.

### 2. Wait for Results

#### Estimated Time
- Analysis typically takes **1-5 minutes**
- May take 10-15 minutes during peak hours

#### Check Progress
- System displays a Task ID
- Save this ID for future reference

#### Receive Email
- You'll receive an email upon completion
- Email contains full results link
- Click link to view detailed analysis

## Understanding Your Score

### Dual-Track Scoring System

The v5 model uses two independent scoring dimensions:

#### Structure Score (40% Weight)
Measures content **organization and presentation**

**For HTML Content**
- Heading structure (H1/H2 hierarchy)
- Paragraphs, lists, tables
- Readability (sentence length)
- Citations and data

**For Plain Text Content**
- Content length
- Paragraph structure
- Readability
- Citations and data

**Improvement Suggestions**
- Add lists or tables
- Break up long paragraphs
- Include citations and data

#### Strategy Score (60% Weight)
Measures content **persuasiveness and completeness**

**WHY - Problem Definition (1-10 points)**
- Does it clearly describe reader pain points?
- Does it explain "why readers need this article"?

**HOW - Implementation Method (1-10 points)**
- Does it explain the solution's principles?
- Does it provide concrete steps or guidance?

**WHAT - Solution (1-10 points)**
- Does it clearly summarize the solution?
- Does it emphasize practical benefits for readers?

**Improvement Suggestions**
- Strengthen problem description specificity
- Add more practical examples
- Clearly summarize the solution

### Overall Score Interpretation

```
Overall Score = Structure Score × 0.4 + Strategy Score × 0.6
```

**Score Ranges**
- **80-100**: 🌟 Excellent - Outstanding content quality, AI citation potential
- **60-79**: 👍 Good - Solid foundation, room for optimization
- **40-59**: ⚠️ Fair - Needs improvement, follow recommendations
- **0-39**: ❌ Needs Improvement - Consider revising content strategy

## Frequently Asked Questions

### Q: Why is my plain text score lower than HTML?
**A:** Plain text mode cannot check HTML tags (H1/H2). Recommendations:
- Add more content (1000+ characters)
- Improve paragraph structure
- Include citations and data

### Q: My WHY score is low. What should I do?
**A:** Your article lacks problem description. Recommendations:
- Clearly identify reader pain points in opening
- Use concrete examples to illustrate problem importance
- Explain "why readers need this article"

### Q: What does a low HOW score mean?
**A:** Your content lacks concrete execution guidance. Recommendations:
- Add step-by-step instructions
- Include practical examples or how-to guides
- Explain solution principles

### Q: My WHAT score is low. How do I improve it?
**A:** Your conclusion or solution is unclear. Recommendations:
- Clearly summarize solution at conclusion
- Emphasize practical benefits for readers
- Avoid vague or overly generic conclusions

### Q: How long until I receive the email?
**A:** Usually 1-5 minutes. If not received within 15 minutes:
- Check spam folder
- Verify email address
- Use Task ID to manually check results

### Q: Can I re-analyze the same article?
**A:** Yes. Each submission generates a new Task ID and analysis.

### Q: How long are results stored?
**A:** Results are stored for 7 days. Save emails or screenshots for future reference.

## Best Practices

### Writing High-Scoring Content

#### 1. Clear Problem Definition (Improve WHY)
```
❌ Poor: "This article introduces lutein supplements."
✅ Good: "As we age, many face vision decline. Lutein is a key nutrient that protects eyes. This guide will help you choose the best supplement."
```

#### 2. Concrete Implementation Steps (Improve HOW)
```
❌ Poor: "Choose a good supplement."
✅ Good: "When selecting supplements, consider:
1. Dosage: 10-20mg daily recommended
2. Form: Free form absorbs faster than esterified
3. Certification: Look for USP or NSF certification
4. Combination: Works better with zeaxanthin"
```

#### 3. Clear Conclusion (Improve WHAT)
```
❌ Poor: "Choosing the right supplement is important."
✅ Good: "In summary, choosing lutein supplements requires considering dosage, form, and certification. Start with 10-20mg dosage, choose reputable brands, and observe effects over 3-6 months."
```

#### 4. Add Evidence (Improve Structure Score)
- Cite research: "2021 research found..."
- Provide specific numbers: "Improved contrast sensitivity by 35%"
- List case studies: "Many consumers report..."

#### 5. Improve Readability (Improve Structure Score)
- Use lists and tables
- Break up long paragraphs (< 380 characters)
- Simplify sentence structure (average 15-25 words)

## Advanced Features

### Batch Analysis (Planned)
Future support for submitting multiple articles for analysis.

### Results Comparison (Planned)
View multiple analysis results for the same article to track improvement.

### Content Type Specialization (Planned)
Specialized scoring frameworks for different content types (news, guides, reviews, etc.).

## Technical Details

### Supported Content Formats
- **Plain Text**: Direct text input
- **HTML**: Web content with tags
- **Markdown**: Automatically converted to plain text

### Content Limits
- **Minimum Length**: 300+ characters recommended
- **Maximum Length**: Unlimited (first 8000 characters analyzed)

### Privacy and Security
- Your content is used only for analysis, not stored or shared
- Email address used only for result notifications
- All communications use encrypted transmission

## Contact Support

For questions or suggestions:
- **Email**: support@content-optimizer.ai
- **Documentation**: docs.content-optimizer.ai
- **Community**: community.content-optimizer.ai
