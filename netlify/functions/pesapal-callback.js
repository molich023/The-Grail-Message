const { createClient } = require('@supabase/supabase-js');

const PESAPAL_URLS = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  live: 'https://pay.pesapal.com/v3'
};

async function getPesapalToken(baseUrl) {
  const res = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
    })
  });
  return (await res.json()).token;
}

exports.handler = async (event) => {
  const {
    orderTrackingId,
    orderMerchantReference
  } = event.queryStringParameters || {};

  try {
    if (!orderTrackingId) {
      return { statusCode: 400, body: 'Missing orderTrackingId' };
    }

    const env     = process.env.PESAPAL_ENV === 'live' ? 'live' : 'sandbox';
    const baseUrl = PESAPAL_URLS[env];
    const token   = await getPesapalToken(baseUrl);

    const res = await fetch(
      `${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const status = await res.json();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const statusMap = {
      'Completed': 'completed',
      'Failed':    'failed',
      'Invalid':   'failed',
      'Reversed':  'refunded',
      'Pending':   'pending'
    };

    const ourStatus = statusMap[status.payment_status_description] || 'pending';

    const { data: payment } = await supabase
      .from('payments')
      .update({
        status:      ourStatus,
        pesapal_ref: orderMerchantReference || null,
        paid_at:     ourStatus === 'completed' ? new Date().toISOString() : null
      })
      .eq('transaction_id', orderTrackingId)
      .select('order_id')
      .single();

    if (ourStatus === 'completed' && payment?.order_id) {
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', payment.order_id);
      console.log(`Payment confirmed for order ${payment.order_id}`);
    }

    if (ourStatus === 'failed' && payment?.order_id) {
      await supabase
        .from('orders')
        .update({ status: 'payment_failed' })
        .eq('id', payment.order_id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        orderTrackingId,
        orderMerchantReference,
        status: 200
      })
    };

  } catch (err) {
    console.error('pesapal-callback error:', err.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 200 })
    };
  }
};
