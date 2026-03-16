const { createClient } = require('@supabase/supabase-js');
const { secureHeaders, rateLimit, getClientIP, sanitizeAll, validatePhone, validateRequired, handlePreflight } = require('./security');
async function getMpesaToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:`Basic ${auth}`}});
  return (await res.json()).access_token;
}
function getMpesaPassword() {
  const ts = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
  return {password:Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString('base64'),timestamp:ts};
}
exports.handler = async (event) => {
  const origin = event.headers.origin||''; const headers = secureHeaders(origin);
  if (event.httpMethod==='OPTIONS') return handlePreflight(headers);
  if (event.httpMethod!=='POST') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  const limit = rateLimit(getClientIP(event),{windowMs:300000,maxRequests:3});
  if (limit.limited) return {statusCode:429,headers,body:JSON.stringify({error:`Wait ${limit.retryAfter}s.`})};
  try {
    const d = sanitizeAll(JSON.parse(event.body||'{}'));
    const missing = validateRequired(d,['phone','amount_ksh','order_id']);
    if (missing.length) return {statusCode:400,headers,body:JSON.stringify({error:`Missing: ${missing.join(', ')}`})};
    if (!validatePhone(d.phone)) return {statusCode:400,headers,body:JSON.stringify({error:'Invalid phone.'})};
    const phone = d.phone.replace(/^0/,'254').replace(/[^0-9]/g,'');
    const token = await getMpesaToken();
    const {password,timestamp} = getMpesaPassword();
    const stk = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({BusinessShortCode:process.env.MPESA_SHORTCODE,Password:password,Timestamp:timestamp,TransactionType:'CustomerPayBillOnline',Amount:Math.ceil(parseFloat(d.amount_ksh)),PartyA:phone,PartyB:process.env.MPESA_SHORTCODE,PhoneNumber:phone,CallBackURL:process.env.MPESA_CALLBACK_URL,AccountReference:`GMK-${d.order_id.toString().slice(0,8).toUpperCase()}`,TransactionDesc:'Grail Message Kenya'})});
    const stkData = await stk.json();
    if (stkData.ResponseCode!=='0') throw new Error(stkData.ResponseDescription||'STK failed');
    const sb = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
    await sb.from('payments').update({mpesa_phone:phone,transaction_id:stkData.CheckoutRequestID,status:'pending'}).eq('order_id',d.order_id);
    return {statusCode:200,headers,body:JSON.stringify({success:true,message:`M-Pesa prompt sent to ${d.phone}. Enter PIN to complete.`})};
  } catch(err) { console.error('mpesa-payment:',err.message); return {statusCode:500,headers,body:JSON.stringify({error:'M-Pesa failed. Call 0736-340024.'})}; }
};
