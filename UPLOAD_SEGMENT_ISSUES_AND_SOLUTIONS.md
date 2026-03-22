# Upload Segment Issues & Solutions

## 🚨 CRITICAL ISSUES

### 1. **Race Condition: Multiple Meetings Upload Collision**

**Problem:**
```javascript
// In uploadSegment.js
let activeUploads = new Set(); // Tracks by segmentIndex only!

// Meeting A: segment 0, 1, 2
// Meeting B: segment 0, 1, 2
// Both tracked as just: Set(0, 1, 2)
```

**Issue:**
- If uploading from multiple meetings simultaneously, segment indices collide
- Meeting A segment 0 blocks Meeting B segment 0
- Wrong segments marked as "uploading"

**Impact:**
- Segments from different meetings interfere with each other
- Upload loops stop prematurely
- Some segments never upload

**Solution:**
```javascript
// Track by meetingId + segmentIndex
let activeUploads = new Set(); // Store "meetingId:segmentIndex"

export async function uploadOldestSegment(meetingId, userEmail) {
  // ... existing code ...
  
  // Filter using composite key
  const availableSegments = allSegments.filter(s => 
    !activeUploads.has(`${meetingId}:${s.segmentIndex}`)
  );
  
  // ... rest of code
}

async function uploadSingleSegment(segment, meetingId, userEmail) {
  const uploadKey = `${meetingId}:${segment.segmentIndex}`;
  
  // Mark as being uploaded with composite key
  activeUploads.add(uploadKey);
  
  try {
    // ... upload logic ...
  } finally {
    // Remove from active uploads
    activeUploads.delete(uploadKey);
  }
}
```

---

### 2. **Race Condition: Multiple Upload Loops for Same Meeting**

**Problem:**
```javascript
// In Home.jsx
const handleUploadToggle = async (meetingName, e) => {
  uploadingMeetingsRef.current[meetingName] = true;
  startUploadLoop(meetingName, meetingId); // No check if already running!
}
```

**Issue:**
- User clicks play button multiple times
- Multiple loops start for same meeting
- All loops try to upload same segments
- Race condition on IndexedDB reads/deletes

**Impact:**
- Duplicate uploads to Cloudinary (wasted bandwidth/storage)
- Segments deleted while being uploaded by another loop
- Upload errors and failures

**Solution:**
```javascript
// Track running loops
const runningLoops = useRef(new Set());

const handleUploadToggle = async (meetingName, e) => {
  e.stopPropagation();
  
  const isCurrentlyUploading = uploadingMeetingsRef.current[meetingName];
  
  if (isCurrentlyUploading) {
    // Pause upload
    uploadingMeetingsRef.current[meetingName] = false;
    setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
    console.log(`⏸️ Paused upload for meeting: ${meetingName}`);
  } else {
    // Check if loop already running
    if (runningLoops.current.has(meetingName)) {
      console.log(`⚠️ Upload loop already running for: ${meetingName}`);
      return;
    }
    
    // Start/Resume upload
    uploadingMeetingsRef.current[meetingName] = true;
    setUploadingMeetings(prev => ({ ...prev, [meetingName]: true }));
    console.log(`▶️ Starting upload for meeting: ${meetingName}`);
    
    try {
      const meetingId = await getMeetingIdFromName(meetingName);
      await startUploadLoop(meetingName, meetingId);
    } catch (error) {
      console.error(`Failed to start upload for ${meetingName}:`, error);
      uploadingMeetingsRef.current[meetingName] = false;
      setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
    }
  }
};

const startUploadLoop = async (meetingName, meetingId) => {
  // Mark loop as running
  runningLoops.current.add(meetingName);
  
  try {
    console.log("🔄 [UPLOAD_LOOP] Starting upload loop");
    
    while (uploadingMeetingsRef.current[meetingName]) {
      console.log("\n🔁 [UPLOAD_LOOP] Loop iteration for:", meetingId);
      
      try {
        await uploadOldestSegment(meetingId, emailId);
        
        const hasMore = await hasRemainingSegments(meetingId);
        console.log(`📊 [UPLOAD_LOOP] Has more segments: ${hasMore}`);
        
        if (!hasMore) {
          uploadingMeetingsRef.current[meetingName] = false;
          setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
          console.log(`✅ [UPLOAD_LOOP] All segments uploaded for meeting: ${meetingName}`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ [UPLOAD_LOOP] Error uploading segment:`, error);
        uploadingMeetingsRef.current[meetingName] = false;
        setUploadingMeetings(prev => ({ ...prev, [meetingName]: false }));
        break;
      }
    }
  } finally {
    // Always remove from running loops
    runningLoops.current.delete(meetingName);
    console.log("🏁 [UPLOAD_LOOP] Upload loop ended for:", meetingName);
  }
};
```

---

### 3. **IndexedDB: No Unique Constraint on Segments**

**Problem:**
```javascript
// In recording.js
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

