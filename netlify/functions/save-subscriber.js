const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Standard for calling Cloudflare API
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

  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const limit = rateLimit(getClientIP(event), { windowMs: 60000, maxRequests: 5 });
  if (limit.limited) return { statusCode: 429, headers, body: JSON.stringify({ error: `Please wait ${limit.retryAfter}s.` }) };

  try {
    const raw = JSON.parse(event.body || '{}');
    
    // 1. CLOUDFLARE TURNSTILE VERIFICATION
    const token = raw['cf-turnstile-response'];
    const ip = getClientIP(event);
    
    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Security verification missing.' }) };
    }

    const formData = new URLSearchParams();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: formData,
      method: 'POST',
    });

    const outcome = await result.json();
    if (!outcome.success) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Security verification failed. Please try again.' }) };
    }

    // 2. DATA SANITIZATION
    if (isBot(raw)) return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    const d = sanitizeAll(raw);
    
    const missing = validateRequired(d, ['first_name', 'last_name', 'email', 'phone', 'city']);
    if (missing.length) return { statusCode: 400, headers, body: JSON.stringify({ error: `Missing: ${missing.join(', ')}` }) };
    if (!validateEmail(d.email)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email.' }) };
    if (checkForInjection(d)) return blocked(headers, 'Invalid input.');

    // 3. SUPABASE OPERATION
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    const { data: ex } = await sb.from('subscribers').select('id').eq('email', d.email).single();
    
    if (ex) {
      await sb.from('subscribers').update({ pdf_downloaded: true, last_active: new Date() }).eq('email', d.email);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Welcome back! The path is open.' }) };
    }

    const { error } = await sb.from('subscribers').insert([{
      first_name: d.first_name,
      last_name: d.last_name,
      email: d.email,
      phone: d.phone,
      city: d.city,
      country: d.country || 'Kenya',
      pdf_downloaded: true,
      subscribed_at: new Date()
    }]);

    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'You have joined the circle. The Light awaits.' }) };

  } catch (err) {
    console.error('save-subscriber error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Something went wrong.' }) };
  }
};
