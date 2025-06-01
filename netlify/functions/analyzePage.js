const axios = require('axios');
const cheerio = require('cheerio');
const { Configuration, OpenAIApi } = require('openai');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Only POST method allowed' }),
    };
  }

  const { url } = JSON.parse(event.body);
  if (!url) {
    return {
      statusCode: 400,
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
      robots_txt_allowed: true
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

    const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
    const chat = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Evaluate how well a webpage is structured for ChatGPT-style summarization and referencing.' },
        { role: 'user', content: prompt }
      ]
    });

    return {
      statusCode: 200,
      body: chat.data.choices[0].message.content,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
