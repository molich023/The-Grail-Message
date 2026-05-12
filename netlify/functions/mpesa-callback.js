const { createClient } = require('@supabase/supabase-js');
const { secureHeaders } = require('./security');

exports.handler = async (event) => {
  // 1. Initial Security & Header Setup
  const headers = secureHeaders();
  
  // Safaricom doesn't send CORS, but we keep headers for internal consistency
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const callbackData = payload.Body.stkCallback;
    
    // Initialize Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const checkoutRequestID = callbackData.CheckoutRequestID;
    const resultCode = callbackData.ResultCode;
    const resultDesc = callbackData.ResultDesc;

    console.log(`M-Pesa Callback received for: ${checkoutRequestID} | Result: ${resultDesc}`);

    // 2. Check if Payment was Successful (ResultCode 0)
    if (resultCode === 0) {
      const meta = callbackData.CallbackMetadata.Item;
      
      // Extract specific values from the Safaricom metadata array
      const mpesaReceipt = meta.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const amountPaid = meta.find(i => i.Name === 'Amount')?.Value;
      const phoneNumber = meta.find(i => i.Name === 'PhoneNumber')?.Value;
      const transactionDate = meta.find(i => i.Name === 'TransactionDate')?.Value;

      // 3. Update the Order in Supabase
      // We match by checkout_id which was saved when the payment was initiated
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          mpesa_receipt: mpesaReceipt,
          amount_confirmed: amountPaid,
          paid_at: new Date().toISOString(),
          raw_callback: payload // Store for auditing
        })
        .eq('checkout_id', checkoutRequestID)
        .select();

      if (error) {
        console.error('Supabase Update Error:', error.message);
        throw error;
      }

      console.log(`Successfully processed payment: ${mpesaReceipt} for Order: ${data[0]?.id}`);
      
      return { 
        statusCode: 200, 
        body: JSON.stringify({ message: "Callback Processed Successfully" }) 
      };

    } else {
      // 4. Handle Cancelled or Failed Payments (User cancelled, Insufficient funds, etc.)
      await supabase
        .from('orders')
        .update({ 
          status: 'failed', 
          failure_reason: resultDesc 
        })
        .eq('checkout_id', checkoutRequestID);

      console.log(`Payment failed or cancelled by user: ${resultDesc}`);
      
      return { 
        statusCode: 200, 
        body: JSON.stringify({ message: "Failure Logged" }) 
      };
    }

  } catch (err) {
    console.error('CRITICAL CALLBACK ERROR:', err.message);
    // We still return 200 to Safaricom to stop them from retrying, 
    // but we log the error internally for the Guardian to fix.
    return { 
      statusCode: 200, 
      body: JSON.stringify({ error: "Internal processing error" }) 
    };
  }
};
