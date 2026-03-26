# Complete Upload Flow - From Join to Leave to Rejoin

## 🎬 Session 1: First Join → Record → Leave

### Step 1: User Joins Meeting
```
Frontend: MeetingUI.jsx
├─ User clicks "Join Meeting"
├─ Navigate to /meeting/:meetingName
├─ StreamVideoClient initializes
└─ Socket emits "join_meeting"

Backend: socketController.js
├─ Receives "join_meeting" event
├─ Creates/updates SessionDB entry
├─ Adds user to MeetingParticipantDB
├─ Checks meetingRecordingState
└─ Emits "joined_meeting" with { meetingId, isRecording }

Frontend: MeetingUI.jsx
├─ Receives "joined_meeting"
├─ If isRecording = true → Auto-starts recording
└─ User sees meeting UI
```

### Step 2: User Starts Recording
```
Frontend: MeetingUI.jsx
├─ User clicks "Record" button
├─ Socket emits "start_recording"
└─ Sets local recording state = true

Backend: socketController.js
├─ Receives "start_recording"
├─ Sets meetingRecordingState[meetingId] = true
└─ Broadcasts "start_recording" to all users in meeting

Frontend: MeetingUI.jsx (All Users)
├─ Receives "start_recording" event
├─ Calls startRecording(meetingName, userEmail)
└─ Recording begins

Frontend: recording.js → startRecording()
├─ Gets camera/microphone stream
├─ Checks IndexedDB for existing segments
│  └─ If found: segmentCounter = maxIndex + 1
│  └─ If not: segmentCounter = 0
├─ Starts MediaRecorder
└─ Begins 60-second segment recording
```

### Step 3: Recording Segments (Every 60 Seconds)
```
Frontend: recording.js → startSegmentRecording()
├─ MediaRecorder records for 60 seconds
├─ On stop:
│  ├─ Merges recorded chunks into Blob
│  ├─ Saves to IndexedDB:
│  │  {
│  │    id: auto-increment,
│  │    userId: "user@email.com",
│  │    meetingId: "meeting-name",
│  │    segmentIndex: 0,
│  │    blob: <Blob>,
│  │    timestamp: Date.now(),
│  │    retries: 0,
│  │    uploaded: false
│  │  }
│  ├─ Increments segmentCounter++
│  └─ Starts next segment recording
└─ Repeats every 60 seconds

Example Timeline:
0:00 - 1:00 → segment_0 saved to IndexedDB
1:00 - 2:00 → segment_1 saved to IndexedDB
2:00 - 3:00 → segment_2 saved to IndexedDB
```

### Step 4: User Leaves Meeting
```
Frontend: MeetingUI.jsx → handleHangup()
├─ User clicks "Leave Call" button
├─ Sets isLeaving = true (shows loading)
├─ If recording active:
│  └─ Calls saveCurrentBlobAndStop()
│     ├─ Stops MediaRecorder
│     ├─ Waits for current segment to save to IndexedDB
│     └─ Stops camera/microphone tracks
├─ Disables camera: call.camera.disable()
├─ Disables microphone: call.microphone.disable()
├─ Socket emits "leave_meeting"
├─ Calls call.leave()
├─ Calls client.disconnectUser()
└─ Navigates to /home

Backend: socketController.js
├─ Receives "leave_meeting"
├─ Calculates endTime
├─ Updates SessionDB (sets session.end)
└─ User leaves socket room

Frontend: Home.jsx (Dashboard)
├─ User sees dashboard
├─ Meetings list shows all meetings
└─ Each meeting has upload button (Play icon)

IndexedDB State:
└─ Contains segments: [segment_0, segment_1, segment_2]
   (Not uploaded yet)
```

---

## 📤 Upload from Dashboard (Optional)

