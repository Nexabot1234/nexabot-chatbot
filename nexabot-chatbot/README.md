# NexaBot — Shopify Chatbot Template

A production-ready AI chatbot for Shopify stores. Recovers abandoned carts, answers product questions, tracks orders, and hands off to humans when needed.

**Built with:** Node.js + Express + OpenAI GPT-4o + Shopify Admin API

---

## What's included

```
├── server.js              ← Node.js backend (API server)
├── public/
│   ├── index.html         ← Demo storefront page
│   ├── chatbot.js         ← Frontend chat widget
│   └── styles.css         ← Widget styling
├── .env.example           ← Environment variables template
├── PROMPTS.md             ← All AI prompt templates
├── CART_RECOVERY.md       ← Cart abandonment logic docs
├── INSTALL.md             ← How to install on any Shopify store
└── README.md              ← You are here
```

---

## Setup in 5 minutes

### 1. Create a Shopify Partner dev store (free)

1. Go to [partners.shopify.com](https://partners.shopify.com) → Create Partner Account
2. Dashboard → Create dev store → choose "Showcase" → name it anything
3. Go to your dev store → Apps → Develop apps → let it create
4. Install the app → copy the **Admin API access token** (starts with `shpat_...`)

### 2. Get an OpenAI API key

1. Go to [platform.openai.com](https://platform.openai.com) → API Keys → Create new secret key
2. Copy it (starts with `sk-...`)

### 3. Deploy the backend to Vercel (free)

1. Create a new GitHub repo
2. Upload all files from this template
3. Connect repo to Vercel → Deploy (free tier)
4. Add environment variables in Vercel:
   - `OPENAI_API_KEY` = your OpenAI key
   - `SHOPIFY_ACCESS_TOKEN` = your Shopify token
   - `SHOPIFY_STORE_URL` = `your-store.myshopify.com`
5. Copy your Vercel deployment URL (e.g. `https://your-app.vercel.app`)

### 4. Install on Shopify

1. Shopify Admin → Online Store → Themes → Edit code
2. Find `theme.liquid` → paste this before `</body>`:
```html
<script>
  window.NEXABOT_CONFIG = {
    apiUrl: "https://your-app.vercel.app",  // Replace with your Vercel URL
    storeName: "Your Store Name",
    brandColor: "#00c3ff",
    position: "bottom-right"
  };
</script>
<script src="https://your-app.vercel.app/chatbot.js" defer></script>
```

Done. Bot is live.

---

## Pricing for clients

| Tier | Price | Delivery | Includes |
|---|---|---|---|
| Basic | $95 | 3 days | 10 intents, ChatGPT fallback, 1-line install |
| Standard | $245 | 5 days | 25 intents, cart recovery, order tracking, analytics |
| Premium | $595 | 10 days | Unlimited intents, multi-channel, recommendation engine |

---

## For the demo store

The demo store is deployed at: **[TBD - user will set up]**

Screenshots for portfolio to generate:
- Screenshot 1: Chat widget open on a product page
- Screenshot 2: Cart recovery prompt appearing
- Screenshot 3: Order tracking response
- Screenshot 4: Analytics dashboard

---

*NexaBot template — built to reuse for every client*