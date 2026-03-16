const { createClient } = require('@supabase/supabase-js');
const { secureHeaders, blocked, rateLimit, getClientIP, sanitizeAll, validateEmail, validatePhone, validateRequired, isBot, checkForInjection, handlePreflight } = require('./security');
exports.handler = async (event) => {
  const origin = event.headers.origin||''; const headers = secureHeaders(origin);
  if (event.httpMethod==='OPTIONS') return handlePreflight(headers);
  if (event.httpMethod!=='POST') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  const limit = rateLimit(getClientIP(event),{windowMs:60000,maxRequests:5});
  if (limit.limited) return {statusCode:429,headers,body:JSON.stringify({error:`Wait ${limit.retryAfter}s.`})};
  try {
    const raw = JSON.parse(event.body||'{}');
    if (isBot(raw)) return {statusCode:200,headers,body:JSON.stringify({success:true})};
    const d = sanitizeAll(raw);
    const missing = validateRequired(d,['first_name','last_name','email','phone','city']);
    if (missing.length) return {statusCode:400,headers,body:JSON.stringify({error:`Missing: ${missing.join(', ')}`})};
    if (!validateEmail(d.email)) return {statusCode:400,headers,body:JSON.stringify({error:'Invalid email.'})};
    if (!validatePhone(d.phone)) return {statusCode:400,headers,body:JSON.stringify({error:'Invalid phone.'})};
    if (checkForInjection(d)) return blocked(headers,'Invalid input.');
    const sb = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
    const {data:ex} = await sb.from('subscribers').select('id').eq('email',d.email).single();
    if (ex) { await sb.from('subscribers').update({pdf_downloaded:true}).eq('email',d.email); return {statusCode:200,headers,body:JSON.stringify({success:true,message:'Welcome back! PDF ready.'})}; }
    const {error} = await sb.from('subscribers').insert([{first_name:d.first_name,last_name:d.last_name,email:d.email,phone:d.phone,country:d.country||'Kenya',city:d.city,occupation:d.occupation||null,referral:d.referral||null,pdf_downloaded:true}]);
    if (error) throw error;
    return {statusCode:200,headers,body:JSON.stringify({success:true,message:'Saved! PDF ready.'})};
  } catch(err) { console.error('save-subscriber:',err.message); return {statusCode:500,headers,body:JSON.stringify({error:'Something went wrong.'})}; }
};
