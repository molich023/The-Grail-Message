# Grail Message Kenya — Website

## Structure
```
grailmessage/
├── index.html                         ← Main website
├── netlify.toml                       ← Netlify config
└── netlify/functions/
    ├── save-subscriber.js             ← PDF signup → Supabase
    ├── place-order.js                 ← Book orders → Supabase
    ├── mpesa-payment.js               ← M-Pesa STK Push
    ├── mpesa-callback.js              ← M-Pesa confirmation
    └── contact-message.js            ← Contact form → Supabase
```

## Netlify Environment Variables Required
Set these in Netlify → Site configuration → Environment variables:

| Variable | Where to get it |
|----------|----------------|
| SUPABASE_URL | Supabase → Settings → API |
| SUPABASE_ANON_KEY | Supabase → Settings → API |
| MPESA_CONSUMER_KEY | Safaricom Developer Portal |
| MPESA_CONSUMER_SECRET | Safaricom Developer Portal |
| MPESA_SHORTCODE | Your Paybill number |
| MPESA_PASSKEY | Safaricom Developer Portal |
| MPESA_CALLBACK_URL | https://grailmessagekenya.netlify.app/api/mpesa-callback |

## Deploy
Push to GitHub → Netlify auto-deploys from main branch.
