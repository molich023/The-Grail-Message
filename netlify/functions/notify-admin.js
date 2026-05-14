const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  const payload = JSON.parse(event.body);
  
  // Only alert if the payment just became "completed"
  if (payload.record.status === 'completed') {
    const msg = {
      to: 'your-email@gmail.com',
      from: 'alerts@grailmessagekenya.eu.org',
      subject: '✨ New Sanctuary Order!',
      text: `A seeker (${payload.record.email}) just purchased ${payload.record.items.length} items. Total: Ksh ${payload.record.total_amount}. Check your Admin Dashboard!`,
    };
    await sgMail.send(msg);
  }
  
  return { statusCode: 200, body: 'Alert Sent' };
};
