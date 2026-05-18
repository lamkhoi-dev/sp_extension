const jwt = require('jsonwebtoken');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'shopee-aff-bot-jwt-secret-2024';
const JWT_COOKIE = 'auth_token';

function signToken(payload, remember = false) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: remember ? '7d' : '24h',
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  // Skip auth for login endpoint
  if (req.path === '/api/auth/login') return next();

  const token = req.cookies?.[JWT_COOKIE] || extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }

  req.admin = {
    username: decoded.username,
    displayName: decoded.displayName,
  };
  next();
}

function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

module.exports = { requireAuth, signToken, verifyToken, JWT_COOKIE, JWT_SECRET };
