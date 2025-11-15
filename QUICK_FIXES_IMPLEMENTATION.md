# 🚀 Quick Fixes - Implementation Guide

## Immediate Actions (Do These First!)

### 1. Fix Hardcoded API Keys

**File: `Backend/routes/route.js`**

**Before:**
```javascript
const apiKey = "55gcbd3wd3nk";
const apiSecret = "86wmmssfy926tzyvz3362j8f63mwrd2p2p9yex9ftgkpspchejmn8pzxp6zyscdg";
```

**After:**
```javascript
const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  throw new Error('Stream.io API credentials are missing!');
}
```

**Create `.env` file:**
```env
STREAM_API_KEY=55gcbd3wd3nk
STREAM_API_SECRET=86wmmssfy926tzyvz3362j8f63mwrd2p2p9yex9ftgkpspchejmn8pzxp6zyscdg
```

**Add to `.gitignore`:**
```
.env
.env.local
.env.*.local
```

---

### 2. Fix CORS Configuration

**File: `Backend/index.js`**

**Before:**
```javascript
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});
```

**After:**
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

**Add to `.env`:**
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

### 3. Fix removeMeetingFromSchedule Bug

**File: `Backend/routes/route.js` (Line 131-144)**

**Before:**
```javascript
router.post('/removeMeetingFromSchedule/:emailId', async (req, res) =>{
    const email = req.params.emailId;
    const user = await User.findById(email);

if (user) {
  const index = user.meeting.indexOf(meetingToRemove);
  
  if (index !== -1) {
    user.meeting.splice(index, 1);
    user.date.splice(index, 1);
    await user.save();
  }
}
})
```

**After:**
```javascript
router.post('/removeMeetingFromSchedule/:emailId', async (req, res) =>{
    try {
        const email = req.params.emailId;
        const { meetingToRemove } = req.body;
        
        if (!meetingToRemove) {
            return res.status(400).json({ 
                success: false, 
                message: 'meetingToRemove is required' 
            });
        }

        const user = await User.findOne({ email: email });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const index = user.meeting.indexOf(meetingToRemove);
        
        if (index !== -1) {
            user.meeting.splice(index, 1);
            user.date.splice(index, 1);
            await user.save();
            return res.json({ 
                success: true, 
                message: 'Meeting removed successfully' 
            });
        } else {
            return res.status(404).json({ 
                success: false, 
                message: 'Meeting not found in schedule' 
            });
        }
    } catch (err) {
        console.error('Error removing meeting:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error removing meeting' 
        });
    }
})
```

---

### 4. Fix Socket.io Global Variable Issue

**File: `Backend/controller/socketHandler.js`**

**Before:**
```javascript
let current_meeting_id = null;
export function socketHandler(io) {
    io.on("connection", (socket) => {
        socket.on("join_meeting", (meetingId) => {
            current_meeting_id = meetingId; // ❌ Global variable
```

**After:**
```javascript
export function socketHandler(io) {
    io.on("connection", (socket) => {
        let current_meeting_id = null; // ✅ Per-socket variable
        
        socket.on("join_meeting", (meetingId) => {
            current_meeting_id = meetingId;
            socket.join(meetingId);
            console.log(`${socket.id} joined meeting: ${meetingId}`);

            updateParticipantCount(meetingId, io);
            socket.emit("joined_meeting", meetingId);
        });

        socket.on("disconnect", () => {
            console.log("socket disconnected:", socket.id);
            if (current_meeting_id) {
                updateParticipantCount(current_meeting_id, io);
            }
        });
    });
}
```

---

### 5. Add Security Headers (Helmet)

**Install:**
```bash
npm install helmet
```

**File: `Backend/index.js`**

**Add:**
```javascript
import helmet from 'helmet';

app.use(helmet());
```

---

### 6. Add Rate Limiting

**Install:**
```bash
npm install express-rate-limit
```

**File: `Backend/index.js`**

**Add:**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Stricter limit for upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10 // 10 uploads per hour
});

app.use('/upload', uploadLimiter);
```

---

### 7. Add Request Validation

**Install:**
```bash
npm install express-validator
```

**File: `Backend/routes/route.js`**

**Add:**
```javascript
import { body, param, validationResult } from 'express-validator';

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Update token endpoint
router.get('/token/:userId', 
  param('userId').notEmpty().trim().escape(),
  validate,
  (req, res) => {
    const userId = req.params.userId;
    const validity = 24*60*60;
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: validity });
    res.json({token});
  }
);

// Update addUsersMeetings endpoint
router.post('/addUsersMeetings/:emailId',
  param('emailId').isEmail().normalizeEmail(),
  body('newMeeting').notEmpty().trim(),
  body('newDate').isISO8601().toDate(),
  validate,
  async (req, res) => {
    // ... existing code
  }
);
```

---

### 8. Replace console.log with Winston

**Install:**
```bash
npm install winston
```

**Create: `Backend/utils/logger.js`**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'stream-app' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// If not in production, log to console too
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
```

**Update `Backend/routes/route.js`:**
```javascript
import logger from '../utils/logger.js';

// Replace all console.log with logger
logger.info('file uploaded:', req.file);
logger.error('Error in adding new meeting', err);
```

---

### 9. Add Error Handling Middleware

**File: `Backend/index.js`**

**Add at the end (before server.listen):**
```javascript
// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  logger.error(err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});
```

---

### 10. Add Compression

**Install:**
```bash
npm install compression
```

**File: `Backend/index.js`**

**Add:**
```javascript
import compression from 'compression';

app.use(compression());
```

---

### 11. Add Health Check Endpoint

**File: `Backend/routes/route.js`**

**Add:**
```javascript
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});
```

---

### 12. Update Frontend Socket URL

**File: `Frontend/my_meeting_app/src/socket.js`**

**Before:**
```javascript
const socket = io("http://localhost:3000");
```

**After:**
```javascript
const socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000", {
  transports: ['websocket', 'polling']
});
```

**Create: `Frontend/my_meeting_app/.env`**
```env
VITE_API_URL=http://localhost:3000
```

---

## 📝 Updated .env.example Template

**Create: `Backend/.env.example`**
```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/stream_app

# Stream.io
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUD_NAME=your_cloud_name
CLOUD_KEY=your_api_key
CLOUD_SECRET=your_api_secret

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Logging
LOG_LEVEL=info
```

---

## ✅ Checklist

- [ ] Move API keys to environment variables
- [ ] Fix CORS configuration
- [ ] Fix removeMeetingFromSchedule bug
- [ ] Fix Socket.io global variable
- [ ] Add helmet security headers
- [ ] Add rate limiting
- [ ] Add input validation
- [ ] Replace console.log with Winston
- [ ] Add error handling middleware
- [ ] Add compression
- [ ] Add health check endpoint
- [ ] Update frontend socket URL
- [ ] Create .env.example file
- [ ] Update .gitignore

---

## 🚀 Next Steps

After completing these quick fixes, move on to:
1. Add authentication/authorization
2. Implement Redis caching
3. Set up job queue for video processing
4. Add comprehensive testing
5. Set up CI/CD pipeline

See `INDUSTRY_GRADE_IMPROVEMENTS.md` for detailed guidance on all improvements.

