import { appendBlob } from './appendBlob.js';

let mediaRecorder;
let currentStream = null;
let isRecording = false;
let currentMeetingName = null;
let currentUserEmail = null;
let cleanupHandlers = [];
let uploadInterval = null;
let chunkCounter = 0;
let segmentCounter = 0; // Track 60-second segments

// Track recording state
export function isRecordingActive() {
  return isRecording && mediaRecorder && mediaRecorder.state === 'recording';
}

// Get current meeting name
export function getCurrentMeetingName() {
  return currentMeetingName;
}

export async function startRecording(meetingName, userEmail = null) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    console.log("getUserMedia supported.");

    try {
      // Capture both video and audio
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

      // Setup recorder
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      mediaRecorder.ondataavailable = async (e) => {
        chunkCounter++;
        if (e.data.size > 0) {
          console.log(`Chunk ${chunkCounter} received, size: ${e.data.size} bytes`);
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

      // Setup cleanup handlers for page unload
      setupCleanupHandlers(meetingName);

      mediaRecorder.start(2000); // collect data every 2s
      
      // Start 60-second upload interval
      startUploadInterval(meetingName, userEmail);
      
      console.log("Recording started.");
    } catch (err) {
      console.error("Error accessing camera/mic:", err);
      isRecording = false;
    }
  } else {
    console.log("getUserMedia not supported!");
  }
}

// Upload every 60 seconds
function startUploadInterval(meetingName, userEmail) {
  uploadInterval = setInterval(async () => {
    console.log("⏰ 60 seconds elapsed - uploading segment...");
    
    // Stop current recording temporarily
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      
      // Wait a bit for final chunks
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Upload the current segment
      const success = await uploadSegment(meetingName, userEmail, segmentCounter);
      
      if (success) {
        console.log("✅ Segment uploaded successfully, restarting recorder...");
        segmentCounter++;
        chunkCounter = 0; // Reset chunk counter for new segment
        
        // Restart recording
        if (currentStream && isRecording) {
          mediaRecorder = new MediaRecorder(currentStream, {
            mimeType: "video/webm;codecs=vp9,opus",
          });
          
          mediaRecorder.ondataavailable = async (e) => {
            chunkCounter++;
            if (e.data.size > 0) {
              console.log(`Chunk ${chunkCounter} received, size: ${e.data.size} bytes`);
              await appendBlob({
                userEmail: userEmail, 
                meetingId: meetingName,
                blob: e.data, 
                chunkIndex: chunkCounter,
                segmentIndex: segmentCounter
              });
            }
          };
          
          mediaRecorder.start(2000);
        }
      } else {
        console.log("❌ Segment upload failed, continuing to next segment...");
        segmentCounter++;
        
        // Restart recording anyway
        if (currentStream && isRecording) {
          mediaRecorder = new MediaRecorder(currentStream, {
            mimeType: "video/webm;codecs=vp9,opus",
          });
          
          mediaRecorder.ondataavailable = async (e) => {
            chunkCounter++;
            if (e.data.size > 0) {
              await appendBlob({
                userEmail: userEmail, 
                meetingId: meetingName,
                blob: e.data, 
                chunkIndex: chunkCounter,
                segmentIndex: segmentCounter
              });
            }
          };
          
          mediaRecorder.start(2000);
        }
      }
    }
  }, 60000); // 60 seconds
}

