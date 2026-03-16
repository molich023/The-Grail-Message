const { createClient } = require('@supabase/supabase-js');
const {
  secureHeaders,
  handlePreflight
} = require('./security');

function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch(e) { return null; }
}

exports.handler = async (event) => {
  const origin  = event.headers.origin || '';
  const headers = secureHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);

  try {
    // Verify authentication
    const authHeader = event.headers.authorization ||
                       event.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required.' })
      };
    }

    const token   = authHeader.replace('Bearer ', '');
    const payload = decodeJWT(token);

    if (!payload) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token.' })
      };
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Session expired. Please log in again.' })
      };
    }

    // Connect to Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Fetch all dashboard data simultaneously
    const [subscribers, orders, payments, messages] = await Promise.all([

      supabase
        .from('subscribers')
        .select('id, first_name, last_name, email, phone, country, city, subscribed_at')
        .order('subscribed_at', { ascending: false })
        .limit(20),

      supabase
        .from('orders')
        .select('id, full_name, email, phone, total_ksh, status, payment_method, created_at')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('payments')
        .select('amount_ksh, status')
        .eq('status', 'completed'),

      supabase
        .from('contact_messages')
        .select('id, name, email, phone, subject, message, created_at')
        .eq('is_read', false)
        .order('created_at', { ascending: false })

    ]);

    // Calculate total revenue
    const totalRevenue = (payments.data || [])
      .reduce((sum, p) => sum + (p.amount_ksh || 0), 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summary: {
          total_subscribers: subscribers.data?.length || 0,
          total_orders:      orders.data?.length || 0,
          total_revenue_ksh: totalRevenue,
          unread_messages:   messages.data?.length || 0
        },
        recent_subscribers: subscribers.data || [],
        recent_orders:      orders.data || [],
        unread_messages:    messages.data || []
      })
    };

  } catch (err) {
    console.error('admin-dashboard error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not load dashboard data.' })
    };
  }
};
