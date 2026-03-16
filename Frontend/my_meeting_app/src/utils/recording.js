import { appendBlob } from './appendBlob.js';

let mediaRecorder;
let currentStream = null;
let isRecording = false;
let currentMeetingName = null;
let currentUserEmail = null;
let uploadInterval = null;
let chunkCounter = 0;
let segmentCounter = 0;
let isUploading = false;

export function isRecordingActive() {
  return isRecording && mediaRecorder && mediaRecorder.state === 'recording';
}

export function getCurrentMeetingName() {
  return currentMeetingName;
}

export async function startRecording(meetingName, userEmail = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.log("getUserMedia not supported!");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true,
      audio: true,
    });

    currentStream = stream;
    currentMeetingName = meetingName;
    currentUserEmail = userEmail;
    isRecording = true;
    chunkCounter = 0;
    segmentCounter = 0;

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9,opus",
    });

    mediaRecorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        chunkCounter++;
        console.log(`Chunk ${chunkCounter} (segment ${segmentCounter}), size: ${e.data.size} bytes`);
        await appendBlob({
          userEmail: userEmail, 
          meetingId: meetingName,
          blob: e.data, 
          chunkIndex: chunkCounter,
          segmentIndex: segmentCounter
        });
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
    };

    mediaRecorder.start(2000); // Collect data every 2s
    
    // Start upload interval
    startUploadInterval(meetingName, userEmail);
    
    console.log("Recording started.");
  } catch (err) {
    console.error("Error accessing camera/mic:", err);
    isRecording = false;
  }
}

function startUploadInterval(meetingName, userEmail) {
  uploadInterval = setInterval(async () => {
    console.log("⏰ 60 seconds elapsed - finalizing segment and starting new one...");
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Request final data to ensure we get the last chunk
      mediaRecorder.requestData();
      
      // Stop to finalize the segment (adds proper end markers)
      mediaRecorder.stop();
      
      // Wait for ondataavailable to process the final chunk
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Move to next segment
      segmentCounter++;
      chunkCounter = 0;
      
      // Upload oldest segment in background
      if (!isUploading) {
        uploadOldestSegment(meetingName, userEmail);
      }
      
      // Restart MediaRecorder for new segment (gets new headers)
      if (currentStream && isRecording) {
        mediaRecorder = new MediaRecorder(currentStream, {
          mimeType: "video/webm;codecs=vp9,opus",
        });

        mediaRecorder.ondataavailable = async (e) => {
          if (e.data.size > 0) {
            chunkCounter++;
            console.log(`Chunk ${chunkCounter} (segment ${segmentCounter}), size: ${e.data.size} bytes`);
            await appendBlob({
              userEmail: userEmail, 
              meetingId: meetingName,
              blob: e.data, 
              chunkIndex: chunkCounter,
              segmentIndex: segmentCounter
            });
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error("MediaRecorder error:", event.error);
        };

        mediaRecorder.start(2000);
        console.log(`✅ Started recording segment ${segmentCounter}`);
      }
    }
  }, 60000);
}

async function uploadOldestSegment(meetingId, userEmail) {
  if (isUploading) {
    console.log("⚠️ Upload already in progress, skipping...");
    return;
  }
  
  if (!navigator.onLine) {
    console.log("❌ No internet connection");
    return;
  }
  
  isUploading = true;
  
  try {
    const { db } = await import('../db/db.js');
    
    // Get all chunks
    const allChunks = await db.chunks
      .where('meetingId')
      .equals(meetingId)
      .toArray();
    
    if (allChunks.length === 0) {
      console.log("✅ No chunks to upload");
      return;
    }
    
    // Find oldest segment
    const oldestSegmentIndex = Math.min(...allChunks.map(c => c.segmentIndex));
    
    // Get chunks for oldest segment, sorted by chunkIndex
    const chunks = allChunks
      .filter(c => c.segmentIndex === oldestSegmentIndex)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    
    console.log(`📦 Uploading segment ${oldestSegmentIndex} with ${chunks.length} chunks`);
    
    // Merge blobs
    const blobs = chunks.map(c => c.blob);
    const mergedBlob = new Blob(blobs, { type: 'video/webm' });
    
    console.log(`📤 Uploading ${mergedBlob.size} bytes...`);
    
    // Upload
    const formData = new FormData();
    formData.append("file", mergedBlob, `segment-${oldestSegmentIndex}.webm`);
    formData.append("userId", userEmail);
    formData.append("chunkIndex", oldestSegmentIndex);
    
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
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    console.log(`✅ Segment ${oldestSegmentIndex} uploaded successfully`);
    
    // Delete chunks only after successful upload
    for (const chunk of chunks) {
      await db.chunks.delete(chunk.id);
    }
    
    console.log(`🗑️ Deleted ${chunks.length} chunks from IndexedDB`);
    
  } catch (error) {
    console.error(`❌ Upload error:`, error);
  } finally {
    isUploading = false;
  }
}

export function stopRecording() {
  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log("Recording stopped.");
  }
  
  isRecording = false;
}

export function cleanupRecording() {
  stopRecording();
  
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}
