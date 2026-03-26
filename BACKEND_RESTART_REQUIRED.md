# Backend Server Restart Required

## Issue

Getting `404 Not Found` for the new endpoint:
```
http://localhost:3000/getLastSegmentIndex/gBggFvJozA5W/ayushbhatia456%40gmail.com
```

## Cause

The new route `/getLastSegmentIndex/:meetingName/:userId` was added to `Backend/routes/route.js`, but the backend server needs to be restarted to load the new route.

## Solution

### Step 1: Stop the Backend Server

If running in terminal:
- Press `Ctrl + C` to stop the server

If running as a background process:
- Find the process: `Get-Process node`
- Kill it: `Stop-Process -Name node -Force`

### Step 2: Restart the Backend Server

```bash
cd Backend
npm start
```

Or if using nodemon:
```bash
cd Backend
npm run dev
```

### Step 3: Verify the Server Started

You should see:
```
MongoDB connected!
Server running on port 3000
```

### Step 4: Test the Endpoint

Open browser or use curl:
```
http://localhost:3000/getLastSegmentIndex/gBggFvJozA5W/ayushbhatia456@gmail.com
```

Expected response:
```json
{
  "lastSegmentIndex": -1  // or a number if data exists
}
```

## Alternative: Use Nodemon for Auto-Restart

To avoid manual restarts during development:

1. Install nodemon (if not already):
   ```bash
   npm install -D nodemon
   ```

2. Add to `package.json`:
   ```json
   {
     "scripts": {
       "start": "node index.js",
       "dev": "nodemon index.js"
     }
   }
   ```

3. Run with:
   ```bash
   npm run dev
   ```

Now the server will auto-restart on file changes!

## Debugging

If still getting 404 after restart:

1. **Check server logs** for any errors
2. **Verify route is loaded**:
   - Add console.log in route.js:
   ```javascript
   console.log("✅ getLastSegmentIndex route registered");
   ```

3. **Test a simpler endpoint** first:
   ```
   http://localhost:3000/
   ```
   Should return: `"Backend working ✔"`

4. **Check if meeting exists** in database:
   - The endpoint now handles both `meetingName` and `meetingId`
   - Returns `-1` if meeting not found (not 404)

## Expected Behavior After Fix

### First Time Recording (No Previous Data)
```
Request: GET /getLastSegmentIndex/gBggFvJozA5W/ayushbhatia456@gmail.com
Response: { "lastSegmentIndex": -1 }
Frontend: Starts from segment_0
```

### After Leaving Meeting
```
Backend saves: lastSegmentIndex = 5
Database updated ✅
```

### Rejoining Meeting
```
Request: GET /getLastSegmentIndex/gBggFvJozA5W/ayushbhatia456@gmail.com
Response: { "lastSegmentIndex": 5 }
Frontend: Starts from segment_6 ✅
```

## Quick Test

After restarting backend, test in browser console:

```javascript
fetch('http://localhost:3000/getLastSegmentIndex/gBggFvJozA5W/ayushbhatia456@gmail.com')
  .then(r => r.json())
  .then(console.log);
```

Should see:
```javascript
{ lastSegmentIndex: -1 } // or a number
```

Not:
```
404 Not Found
```
