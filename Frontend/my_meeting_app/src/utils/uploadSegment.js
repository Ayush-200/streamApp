import { db } from "../db/db.js";

let activeUploads = new Set();
const MAX_CONCURRENT_UPLOADS = 3;

export async function uploadOldestSegment(meetingId, userEmail, getAccessTokenSilently) {
  if (!navigator.onLine) {
    console.log("❌ No internet connection");
    return;
  }
  
  try {
    // Get all segments that haven't been uploaded yet
    const allSegments = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .toArray();
    
    if (allSegments.length === 0) {
      return;
    }
    
    // Filter out segments that are currently being uploaded
    const availableSegments = allSegments.filter(s => !activeUploads.has(s.segmentIndex));
    
    if (availableSegments.length === 0) {
      return;
    }
    
    // Sort by segment index and take up to MAX_CONCURRENT_UPLOADS
    const segmentsToUpload = availableSegments
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .slice(0, MAX_CONCURRENT_UPLOADS);
    
    console.log(`📤 Uploading ${segmentsToUpload.length} segments: [${segmentsToUpload.map(s => s.segmentIndex).join(', ')}]`);
    
    // Upload segments in parallel
    const uploadPromises = segmentsToUpload.map(segment => 
      uploadSingleSegment(segment, meetingId, userEmail, getAccessTokenSilently)
    );
    
    await Promise.allSettled(uploadPromises);
    
  } catch (error) {
    console.error(`❌ Upload error:`, error);
  }
}

async function uploadSingleSegment(segment, meetingId, userEmail, getAccessTokenSilently) {
  const segmentIndex = segment.segmentIndex;
  
  activeUploads.add(segmentIndex);
  
  try {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN || 'dev-6u7dy62xhf1femi3.us.auth0.com'}/api/v2/`,
      }
    });
    
    const file = new File([segment.blob], `segment-${segmentIndex}.webm`, {
      type: 'video/webm'
    });
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userEmail);
    formData.append("chunkIndex", segmentIndex);
    if (segment.chunkStartTime !== undefined) {
      formData.append("chunkStartTime", segment.chunkStartTime);
      formData.append("chunkEndTime", segment.chunkEndTime);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);
    
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/uploadSegment/${meetingId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }
    
    // const result = await response.json();
    console.log(`✅ Segment ${segmentIndex} uploaded (${(segment.blob.size / 1024 / 1024).toFixed(2)}MB)`);
    
    // Delete segment only after successful upload
    await db.chunks.delete(segment.id);
    
  } catch (error) {
    console.error(`❌ Segment ${segmentIndex} upload failed:`, error.message);
    throw error; // Re-throw to be caught by Promise.allSettled
  } finally {
    // Remove from active uploads
    activeUploads.delete(segmentIndex);
  }
}

export function isUploadInProgress() {
  return activeUploads.size > 0;
}

// Check if there are any segments remaining in IndexedDB for a meeting
export async function hasRemainingSegments(meetingId) {
  try {
    const count = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .count();
    
    return count > 0;
  } catch (error) {
    console.error(`❌ Error checking remaining segments:`, error);
    return false;
  }
}
