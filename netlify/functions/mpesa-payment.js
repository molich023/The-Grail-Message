// ══════════════════════════════════════════════════════════════════════
// NETLIFY FUNCTION: mpesa-payment.js
// Safaricom Daraja 2.0 — STK Push Payment
// Grail Message Kenya
// ══════════════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES REQUIRED:
//   MPESA_CONSUMER_KEY    → from Daraja portal
//   MPESA_CONSUMER_SECRET → from Daraja portal
//   MPESA_SHORTCODE       → 174379 for sandbox testing
//   MPESA_TILL_NUMBER     → Your phone number as Till: 0716748004 (for live)
//   MPESA_PASSKEY         → from Daraja portal
//   MPESA_CALLBACK_URL    → https://grailmessagekenya.netlify.app/api/mpesa-callback
//   MPESA_ENV             → 'sandbox' or 'live'
// ══════════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const {
  secureHeaders,
  rateLimit,
  getClientIP,
  sanitizeAll,
  validatePhone,
  validateRequired,
  handlePreflight
} = require('./security');

// ── API URLs ──────────────────────────────────────────────────────────
const MPESA_URLS = {
  sandbox: {
    auth:     'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkpush:  'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    query:    'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query'
  },
  live: {
    auth:     'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkpush:  'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    query:    'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
  }
};

// ── Get environment (sandbox or live) ────────────────────────────────
function getEnv() {
  return process.env.MPESA_ENV === 'live' ? 'live' : 'sandbox';
}

// ── Get OAuth access token ────────────────────────────────────────────
async function getMpesaToken() {
  const env  = getEnv();
  const urls = MPESA_URLS[env];

  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await fetch(urls.auth, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Daraja auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data.access_token) {
    throw new Error('No access token received from Daraja');
  }

  return data.access_token;
}

// ── Generate password and timestamp ──────────────────────────────────
function getMpesaPassword() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);

  const raw      = `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
  const password = Buffer.from(raw).toString('base64');

  return { password, timestamp };
}

// ── Format phone number ───────────────────────────────────────────────
// Converts 07XXXXXXXX or +2547XXXXXXXX to 2547XXXXXXXX
function formatPhone(phone) {
  let cleaned = String(phone).replace(/[\s\-().+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  } else if (cleaned.startsWith('+254')) {
    cleaned = cleaned.slice(1);
  } else if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

// ── Main handler ──────────────────────────────────────────────────────
exports.handler = async (event) => {
  const origin  = event.headers.origin || '';
  const headers = secureHeaders(origin);

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);

  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Rate limit — max 3 payment attempts per IP per 5 minutes
  const ip    = getClientIP(event);
  const limit = rateLimit(ip, { windowMs: 300000, maxRequests: 3 });
  if (limit.limited) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: `Too many payment attempts. Please wait ${limit.retryAfter} seconds.`
      })
    };
  }

  try {
    // Parse and sanitize input
    const raw  = JSON.parse(event.body || '{}');
    const data = sanitizeAll(raw);

    const { phone, amount_ksh, order_id, description } = data;

    // Validate required fields
    const missing = validateRequired(data, ['phone', 'amount_ksh', 'order_id']);
    if (missing.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Missing: ${missing.join(', ')}` })
      };
    }

    // Validate phone
    if (!validatePhone(phone)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid phone number. Please use format 07XXXXXXXX'
        })
      };
    }

    // Validate amount
    const amount = Math.ceil(parseFloat(amount_ksh));
    if (isNaN(amount) || amount < 1) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid payment amount.' })
      };
    }

    const formattedPhone = formatPhone(phone);
    const env            = getEnv();
    const urls           = MPESA_URLS[env];

    console.log(`M-Pesa Buy Goods: KSH ${amount} from ${formattedPhone} to till ${process.env.MPESA_TILL_NUMBER||process.env.MPESA_SHORTCODE} [${env}]`);

    // Get access token
    const token = await getMpesaToken();

    // Generate password
    const { password, timestamp } = getMpesaPassword();

    // Build account reference
    const accountRef = `GMK-${order_id.toString().slice(0, 8).toUpperCase()}`;

    // Send STK Push request
    const stkRes = await fetch(urls.stkpush, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password:          password,
        Timestamp:         timestamp,
        TransactionType:   'CustomerBuyGoodsOnline',
        Amount:            amount,
        PartyA:            formattedPhone,
        PartyB:            process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE,
        PhoneNumber:       formattedPhone,
        CallBackURL:       process.env.MPESA_CALLBACK_URL,
        AccountReference:  accountRef,
        TransactionDesc:   description || 'Grail Message Kenya Book Order'
      })
    });

    const stkData = await stkRes.json();

    console.log('STK Push response:', JSON.stringify(stkData));

    // Check response
    if (stkData.ResponseCode !== '0') {
      throw new Error(
        stkData.ResponseDescription ||
        stkData.errorMessage ||
        'STK Push failed'
      );
    }

    // Save payment record to Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    await supabase.from('payments').update({
      mpesa_phone:    formattedPhone,
      transaction_id: stkData.CheckoutRequestID,
      status:         'pending'
    }).eq('order_id', order_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:             true,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        message:             `M-Pesa prompt sent to ${phone}. Please enter your PIN to complete payment.`,
        amount:              amount,
        reference:           accountRef,
        environment:         env
      })
    };

  } catch (err) {
    console.error('mpesa-payment error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'M-Pesa payment initiation failed. Please try again or call 0704-658022.'
      })
    };
  }
};