**Issue:**
- Multiple segments can have same `meetingId + segmentIndex`
- If recording stops/starts rapidly, duplicate segments created
- Upload logic doesn't know which segment to upload

**Impact:**
- Duplicate segments in IndexedDB
- Wrong segment uploaded
- Segments uploaded multiple times

**Solution:**
```javascript
// In db.js - Add compound unique index
db.version(6).stores({
  chunks: "++id, userId, meetingId, [meetingId+segmentIndex], timestamp, retries, uploaded"
});

// In recording.js - Use put with unique key instead of add
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

---

### 4. **Network Failure: No Retry Logic**

**Problem:**
```javascript
// In uploadSegment.js
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes!

const response = await fetch(/* ... */);

if (!response.ok) {
  throw new Error(`Upload failed: ${response.statusText}`);
  // No retry, segment stays in DB forever
}
```

**Issue:**
- Network failures cause upload to fail
- No automatic retry
- Segment stays in IndexedDB
- User must manually retry

**Impact:**
- Segments stuck in IndexedDB
- Upload never completes
- Poor user experience

**Solution:**
```javascript
// Add retry logic with exponential backoff
const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 60000; // 1 minute

async function uploadSingleSegment(segment, meetingId, userEmail, retryCount = 0) {
  const segmentIndex = segment.segmentIndex;
  const uploadKey = `${meetingId}:${segmentIndex}`;
  
  activeUploads.add(uploadKey);
  
  try {
    console.log(`📤 [UPLOAD] Attempt ${retryCount + 1}/${MAX_RETRIES + 1} for segment ${segmentIndex}`);
    
    const file = new File([segment.blob], `segment-${segmentIndex}.webm`, {
      type: 'video/webm'
    });
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userEmail);
    formData.append("chunkIndex", segmentIndex);
    
    // Increase timeout with each retry
    const timeout = INITIAL_TIMEOUT * Math.pow(2, retryCount);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/uploadSegment/${meetingId}`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✅ [UPLOAD] Segment ${segmentIndex} uploaded successfully`);
    
    // Delete segment only after successful upload
    await db.chunks.delete(segment.id);
    console.log(`🗑️ [UPLOAD] Deleted segment ${segmentIndex} from IndexedDB`);
    
  } catch (error) {
    console.error(`❌ [UPLOAD] Error for segment ${segmentIndex}:`, error);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`🔄 [UPLOAD] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Remove from active uploads before retry
      activeUploads.delete(uploadKey);
      
      // Retry
      return uploadSingleSegment(segment, meetingId, userEmail, retryCount + 1);
    } else {
      console.error(`❌ [UPLOAD] Max retries reached for segment ${segmentIndex}`);
      
      // Update retry count in DB
      await db.chunks.update(segment.id, { 
        retries: (segment.retries || 0) + 1,
        lastError: error.message,
        lastAttempt: Date.now()
      });
      
      throw error;
    }
  } finally {
    activeUploads.delete(uploadKey);
  }
}
```

---

### 5. **Offline Detection: No Resume on Reconnect**

**Problem:**
```javascript
// In uploadSegment.js
if (!navigator.onLine) {
  console.log("❌ [UPLOAD] No internet connection");
  return; // Just returns, doesn't retry when online
}
```

**Issue:**
- Upload stops when offline
- Doesn't resume when back online
- User must manually restart upload

**Impact:**
- Incomplete uploads
- Poor user experience
- Segments stuck in IndexedDB

**Solution:**
```javascript
// In Home.jsx - Add online/offline listeners
useEffect(() => {
  const handleOnline = () => {
    console.log('🌐 [NETWORK] Back online');
    
    // Resume all paused uploads
    Object.keys(uploadingMeetingsRef.current).forEach(async (meetingName) => {
      if (uploadingMeetingsRef.current[meetingName]) {
        console.log(`🔄 [NETWORK] Resuming upload for: ${meetingName}`);
        
        // Check if there are segments to upload
        const meetingId = await getMeetingIdFromName(meetingName);
        const hasSegments = await hasRemainingSegments(meetingId);
        
        if (hasSegments && !runningLoops.current.has(meetingName)) {
          startUploadLoop(meetingName, meetingId);
        }
      }
    });
  };
  
  const handleOffline = () => {
    console.log('📴 [NETWORK] Gone offline');
    // Uploads will fail and retry when back online
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

// In uploadSegment.js - Check online status before each upload
export async function uploadOldestSegment(meetingId, userEmail) {
  if (!navigator.onLine) {
    console.log("❌ [UPLOAD] No internet connection, will retry when online");
    throw new Error('No internet connection');
  }
  
  // ... rest of upload logic
}
```

---

### 6. **Storage Quota: No Quota Checks**

**Problem:**
- No check for IndexedDB storage quota
- Recording fails silently when quota exceeded
- User doesn't know why recording stopped

**Issue:**
- Segments can't be saved to IndexedDB
- Recording appears to work but data is lost
- No warning to user

**Impact:**
- Lost recordings
- Confused users
- Data loss

**Solution:**
```javascript
// In recording.js - Check quota before saving
async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const percentUsed = (estimate.usage / estimate.quota) * 100;
    
    console.log(`💾 [STORAGE] Using ${percentUsed.toFixed(2)}% of quota`);
    console.log(`💾 [STORAGE] ${estimate.usage} / ${estimate.quota} bytes`);
    
    if (percentUsed > 90) {
      throw new Error('Storage quota almost full! Please upload existing recordings.');
    }
    
    if (percentUsed > 80) {
      console.warn(`⚠️ [STORAGE] Storage is ${percentUsed.toFixed(2)}% full`);
    }
  }
}

// In startSegmentRecording - Check before saving
recorder.onstop = async () => {
  try {
    // ... existing blob creation code ...
    
    // Check storage quota
    await checkStorageQuota();
    
    // Save to IndexedDB
    await db.chunks.put({
      id: uniqueId,
      userId: userEmail,
      blob: segmentBlob,
      meetingId: meetingName,
      segmentIndex: segmentIndex,
      timestamp: Date.now(),
      retries: 0,
      uploaded: false
    });
    
    console.log(`✅ [STEP 5] Segment ${segmentIndex} saved to IndexedDB`);
    
  } catch (error) {
    if (error.message.includes('quota')) {
      // Show user-friendly error
      alert('Storage is full! Please upload existing recordings before continuing.');
      stopRecording();
    }
    console.error("❌ Segment processing error:", error);
  }
};

// Add cleanup function for old segments
export async function cleanupOldSegments(meetingId) {
  try {
    // Delete segments older than 7 days that are already uploaded
    const oldSegments = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .filter(chunk => {
        const age = Date.now() - chunk.timestamp;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        return chunk.uploaded && age > sevenDays;
      })
      .toArray();
    
    if (oldSegments.length > 0) {
      await db.chunks.bulkDelete(oldSegments.map(s => s.id));
      console.log(`🗑️ [CLEANUP] Deleted ${oldSegments.length} old segments`);
    }
  } catch (error) {
    console.error('❌ [CLEANUP] Error cleaning up old segments:', error);
  }
}
```

---

### 7. **Blob Size: No Size Validation**

**Problem:**
- No check for blob size before upload
- Very large blobs (>100MB) may fail
- Backend may reject large files

**Issue:**
- Upload fails for large segments
- Network timeout
- Wasted bandwidth

**Impact:**
- Failed uploads
- Segments stuck in IndexedDB
- Poor user experience

**Solution:**
```javascript
// In uploadSegment.js - Add size validation
const MAX_BLOB_SIZE = 100 * 1024 * 1024; // 100MB
const WARN_BLOB_SIZE = 50 * 1024 * 1024; // 50MB

async function uploadSingleSegment(segment, meetingId, userEmail, retryCount = 0) {
  const segmentIndex = segment.segmentIndex;
  const uploadKey = `${meetingId}:${segmentIndex}`;
  
  activeUploads.add(uploadKey);
  
  try {
    // Validate blob size
    if (segment.blob.size > MAX_BLOB_SIZE) {
      console.error(`❌ [UPLOAD] Segment ${segmentIndex} too large: ${segment.blob.size} bytes`);
      throw new Error(`Segment too large: ${(segment.blob.size / 1024 / 1024).toFixed(2)}MB (max: 100MB)`);
    }
    
    if (segment.blob.size > WARN_BLOB_SIZE) {
      console.warn(`⚠️ [UPLOAD] Large segment ${segmentIndex}: ${(segment.blob.size / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.log(`📤 [UPLOAD] Segment ${segmentIndex} size: ${(segment.blob.size / 1024 / 1024).toFixed(2)}MB`);
    
    // ... rest of upload logic
    
  } catch (error) {
    // ... error handling
  } finally {
    activeUploads.delete(uploadKey);
  }
}
```

---

### 8. **Concurrent Uploads: No Rate Limiting**

**Problem:**
```javascript
const MAX_CONCURRENT_UPLOADS = 3; // Fixed limit
```

**Issue:**
- Fixed limit doesn't adapt to network conditions
- May be too aggressive on slow connections
- May be too conservative on fast connections

**Impact:**
- Slow uploads on fast connections
- Failed uploads on slow connections
- Suboptimal performance

**Solution:**
```javascript
// Dynamic concurrent upload limit based on network speed
let MAX_CONCURRENT_UPLOADS = 3;
let uploadSuccessCount = 0;
let uploadFailureCount = 0;

function adjustConcurrentUploads() {
  const successRate = uploadSuccessCount / (uploadSuccessCount + uploadFailureCount);
  
  if (successRate > 0.9 && MAX_CONCURRENT_UPLOADS < 5) {
    // High success rate, increase concurrency
    MAX_CONCURRENT_UPLOADS++;
    console.log(`📈 [UPLOAD] Increased concurrent uploads to ${MAX_CONCURRENT_UPLOADS}`);
  } else if (successRate < 0.7 && MAX_CONCURRENT_UPLOADS > 1) {
    // Low success rate, decrease concurrency
    MAX_CONCURRENT_UPLOADS--;
    console.log(`📉 [UPLOAD] Decreased concurrent uploads to ${MAX_CONCURRENT_UPLOADS}`);
  }
  
  // Reset counters
  uploadSuccessCount = 0;
  uploadFailureCount = 0;
}

// Adjust every 10 uploads
setInterval(() => {
  if (uploadSuccessCount + uploadFailureCount >= 10) {
    adjustConcurrentUploads();
  }
}, 30000); // Every 30 seconds

// Track success/failure
async function uploadSingleSegment(segment, meetingId, userEmail, retryCount = 0) {
  try {
    // ... upload logic ...
    uploadSuccessCount++;
  } catch (error) {
    uploadFailureCount++;
    throw error;
  }
}
```

---

### 9. **Upload Progress: No Progress Tracking**

**Problem:**
- User doesn't know upload progress
- No indication of how many segments left
- No ETA for completion

**Issue:**
- Poor user experience
- User doesn't know if upload is working
- Can't estimate completion time

**Solution:**
```javascript
// In Home.jsx - Add progress tracking
const [uploadProgress, setUploadProgress] = useState({});

const startUploadLoop = async (meetingName, meetingId) => {
  runningLoops.current.add(meetingName);
  
  try {
    // Get total segments
    const totalSegments = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .count();
    
    let uploadedCount = 0;
    
    while (uploadingMeetingsRef.current[meetingName]) {
      await uploadOldestSegment(meetingId, emailId);
      
      uploadedCount += 3; // MAX_CONCURRENT_UPLOADS
      const progress = Math.min((uploadedCount / totalSegments) * 100, 100);
      
      setUploadProgress(prev => ({
        ...prev,
        [meetingName]: {
          uploaded: uploadedCount,
          total: totalSegments,
          percentage: progress.toFixed(0)
        }
      }));
      
      const hasMore = await hasRemainingSegments(meetingId);
      if (!hasMore) break;
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } finally {
    runningLoops.current.delete(meetingName);
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[meetingName];
      return newProgress;
    });
  }
};

