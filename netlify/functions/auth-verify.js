const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { 
  secureHeaders, 
  rateLimit, 
  getClientIP, 
  sanitizeAll, 
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

  // 2. Rate Limiting (Stricter for Login - 3 attempts per minute)
  const limit = rateLimit(getClientIP(event), { windowMs: 60000, maxRequests: 3 });
  if (limit.limited) {
    return { 
      statusCode: 429, 
      headers, 
      body: JSON.stringify({ error: `Too many attempts. Please wait ${limit.retryAfter}s.` }) 
    };
  }

  try {
    const raw = JSON.parse(event.body || '{}');
    
    // 3. Cloudflare Turnstile Verification
    const token = raw['cf-turnstile-response'];
    if (!token) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Security token missing.' }) };
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

    // 4. Sanitize Input & Check for Injection
    const { email, pass } = sanitizeAll(raw);
    if (checkForInjection({ email, pass })) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid characters detected.' }) };
    }

    // 5. Supabase Authentication
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pass
    });

    if (error) {
      return { 
        statusCode: 401, 
        headers, 
        body: JSON.stringify({ error: 'The Guardian credentials provided are incorrect.' }) 
      };
    }

    // 6. Success Response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Welcome to the Sanctuary.',
        session: data.session 
      })
    };

  } catch (err) {
    console.error('auth-verify error:', err.message);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'The Sanctuary gates are temporarily barred. Try again later.' }) 
    };
  }
};
