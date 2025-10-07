// Cloudflare Workers API endpoint for content analysis

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, targetKeyword } = await request.json();

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: '請提供文章內容' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from environment variables
    const openaiApiKey = env.OPENAI_API_KEY;
    const geminiApiKey = env.GEMINI_API_KEY;

    let analysisResult;

    // Try OpenAI first, then fallback to Gemini
    if (openaiApiKey) {
      analysisResult = await analyzeWithOpenAI(content, targetKeyword, openaiApiKey);
    } else if (geminiApiKey) {
      analysisResult = await analyzeWithGemini(content, targetKeyword, geminiApiKey);
    } else {
      // If no API key is available, return mock data for testing
      console.warn('No API key found, returning mock data');
      analysisResult = generateMockAnalysis(content, targetKeyword);
    }

    return new Response(
      JSON.stringify(analysisResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: '分析過程發生錯誤，請稍後再試' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// OpenAI GPT-4 Analysis
async function analyzeWithOpenAI(content, targetKeyword, apiKey) {
  const prompt = buildAnalysisPrompt(content, targetKeyword);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO and AEO content analyst. Analyze content and provide structured feedback in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  
  return result;
}

// Google Gemini Analysis
async function analyzeWithGemini(content, targetKeyword, apiKey) {
  const prompt = buildAnalysisPrompt(content, targetKeyword);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt + '\n\nPlease respond with valid JSON only.'
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const textContent = data.candidates[0].content.parts[0].text;
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/) || textContent.match(/```\n([\s\S]*?)\n```/);
  const jsonString = jsonMatch ? jsonMatch[1] : textContent;
  
  return JSON.parse(jsonString);
}

// Build the analysis prompt
function buildAnalysisPrompt(content, targetKeyword) {
  return `請分析以下文章內容，並提供詳細的 SEO 和 AEO 評分與建議。

文章內容：
${content}

${targetKeyword ? `目標關鍵字：${targetKeyword}` : ''}

請以 JSON 格式回傳分析結果，包含以下結構：

{
  "overallScore": 0-100 的整數,
  "aeoScore": 0-100 的整數,
  "seoScore": 0-100 的整數,
  "metrics": {
    "aeo": [
      {
        "name": "指標名稱",
        "score": 0-10 的整數,
        "description": "簡短描述"
      }
    ],
    "seo": [
      {
        "name": "指標名稱",
        "score": 0-10 的整數,
        "description": "簡短描述"
      }
    ]
  },
  "recommendations": [
    {
      "priority": "high/medium/low",
      "category": "AEO/SEO",
      "title": "建議標題",
      "description": "詳細說明",
      "example": "具體範例（選填）"
    }
  ]
}

評分標準：
AEO 指標應包含：段落獨立性、語言清晰度、實體辨識、邏輯流暢度、可信度信號
SEO 指標應包含：關鍵字分佈、搜尋意圖、主題全面性、內容獨創性

請提供具體、可操作的建議，並按優先級排序。`;
}

// Mock analysis for testing without API key
function generateMockAnalysis(content, targetKeyword) {
  const wordCount = content.trim().split(/\s+/).length;
  const hasKeyword = targetKeyword && content.includes(targetKeyword);
  
  return {
    overallScore: 75,
    aeoScore: 78,
    seoScore: 72,
    metrics: {
      aeo: [
        {
          name: '段落獨立性',
          score: 8,
          description: '段落主題明確，結構良好'
        },
        {
          name: '語言清晰度',
          score: 7,
          description: '語言表達清晰，但部分句子可以更簡潔'
        },
        {
          name: '實體辨識',
          score: 8,
          description: '包含豐富的實體和專有名詞'
        },
        {
          name: '邏輯流暢度',
          score: 8,
          description: '論述邏輯連貫，易於理解'
        },
        {
          name: '可信度信號',
          score: 7,
          description: '建議增加更多數據和來源引用'
        }
      ],
      seo: [
        {
          name: '關鍵字分佈',
          score: hasKeyword ? 7 : 5,
          description: hasKeyword ? '關鍵字出現適中' : '建議增加目標關鍵字'
        },
        {
          name: '搜尋意圖',
          score: 7,
          description: '內容符合使用者搜尋意圖'
        },
        {
          name: '主題全面性',
          score: wordCount > 500 ? 8 : 6,
          description: wordCount > 500 ? '主題涵蓋完整' : '建議擴充內容深度'
        },
        {
          name: '內容獨創性',
          score: 7,
          description: '具有獨特觀點和見解'
        }
      ]
    },
    recommendations: [
      {
        priority: 'high',
        category: 'SEO',
        title: '優化關鍵字密度',
        description: targetKeyword 
          ? `目標關鍵字「${targetKeyword}」在文中出現次數可以增加，建議在標題和結論處自然融入。`
          : '建議設定目標關鍵字並在文章中適當分佈。',
        example: '在文章開頭、中間和結尾各出現 1-2 次'
      },
      {
        priority: 'medium',
        category: 'AEO',
        title: '增強段落獨立性',
        description: '確保每個段落都能獨立表達一個完整的概念，方便 AI 提取和理解。',
        example: '每段開頭用主題句明確說明該段重點'
      },
      {
        priority: 'medium',
        category: 'AEO',
        title: '添加數據支持',
        description: '在關鍵論點處加入具體數據、統計資料或研究結果，提升內容可信度。',
        example: '「根據 2024 年研究顯示，使用此方法可提升 35% 的效率」'
      },
      {
        priority: 'low',
        category: 'SEO',
        title: '擴充相關主題',
        description: '考慮增加相關子主題的討論，提升內容的全面性和深度。'
      }
    ]
  };
}
