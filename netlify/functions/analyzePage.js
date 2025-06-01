const axios = require('axios');
const cheerio = require('cheerio');

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
    // Scrape the page
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const headers = [];
    $('h1, h
