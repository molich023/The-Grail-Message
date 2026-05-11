const { createClient } = require('@supabase/supabase-js');
const { 
  secureHeaders, 
  blocked, 
  rateLimit, 
  getClientIP, 
  sanitizeAll, 
  validateEmail, 
  validatePhone, 
  validateRequired, 
  isBot, 
  checkForInjection, 
  handlePreflight 
} = require('./security');

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = secureHeaders(origin);

  // 1. Handle CORS Preflight
  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);

  // 2. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // 3. Rate Limiting (5 requests per minute per IP)
  const limit = rateLimit(getClientIP(event), { windowMs: 60000, maxRequests: 5 });
  if (limit.limited) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: `Please wait ${limit.retryAfter}s before trying again.` })
    };
  }

  try {
    const raw = JSON.parse(event.body || '{}');

    // 4. Bot Protection (Honeypot)
    if (isBot(raw)) {
      console.log('Bot detected and blocked.');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // 5. Data Sanitization and Validation
    const d = sanitizeAll(raw);
    const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'city'];
    const missing = validateRequired(d, requiredFields);

    if (missing.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Required: ${missing.join(', ')}` })
      };
    }

    if (!validateEmail(d.email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email format.' }) };
    }

    if (!validatePhone(d.phone)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please use a valid Kenyan phone number.' }) };
    }

    // 6. Security Injection Check
    if (checkForInjection(d)) {
      return blocked(headers, 'Security violation detected.');
    }

    // 7. Supabase Operation
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Check if subscriber already exists
    const { data: existing } = await sb
      .from('subscribers')
      .select('id')
      .eq('email', d.email)
      .single();

    if (existing) {
      // Update existing record
      await sb.from('subscribers')
        .update({ pdf_downloaded: true, last_active: new Date() })
        .eq('email', d.email);
        
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Welcome back! Your path to the Message is open.' 
        })
      };
    }

    // Insert new Seeker
    const { error } = await sb.from('subscribers').insert([{
      first_name: d.first_name,
      last_name: d.last_name,
      email: d.email,
      phone: d.phone,
      country: d.country || 'Kenya',
      city: d.city,
      occupation: d.occupation || null,
      referral: d.referral || 'Website Portal',
      pdf_downloaded: true,
      subscribed_at: new Date()
    }]);

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'You have joined the circle. The Light awaits.' 
      })
    };

  } catch (err) {
    console.error('save-subscriber error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'An internal error occurred. Please try again later.' })
    };
  }
};
