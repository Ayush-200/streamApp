import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import connectDB from './config/db.js';
import { handleAuthErrors } from './middleware/auth.js';
import { Server } from 'socket.io';
import { socketHandler } from './controllers/socketSetup.js';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

import router from './routes/route.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: [
    "https://streamapp-webapp.onrender.com",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit uploads to 20 per window
  message: { error: 'Too many upload requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // More lenient for token requests
  message: { error: 'Too many authentication requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all routes
app.use(generalLimiter);

// Apply stricter rate limiting to upload endpoints
app.use('/upload', uploadLimiter);
app.use('/uploadSegment', uploadLimiter);

// Apply auth rate limiter to token endpoint
app.use('/token', authLimiter);

// ⭐ HEALTH CHECK ROUTE — VERY IMPORTANT FOR RENDER
app.get("/", (req, res) => {
  res.send("Backend working ✔");
});

// Load routes normally (NOT inside DB connect)
app.use('/', router);

// Auth error handler (must be after routes)
app.use(handleAuthErrors);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// SOCKET.IO - Allow both frontend URLs
const io = new Server(server, {
  cors: {
    origin: [
      "https://streamapp-webapp.onrender.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  // Connection rate limiting
  maxHttpBufferSize: 1e8, // 100 MB max message size
  connectTimeout: 45000,
});

// Socket connection rate limiting
const socketConnectionAttempts = new Map();
const SOCKET_RATE_LIMIT = 10; // Max connections per IP per minute
const SOCKET_WINDOW = 60 * 1000; // 1 minute

io.use((socket, next) => {
  const ip = socket.handshake.address;
  const now = Date.now();
  
  if (!socketConnectionAttempts.has(ip)) {
    socketConnectionAttempts.set(ip, []);
  }
  
  const attempts = socketConnectionAttempts.get(ip);
  const recentAttempts = attempts.filter(time => now - time < SOCKET_WINDOW);
  
  if (recentAttempts.length >= SOCKET_RATE_LIMIT) {
    console.warn(`⚠️ Socket rate limit exceeded for IP: ${ip}`);
    return next(new Error('Too many connection attempts'));
  }
  
  recentAttempts.push(now);
  socketConnectionAttempts.set(ip, recentAttempts);
  next();
});

// Clean up old connection attempts every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of socketConnectionAttempts.entries()) {
    const recentAttempts = attempts.filter(time => now - time < SOCKET_WINDOW);
    if (recentAttempts.length === 0) {
      socketConnectionAttempts.delete(ip);
    } else {
      socketConnectionAttempts.set(ip, recentAttempts);
    }
  }
}, 5 * 60 * 1000);

socketHandler(io);

// CONNECT TO DB THEN START SERVER
connectDB()
  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });