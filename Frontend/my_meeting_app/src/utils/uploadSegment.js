import { db } from "../db/db.js";

let activeUploads = new Set(); // Track active upload segment indices
const MAX_CONCURRENT_UPLOADS = 3; // Upload up to 3 segments in parallel

export async function uploadOldestSegment(meetingId, userEmail) {
  if (!navigator.onLine) {
    console.log("❌ [UPLOAD] No internet connection");
    return;
  }
  
  console.log("🚀 [STEP 6] Starting upload process...");
  
  try {
    // Get all segments that haven't been uploaded yet
    const allSegments = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .toArray();
    
    if (allSegments.length === 0) {
      console.log("✅ [UPLOAD] No segments to upload");
      return;
    }
    
    // Filter out segments that are currently being uploaded
    const availableSegments = allSegments.filter(s => !activeUploads.has(s.segmentIndex));
    
    if (availableSegments.length === 0) {
      console.log("⚠️ [UPLOAD] All segments are currently being uploaded");
      return;
    }
    
    // Sort by segment index and take up to MAX_CONCURRENT_UPLOADS
    const segmentsToUpload = availableSegments
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .slice(0, MAX_CONCURRENT_UPLOADS);
    
    console.log(`📤 [UPLOAD] Uploading ${segmentsToUpload.length} segments in parallel`);
    
    // Upload segments in parallel
    const uploadPromises = segmentsToUpload.map(segment => 
      uploadSingleSegment(segment, meetingId, userEmail)
    );
    
    await Promise.allSettled(uploadPromises);
    
  } catch (error) {
    console.error(`❌ [UPLOAD ERROR]:`, error);
  }
}

async function uploadSingleSegment(segment, meetingId, userEmail) {
  const segmentIndex = segment.segmentIndex;
  
  // Mark as being uploaded
  activeUploads.add(segmentIndex);
  
  try {
    console.log(`📤 [STEP 7] Preparing to upload segment ${segmentIndex}`);
    console.log(`   - Blob size: ${segment.blob.size} bytes`);
    console.log(`   - Blob type: ${segment.blob.type}`);
    
    // Create FormData with proper File object
    const file = new File([segment.blob], `segment-${segmentIndex}.webm`, {
      type: 'video/webm'
    });
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userEmail);
    formData.append("chunkIndex", segmentIndex);
    
    console.log(`📨 [STEP 8] FormData created for segment ${segmentIndex}`);
    console.log(`   - File name: ${file.name}`);
    console.log(`   - File type: ${file.type}`);
    console.log(`   - File size: ${file.size}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes to match backend
    
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
    console.log(`✅ [STEP 9] Segment ${segmentIndex} uploaded successfully:`, result);
    
    // Delete segment only after successful upload
    await db.chunks.delete(segment.id);
    
    console.log(`🗑️ [STEP 10] Deleted segment ${segmentIndex} from IndexedDB`);
    
  } catch (error) {
    console.error(`❌ [UPLOAD ERROR] Segment ${segmentIndex}:`, error);
    throw error; // Re-throw to be caught by Promise.allSettled
  } finally {
    // Remove from active uploads
    activeUploads.delete(segmentIndex);
  }
}

export function isUploadInProgress() {
  return activeUploads.size > 0;
}
