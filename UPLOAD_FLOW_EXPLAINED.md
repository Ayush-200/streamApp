# Complete Upload Flow Documentation

## Overview
This document explains the complete flow of recording and uploading meeting segments from when a user joins a meeting until they leave and rejoin.

---

## Flow 1: Join Meeting → Record → Leave

### Step 1: User Joins Meeting
**Location**: `Frontend/my_meeting_app/src/MeetingUI.jsx`

1. User clicks "Join Meeting" or creates a new meeting
2. Socket emits `join_meeting` event to backend
3. Backend (`socketController.js`) handles join:
   - Creates/updates session document in MongoDB
   - Checks if recording is already active for this meeting
   - Emits `joined_meeting` with `isRecording` flag
4. Frontend receives `joined_meeting`:
   - If `isRecording: true`, automatically starts recording
   - If `isRecording: false`, waits for user to click "Start Recording"

### Step 2: Start Recording
**Location**: `Frontend/my_meeting_app/src/utils/recording.js`

1. User clicks "Start Recording" button (or auto-starts if meeting already recording)
2. `startRecording(meetingName, userEmail)` is called:
   - Requests camera/microphone access
   - **Checks IndexedDB for existing segments** to avoid overwriting:
     ```javascript
     const existingSegments = await db.chunks
       .where('meetingId')
       .equals(meetingName)
       .toArray();
     
     if (existingSegments.length > 0) {
       const maxIndex = Math.max(...existingSegments.map(s => s.segmentIndex));
       segmentCounter = maxIndex + 1; // Continue from highest
     } else {
       segmentCounter = 0; // Start fresh
     }
     ```
   - Starts recording 60-second segments
3. Socket emits `start_recording` to backend
4. Backend updates `meetingRecordingState` Map and broadcasts to all users

### Step 3: Recording Segments (Every 60 seconds)
**Location**: `Frontend/my_meeting_app/src/utils/recording.js`

1. MediaRecorder records for 60 seconds
2. On `recorder.onstop`:
   - Merges recorded chunks into a Blob
   - Creates unique ID: `${meetingName}_${segmentIndex}`
   - Saves to IndexedDB:
     ```javascript
     await db.chunks.put({
       id: uniqueId,
       userId: userEmail,
       blob: segmentBlob,
       meetingId: meetingName,
       segmentIndex: segmentIndex,
       timestamp: Date.now(),
       retries: 0,
       uploaded: false
     });
     ```
   - Increments `segmentCounter++`
   - Starts next segment recording

**Blob Naming**: `segment_0`, `segment_1`, `segment_2`, etc.

### Step 4: Leave Meeting
**Location**: `Frontend/my_meeting_app/src/MeetingUI.jsx`

1. User clicks "Leave Call" button
2. `handleHangup()` function executes:
   - Disables camera: `call.camera.disable()`
   - Disables microphone: `call.microphone.disable()`
   - **Saves current recording blob**: `await saveCurrentBlobAndStop()`
     - Shows "Saving recording..." overlay
     - Stops MediaRecorder
     - Waits for current blob to save to IndexedDB
     - Stops all media tracks
   - Leaves the call: `await call.leave()`
   - Emits `leave_meeting` socket event
   - Navigates to dashboard: `navigate('/')`

3. Backend updates session end time in MongoDB

**Result**: All recorded segments are now in IndexedDB, ready for upload

---

## Flow 2: Dashboard → Upload Segments

### Step 5: View Meetings on Dashboard
**Location**: `Frontend/my_meeting_app/src/Home.jsx`

1. Dashboard loads all user meetings via `fetchMeetings(emailId)`
2. Each meeting card shows:
   - Meeting name
   - Date
   - Upload button (Play/Pause icon)

### Step 6: Start Upload
**Location**: `Frontend/my_meeting_app/src/Home.jsx`

1. User clicks Play button on a meeting card
2. `handleUploadToggle(meetingName, e)` executes:
   - Checks if another meeting is uploading
   - If yes, **immediately stops** that upload
   - Prevents duplicate loops with `runningLoops` Set
   - Fetches `meetingId` from backend
   - Calls `startUploadLoop(meetingName, meetingId)`

### Step 7: Upload Loop
**Location**: `Frontend/my_meeting_app/src/Home.jsx`