// In JSX - Show progress
{uploadProgress[m.meeting] && (
  <div className="mt-2">
    <div className="w-full bg-gray-700 rounded-full h-2">
      <div 
        className="bg-[#FFBA08] h-2 rounded-full transition-all duration-300"
        style={{ width: `${uploadProgress[m.meeting].percentage}%` }}
      />
    </div>
    <p className="text-xs text-gray-400 mt-1">
      {uploadProgress[m.meeting].uploaded} / {uploadProgress[m.meeting].total} segments
      ({uploadProgress[m.meeting].percentage}%)
    </p>
  </div>
)}
```

---

### 10. **Error Recovery: No Failed Upload Queue**

**Problem:**
- Failed uploads are lost
- No way to retry failed segments
- User must manually restart entire upload

**Issue:**
- Segments with permanent errors stuck in DB
- No visibility into failed uploads
- No recovery mechanism

**Solution:**
```javascript
// Add failed upload tracking
const failedUploads = new Map(); // meetingId -> [segmentIndices]

async function uploadSingleSegment(segment, meetingId, userEmail, retryCount = 0) {
  try {
    // ... upload logic ...
    
    // Remove from failed uploads on success
    if (failedUploads.has(meetingId)) {
      const failed = failedUploads.get(meetingId);
      const index = failed.indexOf(segment.segmentIndex);
      if (index > -1) {
        failed.splice(index, 1);
      }
    }
    
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      // Add to failed uploads
      if (!failedUploads.has(meetingId)) {
        failedUploads.set(meetingId, []);
      }
      failedUploads.get(meetingId).push(segment.segmentIndex);
      
      console.error(`❌ [UPLOAD] Segment ${segment.segmentIndex} permanently failed`);
    }
    throw error;
  }
}

