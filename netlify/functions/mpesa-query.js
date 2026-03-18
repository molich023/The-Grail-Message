// ══════════════════════════════════════════════════════════════════════
// NETLIFY FUNCTION: mpesa-query.js
// Query the status of an M-Pesa STK Push transaction
// Endpoint: POST /api/mpesa-query
// ══════════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const {
  secureHeaders,
  rateLimit,
  getClientIP,
  sanitizeAll,
  validateRequired,
  handlePreflight
} = require('./security');

const MPESA_URLS = {
  sandbox: {
    auth:  'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    query: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query'
  },
  live: {
    auth:  'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    query: 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
  }
};

async function getMpesaToken(env) {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res  = await fetch(MPESA_URLS[env].auth, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  const data = await res.json();
  return data.access_token;
}

function getMpesaPassword() {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
  const raw       = `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
  return { password: Buffer.from(raw).toString('base64'), timestamp };
}

exports.handler = async (event) => {
  const origin  = event.headers.origin || '';
  const headers = secureHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ip    = getClientIP(event);
  const limit = rateLimit(ip, { windowMs: 60000, maxRequests: 10 });
  if (limit.limited) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests.' }) };
  }

  try {
    const raw  = JSON.parse(event.body || '{}');
    const data = sanitizeAll(raw);

    const missing = validateRequired(data, ['checkout_request_id']);
    if (missing.length) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: 'checkout_request_id is required.' })
      };
    }

    const env            = process.env.MPESA_ENV === 'live' ? 'live' : 'sandbox';
    const token          = await getMpesaToken(env);
    const { password, timestamp } = getMpesaPassword();

    const res = await fetch(MPESA_URLS[env].query, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode:   process.env.MPESA_SHORTCODE,
        Password:            password,
        Timestamp:           timestamp,
        CheckoutRequestID:   data.checkout_request_id
      })
    });

    const result = await res.json();

    // Map result code to status
    let status  = 'pending';
    let message = 'Payment is being processed.';

    if (result.ResultCode === '0') {
      status  = 'completed';
      message = '✅ Payment confirmed!';
    } else if (result.ResultCode === '1032') {
      status  = 'cancelled';
      message = 'Payment was cancelled.';
    } else if (result.ResultCode) {
      status  = 'failed';
      message = result.ResultDesc || 'Payment failed.';
    }

    // Also update Supabase if completed or failed
    if (status === 'completed' || status === 'failed') {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      await supabase.from('payments')
        .update({ status })
        .eq('transaction_id', data.checkout_request_id);
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        status,
        message,
        result_code: result.ResultCode,
        result_desc: result.ResultDesc
      })
    };

  } catch(err) {
    console.error('mpesa-query error:', err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Could not query payment status.' })
    };
  }
};
