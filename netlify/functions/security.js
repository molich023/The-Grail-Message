const ALLOWED_ORIGINS = [
  'https://grailmessagekenya.netlify.app',
  'http://localhost:3000',
  'http://localhost:8888'
];
function secureHeaders(origin = '') {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store'
  };
}
function blocked(headers, reason = 'Forbidden') {
  return { statusCode: 403, headers, body: JSON.stringify({ error: reason }) };
}
const store = new Map();
function rateLimit(ip, options = {}) {
  const { windowMs = 60000, maxRequests = 10 } = options;
  const now = Date.now(); const key = ip || 'unknown';
  if (!store.has(key)) { store.set(key, { count:1, start:now }); return { limited:false }; }
  const r = store.get(key);
  if (now - r.start > windowMs) { store.set(key, { count:1, start:now }); return { limited:false }; }
  r.count++;
  if (r.count > maxRequests) return { limited:true, retryAfter: Math.ceil((r.start+windowMs-now)/1000) };
  return { limited:false };
}
function getClientIP(event) {
  return event.headers['x-forwarded-for']?.split(',')[0].trim() || event.headers['client-ip'] || 'unknown';
}
function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;').trim().slice(0,500);
}
function sanitizeAll(obj) {
  if (typeof obj !== 'object' || obj === null) return sanitize(String(obj));
  const c = {};
  for (const [k,v] of Object.entries(obj)) c[k] = typeof v === 'object' ? sanitizeAll(v) : sanitize(String(v??''));
  return c;
}
function validateEmail(e) { return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(e).trim()); }
function validatePhone(p) { return /^(\+?254|0)[17]\d{8}$/.test(String(p).replace(/[\s\-().]/g,'')); }
function validateRequired(obj,fields) { return fields.filter(f => !obj[f]||String(obj[f]).trim()===''); }
function isBot(b) { return !!(b['bot-field']||b.website||b.url); }
function checkForInjection(obj) {
  const P = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,/(--|;|\/\*|\*\/)/i];
  for (const v of Object.values(obj)) {
    if (typeof v==='string' && P.some(p=>p.test(v))) return true;
    if (typeof v==='object' && checkForInjection(v)) return true;
  }
  return false;
}
function handlePreflight(headers) { return { statusCode:200, headers, body:'' }; }
module.exports = { secureHeaders, blocked, rateLimit, getClientIP, sanitize, sanitizeAll, validateEmail, validatePhone, validateRequired, isBot, checkForInjection, handlePreflight };
