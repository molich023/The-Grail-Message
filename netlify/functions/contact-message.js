const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
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

  // 1. Handle Preflight & Method Validation
  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // 2. Rate Limiting (3 inquiries per minute to prevent spam)
  const limit = rateLimit(getClientIP(event), { windowMs: 60000, maxRequests: 3 });
  if (limit.limited) {
    return { 
      statusCode: 429, 
      headers, 
      body: JSON.stringify({ error: `Please wait ${limit.retryAfter}s before sending again.` }) 
    };
  }

  try {
    const raw = JSON.parse(event.body || '{}');
    
    // 3. Cloudflare Turnstile Verification
    const token = raw['cf-turnstile-response'];
    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Security verification missing.' }) };
    }

    const formData = new URLSearchParams();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', getClientIP(event));

    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const outcome = await verifyResponse.json();
    if (!outcome.success) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Security verification failed.' }) };
    }

    // 4. Sanitize Input
    const d = sanitizeAll(raw);
    
    // 5. Validation
    if (!d.name || !d.message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name and message are required.' }) };
    }

    if (d.email && !validateEmail(d.email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address.' }) };
    }

    if (checkForInjection(d)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid input detected.' }) };
    }

    // 6. Supabase Connection & Insertion
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    const { error } = await supabase.from('contact_messages').insert([{
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
        message: 'Your inquiry has been received. We will respond within 24 hours.' 
      })
    };

  } catch (err) {
    console.error('contact-message error:', err.message);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Could not send. Please call or WhatsApp 0736-340024.' }) 
    };
  }
};
