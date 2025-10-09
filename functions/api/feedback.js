// Simple feedback endpoint for logging user feedback (no storage yet)

export async function onRequestPost(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://ragseo.thinkwithblack.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, contentHash, targetKeywords, recommendationId, verdict, notes, chunkIds } = body || {};

    // Minimal validation
    const errors = [];
    if (!sessionId) errors.push('sessionId is required');
    if (!contentHash) errors.push('contentHash is required');
    if (!Array.isArray(targetKeywords) || targetKeywords.length === 0) errors.push('targetKeywords must be a non-empty array');
    if (!recommendationId) errors.push('recommendationId is required');
    if (!['up', 'down'].includes(verdict)) errors.push("verdict must be 'up' or 'down'");

    if (errors.length) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, just log it. In the next step we can persist to KV/D1.
    console.log('User feedback received:', JSON.stringify({ sessionId, contentHash, targetKeywords, recommendationId, verdict, notes, chunkIds }, null, 2));

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Feedback endpoint error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error', message: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
