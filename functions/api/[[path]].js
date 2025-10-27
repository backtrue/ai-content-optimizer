// Cloudflare Workers API endpoint for content analysis

function stripTrailingComma(text) {
  return typeof text === 'string' ? text.replace(/,\s*$/u, '') : text;
}

function appendMissingClosers(text) {
  if (typeof text !== 'string') return text;
  const stack = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      stack.push('}');
    } else if (ch === '[') {
      stack.push(']');
    } else if ((ch === '}' || ch === ']') && stack.length) {
      const expected = stack[stack.length - 1];
      if (expected === ch) {
        stack.pop();
      } else {
        break;
      }
    }
  }
  return text + stack.reverse().join('');
}

async function analyzeWithGemini(content, targetKeywords, env) {
  try {
    console.log('Starting Gemini API call...');
    
    const apiKey = env && env.GEMINI_API_KEY ? env.GEMINI_API_KEY : null;
    
    if (!apiKey) {
      console.error('Gemini API key is missing');
    }

    // 控制輸入長度避免超出總tokens
    const MAX_CONTENT_CHARS = 8000;
    const truncatedContent = typeof content === 'string' ? content.slice(0, MAX_CONTENT_CHARS) : content;
    const prompt = buildAnalysisPrompt(truncatedContent, targetKeywords);
    console.log('Prompt length:', prompt.length);
    
    // 動態選擇可用模型：呼叫 v1 ListModels 並挑選支援 generateContent 的 2.x 或 1.5 模型
    const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    console.log('Listing models from:', listUrl);
    const listRes = await fetch(listUrl);
    const listText = await listRes.text();
    if (!listRes.ok) {
      throw new Error(`ListModels failed (${listRes.status} ${listRes.statusText}): ${listText}`);
    }
    const listData = JSON.parse(listText);
    const models = Array.isArray(listData.models) ? listData.models : [];
    // 偏好順序：2.5 > 2.0 > 1.5 > 1.0；且要有 generateContent 支援
    const prefer = [
      'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-pro', 'gemini-2.0-flash',
      'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'
    ];
    let chosen = null;
    for (const name of prefer) {
      const m = models.find(x => x.name?.includes(name) && (x.supportedGenerationMethods?.includes('generateContent') || x.supportedGenerationMethods?.includes('generateText')));
      if (m) { chosen = m; break; }
    }
    // 若未命中，退而求其次：任一支援 generateContent 的模型
    if (!chosen) {
      chosen = models.find(x => x.supportedGenerationMethods?.includes('generateContent') || x.supportedGenerationMethods?.includes('generateText'));
    }
    if (!chosen || !chosen.name) {
      throw new Error('No available Gemini model supporting generateContent for this API key/project');
    }
    const chosenModel = chosen.name.replace('models/', '');
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${chosenModel}:generateContent?key=${apiKey}`;
    console.log('Chosen model:', chosenModel);
    console.log('API URL:', apiUrl);
    
    // 簡化請求體，只包含必要字段
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt + '\n\n請以有效的 JSON 格式回應，不要包含任何其他文字。'
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 4096
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };
    
    console.log('Sending request to Gemini API...');
    console.log('Request URL:', apiUrl);
    console.log('Request payload summary:', JSON.stringify({
      contentLength: typeof truncatedContent === 'string' ? truncatedContent.length : 0,
      keywordCount: targetKeywords.length,
      temperature: requestBody.generationConfig.temperature,
      maxOutputTokens: requestBody.generationConfig.maxOutputTokens
    }, null, 2));
    
    let response;
    let responseText;

    const tryOnce = async () => {
      return fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    };

    // Internal retries for transient errors (429/503)
    const maxRetries = 2;
    let attempt = 0;
    let lastStatus = 0;
    while (attempt <= maxRetries) {
      response = await tryOnce();
      responseText = await response.text();
      console.log('Response status:', response.status, response.statusText);
      
      // 記錄響應頭和部分響應體（不記錄敏感信息）
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = key.toLowerCase().includes('key') ? '***REDACTED***' : value;
      });
      console.log('Response headers:', JSON.stringify(responseHeaders, null, 2));
      
      // 只記錄響應體的前 500 個字符，避免日誌過大
      console.log('Response body length:', typeof responseText === 'string' ? responseText.length : 0);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        const responseSummary = {
          candidateCount: Array.isArray(data?.candidates) ? data.candidates.length : 0,
          finishReason: data?.candidates?.[0]?.finishReason ?? data?.candidates?.[0]?.finish_reason ?? null,
          promptTokens: data?.usageMetadata?.promptTokenCount ?? data?.usage?.prompt_tokens ?? null,
          responseTokens: data?.usageMetadata?.candidatesTokenCount ?? data?.usage?.completion_tokens ?? null
        };
        console.log('Parsed response summary:', JSON.stringify(responseSummary, null, 2));
        
        const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) ? data.candidates[0].content.parts : [];
        const textPart = Array.isArray(parts) ? parts.find(p => typeof p.text === 'string') : undefined;
        if (!textPart || !textPart.text) {
          console.warn('No text part found in response. Returning raw response for debugging.');
          return { rawResponse: data };
        }

        // Try to parse JSON from text
        let jsonString = textPart.text;
        const jsonMatch = jsonString.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1];
        }
        try {
          const parsed = JSON.parse(jsonString);
          return parsed;
        } catch (e) {
          console.error('Failed to parse JSON from text part, returning raw text.', e);
          return { rawText: textPart.text, rawResponse: data };
        }
      }

      lastStatus = response.status;
      if (response.status === 429 || response.status === 503) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`Gemini transient error ${response.status}, retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
        attempt += 1;
        continue;
      }

      if (!response.ok) {
        let errorDetails;
        try {
          const errorJson = JSON.parse(responseText);
          // 過濾掉可能的敏感信息
          if (errorJson.error && errorJson.error.message) {
            errorDetails = errorJson.error.message;
          } else {
            errorDetails = JSON.stringify(errorJson, (key, value) => 
              key.toLowerCase().includes('key') ? '***REDACTED***' : value, 2);
          }
        } catch (e) {
          errorDetails = 'Failed to parse error response';
        }
        
        const errorMessage = `Gemini API 錯誤 (${response.status} ${response.statusText}): ${errorDetails}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
  } catch (error) {
    console.error('Unexpected error in analyzeWithGemini:', error);
    // Fallback: if model is overloaded or rate-limited, return mock to keep UX responsive
    if (String(error.message || '').includes('503') || String(error.message || '').includes('429')) {
      console.warn('Gemini overloaded/rate-limited, falling back to mock analysis (outer catch)');
      const firstKeyword = Array.isArray(targetKeywords) && targetKeywords.length ? targetKeywords[0] : '';
      return generateMockAnalysis(content || '', firstKeyword);
    }
    throw error;
  }
}

function stripMarkdownFences(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function tryParseJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text.trim();
  const attempts = new Set();

  const enqueue = (candidate) => {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) attempts.add(trimmed);
    }
  };

  enqueue(cleaned);
  enqueue(stripTrailingComma(cleaned));
  enqueue(appendMissingClosers(cleaned));
  enqueue(appendMissingClosers(stripTrailingComma(cleaned)));

  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastBrace !== -1) {
    const slice = cleaned.slice(0, lastBrace + 1);
    enqueue(slice);
    enqueue(appendMissingClosers(slice));
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      continue;
    }
  }

  console.error('tryParseJson failed after repair attempts', cleaned.slice(0, 200));
  return null;
}

export async function onRequestPost(context) {
  console.log('=== 收到分析請求 ===');
  const { request, env } = context;
 

  // 記錄請求頭部信息
  console.log('請求頭部:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://ragseo.thinkwithblack.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('開始解析請求體...');
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('請求體解析成功:', JSON.stringify({
        contentLength: requestBody.content?.length || 0,
        hasTargetKeywords: Array.isArray(requestBody.targetKeywords),
        targetKeywordLegacy: !!requestBody.targetKeyword
      }, null, 2));
    } catch (e) {
      console.error('解析請求體失敗:', e);
      throw new Error('無效的 JSON 請求體');
    }
    
    const contentVariants = normalizeContentVariants(requestBody);
    const {
      plain: contentPlain,
      html: contentHtml,
      markdown: contentMarkdown,
      hint: contentFormatHint
    } = contentVariants;
    const primaryContent = derivePrimaryPlainContent(contentVariants);
    const normalizedContentVariants = {
      ...contentVariants,
      plain: primaryContent
    };
    const chunkSourceText = deriveChunkSourceText(normalizedContentVariants);
    const chunkSourceFormat = guessChunkSourceFormat(normalizedContentVariants);

    console.log('請求體解析成功:', JSON.stringify({
      contentLengthLegacy: typeof requestBody.content === 'string' ? requestBody.content.length : 0,
      contentPlainLength: normalizedContentVariants.plain.length,
      contentHtmlLength: normalizedContentVariants.html.length,
      contentMarkdownLength: normalizedContentVariants.markdown.length,
      contentFormatHint: normalizedContentVariants.hint,
      hasTargetKeywords: Array.isArray(requestBody.targetKeywords),
      targetKeywordLegacy: !!requestBody.targetKeyword
    }, null, 2));

    if (!normalizedContentVariants.plain.trim()) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize target keywords
    let targetKeywords = [];
    if (Array.isArray(requestBody.targetKeywords)) {
      targetKeywords = requestBody.targetKeywords;
    } else if (typeof requestBody.targetKeywords === 'string') {
      targetKeywords = requestBody.targetKeywords.split(/[\s,]+/);
    } else if (typeof requestBody.targetKeyword === 'string') { // 兼容舊版
      targetKeywords = requestBody.targetKeyword.split(/[\s,]+/);
    }
    targetKeywords = targetKeywords.map(k => String(k).trim()).filter(Boolean);

    if (targetKeywords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'targetKeywords 是必填，請輸入 1-5 個關鍵字' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (targetKeywords.length > 5) {
      return new Response(
        JSON.stringify({ error: '最多只允許 5 個關鍵字', received: targetKeywords.length }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('目標關鍵字:', targetKeywords);

    const returnChunks = Boolean(requestBody.returnChunks);

    // 從環境變量獲取 API 密鑰
    const geminiApiKey = env.GEMINI_API_KEY;
    console.log('GEMINI_API_KEY 長度:', geminiApiKey ? `${geminiApiKey.substring(0, 5)}...${geminiApiKey.substring(geminiApiKey.length - 3)}` : '未設置');
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('開始處理分析請求...');
    let analysisResult;
    try {
      analysisResult = await analyzeWithGemini(normalizedContentVariants.plain, targetKeywords, env);
      console.log('分析成功完成');
      analysisResult = coerceAnalysisResult(analysisResult);
    } catch (error) {
      console.error('分析過程中出錯:', error);
      const msg = String(error && error.message ? error.message : '');
      if (msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded')) {
        console.warn('偵測到模型過載/速率限制，改用模擬分析結果以維持體驗');
        const firstKeyword = Array.isArray(targetKeywords) && targetKeywords.length ? targetKeywords[0] : '';
        analysisResult = generateMockAnalysis(normalizedContentVariants.plain, firstKeyword);
      } else {
        throw new Error(`分析失敗: ${error.message}`);
      }
    }
    // 可選：回傳 chunk 視覺化資料
    let payload = normalizeAnalysisResult(analysisResult);
    if (returnChunks && chunkSourceText) {
      const chunks = chunkContent(chunkSourceText, {
        format: chunkSourceFormat,
        html: normalizedContentVariants.html,
        markdown: normalizedContentVariants.markdown,
        plain: normalizedContentVariants.plain
      });
      payload = { ...payload, chunks, chunkSourceFormat };
    }

    return new Response(
      JSON.stringify(payload),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    const errorResponse = { 
      error: 'Failed to process request',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      details: {
        name: error.name,
        ...(error.response?.status && { status: error.response.status }),
        ...(error.response?.statusText && { statusText: error.response.statusText }),
        ...(error.config && { 
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers
        })
      }
    };
    
    console.error('Error details:', JSON.stringify(errorResponse, null, 2));
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
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

function coerceAnalysisResult(result, depth = 0) {
  if (!result || typeof result !== 'object') return result;
  if (depth > 2) return result;

  const hasCoreFields =
    typeof result.overallScore === 'number' ||
    typeof result.aeoScore === 'number' ||
    typeof result.seoScore === 'number' ||
    (result.metrics && typeof result.metrics === 'object' && (result.metrics.aeo || result.metrics.seo));

  if (hasCoreFields) {
    return result;
  }

  const rawTextCandidates = [];

  if (typeof result.rawText === 'string') {
    rawTextCandidates.push(result.rawText);
  }

  if (result.rawResponse && typeof result.rawResponse === 'object') {
    const candidateText = extractTextFromRawResponse(result.rawResponse);
    if (candidateText) {
      rawTextCandidates.push(candidateText);
    }
  }

  for (const candidate of rawTextCandidates) {
    const cleaned = stripMarkdownFences(candidate);
    if (!cleaned) continue;
    const parsed = tryParseJson(cleaned);
    if (parsed) {
      const coerced = coerceAnalysisResult(parsed, depth + 1);
      if (coerced !== parsed) {
        return coerced;
      }
      return parsed;
    }
  }

  return { ...result };
}

function extractTextFromRawResponse(rawResponse) {
  try {
    const candidates = rawResponse?.candidates;
    if (!Array.isArray(candidates) || !candidates.length) return null;
    const parts = candidates[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const textPart = parts.find((part) => typeof part.text === 'string');
    return textPart?.text ?? null;
  } catch (error) {
    console.error('extractTextFromRawResponse failed', error);
    return null;
  }
}

// Build the analysis prompt (multiple keywords)
function buildAnalysisPrompt(content, targetKeywords) {
  const keywordsList = Array.isArray(targetKeywords) ? targetKeywords.filter(Boolean).join(', ') : '';
  return `你是一位嚴謹的 SEO 與 AEO 分析專家。請僅依據使用者提供的目標關鍵字進行分析，不要臆測或自行假設任何關鍵字。

文章內容：
${content}

目標關鍵字（1-5 個，僅限以下清單）：${keywordsList}

請以 JSON 格式回傳分析結果，包含以下結構：
{
  "overallScore": 整數(0-100),
  "aeoScore": 整數(0-100),
  "seoScore": 整數(0-100),
  "metrics": {
    "aeo": [
      { "name": "段落獨立性", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "語言清晰度", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "實體辨識", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "邏輯流暢度", "score": 整數(0-10), "description": "簡短描述" },
      { "name": "可信度信號", "score": 整數(0-10), "description": "簡短描述" }
    ],
    "seo": [
      { "name": "E-E-A-T 信任線索", "weight": 18, "score": 整數(0-10), "description": "評估文本中呈現的專業背景、經驗與可信度證據（如作者簡介、引用來源）", "evidence": ["指出文本中的可信度線索，若缺少請說明"] },
      { "name": "內容品質與原創性", "weight": 18, "score": 整數(0-10), "description": "衡量內容是否提供深度洞察、獨特案例或自家觀點，而非重複常識", "evidence": ["列出展現原創洞察或研究的段落"] },
      { "name": "人本與主題一致性", "weight": 12, "score": 整數(0-10), "description": "判斷內容是否為真實使用者需求而寫，並與文中標題/主題保持一致", "evidence": ["說明內容如何回應使用者需求或指出偏離之處"] },
      { "name": "標題與承諾落實", "weight": 10, "score": 整數(0-10), "description": "檢查標題或開頭承諾是否在正文中兌現，避免誇大", "evidence": ["比較標題/開頭與正文的對應關係"] },
      { "name": "搜尋意圖契合度", "weight": 12, "score": 整數(0-10), "description": "衡量內容是否完整回答主要問題或達成相關任務", "evidence": ["指出滿足意圖的段落，或註記缺少資訊"] },
      { "name": "新鮮度與時效性", "weight": 8, "score": 整數(0-10), "description": "檢視文本是否提供最新數據、更新時間或具時效性的資訊", "evidence": ["列出最新年份或說明資訊過時"] },
      { "name": "使用者安全與風險", "weight": 12, "score": 整數(0-10), "description": "評估內容是否含有潛在誤導、風險或未標示的限制／免責", "evidence": ["指出危險段落或說明安全防護措施"] },
      { "name": "結構與可讀性", "weight": 10, "score": 整數(0-10), "description": "判斷段落結構、排版提示、語句長度是否有利於閱讀與行動裝置瀏覽", "evidence": ["示例說明段落、列表或格式改善點"] }
    ]
  },
  "perKeyword": [
    { "keyword": "...", "density": "...", "intentFit": "...", "coverage": "..." }
  ],
  "recommendations": [
    { "priority": "high|medium|low", "category": "AEO|SEO|E-E-A-T|Safety", "title": "...", "description": "...", "example": "..." }
  ],
  "highRiskFlags": [
    { "type": "harm|deception|spam", "severity": "critical|warning", "summary": "...", "action": "..." }
  ]
}

重要：
- 僅使用提供的目標關鍵字進行分析，不得臆測新增或替換。
- 僅依據貼上內容本身的文字線索進行評估；若文本未提供所需資訊，請於 description 與 evidence 中明確標註「文本未提供」。
- 若內容不足以評估，請在描述與建議中明確指出不足與需要補充的資訊。
- highRiskFlags 為必填欄位，若無風險請輸出空陣列。
- 必須輸出上述 8 項 \`metrics.seo\` 指標，不可刪減或整併。
- 每項 description 請以 1–2 句繁體中文撰寫，總字數不超過 70 字。
- 每項 evidence 最多 2 條，單條字數不超過 40 字。
- 嚴禁輸出 Markdown 圍欄或額外文字，僅回傳合法 JSON。`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && value.length) return value.join('\n');
  }
  return '';
}

