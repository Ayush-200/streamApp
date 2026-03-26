# Why Multiple Socket Events Are Triggered

## The Mystery

Looking at the logs, we see `joined_meeting` event received **3 times**:

```
✅ [MEETING_UI] joined_meeting confirmation for: dOOHUX3lKVJG
✅ [MEETING_UI] joined_meeting confirmation for: dOOHUX3lKVJG  ← DUPLICATE
✅ [MEETING_UI] joined_meeting confirmation for: dOOHUX3lKVJG  ← DUPLICATE
```

But the backend only emits it **once**:

```javascript
// Backend - socketController.js
socket.emit("joined_meeting", { meetingId, isRecording }); // Only once!
```

So why does the frontend receive it 3 times?

---

## Root Cause Analysis

### 1. React Strict Mode (Development Only)

In development, React Strict Mode intentionally **double-invokes** effects to help detect side effects:

```javascript
// React Strict Mode behavior in development:
useEffect(() => {
  // This runs TWICE in development
  console.log("Effect running");
  
  return () => {
    // Cleanup runs TWICE too
    console.log("Cleanup running");
  };
}, [dependencies]);
```

**Result**: Effect runs → Cleanup → Effect runs again

### 2. Event Listeners Not Properly Removed

The original code used **anonymous functions** for event listeners:

```javascript
// ❌ PROBLEM: Anonymous function
socket.on("joined_meeting", ({ meetingId, isRecording }) => {
  // This creates a NEW function each time
  startRecording(meetingName, user?.email);
});

// Cleanup
return () => {
  socket.off("joined_meeting"); // ❌ Doesn't remove the specific listener!
};
```

**Why this fails:**
- `socket.off("joined_meeting")` without a function reference removes **ALL** listeners for that event
- But Socket.IO might not remove them immediately
- Each effect run adds a **new** listener
- Old listeners remain attached

### 3. Effect Runs Multiple Times

The useEffect has dependencies that change:

```javascript
useEffect(() => {
  // Setup socket listeners
  socket.on("joined_meeting", handler);
  
  return () => {
    socket.off("joined_meeting");
  };
}, [call, meetingName, user]); // ← These change!
```

**When does this effect run?**
1. Initial mount
2. When `call` changes (after StreamVideoClient initializes)
3. When `meetingName` changes (navigation)
4. When `user` changes (auth state updates)
5. React Strict Mode doubles each run

---

## The Complete Flow (Why 3 Events)

### Scenario: User Rejoins Meeting

```
1. Component mounts
   ↓
2. useEffect runs (first time)
   ↓
   - socket.on("joined_meeting", handler1) ← Listener 1 added
   - socket.emit("join_meeting")
   ↓
3. React Strict Mode cleanup (development)
   ↓
   - socket.off("joined_meeting") ← Tries to remove, but...
   ↓
4. React Strict Mode re-run (development)
   ↓
   - socket.on("joined_meeting", handler2) ← Listener 2 added
   - socket.emit("join_meeting") again? (if socket reconnects)
   ↓
5. `call` state updates (StreamVideoClient ready)
   ↓
   - Effect cleanup runs
   - socket.off("joined_meeting") ← Tries to remove
   ↓
6. Effect runs again (dependency changed)
   ↓
   - socket.on("joined_meeting", handler3) ← Listener 3 added
   ↓
7. Backend emits "joined_meeting" (once)
   ↓
8. All 3 listeners receive it!
   ↓
   handler1() → startRecording()
   handler2() → startRecording()
   handler3() → startRecording()
```

---

## Visual Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Lifecycle                       │
└─────────────────────────────────────────────────────────────┘

Mount
  │
  ├─ useEffect Run #1
  │   ├─ socket.on("joined_meeting", λ1)  ← Listener 1
  │   └─ socket.emit("join_meeting")
  │
  ├─ [Strict Mode Cleanup]
  │   └─ socket.off("joined_meeting")  ← Doesn't fully remove λ1
  │
  ├─ [Strict Mode Re-run]
  │   ├─ socket.on("joined_meeting", λ2)  ← Listener 2
  │   └─ socket.emit("join_meeting")
  │
  ├─ [call state updates]
  │
  ├─ useEffect Cleanup
  │   └─ socket.off("joined_meeting")  ← Doesn't fully remove λ1, λ2
  │
  ├─ useEffect Run #2 (dependency changed)
  │   ├─ socket.on("joined_meeting", λ3)  ← Listener 3
  │   └─ socket.emit("join_meeting")
  │
  └─ Backend Response
      └─ emit("joined_meeting")  ← ONE emission
          │
          ├─ λ1 receives it → startRecording()
          ├─ λ2 receives it → startRecording()
          └─ λ3 receives it → startRecording()
