# ✦ In the Light of Truth — The Grail Message Kenya

**Alexander Bernhardt Publishing Company Kenya**
Authorised Distributor of the works of Abd-ru-shin in Kenya and East Africa

🌐 **Live Site:** https://grailmessagekenya.netlify.app
📦 **Repository:** https://github.com/molich023/The-Grail-Message
📧 **Contact:** info@grailmessagekenya.co.ke
📞 **Phone:** +254 736 340 024
📮 **Address:** P.O. Box 237-00208, Ngong Hills, Kenya

---

## ✦ Project Overview

A fully authenticated spiritual bookstore website for distributing
the works of Abd-ru-shin across Kenya and East Africa. Built as a
single-file progressive web app with Netlify hosting, Supabase
database and authentication, M-Pesa Daraja 2.0 payments and
Pesapal card payments.

Every visitor must create an account and verify their email before
accessing any content — giving full analytics on who is interested
in the Grail Message across East Africa.

---

## ✦ Project Status

| Feature | Status |
|---------|--------|
| Site live on Netlify | ✅ Complete |
| Supabase database | ✅ Complete — 8 tables |
| User authentication | ✅ Complete — Supabase Auth |
| Login / Signup page | ✅ Complete |
| Email verification | ✅ Complete |
| Welcome page | ✅ Complete |
| Site protection — login required | ✅ Complete |
| Admin dashboard | ✅ Complete |
| Password reset | ✅ Complete |
| Book catalogue — 10 titles | ✅ Complete |
| Audio chapters — KSH 20 each | ✅ Complete |
| Free PDF download gate | ✅ Complete |
| Shopping cart | ✅ Complete |
| Netlify functions — 12 deployed | ✅ Complete |
| Security headers | ✅ Complete |
| Rate limiting | ✅ Complete |
| Bot protection | ✅ Complete |
| Keep-alive scheduler | ✅ Complete |
| M-Pesa Daraja integration | 🔄 Sandbox — awaiting go-live |
| Pesapal card payments | 🔄 Sandbox — awaiting approval |
| hCaptcha bot protection | 🔄 Pending configuration |
| Custom domain | 📋 Planned |
| Audio licensing | 📋 Awaiting Stiftung reply |
| SMS notifications | 📋 Planned |

---

## ✦ Complete File Structure

```
The-Grail-Message/
│
├── index.html                        ← Main bookstore (protected — requires login)
├── netlify.toml                      ← Netlify config, security headers, redirects
├── package.json                      ← Root dependencies (Supabase)
├── README.md                         ← This file
│
├── login/
│   └── index.html                    ← Login, signup and forgot password page
│
├── welcome/
│   └── index.html                    ← Welcome page after email verification
│
├── admin/
│   └── index.html                    ← Admin dashboard (subscribers, orders, messages)
│
├── payment-success/
│   └── index.html                    ← Payment confirmation page (Pesapal)
│
├── reset-password/
│   └── index.html                    ← Password reset page
│
└── netlify/
    └── functions/
        ├── package.json              ← Functions dependencies
        ├── security.js               ← Shared security utilities
        ├── save-subscriber.js        ← PDF signup → Supabase subscribers table
        ├── place-order.js            ← Book orders → Supabase orders table
        ├── mpesa-payment.js          ← M-Pesa Daraja STK Push (Buy Goods)
        ├── mpesa-callback.js         ← M-Pesa payment confirmation from Safaricom
        ├── mpesa-query.js            ← Query M-Pesa transaction status
        ├── pesapal-pay.js            ← Pesapal card payment initiation
        ├── pesapal-callback.js       ← Pesapal IPN payment confirmation
        ├── pesapal-status.js         ← Query Pesapal payment status
        ├── contact-message.js        ← Contact form → Supabase
        ├── admin-dashboard.js        ← Admin data API (protected)
        ├── auth0-verify.js           ← Token verification utility
        └── keep-alive.js             ← Daily Supabase ping (prevents pausing)
```

---

## ✦ Book Catalogue

| # | Title | Author | Price (KSH) | Category |
|---|-------|--------|-------------|---------|
| 1 | In the Light of Truth — Vol. I | Abd-ru-shin | 2,500 | Core Work |
| 2 | In the Light of Truth — Vol. II | Abd-ru-shin | 2,500 | Core Work |
| 3 | In the Light of Truth — Vol. III | Abd-ru-shin | 2,500 | Core Work |
| 4 | Complete 3-Volume Boxed Set | Abd-ru-shin | 6,500 | Best Value |
| 5 | The Ten Commandments of God & The Lord's Prayer | Abd-ru-shin | 1,800 | Sacred Commentary |
| 6 | Prayers — Given to Mankind by Abd-ru-shin | Abd-ru-shin | 1,500 | Devotional |
| 7 | Questions and Answers | Abd-ru-shin | 2,000 | Reference |
| 8 | Selected Lectures from In the Light of Truth | Abd-ru-shin | 1,800 | Introductory |
| 9 | Thoughts on the Work "In the Light of Truth" | Abd-ru-shin | 1,900 | Reflective Study |
| 10 | Lectures in the Proximity of Abd-ru-shin | Dr. Kurt Illig | 2,000 | Scholarly |