// Function to retry failed uploads
export async function retryFailedUploads(meetingId, userEmail) {
  const failed = failedUploads.get(meetingId) || [];
  
  if (failed.length === 0) {
    console.log('✅ [RETRY] No failed uploads to retry');
    return;
  }
  
  console.log(`🔄 [RETRY] Retrying ${failed.length} failed segments`);
  
  for (const segmentIndex of failed) {
    const segment = await db.chunks
      .where('[meetingId+segmentIndex]')
      .equals([meetingId, segmentIndex])
      .first();
    
    if (segment) {
      try {
        await uploadSingleSegment(segment, meetingId, userEmail, 0);
      } catch (error) {
        console.error(`❌ [RETRY] Failed to retry segment ${segmentIndex}`);
      }
    }
  }
}

// Export function to get failed uploads
export function getFailedUploads(meetingId) {
  return failedUploads.get(meetingId) || [];
}
```

---

## 📋 IMPLEMENTATION PRIORITY

### High Priority (Implement First):
1. ✅ Fix activeUploads tracking (meetingId:segmentIndex)
2. ✅ Prevent multiple upload loops
3. ✅ Add retry logic with exponential backoff
4. ✅ Add unique constraint to IndexedDB
5. ✅ Add storage quota checks

### Medium Priority:
6. ✅ Add offline/online detection
7. ✅ Add blob size validation
8. ✅ Add upload progress tracking
9. ✅ Add failed upload queue

### Low Priority (Nice to Have):
10. ✅ Dynamic concurrent upload adjustment
11. ✅ Cleanup old segments
12. ✅ Upload speed monitoring

## 🧪 TESTING CHECKLIST

- [ ] Upload from multiple meetings simultaneously
- [ ] Click upload button rapidly (multiple times)
- [ ] Disconnect internet during upload
- [ ] Fill up storage quota
- [ ] Upload very large segments (>50MB)
- [ ] Slow network simulation
- [ ] Server errors (500, 503)
- [ ] Browser tab close during upload
- [ ] Multiple browser tabs same meeting

## 📊 MONITORING RECOMMENDATIONS

Add logging for:
- Upload success/failure rates
- Average upload time per segment
- Storage quota usage
- Failed upload counts
- Network errors
- Retry attempts

This will help identify issues in production.
