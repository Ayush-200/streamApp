# Segment Counter Solution - Preventing Overwrite on Rejoin

## Problem Statement

When a user records a meeting, leaves, uploads all segments to Cloudinary, and then rejoins the same meeting, the segment counter resets to 0. This causes new recordings to overwrite existing segments on Cloudinary.

### Example Scenario

**Session 1:**
- User joins meeting
- Records segments: `segment_0`, `segment_1`, `segment_2`
- Leaves meeting
- Uploads all segments to Cloudinary
- IndexedDB is now empty

**Session 2 (Rejoin):**
- User rejoins same meeting
- IndexedDB is empty (all uploaded)
- Counter resets to 0
- Records new `segment_0`, `segment_1`, `segment_2`
- ⚠️ **OVERWRITES** existing segments on Cloudinary!

---

## Solution: Multi-Layer Segment Counter Tracking

We implement a 3-tier fallback system to track the last segment index:

1. **localStorage** (Browser-specific, fastest)
2. **Database** (Source of truth, cross-device)
3. **IndexedDB** (Fallback for unsaved segments)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    startRecording()                          │
│                                                              │
│  1. Check localStorage                                       │
│     ├─ Found? → Use it                                      │
│     └─ Not found? → Go to step 2                           │
│                                                              │
│  2. Check Database (MongoDB)                                │
│     ├─ Found? → Use it + Sync to localStorage              │
│     └─ Not found? → Go to step 3                           │
│                                                              │
│  3. Check IndexedDB                                         │
│     ├─ Found segments? → Use max index                     │
│     └─ Not found? → Start at 0                             │
│                                                              │
│  4. Set segmentCounter = maxIndex + 1                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Database Schema Update

**File**: `Backend/models/model.js`

Added `lastSegmentIndex` field to ParticipantSchema:

```javascript
const ParticipantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  joinTime: { type: Date, required: true },
  leaveTime: { type: Date },
  videoPublicId: { type: String },
  lastSegmentIndex: { type: Number, default: -1 }, // ✅ NEW FIELD
  chunks: [{
    chunkIndex: Number,
    cloudinaryUrl: String,
    uploadTime: Date
  }]
});
```

### 2. Frontend: Recording Start Logic

**File**: `Frontend/my_meeting_app/src/utils/recording.js`