function coerceString(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(coerceString).join('\n');
  if (typeof value === 'object' && typeof value.toString === 'function') return value.toString();
  return '';
}

function normalizeContentVariants(source = {}) {
  const plain = firstNonEmpty(
    source.contentPlain,
    source.plain,
    typeof source.content === 'string' ? source.content : '',
    source.text
  );
  const html = firstNonEmpty(source.contentHtml, source.html, source.rawHtml);
  const markdown = firstNonEmpty(source.contentMarkdown, source.markdown, source.rawMarkdown);
  const hintSource = coerceString(source.contentFormatHint || source.hint || '');
  const hint = hintSource.trim().toLowerCase();

  return {
    plain: coerceString(plain),
    html: coerceString(html),
    markdown: coerceString(markdown),
    hint: hint === 'html' || hint === 'markdown' || hint === 'plain' ? hint : ''
  };
}

function derivePrimaryPlainContent(variants) {
  const plain = coerceString(variants?.plain || '').trim();
  if (plain) return normalizeWhitespace(plain);

  const markdown = coerceString(variants?.markdown || '').trim();
  if (markdown) return normalizeWhitespace(markdownToPlain(markdown));

  const html = coerceString(variants?.html || '').trim();
  if (html) return normalizeWhitespace(htmlToStructuredText(html));

  return '';
}

