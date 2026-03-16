const { createClient } = require('@supabase/supabase-js');
const { secureHeaders, blocked, rateLimit, getClientIP, sanitizeAll, validateEmail, validatePhone, validateRequired, isBot, checkForInjection, handlePreflight } = require('./security');
const PRICES = {'In the Light of Truth \u2013 Vol. I':2500,'In the Light of Truth \u2013 Vol. II':2500,'In the Light of Truth \u2013 Vol. III':2500,'Complete 3-Volume Boxed Set':6500,'The Ten Commandments of God & The Lord\'s Prayer':1800,'Prayers \u2013 Given to Mankind by Abd-ru-shin':1500,'Questions and Answers':2000,'Selected Lectures from In the Light of Truth':1800,'Thoughts on the Work "In the Light of Truth"':1900,'Lectures in the Proximity of Abd-ru-shin':2000};
exports.handler = async (event) => {
  const origin = event.headers.origin||''; const headers = secureHeaders(origin);
  if (event.httpMethod==='OPTIONS') return handlePreflight(headers);
  if (event.httpMethod!=='POST') return {statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};
  const limit = rateLimit(getClientIP(event),{windowMs:300000,maxRequests:3});
  if (limit.limited) return {statusCode:429,headers,body:JSON.stringify({error:`Wait ${limit.retryAfter}s.`})};
  try {
    const raw = JSON.parse(event.body||'{}');
    if (isBot(raw)) return blocked(headers,'Bot detected.');
    const d = sanitizeAll(raw); const cart = raw.cart_items;
    const missing = validateRequired(d,['full_name','email','phone','payment_method']);
    if (missing.length) return {statusCode:400,headers,body:JSON.stringify({error:`Missing: ${missing.join(', ')}`})};
    if (!validateEmail(d.email)) return {statusCode:400,headers,body:JSON.stringify({error:'Invalid email.'})};
    if (!validatePhone(d.phone)) return {statusCode:400,headers,body:JSON.stringify({error:'Invalid phone.'})};
    if (!cart||!Array.isArray(cart)||cart.length===0) return {statusCode:400,headers,body:JSON.stringify({error:'Cart is empty.'})};
    if (checkForInjection(d)) return blocked(headers,'Invalid input.');
    let total=0;
    for (const item of cart) { const p=PRICES[item.title]; if(!p) return {statusCode:400,headers,body:JSON.stringify({error:`Unknown: ${item.title}`})}; total+=p*Math.min(parseInt(item.qty)||1,10); }
    const sb = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
    const {data:sub} = await sb.from('subscribers').select('id').eq('email',d.email).single();
    const {data:order,error:oErr} = await sb.from('orders').insert([{subscriber_id:sub?.id||null,full_name:d.full_name,email:d.email,phone:d.phone,delivery_address:d.delivery_address||null,country:d.country||'Kenya',city:d.city||null,payment_method:d.payment_method,total_ksh:total,status:'pending'}]).select().single();
    if (oErr) throw oErr;
    await sb.from('order_items').insert(cart.map(i=>({order_id:order.id,book_title:i.title,quantity:Math.min(parseInt(i.qty)||1,10),unit_price:PRICES[i.title]})));
    await sb.from('payments').insert([{order_id:order.id,payment_method:d.payment_method,amount_ksh:total,status:'pending'}]);
    return {statusCode:200,headers,body:JSON.stringify({success:true,order_id:order.id,total_ksh:total,message:`Order confirmed! Total: KSH ${total.toLocaleString()}.`})};
  } catch(err) { console.error('place-order:',err.message); return {statusCode:500,headers,body:JSON.stringify({error:'Could not save order. Call 0736-340024.'})}; }
};