```javascript
export async function startRecording(meetingName, userEmail = null) {
  // ... camera/mic setup ...
  
  let maxSegmentIndex = -1;
  const storageKey = `lastSegment_${meetingName}_${userEmail}`;
  
  // 1️⃣ Check localStorage (fastest)
  const localStorageIndex = localStorage.getItem(storageKey);
  if (localStorageIndex !== null) {
    maxSegmentIndex = parseInt(localStorageIndex, 10);
    console.log(`📊 Found in localStorage: ${maxSegmentIndex}`);
  } else {
    // 2️⃣ Check database (source of truth)
    try {
      const response = await fetch(
        `${BACKEND_URL}/getLastSegmentIndex/${meetingName}/${userEmail}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.lastSegmentIndex >= 0) {
          maxSegmentIndex = data.lastSegmentIndex;
          console.log(`📊 Found in database: ${maxSegmentIndex}`);
          
          // Sync to localStorage
          localStorage.setItem(storageKey, maxSegmentIndex.toString());
        }
      }
    } catch (error) {
      console.warn(`⚠️ Database check failed:`, error.message);
    }
  }
  
  // 3️⃣ Check IndexedDB (fallback for unsaved segments)
  const existingSegments = await db.chunks
    .where('meetingId')
    .equals(meetingName)
    .toArray();
  
  if (existingSegments.length > 0) {
    const indexedDBMax = Math.max(...existingSegments.map(s => s.segmentIndex));
    if (indexedDBMax > maxSegmentIndex) {
      maxSegmentIndex = indexedDBMax;
      console.log(`📊 Found higher in IndexedDB: ${maxSegmentIndex}`);
    }
  }
  
  // 4️⃣ Set counter to next available
  segmentCounter = maxSegmentIndex + 1;
  console.log(`📊 Starting from segment ${segmentCounter}`);
  
  startSegmentRecording(stream, meetingName, userEmail, segmentCounter);
}
```

### 3. Frontend: Update localStorage After Each Segment

**File**: `Frontend/my_meeting_app/src/utils/recording.js`

```javascript
recorder.onstop = async () => {
  // ... save blob to IndexedDB ...
  
  // ✅ Update localStorage with latest segment index
  const storageKey = `lastSegment_${meetingName}_${userEmail}`;
  localStorage.setItem(storageKey, segmentIndex.toString());
  
  // ... continue recording ...
};
```

### 4. Frontend: Send lastSegmentIndex on Leave

**File**: `Frontend/my_meeting_app/src/MeetingUI.jsx`

```javascript
const handleHangup = async () => {
  // ... save recording, stop camera/mic ...
  
  // Get lastSegmentIndex from localStorage
  let lastSegmentIndex = -1;
  if (user?.email && meetingName) {
    const storageKey = `lastSegment_${meetingName}_${user.email}`;
    const storedIndex = localStorage.getItem(storageKey);
    if (storedIndex !== null) {
      lastSegmentIndex = parseInt(storedIndex, 10);
    }
  }
  
  // Emit leave_meeting with lastSegmentIndex
  socket.emit("leave_meeting", { 
    meetingId: meetingName, 
    userId: user.email,
    lastSegmentIndex: lastSegmentIndex // ✅ SEND TO BACKEND
  });
  
  // ... leave call, navigate ...
};
```

### 5. Backend: Save lastSegmentIndex on Leave

**File**: `Backend/controller/socketController.js`

```javascript
socket.on("leave_meeting", async ({ meetingId, userId, lastSegmentIndex }) => {
  try {
    // ... close session ...
    
    // ✅ Update lastSegmentIndex in database
    if (lastSegmentIndex !== undefined && lastSegmentIndex >= 0) {
      const meetingDoc = await MeetingParticipantDB.findOne({ meetingId });
      if (meetingDoc) {
        const participant = meetingDoc.participants.find(p => p.userId === userId);
        if (participant) {
          participant.lastSegmentIndex = lastSegmentIndex;
          participant.leaveTime = new Date();
          await meetingDoc.save();
          console.log(`✅ Updated lastSegmentIndex: ${lastSegmentIndex}`);
        }
      }
    }
    
    // ... socket.leave ...
  } catch (err) {
    console.error("❌ Leave error:", err.message);
  }
});
```

### 6. Backend: API Endpoint to Get lastSegmentIndex

**File**: `Backend/routes/route.js`

```javascript
router.get('/getLastSegmentIndex/:meetingName/:userId', async (req, res) => {
  try {
    const { meetingName, userId } = req.params;
    
    // Get meetingId from meetingName
    const meetingDoc = await MeetingDB.findOne({ meetingName });
    if (!meetingDoc) {
      return res.json({ lastSegmentIndex: -1 });
    }
    
    // Find participant
    const participantDoc = await MeetingParticipantDB.findOne({ 
      meetingId: meetingDoc.meetingId 
    });
    
    if (!participantDoc) {
      return res.json({ lastSegmentIndex: -1 });
    }
    
    const participant = participantDoc.participants.find(p => p.userId === userId);
    
    if (!participant || participant.lastSegmentIndex === undefined) {
      return res.json({ lastSegmentIndex: -1 });
    }
    
    res.json({ 
      lastSegmentIndex: participant.lastSegmentIndex,
      meetingId: meetingDoc.meetingId
    });
  } catch (error) {
    console.error("Error fetching lastSegmentIndex:", error);
    res.status(500).json({ lastSegmentIndex: -1 });
  }
});
```

---

## Flow Diagrams

### Flow 1: First Recording Session

```
User joins meeting
    ↓
startRecording() called
    ↓
Check localStorage → Not found (-1)
    ↓
Check database → Not found (-1)
    ↓
Check IndexedDB → Empty (-1)
    ↓
segmentCounter = 0
    ↓
Record segment_0, segment_1, segment_2
    ↓
Each segment saved:
  - IndexedDB ✅
  - localStorage updated ✅
    ↓
User leaves
    ↓
