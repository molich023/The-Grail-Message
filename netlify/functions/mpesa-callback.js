// ══════════════════════════════════════════════════════════════════════
// NETLIFY FUNCTION: mpesa-callback.js
// Receives payment confirmation from Safaricom Daraja
// Endpoint: POST /api/mpesa-callback
// ══════════════════════════════════════════════════════════════════════
// Safaricom calls this URL after every payment event.
// Must ALWAYS return 200 to Safaricom — even on errors.
// ══════════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {

  // Always allow POST only
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body     = JSON.parse(event.body || '{}');
    const callback = body.Body?.stkCallback;

    if (!callback) {
      console.error('Invalid callback body:', JSON.stringify(body));
      // Still return 200 to Safaricom
      return {
        statusCode: 200,
        body: JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' })
      };
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = callback;

    console.log(`M-Pesa callback: RequestID=${CheckoutRequestID} ResultCode=${ResultCode} Desc=${ResultDesc}`);

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    if (ResultCode === 0) {
      // ── PAYMENT SUCCESSFUL ──────────────────────────────────
      const items   = CallbackMetadata?.Item || [];
      const getMeta = (name) => items.find(i => i.Name === name)?.Value;

      const mpesa_ref  = getMeta('MpesaReceiptNumber');
      const amount     = getMeta('Amount');
      const phone      = getMeta('PhoneNumber');
      const paid_at    = new Date().toISOString();

      console.log(`✅ Payment confirmed: ${mpesa_ref} KSH ${amount} from ${phone}`);

      // Update payment record
      const { data: payment, error: payError } = await supabase
        .from('payments')
        .update({
          status:    'completed',
          mpesa_ref: mpesa_ref,
          paid_at:   paid_at
        })
        .eq('transaction_id', CheckoutRequestID)
        .select('order_id')
        .single();

      if (payError) {
        console.error('Payment update error:', payError.message);
      }

      // Update order status
      if (payment?.order_id) {
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status:    'paid',
            mpesa_ref: mpesa_ref
          })
          .eq('id', payment.order_id);

        if (orderError) {
          console.error('Order update error:', orderError.message);
        } else {
          console.log(`✅ Order ${payment.order_id} marked as paid`);
        }
      }

    } else {
      // ── PAYMENT FAILED OR CANCELLED ─────────────────────────
      const failureMessages = {
        1:    'Insufficient funds',
        17:   'Transaction failed',
        1032: 'Transaction cancelled by user',
        1037: 'Timeout — no response from user',
        2001: 'Wrong PIN entered'
      };

      const reason = failureMessages[ResultCode] || ResultDesc || 'Payment failed';
      console.log(`❌ Payment failed: ${reason} (Code: ${ResultCode})`);

      const { data: payment } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('transaction_id', CheckoutRequestID)
        .select('order_id')
        .single();

      if (payment?.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'payment_failed' })
          .eq('id', payment.order_id);
      }
    }

    // ALWAYS return 200 to Safaricom
    return {
      statusCode: 200,
      body: JSON.stringify({
        ResultCode: 0,
        ResultDesc: 'Accepted'
      })
    };

  } catch (err) {
    console.error('mpesa-callback error:', err.message);
    // ALWAYS return 200 to Safaricom even on errors
    return {
      statusCode: 200,
      body: JSON.stringify({
        ResultCode: 0,
        ResultDesc: 'Accepted'
      })
    };
  }
};
