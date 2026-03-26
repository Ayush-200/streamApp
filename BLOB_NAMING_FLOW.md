# Blob Naming Flow - Complete Documentation

## 📊 Complete Naming Flow

### Step 1: Recording (Frontend)
**Location:** `Frontend/my_meeting_app/src/utils/recording.js`

When a segment is recorded, it's saved to IndexedDB with metadata:

```javascript
await db.chunks.add({
  userId: userEmail,                    // e.g., "user@example.com"
  blob: segmentBlob,                    // The actual video blob
  meetingId: meetingName,               // e.g., "daily-standup-2024"
  segmentIndex: segmentIndex,           // e.g., 0, 1, 2, 3...
  timestamp: Date.now(),
  retries: 0,
  uploaded: false
});
```

**At this stage:**
- Blob has NO name yet
- Just stored in IndexedDB with metadata
- `segmentIndex` is the key identifier (0, 1, 2, 3...)

---

### Step 2: Upload Preparation (Frontend)
**Location:** `Frontend/my_meeting_app/src/utils/uploadSegment.js`

When uploading, the blob is converted to a File object with a name:

```javascript
const file = new File([segment.blob], `segment-${segmentIndex}.webm`, {
  type: 'video/webm'
});
```

**Naming Pattern:**
```
segment-0.webm
segment-1.webm
segment-2.webm
segment-3.webm
...
```

**Example:**
- Segment 0 → `segment-0.webm`
- Segment 5 → `segment-5.webm`
- Segment 42 → `segment-42.webm`

---

### Step 3: FormData Creation (Frontend)
**Location:** `Frontend/my_meeting_app/src/utils/uploadSegment.js`

The file is added to FormData with additional metadata:

```javascript
const formData = new FormData();
formData.append("file", file);              // segment-0.webm
formData.append("userId", userEmail);       // user@example.com
formData.append("chunkIndex", segmentIndex); // 0
```

**What's sent to backend:**
```
file: segment-0.webm (binary data)
userId: "user@example.com"
chunkIndex: "0"
```

---

### Step 4: Backend Receives (Backend)
**Location:** `Backend/utils/uploadBlob.js`

Multer processes the upload:

```javascript
const { meetingId } = req.params;        // From URL: /uploadSegment/:meetingId
const { userId, chunkIndex } = req.body; // From FormData
const blob = req.file;                   // Multer file object

console.log("originalname:", blob.originalname); // "segment-0.webm"
console.log("mimetype:", blob.mimetype);         // "video/webm"
console.log("size:", blob.size);                 // File size in bytes
```

**Multer file object:**
```javascript
{
  originalname: "segment-0.webm",
  mimetype: "video/webm",
  size: 1234567,
  buffer: <Buffer ...>
}
```

---

### Step 5: Cloudinary Upload (Backend)
**Location:** `Backend/utils/uploadBlob.js`

The blob is uploaded to Cloudinary with a structured path:

```javascript
const result = await cloudinary.uploader.upload_large(
    base64Data,
    {
        resource_type: "video",
        format: "webm",
        upload_preset: "THIS_IS_MY_PRESET",
        public_id: `recordings/${meetingId}/${userId}/segment_${chunkIndex}`,
        tags: [meetingId, userId],
        folder: `meeting_recordings/${meetingId}`,
        chunk_size: 6000000,
        timeout: 600000
    }
);
```

**Cloudinary Naming Structure:**

```
public_id: recordings/{meetingId}/{userId}/segment_{chunkIndex}
folder: meeting_recordings/{meetingId}
```

**Example:**
```
meetingId: "daily-standup-2024"
userId: "user@example.com"
chunkIndex: 0

public_id: recordings/daily-standup-2024/user@example.com/segment_0
folder: meeting_recordings/daily-standup-2024
```

**Full Cloudinary Path:**
```
meeting_recordings/daily-standup-2024/recordings/daily-standup-2024/user@example.com/segment_0
```

**Cloudinary URL:**
```
https://res.cloudinary.com/your-cloud/video/upload/v1234567890/meeting_recordings/daily-standup-2024/recordings/daily-standup-2024/user@example.com/segment_0.webm
```

---

## 🗂️ Complete Example

### Scenario: User records a 3-minute meeting

**Meeting Details:**
- Meeting ID: `team-sync-march-25`
- User Email: `john.doe@company.com`
- Recording Duration: 3 minutes
- Segments: 3 (60 seconds each)

### Naming at Each Stage:

#### Stage 1: IndexedDB (Frontend)
```javascript
// Segment 0
{
  id: 1,
  userId: "john.doe@company.com",
  meetingId: "team-sync-march-25",
  segmentIndex: 0,
  blob: <Blob>,
  timestamp: 1711363200000
}

// Segment 1
{
  id: 2,
  userId: "john.doe@company.com",
  meetingId: "team-sync-march-25",
  segmentIndex: 1,
  blob: <Blob>,
  timestamp: 1711363260000
}

// Segment 2
{
  id: 3,
  userId: "john.doe@company.com",
  meetingId: "team-sync-march-25",
  segmentIndex: 2,
  blob: <Blob>,
  timestamp: 1711363320000
}
```

#### Stage 2: File Objects (Frontend Upload)
```javascript
segment-0.webm  // Segment 0
segment-1.webm  // Segment 1
segment-2.webm  // Segment 2
```

