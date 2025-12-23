# Environment Variables Setup

## Frontend Configuration

The frontend uses environment variables to configure the backend API URL.

### Setup Instructions

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   
   **For Production:**
   ```env
   VITE_API_URL=https://streamapp-uyjv.onrender.com
   ```
   
   **For Local Development:**
   ```env
   VITE_API_URL=http://localhost:3000
   ```

### Important Notes

- All Vite environment variables must be prefixed with `VITE_`
- The `.env` file is gitignored and should never be committed
- Use `.env.example` as a template for other developers
- After changing `.env`, restart the dev server for changes to take effect

### Usage in Code

The API URL is centralized in `src/config.js`:

```javascript
import { apiUrl } from './config';

// Use it like this:
const response = await fetch(apiUrl('getUserMeetings/123'));
```

### Files Updated

All fetch requests in the following files now use the environment variable:
- `src/CreateMeetingForm.jsx`
- `src/ScheduleMeeting.jsx`
- `src/MeetingUI.jsx`
- `src/Home.jsx`
- `src/recording.js`
- `src/socket.js`
