const cheerio = require('cheerio');
const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event) {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://dumasai.co',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Only POST method allowed' }),
    };
  }

  const { url } = JSON.parse(event.body || '{}');
  if (!url) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing URL in request body' }),
    };
  }

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const headers = [];
    $('h1, h2, h3').each((_, el) => headers.push($(el).text().trim()));

    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);
    const payload = {
      url,
      html_title: title,
      meta_description: metaDesc,
      content: text,
      word_count: text.split(/\s+/).length,
      header_tags: headers,
      has_structured_data: $('script[type="application/ld+json"]').length > 0,
      contains_faq: text.toLowerCase().includes('faq'),
      robots_txt_allowed: true,
    };

    const prompt = `
You are an AI web evaluator. Based on the structured data below, return a JSON response with:
- score (1–10)
- summary (2–3 sentence description of structure)
- issues (array)
- recommendations (array)

Input:
${JSON.stringify(payload, null, 2)}
`;

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4',
        messages: [
          { role: 'system', content: 'Evaluate how well a webpage is structured for ChatGPT-style summarization and referencing.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const json = await openRouterResponse.json();
    const content = json.choices?.[0]?.message?.content || 'Error: No content returned from model.';

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: content,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
