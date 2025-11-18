# 🎥 Video Recording Explanation

## How Recording Works in Your Project

### ✅ **YES - Recording Uses User's Local Camera & Microphone**

Your project records video using the **user's local camera and microphone** directly from their browser/device.

---

## 📋 Recording Flow

### 1. **Recording Initiation** (`MeetingUI.jsx`)
```javascript
// User clicks "record" button
function handleRecord(){
  if(!recording){
    socket.emit("start_recording", meetingName);  // Notify server
    setRecording(true);
  }
}
```

### 2. **Recording Start** (`recording.js` - Lines 4-44)
```javascript
export async function startRecording(meetingName) {
  // ✅ Uses browser's MediaDevices API
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,  // User's camera
    audio: true,  // User's microphone
  });

  // ✅ Creates MediaRecorder to capture the stream
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9,opus",
  });
  
  mediaRecorder.start(1000); // Records every 1 second
}
```

### 3. **Recording Stop** (`recording.js` - Lines 46-49)
```javascript
export function stopRecording(meetingName) {
  mediaRecorder.stop(); // Stops recording
  // Automatically triggers onstop event
}
```

### 4. **Upload to Backend** (`recording.js` - Lines 51-60)
```javascript
function uploadRecording(blob, meetingName) {
  const formData = new FormData();
  formData.append("file", blob, `user-${Date.now()}.webm`);
  
  // Uploads to Backend/uploads/ folder
  fetch(`http://localhost:3000/upload/${meetingName}`, {
    method: "POST",
    body: formData,
  });
}
```

---

## 🔍 Key Points

### ✅ **What It Records:**
- **User's own camera feed** (their video)
- **User's own microphone** (their audio)
- Recorded **client-side** in the browser
- Format: **WebM** (`.webm`)

### ⚠️ **Important Limitation:**
The recording captures **only the individual user's camera/mic**, NOT:
- ❌ The full meeting with all participants
- ❌ Other participants' video/audio
- ❌ The Stream.io call stream

### 📊 **Current Architecture:**

```
┌─────────────────────────────────────────┐
│         User's Browser                   │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Stream.io Video Call             │  │
│  │  (Shows all participants)         │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Recording (Separate)             │  │
│  │  getUserMedia() → MediaRecorder   │  │
│  │  (Only records THIS user)          │  │
│  └──────────────────────────────────┘  │
│              ↓                          │
│         Upload to Backend               │
└─────────────────────────────────────────┘
```

---

## 🔄 Complete Recording Workflow

1. **User joins meeting** → Stream.io handles video call
2. **User clicks "Record" button** → Socket.io emits `start_recording`
3. **All participants receive signal** → Each starts recording their own camera
4. **Browser requests camera/mic permission** → `getUserMedia()` API
5. **MediaRecorder captures stream** → Records to chunks every 1 second
6. **User clicks "Stop"** → `mediaRecorder.stop()` called
7. **Blob created** → All chunks combined into WebM file
8. **Uploaded to backend** → `Backend/uploads/` folder
9. **Backend uploads to Cloudinary** → Tagged with `meetingId`
10. **FFmpeg merges all videos** → Creates grid layout with all participants

---

## 🎯 What Gets Recorded

### Each Participant Records:
- ✅ Their own camera video
- ✅ Their own microphone audio
- ✅ Format: WebM (VP9 video codec, Opus audio codec)

### After Upload:
- All individual recordings are merged using **FFmpeg**
- Creates a **grid layout** showing all participants
- Final merged video stored in Cloudinary

---

## 🔧 Technical Details

### **Browser APIs Used:**
1. **`navigator.mediaDevices.getUserMedia()`**
   - Requests access to user's camera and microphone
   - Returns a `MediaStream` object
   - Requires user permission (browser will prompt)

2. **`MediaRecorder API`**
   - Records the MediaStream
   - Creates chunks of video data
   - Combines chunks into a Blob when stopped

3. **`Blob`**
   - Binary data container for the video
   - Uploaded as FormData to backend

### **File Format:**
- **Container**: WebM
- **Video Codec**: VP9
- **Audio Codec**: Opus
- **File Extension**: `.webm`

---

## ⚠️ Current Issues & Improvements

### **Issue 1: Recording Only Self**
Currently, each user records only themselves. To record the full meeting:
- Option A: Use Stream.io's built-in recording feature
- Option B: Record the combined video stream (more complex)

### **Issue 2: No Error Handling**
```javascript
// Current: Basic try-catch
catch (err) {
  console.error("Error accessing camera/mic:", err);
}

// Should have: User-friendly error messages
catch (err) {
  if (err.name === 'NotAllowedError') {
    alert('Camera/microphone permission denied');
  } else if (err.name === 'NotFoundError') {
    alert('No camera/microphone found');
  }
}
```

### **Issue 3: No Recording State Management**
- No way to know if recording is actually active
- No visual indicator during recording
- No pause/resume functionality

---

## 🚀 Better Alternatives

### **Option 1: Use Stream.io Recording (Recommended)**
Stream.io has built-in cloud recording:
```javascript
// Start recording
await call.startRecording();

// Stop recording
await call.stopRecording();
```
**Benefits:**
- Records full meeting (all participants)
- Server-side recording (more reliable)
- Better quality
- Automatic handling

### **Option 2: Record Combined Stream**
Record the actual video call stream instead of individual camera:
```javascript
// Get the call's video track
const videoTrack = call.camera.state.track;
const audioTrack = call.microphone.state.track;

// Combine tracks
const combinedStream = new MediaStream([videoTrack, audioTrack]);

// Record combined stream
mediaRecorder = new MediaRecorder(combinedStream);
```

---

## 📝 Summary

**Your current recording:**
- ✅ Uses user's **local camera and microphone**
- ✅ Recorded **client-side** in browser
- ✅ Each participant records **themselves**
- ✅ Uploaded to backend and merged with FFmpeg
- ⚠️ Does NOT record the full meeting view
- ⚠️ Only records individual participant's feed

**To record the full meeting**, you would need to either:
1. Use Stream.io's cloud recording feature, OR
2. Record the combined video stream from the call

