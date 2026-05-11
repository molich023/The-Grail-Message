/**
 * THE OMNI-SECURITY PROTOCOL
 * Grail Message Kenya - Luminous Architecture
 */

const ALLOWED_ORIGINS = [
  'https://grailmessagekenya.eu.org',      // The Primary Domain
  'https://grailmessagekenya.netlify.app',  // Netlify Subdomain
  'http://localhost:3000',                  // Local Development
  'http://localhost:8888'                   // Netlify CLI Local
];

/**
 * Generates secure headers and validates the origin of the request.
 */
function secureHeaders(origin = '') {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

/**
 * Standard 403 Forbidden Response
 */
function blocked(headers, reason = 'Forbidden') {
  return { 
    statusCode: 403, 
    headers, 
    body: JSON.stringify({ error: reason, safety: "Access denied by security protocol." }) 
  };
}

const store = new Map();

/**
 * Prevents automated attacks by limiting requests per IP
 */
function rateLimit(ip, options = {}) {
  const { windowMs = 60000, maxRequests = 10 } = options;
  const now = Date.now(); 
  const key = ip || 'unknown';

  if (!store.has(key)) { 
    store.set(key, { count: 1, start: now }); 
    return { limited: false }; 
  }

  const r = store.get(key);
  if (now - r.start > windowMs) { 
    store.set(key, { count: 1, start: now }); 
    return { limited: false }; 
  }

  r.count++;
  if (r.count > maxRequests) {
    return { 
      limited: true, 
      retryAfter: Math.ceil((r.start + windowMs - now) / 1000) 
    };
  }
  return { limited: false };
}

/**
 * Extracts the real IP of the seeker
 */
function getClientIP(event) {
  return event.headers['x-forwarded-for']?.split(',')[0].trim() || 
         event.headers['client-ip'] || 
         'unknown';
}

/**
 * Cleans individual strings of malicious code
 */
function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 1000); // Increased limit for spiritual messages
}

/**
 * Cleans entire objects/payloads
 */
function sanitizeAll(obj) {
  if (typeof obj !== 'object' || obj === null) return sanitize(String(obj));
  const c = {};
  for (const [k, v] of Object.entries(obj)) {
    c[k] = typeof v === 'object' ? sanitizeAll(v) : sanitize(String(v ?? ''));
  }
  return c;
}

function validateEmail(e) { 
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(e).trim()); 
}

function validatePhone(p) { 
  // Validates Kenyan numbers (07..., 01..., +254...)
  return /^(\+?254|0)[17]\d{8}$/.test(String(p).replace(/[\s\-().]/g, '')); 
}

function validateRequired(obj, fields) { 
  return fields.filter(f => !obj[f] || String(obj[f]).trim() === ''); 
}

/**
 * Honeypot Bot Detection
 */
function isBot(b) { 
  return !!(b['bot-field'] || b.website || b.url); 
}

/**
 * Scans for SQL injection patterns
 */
function checkForInjection(obj) {
  const P = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/i,
    /(--|;|\/\*|\*\/)/i,
    /(xp_)/i // Common SQL Server prefix
  ];
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && P.some(p => p.test(v))) return true;
    if (typeof v === 'object' && v !== null && checkForInjection(v)) return true;
  }
  return false;
}

/**
 * Handles browser OPTIONS requests (Preflight)
 */
function handlePreflight(headers) { 
  return { statusCode: 200, headers, body: '' }; 
}

module.exports = { 
  secureHeaders, 
  blocked, 
  rateLimit, 
  getClientIP, 
  sanitize, 
  sanitizeAll, 
  validateEmail, 
  validatePhone, 
  validateRequired, 
  isBot, 
  checkForInjection, 
  handlePreflight 
};
