const crypto = require('crypto');

const csrfTokens = new Map();

const generateToken = (sessionId) => {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + 3600000 // 1 hour
  });
  return token;
};

const validateToken = (sessionId, token) => {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  if (stored.expires < Date.now()) {
    csrfTokens.delete(sessionId);
    return false;
  }
  return stored.token === token;
};

const csrfProtection = (req, res, next) => {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for webhook and health endpoints
  if (req.path.startsWith('/api/webhooks') || req.path === '/api/health') {
    return next();
  }

  const sessionId = req.sessionID;
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;

  if (!validateToken(sessionId, csrfToken)) {
    return res.status(403).json({
      success: false,
      error: { code: 'CSRF_TOKEN_INVALID', message: 'Invalid CSRF token' }
    });
  }

  next();
};

const csrfTokenEndpoint = (req, res) => {
  const token = generateToken(req.sessionID);
  res.json({ csrfToken: token });
};

module.exports = { csrfProtection, csrfTokenEndpoint, generateToken, validateToken };