```javascript
while (uploadingMeetingsRef.current[meetingName]) {
  // 1. Get segment count before upload
  const beforeCount = await db.chunks.where('meetingId').equals(meetingId).count();
  
  // 2. Update progress UI
  setUploadProgress({ total, remaining, uploaded, percentage, status: 'uploading' });
  
  // 3. Upload up to 3 segments in parallel
  await uploadOldestSegment(meetingId, emailId);
  
  // 4. Get count after upload
  const afterCount = await db.chunks.where('meetingId').equals(meetingId).count();
  
  // 5. Check if done
  if (afterCount === 0) {
    // All uploaded! Show completion
    setUploadProgress({ status: 'completed', percentage: 100 });
    break;
  }
  
  // 6. Wait 2 seconds before next batch
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

### Step 8: Upload Individual Segments
**Location**: `Frontend/my_meeting_app/src/utils/uploadSegment.js`

1. `uploadOldestSegment(meetingId, userEmail)`:
   - Gets all segments for this meetingId from IndexedDB
   - Filters out segments currently being uploaded (tracked in `activeUploads` Set)
   - Sorts by `segmentIndex` (oldest first)
   - Takes up to 3 segments for parallel upload
   - Calls `uploadSingleSegment()` for each

2. `uploadSingleSegment(segment, meetingId, userEmail)`:
   - Marks segment as uploading: `activeUploads.add(segmentIndex)`
   - Creates FormData with File object
   - POSTs to backend: `/uploadSegment/${meetingId}`
   - On success:
     - Deletes segment from IndexedDB: `await db.chunks.delete(segment.id)`
     - Removes from active uploads: `activeUploads.delete(segmentIndex)`

### Step 9: Backend Upload to Cloudinary
**Location**: `Backend/utils/uploadBlob.js`

1. Receives file via multer
2. Converts buffer to base64
3. Uploads to Cloudinary using `upload_large`:
   ```javascript
   public_id: `recordings/${meetingId}/${userId}/segment_${chunkIndex}`
   folder: `meeting_recordings/${meetingId}`
   ```
4. Returns success with Cloudinary URL

**Cloudinary Naming**: `recordings/{meetingId}/{userId}/segment_0`, `segment_1`, etc.

### Step 10: Upload Complete
**Location**: `Frontend/my_meeting_app/src/Home.jsx`

1. When IndexedDB count reaches 0:
   - Shows "✅ Complete!" message
   - Progress bar turns green
   - Auto-hides after 3 seconds
2. Upload loop exits
3. Meeting card returns to normal state

---

## Flow 3: Rejoin Meeting → Continue Recording

### Step 11: User Rejoins Same Meeting
**Location**: `Frontend/my_meeting_app/src/MeetingUI.jsx` → `recording.js`

1. User joins the same meeting again
2. If recording is active, `startRecording()` is called
3. **Critical**: Checks IndexedDB for existing segments:
   ```javascript
   const existingSegments = await db.chunks
     .where('meetingId')
     .equals(meetingName)
     .toArray();
   
   if (existingSegments.length > 0) {
     const maxIndex = Math.max(...existingSegments.map(s => s.segmentIndex));
     segmentCounter = maxIndex + 1; // ✅ Continue from highest
   }
   ```

### Scenario A: Segments Still in IndexedDB (Not Uploaded Yet)
- Example: Previous session had `segment_0`, `segment_1`, `segment_2`
- New recording starts at `segment_3`
- ✅ **No overwriting**

### Scenario B: All Segments Already Uploaded
- IndexedDB is empty for this meetingId
- `segmentCounter` resets to 0
- New recording creates `segment_0` again
- ⚠️ **OVERWRITES** existing `segment_0` on Cloudinary

### Step 12: Leave Again
Same as Step 4 - saves current blob and navigates to dashboard

---

## Key Features

### Single Meeting Upload at a Time
- Only one meeting can upload at a time
- Clicking another meeting's upload button immediately stops current upload
- Visual indicators:
  - Golden border on uploading meeting
  - "UPLOADING" badge
  - Pulsing dot animation
  - Other meetings dimmed

### Upload Progress Tracking
- Shows: `uploaded/total` count
- Shows: percentage progress bar
- Color coding:
  - Yellow: Uploading
  - Green: Complete
  - Gray: Paused
  - Red: Error
- Auto-hides 3 seconds after completion

### Pause/Resume Upload
- User can pause anytime
- Current segment finishes uploading first
- Can resume later from where it stopped

### Parallel Upload (Up to 3 Segments)
- Uploads 3 segments simultaneously for speed
- Tracks active uploads to prevent duplicates
- Waits 2 seconds between batches

---

## Current Issues

### ❌ Issue: Segment Counter Resets After Full Upload
**Problem**: If all segments are uploaded and IndexedDB is empty, rejoining resets counter to 0

**Impact**: New recordings overwrite existing segments on Cloudinary

**Current Solution**: Checks IndexedDB only (partial fix)

**Complete Solution Needed**:
1. Create backend endpoint: `/getMaxSegmentIndex/:meetingName/:userId`
2. Query Cloudinary for existing segments
3. Return highest segment index
4. In `startRecording()`, check BOTH IndexedDB AND Cloudinary
5. Use the higher of the two values

---

## Console Log Locations

### Frontend Logs
1. **recording.js**: Steps 1-5 (segment creation and IndexedDB save)
2. **uploadSegment.js**: Steps 6-10 (upload process)
3. **Home.jsx**: Upload loop progress
4. **MeetingUI.jsx**: Join/leave events

### Backend Logs
1. **socketController.js**: Join/leave/recording events
2. **uploadBlob.js**: Cloudinary upload process

---

## Summary

The upload flow ensures:
- ✅ Recordings are saved locally first (IndexedDB)
- ✅ Uploads happen asynchronously on dashboard
- ✅ Only one meeting uploads at a time
- ✅ Progress is tracked and displayed
- ✅ Segments continue from previous session (if in IndexedDB)
- ⚠️ Segments may overwrite if all previously uploaded (needs Cloudinary check)
