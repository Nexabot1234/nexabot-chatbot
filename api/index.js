const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const SHOPIFY_URL = process.env.SHOPIFY_STORE_URL || 'nexabot.myshopify.com';

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';

  // Health check
  if (url.includes('health')) {
    res.status(200).json({ status: 'ok', brand: 'NexaBot', openai: !!OPENAI_KEY, shopify: !!SHOPIFY_TOKEN });
    return;
  }

  // Chat
  if (url.includes('/api/chat') && req.method === 'POST') {
    let body = {};
    try {
      if (req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } else if (req.rawBody) {
        body = JSON.parse(req.rawBody);
      }
    } catch (e) {
      body = {};
    }

    const message = body.message || '';

    if (!message) {
      res.status(400).json({ error: 'No message provided' });
      return;
    }

    const lower = message.toLowerCase();
    let context = 'General question about our Shopify store.';

    if (lower.includes('track') || lower.includes('order') || lower.includes('where')) {
      context = 'Customer asking about order status. Ask for order number.';
    } else if (lower.includes('cart') || lower.includes('checkout')) {
      context = 'Customer asking about cart recovery or checkout.';
    } else if (lower.includes('ship') || lower.includes('deliver') || lower.includes('arrive')) {
      context = 'Shipping: 3-5 business days standard.';
    } else if (lower.includes('return') || lower.includes('refund')) {
      context = 'Returns: 30 days, full refund.';
    } else if (lower.includes('price') || lower.includes('cost')) {
      context = 'Pricing question.';
    } else if (lower.includes('size') || lower.includes('fit')) {
      context = 'Size and fit question.';
    }

    if (!OPENAI_KEY) {
      res.status(200).json({
        response: "Hey! I'm NexaBot. I'll be fully live soon. I can help with cart recovery, order tracking, shipping and returns!",
        demo: true
      });
      return;
    }

    const postData = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are NexaBot, a friendly AI assistant for a Shopify store. Be concise (2 sentences max), helpful and friendly. Context: ${context}`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OPENAI_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const https = require('https');
    const req2 = https.request(options, (res2) => {
      let data = '';
      res2.on('data', (chunk) => { data += chunk; });
      res2.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // Check for OpenAI error
          if (parsed.error) {
            res.status(200).json({ response: "I'm having a moment - please try again!", error: parsed.error.message, debug: true });
            return;
          }

          // Navigate the response tree correctly
          let reply = "I'm here! What can I help with?";

          // Try standard path: data.choices[0].message.content
          if (parsed.data && parsed.data.choices && parsed.data.choices[0] && parsed.data.choices[0].message) {
            reply = parsed.data.choices[0].message.content;
          }
          // Try alternative path: choices[0].message.content
          else if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            reply = parsed.choices[0].message.content;
          }
          // Try just text: choices[0].text
          else if (parsed.choices && parsed.choices[0] && parsed.choices[0].text) {
            reply = parsed.choices[0].text;
          }
          // Log for debugging
          else {
            console.log('OpenAI response:', JSON.stringify(parsed).substring(0, 500));
          }

          res.status(200).json({ response: reply, intent: 'chat' });
        } catch (e) {
          res.status(200).json({ response: "I'm having a moment - please try again!", parse_error: e.message, raw: data.substring(0, 200) });
        }
      });
    });

    req2.on('error', (e) => {
      res.status(200).json({ response: "I'm having a moment - please try again!", net_error: e.message });
    });

    req2.write(postData);
    req2.end();
    return;
  }

  // Root
  if (url === '/' || url === '') {
    res.status(200).json({ brand: 'NexaBot', status: 'live' });
    return;
  }

  res.status(404).json({ error: 'Not found' });
};