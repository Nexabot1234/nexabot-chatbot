const serverless = require('serverless-http');
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');

// â”€â”€ OpenAI Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

// â”€â”€ Shopify API Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || 'nexabot.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// â”€â”€ Shopify GraphQL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function shopifyGraphQL(query, variables = {}) {
  try {
    const response = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2024-01/graphql.json`,
      { query, variables },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  } catch (err) {
    console.error('Shopify API error:', err.message);
    return null;
  }
}

// â”€â”€ Intent Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function detectIntent(message) {
  const lower = message.toLowerCase();
  if (lower.includes('track') || lower.includes('order') || lower.includes('where')) return 'order_tracking';
  if (lower.includes('cart') || lower.includes('checkout') || lower.includes('pay')) return 'cart_recovery';
  if (lower.includes('ship') || lower.includes('deliver') || lower.includes('arrive')) return 'shipping';
  if (lower.includes('return') || lower.includes('refund') || lower.includes('exchange')) return 'returns';
  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) return 'pricing';
  if (lower.includes('size') || lower.includes('fit')) return 'sizing';
  if (lower.includes('stock') || lower.includes('available')) return 'stock';
  return 'general';
}

// â”€â”€ Order Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getOrderStatus(orderNumber) {
  try {
    const data = await shopifyGraphQL(`
      query getOrder($orderNumber: String!) {
        orders(first: 5, query: $orderNumber) {
          edges {
            node {
              name
              fulfillmentStatus
              fulfillment {
                trackingCompany
                trackingUrl
                trackingNumber
              }
            }
          }
        }
      }
    `, { orderNumber: `#${orderNumber}` });

    const order = data?.orders?.edges?.[0]?.node;
    if (!order) return null;
    return {
      orderNumber: order.name,
      status: order.fulfillmentStatus || 'Processing',
      tracking: order.fulfillment?.trackingCompany,
      trackingUrl: order.fulfillment?.trackingUrl,
    };
  } catch (err) {
    return null;
  }
}

// â”€â”€ Vercel Serverless Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const handler = serverless(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Health check
  if (req.path === '/api/health' || req.path === '/health') {
    res.status(200).json({ status: 'ok', brand: 'NexaBot', version: '1.0' });
    return;
  }

  // Chat endpoint
  if (req.path === '/api/chat' && req.method === 'POST') {
    try {
      const { message, context = {} } = req.body || {};
      if (!message) {
        res.status(400).json({ error: 'No message provided' });
        return;
      }

      const intent = detectIntent(message);
      let systemContext = '';

      // Order tracking with real Shopify data
      if (intent === 'order_tracking') {
        const orderNum = message.replace(/[^0-9]/g, '');
        if (orderNum) {
          const order = await getOrderStatus(orderNum);
          if (order) {
            res.status(200).json({
              response: `ðŸ“¦ Order ${order.orderNumber}\nStatus: ${order.status}\n${order.tracking ? `Carrier: ${order.tracking}\nTracking: ${order.trackingUrl || order.trackingNumber}` : 'Tracking info coming soon'}\n\nNeed anything else?`,
              intent
            });
            return;
          }
        }
        systemContext = 'Customer is asking about order status. Ask for their order number if not provided.';
      }

      if (intent === 'cart_recovery') {
        systemContext = 'Customer has a cart or checkout question. Be helpful and friendly.';
      }

      if (intent === 'shipping') {
        systemContext = 'Customer is asking about shipping. Standard 3-5 business days, express available at checkout.';
      }

      if (intent === 'returns') {
        systemContext = 'Customer is asking about returns. Our standard return window is 30 days with full refund.';
      }

      // GPT-4o response
      const completion = await openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are NexaBot â€” a friendly AI assistant for a Shopify store. Be helpful, concise (2-3 sentences max), and never make up product info. If you don't know something, say so. Current context: ${systemContext || 'General customer question'}`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      res.status(200).json({
        response: completion.data.choices[0].message.content,
        intent
      });

    } catch (err) {
      console.error('Chat error:', err.message);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    return;
  }

  // Root route
  if (req.path === '/' || req.path === '') {
    res.status(200).json({
      brand: 'NexaBot',
      status: 'running',
      endpoints: {
        health: '/api/health',
        chat: 'POST /api/chat',
        demo: 'GET /demo'
      }
    });
    return;
  }

  // 404
  res.status(404).json({ error: 'Not found' });
});

module.exports = handler;
module.exports.handler = handler;