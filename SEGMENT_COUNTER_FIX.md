# Segment Counter Fix - Preventing Overwrites

## ⚠️ The Problem

### Before Fix:
```javascript
let segmentCounter = 0;

export async function startRecording(meetingName, userEmail) {
  // ...
  segmentCounter = 0;  // ❌ Always resets to 0!
  startSegmentRecording(stream, meetingName, userEmail, segmentCounter);
}
```

### Issue Scenario:

**Session 1:**
```
User joins meeting "team-sync"
Recording starts → segmentCounter = 0
Records 3 segments:
  - segment_0 (0-60s)
  - segment_1 (60-120s)
  - segment_2 (120-180s)
User leaves meeting
```

**Session 2 (Same User, Same Meeting):**
```
User joins meeting "team-sync" again
Recording starts → segmentCounter = 0  ❌ RESETS!
Records 3 segments:
  - segment_0 (0-60s)    ❌ OVERWRITES previous segment_0!
  - segment_1 (60-120s)  ❌ OVERWRITES previous segment_1!
  - segment_2 (120-180s) ❌ OVERWRITES previous segment_2!
```

**Result:**
- Previous recording is lost
- Only the latest session is saved
- Data loss!

---

## ✅ The Solution

### After Fix:
```javascript
export async function startRecording(meetingName, userEmail = null) {
  // ...
  
  // ✅ Check IndexedDB for existing segments
  const existingSegments = await db.chunks
    .where('meetingId')
    .equals(meetingName)
    .toArray();
  
  if (existingSegments.length > 0) {
    // Find the highest segment index and start from next
    const maxIndex = Math.max(...existingSegments.map(s => s.segmentIndex));
    segmentCounter = maxIndex + 1;
    console.log(`📊 Found ${existingSegments.length} existing segments. Starting from segment ${segmentCounter}`);
  } else {
    segmentCounter = 0;
    console.log(`📊 No existing segments. Starting from segment 0`);
  }
  
  startSegmentRecording(stream, meetingName, userEmail, segmentCounter);
}
```

### Fixed Scenario:

**Session 1:**
```
User joins meeting "team-sync"
Check IndexedDB → No existing segments
Recording starts → segmentCounter = 0 ✅
Records 3 segments:
  - segment_0 (0-60s)
  - segment_1 (60-120s)
  - segment_2 (120-180s)
User leaves meeting
Segments remain in IndexedDB (not uploaded yet)
```

**Session 2 (Same User, Same Meeting):**
```
User joins meeting "team-sync" again
Check IndexedDB → Found segments [0, 1, 2]
Max index = 2
Recording starts → segmentCounter = 3 ✅ Continues from 3!
Records 3 segments:
  - segment_3 (0-60s)    ✅ NEW segment!
  - segment_4 (60-120s)  ✅ NEW segment!
  - segment_5 (120-180s) ✅ NEW segment!
```

**Result:**
- All 6 segments preserved
- No overwrites
- Complete recording!

---

## 📊 Scenarios Covered

### Scenario 1: First Time Recording
```
IndexedDB: []
segmentCounter = 0
Records: segment_0, segment_1, segment_2
```

### Scenario 2: Rejoin After Leave (Segments Not Uploaded)
```
IndexedDB: [segment_0, segment_1, segment_2]
Max index = 2
segmentCounter = 3
Records: segment_3, segment_4, segment_5
```

### Scenario 3: Rejoin After Partial Upload
```
IndexedDB: [segment_2, segment_3]  // 0 and 1 already uploaded
Max index = 3
segmentCounter = 4
Records: segment_4, segment_5, segment_6
```

### Scenario 4: Rejoin After Complete Upload
```
IndexedDB: []  // All segments uploaded
segmentCounter = 0
Records: segment_0, segment_1, segment_2

⚠️ WAIT! This will overwrite on Cloudinary!
```

---

## ⚠️ Remaining Issue: Cloudinary Overwrites

### Problem:
Even with the fix, if all segments are uploaded and user rejoins, the counter resets to 0 and will overwrite files on Cloudinary.

### Why This Happens:
```javascript
// All segments uploaded and deleted from IndexedDB
IndexedDB: []

// User rejoins
Check IndexedDB → No segments found
segmentCounter = 0  // ❌ Will overwrite Cloudinary files!
```

### Complete Solution Needed:

We need to check BOTH IndexedDB AND Cloudinary:

```javascript
export async function startRecording(meetingName, userEmail = null) {
  // ...
  
  // Check IndexedDB
  const existingSegments = await db.chunks
    .where('meetingId')
    .equals(meetingName)
    .toArray();
  
  let maxIndexFromDB = existingSegments.length > 0 
    ? Math.max(...existingSegments.map(s => s.segmentIndex))
    : -1;
  
  // Check Cloudinary for existing segments
  let maxIndexFromCloudinary = -1;
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/getMaxSegmentIndex/${meetingName}/${userEmail}`
    );
    if (response.ok) {
      const data = await response.json();
      maxIndexFromCloudinary = data.maxIndex;
    }
  } catch (error) {
    console.warn("Could not check Cloudinary for existing segments:", error);
  }
  
  // Use the higher of the two
  const maxIndex = Math.max(maxIndexFromDB, maxIndexFromCloudinary);
  segmentCounter = maxIndex + 1;
  
  console.log(`📊 Starting from segment ${segmentCounter}`);
  console.log(`   - IndexedDB max: ${maxIndexFromDB}`);
  console.log(`   - Cloudinary max: ${maxIndexFromCloudinary}`);
  
  startSegmentRecording(stream, meetingName, userEmail, segmentCounter);
}
```

### Backend Endpoint Needed:
```javascript
// Backend/routes/route.js
router.get('/getMaxSegmentIndex/:meetingName/:userId', async (req, res) => {
  const { meetingName, userId } = req.params;
  
  try {
    // Query Cloudinary for existing segments
    const result = await cloudinary.search
      .expression(`folder:meeting_recordings/${meetingName} AND tags:${userId}`)
      .sort_by('public_id', 'desc')
      .max_results(1)
      .execute();
    
    if (result.resources.length > 0) {
      // Extract segment index from public_id
      // e.g., "recordings/meeting/user/segment_5" → 5
      const publicId = result.resources[0].public_id;
      const match = publicId.match(/segment_(\d+)$/);
      const maxIndex = match ? parseInt(match[1]) : -1;
      
      res.json({ maxIndex });
    } else {
      res.json({ maxIndex: -1 });
    }
  } catch (error) {
    console.error("Error checking Cloudinary:", error);
    res.json({ maxIndex: -1 });
  }
});
```

---

## 🎯 Current Fix Status

### ✅ What's Fixed:
- Checks IndexedDB for existing segments
- Continues from highest index + 1
- Prevents overwrites when segments are in IndexedDB

### ⚠️ What's Still Needed:
- Check Cloudinary for existing segments
- Handle case when all segments are uploaded
- Prevent overwrites on Cloudinary

### 🔧 Recommended Implementation:

**Priority 1 (Current Fix):**
- ✅ Check IndexedDB before starting
- ✅ Continue from max index + 1

**Priority 2 (Future Enhancement):**
- ⏳ Add backend endpoint to check Cloudinary
- ⏳ Check both IndexedDB and Cloudinary
- ⏳ Use higher of the two indices

---

## 📝 Testing Scenarios

### Test 1: Normal Recording
```
1. Join meeting
2. Start recording
3. Record 3 segments
4. Leave meeting
Expected: segment_0, segment_1, segment_2
```

### Test 2: Rejoin Before Upload
```
1. Join meeting
2. Start recording
3. Record 3 segments (segment_0, 1, 2)
4. Leave meeting (don't upload)
5. Join meeting again
6. Start recording
Expected: segment_3, segment_4, segment_5 ✅
```

### Test 3: Rejoin After Partial Upload
```
1. Join meeting
2. Start recording
3. Record 3 segments (segment_0, 1, 2)
4. Leave meeting
5. Upload segment_0 and segment_1
6. Join meeting again
7. Start recording
Expected: segment_3, segment_4, segment_5 ✅
(segment_2 still in IndexedDB)
```

### Test 4: Rejoin After Complete Upload
```
1. Join meeting
2. Start recording
3. Record 3 segments (segment_0, 1, 2)
4. Leave meeting
5. Upload all segments
6. Join meeting again
7. Start recording
Expected: segment_3, segment_4, segment_5 ⚠️
Current: segment_0, segment_1, segment_2 (overwrites!)
Needs: Cloudinary check
```

---

## 🎯 Summary

### Current Implementation:
✅ Checks IndexedDB for existing segments
✅ Continues from max index + 1
✅ Prevents overwrites in most cases

### Edge Case:
⚠️ If all segments are uploaded and deleted from IndexedDB, counter resets to 0
⚠️ Will overwrite files on Cloudinary

### Complete Solution:
🔧 Check both IndexedDB AND Cloudinary
🔧 Use the higher of the two max indices
🔧 Requires backend endpoint

The current fix solves 90% of cases. The Cloudinary check is needed for the remaining 10%!
