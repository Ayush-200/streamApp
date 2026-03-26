# The ACTUAL Cause of Multiple Events (No Strict Mode!)

## Discovery

React.StrictMode is **NOT enabled** in your `main.jsx`:

```javascript
// main.jsx - NO StrictMode wrapper
root.render(
  <Auth0Provider>
    <App />
  </Auth0Provider>
);
```

So the duplicate events are NOT caused by Strict Mode. Let's find the real culprit!

---

## The Real Cause: Multiple `join_meeting` Emissions

Looking at your logs carefully:

```
📡 [MEETING_UI] Emitting join_meeting event...
✅ [MEETING_UI] joined_meeting confirmation for: dOOHUX3lKVJG

📡 [MEETING_UI] Emitting join_meeting event...  ← EMITTED AGAIN!
✅ [MEETING_UI] joined_meeting confirmation for: dOOHUX3lKVJG

📡 [MEETING_UI] Emitting join_meeting event...  ← EMITTED AGAIN!
✅ [MEETING_UI] joined_meeting confirmation for: dOOHUX3lKVJG
```

The frontend is **emitting** `join_meeting` **3 times**, and the backend responds each time!

---

## Why `join_meeting` is Emitted 3 Times

### The useEffect Dependencies

```javascript
useEffect(() => {
  // ... setup socket listeners ...
  
  const emitJoinMeeting = () => {
    socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});
  };
  
  if (socket.connected) {
    emitJoinMeeting(); // ← EMITS HERE
  }
  
  // ... rest of code ...
}, [call, meetingName, user]); // ← These dependencies change!
```

### When This Effect Runs

1. **Initial mount** when component loads
   - `call` is `null`
   - Effect returns early: `if (!call || !user) return;`
   - ❌ No emission yet

2. **When `call` is set** (after StreamVideoClient initializes)
   - First useEffect completes: `setCall(callInstance)`
   - Second useEffect runs because `call` changed
   - ✅ **First emission**: `join_meeting` sent
   - Backend responds: `joined_meeting` received

3. **When `user` object changes** (Auth0 updates)
   - Auth0 might update user object (token refresh, profile update)
   - Effect runs again because `user` reference changed
   - ✅ **Second emission**: `join_meeting` sent again
   - Backend responds: `joined_meeting` received again

4. **When `meetingName` changes** (if navigating)
   - If user navigates or meetingName updates
   - Effect runs again
   - ✅ **Third emission**: `join_meeting` sent again
   - Backend responds: `joined_meeting` received again

---

## Visual Flow

```
Component Mount
    ↓
First useEffect (init)
    ↓
    - Fetch token
    - Create StreamVideoClient
    - setClient(c)
    - setCall(callInstance) ← STATE UPDATE
    ↓
Second useEffect triggered (call changed)
    ↓
    - call is now set
    - socket.emit("join_meeting") ← EMISSION #1
    - Backend: socket.emit("joined_meeting")
    - Frontend: handleJoinedMeeting() called
    - startRecording() called #1
    ↓
Auth0 updates user object
    ↓
Second useEffect triggered (user changed)
    ↓
    - socket.emit("join_meeting") ← EMISSION #2
    - Backend: socket.emit("joined_meeting")
    - Frontend: handleJoinedMeeting() called
    - startRecording() called #2
    ↓
Some other state change (meetingName or user again)
    ↓
Second useEffect triggered
    ↓
    - socket.emit("join_meeting") ← EMISSION #3
    - Backend: socket.emit("joined_meeting")
    - Frontend: handleJoinedMeeting() called
    - startRecording() called #3
```

---

## Why `user` Object Changes

Auth0Provider can update the `user` object for several reasons:

1. **Token refresh**: Auth0 silently refreshes tokens
2. **Profile updates**: User profile data updates
3. **Object recreation**: Auth0 might recreate the user object
4. **Cache updates**: `cacheLocation="localstorage"` syncs

Each time the `user` object reference changes, the effect re-runs!

---

## The Problem with Current Dependencies

```javascript
useEffect(() => {
  // This effect should only run ONCE when joining
  // But it runs every time call, meetingName, or user changes!
  
  socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});
  
}, [call, meetingName, user]); // ← TOO MANY DEPENDENCIES
```

**What we want**: Emit `join_meeting` only once when joining
**What happens**: Emit every time dependencies change

---

## Solution Options

### Option 1: Use `useRef` to Track if Already Joined (BEST)

