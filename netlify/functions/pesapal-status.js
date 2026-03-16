const { createClient } = require('@supabase/supabase-js');
const {
  secureHeaders,
  handlePreflight,
  getClientIP,
  rateLimit
} = require('./security');

exports.handler = async (event) => {
  const origin  = event.headers.origin || '';
  const headers = secureHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const ip    = getClientIP(event);
  const limit = rateLimit(ip, { windowMs: 60000, maxRequests: 20 });
  if (limit.limited) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Too many requests.' })
    };
  }

  try {
    const { order_id } = event.queryStringParameters || {};

    if (!order_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'order_id is required.' })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: payment, error } = await supabase
      .from('payments')
      .select('status, amount_ksh, payment_method, pesapal_ref, paid_at')
      .eq('order_id', order_id)
      .single();

    if (error || !payment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Payment not found.' })
      };
    }

    const messages = {
      completed: '✅ Payment confirmed! Your order is being processed.',
      pending:   '⏳ Payment is being processed. Please wait...',
      failed:    '❌ Payment was not completed. Please try again.',
      refunded:  '↩️ Payment was reversed or refunded.'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:        true,
        order_id,
        status:         payment.status,
        amount_ksh:     payment.amount_ksh,
        payment_method: payment.payment_method,
        reference:      payment.pesapal_ref,
        paid_at:        payment.paid_at,
        message:        messages[payment.status] || 'Status unknown.'
      })
    };

  } catch (err) {
    console.error('pesapal-status error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not check payment status.' })
    };
  }
};