---

## ✦ Audio Chapter Pricing

| Item | Price |
|------|-------|
| Single audio chapter | **KSH 20** |
| Available chapters | 6 introductory chapters |
| Format | MP3 (official recordings pending licensing) |

### Available Chapters
1. What Is the Grail Message?
2. What Seek Ye?
3. Awake!
4. The Laws of Creation
5. Karma
6. The Holy Grail

> **Note:** Official audio licensing request submitted to Stiftung
> Gralsbotschaft / Alexander Bernhardt Verlag. Awaiting approval.

---

## ✦ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Hosting | Netlify | Static hosting, functions, CDN |
| Database | Supabase (PostgreSQL) | All business data |
| Authentication | Supabase Auth | User login, signup, sessions |
| Backend | Netlify Functions (Node.js) | API, payments, security |
| Payments | M-Pesa Daraja 2.0 | Mobile money payments |
| Payments | Pesapal | Card payments (Visa/Mastercard) |
| Security | hCaptcha | Bot protection on forms |
| Analytics | Simple Analytics | Privacy-friendly visitor tracking |
| Email | Gmail SMTP via Supabase | Auth emails |
| Frontend | Vanilla HTML/CSS/JS | No framework needed |
| Fonts | Google Fonts (Cinzel, EB Garamond) | Typography |

---

## ✦ Supabase Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `subscribers` | PDF download signups | email, first_name, city, pdf_downloaded |
| `books` | Book catalogue | title, price_ksh, category, in_stock |
| `orders` | Customer orders | full_name, email, total_ksh, status |
| `order_items` | Books per order | order_id, book_title, quantity, unit_price |
| `payments` | Payment records | order_id, method, amount_ksh, status, mpesa_ref |
| `audio_purchases` | Audio chapter sales | email, chapter_title, amount_ksh (KSH 20) |
| `contact_messages` | Enquiries | name, email, subject, message, is_read |
| `admin_users` | Admin accounts | email, full_name, role, is_active |

### Row Level Security
All tables have RLS enabled:
- Public can INSERT subscribers, orders, order_items, payments, contact_messages
- Only authenticated users can SELECT all data
- Books readable by public (in_stock = true)

---

## ✦ Netlify Environment Variables

Set these in:
```
Netlify → grailmessagekenya → Site configuration → Environment variables
```

### Supabase
| Variable | Where to Get | Sensitive |
|----------|-------------|-----------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL | No |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | ✅ Yes |
| `SITE_URL` | `https://grailmessagekenya.netlify.app` | No |

### M-Pesa Daraja
| Variable | Where to Get | Sensitive |
|----------|-------------|-----------|
| `MPESA_CONSUMER_KEY` | Safaricom Daraja Portal | ✅ Yes |
| `MPESA_CONSUMER_SECRET` | Safaricom Daraja Portal | ✅ Yes |
| `MPESA_SHORTCODE` | `174379` sandbox / Paybill live | No |
| `MPESA_TILL_NUMBER` | `0716748004` | No |
| `MPESA_PASSKEY` | Safaricom Daraja Portal | ✅ Yes |
| `MPESA_CALLBACK_URL` | `https://grailmessagekenya.netlify.app/api/mpesa-callback` | No |
| `MPESA_ENV` | `sandbox` or `live` | No |

### Pesapal
| Variable | Where to Get | Sensitive |
|----------|-------------|-----------|
| `PESAPAL_CONSUMER_KEY` | Pesapal merchant dashboard | ✅ Yes |
| `PESAPAL_CONSUMER_SECRET` | Pesapal merchant dashboard | ✅ Yes |
| `PESAPAL_ENV` | `sandbox` or `live` | No |

### Security Scanning
| Variable | Value | Purpose |
|----------|-------|---------|
| `SECRETS_SCAN_OMIT_KEYS` | `SUPABASE_ANON,AUTH0_PRIVATE_KEY` | Prevent false positives |

---

## ✦ M-Pesa Payment Flow

```
Customer adds books to cart
         ↓
Clicks Checkout → fills name, email, phone
         ↓
Selects M-Pesa payment
         ↓
place-order.js saves order to Supabase (status: pending)
         ↓
mpesa-payment.js sends STK Push to customer phone
(Buy Goods — CustomerBuyGoodsOnline → 0716748004)
         ↓
Customer sees M-Pesa prompt on their phone
         ↓
Customer enters M-Pesa PIN
         ↓
Safaricom processes payment
         ↓
mpesa-callback.js receives confirmation from Safaricom
         ↓
Order updated to PAID in Supabase
         ↓
Payment recorded with M-Pesa receipt number
```

---

## ✦ User Authentication Flow

