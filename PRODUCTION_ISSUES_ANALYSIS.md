# Production Issues & Race Conditions Analysis

## 🚨 CRITICAL RACE CONDITIONS

### 1. **Recording State Race Condition (CRITICAL)**
**Location:** `recording.js` - Module-level variables

**Problem:**
```javascript
let mediaRecorder;
let currentStream = null;
let isRecording = false;
let currentMeetingName = null;
let currentUserEmail = null;
let segmentCounter = 0;
let stopTimeout = null;
```

**Issues:**
- **Multiple tabs/windows:** If user opens same meeting in multiple tabs, they share the same module state
- **Rapid start/stop:** If user clicks record button rapidly, multiple recordings can start
- **Segment counter collision:** `segmentCounter` is global, can cause duplicate segment indices

**Impact:** 
- Lost recordings
- Duplicate segments with same index
- Memory leaks from unclosed streams

**Fix Required:**
```javascript
// Use Map to track per-meeting state
const recordingStates = new Map();

function getRecordingState(meetingId) {
  if (!recordingStates.has(meetingId)) {
    recordingStates.set(meetingId, {
      mediaRecorder: null,
      stream: null,
      isRecording: false,
      segmentCounter: 0,
      stopTimeout: null
    });
  }
  return recordingStates.get(meetingId);
}
```

---

### 2. **Upload Segment Race Condition (HIGH)**
**Location:** `uploadSegment.js` - `activeUploads` Set

**Problem:**
```javascript
let activeUploads = new Set(); // Track by segmentIndex only
```

**Issues:**
- **Multiple meetings:** If uploading segments from multiple meetings simultaneously, segment indices can collide
  - Meeting A segment 0 and Meeting B segment 0 both tracked as just "0"
- **Duplicate uploads:** Same segment could be uploaded twice if upload loop runs in parallel

**Impact:**
- Segments uploaded multiple times (wasted bandwidth/storage)
- Wrong segments marked as "uploading"
- Upload loop never completes

**Fix Required:**
```javascript
// Track by meetingId + segmentIndex
let activeUploads = new Set(); // Store "meetingId:segmentIndex"

// In uploadSingleSegment:
const uploadKey = `${meetingId}:${segmentIndex}`;
activeUploads.add(uploadKey);
// ... later
activeUploads.delete(uploadKey);
```

---

### 3. **Socket Event Race Condition (HIGH)**
**Location:** `MeetingUI.jsx` - Socket listeners

**Problem:**
```javascript
socket.on("start_recording", () => {
  setRecording(true);
  startRecording(meetingName, user?.email);
});
```

**Issues:**
- **Multiple listeners:** If component re-renders, multiple listeners can be attached
- **Stale closures:** Listeners capture old values of `meetingName`, `user`
- **No cleanup on unmount:** Listeners may fire after component unmounts

**Impact:**
- Multiple recordings started for same event
- Recording started with wrong meeting name
- Memory leaks

**Current Fix:** Cleanup in useEffect return, but still vulnerable to re-renders

**Better Fix:**
```javascript
useEffect(() => {
  // Remove any existing listeners first
  socket.off("start_recording");
  socket.off("stop_recording");
  
  const handleStartRecording = () => {
    setRecording(true);
    startRecording(meetingName, user?.email);
  };
  
  socket.on("start_recording", handleStartRecording);
  
  return () => {
    socket.off("start_recording", handleStartRecording);
  };
}, [meetingName, user?.email]); // Add dependencies
```

---

### 4. **IndexedDB Concurrent Write Race (MEDIUM)**
**Location:** `recording.js` - `recorder.onstop`

**Problem:**
```javascript
await db.chunks.add({
  userId: userEmail,
  blob: segmentBlob,
  meetingId: meetingName,
  segmentIndex: segmentIndex, // Can be duplicate!
  timestamp: Date.now(),
  retries: 0,
  uploaded: false
});
```

**Issues:**
- **No unique constraint:** Multiple segments can have same `segmentIndex`
- **Concurrent adds:** If multiple recorders stop at same time, race to add
- **No transaction:** Partial writes possible

**Impact:**
- Duplicate segments in DB
- Upload confusion (which segment 0 to upload?)
- Data corruption

**Fix Required:**
```javascript
// Add compound unique index in db.js
db.version(6).stores({
  chunks: "++id, userId, meetingId, [meetingId+segmentIndex], timestamp"
});

// Use put with unique key instead of add
await db.chunks.put({
  id: `${meetingId}_${segmentIndex}`, // Unique ID
  userId: userEmail,
  blob: segmentBlob,
  meetingId: meetingName,
  segmentIndex: segmentIndex,
  timestamp: Date.now(),
  retries: 0,
  uploaded: false
});
```

---

### 5. **Backend Recording State Race (HIGH)**
**Location:** `socketController.js` - `meetingRecordingState` Map

