const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { secureHeaders, getClientIP, sanitizeAll } = require('./security');

exports.handler = async (event) => {
    const origin = event.headers.origin || '';
    const headers = secureHeaders(origin);

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const raw = JSON.parse(event.body);
        const { email, phone, cart, shippingType, address } = sanitizeAll(raw);

        // 1. Calculate Totals
        const itemTotal = cart.reduce((sum, item) => sum + item.price, 0);
        const shippingFee = shippingType === 'upcountry' ? 450 : (shippingType === 'nairobi' ? 250 : 0);
        const finalAmount = itemTotal + shippingFee;

        // 2. Format Phone (Safaricom requires 254...)
        const formattedPhone = phone.replace(/\+/g, '').replace(/^0/, '254');

        // 3. Get M-Pesa OAuth Token
        const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
        const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
            headers: { Authorization: `Basic ${auth}` }
        });
        const { access_token } = await tokenRes.json();

        // 4. Trigger STK Push
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

        const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
            method: 'POST',
            headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                BusinessShortCode: process.env.MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: finalAmount,
                PartyA: formattedPhone,
                PartyB: process.env.MPESA_SHORTCODE,
                PhoneNumber: formattedPhone,
                CallBackURL: "https://grailmessagekenya.eu.org/api/mpesa-callback",
                AccountReference: "GrailSupport",
                TransactionDesc: "Spiritual Materials"
            })
        });

        const stkData = await stkRes.json();

        if (stkData.ResponseCode === "0") {
            // 5. Save Pending Order to Supabase
            const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
            await sb.from('orders').insert([{
                email,
                items: cart,
                total_amount: finalAmount,
                checkout_id: stkData.CheckoutRequestID,
                status: 'pending',
                shipping_address: address
            }]);

            return { statusCode: 200, headers, body: JSON.stringify({ message: "Check your phone to enter PIN" }) };
        } else {
            throw new Error(stkData.ResponseDescription || "STK Push Failed");
        }

    } catch (err) {
        console.error('Payment Error:', err.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
