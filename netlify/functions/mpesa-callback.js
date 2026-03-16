const { createClient } = require('@supabase/supabase-js');
exports.handler = async (event) => {
  if (event.httpMethod!=='POST') return {statusCode:405,body:'Method not allowed'};
  try {
    const cb = JSON.parse(event.body); const r = cb.Body?.stkCallback;
    if (!r) return {statusCode:400,body:'Invalid callback'};
    const sb = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
    if (r.ResultCode===0) {
      const items = r.CallbackMetadata?.Item||[];
      const get = (n) => items.find(i=>i.Name===n)?.Value;
      const ref = get('MpesaReceiptNumber');
      await sb.from('payments').update({status:'completed',mpesa_ref:ref,paid_at:new Date().toISOString()}).eq('transaction_id',r.CheckoutRequestID);
      const {data:p} = await sb.from('payments').select('order_id').eq('transaction_id',r.CheckoutRequestID).single();
      if (p) await sb.from('orders').update({status:'paid',mpesa_ref:ref}).eq('id',p.order_id);
    } else { await sb.from('payments').update({status:'failed'}).eq('transaction_id',r.CheckoutRequestID); }
    return {statusCode:200,body:JSON.stringify({ResultCode:0,ResultDesc:'Accepted'})};
  } catch(err) { return {statusCode:200,body:JSON.stringify({ResultCode:0,ResultDesc:'Accepted'})}; }
};