function deriveChunkSourceText(variants) {
  if (!variants) return '';
  const hint = variants.hint;
  const html = coerceString(variants.html || '').trim();
  const markdown = coerceString(variants.markdown || '').trim();
  const plain = coerceString(variants.plain || '').trim();

  if (hint === 'html' && html) return normalizeWhitespace(htmlToStructuredText(html));
  if (hint === 'markdown' && markdown) return normalizeWhitespace(markdownToStructuredText(markdown));
  if (html && !plain && !markdown) return normalizeWhitespace(htmlToStructuredText(html));
  if (markdown && !plain) return normalizeWhitespace(markdownToStructuredText(markdown));

  return normalizeWhitespace(plain || markdownToStructuredText(markdown) || htmlToStructuredText(html));
}

function guessChunkSourceFormat(variants) {
  if (!variants) return 'plain';
  if (variants.hint === 'html' || variants.hint === 'markdown' || variants.hint === 'plain') {
    if (variants.hint === 'html' && !coerceString(variants.html).trim()) return 'plain';
    if (variants.hint === 'markdown' && !coerceString(variants.markdown).trim()) return 'plain';
    return variants.hint;
  }
  if (coerceString(variants.html).trim()) return 'html';
  if (coerceString(variants.markdown).trim()) return 'markdown';
  return 'plain';
}

function htmlToStructuredText(html) {
  if (typeof html !== 'string' || !html.trim()) return '';
  let output = html.replace(/\r\n/g, '\n');
  output = output.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1>/gi, '');

  output = output.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const prefix = '#'.repeat(Number(level) || 1);
    const headingText = stripHtmlTags(inner).trim();
    return `\n${prefix} ${headingText}\n`;
  });

  const blockTags = [
    'p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'nav',
    'li', 'ul', 'ol', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'figure', 'figcaption'
  ];
  for (const tag of blockTags) {
    const regex = new RegExp(`<\\s*${tag}[^>]*>`, 'gi');
    output = output.replace(regex, '\n');
    const closeRegex = new RegExp(`<\\/\\s*${tag}\\s*>`, 'gi');
    output = output.replace(closeRegex, '\n');
  }

  output = output.replace(/<br\s*\/?\s*>/gi, '\n');
  output = stripHtmlTags(output);
  output = decodeBasicEntities(output);
  return normalizeWhitespace(output);
}

function markdownToStructuredText(markdown) {
  if (typeof markdown !== 'string') return '';
  return normalizeWhitespace(markdown.replace(/\r\n/g, '\n'));
}

function markdownToPlain(markdown) {
  const structured = markdownToStructuredText(markdown);
  return normalizeWhitespace(stripMarkdown(structured));
}

