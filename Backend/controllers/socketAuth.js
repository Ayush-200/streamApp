import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const jwksClient = jwksRsa({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com'}/.well-known/jwks.json`
});

function getKey(header, callback) {
    jwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) {
            callback(err);
        } else {
            const signingKey = key.publicKey || key.rsaPublicKey;
            callback(null, signingKey);
        }
    });
}

async function verifySocketToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            getKey,
            {
                audience: process.env.AUTH0_AUDIENCE || `https://${process.env.AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com'}/api/v2/`,
                issuer: `https://${process.env.AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com'}/`,
                algorithms: ['RS256']
            },
            (err, decoded) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            }
        );
    });
}

export async function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = await verifySocketToken(token);
        socket.user = {
            id: decoded.sub,
            email: decoded.email || decoded[`https://${process.env.AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com'}/email`]
        };
        next();
    } catch (error) {
        console.error('Socket auth failed:', error.message);
        next(new Error('Invalid token'));
    }
}