// Upload a segment (merge chunks and upload)
async function uploadSegment(meetingId, userEmail, segmentIndex) {
  try {
    const { db } = await import('../db/db.js');
    
    // Get all chunks for this segment
    const chunks = await db.chunks
      .where('segmentIndex')
      .equals(segmentIndex)
      .sortBy('chunkIndex');
    
    if (chunks.length === 0) {
      console.log("No chunks to upload for segment", segmentIndex);
      return true;
    }
    
    console.log(`📦 Merging ${chunks.length} chunks for segment ${segmentIndex}...`);
    
    // Merge all blobs
    const blobs = chunks.map(c => c.blob);
    const mergedBlob = new Blob(blobs, { type: 'video/webm' });
    
    console.log(`📤 Uploading merged segment ${segmentIndex} (${mergedBlob.size} bytes)...`);
    
    // Upload to Cloudinary
    const formData = new FormData();
    formData.append("file", mergedBlob, `segment-${segmentIndex}.webm`);
    formData.append("userId", userEmail);
    formData.append("segmentIndex", segmentIndex);
    
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/uploadSegment/${meetingId}`,
      {
        method: 'POST',
        body: formData
      }
    );
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Segment ${segmentIndex} uploaded:`, result);
    
    // Delete chunks from IndexedDB
    for (const chunk of chunks) {
      await db.chunks.delete(chunk.id);
    }
    
    console.log(`🗑️ Deleted ${chunks.length} chunks from IndexedDB`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error uploading segment ${segmentIndex}:`, error);
    return false;
  }
}

export function stopRecording(meetingName) {
  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log("Recording stopped manually.");
  }
}

// Setup event handlers for page unload/close
function setupCleanupHandlers(meetingName) {
  // Remove existing handlers
  cleanupHandlers.forEach(({ event, handler, target }) => {
    target.removeEventListener(event, handler);
  });
  cleanupHandlers = [];

  // Handler for page unload (user closes tab/browser)
  const handleBeforeUnload = (e) => {
    if (isRecordingActive()) {
      // Stop recording before page unloads
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        try {
          mediaRecorder.requestData();
          mediaRecorder.stop();
          // Request final data
          mediaRecorder.requestData();
        } catch (err) {
          console.error("Error stopping recorder on unload:", err);
        }
      }
      
      // Upload using fetch with keepalive (more reliable than sendBeacon for FormData)
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: "video/webm" });
        uploadRecordingWithKeepalive(blob, meetingName, currentUserEmail);
      }
    }
  };

  // Handler for visibility change (tab switch, minimize)
  const handleVisibilityChange = () => {
    if (document.hidden && isRecordingActive()) {
      // Tab is hidden, but keep recording
      // We'll upload when they come back or leave
      console.log("Tab hidden, recording continues...");
    }
  };

  // Handler for pagehide (more reliable than beforeunload)
  const handlePageHide = (e) => {
    if (isRecordingActive()) {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.requestData();
      }
      
      // Upload using keepalive
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: "video/webm" });
        uploadRecordingWithKeepalive(blob, meetingName, currentUserEmail);
      }
    }
  };

  // Add event listeners
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  cleanupHandlers = [
    { event: 'beforeunload', handler: handleBeforeUnload, target: "window" },
    { event: 'pagehide', handler: handlePageHide, target: "window" },
    { event: 'visibilitychange', handler: handleVisibilityChange, target: "document" }
  ];
}

// Cleanup function
function cleanup() {
  // Stop all tracks
  if (currentStream) {
    currentStream.getTracks().forEach(track => {
      track.stop();
    });
    currentStream = null;
  }

  // Clear chunks
  chunks = [];
  isRecording = false;
  currentMeetingName = null;
  currentUserEmail = null;

  // Remove event listeners
  cleanupHandlers.forEach(({ event, handler }) => {
    window.removeEventListener(event, handler);
    document.removeEventListener(event, handler);
  });
  cleanupHandlers = [];
}

// Export cleanup function for manual cleanup
export function cleanupRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  cleanup();
}

// Upload with keepalive (for page unload scenarios)
function uploadRecordingWithKeepalive(blob, meetingId, userEmail) {
  const formData = new FormData();
  formData.append("file", blob, `user-${Date.now()}.webm`);
  if (userEmail) {
    formData.append("userEmail", userEmail);
  }

  fetch(`${import.meta.env.VITE_BACKEND_URL}/upload/${meetingId}`, {
    method: "POST",
    body: formData,
    keepalive: true, // Ensures request continues even if page closes
  })
  .then((res) => {
    console.log("Uploaded on page unload:", res);
  })
  .catch((err) => {
    console.error("Upload failed on page unload:", err);
  });
}

async function uploadRecording(blob, meetingId, userEmail) {
  console.log("inside upload function");
  console.log("userEMail", userEmail);
    

  // --- Step 1: Upload to Cloudinary ---
  const formData = new FormData();
  formData.append("file", blob, `user-${Date.now()}.webm`);
  formData.append("upload_preset", "THIS_IS_MY_PRESET"); // Cloudinary unsigned preset
  formData.append("folder", `meeting_recordings/${meetingId}`); // optional folder

  try {
    // NOTE: Replace 'YOUR_CLOUD_NAME' with your actual Cloudinary cloud name
    const cloudRes = await fetch(
      `${import.meta.env.VITE_CLOUDINARY_URL}/video/upload`,
      { method: "POST", body: formData }
    );

    
    const cloudData = await cloudRes.json();
    console.log("videoUrl", cloudData);

    if (!cloudData.secure_url) {
      console.error("Cloudinary upload failed:", cloudData);
      throw new Error("Cloudinary upload failed");
    }

    console.log("Uploaded to Cloudinary:", cloudData.secure_url);

    // --- Step 2: Notify backend ---
    // Backend expects JSON, so send userEmail and videoUrl

    const backendRes = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/upload/${meetingId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userEmail,       // your participant's email
          videoPublicId: cloudData.secure_url // Cloudinary video URL
        })
      }
    );

    const backendData = await backendRes.json();
    console.log("Backend response:", backendData);

    return cloudData.secure_url; // return Cloudinary URL for further use

  } catch (err) {
    console.error("Upload failed:", err.message);
    throw err;
  }
}