function stripMarkdown(markdown) {
  if (!markdown) return '';
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}(#{1,6})\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/>\s?/g, '')
    .replace(/\|\s?\|/g, ' ');
}

function stripHtmlTags(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ');
}

function decodeBasicEntities(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeWhitespace(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \f\v]{2,}/g, ' ')
    .trim();
}

// 結構化 chunking 輔助工具（參考 chunkr 階層式分段概念）
function chunkContent(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const normalized = text.replace(/\r\n/g, '\n');
  const config = {
    targetTokens: clampPositiveInteger(options.targetTokens, 520),
    maxTokens: clampPositiveInteger(options.maxTokens, 680),
    minTokens: clampPositiveInteger(options.minTokens, 140),
    overlapTokens: clampNonNegativeInteger(options.overlapTokens, 80),
    includeLeadingContext: options.includeLeadingContext !== false,
    maxChunks: clampPositiveInteger(options.maxChunks, 500)
  };
  const sourceFormat = typeof options.format === 'string' ? options.format : 'plain';

  if (config.maxTokens < config.targetTokens) {
    config.maxTokens = config.targetTokens + 40;
  }
  if (config.minTokens > config.targetTokens) {
    config.minTokens = Math.max(60, Math.floor(config.targetTokens * 0.4));
  }

  const segments = segmentContent(normalized, config);
  if (!segments.length) {
    const fallbackText = normalized.trim();
    return fallbackText
      ? [
          {
            id: 1,
            start: 0,
            end: fallbackText.length,
            text: fallbackText,
            tokens: estimateTokens(fallbackText),
            segmentCount: 1,
            headings: [],
            leadingContext: '',
            sourceFormat
          }
        ]
      : [];
  }

  const blueprints = buildChunkBlueprints(segments, config).slice(0, config.maxChunks);
  return finalizeChunks(blueprints, normalized, config, sourceFormat);
}

function clampPositiveInteger(value, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isFinite(num) && num > 0) return num;
  return fallback;
}

function clampNonNegativeInteger(value, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
}