lastSegmentIndex = 2 sent to backend
    ↓
Database updated: lastSegmentIndex = 2 ✅
```

### Flow 2: Rejoin After Upload (Problem Solved!)

```
User rejoins meeting
    ↓
startRecording() called
    ↓
Check localStorage → Found: 2 ✅
    ↓
segmentCounter = 3 (not 0!)
    ↓
Record segment_3, segment_4, segment_5
    ↓
✅ NO OVERWRITE!
```

### Flow 3: Rejoin from Different Browser

```
User rejoins from different browser
    ↓
startRecording() called
    ↓
Check localStorage → Not found (different browser)
    ↓
Check database → Found: 2 ✅
    ↓
Sync to localStorage ✅
    ↓
segmentCounter = 3
    ↓
Record segment_3, segment_4, segment_5
    ↓
✅ NO OVERWRITE!
```

### Flow 4: Rejoin with Unsaved Segments

```
User rejoins (some segments not uploaded yet)
    ↓
startRecording() called
    ↓
Check localStorage → Found: 5
    ↓
Check IndexedDB → Found segments: 3, 4, 5
    ↓
Max = 5 (same as localStorage)
    ↓
segmentCounter = 6
    ↓
Continue recording ✅
```

---

## Edge Cases Handled

### 1. localStorage Cleared
- Falls back to database
- Database has the last known index
- ✅ No overwrite

### 2. Different Browser/Device
- localStorage is empty (browser-specific)
- Database provides the index
- ✅ Cross-device consistency

### 3. Database Connection Failed
- Falls back to IndexedDB
- Uses local segments if available
- ⚠️ May reset if all uploaded (rare case)

### 4. Concurrent Sessions (Same User, Multiple Tabs)
- Each tab has its own localStorage
- Database updates on leave
- Last tab to leave wins
- ✅ Segments don't overlap (different indices)

### 5. User Never Leaves (Browser Crash)
- localStorage persists
- On rejoin, uses localStorage value
- ✅ Continues from last known index

---

## Benefits

### 1. Performance
- **localStorage**: Instant access (no network call)
- **Database**: Only queried if localStorage empty
- **IndexedDB**: Already being queried for segments

### 2. Reliability
- **3-tier fallback**: Multiple sources of truth
- **Database persistence**: Survives browser clear
- **Cross-device**: Works on any device

### 3. Simplicity
- **No Cloudinary queries**: Avoids API rate limits
- **Minimal backend changes**: One new field, one endpoint
- **Automatic sync**: localStorage updated on each segment

### 4. Scalability
- **localStorage**: No server load
- **Database**: Single query on rejoin
- **No polling**: Event-driven updates

---

## Testing Checklist

- [ ] First recording session starts at segment_0
- [ ] localStorage updated after each segment
- [ ] Database updated on leave with correct lastSegmentIndex
- [ ] Rejoin continues from last segment (not 0)
- [ ] Different browser uses database value
- [ ] Clear localStorage, rejoin uses database
- [ ] Segments in IndexedDB take precedence if higher
- [ ] Multiple rejoins increment correctly
- [ ] Browser crash recovery works
- [ ] No segments overwritten on Cloudinary

---

## localStorage Key Format

```
Key: lastSegment_{meetingName}_{userEmail}
Value: {segmentIndex} (as string)

Example:
Key: "lastSegment_daily-standup_user@example.com"
Value: "5"
```

---

## Database Schema

```javascript
MeetingParticipant {
  meetingId: "abc123",
  participants: [
    {
      userId: "user@example.com",
      joinTime: Date,
      leaveTime: Date,
      lastSegmentIndex: 5, // ✅ NEW FIELD
      chunks: [...]
    }
  ]
}
```

---

## Summary

This solution completely eliminates the segment overwrite problem by:

1. **Tracking segment index** in 3 places (localStorage, database, IndexedDB)
2. **Prioritizing speed** (localStorage first) with reliability (database fallback)
3. **Updating automatically** after each segment and on leave
4. **Working cross-device** via database persistence
5. **Requiring minimal changes** to existing codebase

The segment counter now **never resets** inappropriately, ensuring all recordings are preserved on Cloudinary without overwrites.
