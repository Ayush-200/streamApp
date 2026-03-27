# Video Recording Session Tracking - Implementation Complete

## Overview
Implemented a comprehensive session tracking system that creates one MongoDB session entry per video chunk, enabling the video merge service to accurately map chunks to their time ranges.

## Changes Made

### 1. Frontend Recording Timing (recording.js)

Added timing variables:
- `meetingStartTime`: Tracks when meeting recording begins (Date.now()) - SET ONCE PER MEETING
- `currentChunkStartTime`: Tracks when each chunk starts recording (seconds from meeting start)

Key changes:
- Initialize or restore `meetingStartTime` from localStorage when `startRecording()` is called
- Store `meetingStartTime` in localStorage with key: `meetingStartTime_{meetingName}_{userEmail}`
- If user reloads tab or rejoins, restore `meetingStartTime` from localStorage to maintain continuous timing
- **CRITICAL**: `meetingStartTime` is NEVER reset when user leaves/rejoins - only when recording stops
- Calculate `currentChunkStartTime` dynamically before each chunk (relative to original `meetingStartTime`)
- Calculate `chunkEndTime` when chunk recording completes
- Store timing data (`chunkStartTime`, `chunkEndTime`) in IndexedDB alongside blob data
- Clean up `meetingStartTime` from localStorage ONLY when recording is stopped by host (not when user leaves)

**Reload/Rejoin Handling:**
The implementation maintains timing continuity across reloads and rejoin events:
1. `meetingStartTime` is restored from localStorage (never reset)
2. All chunk times are calculated relative to the ORIGINAL meeting start time
3. Timing remains accurate and sequential even if user leaves and rejoins multiple times

**Example:**
```
Meeting starts at 10:00:00 AM (meetingStartTime set)
User A records: Chunk 0 (0-60s), Chunk 1 (60-120s)
User A leaves meeting at 10:02:00 AM
User A rejoins at 10:05:00 AM (meetingStartTime restored from localStorage)
User A records: Chunk 2 (300-360s) ✅ Correct! (5 minutes from meeting start)
```

### 2. Frontend Upload with Timing (uploadSegment.js)

After successful Cloudinary upload:
- Extract timing data from IndexedDB segment
- Send POST request to `/sessions/update-chunk` endpoint
- Include: meetingId, userEmail, sessionId, start time, end time
- Non-blocking: Upload success doesn't depend on timing update

### 3. Backend API Endpoint (route.js)

New route: `POST /sessions/update-chunk`

Functionality:
- Receives chunk timing data from frontend
- Finds or creates SessionDB document for the meeting
- Initializes user's session array if needed
- Adds or updates session entry with timing data
- Uses `markModified('sessions')` for nested object updates
- Returns success/error response

## Database Structure

### Before (WRONG)
```json
{
  "meetingId": "abc123",
  "sessions": {
    "user@example.com": [
      { "sessionId": "user@example.com_1", "start": 0, "end": 537 },
      { "sessionId": "user@example.com_2", "start": 640, "end": 656 }
    ]
  }
}
```
Only 2 entries for 10 video chunks - merge service fails!

### After (CORRECT)
```json
{
  "meetingId": "abc123",
  "sessions": {
    "user@example.com": [
      { "sessionId": "user@example.com_1", "start": 0, "end": 60 },
      { "sessionId": "user@example.com_2", "start": 60, "end": 120 },
      { "sessionId": "user@example.com_3", "start": 120, "end": 180 },
      { "sessionId": "user@example.com_4", "start": 180, "end": 240 },
      ...
    ]
  }
}
```
One entry per video chunk - merge service can map correctly!

## Flow Diagram

```
1. User starts recording (first time)
   └─> Check localStorage for meetingStartTime_{meeting}_{user}
   └─> Not found: meetingStartTime = Date.now()
   └─> Save to localStorage

2. User starts recording (rejoin/reload)
   └─> Check localStorage for meetingStartTime_{meeting}_{user}
   └─> Found: Restore existing timestamp (DON'T reset!)
   └─> Calculate elapsed time since meeting start

3. Chunk recording starts
   └─> currentChunkStartTime = (Date.now() - meetingStartTime) / 1000
   └─> (Always relative to ORIGINAL meetingStartTime)

4. Chunk recording stops (after 60s)
   └─> chunkEndTime = (Date.now() - meetingStartTime) / 1000
   └─> Save to IndexedDB with timing data

5. Upload to Cloudinary
   └─> On success: POST /sessions/update-chunk
   └─> Backend saves timing to MongoDB SessionDB

6. Repeat for each chunk (timing always relative to original start)

7. Recording stopped by host
   └─> Clean up meetingStartTime from localStorage
   └─> Reset timing variables
```