function segmentContent(text, config) {
  const segments = [];
  const lines = text.split('\n');
  let lineStart = 0;
  let bufferLines = [];
  let bufferStart = 0;
  let bufferEnd = 0;
  let bufferType = null;
  let bufferHeadingLevel = null;
  let inCodeFence = false;

  const flushBuffer = () => {
    if (!bufferLines.length) return;
    const segment = createSegmentFromRange(
      text,
      bufferStart,
      bufferEnd,
      bufferType || 'paragraph',
      bufferHeadingLevel
    );
    appendSegment(segment, segments, config);
    bufferLines = [];
    bufferType = null;
    bufferHeadingLevel = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const nextCharIndex = lineStart + rawLine.length;
    const hasTrailingNewline = text[nextCharIndex] === '\n' ? 1 : 0;
    const lineEndWithNewline = nextCharIndex + hasTrailingNewline;

    if (inCodeFence) {
      if (!bufferLines.length) {
        bufferStart = lineStart;
      }
      bufferLines.push(rawLine);
      bufferEnd = lineEndWithNewline;
      if (trimmed.startsWith('```')) {
        inCodeFence = false;
        flushBuffer();
      }
      lineStart = lineEndWithNewline;
      continue;
    }

    if (!trimmed.length) {
      flushBuffer();
      lineStart = lineEndWithNewline;
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushBuffer();
      inCodeFence = true;
      bufferStart = lineStart;
      bufferLines = [rawLine];
      bufferEnd = lineEndWithNewline;
      bufferType = 'code';
      lineStart = lineEndWithNewline;
      continue;
    }

    const classification = classifyLine(trimmed);

    if (classification.type === 'heading') {
      flushBuffer();
      const headingSegment = createSegmentFromRange(
        text,
        lineStart,
        lineEndWithNewline,
        'heading',
        classification.headingLevel
      );
      appendSegment(headingSegment, segments, config);
      lineStart = lineEndWithNewline;
      continue;
    }

    if (classification.type === 'image' || classification.type === 'caption') {
      flushBuffer();
      const singleSegment = createSegmentFromRange(
        text,
        lineStart,
        lineEndWithNewline,
        classification.type,
        null
      );
      appendSegment(singleSegment, segments, config);
      lineStart = lineEndWithNewline;
      continue;
    }

    if (classification.type === 'table' || classification.type === 'list' || classification.type === 'quote') {
      if (!bufferLines.length) {
        bufferStart = lineStart;
        bufferType = classification.type;
      }
      bufferHeadingLevel = bufferHeadingLevel ?? classification.headingLevel ?? null;
      bufferLines.push(rawLine);
      bufferEnd = lineEndWithNewline;
      lineStart = lineEndWithNewline;
      continue;
    }

    // Default paragraph
    if (!bufferLines.length) {
      bufferStart = lineStart;
      bufferType = 'paragraph';
    }
    bufferHeadingLevel = null;
    bufferLines.push(rawLine);
    bufferEnd = lineEndWithNewline;
    lineStart = lineEndWithNewline;
  }

  flushBuffer();
  return segments;
}

function appendSegment(segment, segments, config) {
  if (segment.tokens <= config.maxTokens) {
    segments.push(segment);
    return;
  }

  const pieces = splitLargeSegment(segment, config.maxTokens);
  for (const piece of pieces) {
    segments.push(piece);
  }
}

function createSegmentFromRange(text, start, end, type, headingLevel = null) {
  const raw = text.slice(start, end);
  const trimmed = raw.trim();
  return {
    type,
    headingLevel,
    raw,
    text: trimmed,
    start,
    end,
    tokens: estimateTokens(trimmed),
    isCaption: type === 'caption'
  };
}

function classifyLine(line) {
  if (!line) return { type: 'paragraph', headingLevel: null };

  if (/^#{1,6}\s+/.test(line)) {
    const level = line.match(/^#{1,6}/)[0].length;
    return { type: 'heading', headingLevel: level };
  }

  if (/^(?:[IVXLC]+\.)(?:\d+\.)*\s+/.test(line)) {
    const depth = line.split('.')[0]?.length ?? 1;
    return { type: 'heading', headingLevel: Math.min(6, depth + 1) };
  }

  if (/^\d+(?:\.\d+)+\s+\S/.test(line)) {
    const depth = line.split(' ')[0].split('.').length;
    return { type: 'heading', headingLevel: Math.min(6, depth) };
  }

  if (/^(\*|-|\+|\u2022|\d+[\.\)])\s+/.test(line)) {
    return { type: 'list', headingLevel: null };
  }

  if (/^>\s+/.test(line)) {
    return { type: 'quote', headingLevel: null };
  }

  if (/^\|.+\|\s*$/.test(line) || /^\s*\+-[-+]+\+\s*$/.test(line)) {
    return { type: 'table', headingLevel: null };
  }

  if (/^!\[.*\]\(.*\)/.test(line) || /<img\s.+?>/.test(line)) {
    return { type: 'image', headingLevel: null };
  }

  if (/^(?:Figure|圖|表|圖表|圖片|照片)\s*\d+[:：.\-）\)]/i.test(line)) {
    return { type: 'caption', headingLevel: null };
  }

  if (/^[A-Z0-9][A-Z0-9\s\-:]{2,}$/.test(line) && line.length <= 80) {
    return { type: 'heading', headingLevel: 2 };
  }

  return { type: 'paragraph', headingLevel: null };
}

function splitLargeSegment(segment, maxTokens) {
  const approxChars = Math.max(80, Math.floor(maxTokens * 4));
  const parts = [];
  const text = segment.raw || segment.text || '';
  const relativeStart = segment.start;
  const totalLength = text.length;
  let cursor = 0;

  while (cursor < totalLength) {
    let sliceEnd = Math.min(cursor + approxChars, totalLength);
    if (sliceEnd < totalLength) {
      const searchWindow = text.slice(sliceEnd, Math.min(sliceEnd + 120, totalLength));
      const sentenceBreak = searchWindow.search(/[\.。！？!?\n]/u);
      if (sentenceBreak !== -1) {
        sliceEnd += sentenceBreak + 1;
      }
    }

    const partText = text.slice(cursor, sliceEnd);
    const absoluteStart = relativeStart + cursor;
    const absoluteEnd = relativeStart + sliceEnd;
    const cleanPart = partText.trim();

    parts.push({
      type: segment.type,
      headingLevel: segment.headingLevel,
      raw: partText,
      text: cleanPart,
      start: absoluteStart,
      end: absoluteEnd,
      tokens: estimateTokens(cleanPart),
      isCaption: segment.isCaption
    });

    cursor = sliceEnd;
  }

  return parts;
}