```
Visitor arrives at grailmessagekenya.netlify.app
         ↓
Auth gate checks for Supabase session (runs immediately)
         ↓
No session → redirect to /login/
         ↓
User signs up with name, email, phone, city, password
         ↓
Supabase sends verification email via Gmail SMTP
         ↓
User clicks verification link in email
         ↓
Lands on /welcome/ — personalised welcome message
         ↓
Clicks Enter the Bookstore
         ↓
Main site loads — shows 👤 FirstName in nav
         ↓
User record saved in both auth.users and subscribers table
```

---

## ✦ Security Layers

| Layer | Implementation |
|-------|---------------|
| HTTPS enforced | Strict-Transport-Security header — 2 years |
| Clickjacking blocked | X-Frame-Options: DENY |
| XSS protection | Content-Security-Policy + X-XSS-Protection |
| MIME sniffing blocked | X-Content-Type-Options: nosniff |
| CORS locked | Only grailmessagekenya.netlify.app allowed |
| Rate limiting | Per-IP limits on all functions |
| Input sanitization | All form data cleaned before database |
| SQL injection guards | Pattern detection on all inputs |
| Bot protection | Honeypot fields + hCaptcha (pending) |
| Price tampering blocked | Server-side price validation |
| Secrets protected | All keys in Netlify env vars only |
| Auth protection | Supabase RLS on all tables |
| Site protection | Login required to view any content |

---

## ✦ Netlify Build Configuration

```toml
[build]
  publish = "."
  functions = "netlify/functions"
  command = "npm install"

[functions]
  node_bundler = "esbuild"

[[plugins]]
  package = "@netlify/plugin-functions-install-core"

[functions."keep-alive"]
  schedule = "@daily"
```

---

## ✦ Deployed Functions

| Function | Endpoint | Method |
|----------|---------|--------|
| save-subscriber | /api/save-subscriber | POST |
| place-order | /api/place-order | POST |
| mpesa-payment | /api/mpesa-payment | POST |
| mpesa-callback | /api/mpesa-callback | POST |
| mpesa-query | /api/mpesa-query | POST |
| pesapal-pay | /api/pesapal-pay | POST |
| pesapal-callback | /api/pesapal-callback | GET |
| pesapal-status | /api/pesapal-status | GET |
| contact-message | /api/contact-message | POST |
| admin-dashboard | /api/admin-dashboard | GET |
| auth0-verify | /api/auth0-verify | POST |
| keep-alive | Scheduled daily | AUTO |

---

## ✦ Pages

| URL | Page | Access |
|-----|------|--------|
| `/` | Main bookstore | 🔒 Requires login |
| `/login/` | Login and signup | 🌐 Public |
| `/welcome/` | Post-verification welcome | 🌐 Public |
| `/admin/` | Admin dashboard | 🔒 Admin only |
| `/payment-success/` | Payment confirmation | 🌐 Public |
| `/reset-password/` | Password reset | 🌐 Public |

---

## ✦ Admin Access

| Field | Value |
|-------|-------|
| **URL** | https://grailmessagekenya.netlify.app/admin/ |
| **Email** | molich60@gmail.com |
| **Role** | admin |
| **Dashboard shows** | Subscribers, Orders, Revenue, Messages |

---

## ✦ Pending Items

### Immediate
- [ ] Add real Supabase anon key to login/welcome/admin pages
- [ ] Configure hCaptcha site key and secret key
- [ ] Set up Gmail App Password for SMTP in Supabase
- [ ] Test M-Pesa sandbox payment end to end
- [ ] Verify Pesapal sandbox integration

### Short Term
- [ ] Get Safaricom Daraja go-live approval
- [ ] Register 0716748004 as Buy Goods Till number
- [ ] Get Pesapal merchant approval
- [ ] Add more books to catalogue when images available
- [ ] Get official audio files licensing from Stiftung Gralsbotschaft

### Future
- [ ] Custom domain purchase
- [ ] SMS order notifications
- [ ] Customer order history page
- [ ] Audio content protection for paid chapters
- [ ] Delivery tracking integration

---

## ✦ About Abd-ru-shin

Abd-ru-shin (pen name of Oskar Ernst Bernhardt, 1875–1941) was a
German spiritual teacher whose principal work *In the Light of Truth —
The Grail Message* comprises 168 lectures on the spiritual Laws of
Creation. The work is published and distributed worldwide by
Stiftung Gralsbotschaft and Alexander Bernhardt Verlag.

**Official Publisher:** https://www.alexander-bernhardt.com

---

## ✦ Licensing

All book content, imagery and audio recordings are the intellectual
property of Stiftung Gralsbotschaft. This website is an authorised
distribution platform. All prices in Kenyan Shillings (KSH).

Website code: MIT License
Book content: © Stiftung Gralsbotschaft — all rights reserved

---

*Built with care for seekers of the Truth across East Africa.*
*"Seek the Truth and the Truth will set you free." — Abd-ru-shin*