### Rejoin Scenario (CRITICAL FIX)
```
10:00:00 AM - Meeting starts, User A joins
              meetingStartTime = 1234567890000 (saved to localStorage)
              
10:00:00 - 10:01:00 - Chunk 0: start=0s, end=60s
10:01:00 - 10:02:00 - Chunk 1: start=60s, end=120s

10:02:00 AM - User A leaves meeting
              (meetingStartTime STAYS in localStorage - NOT removed!)

10:05:00 AM - User A rejoins meeting
              meetingStartTime = 1234567890000 (restored from localStorage)
              Elapsed time = 300s (5 minutes since meeting start)
              
10:05:00 - 10:06:00 - Chunk 2: start=300s, end=360s ✅ CORRECT!
10:06:00 - 10:07:00 - Chunk 3: start=360s, end=420s ✅ CORRECT!

10:10:00 AM - Host stops recording
              meetingStartTime removed from localStorage
```

### What Was Wrong Before
```
❌ WRONG: Resetting currentChunkStartTime to 0 on rejoin
10:05:00 AM - User A rejoins
              currentChunkStartTime = 0 (WRONG!)
              
10:05:00 - 10:06:00 - Chunk 2: start=0s, end=60s ❌ WRONG! (overlaps with Chunk 0)
```

## Testing Verification

To verify the implementation works:

1. Start a meeting and record for 5+ minutes (multiple chunks)
2. Check MongoDB after upload completes:

```javascript
db.sessions.findOne({ meetingId: "your-meeting-id" })
```

Expected results:
- Number of session entries = Number of video chunks in Cloudinary
- Start/end times are sequential (no gaps or overlaps)
- Each sessionId matches the chunk index (user@email.com_1, user@email.com_2, etc.)

## Key Features

- All times stored in seconds from meeting start
- Timing data sent AFTER Cloudinary upload succeeds
- Non-blocking: Upload doesn't fail if timing update fails
- Handles network failures gracefully
- Backward compatible: Doesn't affect existing video playback
- **Reload-safe**: Meeting start time persisted to localStorage, survives page reloads
- Automatic cleanup: Meeting start time removed from localStorage when user leaves

## Files Modified

1. `Frontend/my_meeting_app/src/utils/recording.js`
   - Added timing tracking variables
   - Store timing data in IndexedDB

2. `Frontend/my_meeting_app/src/utils/uploadSegment.js`
   - Send timing data to backend after upload

3. `Backend/routes/route.js`
   - New POST /sessions/update-chunk endpoint
   - Session timing storage logic

## Next Steps

1. Test with a real meeting recording
2. Verify MongoDB session entries match Cloudinary chunks
3. Test video merge service with new session data
4. Monitor for any timing discrepancies or edge cases

## Edge Cases Handled

### User Reloads Browser Tab
- `meetingStartTime` is persisted to localStorage
- On reload, timing is restored and continues from original start time
- Chunk timing remains accurate and sequential
- **All times calculated relative to ORIGINAL meeting start**

### User Leaves and Rejoins Meeting (CRITICAL)
- When user leaves: `meetingStartTime` is NOT removed from localStorage
- When user rejoins: `meetingStartTime` is restored from localStorage
- Timing continues from original meeting start (NOT reset to 0)
- New chunks get correct timing relative to meeting start
- **Example**: If user rejoins 5 minutes after meeting start, next chunk starts at 300s (not 0s)

### localStorage Cleanup
- Meeting start time is removed ONLY when:
  - Host stops recording (stop_recording event)
  - NOT when user leaves meeting
  - NOT when user closes tab
- This ensures timing continuity across rejoin events
- Prevents timing overlap and merge service failures

### Network Failures
- If timing update to backend fails, upload still succeeds
- Timing data remains in IndexedDB until next retry
- Non-blocking design ensures video chunks are not lost

### Multiple Users in Same Meeting
- Each user has their own `meetingStartTime_{meetingName}_{userEmail}` key
- Users can join at different times
- Each user's chunks are timed relative to when THEY started recording
- Session tracking handles multiple users independently

