const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const { lecture, email } = event.queryStringParameters;
    const decodedLecture = Buffer.from(lecture, 'base64').toString();
    const decodedEmail = Buffer.from(email, 'base64').toString();

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Final Backend Security Check
    const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('email', decodedEmail)
        .eq('status', 'completed')
        .contains('items', [{ name: decodedLecture }]);

    if (!data || data.length === 0) {
        return { statusCode: 403, body: "Access Denied" };
    }

    // If verified, redirect to the actual storage location (e.g., Supabase Storage or AWS S3)
    // Using a redirect keeps your actual file URL hidden
    const signedUrl = `https://your-storage-provider.com/lectures/${decodedLecture.replace(/\s+/g, '_')}.mp3`;

    return {
        statusCode: 302,
        headers: { Location: signedUrl }
    };
};