function buildChunkBlueprints(segments, config) {
  const blueprints = [];
  let currentSegments = [];
  let currentTokens = 0;
  let i = 0;

  const pushCurrent = () => {
    if (!currentSegments.length) return;
    blueprints.push({
      segments: currentSegments,
      tokens: currentTokens
    });
    currentSegments = [];
    currentTokens = 0;
  };

  while (i < segments.length) {
    let segment = segments[i];

    if (segment.type === 'heading') {
      pushCurrent();
      currentSegments.push(segment);
      currentTokens = Math.max(1, segment.tokens);
      i += 1;
      continue;
    }

    let bundle = [segment];
    let bundleTokens = Math.max(1, segment.tokens);

    if (shouldPairWithNext(segment, segments[i + 1])) {
      const partner = segments[i + 1];
      bundle.push(partner);
      bundleTokens += Math.max(1, partner.tokens);
      i += 1;
    }

    if (currentTokens && currentTokens + bundleTokens > config.maxTokens) {
      pushCurrent();
    }

    for (const item of bundle) {
      currentSegments.push(item);
      currentTokens += Math.max(1, item.tokens);
    }

    const next = segments[i + 1];
    const reachedTarget = currentTokens >= config.targetTokens;
    const nextWouldOverflow = next && currentTokens + Math.max(1, next.tokens) > config.maxTokens;
    const nextIsHeading = next && next.type === 'heading';

    if (
      nextIsHeading ||
      nextWouldOverflow ||
      (reachedTarget && (!next || currentTokens >= config.targetTokens))
    ) {
      pushCurrent();
    }

    i += 1;
  }

  pushCurrent();
  return blueprints;
}

function shouldPairWithNext(current, next) {
  if (!next) return false;
  const assetTypes = new Set(['image', 'table']);
  if (assetTypes.has(current.type) && next.type === 'caption') return true;
  if (current.type === 'caption' && assetTypes.has(next.type)) return true;
  return false;
}

function finalizeChunks(blueprints, text, config, sourceFormat) {
  const chunks = [];
  const approxCharsPerToken = 4;
  const overlapChars = config.overlapTokens * approxCharsPerToken;
  let previousTail = '';

  for (const blueprint of blueprints) {
    if (!blueprint.segments || !blueprint.segments.length) continue;
    const start = Math.max(0, blueprint.segments[0].start);
    const end = Math.min(text.length, blueprint.segments[blueprint.segments.length - 1].end);
    const chunkRaw = text.slice(start, end);
    const cleaned = chunkRaw.trim();
    if (!cleaned) continue;

    const headings = collectHeadings(blueprint.segments);
    const leadingContext = config.includeLeadingContext
      ? buildLeadingContext(previousTail, headings)
      : '';
    const tokens = Math.max(1, estimateTokens(cleaned));

    chunks.push({
      id: chunks.length + 1,
      start,
      end,
      text: cleaned,
      tokens,
      segmentCount: blueprint.segments.length,
      headings,
      leadingContext,
      sourceFormat
    });

    const tail = cleaned.slice(-Math.max(overlapChars, 160));
    previousTail = tail.trimStart();
  }

  return chunks;
}

function collectHeadings(segments) {
  const headings = [];
  for (const segment of segments) {
    if (segment.type === 'heading' && segment.text) {
      headings.push(segment.text);
    }
  }
  return headings;
}

function buildLeadingContext(previousTail, headings) {
  const context = [];
  if (headings.length) {
    context.push(headings.slice(-3).join(' > '));
  }
  if (previousTail) {
    context.push(previousTail);
  }
  return context.join('\n').trim();
}

