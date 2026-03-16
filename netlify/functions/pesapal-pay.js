// ══════════════════════════════════════════════════════════════════════
// NETLIFY FUNCTION: pesapal-pay.js
// Initiates a Pesapal card/mobile payment and returns a redirect URL
// Endpoint: POST /api/pesapal-pay
// ══════════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES REQUIRED (add in Netlify → Environment variables):
//   PESAPAL_CONSUMER_KEY      → from Pesapal merchant dashboard
//   PESAPAL_CONSUMER_SECRET   → from Pesapal merchant dashboard
//   PESAPAL_ENV               → "sandbox" for testing, "live" for production
//   SITE_URL                  → https://grailmessagekenya.netlify.app
// ══════════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const {
  secureHeaders, blocked, rateLimit, getClientIP,
  sanitizeAll, validateEmail, validatePhone,
  validateRequired, isBot, checkForInjection, handlePreflight
} = require('./security');

// Pesapal API base URLs
const PESAPAL_URLS = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  live:    'https://pay.pesapal.com/v3'
};

// ── STEP 1: Get OAuth token from Pesapal ──────────────────────────────
async function getPesapalToken(baseUrl) {
  const res = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      consumer_key:    process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
    })
  });

  const data = await res.json();

  if (!data.token) {
    throw new Error(`Pesapal auth failed: ${data.message || 'No token returned'}`);
  }

  return data.token;
}

// ── STEP 2: Register IPN (Instant Payment Notification) URL ───────────
// This tells Pesapal where to send payment confirmations.
// Only needs to be registered once but safe to call each time.
async function registerIPN(baseUrl, token) {
  const ipnUrl = `${process.env.SITE_URL}/api/pesapal-callback`;

  const res = await fetch(`${baseUrl}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      url:          ipnUrl,
      ipn_notification_type: 'GET'  // Pesapal sends a GET request to your callback
    })
  });

  const data = await res.json();
  return data.ipn_id || null;
}

// ── STEP 3: Submit the order to Pesapal ───────────────────────────────
async function submitOrder(baseUrl, token, ipnId, orderPayload) {
  const res = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(orderPayload)
  });

  const data = await res.json();

  if (!data.redirect_url) {
    throw new Error(`Pesapal order failed: ${data.message || JSON.stringify(data)}`);
  }

  return data;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────
exports.handler = async (event) => {
  const origin  = event.headers.origin || '';
  const headers = secureHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit — max 3 payment attempts per IP per 5 minutes
  const ip    = getClientIP(event);
  const limit = rateLimit(ip, { windowMs: 300000, maxRequests: 3 });
  if (limit.limited) {
    return {
      statusCode: 429, headers,
      body: JSON.stringify({ error: `Too many payment attempts. Please wait ${limit.retryAfter} seconds.` })
    };
  }

  try {
    const raw = JSON.parse(event.body || '{}');

    // Bot check
    if (isBot(raw)) return blocked(headers, 'Bot detected.');

    // Sanitize
    const data = sanitizeAll(raw);
    const { full_name, email, phone, order_id, amount_ksh, description } = data;

    // Validate required fields
    const missing = validateRequired(data, ['full_name', 'email', 'phone', 'order_id', 'amount_ksh']);
    if (missing.length) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
      };
    }

    if (!validateEmail(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address.' }) };
    }

    if (checkForInjection(data)) return blocked(headers, 'Invalid input detected.');

    // Amount must be a positive number
    const amount = parseFloat(amount_ksh);
    if (isNaN(amount) || amount <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid payment amount.' }) };
    }

    // Split full name into first/last for Pesapal
    const nameParts  = full_name.trim().split(/\s+/);
    const first_name = nameParts[0] || full_name;
    const last_name  = nameParts.slice(1).join(' ') || first_name;

    // Format phone for Pesapal: 0712345678 → 254712345678
    const formattedPhone = phone.replace(/^0/, '254').replace(/[^0-9]/g, '');

    // Choose sandbox or live
    const env     = process.env.PESAPAL_ENV === 'live' ? 'live' : 'sandbox';
    const baseUrl = PESAPAL_URLS[env];

    // Get token
    const token = await getPesapalToken(baseUrl);

    // Register IPN
    const ipnId = await registerIPN(baseUrl, token);

    // Build order reference — short, unique, human-readable
    const reference = `GMK-${order_id.toString().slice(0, 8).toUpperCase()}`;

    // Submit order to Pesapal
    const pesapalOrder = await submitOrder(baseUrl, token, ipnId, {
      id:                  reference,
      currency:            'KES',
      amount:              amount,
      description:         description || 'Grail Message Kenya — Book Order',
      callback_url:        `${process.env.SITE_URL}/payment-success?order=${order_id}`,
      notification_id:     ipnId,
      billing_address: {
        email_address:  email,
        phone_number:   formattedPhone,
        country_code:   'KE',
        first_name:     first_name,
        last_name:      last_name
      }
    });

    // Save payment record in Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    await supabase.from('payments').upsert([{
      order_id:        order_id,
      payment_method:  'pesapal',
      amount_ksh:      amount,
      status:          'pending',
      transaction_id:  pesapalOrder.order_tracking_id,
      pesapal_ref:     reference
    }], { onConflict: 'order_id' });

    // Return the Pesapal redirect URL to the frontend
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success:      true,
        redirect_url: pesapalOrder.redirect_url,
        tracking_id:  pesapalOrder.order_tracking_id,
        reference:    reference,
        message:      'Redirecting to Pesapal secure payment page...'
      })
    };

  } catch (err) {
    console.error('pesapal-pay error:', err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({
        error: 'Payment initiation failed. Please try M-Pesa or call 0736-340024.'
      })
    };
  }
};
