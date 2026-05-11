const { createClient } = require('@supabase/supabase-js');
const { 
  secureHeaders, 
  rateLimit, 
  getClientIP, 
  sanitizeAll, 
  validateEmail, 
  handlePreflight,
  checkForInjection 
} = require('./security');

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = secureHeaders(origin);

  // 1. Handle CORS Preflight
  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);

  // 2. Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  // 3. Strict Rate Limiting (3 messages per minute)
  const limit = rateLimit(getClientIP(event), { windowMs: 60000, maxRequests: 3 });
  if (limit.limited) {
    return { 
      statusCode: 429, 
      headers, 
      body: JSON.stringify({ error: `Please wait ${limit.retryAfter}s before sending another message.` }) 
    };
  }

  try {
    const raw = JSON.parse(event.body || '{}');
    const d = sanitizeAll(raw);

    // 4. Validation
    if (!d.name || !d.message) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Please provide both your name and a message.' }) 
      };
    }

    if (d.email && !validateEmail(d.email)) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'The email address provided is invalid.' }) 
      };
    }

    // 5. Security Injection Check
    if (checkForInjection(d)) {
      return { 
        statusCode: 403, 
        headers, 
        body: JSON.stringify({ error: 'Security violation detected.' }) 
      };
    }

    // 6. Supabase Connection
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const { error } = await sb.from('contact_messages').insert([{
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      subject: d.subject || 'Spiritual Inquiry',
      message: d.message,
      created_at: new Date()
    }]);

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Your message has reached us. We shall reply within 24 hours.' 
      })
    };

  } catch (err) {
    console.error('contact-message error:', err.message);
    // Provide a fallback contact method in the error response
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Technical difficulty. Please reach us at 0736-340024.' }) 
    };
  }
};
