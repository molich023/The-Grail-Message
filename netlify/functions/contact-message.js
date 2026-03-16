const { createClient } = require('@supabase/supabase-js');
const { secureHeaders, rateLimit, getClientIP, sanitizeAll, validateEmail, handlePreflight } = require('./security');
exports.handler = async (event) => {
  const origin = event.headers.origin||''; const headers = secureHeaders(origin);
  if (event.httpMethod==='OPTIONS') return handlePreflight(headers);
  if (event.httpMethod!=='POST') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  const limit = rateLimit(getClientIP(event),{windowMs:60000,maxRequests:3});
  if (limit.limited) return {statusCode:429,headers,body:JSON.stringify({error:`Wait ${limit.retryAfter}s.`})};
  try {
    const raw = JSON.parse(event.body||'{}');
    const d = sanitizeAll(raw);
    if (!d.name||!d.message) return {statusCode:400,headers,body:JSON.stringify({error:'Name and message required.'})};
    if (d.email&&!validateEmail(d.email)) return {statusCode:400,headers,body:JSON.stringify({error:'Invalid email.'})};
    const sb = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
    const {error} = await sb.from('contact_messages').insert([{name:d.name,email:d.email||null,phone:d.phone||null,subject:d.subject||'General Enquiry',message:d.message}]);
    if (error) throw error;
    return {statusCode:200,headers,body:JSON.stringify({success:true,message:'Message received. We reply within 24 hours.'})};
  } catch(err) { console.error('contact-message:',err.message); return {statusCode:500,headers,body:JSON.stringify({error:'Could not send. Call 0736-340024.'})}; }
};
