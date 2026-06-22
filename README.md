# StreamApp - Video Meeting Platform

A real-time video meeting application with recording capabilities and session tracking.

## Features

- Real-time video calls with multiple participants
- Session recording with automatic upload to Cloudinary
- Session timeline tracking with 2-second grace period for reconnections
- Automatic video merging with audio mixing
- Frame-accurate video cuts with A/V sync

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Cloudinary account
- Redis instance
- Stream.io account

### Setup

1. **Backend Setup**
   ```bash
   cd Backend
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm start
   ```

2. **Frontend Setup**
   ```bash
   cd Frontend/my_meeting_app
   npm install
   cp .env.example .env
   # Edit .env with backend URL
   npm run dev
   ```

3. **Access**: Open `http://localhost:5173`

## Documentation

- `SETUP_GUIDE.md` - Complete setup instructions
- `SECURITY_CREDENTIALS_FIX.md` - Security best practices
- `PRODUCTION_READINESS_CHECKLIST.md` - Production deployment checklist
- `FFMPEG_WORKER_SPEC.md` - FFmpeg worker service specification
- `VIDEO_PROCESSING_IMPROVEMENTS.md` - Recent video processing improvements

## Architecture

```
Frontend (React + Vite)
    ↓ Socket.io + REST API
Backend (Express + Socket.io)
    ↓ BullMQ
FFmpeg Worker Service
    ↓
Cloudinary (Video Storage)
```

## Key Technologies

- **Frontend**: React, Vite, Stream.io Video SDK, Socket.io Client
- **Backend**: Express, Socket.io, Mongoose, BullMQ
- **Storage**: MongoDB, Redis, Cloudinary
- **Video**: FFmpeg, Stream.io

## Security Notes

⚠️ Before deploying to production:
1. Remove `.env` files from Git
2. Rotate all credentials
3. Add authentication middleware
4. Add rate limiting
5. See `PRODUCTION_READINESS_CHECKLIST.md` for complete list

## License

Private project