function estimateTokens(text) {
  if (typeof text !== 'string') return 0;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 0;
  const words = cleaned.split(' ');
  const avgWordLength = cleaned.length / words.length;
  const approx = Math.ceil((words.length + cleaned.length / 4) / 2);
  return Math.max(1, Math.ceil(approx * Math.max(0.7, Math.min(1.3, 4 / Math.max(1, avgWordLength)))));
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
          name: 'E-E-A-T 信任線索',
          weight: 18,
          score: 7,
          description: '文本提供基本背景與來源，但仍可補充更多權威佐證',
          evidence: ['導言段提到作者具多年經驗', '內文引用 1 筆 2023 年業界調查']
        },
        {
          name: '內容品質與原創性',
          weight: 18,
          score: hasKeyword ? 7 : 6,
          description: hasKeyword ? '主內容結構完整且包含親身案例' : '內容尚未針對目標關鍵字提供具體案例',
          evidence: [wordCount > 500 ? '第三段描述實際實施流程' : '篇幅不足 500 字，缺少深度資訊']
        },
        {
          name: '人本與主題一致性',
          weight: 12,
          score: 7,
          description: '全文聚焦解決使用者問題，無刻意堆疊關鍵字',
          evidence: ['第二段直接回答「該怎麼做」的提問']
        },
        {
          name: '標題與承諾落實',
          weight: 10,
          score: 7,
          description: '標題承諾的步驟在正文中都有對應段落',
          evidence: ['標題寫「三步驟」，內文第 3-5 段逐一說明']
        },
        {
          name: '搜尋意圖契合度',
          weight: 12,
          score: 7,
          description: '內容回答主要問題並提供操作步驟',
          evidence: ['結論提供可執行清單對應讀者意圖']
        },
        {
          name: '新鮮度與時效性',
          weight: 8,
          score: wordCount > 500 ? 7 : 6,
          description: wordCount > 500 ? '引用 2024 年資料維持時效性' : '缺少發布或更新時間資訊',
          evidence: [wordCount > 500 ? '第四段引用「2024 年統計」' : '全文未標示年份']
        },
        {
          name: '使用者安全與風險',
          weight: 12,
          score: 7,
          description: '內容無明顯危害，但建議補充資料來源以降低誤導風險',
          evidence: ['無極端承諾或危險指引', '建議加入引用佐證關鍵數據']
        },
        {
          name: '結構與可讀性',
          weight: 10,
          score: 8,
          description: '段落切分良好，適合行動裝置閱讀',
          evidence: ['使用條列整理步驟', '句子長度適中，易於掃讀']
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
        category: 'E-E-A-T',
        title: '補強權威訊號',
        description: '補充專家引言或連結至可信賴來源，提升 E-E-A-T 評分。',
        example: '引用政府或學術機構資料作為補充說明'
      }
    ],
    highRiskFlags: []
  };
}

function normalizeAnalysisResult(result) {
  if (!result || typeof result !== 'object') return result;

  if (!result.metrics || typeof result.metrics !== 'object') {
    result.metrics = {};
  }

  if (Array.isArray(result.metrics.aeo)) {
    result.metrics.aeo = result.metrics.aeo.map(sanitizeMetricEntry);
    const computedAeo = computeAverageScore(result.metrics.aeo);
    if (!Number.isFinite(result.aeoScore) && computedAeo !== null) {
      result.aeoScore = computedAeo;
    }
  }

  if (Array.isArray(result.metrics.seo)) {
    result.metrics.seo = result.metrics.seo.map(sanitizeSeoMetricEntry);
    const weightedSeo = computeWeightedScore(result.metrics.seo);
    const averageSeo = weightedSeo !== null ? weightedSeo : computeAverageScore(result.metrics.seo);
    if (!Number.isFinite(result.seoScore) && averageSeo !== null) {
      result.seoScore = averageSeo;
    }
  }

  result.recommendations = Array.isArray(result.recommendations)
    ? result.recommendations.filter((item) => item && typeof item === 'object')
    : [];

  result.highRiskFlags = Array.isArray(result.highRiskFlags)
    ? result.highRiskFlags.map((flag) => ({
        type: typeof flag?.type === 'string' ? flag.type : 'safety',
        severity: typeof flag?.severity === 'string' ? flag.severity : 'warning',
        summary: typeof flag?.summary === 'string' ? flag.summary : '',
        action: typeof flag?.action === 'string' ? flag.action : ''
      }))
    : [];

  if (!Number.isFinite(result.overallScore)) {
    if (Number.isFinite(result.aeoScore) && Number.isFinite(result.seoScore)) {
      result.overallScore = Math.round(result.aeoScore * 0.45 + result.seoScore * 0.55);
    } else if (Number.isFinite(result.seoScore)) {
      result.overallScore = Math.round(result.seoScore);
    } else if (Number.isFinite(result.aeoScore)) {
      result.overallScore = Math.round(result.aeoScore);
    }
  }

  return result;
}

function sanitizeMetricEntry(metric) {
  const score = clampScore(metric?.score);
  const description = typeof metric?.description === 'string' ? metric.description : '';
  const evidence = Array.isArray(metric?.evidence)
    ? metric.evidence.filter((item) => typeof item === 'string' && item.trim())
    : [];

  return {
    ...metric,
    score,
    description,
    evidence
  };
}

function sanitizeSeoMetricEntry(metric) {
  const base = sanitizeMetricEntry(metric);
  let weight = base.weight;
  if (weight === undefined && metric?.weight !== undefined) {
    weight = Number(metric.weight);
  }
  if (typeof weight === 'number' && !Number.isNaN(weight)) {
    weight = Math.max(0, weight);
  } else {
    weight = undefined;
  }
  return {
    ...base,
    weight
  };
}

function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 10) return 10;
  return value;
}

function computeAverageScore(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null;
  let total = 0;
  let count = 0;
  metrics.forEach((metric) => {
    const score = clampScore(metric.score);
    total += score;
    count += 1;
  });
  if (count === 0) return null;
  const averageOutOfTen = total / count;
  return Math.round(averageOutOfTen * 10);
}

function computeWeightedScore(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  metrics.forEach((metric) => {
    if (typeof metric.weight === 'number') {
      const score = clampScore(metric.score);
      weightedSum += metric.weight * score;
      totalWeight += metric.weight;
    }
  });
  if (totalWeight <= 0) return null;
  const averageOutOfTen = weightedSum / totalWeight;
  return Math.round(averageOutOfTen * 10);
}
