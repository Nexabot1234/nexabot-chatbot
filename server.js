const serverless = require('serverless-http');
const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ── OpenAI Setup ──────────────────────────────────────────────
const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

// ── Shopify API Setup ──────────────────────────────────────────
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function shopifyGraphQL(query, variables = {}) {
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
}

// ── Intent Detection ───────────────────────────────────────────
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

// ── Shopify Data Fetchers ──────────────────────────────────────
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

    const order = data.orders?.edges?.[0]?.node;
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

// ── AI Response Handler ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context = {} } = req.body;
    if (!message) return res.status(400).json({ error: 'No message' });

    const intent = detectIntent(message);
    let systemContext = '';

    // Handle order tracking with real Shopify data
    if (intent === 'order_tracking') {
      const orderNum = message.replace(/[^0-9]/g, '');
      if (orderNum) {
        const order = await getOrderStatus(orderNum);
        if (order) {
          return res.json({
            response: `📦 Order ${order.orderNumber}\nStatus: ${order.status}\n${order.tracking ? `Tracking: ${order.trackingUrl || order.trackingNumber}` : 'Tracking info coming soon'}\n\nNeed anything else?`,
            intent
          });
        }
      }
      systemContext = 'Customer is asking about order status. If they give an order number, say you will look it up. Otherwise ask for the order number.';
    }

    if (intent === 'cart_recovery') {
      systemContext = 'Customer has a cart or checkout question. Be helpful and friendly.';
    }

    if (intent === 'shipping') {
      systemContext = 'Customer is asking about shipping. Standard shipping 3-5 business days.';
    }

    // Fall back to GPT-4o
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are NexaBot — a friendly AI assistant for a Shopify store. Be helpful, concise (2-3 sentences max), and never make up product info. Current context: ${systemContext || 'General question'}`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    res.json({
      response: completion.data.choices[0].message.content,
      intent
    });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Health Check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brand: 'NexaBot' });
});

module.exports = app;
module.exports.handler = serverless(app);