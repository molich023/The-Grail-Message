const { createClient } = require('@supabase/supabase-js');
const { secureHeaders } = require('./security');

exports.handler = async (event) => {
  const headers = secureHeaders(event.headers.origin);
  const checkoutId = event.queryStringParameters.checkout_id;

  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await sb
      .from('orders')
      .select('status, mpesa_receipt, shipping_address')
      .eq('checkout_id', checkoutId)
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: data.status, // completed, pending, or failed
        receipt: data.mpesa_receipt,
        shipping: data.shipping_address ? 'Courier Delivery' : 'Digital'
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
