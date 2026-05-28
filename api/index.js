// Simple NexaBot API - no serverless-http dependency
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');

function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return createResponse(200, {});
  }

  const path = req.path || req.url || '';

  // Health check
  if (path.includes('health')) {
    return createResponse(200, { status: 'ok', brand: 'NexaBot', message: 'Server running' });
  }

  // Chat endpoint
  if (path.includes('/api/chat') && req.method === 'POST') {
    const message = (req.body && req.body.message) ? req.body.message : '';

    if (!message) {
      return createResponse(400, { error: 'No message provided' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyUrl = process.env.SHOPIFY_STORE_URL || 'nexabot.myshopify.com';

    if (!openaiKey) {
      return createResponse(200, {
        response: "Hey! I'm NexaBot. The AI is currently being configured for this demo - check back in a moment. In the meantime, message me about cart recovery, order tracking, or product questions!",
        intent: 'demo_mode'
      });
    }

    try {
      const openai = new OpenAIApi(new Configuration({ apiKey: openaiKey }));

      // Detect intent
      const lower = message.toLowerCase();
      let context = 'General customer question about our Shopify store.';

      if (lower.includes('track') || lower.includes('order') || lower.includes('where')) {
        context = 'Customer is asking about order status. If they provide an order number like #1001, acknowledge and say you will look it up.';
      } else if (lower.includes('cart') || lower.includes('checkout')) {
        context = 'Customer has a cart or checkout question. Be helpful and mention we can help them complete their purchase.';
      } else if (lower.includes('ship') || lower.includes('deliver') || lower.includes('arrive')) {
        context = 'Customer is asking about shipping. Standard shipping is 3-5 business days. Express available at checkout.';
      } else if (lower.includes('return') || lower.includes('refund')) {
        context = 'Customer is asking about returns. Our return window is 30 days with a full refund.';
      }

      const completion = await openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are NexaBot, a friendly AI assistant for a Shopify store. Be concise (2-3 sentences max), helpful, and never make up product info. If you do not know something, say so. Current context: ${context}`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 250,
        temperature: 0.7
      });

      return createResponse(200, {
        response: completion.data.choices[0].message.content,
        intent: 'chat'
      });

    } catch (err) {
      console.error('OpenAI error:', err.message);
      return createResponse(200, {
        response: "I'm having a little trouble right now - please try again in a moment!",
        error: true
      });
    }
  }

  // Root
  if (path === '/' || path === '') {
    return createResponse(200, {
      brand: 'NexaBot',
      status: 'running',
      message: 'NexaBot Shopify chatbot API - live at project-rv6ol.vercel.app'
    });
  }

  return createResponse(404, { error: 'Not found' });
};