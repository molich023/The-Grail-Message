const https = require('https');
const {
  secureHeaders,
  handlePreflight
} = require('./security');

function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch(e) { return null; }
}

exports.handler = async (event) => {
  const origin  = event.headers.origin || '';
  const headers = secureHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return handlePreflight(headers);

  try {
    const authHeader = event.headers.authorization ||
                       event.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No token provided. Please log in.' })
      };
    }

    const token   = authHeader.replace('Bearer ', '');
    const payload = decodeJWT(token);

    if (!payload) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token format.' })
      };
    }

    // Check token expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token expired. Please log in again.' })
      };
    }

    // Check issuer matches your Auth0 domain
    const expectedIssuer = `https://${process.env.AUTH0_DOMAIN}/`;
    if (payload.iss !== expectedIssuer) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token issuer.' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        authenticated: true,
        user: {
          id:      payload.sub,
          email:   payload.email,
          name:    payload.name,
          picture: payload.picture,
          roles:   payload[
            'https://grailmessagekenya.netlify.app/roles'
          ] || []
        }
      })
    };

  } catch (err) {
    console.error('auth0-verify error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Authentication check failed.' })
    };
  }
};
