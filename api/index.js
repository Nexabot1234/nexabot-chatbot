// NexaBot - Vercel Serverless API
import { createClient } from '@supabase/supabase-js';

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const SHOPIFY_URL = process.env.SHOPIFY_STORE_URL || 'nexabot.myshopify.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';

  // Health
  if (url.includes('health')) {
    res.status(200).json({ status: 'ok', brand: 'NexaBot', openai: !!OPENAI_KEY, shopify: !!SHOPIFY_TOKEN });
    return;
  }

  // Chat
  if (url.includes('/api/chat') && req.method === 'POST') {
    const message = req.body?.message || '';

    if (!message) {
      res.status(400).json({ error: 'No message' });
      return;
    }

    const lower = message.toLowerCase();
    let context = 'General question about our Shopify store.';

    if (lower.includes('track') || lower.includes('order') || lower.includes('where')) {
      context = 'Customer asking about order status. Ask for order number if not provided.';
    } else if (lower.includes('cart') || lower.includes('checkout')) {
      context = 'Customer asking about checkout or cart. Be helpful.';
    } else if (lower.includes('ship') || lower.includes('deliver')) {
      context = 'Shipping: 3-5 business days standard, express at checkout.';
    } else if (lower.includes('return') || lower.includes('refund')) {
      context = 'Returns: 30 days, full refund.';
    }

    if (!OPENAI_KEY) {
      res.status(200).json({
        response: "Hey! I'm NexaBot. The AI integration is being set up - I'll be fully live soon. For now, I can help with cart recovery, order tracking, shipping and returns questions!",
        demo: true
      });
      return;
    }

    try {
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are NexaBot, a friendly AI assistant for a Shopify store. Be concise (2 sentences max), helpful. Never make up product info. Context: ${context}`
            },
            { role: 'user', content: message }
          ],
          max_tokens: 250,
          temperature: 0.7
        })
      });

      const data = await completion.json();
      const reply = data.choices?.[0]?.message?.content || "I'm here! What can I help with?";

      res.status(200).json({ response: reply, intent: 'chat' });
    } catch (err) {
      res.status(200).json({ response: "I'm having a moment - please try again!", error: true });
    }
    return;
  }

  // Root
  if (url === '/' || url === '') {
    res.status(200).json({ brand: 'NexaBot', status: 'live', url: 'https://project-rv6ol.vercel.app' });
    return;
  }

  res.status(404).json({ error: 'Not found' });
}