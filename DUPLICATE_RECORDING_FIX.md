# Duplicate Recording Issue - Fix Documentation

## Problem Identified

When rejoining a meeting, `startRecording()` was being called **multiple times** (2-3 times), causing:
- Multiple parallel recording streams
- Duplicate segments being saved to IndexedDB
- Same segment index saved multiple times (e.g., segment_5 saved 3 times)
- Wasted resources (camera/mic streams, memory, storage)

### Evidence from Logs

```
MeetingUI.jsx:262 🔴 Auto-starting recording for newly joined user
MeetingUI.jsx:262 🔴 Auto-starting recording for newly joined user  ← DUPLICATE
MeetingUI.jsx:262 🔴 Auto-starting recording for newly joined user  ← DUPLICATE

recording.js:47 📊 Found lastSegmentIndex in localStorage: 4
recording.js:88 📊 Starting recording from segment 5
recording.js:92 ✅ Recording started
recording.js:47 📊 Found lastSegmentIndex in localStorage: 4  ← DUPLICATE
recording.js:88 📊 Starting recording from segment 5  ← DUPLICATE
recording.js:92 ✅ Recording started  ← DUPLICATE
recording.js:47 📊 Found lastSegmentIndex in localStorage: 4  ← DUPLICATE
recording.js:88 📊 Starting recording from segment 5  ← DUPLICATE
recording.js:92 ✅ Recording started  ← DUPLICATE

recording.js:129 💾 Saving segment 5 (13.25MB)
recording.js:129 💾 Saving segment 5 (13.26MB)  ← DUPLICATE (slightly different size)
recording.js:129 💾 Saving segment 6 (13.13MB)
```

---

## Root Causes

### 1. Multiple `joined_meeting` Socket Events

The `joined_meeting` event was being received **3 times** for a single join:

```javascript
socket.on("joined_meeting", ({ meetingId, isRecording }) => {
  if (isRecording && !isRecordingActive()) {
    startRecording(meetingName, user?.email); // Called 3 times!
  }
});
```

**Why?**
- Socket event listeners were not being properly removed in cleanup
- React strict mode in development causes double renders
- Multiple effect runs due to dependency changes

### 2. No Guard Against Duplicate Calls

`startRecording()` had no protection against being called multiple times:

```javascript
export async function startRecording(meetingName, userEmail = null) {
  // No check if already recording!
  isRecording = true;
  // ... start recording ...
}
```

### 3. Anonymous Functions in Event Listeners

Event listeners were using anonymous functions, making cleanup ineffective:

```javascript
// ❌ BAD: Anonymous function can't be removed properly
socket.on("start_recording", () => {
  startRecording(meetingName, user?.email);
});

// Cleanup doesn't work because it's a different function reference
socket.off("start_recording"); // Doesn't remove the listener!
```

---

## Solution

### 1. Named Event Handler Functions

**File**: `Frontend/my_meeting_app/src/MeetingUI.jsx`

Use named functions so they can be properly removed:

```javascript
// ✅ Track if recording has been started to prevent duplicates
let recordingStarted = false;

const handleStartRecording = () => {
  console.log("🔴 [MEETING_UI] start_recording event received");
  if (!recordingStarted) {
    recordingStarted = true;
    setRecording(true);
    startRecording(meetingName, user?.email);
  } else {
    console.warn("⚠️ [MEETING_UI] Recording already started, ignoring duplicate event");
  }
};

const handleStopRecording = () => {
  console.log("⏹️ [MEETING_UI] stop_recording event received");
  recordingStarted = false;
  setRecording(false);
  stopRecording(meetingName);
};

const handleJoinedMeeting = ({ meetingId, isRecording }) => {
  console.log("✅ [MEETING_UI] joined_meeting confirmation for:", meetingId);
  console.log("🎥 [MEETING_UI] Recording in progress:", isRecording);
  
  // Only start if not already started
  if (isRecording && !recordingStarted && !isRecordingActive()) {
    console.log("🔴 [MEETING_UI] Auto-starting recording for newly joined user");
    recordingStarted = true;
    setRecording(true);
    startRecording(meetingName, user?.email);
  }
};

// Add event listeners with named functions
socket.on("start_recording", handleStartRecording);
socket.on("stop_recording", handleStopRecording);
socket.on("joined_meeting", handleJoinedMeeting);

// Cleanup with same function references
return () => {
  socket.off("start_recording", handleStartRecording);
  socket.off("stop_recording", handleStopRecording);
  socket.off("joined_meeting", handleJoinedMeeting);
};
```

### 2. Guard in `startRecording()`

**File**: `Frontend/my_meeting_app/src/utils/recording.js`

Add early return if already recording:

```javascript
export async function startRecording(meetingName, userEmail = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.log("❌ getUserMedia not supported!");
    return;
  }

  // ✅ Prevent multiple simultaneous recordings
  if (isRecording) {
    console.warn("⚠️ Recording already in progress, ignoring duplicate call");
    return;
  }

  try {
    // ... rest of recording logic ...
    isRecording = true;
    // ...
  } catch (err) {
    console.error("❌ Error accessing camera/mic:", err);
    isRecording = false;
  }
}
```

