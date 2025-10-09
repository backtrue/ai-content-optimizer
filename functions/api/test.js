// Simple test endpoint
export async function onRequestGet() {
  return new Response(JSON.stringify({ 
    status: 'ok',
    message: 'Functions are working!' 
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestPost() {
  return new Response(JSON.stringify({ 
    status: 'ok',
    message: 'POST is working!',
    overallScore: 75,
    aeoScore: 78,
    seoScore: 72,
    metrics: {
      aeo: [
        { name: '測試指標', score: 8, description: '這是測試' }
      ],
      seo: [
        { name: '測試指標', score: 7, description: '這是測試' }
      ]
    },
    recommendations: [
      {
        priority: 'high',
        category: 'TEST',
        title: '測試建議',
        description: '如果您看到這個，表示 Functions 正在運行'
      }
    ]
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
