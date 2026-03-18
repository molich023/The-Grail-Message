// ══════════════════════════════════════════════════════
// SCHEDULED FUNCTION: keep-alive.js
// Runs daily to keep Supabase free tier project active
// Prevents project from pausing after 7 days inactivity
// ══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Simple ping — just count books table
    const { data, error } = await supabase
      .from('books')
      .select('id')
      .limit(1);

    if (error) {
      console.log('Keep-alive ping failed:', error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          message: error.message,
          time: new Date().toISOString()
        })
      };
    }

    console.log('Keep-alive ping successful:', new Date().toISOString());

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Supabase pinged successfully',
        time: new Date().toISOString()
      })
    };

  } catch(err) {
    console.log('Keep-alive error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: err.message
      })
    };
  }
};