#### Stage 3: Cloudinary (Backend)
```
Public IDs:
- recordings/team-sync-march-25/john.doe@company.com/segment_0
- recordings/team-sync-march-25/john.doe@company.com/segment_1
- recordings/team-sync-march-25/john.doe@company.com/segment_2

Folders:
- meeting_recordings/team-sync-march-25/

Full Paths:
- meeting_recordings/team-sync-march-25/recordings/team-sync-march-25/john.doe@company.com/segment_0.webm
- meeting_recordings/team-sync-march-25/recordings/team-sync-march-25/john.doe@company.com/segment_1.webm
- meeting_recordings/team-sync-march-25/recordings/team-sync-march-25/john.doe@company.com/segment_2.webm
```

#### Stage 4: Cloudinary URLs
```
https://res.cloudinary.com/your-cloud/video/upload/v1711363200/meeting_recordings/team-sync-march-25/recordings/team-sync-march-25/john.doe@company.com/segment_0.webm

https://res.cloudinary.com/your-cloud/video/upload/v1711363260/meeting_recordings/team-sync-march-25/recordings/team-sync-march-25/john.doe@company.com/segment_1.webm

https://res.cloudinary.com/your-cloud/video/upload/v1711363320/meeting_recordings/team-sync-march-25/recordings/team-sync-march-25/john.doe@company.com/segment_2.webm
```

---

## 🔍 Naming Components Breakdown

### Frontend File Name
```
segment-{segmentIndex}.webm
```
- **Purpose:** Temporary name for upload
- **Format:** `segment-0.webm`, `segment-1.webm`, etc.
- **Used:** Only during HTTP upload
- **Not stored:** Cloudinary ignores this name

### Cloudinary Public ID
```
recordings/{meetingId}/{userId}/segment_{chunkIndex}
```
- **Purpose:** Unique identifier in Cloudinary
- **Components:**
  - `recordings/` - Base path
  - `{meetingId}` - Meeting identifier
  - `{userId}` - User email
  - `segment_{chunkIndex}` - Segment number

### Cloudinary Folder
```
meeting_recordings/{meetingId}
```
- **Purpose:** Organize videos by meeting
- **Components:**
  - `meeting_recordings/` - Base folder
  - `{meetingId}` - Meeting identifier

### Full Cloudinary Path
```
{folder}/{public_id}.{format}
```
- **Example:**
  ```
  meeting_recordings/team-sync-march-25/recordings/team-sync-march-25/john.doe@company.com/segment_0.webm
  ```

---

## 📝 Key Points

### 1. **Segment Index is Critical**
- Used consistently across all stages
- Determines upload order
- Part of Cloudinary public_id
- Must be unique per meeting

### 2. **Meeting ID is the Primary Grouping**
- Used in Cloudinary folder
- Used in public_id path
- Allows filtering by meeting
- Enables per-meeting operations

### 3. **User ID for Multi-User Support**
- Each user's segments stored separately
- Allows multiple users recording same meeting
- Part of public_id path
- Enables per-user filtering

### 4. **File Extension**
- Always `.webm` (WebM format)
- Set in frontend: `type: 'video/webm'`
- Set in backend: `format: "webm"`
- Cloudinary adds extension automatically

---

## 🎯 Naming Best Practices

### ✅ Good Naming (Current Implementation)
```
recordings/team-sync-march-25/john.doe@company.com/segment_0
recordings/team-sync-march-25/john.doe@company.com/segment_1
recordings/team-sync-march-25/john.doe@company.com/segment_2
```

**Benefits:**
- Hierarchical structure
- Easy to filter by meeting
- Easy to filter by user
- Sequential ordering
- No naming conflicts

### ❌ Bad Naming (Avoid)
```
segment_0
segment_1
segment_2
```

**Problems:**
- No meeting context
- No user context
- Naming conflicts between meetings
- Can't filter or organize

---

## 🔧 Customization Options

### Option 1: Add Timestamp to Name
```javascript
public_id: `recordings/${meetingId}/${userId}/segment_${chunkIndex}_${Date.now()}`
```
**Result:** `segment_0_1711363200000`

### Option 2: Add Date to Folder
```javascript
folder: `meeting_recordings/${new Date().toISOString().split('T')[0]}/${meetingId}`
```
**Result:** `meeting_recordings/2024-03-25/team-sync-march-25/`

### Option 3: Use UUID Instead of Index
```javascript
import { v4 as uuidv4 } from 'uuid';
public_id: `recordings/${meetingId}/${userId}/${uuidv4()}`
```
**Result:** `segment_a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## 📊 Summary

| Stage | Location | Name Format | Example |
|-------|----------|-------------|---------|
| Recording | IndexedDB | No name (just index) | `segmentIndex: 0` |
| Upload Prep | Frontend | `segment-{index}.webm` | `segment-0.webm` |
| HTTP Upload | Network | `segment-{index}.webm` | `segment-0.webm` |
| Cloudinary | Cloud | `recordings/{meeting}/{user}/segment_{index}` | `recordings/team-sync/user@email.com/segment_0` |
| Final URL | Public | Full path + extension | `https://...segment_0.webm` |

The naming is **hierarchical, organized, and scalable** for production use! 🎉
