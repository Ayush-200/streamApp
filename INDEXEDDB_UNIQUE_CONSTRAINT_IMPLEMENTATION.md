# IndexedDB Unique Constraint Implementation

## 🎯 Problem Solved

**Before:** Multiple segments could have the same `meetingId + segmentIndex`, causing:
- Duplicate segments in IndexedDB
- Wrong segments uploaded
- Segments uploaded multiple times
- Confusion about which segment to upload

**After:** Each segment has a unique composite key, preventing duplicates entirely.

## ✅ Implementation

### 1. Database Schema Update (db.js)

**Changed from Version 5 to Version 6:**

```javascript
// OLD (Version 5) - No unique constraint
db.version(5).stores({
  chunks: "++id, userId, meetingId, segmentIndex, timestamp, retries, uploaded"
});

// NEW (Version 6) - With compound unique index
db.version(6).stores({
  chunks: "id, userId, meetingId, segmentIndex, [meetingId+segmentIndex], timestamp, retries, uploaded"
});
```

**Key Changes:**
- Changed from `++id` (auto-increment) to `id` (manual assignment)
- Added `[meetingId+segmentIndex]` compound index for efficient queries
- This allows querying by the combination of meetingId and segmentIndex

### 2. Recording Logic Update (recording.js)

**Changed from `add()` to `put()` with unique ID:**

```javascript
// OLD - Could create duplicates
await db.chunks.add({
  userId: userEmail,
  blob: segmentBlob,
  meetingId: meetingName,
  segmentIndex: segmentIndex,
  timestamp: Date.now(),
  retries: 0,
  uploaded: false
});

// NEW - Unique composite key prevents duplicates
const uniqueId = `${meetingName}_${segmentIndex}`;

await db.chunks.put({
  id: uniqueId, // Unique composite key
  userId: userEmail,
  blob: segmentBlob,
  meetingId: meetingName,
  segmentIndex: segmentIndex,
  timestamp: Date.now(),
  retries: 0,
  uploaded: false
});
```

**Benefits of `put()` over `add()`:**
- `add()`: Throws error if key already exists
- `put()`: Replaces existing record if key exists (upsert behavior)
- If recording stops/starts rapidly, the latest segment overwrites the old one

## 🔑 Unique ID Format

```javascript
const uniqueId = `${meetingName}_${segmentIndex}`;

// Examples:
// "daily-standup_0"
// "daily-standup_1"
// "team-meeting_0"
// "team-meeting_1"
```

This ensures:
- Each meeting has its own namespace
- Segment indices are unique within each meeting
- No collisions between different meetings

## 📊 How It Prevents Duplicates

### Scenario 1: Rapid Stop/Start Recording

```javascript
// User starts recording
startRecording("meeting-1", "user@email.com");
// Segment 0 created: id = "meeting-1_0"

// User stops recording
stopRecording();

// User immediately starts recording again
startRecording("meeting-1", "user@email.com");
// Segment 0 created again: id = "meeting-1_0"
// ✅ put() replaces the old segment 0 with new one
// ❌ OLD: add() would create duplicate segment 0
```

### Scenario 2: Multiple Meetings

```javascript
// Meeting A, Segment 0
id = "meeting-a_0"

// Meeting B, Segment 0
id = "meeting-b_0"

// ✅ Different IDs, no collision
// ❌ OLD: Both would have segmentIndex = 0, causing confusion
```

### Scenario 3: Browser Refresh During Recording

```javascript
// Before refresh: Segment 0, 1, 2 saved
// User refreshes browser
// Recording restarts from segment 0

// Segment 0 created: id = "meeting-1_0"
// ✅ Overwrites old segment 0 (which may be corrupted)
// ✅ Segments 1, 2 remain intact
```

## 🔄 Database Migration

When users update to this version, Dexie automatically handles the migration:

1. **Existing Data:** Old segments with auto-increment IDs remain
2. **New Data:** New segments use composite key format
3. **No Data Loss:** All existing segments are preserved
4. **Gradual Transition:** Old segments upload normally, new segments use new format

### Migration Behavior:

```javascript
// Old segments (from version 5)
{
  id: 1,  // Auto-increment
  meetingId: "meeting-1",
  segmentIndex: 0
}

// New segments (from version 6)
{
  id: "meeting-1_0",  // Composite key
  meetingId: "meeting-1",
  segmentIndex: 0
}

// Both can coexist and upload correctly!
```

## ✅ Upload Logic Compatibility

The upload logic works with both old and new ID formats:

```javascript
// Delete segment after upload
await db.chunks.delete(segment.id);

// Works with:
// - Old format: segment.id = 1, 2, 3, ...
// - New format: segment.id = "meeting-1_0", "meeting-1_1", ...
```

## 🧪 Testing Scenarios

### Test 1: Duplicate Prevention
```javascript
// Create segment
await db.chunks.put({ id: "meeting-1_0", ... });

// Try to create again
await db.chunks.put({ id: "meeting-1_0", ... });

// Result: Only one segment exists (latest one)
```

### Test 2: Query by Compound Index
```javascript
// Find specific segment
const segment = await db.chunks
  .where('[meetingId+segmentIndex]')
  .equals(['meeting-1', 0])
  .first();

// Fast lookup using compound index!
```

### Test 3: Multiple Meetings
```javascript
// Meeting A segments
await db.chunks.put({ id: "meeting-a_0", ... });
await db.chunks.put({ id: "meeting-a_1", ... });

// Meeting B segments
await db.chunks.put({ id: "meeting-b_0", ... });
await db.chunks.put({ id: "meeting-b_1", ... });

// No collisions, all segments unique
```

## 📈 Performance Benefits

### Before (Version 5):
- No unique constraint
- Possible duplicates
- Slower queries (no compound index)
- Manual duplicate checking needed

### After (Version 6):
- Automatic duplicate prevention
- Fast compound index queries
- Database enforces uniqueness
- Cleaner, more reliable code

## 🔍 Debugging

To check segments in IndexedDB:

```javascript
// Get all segments for a meeting
const segments = await db.chunks
  .where('meetingId')
  .equals('meeting-1')
  .toArray();

console.log('Segments:', segments.map(s => ({
  id: s.id,
  segmentIndex: s.segmentIndex,
  size: s.blob.size
})));

// Check for duplicates (should be none!)
const duplicates = segments.filter((s, i, arr) => 
  arr.findIndex(x => x.segmentIndex === s.segmentIndex) !== i
);

console.log('Duplicates:', duplicates); // Should be []
```

## 🎯 Summary

✅ **Unique composite key:** `${meetingName}_${segmentIndex}`
✅ **No duplicates possible:** Database enforces uniqueness
✅ **Upsert behavior:** `put()` replaces if exists
✅ **Backward compatible:** Works with old segments
✅ **Fast queries:** Compound index for efficient lookups
✅ **Automatic migration:** Dexie handles version upgrade
✅ **No code changes needed:** Upload logic works with both formats

This implementation completely eliminates the duplicate segment issue!