### Step 5: User Uploads Segments
```
Frontend: Home.jsx
├─ User clicks Play button on meeting card
├─ Calls handleUploadToggle(meetingName)
│  ├─ Checks if another meeting is uploading
│  ├─ Checks if loop already running (runningLoops)
│  ├─ Marks runningLoops.add(meetingName)
│  ├─ Sets uploadingMeetingsRef[meetingName] = true
│  ├─ Sets currentUploadingMeeting = meetingName
│  └─ Calls startUploadLoop(meetingName, meetingId)
└─ Shows progress indicator

Frontend: Home.jsx → startUploadLoop()
├─ Gets initial segment count from IndexedDB
├─ While uploadingMeetingsRef[meetingName] = true:
│  ├─ Calls uploadOldestSegment(meetingId, userEmail)
│  ├─ Updates progress state
│  ├─ Checks if more segments remain
│  └─ Waits 2 seconds before next batch
└─ When complete:
   ├─ Sets status = 'completed'
   ├─ Clears runningLoops
   └─ Hides progress after 3 seconds

Frontend: uploadSegment.js → uploadOldestSegment()
├─ Checks navigator.onLine
├─ Gets all segments from IndexedDB for this meetingId
├─ Filters out currently uploading segments
├─ Sorts by segmentIndex (oldest first)
├─ Takes up to 3 segments (MAX_CONCURRENT_UPLOADS)
└─ Uploads in parallel using Promise.allSettled()

Frontend: uploadSegment.js → uploadSingleSegment()
├─ Marks segment as uploading (activeUploads.add)
├─ Creates File object: new File([blob], "segment-0.webm")
├─ Creates FormData:
│  ├─ file: segment-0.webm
│  ├─ userId: "user@email.com"
│  └─ chunkIndex: 0
├─ Sends POST to /uploadSegment/:meetingId
├─ Waits for response (timeout: 10 minutes)
├─ If success:
│  ├─ Deletes segment from IndexedDB
│  └─ Removes from activeUploads
└─ If error:
   ├─ Logs error
   └─ Segment stays in IndexedDB for retry

Backend: uploadBlob.js
├─ Receives POST /uploadSegment/:meetingId
├─ Extracts: meetingId, userId, chunkIndex, file
├─ Converts buffer to base64
├─ Uploads to Cloudinary:
│  {
│    resource_type: "video",
│    format: "webm",
│    public_id: "recordings/{meetingId}/{userId}/segment_{chunkIndex}",
│    folder: "meeting_recordings/{meetingId}",
│    chunk_size: 6MB,
│    timeout: 10 minutes
│  }
├─ Returns: { success: true, url: cloudinaryUrl, chunkIndex }
└─ Frontend deletes segment from IndexedDB

Cloudinary Storage:
└─ recordings/meeting-name/user@email.com/segment_0
└─ recordings/meeting-name/user@email.com/segment_1
└─ recordings/meeting-name/user@email.com/segment_2

IndexedDB State:
└─ Empty (all segments uploaded)
```

---

## 🔄 Session 2: User Rejoins Same Meeting

### Step 6: User Rejoins Meeting
```
Frontend: MeetingUI.jsx
├─ User navigates to /meeting/:meetingName again
├─ StreamVideoClient initializes
└─ Socket emits "join_meeting"

Backend: socketController.js
├─ Receives "join_meeting"
├─ Creates new session in SessionDB
├─ Checks meetingRecordingState[meetingId]
└─ Emits "joined_meeting" with { meetingId, isRecording }

Frontend: MeetingUI.jsx
├─ Receives "joined_meeting"
└─ User sees meeting UI
```

### Step 7: User Starts Recording Again
```
Frontend: MeetingUI.jsx
├─ User clicks "Record" button
├─ Socket emits "start_recording"
└─ Sets local recording state = true

Backend: socketController.js
├─ Receives "start_recording"
├─ Sets meetingRecordingState[meetingId] = true
└─ Broadcasts "start_recording" to all users

Frontend: recording.js → startRecording()
├─ Gets camera/microphone stream
├─ Checks IndexedDB for existing segments
│  └─ Query: db.chunks.where('meetingId').equals(meetingName)
│  
│  Case A: Segments Not Uploaded Yet
│  ├─ Found: [segment_0, segment_1, segment_2]
│  ├─ Max index = 2
│  └─ segmentCounter = 3 ✅ Continues from 3!
│  
│  Case B: All Segments Uploaded
│  ├─ Found: []
│  ├─ Max index = -1
│  └─ segmentCounter = 0 ⚠️ Will overwrite on Cloudinary!
│
├─ Starts MediaRecorder
└─ Begins recording from calculated segmentCounter

Recording Timeline (Case A):
3:00 - 4:00 → segment_3 saved to IndexedDB
4:00 - 5:00 → segment_4 saved to IndexedDB
5:00 - 6:00 → segment_5 saved to IndexedDB
```