**Problem:**
```javascript
const meetingRecordingState = new Map();

socket.on("start_recording", (meetingId) => {
  meetingRecordingState.set(meetingId, true);
  io.to(meetingId).emit("start_recording");
});
```

**Issues:**
- **No synchronization:** Multiple users can start recording simultaneously
- **State lost on server restart:** In-memory Map is not persisted
- **No cleanup:** State never removed when meeting ends

**Impact:**
- New users join after server restart, don't get recording state
- Memory leak (Map grows forever)
- Conflicting recording states

**Fix Required:**
```javascript
// Store in database
socket.on("start_recording", async (meetingId) => {
  await MeetingDB.findOneAndUpdate(
    { meetingId },
    { isRecording: true },
    { upsert: true }
  );
  io.to(meetingId).emit("start_recording");
});

// On join, check DB
const meeting = await MeetingDB.findOne({ meetingId });
const isRecording = meeting?.isRecording || false;
```

---

## ⚠️ PRODUCTION ISSUES

### 6. **Memory Leaks**

**A. MediaStream Not Cleaned Up**
```javascript
// In recording.js - saveCurrentBlobAndStop
if (currentStream) {
  currentStream.getTracks().forEach(track => track.stop());
  currentStream = null; // Good, but what if exception thrown before this?
}
```

**Fix:** Use try-finally
```javascript
try {
  // ... recording logic
} finally {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}
```

**B. Socket Listeners Not Removed**
- Multiple useEffects attach listeners
- Some don't have proper cleanup
- Listeners hold references to old closures

---

### 7. **Network Failure Handling**

**A. Upload Timeout Too Long**
```javascript
const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes!
```

**Issues:**
- User waits 10 minutes for failed upload
- Blocks other uploads (only 3 concurrent)
- No retry logic

**Fix:**
```javascript
// Shorter timeout with exponential backoff retry
const UPLOAD_TIMEOUT = 60000; // 1 minute
const MAX_RETRIES = 3;

async function uploadWithRetry(segment, retries = 0) {
  try {
    await uploadSingleSegment(segment);
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      return uploadWithRetry(segment, retries + 1);
    }
    throw error;
  }
}
```

**B. No Offline Detection**
```javascript
if (!navigator.onLine) {
  console.log("❌ [UPLOAD] No internet connection");
  return; // Just returns, doesn't retry when online
}
```

**Fix:**
```javascript
// Listen for online event
window.addEventListener('online', () => {
  console.log('Back online, resuming uploads...');
  resumeAllUploads();
});
```

---

### 8. **Browser Tab Close/Refresh**

**Problem:**
```javascript
// beforeunload only shows warning, doesn't save data
const handleBeforeUnload = (e) => {
  if (isRecordingActive()) {
    e.preventDefault();
    e.returnValue = '';
  }
};
```

**Issues:**
- User can still close tab (just gets warning)
- Current recording blob is lost
- No automatic save

**Fix:**
```javascript
const handleBeforeUnload = async (e) => {
  if (isRecordingActive()) {
    e.preventDefault();
    e.returnValue = '';
    
    // Use sendBeacon for guaranteed delivery
    const blob = await getCurrentRecordingBlob();
    const formData = new FormData();
    formData.append('blob', blob);
    navigator.sendBeacon('/api/emergency-save', formData);
  }
};
```

---

### 9. **Concurrent Meeting Sessions**

**Problem:** User joins same meeting in multiple tabs

**Issues:**
- Multiple recordings started
- Duplicate segments uploaded
- Session timeline corrupted (multiple join/leave events)

**Fix Required:**
```javascript
// Detect multiple tabs using BroadcastChannel
const channel = new BroadcastChannel('meeting-channel');

channel.onmessage = (event) => {
  if (event.data.type === 'MEETING_JOINED' && 
      event.data.meetingId === currentMeetingId) {
    alert('This meeting is already open in another tab!');
    window.close();
  }
};

// Broadcast when joining
channel.postMessage({ 
  type: 'MEETING_JOINED', 
  meetingId: meetingName 
});
```

---

### 10. **IndexedDB Quota Exceeded**

**Problem:** No check for storage quota

**Issues:**
- Recording fails silently when quota exceeded
- User doesn't know why recording stopped
- Old segments not cleaned up

**Fix Required:**
```javascript
// Check quota before recording
async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const percentUsed = (estimate.usage / estimate.quota) * 100;
    
    if (percentUsed > 90) {
      throw new Error('Storage quota almost full! Please upload existing recordings.');
    }
  }
}

// Clean up old uploaded segments
async function cleanupOldSegments() {
  const oldSegments = await db.chunks
    .where('uploaded')
    .equals(true)
    .and(chunk => Date.now() - chunk.timestamp > 24 * 60 * 60 * 1000) // 24 hours old
    .toArray();
  
  await db.chunks.bulkDelete(oldSegments.map(s => s.id));
}
```

