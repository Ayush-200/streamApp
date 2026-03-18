import { db } from "../db/db.js";

let isUploading = false;

export async function uploadOldestSegment(meetingId, userEmail) {
  if (isUploading) {
    console.log("⚠️ [UPLOAD] Already in progress, skipping...");
    return;
  }
  
  if (!navigator.onLine) {
    console.log("❌ [UPLOAD] No internet connection");
    return;
  }
  
  isUploading = true;
  console.log("🚀 [STEP 6] Starting upload process...");
  
  try {
    // Get all segments
    const allSegments = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .toArray();
    
    if (allSegments.length === 0) {
      console.log("✅ [UPLOAD] No segments to upload");
      return;
    }
    
    // Find oldest segment
    const oldestSegmentIndex = Math.min(...allSegments.map(c => c.segmentIndex));
    const segment = allSegments.find(c => c.segmentIndex === oldestSegmentIndex);
    
    console.log(`📤 [STEP 7] Preparing to upload segment ${oldestSegmentIndex}`);
    console.log(`   - Blob size: ${segment.blob.size} bytes`);
    console.log(`   - Blob type: ${segment.blob.type}`);
    
    // Read first 20 bytes to verify it's video data
    const firstBytes = await segment.blob.slice(0, 20).arrayBuffer();
    console.log(`   - First 20 bytes:`, new Uint8Array(firstBytes));
    
    // Create FormData with proper File object
    const file = new File([segment.blob], `segment-${oldestSegmentIndex}.webm`, {
      type: 'video/webm'
    });
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userEmail);
    formData.append("chunkIndex", oldestSegmentIndex);
    
    console.log(`📨 [STEP 8] FormData created with File object`);
    console.log(`   - File name: ${file.name}`);
    console.log(`   - File type: ${file.type}`);
    console.log(`   - File size: ${file.size}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
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
    console.log(`✅ [STEP 9] Segment ${oldestSegmentIndex} uploaded successfully:`, result);
    
    // Delete segment only after successful upload
    await db.chunks.delete(segment.id);
    
    console.log(`🗑️ [STEP 10] Deleted segment ${oldestSegmentIndex} from IndexedDB`);
    
  } catch (error) {
    console.error(`❌ [UPLOAD ERROR]:`, error);
  } finally {
    isUploading = false;
  }
}

export function isUploadInProgress() {
  return isUploading;
}
