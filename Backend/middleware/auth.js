import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

// Auth0 configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || `https://${AUTH0_DOMAIN}/api/v2/`;

// JWT verification middleware
const verifyToken = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  audience: AUTH0_AUDIENCE,
  issuer: `https://${AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
  credentialsRequired: true
});

// Optional: Extract user info from token
const attachUser = (req, res, next) => {
  if (req.auth) {
    req.user = {
      id: req.auth.sub,
      email: req.auth.email || req.auth[`https://${AUTH0_DOMAIN}/email`],
      permissions: req.auth.permissions || []
    };
  }
  next();
};

// Combined middleware
export const authenticate = [verifyToken, attachUser];

// Error handler for JWT errors
export const handleAuthErrors = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    });
  }
  next(err);
};
