/**
 * NexaBot — Shopify Chatbot Backend
 * Node.js + Express + OpenAI GPT-4o + Shopify Admin API
 */

require('dotenv').config();
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
// Maps user messages to actions
function detectIntent(message) {
  const lower = message.toLowerCase();
  if (lower.includes('track') || lower.includes('order') || lower.includes('where')) return 'order_tracking';
  if (lower.includes('cart') || lower.includes('checkout') || lower.includes('pay')) return 'cart_recovery';
  if (lower.includes('ship') || lower.includes('deliver') || lower.includes('arrive')) return 'shipping';
  if (lower.includes('return') || lower.includes('refund') || lower.includes('exchange')) return 'returns';
  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) return 'pricing';
  if (lower.includes('size') || lower.includes('fit') || lower.includes('尺码')) return 'sizing';
  if (lower.includes('stock') || lower.includes('available') || lower.includes('库存')) return 'stock';
  return 'general';
}

// ── Shopify Data Fetchers ──────────────────────────────────────
async function getOrderStatus(orderNumber) {
  try {
    const data = await shopifyGraphQL(`
      query getOrder($orderNumber: String!) {
        order(id: "gid://shopify/Order/1") { name createdAt }
        orders(first: 1, query: $orderNumber) {
          edges {
            node {
              name
              fulfillmentStatus
              fulfillment {
                trackingCompany
                trackingUrl
                trackingNumber
              }
              shippingAddress { address1 city country }
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
      trackingNumber: order.fulfillment?.trackingNumber,
      address: order.shippingAddress
    };
  } catch (err) {
    console.error('Shopify order fetch error:', err.message);
    return null;
  }
}

async function getProductInfo(productQuery) {
  try {
    const data = await shopifyGraphQL(`
      query getProduct($query: String!) {
        products(first: 3, query: $query) {
          edges {
            node {
              title
              description
              priceRange { minVariantPrice { amount currencyCode } }
              images(first: 1) { edges { node { url } } }
            }
          }
        }
      }
    `, { query: productQuery });

    return data.products?.edges?.map(e => e.node) || [];
  } catch (err) {
    return [];
  }
}

// ── AI Response Handler ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, context = {} } = req.body;

  if (!message) return res.status(400).json({ error: 'No message provided' });

  const intent = detectIntent(message);
  let systemContext = '';

  try {
    // Handle specific intents with structured data first
    if (intent === 'order_tracking') {
      const orderNum = message.replace(/[^0-9]/g, '');
      if (orderNum) {
        const order = await getOrderStatus(orderNum);
        if (order) {
          const response = `📦 **Order ${order.orderNumber}**\nStatus: ${order.status}\n${order.tracking ? `Carrier: ${order.tracking}\nTracking: ${order.trackingUrl || order.trackingNumber}` : 'Tracking info coming soon'}\n\nNeed anything else?`;
          return res.json({ response, intent });
        }
      }
      systemContext = 'The customer is asking about order status. If they provide an order number, say "Let me look that up for you" and the system will fetch it. If no order number, ask for it politely.';
    }

    if (intent === 'cart_recovery') {
      systemContext = 'The customer is asking about checkout or cart issues. Be helpful, mention you can help them complete their purchase, and if they have a discount code handy you can apply it for them.';
    }

    if (intent === 'shipping') {
      systemContext = 'The customer is asking about shipping. Use general Shopify shipping info — standard shipping 3-5 business days, express available at checkout. Be helpful and friendly.';
    }

    // Fall back to GPT-4o for everything else
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are NexaBot — a friendly, expert AI assistant for a Shopify store called "${context.storeName || 'our store'}". 

Your job is to:
- Help customers find products
- Answer questions about sizing, shipping, returns, pricing
- Recover abandoned carts by being helpful and non-pushy
- Track orders when customers provide an order number
- Hand off to human support gracefully when you can't help

Rules:
- Never make up product info — say "Let me check that for you" if unsure
- Never process payments or refunds — direct to human for those
- Be friendly, helpful, concise — 2-3 sentences max
- If customer seems frustrated, acknowledge and offer human handoff
- Always end with a gentle next step or question

Current context: ${systemContext || 'General customer inquiry'}`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const response = completion.data.choices[0].message.content;
    res.json({ response, intent });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Something went wrong, please try again.' });
  }
});

// ── Health Check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brand: 'NexaBot', version: '1.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NexaBot running on port ${PORT}`));