---

### 11. **Session Timeline Race Conditions**

**Location:** `socketController.js` - Session tracking

**Problem:**
```javascript
const meetingStartTimes = new Map();
// ...
if (!meetingStartTimes.has(meetingId)) {
  meetingStartTimes.set(meetingId, Date.now());
}
```

**Issues:**
- **Multiple joins:** If 2 users join simultaneously, both might initialize start time
- **Lost on restart:** In-memory Map lost on server restart
- **No cleanup:** Map grows forever

**Fix Required:**
```javascript
// Use database with atomic operations
const session = await SessionDB.findOneAndUpdate(
  { meetingId },
  { 
    $setOnInsert: { callStartTime: new Date() }
  },
  { 
    upsert: true, 
    new: true 
  }
);
```

---

### 12. **Upload Loop Multiple Instances**

**Location:** `Home.jsx` - `startUploadLoop`

**Problem:**
```javascript
const handleUploadToggle = async (meetingName, e) => {
  // ...
  startUploadLoop(meetingName, meetingId); // No check if already running!
}
```

**Issues:**
- Clicking play button multiple times starts multiple loops
- Multiple loops upload same segments
- Race condition on `uploadingMeetingsRef`

**Fix Required:**
```javascript
// Track running loops
const runningLoops = new Set();

const startUploadLoop = async (meetingName, meetingId) => {
  const loopKey = `${meetingName}:${meetingId}`;
  
  if (runningLoops.has(loopKey)) {
    console.log('Upload loop already running for', meetingName);
    return;
  }
  
  runningLoops.add(loopKey);
  
  try {
    while (uploadingMeetingsRef.current[meetingName]) {
      // ... upload logic
    }
  } finally {
    runningLoops.delete(loopKey);
  }
};
```

---

### 13. **Socket Reconnection Issues**

**Problem:** No handling for socket disconnection/reconnection

**Issues:**
- User disconnects, recording state lost
- Reconnects, doesn't rejoin meeting room
- Events missed during disconnection

**Fix Required:**
```javascript
socket.on('disconnect', () => {
  console.log('Socket disconnected, will attempt reconnect...');
});

socket.on('connect', () => {
  console.log('Socket reconnected');
  
  // Rejoin meeting if we were in one
  if (currentMeetingId && user?.email) {
    socket.emit('join_meeting', { 
      meetingId: currentMeetingId, 
      userId: user.email 
    });
  }
});
```

---

### 14. **Blob Size Limits**

**Problem:** No check for blob size before upload

**Issues:**
- Very large blobs (>100MB) may fail to upload
- Network timeout
- Backend may reject large files

**Fix Required:**
```javascript
const MAX_BLOB_SIZE = 50 * 1024 * 1024; // 50MB

if (segment.blob.size > MAX_BLOB_SIZE) {
  console.error(`Segment ${segmentIndex} too large: ${segment.blob.size} bytes`);
  // Split into smaller chunks or compress
  throw new Error('Segment too large');
}
```

---

### 15. **Meeting ID Collision**

**Problem:** Meeting IDs from URL params, no validation

**Issues:**
- Special characters in meeting ID
- SQL injection if stored in SQL DB
- Path traversal if used in file paths

**Fix Required:**
```javascript
function sanitizeMeetingId(meetingId) {
  // Only allow alphanumeric, dash, underscore
  return meetingId.replace(/[^a-zA-Z0-9-_]/g, '');
}

// Validate before use
if (!/^[a-zA-Z0-9-_]+$/.test(meetingId)) {
  throw new Error('Invalid meeting ID');
}
```

---

## 📋 SUMMARY OF CRITICAL FIXES NEEDED

1. ✅ **Fix upload segment tracking** - Use `meetingId:segmentIndex` key
2. ✅ **Add recording state per meeting** - Use Map instead of globals
3. ✅ **Persist recording state in DB** - Don't use in-memory Map
4. ✅ **Add unique constraint to IndexedDB** - Prevent duplicate segments
5. ✅ **Add upload retry logic** - Handle network failures
6. ✅ **Detect multiple tabs** - Prevent concurrent sessions
7. ✅ **Check storage quota** - Warn user before quota exceeded
8. ✅ **Add socket reconnection** - Handle disconnects gracefully
9. ✅ **Prevent multiple upload loops** - Track running loops
10. ✅ **Add blob size validation** - Reject oversized segments

## 🔧 RECOMMENDED TESTING

1. **Load Testing:** Multiple users in same meeting
2. **Network Testing:** Simulate slow/dropped connections
3. **Storage Testing:** Fill up IndexedDB quota
4. **Tab Testing:** Open same meeting in multiple tabs
5. **Timing Testing:** Rapid button clicks, race conditions
6. **Recovery Testing:** Server restart during meeting
7. **Browser Testing:** Close tab during recording
8. **Mobile Testing:** Background/foreground transitions