```

---

## Why Anonymous Functions Fail

### Problem Code

```javascript
// Each render creates a NEW function
socket.on("joined_meeting", ({ meetingId, isRecording }) => {
  // Function body
});

// Cleanup
socket.off("joined_meeting"); // Which function to remove? 🤷
```

### What Happens

```javascript
// Render 1
const handler1 = ({ meetingId, isRecording }) => { /* ... */ };
socket.on("joined_meeting", handler1);

// Cleanup attempt
socket.off("joined_meeting"); // Tries to remove ALL, but might not work

// Render 2
const handler2 = ({ meetingId, isRecording }) => { /* ... */ }; // NEW function!
socket.on("joined_meeting", handler2);

// Now we have BOTH handler1 AND handler2 listening!
```

---

## The Fix: Named Functions

### Solution Code

```javascript
useEffect(() => {
  // ✅ Named function with stable reference
  const handleJoinedMeeting = ({ meetingId, isRecording }) => {
    if (isRecording && !recordingStarted) {
      recordingStarted = true;
      startRecording(meetingName, user?.email);
    }
  };

  // Add listener with named function
  socket.on("joined_meeting", handleJoinedMeeting);

  // Cleanup with SAME function reference
  return () => {
    socket.off("joined_meeting", handleJoinedMeeting); // ✅ Removes THIS specific listener
  };
}, [call, meetingName, user]);
```

### Why This Works

```javascript
// Render 1
const handleJoinedMeeting1 = () => { /* ... */ };
socket.on("joined_meeting", handleJoinedMeeting1);

// Cleanup
socket.off("joined_meeting", handleJoinedMeeting1); // ✅ Removes handleJoinedMeeting1

// Render 2
const handleJoinedMeeting2 = () => { /* ... */ };
socket.on("joined_meeting", handleJoinedMeeting2);

// Only handleJoinedMeeting2 is listening now!
```

---

## Additional Factors

### 1. Socket.IO Event Accumulation

Socket.IO doesn't automatically remove listeners when you call `socket.off(eventName)` without a function reference. It's a known behavior:

```javascript
// ❌ Might not remove all listeners
socket.off("joined_meeting");

// ✅ Removes specific listener
socket.off("joined_meeting", specificHandler);
```

### 2. React Development vs Production

**Development (Strict Mode ON)**:
- Effects run twice
- More likely to accumulate listeners
- 3+ duplicate events common

**Production (Strict Mode OFF)**:
- Effects run once
- Still possible to get duplicates if dependencies change
- 2 duplicate events possible

### 3. Component Re-renders

Any state change causes re-render:
- `recording` state changes
- `call` state changes
- `user` state changes
- Parent component re-renders

Each re-render with dependency changes → Effect runs → New listener added

---

## Summary

**Why 3 events?**

1. **React Strict Mode** (development): Runs effect twice
2. **Dependency changes**: `call` state updates → Effect runs again
3. **Anonymous functions**: Can't properly remove old listeners
4. **Socket.IO behavior**: Doesn't remove listeners without function reference

**Result**: 3 listeners attached, all receive the same event

**Solution**:
1. ✅ Use named functions for event handlers
2. ✅ Pass function reference to `socket.off()`
3. ✅ Add local guard (`recordingStarted` flag)
4. ✅ Add guard in `startRecording()` function

**Production Note**: In production (without Strict Mode), you'd likely see 2 events instead of 3, but the problem still exists. The fix handles both cases.

---

## Testing in Production

To verify this is a Strict Mode issue:

1. Build for production: `npm run build`
2. Serve production build: `npm run preview`
3. Check logs: Should see fewer duplicate events (but still possible)

The fix we implemented handles **both** development and production scenarios.