### Step 8: User Leaves Meeting Again
```
Frontend: MeetingUI.jsx → handleHangup()
├─ User clicks "Leave Call" button
├─ If recording active:
│  └─ Calls saveCurrentBlobAndStop()
│     └─ Saves current segment to IndexedDB
├─ Disables camera/microphone
├─ Socket emits "leave_meeting"
├─ Leaves call
└─ Navigates to /home

Backend: socketController.js
├─ Receives "leave_meeting"
├─ Updates SessionDB (closes second session)
└─ User leaves socket room

IndexedDB State (Case A):
└─ Contains: [segment_0, segment_1, segment_2, segment_3, segment_4, segment_5]
   (6 segments total from both sessions)

IndexedDB State (Case B):
└─ Contains: [segment_0, segment_1, segment_2]
   (3 segments from second session)
   ⚠️ Will overwrite on Cloudinary when uploaded!
```

---

## 📊 Complete Data Flow Summary

### Recording Flow:
```
User Action → Socket Event → Recording Start → Segment Creation → IndexedDB Storage
```

### Upload Flow:
```
Dashboard Click → Upload Loop → Get Segments → Upload to Backend → Cloudinary Storage → Delete from IndexedDB
```

### Rejoin Flow:
```
Join Meeting → Check IndexedDB → Calculate segmentCounter → Continue Recording
```

---

## 🗂️ Data Storage at Each Stage

### During Recording (Session 1):
```
IndexedDB:
├─ segment_0 (blob, not uploaded)
├─ segment_1 (blob, not uploaded)
└─ segment_2 (blob, not uploaded)

Cloudinary:
└─ (empty)
```

### After Upload:
```
IndexedDB:
└─ (empty)

Cloudinary:
├─ recordings/meeting/user/segment_0
├─ recordings/meeting/user/segment_1
└─ recordings/meeting/user/segment_2
```

### During Recording (Session 2 - Case A: Not Uploaded):
```
IndexedDB:
├─ segment_0 (blob, not uploaded)
├─ segment_1 (blob, not uploaded)
├─ segment_2 (blob, not uploaded)
├─ segment_3 (blob, not uploaded) ← New
├─ segment_4 (blob, not uploaded) ← New
└─ segment_5 (blob, not uploaded) ← New

Cloudinary:
└─ (empty)
```

### During Recording (Session 2 - Case B: Already Uploaded):
```
IndexedDB:
├─ segment_0 (blob, not uploaded) ← New recording
├─ segment_1 (blob, not uploaded) ← New recording
└─ segment_2 (blob, not uploaded) ← New recording

Cloudinary:
├─ recordings/meeting/user/segment_0 ← From Session 1
├─ recordings/meeting/user/segment_1 ← From Session 1
└─ recordings/meeting/user/segment_2 ← From Session 1

⚠️ When uploaded, IndexedDB segments will overwrite Cloudinary!
```

---

## 🎯 Key Points

### 1. Recording is Independent of Upload
- Recording saves to IndexedDB immediately
- Upload happens separately (from dashboard)
- User can record without uploading

### 2. Segment Counter Logic
- ✅ Checks IndexedDB before starting
- ✅ Continues from max index + 1
- ⚠️ Doesn't check Cloudinary (edge case)

### 3. Upload is Asynchronous
- Happens in background from dashboard
- Up to 3 segments upload in parallel
- Deletes from IndexedDB only after success

### 4. Multiple Sessions Supported
- Each session creates new segments
- Segments accumulate in IndexedDB
- All segments eventually uploaded

### 5. Edge Case: Complete Upload Before Rejoin
- If all segments uploaded → IndexedDB empty
- Rejoin → Counter resets to 0
- New recording → Overwrites on Cloudinary
- Solution: Check Cloudinary for max index

---

## 🔧 Flow Optimization Opportunities

### Current Issues:
1. Too many console logs (as you mentioned)
2. No Cloudinary check before recording
3. 10-minute upload timeout too long
4. No automatic retry on upload failure

### Recommended Improvements:
1. Reduce logging to key events only
2. Add Cloudinary max index check
3. Reduce timeout to 2 minutes with retry
4. Add automatic upload on leave (optional)