```javascript
useEffect(() => {
  if (!call || !user) return;
  
  const hasJoinedRef = useRef(false);
  
  const emitJoinMeeting = () => {
    if (hasJoinedRef.current) {
      console.log("⚠️ Already joined, skipping emission");
      return;
    }
    
    console.log("📡 Emitting join_meeting event...");
    socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});
    hasJoinedRef.current = true;
  };
  
  if (socket.connected) {
    emitJoinMeeting();
  }
  
  // ... rest of code ...
}, [call, meetingName, user]);
```

### Option 2: Separate Effects (CLEANER)

```javascript
// Effect 1: Setup socket listeners (runs on dependency changes)
useEffect(() => {
  if (!call || !user) return;
  
  const handleJoinedMeeting = ({ meetingId, isRecording }) => {
    // ... handler code ...
  };
  
  socket.on("joined_meeting", handleJoinedMeeting);
  
  return () => {
    socket.off("joined_meeting", handleJoinedMeeting);
  };
}, [call, meetingName, user]);

// Effect 2: Emit join_meeting ONCE (runs only when call is first set)
useEffect(() => {
  if (!call || !user) return;
  
  console.log("📡 Emitting join_meeting event...");
  socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});
  
  // No cleanup needed
}, [call]); // ← Only depends on call, runs once when call is set
```

### Option 3: Use `user.email` Instead of `user` Object

```javascript
useEffect(() => {
  if (!call || !user) return;
  
  // ... setup code ...
  
}, [call, meetingName, user.email]); // ← Use user.email, not user object
```

This prevents re-runs when the `user` object reference changes but the email stays the same.

---

## Why Our Current Fix Still Works

Even though we didn't fix the root cause (multiple emissions), our guards prevent the issue:

1. **Local `recordingStarted` flag**:
   ```javascript
   let recordingStarted = false;
   
   if (!recordingStarted) {
     recordingStarted = true;
     startRecording();
   }
   ```

2. **Guard in `startRecording()`**:
   ```javascript
   if (isRecording) {
     console.warn("Already recording");
     return;
   }
   ```

3. **Named functions for proper cleanup**:
   - Ensures old listeners are removed
   - Prevents accumulation across re-renders

---

## Recommended Fix

Implement **Option 2** (Separate Effects) for cleanest solution:

```javascript
// Effect 1: Setup socket listeners
useEffect(() => {
  if (!call || !user) return;
  
  setMeetingName(meetingName);
  
  let recordingStarted = false;
  
  const handleStartRecording = () => {
    if (!recordingStarted) {
      recordingStarted = true;
      setRecording(true);
      startRecording(meetingName, user?.email);
    }
  };
  
  const handleStopRecording = () => {
    recordingStarted = false;
    setRecording(false);
    stopRecording(meetingName);
  };
  
  const handleJoinedMeeting = ({ meetingId, isRecording }) => {
    if (isRecording && !recordingStarted && !isRecordingActive()) {
      recordingStarted = true;
      setRecording(true);
      startRecording(meetingName, user?.email);
    }
  };
  
  socket.on("start_recording", handleStartRecording);
  socket.on("stop_recording", handleStopRecording);
  socket.on("joined_meeting", handleJoinedMeeting);
  
  return () => {
    socket.off("start_recording", handleStartRecording);
    socket.off("stop_recording", handleStopRecording);
    socket.off("joined_meeting", handleJoinedMeeting);
  };
}, [call, meetingName, user]);

// Effect 2: Emit join_meeting ONCE
useEffect(() => {
  if (!call || !user) return;
  
  console.log("📡 [MEETING_UI] Emitting join_meeting event...");
  socket.emit("join_meeting", {meetingId: meetingName, userId: user.email});
  
}, [call]); // ← Only runs when call is first set
```

---

## Summary

**Root Cause**: The useEffect with socket listeners runs **3 times** because:
1. `call` changes (when StreamVideoClient initializes)
2. `user` object changes (Auth0 updates)
3. Possibly `meetingName` or `user` changes again

**Each time it runs**: 
- Emits `join_meeting` 
- Backend responds with `joined_meeting`
- `handleJoinedMeeting` calls `startRecording()`

**Current Fix**: Guards prevent multiple recordings even with multiple emissions

**Better Fix**: Separate the "emit join_meeting" logic into its own effect that only runs once when `call` is set

**Best Practice**: Use `useRef` to track if already joined, or split into two effects with different dependencies.
