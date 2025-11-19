let mediaRecorder;
let chunks = [];
let currentStream = null;
let isRecording = false;
let currentMeetingName = null;
let currentUserEmail = null;
let cleanupHandlers = [];

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

      // Setup recorder
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: "video/webm" });
          console.log("Recording stopped, uploading...", blob.size, "bytes");
          
          // Upload recording
          uploadRecording(blob, meetingName, currentUserEmail);
        } else {
          console.log("No recording data to upload");
        }
        
        // Cleanup
        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
      };

      // Setup cleanup handlers for page unload
      setupCleanupHandlers(meetingName);

      mediaRecorder.start(1000); // collect data every 1s
      console.log("Recording started.");
    } catch (err) {
      console.error("Error accessing camera/mic:", err);
      isRecording = false;
    }
  } else {
    console.log("getUserMedia not supported!");
  }
}

export function stopRecording(meetingName) {
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
          try{
            mediaRecorder.stop();
          }catch(e){}
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

  fetch(`https://streamapp-uyjv.onrender.com/upload/${meetingId}`, {
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

  // --- Step 1: Upload to Cloudinary ---
  const formData = new FormData();
  formData.append("file", blob, `user-${Date.now()}.webm`);
  formData.append("upload_preset", "YOUR_UNSIGNED_PRESET"); // Cloudinary unsigned preset
  formData.append("folder", `meeting_recordings/${meetingId}`); // optional folder

  try {
    // NOTE: Replace 'YOUR_CLOUD_NAME' with your actual Cloudinary cloud name
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
      { method: "POST", body: formData }
    );

    const cloudData = await cloudRes.json();

    if (!cloudData.secure_url) {
      console.error("Cloudinary upload failed:", cloudData);
      throw new Error("Cloudinary upload failed");
    }

    console.log("Uploaded to Cloudinary:", cloudData.secure_url);

    // --- Step 2: Notify backend ---
    // Backend expects JSON, so send userEmail and videoUrl
    const backendRes = await fetch(
      `https://streamapp-uyjv.onrender.com/upload/${meetingId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail,       // your participant's email
          videoUrl: cloudData.secure_url // Cloudinary video URL
        })
      }
    );

    const backendData = await backendRes.json();
    console.log("Backend response:", backendData);

    return cloudData.secure_url; // return Cloudinary URL for further use

  } catch (err) {
    console.error("Upload failed:", err);
    throw err;
  }
}