### 3. Local State Tracking

Track recording state locally in the effect to prevent duplicates within the same component lifecycle:

```javascript
let recordingStarted = false; // Local to the effect

const handleStartRecording = () => {
  if (!recordingStarted) {
    recordingStarted = true;
    // ... start recording ...
  }
};

const handleStopRecording = () => {
  recordingStarted = false; // Reset on stop
  // ... stop recording ...
};
```

---

## How It Works Now

### Before Fix (Duplicate Recordings)

```
User rejoins meeting
    ↓
joined_meeting event received (3 times)
    ↓
startRecording() called 3 times
    ↓
3 parallel MediaRecorder instances created
    ↓
Each records the same content
    ↓
segment_5 saved 3 times to IndexedDB
    ↓
3x storage usage, 3x upload bandwidth
```

### After Fix (Single Recording)

```
User rejoins meeting
    ↓
joined_meeting event received (3 times)
    ↓
First call: recordingStarted = false
  → startRecording() called ✅
  → recordingStarted = true
    ↓
Second call: recordingStarted = true
  → Ignored ✅
    ↓
Third call: recordingStarted = true
  → Ignored ✅
    ↓
Single MediaRecorder instance
    ↓
segment_5 saved once
    ↓
Normal storage and bandwidth usage
```

---

## Benefits

### 1. Resource Efficiency
- **Before**: 3x camera/mic streams, 3x memory usage
- **After**: 1x camera/mic stream, 1x memory usage

### 2. Storage Savings
- **Before**: Each segment saved 3 times (3x storage)
- **After**: Each segment saved once

### 3. Upload Efficiency
- **Before**: Same segment uploaded 3 times (wasted bandwidth)
- **After**: Each segment uploaded once

### 4. Cleaner Logs
- **Before**: Duplicate logs everywhere
- **After**: Clean, single-instance logs

### 5. Predictable Behavior
- **Before**: Race conditions, unpredictable segment counts
- **After**: Deterministic, one recording stream

---

## Testing Checklist

- [x] Join meeting → Start recording → Only one stream
- [x] Rejoin meeting → Auto-start recording → Only one stream
- [x] Multiple rejoins → No duplicate recordings
- [x] Start/stop recording manually → Works correctly
- [x] Leave meeting → Recording stops cleanly
- [x] Event listeners cleaned up properly
- [x] No duplicate segments in IndexedDB
- [x] Logs show single recording start

---

## Edge Cases Handled

### 1. React Strict Mode (Development)
- Strict mode causes double renders
- Named functions + local state prevent duplicates
- ✅ Works correctly

### 2. Multiple Socket Events
- Backend might emit multiple times
- Guard in `startRecording()` prevents duplicates
- ✅ Only first call succeeds

### 3. Rapid Rejoin
- User leaves and rejoins quickly
- `recordingStarted` flag prevents overlap
- ✅ Clean state management

### 4. Event Listener Cleanup
- Named functions ensure proper removal
- No memory leaks from orphaned listeners
- ✅ Clean cleanup

---

## Code Changes Summary

### MeetingUI.jsx
```diff
- socket.on("start_recording", () => {
-   startRecording(meetingName, user?.email);
- });

+ let recordingStarted = false;
+ 
+ const handleStartRecording = () => {
+   if (!recordingStarted) {
+     recordingStarted = true;
+     startRecording(meetingName, user?.email);
+   }
+ };
+ 
+ socket.on("start_recording", handleStartRecording);

  return () => {
-   socket.off("start_recording");
+   socket.off("start_recording", handleStartRecording);
  };
```

### recording.js
```diff
  export async function startRecording(meetingName, userEmail = null) {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

+   // Prevent multiple simultaneous recordings
+   if (isRecording) {
+     console.warn("⚠️ Recording already in progress");
+     return;
+   }

    isRecording = true;
    // ... rest of code ...
  }
```

---

## Expected Logs After Fix

```
✅ [MEETING_UI] joined_meeting confirmation for: dOOHUX3lKVJG
🎥 [MEETING_UI] Recording in progress: true
🔴 [MEETING_UI] Auto-starting recording for newly joined user
📊 Found lastSegmentIndex in localStorage: 4
📊 Starting recording from segment 5
✅ Recording started

💾 Saving segment 5 (13.25MB)  ← Only once!
💾 Saving segment 6 (13.13MB)  ← Only once!
💾 Saving segment 7 (5.43MB)   ← Only once!
```

No more duplicates! 🎉

---

## Summary

The duplicate recording issue was caused by:
1. Multiple socket event emissions
2. Anonymous event handlers preventing proper cleanup
3. No guard against duplicate `startRecording()` calls

Fixed by:
1. Using named event handler functions
2. Adding local `recordingStarted` flag
3. Adding guard in `startRecording()` function
4. Proper event listener cleanup with function references

Result: Clean, single-instance recordings with no duplicates.
